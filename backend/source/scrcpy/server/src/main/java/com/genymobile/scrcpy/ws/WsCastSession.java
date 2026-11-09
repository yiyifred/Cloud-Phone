package com.genymobile.scrcpy.ws;

import com.genymobile.scrcpy.AsyncProcessor;
import com.genymobile.scrcpy.CleanUp;
import com.genymobile.scrcpy.Options;
import com.genymobile.scrcpy.control.ControlMessage;
import com.genymobile.scrcpy.control.Controller;
import com.genymobile.scrcpy.device.Device;
import com.genymobile.scrcpy.model.ConfigurationException;
import com.genymobile.scrcpy.model.NewDisplay;
import com.genymobile.scrcpy.video.CameraCapture;
import com.genymobile.scrcpy.video.NewDisplayCapture;
import com.genymobile.scrcpy.util.Ln;
import com.genymobile.scrcpy.util.Settings;
import com.genymobile.scrcpy.util.SettingsException;
import com.genymobile.scrcpy.video.ScreenCapture;
import com.genymobile.scrcpy.video.SurfaceCapture;
import com.genymobile.scrcpy.video.SurfaceEncoder;
import com.genymobile.scrcpy.video.VideoSource;
import com.genymobile.scrcpy.video.VirtualDisplayListener;

import org.java_websocket.WebSocket;

import java.io.IOException;
import java.nio.ByteBuffer;
import java.util.Collections;
import java.util.HashSet;
import java.util.Set;
import java.util.concurrent.Executors;
import java.util.concurrent.ScheduledExecutorService;
import java.util.concurrent.TimeUnit;

public final class WsCastSession implements WsSocketBroadcaster {

  private static final ScheduledExecutorService SCHEDULER = Executors.newSingleThreadScheduledExecutor();

  private final Options baseOptions;
  private final WsServer server;
  private VideoSettings videoSettings;
  private final Set<WebSocket> clients = Collections.synchronizedSet(new HashSet<>());

  private WsControlChannel controlChannel;
  private Controller controller;
  private SurfaceEncoder surfaceEncoder;
  private SurfaceCapture surfaceCapture;
  private WsStreamer streamer;
  private WsPcmAudioProcessor pcmAudioProcessor;
  private CleanUp cleanUp;
  private boolean started;
  private Options activeStreamOptions;

  WsCastSession(Options baseOptions, VideoSettings videoSettings, WsServer server) {
    this.baseOptions = baseOptions;
    this.videoSettings = videoSettings;
    this.server = server;
  }

  VideoSettings getVideoSettings() {
    return videoSettings;
  }

  int getClientCount() {
    return clients.size();
  }

  byte[] getScreenInfoBytes() {
    return new byte[0];
  }

  @Override
  public Set<WebSocket> getOpenSockets() {
    return clients;
  }

  @Override
  public void broadcast(ByteBuffer data) {
    synchronized (clients) {
      for (WebSocket socket : clients) {
        if (socket != null && socket.isOpen()) {
          socket.send(data.duplicate());
        }
      }
    }
  }

  void join(WebSocket socket, VideoSettings incoming) throws IOException, ConfigurationException {
    if (socket != null) {
      clients.add(socket);
    }

    // ws-scrcpy always sends type 101 after connect; defer pipeline until then so
    // --new-display / --start-app use the correct display id (not main display 0).
    if (incoming != null) {
      boolean changed = !incoming.equals(videoSettings);
      if (changed) {
        videoSettings = incoming;
      }
      if (started) {
        if (changed) {
          softReconfigureStream();
          server.broadcastInitialInfo();
        }
        // Do not re-broadcast when type 101 is unchanged — avoids a
        // scrcpy_initial ↔ type 101 feedback loop across multi-app windows.
        return;
      }
      startPipeline();
      return;
    }

    if (!started) {
      Ln.d("Web cast client joined, waiting for stream parameters (type 101)");
      return;
    }

    server.broadcastInitialInfo();
  }

  void leave(WebSocket socket) {
    clients.remove(socket);
    if (clients.isEmpty()) {
      stopPipeline();
    } else {
      server.broadcastInitialInfo();
    }
  }

