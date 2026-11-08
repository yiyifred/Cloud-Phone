package com.yiyi.cloud_phone;

import java.net.CookieHandler;
import java.net.CookieManager;
import java.net.HttpCookie;
import java.net.URI;
import java.util.List;

import okhttp3.Request;

/** Attaches the login Cookie from the JVM CookieManager to OkHttp WebSocket requests. */
public final class SessionCookieHelper {
    private SessionCookieHelper() {
    }

    public static void attach(Request.Builder builder, String host, int port) {
        CookieHandler handler = CookieHandler.getDefault();
        if (!(handler instanceof CookieManager)) {
            return;
        }
        CookieManager manager = (CookieManager) handler;
        try {
            URI uri = URI.create(ServerUrl.httpBase(host, port) + "/");
            List<HttpCookie> cookies = manager.getCookieStore().get(uri);
            if (cookies == null || cookies.isEmpty()) {
                return;
            }
            StringBuilder cookieHeader = new StringBuilder();
            for (int index = 0; index < cookies.size(); index += 1) {
                if (index > 0) {
                    cookieHeader.append("; ");
                }
                HttpCookie cookie = cookies.get(index);
                cookieHeader.append(cookie.getName()).append('=').append(cookie.getValue());
            }
            builder.header("Cookie", cookieHeader.toString());
        } catch (Exception ignored) {
            // ignore cookie attach failures
        }
    }
}
