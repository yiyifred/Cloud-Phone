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

public final class CloudPhoneApiClient {
    private CloudPhoneApiClient() {
    }

    public static List<DeviceItem> fetchDevices(Context context, String host, int port) throws Exception {
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

    static JSONObject connectDevice(
            Context context,
            String host,
            int port,
            String deviceHost,
            int devicePort
    ) throws Exception {
        JSONObject body = new JSONObject();
        body.put("host", deviceHost);
        body.put("port", devicePort);
        return postProtectedJson(context, host, port, "/api/devices/connect", body);
    }

    public static byte[] fetchScreenshot(
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

    static JSONObject getDeviceCastStatus(Context context, String host, int port, String serial) throws Exception {
        String path = "/api/devices/" + Uri.encode(serial, StandardCharsets.UTF_8.name()) + "/cast/status";
        return requestProtectedJson(context, host, port, path, "GET");
    }

    static JSONObject disconnectDevice(Context context, String host, int port, String serial) throws Exception {
        String path = "/api/devices/" + Uri.encode(serial, StandardCharsets.UTF_8.name());
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

    // ---- File Explorer ----

    public static JSONObject listFiles(Context context, String host, int port, String serial, String path) throws Exception {
        String encoded = Uri.encode(path, StandardCharsets.UTF_8.name());
        String apiPath = "/api/devices/" + encSerial(serial) + "/files?path=" + encoded;
        return requestProtectedJson(context, host, port, apiPath, "GET");
    }

    public static byte[] downloadFile(Context context, String host, int port, String serial, String path) throws Exception {
        JSONObject body = new JSONObject();
        body.put("path", path);
        String apiPath = "/api/devices/" + encSerial(serial) + "/files/download";
        return requestProtectedRawPost(context, host, port, apiPath, body);
    }

    public static JSONObject uploadFile(
            Context context, String host, int port, String serial,
            String devicePath, java.io.InputStream bodyStream
    ) throws Exception {
        String apiPath = "/api/devices/" + encSerial(serial) + "/files/upload";
        return requestProtectedUploadJson(context, host, port, apiPath, bodyStream, devicePath);
    }

    // ---- App Manager ----

    public static JSONObject listApps(Context context, String host, int port, String serial) throws Exception {
        return requestProtectedJson(context, host, port, "/api/devices/" + encSerial(serial) + "/apps", "GET");
    }

    public static JSONObject getAppDetail(Context context, String host, int port, String serial, String pkg) throws Exception {
        return requestProtectedJson(context, host, port,
                "/api/devices/" + encSerial(serial) + "/apps/" + Uri.encode(pkg, StandardCharsets.UTF_8.name()), "GET");
    }

    public static JSONObject uninstallApp(Context context, String host, int port, String serial, String pkg) throws Exception {
        return requestProtectedJson(context, host, port,
                "/api/devices/" + encSerial(serial) + "/apps/" + Uri.encode(pkg, StandardCharsets.UTF_8.name()) + "?confirm=1",
                "DELETE", null);
    }

    public static JSONObject installApp(
            Context context, String host, int port, String serial, java.io.InputStream apkStream
    ) throws Exception {
        return requestProtectedUploadJson(context, host, port,
                "/api/devices/" + encSerial(serial) + "/apps/install", apkStream, null);
    }

    public static JSONObject setAppFrozen(
            Context context, String host, int port, String serial, String pkg, boolean frozen
    ) throws Exception {
        JSONObject body = new JSONObject();
        body.put("frozen", frozen);
        return postProtectedJson(context, host, port,
                "/api/devices/" + encSerial(serial) + "/apps/" + Uri.encode(pkg, StandardCharsets.UTF_8.name()) + "/state",
                body);
    }

    public static byte[] extractApk(Context context, String host, int port, String serial, String pkg) throws Exception {
        return requestProtectedRaw(context, host, port,
                "/api/devices/" + encSerial(serial) + "/apps/" + Uri.encode(pkg, StandardCharsets.UTF_8.name()) + "/apk");
    }

    /** Soft exit then force-stop if still running (multi-app window close). */
    public static JSONObject stopApp(Context context, String host, int port, String serial, String pkg) throws Exception {
        return postProtectedJson(context, host, port,
                "/api/devices/" + encSerial(serial) + "/apps/" + Uri.encode(pkg, StandardCharsets.UTF_8.name()) + "/stop",
                new JSONObject());
    }

    public static JSONObject forceStopApp(Context context, String host, int port, String serial, String pkg) throws Exception {
        return postProtectedJson(context, host, port,
                "/api/devices/" + encSerial(serial) + "/apps/" + Uri.encode(pkg, StandardCharsets.UTF_8.name()) + "/force-stop",
                new JSONObject());
    }

    public static JSONObject listLauncherApps(
            Context context, String host, int port, String serial, boolean light, boolean packageNamesOnly
    ) throws Exception {
        String query = "?light=" + (light ? "1" : "0") + "&packageNamesOnly=" + (packageNamesOnly ? "1" : "0");
        return requestProtectedJson(context, host, port, "/api/devices/" + encSerial(serial) + "/launcher-apps" + query, "GET");
    }

    // ---- Icon Helper (app icon/name extraction service) ----

    public static JSONObject iconHelperStatus(Context context, String host, int port, String serial) throws Exception {
        return requestProtectedJson(
                context,
                host,
                port,
                "/api/devices/" + encSerial(serial) + "/icon-helper/status",
                "GET"
        );
    }

    public static JSONObject iconHelperEnsure(
            Context context, String host, int port, String serial, boolean force
    ) throws Exception {
        String qs = force ? "?force=1" : "";
        return requestProtectedJson(
                context,
                host,
                port,
                "/api/devices/" + encSerial(serial) + "/icon-helper/ensure" + qs,
                "POST"
        );
    }

    public static JSONObject iconHelperProgress(Context context, String host, int port, String serial) throws Exception {
        return requestProtectedJson(
                context,
                host,
                port,
                "/api/devices/" + encSerial(serial) + "/icon-helper/progress",
                "GET"
        );
    }

    public static String fetchAppOrientation(Context context, String host, int port, String serial, String pkg) throws Exception {
        JSONObject result = requestProtectedJson(context, host, port,
                "/api/devices/" + encSerial(serial) + "/apps/" + Uri.encode(pkg, StandardCharsets.UTF_8.name()) + "/orientation",
                "GET");
        return "landscape".equals(result.optString("orientation", "")) ? "landscape" : "portrait";
    }

    public static JSONObject getAppRunningState(Context context, String host, int port, String serial, String pkg) throws Exception {
        return requestProtectedJson(context, host, port,
                "/api/devices/" + encSerial(serial) + "/apps/" + Uri.encode(pkg, StandardCharsets.UTF_8.name()) + "/running",
                "GET");
    }

    public static JSONObject getQuickSettings(Context context, String host, int port, String serial) throws Exception {
        return requestProtectedJson(context, host, port, "/api/devices/" + encSerial(serial) + "/quick-settings", "GET");
    }

    public static JSONObject patchQuickSettings(
            Context context, String host, int port, String serial, JSONObject patch
    ) throws Exception {
        return postProtectedJson(context, host, port, "/api/devices/" + encSerial(serial) + "/quick-settings", patch);
    }

    public static JSONObject getNotifications(Context context, String host, int port, String serial, boolean light) throws Exception {
        String query = light ? "?light=1" : "";
        return requestProtectedJson(context, host, port, "/api/devices/" + encSerial(serial) + "/notifications" + query, "GET");
    }

    // ---- iOS device management ----

    public static JSONObject discoverIosDevices(Context context, String host, int port) throws Exception {
        return requestProtectedJson(context, host, port, "/api/devices/ios/discover", "GET");
    }

    public static JSONObject connectIosDevice(Context context, String host, int port, String serial) throws Exception {
        JSONObject body = new JSONObject();
        body.put("serial", serial);
        return postProtectedJson(context, host, port, "/api/devices/ios/connect", body);
    }

    public static JSONObject disconnectIosDevice(Context context, String host, int port, String serial) throws Exception {
        return requestProtectedJson(context, host, port,
                "/api/devices/ios/" + Uri.encode(serial, StandardCharsets.UTF_8.name()), "DELETE", null);
    }

    public static JSONObject checkIosWdaPrepare(Context context, String host, int port) throws Exception {
        return requestProtectedJson(context, host, port, "/api/devices/ios/wda/prepare", "GET");
    }

    public static JSONObject startIosWdaPipeline(
            Context context, String host, int port,
            String appleId, String password, boolean skipSign, boolean skipInstall
    ) throws Exception {
        JSONObject body = new JSONObject();
        body.put("appleId", appleId);
        body.put("password", password);
        body.put("skipSign", skipSign);
        body.put("skipInstall", skipInstall);
        return postProtectedJson(context, host, port, "/api/devices/ios/wda/pipeline", body);
    }

    public static JSONObject getIosWdaPipelineStatus(Context context, String host, int port, String jobId) throws Exception {
        return requestProtectedJson(context, host, port,
                "/api/devices/ios/wda/pipeline/" + Uri.encode(jobId, StandardCharsets.UTF_8.name()), "GET");
    }

    public static String encSerial(String serial) {
        return Uri.encode(serial, StandardCharsets.UTF_8.name());
    }

    public static JSONObject requestProtectedJson(
            Context context,
            String host,
            int port,
            String path,
            String method
    ) throws Exception {
        return requestProtectedJson(context, host, port, path, method, null);
    }

    public static JSONObject postProtectedJson(
            Context context,
            String host,
            int port,
            String path,
            JSONObject body
    ) throws Exception {
        return requestProtectedJson(context, host, port, path, "POST", body);
    }

    public static JSONObject requestProtectedJson(
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
            URL url = new URL(ServerUrl.httpUrl(host, port, path));
            connection = (HttpURLConnection) url.openConnection();
            connection.setRequestMethod(method);
            connection.setConnectTimeout(8000);
            connection.setReadTimeout(20000);
            connection.setInstanceFollowRedirects(true);

            if (plainBody != null && ("POST".equals(method) || "PUT".equals(method) || "DELETE".equals(method))) {
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
                JSONObject decrypted;
                try {
                    decrypted = ApiCrypto.decryptPayload(envelope, keyBytes);
                } catch (Exception decryptError) {
                    byte[] wireKey = ApiCrypto.derivePasswordEnvelopeKey(
                            "cloud-phone", "login-request-wire-v1");
                    decrypted = ApiCrypto.decryptPayload(envelope, wireKey);
                }
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

    public static byte[] requestProtectedRaw(
            Context context, String host, int port, String path
    ) throws Exception {
        String sessionKey = SessionKeyStore.load(context);
        if (sessionKey.isEmpty()) throw new IOException("missing_session_key");
        byte[] keyBytes = ApiCrypto.keyFromBase64(sessionKey);
        HttpURLConnection conn = null;
        try {
            conn = (HttpURLConnection) new URL(ServerUrl.httpUrl(host, port, path)).openConnection();
            conn.setRequestMethod("GET");
            conn.setConnectTimeout(8000);
            conn.setReadTimeout(30000);
            int code = conn.getResponseCode();
            String resp = readStream(code >= 400 ? conn.getErrorStream() : conn.getInputStream());
            JSONObject envelope = new JSONObject(resp);
            if (envelope.optBoolean("encrypted")) {
                JSONObject dec;
                try {
                    dec = ApiCrypto.decryptPayload(envelope, keyBytes);
                } catch (Exception decryptError) {
                    byte[] wireKey = ApiCrypto.derivePasswordEnvelopeKey(
                            "cloud-phone", "login-request-wire-v1");
                    dec = ApiCrypto.decryptPayload(envelope, wireKey);
                }
                if (code >= 400 && !dec.optBoolean("success", false)) {
                    throw new IOException(dec.optString("message", "HTTP " + code));
                }
                String data = dec.optString("data", "");
                if (data.isEmpty()) throw new IOException("missing_encrypted_binary");
                return java.util.Base64.getDecoder().decode(data);
            }
            if (code >= 400) throw new IOException(envelope.optString("message", "HTTP " + code));
            return resp.getBytes(StandardCharsets.UTF_8);
        } finally {
            if (conn != null) conn.disconnect();
        }
    }

    static byte[] requestProtectedRawPost(
            Context context, String host, int port, String path, JSONObject plainBody
    ) throws Exception {
        JSONObject dec = requestProtectedJson(context, host, port, path, "POST", plainBody);
        String data = dec.optString("data", "");
        if (data.isEmpty()) throw new IOException("missing_encrypted_binary");
        return java.util.Base64.getDecoder().decode(data);
    }

    public static JSONObject requestProtectedUploadJson(
            Context context, String host, int port, String path, InputStream bodyStream, String devicePath
    ) throws Exception {
        String sessionKey = SessionKeyStore.load(context);
        if (sessionKey.isEmpty()) throw new IOException("missing_session_key");
        byte[] keyBytes = ApiCrypto.keyFromBase64(sessionKey);

        java.io.ByteArrayOutputStream bos = new java.io.ByteArrayOutputStream();
        byte[] buf = new byte[8192];
        int len;
        while ((len = bodyStream.read(buf)) != -1) bos.write(buf, 0, len);
        String data = java.util.Base64.getEncoder().encodeToString(bos.toByteArray());

        JSONObject plain = new JSONObject();
        plain.put("data", data);
        if (devicePath != null && !devicePath.isEmpty()) {
            plain.put("path", devicePath);
        }

        return requestProtectedJson(context, host, port, path, "PUT", plain);
    }

    private static byte[] readBytes(InputStream stream) throws IOException {
        if (stream == null) return new byte[0];
        java.io.ByteArrayOutputStream bos = new java.io.ByteArrayOutputStream();
        byte[] buf = new byte[8192];
        int len;
        while ((len = stream.read(buf)) != -1) bos.write(buf, 0, len);
        return bos.toByteArray();
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
