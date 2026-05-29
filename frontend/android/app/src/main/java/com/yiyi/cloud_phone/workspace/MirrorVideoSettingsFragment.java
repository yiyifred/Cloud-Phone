package com.yiyi.cloud_phone.workspace;

import org.json.JSONObject;

public class MirrorVideoSettingsFragment extends CastSettingsTabFragment {
    @Override
    protected void buildForm(CastFormBuilder form) {
        JSONObject video = CastJson.section(host.getMirrorSettings(), "video");
        form.addSwitch(
                "禁用视频（仅音频）",
                "开启后仅传输音频，需 Android 11+。",
                CastJson.bool(video, "disabled", false),
                value -> CastJson.putBool(video, "disabled", value)
        );
        form.addSpinner(
                "视频编码器",
                "优先选择 H.264 硬件编码器。",
                CastOptionLists.videoEncoders(),
                CastJson.text(video, "encoder", ""),
                value -> CastJson.putText(video, "encoder", value)
        );
        form.addNumberField(
                "比特率 (Mbps)",
                "对应 scrcpy --video-bit-rate。",
                String.valueOf(CastJson.number(video, "bitRateMbps", 5)),
                true,
                value -> CastJson.putNumber(video, "bitRateMbps", parseDouble(value, 5))
        );
        form.addNumberField(
                "刷新率 (fps)",
                "对应 --max-fps。",
                String.valueOf(CastJson.integer(video, "maxFps", 60)),
                false,
                value -> CastJson.putInt(video, "maxFps", parseInt(value, 60))
        );
        form.addSpinner(
                "分辨率",
                "编码长边上限，等比缩放。",
                CastOptionLists.resolutions(),
                CastJson.text(video, "resolution", "1080p"),
                value -> CastJson.putText(video, "resolution", value)
        );
        form.addTextField(
                "裁剪区域",
                "格式 宽:高:x:y，留空表示不裁剪。",
                CastJson.text(video, "crop", ""),
                value -> CastJson.putText(video, "crop", value)
        );
        form.addSpinner(
                "显示方向（采集）",
                "旋转编码后的画面，非仅预览。",
                CastOptionLists.captureOrientations(),
                CastJson.text(video, "captureOrientation", "0"),
                value -> CastJson.putText(video, "captureOrientation", value)
        );
        form.addNumberField(
                "关键帧间隔 (秒)",
                "I 帧间隔，部分机型可能忽略。",
                String.valueOf(CastJson.integer(video, "iFrameInterval", 10)),
                false,
                value -> CastJson.putInt(video, "iFrameInterval", parseInt(value, 10))
        );
        form.addNumberField(
                "预览旋转 (°)",
                "仅旋转客户端预览，不影响设备端采集。",
                String.valueOf(CastJson.integer(video, "rotationDeg", 0)),
                false,
                value -> CastJson.putInt(video, "rotationDeg", parseInt(value, 0))
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
