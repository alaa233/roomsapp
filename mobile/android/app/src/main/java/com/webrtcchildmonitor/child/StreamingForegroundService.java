package com.webrtcchildmonitor.child;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Intent;
import android.content.pm.ServiceInfo;
import android.os.Build;
import android.os.IBinder;
import androidx.annotation.Nullable;
import androidx.core.app.NotificationCompat;

/**
 * Foreground service while WebRTC streaming is active (camera + microphone).
 * Android 14+ uses {@code camera|microphone} foreground service types (see manifest).
 */
public class StreamingForegroundService extends Service {

  public static final String CHANNEL_ID = "webrtc_child_streaming";
  public static final int NOTIFICATION_ID = 0x7c01;
  public static final String EXTRA_TITLE = "extra_title";
  public static final String EXTRA_BODY = "extra_body";

  @Override
  public void onCreate() {
    super.onCreate();
    createChannel();
  }

  private void createChannel() {
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
      NotificationChannel channel =
          new NotificationChannel(
              CHANNEL_ID,
              getString(R.string.streaming_notification_channel_name),
              NotificationManager.IMPORTANCE_LOW);
      channel.setDescription(getString(R.string.streaming_notification_channel_desc));
      NotificationManager nm = getSystemService(NotificationManager.class);
      if (nm != null) {
        nm.createNotificationChannel(channel);
      }
    }
  }

  @Override
  public int onStartCommand(Intent intent, int flags, int startId) {
    String title =
        intent != null && intent.hasExtra(EXTRA_TITLE)
            ? intent.getStringExtra(EXTRA_TITLE)
            : getString(R.string.streaming_notification_title_default);
    String body =
        intent != null && intent.hasExtra(EXTRA_BODY)
            ? intent.getStringExtra(EXTRA_BODY)
            : getString(R.string.streaming_notification_body_default);

    Intent launch = new Intent(this, MainActivity.class);
    launch.setFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP);
    PendingIntent pi =
        PendingIntent.getActivity(
            this,
            0,
            launch,
            PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);

    Notification notification =
        new NotificationCompat.Builder(this, CHANNEL_ID)
            .setContentTitle(title)
            .setContentText(body)
            .setSmallIcon(android.R.drawable.ic_media_play)
            .setContentIntent(pi)
            .setOngoing(true)
            .setOnlyAlertOnce(true)
            .setPriority(NotificationCompat.PRIORITY_LOW)
            .build();

    if (Build.VERSION.SDK_INT >= 34) {
      startForeground(
          NOTIFICATION_ID,
          notification,
          ServiceInfo.FOREGROUND_SERVICE_TYPE_CAMERA
              | ServiceInfo.FOREGROUND_SERVICE_TYPE_MICROPHONE);
    } else {
      startForeground(NOTIFICATION_ID, notification);
    }
    return START_STICKY;
  }

  @Nullable
  @Override
  public IBinder onBind(Intent intent) {
    return null;
  }
}
