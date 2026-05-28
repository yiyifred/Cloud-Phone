package com.yiyi.cloud_phone;

import android.content.Context;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.view.LayoutInflater;
import android.view.View;
import android.view.ViewGroup;
import android.widget.TextView;

import androidx.annotation.NonNull;
import androidx.annotation.Nullable;
import androidx.fragment.app.Fragment;
import androidx.recyclerview.widget.LinearLayoutManager;
import androidx.recyclerview.widget.RecyclerView;
import androidx.swiperefreshlayout.widget.SwipeRefreshLayout;

import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

public class DevicesFragment extends Fragment implements DeviceCardAdapter.ScreenshotRequester {
    private static final String PREF_NAME = "cloud_phone_settings";
    private static final String KEY_SERVER_HOST = "server_host";
    private static final String KEY_SERVER_PORT = "server_port";
    private static final long DEVICE_INTERVAL_MS = 1000L;
    private static final long SCREENSHOT_INTERVAL_MS = 5000L;

    private final ExecutorService networkExecutor = Executors.newFixedThreadPool(2);
    private final Handler mainHandler = new Handler(Looper.getMainLooper());

    private SwipeRefreshLayout swipeRefresh;
    private TextView textLastRefresh;
    private TextView textStatusPill;
    private TextView textOfflineHint;
    private TextView textError;
    private TextView textEmpty;
    private RecyclerView recyclerDevices;
    private DeviceCardAdapter adapter;
    private View buttonAddDevice;

    private long screenshotTick;
    private long lastRefreshedAt;
    private boolean pollingActive;
    private final List<DeviceItem> displayedDevices = new ArrayList<>();
    private final Runnable devicePollRunnable = new Runnable() {
        @Override
        public void run() {
            refreshDevices(false);
            if (pollingActive) {
                mainHandler.postDelayed(this, DEVICE_INTERVAL_MS);
            }
        }
    };
    private final Runnable screenshotPollRunnable = new Runnable() {
        @Override
        public void run() {
            screenshotTick += 1L;
            if (adapter != null) {
                adapter.bumpScreenshotTick(screenshotTick);
            }
            if (pollingActive) {
                mainHandler.postDelayed(this, SCREENSHOT_INTERVAL_MS);
            }
        }
    };

    @Nullable
    @Override
    public View onCreateView(
            @NonNull LayoutInflater inflater,
            @Nullable ViewGroup container,
            @Nullable Bundle savedInstanceState
    ) {
        return inflater.inflate(R.layout.fragment_devices, container, false);
    }

    @Override
    public void onViewCreated(@NonNull View view, @Nullable Bundle savedInstanceState) {
        super.onViewCreated(view, savedInstanceState);
        swipeRefresh = view.findViewById(R.id.swipeRefresh);
        textLastRefresh = view.findViewById(R.id.textLastRefresh);
        textStatusPill = view.findViewById(R.id.textStatusPill);
        textOfflineHint = view.findViewById(R.id.textOfflineHint);
        textError = view.findViewById(R.id.textError);
        textEmpty = view.findViewById(R.id.textEmpty);
        recyclerDevices = view.findViewById(R.id.recyclerDevices);
        buttonAddDevice = view.findViewById(R.id.buttonAddDevice);

        adapter = new DeviceCardAdapter(requireContext(), this);
        recyclerDevices.setLayoutManager(new LinearLayoutManager(requireContext()));
        recyclerDevices.setAdapter(adapter);

        swipeRefresh.setColorSchemeResources(R.color.auth_primary);
        swipeRefresh.setOnRefreshListener(() -> refreshDevices(true));
        buttonAddDevice.setOnClickListener(v -> AddDeviceBottomSheet.show(this));
        updateHeader(new ArrayList<>(), false, "");
    }

    List<DeviceItem> getDisplayedDevices() {
        return new ArrayList<>(displayedDevices);
    }

    void refreshDevicesNow() {
        refreshDevices(false);
    }

    @Override
    public void onResume() {
        super.onResume();
        startPolling();
    }

    @Override
    public void onPause() {
        stopPolling();
        super.onPause();
    }

    @Override
    public void onDestroy() {
        networkExecutor.shutdownNow();
        super.onDestroy();
    }

    @Override
    public void requestScreenshot(String serial, long tick, DeviceCardAdapter.ScreenshotCallback callback) {
        ServerEndpoint endpoint = readServerEndpoint();
        if (endpoint == null) {
            callback.onFailure(serial);
            return;
        }
        Context appContext = requireContext().getApplicationContext();
        networkExecutor.execute(() -> {
            try {
                byte[] bytes = CloudPhoneApiClient.fetchScreenshot(
                        appContext,
                        endpoint.host,
                        endpoint.port,
                        serial,
                        tick
                );
                callback.onSuccess(serial, bytes);
            } catch (Exception error) {
                callback.onFailure(serial);
            }
        });
    }

