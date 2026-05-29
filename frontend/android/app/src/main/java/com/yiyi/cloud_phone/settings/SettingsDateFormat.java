package com.yiyi.cloud_phone.settings;

import android.content.Context;

import com.yiyi.cloud_phone.R;

import java.text.DateFormat;
import java.text.ParseException;
import java.text.SimpleDateFormat;
import java.util.Date;
import java.util.Locale;
import java.util.TimeZone;

public final class SettingsDateFormat {
    private static final String[] ISO_PATTERNS = {
            "yyyy-MM-dd'T'HH:mm:ss.SSS'Z'",
            "yyyy-MM-dd'T'HH:mm:ss'Z'",
            "yyyy-MM-dd'T'HH:mm:ss.SSSXXX",
            "yyyy-MM-dd'T'HH:mm:ssXXX",
    };

    private SettingsDateFormat() {
    }

    public static String formatSessionExpiry(Context context, String raw) {
        if (raw == null || raw.trim().isEmpty()) {
            return context.getString(R.string.settings_session_unset);
        }
        Date date = parseIso(raw.trim());
        if (date == null) {
            return raw;
        }
        DateFormat formatter = DateFormat.getDateTimeInstance(
                DateFormat.MEDIUM,
                DateFormat.SHORT,
                Locale.getDefault()
        );
        return formatter.format(date);
    }

    private static Date parseIso(String raw) {
        for (String pattern : ISO_PATTERNS) {
            try {
                SimpleDateFormat format = new SimpleDateFormat(pattern, Locale.US);
                format.setTimeZone(TimeZone.getTimeZone("UTC"));
                return format.parse(raw);
            } catch (ParseException ignored) {
                // try next pattern
            }
        }
        return null;
    }
}
