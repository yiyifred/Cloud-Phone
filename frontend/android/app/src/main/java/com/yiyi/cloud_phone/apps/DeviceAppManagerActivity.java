package com.yiyi.cloud_phone.apps;

import android.app.Activity;
import android.app.AlertDialog;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.os.Bundle;
import android.text.Editable;
import android.text.TextWatcher;
import android.view.View;
import android.widget.EditText;
import android.widget.ImageButton;
import android.widget.ProgressBar;
import android.widget.TextView;
import android.widget.Toast;

import androidx.activity.EdgeToEdge;
import androidx.annotation.Nullable;
import androidx.appcompat.app.AppCompatActivity;
import androidx.core.graphics.Insets;
import androidx.core.view.ViewCompat;
import androidx.core.view.WindowInsetsCompat;
import androidx.recyclerview.widget.DividerItemDecoration;
import androidx.recyclerview.widget.LinearLayoutManager;
import androidx.recyclerview.widget.RecyclerView;
import androidx.swiperefreshlayout.widget.SwipeRefreshLayout;

import com.yiyi.cloud_phone.AppIcons;
import com.yiyi.cloud_phone.CloudPhoneApiClient;
import com.yiyi.cloud_phone.R;
import com.yiyi.cloud_phone.files.DeviceFileExplorerActivity;
import com.yiyi.cloud_phone.logs.AppEventLogger;
import com.yiyi.cloud_phone.settings.ServerEndpointStore;

import org.json.JSONArray;
import org.json.JSONObject;

import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.atomic.AtomicBoolean;

public class DeviceAppManagerActivity extends AppCompatActivity {
    public static final String EXTRA_SERIAL = "device_serial";
    public static final String EXTRA_DISPLAY_NAME = "device_display_name";

    private String deviceSerial;
    private String deviceDisplayName;
    private AppItemAdapter adapter;
    private SwipeRefreshLayout swipeRefresh;
    private TextView textStatus;
    private ProgressBar progressAppManager;
    private final ExecutorService executor = Executors.newSingleThreadExecutor();

    public static void open(Context context, String serial, String displayName) {
        Intent intent = new Intent(context, DeviceAppManagerActivity.class);
        intent.putExtra(EXTRA_SERIAL, serial);
        intent.putExtra(EXTRA_DISPLAY_NAME, displayName);
        context.startActivity(intent);
    }

    @Override
    protected void onCreate(@Nullable Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        EdgeToEdge.enable(this);
        setContentView(R.layout.activity_device_app_manager);
        ViewCompat.setOnApplyWindowInsetsListener(findViewById(R.id.appManagerRoot), (v, insets) -> {
            Insets bars = insets.getInsets(WindowInsetsCompat.Type.systemBars());
            v.setPadding(bars.left, bars.top, bars.right, bars.bottom);
            return insets;
        });

        deviceSerial = getIntent().getStringExtra(EXTRA_SERIAL);
        if (deviceSerial == null) deviceSerial = "";
        deviceDisplayName = getIntent().getStringExtra(EXTRA_DISPLAY_NAME);
        if (deviceDisplayName == null) deviceDisplayName = deviceSerial;

        TextView titleView = findViewById(R.id.textAppManagerTitle);
        titleView.setText(getString(R.string.apps_title) + " – " + deviceDisplayName);

        ImageButton backBtn = findViewById(R.id.buttonAppManagerBack);
        backBtn.setImageDrawable(AppIcons.back(this));
        backBtn.setOnClickListener(v -> finish());

        ImageButton refreshBtn = findViewById(R.id.buttonAppManagerRefresh);
        refreshBtn.setImageDrawable(AppIcons.navRefresh(this));
        refreshBtn.setOnClickListener(v -> loadApps());

        ImageButton installBtn = findViewById(R.id.buttonInstallApp);
        installBtn.setImageDrawable(AppIcons.install(this));
        installBtn.setOnClickListener(v -> triggerInstall());

        EditText searchEdit = findViewById(R.id.editAppSearch);
        searchEdit.addTextChangedListener(new TextWatcher() {
            @Override public void beforeTextChanged(CharSequence s, int start, int count, int after) {}
            @Override public void onTextChanged(CharSequence s, int start, int before, int count) {
                adapter.setFilter(s.toString());
                updateCount();
            }
            @Override public void afterTextChanged(Editable s) {}
        });

        textStatus = findViewById(R.id.textAppStatus);
        progressAppManager = findViewById(R.id.progressAppManager);
        progressAppManager.setVisibility(View.GONE);

        RecyclerView recycler = findViewById(R.id.recyclerApps);
        recycler.setLayoutManager(new LinearLayoutManager(this));
        recycler.addItemDecoration(new DividerItemDecoration(this, DividerItemDecoration.VERTICAL));

        adapter = new AppItemAdapter();
        adapter.setOnAppClickListener(this::showAppDetail);
        recycler.setAdapter(adapter);

        swipeRefresh = findViewById(R.id.swipeRefreshApps);
        swipeRefresh.setOnRefreshListener(this::loadApps);

        loadApps();
    }

