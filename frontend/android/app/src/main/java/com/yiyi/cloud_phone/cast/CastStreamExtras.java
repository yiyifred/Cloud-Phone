package com.yiyi.cloud_phone.cast;

import org.json.JSONObject;

import java.util.ArrayList;
import java.util.List;

final class CastStreamExtras {
    private static final int ANDROID_SDK_AUDIO_DUP_MIN = 30;

    private CastStreamExtras() {
    }

    static String fromMirror(JSONObject mirror) {
        List<String> parts = new ArrayList<>();
        appendMirrorAudio(parts, mirror);
        appendMirrorVideo(parts, mirror);
        appendMirrorDevice(parts, mirror.optJSONObject("device"));
        appendMirrorScreen(parts, mirror.optJSONObject("screen"));
        return join(parts);
    }

    static String fromCamera(JSONObject mirror) {
        List<String> parts = new ArrayList<>();
        parts.add("video_source=camera");
        appendCameraAudio(parts, mirror);
        appendCameraOptions(parts, mirror.optJSONObject("camera"));
        parts.add("power_on=false");
        return join(parts);
    }

    private static void appendMirrorAudio(List<String> parts, JSONObject mirror) {
        JSONObject video = mirror.optJSONObject("video");
        JSONObject audio = mirror.optJSONObject("audio");
        boolean videoDisabled = video != null && video.optBoolean("disabled", false);
        boolean audioDisabled = audio != null && audio.optBoolean("disabled", false);

        if (videoDisabled) {
            parts.add("video=false");
            parts.add("audio=true");
        } else if (audioDisabled) {
            parts.add("audio=false");
            return;
        } else {
            parts.add("audio=true");
        }

        if (videoDisabled || audioDisabled) {
            return;
        }

        int deviceSdk = mirror.optInt("deviceSdk", 0);
        String source = audio.optString("source", "output").trim();
        if (source.isEmpty()) {
            source = "output";
        }
        boolean audioDup = audio.optBoolean("audioDup", false);
        if (audioDup) {
            if (deviceSdk > 0 && deviceSdk < ANDROID_SDK_AUDIO_DUP_MIN) {
                audioDup = false;
            } else {
                source = "playback";
            }
        }
        if ("playback".equals(source) && deviceSdk > 0 && deviceSdk < ANDROID_SDK_AUDIO_DUP_MIN) {
            source = "output";
        }
        if (!source.isEmpty()) {
            parts.add("audio_source=" + source);
        }
        parts.add("audio_dup=" + audioDup);

        int bitRateKbps = audio.optInt("bitRateKbps", 128);
        if (bitRateKbps > 0) {
            parts.add("audio_bit_rate=" + (bitRateKbps * 1000));
        }
        String codec = audio.optString("codec", "opus").trim().toLowerCase();
        if (!codec.isEmpty()) {
            parts.add("audio_codec=" + codec);
        }
        String encoder = audio.optString("encoder", "").trim();
        if (!encoder.isEmpty()) {
            parts.add("audio_encoder=" + encoder);
        }
    }

    private static void appendMirrorVideo(List<String> parts, JSONObject mirror) {
        JSONObject video = mirror.optJSONObject("video");
        if (video == null) {
            return;
        }
        String orientation = video.optString("displayOrientation", "");
        if (orientation.isEmpty()) {
            orientation = video.optString("captureOrientation", "0");
        }
        String capture = captureOrientationServerValue(orientation);
        if (!capture.isEmpty()) {
            parts.add("capture_orientation=" + capture);
        }
        String crop = video.optString("crop", "").trim();
        if (!crop.isEmpty()) {
            parts.add("crop=" + crop);
        }
    }

    private static void appendMirrorDevice(List<String> parts, JSONObject device) {
        if (device == null) {
            return;
        }
        parts.add("show_touches=" + device.optBoolean("showTouches", false));
        if (device.optBoolean("turnScreenOff", false)) {
            parts.add("turn_screen_off=true");
        }
        if (device.optBoolean("stayAwake", false)) {
            parts.add("stay_awake=true");
        }
        if (device.optBoolean("keepActive", false)) {
            parts.add("keep_active=true");
        }
        int timeout = device.optInt("screenOffTimeout", 0);
        if (timeout > 0) {
            parts.add("screen_off_timeout=" + timeout);
        }
        boolean powerOn = !device.optBoolean("noPowerOn", false) && device.optBoolean("powerOn", true);
        parts.add("power_on=" + powerOn);
    }

