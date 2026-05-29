package com.yiyi.cloud_phone.cast;

import android.view.Gravity;
import android.view.TextureView;
import android.widget.FrameLayout;

final class CastSurfaceLayout {
    private CastSurfaceLayout() {
    }

    static void applyLetterbox(
            FrameLayout rootLayout,
            TextureView textureView,
            int videoWidth,
            int videoHeight,
            int previewRotation
    ) {
        int parentW = rootLayout.getWidth();
        int parentH = rootLayout.getHeight();
        if (parentW <= 0 || parentH <= 0 || videoWidth <= 0 || videoHeight <= 0) {
            return;
        }
        float ratio = (float) videoWidth / (float) videoHeight;
        int targetW = parentW;
        int targetH = Math.round(parentW / ratio);
        if (targetH > parentH) {
            targetH = parentH;
            targetW = Math.round(parentH * ratio);
        }
        if (previewRotation == 90 || previewRotation == 270) {
            int swap = targetW;
            targetW = targetH;
            targetH = swap;
        }
        FrameLayout.LayoutParams params = (FrameLayout.LayoutParams) textureView.getLayoutParams();
        params.width = targetW;
        params.height = targetH;
        params.gravity = Gravity.CENTER;
        textureView.setLayoutParams(params);
        textureView.setRotation(previewRotation);
    }
}
