package com.webrtcchildmonitor.child;

import android.content.Context;
import android.content.RestrictionsManager;
import android.os.Bundle;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/**
 * Reads Android Enterprise managed configuration (RestrictionsManager) for keys such as
 * {@code serverUrl}, delivered by MDM.
 */
@CapacitorPlugin(name = "MdmConfig")
public class MdmConfigPlugin extends Plugin {

  @PluginMethod
  public void getServerUrl(PluginCall call) {
    Context ctx = getContext();
    if (ctx == null) {
      call.reject("No context");
      return;
    }
    RestrictionsManager rm = (RestrictionsManager) ctx.getSystemService(Context.RESTRICTIONS_SERVICE);
    Bundle restrictions = rm != null ? rm.getApplicationRestrictions() : null;
    JSObject ret = new JSObject();
    if (restrictions != null && restrictions.containsKey("serverUrl")) {
      String url = restrictions.getString("serverUrl");
      ret.put("serverUrl", url);
    } else {
      ret.put("serverUrl", null);
    }
    call.resolve(ret);
  }
}
