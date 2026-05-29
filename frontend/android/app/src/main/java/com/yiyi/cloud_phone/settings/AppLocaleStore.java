package com.yiyi.cloud_phone.settings;

import android.content.Context;

import androidx.appcompat.app.AppCompatDelegate;
import androidx.core.os.LocaleListCompat;

import com.yiyi.cloud_phone.R;

import java.util.ArrayList;
import java.util.List;

public final class AppLocaleStore {
    public static final class LocaleOption {
        public final String code;
        public final int labelRes;

        LocaleOption(String code, int labelRes) {
            this.code = code;
            this.labelRes = labelRes;
        }
    }

    private AppLocaleStore() {
    }

    public static List<LocaleOption> options() {
        List<LocaleOption> items = new ArrayList<>();
        items.add(new LocaleOption(AppPrefs.LOCALE_ZH_CN, R.string.settings_locale_zh_cn));
        items.add(new LocaleOption(AppPrefs.LOCALE_EN_US, R.string.settings_locale_en_us));
        items.add(new LocaleOption(AppPrefs.LOCALE_ZH_TW, R.string.settings_locale_zh_tw));
        items.add(new LocaleOption(AppPrefs.LOCALE_JA_JP, R.string.settings_locale_ja_jp));
        items.add(new LocaleOption(AppPrefs.LOCALE_KO_KR, R.string.settings_locale_ko_kr));
        return items;
    }

    public static String load(Context context) {
        String locale = context.getSharedPreferences(AppPrefs.NAME, Context.MODE_PRIVATE)
                .getString(AppPrefs.KEY_LOCALE, AppPrefs.LOCALE_ZH_CN);
        for (LocaleOption option : options()) {
            if (option.code.equals(locale)) {
                return option.code;
            }
        }
        return AppPrefs.LOCALE_ZH_CN;
    }

    public static void save(Context context, String localeCode) {
        String resolved = load(context);
        for (LocaleOption option : options()) {
            if (option.code.equals(localeCode)) {
                resolved = option.code;
                break;
            }
        }
        context.getSharedPreferences(AppPrefs.NAME, Context.MODE_PRIVATE)
                .edit()
                .putString(AppPrefs.KEY_LOCALE, resolved)
                .apply();
        AppCompatDelegate.setApplicationLocales(LocaleListCompat.forLanguageTags(resolved));
    }

    public static void applySaved(Context context) {
        AppCompatDelegate.setApplicationLocales(
                LocaleListCompat.forLanguageTags(load(context))
        );
    }
}
