package com.yiyi.cloud_phone.cast;

import android.content.Context;
import android.graphics.SurfaceTexture;
import android.os.Handler;
import android.os.Looper;
import android.view.Surface;
import android.view.TextureView;

import com.yiyi.cloud_phone.DeviceCastApi;
import com.yiyi.cloud_phone.multiapp.MultiAppWindowState;
import com.yiyi.cloud_phone.workspace.MultiAppCastOptions;

import org.json.JSONObject;

import java.net.CookieHandler;
import java.net.CookieManager;

import okhttp3.JavaNetCookieJar;
import okhttp3.OkHttpClient;

public final class MultiAppWindowCastSession {
    public interface Callback {
        void onReady();

        void onError(String message);

        void onVdError(String detail);

        void onReconnecting();
    }

    private final Context context;
    private final String serial;
    private final int deviceSdk;
    private final Handler mainHandler = new Handler(Looper.getMainLooper());
    private final AnnexBH264Decoder decoder = new AnnexBH264Decoder();
    private final CastWebSocketSession webSocketSession = new CastWebSocketSession(decoder);

    private TextureView textureView;
    private Callback callback;
    private OkHttpClient httpClient;
    private MultiAppWindowState window;
    private boolean surfaceReady;
    private boolean started;
    private boolean ready;
    private boolean backendHeld;
    private JSONObject backendPayload;
    private byte[] pendingStreamParams;
    private int videoWidth;
    private int videoHeight;
    private int reconnectAttempts;
    private boolean vdErrorShown;
    private Runnable reconnectRunnable;
    private int targetMaxFps = MultiAppCastOptions.FOCUSED_MAX_FPS;
    private int appliedMaxFps = -1;

    public MultiAppWindowCastSession(Context context, String serial, int deviceSdk) {
        this.context = context.getApplicationContext();
        this.serial = serial;
        this.deviceSdk = deviceSdk;
        CookieHandler handler = CookieHandler.getDefault();
        OkHttpClient.Builder builder = new OkHttpClient.Builder();
        if (handler instanceof CookieManager) {
            builder.cookieJar(new JavaNetCookieJar((CookieManager) handler));
        }
        httpClient = builder.build();
        decoder.setListener(new AnnexBH264Decoder.Listener() {
            @Override
            public void onVideoFrameSize(int width, int height) {
                videoWidth = width;
                videoHeight = height;
                mainHandler.post(() -> {
                    if (textureView != null) {
                        textureView.setVisibility(android.view.View.VISIBLE);
                    }
                });
            }

            @Override
            public void onFrameRendered() {
                mainHandler.post(() -> {
                    ready = true;
                    if (appliedMaxFps < 0) {
                        appliedMaxFps = targetMaxFps;
                    }
                    if (callback != null) {
                        callback.onReady();
                    }
                });
            }
        });
    }

    public void attach(TextureView view, Callback callback) {
        this.textureView = view;
        this.callback = callback;
        view.setSurfaceTextureListener(new TextureView.SurfaceTextureListener() {
            @Override
            public void onSurfaceTextureAvailable(SurfaceTexture surface, int width, int height) {
                surfaceReady = true;
                decoder.attachSurface(new Surface(surface), surface);
                maybeConnect();
            }

            @Override
            public void onSurfaceTextureSizeChanged(SurfaceTexture surface, int width, int height) {
            }

            @Override
            public boolean onSurfaceTextureDestroyed(SurfaceTexture surface) {
                surfaceReady = false;
                decoder.attachSurface(null, null);
                return true;
            }

            @Override
            public void onSurfaceTextureUpdated(SurfaceTexture surface) {
            }
        });
    }

    public void start(MultiAppWindowState win) {
        start(win, MultiAppCastOptions.FOCUSED_MAX_FPS);
    }

    public void start(MultiAppWindowState win, int maxFps) {
        if (started && window != null && window.id.equals(win.id)) {
            applyMaxFps(maxFps);
            return;
        }
        window = win;
        targetMaxFps = Math.max(1, maxFps);
        appliedMaxFps = -1;
        startInternal(false);
    }

    public void applyMaxFps(int maxFps) {
        int next = Math.max(1, maxFps);
        targetMaxFps = next;
        if (!ready || window == null || appliedMaxFps == next) {
            return;
        }
        try {
            MultiAppWindowState win = window;
            byte[] params = MultiAppCastOptions.buildStreamParams(
                    win.packageName, win.vdWidth, win.vdHeight, win.vdDpi, deviceSdk, next
            );
            webSocketSession.sendControl(params);
            appliedMaxFps = next;
        } catch (Exception ignored) {
            // keep previous appliedMaxFps; retry on next focus sync
        }
    }

    public void restart(boolean keepBackend) {
        stopWindowCast(!keepBackend);
        vdErrorShown = false;
        reconnectAttempts = 0;
        startInternal(keepBackend);
    }

    public void stop(boolean releaseBackend) {
        cancelReconnect();
        stopWindowCast(releaseBackend);
        decoder.release();
    }

    public void sendResizeDisplay(int width, int height) {
        byte[] payload = ScrcpyControlWire.resizeDisplay(width, height);
        webSocketSession.sendControl(payload);
    }

