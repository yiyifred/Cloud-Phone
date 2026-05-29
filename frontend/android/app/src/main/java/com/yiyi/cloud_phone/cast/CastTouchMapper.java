package com.yiyi.cloud_phone.cast;

import android.graphics.Matrix;
import android.view.MotionEvent;
import android.view.TextureView;

final class CastTouchMapper {
    private CastTouchMapper() {
    }

    static final class DevicePoint {
        final float x;
        final float y;

        DevicePoint(float x, float y) {
            this.x = x;
            this.y = y;
        }
    }

    static DevicePoint mapTouchEvent(
            MotionEvent event,
            TextureView textureView,
            int videoWidth,
            int videoHeight,
            int previewRotationDeg
    ) {
        return mapToDevice(
                event.getX(),
                event.getY(),
                textureView,
                videoWidth,
                videoHeight,
                previewRotationDeg
        );
    }

    static DevicePoint mapToDevice(
            float localX,
            float localY,
            TextureView textureView,
            int videoWidth,
            int videoHeight,
            int previewRotationDeg
    ) {
        if (videoWidth <= 0 || videoHeight <= 0) {
            return new DevicePoint(localX, localY);
        }

        float viewW = Math.max(1f, textureView.getWidth());
        float viewH = Math.max(1f, textureView.getHeight());

        // Touch coordinates are already delivered in the unrotated local coordinate space
        // (Android applies the inverse view matrix when dispatching MotionEvent).
        // So we must NOT inverse-rotate here, otherwise we'd double-rotate the mapping.
        Matrix transform = new Matrix();
        textureView.getTransform(transform);
        Matrix inverse = new Matrix();
        if (!transform.invert(inverse)) {
            inverse.reset();
        }
        float[] pts = {localX, localY};
        inverse.mapPoints(pts);
        float mappedX = pts[0];
        float mappedY = pts[1];

        // If transform is identity (our default), mappedX/Y are view-local pixels.
        // Scale to video pixels.
        float videoX = mappedX * (videoWidth / viewW);
        float videoY = mappedY * (videoHeight / viewH);

        videoX = Math.max(0f, Math.min(videoWidth, videoX));
        videoY = Math.max(0f, Math.min(videoHeight, videoY));

        return new DevicePoint(Math.round(videoX), Math.round(videoY));
    }

    // Rotation is intentionally unused here: MotionEvent coordinates are already
    // mapped into the unrotated local coordinate space by Android.
}