    private void loadApps() {
        swipeRefresh.setRefreshing(true);
        textStatus.setVisibility(View.VISIBLE);
        progressAppManager.setVisibility(View.VISIBLE);
        progressAppManager.setIndeterminate(true);
        progressAppManager.setProgress(0);
        textStatus.setText(R.string.apps_loading);

        ServerEndpointStore.Endpoint store = ServerEndpointStore.read(this);
        executor.execute(() -> {
            try {
                String prefName = "cloud_phone_icon_helper";
                SharedPreferences prefs = getSharedPreferences(prefName, Context.MODE_PRIVATE);
                String consentKey = "icon_helper_allowed." + deviceSerial;

                boolean allowIcons;
                if (prefs.contains(consentKey)) {
                    allowIcons = prefs.getBoolean(consentKey, false);
                } else {
                    allowIcons = promptIconHelperConsent();
                    prefs.edit().putBoolean(consentKey, allowIcons).apply();
                }

                if (allowIcons) {
                    runOnUiThread(() -> {
                        textStatus.setText("正在安装 / 更新图标服务…");
                        progressAppManager.setIndeterminate(true);
                        progressAppManager.setProgress(0);
                    });
                    CloudPhoneApiClient.iconHelperEnsure(this, store.host, store.port, deviceSerial, false);

                    long deadline = System.currentTimeMillis() + 10L * 60_000L;
                    while (System.currentTimeMillis() < deadline) {
                        JSONObject progressRes = CloudPhoneApiClient.iconHelperProgress(this, store.host, store.port, deviceSerial);
                        JSONObject p = progressRes.optJSONObject("progress");
                        if (p == null) {
                            throw new RuntimeException("icon_helper_progress_missing");
                        }

                        String phase = p.optString("phase", "running");
                        int total = p.optInt("total", 0);
                        int done = p.optInt("done", 0);
                        String current = p.optString("current", "");

                        if ("running".equals(phase)) {
                            final int safeTotal = total > 0 ? total : 0;
                            final int percent = safeTotal > 0
                                    ? Math.max(0, Math.min(100, Math.round((done * 100f) / safeTotal)))
                                    : 0;
                            final String label = safeTotal > 0
                                    ? "正在提取（" + done + "/" + safeTotal + "）" + (current.isEmpty() ? "" : " · " + current)
                                    : "正在提取（" + done + "）" + (current.isEmpty() ? "" : " · " + current);
                            final int safePercent = percent;
                            runOnUiThread(() -> {
                                progressAppManager.setIndeterminate(false);
                                progressAppManager.setMax(100);
                                progressAppManager.setProgress(safePercent);
                                textStatus.setText(label);
                            });
                        } else if ("done".equals(phase)) {
                            runOnUiThread(() -> {
                                progressAppManager.setIndeterminate(false);
                                progressAppManager.setMax(100);
                                progressAppManager.setProgress(100);
                                textStatus.setText("图标提取完成");
                            });
                            break;
                        } else if ("error".equals(phase)) {
                            String message = p.optString("message", "extract_failed");
                            throw new RuntimeException(message);
                        }

                        try {
                            Thread.sleep(600);
                        } catch (InterruptedException ignored) {
                            // keep polling until deadline
                        }
                    }
                } else {
                    runOnUiThread(() -> {
                        textStatus.setText("正在加载包名…");
                        progressAppManager.setIndeterminate(true);
                        progressAppManager.setProgress(0);
                    });
                }

                JSONObject result = CloudPhoneApiClient.listApps(this, store.host, store.port, deviceSerial);
                JSONArray appsJson = result.optJSONArray("apps");
                List<AppItem> apps = new ArrayList<>();
                if (appsJson != null) {
                    for (int i = 0; i < appsJson.length(); i++) {
                        apps.add(new AppItem(appsJson.getJSONObject(i)));
                    }
                }
                AppEventLogger.get().info("apps", "load", "Loaded " + apps.size() + " apps for " + deviceSerial);
                runOnUiThread(() -> {
                    swipeRefresh.setRefreshing(false);
                    progressAppManager.setVisibility(View.GONE);
                    adapter.setShowIcons(allowIcons);
                    adapter.setApps(apps);
                    updateCount();
                    textStatus.setVisibility(View.GONE);
                });
            } catch (Exception e) {
                runOnUiThread(() -> {
                    swipeRefresh.setRefreshing(false);
                    progressAppManager.setVisibility(View.GONE);
                    textStatus.setText(e.getMessage());
                    textStatus.setVisibility(View.VISIBLE);
                });
            }
        });
    }

