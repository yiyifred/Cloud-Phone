package com.genymobile.scrcpy.control;

import com.genymobile.scrcpy.AndroidVersions;
import com.genymobile.scrcpy.AsyncProcessor;
import com.genymobile.scrcpy.CleanUp;
import com.genymobile.scrcpy.Options;
import com.genymobile.scrcpy.device.Device;
import com.genymobile.scrcpy.display.DisplayInfo;
import com.genymobile.scrcpy.model.DeviceApp;
import com.genymobile.scrcpy.model.Point;
import com.genymobile.scrcpy.model.Position;
import com.genymobile.scrcpy.model.Size;
import com.genymobile.scrcpy.util.Ln;
import com.genymobile.scrcpy.util.LogUtils;
import com.genymobile.scrcpy.video.CameraCapture;
import com.genymobile.scrcpy.video.CaptureControl;
import com.genymobile.scrcpy.video.NewDisplayCapture;
import com.genymobile.scrcpy.video.SurfaceCapture;
import com.genymobile.scrcpy.video.VideoSource;
import com.genymobile.scrcpy.video.VirtualDisplayListener;
import com.genymobile.scrcpy.wrappers.ClipboardManager;
import com.genymobile.scrcpy.wrappers.InputManager;
import com.genymobile.scrcpy.wrappers.ServiceManager;

import android.content.Intent;
import android.os.Build;
import android.os.SystemClock;
import android.util.Pair;
import android.view.InputDevice;
import android.view.KeyCharacterMap;
import android.view.KeyEvent;
import android.view.MotionEvent;

import java.io.IOException;
import java.util.List;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.ScheduledExecutorService;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicBoolean;
import java.util.concurrent.atomic.AtomicReference;

public class Controller implements AsyncProcessor, VirtualDisplayListener {

    /*
     * For event injection, there are two display ids:
     *  - the displayId passed to the constructor (which comes from --display-id passed by the client, 0 for the main display);
     *  - the virtualDisplayId used for mirroring, notified by the capture instance via the VirtualDisplayListener interface.
     *
     * (In case the ScreenCapture uses the "SurfaceControl API", then both ids are equals, but this is an implementation detail.)
     *
     * In order to make events work correctly in all cases:
     *  - virtualDisplayId must be used for events relative to the display (mouse and touch events with coordinates);
     *  - displayId must be used for other events (like key events).
     *
     * If a new separate virtual display is created (using --new-display), then displayId == Device.DISPLAY_ID_NONE. In that case, all events are
     * sent to the virtual display id.
     */

    static final class DisplayData {
        final int virtualDisplayId;
        final PositionMapper positionMapper;

        private DisplayData(int virtualDisplayId, PositionMapper positionMapper) {
            this.virtualDisplayId = virtualDisplayId;
            this.positionMapper = positionMapper;
        }
    }

    private static final int DEFAULT_DEVICE_ID = 0;

    // control_msg.h values of the pointerId field in inject_touch_event message
    private static final int POINTER_ID_MOUSE = -1;

    // Interval between simulated user activity events
    private static final long KEEP_ACTIVE_INTERVAL_MS = 4000;

    static final ScheduledExecutorService EXECUTOR = Executors.newSingleThreadScheduledExecutor();
    ExecutorService startAppExecutor;

    private Thread thread;
    private Thread keepActiveThread;

    private UhidManager uhidManager;

    final boolean camera;
    final int displayId;
    final boolean supportsInputEvents;
    private final ControlConnection controlChannel;
    final CleanUp cleanUp;
    final DeviceMessageSender sender;
    final boolean clipboardAutosync;
    private final boolean powerOn;
    private final boolean keepActive;

    final KeyCharacterMap charMap = KeyCharacterMap.load(KeyCharacterMap.VIRTUAL_KEYBOARD);

    final AtomicBoolean isSettingClipboard = new AtomicBoolean();

    final AtomicReference<DisplayData> displayData = new AtomicReference<>();
    final Object displayDataAvailable = new Object(); // condition variable

    long lastTouchDown;
    final PointersState pointersState = new PointersState();
    final MotionEvent.PointerProperties[] pointerProperties = new MotionEvent.PointerProperties[PointersState.MAX_POINTERS];
    final MotionEvent.PointerCoords[] pointerCoords = new MotionEvent.PointerCoords[PointersState.MAX_POINTERS];

