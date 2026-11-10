package com.genymobile.scrcpy.video;

import com.genymobile.scrcpy.AndroidVersions;
import com.genymobile.scrcpy.Options;
import com.genymobile.scrcpy.model.ConfigurationException;
import com.genymobile.scrcpy.model.Orientation;
import com.genymobile.scrcpy.model.Size;
import com.genymobile.scrcpy.opengl.AffineOpenGLFilter;
import com.genymobile.scrcpy.opengl.OpenGLFilter;
import com.genymobile.scrcpy.opengl.OpenGLRunner;
import com.genymobile.scrcpy.util.AffineMatrix;
import com.genymobile.scrcpy.util.HandlerExecutor;
import com.genymobile.scrcpy.util.Ln;
import com.genymobile.scrcpy.util.LogUtils;
import com.genymobile.scrcpy.wrappers.ServiceManager;

import android.annotation.SuppressLint;
import android.annotation.TargetApi;
import android.graphics.Rect;
import android.hardware.camera2.CameraAccessException;
import android.hardware.camera2.CameraCaptureSession;
import android.hardware.camera2.CameraCharacteristics;
import android.hardware.camera2.CameraConstrainedHighSpeedCaptureSession;
import android.hardware.camera2.CameraDevice;
import android.hardware.camera2.CameraManager;
import android.hardware.camera2.CaptureFailure;
import android.hardware.camera2.CaptureRequest;
import android.hardware.camera2.params.OutputConfiguration;
import android.hardware.camera2.params.SessionConfiguration;
import android.hardware.camera2.params.StreamConfigurationMap;
import android.media.MediaCodec;
import android.os.Handler;
import android.os.HandlerThread;
import android.util.Range;
import android.view.Surface;

import java.io.IOException;
import java.util.Arrays;
import java.util.Collections;
import java.util.List;
import java.util.Optional;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.ExecutionException;
import java.util.concurrent.Executor;
import java.util.concurrent.atomic.AtomicBoolean;
import java.util.stream.Stream;

public class CameraCapture extends SurfaceCapture {

    public static final float[] VFLIP_MATRIX = {
            1, 0, 0, 0, // column 1
            0, -1, 0, 0, // column 2
            0, 0, 1, 0, // column 3
            0, 1, 0, 1, // column 4
    };

    private static final float ZOOM_FACTOR = 1 + 1 / 16f;

    private final String explicitCameraId;
    private final CameraFacing cameraFacing;
    private final Size explicitSize;
    private final CameraAspectRatio aspectRatio;
    private final int fps;
    private final boolean highSpeed;
    private final Rect crop;
    private final Orientation captureOrientation;
    private final float angle;
    private final boolean initialTorch;
    private float zoom;

    private VideoConstraints videoConstraints;

    private String cameraId;
    private Size captureSize;
    private Size videoSize; // after OpenGL transforms
    private Range<Float> zoomRange;

    private AffineMatrix transform;
    private OpenGLRunner glRunner;

    private HandlerThread cameraThread;
    private Handler cameraHandler;
    private CameraDevice cameraDevice;
    private Executor cameraExecutor;

    private final AtomicBoolean disconnected = new AtomicBoolean();

    // The following fields must be accessed only from the camera thread
    private boolean started;
    private CaptureRequest.Builder requestBuilder;
    private CameraCaptureSession currentSession;

    public CameraCapture(Options options) {
        this.explicitCameraId = options.getCameraId();
        this.cameraFacing = options.getCameraFacing();
        this.explicitSize = options.getCameraSize();
        this.aspectRatio = options.getCameraAspectRatio();
        this.fps = options.getCameraFps();
        this.highSpeed = options.getCameraHighSpeed();
        this.crop = options.getCrop();
        this.captureOrientation = options.getCaptureOrientation();
        assert captureOrientation != null;
        this.angle = options.getAngle();
        this.initialTorch = options.getCameraTorch();
        this.zoom = options.getCameraZoom();
    }

    @Override
    protected void init(VideoConstraints videoConstraints) throws ConfigurationException, IOException {
        this.videoConstraints = videoConstraints;

        cameraThread = new HandlerThread("camera");
        cameraThread.start();
        cameraHandler = new Handler(cameraThread.getLooper());
        cameraExecutor = new HandlerExecutor(cameraHandler);

        try {
            cameraId = CameraCaptureSelection.selectCamera(explicitCameraId, cameraFacing);
            if (cameraId == null) {
                throw new ConfigurationException("No matching camera found");
            }

            Ln.i("Using camera '" + cameraId + "'");
            cameraDevice = openCamera(cameraId);
        } catch (CameraAccessException | InterruptedException e) {
            throw new IOException(e);
        }
    }

