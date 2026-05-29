package com.yiyi.cloud_phone;

import android.content.Context;
import android.net.Uri;

import org.json.JSONArray;
import org.json.JSONObject;

import java.io.BufferedReader;
import java.io.IOException;
import java.io.InputStream;
import java.io.InputStreamReader;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.List;

final class CloudPhoneApiClient {
    private CloudPhoneApiClient() {
    }

    static List<DeviceItem> fetchDevices(Context context, String host, int port) throws Exception {
        JSONObject body = requestProtectedJson(context, host, port, "/api/devices", "GET");
        if (!body.optBoolean("success", false)) {
            throw new IOException(body.optString("message", "设备列表加载失败"));
        }
        JSONArray devices = body.optJSONArray("devices");
        List<DeviceItem> items = new ArrayList<>();
        if (devices == null) {
            return items;
        }
        for (int index = 0; index < devices.length(); index += 1) {
            items.add(new DeviceItem(devices.getJSONObject(index)));
        }
        return items;
    }

    static JSONObject pairWithCode(
            Context context,
            String host,
            int port,
            String deviceHost,
            int devicePort,
            String pairingCode
    ) throws Exception {
        JSONObject body = new JSONObject();
        body.put("host", deviceHost);
        body.put("port", devicePort);
        body.put("pairingCode", pairingCode);
        return postProtectedJson(context, host, port, "/api/devices/pair-code", body);
    }

    static JSONObject createQrSession(Context context, String host, int port) throws Exception {
        return postProtectedJson(context, host, port, "/api/devices/qr-session", new JSONObject());
    }

    static JSONObject pairWithQr(
            Context context,
            String host,
            int port,
            String serviceName,
            String pairingCode
    ) throws Exception {
        JSONObject body = new JSONObject();
        body.put("serviceName", serviceName);
        body.put("pairingCode", pairingCode);
        return postProtectedJson(context, host, port, "/api/devices/pair-qr", body);
    }

    static byte[] fetchScreenshot(
            Context context,
            String host,
            int port,
            String serial,
            long tick
    ) throws Exception {
        String path = "/api/devices/" + Uri.encode(serial, StandardCharsets.UTF_8.name()) + "/screenshot?t=" + tick;
        JSONObject body = requestProtectedJson(context, host, port, path, "GET");
        if (!body.optBoolean("success", false)) {
            throw new IOException(body.optString("message", "截图加载失败"));
        }
        String data = body.optString("data", "");
        if (data.isEmpty()) {
            throw new IOException("missing_screenshot_data");
        }
        return java.util.Base64.getDecoder().decode(data);
    }

    static JSONObject startDeviceCast(
            Context context,
            String host,
            int port,
            String serial,
            JSONObject options
    ) throws Exception {
        String path = "/api/devices/" + Uri.encode(serial, StandardCharsets.UTF_8.name()) + "/cast/start";
        return postProtectedJson(context, host, port, path, options);
    }

    static JSONObject stopDeviceCast(Context context, String host, int port, String serial) throws Exception {
        String path = "/api/devices/" + Uri.encode(serial, StandardCharsets.UTF_8.name()) + "/cast/stop";
        return requestProtectedJson(context, host, port, path, "DELETE", null);
    }

    static JSONObject changePassword(
            Context context,
            String host,
            int port,
            String currentPassword,
            String nextPassword
    ) throws Exception {
        JSONObject body = new JSONObject();
        body.put("currentPassword", currentPassword);
        body.put("nextPassword", nextPassword);
        return postProtectedJson(context, host, port, "/api/auth/change-password", body);
    }

    static void logout(Context context, String host, int port) throws Exception {
        postProtectedJson(context, host, port, "/api/auth/logout", new JSONObject());
    }

    private static JSONObject requestProtectedJson(
            Context context,
            String host,
            int port,
            String path,
            String method
    ) throws Exception {
        return requestProtectedJson(context, host, port, path, method, null);
    }

    private static JSONObject postProtectedJson(
            Context context,
            String host,
            int port,
            String path,
            JSONObject body
    ) throws Exception {
        return requestProtectedJson(context, host, port, path, "POST", body);
    }

    private static JSONObject requestProtectedJson(
            Context context,
            String host,
            int port,
            String path,
            String method,
            JSONObject plainBody
    ) throws Exception {
        String sessionKey = SessionKeyStore.load(context);
        if (sessionKey.isEmpty()) {
            throw new IOException("missing_session_key");
        }
        byte[] keyBytes = ApiCrypto.keyFromBase64(sessionKey);

        HttpURLConnection connection = null;
        try {
            URL url = new URL("http://" + host + ":" + port + path);
            connection = (HttpURLConnection) url.openConnection();
            connection.setRequestMethod(method);
            connection.setConnectTimeout(8000);
            connection.setReadTimeout(20000);
            connection.setInstanceFollowRedirects(true);

            if ("POST".equals(method) && plainBody != null) {
                connection.setDoOutput(true);
                connection.setRequestProperty("Content-Type", "application/json; charset=utf-8");
                connection.setRequestProperty("X-Encrypted-Request", "1");
                JSONObject envelope = ApiCrypto.encryptPayload(plainBody, keyBytes);
                byte[] bytes = envelope.toString().getBytes(StandardCharsets.UTF_8);
                connection.setFixedLengthStreamingMode(bytes.length);
                try (java.io.OutputStream output = connection.getOutputStream()) {
                    output.write(bytes);
                }
            }

            int code = connection.getResponseCode();
            JSONObject envelope = new JSONObject(readStream(
                    code >= 400 ? connection.getErrorStream() : connection.getInputStream()
            ));

            if (envelope.optBoolean("encrypted")) {
                JSONObject decrypted = ApiCrypto.decryptPayload(envelope, keyBytes);
                if (code >= 400 && !decrypted.optBoolean("success", false)) {
                    throw new IOException(decrypted.optString("message", "HTTP " + code));
                }
                return decrypted;
            }
            if (code >= 400) {
                throw new IOException(envelope.optString("message", "HTTP " + code));
            }
            return envelope;
        } finally {
            if (connection != null) {
                connection.disconnect();
            }
        }
    }

    private static String readStream(InputStream stream) throws IOException {
        if (stream == null) {
            return "{}";
        }
        StringBuilder builder = new StringBuilder();
        try (BufferedReader reader = new BufferedReader(new InputStreamReader(stream, StandardCharsets.UTF_8))) {
            String line;
            while ((line = reader.readLine()) != null) {
                builder.append(line);
            }
        }
        return builder.length() == 0 ? "{}" : builder.toString();
    }
}
