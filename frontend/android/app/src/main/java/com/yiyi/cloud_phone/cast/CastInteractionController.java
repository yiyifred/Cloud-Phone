package com.yiyi.cloud_phone.cast;

import android.animation.AnimatorInflater;
import android.view.MotionEvent;
import android.widget.ImageButton;
import android.widget.LinearLayout;
import android.view.View;

import com.yiyi.cloud_phone.R;
import com.yiyi.cloud_phone.workspace.CastMode;

final class CastInteractionController {
    private static final String[] MIRROR_ACTIONS = {
            "recents", "home", "back", "power", "volume-down", "volume-up", "rotate", "stop"
    };
    private static final String[] CAMERA_ACTIONS = {
            "torch", "zoom-out", "zoom-in", "stop"
    };

    private final CastFullscreenActivity activity;
    private final CastMode castMode;
    private final TextureHolder textureHolder;
    private final CastWebSocketSession webSocketSession;
    private final CastFullscreenActivity.ToolbarHandler toolbarHandler;
    private final CastChromeController chromeController;
    private final View screenshotFlash;
    private boolean interactionEnabled = true;
    private int videoWidth;
    private int videoHeight;
    private int previewRotation;
    private float touchDownX;
    private float touchDownY;
    private boolean torchOn;

    interface TextureHolder {
        View getTouchTarget();

        int getWidth();

        int getHeight();
    }

    CastInteractionController(
            CastFullscreenActivity activity,
            CastMode castMode,
            TextureHolder textureHolder,
            CastWebSocketSession webSocketSession,
            CastFullscreenActivity.ToolbarHandler toolbarHandler,
            CastChromeController chromeController,
            View screenshotFlash
    ) {
        this.activity = activity;
        this.castMode = castMode;
        this.textureHolder = textureHolder;
        this.webSocketSession = webSocketSession;
        this.toolbarHandler = toolbarHandler;
        this.chromeController = chromeController;
        this.screenshotFlash = screenshotFlash;
    }

    void bind(LinearLayout toolbar) {
        String[] actions = castMode == CastMode.CAMERA ? CAMERA_ACTIONS : MIRROR_ACTIONS;
        int buttonSize = (int) (44 * activity.getResources().getDisplayMetrics().density);
        int padding = (int) (10 * activity.getResources().getDisplayMetrics().density);
        for (String actionId : actions) {
            ImageButton button = new ImageButton(activity);
            LinearLayout.LayoutParams params = new LinearLayout.LayoutParams(buttonSize, buttonSize);
            params.setMarginEnd((int) (6 * activity.getResources().getDisplayMetrics().density));
            button.setLayoutParams(params);
            button.setBackgroundResource(R.drawable.cast_toolbar_button_bg);
            button.setImageDrawable(CastUiIcons.action(activity, actionId));
            button.setContentDescription(CastUiIcons.actionLabel(activity, actionId));
            button.setPadding(padding, padding, padding, padding);
            button.setStateListAnimator(
                    AnimatorInflater.loadStateListAnimator(activity, R.animator.cast_toolbar_press)
            );
            button.setOnClickListener(v -> onToolbarAction(actionId));
            toolbar.addView(button);
        }
        textureHolder.getTouchTarget().setOnTouchListener(this::handleTouch);
    }

    void setInteractionEnabled(boolean enabled) {
        interactionEnabled = enabled;
    }

    void setPreviewRotation(int rotation) {
        previewRotation = rotation;
    }

    void setVideoSize(int width, int height) {
        videoWidth = width;
        videoHeight = height;
    }

    private boolean handleTouch(View view, MotionEvent event) {
        chromeController.onUserInteraction();
        int action = event.getActionMasked();
        if (action == MotionEvent.ACTION_DOWN) {
            touchDownX = event.getX();
            touchDownY = event.getY();
        }
        if (!interactionEnabled || videoWidth <= 0 || videoHeight <= 0) {
            return true;
        }
        int motionAction;
        switch (action) {
            case MotionEvent.ACTION_DOWN:
                motionAction = ScrcpyControlWire.MOTION_DOWN;
                break;
            case MotionEvent.ACTION_MOVE:
                motionAction = ScrcpyControlWire.MOTION_MOVE;
                break;
            case MotionEvent.ACTION_UP:
            case MotionEvent.ACTION_CANCEL:
                motionAction = ScrcpyControlWire.MOTION_UP;
                break;
            default:
                return true;
        }
        CastTouchMapper.DevicePoint point = CastTouchMapper.mapToDevice(
                event.getX(),
                event.getY(),
                textureHolder.getWidth(),
                textureHolder.getHeight(),
                videoWidth,
                videoHeight,
                previewRotation
        );
        webSocketSession.sendControl(ScrcpyControlWire.injectTouch(
                motionAction,
                point.x,
                point.y,
                videoWidth,
                videoHeight
        ));
        return true;
    }

    private void onToolbarAction(String actionId) {
        chromeController.onUserInteraction();
        if ("stop".equals(actionId)) {
            toolbarHandler.onStopRequested();
            return;
        }
        if ("rotate".equals(actionId)) {
            toolbarHandler.onRotateRequested();
            return;
        }
        if ("torch".equals(actionId)) {
            torchOn = !torchOn;
            webSocketSession.sendControl(ScrcpyControlWire.cameraSetTorch(torchOn));
            return;
        }
        if ("zoom-in".equals(actionId)) {
            webSocketSession.sendControl(ScrcpyControlWire.cameraZoomIn());
            return;
        }
        if ("zoom-out".equals(actionId)) {
            webSocketSession.sendControl(ScrcpyControlWire.cameraZoomOut());
            return;
        }
        byte[] payload = ScrcpyControlWire.navigationTap(actionId);
        if (payload != null) {
            webSocketSession.sendControl(payload);
        }
    }
}
