package com.georgefejer.study6.quest;

import android.annotation.SuppressLint;
import android.app.Activity;
import android.content.Intent;
import android.media.MediaPlayer;
import android.net.Uri;
import android.os.Handler;
import android.os.Looper;
import android.os.SystemClock;
import android.util.Log;
import android.view.WindowManager;
import android.webkit.JavascriptInterface;
import android.webkit.WebChromeClient;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.TextView;

import org.json.JSONException;
import org.json.JSONObject;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.time.Instant;

final class Study6QuestionnairePanelController {
    private static final String TAG = "Study6Panel";
    private static final int DEV_AUDIO_DURATION_MS = 20_000;

    private final Activity activity;
    private final WebView webView;
    private final TextView banner;
    private final Handler mainHandler = new Handler(Looper.getMainLooper());

    private Study6RunLogger logger;
    private Study6PolarH10Manager polarManager;
    private MediaPlayer mediaPlayer;
    private int activeAudioBlock = -1;
    private boolean autoRunEnabled;
    private boolean started;
    private boolean webContentReady;
    private boolean polarConnectedLogged;
    private boolean polarEcgStreamStartedLogged;
    private boolean physiologyCompletedLogged;
    private long lastPolarStatusEventSequence;
    private String apkVariantId;
    private String autoRunProfile;
    private JSONObject latestPolarStatus;

    Study6QuestionnairePanelController(Activity activity, WebView webView, TextView banner) {
        this.activity = activity;
        this.webView = webView;
        this.banner = banner;
    }

    @SuppressLint({"SetJavaScriptEnabled", "AddJavascriptInterface"})
    void start(Intent intent) {
        if (started) {
            return;
        }
        started = true;
        apkVariantId = stringExtra(intent, "study6_apk_variant_id", "BG_ENV");
        String requestedParticipantId = stringExtra(intent, "study6_participant_id", "");
        autoRunEnabled = booleanExtra(intent, "study6_auto_run", false);
        autoRunProfile = stringExtra(intent, "study6_auto_run_profile", "linear");
        logger = new Study6RunLogger(activity, apkVariantId, DEV_AUDIO_DURATION_MS / 1000, requestedParticipantId);
        Study6PolarH10Manager.requestRuntimePermissions(activity);
        startPhysiologyForegroundService();
        String requestedPolarAddress = stringExtra(intent, "study6_polar_device_address", "");
        polarManager = new Study6PolarH10Manager(activity, this::onPolarStatus);
        JSONObject physiologyStarted = polarManager.startSessionRecording(
                logger.participantId(),
                logger.sessionId(),
                logger.apkVariantId(),
                logger.apkFileCode(),
                logger.ecgMasterCsvFile());
        logger.logSessionPhysiologyStarted(physiologyStarted);
        polarManager.start(requestedPolarAddress);
        updateBanner();

        WebSettings settings = webView.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setAllowFileAccess(true);
        settings.setAllowFileAccessFromFileURLs(true);
        settings.setAllowUniversalAccessFromFileURLs(true);
        settings.setMediaPlaybackRequiresUserGesture(false);
        webView.setFocusable(true);
        webView.setFocusableInTouchMode(true);
        activity.getWindow().setSoftInputMode(WindowManager.LayoutParams.SOFT_INPUT_ADJUST_RESIZE);
        webView.setWebChromeClient(new WebChromeClient());
        webView.setWebViewClient(new WebViewClient() {
            @Override
            public void onPageFinished(WebView view, String url) {
                installQuestAuthorityJavascript();
                installBridgeJavascript();
                if (!autoRunEnabled) {
                    installManualAuditJavascript();
                }
                if (autoRunEnabled) {
                    installQuestAutoRunJavascript();
                }
                webContentReady = true;
                pushLatestPolarStatus();
            }
        });
        webView.addJavascriptInterface(new Study6Bridge(), "AndroidStudy6");
        webView.loadUrl("file:///android_asset/questionnaire-ui-preview/index.html?questApk=1"
                + "&participant_id=" + Uri.encode(logger.participantId())
                + "&apk_variant_id=" + Uri.encode(apkVariantId)
                + "&auto_run_profile=" + Uri.encode(autoRunProfile));
        logger.logHarnessStarted();
        if (autoRunEnabled) {
            logger.logHarnessEvent("quest_auto_run_profile", autoRunProfile);
        }
    }

