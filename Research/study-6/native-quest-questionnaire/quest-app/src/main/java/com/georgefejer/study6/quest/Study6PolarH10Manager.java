package com.georgefejer.study6.quest;

import android.Manifest;
import android.annotation.SuppressLint;
import android.app.Activity;
import android.bluetooth.BluetoothAdapter;
import android.bluetooth.BluetoothDevice;
import android.bluetooth.BluetoothGatt;
import android.bluetooth.BluetoothGattCallback;
import android.bluetooth.BluetoothGattCharacteristic;
import android.bluetooth.BluetoothGattDescriptor;
import android.bluetooth.BluetoothManager;
import android.bluetooth.BluetoothProfile;
import android.bluetooth.BluetoothStatusCodes;
import android.bluetooth.le.ScanCallback;
import android.bluetooth.le.ScanResult;
import android.bluetooth.le.ScanSettings;
import android.content.Context;
import android.content.pm.PackageManager;
import android.os.Build;
import android.os.ParcelUuid;
import android.os.SystemClock;
import android.util.Log;

import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

import java.io.BufferedReader;
import java.io.BufferedWriter;
import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.io.IOException;
import java.io.InputStreamReader;
import java.io.OutputStreamWriter;
import java.nio.ByteBuffer;
import java.nio.ByteOrder;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;
import java.util.Locale;
import java.util.UUID;
import java.util.concurrent.LinkedBlockingQueue;
import java.util.concurrent.TimeUnit;

final class Study6PolarH10Manager implements AutoCloseable {
    interface StatusListener {
        void onPolarStatus(JSONObject status);
    }

    private static final String TAG = "Study6PolarH10";
    private static final int REQUEST_BLUETOOTH_PERMISSIONS = 606;
    private static final long DEFAULT_SCAN_TIMEOUT_MS = 45_000L;
    private static final long CONNECT_TIMEOUT_MS = 15_000L;
    private static final long SERVICE_DISCOVERY_TIMEOUT_MS = 12_000L;
    private static final long MTU_TIMEOUT_MS = 5_000L;
    private static final long GATT_OPERATION_TIMEOUT_MS = 6_000L;
    private static final long CONTROL_RESPONSE_TIMEOUT_MS = 8_000L;
    private static final long STATUS_PUBLISH_INTERVAL_MS = 200L;
    private static final long POLAR_RECONNECT_TOLERANCE_MS = 20_000L;
    private static final long READY_STABLE_REQUIRED_MS = 3_000L;
    private static final long ECG_STALL_TIMEOUT_MS = 5_000L;
    private static final long SCAN_SETTLE_MS = 3_500L;
    private static final int EARLY_ACCEPT_SCORE = 180;
    private static final int GATT_START_FAILED = -1;
    private static final int GATT_CONNECTION_TIMEOUT = -2;
    private static final int PREFERRED_MTU = 232;
    private static final int CONNECT_ATTEMPTS = 3;
    private static final int STRONG_CANDIDATE_SCORE = 80;
    private static final int RECENT_ECG_SAMPLE_LIMIT = 260;
    private static final int MAX_SCAN_CANDIDATE_SUMMARIES = 12;

    private static final UUID HEART_RATE_SERVICE =
            UUID.fromString("0000180d-0000-1000-8000-00805f9b34fb");
    private static final UUID HEART_RATE_MEASUREMENT =
            UUID.fromString("00002a37-0000-1000-8000-00805f9b34fb");
    private static final UUID PMD_SERVICE =
            UUID.fromString("fb005c80-02e7-f387-1cad-8acd2d8df0c8");
    private static final UUID PMD_CONTROL_POINT =
            UUID.fromString("fb005c81-02e7-f387-1cad-8acd2d8df0c8");
    private static final UUID PMD_DATA =
            UUID.fromString("fb005c82-02e7-f387-1cad-8acd2d8df0c8");
    private static final UUID CCCD_DESCRIPTOR =
            UUID.fromString("00002902-0000-1000-8000-00805f9b34fb");

    private static final byte MEASUREMENT_TYPE_ECG = 0x00;
    private static final byte OPCODE_GET_SETTINGS = 0x01;
    private static final byte OPCODE_START_STREAM = 0x02;
    private static final byte OPCODE_STOP_STREAM = 0x03;
    private static final int RESPONSE_FRAME_ID = 0xF0;
    private static final int ECG_SAMPLE_RATE_HZ = 130;
    private static final int ECG_RESOLUTION_BITS = 14;
    private static final long ECG_SAMPLE_INTERVAL_NS = 1_000_000_000L / ECG_SAMPLE_RATE_HZ;
    private static final long ECG_QC_MAX_SINGLE_GAP_NS = 20_000_000_000L;
    private static final double MIN_BLOCK_ECG_COVERAGE_RATIO = 0.80d;
    private static final String BLOCK_ECG_CSV_HEADER = "sample_id,apk_file_code,participant_id,apk_variant_id,block_order,block_id,vr_condition_id,device_id,device_name,device_address,sample_index,polar_sample_timestamp_ns,host_received_timestamp_utc,host_received_elapsed_realtime_ns,ecg_raw,ecg_unit,contact_quality,source,recording_started_at_utc,sync_start_elapsed_realtime_ns,sample_offset_from_sync_start_ns";
    private static final String MASTER_ECG_CSV_HEADER = "sample_id,apk_file_code,participant_id,apk_variant_id,session_id,device_id,device_name,device_address,session_sample_index,polar_sample_timestamp_ns,host_received_timestamp_utc,host_received_elapsed_realtime_ns,ecg_raw,ecg_unit,contact_quality,source,session_recording_started_at_utc,session_recording_start_elapsed_realtime_ns,active_window_id,active_block_order,active_block_id,active_block_file_stem,active_vr_condition_id,active_coherence_level,active_energy_noise_level,active_audio_variant_id,active_window_start_elapsed_realtime_ns,sample_offset_from_active_window_start_ns";

    private final Context context;
    private final StatusListener listener;
    private final Object lock = new Object();
    private final int[] recentEcgSamples = new int[RECENT_ECG_SAMPLE_LIMIT];

    private volatile boolean stopRequested;
    private Thread workerThread;
    private BluetoothGatt gatt;
    private GattCallback callback;

    private String requestedDeviceAddress = "";
    private String lastSuccessfulDeviceAddress = "";
    private String statusState = "idle";
    private String deviceName = "";
    private String deviceAddress = "";
    private String lastError = "";
    private String missingPermissions = "";
    private int rssi = Integer.MIN_VALUE;
    private int heartRateBpm;
    private int rrIntervalCount;
    private int negotiatedMtu;
    private boolean heartRateServiceVisible;
    private boolean pmdServiceVisible;
    private boolean pmdControlPointIndicationsEnabled;
    private boolean pmdDataNotificationsEnabled;
    private boolean pmdSettingsReceived;
    private boolean pmdStartResponseReceived;
    private boolean ecgStreamStarted;
    private long heartRateEventCount;
    private long ecgFrameCount;
    private long ecgSampleCount;
    private long malformedFrameCount;
    private long latestFrameElapsedNs;
    private long latestSensorTimestampNs;
    private int latestFrameSampleCount;
    private int recentEcgWriteIndex;
    private int recentEcgCount;
    private JSONArray recentScanCandidates = new JSONArray();
    private long lastStatusPublishElapsedMs;
    private long readyCandidateSinceElapsedMs;
    private long sessionReadyAtElapsedNs;
    private boolean sessionReadyObserved;

    private long statusEventSequence;
    private String statusEventType = "";
    private String statusEventFailureCode = "";
    private String statusEventMessage = "";
    private String statusEventUtc = "";
    private long statusEventElapsedNs;

    private boolean connectionGapActive;
    private long connectionGapStartNs;
    private int sessionGapCount;
    private long sessionTotalGapNs;
    private long sessionMaxGapNs;
    private int polarReconnectCount;
    private boolean reconnectActive;
    private long reconnectStartedElapsedMs;
    private boolean reconnectFailedLogged;
    private long lastDisconnectElapsedNs;
    private String lastDisconnectUtc = "";

    private BufferedWriter sessionWriter;
    private File sessionFile;
    private String sessionParticipantId = "";
    private String sessionId = "";
    private String sessionApkVariantId = "";
    private String sessionApkFileCode = "";
    private boolean sessionRecordingActive;
    private long sessionSampleIndex;
    private long sessionFrameCount;
    private long sessionStartElapsedNs;
    private String sessionStartUtc = "";
    private String sessionWriteError = "";

    private Study6RunLogger.BlockPlan recordingPlan;
    private File recordingFile;
    private boolean recordingArmed;
    private boolean recordingActive;
    private int recordingSampleIndex;
    private long recordingFrameCount;
    private long recordingStartElapsedNs;
    private long recordingEndElapsedNs;
    private long recordingExpectedSampleCount;
    private long recordingInitialSessionSampleIndex;
    private int recordingGapCount;
    private long recordingTotalGapNs;
    private long recordingMaxGapNs;
    private int recordingReconnectCount;
    private boolean recordingGapInProgress;
    private long recordingGapStartNs;
    private boolean recordingReadyAtStart;
    private String recordingStartUtc = "";
    private String recordingEndUtc = "";
    private String recordingWriteError = "";

    Study6PolarH10Manager(Context context, StatusListener listener) {
        this.context = context.getApplicationContext();
        this.listener = listener;
        publishStatus();
    }

