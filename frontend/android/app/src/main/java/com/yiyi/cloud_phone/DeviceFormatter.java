package com.yiyi.cloud_phone;

import android.content.Context;

import java.text.SimpleDateFormat;
import java.util.ArrayList;
import java.util.Collections;
import java.util.Comparator;
import java.util.Date;
import java.util.HashSet;
import java.util.List;
import java.util.Locale;
import java.util.Set;

final class DeviceFormatter {
    private static final Set<String> KNOWN_STATES = new HashSet<>();

    static {
        Collections.addAll(
                KNOWN_STATES,
                "device",
                "offline",
                "unauthorized",
                "bootloader",
                "recovery",
                "sideload",
                "downloading",
                "no permissions"
        );
    }

    private DeviceFormatter() {
    }

    static List<DeviceItem> sort(List<DeviceItem> devices) {
        List<DeviceItem> sorted = new ArrayList<>(devices);
        sorted.sort(new Comparator<DeviceItem>() {
            @Override
            public int compare(DeviceItem left, DeviceItem right) {
                if (left.connected != right.connected) {
                    return left.connected ? -1 : 1;
                }
                String leftName = left.displayName == null ? left.serial : left.displayName;
                String rightName = right.displayName == null ? right.serial : right.displayName;
                return leftName.compareToIgnoreCase(rightName);
            }
        });
        return sorted;
    }

    static int countOnline(List<DeviceItem> devices) {
        int online = 0;
        for (DeviceItem device : devices) {
            if (device.connected) {
                online += 1;
            }
        }
        return online;
    }

    static String stateLabel(Context context, String state) {
        if (state == null || state.isEmpty()) {
            return context.getString(R.string.devices_state_unknown);
        }
        if ("device".equals(state)) {
            return context.getString(R.string.devices_state_device);
        }
        if ("offline".equals(state)) {
            return context.getString(R.string.devices_state_offline);
        }
        if ("unauthorized".equals(state)) {
            return context.getString(R.string.devices_state_unauthorized);
        }
        if ("bootloader".equals(state)) {
            return context.getString(R.string.devices_state_bootloader);
        }
        if ("recovery".equals(state)) {
            return context.getString(R.string.devices_state_recovery);
        }
        if ("sideload".equals(state)) {
            return context.getString(R.string.devices_state_sideload);
        }
        if ("downloading".equals(state)) {
            return context.getString(R.string.devices_state_downloading);
        }
        if ("no permissions".equals(state)) {
            return context.getString(R.string.devices_state_no_permissions);
        }
        return state;
    }

    static String manufacturerLine(DeviceItem device) {
        if (!device.manufacturer.isEmpty() && !device.product.isEmpty()) {
            return device.manufacturer + " · " + device.product;
        }
        if (!device.manufacturer.isEmpty()) {
            return device.manufacturer;
        }
        if (!device.product.isEmpty()) {
            return device.product;
        }
        return "";
    }

    static String androidLine(DeviceItem device) {
        if (!device.androidVersion.isEmpty() && !device.sdkVersion.isEmpty()) {
            return "Android " + device.androidVersion + " · SDK " + device.sdkVersion;
        }
        if (!device.androidVersion.isEmpty()) {
            return "Android " + device.androidVersion;
        }
        if (!device.sdkVersion.isEmpty()) {
            return "SDK " + device.sdkVersion;
        }
        return "";
    }

    static String productLine(DeviceItem device) {
        if (!device.product.isEmpty() && !device.device.isEmpty()) {
            return device.product + " · " + device.device;
        }
        if (!device.product.isEmpty()) {
            return device.product;
        }
        if (!device.device.isEmpty()) {
            return device.device;
        }
        return "—";
    }

    static String formatRefreshTime(long timestampMs) {
        if (timestampMs <= 0L) {
            return "";
        }
        return new SimpleDateFormat("HH:mm:ss", Locale.getDefault()).format(new Date(timestampMs));
    }
}
