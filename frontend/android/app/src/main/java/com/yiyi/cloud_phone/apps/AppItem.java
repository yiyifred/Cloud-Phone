package com.yiyi.cloud_phone.apps;

import org.json.JSONObject;

final class AppItem {
    final String packageName;
    final String label;
    final String iconDataUrl;
    final String versionName;
    final String versionCode;
    final boolean system;
    final boolean enabled;
    final boolean frozen;
    final String dataDir;
    final int targetSdk;
    final int minSdk;

    AppItem(JSONObject json) {
        packageName = json.optString("packageName", "");
        label = json.optString("label", packageName);
        iconDataUrl = json.optString("iconDataUrl", "");
        versionName = json.optString("versionName", "");
        versionCode = json.optString("versionCode", "");
        system = json.optBoolean("system", false);
        enabled = json.optBoolean("enabled", true);
        frozen = json.optBoolean("frozen", false);
        dataDir = json.optString("dataDir", "");
        targetSdk = json.optInt("targetSdk", 0);
        minSdk = json.optInt("minSdk", 0);
    }

    String getInitials() {
        if (label != null && !label.isEmpty()) {
            return String.valueOf(label.charAt(0)).toUpperCase();
        }
        if (packageName != null && !packageName.isEmpty()) {
            return String.valueOf(packageName.charAt(0)).toUpperCase();
        }
        return "?";
    }
}