    public void sendTouch(int action, float x, float y, int viewW, int viewH) {
        if (videoWidth <= 0 || videoHeight <= 0 || viewW <= 0 || viewH <= 0) {
            return;
        }
        float mappedX = x / viewW * videoWidth;
        float mappedY = y / viewH * videoHeight;
        byte[] payload = ScrcpyControlWire.injectTouch(action, mappedX, mappedY, videoWidth, videoHeight);
        webSocketSession.sendControl(payload);
    }

    public void sendBack() {
        byte[] payload = ScrcpyControlWire.navigationTap("back");
        if (payload != null) {
            webSocketSession.sendControl(payload);
        }
    }

    public boolean isReady() {
        return ready;
    }

    private void startInternal(boolean keepBackend) {
        if (window == null) {
            return;
        }
        started = true;
        ready = false;
        Thread worker = new Thread(() -> {
            try {
                MultiAppWindowState win = window;
                int maxFps = Math.max(1, targetMaxFps);
                byte[] streamParams = MultiAppCastOptions.buildStreamParams(
                        win.packageName, win.vdWidth, win.vdHeight, win.vdDpi, deviceSdk, maxFps
                );
                JSONObject payload;
                if (keepBackend && backendHeld && backendPayload != null && backendPayload.optBoolean("success", false)) {
                    payload = backendPayload;
                } else {
                    JSONObject mirrorPayload = MultiAppCastOptions.buildPayload(
                            win.packageName, win.vdWidth, win.vdHeight, win.vdDpi, deviceSdk, maxFps
                    );
                    JSONObject session = DeviceCastApi.startCast(
                            context,
                            CastServerConfig.host(context),
                            CastServerConfig.port(context),
                            serial,
                            mirrorPayload
                    );
                    if (!session.optBoolean("success", false)) {
                        throw new Exception(session.optString("message", "cast_start_failed"));
                    }
                    payload = session;
                    backendPayload = payload;
                    backendHeld = true;
                }
                pendingStreamParams = streamParams;
                mainHandler.post(this::maybeConnect);
            } catch (Exception error) {
                String message = error.getMessage() == null ? "cast_start_failed" : error.getMessage();
                mainHandler.post(() -> presentError(message));
            }
        }, "multi-app-cast");
        worker.start();
    }

    private void stopWindowCast(boolean releaseBackend) {
        webSocketSession.close();
        started = false;
        ready = false;
        appliedMaxFps = -1;
        pendingStreamParams = null;
        if (releaseBackend && backendHeld) {
            backendHeld = false;
            backendPayload = null;
            CastSessionController.stop(
                    context,
                    CastServerConfig.host(context),
                    CastServerConfig.port(context),
                    serial
            );
        }
    }

    private void maybeConnect() {
        if (!surfaceReady || pendingStreamParams == null || !started) {
            return;
        }
        byte[] params = pendingStreamParams;
        pendingStreamParams = null;
        CastConnectCoordinator.openStream(
                httpClient,
                webSocketSession,
                CastServerConfig.host(context),
                CastServerConfig.port(context),
                serial,
                params,
                new CastConnectCoordinator.Host() {
                    @Override
                    public void onBackendStarted(JSONObject sessionPayload, byte[] streamParams) {
                    }

                    @Override
                    public void onWebSocketOpen() {
                    }

                    @Override
                    public void onInitialInfo() {
                    }

                    @Override
                    public void onStreamError(String message) {
                        mainHandler.post(() -> handleStreamError(message));
                    }
                }
        );
    }

    private void handleStreamError(String message) {
        if (vdErrorShown) {
            return;
        }
        if (CastVdErrorHelper.isVirtualDisplayError(message)) {
            vdErrorShown = true;
            if (callback != null) {
                callback.onVdError(CastVdErrorHelper.formatUserMessage(message));
            }
            return;
        }
        if (started && ready) {
            scheduleReconnect(message);
            return;
        }
        presentError(message);
    }

    private void scheduleReconnect(String reason) {
        if (reconnectRunnable != null || vdErrorShown) {
            return;
        }
        if (reconnectAttempts >= 3) {
            presentError(reason == null ? "画面中断，重连失败" : reason);
            return;
        }
        reconnectAttempts += 1;
        if (callback != null) {
            callback.onReconnecting();
        }
        reconnectRunnable = () -> {
            reconnectRunnable = null;
            stopWindowCast(false);
            startInternal(true);
        };
        mainHandler.postDelayed(reconnectRunnable, 400L);
    }

    private void cancelReconnect() {
        if (reconnectRunnable != null) {
            mainHandler.removeCallbacks(reconnectRunnable);
            reconnectRunnable = null;
        }
    }

    private void presentError(String message) {
        ready = false;
        if (CastVdErrorHelper.isVirtualDisplayError(message)) {
            vdErrorShown = true;
            if (callback != null) {
                callback.onVdError(CastVdErrorHelper.formatUserMessage(message));
            }
            return;
        }
        if (callback != null) {
            callback.onError(message == null || message.isEmpty() ? "投屏启动失败" : message);
        }
    }
}
