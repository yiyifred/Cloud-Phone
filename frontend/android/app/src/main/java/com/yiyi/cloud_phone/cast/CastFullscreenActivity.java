package com.yiyi.cloud_phone.cast;

import android.app.Activity;
import android.content.Context;
import android.content.Intent;
import android.graphics.SurfaceTexture;
import android.os.Bundle;
import android.view.Surface;
import android.view.TextureView;
import android.view.View;
import android.widget.FrameLayout;
import android.widget.ImageButton;
import android.widget.LinearLayout;
import android.widget.TextView;
import android.widget.Toast;

import androidx.annotation.Nullable;
import androidx.appcompat.app.AppCompatActivity;

import com.yiyi.cloud_phone.DeviceWorkspaceActivity;
import com.yiyi.cloud_phone.R;
import com.yiyi.cloud_phone.workspace.CastMode;
import com.yiyi.cloud_phone.workspace.CastSettingsStore;

import org.json.JSONObject;

import java.net.CookieHandler;
import java.net.CookieManager;

import okhttp3.JavaNetCookieJar;
import okhttp3.OkHttpClient;

public class CastFullscreenActivity extends AppCompatActivity implements CastChromeController.Host {
    public static final String EXTRA_SERIAL = DeviceWorkspaceActivity.EXTRA_SERIAL;
    public static final String EXTRA_DISPLAY_NAME = DeviceWorkspaceActivity.EXTRA_DISPLAY_NAME;
    public static final String EXTRA_SDK = DeviceWorkspaceActivity.EXTRA_SDK;
    public static final String EXTRA_CAST_MODE = "cast_mode";

    interface ToolbarHandler {
        void onStopRequested();

        void onRotateRequested();
    }

    private String deviceSerial = "";
    private String deviceDisplayName = "";
    private int deviceSdk;
    private CastMode castMode = CastMode.MIRROR;
    private JSONObject settings;

    private TextureView textureView;
    private View loadingOverlay;
    private View errorOverlay;
    private View chromeLayer;
    private TextView errorText;
    private TextView statusText;
    private View liveDot;
    private View screenshotFlash;
    private FrameLayout rootLayout;

    private final AnnexBH264Decoder decoder = new AnnexBH264Decoder();
    private CastWebSocketSession webSocketSession;
    private CastInteractionController interactionController;
    private CastChromeController chromeController;
    private OkHttpClient httpClient;
    private byte[] pendingStreamParams;
    private boolean surfaceReady;
    private boolean backendActive;
    private boolean streamReady;
    private int videoWidth;
    private int videoHeight;
    private int previewRotation;

    public static void open(
            Context context,
            String serial,
            String displayName,
            int deviceSdk,
            CastMode mode
    ) {
        Intent intent = new Intent(context, CastFullscreenActivity.class);
        intent.putExtra(EXTRA_SERIAL, serial);
        intent.putExtra(EXTRA_DISPLAY_NAME, displayName);
        intent.putExtra(EXTRA_SDK, deviceSdk);
        intent.putExtra(EXTRA_CAST_MODE, mode.name());
        if (context instanceof Activity) {
            CastMotion.openCast((Activity) context, intent);
        } else {
            context.startActivity(intent);
        }
    }

    @Override
    public View getChromeRoot() {
        return chromeLayer;
    }

    @Override
    public void setChromeVisible(boolean visible) {
        if (chromeLayer != null) {
            chromeLayer.setVisibility(visible ? View.VISIBLE : View.GONE);
        }
    }

    @Override
    protected void onCreate(@Nullable Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        CastFullscreenUi.apply(this);
        setContentView(R.layout.activity_cast_fullscreen);
        readExtras();
        setupHttpClient();
        bindViews();
        loadSettings();
        setupDecoder();
        requestCastStart();
    }

