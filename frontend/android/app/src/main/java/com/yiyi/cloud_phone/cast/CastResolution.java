package com.yiyi.cloud_phone.cast;

import org.json.JSONObject;

final class CastResolution {
    private CastResolution() {
    }

    static int maxSizeFromVideo(JSONObject video) {
        if (video == null) {
            return 1920;
        }
        String resolution = video.optString("resolution", "1080p");
        switch (resolution) {
            case "original":
                return 0;
            case "4k":
                return 2160;
            case "1440p":
                return 1440;
            case "1080p":
                return 1920;
            case "720p":
                return 1280;
            case "540p":
                return 960;
            default:
                return 1920;
        }
    }
}