  void handleControl(WebSocket socket, ByteBuffer payload) throws IOException, ConfigurationException {
    if (!payload.hasRemaining()) {
      return;
    }
    int type = payload.get(payload.position()) & 0xff;
    if (type == VideoSettings.TYPE_CHANGE_STREAM_PARAMETERS) {
      payload.get(); // consume type
      byte[] bytes = new byte[payload.remaining()];
      payload.get(bytes);
      // Keep the owning socket in clients (type-101 used to call join(null, …)).
      join(socket, VideoSettings.fromByteArray(bytes));
      return;
    }
    if (type == WsControlFilter.TYPE_PUSH_FILE) {
      // ws-scrcpy file push — not implemented on Cloud-Phone yet.
      return;
    }
    if (!WsControlFilter.shouldFeedToControl(payload)) {
      if (type > ControlMessage.TYPE_RESIZE_DISPLAY && type != WsControlFilter.TYPE_PUSH_FILE) {
        Ln.w("Ignoring unknown WebSocket control type: " + type);
      }
      return;
    }

    if (!started || controlChannel == null) {
      Ln.w("Dropping control type " + type + " (pipeline not started yet)");
      return;
    }

    controlChannel.feedControl(payload);
  }

  private void startPipeline() throws IOException, ConfigurationException {
    stopPipeline();
    Options streamOptions = baseOptions.copyForWebStream(videoSettings);
    boolean useVideo = streamOptions.getVideo();
    boolean useAudio = streamOptions.getAudio();

    // Waydroid: playback (AudioRecord source=REMOTE_SUBMIX/playback) PCM capture and the
    // display capture fight over the same projection — with audio on, video emitted only
    // the encoder CSD and the browser canvas stayed black. Video is the primary output of
    // a cast, so keep it and skip playback PCM when both are requested without audio_dup.
    if (useVideo && useAudio && !streamOptions.getAudioDup()) {
      Ln.w("Web cast: playback PCM audio would starve display capture; keeping video, audio disabled"
          + " (use audio_dup=true to hear audio on the device instead)");
      useAudio = false;
    }

    NewDisplay nd = streamOptions.getNewDisplay();
    Ln.i("Web cast startPipeline session@" + Integer.toHexString(System.identityHashCode(this))
        + " video=" + useVideo
        + " new_display=" + (nd == null ? "null"
            : (nd.getSize() == null ? "default" : nd.getSize()) + "/" + nd.getDpi())
        + " start_app=" + streamOptions.getStartApp()
        + " clients=" + clients.size());

    if (streamOptions.getCleanup()) {
      cleanUp = CleanUp.start(streamOptions);
    }

    controlChannel = new WsControlChannel(this);
    controller = new Controller(controlChannel, cleanUp, streamOptions);

    applyShowTouchesSystemSetting(streamOptions.getShowTouches());

    activeStreamOptions = streamOptions;

    if (useVideo) {
      startVideoEncoder(streamOptions);
    }

    controller.start(controlTerminationListener());

    scheduleTurnScreenOffIfRequested(streamOptions);
    scheduleStartAppIfRequested(streamOptions);
    started = true;

    if (useAudio) {
      scheduleAudioProcessorStart(streamOptions, useVideo);
    } else if (!useVideo) {
      Ln.w("Web cast started with neither video nor audio");
    }

    Ln.i("Web cast pipeline: video=" + useVideo + ", audio=" + useAudio
        + ", source=" + streamOptions.getAudioSource()
        + ", audio_dup=" + streamOptions.getAudioDup());

    server.broadcastInitialInfo();
  }

  private void softReconfigureStream() throws IOException, ConfigurationException {
    Options streamOptions = baseOptions.copyForWebStream(videoSettings);
    boolean needCaptureRestart = requiresVideoCaptureRestart(activeStreamOptions, streamOptions);
    Ln.i("Web cast softReconfigure session@" + Integer.toHexString(System.identityHashCode(this))
        + " captureRestart=" + needCaptureRestart
        + " prevStartApp=" + (activeStreamOptions == null ? "null" : activeStreamOptions.getStartApp())
        + " nextStartApp=" + streamOptions.getStartApp()
        + " clients=" + clients.size());

    applyShowTouchesSystemSetting(streamOptions.getShowTouches());
    syncAudioProcessor(streamOptions, streamOptions.getVideo());

    if (requiresControlRestart(activeStreamOptions, streamOptions)) {
      restartControl(streamOptions);
    }

    if (streamOptions.getVideo()) {
      if (needCaptureRestart) {
        restartVideoCapture(streamOptions);
      } else if (surfaceEncoder == null) {
        startVideoEncoder(streamOptions);
      } else {
        // Capture-reset on a duplicate type-101 (same source/display/crop) rebuilt the
        // encoder and then emitted nothing on Waydroid: clients got CSD only, so the
        // canvas stayed black. Keep the live pipeline and just apply the cheap knobs.
        surfaceEncoder.applyStreamTuning(streamOptions);
        Ln.i("Web cast softReconfigure keeps live capture (no reset)");
      }
    } else {
      stopVideoEncoder();
    }

    activeStreamOptions = streamOptions;
    scheduleTurnScreenOffIfRequested(streamOptions);
    scheduleStartAppIfRequested(streamOptions);
  }