    private void readExtras() {
        Intent intent = getIntent();
        deviceSerial = intent.getStringExtra(EXTRA_SERIAL);
        if (deviceSerial == null) {
            deviceSerial = "";
        }
        deviceDisplayName = intent.getStringExtra(EXTRA_DISPLAY_NAME);
        if (deviceDisplayName == null || deviceDisplayName.isEmpty()) {
            deviceDisplayName = deviceSerial;
        }
        deviceSdk = intent.getIntExtra(EXTRA_SDK, 0);
        String modeRaw = intent.getStringExtra(EXTRA_CAST_MODE);
        castMode = CastMode.CAMERA.name().equals(modeRaw) ? CastMode.CAMERA : CastMode.MIRROR;
    }

    private void bindViews() {
        rootLayout = findViewById(R.id.castRoot);
        textureView = findViewById(R.id.castTexture);
        loadingOverlay = findViewById(R.id.castOverlayLoading);
        errorOverlay = findViewById(R.id.castOverlayError);
        chromeLayer = findViewById(R.id.castChrome);
        errorText = findViewById(R.id.castErrorText);
        statusText = findViewById(R.id.castStatusText);
        liveDot = findViewById(R.id.castLiveDot);
        screenshotFlash = findViewById(R.id.castScreenshotFlash);
        TextView deviceNameView = findViewById(R.id.castDeviceName);
        deviceNameView.setText(deviceDisplayName);

        chromeController = new CastChromeController(this);
        textureView.setOnClickListener(v -> chromeController.toggleChrome());

        ImageButton exitButton = findViewById(R.id.castButtonExit);
        exitButton.setImageDrawable(CastUiIcons.back(this));
        exitButton.setOnClickListener(v -> stopCastAndFinish());
        findViewById(R.id.castErrorClose).setOnClickListener(v -> stopCastAndFinish());

        interactionController = new CastInteractionController(
                this,
                castMode,
                new CastInteractionController.TextureHolder() {
                    @Override
                    public View getTouchTarget() {
                        return textureView;
                    }

                    @Override
                    public int getWidth() {
                        return textureView.getWidth();
                    }

                    @Override
                    public int getHeight() {
                        return textureView.getHeight();
                    }
                },
                webSocketSession,
                new ToolbarHandler() {
                    @Override
                    public void onStopRequested() {
                        stopCastAndFinish();
                    }

                    @Override
                    public void onRotateRequested() {
                        previewRotation = (previewRotation + 90) % 360;
                        interactionController.setPreviewRotation(previewRotation);
                        applyLetterbox();
                    }
                },
                chromeController,
                screenshotFlash
        );
        interactionController.bind(findViewById(R.id.castToolbar));
        interactionController.setInteractionEnabled(castMode != CastMode.CAMERA);
        setupTextureView();
    }

    private void loadSettings() {
        if (castMode == CastMode.CAMERA) {
            settings = CastSettingsStore.loadCamera(this, deviceSerial);
            previewRotation = 0;
        } else {
            settings = CastSettingsStore.loadMirror(this, deviceSerial);
            JSONObject video = settings.optJSONObject("video");
            previewRotation = video == null ? 0 : video.optInt("rotationDeg", 0);
        }
        interactionController.setPreviewRotation(previewRotation);
    }

    private void setupHttpClient() {
        CookieHandler handler = CookieHandler.getDefault();
        OkHttpClient.Builder builder = new OkHttpClient.Builder();
        if (handler instanceof CookieManager) {
            builder.cookieJar(new JavaNetCookieJar((CookieManager) handler));
        }
        httpClient = builder.build();
        webSocketSession = new CastWebSocketSession(decoder);
    }

    private void setupDecoder() {
        decoder.setListener(new AnnexBH264Decoder.Listener() {
            @Override
            public void onVideoFrameSize(int width, int height) {
                runOnUiThread(() -> {
                    videoWidth = width;
                    videoHeight = height;
                    interactionController.setVideoSize(width, height);
                    applyLetterbox();
                });
            }

            @Override
            public void onFrameRendered() {
                runOnUiThread(() -> onStreamReady());
            }
        });
    }