    @Override
    public void prepare() throws IOException {
        try {
            int maxSize = videoConstraints.getMaxSize();
            captureSize = CameraCaptureSelection.selectSize(cameraId, explicitSize, maxSize, aspectRatio, highSpeed);
            if (captureSize == null) {
                throw new IOException("Could not select camera size");
            }
        } catch (CameraAccessException e) {
            throw new IOException(e);
        }

        VideoFilter filter = new VideoFilter(captureSize);

        if (crop != null) {
            filter.addCrop(crop, false);
        }

        if (captureOrientation != Orientation.Orient0) {
            filter.addOrientation(captureOrientation);
        }

        filter.addAngle(angle);

        transform = filter.getInverseTransform();
        videoSize = filter.getOutputSize().align(videoConstraints.getAlignment());

        if (!videoSize.equals(captureSize) && transform == null) {
            // The camera stream can only be rendered on a surface matching the input size.
            // If the video constraints change the size, an intermediate OpenGL filter is required.
            transform = AffineMatrix.IDENTITY;
        }
    }

    @TargetApi(AndroidVersions.API_30_ANDROID_11)
    @Override
    public void start(Surface surface) throws IOException {
        if (transform != null) {
            assert glRunner == null;
            OpenGLFilter glFilter = new AffineOpenGLFilter(transform);
            // The transform matrix returned by SurfaceTexture is incorrect for camera capture (it often contains an additional unexpected 90°
            // rotation). Use a vertical flip transform matrix instead.
            glRunner = new OpenGLRunner(glFilter, VFLIP_MATRIX);
            surface = glRunner.start(captureSize, videoSize, surface);
        }

        cameraHandler.post(() -> {
            assertCameraThread();
            started = true;
        });

        Surface captureSurface = surface;
        OutputConfiguration outputConfig = new OutputConfiguration(captureSurface);
        List<OutputConfiguration> outputs = Collections.singletonList(outputConfig);
        int sessionType = highSpeed ? SessionConfiguration.SESSION_HIGH_SPEED : SessionConfiguration.SESSION_REGULAR;
        SessionConfiguration sessionConfig = new SessionConfiguration(sessionType, outputs, cameraExecutor, new CameraCaptureSession.StateCallback() {
            @Override
            public void onConfigured(CameraCaptureSession session) {
                assertCameraThread();
                if (!started) {
                    // Stopped on the encoder thread between the call to start() and this callback
                    return;
                }

                CameraManager cameraManager = ServiceManager.getCameraManager();
                try {
                    CameraCharacteristics characteristics = cameraManager.getCameraCharacteristics(cameraId);
                    zoomRange = characteristics.get(CameraCharacteristics.CONTROL_ZOOM_RATIO_RANGE);
                } catch (CameraAccessException e) {
                    Ln.w("Could not get camera characteristics");
                }

                try {
                    requestBuilder = cameraDevice.createCaptureRequest(CameraDevice.TEMPLATE_RECORD);
                    requestBuilder.addTarget(captureSurface);

                    if (fps > 0) {
                        requestBuilder.set(CaptureRequest.CONTROL_AE_TARGET_FPS_RANGE, new Range<>(fps, fps));
                    }
                    if (initialTorch) {
                        Ln.i("Turn camera torch on");
                        requestBuilder.set(CaptureRequest.FLASH_MODE, CaptureRequest.FLASH_MODE_TORCH);
                    }
                    if (zoom != 1) {
                        zoom = clampZoom(zoom);
                        Ln.i("Set camera zoom: " + zoom);
                        requestBuilder.set(CaptureRequest.CONTROL_ZOOM_RATIO, zoom);
                    }

                    CaptureRequest request = requestBuilder.build();
                    setRepeatingRequest(session, request);
                    currentSession = session;
                } catch (CameraAccessException e) {
                    Ln.e("Camera error", e);
                    disconnected.set(true);
                    getCaptureControl().reset(CaptureControl.RESET_REASON_TERMINATED);
                }
            }

            @Override
            public void onConfigureFailed(CameraCaptureSession session) {
                Ln.e("Camera configuration error");
                disconnected.set(true);
                getCaptureControl().reset(CaptureControl.RESET_REASON_TERMINATED);
            }
        });

        try {
            cameraDevice.createCaptureSession(sessionConfig);
        } catch (CameraAccessException e) {
            stop();
            throw new IOException(e);
        }
    }

    @Override
    public void stop() {
        cameraHandler.post(() -> {
            assertCameraThread();
            if (currentSession != null) {
                try {
                    currentSession.stopRepeating();
                } catch (CameraAccessException | IllegalStateException e) {
                    // The session may already be closed (for example if the camera has been disconnected)
                    Ln.d("Could not stop repeating capture request: " + e.getMessage());
                }
            }
            currentSession = null;
            requestBuilder = null;
            started = false;
        });

        if (glRunner != null) {
            glRunner.stopAndRelease();
            glRunner = null;
        }
    }

    @Override
    public void release() {
        if (cameraDevice != null) {
            cameraDevice.close();
        }
        if (cameraThread != null) {
            cameraThread.quitSafely();
        }
    }

    @Override
    public Size getSize() {
        return videoSize;
    }

    @Override
    protected boolean applyNewVideoConstraints(VideoConstraints videoConstraints) {
        if (explicitSize != null) {
            return false;
        }

        this.videoConstraints = videoConstraints;
        return true;
    }