    boolean keepDisplayPowerOff;
    /** True after client turned display off via SET_DISPLAY_POWER; cleared after a successful wake. */
    boolean clientRequestedDisplayOff;

    // Used for resetting video encoding on RESET_VIDEO message or for sending camera controls
    SurfaceCapture surfaceCapture;

    public Controller(ControlConnection controlChannel, CleanUp cleanUp, Options options) {
        this.camera = options.getVideoSource() == VideoSource.CAMERA;
        this.controlChannel = controlChannel;
        this.cleanUp = cleanUp;

        if (this.camera) {
            // Unused for camera
            this.displayId = Device.DISPLAY_ID_NONE;
            this.supportsInputEvents = false;
            this.sender = null;
            this.clipboardAutosync = false;
            this.powerOn = false;
            this.keepActive = false;
            return;
        }

        this.displayId = options.getDisplayId();

        this.clipboardAutosync = options.getClipboardAutosync();
        this.powerOn = options.getPowerOn();
        this.keepActive = options.getKeepActive();
        initPointers();
        sender = new DeviceMessageSender(controlChannel);

        supportsInputEvents = Device.supportsInputEvents(displayId);
        if (!supportsInputEvents) {
            Ln.w("Input events are not supported for secondary displays before Android 10");
        }

        // Make sure the clipboard manager is always created from the main thread (even if clipboardAutosync is disabled)
        ClipboardManager clipboardManager = ServiceManager.getClipboardManager();
        if (clipboardAutosync) {
            // If control and autosync are enabled, synchronize Android clipboard to the computer automatically
            if (clipboardManager != null) {
                clipboardManager.addPrimaryClipChangedListener(() -> {
                    if (isSettingClipboard.get()) {
                        // This is a notification for the change we are currently applying, ignore it
                        return;
                    }
                    String text = Device.getClipboardText();
                    if (text != null) {
                        DeviceMessage msg = DeviceMessage.createClipboard(text);
                        sender.send(msg);
                    }
                });
            } else {
                Ln.w("No clipboard manager, copy-paste between device and computer will not work");
            }
        }
    }

    @Override
    public void onNewVirtualDisplay(int virtualDisplayId, PositionMapper positionMapper) {
        DisplayData data = new DisplayData(virtualDisplayId, positionMapper);
        DisplayData old = this.displayData.getAndSet(data);
        if (old == null) {
            // The very first time the Controller is notified of a new virtual display
            synchronized (displayDataAvailable) {
                displayDataAvailable.notify();
            }
        }
    }

    public void setSurfaceCapture(SurfaceCapture surfaceCapture) {
        this.surfaceCapture = surfaceCapture;
    }

    UhidManager getUhidManager() {
        if (uhidManager == null) {
            int uhidDisplayId = displayId;
            if (Build.VERSION.SDK_INT >= AndroidVersions.API_35_ANDROID_15) {
                if (displayId == Device.DISPLAY_ID_NONE) {
                    // Mirroring a new virtual display id (using --new-display-id feature) on Android >= 15, where the UHID mouse pointer can be
                    // associated to the virtual display
                    try {
                        // Wait for at most 1 second until a virtual display id is known
                        DisplayData data = ControllerDisplaySession.waitDisplayData(this, 1000);
                        if (data != null) {
                            uhidDisplayId = data.virtualDisplayId;
                        }
                    } catch (InterruptedException e) {
                        // do nothing
                    }
                }
            }

            String displayUniqueId = null;
            if (uhidDisplayId > 0) {
                // Ignore Device.DISPLAY_ID_NONE and 0 (main display)
                DisplayInfo displayInfo = ServiceManager.getDisplayManager().getDisplayInfo(uhidDisplayId);
                if (displayInfo != null) {
                    displayUniqueId = displayInfo.getUniqueId();
                }
            }
            uhidManager = new UhidManager(sender, displayUniqueId);
        }

        return uhidManager;
    }

    private void initPointers() {
        for (int i = 0; i < PointersState.MAX_POINTERS; ++i) {
            MotionEvent.PointerProperties props = new MotionEvent.PointerProperties();
            props.toolType = MotionEvent.TOOL_TYPE_FINGER;

            MotionEvent.PointerCoords coords = new MotionEvent.PointerCoords();
            coords.orientation = 0;
            coords.size = 0;

            pointerProperties[i] = props;
            pointerCoords[i] = coords;
        }
    }

