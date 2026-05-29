package com.yiyi.cloud_phone;

import org.json.JSONObject;

import java.io.BufferedReader;
import java.io.IOException;
import java.io.InputStream;
import java.io.InputStreamReader;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;

final class AuthApiClient {
    static final String DEFAULT_PASSWORD = "admin";

    static final class SessionStatus {
        final boolean authenticated;
        final boolean passwordConfigured;
        final boolean requiresPasswordChange;
        final String sessionExpiresAt;

        SessionStatus(
                boolean authenticated,
                boolean passwordConfigured,
                boolean requiresPasswordChange,
                String sessionExpiresAt
        ) {
            this.authenticated = authenticated;
            this.passwordConfigured = passwordConfigured;
            this.requiresPasswordChange = requiresPasswordChange;
            this.sessionExpiresAt = sessionExpiresAt;
        }
    }

    static final class AuthResult {
        final boolean success;
        final boolean authenticated;
        final boolean requiresPasswordChange;
        final boolean passwordConfigured;
        final String message;
        final String encryptionKey;

        AuthResult(
                boolean success,
                boolean authenticated,
                boolean requiresPasswordChange,
                boolean passwordConfigured,
                String message,
                String encryptionKey
        ) {
            this.success = success;
            this.authenticated = authenticated;
            this.requiresPasswordChange = requiresPasswordChange;
            this.passwordConfigured = passwordConfigured;
            this.message = message;
            this.encryptionKey = encryptionKey;
        }
    }

    SessionStatus fetchSession(String host, int port) throws Exception {
        JSONObject body = requestJson(host, port, "/api/auth/session", "GET", null);
        String expiresAt = body.optString("sessionExpiresAt", "");
        if (expiresAt.isEmpty() && !body.isNull("sessionExpiresAt")) {
            expiresAt = String.valueOf(body.opt("sessionExpiresAt"));
        }
        return new SessionStatus(
                body.optBoolean("authenticated"),
                body.optBoolean("passwordConfigured"),
                body.optBoolean("requiresPasswordChange"),
                expiresAt.isEmpty() ? null : expiresAt
        );
    }

    AuthResult login(String host, int port, String password) throws Exception {
        JSONObject requestBody = new JSONObject();
        requestBody.put("password", password);
        JSONObject envelope = requestJson(host, port, "/api/auth/login", "POST", requestBody.toString());

        if (!envelope.optBoolean("encrypted")) {
            return failed(envelope.optString("message", "登录响应未加密"));
        }

        byte[] key = ApiCrypto.derivePasswordEnvelopeKey(password, "login-response-v1");
        JSONObject body = ApiCrypto.decryptPayload(envelope, key);
        if (!body.optBoolean("success", true)) {
            return failed(body.optString("message", "登录失败"));
        }

        return new AuthResult(
                true,
                body.optBoolean("authenticated"),
                body.optBoolean("requiresPasswordChange"),
                body.optBoolean("passwordConfigured"),
                body.optString("message", ""),
                body.optString("encryptionKey", "")
        );
    }

    AuthResult changePassword(String host, int port, String currentPassword, String nextPassword)
            throws Exception {
        JSONObject requestBody = new JSONObject();
        requestBody.put("currentPassword", currentPassword);
        requestBody.put("nextPassword", nextPassword);
        JSONObject envelope = requestJson(
                host,
                port,
                "/api/auth/change-password",
                "POST",
                requestBody.toString()
        );

        JSONObject body = envelope;
        if (envelope.optBoolean("encrypted")) {
            byte[] key = ApiCrypto.derivePasswordEnvelopeKey(currentPassword, "login-response-v1");
            body = ApiCrypto.decryptPayload(envelope, key);
        }

        if (!body.optBoolean("success", false)) {
            return failed(body.optString("message", "密码更新失败"));
        }

        return new AuthResult(
                true,
                body.optBoolean("authenticated"),
                body.optBoolean("requiresPasswordChange"),
                body.optBoolean("passwordConfigured"),
                body.optString("message", ""),
                body.optString("encryptionKey", "")
        );
    }

    private AuthResult failed(String message) {
        return new AuthResult(false, false, false, false, message, "");
    }

    private JSONObject requestJson(String host, int port, String path, String method, String body)
            throws Exception {
        HttpURLConnection connection = null;
        try {
            URL url = new URL("http://" + host + ":" + port + path);
            connection = (HttpURLConnection) url.openConnection();
            connection.setRequestMethod(method);
            connection.setConnectTimeout(5000);
            connection.setReadTimeout(5000);
            connection.setInstanceFollowRedirects(true);

            if ("POST".equals(method) && body != null) {
                connection.setDoOutput(true);
                connection.setRequestProperty("Content-Type", "application/json; charset=utf-8");
                byte[] bytes = body.getBytes(StandardCharsets.UTF_8);
                connection.setFixedLengthStreamingMode(bytes.length);
                try (OutputStream output = connection.getOutputStream()) {
                    output.write(bytes);
                }
            }

            int code = connection.getResponseCode();
            JSONObject json = new JSONObject(readStream(
                    code >= 400 ? connection.getErrorStream() : connection.getInputStream()
            ));

            if (code >= 400 && !json.optBoolean("encrypted")) {
                throw new IOException(json.optString("message", "HTTP " + code));
            }

            return json;
        } finally {
            if (connection != null) {
                connection.disconnect();
            }
        }
    }

    private String readStream(InputStream stream) throws IOException {
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