    private void installQuestAuthorityJavascript() {
        try {
            String js = "window.__STUDY6_QUEST_BLOCK_ORDER=" + logger.questBlockOrderJson() + ";\n"
                    + readAssetText("study6-quest-authority.js");
            webView.evaluateJavascript(js, null);
        } catch (IOException error) {
            logger.logHarnessEvent("quest_authority_install_failed", error.getMessage());
            Log.e(TAG, "Unable to install Quest authority script", error);
        }
    }

    private void installManualAuditJavascript() {
        try {
            webView.evaluateJavascript(readAssetText("study6-quest-manual-audit.js"), null);
        } catch (IOException error) {
            logger.logHarnessEvent("manual_audit_install_failed", error.getMessage());
            Log.e(TAG, "Unable to install manual audit script", error);
        }
    }

    void shutdown(boolean destroyWebView) {
        stopAudio("controller_shutdown");
        if (polarManager != null) {
            completeSessionPhysiology("controller_shutdown");
            polarManager.close();
            polarManager = null;
        }
        mainHandler.removeCallbacksAndMessages(null);
        if (destroyWebView) {
            webView.destroy();
        }
    }

    private void updateBanner() {
        if (banner == null) {
            return;
        }
        banner.setText("Study 6 dev harness: " + apkVariantId + " | " + logger.participantId()
                + " | lookup-owned order | 20s audio blocks"
                + (autoRunEnabled ? " | auto-run validation" : ""));
    }

    private void installBridgeJavascript() {
        String js = "(function(){"
                + "if(window.__study6BridgeInstalled){return;}"
                + "window.__study6BridgeInstalled=true;"
                + "function send(reason){"
                + "try{"
                + "if(!window.STUDY6_QUESTIONNAIRE_PREVIEW){return;}"
                + "var payload=window.STUDY6_QUESTIONNAIRE_PREVIEW.exportObject();"
                + "window.AndroidStudy6.onQuestionnaireSnapshot(reason, JSON.stringify(payload));"
                + "}catch(e){window.AndroidStudy6.onBridgeError(String(e));}"
                + "}"
                + "['nextPage','previousPage'].forEach(function(id){"
                + "var el=document.getElementById(id);"
                + "if(el){el.addEventListener('click',function(){setTimeout(function(){send(id);},250);},true);}"
                + "});"
                + "document.addEventListener('change',function(){setTimeout(function(){send('change');},150);},true);"
                + "document.addEventListener('click',function(){setTimeout(function(){send('click');},150);},true);"
                + "setInterval(function(){send('poll');},2000);"
                + "send('page_loaded');"
                + "})();";
        webView.evaluateJavascript(js, null);
    }

    private void onPolarStatus(JSONObject status) {
        latestPolarStatus = status;
        if (logger != null) {
            logger.updatePolarStatus(status);
        }
        if (!polarConnectedLogged && status.optBoolean("connected", false)) {
            polarConnectedLogged = true;
            logger.logPolarConnected(status);
        }
        if (!polarEcgStreamStartedLogged && status.optBoolean("ecg_streaming", false)) {
            polarEcgStreamStartedLogged = true;
            logger.logPolarEcgStreamStarted(status);
        }
        logPolarStatusEvent(status);
        pushLatestPolarStatus();
    }

