package com.yiyi.cloud_phone.cast;

import com.yiyi.cloud_phone.workspace.CastMode;

import org.json.JSONObject;

import java.nio.ByteBuffer;
import java.nio.ByteOrder;
import java.nio.charset.StandardCharsets;

final class CastVideoSettingsWire {
    static final int TYPE_CHANGE_STREAM_PARAMETERS = 101;

    private CastVideoSettingsWire() {
    }

    static byte[] changeStreamParameters(CastMode mode, JSONObject settings, int maxSize) {
        JSONObject mirror = new JSONObject();
        try {
            mirror = new JSONObject(settings.toString());
            mirror.put("deviceSdk", settings.optInt("deviceSdk", 0));
        } catch (Exception ignored) {
            // keep empty mirror
        }
        return serializeChangeStreamParameters(buildSettings(mode, mirror, maxSize));
    }

    static byte[] changeStreamParametersFromPayload(JSONObject payload) {
        String castMode = payload.optString("castMode", "mirror");
        JSONObject mirror = payload.optJSONObject("mirror");
        if (mirror == null) {
            mirror = new JSONObject();
        }
        int maxSize = payload.optInt("maxSize", 0);
        CastMode mode = "camera".equals(castMode) ? CastMode.CAMERA : CastMode.MIRROR;
        return serializeChangeStreamParameters(buildSettings(mode, mirror, maxSize));
    }

    private static VideoSettings buildSettings(CastMode mode, JSONObject mirror, int maxSize) {
        if (mode == CastMode.CAMERA) {
            return fromCamera(mirror, maxSize);
        }
        return fromMirror(mirror, maxSize);
    }

    private static VideoSettings fromMirror(JSONObject mirror, int maxSize) {
        JSONObject video = mirror.optJSONObject("video");
        if (video == null) {
            video = new JSONObject();
        }
        JSONObject screen = mirror.optJSONObject("screen");
        if (screen == null) {
            screen = new JSONObject();
        }
        int resolvedMax = maxSize > 0 ? maxSize : CastResolution.maxSizeFromVideo(video);
        int displayId = isNewDisplayEnabled(screen) ? -1 : parseDisplayId(screen.optString("displayId", "0"));
        return new VideoSettings(
                (int) Math.round(video.optDouble("bitRateMbps", 5) * 1_000_000),
                video.optInt("maxFps", 60),
                video.optInt("iFrameInterval", 10),
                resolvedMax > 0 ? resolvedMax & ~15 : 0,
                0,
                displayId,
                CastStreamExtras.fromMirror(mirror),
                video.optString("encoder", "").trim()
        );
    }

    private static VideoSettings fromCamera(JSONObject mirror, int maxSize) {
        JSONObject camera = mirror.optJSONObject("camera");
        if (camera == null) {
            camera = new JSONObject();
        }
        int resolvedMax = maxSize > 0 ? maxSize : CastResolution.maxSizeFromVideo(camera);
        return new VideoSettings(
                (int) Math.round(camera.optDouble("bitRateMbps", 8) * 1_000_000),
                camera.optInt("maxFps", camera.optInt("fps", 30)),
                camera.optInt("iFrameInterval", 10),
                resolvedMax > 0 ? resolvedMax & ~15 : 0,
                0,
                0,
                CastStreamExtras.fromCamera(mirror),
                camera.optString("encoder", "").trim()
        );
    }

    private static int parseDisplayId(String raw) {
        try {
            return Integer.parseInt(raw.trim());
        } catch (Exception error) {
            return 0;
        }
    }

    private static boolean isNewDisplayEnabled(JSONObject screen) {
        if (screen.optBoolean("useNewDisplay", false)) {
            return true;
        }
        String select = screen.optString("newDisplaySelect", "").trim();
        return !select.isEmpty() && !"off".equals(select);
    }

    private static byte[] serializeChangeStreamParameters(VideoSettings settings) {
        byte[] body = serializeVideoSettings(settings);
        byte[] message = new byte[1 + body.length];
        message[0] = (byte) TYPE_CHANGE_STREAM_PARAMETERS;
        System.arraycopy(body, 0, message, 1, body.length);
        return message;
    }

    private static byte[] serializeVideoSettings(VideoSettings settings) {
        byte[] codecBytes = settings.codecOptions.getBytes(StandardCharsets.UTF_8);
        byte[] encoderBytes = settings.encoderName.getBytes(StandardCharsets.UTF_8);
        int total = 35 + codecBytes.length + encoderBytes.length;
        ByteBuffer buffer = ByteBuffer.allocate(total).order(ByteOrder.BIG_ENDIAN);
        buffer.putInt(settings.bitRate);
        buffer.putInt(settings.maxFps);
        buffer.put((byte) settings.iFrameInterval);
        buffer.putShort((short) settings.width);
        buffer.putShort((short) settings.height);
        buffer.putShort((short) 0);
        buffer.putShort((short) 0);
        buffer.putShort((short) 0);
        buffer.putShort((short) 0);
        buffer.put((byte) 0);
        buffer.put((byte) -1);
        buffer.putInt(settings.displayId);
        buffer.putInt(codecBytes.length);
        if (codecBytes.length > 0) {
            buffer.put(codecBytes);
        }
        buffer.putInt(encoderBytes.length);
        if (encoderBytes.length > 0) {
            buffer.put(encoderBytes);
        }
        return buffer.array();
    }

    private static final class VideoSettings {
        final int bitRate;
        final int maxFps;
        final int iFrameInterval;
        final int width;
        final int height;
        final int displayId;
        final String codecOptions;
        final String encoderName;

        VideoSettings(
                int bitRate,
                int maxFps,
                int iFrameInterval,
                int width,
                int height,
                int displayId,
                String codecOptions,
                String encoderName
        ) {
            this.bitRate = bitRate;
            this.maxFps = maxFps;
            this.iFrameInterval = iFrameInterval;
            this.width = width;
            this.height = height;
            this.displayId = displayId;
            this.codecOptions = codecOptions == null ? "" : codecOptions;
            this.encoderName = encoderName == null ? "" : encoderName;
        }
    }
}
