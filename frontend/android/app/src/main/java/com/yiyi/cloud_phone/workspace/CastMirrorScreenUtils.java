package com.yiyi.cloud_phone.workspace;

import org.json.JSONObject;

public final class CastMirrorScreenUtils {
    public static final String NEW_DISPLAY_OFF = "";
    public static final String NEW_DISPLAY_MAIN = "__main__";
    public static final String NEW_DISPLAY_CUSTOM = "__custom__";

    private CastMirrorScreenUtils() {
    }

    public static boolean isNewDisplayEnabled(JSONObject screen) {
        if (screen == null) {
            return false;
        }
        if (CastJson.bool(screen, "useNewDisplay", false)) {
            return true;
        }
        String select = CastJson.text(screen, "newDisplaySelect", "").trim();
        return !select.isEmpty() && !NEW_DISPLAY_OFF.equals(select);
    }

    public static String formatNewDisplayExtra(JSONObject screen) {
        if (!isNewDisplayEnabled(screen)) {
            return "";
        }
        String select = CastJson.text(screen, "newDisplaySelect", "").trim();
        if (NEW_DISPLAY_MAIN.equals(select)) {
            return "";
        }
        if (NEW_DISPLAY_CUSTOM.equals(select)) {
            return formatCustomDisplay(screen);
        }
        if (select.contains("x") && select.contains("/")) {
            return select;
        }
        return formatCustomDisplay(screen);
    }

    public static String resolveStartAppPackage(JSONObject screen) {
        if (screen == null) {
            return "";
        }
        return CastJson.text(screen, "newDisplayApp", "").trim();
    }

    public static void applyNewDisplaySelect(JSONObject screen, String selectValue) {
        String value = selectValue == null ? "" : selectValue;
        CastJson.putText(screen, "newDisplaySelect", value);
        if (NEW_DISPLAY_OFF.equals(value) || value.isEmpty()) {
            CastJson.putBool(screen, "useNewDisplay", false);
            return;
        }
        CastJson.putBool(screen, "useNewDisplay", true);
        if (NEW_DISPLAY_MAIN.equals(value) || NEW_DISPLAY_CUSTOM.equals(value)) {
            return;
        }
        if (value.contains("x") && value.contains("/")) {
            applyPresetValue(screen, value);
        }
    }

    public static void ensureSuggestedDpi(JSONObject screen) {
        if (CastJson.bool(screen, "newDisplayDpiManual", false)) {
            return;
        }
        int width = CastJson.integer(screen, "newDisplayWidth", 1920);
        int height = CastJson.integer(screen, "newDisplayHeight", 1080);
        CastJson.putInt(screen, "newDisplayDpi", suggestDpi(width, height));
    }

    public static int suggestDpi(int width, int height) {
        double diagonal = Math.hypot(width, height);
        double reference = Math.hypot(1920, 1080);
        int dpi = (int) Math.round((diagonal / reference) * 420);
        return Math.max(120, Math.min(640, dpi));
    }

    private static String formatCustomDisplay(JSONObject screen) {
        int width = CastJson.integer(screen, "newDisplayWidth", 1920);
        int height = CastJson.integer(screen, "newDisplayHeight", 1080);
        int dpi = CastJson.integer(screen, "newDisplayDpi", 420);
        return width + "x" + height + "/" + dpi;
    }

    private static void applyPresetValue(JSONObject screen, String value) {
        String[] parts = value.split("/");
        String[] size = parts[0].split("x");
        if (size.length == 2) {
            CastJson.putInt(screen, "newDisplayWidth", parseInt(size[0], 1920));
            CastJson.putInt(screen, "newDisplayHeight", parseInt(size[1], 1080));
        }
        if (parts.length > 1) {
            CastJson.putInt(screen, "newDisplayDpi", parseInt(parts[1], 420));
            CastJson.putBool(screen, "newDisplayDpiManual", true);
        }
    }

    private static int parseInt(String raw, int fallback) {
        try {
            return Integer.parseInt(raw.trim());
        } catch (Exception error) {
            return fallback;
        }
    }
}