    private void setupTextureView() {
        textureView.setSurfaceTextureListener(new TextureView.SurfaceTextureListener() {
            @Override
            public void onSurfaceTextureAvailable(SurfaceTexture surface, int width, int height) {
                surfaceReady = true;
                surface.setDefaultBufferSize(Math.max(width, 1), Math.max(height, 1));
                decoder.attachSurface(new Surface(surface), surface);
                maybeConnectWebSocket();
            }

            @Override
            public void onSurfaceTextureSizeChanged(SurfaceTexture surface, int width, int height) {
                applyLetterbox();
            }

            @Override
            public boolean onSurfaceTextureDestroyed(SurfaceTexture surface) {
                surfaceReady = false;
                decoder.attachSurface(null, null);
                return true;
            }

            @Override
            public void onSurfaceTextureUpdated(SurfaceTexture surface) {
                // no-op
            }
        });
    }

    private void requestCastStart() {
        loadingOverlay.setVisibility(View.VISIBLE);
        errorOverlay.setVisibility(View.GONE);
        updateStatus(R.string.cast_starting);
        CastConnectCoordinator.startBackend(
                this,
                CastServerConfig.host(this),
                CastServerConfig.port(this),
                deviceSerial,
                castMode,
                settings,
                deviceSdk,
                new CastConnectCoordinator.Host() {
                    @Override
                    public void onBackendStarted(byte[] streamParams) {
                        runOnUiThread(() -> {
                            backendActive = true;
                            pendingStreamParams = streamParams;
                            updateStatus(R.string.cast_connecting);
                            maybeConnectWebSocket();
                        });
                    }

                    @Override
                    public void onStreamReady() {
                        runOnUiThread(CastFullscreenActivity.this::onStreamReady);
                    }

                    @Override
                    public void onStreamError(String message) {
                        runOnUiThread(() -> showError(resolveErrorMessage(message)));
                    }
                }
        );
    }

    private void maybeConnectWebSocket() {
        if (!surfaceReady || pendingStreamParams == null) {
            return;
        }
        byte[] streamParams = pendingStreamParams;
        pendingStreamParams = null;
        CastConnectCoordinator.openStream(
                httpClient,
                webSocketSession,
                CastServerConfig.host(this),
                CastServerConfig.port(this),
                deviceSerial,
                streamParams,
                new CastConnectCoordinator.Host() {
                    @Override
                    public void onBackendStarted(byte[] streamParams) {
                        // no-op
                    }

                    @Override
                    public void onStreamReady() {
                        CastFullscreenActivity.this.onStreamReady();
                    }

                    @Override
                    public void onStreamError(String message) {
                        showError(resolveErrorMessage(message));
                    }
                }
        );
    }

    private void onStreamReady() {
        if (streamReady) {
            return;
        }
        streamReady = true;
        CastMotion.fadeOut(loadingOverlay, null);
        updateStatus(R.string.cast_streaming);
        chromeController.setStreaming(true);
        CastMotion.pulseLiveDot(liveDot);
    }

    private void applyLetterbox() {
        CastSurfaceLayout.applyLetterbox(rootLayout, textureView, videoWidth, videoHeight, previewRotation);
    }

    private void updateStatus(int textRes) {
        if (statusText != null) {
            statusText.setText(textRes);
        }
    }

    private String resolveErrorMessage(String message) {
        if ("websocket_unauthorized".equals(message)) {
            return getString(R.string.cast_unauthorized);
        }
        if (message == null || message.isEmpty()) {
            return getString(R.string.cast_start_failed);
        }
        return message;
    }

    private void showError(String message) {
        loadingOverlay.setVisibility(View.GONE);
        errorOverlay.setVisibility(View.VISIBLE);
        errorText.setText(message);
        updateStatus(R.string.cast_start_failed);
        chromeController.setStreaming(false);
        Toast.makeText(this, message, Toast.LENGTH_SHORT).show();
    }

    private void stopCastAndFinish() {
        chromeController.release();
        webSocketSession.close();
        decoder.release();
        if (backendActive) {
            CastSessionController.stop(
                    this,
                    CastServerConfig.host(this),
                    CastServerConfig.port(this),
                    deviceSerial
            );
            backendActive = false;
        }
        CastMotion.closeCast(this);
    }

    @Override
    public void onBackPressed() {
        stopCastAndFinish();
    }

    @Override
    protected void onDestroy() {
        chromeController.release();
        webSocketSession.close();
        decoder.release();
        super.onDestroy();
    }
}
