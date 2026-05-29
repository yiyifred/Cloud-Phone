package com.yiyi.cloud_phone.workspace;

import org.json.JSONObject;

public class MirrorScreenSettingsFragment extends CastSettingsTabFragment {
    @Override
    protected void buildForm(CastFormBuilder form) {
        JSONObject screen = CastJson.section(host.getMirrorSettings(), "screen");
        form.addTextField(
                "投屏屏幕 (display-id)",
                "新建虚拟屏启用时将忽略此项。",
                CastJson.text(screen, "displayId", ""),
                value -> CastJson.putText(screen, "displayId", value)
        );
        form.addSpinner(
                "新建显示屏",
                "创建独立虚拟屏并镜像其内容。",
                CastOptionLists.newDisplayPresets(),
                CastJson.text(screen, "newDisplaySelect", ""),
                value -> applyNewDisplaySelect(screen, value)
        );
        form.addNumberField(
                "虚拟屏宽度",
                "像素。",
                String.valueOf(CastJson.integer(screen, "newDisplayWidth", 1920)),
                false,
                value -> CastJson.putInt(screen, "newDisplayWidth", parseInt(value, 1920))
        );
        form.addNumberField(
                "虚拟屏高度",
                "像素。",
                String.valueOf(CastJson.integer(screen, "newDisplayHeight", 1080)),
                false,
                value -> CastJson.putInt(screen, "newDisplayHeight", parseInt(value, 1080))
        );
        form.addNumberField(
                "DPI",
                "虚拟屏密度。",
                String.valueOf(CastJson.integer(screen, "newDisplayDpi", 420)),
                false,
                value -> CastJson.putInt(screen, "newDisplayDpi", parseInt(value, 420))
        );
        form.addSwitch(
                "手动设置 DPI",
                "开启后不再自动建议 DPI。",
                CastJson.bool(screen, "newDisplayDpiManual", false),
                value -> CastJson.putBool(screen, "newDisplayDpiManual", value)
        );
        form.addTextField(
                "启动应用包名",
                "连接后在新建虚拟屏上启动该应用。",
                CastJson.text(screen, "newDisplayApp", ""),
                value -> CastJson.putText(screen, "newDisplayApp", value)
        );
        form.addSwitch(
                "弹性虚拟屏",
                "允许虚拟屏随窗口比例调整。",
                CastJson.bool(screen, "flexDisplay", false),
                value -> CastJson.putBool(screen, "flexDisplay", value)
        );
        form.addSwitch(
                "关闭不销毁内容",
                "关闭虚拟屏时保留其中内容。",
                CastJson.bool(screen, "noVdDestroyContent", false),
                value -> CastJson.putBool(screen, "noVdDestroyContent", value)
        );
        form.addSwitch(
                "无系统装饰",
                "隐藏虚拟屏系统装饰。",
                CastJson.bool(screen, "noVdSystemDecorations", false),
                value -> CastJson.putBool(screen, "noVdSystemDecorations", value)
        );
        form.addSpinner(
                "IME 策略",
                "local 为虚拟屏本地输入法。",
                CastOptionLists.imePolicies(),
                CastJson.text(screen, "displayImePolicy", ""),
                value -> CastJson.putText(screen, "displayImePolicy", value)
        );
    }

    private static void applyNewDisplaySelect(JSONObject screen, String value) {
        CastJson.putText(screen, "newDisplaySelect", value);
        CastJson.putBool(screen, "useNewDisplay", value != null && !value.isEmpty());
        if (value != null && value.contains("x") && value.contains("/")) {
            String[] parts = value.split("/");
            String[] size = parts[0].split("x");
            if (size.length == 2) {
                CastJson.putInt(screen, "newDisplayWidth", parseInt(size[0], 1920));
                CastJson.putInt(screen, "newDisplayHeight", parseInt(size[1], 1080));
            }
            if (parts.length > 1) {
                CastJson.putInt(screen, "newDisplayDpi", parseInt(parts[1], 420));
            }
        }
    }

    private static int parseInt(String raw, int fallback) {
        try {
            return Integer.parseInt(raw);
        } catch (Exception error) {
            return fallback;
        }
    }
}
