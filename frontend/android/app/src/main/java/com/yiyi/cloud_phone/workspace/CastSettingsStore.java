package com.yiyi.cloud_phone.workspace;

import android.content.Context;
import android.content.SharedPreferences;

import org.json.JSONObject;

public final class CastSettingsStore {
    private static final String PREF = "cloud_phone_cast_settings";
    private static final String KEY_MODE_PREFIX = "cast_mode_";
    private static final String KEY_MIRROR_PREFIX = "mirror_";
    private static final String KEY_CAMERA_PREFIX = "camera_";

    private CastSettingsStore() {
    }

    public static CastMode loadMode(Context context, String serial) {
        String id = prefs(context).getString(KEY_MODE_PREFIX + serial, CastMode.MIRROR.id);
        return CastMode.fromId(id);
    }

    public static void saveMode(Context context, String serial, CastMode mode) {
        prefs(context).edit().putString(KEY_MODE_PREFIX + serial, mode.id).apply();
    }

    public static JSONObject loadMirror(Context context, String serial) {
        return loadJson(context, KEY_MIRROR_PREFIX + serial, CastSettingsDefaults.mirror());
    }

    public static JSONObject loadCamera(Context context, String serial) {
        return loadJson(context, KEY_CAMERA_PREFIX + serial, CastSettingsDefaults.camera());
    }

    public static void saveMirror(Context context, String serial, JSONObject settings) {
        saveJson(context, KEY_MIRROR_PREFIX + serial, settings);
    }

    public static void saveCamera(Context context, String serial, JSONObject settings) {
        saveJson(context, KEY_CAMERA_PREFIX + serial, settings);
    }

    private static SharedPreferences prefs(Context context) {
        return context.getApplicationContext().getSharedPreferences(PREF, Context.MODE_PRIVATE);
    }

    private static JSONObject loadJson(Context context, String key, JSONObject fallback) {
        String raw = prefs(context).getString(key, "");
        if (raw.isEmpty()) {
            return deepCopy(fallback);
        }
        try {
            return new JSONObject(raw);
        } catch (Exception error) {
            return deepCopy(fallback);
        }
    }

    private static void saveJson(Context context, String key, JSONObject settings) {
        prefs(context).edit().putString(key, settings.toString()).apply();
    }

    private static JSONObject deepCopy(JSONObject source) {
        try {
            return new JSONObject(source.toString());
        } catch (Exception error) {
            return CastSettingsDefaults.mirror();
        }
    }
}
