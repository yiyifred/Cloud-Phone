package com.yiyi.cloud_phone.multiapp;

import android.app.AlertDialog;
import android.content.Context;
import android.content.SharedPreferences;
import android.text.Editable;
import android.text.TextWatcher;
import android.view.LayoutInflater;
import android.view.View;
import android.view.ViewGroup;
import android.widget.EditText;
import android.widget.ImageView;
import android.widget.ProgressBar;
import android.widget.PopupWindow;
import android.widget.TextView;
import android.widget.Toast;

import androidx.appcompat.app.AppCompatActivity;
import androidx.recyclerview.widget.GridLayoutManager;
import androidx.recyclerview.widget.LinearLayoutManager;
import androidx.recyclerview.widget.RecyclerView;

import com.yiyi.cloud_phone.CloudPhoneApiClient;
import com.yiyi.cloud_phone.R;
import com.yiyi.cloud_phone.settings.ServerEndpointStore;

import org.json.JSONArray;
import org.json.JSONObject;

import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.atomic.AtomicBoolean;

public final class MultiAppStartMenuDialog {
    public static final class AppItem {
        public final String packageName;
        public final String label;
        public final String activity;
        public final String iconDataUrl;
        public final String orientation;

        public AppItem(String packageName, String label, String activity, String iconDataUrl, String orientation) {
            this.packageName = packageName;
            this.label = label;
            this.activity = activity;
            this.iconDataUrl = iconDataUrl;
            this.orientation = orientation;
        }
    }

    public interface LaunchListener {
        void onLaunch(AppItem item);
    }

    public interface FullscreenListener {
        void onToggleFullscreen();
    }

    private MultiAppStartMenuDialog() {
    }

