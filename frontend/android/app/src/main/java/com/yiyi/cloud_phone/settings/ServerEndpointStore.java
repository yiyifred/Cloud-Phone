package com.yiyi.cloud_phone.settings;

import android.content.Context;

public final class ServerEndpointStore {
    public static final class Endpoint {
        public final String host;
        public final int port;

        public Endpoint(String host, int port) {
            this.host = host;
            this.port = port;
        }

        public boolean isValid() {
            return host != null && !host.trim().isEmpty();
        }

        public String label() {
            return host + ":" + port;
        }
    }

    private ServerEndpointStore() {
    }

    public static Endpoint read(Context context) {
        String host = context.getSharedPreferences(AppPrefs.NAME, Context.MODE_PRIVATE)
                .getString(AppPrefs.KEY_SERVER_HOST, "");
        int port = context.getSharedPreferences(AppPrefs.NAME, Context.MODE_PRIVATE)
                .getInt(AppPrefs.KEY_SERVER_PORT, AppPrefs.DEFAULT_SERVER_PORT);
        return new Endpoint(host == null ? "" : host.trim(), port);
    }
}
