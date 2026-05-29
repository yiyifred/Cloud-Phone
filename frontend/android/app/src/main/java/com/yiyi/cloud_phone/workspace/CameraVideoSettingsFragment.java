package com.yiyi.cloud_phone.workspace;

import org.json.JSONObject;

public class CameraVideoSettingsFragment extends CastSettingsTabFragment {
    @Override
    protected void buildForm(CastFormBuilder form) {
        JSONObject camera = CastJson.section(host.getCameraSettings(), "camera");
        form.addSpinner(
                "长边上限",
                "在未指定 camera-size 时生效。",
                CastOptionLists.resolutions(),
                CastJson.text(camera, "resolution", "1080p"),
                value -> CastJson.putText(camera, "resolution", value)
        );
        form.addNumberField(
                "视频码率 (Mbps)",
                "摄像头画面建议使用较高码率。",
                String.valueOf(CastJson.number(camera, "bitRateMbps", 8)),
                true,
                value -> CastJson.putNumber(camera, "bitRateMbps", parseDouble(value, 8))
        );
        form.addNumberField(
                "编码帧率上限",
                "与采集帧率取较小值生效。",
                String.valueOf(CastJson.integer(camera, "maxFps", 30)),
                false,
                value -> CastJson.putInt(camera, "maxFps", parseInt(value, 30))
        );
        form.addSpinner(
                "视频编码器",
                "优先 H.264 硬件编码。",
                CastOptionLists.videoEncoders(),
                CastJson.text(camera, "encoder", ""),
                value -> CastJson.putText(camera, "encoder", value)
        );
        form.addNumberField(
                "关键帧间隔 (秒)",
                "I 帧间隔。",
                String.valueOf(CastJson.integer(camera, "iFrameInterval", 10)),
                false,
                value -> CastJson.putInt(camera, "iFrameInterval", parseInt(value, 10))
        );
    }

    private static int parseInt(String raw, int fallback) {
        try {
            return Integer.parseInt(raw);
        } catch (Exception error) {
            return fallback;
        }
    }

    private static double parseDouble(String raw, double fallback) {
        try {
            return Double.parseDouble(raw);
        } catch (Exception error) {
            return fallback;
        }
    }
}