    private void logPolarStatusEvent(JSONObject status) {
        long sequence = status.optLong("polar_event_sequence", 0L);
        if (sequence <= 0L || sequence <= lastPolarStatusEventSequence) {
            return;
        }
        lastPolarStatusEventSequence = sequence;
        String eventType = status.optString("polar_event_type", "");
        if (eventType.isEmpty()) {
            return;
        }
        JSONObject extra = new JSONObject();
        put(extra, "polar_event_sequence", sequence);
        put(extra, "failure_code", status.optString("polar_event_failure_code", ""));
        put(extra, "failure_message", status.optString("polar_event_message", ""));
        put(extra, "event_state", status.optString("state", ""));
        put(extra, "polar_device_id", status.optString("device_id", ""));
        put(extra, "device_name", status.optString("device_name", ""));
        put(extra, "device_address", status.optString("device_address", ""));
        put(extra, "polar_ready", status.optBoolean("ready", false));
        put(extra, "heart_rate_bpm", status.optInt("heart_rate_bpm", 0));
        put(extra, "rr_interval_count", status.optInt("rr_interval_count", 0));
        put(extra, "ecg_sample_count", status.optLong("ecg_sample_count", 0L));
        put(extra, "pmd_frame_count", status.optLong("pmd_frame_count", 0L));
        put(extra, "connection_gap_active", status.optBoolean("connection_gap_active", false));
        put(extra, "ecg_gap_count", status.optInt("ecg_gap_count", 0));
        put(extra, "max_ecg_gap_ms", status.optLong("max_ecg_gap_ms", 0L));
        put(extra, "total_ecg_gap_ms", status.optLong("total_ecg_gap_ms", 0L));
        put(extra, "polar_reconnect_count", status.optInt("polar_reconnect_count", 0));
        put(extra, "reconnect_tolerance_ms", status.optLong("reconnect_tolerance_ms", 0L));
        put(extra, "last_disconnect_utc", status.optString("last_disconnect_utc", ""));
        put(extra, "last_disconnect_elapsed_realtime_ns", status.optLong("last_disconnect_elapsed_realtime_ns", 0L));
        Study6RunLogger.BlockPlan activePlan = activeAudioBlock > 0 ? logger.blockPlan(activeAudioBlock) : null;
        logger.logPolarRuntimeMarker(activePlan, eventType, extra);
    }

    private void pushLatestPolarStatus() {
        if (!webContentReady || latestPolarStatus == null) {
            return;
        }
        String js = "if(window.STUDY6_QUESTIONNAIRE_PREVIEW"
                + "&&window.STUDY6_QUESTIONNAIRE_PREVIEW.setNativePolarValidation){"
                + "window.STUDY6_QUESTIONNAIRE_PREVIEW.setNativePolarValidation("
                + latestPolarStatus.toString()
                + ");}";
        mainHandler.post(() -> webView.evaluateJavascript(js, null));
    }

    private void installQuestAutoRunJavascript() {
        try {
            webView.evaluateJavascript(readAssetText("study6-quest-auto-run.js"), null);
        } catch (IOException error) {
            logger.logHarnessEvent("quest_auto_run_install_failed", error.getMessage());
            Log.e(TAG, "Unable to install Quest auto-run script", error);
        }
    }

