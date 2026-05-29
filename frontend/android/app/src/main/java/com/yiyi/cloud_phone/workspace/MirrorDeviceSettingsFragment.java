package com.yiyi.cloud_phone.workspace;

import org.json.JSONObject;

public class MirrorDeviceSettingsFragment extends CastSettingsTabFragment {
    @Override
    protected void buildForm(CastFormBuilder form) {
        JSONObject device = CastJson.section(host.getMirrorSettings(), "device");
        form.addSwitch(
                "显示触摸点",
                "在投屏画面上叠加触摸位置指示。",
                CastJson.bool(device, "showTouches", false),
                value -> CastJson.putBool(device, "showTouches", value)
        );
        form.addSwitch(
                "保持唤醒",
                "投屏期间尽量保持设备唤醒。",
                CastJson.bool(device, "stayAwake", false),
                value -> CastJson.putBool(device, "stayAwake", value)
        );
        form.addSwitch(
                "关闭设备屏幕",
                "开始投屏后自动熄屏。",
                CastJson.bool(device, "turnScreenOff", false),
                value -> CastJson.putBool(device, "turnScreenOff", value)
        );
        form.addSwitch(
                "启动时点亮屏幕",
                "与「不自动点亮」互斥。",
                CastJson.bool(device, "powerOn", true),
                value -> CastJson.putBool(device, "powerOn", value)
        );
        form.addSwitch(
                "不自动点亮",
                "连接时不主动点亮屏幕。",
                CastJson.bool(device, "noPowerOn", false),
                value -> CastJson.putBool(device, "noPowerOn", value)
        );
        form.addSwitch(
                "保持虚拟显示活跃",
                "降低虚拟显示被系统回收的概率。",
                CastJson.bool(device, "keepActive", false),
                value -> CastJson.putBool(device, "keepActive", value)
        );
        form.addNumberField(
                "熄屏超时（秒）",
                "0 表示使用系统默认。",
                String.valueOf(CastJson.integer(device, "screenOffTimeout", 0)),
                false,
                value -> CastJson.putInt(device, "screenOffTimeout", parseInt(value, 0))
        );
        form.addBanner("设备类参数经 WebSocket type 101 的 codecOptions 同步到 scrcpy-server。");
    }

    private static int parseInt(String raw, int fallback) {
        try {
            return Integer.parseInt(raw);
        } catch (Exception error) {
            return fallback;
        }
    }
}
