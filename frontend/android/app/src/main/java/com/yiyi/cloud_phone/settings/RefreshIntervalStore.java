package com.yiyi.cloud_phone.settings;

import android.content.Context;

public final class RefreshIntervalStore {
    public static final int DEFAULT_DEVICE_SECONDS = 1;
    public static final int DEFAULT_SCREENSHOT_SECONDS = 5;
    private static final int MIN_SECONDS = 1;
    private static final int MAX_SECONDS = 120;

    private RefreshIntervalStore() {
    }

    public static int deviceIntervalSeconds(Context context) {
        return normalize(
                context.getSharedPreferences(AppPrefs.NAME, Context.MODE_PRIVATE)
                        .getInt(AppPrefs.KEY_DEVICE_INTERVAL_SECONDS, DEFAULT_DEVICE_SECONDS),
                DEFAULT_DEVICE_SECONDS
        );
    }

    public static int screenshotIntervalSeconds(Context context) {
        return normalize(
                context.getSharedPreferences(AppPrefs.NAME, Context.MODE_PRIVATE)
                        .getInt(AppPrefs.KEY_SCREENSHOT_INTERVAL_SECONDS, DEFAULT_SCREENSHOT_SECONDS),
                DEFAULT_SCREENSHOT_SECONDS
        );
    }

    public static long deviceIntervalMs(Context context) {
        return deviceIntervalSeconds(context) * 1000L;
    }

    public static long screenshotIntervalMs(Context context) {
        return screenshotIntervalSeconds(context) * 1000L;
    }

    public static void save(Context context, int deviceSeconds, int screenshotSeconds) {
        context.getSharedPreferences(AppPrefs.NAME, Context.MODE_PRIVATE)
                .edit()
                .putInt(AppPrefs.KEY_DEVICE_INTERVAL_SECONDS, normalize(deviceSeconds, DEFAULT_DEVICE_SECONDS))
                .putInt(
                        AppPrefs.KEY_SCREENSHOT_INTERVAL_SECONDS,
                        normalize(screenshotSeconds, DEFAULT_SCREENSHOT_SECONDS)
                )
                .apply();
    }

    private static int normalize(int value, int fallback) {
        if (value < MIN_SECONDS || value > MAX_SECONDS) {
            return fallback;
        }
        return value;
    }
}
