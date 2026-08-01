package com.yiyi.cloud_phone.multiapp;

import android.view.View;
import android.widget.FrameLayout;
import android.widget.ImageButton;
import android.widget.TextView;

import androidx.appcompat.app.AppCompatActivity;

import com.yiyi.cloud_phone.CloudPhoneApiClient;
import com.yiyi.cloud_phone.R;
import com.yiyi.cloud_phone.cast.CastSessionController;
import com.yiyi.cloud_phone.cast.MultiAppWindowCastSession;
import com.yiyi.cloud_phone.settings.ServerEndpointStore;
import com.yiyi.cloud_phone.workspace.MultiAppCastOptions;

import java.util.HashMap;
import java.util.HashSet;
import java.util.Map;
import java.util.Set;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

final class MultiAppDesktopController implements MultiAppWindowManager.Listener,
        MultiAppTaskbarController.Host, MultiAppQuickSettingsDialog.TrayListener {
    interface Host {
        void onExitDesktop();

        void onSwitchMirror();

        void onToggleFullscreen();

        default boolean isFullscreenDesktop() {
            return false;
        }
    }

    private static final class WindowBundle {
        MultiAppWindowCastSession cast;
        MultiAppAppExitWatcher exitWatch;
        MultiAppVdResizeScheduler resizeScheduler;
    }

    private final AppCompatActivity activity;
    private final Host host;
    private final String serial;
    private final int deviceSdk;
    private final MultiAppWindowManager windowManager = new MultiAppWindowManager();
    private final Map<String, View> windowViews = new HashMap<>();
    private final Map<String, WindowBundle> bundles = new HashMap<>();
    private final ExecutorService executor = Executors.newCachedThreadPool();
    private final MultiAppLaunchQueue launchQueue = new MultiAppLaunchQueue();
    private final MultiAppTaskbarController taskbar;

    private FrameLayout desktopCanvas;
    private View taskbarRoot;

    MultiAppDesktopController(AppCompatActivity activity, Host host, String serial, int deviceSdk) {
        this.activity = activity;
        this.host = host;
        this.serial = serial;
        this.deviceSdk = deviceSdk;
        this.taskbar = new MultiAppTaskbarController(activity, this);
        windowManager.setListener(this);
    }

    void bind(View root) {
        desktopCanvas = root.findViewById(R.id.desktopCanvas);
        taskbarRoot = root.findViewById(R.id.taskbar);
        float density = activity.getResources().getDisplayMetrics().density;
        MultiAppWindowState.configureTitleBarPx(Math.round(MultiAppWindowState.TITLE_BAR_DP * density));
        taskbar.bind(taskbarRoot);
        ImageButton back = root.findViewById(R.id.buttonDesktopBack);
        if (back != null) {
            // Web has no floating back; exit fullscreen via Start menu.
            back.setVisibility(View.GONE);
        }
        taskbar.updateClock();
    }

    void onClockTick() {
        taskbar.updateClock();
    }

    void launchApp(MultiAppStartMenuDialog.AppItem app) {
        int canvasW = Math.max(desktopCanvas.getWidth(), 800);
        int canvasH = Math.max(desktopCanvas.getHeight(), 480);
        String orientation = app.orientation == null ? "portrait" : app.orientation;
        MultiAppWindowState win = windowManager.openOrFocusApp(
                app.packageName, app.label, orientation, app.iconDataUrl, app.activity, canvasW, canvasH
        );
        ensureCastSession(win);
        launchQueue.enqueue(() -> {
            try {
                ServerEndpointStore.Endpoint store = ServerEndpointStore.read(activity);
                String fetched = CloudPhoneApiClient.fetchAppOrientation(
                        activity, store.host, store.port, serial, app.packageName
                );
                activity.runOnUiThread(() -> windowManager.setOrientation(win.id, fetched));
            } catch (Exception ignored) {
            }
            try {
                Thread.sleep(400L);
            } catch (InterruptedException ignored) {
            }
        });
    }

    void switchToMirror() {
        for (String id : bundles.keySet().toArray(new String[0])) {
            closeWindow(id, false);
        }
        ServerEndpointStore.Endpoint store = ServerEndpointStore.read(activity);
        CastSessionController.stop(activity, store.host, store.port, serial);
        launchQueue.shutdown();
        host.onSwitchMirror();
    }

    void exitDesktop() {
        for (String id : bundles.keySet().toArray(new String[0])) {
            closeWindow(id, false);
        }
        ServerEndpointStore.Endpoint store = ServerEndpointStore.read(activity);
        CastSessionController.stop(activity, store.host, store.port, serial);
        launchQueue.shutdown();
        host.onExitDesktop();
    }

    void release() {
        for (WindowBundle bundle : bundles.values()) {
            releaseBundle(bundle, false);
        }
        bundles.clear();
        executor.shutdownNow();
        launchQueue.shutdown();
    }

    @Override
    public void onWindowsChanged() {
        syncDesktopViews();
        taskbar.rebuild(windowManager);
        for (MultiAppWindowState win : windowManager.windows()) {
            WindowBundle bundle = bundles.get(win.id);
            if (bundle != null && bundle.resizeScheduler != null && bundle.cast != null && bundle.cast.isReady()) {
                bundle.resizeScheduler.schedule(win.contentWidth(), win.contentHeight());
            }
        }
        syncWindowMaxFps();
    }

    @Override
    public void onFocusChanged(String windowId) {
        View view = windowViews.get(windowId);
        if (view != null) {
            view.bringToFront();
        }
        for (Map.Entry<String, View> entry : windowViews.entrySet()) {
            MultiAppWindowState win = windowManager.find(entry.getKey());
            if (win != null) {
                applyWindowChrome(entry.getValue(), win);
            }
        }
        taskbar.rebuild(windowManager);
        syncWindowMaxFps();
    }

    /** Topmost focused window → 60fps; others → 30fps. */
    private void syncWindowMaxFps() {
        String focused = windowManager.focusedId();
        for (MultiAppWindowState win : windowManager.windows()) {
            WindowBundle bundle = bundles.get(win.id);
            if (bundle == null || bundle.cast == null) {
                continue;
            }
            boolean top = win.id.equals(focused) && !win.minimized;
            bundle.cast.applyMaxFps(MultiAppCastOptions.resolveMaxFps(top, win.minimized));
        }
    }

    @Override
    public void onStartMenu(View anchor) {
        MultiAppStartMenuDialog.show(
                activity, anchor, serial, this::launchApp, host::onToggleFullscreen, host.isFullscreenDesktop());
    }

    @Override
    public void onFocusWindow(String id) {
        windowManager.focusWindow(id);
    }

    @Override
    public void onQuickSettings(View anchor) {
        MultiAppQuickSettingsDialog.show(activity, anchor, serial, this);
    }

    @Override
    public void onClockPanel(View anchor) {
        MultiAppClockPanelDialog.show(activity, anchor, serial);
    }

    @Override
    public void onTrayStatus(boolean wifiEnabled, boolean volumeMuted) {
        taskbar.updateTrayIcons(wifiEnabled, volumeMuted);
    }

    private void syncDesktopViews() {
        Set<String> alive = new HashSet<>();
        for (MultiAppWindowState win : windowManager.windows()) {
            alive.add(win.id);
            if (win.minimized) {
                removeWindowView(win.id);
                continue;
            }
            View frame = windowViews.get(win.id);
            if (frame == null) {
                frame = MultiAppWindowFrameBinder.inflate(activity, desktopCanvas, win, frameHost);
                desktopCanvas.addView(frame);
                windowViews.put(win.id, frame);
                ensureCastSession(win);
            } else {
                MultiAppWindowFrameBinder.refresh(frame, win, frameHost);
            }
        }
        for (String id : windowViews.keySet().toArray(new String[0])) {
            if (!alive.contains(id)) {
                removeWindowView(id);
            }
        }
    }

    private final MultiAppWindowFrameBinder.Host frameHost = new MultiAppWindowFrameBinder.Host() {
        @Override
        public void onFocus(String id) {
            windowManager.focusWindow(id);
        }

        @Override
        public void onMinimize(String id) {
            windowManager.minimizeWindow(id);
        }

        @Override
        public void onMaximize(String id) {
            windowManager.toggleMaximize(id, desktopCanvas.getWidth(), desktopCanvas.getHeight());
        }

        @Override
        public void onClose(String id) {
            closeWindow(id, true);
        }

        @Override
        public void onBack(String id) {
            WindowBundle bundle = bundles.get(id);
            if (bundle != null && bundle.cast != null) {
                bundle.cast.sendBack();
            }
        }

        @Override
        public void onResize(String id, int x, int y, int width, int height) {
            windowManager.updateBounds(id, x, y, width, height);
            windowManager.clampToCanvas(id, desktopCanvas.getWidth(), desktopCanvas.getHeight());
            MultiAppWindowState win = windowManager.find(id);
            View view = windowViews.get(id);
            if (win != null && view != null) {
                applyWindowLayout(view, win);
            }
            scheduleVdResize(id);
        }

        @Override
        public void onMove(String id, int x, int y) {
            MultiAppWindowState win = windowManager.find(id);
            if (win == null) {
                return;
            }
            windowManager.updateBounds(id, x, y, win.width, win.height);
            windowManager.clampToCanvas(id, desktopCanvas.getWidth(), desktopCanvas.getHeight());
            View view = windowViews.get(id);
            if (view != null) {
                applyWindowLayout(view, win);
            }
        }

        @Override
        public void applyLayout(View frame, MultiAppWindowState win) {
            applyWindowLayout(frame, win);
        }
    };

    private void removeWindowView(String id) {
        View frame = windowViews.remove(id);
        if (frame != null) {
            desktopCanvas.removeView(frame);
        }
    }

    private void applyWindowLayout(View frame, MultiAppWindowState win) {
        FrameLayout.LayoutParams lp = (FrameLayout.LayoutParams) frame.getLayoutParams();
        if (lp == null) {
            lp = new FrameLayout.LayoutParams(win.width, win.height);
        }
        lp.width = win.width;
        lp.height = win.height;
        lp.leftMargin = win.x;
        lp.topMargin = win.y;
        frame.setLayoutParams(lp);
        frame.setElevation(win.zIndex + (win.id.equals(windowManager.focusedId()) ? 8 : 0));
        applyWindowChrome(frame, win);
    }

    private void scheduleVdResize(String id) {
        MultiAppWindowState win = windowManager.find(id);
        WindowBundle bundle = bundles.get(id);
        if (win == null || bundle == null || bundle.resizeScheduler == null || bundle.cast == null
                || !bundle.cast.isReady()) {
            return;
        }
        bundle.resizeScheduler.schedule(win.contentWidth(), win.contentHeight());
    }

    private void applyWindowChrome(View frame, MultiAppWindowState win) {
        View titleBar = frame.findViewById(R.id.windowTitleBar);
        if (titleBar == null) {
            return;
        }
        boolean focused = win.id.equals(windowManager.focusedId());
        titleBar.setBackgroundColor(activity.getColor(
                focused ? R.color.win11_titlebar_focused : R.color.win11_titlebar_idle));
        if (win.maximized) {
            frame.setBackgroundColor(0xFFFFFFFF);
            frame.setElevation(focused ? 12 : 4);
        } else {
            frame.setBackgroundResource(R.drawable.bg_win11_window);
        }
    }

    private void ensureCastSession(MultiAppWindowState win) {
        if (bundles.containsKey(win.id)) {
            return;
        }
        View frame = windowViews.get(win.id);
        if (frame == null) {
            return;
        }
        android.view.TextureView texture = frame.findViewById(R.id.windowTexture);
        TextView status = frame.findViewById(R.id.windowStatus);
        status.setText(R.string.multi_app_creating_vd);
        status.setVisibility(View.VISIBLE);
        WindowBundle bundle = new WindowBundle();
        bundle.cast = new MultiAppWindowCastSession(activity, serial, deviceSdk);
        bundle.exitWatch = new MultiAppAppExitWatcher(activity, serial, win.packageName, new MultiAppAppExitWatcher.Callback() {
            @Override
            public void onAppExited() {
                closeWindow(win.id, false);
            }

            @Override
            public void onOffVirtualDisplay() {
                if (bundle.exitWatch != null) {
                    bundle.exitWatch.bumpGrace(12_000L);
                }
                if (bundle.cast != null) {
                    // "+" = force-stop then start on this window's virtual display.
                    bundle.cast.sendStartApp("+" + win.packageName);
                }
            }
        });
        bundle.resizeScheduler = new MultiAppVdResizeScheduler(new MultiAppVdResizeScheduler.ResizeAction() {
            @Override
            public void applyResize(int vdWidth, int vdHeight) {
                win.vdWidth = vdWidth;
                win.vdHeight = vdHeight;
                win.vdDpi = MultiAppWindowLayout.suggestDpiForContent(win.contentWidth(), win.contentHeight());
                if (bundle.cast != null) {
                    bundle.cast.sendResizeDisplay(vdWidth, vdHeight);
                }
            }

            @Override
            public void bumpExitGrace(long ms) {
                if (bundle.exitWatch != null) {
                    bundle.exitWatch.bumpGrace(ms);
                }
            }
        });
        bundle.cast.attach(texture, new MultiAppWindowCastSession.Callback() {
            @Override
            public void onReady() {
                status.setVisibility(View.GONE);
                bundle.resizeScheduler.markCastReady(win.vdWidth, win.vdHeight);
                bundle.exitWatch.bumpGrace(10_000L);
                bundle.exitWatch.setEnabled(true);
                syncWindowMaxFps();
            }

            @Override
            public void onError(String message) {
                status.setText(message);
                status.setVisibility(View.VISIBLE);
            }

            @Override
            public void onVdError(String detail) {
                status.setVisibility(View.GONE);
                MultiAppVdErrorDialog.show(activity, detail,
                        () -> closeWindow(win.id, true),
                        () -> bundle.cast.restart(false),
                        () -> switchToMirror());
            }

            @Override
            public void onReconnecting() {
                status.setText(R.string.multi_app_reconnecting);
                status.setVisibility(View.VISIBLE);
                bundle.exitWatch.bumpGrace(15_000L);
            }
        });
        MultiAppWindowFrameBinder.setupTouch(frame.findViewById(R.id.windowContent), bundle.cast);
        bundles.put(win.id, bundle);
        bundle.exitWatch.bumpGrace(12_000L);
        boolean top = win.id.equals(windowManager.focusedId()) && !win.minimized;
        bundle.cast.start(win, MultiAppCastOptions.resolveMaxFps(top, win.minimized));
    }

    private void closeWindow(String id, boolean stopApp) {
        MultiAppWindowState win = windowManager.find(id);
        if (stopApp && win != null) {
            String packageName = win.packageName;
            WindowBundle bundle = bundles.get(id);
            // Instant UI close; keep cast/VD until stop finishes (noVdDestroyContent).
            windowManager.closeWindow(id);
            if (bundle != null && bundle.exitWatch != null) {
                bundle.exitWatch.release();
                bundle.exitWatch = null;
            }
            ServerEndpointStore.Endpoint store = ServerEndpointStore.read(activity);
            executor.execute(() -> {
                try {
                    CloudPhoneApiClient.stopApp(activity, store.host, store.port, serial, packageName);
                } catch (Exception stopErr) {
                    try {
                        CloudPhoneApiClient.forceStopApp(activity, store.host, store.port, serial, packageName);
                    } catch (Exception ignored) {
                    }
                } finally {
                    activity.runOnUiThread(() -> releaseClosingBundle(id));
                }
            });
            return;
        }
        if (win == null) {
            // Already closed in UI; pending background stop owns the bundle.
            return;
        }
        finishCloseWindow(id);
    }

    private void releaseClosingBundle(String id) {
        WindowBundle bundle = bundles.remove(id);
        if (bundle != null) {
            releaseBundle(bundle, windowManager.isEmpty());
        }
    }

    private void finishCloseWindow(String id) {
        WindowBundle bundle = bundles.remove(id);
        windowManager.closeWindow(id);
        if (bundle != null) {
            releaseBundle(bundle, windowManager.isEmpty());
        }
    }

    private void releaseBundle(WindowBundle bundle, boolean releaseBackend) {
        if (bundle.exitWatch != null) {
            bundle.exitWatch.release();
        }
        if (bundle.resizeScheduler != null) {
            bundle.resizeScheduler.release();
        }
        if (bundle.cast != null) {
            bundle.cast.stop(releaseBackend);
        }
    }
}
