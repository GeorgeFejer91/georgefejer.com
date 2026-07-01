package com.georgefejer.study6.quest;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.Service;
import android.content.Context;
import android.content.Intent;
import android.content.pm.ServiceInfo;
import android.os.IBinder;

public final class Study6PhysiologyForegroundService extends Service {
    private static final String CHANNEL_ID = "study6_physiology_recording";
    private static final int NOTIFICATION_ID = 60610;
    private static final String EXTRA_PARTICIPANT_ID = "participant_id";
    private static final String EXTRA_APK_VARIANT_ID = "apk_variant_id";

    static void start(Context context, String participantId, String apkVariantId) {
        Intent intent = new Intent(context, Study6PhysiologyForegroundService.class);
        intent.putExtra(EXTRA_PARTICIPANT_ID, participantId == null ? "" : participantId);
        intent.putExtra(EXTRA_APK_VARIANT_ID, apkVariantId == null ? "" : apkVariantId);
        context.startForegroundService(intent);
    }

    static void stop(Context context) {
        context.stopService(new Intent(context, Study6PhysiologyForegroundService.class));
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        createNotificationChannel();
        String participantId = intent == null ? "" : intent.getStringExtra(EXTRA_PARTICIPANT_ID);
        String apkVariantId = intent == null ? "" : intent.getStringExtra(EXTRA_APK_VARIANT_ID);
        Notification notification = new Notification.Builder(this, CHANNEL_ID)
                .setSmallIcon(android.R.drawable.stat_sys_data_bluetooth)
                .setContentTitle("Study 6 physiology recording")
                .setContentText((apkVariantId == null ? "" : apkVariantId) + " " + (participantId == null ? "" : participantId))
                .setOngoing(true)
                .setOnlyAlertOnce(true)
                .build();
        startForeground(NOTIFICATION_ID, notification, ServiceInfo.FOREGROUND_SERVICE_TYPE_CONNECTED_DEVICE);
        return START_STICKY;
    }

    @Override
    public IBinder onBind(Intent intent) {
        return null;
    }

    private void createNotificationChannel() {
        NotificationManager manager = getSystemService(NotificationManager.class);
        if (manager == null || manager.getNotificationChannel(CHANNEL_ID) != null) {
            return;
        }
        NotificationChannel channel = new NotificationChannel(
                CHANNEL_ID,
                "Study 6 physiology recording",
                NotificationManager.IMPORTANCE_LOW);
        channel.setDescription("Keeps Polar H10 ECG recording active during Study 6 runs.");
        manager.createNotificationChannel(channel);
    }
}