    private void maybeStartBlockAudio(JSONObject snapshot) throws JSONException {
        String activePage = snapshot.optString("active_panel_page_id", "");
        int blockPosition = snapshot.optInt("active_block_position", snapshot.optInt("active_condition_position", 1));
        if (!"vr_task_instructions".equals(activePage) || blockPosition <= 0 || activeAudioBlock == blockPosition) {
            return;
        }
        activeAudioBlock = blockPosition;
        Study6RunLogger.BlockPlan blockPlan = logger.blockPlan(blockPosition, languageCodeFromSnapshot(snapshot));
        String uiConditionId = snapshot.optString("active_vr_condition_id", snapshot.optString("active_condition_id", ""));
        if (!uiConditionId.isEmpty() && !blockPlan.vrConditionId.equals(uiConditionId)) {
            JSONObject mismatch = new JSONObject();
            put(mismatch, "ui_active_block_position", blockPosition);
            put(mismatch, "ui_active_vr_condition_id", uiConditionId);
            put(mismatch, "lookup_vr_condition_id", blockPlan.vrConditionId);
            logger.logPhysiologyFailure(blockPlan, "marker_plan_mismatch",
                    "WebView active condition did not match lookup-derived native block plan.",
                    "metadata_invalid",
                    mismatch);
            logger.logTechnicalFailure(blockPlan, "marker_plan_mismatch",
                    "UI condition " + uiConditionId + " != native lookup condition " + blockPlan.vrConditionId);
            activeAudioBlock = -1;
            return;
        }
        if (!isPolarReadyForBlock()) {
            JSONObject extra = latestPolarStatus == null ? new JSONObject() : new JSONObject(latestPolarStatus.toString());
            logger.logPhysiologyFailure(blockPlan, "polar_not_ready_at_block_start",
                    "Native Polar readiness gate blocked audio/condition start.",
                    "physiology_invalid",
                    extra);
            logger.logTechnicalFailure(blockPlan, "polar_not_ready_at_block_start",
                    "Native Polar readiness gate blocked audio/condition start.");
            activeAudioBlock = -1;
            return;
        }
        logger.logBlockStarted(blockPlan);
        playAudioForBlock(blockPlan);
    }

    private boolean isPolarReadyForBlock() {
        return latestPolarStatus != null
                && latestPolarStatus.optBoolean("ready", false)
                && latestPolarStatus.optBoolean("streaming", false)
                && latestPolarStatus.optBoolean("pmd_ready", false)
                && latestPolarStatus.optBoolean("ecg_streaming", false)
                && latestPolarStatus.optLong("ecg_sample_count", 0L) > 0L
                && latestPolarStatus.optInt("ecg_sample_rate_hz", 0) == 130;
    }

    private String languageCodeFromSnapshot(JSONObject snapshot) {
        JSONObject demographics = snapshot == null ? null : snapshot.optJSONObject("demographics");
        return demographics != null && "de".equals(demographics.optString("language_code", "en")) ? "de" : "en";
    }

    private void playAudioForBlock(Study6RunLogger.BlockPlan blockPlan) {
        stopAudio("new_block");
        try {
            mediaPlayer = new MediaPlayer();
            android.content.res.AssetFileDescriptor afd = activity.getAssets()
                    .openFd("neutral-hand-audio/audio/" + blockPlan.audioAssetFile);
            mediaPlayer.setDataSource(afd.getFileDescriptor(), afd.getStartOffset(), afd.getLength());
            afd.close();
            mediaPlayer.setLooping(true);
            mediaPlayer.setOnPreparedListener((player) -> {
                JSONObject ecgArmed = polarManager == null
                        ? noPolarManagerSummary("ecg_recording_armed")
                        : polarManager.armBlockRecording(
                                blockPlan,
                                logger.participantId(),
                                logger.apkVariantId(),
                                logger.ecgCsvFile(blockPlan));
                logger.logEcgRecordingArmed(blockPlan, ecgArmed);
                long syncStartElapsedNs = SystemClock.elapsedRealtimeNanos();
                String syncStartUtc = Instant.now().toString();
                JSONObject syncStart = syncPayload(syncStartElapsedNs, syncStartUtc, "sync_start");
                JSONObject ecgStarted = polarManager == null
                        ? noPolarManagerSummary("ecg_recording_started")
                        : polarManager.startArmedBlockRecording(syncStartElapsedNs, syncStartUtc);
                logger.logEcgRecordingStarted(blockPlan, merge(syncStart, ecgStarted));
                player.start();
                logger.logAudioStarted(blockPlan, syncStart);
                logger.logConditionStarted(blockPlan, syncStart);
                mainHandler.postDelayed(() -> {
                    long syncEndElapsedNs = SystemClock.elapsedRealtimeNanos();
                    String syncEndUtc = Instant.now().toString();
                    JSONObject syncEnd = syncPayload(syncEndElapsedNs, syncEndUtc, "sync_end");
                    stopAudio("dev_20s_elapsed");
                    JSONObject ecgCompleted = polarManager == null
                            ? noPolarManagerSummary("ecg_recording_completed")
                            : polarManager.stopBlockRecording(syncEndElapsedNs, syncEndUtc);
                    logger.logAudioStoppedAtDevDuration(blockPlan, syncEnd);
                    logger.logConditionEnded(blockPlan, syncEnd);
                    logger.logEcgRecordingCompleted(blockPlan, merge(syncEnd, ecgCompleted));
                    logger.logBlockEcgWindowClosed(blockPlan, merge(syncEnd, ecgCompleted));
                    logPhysiologyWriteFailures(blockPlan, ecgCompleted);
                    autoAdvanceAfterDevAudio();
                }, DEV_AUDIO_DURATION_MS);
            });
            mediaPlayer.setOnCompletionListener((player) -> logger.logAudioCompletedBeforeDevDuration(blockPlan));
            mediaPlayer.prepareAsync();
        } catch (IOException error) {
            logger.logTechnicalFailure(blockPlan, "audio_start_failed", error.getMessage());
            Log.e(TAG, "Unable to play audio", error);
        }
    }

