package com.yiyi.cloud_phone.multiapp;

import android.content.Context;
import android.os.Handler;
import android.os.Looper;

import com.yiyi.cloud_phone.CloudPhoneApiClient;
import com.yiyi.cloud_phone.settings.ServerEndpointStore;

import org.json.JSONObject;

/**
 * Poll package presence for a multi-app window:
 * exited → {@link Callback#onAppExited()};
 * running but not on a virtual display → {@link Callback#onOffVirtualDisplay()}.
 */
final class MultiAppAppExitWatcher {
    interface Callback {
        void onAppExited();

        void onOffVirtualDisplay();
    }

    private final Context context;
    private final String serial;
    private final String packageName;
    private final Callback callback;
    private final Handler handler = new Handler(Looper.getMainLooper());
    private final Runnable tick = this::poll;

    private boolean enabled;
    private long startedAt;
    private long pauseUntil;
    private int missCount;
    private int offVdMissCount;
    private boolean checking;

    MultiAppAppExitWatcher(Context context, String serial, String packageName, Callback callback) {
        this.context = context.getApplicationContext();
        this.serial = serial;
        this.packageName = packageName;
        this.callback = callback;
    }

    void setEnabled(boolean next) {
        if (next == enabled) {
            return;
        }
        enabled = next;
        if (enabled) {
            startedAt = System.currentTimeMillis();
            pauseUntil = 0;
            missCount = 0;
            offVdMissCount = 0;
            handler.postDelayed(tick, 2500L);
        } else {
            handler.removeCallbacks(tick);
            missCount = 0;
            offVdMissCount = 0;
        }
    }

    void bumpGrace(long ms) {
        pauseUntil = Math.max(pauseUntil, System.currentTimeMillis() + Math.max(0, ms));
        missCount = 0;
        offVdMissCount = 0;
    }

    void release() {
        enabled = false;
        handler.removeCallbacks(tick);
    }

    private void poll() {
        if (!enabled) {
            return;
        }
        handler.postDelayed(tick, 2500L);
        if (checking) {
            return;
        }
        long now = System.currentTimeMillis();
        if (now - startedAt < 15_000L || now < pauseUntil) {
            return;
        }
        checking = true;
        new Thread(() -> {
            try {
                ServerEndpointStore.Endpoint store = ServerEndpointStore.read(context);
                JSONObject result = CloudPhoneApiClient.getAppRunningState(
                        context, store.host, store.port, serial, packageName
                );
                if (result.optBoolean("uncertain", false) || result.isNull("running")) {
                    return;
                }
                if (!result.has("running")) {
                    return;
                }
                if (result.optBoolean("running", false)) {
                    missCount = 0;
                    if (result.has("onVirtualDisplay")
                            && !result.isNull("onVirtualDisplay")
                            && !result.optBoolean("onVirtualDisplay", true)) {
                        offVdMissCount += 1;
                        if (offVdMissCount >= 2) {
                            offVdMissCount = 0;
                            handler.post(() -> {
                                if (callback != null) {
                                    callback.onOffVirtualDisplay();
                                }
                            });
                        }
                    } else {
                        offVdMissCount = 0;
                    }
                    return;
                }
                offVdMissCount = 0;
                missCount += 1;
                if (missCount >= 4) {
                    handler.post(() -> {
                        setEnabled(false);
                        if (callback != null) {
                            callback.onAppExited();
                        }
                    });
                }
            } catch (Exception ignored) {
                // transient errors must not close window
            } finally {
                checking = false;
            }
        }, "multi-app-exit-watch").start();
    }
}
