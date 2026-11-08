package com.yiyi.cloud_phone;

/**
 * 后端地址与协议的单一来源。
 *
 * 背景：客户端以前把 "http://" 与 "ws://" 硬编码在 7 处，后端上了 TLS 之后
 * 这些调用全部连不上。协议由用户填写的地址决定（https:// 或 wss 由 https 推导），
 * 默认保持 http，不影响既有部署。
 */
public final class ServerUrl {
    public static final String SCHEME_HTTP = "http";
    public static final String SCHEME_HTTPS = "https";

    private static volatile String scheme = SCHEME_HTTP;

    private ServerUrl() {
    }

    public static void setScheme(String value) {
        scheme = SCHEME_HTTPS.equalsIgnoreCase(value) ? SCHEME_HTTPS : SCHEME_HTTP;
    }

    public static String getScheme() {
        return scheme;
    }

    public static boolean isHttps() {
        return SCHEME_HTTPS.equals(scheme);
    }

    public static String httpBase(String host, int port) {
        return scheme + "://" + host + ":" + port;
    }

    public static String httpUrl(String host, int port, String path) {
        return httpBase(host, port) + path;
    }

    public static String wsBase(String host, int port) {
        return (isHttps() ? "wss" : "ws") + "://" + host + ":" + port;
    }

    public static String wsUrl(String host, int port, String path) {
        return wsBase(host, port) + path;
    }

    /**
     * 把用户输入的地址拆成「协议 + 主机」。
     * 接受 "https://1.2.3.4"、"http://example.lan"、"1.2.3.4" 三种写法。
     */
    public static Split splitInput(String raw) {
        String value = raw == null ? "" : raw.trim();
        String parsedScheme = SCHEME_HTTP;
        String lower = value.toLowerCase(java.util.Locale.ROOT);

        if (lower.startsWith("https://")) {
            parsedScheme = SCHEME_HTTPS;
            value = value.substring("https://".length());
        } else if (lower.startsWith("http://")) {
            value = value.substring("http://".length());
        }

        int slashIndex = value.indexOf('/');

        if (slashIndex >= 0) {
            value = value.substring(0, slashIndex);
        }

        return new Split(parsedScheme, value.trim());
    }

    public static final class Split {
        public final String scheme;
        public final String host;

        Split(String scheme, String host) {
            this.scheme = scheme;
            this.host = host;
        }
    }
}
