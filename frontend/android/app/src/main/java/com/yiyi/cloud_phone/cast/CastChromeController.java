package com.yiyi.cloud_phone.cast;

import android.os.Handler;
import android.os.Looper;
import android.view.View;

final class CastChromeController {
    interface Host {
        void setChromeVisible(boolean visible);
    }

    private static final long AUTO_HIDE_MS = 3500L;

    private final Host host;
    private final Handler handler = new Handler(Looper.getMainLooper());
    private boolean chromeVisible = true;
    private boolean streaming;

    private final Runnable hideRunnable = () -> {
        if (streaming) {
            setChromeVisible(false);
        }
    };

    CastChromeController(Host host) {
        this.host = host;
    }

    void setStreaming(boolean streaming) {
        this.streaming = streaming;
        if (streaming) {
            scheduleAutoHide();
        } else {
            setChromeVisible(true);
        }
    }

    void onUserInteraction() {
        if (!streaming) {
            return;
        }
        setChromeVisible(true);
        scheduleAutoHide();
    }

    void toggleChrome() {
        if (!streaming) {
            return;
        }
        setChromeVisible(!chromeVisible);
        if (chromeVisible) {
            scheduleAutoHide();
        } else {
            handler.removeCallbacks(hideRunnable);
        }
    }

    private void scheduleAutoHide() {
        handler.removeCallbacks(hideRunnable);
        handler.postDelayed(hideRunnable, AUTO_HIDE_MS);
    }

    private void setChromeVisible(boolean visible) {
        chromeVisible = visible;
        host.setChromeVisible(visible);
    }

    void release() {
        handler.removeCallbacks(hideRunnable);
    }
}
