package com.yiyi.cloud_phone.workspace;

import org.json.JSONObject;

public class CameraAudioSettingsFragment extends CastSettingsTabFragment {
    @Override
    protected void buildForm(CastFormBuilder form) {
        JSONObject audio = CastJson.section(host.getCameraSettings(), "audio");
        form.addSwitch(
                "禁用音频",
                "关闭后仅传输视频。",
                CastJson.bool(audio, "disabled", false),
                value -> CastJson.putBool(audio, "disabled", value)
        );
        form.addSpinner(
                "音频源",
                "摄像头模式常用 mic。",
                CastOptionLists.cameraAudioSources(),
                CastJson.text(audio, "source", "mic"),
                value -> CastJson.putText(audio, "source", value)
        );
        form.addSpinner(
                "音频编码",
                "对应 --audio-code。",
                CastOptionLists.audioCodes(),
                CastJson.text(audio, "codec", "opus"),
                value -> CastJson.putText(audio, "codec", value)
        );
        form.addSpinner(
                "比特率",
                "音频编码目标比特率（kbps）。",
                CastOptionLists.audioBitrates(),
                String.valueOf(CastJson.integer(audio, "bitRateKbps", 128)),
                value -> CastJson.putInt(audio, "bitRateKbps", parseInt(value, 128))
        );
        form.addSwitch(
                "音频复制到设备",
                "需 Android 13+ 与 playback 源。",
                CastJson.bool(audio, "audioDup", false),
                value -> CastJson.putBool(audio, "audioDup", value)
        );
    }

    private static int parseInt(String raw, int fallback) {
        try {
            return Integer.parseInt(raw);
        } catch (Exception error) {
            return fallback;
        }
    }
}
