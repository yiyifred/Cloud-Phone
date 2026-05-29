package com.yiyi.cloud_phone.settings;

import android.content.Context;

import androidx.appcompat.app.AppCompatDelegate;

public final class AppThemeStore {
    private AppThemeStore() {
    }

    public static void applySaved(Context context) {
        AppCompatDelegate.setDefaultNightMode(resolveNightMode(load(context)));
    }

    public static String load(Context context) {
        String theme = context.getSharedPreferences(AppPrefs.NAME, Context.MODE_PRIVATE)
                .getString(AppPrefs.KEY_THEME, AppPrefs.THEME_LIGHT);
        return AppPrefs.THEME_DARK.equals(theme) ? AppPrefs.THEME_DARK : AppPrefs.THEME_LIGHT;
    }

    public static void save(Context context, String theme) {
        String resolved = AppPrefs.THEME_DARK.equals(theme) ? AppPrefs.THEME_DARK : AppPrefs.THEME_LIGHT;
        context.getSharedPreferences(AppPrefs.NAME, Context.MODE_PRIVATE)
                .edit()
                .putString(AppPrefs.KEY_THEME, resolved)
                .apply();
        AppCompatDelegate.setDefaultNightMode(resolveNightMode(resolved));
    }

    private static int resolveNightMode(String theme) {
        return AppPrefs.THEME_DARK.equals(theme)
                ? AppCompatDelegate.MODE_NIGHT_YES
                : AppCompatDelegate.MODE_NIGHT_NO;
    }
}
