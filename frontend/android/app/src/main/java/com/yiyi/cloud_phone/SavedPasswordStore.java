package com.yiyi.cloud_phone;

import android.content.Context;
import android.content.SharedPreferences;

import androidx.security.crypto.EncryptedSharedPreferences;
import androidx.security.crypto.MasterKey;

final class SavedPasswordStore {
    private static final String PREF_FILE = "cloud_phone_secure_prefs";
    private static final String KEY_PREFIX = "saved_password_";

    private SavedPasswordStore() {
    }

    static String serverKey(String host, int port) {
        return host.trim().toLowerCase() + ":" + port;
    }

    static void save(Context context, String host, int port, String password) {
        if (password == null || password.isEmpty()) {
            return;
        }
        try {
            prefs(context).edit().putString(KEY_PREFIX + serverKey(host, port), password).apply();
        } catch (Exception error) {
            // Ignore secure storage failures; user can sign in manually.
        }
    }

    static String load(Context context, String host, int port) {
        try {
            return prefs(context).getString(KEY_PREFIX + serverKey(host, port), "");
        } catch (Exception error) {
            return "";
        }
    }

    static void clear(Context context, String host, int port) {
        try {
            prefs(context).edit().remove(KEY_PREFIX + serverKey(host, port)).apply();
        } catch (Exception error) {
            // Ignore.
        }
    }

    private static SharedPreferences prefs(Context context) throws Exception {
        MasterKey masterKey = new MasterKey.Builder(context)
                .setKeyScheme(MasterKey.KeyScheme.AES256_GCM)
                .build();
        return EncryptedSharedPreferences.create(
                context,
                PREF_FILE,
                masterKey,
                EncryptedSharedPreferences.PrefKeyEncryptionScheme.AES256_SIV,
                EncryptedSharedPreferences.PrefValueEncryptionScheme.AES256_GCM
        );
    }
}
