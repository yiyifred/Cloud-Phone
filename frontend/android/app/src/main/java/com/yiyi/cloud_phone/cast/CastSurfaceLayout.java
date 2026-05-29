package com.yiyi.cloud_phone.cast;

import android.graphics.Matrix;
import android.view.Gravity;
import android.view.TextureView;
import android.widget.FrameLayout;

final class CastSurfaceLayout {
    private CastSurfaceLayout() {
    }

    /**
     * Pick 0° or 90° preview rotation to maximize scale (minimize letterboxing),
     * matching web mobile fullscreen {@code updateFullscreenLayoutMode}.
     */
    static int suggestAutoRotation(int parentW, int parentH, int videoW, int videoH) {
        if (parentW <= 0 || parentH <= 0 || videoW <= 0 || videoH <= 0) {
            return 0;
        }
        float scale0 = Math.min(parentW / (float) videoW, parentH / (float) videoH);
        float scale90 = Math.min(parentW / (float) videoH, parentH / (float) videoW);
        return scale90 > scale0 ? 90 : 0;
    }

    static void applyLetterbox(
            FrameLayout rootLayout,
            TextureView textureView,
            int videoWidth,
            int videoHeight,
            int rotationDeg
    ) {
        int parentW = rootLayout.getWidth();
        int parentH = rootLayout.getHeight();
        if (parentW <= 0 || parentH <= 0 || videoWidth <= 0 || videoHeight <= 0) {
            return;
        }

        int deg = normalizeRotation(rotationDeg);
        int contentW = deg == 90 || deg == 270 ? videoHeight : videoWidth;
        int contentH = deg == 90 || deg == 270 ? videoWidth : videoHeight;

        float scale = Math.min(parentW / (float) contentW, parentH / (float) contentH);
        int visibleW = Math.max(1, Math.round(contentW * scale));
        int visibleH = Math.max(1, Math.round(contentH * scale));

        int layoutW = visibleW;
        int layoutH = visibleH;
        if (deg == 90 || deg == 270) {
            layoutW = visibleH;
            layoutH = visibleW;
        }

        FrameLayout.LayoutParams params = (FrameLayout.LayoutParams) textureView.getLayoutParams();
        params.width = layoutW;
        params.height = layoutH;
        params.gravity = Gravity.CENTER;
        textureView.setLayoutParams(params);
        textureView.setPivotX(layoutW / 2f);
        textureView.setPivotY(layoutH / 2f);
        textureView.setRotation(deg);
        // We already size the TextureView to a contain-fit rectangle. Any additional
        // internal transform would double-scale the content and cause zoom/crop.
        textureView.setTransform(new Matrix());
    }

    private static int normalizeRotation(int degrees) {
        int deg = degrees % 360;
        if (deg < 0) {
            deg += 360;
        }
        if (deg != 0 && deg != 90 && deg != 180 && deg != 270) {
            return 0;
        }
        return deg;
    }
}