    @SuppressLint("MissingPermission")
    @TargetApi(AndroidVersions.API_31_ANDROID_12)
    private CameraDevice openCamera(String id) throws CameraAccessException, InterruptedException {
        CompletableFuture<CameraDevice> future = new CompletableFuture<>();
        ServiceManager.getCameraManager().openCamera(id, new CameraDevice.StateCallback() {
            @Override
            public void onOpened(CameraDevice camera) {
                Ln.d("Camera opened successfully");
                future.complete(camera);
            }

            @Override
            public void onDisconnected(CameraDevice camera) {
                Ln.w("Camera disconnected");
                disconnected.set(true);
                getCaptureControl().reset(CaptureControl.RESET_REASON_TERMINATED);
            }

            @Override
            public void onError(CameraDevice camera, int error) {
                int cameraAccessExceptionErrorCode;
                switch (error) {
                    case CameraDevice.StateCallback.ERROR_CAMERA_IN_USE:
                        cameraAccessExceptionErrorCode = CameraAccessException.CAMERA_IN_USE;
                        break;
                    case CameraDevice.StateCallback.ERROR_MAX_CAMERAS_IN_USE:
                        cameraAccessExceptionErrorCode = CameraAccessException.MAX_CAMERAS_IN_USE;
                        break;
                    case CameraDevice.StateCallback.ERROR_CAMERA_DISABLED:
                        cameraAccessExceptionErrorCode = CameraAccessException.CAMERA_DISABLED;
                        break;
                    case CameraDevice.StateCallback.ERROR_CAMERA_DEVICE:
                    case CameraDevice.StateCallback.ERROR_CAMERA_SERVICE:
                    default:
                        cameraAccessExceptionErrorCode = CameraAccessException.CAMERA_ERROR;
                        break;
                }
                future.completeExceptionally(new CameraAccessException(cameraAccessExceptionErrorCode));
            }
        }, cameraHandler);

        try {
            return future.get();
        } catch (ExecutionException e) {
            throw (CameraAccessException) e.getCause();
        }
    }

    @TargetApi(AndroidVersions.API_31_ANDROID_12)
    private void setRepeatingRequest(CameraCaptureSession session, CaptureRequest request) throws CameraAccessException {
        CameraCaptureSession.CaptureCallback callback = new CameraCaptureSession.CaptureCallback() {
            @Override
            public void onCaptureStarted(CameraCaptureSession session, CaptureRequest request, long timestamp, long frameNumber) {
                // Called for each frame captured, do nothing
            }

            @Override
            public void onCaptureFailed(CameraCaptureSession session, CaptureRequest request, CaptureFailure failure) {
                Ln.w("Camera capture failed: frame " + failure.getFrameNumber());
            }
        };

        if (highSpeed) {
            CameraConstrainedHighSpeedCaptureSession highSpeedSession = (CameraConstrainedHighSpeedCaptureSession) session;
            List<CaptureRequest> requests = highSpeedSession.createHighSpeedRequestList(request);
            highSpeedSession.setRepeatingBurst(requests, callback, cameraHandler);
        } else {
            session.setRepeatingRequest(request, callback, cameraHandler);
        }
    }

    @Override
    public boolean isClosed() {
        return disconnected.get();
    }

    public void setTorchEnabled(boolean enabled) {
        cameraHandler.post(() -> {
            assertCameraThread();
            if (currentSession != null && requestBuilder != null) {
                try {
                    Ln.i("Turn camera torch " + (enabled ? "on" : "off"));
                    requestBuilder.set(CaptureRequest.FLASH_MODE, enabled ? CaptureRequest.FLASH_MODE_TORCH : CaptureRequest.FLASH_MODE_OFF);
                    CaptureRequest request = requestBuilder.build();
                    setRepeatingRequest(currentSession, request);
                } catch (CameraAccessException e) {
                    Ln.e("Camera error", e);
                }
            }
        });
    }

    @TargetApi(AndroidVersions.API_30_ANDROID_11)
    private void zoom(boolean in) {
        cameraHandler.post(() -> {
            assertCameraThread();
            if (currentSession != null && requestBuilder != null) {
                // Always align to log values
                double z = Math.round(Math.log(zoom) / Math.log(ZOOM_FACTOR));
                double dir = in ? 1 : -1;
                zoom = (float) Math.pow(ZOOM_FACTOR, z + dir);

                try {
                    zoom = clampZoom(zoom);
                    Ln.i("Set camera zoom: " + zoom);
                    requestBuilder.set(CaptureRequest.CONTROL_ZOOM_RATIO, zoom);
                    CaptureRequest request = requestBuilder.build();
                    setRepeatingRequest(currentSession, request);
                } catch (CameraAccessException e) {
                    Ln.e("Camera error", e);
                }
            }
        });
    }

    public void zoomIn() {
        zoom(true);
    }

    public void zoomOut() {
        zoom(false);
    }

    private float clampZoom(float value) {
        assertCameraThread();
        if (zoomRange == null) {
            return value;
        }

        return zoomRange.clamp(value);
    }

    private void assertCameraThread() {
        assert Thread.currentThread() == cameraThread;
    }
}
