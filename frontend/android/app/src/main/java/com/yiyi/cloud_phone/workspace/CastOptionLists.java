package com.yiyi.cloud_phone.workspace;

import java.util.ArrayList;
import java.util.List;

final class CastOptionLists {
    static final class Option {
        final String value;
        final String label;

        Option(String value, String label) {
            this.value = value;
            this.label = label;
        }
    }

    private CastOptionLists() {
    }

    static List<Option> castModes() {
        List<Option> items = new ArrayList<>();
        items.add(new Option(CastMode.MIRROR.id, "镜像投屏"));
        items.add(new Option(CastMode.CAMERA.id, "摄像头"));
        return items;
    }

    static List<Option> resolutions() {
        List<Option> items = new ArrayList<>();
        items.add(new Option("original", "原画（设备原生）"));
        items.add(new Option("4k", "4K（长边 2160）"));
        items.add(new Option("1440p", "1440p（长边 1440）"));
        items.add(new Option("1080p", "1080p（长边 1920）"));
        items.add(new Option("720p", "720p（长边 1280）"));
        items.add(new Option("540p", "540p（长边 960）"));
        return items;
    }

    static List<Option> captureOrientations() {
        List<Option> items = new ArrayList<>();
        items.add(new Option("0", "0°"));
        items.add(new Option("90", "90°"));
        items.add(new Option("180", "180°"));
        items.add(new Option("270", "270°"));
        items.add(new Option("flip0", "0° 翻转"));
        items.add(new Option("flip90", "90° 翻转"));
        items.add(new Option("flip180", "180° 翻转"));
        items.add(new Option("flip270", "270° 翻转"));
        return items;
    }

    static List<Option> audioSources() {
        List<Option> items = new ArrayList<>();
        items.add(new Option("output", "设备输出（REMOTE_SUBMIX）"));
        items.add(new Option("playback", "播放捕获（playback）"));
        items.add(new Option("mic", "麦克风（mic）"));
        items.add(new Option("mic-unprocessed", "麦克风未处理"));
        items.add(new Option("mic-camcorder", "麦克风摄像机"));
        items.add(new Option("mic-voice-recognition", "语音识别"));
        items.add(new Option("mic-voice-communication", "语音通话麦克风"));
        items.add(new Option("voice-call", "通话"));
        items.add(new Option("voice-call-uplink", "通话上行"));
        items.add(new Option("voice-call-downlink", "通话下行"));
        items.add(new Option("voice-performance", "语音性能 / K 歌"));
        return items;
    }

    static List<Option> cameraAudioSources() {
        List<Option> items = new ArrayList<>();
        items.add(new Option("mic", "麦克风（mic）"));
        items.add(new Option("output", "设备输出"));
        items.add(new Option("playback", "播放捕获"));
        return items;
    }

    static List<Option> audioCodes() {
        List<Option> items = new ArrayList<>();
        items.add(new Option("opus", "opus（默认）"));
        items.add(new Option("aac", "aac"));
        items.add(new Option("flac", "flac"));
        items.add(new Option("raw", "raw（PCM）"));
        return items;
    }

    static List<Option> audioBitrates() {
        List<Option> items = new ArrayList<>();
        items.add(new Option("64", "64 Kbps"));
        items.add(new Option("128", "128 Kbps（默认）"));
        items.add(new Option("192", "192 Kbps"));
        items.add(new Option("256", "256 Kbps"));
        return items;
    }

    static List<Option> videoEncoders() {
        List<Option> items = new ArrayList<>();
        items.add(new Option("", "自动（默认）"));
        items.add(new Option("c2.android.avc.encoder", "c2.android.avc.encoder"));
        items.add(new Option("OMX.google.h264.encoder", "OMX.google.h264.encoder"));
        return items;
    }

    static List<Option> cameraFacings() {
        List<Option> items = new ArrayList<>();
        items.add(new Option("", "自动（首个可用）"));
        items.add(new Option("back", "后置"));
        items.add(new Option("front", "前置"));
        items.add(new Option("external", "外接"));
        return items;
    }

    static List<Option> cameraAspectRatios() {
        List<Option> items = new ArrayList<>();
        items.add(new Option("", "自动（最大尺寸）"));
        items.add(new Option("sensor", "传感器比例"));
        items.add(new Option("16:9", "16:9"));
        items.add(new Option("4:3", "4:3"));
        items.add(new Option("1:1", "1:1"));
        return items;
    }

    static List<Option> newDisplayPresets() {
        return CastNewDisplayPresets.all();
    }

    static List<Option> imePolicies() {
        List<Option> items = new ArrayList<>();
        items.add(new Option("", "默认"));
        items.add(new Option("local", "local（虚拟屏本地 IME）"));
        items.add(new Option("fallback", "fallback"));
        items.add(new Option("hide", "hide"));
        return items;
    }

    static String labelFor(List<Option> options, String value) {
        for (Option option : options) {
            if (option.value.equals(value)) {
                return option.label;
            }
        }
        return value == null || value.isEmpty() ? "—" : value;
    }

    static int indexOf(List<Option> options, String value) {
        for (int index = 0; index < options.size(); index += 1) {
            if (options.get(index).value.equals(value)) {
                return index;
            }
        }
        return 0;
    }
}
