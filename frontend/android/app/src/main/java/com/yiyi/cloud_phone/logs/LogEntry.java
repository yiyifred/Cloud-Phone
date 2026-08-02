package com.yiyi.cloud_phone.logs;

import org.json.JSONObject;

import java.text.SimpleDateFormat;
import java.util.Date;
import java.util.Locale;
import java.util.TimeZone;

public final class LogEntry {
    private static final SimpleDateFormat DISPLAY_FMT =
            new SimpleDateFormat("yyyy/MM/dd HH:mm:ss", Locale.CHINA);
    private static final SimpleDateFormat ISO_FMT =
            new SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss.SSS'Z'", Locale.US);

    static {
        ISO_FMT.setTimeZone(TimeZone.getTimeZone("UTC"));
    }

    public final long id;
    public final long timestamp;
    public final String displayTime;
    public final String level;
    public final String category;
    public final String event;
    public final String message;
    public final String deviceSerial;
    public final String deviceName;

    LogEntry(long id, long timestamp, String displayTime, String level, String category,
             String event, String message, String deviceSerial, String deviceName) {
        this.id = id;
        this.timestamp = timestamp;
        this.displayTime = displayTime;
        this.level = level;
        this.category = category;
        this.event = event;
        this.message = message;
        this.deviceSerial = deviceSerial;
        this.deviceName = deviceName;
    }

    static LogEntry fromJson(JSONObject json) {
        long id = json.optLong("id", 0L);
        String iso = json.optString("timestamp", "");
        long millis = parseIsoMillis(iso);
        if (millis <= 0) {
            millis = System.currentTimeMillis();
        }
        String display;
        synchronized (DISPLAY_FMT) {
            display = DISPLAY_FMT.format(new Date(millis));
        }
        return new LogEntry(
                id,
                millis,
                display,
                json.optString("level", AppEventLogger.LEVEL_INFO),
                json.optString("category", "ui"),
                json.optString("event", "event"),
                json.optString("message", ""),
                emptyToNull(json.optString("deviceSerial", null)),
                emptyToNull(json.optString("deviceName", null))
        );
    }

    String toIsoTimestamp() {
        synchronized (ISO_FMT) {
            return ISO_FMT.format(new Date(timestamp));
        }
    }

    private static long parseIsoMillis(String iso) {
        if (iso == null || iso.isEmpty()) {
            return 0L;
        }
        try {
            synchronized (ISO_FMT) {
                Date parsed = ISO_FMT.parse(iso);
                return parsed == null ? 0L : parsed.getTime();
            }
        } catch (Exception ignored) {
            return 0L;
        }
    }

    private static String emptyToNull(String value) {
        if (value == null || value.trim().isEmpty() || "null".equals(value)) {
            return null;
        }
        return value;
    }
}
