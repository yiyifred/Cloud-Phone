package com.yiyi.cloud_phone.multiapp;

import android.view.LayoutInflater;
import android.view.MotionEvent;
import android.view.View;
import android.widget.FrameLayout;
import android.widget.ImageView;
import android.widget.TextView;

import androidx.appcompat.app.AppCompatActivity;

import com.yiyi.cloud_phone.R;
import com.yiyi.cloud_phone.cast.MultiAppWindowCastSession;
import com.yiyi.cloud_phone.cast.ScrcpyControlWire;

final class MultiAppWindowFrameBinder {
    interface Host {
        void onFocus(String id);

        void onMinimize(String id);

        void onMaximize(String id);

        void onClose(String id);

        void onBack(String id);

        void onResize(String id, int x, int y, int width, int height);

        void onMove(String id, int x, int y);

        void applyLayout(View frame, MultiAppWindowState win);
    }

    private MultiAppWindowFrameBinder() {
    }

    static View inflate(AppCompatActivity activity, FrameLayout desktopCanvas, MultiAppWindowState win, Host host) {
        View frame = LayoutInflater.from(activity).inflate(R.layout.view_multi_app_window, desktopCanvas, false);
        bindChrome(frame, win, host);
        refresh(frame, win, host);
        return frame;
    }

    /** Update title/icons/layout/edge visibility without recreating touch listeners. */
    static void refresh(View frame, MultiAppWindowState win, Host host) {
        TextView title = frame.findViewById(R.id.windowTitle);
        if (title != null) {
            title.setText(win.label);
        }
        bindIcons(frame, win);
        setResizeEdgesVisible(frame, !win.maximized);
        host.applyLayout(frame, win);
    }

    static void bindIcons(View frame, MultiAppWindowState win) {
        ImageView icon = frame.findViewById(R.id.windowIcon);
        TextView initial = frame.findViewById(R.id.windowIconInitial);
        MultiAppIconUtil.bindIcon(icon, initial, win.label, win.iconDataUrl);
    }

    static void setupTouch(View target, MultiAppWindowCastSession session) {
        target.setOnTouchListener((v, event) -> {
            int action;
            if (event.getActionMasked() == MotionEvent.ACTION_DOWN) {
                action = ScrcpyControlWire.MOTION_DOWN;
            } else if (event.getActionMasked() == MotionEvent.ACTION_UP
                    || event.getActionMasked() == MotionEvent.ACTION_CANCEL) {
                action = ScrcpyControlWire.MOTION_UP;
            } else if (event.getActionMasked() == MotionEvent.ACTION_MOVE) {
                action = ScrcpyControlWire.MOTION_MOVE;
            } else {
                return false;
            }
            session.sendTouch(action, event.getX(), event.getY(), v.getWidth(), v.getHeight());
            return true;
        });
    }

    private static void bindChrome(View frame, MultiAppWindowState win, Host host) {
        bindChromeButton(frame.findViewById(R.id.buttonWindowBack), () -> host.onBack(win.id));
        bindChromeButton(frame.findViewById(R.id.buttonWindowMinimize), () -> host.onMinimize(win.id));
        bindChromeButton(frame.findViewById(R.id.buttonWindowMaximize), () -> host.onMaximize(win.id));
        bindChromeButton(frame.findViewById(R.id.buttonWindowClose), () -> host.onClose(win.id));
        View titleBar = frame.findViewById(R.id.windowTitleBar);
        titleBar.setOnTouchListener(new MultiAppTitleDragListener(win, new MultiAppTitleDragListener.Host() {
            @Override
            public void onFocus() {
                host.onFocus(win.id);
            }

            @Override
            public void onMove(int x, int y) {
                host.onMove(win.id, x, y);
            }

            @Override
            public void onToggleMaximize() {
                host.onMaximize(win.id);
            }
        }, frame.getContext()));
        bindResizeEdge(frame, win, host, R.id.resizeN, "n");
        bindResizeEdge(frame, win, host, R.id.resizeS, "s");
        bindResizeEdge(frame, win, host, R.id.resizeE, "e");
        bindResizeEdge(frame, win, host, R.id.resizeW, "w");
        bindResizeEdge(frame, win, host, R.id.resizeNE, "ne");
        bindResizeEdge(frame, win, host, R.id.resizeNW, "nw");
        bindResizeEdge(frame, win, host, R.id.resizeSE, "se");
        bindResizeEdge(frame, win, host, R.id.resizeSW, "sw");
        frame.setOnClickListener(v -> host.onFocus(win.id));
    }

    /**
     * Consume all touches on chrome buttons so the title-bar double-tap
     * maximize gesture never fires when double-tapping Back / Min / Max / Close.
     */
    private static void bindChromeButton(View button, Runnable action) {
        if (button == null) {
            return;
        }
        button.setOnTouchListener((v, event) -> {
            int actionMasked = event.getActionMasked();
            if (actionMasked == MotionEvent.ACTION_UP) {
                float x = event.getX();
                float y = event.getY();
                if (x >= 0 && y >= 0 && x < v.getWidth() && y < v.getHeight()) {
                    action.run();
                }
            }
            return true;
        });
        button.setOnClickListener(null);
        button.setClickable(true);
    }

    private static void setResizeEdgesVisible(View frame, boolean visible) {
        int visibility = visible ? View.VISIBLE : View.GONE;
        int[] ids = {
                R.id.resizeN, R.id.resizeS, R.id.resizeE, R.id.resizeW,
                R.id.resizeNE, R.id.resizeNW, R.id.resizeSE, R.id.resizeSW
        };
        for (int id : ids) {
            View handle = frame.findViewById(id);
            if (handle != null) {
                handle.setVisibility(visibility);
            }
        }
    }

    private static void bindResizeEdge(View frame, MultiAppWindowState win, Host host, int id, String edge) {
        View handle = frame.findViewById(id);
        if (handle == null) {
            return;
        }
        handle.setOnTouchListener(new MultiAppWindowResizeTouch(win, edge, new MultiAppWindowResizeTouch.Listener() {
            @Override
            public void onResize(int x, int y, int width, int height) {
                host.onResize(win.id, x, y, width, height);
            }

            @Override
            public void onFocus() {
                host.onFocus(win.id);
            }
        }));
    }
}
