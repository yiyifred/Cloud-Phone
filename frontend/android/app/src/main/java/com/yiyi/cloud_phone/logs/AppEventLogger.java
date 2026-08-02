package com.yiyi.cloud_phone.logs;

import android.content.Context;

import java.text.SimpleDateFormat;
import java.util.ArrayList;
import java.util.Collections;
import java.util.Date;
import java.util.List;
import java.util.Locale;
import java.util.concurrent.CopyOnWriteArrayList;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.atomic.AtomicLong;

public class AppEventLogger {
    public static final String LEVEL_DEBUG = "debug";
    public static final String LEVEL_INFO = "info";
    public static final String LEVEL_WARN = "warn";
    public static final String LEVEL_ERROR = "error";

    private static final int MAX_LOCAL_ENTRIES = 80;
    private static final SimpleDateFormat TIME_FMT = new SimpleDateFormat("HH:mm:ss", Locale.getDefault());
    private static final AtomicLong idCounter = new AtomicLong(1);
    private static final AppEventLogger INSTANCE = new AppEventLogger();
    private static final ExecutorService SYNC = Executors.newSingleThreadExecutor();

    private final CopyOnWriteArrayList<LogEntry> entries = new CopyOnWriteArrayList<>();
    private OnLogChangedListener listener;
    private Context appContext;

    private AppEventLogger() {
    }

    public static AppEventLogger get() {
        return INSTANCE;
    }

    public void attach(Context context) {
        if (context != null) {
            appContext = context.getApplicationContext();
        }
    }

    public interface OnLogChangedListener {
        void onLogChanged();
    }

    public void setOnLogChangedListener(OnLogChangedListener l) {
        this.listener = l;
    }

    public void log(String level, String category, String event, String message) {
        log(level, category, event, message, null, null);
    }

    public void log(String level, String category, String event, String message,
                    String deviceSerial, String deviceName) {
        long now = System.currentTimeMillis();
        String display;
        synchronized (TIME_FMT) {
            display = TIME_FMT.format(new Date(now));
        }
        LogEntry entry = new LogEntry(
                idCounter.getAndIncrement(),
                now,
                display,
                level, category, event, message, deviceSerial, deviceName
        );
        entries.add(entry);
        while (entries.size() > MAX_LOCAL_ENTRIES) {
            entries.remove(0);
        }
        notifyChanged();
        Context ctx = appContext;
        if (ctx != null) {
            SYNC.execute(() -> {
                try {
                    AppLogsApi.append(ctx, entry);
                } catch (Exception ignored) {
                }
            });
        }
    }

    public void debug(String category, String event, String message) {
        log(LEVEL_DEBUG, category, event, message);
    }

    public void info(String category, String event, String message) {
        log(LEVEL_INFO, category, event, message);
    }

    public void warn(String category, String event, String message) {
        log(LEVEL_WARN, category, event, message);
    }

    public void error(String category, String event, String message) {
        log(LEVEL_ERROR, category, event, message);
    }

    public List<LogEntry> getEntries() {
        List<LogEntry> copy = new ArrayList<>(entries);
        Collections.reverse(copy);
        return copy;
    }

    public void clear() {
        entries.clear();
        notifyChanged();
        Context ctx = appContext;
        if (ctx != null) {
            SYNC.execute(() -> {
                try {
                    AppLogsApi.clear(ctx);
                } catch (Exception ignored) {
                }
            });
        }
    }

    private void notifyChanged() {
        if (listener != null) {
            listener.onLogChanged();
        }
    }
}
