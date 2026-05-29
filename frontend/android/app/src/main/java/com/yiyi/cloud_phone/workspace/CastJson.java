package com.yiyi.cloud_phone.workspace;

import org.json.JSONObject;

final class CastJson {
    private CastJson() {
    }

    static JSONObject section(JSONObject root, String name) {
        JSONObject section = root.optJSONObject(name);
        if (section != null) {
            return section;
        }
        section = new JSONObject();
        try {
            root.put(name, section);
        } catch (Exception ignored) {
            // ignore
        }
        return section;
    }

    static boolean bool(JSONObject object, String key, boolean fallback) {
        return object != null && object.optBoolean(key, fallback);
    }

    static void putBool(JSONObject object, String key, boolean value) {
        if (object == null) {
            return;
        }
        try {
            object.put(key, value);
        } catch (Exception ignored) {
            // ignore
        }
    }

    static int integer(JSONObject object, String key, int fallback) {
        return object != null ? object.optInt(key, fallback) : fallback;
    }

    static void putInt(JSONObject object, String key, int value) {
        if (object == null) {
            return;
        }
        try {
            object.put(key, value);
        } catch (Exception ignored) {
            // ignore
        }
    }

    static double number(JSONObject object, String key, double fallback) {
        return object != null ? object.optDouble(key, fallback) : fallback;
    }

    static void putNumber(JSONObject object, String key, double value) {
        if (object == null) {
            return;
        }
        try {
            object.put(key, value);
        } catch (Exception ignored) {
            // ignore
        }
    }

    static String text(JSONObject object, String key, String fallback) {
        if (object == null) {
            return fallback;
        }
        String value = object.optString(key, fallback);
        return value == null ? fallback : value;
    }

    static void putText(JSONObject object, String key, String value) {
        if (object == null) {
            return;
        }
        try {
            object.put(key, value == null ? "" : value);
        } catch (Exception ignored) {
            // ignore
        }
    }
}
