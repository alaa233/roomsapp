package com.webrtcchildmonitor.child;

import android.content.Intent;
import android.os.Build;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

@CapacitorPlugin(name = "StreamingForeground")
public class StreamingForegroundPlugin extends Plugin {

  @PluginMethod
  public void start(PluginCall call) {
    String title = call.getString("title", "Camera and microphone active");
    String body =
        call.getString(
            "body", "Streaming to parent. Tap to return to the app.");

    Intent intent = new Intent(getContext(), StreamingForegroundService.class);
    intent.putExtra(StreamingForegroundService.EXTRA_TITLE, title);
    intent.putExtra(StreamingForegroundService.EXTRA_BODY, body);

    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
      getContext().startForegroundService(intent);
    } else {
      getContext().startService(intent);
    }
    call.resolve();
  }

  @PluginMethod
  public void stop(PluginCall call) {
    Intent intent = new Intent(getContext(), StreamingForegroundService.class);
    getContext().stopService(intent);
    call.resolve();
  }
}
