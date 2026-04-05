package com.webrtcchildmonitor.child;

import android.Manifest;
import android.content.Intent;
import android.net.Uri;
import android.os.Build;
import android.provider.Settings;
import com.getcapacitor.JSObject;
import com.getcapacitor.PermissionState;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.annotation.PermissionCallback;
import java.util.Map;

@CapacitorPlugin(
    name = "AppPermissions",
    permissions = {
        @Permission(alias = "camera", strings = { Manifest.permission.CAMERA }),
        @Permission(alias = "microphone", strings = { Manifest.permission.RECORD_AUDIO }),
        @Permission(alias = "notifications", strings = { Manifest.permission.POST_NOTIFICATIONS })
    })
public class AppPermissionsPlugin extends Plugin {

  @PluginMethod
  public void getStatus(PluginCall call) {
    call.resolve(buildStatus());
  }

  @PluginMethod
  public void requestStreamingPermissions(PluginCall call) {
    if (Build.VERSION.SDK_INT >= 33) {
      requestPermissionForAliases(
          new String[] { "camera", "microphone", "notifications" }, call, "streamingPermissionCallback");
    } else {
      requestPermissionForAliases(
          new String[] { "camera", "microphone" }, call, "streamingPermissionCallback");
    }
  }

  @PermissionCallback
  private void streamingPermissionCallback(PluginCall call) {
    call.resolve(buildStatus());
  }

  @PluginMethod
  public void openAppSettings(PluginCall call) {
    Intent intent = new Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS);
    Uri uri = Uri.fromParts("package", getContext().getPackageName(), null);
    intent.setData(uri);
    intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
    getActivity().startActivity(intent);
    call.resolve();
  }

  private JSObject buildStatus() {
    JSObject ret = new JSObject();
    Map<String, PermissionState> states = getPermissionStates();
    ret.put("camera", permissionStateToJs(states.get("camera")));
    ret.put("microphone", permissionStateToJs(states.get("microphone")));
    if (Build.VERSION.SDK_INT >= 33) {
      ret.put("notifications", permissionStateToJs(states.get("notifications")));
    } else {
      ret.put("notifications", "notApplicable");
    }
    return ret;
  }

  private String permissionStateToJs(PermissionState state) {
    if (state == null) {
      return "prompt";
    }
    return state.toString();
  }
}
