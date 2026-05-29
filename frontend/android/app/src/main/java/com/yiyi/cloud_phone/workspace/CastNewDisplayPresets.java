package com.yiyi.cloud_phone.workspace;

import java.util.ArrayList;
import java.util.List;

final class CastNewDisplayPresets {
    private CastNewDisplayPresets() {
    }

    static List<CastOptionLists.Option> all() {
        List<CastOptionLists.Option> items = new ArrayList<>();
        items.add(new CastOptionLists.Option("", "关闭（使用 display-id）"));
        items.add(new CastOptionLists.Option("__main__", "主屏尺寸与密度"));
        items.add(new CastOptionLists.Option("__custom__", "自定义分辨率 / DPI"));
        addDesktop(items);
        addMac(items);
        addUltrawide(items);
        addTablet(items);
        addPhone(items);
        return items;
    }

    private static void addDesktop(List<CastOptionLists.Option> items) {
        items.add(new CastOptionLists.Option("1280x720/160", "HD 16:9 1280×720/160"));
        items.add(new CastOptionLists.Option("1920x1080/160", "FHD 16:9 1920×1080/160"));
        items.add(new CastOptionLists.Option("2560x1440/160", "QHD 16:9 2560×1440/160"));
        items.add(new CastOptionLists.Option("3840x2160/160", "4K UHD 16:9 3840×2160/160"));
        items.add(new CastOptionLists.Option("1280x800/160", "WXGA 16:10 1280×800/160"));
        items.add(new CastOptionLists.Option("1920x1200/160", "WUXGA 16:10 1920×1200/160"));
    }

    private static void addMac(List<CastOptionLists.Option> items) {
        items.add(new CastOptionLists.Option("3024x1964/254", "MacBook Pro 14\" 3024×1964/254"));
        items.add(new CastOptionLists.Option("3456x2234/254", "MacBook Pro 16\" 3456×2234/254"));
        items.add(new CastOptionLists.Option("4480x2520/218", "iMac 24\" 4480×2520/218"));
    }

    private static void addUltrawide(List<CastOptionLists.Option> items) {
        items.add(new CastOptionLists.Option("3440x1440/160", "UW QHD 3440×1440/160"));
        items.add(new CastOptionLists.Option("5120x2160/160", "UW 5K 5120×2160/160"));
    }

    private static void addTablet(List<CastOptionLists.Option> items) {
        items.add(new CastOptionLists.Option("2360x1640/264", "iPad Air 11\" 2360×1640/264"));
        items.add(new CastOptionLists.Option("2752x2064/264", "iPad Pro 13\" 2752×2064/264"));
        items.add(new CastOptionLists.Option("2560x1600/287", "Galaxy Tab S4 2560×1600/287"));
    }

    private static void addPhone(List<CastOptionLists.Option> items) {
        items.add(new CastOptionLists.Option("2556x1179/460", "iPhone 16 2556×1179/460"));
        items.add(new CastOptionLists.Option("2868x1320/460", "iPhone 17 Pro Max 2868×1320/460"));
        items.add(new CastOptionLists.Option("1440x3200/511", "Galaxy S20 Ultra 1440×3200/511"));
        items.add(new CastOptionLists.Option("1080x2400/416", "Pixel 7 1080×2400/416"));
    }
}
