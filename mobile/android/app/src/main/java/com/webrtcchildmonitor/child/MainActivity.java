package com.webrtcchildmonitor.child;

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {

  @Override
  public void onCreate(Bundle savedInstanceState) {
    registerPlugin(MdmConfigPlugin.class);
    registerPlugin(StreamingForegroundPlugin.class);
    super.onCreate(savedInstanceState);
  }
}
