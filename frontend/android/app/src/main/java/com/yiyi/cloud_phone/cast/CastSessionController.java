package com.yiyi.cloud_phone.cast;

import android.content.Context;
import android.net.Uri;

import com.yiyi.cloud_phone.DeviceCastApi;
import com.yiyi.cloud_phone.workspace.CastMode;

import org.json.JSONObject;

import java.io.IOException;

public final class CastSessionController {
    public interface Callback {
        void onCastStarted(JSONObject sessionPayload, byte[] streamParams);

        void onError(String message);
    }

    private CastSessionController() {
    }

    public static void start(
            Context context,
            String host,
            int port,
            String serial,
            CastMode mode,
            JSONObject settings,
            int deviceSdk,
            Callback callback
    ) {
        Thread worker = new Thread(() -> {
            try {
                JSONObject payload = CastPayloadBuilder.build(mode, settings, deviceSdk);
                JSONObject session = DeviceCastApi.startCast(context, host, port, serial, payload);
                if (!session.optBoolean("success", false)) {
                    throw new IOException(session.optString("message", "cast_start_failed"));
                }
                byte[] streamParams = CastVideoSettingsWire.changeStreamParametersFromPayload(payload);
                callback.onCastStarted(session, streamParams);
            } catch (Exception error) {
                String message = error.getMessage() == null ? "cast_start_failed" : error.getMessage();
                callback.onError(message);
            }
        }, "cast-start");
        worker.start();
    }

    public static void stop(Context context, String host, int port, String serial) {
        Thread worker = new Thread(() -> {
            try {
                DeviceCastApi.stopCast(context, host, port, serial);
            } catch (Exception ignored) {
                // best effort
            }
        }, "cast-stop");
        worker.start();
    }

    public static String encodedSerial(String serial) {
        return Uri.encode(serial);
    }
}
