package com.yiyi.cloud_phone.cast;

import android.view.MotionEvent;
import android.view.View;
import android.widget.ImageButton;
import android.widget.LinearLayout;

import com.yiyi.cloud_phone.R;

final class CastInteractionController {
    private final CastFullscreenActivity activity;
    private final TextureHolder textureHolder;
    private final CastWebSocketSession webSocketSession;
    private final CastFullscreenActivity.ToolbarHandler toolbarHandler;
    private final CastChromeController chromeController;
    private boolean interactionEnabled = true;
    private int videoWidth;
    private int videoHeight;
    private int previewRotation;
    private float touchDownX;
    private float touchDownY;

    interface TextureHolder {
        View getTouchTarget();

        int getWidth();

        int getHeight();
    }

    CastInteractionController(
            CastFullscreenActivity activity,
            TextureHolder textureHolder,
            CastWebSocketSession webSocketSession,
            CastFullscreenActivity.ToolbarHandler toolbarHandler,
            CastChromeController chromeController
    ) {
        this.activity = activity;
        this.textureHolder = textureHolder;
        this.webSocketSession = webSocketSession;
        this.toolbarHandler = toolbarHandler;
        this.chromeController = chromeController;
    }

    void bind(LinearLayout toolbar) {
        int buttonSize = (int) (44 * activity.getResources().getDisplayMetrics().density);
        int padding = (int) (10 * activity.getResources().getDisplayMetrics().density);
        for (String actionId : CastFullscreenActivity.TOOLBAR_ACTIONS) {
            ImageButton button = new ImageButton(activity);
            LinearLayout.LayoutParams params = new LinearLayout.LayoutParams(buttonSize, buttonSize);
            params.setMarginEnd((int) (6 * activity.getResources().getDisplayMetrics().density));
            button.setLayoutParams(params);
            button.setBackgroundResource(R.drawable.cast_toolbar_button_bg);
            button.setImageDrawable(CastUiIcons.action(activity, actionId));
            button.setContentDescription(CastUiIcons.actionLabel(activity, actionId));
            button.setPadding(padding, padding, padding, padding);
            button.setScaleType(ImageButton.ScaleType.CENTER_INSIDE);
            button.setOnClickListener(v -> onToolbarAction(actionId));
            toolbar.addView(button);
        }
        View target = textureHolder.getTouchTarget();
        target.setOnTouchListener(this::handleTouch);
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
        if (action == MotionEvent.ACTION_UP) {
            float dx = Math.abs(event.getX() - touchDownX);
            float dy = Math.abs(event.getY() - touchDownY);
            float threshold = 18f * activity.getResources().getDisplayMetrics().density;
            if (dx < threshold && dy < threshold && !interactionEnabled) {
                chromeController.toggleChrome();
                return true;
            }
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
        byte[] payload = ScrcpyControlWire.navigationTap(actionId);
        if (payload != null) {
            webSocketSession.sendControl(payload);
        }
    }
}
