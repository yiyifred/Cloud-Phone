package com.genymobile.scrcpy.control;

import com.genymobile.scrcpy.device.Device;
import com.genymobile.scrcpy.video.CameraCapture;

import java.io.IOException;

final class ControllerMessageHandler {

    private ControllerMessageHandler() {
    }

    static boolean handleMessage(Controller controller, ControlMessage msg) throws IOException {
        int type = msg.getType();

        switch (type) {
            case ControlMessage.TYPE_RESET_VIDEO:
                controller.resetVideo();
                return true;
            default:
                break;
        }

        if (!controller.camera) {
            switch (type) {
                case ControlMessage.TYPE_INJECT_KEYCODE:
                    if (controller.supportsInputEvents) {
                        ControllerKeyboardInput.injectKeycode(controller, msg.getAction(), msg.getKeycode(), msg.getRepeat(),
                                msg.getMetaState());
                    }
                    return true;
                case ControlMessage.TYPE_INJECT_TEXT:
                    if (controller.supportsInputEvents) {
                        ControllerKeyboardInput.injectText(controller, msg.getText());
                    }
                    return true;
                case ControlMessage.TYPE_INJECT_TOUCH_EVENT:
                    if (controller.supportsInputEvents) {
                        ControllerTouchInput.injectTouch(controller,
                                msg.getAction(), msg.getPointerId(), msg.getPosition(), msg.getPressure(),
                                msg.getActionButton(), msg.getButtons());
                    }
                    return true;
                case ControlMessage.TYPE_INJECT_SCROLL_EVENT:
                    if (controller.supportsInputEvents) {
                        ControllerTouchInput.injectScroll(controller, msg.getPosition(), msg.getHScroll(), msg.getVScroll(),
                                msg.getButtons());
                    }
                    return true;
                case ControlMessage.TYPE_BACK_OR_SCREEN_ON:
                    if (controller.supportsInputEvents) {
                        ControllerKeyboardInput.pressBackOrTurnScreenOn(controller, msg.getAction());
                    }
                    return true;
                case ControlMessage.TYPE_EXPAND_NOTIFICATION_PANEL:
                    Device.expandNotificationPanel();
                    return true;
                case ControlMessage.TYPE_EXPAND_SETTINGS_PANEL:
                    Device.expandSettingsPanel();
                    return true;
                case ControlMessage.TYPE_COLLAPSE_PANELS:
                    Device.collapsePanels();
                    return true;
                case ControlMessage.TYPE_GET_CLIPBOARD:
                    ControllerClipboard.getClipboard(controller, msg.getCopyKey());
                    return true;
                case ControlMessage.TYPE_SET_CLIPBOARD:
                    ControllerClipboard.setClipboard(controller, msg.getText(), msg.getPaste(), msg.getSequence());
                    return true;
                case ControlMessage.TYPE_SET_DISPLAY_POWER:
                    if (controller.supportsInputEvents) {
                        ControllerDisplaySession.setDisplayPower(controller, msg.getOn());
                    }
                    return true;
                case ControlMessage.TYPE_ROTATE_DEVICE:
                    int actionDisplayId = ControllerKeyboardInput.getActionDisplayId(controller);
                    if (actionDisplayId != Device.DISPLAY_ID_NONE) {
                        Device.rotateDevice(actionDisplayId);
                    }
                    return true;
                case ControlMessage.TYPE_UHID_CREATE:
                    controller.getUhidManager().open(msg.getId(), msg.getVendorId(), msg.getProductId(), msg.getText(), msg.getData());
                    return true;
                case ControlMessage.TYPE_UHID_INPUT:
                    controller.getUhidManager().writeInput(msg.getId(), msg.getData());
                    return true;
                case ControlMessage.TYPE_UHID_DESTROY:
                    controller.getUhidManager().close(msg.getId());
                    return true;
                case ControlMessage.TYPE_OPEN_HARD_KEYBOARD_SETTINGS:
                    ControllerClipboard.openHardKeyboardSettings();
                    return true;
                case ControlMessage.TYPE_START_APP:
                    ControllerDisplaySession.startAppAsync(controller, msg.getText());
                    return true;
                case ControlMessage.TYPE_RESIZE_DISPLAY:
                    controller.resizeDisplay(msg.getWidth(), msg.getHeight());
                    return true;
                case ControlMessage.TYPE_SCAN_FILE:
                    controller.scanFile(msg.getText());
                    return true;
                default:
                    break;
            }
        } else {
            assert controller.surfaceCapture instanceof CameraCapture;
            CameraCapture cameraCapture = (CameraCapture) controller.surfaceCapture;
            switch (type) {
                case ControlMessage.TYPE_CAMERA_SET_TORCH:
                    cameraCapture.setTorchEnabled(msg.getOn());
                    return true;
                case ControlMessage.TYPE_CAMERA_ZOOM_IN:
                    cameraCapture.zoomIn();
                    return true;
                case ControlMessage.TYPE_CAMERA_ZOOM_OUT:
                    cameraCapture.zoomOut();
                    return true;
                default:
                    break;
            }
        }

        throw new AssertionError("Unexpected message type: " + type);
    }
}