    public static void show(
            AppCompatActivity activity,
            View anchor,
            String serial,
            LaunchListener listener,
            FullscreenListener fullscreenListener,
            boolean inFullscreen
    ) {
        View content = LayoutInflater.from(activity).inflate(R.layout.dialog_multi_app_start_menu, null);
        RecyclerView recycler = content.findViewById(R.id.recyclerStartMenuApps);
        EditText search = content.findViewById(R.id.editStartMenuSearch);
        TextView status = content.findViewById(R.id.textStartMenuStatus);
        ProgressBar progress = content.findViewById(R.id.progressStartMenu);
        TextView fullscreenText = content.findViewById(R.id.textStartMenuFullscreen);
        ImageView fullscreenIcon = content.findViewById(R.id.imageStartMenuFullscreen);
        MultiAppStartMenuAdapter adapter = new MultiAppStartMenuAdapter();
        recycler.setAdapter(adapter);
        List<AppItem> allApps = new ArrayList<>();
        status.setVisibility(View.VISIBLE);
        status.setText("正在加载应用…");
        progress.setVisibility(View.VISIBLE);
        progress.setIndeterminate(true);
        progress.setProgress(0);
        recycler.setVisibility(View.GONE);

        int width = Math.min(
                MultiAppFlyoutPopup.fitWidth(activity, 560),
                Math.round(activity.getResources().getDisplayMetrics().widthPixels * 0.92f)
        );
        int maxHeight = MultiAppFlyoutPopup.maxHeightAbove(activity, anchor);
        content.setLayoutParams(new ViewGroup.LayoutParams(width, maxHeight));
        PopupWindow popup = MultiAppFlyoutPopup.showAbove(activity, anchor, content, width, maxHeight);

        adapter.setOnAppClickListener(item -> {
            popup.dismiss();
            listener.onLaunch(item);
        });

        ExecutorService executor = Executors.newSingleThreadExecutor();
        executor.execute(() -> {
            try {
                ServerEndpointStore.Endpoint store = ServerEndpointStore.read(activity);

                // Icon helper consent: without it, show only package names.
                String prefName = "cloud_phone_icon_helper";
                SharedPreferences prefs = activity.getSharedPreferences(prefName, Context.MODE_PRIVATE);
                String consentKey = "icon_helper_allowed." + serial;
                boolean allowIcons;
                if (prefs.contains(consentKey)) {
                    allowIcons = prefs.getBoolean(consentKey, false);
                } else {
                    allowIcons = promptIconHelperConsent(activity);
                    prefs.edit().putBoolean(consentKey, allowIcons).apply();
                }

                JSONObject iconStatus = null;
                if (allowIcons) {
                    iconStatus = CloudPhoneApiClient.iconHelperStatus(activity, store.host, store.port, serial);
                    activity.runOnUiThread(() -> status.setText("正在安装 / 更新图标服务…"));
                    activity.runOnUiThread(() -> {
                        progress.setIndeterminate(true);
                        progress.setProgress(0);
                    });
                    CloudPhoneApiClient.iconHelperEnsure(activity, store.host, store.port, serial, Boolean.FALSE);
                } else {
                    activity.runOnUiThread(() -> status.setText("正在加载包名…"));
                    activity.runOnUiThread(() -> {
                        progress.setIndeterminate(true);
                        progress.setProgress(0);
                    });
                }

                if (allowIcons) {
                    // Poll extraction progress and update the progress bar.
                    long deadline = System.currentTimeMillis() + 10L * 60_000L;
                    while (System.currentTimeMillis() < deadline) {
                        JSONObject progressRes = CloudPhoneApiClient.iconHelperProgress(activity, store.host, store.port, serial);
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
                            final int percent = safeTotal > 0 ? Math.max(0, Math.min(100, Math.round((done * 100f) / safeTotal))) : 0;
                            final String label = safeTotal > 0
                                    ? "正在提取（" + done + "/" + safeTotal + "）" + (current.isEmpty() ? "" : " · " + current)
                                    : "正在提取（" + done + "）" + (current.isEmpty() ? "" : " · " + current);
                            final int safePercent = percent;
                            activity.runOnUiThread(() -> {
                                progress.setIndeterminate(false);
                                progress.setMax(100);
                                progress.setProgress(safePercent);
                                status.setText(label);
                            });
                        } else if ("done".equals(phase)) {
                            activity.runOnUiThread(() -> {
                                progress.setIndeterminate(false);
                                progress.setMax(100);
                                progress.setProgress(100);
                                status.setText("图标提取完成");
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
                }

                boolean packageNamesOnly = !allowIcons;
                JSONObject result = CloudPhoneApiClient.listLauncherApps(
                        activity, store.host, store.port, serial, false, packageNamesOnly
                );
                JSONArray apps = result.optJSONArray("apps");
                List<AppItem> parsed = new ArrayList<>();
                if (apps != null) {
                    for (int i = 0; i < apps.length(); i++) {
                        JSONObject app = apps.optJSONObject(i);
                        if (app == null) {
                            continue;
                        }
                        String pkg = app.optString("packageName", "");
                        if (pkg.isEmpty()) {
                            continue;
                        }
                        parsed.add(new AppItem(
                                pkg,
                                app.optString("label", pkg),
                                app.optString("activity", ""),
                                app.optString("iconDataUrl", null),
                                "portrait"
                        ));
                    }
                }
                activity.runOnUiThread(() -> {
                    progress.setVisibility(View.GONE);
                    allApps.clear();
                    allApps.addAll(parsed);
                    applyList(recycler, adapter, status, allApps, "");
                });
            } catch (Exception error) {
                activity.runOnUiThread(() -> {
                    progress.setVisibility(View.GONE);
                    status.setVisibility(View.VISIBLE);
                    status.setText(error.getMessage() == null ? "加载失败" : error.getMessage());
                    status.setTextColor(0xFFC42B1C);
                    recycler.setVisibility(View.GONE);
                    Toast.makeText(activity, error.getMessage(), Toast.LENGTH_SHORT).show();
                });
            } finally {
                executor.shutdown();
            }
        });

        search.addTextChangedListener(new TextWatcher() {
            @Override
            public void beforeTextChanged(CharSequence s, int start, int count, int after) {
            }

            @Override
            public void onTextChanged(CharSequence s, int start, int before, int count) {
                String q = s == null ? "" : s.toString().trim().toLowerCase(Locale.ROOT);
                applyList(recycler, adapter, status, allApps, q);
            }

            @Override
            public void afterTextChanged(Editable s) {
            }
        });

        fullscreenText.setText(inFullscreen
                ? R.string.multi_app_exit_fullscreen
                : R.string.multi_app_toggle_fullscreen);
        fullscreenIcon.setImageResource(inFullscreen
                ? R.drawable.ic_win11_exit_fullscreen
                : R.drawable.ic_win11_fullscreen);
        content.findViewById(R.id.buttonStartMenuFullscreen).setOnClickListener(v -> {
            popup.dismiss();
            if (fullscreenListener != null) {
                fullscreenListener.onToggleFullscreen();
            }
        });
    }

    private static void applyList(
            RecyclerView recycler,
            MultiAppStartMenuAdapter adapter,
            TextView status,
            List<AppItem> allApps,
            String query
    ) {
        List<AppItem> shown = new ArrayList<>();
        if (query.isEmpty()) {
            shown.addAll(allApps);
            recycler.setLayoutManager(new GridLayoutManager(recycler.getContext(), 6));
        } else {
            for (AppItem item : allApps) {
                if (item.label.toLowerCase(Locale.ROOT).contains(query)
                        || item.packageName.toLowerCase(Locale.ROOT).contains(query)) {
                    shown.add(item);
                }
            }
            recycler.setLayoutManager(new LinearLayoutManager(recycler.getContext()));
        }
        adapter.setItems(shown);
        if (shown.isEmpty()) {
            status.setVisibility(View.VISIBLE);
            status.setTextColor(0xFF666666);
            status.setText(query.isEmpty() ? "暂无应用" : "无匹配应用");
            recycler.setVisibility(View.GONE);
        } else {
            status.setVisibility(View.GONE);
            recycler.setVisibility(View.VISIBLE);
        }
    }

    private static boolean promptIconHelperConsent(AppCompatActivity activity) {
        CountDownLatch latch = new CountDownLatch(1);
        AtomicBoolean allowed = new AtomicBoolean(false);

        activity.runOnUiThread(() -> new AlertDialog.Builder(activity)
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
}