    private void control() throws IOException {
        // on start, power on the device
        if (!camera && powerOn && displayId == 0 && !Device.isScreenOn(displayId)) {
            Device.pressReleaseKeycode(KeyEvent.KEYCODE_POWER, displayId, Device.INJECT_MODE_ASYNC);

            // dirty hack
            // After POWER is injected, the device is powered on asynchronously.
            // To turn the device screen off while mirroring, the client will send a message that
            // would be handled before the device is actually powered on, so its effect would
            // be "canceled" once the device is turned back on.
            // Adding this delay prevents to handle the message before the device is actually
            // powered on.
            SystemClock.sleep(500);
        }

        boolean alive = true;
        while (!Thread.currentThread().isInterrupted() && alive) {
            alive = handleEvent();
        }
    }

    private void startKeepActiveThread() {
        keepActiveThread = new Thread(() -> {
            try {
                while (true) {
                    Thread.sleep(KEEP_ACTIVE_INTERVAL_MS);
                    int actionDisplayId = ControllerKeyboardInput.getActionDisplayId(this);
                    if (actionDisplayId != Device.DISPLAY_ID_NONE) {
                        Device.keepActive(actionDisplayId);
                    }
                }
            } catch (InterruptedException e) {
                // ignore
            } catch (Throwable e) {
                Ln.e("Keep active error", e);
            } finally {
                Ln.d("Keep active thread stopped");
            }
        });
        keepActiveThread.setName("keep-active");
        keepActiveThread.setDaemon(true);
        keepActiveThread.start();
    }

    @Override
    public void start(TerminationListener listener) {
        if (keepActive) {
            startKeepActiveThread();
        }

        thread = new Thread(() -> {
            try {
                control();
            } catch (IOException e) {
                Ln.e("Controller error", e);
            } finally {
                Ln.d("Controller stopped");
                if (uhidManager != null) {
                    uhidManager.closeAll();
                }
                listener.onTerminated(true);
            }
        }, "control-recv");
        thread.start();
        if (sender != null) {
            sender.start();
        }
    }

    @Override
    public void stop() {
        if (keepActiveThread != null) {
            keepActiveThread.interrupt();
        }
        if (thread != null) {
            thread.interrupt();
        }
        if (sender != null) {
            sender.stop();
        }
    }

    @Override
    public void join() throws InterruptedException {
        if (thread != null) {
            thread.join();
        }
        if (sender != null) {
            sender.join();
        }
    }

    private boolean handleEvent() throws IOException {
        ControlMessage msg;
        try {
            msg = controlChannel.recv();
        } catch (ControlProtocolException e) {
            Ln.e("Control protocol error", e);
            return false;
        } catch (IOException e) {
            // this is expected on close
            return false;
        }

        return ControllerMessageHandler.handleMessage(this, msg);
    }

    /**
     * Handle a control message received from a non-socket transport (e.g. WebSocket).
     */
    public void handleExternalMessage(ControlMessage msg) throws IOException {
        ControllerMessageHandler.handleMessage(this, msg);
    }

    boolean pressReleaseKeycode(int keyCode, int injectMode) {
        int actionDisplayId = ControllerKeyboardInput.getActionDisplayId(this);
        if (actionDisplayId == Device.DISPLAY_ID_NONE) {
            return false;
        }
        return Device.pressReleaseKeycode(keyCode, actionDisplayId, injectMode);
    }

    void resizeDisplay(int width, int height) {
        NewDisplayCapture newDisplayCapture = (NewDisplayCapture) surfaceCapture;
        newDisplayCapture.requestResize(width, height);
    }

    /** Reset video capture/encoder after live stream parameter changes (web cast). */
    public void requestResetVideo() {
        resetVideo();
    }

    /** Launch an app on the mirrored / virtual display (scrcpy --start-app). */
    public void requestStartApp(String name) {
        if (name != null && !name.isEmpty()) {
            ControllerDisplaySession.startAppAsync(this, name);
        }
    }

    void resetVideo() {
        if (surfaceCapture == null) {
            return;
        }

        CaptureControl captureControl = surfaceCapture.getCaptureControl();
        if (captureControl == null) {
            Ln.d("Video capture reset skipped (capture not initialized yet)");
            return;
        }

        // Request a keyframe on the live encoder: resetting the capture here rebuilt the
        // pipeline and Waydroid then delivered CSD only, which showed up as a black canvas.
        Ln.i("Video keyframe requested by client");
        captureControl.requestSyncFrame();
    }

}
