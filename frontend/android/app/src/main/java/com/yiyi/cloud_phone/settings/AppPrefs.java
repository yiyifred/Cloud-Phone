package com.yiyi.cloud_phone.settings;

public final class AppPrefs {
    public static final int DEFAULT_SERVER_PORT = 3000;
    public static final String NAME = "cloud_phone_settings";
    public static final String KEY_SERVER_HOST = "server_host";
    public static final String KEY_SERVER_PORT = "server_port";
    public static final String KEY_DEVICE_INTERVAL_SECONDS = "device_list_interval_seconds";
    public static final String KEY_SCREENSHOT_INTERVAL_SECONDS = "screenshot_interval_seconds";
    public static final String KEY_THEME = "app_theme";
    public static final String KEY_LOCALE = "app_locale";

    public static final String THEME_LIGHT = "light";
    public static final String THEME_DARK = "dark";
    public static final String LOCALE_ZH_CN = "zh-CN";
    public static final String LOCALE_EN_US = "en-US";
    public static final String LOCALE_ZH_TW = "zh-TW";
    public static final String LOCALE_JA_JP = "ja-JP";
    public static final String LOCALE_KO_KR = "ko-KR";

    private AppPrefs() {
    }
}
