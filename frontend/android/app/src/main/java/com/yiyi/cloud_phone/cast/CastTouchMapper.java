package com.yiyi.cloud_phone.cast;

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

    static DevicePoint mapToDevice(
            float localX,
            float localY,
            float viewWidth,
            float viewHeight,
            int videoWidth,
            int videoHeight,
            int rotationDeg
    ) {
        float rawWidth = Math.max(1f, viewWidth);
        float rawHeight = Math.max(1f, viewHeight);
        int deg = normalizeRotation(rotationDeg);

        RotatedPoint inverse = rotatePointInverse(localX, localY, rawWidth, rawHeight, deg);
        float touchX = inverse.x;
        float touchY = inverse.y;
        float clientWidth = inverse.width;
        float clientHeight = inverse.height;

        if (videoWidth <= 0 || videoHeight <= 0) {
            return new DevicePoint(touchX, touchY);
        }

        float ratio = (float) videoWidth / (float) videoHeight;
        float eps = 100_000f;
        float shouldBe = Math.round(eps * ratio);
        float haveNow = Math.round((eps * clientWidth) / clientHeight);

        if (shouldBe > haveNow) {
            float realHeight = (float) Math.ceil(clientWidth / ratio);
            float top = (clientHeight - realHeight) / 2f;
            touchY -= top;
            clientHeight = realHeight;
        } else if (shouldBe < haveNow) {
            float realWidth = (float) Math.ceil(clientHeight * ratio);
            float left = (clientWidth - realWidth) / 2f;
            touchX -= left;
            clientWidth = realWidth;
        }

        float nx = touchX / Math.max(1f, clientWidth);
        float ny = touchY / Math.max(1f, clientHeight);
        nx = Math.min(1f, Math.max(0f, nx));
        ny = Math.min(1f, Math.max(0f, ny));
        return new DevicePoint(
                Math.round(nx * videoWidth),
                Math.round(ny * videoHeight)
        );
    }

    private static int normalizeRotation(int degrees) {
        int deg = degrees % 360;
        if (deg < 0) {
            deg += 360;
        }
        return deg;
    }

    private static RotatedPoint rotatePointInverse(
            float x,
            float y,
            float width,
            float height,
            int deg
    ) {
        if (deg == 0) {
            return new RotatedPoint(x, y, width, height);
        }
        float cx = width / 2f;
        float cy = height / 2f;
        float dx = x - cx;
        float dy = y - cy;
        float rdx = dx;
        float rdy = dy;
        switch (deg) {
            case 90:
                rdx = dy;
                rdy = -dx;
                break;
            case 180:
                rdx = -dx;
                rdy = -dy;
                break;
            case 270:
                rdx = -dy;
                rdy = dx;
                break;
            default:
                break;
        }
        float unrotatedWidth = deg == 90 || deg == 270 ? height : width;
        float unrotatedHeight = deg == 90 || deg == 270 ? width : height;
        return new RotatedPoint(
                rdx + unrotatedWidth / 2f,
                rdy + unrotatedHeight / 2f,
                unrotatedWidth,
                unrotatedHeight
        );
    }

    private static final class RotatedPoint {
        final float x;
        final float y;
        final float width;
        final float height;

        RotatedPoint(float x, float y, float width, float height) {
            this.x = x;
            this.y = y;
            this.width = width;
            this.height = height;
        }
    }
}
