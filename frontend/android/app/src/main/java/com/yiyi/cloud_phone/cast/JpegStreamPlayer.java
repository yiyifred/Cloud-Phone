package com.yiyi.cloud_phone.cast;

import android.graphics.Bitmap;
import android.graphics.BitmapFactory;
import android.os.Handler;
import android.os.Looper;
import android.view.TextureView;
import android.graphics.Canvas;
import android.graphics.Matrix;

import okhttp3.OkHttpClient;
import okhttp3.Request;
import okhttp3.WebSocket;
import okhttp3.WebSocketListener;
import okio.ByteString;

import org.json.JSONObject;

/**
 * JPEG frame stream player for iOS (MJPEG) and HarmonyOS (JPEG) cast protocols.
 * Receives JPEG frames over WebSocket and renders them to a TextureView.
 */
public class JpegStreamPlayer {
    public interface Callback {
        void onConnected();
        void onFirstFrame(int width, int height);
        void onError(String error);
        void onClosed();
    }

    private static final OkHttpClient client = new OkHttpClient();
    private final Handler mainHandler = new Handler(Looper.getMainLooper());

    private WebSocket ws;
    private TextureView textureView;
    private Callback callback;
    private boolean firstFrameReceived;
    private int videoWidth;
    private int videoHeight;

    public void attach(TextureView view) {
        this.textureView = view;
    }

    public void connect(String host, int port, String serial, String protocol, JSONObject options, Callback callback) {
        this.callback = callback;
        firstFrameReceived = false;

        String encodedSerial;
        try {
            encodedSerial = java.net.URLEncoder.encode(serial, "UTF-8").replace("+", "%20");
        } catch (Exception e) {
            encodedSerial = serial;
        }

        String url = ServerUrl.wsUrl(host, port, "/api/devices/" + encodedSerial + "/cast/ws");
        Request.Builder builder = new Request.Builder().url(url);
        com.yiyi.cloud_phone.SessionCookieHelper.attach(builder, host, port);
        Request request = builder.build();

        ws = client.newWebSocket(request, new WebSocketListener() {
            @Override
            public void onOpen(WebSocket webSocket, okhttp3.Response response) {
                try {
                    JSONObject params = new JSONObject();
                    params.put("protocol", protocol);
                    if (options != null) {
                        java.util.Iterator<String> keys = options.keys();
                        while (keys.hasNext()) {
                            String key = keys.next();
                            params.put(key, options.get(key));
                        }
                    }
                    webSocket.send(params.toString());
                } catch (Exception ignored) {
                }
                mainHandler.post(() -> {
                    if (callback != null) callback.onConnected();
                });
            }

            @Override
            public void onMessage(WebSocket webSocket, ByteString bytes) {
                byte[] data = bytes.toByteArray();
                Bitmap bmp = BitmapFactory.decodeByteArray(data, 0, data.length);
                if (bmp != null) {
                    mainHandler.post(() -> renderFrame(bmp));
                }
            }

            @Override
            public void onClosed(WebSocket webSocket, int code, String reason) {
                mainHandler.post(() -> {
                    if (callback != null) callback.onClosed();
                });
            }

            @Override
            public void onFailure(WebSocket webSocket, Throwable t, okhttp3.Response response) {
                mainHandler.post(() -> {
                    if (callback != null) callback.onError(t.getMessage() != null ? t.getMessage() : "Connection failed");
                });
            }
        });
    }

    private void renderFrame(Bitmap bmp) {
        if (textureView == null || !textureView.isAvailable()) {
            bmp.recycle();
            return;
        }

        if (!firstFrameReceived) {
            firstFrameReceived = true;
            videoWidth = bmp.getWidth();
            videoHeight = bmp.getHeight();
            if (callback != null) callback.onFirstFrame(videoWidth, videoHeight);
        }

        Canvas canvas = textureView.lockCanvas();
        if (canvas != null) {
            canvas.drawColor(android.graphics.Color.BLACK);
            float scaleX = (float) canvas.getWidth() / bmp.getWidth();
            float scaleY = (float) canvas.getHeight() / bmp.getHeight();
            float scale = Math.min(scaleX, scaleY);
            float dx = (canvas.getWidth() - bmp.getWidth() * scale) / 2f;
            float dy = (canvas.getHeight() - bmp.getHeight() * scale) / 2f;
            Matrix matrix = new Matrix();
            matrix.setScale(scale, scale);
            matrix.postTranslate(dx, dy);
            canvas.drawBitmap(bmp, matrix, null);
            textureView.unlockCanvasAndPost(canvas);
        }
        bmp.recycle();
    }

    public void sendTouch(String type, float x, float y) {
        if (ws != null) {
            try {
                JSONObject msg = new JSONObject();
                msg.put("type", type);
                msg.put("x", x);
                msg.put("y", y);
                ws.send(msg.toString());
            } catch (Exception ignored) {
            }
        }
    }

    public void sendNavigation(String actionId) {
        if (ws != null) {
            try {
                JSONObject msg = new JSONObject();
                msg.put("type", "navigation");
                msg.put("actionId", actionId);
                ws.send(msg.toString());
            } catch (Exception ignored) {
            }
        }
    }

    public void close() {
        if (ws != null) {
            ws.close(1000, "close");
            ws = null;
        }
    }
}