    private void startPolling() {
        if (SessionKeyStore.load(requireContext()).isEmpty()) {
            showSessionError();
            return;
        }
        pollingActive = true;
        refreshDevices(true);
        mainHandler.removeCallbacks(devicePollRunnable);
        mainHandler.removeCallbacks(screenshotPollRunnable);
        mainHandler.postDelayed(devicePollRunnable, DEVICE_INTERVAL_MS);
        mainHandler.postDelayed(screenshotPollRunnable, SCREENSHOT_INTERVAL_MS);
    }

    private void stopPolling() {
        pollingActive = false;
        mainHandler.removeCallbacks(devicePollRunnable);
        mainHandler.removeCallbacks(screenshotPollRunnable);
    }

    private void refreshDevices(boolean manualRefresh) {
        ServerEndpoint endpoint = readServerEndpoint();
        if (endpoint == null) {
            finishRefreshing();
            return;
        }
        Context appContext = requireContext().getApplicationContext();
        networkExecutor.execute(() -> {
            try {
                List<DeviceItem> devices = DeviceFormatter.sort(
                        CloudPhoneApiClient.fetchDevices(appContext, endpoint.host, endpoint.port)
                );
                lastRefreshedAt = System.currentTimeMillis();
                mainHandler.post(() -> {
                    displayedDevices.clear();
                    displayedDevices.addAll(devices);
                    adapter.submitList(devices);
                    updateHeader(displayedDevices, false, "");
                    finishRefreshing();
                });
            } catch (Exception error) {
                String message = error.getMessage();
                if ("missing_session_key".equals(message)) {
                    message = getString(R.string.devices_missing_session);
                } else if (message == null || message.isEmpty()) {
                    message = getString(R.string.devices_load_failed);
                }
                String finalMessage = message;
                mainHandler.post(() -> {
                    updateHeader(displayedDevices, true, finalMessage);
                    finishRefreshing();
                });
            }
        });
    }

    private void showSessionError() {
        updateHeader(new ArrayList<>(), true, getString(R.string.devices_missing_session));
        textEmpty.setVisibility(View.GONE);
        recyclerDevices.setVisibility(View.GONE);
    }

    private void updateHeader(List<DeviceItem> devices, boolean hasError, String errorMessage) {
        String refreshLabel = DeviceFormatter.formatRefreshTime(lastRefreshedAt);
        if (refreshLabel.isEmpty()) {
            textLastRefresh.setText(getString(R.string.devices_refresh_never));
        } else {
            textLastRefresh.setText(getString(R.string.devices_last_update, refreshLabel));
        }

        if (hasError) {
            textError.setVisibility(View.VISIBLE);
            textError.setText(errorMessage);
        } else {
            textError.setVisibility(View.GONE);
        }

        int online = DeviceFormatter.countOnline(devices);
        int total = devices.size();
        if (devices.isEmpty() && !hasError) {
            textStatusPill.setText(getString(R.string.devices_empty));
            textEmpty.setVisibility(View.VISIBLE);
            textEmpty.setText(getString(R.string.devices_not_found));
            recyclerDevices.setVisibility(View.GONE);
        } else if (devices.isEmpty()) {
            textStatusPill.setText(getString(R.string.devices_loading));
            textEmpty.setVisibility(View.GONE);
            recyclerDevices.setVisibility(View.GONE);
        } else {
            textStatusPill.setText(getString(R.string.devices_online_summary, online, total));
            textEmpty.setVisibility(View.GONE);
            recyclerDevices.setVisibility(View.VISIBLE);
        }

        int offline = total - online;
        if (offline > 0) {
            textOfflineHint.setVisibility(View.VISIBLE);
            textOfflineHint.setText(getString(R.string.devices_offline_hint, offline));
        } else {
            textOfflineHint.setVisibility(View.GONE);
        }
    }

    private void finishRefreshing() {
        if (swipeRefresh != null) {
            swipeRefresh.setRefreshing(false);
        }
    }

    private ServerEndpoint readServerEndpoint() {
        Context context = getContext();
        if (context == null) {
            return null;
        }
        String host = context.getSharedPreferences(PREF_NAME, Context.MODE_PRIVATE)
                .getString(KEY_SERVER_HOST, "");
        int port = context.getSharedPreferences(PREF_NAME, Context.MODE_PRIVATE)
                .getInt(KEY_SERVER_PORT, LanServerDefaults.DEFAULT_PORT);
        if (host.isEmpty()) {
            return null;
        }
        return new ServerEndpoint(host, port);
    }

    private static final class ServerEndpoint {
        final String host;
        final int port;

        ServerEndpoint(String host, int port) {
            this.host = host;
            this.port = port;
        }
    }
}