    private void updateCount() {
        int count = adapter.getFilteredApps().size();
        // Count shown in textStatus when no error
    }

    private boolean promptIconHelperConsent() {
        CountDownLatch latch = new CountDownLatch(1);
        AtomicBoolean allowed = new AtomicBoolean(false);

        runOnUiThread(() -> new AlertDialog.Builder(this)
                .setTitle("安装图标服务应用")
                .setMessage("需要在设备上安装一个极小的服务应用，用于提取应用名称与图标（图标将通过 ADB 读取）。是否允许安装？")
                .setCancelable(false)
                .setPositiveButton("允许安装", (d, w) -> {
                    allowed.set(true);
                    latch.countDown();
                })
                .setNegativeButton("暂不安装", (d, w) -> {
                    allowed.set(false);
                    latch.countDown();
                })
                .show());

        try {
            latch.await();
        } catch (InterruptedException ignored) {
            Thread.currentThread().interrupt();
        }
        return allowed.get();
    }

    private void showAppDetail(AppItem app) {
        AppDetailBottomSheet sheet = AppDetailBottomSheet.newInstance(app, deviceSerial, deviceDisplayName);
        sheet.setOnActionListener(new AppDetailBottomSheet.OnActionListener() {
            @Override
            public void onUninstalled(String packageName) {
                loadApps();
            }

            @Override
            public void onFrozenChanged(String packageName, boolean frozen) {
                loadApps();
            }

            @Override
            public void onOpenDataDir(String path) {
                DeviceFileExplorerActivity.open(DeviceAppManagerActivity.this, deviceSerial, deviceDisplayName, path);
            }
        });
        sheet.show(getSupportFragmentManager(), "app_detail");
    }

    private void triggerInstall() {
        Intent intent = new Intent(Intent.ACTION_GET_CONTENT);
        intent.setType("application/vnd.android.package-archive");
        intent.addCategory(Intent.CATEGORY_OPENABLE);
        startActivityForResult(Intent.createChooser(intent, getString(R.string.apps_install)), 1002);
    }

    @Override
    protected void onActivityResult(int requestCode, int resultCode, @Nullable Intent data) {
        super.onActivityResult(requestCode, resultCode, data);
        if (requestCode == 1002 && resultCode == Activity.RESULT_OK && data != null && data.getData() != null) {
            android.net.Uri fileUri = data.getData();
            ServerEndpointStore.Endpoint store = ServerEndpointStore.read(this);
            executor.execute(() -> {
                try (java.io.InputStream is = getContentResolver().openInputStream(fileUri)) {
                    CloudPhoneApiClient.installApp(this, store.host, store.port, deviceSerial, is);
                    runOnUiThread(() -> {
                        Toast.makeText(this, R.string.apps_install_success, Toast.LENGTH_SHORT).show();
                        loadApps();
                    });
                } catch (Exception e) {
                    runOnUiThread(() ->
                            Toast.makeText(this, getString(R.string.apps_install_failed, e.getMessage()), Toast.LENGTH_SHORT).show());
                }
            });
        }
    }

    @Override
    protected void onDestroy() {
        executor.shutdown();
        super.onDestroy();
    }
}
