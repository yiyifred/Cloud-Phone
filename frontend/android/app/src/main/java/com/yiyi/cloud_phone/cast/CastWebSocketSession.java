package com.yiyi.cloud_phone.cast;

import android.net.Uri;
import android.os.Handler;
import android.os.Looper;

import java.net.CookieHandler;
import java.net.CookieManager;
import java.net.HttpCookie;
import java.net.URI;
import java.util.List;
import java.util.concurrent.atomic.AtomicBoolean;

final class CastWebSocketSession {
    interface Listener {
        void onOpen();

        void onStreamReady();

        void onClosed(String reason);

        void onFailure(String message);
    }

    private static final byte[] MAGIC_INITIAL = "scrcpy_initial".getBytes();
    private static final byte[] MAGIC_MESSAGE = "scrcpy_message".getBytes();
    private static final byte[] MAGIC_AUDIO = "scrcpy_audio".getBytes();

    private final Handler mainHandler = new Handler(Looper.getMainLooper());
    private final AnnexBH264Decoder decoder;
    private okhttp3.WebSocket socket;
    private Listener listener;
    private final AtomicBoolean streamReadySent = new AtomicBoolean(false);

    CastWebSocketSession(AnnexBH264Decoder decoder) {
        this.decoder = decoder;
    }

    static String buildUrl(String host, int port, String serial) {
        return "ws://" + host + ":" + port + "/api/devices/" + Uri.encode(serial) + "/cast/ws";
    }

    void connect(
            okhttp3.OkHttpClient client,
            String host,
            int port,
            String url,
            byte[] streamParams,
            Listener listener
    ) {
        closeQuietly();
        this.listener = listener;
        streamReadySent.set(false);
        okhttp3.Request.Builder builder = new okhttp3.Request.Builder().url(url);
        attachSessionCookie(builder, host, port);
        socket = client.newWebSocket(builder.build(), new okhttp3.WebSocketListener() {
            @Override
            public void onOpen(okhttp3.WebSocket webSocket, okhttp3.Response response) {
                webSocket.send(okio.ByteString.of(streamParams));
                notifyOpen();
            }

            @Override
            public void onMessage(okhttp3.WebSocket webSocket, okio.ByteString bytes) {
                handleBinary(bytes.toByteArray());
            }

            @Override
            public void onClosing(okhttp3.WebSocket webSocket, int code, String reason) {
                webSocket.close(code, reason);
            }

            @Override
            public void onClosed(okhttp3.WebSocket webSocket, int code, String reason) {
                notifyClosed(reason == null ? "closed" : reason);
            }

            @Override
            public void onFailure(okhttp3.WebSocket webSocket, Throwable t, okhttp3.Response response) {
                String message = "websocket_failed";
                if (response != null && response.code() == 401) {
                    message = "websocket_unauthorized";
                } else if (t != null && t.getMessage() != null) {
                    message = t.getMessage();
                }
                notifyFailure(message);
            }
        });
    }

    void sendControl(byte[] payload) {
        if (socket == null || payload == null || payload.length == 0) {
            return;
        }
        socket.send(okio.ByteString.of(payload));
    }

    void close() {
        closeQuietly();
    }

    private static void attachSessionCookie(okhttp3.Request.Builder builder, String host, int port) {
        CookieHandler handler = CookieHandler.getDefault();
        if (!(handler instanceof CookieManager)) {
            return;
        }
        CookieManager manager = (CookieManager) handler;
        try {
            URI uri = URI.create("http://" + host + ":" + port + "/");
            List<HttpCookie> cookies = manager.getCookieStore().get(uri);
            if (cookies == null || cookies.isEmpty()) {
                return;
            }
            StringBuilder cookieHeader = new StringBuilder();
            for (int index = 0; index < cookies.size(); index += 1) {
                if (index > 0) {
                    cookieHeader.append("; ");
                }
                HttpCookie cookie = cookies.get(index);
                cookieHeader.append(cookie.getName()).append('=').append(cookie.getValue());
            }
            builder.header("Cookie", cookieHeader.toString());
        } catch (Exception ignored) {
            // ignore cookie attach failures
        }
    }

    private void handleBinary(byte[] bytes) {
        if (startsWithMagic(bytes, MAGIC_INITIAL)) {
            notifyStreamReadyOnce();
            return;
        }
        if (startsWithMagic(bytes, MAGIC_MESSAGE) || startsWithMagic(bytes, MAGIC_AUDIO)) {
            return;
        }
        decoder.pushFrame(bytes);
    }

    private void notifyStreamReadyOnce() {
        if (!streamReadySent.compareAndSet(false, true)) {
            return;
        }
        mainHandler.post(() -> {
            if (listener != null) {
                listener.onStreamReady();
            }
        });
    }

    private static boolean startsWithMagic(byte[] bytes, byte[] magic) {
        if (bytes.length < magic.length) {
            return false;
        }
        for (int index = 0; index < magic.length; index += 1) {
            if (bytes[index] != magic[index]) {
                return false;
            }
        }
        return true;
    }

    private void closeQuietly() {
        if (socket != null) {
            try {
                socket.close(1000, "client_stop");
            } catch (Exception ignored) {
                // ignore
            }
            socket = null;
        }
    }

    private void notifyOpen() {
        mainHandler.post(() -> {
            if (listener != null) {
                listener.onOpen();
            }
        });
    }

    private void notifyClosed(String reason) {
        mainHandler.post(() -> {
            if (listener != null) {
                listener.onClosed(reason);
            }
        });
    }

    private void notifyFailure(String message) {
        mainHandler.post(() -> {
            if (listener != null) {
                listener.onFailure(message);
            }
        });
    }
}
