package com.yiyi.cloud_phone.cast;

import java.nio.ByteBuffer;
import java.nio.ByteOrder;

public final class ScrcpyControlWire {
    public static final int MOTION_DOWN = 0;
    public static final int MOTION_UP = 1;
    public static final int MOTION_MOVE = 2;

    private static final int TYPE_INJECT_KEYCODE = 0;
    private static final int TYPE_INJECT_TOUCH = 2;
    private static final int TYPE_SET_SCREEN_POWER = 10;
    private static final int TYPE_ROTATE_DEVICE = 11;

    private static final int KEY_HOME = 3;
    private static final int KEY_BACK = 4;
    private static final int KEY_POWER = 26;
    private static final int KEY_VOLUME_UP = 24;
    private static final int KEY_VOLUME_DOWN = 25;
    private static final int KEY_APP_SWITCH = 187;

    private static final int KEY_ACTION_DOWN = 0;
    private static final int KEY_ACTION_UP = 1;
    private static final int BUTTON_PRIMARY = 1;
    private static final int POWER_MODE_OFF = 0;
    private static final int POWER_MODE_NORMAL = 2;

    private ScrcpyControlWire() {
    }

    public static byte[] injectTouch(
            int action,
            float x,
            float y,
            int screenWidth,
            int screenHeight
    ) {
        TouchPhase phase = touchPhase(action);
        ByteBuffer buffer = ByteBuffer.allocate(32).order(ByteOrder.BIG_ENDIAN);
        buffer.put((byte) TYPE_INJECT_TOUCH);
        buffer.put((byte) action);
        buffer.putLong(0L);
        buffer.putInt(Math.round(x));
        buffer.putInt(Math.round(y));
        buffer.putShort((short) screenWidth);
        buffer.putShort((short) screenHeight);
        int pressure = Math.round(Math.min(1f, Math.max(0f, phase.pressure)) * 0xffff);
        buffer.putShort((short) pressure);
        buffer.putInt(phase.actionButton);
        buffer.putInt(phase.buttons);
        return buffer.array();
    }

    public static byte[] navigationPress(String actionId, boolean down) {
        int keyAction = down ? KEY_ACTION_DOWN : KEY_ACTION_UP;
        Integer keycode = navigationKeycode(actionId);
        if (keycode == null) {
            return null;
        }
        return injectKeycode(keyAction, keycode);
    }

    public static byte[] navigationTap(String actionId) {
        Integer keycode = navigationKeycode(actionId);
        if (keycode == null) {
            return null;
        }
        byte[] down = injectKeycode(KEY_ACTION_DOWN, keycode);
        byte[] up = injectKeycode(KEY_ACTION_UP, keycode);
        byte[] merged = new byte[down.length + up.length];
        System.arraycopy(down, 0, merged, 0, down.length);
        System.arraycopy(up, 0, merged, down.length, up.length);
        return merged;
    }

    public static byte[] setScreenPower(boolean on) {
        return new byte[] { (byte) TYPE_SET_SCREEN_POWER, (byte) (on ? POWER_MODE_NORMAL : POWER_MODE_OFF) };
    }

    public static byte[] rotateDevice() {
        return new byte[] { (byte) TYPE_ROTATE_DEVICE };
    }

    private static byte[] injectKeycode(int action, int keycode) {
        ByteBuffer buffer = ByteBuffer.allocate(14).order(ByteOrder.BIG_ENDIAN);
        buffer.put((byte) TYPE_INJECT_KEYCODE);
        buffer.put((byte) action);
        buffer.putInt(keycode);
        buffer.putInt(0);
        buffer.putInt(0);
        return buffer.array();
    }

    private static Integer navigationKeycode(String actionId) {
        if (actionId == null) {
            return null;
        }
        switch (actionId) {
            case "home":
                return KEY_HOME;
            case "back":
                return KEY_BACK;
            case "recents":
                return KEY_APP_SWITCH;
            case "power":
                return KEY_POWER;
            case "volume-up":
                return KEY_VOLUME_UP;
            case "volume-down":
                return KEY_VOLUME_DOWN;
            default:
                return null;
        }
    }

    private static TouchPhase touchPhase(int action) {
        switch (action) {
            case MOTION_DOWN:
                return new TouchPhase(BUTTON_PRIMARY, BUTTON_PRIMARY, 1f);
            case MOTION_MOVE:
                return new TouchPhase(0, BUTTON_PRIMARY, 1f);
            case MOTION_UP:
                return new TouchPhase(BUTTON_PRIMARY, 0, 0f);
            default:
                return new TouchPhase(0, 0, 0f);
        }
    }

    private static final class TouchPhase {
        final int actionButton;
        final int buttons;
        final float pressure;

        TouchPhase(int actionButton, int buttons, float pressure) {
            this.actionButton = actionButton;
            this.buttons = buttons;
            this.pressure = pressure;
        }
    }
}
