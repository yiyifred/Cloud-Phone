package com.yiyi.cloud_phone;

import org.json.JSONObject;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.spec.KeySpec;
import java.util.Base64;

import javax.crypto.Cipher;
import javax.crypto.SecretKey;
import javax.crypto.SecretKeyFactory;
import javax.crypto.spec.GCMParameterSpec;
import javax.crypto.spec.PBEKeySpec;
import javax.crypto.spec.SecretKeySpec;

final class ApiCrypto {
    private static final int GCM_TAG_BITS = 128;

    private ApiCrypto() {
    }

    static byte[] derivePasswordEnvelopeKey(String password, String purpose) throws Exception {
        SecretKeyFactory factory = SecretKeyFactory.getInstance("PBKDF2WithHmacSHA256");
        byte[] salt = ("cloud-phone:" + purpose).getBytes(StandardCharsets.UTF_8);
        KeySpec spec = new PBEKeySpec(password.toCharArray(), salt, 100_000, 256);
        return factory.generateSecret(spec).getEncoded();
    }

    static byte[] keyFromBase64(String base64Key) {
        return java.util.Base64.getDecoder().decode(base64Key);
    }

    static JSONObject decryptPayload(JSONObject envelope, byte[] keyBytes) throws Exception {
        if (!envelope.optBoolean("encrypted") || !envelope.has("payload")) {
            throw new IllegalStateException("encrypted_payload_required");
        }

        byte[] buffer = Base64.getDecoder().decode(envelope.getString("payload"));
        byte[] iv = copyOfRange(buffer, 0, 12);
        byte[] authTag = copyOfRange(buffer, 12, 28);
        byte[] ciphertext = copyOfRange(buffer, 28, buffer.length);
        byte[] cipherWithTag = new byte[ciphertext.length + authTag.length];
        System.arraycopy(ciphertext, 0, cipherWithTag, 0, ciphertext.length);
        System.arraycopy(authTag, 0, cipherWithTag, ciphertext.length, authTag.length);

        SecretKey key = new SecretKeySpec(normalizeKey(keyBytes), "AES");
        Cipher cipher = Cipher.getInstance("AES/GCM/NoPadding");
        cipher.init(Cipher.DECRYPT_MODE, key, new GCMParameterSpec(GCM_TAG_BITS, iv));
        byte[] plain = cipher.doFinal(cipherWithTag);
        return new JSONObject(new String(plain, StandardCharsets.UTF_8));
    }

    private static byte[] normalizeKey(byte[] keyBytes) throws Exception {
        if (keyBytes.length == 32) {
            return keyBytes;
        }
        MessageDigest digest = MessageDigest.getInstance("SHA-256");
        return digest.digest(keyBytes);
    }

    private static byte[] copyOfRange(byte[] source, int start, int end) {
        int length = end - start;
        byte[] copy = new byte[length];
        System.arraycopy(source, start, copy, 0, length);
        return copy;
    }
}