    static void requestRuntimePermissions(Activity activity) {
        if (activity == null || Build.VERSION.SDK_INT < Build.VERSION_CODES.S) {
            return;
        }
        List<String> missing = new ArrayList<>();
        for (String permission : new String[]{
                Manifest.permission.BLUETOOTH_SCAN,
                Manifest.permission.BLUETOOTH_CONNECT
        }) {
            if (activity.checkSelfPermission(permission) != PackageManager.PERMISSION_GRANTED) {
                missing.add(permission);
            }
        }
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU
                && activity.checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED) {
            missing.add(Manifest.permission.POST_NOTIFICATIONS);
        }
        if (!missing.isEmpty()) {
            activity.requestPermissions(missing.toArray(new String[0]), REQUEST_BLUETOOTH_PERMISSIONS);
        }
    }

    void start(String requestedAddress) {
        synchronized (lock) {
            requestedDeviceAddress = requestedAddress == null ? "" : requestedAddress.trim();
            stopRequested = false;
            if (workerThread != null && workerThread.isAlive()) {
                publishStatusLocked(true);
                return;
            }
            statusState = "starting";
            lastError = "";
            missingPermissions = "";
            recentScanCandidates = new JSONArray();
            readyCandidateSinceElapsedMs = 0L;
            workerThread = new Thread(this::runWorker, "Study6PolarH10Worker");
            workerThread.start();
            publishStatusLocked(true);
        }
    }

    JSONObject startSessionRecording(
            String participantId,
            String sessionId,
            String apkVariantId,
            String apkFileCode,
            File masterCsvFile
    ) {
        synchronized (lock) {
            closeSessionWriterLocked();
            sessionParticipantId = participantId == null ? "" : participantId;
            this.sessionId = sessionId == null ? "" : sessionId;
            sessionApkVariantId = apkVariantId == null ? "" : apkVariantId;
            sessionApkFileCode = apkFileCode == null ? "" : apkFileCode;
            sessionFile = masterCsvFile;
            sessionRecordingActive = false;
            sessionSampleIndex = 0L;
            sessionFrameCount = 0L;
            sessionStartElapsedNs = SystemClock.elapsedRealtimeNanos();
            sessionStartUtc = Instant.now().toString();
            sessionWriteError = "";
            sessionGapCount = 0;
            sessionTotalGapNs = 0L;
            sessionMaxGapNs = 0L;
            polarReconnectCount = 0;
            connectionGapActive = false;
            connectionGapStartNs = 0L;
            reconnectActive = false;
            reconnectStartedElapsedMs = 0L;
            reconnectFailedLogged = false;
            lastDisconnectElapsedNs = 0L;
            lastDisconnectUtc = "";
            sessionReadyObserved = false;
            sessionReadyAtElapsedNs = 0L;
            readyCandidateSinceElapsedMs = 0L;

            try {
                File parent = masterCsvFile.getParentFile();
                if (parent != null && !parent.exists() && !parent.mkdirs()) {
                    throw new IOException("Unable to create " + parent);
                }
                sessionWriter = new BufferedWriter(new OutputStreamWriter(
                        new FileOutputStream(masterCsvFile, false),
                        StandardCharsets.UTF_8));
                sessionWriter.write(MASTER_ECG_CSV_HEADER);
                sessionWriter.newLine();
                sessionWriter.flush();
                sessionRecordingActive = true;
            } catch (IOException error) {
                sessionWriteError = error.getMessage();
                lastError = "Session ECG master CSV start failed: " + error.getMessage();
                Log.e(TAG, "Unable to start session ECG master CSV", error);
            }
            publishStatusLocked(true);
            return sessionRecordingSummaryLocked("session_physiology_started", "started");
        }
    }

    JSONObject stopSessionRecording(long syncEndElapsedNs, String syncEndUtc) {
        synchronized (lock) {
            recordingActive = false;
            sessionRecordingActive = false;
            closeSessionWriterLocked();
            publishStatusLocked(true);
            return sessionRecordingSummaryLocked("session_physiology_completed", "completed");
        }
    }

    JSONObject armBlockRecording(
            Study6RunLogger.BlockPlan plan,
            String participantId,
            String apkVariantId,
            File csvFile
    ) {
        synchronized (lock) {
            recordingPlan = plan;
            recordingFile = csvFile;
            recordingArmed = sessionWriter != null && sessionFile != null && sessionRecordingActive;
            recordingActive = false;
            recordingSampleIndex = 0;
            recordingFrameCount = 0L;
            recordingStartElapsedNs = 0L;
            recordingEndElapsedNs = 0L;
            recordingExpectedSampleCount = 0L;
            recordingInitialSessionSampleIndex = sessionSampleIndex;
            recordingGapCount = 0;
            recordingTotalGapNs = 0L;
            recordingMaxGapNs = 0L;
            recordingReconnectCount = 0;
            recordingGapInProgress = false;
            recordingGapStartNs = 0L;
            recordingReadyAtStart = false;
            recordingStartUtc = "";
            recordingEndUtc = "";
            recordingWriteError = "";
            if (!recordingArmed) {
                recordingWriteError = sessionWriteError.isEmpty()
                        ? "Session ECG master CSV is not active."
                        : sessionWriteError;
                lastError = "ECG window arm failed: " + recordingWriteError;
            }
            publishStatusLocked(true);
            return recordingSummaryLocked("ecg_recording_armed", 0L, "", "armed");
        }
    }

    JSONObject startArmedBlockRecording(long syncStartElapsedNs, String syncStartUtc) {
        synchronized (lock) {
            recordingStartElapsedNs = syncStartElapsedNs;
            recordingStartUtc = syncStartUtc == null ? "" : syncStartUtc;
            recordingActive = recordingArmed && sessionWriter != null;
            recordingReadyAtStart = readyLocked();
            recordingInitialSessionSampleIndex = sessionSampleIndex;
            if (connectionGapActive) {
                beginRecordingGapLocked(Math.max(syncStartElapsedNs, connectionGapStartNs));
                if (reconnectActive) {
                    recordingReconnectCount++;
                }
            }
            publishStatusLocked(true);
            return recordingSummaryLocked("ecg_recording_started", syncStartElapsedNs, syncStartUtc, recordingActive ? "recording" : "not_recording");
        }
    }

    JSONObject stopBlockRecording(long syncEndElapsedNs, String syncEndUtc) {
        synchronized (lock) {
            recordingActive = false;
            recordingEndElapsedNs = syncEndElapsedNs;
            recordingEndUtc = syncEndUtc == null ? "" : syncEndUtc;
            recordingExpectedSampleCount = Math.max(0L, (recordingEndElapsedNs - recordingStartElapsedNs) / ECG_SAMPLE_INTERVAL_NS);
            finalizeOpenRecordingGapLocked(syncEndElapsedNs);
            flushSessionWriterLocked();
            int derivedRows = deriveBlockCsvFromMasterLocked();
            if (derivedRows >= 0) {
                recordingSampleIndex = derivedRows;
            }
            JSONObject summary = recordingSummaryLocked("ecg_recording_completed", syncEndElapsedNs, syncEndUtc, "completed");
            recordingArmed = false;
            recordingPlan = null;
            recordingFile = null;
            publishStatusLocked(true);
            return summary;
        }
    }

    @Override
    public void close() {
        Thread thread;
        BluetoothGatt closeGatt;
        synchronized (lock) {
            stopRequested = true;
            statusState = "stopping";
            recordingActive = false;
            sessionRecordingActive = false;
            closeSessionWriterLocked();
            thread = workerThread;
            closeGatt = gatt;
            publishStatusLocked(true);
        }
        if (closeGatt != null) {
            try {
                closeGatt.disconnect();
            } catch (Exception ignored) {
            }
        }
        if (thread != null) {
            thread.interrupt();
        }
    }

    @SuppressLint("MissingPermission")
    private void runWorker() {
        try {
            while (!stopRequested) {
                updateState("checking_permissions");
                List<String> missing = missingBluetoothPermissions();
                while (!stopRequested && !missing.isEmpty()) {
                    fail("permission_blocked", "Missing Bluetooth permission: " + join(missing, ", "));
                    Thread.sleep(2_000L);
                    updateState("checking_permissions");
                    missing = missingBluetoothPermissions();
                }
                if (stopRequested) {
                    break;
                }

                if (!context.getPackageManager().hasSystemFeature(PackageManager.FEATURE_BLUETOOTH_LE)) {
                    fail("ble_unavailable", "Android Bluetooth Low Energy support is unavailable.");
                    Thread.sleep(3_000L);
                    continue;
                }

                BluetoothManager manager = (BluetoothManager) context.getSystemService(Context.BLUETOOTH_SERVICE);
                BluetoothAdapter adapter = manager != null ? manager.getAdapter() : null;
                if (adapter == null) {
                    fail("adapter_unavailable", "Android did not expose a Bluetooth adapter.");
                    Thread.sleep(3_000L);
                    continue;
                }
                if (!adapter.isEnabled()) {
                    fail("bluetooth_disabled", "Bluetooth is disabled.");
                    Thread.sleep(3_000L);
                    continue;
                }

                ConnectionOutcome outcome = runConnectionAttempt(adapter);
                if (stopRequested) {
                    break;
                }
                handleReconnectBackoff(outcome);
            }
        } catch (InterruptedException ignored) {
            Thread.currentThread().interrupt();
        } catch (Exception error) {
            Log.w(TAG, "Polar H10 manager failed: " + error.getMessage(), error);
            try {
                fail("failed", error.getClass().getSimpleName() + ": " + error.getMessage());
            } catch (Exception ignored) {
            }
        } finally {
            synchronized (lock) {
                if ("stopping".equals(statusState) || stopRequested) {
                    statusState = "stopped";
                }
                workerThread = null;
                publishStatusLocked(true);
            }
        }
    }

    @SuppressLint("MissingPermission")
    private ConnectionOutcome runConnectionAttempt(BluetoothAdapter adapter) throws InterruptedException {
        BluetoothGatt localGatt = null;
        GattCallback localCallback = null;
        BluetoothGattCharacteristic localControlPoint = null;
        boolean localEcgStreamStarted = false;
        try {
            PolarDeviceCandidate candidate = resolveCandidate(adapter);
            if (candidate == null) {
                fail("scan_timeout", "No Polar H10/PMD BLE advertisement was seen before scan timeout.");
                return ConnectionOutcome.retry("scan_timeout", "No Polar H10/PMD BLE advertisement was seen before scan timeout.");
            }
            applyCandidate(candidate);

            int connectStatus = GATT_START_FAILED;
            for (int attempt = 1; attempt <= CONNECT_ATTEMPTS && !stopRequested; attempt++) {
                if (attempt > 1) {
                    Thread.sleep(1_500L);
                }
                updateState("connecting");
                GattCallback attemptCallback = new GattCallback();
                BluetoothGatt attemptGatt = candidate.device.connectGatt(
                        context,
                        false,
                        attemptCallback,
                        BluetoothDevice.TRANSPORT_LE);
                if (attemptGatt == null) {
                    connectStatus = GATT_START_FAILED;
                    attemptCallback.close();
                    continue;
                }

            if (localGatt == null || localCallback == null) {
                    connectStatus = awaitInteger(attemptCallback.connectStatuses, CONNECT_TIMEOUT_MS, GATT_CONNECTION_TIMEOUT);
                    if (connectStatus == BluetoothGatt.GATT_SUCCESS) {
                        localGatt = attemptGatt;
                        localCallback = attemptCallback;
                        synchronized (lock) {
                            gatt = localGatt;
                            callback = localCallback;
                            lastSuccessfulDeviceAddress = candidate.deviceAddress;
                            publishStatusLocked(true);
                        }
                        break;
                    }
                }

                try {
                    attemptGatt.disconnect();
                    attemptGatt.close();
                } catch (Exception ignored) {
                }
                attemptCallback.close();
            }

            if (localGatt == null || localCallback == null) {
                String message = "Bluetooth GATT status " + connectStatus + " while connecting.";
                fail("connect_failed", message);
                return ConnectionOutcome.retry("connect_failed", message);
            }

            updateState("negotiating_mtu");
            Integer mtu = requestMtu(localGatt, localCallback);
            if (mtu != null && mtu > 0) {
                synchronized (lock) {
                    negotiatedMtu = mtu;
                    publishStatusLocked(true);
                }
            }

            updateState("discovering_services");
            int serviceStatus = discoverServices(localGatt, localCallback);
            if (serviceStatus != BluetoothGatt.GATT_SUCCESS) {
                String message = "Bluetooth GATT status " + serviceStatus + " while discovering services.";
                fail("service_discovery_failed", message);
                return ConnectionOutcome.retry("service_discovery_failed", message);
            }

            android.bluetooth.BluetoothGattService hrService = localGatt.getService(HEART_RATE_SERVICE);
            android.bluetooth.BluetoothGattService pmdService = localGatt.getService(PMD_SERVICE);
            synchronized (lock) {
                heartRateServiceVisible = hrService != null;
                pmdServiceVisible = pmdService != null;
                publishStatusLocked(true);
            }
            if (pmdService == null) {
                String message = "Connected device did not expose the Polar PMD service.";
                fail("pmd_service_unavailable", message);
                return ConnectionOutcome.retry("pmd_service_unavailable", message);
            }

            if (hrService != null) {
                BluetoothGattCharacteristic heartRate = hrService.getCharacteristic(HEART_RATE_MEASUREMENT);
                if (heartRate != null) {
                    updateState("enabling_hr_notifications");
                    enableCharacteristicUpdates(localGatt, localCallback, heartRate, BluetoothGattDescriptor.ENABLE_NOTIFICATION_VALUE);
                }
            }

            localControlPoint = pmdService.getCharacteristic(PMD_CONTROL_POINT);
            BluetoothGattCharacteristic data = pmdService.getCharacteristic(PMD_DATA);
            if (localControlPoint == null || data == null) {
                String message = "PMD control point or data characteristic is missing.";
                fail("pmd_characteristic_unavailable", message);
                return ConnectionOutcome.retry("pmd_characteristic_unavailable", message);
            }

            updateState("enabling_pmd_notifications");
            enableCharacteristicUpdates(localGatt, localCallback, localControlPoint, BluetoothGattDescriptor.ENABLE_INDICATION_VALUE);
            synchronized (lock) {
                pmdControlPointIndicationsEnabled = true;
                publishStatusLocked(true);
            }
            enableCharacteristicUpdates(localGatt, localCallback, data, BluetoothGattDescriptor.ENABLE_NOTIFICATION_VALUE);
            synchronized (lock) {
                pmdDataNotificationsEnabled = true;
                publishStatusLocked(true);
            }

            updateState("reading_ecg_settings");
            sendPmdCommand(
                    localGatt,
                    localCallback,
                    localControlPoint,
                    buildGetSettingsRequest(),
                    OPCODE_GET_SETTINGS,
                    MEASUREMENT_TYPE_ECG);
            synchronized (lock) {
                pmdSettingsReceived = true;
                publishStatusLocked(true);
            }

            try {
                sendPmdCommand(
                        localGatt,
                        localCallback,
                        localControlPoint,
                        buildStopRequest(),
                        OPCODE_STOP_STREAM,
                        MEASUREMENT_TYPE_ECG);
            } catch (Exception stopError) {
                Log.i(TAG, "ECG pre-stop ignored: " + stopError.getMessage());
            }

            updateState("starting_ecg_stream");
            sendPmdCommand(
                    localGatt,
                    localCallback,
                    localControlPoint,
                    buildStartEcgRequest(),
                    OPCODE_START_STREAM,
                    MEASUREMENT_TYPE_ECG);
            synchronized (lock) {
                ecgStreamStarted = true;
                pmdStartResponseReceived = true;
                localEcgStreamStarted = true;
                publishStatusLocked(true);
            }
            updateState("streaming");

            while (!stopRequested) {
                Integer disconnectStatus = localCallback.disconnectStatuses.poll(1L, TimeUnit.SECONDS);
                if (disconnectStatus != null) {
                    String message = "Polar GATT disconnected with status " + disconnectStatus + ".";
                    synchronized (lock) {
                        markDisconnectedForReconnectLocked("polar_disconnect", message);
                    }
                    return ConnectionOutcome.retry("polar_disconnect", message);
                }
                synchronized (lock) {
                    refreshReadyWindowLocked();
                    completeReconnectIfReadyLocked(latestFrameElapsedNs > 0L ? latestFrameElapsedNs : SystemClock.elapsedRealtimeNanos());
                    long latestFrameAgeMs = latestFrameElapsedNs <= 0L
                            ? 0L
                            : (SystemClock.elapsedRealtimeNanos() - latestFrameElapsedNs) / 1_000_000L;
                    if (ecgStreamStarted && latestFrameAgeMs > ECG_STALL_TIMEOUT_MS) {
                        String message = "No ECG PMD frame received for " + latestFrameAgeMs + " ms.";
                        markDisconnectedForReconnectLocked("ecg_stream_stalled", message);
                        return ConnectionOutcome.retry("ecg_stream_stalled", message);
                    }
                    publishStatusLocked(false);
                }
            }
        } catch (InterruptedException error) {
            throw error;
        } catch (Exception error) {
            Log.w(TAG, "Polar H10 manager failed: " + error.getMessage(), error);
            String message = error.getClass().getSimpleName() + ": " + error.getMessage();
            fail("failed", message);
            return ConnectionOutcome.retry("failed", message);
        } finally {
            if (localEcgStreamStarted && localGatt != null && localCallback != null && localControlPoint != null) {
                try {
                    sendPmdCommand(
                            localGatt,
                            localCallback,
                            localControlPoint,
                            buildStopRequest(),
                            OPCODE_STOP_STREAM,
                            MEASUREMENT_TYPE_ECG);
                } catch (Exception stopError) {
                    Log.w(TAG, "ECG stop command failed: " + stopError.getMessage());
                }
            }
            if (localGatt != null) {
                try {
                    localGatt.disconnect();
                    localGatt.close();
                } catch (Exception ignored) {
                }
            }
            if (localCallback != null) {
                localCallback.close();
            }
            synchronized (lock) {
                gatt = null;
                callback = null;
                clearLiveConnectionFlagsLocked();
                publishStatusLocked(true);
            }
        }
        return ConnectionOutcome.clean();
    }

    private void handleReconnectBackoff(ConnectionOutcome outcome) throws InterruptedException {
        if (outcome == null || !outcome.retry) {
            return;
        }
        synchronized (lock) {
            boolean postReadinessFailure = sessionReadyObserved || ecgSampleCount > 0 || connectionGapActive;
            if (postReadinessFailure) {
                if (!connectionGapActive) {
                    beginConnectionGapLocked(SystemClock.elapsedRealtimeNanos());
                }
                if (!reconnectActive) {
                    reconnectActive = true;
                    reconnectStartedElapsedMs = SystemClock.elapsedRealtime();
                    reconnectFailedLogged = false;
                    polarReconnectCount++;
                    if (recordingActive) {
                        recordingReconnectCount++;
                    }
                    statusState = "reconnecting";
                    emitStatusEventLocked("polar_reconnect_started", outcome.errorCode, outcome.message);
                } else {
                    long reconnectElapsedMs = SystemClock.elapsedRealtime() - reconnectStartedElapsedMs;
                    if (!reconnectFailedLogged && reconnectElapsedMs >= POLAR_RECONNECT_TOLERANCE_MS) {
                        reconnectFailedLogged = true;
                        statusState = "reconnect_overdue";
                        emitStatusEventLocked("polar_reconnect_failed", outcome.errorCode,
                                outcome.message + " Reconnect exceeded " + POLAR_RECONNECT_TOLERANCE_MS + " ms.");
                    }
                }
                publishStatusLocked(true);
            }
        }
        Thread.sleep(1_500L);
    }

    private void markDisconnectedForReconnectLocked(String code, String message) {
        long nowNs = SystemClock.elapsedRealtimeNanos();
        statusState = "disconnected";
        lastError = message == null ? "" : message;
        lastDisconnectElapsedNs = nowNs;
        lastDisconnectUtc = Instant.now().toString();
        beginConnectionGapLocked(latestFrameElapsedNs > 0L ? latestFrameElapsedNs : nowNs);
        emitStatusEventLocked("polar_disconnect", code, message);
        publishStatusLocked(true);
    }

    private void beginConnectionGapLocked(long gapStartNs) {
        if (connectionGapActive) {
            return;
        }
        connectionGapActive = true;
        connectionGapStartNs = gapStartNs <= 0L ? SystemClock.elapsedRealtimeNanos() : gapStartNs;
        if (recordingActive) {
            beginRecordingGapLocked(Math.max(recordingStartElapsedNs, connectionGapStartNs));
        }
    }

    private void closeConnectionGapLocked(long gapEndNs) {
        if (!connectionGapActive) {
            return;
        }
        long safeEndNs = gapEndNs <= 0L ? SystemClock.elapsedRealtimeNanos() : gapEndNs;
        long durationNs = Math.max(0L, safeEndNs - connectionGapStartNs);
        sessionGapCount++;
        sessionTotalGapNs += durationNs;
        sessionMaxGapNs = Math.max(sessionMaxGapNs, durationNs);
        closeRecordingGapLocked(safeEndNs);
        connectionGapActive = false;
        connectionGapStartNs = 0L;
    }

    private void beginRecordingGapLocked(long gapStartNs) {
        if (!recordingActive || recordingGapInProgress) {
            return;
        }
        recordingGapInProgress = true;
        recordingGapStartNs = Math.max(recordingStartElapsedNs, gapStartNs);
        recordingGapCount++;
    }

    private void closeRecordingGapLocked(long gapEndNs) {
        if (!recordingGapInProgress) {
            return;
        }
        long safeEndNs = Math.max(recordingGapStartNs, gapEndNs);
        long durationNs = Math.max(0L, safeEndNs - recordingGapStartNs);
        recordingTotalGapNs += durationNs;
        recordingMaxGapNs = Math.max(recordingMaxGapNs, durationNs);
        recordingGapInProgress = false;
        recordingGapStartNs = 0L;
    }

    private void finalizeOpenRecordingGapLocked(long gapEndNs) {
        closeRecordingGapLocked(gapEndNs);
    }

    private void completeReconnectIfReadyLocked(long gapEndNs) {
        if (!reconnectActive || !readyLocked()) {
            return;
        }
        closeConnectionGapLocked(gapEndNs);
        reconnectActive = false;
        reconnectStartedElapsedMs = 0L;
        reconnectFailedLogged = false;
        statusState = "streaming";
        emitStatusEventLocked("polar_reconnected", "", "Polar H10 ECG stream recovered.");
    }

    private void emitStatusEventLocked(String eventType, String failureCode, String message) {
        statusEventSequence++;
        statusEventType = eventType == null ? "" : eventType;
        statusEventFailureCode = failureCode == null ? "" : failureCode;
        statusEventMessage = message == null ? "" : message;
        statusEventUtc = Instant.now().toString();
        statusEventElapsedNs = SystemClock.elapsedRealtimeNanos();
    }

    private void clearLiveConnectionFlagsLocked() {
        negotiatedMtu = 0;
        heartRateBpm = 0;
        rrIntervalCount = 0;
        heartRateServiceVisible = false;
        pmdServiceVisible = false;
        pmdControlPointIndicationsEnabled = false;
        pmdDataNotificationsEnabled = false;
        pmdSettingsReceived = false;
        pmdStartResponseReceived = false;
        ecgStreamStarted = false;
        readyCandidateSinceElapsedMs = 0L;
    }

    private PolarDeviceCandidate resolveCandidate(BluetoothAdapter adapter) throws InterruptedException {
        if (!requestedDeviceAddress.isEmpty()) {
            try {
                BluetoothDevice device = adapter.getRemoteDevice(requestedDeviceAddress);
                return new PolarDeviceCandidate(
                        device,
                        safeDeviceName(device, "Polar H10"),
                        safeDeviceAddress(device, requestedDeviceAddress),
                        Integer.MIN_VALUE,
                        false,
                        false,
                        220);
            } catch (Exception error) {
                synchronized (lock) {
                    lastError = "Direct Polar address lookup failed: " + error.getMessage();
                    publishStatusLocked(true);
                }
                return null;
            }
        }

        android.bluetooth.le.BluetoothLeScanner scanner = adapter.getBluetoothLeScanner();
        if (scanner == null) {
            return null;
        }

        LinkedBlockingQueue<PolarDeviceCandidate> queue = new LinkedBlockingQueue<>();
        ScanCallback scanCallback = new ScanCallback() {
            @Override
            public void onScanResult(int callbackType, ScanResult result) {
                PolarDeviceCandidate candidate = toPolarCandidate(result);
                if (candidate != null) {
                    queue.offer(candidate);
                }
            }

            @Override
            public void onScanFailed(int errorCode) {
                synchronized (lock) {
                    lastError = "BLE scan failed with code " + errorCode;
                    publishStatusLocked(true);
                }
            }
        };

        updateState("scanning");
        scanner.startScan(
                new ArrayList<>(),
                new ScanSettings.Builder()
                        .setScanMode(ScanSettings.SCAN_MODE_LOW_LATENCY)
                        .build(),
                scanCallback);
        try {
            PolarDeviceCandidate bestCandidate = null;
            long deadlineMs = SystemClock.elapsedRealtime() + DEFAULT_SCAN_TIMEOUT_MS;
            long settleDeadlineMs = SystemClock.elapsedRealtime() + SCAN_SETTLE_MS;
            while (SystemClock.elapsedRealtime() < deadlineMs && !stopRequested) {
                long waitMs = Math.max(1L, deadlineMs - SystemClock.elapsedRealtime());
                PolarDeviceCandidate candidate = queue.poll(waitMs, TimeUnit.MILLISECONDS);
                if (candidate == null) {
                    break;
                }
                if (isBetterCandidate(candidate, bestCandidate)) {
                    bestCandidate = candidate;
                }
                boolean settled = SystemClock.elapsedRealtime() >= settleDeadlineMs;
                if (candidate.matchScore >= EARLY_ACCEPT_SCORE || (settled && candidate.matchScore >= STRONG_CANDIDATE_SCORE)) {
                    return candidate;
                }
            }
            return bestCandidate;
        } finally {
            try {
                scanner.stopScan(scanCallback);
            } catch (Exception ignored) {
            }
        }
    }

    private Integer requestMtu(BluetoothGatt localGatt, GattCallback localCallback) throws InterruptedException {
        localCallback.mtuValues.clear();
        if (!localGatt.requestMtu(PREFERRED_MTU)) {
            return null;
        }
        Integer mtu = localCallback.mtuValues.poll(MTU_TIMEOUT_MS, TimeUnit.MILLISECONDS);
        return mtu == null ? null : mtu;
    }

    private int discoverServices(BluetoothGatt localGatt, GattCallback localCallback) throws InterruptedException {
        localCallback.serviceStatuses.clear();
        if (!localGatt.discoverServices()) {
            return GATT_START_FAILED;
        }
        return awaitInteger(localCallback.serviceStatuses, SERVICE_DISCOVERY_TIMEOUT_MS, GATT_CONNECTION_TIMEOUT);
    }

    private void enableCharacteristicUpdates(
            BluetoothGatt localGatt,
            GattCallback localCallback,
            BluetoothGattCharacteristic characteristic,
            byte[] cccdValue
    ) throws Exception {
        if (!localGatt.setCharacteristicNotification(characteristic, true)) {
            throw new IllegalStateException("Android refused characteristic updates for " + characteristic.getUuid());
        }

        BluetoothGattDescriptor descriptor = characteristic.getDescriptor(CCCD_DESCRIPTOR);
        if (descriptor == null) {
            throw new IllegalStateException("CCCD descriptor missing for " + characteristic.getUuid());
        }

        localCallback.descriptorWriteStatuses.clear();
        if (!writeDescriptorCompat(localGatt, descriptor, cccdValue)) {
            throw new IllegalStateException("CCCD descriptor write did not start for " + characteristic.getUuid());
        }
        int status = awaitInteger(localCallback.descriptorWriteStatuses, GATT_OPERATION_TIMEOUT_MS, GATT_CONNECTION_TIMEOUT);
        if (status != BluetoothGatt.GATT_SUCCESS) {
            throw new IllegalStateException("CCCD descriptor write failed for " + characteristic.getUuid() + ": " + status);
        }
    }

    private byte[] sendPmdCommand(
            BluetoothGatt localGatt,
            GattCallback localCallback,
            BluetoothGattCharacteristic localControlPoint,
            byte[] command,
            byte expectedOpCode,
            byte expectedMeasurementType
    ) throws Exception {
        localCallback.controlNotifications.clear();
        localCallback.characteristicWriteStatuses.clear();
        if (!writeCharacteristicCompat(localGatt, localControlPoint, command)) {
            throw new IllegalStateException("PMD command write did not start.");
        }
        int writeStatus = awaitInteger(localCallback.characteristicWriteStatuses, GATT_OPERATION_TIMEOUT_MS, GATT_CONNECTION_TIMEOUT);
        if (writeStatus != BluetoothGatt.GATT_SUCCESS) {
            throw new IllegalStateException("PMD command write failed: GATT status " + writeStatus);
        }

        byte[] responseBytes = awaitControlResponse(localCallback, expectedOpCode, expectedMeasurementType);
        ControlResponse response = parseControlResponse(responseBytes);
        if (response == null) {
            throw new IllegalStateException("PMD control response was malformed.");
        }
        if (!response.success()) {
            throw new IllegalStateException("PMD control response failed op=" + response.opCode
                    + " measurement=" + response.measurementType
                    + " error=" + response.errorCode);
        }
        return responseBytes;
    }

    private byte[] awaitControlResponse(
            GattCallback localCallback,
            byte expectedOpCode,
            byte expectedMeasurementType
    ) throws InterruptedException {
        int expectedOp = expectedOpCode & 0xff;
        int expectedType = expectedMeasurementType & 0xff;
        long deadline = SystemClock.elapsedRealtime() + CONTROL_RESPONSE_TIMEOUT_MS;
        while (SystemClock.elapsedRealtime() < deadline) {
            long waitMs = Math.max(1L, deadline - SystemClock.elapsedRealtime());
            byte[] bytes = localCallback.controlNotifications.poll(waitMs, TimeUnit.MILLISECONDS);
            if (bytes == null) {
                break;
            }
            ControlResponse response = parseControlResponse(bytes);
            if (response != null && response.opCode == expectedOp && response.measurementType == expectedType) {
                return bytes;
            }
        }
        throw new IllegalStateException("Timed out waiting for PMD control response.");
    }

    private void handleHeartRateData(byte[] value) {
        HeartRateMeasurement measurement = decodeHeartRate(value);
        if (measurement == null) {
            synchronized (lock) {
                lastError = "Ignored malformed Heart Rate Measurement length=" + (value == null ? 0 : value.length);
                publishStatusLocked(true);
            }
            return;
        }
        synchronized (lock) {
            heartRateEventCount++;
            heartRateBpm = measurement.heartRateBpm;
            rrIntervalCount += measurement.rrIntervalCount;
            refreshReadyWindowLocked();
            completeReconnectIfReadyLocked(latestFrameElapsedNs > 0L ? latestFrameElapsedNs : SystemClock.elapsedRealtimeNanos());
            publishStatusLocked(false);
        }
    }

    private void handlePmdData(byte[] value) {
        if (value == null || value.length == 0 || value[0] != MEASUREMENT_TYPE_ECG) {
            return;
        }
        EcgFrame frame = decodeEcgFrame(value);
        if (frame == null) {
            synchronized (lock) {
                malformedFrameCount++;
                lastError = "Ignored malformed ECG PMD frame length=" + value.length;
                publishStatusLocked(true);
            }
            return;
        }

        synchronized (lock) {
            ecgFrameCount++;
            ecgSampleCount += frame.samples.length;
            latestFrameElapsedNs = frame.receivedElapsedNs;
            latestSensorTimestampNs = frame.sensorTimestampNs;
            latestFrameSampleCount = frame.samples.length;
            for (int sample : frame.samples) {
                recentEcgSamples[recentEcgWriteIndex] = sample;
                recentEcgWriteIndex = (recentEcgWriteIndex + 1) % recentEcgSamples.length;
                recentEcgCount = Math.min(recentEcgCount + 1, recentEcgSamples.length);
            }
            appendEcgFrameRowsLocked(frame);
            refreshReadyWindowLocked();
            completeReconnectIfReadyLocked(frame.receivedElapsedNs);
            publishStatusLocked(false);
        }
    }

    private void appendEcgFrameRowsLocked(EcgFrame frame) {
        if (!sessionRecordingActive || sessionWriter == null) {
            return;
        }
        String hostReceivedUtc = frame.receivedAtUtc;
        String contactQuality = heartRateBpm > 0 ? "hr_contact_present" : "ecg_only";
        Study6RunLogger.BlockPlan activePlan = recordingActive ? recordingPlan : null;
        for (int i = 0; i < frame.samples.length; i++) {
            sessionSampleIndex++;
            long polarSampleTimestampNs = frame.sensorTimestampNs + (i * ECG_SAMPLE_INTERVAL_NS);
            long offsetFromWindowStartNs = activePlan == null || recordingStartElapsedNs <= 0L
                    ? 0L
                    : Math.max(0L, frame.receivedElapsedNs - recordingStartElapsedNs);
            String sampleId = sessionApkFileCode + "_" + sessionParticipantId + "_session_ECG_PolarH10_"
                    + String.format(Locale.ROOT, "%08d", sessionSampleIndex);
            try {
                sessionWriter.write(csv(
                        sampleId,
                        sessionApkFileCode,
                        sessionParticipantId,
                        sessionApkVariantId,
                        sessionId,
                        deviceIdLocked(),
                        deviceName,
                        deviceAddress,
                        String.valueOf(sessionSampleIndex),
                        String.valueOf(polarSampleTimestampNs),
                        hostReceivedUtc,
                        String.valueOf(frame.receivedElapsedNs),
                        String.valueOf(frame.samples[i]),
                        "uV",
                        contactQuality,
                        "polar_h10_android_ble_pmd",
                        sessionStartUtc,
                        String.valueOf(sessionStartElapsedNs),
                        activePlan == null ? "" : activePlan.blockFileStem,
                        activePlan == null ? "" : String.valueOf(activePlan.blockPosition),
                        activePlan == null ? "" : activePlan.blockId,
                        activePlan == null ? "" : activePlan.blockFileStem,
                        activePlan == null ? "" : activePlan.vrConditionId,
                        activePlan == null ? "" : activePlan.coherenceLevel,
                        activePlan == null ? "" : activePlan.energyNoiseLevel,
                        activePlan == null ? "" : activePlan.audioVariantId,
                        activePlan == null ? "" : String.valueOf(recordingStartElapsedNs),
                        activePlan == null ? "" : String.valueOf(offsetFromWindowStartNs)
                ));
                sessionWriter.newLine();
                if (activePlan != null) {
                    recordingSampleIndex++;
                }
            } catch (IOException error) {
                sessionWriteError = error.getMessage();
                recordingWriteError = error.getMessage();
                lastError = "Session ECG master CSV write failed: " + error.getMessage();
                sessionRecordingActive = false;
                break;
            }
        }
        sessionFrameCount++;
        if (activePlan != null) {
            recordingFrameCount++;
        }
        flushSessionWriterLocked();
    }

    private int deriveBlockCsvFromMasterLocked() {
        if (sessionFile == null || recordingFile == null || recordingPlan == null) {
            recordingWriteError = "Cannot derive block ECG CSV without master file, block file, and block plan.";
            return -1;
        }
        if (recordingStartElapsedNs <= 0L || recordingEndElapsedNs <= 0L || recordingEndElapsedNs < recordingStartElapsedNs) {
            recordingWriteError = "Cannot derive block ECG CSV from invalid block window.";
            return -1;
        }

        int rowsWritten = 0;
        try {
            File parent = recordingFile.getParentFile();
            if (parent != null && !parent.exists() && !parent.mkdirs()) {
                throw new IOException("Unable to create " + parent);
            }
            try (
                    BufferedReader reader = new BufferedReader(new InputStreamReader(
                            new FileInputStream(sessionFile),
                            StandardCharsets.UTF_8));
                    BufferedWriter writer = new BufferedWriter(new OutputStreamWriter(
                            new FileOutputStream(recordingFile, false),
                            StandardCharsets.UTF_8))
            ) {
                String header = reader.readLine();
                if (header == null) {
                    throw new IOException("Session ECG master CSV is empty.");
                }
                List<String> columns = parseCsvLine(header);
                int polarTimestampIndex = columns.indexOf("polar_sample_timestamp_ns");
                int hostUtcIndex = columns.indexOf("host_received_timestamp_utc");
                int hostElapsedIndex = columns.indexOf("host_received_elapsed_realtime_ns");
                int ecgRawIndex = columns.indexOf("ecg_raw");
                int ecgUnitIndex = columns.indexOf("ecg_unit");
                int contactQualityIndex = columns.indexOf("contact_quality");
                int sourceIndex = columns.indexOf("source");
                int deviceIdIndex = columns.indexOf("device_id");
                int deviceNameIndex = columns.indexOf("device_name");
                int deviceAddressIndex = columns.indexOf("device_address");
                if (hostElapsedIndex < 0 || polarTimestampIndex < 0 || hostUtcIndex < 0 || ecgRawIndex < 0) {
                    throw new IOException("Session ECG master CSV missing required columns.");
                }

                writer.write(BLOCK_ECG_CSV_HEADER);
                writer.newLine();
                String line;
                while ((line = reader.readLine()) != null) {
                    if (line.trim().isEmpty()) {
                        continue;
                    }
                    List<String> cells = parseCsvLine(line);
                    long hostElapsedNs = parseLongCell(cells, hostElapsedIndex);
                    if (hostElapsedNs < recordingStartElapsedNs || hostElapsedNs > recordingEndElapsedNs) {
                        continue;
                    }
                    rowsWritten++;
                    String sampleId = recordingPlan.blockFileStem + "_ECG_PolarH10_"
                            + String.format(Locale.ROOT, "%06d", rowsWritten);
                    writer.write(csv(
                            sampleId,
                            recordingPlan.apkFileCode,
                            sessionParticipantId,
                            sessionApkVariantId,
                            String.valueOf(recordingPlan.blockPosition),
                            recordingPlan.blockId,
                            recordingPlan.vrConditionId,
                            cell(cells, deviceIdIndex),
                            cell(cells, deviceNameIndex),
                            cell(cells, deviceAddressIndex),
                            String.valueOf(rowsWritten),
                            cell(cells, polarTimestampIndex),
                            cell(cells, hostUtcIndex),
                            cell(cells, hostElapsedIndex),
                            cell(cells, ecgRawIndex),
                            cell(cells, ecgUnitIndex),
                            cell(cells, contactQualityIndex),
                            cell(cells, sourceIndex),
                            recordingStartUtc,
                            String.valueOf(recordingStartElapsedNs),
                            String.valueOf(Math.max(0L, hostElapsedNs - recordingStartElapsedNs))
                    ));
                    writer.newLine();
                }
                writer.flush();
            }
            recordingWriteError = "";
            return rowsWritten;
        } catch (IOException error) {
            recordingWriteError = error.getMessage();
            lastError = "Block ECG CSV derivation failed: " + error.getMessage();
            Log.e(TAG, "Unable to derive block ECG CSV", error);
            return -1;
        }
    }

    private JSONObject recordingSummaryLocked(String eventType, long syncElapsedNs, String syncUtc, String state) {
        JSONObject summary = new JSONObject();
        put(summary, "event_type", eventType);
        put(summary, "state", state);
        put(summary, "recording_active", recordingActive);
        put(summary, "recording_armed", recordingArmed);
        put(summary, "ecg_file", recordingFile == null ? "" : recordingFile.getName());
        put(summary, "ecg_master_file", sessionFile == null ? "" : sessionFile.getName());
        put(summary, "device_id", deviceIdLocked());
        put(summary, "device_name", deviceName);
        put(summary, "device_address", deviceAddress);
        put(summary, "sync_elapsed_realtime_ns", syncElapsedNs);
        put(summary, "sync_utc", syncUtc == null ? "" : syncUtc);
        put(summary, "sync_start_elapsed_realtime_ns", recordingStartElapsedNs);
        put(summary, "sync_start_utc", recordingStartUtc);
        put(summary, "sync_end_elapsed_realtime_ns", recordingEndElapsedNs);
        put(summary, "sync_end_utc", recordingEndUtc);
        put(summary, "ecg_sample_rate_hz", ECG_SAMPLE_RATE_HZ);
        put(summary, "ecg_resolution_bits", ECG_RESOLUTION_BITS);
        put(summary, "sample_count", recordingSampleIndex);
        put(summary, "frame_count", recordingFrameCount);
        put(summary, "session_sample_count", sessionSampleIndex);
        put(summary, "session_frame_count", sessionFrameCount);
        put(summary, "stream_sample_count_total", ecgSampleCount);
        put(summary, "stream_frame_count_total", ecgFrameCount);
        put(summary, "heart_rate_bpm", heartRateBpm);
        put(summary, "rr_interval_count", rrIntervalCount);
        put(summary, "write_error", recordingWriteError);
        put(summary, "polar_state", statusState);
        put(summary, "polar_ready", readyLocked());
        put(summary, "polar_device_id", deviceIdLocked());
        put(summary, "polar_ready_at_session_start", sessionReadyObserved);
        put(summary, "polar_ready_at_block_start", recordingReadyAtStart);
        put(summary, "ecg_sample_count", recordingSampleIndex);
        put(summary, "ecg_expected_sample_count", recordingExpectedSampleCount);
        put(summary, "ecg_sample_coverage_ratio", recordingCoverageRatioLocked());
        put(summary, "ecg_gap_count", recordingGapCount);
        put(summary, "max_ecg_gap_ms", nsToMs(recordingMaxGapNs));
        put(summary, "total_ecg_gap_ms", nsToMs(recordingTotalGapNs));
        put(summary, "polar_reconnect_count", recordingReconnectCount);
        put(summary, "ecg_qc_valid", recordingQcValidLocked());
        put(summary, "ecg_qc_flag", recordingQcFlagLocked());
        return summary;
    }

    private JSONObject sessionRecordingSummaryLocked(String eventType, String state) {
        JSONObject summary = new JSONObject();
        put(summary, "event_type", eventType);
        put(summary, "state", state);
        put(summary, "recording_active", sessionRecordingActive);
        put(summary, "ecg_master_file", sessionFile == null ? "" : sessionFile.getName());
        put(summary, "device_id", deviceIdLocked());
        put(summary, "device_name", deviceName);
        put(summary, "device_address", deviceAddress);
        put(summary, "session_started_at_utc", sessionStartUtc);
        put(summary, "session_start_elapsed_realtime_ns", sessionStartElapsedNs);
        put(summary, "ecg_sample_rate_hz", ECG_SAMPLE_RATE_HZ);
        put(summary, "ecg_resolution_bits", ECG_RESOLUTION_BITS);
        put(summary, "sample_count", sessionSampleIndex);
        put(summary, "frame_count", sessionFrameCount);
        put(summary, "stream_sample_count_total", ecgSampleCount);
        put(summary, "stream_frame_count_total", ecgFrameCount);
        put(summary, "heart_rate_bpm", heartRateBpm);
        put(summary, "rr_interval_count", rrIntervalCount);
        put(summary, "write_error", sessionWriteError);
        put(summary, "polar_state", statusState);
        put(summary, "polar_ready", readyLocked());
        put(summary, "polar_device_id", deviceIdLocked());
        put(summary, "polar_ready_at_session_start", sessionReadyObserved);
        put(summary, "session_ready_elapsed_realtime_ns", sessionReadyAtElapsedNs);
        put(summary, "ecg_gap_count", sessionGapCount);
        put(summary, "max_ecg_gap_ms", nsToMs(sessionMaxGapNs));
        put(summary, "total_ecg_gap_ms", nsToMs(sessionTotalGapNs));
        put(summary, "polar_reconnect_count", polarReconnectCount);
        return summary;
    }

    private boolean recordingQcValidLocked() {
        return "ok".equals(recordingQcFlagLocked());
    }

    private String recordingQcFlagLocked() {
        if (!recordingWriteError.isEmpty()) {
            return "ecg_write_failed";
        }
        if (!recordingReadyAtStart) {
            return "polar_not_ready_at_block_start";
        }
        if (recordingSampleIndex <= 0) {
            return "no_ecg_samples";
        }
        if (recordingCoverageRatioLocked() < MIN_BLOCK_ECG_COVERAGE_RATIO) {
            return "low_ecg_coverage";
        }
        if (recordingMaxGapNs > ECG_QC_MAX_SINGLE_GAP_NS) {
            return "gap_exceeded_20s";
        }
        return "ok";
    }

    private double recordingCoverageRatioLocked() {
        if (recordingExpectedSampleCount <= 0L) {
            return recordingSampleIndex > 0 ? 1.0d : 0.0d;
        }
        return Math.min(1.0d, (double) recordingSampleIndex / (double) recordingExpectedSampleCount);
    }

    private static long nsToMs(long ns) {
        return Math.max(0L, ns / 1_000_000L);
    }

    private void flushSessionWriterLocked() {
        if (sessionWriter == null) {
            return;
        }
        try {
            sessionWriter.flush();
        } catch (IOException error) {
            sessionWriteError = error.getMessage();
            recordingWriteError = error.getMessage();
            lastError = "Session ECG master CSV flush failed: " + error.getMessage();
            sessionRecordingActive = false;
        }
    }

    private void closeSessionWriterLocked() {
        if (sessionWriter == null) {
            return;
        }
        try {
            sessionWriter.flush();
            sessionWriter.close();
        } catch (IOException error) {
            sessionWriteError = error.getMessage();
            lastError = "Session ECG master CSV close failed: " + error.getMessage();
        } finally {
            sessionWriter = null;
        }
    }

    private void applyCandidate(PolarDeviceCandidate candidate) {
        synchronized (lock) {
            deviceAddress = candidate.deviceAddress;
            deviceName = candidate.deviceName;
            rssi = candidate.rssi;
            heartRateServiceVisible = candidate.heartRateServiceVisible;
            pmdServiceVisible = candidate.pmdServiceVisible;
            publishStatusLocked(true);
        }
    }

    private void fail(String errorCode, String message) {
        synchronized (lock) {
            statusState = errorCode;
            lastError = message == null ? "" : message;
            if ("permission_blocked".equals(errorCode)) {
                missingPermissions = lastError;
            }
            publishStatusLocked(true);
        }
    }

    private void updateState(String nextState) {
        synchronized (lock) {
            statusState = nextState;
            publishStatusLocked(true);
        }
    }

    private void publishStatus() {
        synchronized (lock) {
            publishStatusLocked(true);
        }
    }

    private void publishStatusLocked(boolean force) {
        long nowMs = SystemClock.elapsedRealtime();
        if (!force && nowMs - lastStatusPublishElapsedMs < STATUS_PUBLISH_INTERVAL_MS) {
            return;
        }
        lastStatusPublishElapsedMs = nowMs;
        if (listener == null) {
            return;
        }
        try {
            listener.onPolarStatus(statusJsonLocked());
        } catch (JSONException error) {
            Log.w(TAG, "Unable to build Polar status JSON", error);
        }
    }

    private JSONObject statusJsonLocked() throws JSONException {
        JSONObject status = new JSONObject();
        put(status, "source", "polar_h10_android_ble_pmd");
        put(status, "state", statusState);
        put(status, "ready", readyLocked());
        put(status, "detected", !deviceAddress.isEmpty());
        put(status, "connected", gatt != null && !deviceAddress.isEmpty());
        put(status, "streaming", "streaming".equals(statusState));
        put(status, "pmd_ready", pmdControlPointIndicationsEnabled && pmdDataNotificationsEnabled && pmdSettingsReceived);
        put(status, "ecg_streaming", ecgStreamStarted);
        put(status, "heart_rate_bpm", heartRateBpm);
        put(status, "rr_interval_count", rrIntervalCount);
        put(status, "ecg_sample_count", ecgSampleCount);
        put(status, "pmd_frame_count", ecgFrameCount);
        put(status, "requested_mtu", PREFERRED_MTU);
        put(status, "negotiated_mtu", negotiatedMtu);
        put(status, "ecg_sample_rate_hz", ECG_SAMPLE_RATE_HZ);
        put(status, "ecg_resolution_bits", ECG_RESOLUTION_BITS);
        put(status, "pmd_control_point_indications_enabled", pmdControlPointIndicationsEnabled);
        put(status, "pmd_data_notifications_enabled", pmdDataNotificationsEnabled);
        put(status, "pmd_settings_received", pmdSettingsReceived);
        put(status, "pmd_start_response_received", pmdStartResponseReceived);
        put(status, "device_id", deviceIdLocked());
        put(status, "device_name", deviceName);
        put(status, "device_address", deviceAddress);
        if (rssi != Integer.MIN_VALUE) {
            put(status, "rssi", rssi);
        }
        put(status, "heart_rate_service_visible", heartRateServiceVisible);
        put(status, "pmd_service_visible", pmdServiceVisible);
        put(status, "heart_rate_event_count", heartRateEventCount);
        put(status, "malformed_frame_count", malformedFrameCount);
        put(status, "latest_frame_elapsed_realtime_ns", latestFrameElapsedNs);
        put(status, "latest_sensor_timestamp_ns", latestSensorTimestampNs);
        put(status, "latest_frame_sample_count", latestFrameSampleCount);
        put(status, "session_recording_active", sessionRecordingActive);
        put(status, "session_ecg_master_file", sessionFile == null ? "" : sessionFile.getName());
        put(status, "session_recording_sample_count", sessionSampleIndex);
        put(status, "session_recording_frame_count", sessionFrameCount);
        put(status, "recording_active", recordingActive);
        put(status, "recording_armed", recordingArmed);
        put(status, "recording_sample_count", recordingSampleIndex);
        put(status, "recording_frame_count", recordingFrameCount);
        put(status, "ready_stable_required_ms", READY_STABLE_REQUIRED_MS);
        put(status, "ready_stable_elapsed_ms", readyCandidateSinceElapsedMs <= 0L ? 0L : Math.max(0L, SystemClock.elapsedRealtime() - readyCandidateSinceElapsedMs));
        put(status, "session_ready_observed", sessionReadyObserved);
        put(status, "session_ready_elapsed_realtime_ns", sessionReadyAtElapsedNs);
        put(status, "reconnect_tolerance_ms", POLAR_RECONNECT_TOLERANCE_MS);
        put(status, "connection_gap_active", connectionGapActive);
        put(status, "last_disconnect_elapsed_realtime_ns", lastDisconnectElapsedNs);
        put(status, "last_disconnect_utc", lastDisconnectUtc);
        put(status, "ecg_gap_count", sessionGapCount);
        put(status, "max_ecg_gap_ms", nsToMs(sessionMaxGapNs));
        put(status, "total_ecg_gap_ms", nsToMs(sessionTotalGapNs));
        put(status, "polar_reconnect_count", polarReconnectCount);
        put(status, "recording_ecg_gap_count", recordingGapCount);
        put(status, "recording_max_ecg_gap_ms", nsToMs(recordingMaxGapNs));
        put(status, "recording_total_ecg_gap_ms", nsToMs(recordingTotalGapNs));
        put(status, "recording_polar_reconnect_count", recordingReconnectCount);
        put(status, "recording_ecg_qc_valid", recordingStartElapsedNs > 0L && recordingQcValidLocked());
        put(status, "recording_ecg_qc_flag", recordingStartElapsedNs > 0L ? recordingQcFlagLocked() : "pending");
        if (statusEventSequence > 0L) {
            put(status, "polar_event_sequence", statusEventSequence);
            put(status, "polar_event_type", statusEventType);
            put(status, "polar_event_failure_code", statusEventFailureCode);
            put(status, "polar_event_message", statusEventMessage);
            put(status, "polar_event_recorded_at_utc", statusEventUtc);
            put(status, "polar_event_elapsed_realtime_ns", statusEventElapsedNs);
        }
        put(status, "last_error", lastError);
        put(status, "missing_permissions", missingPermissions);
        put(status, "recent_scan_candidates", new JSONArray(recentScanCandidates.toString()));
        put(status, "recent_ecg_samples_uv", recentEcgSamplesJsonLocked());
        put(status, "diagnostic", diagnosticLocked());
        put(status, "native_ready_rule", "streaming && heart_rate_bpm > 0 && rr_interval_count > 0 && pmd_ready && ecg_streaming && ecg_sample_count > 0 && ecg_sample_rate_hz == 130 && stable_for_3s");
        return status;
    }

    private boolean readyLocked() {
        refreshReadyWindowLocked();
        return readyPrerequisitesLocked()
                && readyCandidateSinceElapsedMs > 0L
                && SystemClock.elapsedRealtime() - readyCandidateSinceElapsedMs >= READY_STABLE_REQUIRED_MS;
    }

    private boolean readyPrerequisitesLocked() {
        long latestFrameAgeMs = latestFrameElapsedNs <= 0L
                ? Long.MAX_VALUE
                : (SystemClock.elapsedRealtimeNanos() - latestFrameElapsedNs) / 1_000_000L;
        return "streaming".equals(statusState)
                && heartRateBpm > 0
                && rrIntervalCount > 0
                && pmdControlPointIndicationsEnabled
                && pmdDataNotificationsEnabled
                && pmdSettingsReceived
                && ecgStreamStarted
                && ecgSampleCount > 0
                && latestFrameAgeMs <= ECG_STALL_TIMEOUT_MS;
    }

    private void refreshReadyWindowLocked() {
        if (!readyPrerequisitesLocked()) {
            readyCandidateSinceElapsedMs = 0L;
            return;
        }
        long nowMs = SystemClock.elapsedRealtime();
        if (readyCandidateSinceElapsedMs <= 0L) {
            readyCandidateSinceElapsedMs = nowMs;
        }
        if (!sessionReadyObserved && nowMs - readyCandidateSinceElapsedMs >= READY_STABLE_REQUIRED_MS) {
            sessionReadyObserved = true;
            sessionReadyAtElapsedNs = SystemClock.elapsedRealtimeNanos();
        }
    }

    private String diagnosticLocked() {
        if (readyLocked()) {
            return "PMD ready | ECG streaming | MTU " + PREFERRED_MTU + "/" + negotiatedMtu;
        }
        if (readyPrerequisitesLocked()) {
            return "Polar H10 ECG stabilizing";
        }
        if (!lastError.isEmpty()) {
            return lastError;
        }
        return statusState == null || statusState.isEmpty() ? "Waiting for Polar H10 signal" : statusState;
    }

    private String deviceIdLocked() {
        if (!deviceName.isEmpty() && !deviceAddress.isEmpty()) {
            return deviceName + " [" + deviceAddress + "]";
        }
        if (!deviceAddress.isEmpty()) {
            return deviceAddress;
        }
        if (!deviceName.isEmpty()) {
            return deviceName;
        }
        return "not_connected";
    }

    private JSONArray recentEcgSamplesJsonLocked() {
        JSONArray values = new JSONArray();
        int count = Math.min(recentEcgCount, recentEcgSamples.length);
        int start = (recentEcgWriteIndex - count + recentEcgSamples.length) % recentEcgSamples.length;
        for (int i = 0; i < count; i++) {
            values.put(recentEcgSamples[(start + i) % recentEcgSamples.length]);
        }
        return values;
    }

    private List<String> missingBluetoothPermissions() {
        List<String> permissions;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            permissions = Arrays.asList(
                    Manifest.permission.BLUETOOTH_SCAN,
                    Manifest.permission.BLUETOOTH_CONNECT);
        } else {
            permissions = Arrays.asList(
                    Manifest.permission.ACCESS_FINE_LOCATION,
                    Manifest.permission.ACCESS_COARSE_LOCATION);
        }

        List<String> missing = new ArrayList<>();
        for (String permission : permissions) {
            if (context.checkSelfPermission(permission) != PackageManager.PERMISSION_GRANTED) {
                missing.add(permission);
            }
        }
        synchronized (lock) {
            missingPermissions = join(missing, ", ");
        }
        return missing;
    }

    private PolarDeviceCandidate toPolarCandidate(ScanResult result) {
        if (result == null || result.getDevice() == null) {
            return null;
        }
        String advertisedName = result.getScanRecord() == null ? "" : result.getScanRecord().getDeviceName();
        String deviceNameFromGatt = safeDeviceName(result.getDevice(), "");
        String matchedName = advertisedName != null && !advertisedName.isEmpty() ? advertisedName : deviceNameFromGatt;
        boolean hasHeartRate = advertisesService(result, HEART_RATE_SERVICE);
        boolean hasPmd = advertisesService(result, PMD_SERVICE);
        String address = safeDeviceAddress(result.getDevice(), "");
        int matchScore = candidateScore(matchedName, address, hasHeartRate, hasPmd);
        String displayName = matchedName != null && !matchedName.isEmpty() ? matchedName : "Unnamed BLE device";
        recordScanCandidate(result, displayName, hasHeartRate, hasPmd, matchScore, matchScore > 0);
        if (matchScore <= 0) {
            return null;
        }
        return new PolarDeviceCandidate(
                result.getDevice(),
                displayName,
                address,
                result.getRssi(),
                hasHeartRate,
                hasPmd,
                matchScore);
    }

    private boolean advertisesService(ScanResult result, UUID uuid) {
        if (result.getScanRecord() == null) {
            return false;
        }
        ParcelUuid parcelUuid = new ParcelUuid(uuid);
        return (result.getScanRecord().getServiceUuids() != null
                && result.getScanRecord().getServiceUuids().contains(parcelUuid))
                || (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q
                && result.getScanRecord().getServiceSolicitationUuids() != null
                && result.getScanRecord().getServiceSolicitationUuids().contains(parcelUuid));
    }

    private void recordScanCandidate(
            ScanResult result,
            String displayName,
            boolean hasHeartRate,
            boolean hasPmd,
            int matchScore,
            boolean accepted
    ) {
        synchronized (lock) {
            try {
                JSONObject candidate = new JSONObject();
                put(candidate, "accepted", accepted);
                put(candidate, "name", displayName == null ? "" : displayName);
                put(candidate, "address", safeDeviceAddress(result.getDevice(), ""));
                put(candidate, "rssi", result.getRssi());
                put(candidate, "heart_rate_service", hasHeartRate);
                put(candidate, "pmd_service", hasPmd);
                put(candidate, "match_score", matchScore);
                appendRecentScanCandidateLocked(candidate);
                publishStatusLocked(false);
            } catch (Exception error) {
                lastError = "Scan candidate summary failed: " + error.getMessage();
                publishStatusLocked(true);
            }
        }
    }

    private void appendRecentScanCandidateLocked(JSONObject candidate) {
        String address = candidate.optString("address", "");
        String name = candidate.optString("name", "");
        boolean accepted = candidate.optBoolean("accepted", false);
        for (int i = recentScanCandidates.length() - 1; i >= 0; i--) {
            JSONObject existing = recentScanCandidates.optJSONObject(i);
            if (existing == null || existing.optBoolean("accepted", false) != accepted) {
                continue;
            }
            String existingAddress = existing.optString("address", "");
            boolean sameAddress = !address.isEmpty() && address.equals(existingAddress);
            boolean sameName = address.isEmpty() && existingAddress.isEmpty() && name.equals(existing.optString("name", ""));
            if (sameAddress || sameName) {
                recentScanCandidates.remove(i);
            }
        }
        while (recentScanCandidates.length() >= MAX_SCAN_CANDIDATE_SUMMARIES) {
            recentScanCandidates.remove(0);
        }
        recentScanCandidates.put(candidate);
    }

    private int candidateScore(String name, String address, boolean hasHeartRate, boolean hasPmd) {
        int score = 0;
        if (!address.isEmpty() && address.equals(lastSuccessfulDeviceAddress)) {
            score += 180;
        }
        if (!address.isEmpty() && address.equals(requestedDeviceAddress)) {
            score += 220;
        }
        if (hasPmd) {
            score += 140;
        }
        String lowerName = name == null ? "" : name.toLowerCase(Locale.ROOT);
        if (lowerName.contains("polar h10")) {
            score += 120;
        } else if (lowerName.contains("h10")) {
            score += 90;
        } else if (lowerName.contains("polar")) {
            score += 50;
        }
        if (hasHeartRate) {
            score += 30;
        }
        return score;
    }

    private static boolean isBetterCandidate(PolarDeviceCandidate candidate, PolarDeviceCandidate currentBest) {
        if (candidate == null) {
            return false;
        }
        if (currentBest == null) {
            return true;
        }
        if (candidate.matchScore != currentBest.matchScore) {
            return candidate.matchScore > currentBest.matchScore;
        }
        return candidate.rssi > currentBest.rssi;
    }

    private static byte[] buildGetSettingsRequest() {
        return new byte[]{OPCODE_GET_SETTINGS, MEASUREMENT_TYPE_ECG};
    }

    private static byte[] buildStartEcgRequest() {
        return new byte[]{
                OPCODE_START_STREAM,
                MEASUREMENT_TYPE_ECG,
                0x00,
                0x01,
                (byte) (ECG_SAMPLE_RATE_HZ & 0xff),
                (byte) ((ECG_SAMPLE_RATE_HZ >> 8) & 0xff),
                0x01,
                0x01,
                (byte) (ECG_RESOLUTION_BITS & 0xff),
                (byte) ((ECG_RESOLUTION_BITS >> 8) & 0xff)
        };
    }

    private static byte[] buildStopRequest() {
        return new byte[]{OPCODE_STOP_STREAM, MEASUREMENT_TYPE_ECG};
    }

    private static ControlResponse parseControlResponse(byte[] bytes) {
        if (bytes == null || bytes.length < 4 || (bytes[0] & 0xff) != RESPONSE_FRAME_ID) {
            return null;
        }
        return new ControlResponse(bytes[1] & 0xff, bytes[2] & 0xff, bytes[3] & 0xff);
    }

    private static EcgFrame decodeEcgFrame(byte[] bytes) {
        if (bytes == null || bytes.length < 10 || bytes[0] != MEASUREMENT_TYPE_ECG) {
            return null;
        }
        int payloadLength = bytes.length - 10;
        if (payloadLength <= 0 || payloadLength % 3 != 0) {
            return null;
        }
        long sensorTimestampNs = ByteBuffer.wrap(bytes, 1, 8)
                .order(ByteOrder.LITTLE_ENDIAN)
                .getLong();
        int sampleCount = payloadLength / 3;
        int[] samples = new int[sampleCount];
        int index = 0;
        for (int offset = 10; offset < bytes.length; offset += 3) {
            int raw = (bytes[offset] & 0xff)
                    | ((bytes[offset + 1] & 0xff) << 8)
                    | ((bytes[offset + 2] & 0xff) << 16);
            if ((raw & 0x0080_0000) != 0) {
                raw |= 0xff00_0000;
            }
            samples[index++] = raw;
        }
        return new EcgFrame(sensorTimestampNs, samples, Instant.now().toString(), SystemClock.elapsedRealtimeNanos());
    }

    private static HeartRateMeasurement decodeHeartRate(byte[] bytes) {
        if (bytes == null || bytes.length < 2) {
            return null;
        }
        int flags = bytes[0] & 0xff;
        int index = 1;
        int heartRate;
        if ((flags & 0x01) != 0) {
            if (bytes.length < 3) {
                return null;
            }
            heartRate = (bytes[index] & 0xff) | ((bytes[index + 1] & 0xff) << 8);
            index += 2;
        } else {
            heartRate = bytes[index] & 0xff;
            index += 1;
        }
        if ((flags & 0x08) != 0) {
            index += 2;
        }
        int rrCount = 0;
        if ((flags & 0x10) != 0) {
            while (index + 1 < bytes.length) {
                rrCount++;
                index += 2;
            }
        }
        return new HeartRateMeasurement(heartRate, rrCount);
    }

    private static int awaitInteger(LinkedBlockingQueue<Integer> queue, long timeoutMs, int fallback) throws InterruptedException {
        Integer value = queue.poll(timeoutMs, TimeUnit.MILLISECONDS);
        return value == null ? fallback : value;
    }

    @SuppressLint("MissingPermission")
    private static boolean writeCharacteristicCompat(
            BluetoothGatt localGatt,
            BluetoothGattCharacteristic characteristic,
            byte[] value
    ) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            return localGatt.writeCharacteristic(
                    characteristic,
                    value,
                    BluetoothGattCharacteristic.WRITE_TYPE_DEFAULT) == BluetoothStatusCodes.SUCCESS;
        }
        characteristic.setValue(value);
        characteristic.setWriteType(BluetoothGattCharacteristic.WRITE_TYPE_DEFAULT);
        return localGatt.writeCharacteristic(characteristic);
    }

    @SuppressLint("MissingPermission")
    private static boolean writeDescriptorCompat(
            BluetoothGatt localGatt,
            BluetoothGattDescriptor descriptor,
            byte[] value
    ) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            return localGatt.writeDescriptor(descriptor, value) == BluetoothStatusCodes.SUCCESS;
        }
        descriptor.setValue(value);
        return localGatt.writeDescriptor(descriptor);
    }

    @SuppressLint("MissingPermission")
    private static String safeDeviceName(BluetoothDevice device, String fallback) {
        try {
            String name = device == null ? "" : device.getName();
            return name != null && !name.isEmpty() ? name : fallback;
        } catch (SecurityException error) {
            return fallback;
        }
    }

    @SuppressLint("MissingPermission")
    private static String safeDeviceAddress(BluetoothDevice device, String fallback) {
        try {
            String address = device == null ? "" : device.getAddress();
            return address != null && !address.isEmpty() ? address : fallback;
        } catch (SecurityException error) {
            return fallback;
        }
    }

    private static String join(List<String> values, String delimiter) {
        if (values == null || values.isEmpty()) {
            return "";
        }
        StringBuilder builder = new StringBuilder();
        for (int i = 0; i < values.size(); i++) {
            if (i > 0) {
                builder.append(delimiter);
            }
            builder.append(values.get(i));
        }
        return builder.toString();
    }

    private static String csv(String... values) {
        StringBuilder builder = new StringBuilder();
        for (int i = 0; i < values.length; i++) {
            if (i > 0) {
                builder.append(',');
            }
            String value = values[i] == null ? "" : values[i];
            if (value.contains(",") || value.contains("\"") || value.contains("\n")) {
                builder.append('"').append(value.replace("\"", "\"\"")).append('"');
            } else {
                builder.append(value);
            }
        }
        return builder.toString();
    }

    private static List<String> parseCsvLine(String line) {
        List<String> cells = new ArrayList<>();
        StringBuilder cell = new StringBuilder();
        boolean quoted = false;
        for (int i = 0; i < line.length(); i++) {
            char value = line.charAt(i);
            if (quoted) {
                if (value == '"' && i + 1 < line.length() && line.charAt(i + 1) == '"') {
                    cell.append('"');
                    i++;
                } else if (value == '"') {
                    quoted = false;
                } else {
                    cell.append(value);
                }
                continue;
            }
            if (value == '"') {
                quoted = true;
            } else if (value == ',') {
                cells.add(cell.toString());
                cell.setLength(0);
            } else {
                cell.append(value);
            }
        }
        cells.add(cell.toString());
        return cells;
    }

    private static String cell(List<String> cells, int index) {
        if (index < 0 || index >= cells.size()) {
            return "";
        }
        return cells.get(index);
    }

    private static long parseLongCell(List<String> cells, int index) {
        try {
            return Long.parseLong(cell(cells, index));
        } catch (NumberFormatException error) {
            return 0L;
        }
    }

    private static void put(JSONObject object, String key, Object value) {
        try {
            object.put(key, value == null ? JSONObject.NULL : value);
        } catch (JSONException error) {
            throw new IllegalStateException("Unable to put " + key, error);
        }
    }

    private final class GattCallback extends BluetoothGattCallback {
        final LinkedBlockingQueue<Integer> connectStatuses = new LinkedBlockingQueue<>();
        final LinkedBlockingQueue<Integer> disconnectStatuses = new LinkedBlockingQueue<>();
        final LinkedBlockingQueue<Integer> serviceStatuses = new LinkedBlockingQueue<>();
        final LinkedBlockingQueue<Integer> mtuValues = new LinkedBlockingQueue<>();
        final LinkedBlockingQueue<Integer> descriptorWriteStatuses = new LinkedBlockingQueue<>();
        final LinkedBlockingQueue<Integer> characteristicWriteStatuses = new LinkedBlockingQueue<>();
        final LinkedBlockingQueue<byte[]> controlNotifications = new LinkedBlockingQueue<>();

        @Override
        public void onConnectionStateChange(BluetoothGatt gatt, int status, int newState) {
            if (newState == BluetoothProfile.STATE_CONNECTED || status != BluetoothGatt.GATT_SUCCESS) {
                connectStatuses.offer(status);
            }
            if (newState == BluetoothProfile.STATE_DISCONNECTED) {
                disconnectStatuses.offer(status);
            }
        }

        @Override
        public void onMtuChanged(BluetoothGatt gatt, int mtu, int status) {
            mtuValues.offer(status == BluetoothGatt.GATT_SUCCESS ? mtu : 0);
        }

        @Override
        public void onServicesDiscovered(BluetoothGatt gatt, int status) {
            serviceStatuses.offer(status);
        }

        @Override
        public void onDescriptorWrite(BluetoothGatt gatt, BluetoothGattDescriptor descriptor, int status) {
            descriptorWriteStatuses.offer(status);
        }

        @Override
        public void onCharacteristicWrite(BluetoothGatt gatt, BluetoothGattCharacteristic characteristic, int status) {
            characteristicWriteStatuses.offer(status);
        }

        @Override
        public void onCharacteristicChanged(BluetoothGatt gatt, BluetoothGattCharacteristic characteristic) {
            handleNotification(characteristic, characteristic.getValue());
        }

        @Override
        public void onCharacteristicChanged(BluetoothGatt gatt, BluetoothGattCharacteristic characteristic, byte[] value) {
            handleNotification(characteristic, value);
        }

        void close() {
            controlNotifications.clear();
        }

        private void handleNotification(BluetoothGattCharacteristic characteristic, byte[] value) {
            if (characteristic == null || value == null) {
                return;
            }
            UUID uuid = characteristic.getUuid();
            if (PMD_CONTROL_POINT.equals(uuid)) {
                controlNotifications.offer(value.clone());
            } else if (PMD_DATA.equals(uuid)) {
                handlePmdData(value.clone());
            } else if (HEART_RATE_MEASUREMENT.equals(uuid)) {
                handleHeartRateData(value.clone());
            }
        }
    }

    private static final class ConnectionOutcome {
        final boolean retry;
        final String errorCode;
        final String message;

        private ConnectionOutcome(boolean retry, String errorCode, String message) {
            this.retry = retry;
            this.errorCode = errorCode == null ? "" : errorCode;
            this.message = message == null ? "" : message;
        }

        static ConnectionOutcome retry(String errorCode, String message) {
            return new ConnectionOutcome(true, errorCode, message);
        }

        static ConnectionOutcome clean() {
            return new ConnectionOutcome(false, "", "");
        }
    }

    private static final class PolarDeviceCandidate {
        final BluetoothDevice device;
        final String deviceName;
        final String deviceAddress;
        final int rssi;
        final boolean heartRateServiceVisible;
        final boolean pmdServiceVisible;
        final int matchScore;

        PolarDeviceCandidate(
                BluetoothDevice device,
                String deviceName,
                String deviceAddress,
                int rssi,
                boolean heartRateServiceVisible,
                boolean pmdServiceVisible,
                int matchScore
        ) {
            this.device = device;
            this.deviceName = deviceName;
            this.deviceAddress = deviceAddress;
            this.rssi = rssi;
            this.heartRateServiceVisible = heartRateServiceVisible;
            this.pmdServiceVisible = pmdServiceVisible;
            this.matchScore = matchScore;
        }
    }

    private static final class ControlResponse {
        final int opCode;
        final int measurementType;
        final int errorCode;

        ControlResponse(int opCode, int measurementType, int errorCode) {
            this.opCode = opCode;
            this.measurementType = measurementType;
            this.errorCode = errorCode;
        }

        boolean success() {
            return errorCode == 0;
        }
    }

    private static final class EcgFrame {
        final long sensorTimestampNs;
        final int[] samples;
        final String receivedAtUtc;
        final long receivedElapsedNs;

        EcgFrame(long sensorTimestampNs, int[] samples, String receivedAtUtc, long receivedElapsedNs) {
            this.sensorTimestampNs = sensorTimestampNs;
            this.samples = samples;
            this.receivedAtUtc = receivedAtUtc;
            this.receivedElapsedNs = receivedElapsedNs;
        }
    }

    private static final class HeartRateMeasurement {
        final int heartRateBpm;
        final int rrIntervalCount;

        HeartRateMeasurement(int heartRateBpm, int rrIntervalCount) {
            this.heartRateBpm = heartRateBpm;
            this.rrIntervalCount = rrIntervalCount;
        }
    }
}
