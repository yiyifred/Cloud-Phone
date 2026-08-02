package com.yiyi.cloud_phone.logs;

import android.content.Context;

import com.yiyi.cloud_phone.CloudPhoneApiClient;
import com.yiyi.cloud_phone.settings.ServerEndpointStore;

import org.json.JSONArray;
import org.json.JSONObject;

import java.util.ArrayList;
import java.util.List;

/** Paginated activity-log API (/api/logs). */
final class AppLogsApi {
    static final int PAGE_SIZE = 50;

    static final class Page {
        final List<LogEntry> logs = new ArrayList<>();
        final Long nextBeforeId;
        final boolean hasMore;

        Page(Long nextBeforeId, boolean hasMore) {
            this.nextBeforeId = nextBeforeId;
            this.hasMore = hasMore;
        }
    }

    private AppLogsApi() {
    }

    static Page fetchPage(Context context, Long beforeId) throws Exception {
        ServerEndpointStore.Endpoint store = ServerEndpointStore.read(context);
        StringBuilder path = new StringBuilder("/api/logs?limit=").append(PAGE_SIZE);
        if (beforeId != null && beforeId > 0) {
            path.append("&beforeId=").append(beforeId);
        }
        JSONObject body = CloudPhoneApiClient.requestProtectedJson(
                context, store.host, store.port, path.toString(), "GET"
        );
        Page page = new Page(
                body.isNull("nextBeforeId") ? null : body.optLong("nextBeforeId"),
                body.optBoolean("hasMore", false)
        );
        JSONArray logs = body.optJSONArray("logs");
        if (logs != null) {
            for (int i = 0; i < logs.length(); i += 1) {
                page.logs.add(LogEntry.fromJson(logs.getJSONObject(i)));
            }
        }
        return page;
    }

    static void append(Context context, LogEntry entry) throws Exception {
        ServerEndpointStore.Endpoint store = ServerEndpointStore.read(context);
        JSONObject payload = new JSONObject();
        JSONObject item = new JSONObject();
        item.put("timestamp", entry.toIsoTimestamp());
        item.put("level", entry.level);
        item.put("category", entry.category);
        item.put("event", entry.event);
        item.put("message", entry.message);
        if (entry.deviceSerial != null) {
            item.put("deviceSerial", entry.deviceSerial);
        }
        if (entry.deviceName != null) {
            item.put("deviceName", entry.deviceName);
        }
        payload.put("entry", item);
        CloudPhoneApiClient.postProtectedJson(context, store.host, store.port, "/api/logs", payload);
    }

    static void clear(Context context) throws Exception {
        ServerEndpointStore.Endpoint store = ServerEndpointStore.read(context);
        CloudPhoneApiClient.requestProtectedJson(
                context, store.host, store.port, "/api/logs", "DELETE", null
        );
    }
}
