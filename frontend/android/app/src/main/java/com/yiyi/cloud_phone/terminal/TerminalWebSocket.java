package com.yiyi.cloud_phone.terminal;

import com.yiyi.cloud_phone.ServerUrl;

import com.yiyi.cloud_phone.SessionCookieHelper;

import okhttp3.OkHttpClient;
import okhttp3.Request;
import okhttp3.WebSocket;
import okhttp3.WebSocketListener;
import okio.ByteString;

import org.json.JSONObject;

import java.nio.charset.StandardCharsets;
import java.util.concurrent.TimeUnit;

class TerminalWebSocket {
    interface Callback {
        void onConnected();

        void onOutput(byte[] data);

        void onClosed(String reason);

        void onError(String error);
    }

    private static final OkHttpClient client = new OkHttpClient.Builder()
            .readTimeout(0, TimeUnit.MILLISECONDS)
            .build();
    private WebSocket ws;
    private final Callback callback;

    TerminalWebSocket(Callback callback) {
        this.callback = callback;
    }

    void connect(String host, int port, String serial) {
        String encodedSerial;
        try {
            encodedSerial = java.net.URLEncoder.encode(serial, StandardCharsets.UTF_8.name()).replace("+", "%20");
        } catch (Exception e) {
            encodedSerial = serial;
        }
        String url = ServerUrl.wsUrl(host, port, "/api/devices/" + encodedSerial + "/terminal/ws");
        Request.Builder builder = new Request.Builder().url(url);
        SessionCookieHelper.attach(builder, host, port);
        ws = client.newWebSocket(builder.build(), new WebSocketListener() {
            @Override
            public void onOpen(WebSocket webSocket, okhttp3.Response response) {
                callback.onConnected();
            }

            @Override
            public void onMessage(WebSocket webSocket, String text) {
                callback.onOutput(text.getBytes(StandardCharsets.UTF_8));
            }

            @Override
            public void onMessage(WebSocket webSocket, ByteString bytes) {
                callback.onOutput(bytes.toByteArray());
            }

            @Override
            public void onClosed(WebSocket webSocket, int code, String reason) {
                callback.onClosed(reason != null && !reason.isEmpty() ? reason : "closed");
            }

            @Override
            public void onFailure(WebSocket webSocket, Throwable t, okhttp3.Response response) {
                String detail = t.getMessage() != null ? t.getMessage() : "Connection failed";
                if (response != null) {
                    detail = response.code() + " " + (response.message() != null ? response.message() : detail);
                }
                callback.onError(detail);
            }
        });
    }

    void sendInput(byte[] data) {
        if (ws != null) {
            ws.send(ByteString.of(data));
        }
    }

    void sendResize(int cols, int rows) {
        if (ws != null) {
            try {
                JSONObject msg = new JSONObject();
                msg.put("type", "resize");
                msg.put("cols", cols);
                msg.put("rows", rows);
                ws.send(msg.toString());
            } catch (Exception ignored) {
            }
        }
    }

    void close() {
        if (ws != null) {
            ws.close(1000, "user_close");
            ws = null;
        }
    }
}
