package com.yiyi.cloud_phone;

import android.content.Context;
import android.content.SharedPreferences;

import androidx.security.crypto.EncryptedSharedPreferences;
import androidx.security.crypto.MasterKey;

final class SessionKeyStore {
    private static final String PREF_FILE = "cloud_phone_secure_prefs";
    private static final String KEY_SESSION = "api_session_encryption_key";

    private SessionKeyStore() {
    }

    static void save(Context context, String base64Key) {
        if (base64Key == null || base64Key.isEmpty()) {
            clear(context);
            return;
        }
        try {
            prefs(context).edit().putString(KEY_SESSION, base64Key).apply();
        } catch (Exception error) {
            // Ignore secure storage failures.
        }
    }

    static String load(Context context) {
        try {
            return prefs(context).getString(KEY_SESSION, "");
        } catch (Exception error) {
            return "";
        }
    }

    static void clear(Context context) {
        try {
            prefs(context).edit().remove(KEY_SESSION).apply();
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