    private void logPhysiologyWriteFailures(Study6RunLogger.BlockPlan blockPlan, JSONObject summary) {
        if (summary == null) {
            return;
        }
        String writeError = summary.optString("write_error", "");
        if (!writeError.isEmpty()) {
            logger.logPhysiologyFailure(blockPlan, "ecg_write_failed", writeError, "physiology_invalid", summary);
        }
    }

    private void completeSessionPhysiology(String reason) {
        if (physiologyCompletedLogged || polarManager == null || logger == null) {
            return;
        }
        physiologyCompletedLogged = true;
        long syncEndElapsedNs = SystemClock.elapsedRealtimeNanos();
        String syncEndUtc = Instant.now().toString();
        JSONObject completed = polarManager.stopSessionRecording(syncEndElapsedNs, syncEndUtc);
        put(completed, "reason", reason);
        if (polarEcgStreamStartedLogged) {
            logger.logPolarEcgStreamStopped(completed);
        }
        logger.logSessionPhysiologyCompleted(completed);
        stopPhysiologyForegroundService();
    }

    private void startPhysiologyForegroundService() {
        try {
            Study6PhysiologyForegroundService.start(activity, logger.participantId(), logger.apkVariantId());
            logger.logHarnessEvent("physiology_foreground_service_started", logger.participantId());
        } catch (RuntimeException error) {
            logger.logHarnessEvent("physiology_foreground_service_start_failed", error.getMessage());
            Log.w(TAG, "Unable to start physiology foreground service", error);
        }
    }

    private void stopPhysiologyForegroundService() {
        try {
            Study6PhysiologyForegroundService.stop(activity);
            logger.logHarnessEvent("physiology_foreground_service_stopped", logger.participantId());
        } catch (RuntimeException error) {
            logger.logHarnessEvent("physiology_foreground_service_stop_failed", error.getMessage());
            Log.w(TAG, "Unable to stop physiology foreground service", error);
        }
    }

    private void autoAdvanceAfterDevAudio() {
        mainHandler.post(() -> webView.evaluateJavascript(
                "var b=document.getElementById('nextPage'); if(b && !b.disabled){ b.click(); }",
                null
        ));
    }

    private void stopAudio(String reason) {
        if (mediaPlayer == null) {
            return;
        }
        try {
            if (mediaPlayer.isPlaying()) {
                mediaPlayer.stop();
            }
        } catch (IllegalStateException ignored) {
            // MediaPlayer can be between prepare/start/stop states during app teardown.
        }
        mediaPlayer.release();
        mediaPlayer = null;
        if (logger != null) {
            logger.logHarnessEvent("audio_player_released", reason);
        }
    }

    private JSONObject syncPayload(long elapsedRealtimeNs, String utc, String phase) {
        JSONObject payload = new JSONObject();
        put(payload, phase + "_elapsed_realtime_ns", elapsedRealtimeNs);
        put(payload, phase + "_utc", utc);
        return payload;
    }

