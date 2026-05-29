package com.yiyi.cloud_phone.cast;

import android.content.Context;
import android.content.SharedPreferences;

final class CastServerConfig {
    private static final String PREF_NAME = "cloud_phone_settings";
    private static final String KEY_SERVER_HOST = "server_host";
    private static final String KEY_SERVER_PORT = "server_port";
    private static final String FALLBACK_HOST = "192.168.1.1";
    private static final int FALLBACK_PORT = 3000;

    private CastServerConfig() {
    }

    static String host(Context context) {
        SharedPreferences prefs = context.getSharedPreferences(PREF_NAME, Context.MODE_PRIVATE);
        String host = prefs.getString(KEY_SERVER_HOST, "");
        if (host == null || host.trim().isEmpty()) {
            return FALLBACK_HOST;
        }
        return host.trim();
    }

    static int port(Context context) {
        SharedPreferences prefs = context.getSharedPreferences(PREF_NAME, Context.MODE_PRIVATE);
        return prefs.getInt(KEY_SERVER_PORT, FALLBACK_PORT);
    }
}
