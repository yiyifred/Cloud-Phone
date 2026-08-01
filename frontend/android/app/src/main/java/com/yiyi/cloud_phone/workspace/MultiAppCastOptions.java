package com.yiyi.cloud_phone.workspace;

import com.yiyi.cloud_phone.cast.CastPayloadBuilder;

import org.json.JSONObject;

public final class MultiAppCastOptions {
    public static final int FOCUSED_MAX_FPS = 60;
    public static final int BACKGROUND_MAX_FPS = 30;

    private MultiAppCastOptions() {
    }

    public static int resolveMaxFps(boolean focused, boolean minimized) {
        return focused && !minimized ? FOCUSED_MAX_FPS : BACKGROUND_MAX_FPS;
    }

    public static JSONObject buildSettings(
            String packageName,
            int vdWidth,
            int vdHeight,
            int vdDpi,
            int deviceSdk
    ) throws Exception {
        return buildSettings(packageName, vdWidth, vdHeight, vdDpi, deviceSdk, FOCUSED_MAX_FPS);
    }

    public static JSONObject buildSettings(
            String packageName,
            int vdWidth,
            int vdHeight,
            int vdDpi,
            int deviceSdk,
            int maxFps
    ) throws Exception {
        JSONObject settings = CastSettingsDefaults.mirror();
        JSONObject video = settings.getJSONObject("video");
        video.put("maxFps", Math.max(1, maxFps));
        video.put("bitRateMbps", 8);
        video.put("iFrameInterval", 10);
        video.put("resolution", "1080p");

        JSONObject audio = settings.getJSONObject("audio");
        audio.put("disabled", true);

        JSONObject screen = settings.getJSONObject("screen");
        CastMirrorScreenUtils.applyNewDisplaySelect(screen, CastMirrorScreenUtils.NEW_DISPLAY_CUSTOM);
        CastJson.putInt(screen, "newDisplayWidth", vdWidth);
        CastJson.putInt(screen, "newDisplayHeight", vdHeight);
        CastJson.putInt(screen, "newDisplayDpi", vdDpi);
        CastJson.putBool(screen, "newDisplayDpiManual", true);
        CastJson.putText(screen, "newDisplayApp", packageName);
        CastJson.putBool(screen, "flexDisplay", true);
        CastJson.putBool(screen, "noVdDestroyContent", true);
        CastJson.putBool(screen, "noVdSystemDecorations", true);

        settings.put("deviceSdk", deviceSdk);
        return settings;
    }

    public static JSONObject buildPayload(
            String packageName,
            int vdWidth,
            int vdHeight,
            int vdDpi,
            int deviceSdk
    ) throws Exception {
        return buildPayload(packageName, vdWidth, vdHeight, vdDpi, deviceSdk, FOCUSED_MAX_FPS);
    }

    public static JSONObject buildPayload(
            String packageName,
            int vdWidth,
            int vdHeight,
            int vdDpi,
            int deviceSdk,
            int maxFps
    ) throws Exception {
        return CastPayloadBuilder.fromMirror(
                buildSettings(packageName, vdWidth, vdHeight, vdDpi, deviceSdk, maxFps),
                deviceSdk
        );
    }

    public static byte[] buildStreamParams(
            String packageName,
            int vdWidth,
            int vdHeight,
            int vdDpi,
            int deviceSdk
    ) throws Exception {
        return buildStreamParams(packageName, vdWidth, vdHeight, vdDpi, deviceSdk, FOCUSED_MAX_FPS);
    }

    public static byte[] buildStreamParams(
            String packageName,
            int vdWidth,
            int vdHeight,
            int vdDpi,
            int deviceSdk,
            int maxFps
    ) throws Exception {
        JSONObject payload = buildPayload(packageName, vdWidth, vdHeight, vdDpi, deviceSdk, maxFps);
        return CastPayloadBuilder.streamParamsFromPayload(payload);
    }
}
