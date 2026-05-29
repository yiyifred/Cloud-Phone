package com.yiyi.cloud_phone.cast;

import com.yiyi.cloud_phone.workspace.CastMode;

import org.json.JSONObject;

public final class CastPayloadBuilder {
    private CastPayloadBuilder() {
    }

    public static JSONObject build(CastMode mode, JSONObject settings, int deviceSdk) throws Exception {
        if (mode == CastMode.CAMERA) {
            return fromCamera(settings, deviceSdk);
        }
        return fromMirror(settings, deviceSdk);
    }

    public static JSONObject fromMirror(JSONObject settings, int deviceSdk) throws Exception {
        JSONObject video = settings.optJSONObject("video");
        if (video == null) {
            video = new JSONObject();
        }
        boolean videoDisabled = video.optBoolean("disabled", false);
        JSONObject audio = settings.optJSONObject("audio");
        if (audio == null) {
            audio = new JSONObject();
        }

        JSONObject mirror = new JSONObject(settings.toString());
        mirror.put("deviceSdk", deviceSdk);

        JSONObject payload = new JSONObject();
        payload.put("castMode", "mirror");
        payload.put("maxSize", CastResolution.maxSizeFromVideo(video));
        payload.put("mirror", mirror);
        payload.put("deviceSdk", deviceSdk);
        payload.put("video", !videoDisabled);
        payload.put("control", true);
        payload.put("audio", videoDisabled || !audio.optBoolean("disabled", false));
        return payload;
    }

    public static JSONObject fromCamera(JSONObject settings, int deviceSdk) throws Exception {
        JSONObject camera = settings.optJSONObject("camera");
        if (camera == null) {
            camera = new JSONObject();
        }
        JSONObject audio = settings.optJSONObject("audio");
        if (audio == null) {
            audio = new JSONObject();
        }

        JSONObject mirror = new JSONObject(settings.toString());
        mirror.put("deviceSdk", deviceSdk);

        JSONObject payload = new JSONObject();
        payload.put("castMode", "camera");
        payload.put("maxSize", CastResolution.maxSizeFromVideo(camera));
        payload.put("mirror", mirror);
        payload.put("deviceSdk", deviceSdk);
        payload.put("video", true);
        payload.put("control", true);
        payload.put("audio", !audio.optBoolean("disabled", false));
        return payload;
    }
}
