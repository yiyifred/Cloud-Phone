package com.yiyi.cloud_phone.workspace;

import org.json.JSONObject;

final class CastSettingsDefaults {
    private CastSettingsDefaults() {
    }

    static JSONObject mirror() {
        JSONObject root = new JSONObject();
        try {
            JSONObject video = new JSONObject();
            video.put("disabled", false);
            video.put("codec", "h264");
            video.put("bitRateMbps", 5);
            video.put("encoder", "");
            video.put("rotationDeg", 0);
            video.put("captureOrientation", "0");
            video.put("maxFps", 60);
            video.put("iFrameInterval", 10);
            video.put("resolution", "1080p");
            video.put("crop", "");
            root.put("video", video);

            JSONObject audio = new JSONObject();
            audio.put("disabled", false);
            audio.put("audioDup", false);
            audio.put("audioCode", "opus");
            audio.put("codec", "opus");
            audio.put("encoder", "");
            audio.put("source", "output");
            audio.put("bitRateKbps", 128);
            audio.put("bufferMs", 0);
            audio.put("outputBufferMs", 0);
            root.put("audio", audio);

            JSONObject device = new JSONObject();
            device.put("showTouches", false);
            device.put("stayAwake", false);
            device.put("turnScreenOff", false);
            device.put("powerOn", true);
            device.put("noPowerOn", false);
            device.put("keepActive", false);
            device.put("screenOffTimeout", 0);
            root.put("device", device);

            JSONObject screen = new JSONObject();
            screen.put("displayId", "");
            screen.put("useNewDisplay", false);
            screen.put("newDisplaySelect", "");
            screen.put("newDisplayWidth", 1920);
            screen.put("newDisplayHeight", 1080);
            screen.put("newDisplayDpi", 420);
            screen.put("newDisplayDpiManual", false);
            screen.put("newDisplayApp", "");
            screen.put("flexDisplay", false);
            screen.put("noVdDestroyContent", false);
            screen.put("noVdSystemDecorations", false);
            screen.put("displayImePolicy", "");
            root.put("screen", screen);
        } catch (Exception ignored) {
            // defaults only
        }
        return root;
    }

    static JSONObject camera() {
        JSONObject root = new JSONObject();
        try {
            JSONObject camera = new JSONObject();
            camera.put("facing", "back");
            camera.put("cameraId", "");
            camera.put("size", "");
            camera.put("aspectRatio", "");
            camera.put("fps", 30);
            camera.put("highSpeed", false);
            camera.put("torch", false);
            camera.put("zoom", 1);
            camera.put("resolution", "1080p");
            camera.put("bitRateMbps", 8);
            camera.put("maxFps", 30);
            camera.put("iFrameInterval", 10);
            camera.put("encoder", "");
            camera.put("codec", "h264");
            root.put("camera", camera);

            JSONObject audio = new JSONObject();
            audio.put("disabled", false);
            audio.put("source", "mic");
            audio.put("codec", "opus");
            audio.put("encoder", "");
            audio.put("bitRateKbps", 128);
            audio.put("audioDup", false);
            root.put("audio", audio);
        } catch (Exception ignored) {
            // defaults only
        }
        return root;
    }
}