  private static boolean requiresControlRestart(Options previous, Options next) {
    return requiresVideoCaptureRestart(previous, next);
  }

  private void restartControl(Options streamOptions) {
    if (controller != null) {
      controller.stop();
    }
    controller = new Controller(controlChannel, cleanUp, streamOptions);
    controller.start(controlTerminationListener());
  }

  private static boolean requiresVideoCaptureRestart(Options previous, Options next) {
    if (previous == null) {
      return true;
    }

    if (previous.getVideoSource() != next.getVideoSource()) {
      return true;
    }

    if (next.getVideoSource() == VideoSource.CAMERA) {
      if (!java.util.Objects.equals(previous.getCameraId(), next.getCameraId())
          || previous.getCameraFacing() != next.getCameraFacing()
          || !java.util.Objects.equals(previous.getCameraSize(), next.getCameraSize())
          || !java.util.Objects.equals(previous.getCameraAspectRatio(), next.getCameraAspectRatio())
          || previous.getCameraFps() != next.getCameraFps()
          || previous.getCameraHighSpeed() != next.getCameraHighSpeed()) {
        return true;
      }
    }

    NewDisplay prevNd = previous.getNewDisplay();
    NewDisplay nextNd = next.getNewDisplay();
    boolean prevHasNd = prevNd != null;
    boolean nextHasNd = nextNd != null;
    if (prevHasNd != nextHasNd) {
      return true;
    }

    if (prevHasNd && nextHasNd) {
      if (!java.util.Objects.equals(prevNd.getSize(), nextNd.getSize()) || prevNd.getDpi() != nextNd.getDpi()) {
        return true;
      }
    }

    // Multi-app windows often share identical new_display size/dpi; a different
    // start_app must create a new virtual display instead of soft-reusing one.
    if (!java.util.Objects.equals(previous.getStartApp(), next.getStartApp())) {
      return true;
    }

    if (previous.getDisplayId() != next.getDisplayId()) {
      return true;
    }

    if (!java.util.Objects.equals(previous.getCrop(), next.getCrop())) {
      return true;
    }

    if (previous.getFlexDisplay() != next.getFlexDisplay()) {
      return true;
    }

    return false;
  }

  private static SurfaceCapture createSurfaceCapture(
      Controller controller, Options options, VirtualDisplayListener displayListener)
      throws ConfigurationException, IOException {
    if (options.getVideoSource() == VideoSource.CAMERA) {
      Ln.i("Web cast using device camera");
      return new CameraCapture(options);
    }

    if (options.getNewDisplay() != null) {
      Ln.i("Web cast using new virtual display");
      return new NewDisplayCapture(displayListener, options);
    }

    if (options.getDisplayId() == Device.DISPLAY_ID_NONE) {
      throw new ConfigurationException("No display id for screen capture");
    }

    return new ScreenCapture(displayListener, options);
  }

  private void startVideoEncoder(Options streamOptions) throws IOException, ConfigurationException {
    stopVideoEncoder();
    VirtualDisplayListener displayListener = (displayId, positionMapper) -> {
      controller.onNewVirtualDisplay(displayId, positionMapper);
      server.bindSessionDisplay(this, displayId);
      Ln.i("Web cast pipeline attached to display " + displayId
          + (streamOptions.getNewDisplay() != null ? " (virtual)" : ""));
      // Official scrcpy: START_APP waits ≤1s for VD id — launch as soon as VD exists.
      String app = streamOptions.getStartApp();
      if (app != null && !app.isEmpty() && controller != null) {
        Ln.i("Starting app \"" + app + "\" immediately on display " + displayId);
        controller.requestStartApp(app);
      }
    };
    surfaceCapture = createSurfaceCapture(controller, streamOptions, displayListener);
    streamer = new WsStreamer(clients, streamOptions);
    surfaceEncoder = new SurfaceEncoder(surfaceCapture, streamer, streamOptions);
    controller.setSurfaceCapture(surfaceCapture);
    surfaceEncoder.start(videoTerminationListener());
  }

  private void stopVideoEncoder() {
    if (surfaceEncoder != null) {
      surfaceEncoder.stop();
      try {
        surfaceEncoder.join();
      } catch (InterruptedException e) {
        Thread.currentThread().interrupt();
      }
      surfaceEncoder = null;
    }
    surfaceCapture = null;
    streamer = null;
  }

