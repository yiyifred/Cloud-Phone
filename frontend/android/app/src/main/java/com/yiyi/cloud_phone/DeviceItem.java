package com.yiyi.cloud_phone;

import org.json.JSONObject;

final class DeviceItem {
    final String serial;
    final String state;
    final boolean connected;
    final String product;
    final String model;
    final String device;
    final String manufacturer;
    final String androidVersion;
    final String sdkVersion;
    final String ipAddress;
    final String displayName;

    DeviceItem(JSONObject json) {
        serial = json.optString("serial", "");
        state = json.optString("state", "");
        connected = json.optBoolean("connected", false);
        product = json.optString("product", "");
        model = json.optString("model", "");
        device = json.optString("device", "");
        manufacturer = json.optString("manufacturer", "");
        androidVersion = json.optString("androidVersion", "");
        sdkVersion = json.optString("sdkVersion", "");
        ipAddress = json.optString("ipAddress", "");
        displayName = json.optString("displayName", serial);
    }
}
