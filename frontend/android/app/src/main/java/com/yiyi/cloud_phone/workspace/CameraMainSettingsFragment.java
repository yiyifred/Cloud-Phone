package com.yiyi.cloud_phone.workspace;

import org.json.JSONObject;

public class CameraMainSettingsFragment extends CastSettingsTabFragment {
    private static final int CAMERA_MIN_SDK = 31;

    @Override
    protected void buildForm(CastFormBuilder form) {
        JSONObject camera = CastJson.section(host.getCameraSettings(), "camera");
        int sdk = host.getDeviceSdk();
        if (sdk > 0 && sdk < CAMERA_MIN_SDK) {
            form.addBanner("摄像头投屏需要 Android 12（API 31）及以上，当前 SDK " + sdk + "。");
        }

        form.addTextField(
                "摄像头 ID",
                "留空则按朝向选择首个匹配摄像头。",
                CastJson.text(camera, "cameraId", ""),
                value -> CastJson.putText(camera, "cameraId", value)
        );
        form.addSpinner(
                "朝向",
                "与摄像头 ID 互斥（指定 ID 时忽略）。",
                CastOptionLists.cameraFacings(),
                CastJson.text(camera, "facing", "back"),
                value -> CastJson.putText(camera, "facing", value)
        );
        form.addTextField(
                "采集尺寸",
                "例如 1920x1080，留空自动选择。",
                CastJson.text(camera, "size", ""),
                value -> CastJson.putText(camera, "size", value)
        );
        form.addSpinner(
                "宽高比",
                "未指定尺寸时用于筛选分辨率。",
                CastOptionLists.cameraAspectRatios(),
                CastJson.text(camera, "aspectRatio", ""),
                value -> CastJson.putText(camera, "aspectRatio", value)
        );
        form.addNumberField(
                "采集帧率",
                "对应 --camera-fps，默认 30。",
                String.valueOf(CastJson.integer(camera, "fps", 30)),
                false,
                value -> CastJson.putInt(camera, "fps", parseInt(value, 30))
        );
        form.addSwitch(
                "高速模式",
                "需设备支持高速尺寸。",
                CastJson.bool(camera, "highSpeed", false),
                value -> CastJson.putBool(camera, "highSpeed", value)
        );
        form.addSwitch(
                "启动时打开手电筒",
                "对应 --camera-torch。",
                CastJson.bool(camera, "torch", false),
                value -> CastJson.putBool(camera, "torch", value)
        );
        form.addNumberField(
                "初始变焦",
                "对应 --camera-zoom。",
                String.valueOf(CastJson.number(camera, "zoom", 1)),
                true,
                value -> CastJson.putNumber(camera, "zoom", parseDouble(value, 1))
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