  private void restartVideoCapture(Options streamOptions) throws IOException, ConfigurationException {
    // The previous encoder (and its VirtualDisplay) must be released first: starting a second
    // encoder on the same display left Waydroid feeding only the new codec's CSD, so the
    // client canvas stayed black after any stream-parameter change.
    stopVideoEncoder();
    startVideoEncoder(streamOptions);
  }

  /**
   * Mirror official scrcpy client: request start-app as soon as control is ready.
   * For --new-display, the actual launch happens in the VD listener (display id known).
   * Do NOT sleep 3.5s — that made multi-app windows feel extremely slow.
   */
  private void scheduleStartAppIfRequested(Options streamOptions) {
    String app = streamOptions.getStartApp();
    if (app == null || app.isEmpty() || controller == null) {
      return;
    }

    if (streamOptions.getNewDisplay() != null) {
      Ln.i("start_app \"" + app + "\" will run when virtual display is ready");
      return;
    }

    Ln.i("Scheduling start_app \"" + app + "\" on display " + streamOptions.getDisplayId() + " in 100ms");
    SCHEDULER.schedule(() -> {
      if (started && controller != null) {
        controller.requestStartApp(app);
      }
    }, 100, TimeUnit.MILLISECONDS);
  }

  private AsyncProcessor.TerminationListener videoTerminationListener() {
    return fatalError -> {
      if (fatalError) {
        Ln.e("Web cast video encoder stopped on error");
      }
    };
  }

  private AsyncProcessor.TerminationListener controlTerminationListener() {
    return fatalError -> {
      if (fatalError) {
        Ln.d("Web cast control channel closed");
      }
    };
  }

  private AsyncProcessor.TerminationListener audioTerminationListener() {
    return fatalError -> {
      if (fatalError) {
        Ln.w("Web cast audio processor stopped");
      }
    };
  }

  private void scheduleAudioProcessorStart(Options streamOptions, boolean withVideo) {
    Runnable start = () -> {
      if (!started) {
        return;
      }
      stopAudioProcessor();
      pcmAudioProcessor = new WsPcmAudioProcessor(clients, streamOptions);
      pcmAudioProcessor.start(audioTerminationListener());
      if (withVideo) {
        Ln.i("Web cast video + audio (PCM over WebSocket, audio_dup=" + streamOptions.getAudioDup() + ")");
      } else {
        Ln.i("Web cast audio-only mode (PCM over WebSocket)");
      }
    };

    if (withVideo) {
      SCHEDULER.schedule(start, 350, TimeUnit.MILLISECONDS);
    } else {
      // Defer to next scheduler tick so startPipeline can set started=true first.
      SCHEDULER.schedule(start, 0, TimeUnit.MILLISECONDS);
    }
  }

  private void syncAudioProcessor(Options streamOptions, boolean withVideo) {
    boolean keepVideo = withVideo && streamOptions.getVideo();
    boolean playbackPcm = !streamOptions.getAudioDup();
    if (streamOptions.getAudio() && !(keepVideo && playbackPcm)) {
      scheduleAudioProcessorStart(streamOptions, withVideo);
    } else {
      stopAudioProcessor();
    }
  }

  private void stopAudioProcessor() {
    if (pcmAudioProcessor != null) {
      pcmAudioProcessor.stop();
      pcmAudioProcessor = null;
    }
  }

  private static void applyShowTouchesSystemSetting(boolean enabled) {
    try {
      Settings.putValue(Settings.TABLE_SYSTEM, "show_touches", enabled ? "1" : "0");
    } catch (SettingsException e) {
      Ln.w("Could not set show_touches=" + enabled + ": " + e.getMessage());
    }
  }

  private void scheduleTurnScreenOffIfRequested(Options streamOptions) {
    if (!streamOptions.getTurnScreenOff() || controlChannel == null) {
      return;
    }

    SCHEDULER.schedule(() -> {
      try {
        byte[] msg = new byte[] { (byte) ControlMessage.TYPE_SET_DISPLAY_POWER, 0 };
        controlChannel.feedControl(ByteBuffer.wrap(msg));
      } catch (IOException e) {
        Ln.w("Could not request turn_screen_off: " + e.getMessage());
      }
    }, 250, TimeUnit.MILLISECONDS);
  }

  private void stopPipeline() {
    started = false;
    activeStreamOptions = null;
    server.unbindSession(this);
    stopVideoEncoder();
    stopAudioProcessor();
    if (controller != null) {
      controller.stop();
      controller = null;
    }
    if (cleanUp != null) {
      cleanUp.interrupt();
      cleanUp = null;
    }
    controlChannel = null;
  }
}
