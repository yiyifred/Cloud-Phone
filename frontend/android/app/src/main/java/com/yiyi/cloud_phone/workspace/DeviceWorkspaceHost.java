package com.yiyi.cloud_phone.workspace;

import org.json.JSONObject;

public interface DeviceWorkspaceHost {
    String getDeviceSerial();

    String getDeviceDisplayName();

    int getDeviceSdk();

    boolean isDeviceConnected();

    CastMode getCastMode();

    void setCastMode(CastMode mode);

    JSONObject getMirrorSettings();

    JSONObject getCameraSettings();

    boolean isSettingsLocked();

    void persistSettings();

    void onStartCastRequested();
}
