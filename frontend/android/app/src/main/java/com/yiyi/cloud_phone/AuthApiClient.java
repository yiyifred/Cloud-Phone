package com.yiyi.cloud_phone;

import android.content.Context;

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

    SessionStatus fetchSession(Context context, String host, int port) throws Exception {
        JSONObject body = requestJson(host, port, "/api/auth/session", "GET", null);
        if (body.optBoolean("encrypted")) {
            body = decryptSessionOrWire(context, body);
        }
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

    AuthResult login(Context context, String host, int port, String password) throws Exception {
        JSONObject requestBody = new JSONObject();
        requestBody.put("password", password);
        byte[] wireKey = ApiCrypto.derivePasswordEnvelopeKey("cloud-phone", "login-request-wire-v1");
        JSONObject encrypted = ApiCrypto.encryptPayload(requestBody, wireKey);
        JSONObject envelope = requestJson(host, port, "/api/auth/login", "POST", encrypted.toString());

        if (!envelope.optBoolean("encrypted")) {
            return failed(envelope.optString("message", "登录响应未加密"));
        }

        try {
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
        } catch (Exception decryptError) {
            JSONObject failedBody = ApiCrypto.decryptPayload(envelope, wireKey);
            return failed(failedBody.optString("message", "登录失败"));
        }
    }

    AuthResult changePassword(
            Context context,
            String host,
            int port,
            String currentPassword,
            String nextPassword
    ) throws Exception {
        JSONObject requestBody = new JSONObject();
        requestBody.put("currentPassword", currentPassword);
        requestBody.put("nextPassword", nextPassword);

        String sessionKey = SessionKeyStore.load(context);
        JSONObject envelopeRequest;
        boolean bootstrap;
        if (sessionKey != null && !sessionKey.isEmpty()) {
            bootstrap = false;
            envelopeRequest = ApiCrypto.encryptPayload(requestBody, ApiCrypto.keyFromBase64(sessionKey));
        } else {
            bootstrap = true;
            byte[] key = ApiCrypto.derivePasswordEnvelopeKey(currentPassword, "login-request-v1");
            envelopeRequest = ApiCrypto.encryptPayload(requestBody, key);
        }

        JSONObject envelope = requestJson(
                host,
                port,
                "/api/auth/change-password",
                "POST",
                envelopeRequest.toString()
        );

        JSONObject body = envelope;
        if (envelope.optBoolean("encrypted")) {
            try {
                byte[] key = bootstrap
                        ? ApiCrypto.derivePasswordEnvelopeKey(currentPassword, "login-response-v1")
                        : ApiCrypto.keyFromBase64(sessionKey);
                body = ApiCrypto.decryptPayload(envelope, key);
            } catch (Exception decryptError) {
                byte[] wireKey = ApiCrypto.derivePasswordEnvelopeKey(
                        "cloud-phone", "login-request-wire-v1");
                body = ApiCrypto.decryptPayload(envelope, wireKey);
            }
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

    private JSONObject decryptSessionOrWire(Context context, JSONObject envelope) throws Exception {
        String sessionKey = SessionKeyStore.load(context);
        if (sessionKey != null && !sessionKey.isEmpty()) {
            try {
                return ApiCrypto.decryptPayload(envelope, ApiCrypto.keyFromBase64(sessionKey));
            } catch (Exception ignored) {
                // Public / unauthenticated session status uses the login-wire key.
            }
        }
        byte[] wireKey = ApiCrypto.derivePasswordEnvelopeKey("cloud-phone", "login-request-wire-v1");
        return ApiCrypto.decryptPayload(envelope, wireKey);
    }

    private JSONObject requestJson(String host, int port, String path, String method, String body)
            throws Exception {
        HttpURLConnection connection = null;
        try {
            URL url = new URL(ServerUrl.httpUrl(host, port, path));
            connection = (HttpURLConnection) url.openConnection();
            connection.setRequestMethod(method);
            connection.setConnectTimeout(5000);
            connection.setReadTimeout(5000);
            connection.setInstanceFollowRedirects(true);

            if ("POST".equals(method) && body != null) {
                connection.setDoOutput(true);
                connection.setRequestProperty("Content-Type", "application/json; charset=utf-8");
                connection.setRequestProperty("X-Encrypted-Request", "1");
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
