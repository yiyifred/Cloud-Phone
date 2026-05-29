package com.yiyi.cloud_phone;

import android.content.Context;

import org.json.JSONObject;

public final class DeviceCastApi {
    private DeviceCastApi() {
    }

    public static JSONObject startCast(
            Context context,
            String host,
            int port,
            String serial,
            JSONObject options
    ) throws Exception {
        return CloudPhoneApiClient.startDeviceCast(context, host, port, serial, options);
    }

    public static JSONObject stopCast(Context context, String host, int port, String serial) throws Exception {
        return CloudPhoneApiClient.stopDeviceCast(context, host, port, serial);
    }
}
