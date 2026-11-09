package com.genymobile.scrcpy.video;

import android.media.MediaCodec;
import android.os.Bundle;

public class CaptureControl {

    public static final int RESET_REASON_TERMINATED = 1;
    public static final int RESET_REASON_DISPLAY_PROPERTIES_CHANGED = 1 << 1;
    public static final int RESET_REASON_CLIENT_RESET = 1 << 2;
    public static final int RESET_REASON_CLIENT_RESIZED = 1 << 3;

    private int reset = 0;

    // Current instance of MediaCodec to "interrupt" on reset
    private MediaCodec runningMediaCodec;

    public synchronized boolean isResetRequested() {
        return reset != 0;
    }

    public synchronized int consumeReset() {
        int value = reset;
        reset = 0;
        return value;
    }

    public synchronized void reset(int reason) {
        assert reason != 0;
        reset |= reason;
        if (runningMediaCodec != null) {
            try {
                runningMediaCodec.signalEndOfInputStream();
            } catch (IllegalStateException e) {
                // ignore
            }
        }
    }

    /**
     * Ask the running encoder for an IDR frame without rebuilding capture.
     *
     * <p>The Web client uses this to recover after packet loss. Recreating the capture
     * instead (the previous behaviour) left the Waydroid pipeline emitting only CSD, so the
     * canvas went black whenever a client requested a keyframe.
     */
    public synchronized void requestSyncFrame() {
        if (runningMediaCodec == null) {
            return;
        }
        try {
            Bundle params = new Bundle();
            params.putInt(MediaCodec.PARAMETER_KEY_REQUEST_SYNC_FRAME, 0);
            runningMediaCodec.setParameters(params);
        } catch (IllegalStateException e) {
            // codec already stopped: the next capture restart will produce a keyframe anyway
        }
    }

    public synchronized void setRunningMediaCodec(MediaCodec runningMediaCodec) {
        this.runningMediaCodec = runningMediaCodec;
    }
}