    private static void appendMirrorScreen(List<String> parts, JSONObject screen) {
        if (screen == null) {
            return;
        }
        if (isNewDisplayEnabled(screen)) {
            parts.add("new_display=" + formatNewDisplayExtra(screen));
        } else {
            String displayId = screen.optString("displayId", "").trim();
            if (!displayId.isEmpty()) {
                try {
                    parts.add("display_id=" + Integer.parseInt(displayId));
                } catch (NumberFormatException ignored) {
                    parts.add("display_id=0");
                }
            }
        }
        if (screen.optBoolean("flexDisplay", false)) {
            parts.add("flex_display=true");
        }
        if (screen.optBoolean("noVdDestroyContent", false)) {
            parts.add("vd_destroy_content=false");
        }
        if (screen.optBoolean("noVdSystemDecorations", false)) {
            parts.add("vd_system_decorations=false");
        }
        String imePolicy = screen.optString("displayImePolicy", "").trim();
        if (!imePolicy.isEmpty()) {
            parts.add("display_ime_policy=" + imePolicy);
        }
    }

    private static void appendCameraAudio(List<String> parts, JSONObject mirror) {
        JSONObject audio = mirror.optJSONObject("audio");
        if (audio == null || audio.optBoolean("disabled", false)) {
            parts.add("audio=false");
            return;
        }
        parts.add("audio=true");
        int deviceSdk = mirror.optInt("deviceSdk", 0);
        String source = audio.optString("source", "mic").trim();
        if (source.isEmpty()) {
            source = "mic";
        }
        boolean audioDup = audio.optBoolean("audioDup", false);
        if (audioDup && deviceSdk > 0 && deviceSdk < ANDROID_SDK_AUDIO_DUP_MIN) {
            audioDup = false;
        }
        if (!source.isEmpty()) {
            parts.add("audio_source=" + source);
        }
        parts.add("audio_dup=" + audioDup);
        int bitRateKbps = audio.optInt("bitRateKbps", 128);
        if (bitRateKbps > 0) {
            parts.add("audio_bit_rate=" + (bitRateKbps * 1000));
        }
        String codec = audio.optString("codec", "opus").trim().toLowerCase();
        if (!codec.isEmpty()) {
            parts.add("audio_codec=" + codec);
        }
        String encoder = audio.optString("encoder", "").trim();
        if (!encoder.isEmpty()) {
            parts.add("audio_encoder=" + encoder);
        }
    }

    private static void appendCameraOptions(List<String> parts, JSONObject camera) {
        if (camera == null) {
            return;
        }
        String cameraId = camera.optString("cameraId", "").trim();
        if (!cameraId.isEmpty()) {
            parts.add("camera_id=" + cameraId);
        } else {
            String facing = camera.optString("facing", "").trim();
            if (!facing.isEmpty()) {
                parts.add("camera_facing=" + facing);
            }
        }
        String size = camera.optString("size", "").trim();
        if (!size.isEmpty()) {
            parts.add("camera_size=" + size);
        } else {
            String aspectRatio = camera.optString("aspectRatio", "").trim();
            if (!aspectRatio.isEmpty()) {
                parts.add("camera_ar=" + aspectRatio);
            }
        }
        int fps = camera.optInt("fps", 0);
        if (fps > 0) {
            parts.add("camera_fps=" + fps);
        }
        if (camera.optBoolean("highSpeed", false)) {
            parts.add("camera_high_speed=true");
        }
        if (camera.optBoolean("torch", false)) {
            parts.add("camera_torch=true");
        }
        double zoom = camera.optDouble("zoom", 1);
        if (zoom > 0 && zoom != 1) {
            parts.add("camera_zoom=" + zoom);
        }
    }

    private static String captureOrientationServerValue(String captureOrientation) {
        String value = captureOrientation == null ? "0" : captureOrientation;
        if ("0".equals(value)) {
            return "0";
        }
        return "@" + value;
    }

    private static boolean isNewDisplayEnabled(JSONObject screen) {
        if (screen.optBoolean("useNewDisplay", false)) {
            return true;
        }
        String select = screen.optString("newDisplaySelect", "").trim();
        return !select.isEmpty() && !"off".equals(select);
    }

    private static String formatNewDisplayExtra(JSONObject screen) {
        String select = screen.optString("newDisplaySelect", "").trim();
        if ("main".equals(select) || select.isEmpty()) {
            return "";
        }
        if ("custom".equals(select)) {
            int width = screen.optInt("newDisplayWidth", 1920);
            int height = screen.optInt("newDisplayHeight", 1080);
            int dpi = screen.optInt("newDisplayDpi", 420);
            return width + "x" + height + "/" + dpi;
        }
        if (select.contains("x") && select.contains("/")) {
            return select;
        }
        int width = screen.optInt("newDisplayWidth", 1920);
        int height = screen.optInt("newDisplayHeight", 1080);
        int dpi = screen.optInt("newDisplayDpi", 420);
        return width + "x" + height + "/" + dpi;
    }

    private static String join(List<String> parts) {
        StringBuilder builder = new StringBuilder();
        for (int index = 0; index < parts.size(); index += 1) {
            if (index > 0) {
                builder.append(',');
            }
            builder.append(parts.get(index));
        }
        return builder.toString();
    }
}
