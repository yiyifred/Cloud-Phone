package com.yiyi.cloud_phone.workspace;

import org.json.JSONObject;

public class MirrorAudioSettingsFragment extends CastSettingsTabFragment {
    @Override
    protected void buildForm(CastFormBuilder form) {
        JSONObject audio = CastJson.section(host.getMirrorSettings(), "audio");
        JSONObject video = CastJson.section(host.getMirrorSettings(), "video");
        boolean videoDisabled = CastJson.bool(video, "disabled", false);
        int sdk = host.getDeviceSdk();
        boolean audioDupSupported = sdk <= 0 || sdk >= 33;

        form.addBanner("Web 投屏与视频同传时使用 PCM 到浏览器；仅音频模式为 48kHz 立体声 PCM。");

        if (!videoDisabled) {
            form.addSwitch(
                    "禁用音频",
                    "对应 --no-audio。",
                    CastJson.bool(audio, "disabled", false),
                    value -> CastJson.putBool(audio, "disabled", value)
            );
        }

        form.addSwitch(
                "音频复制到设备",
                audioDupSupported
                        ? "开启后手机与浏览器同时出声，需 Android 13+。"
                        : "本机 SDK 较低，仅浏览器播放。",
                CastJson.bool(audio, "audioDup", false),
                value -> CastJson.putBool(audio, "audioDup", value)
        );
        form.addSpinner(
                "音频源",
                "output 为设备输出，playback 需 Android 13+。",
                CastOptionLists.audioSources(),
                CastJson.text(audio, "source", "output"),
                value -> CastJson.putText(audio, "source", value)
        );
        form.addSpinner(
                "音频编码",
                "对应 --audio-code，Web 投屏以 PCM 传输。",
                CastOptionLists.audioCodes(),
                CastJson.text(audio, "audioCode", "opus"),
                value -> {
                    CastJson.putText(audio, "audioCode", value);
                    CastJson.putText(audio, "codec", value);
                }
        );
        form.addSpinner(
                "比特率",
                "音频编码目标比特率（kbps）。",
                CastOptionLists.audioBitrates(),
                String.valueOf(CastJson.integer(audio, "bitRateKbps", 128)),
                value -> CastJson.putInt(audio, "bitRateKbps", parseInt(value, 128))
        );
        form.addNumberField(
                "缓冲 (ms)",
                "Web 投屏当前忽略，仅保留配置项。",
                String.valueOf(CastJson.integer(audio, "bufferMs", 0)),
                false,
                value -> CastJson.putInt(audio, "bufferMs", parseInt(value, 0))
        );
        form.addNumberField(
                "输出缓冲 (ms)",
                "Web 投屏当前忽略。",
                String.valueOf(CastJson.integer(audio, "outputBufferMs", 0)),
                false,
                value -> CastJson.putInt(audio, "outputBufferMs", parseInt(value, 0))
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
