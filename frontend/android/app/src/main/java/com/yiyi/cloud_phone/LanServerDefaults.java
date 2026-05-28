package com.yiyi.cloud_phone;

import java.net.Inet4Address;
import java.net.InetAddress;
import java.net.NetworkInterface;
import java.util.Enumeration;

final class LanServerDefaults {
    static final int DEFAULT_PORT = 3000;
    private static final String FALLBACK_HOST = "192.168.1.1";

    private LanServerDefaults() {
    }

    static String defaultHost() {
        String localIp = findLocalIpv4();
        if (localIp == null) {
            return FALLBACK_HOST;
        }
        return toSubnetGateway(localIp);
    }

    private static String toSubnetGateway(String ip) {
        int lastDot = ip.lastIndexOf('.');
        if (lastDot < 0) {
            return ip;
        }
        return ip.substring(0, lastDot + 1) + "1";
    }

    private static String findLocalIpv4() {
        try {
            Enumeration<NetworkInterface> interfaces = NetworkInterface.getNetworkInterfaces();
            String fallback = null;
            while (interfaces.hasMoreElements()) {
                NetworkInterface networkInterface = interfaces.nextElement();
                if (!networkInterface.isUp() || networkInterface.isLoopback()) {
                    continue;
                }
                Enumeration<InetAddress> addresses = networkInterface.getInetAddresses();
                while (addresses.hasMoreElements()) {
                    InetAddress address = addresses.nextElement();
                    if (address.isLoopbackAddress() || !(address instanceof Inet4Address)) {
                        continue;
                    }
                    String host = address.getHostAddress();
                    if (host == null || host.isEmpty()) {
                        continue;
                    }
                    if (isPrivateIpv4(host)) {
                        return host;
                    }
                    if (fallback == null) {
                        fallback = host;
                    }
                }
            }
            return fallback;
        } catch (Exception error) {
            return null;
        }
    }

    private static boolean isPrivateIpv4(String ip) {
        String[] parts = ip.split("\\.");
        if (parts.length != 4) {
            return false;
        }
        try {
            int first = Integer.parseInt(parts[0]);
            int second = Integer.parseInt(parts[1]);
            if (first == 10) {
                return true;
            }
            if (first == 172 && second >= 16 && second <= 31) {
                return true;
            }
            return first == 192 && second == 168;
        } catch (NumberFormatException error) {
            return false;
        }
    }
}