    private JSONObject noPolarManagerSummary(String eventType) {
        JSONObject payload = new JSONObject();
        put(payload, "event_type", eventType);
        put(payload, "state", "polar_manager_unavailable");
        put(payload, "recording_active", false);
        put(payload, "sample_count", 0);
        put(payload, "frame_count", 0);
        put(payload, "device_id", "not_connected");
        return payload;
    }

    private JSONObject merge(JSONObject base, JSONObject extra) {
        JSONObject merged = new JSONObject();
        copyInto(merged, base);
        copyInto(merged, extra);
        return merged;
    }

    private void copyInto(JSONObject target, JSONObject source) {
        if (source == null) {
            return;
        }
        org.json.JSONArray names = source.names();
        if (names == null) {
            return;
        }
        for (int i = 0; i < names.length(); i++) {
            String key = names.optString(i);
            put(target, key, source.opt(key));
        }
    }

    private void put(JSONObject object, String key, Object value) {
        try {
            object.put(key, value);
        } catch (JSONException error) {
            throw new IllegalStateException("Unable to put " + key, error);
        }
    }

    private String readAssetText(String assetPath) throws IOException {
        ByteArrayOutputStream buffer = new ByteArrayOutputStream();
        try (InputStream input = activity.getAssets().open(assetPath)) {
            byte[] chunk = new byte[8192];
            int read;
            while ((read = input.read(chunk)) != -1) {
                buffer.write(chunk, 0, read);
            }
        }
        return new String(buffer.toByteArray(), StandardCharsets.UTF_8);
    }

    private String stringExtra(Intent intent, String key, String fallback) {
        String value = intent == null ? null : intent.getStringExtra(key);
        return value == null || value.trim().isEmpty() ? fallback : value.trim();
    }

    private boolean booleanExtra(Intent intent, String key, boolean fallback) {
        if (intent == null || !intent.hasExtra(key)) {
            return fallback;
        }
        return intent.getBooleanExtra(key, fallback) || "true".equalsIgnoreCase(intent.getStringExtra(key));
    }

    private final class Study6Bridge {
        @JavascriptInterface
        public void onQuestionnaireSnapshot(String reason, String payload) {
            try {
                JSONObject snapshot = new JSONObject(payload);
                logger.logSnapshot(reason, snapshot);
                maybeStartBlockAudio(snapshot);
                logger.writeCompletedResultsIfNeeded(snapshot);
                if (logger.allExpectedResultsWritten()) {
                    completeSessionPhysiology("all_expected_results_written");
                }
            } catch (JSONException error) {
                logger.logHarnessEvent("snapshot_parse_failed", error.getMessage());
                Log.e(TAG, "Bad questionnaire snapshot", error);
            }
        }

        @JavascriptInterface
        public void onBridgeError(String message) {
            logger.logHarnessEvent("bridge_error", message);
        }

        @JavascriptInterface
        public void onQuestAutoRunStatus(String eventType, String detail) {
            logger.logHarnessEvent("quest_auto_run_" + eventType, detail);
        }

        @JavascriptInterface
        public void onQuestAutoRunFinished(String payload) {
            logger.logHarnessEvent("quest_auto_run_finished", "all blocks complete");
            onQuestionnaireSnapshot("quest_auto_run_finished", payload);
            completeSessionPhysiology("quest_auto_run_finished");
        }

        @JavascriptInterface
        public void onManualInteraction(String eventType, String payload) {
            try {
                logger.logManualInteraction(eventType, new JSONObject(payload));
            } catch (JSONException error) {
                logger.logHarnessEvent("manual_interaction_parse_failed", error.getMessage());
                Log.e(TAG, "Bad manual interaction payload", error);
            }
        }

        @JavascriptInterface
        public void requestKeyboard(String elementId) {
            logger.logHarnessEvent("native_keyboard_request_ignored", elementId == null ? "" : elementId);
        }
    }
}
