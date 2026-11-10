package com.genymobile.scrcpy;

import com.genymobile.scrcpy.audio.AudioCodec;
import com.genymobile.scrcpy.audio.AudioSource;

import android.os.Build;
import com.genymobile.scrcpy.device.Device;
import com.genymobile.scrcpy.model.CodecOption;
import com.genymobile.scrcpy.model.NewDisplay;
import com.genymobile.scrcpy.model.Orientation;
import com.genymobile.scrcpy.model.Size;
import com.genymobile.scrcpy.util.Ln;
import com.genymobile.scrcpy.video.CameraAspectRatio;
import com.genymobile.scrcpy.video.CameraFacing;
import com.genymobile.scrcpy.video.VideoCodec;
import com.genymobile.scrcpy.video.VideoSource;
import com.genymobile.scrcpy.wrappers.WindowManager;

import android.graphics.Rect;
import android.util.Pair;

import java.util.List;
import java.util.Locale;

public class Options {

    public enum ServerMode {
        LOCAL,
        WEB,
    }

    Ln.Level logLevel = Ln.Level.DEBUG;
    int scid = -1; // 31-bit non-negative value, or -1
    boolean video = true;
    boolean audio = true;
    int maxSize;
    int minSizeAlignment = 1;
    VideoCodec videoCodec = VideoCodec.H264;
    AudioCodec audioCodec = AudioCodec.OPUS;
    VideoSource videoSource = VideoSource.DISPLAY;
    AudioSource audioSource = AudioSource.OUTPUT;
    boolean audioDup;
    int videoBitRate = 8000000;
    int audioBitRate = 128000;
    float maxFps;
    float angle;
    boolean tunnelForward;
    Rect crop;
    boolean control = true;
    int displayId;
    String cameraId;
    Size cameraSize;
    CameraFacing cameraFacing;
    CameraAspectRatio cameraAspectRatio;
    float cameraZoom = 1;
    int cameraFps;
    boolean cameraHighSpeed;
    boolean cameraTorch;
    boolean showTouches;
    boolean turnScreenOff;
    boolean stayAwake;
    int screenOffTimeout = -1;
    int displayImePolicy = -1;
    List<CodecOption> videoCodecOptions;
    List<CodecOption> audioCodecOptions;

    String videoEncoder;
    String audioEncoder;
    boolean powerOffScreenOnClose;
    boolean clipboardAutosync = true;
    boolean downsizeOnError = true;
    boolean cleanup = true;
    boolean powerOn = true;

    NewDisplay newDisplay;
    boolean vdDestroyContent = true;
    boolean vdSystemDecorations = true;
    boolean flexDisplay;

    /** Package or scrcpy --start-app selector from web stream extras. */
    String startApp;

    boolean keepActive;
    boolean ignoreVideoEncoderConstraints;

    Orientation.Lock captureOrientationLock = Orientation.Lock.Unlocked;
    Orientation captureOrientation = Orientation.Orient0;

    boolean listEncoders;
    boolean listDisplays;
    boolean listCameras;
    boolean listCameraSizes;
    boolean listApps;
    boolean listAllApps;

    // Options not used by the scrcpy client, but useful to use scrcpy-server directly
    boolean sendDeviceMeta = true; // send device name and size
    boolean sendFrameMeta = true; // send PTS so that the client may record properly
    boolean sendDummyByte = true; // write a byte on start to detect connection issues
    boolean sendStreamMeta = true; // write the stream metadata (codec and session)

    ServerMode serverMode = ServerMode.LOCAL;
    int wsPort = 8886;
    boolean wsListenAll = true;

    public Ln.Level getLogLevel() {
        return logLevel;
    }

    public int getScid() {
        return scid;
    }

    public boolean getVideo() {
        return video;
    }

    public boolean getAudio() {
        return audio;
    }

    public int getMaxSize() {
        return maxSize;
    }

    public int getMinSizeAlignment() {
        return minSizeAlignment;
    }

    public VideoCodec getVideoCodec() {
        return videoCodec;
    }

    public AudioCodec getAudioCodec() {
        return audioCodec;
    }

    public VideoSource getVideoSource() {
        return videoSource;
    }

    public AudioSource getAudioSource() {
        return audioSource;
    }

    public boolean getAudioDup() {
        return audioDup;
    }

    public int getVideoBitRate() {
        return videoBitRate;
    }

    public int getAudioBitRate() {
        return audioBitRate;
    }

    public float getMaxFps() {
        return maxFps;
    }

    public float getAngle() {
        return angle;
    }

    public boolean isTunnelForward() {
        return tunnelForward;
    }

    public Rect getCrop() {
        return crop;
    }

    public boolean getControl() {
        return control;
    }

    public int getDisplayId() {
        return displayId;
    }

    public String getCameraId() {
        return cameraId;
    }

    public Size getCameraSize() {
        return cameraSize;
    }

    public CameraFacing getCameraFacing() {
        return cameraFacing;
    }

    public CameraAspectRatio getCameraAspectRatio() {
        return cameraAspectRatio;
    }

    public float getCameraZoom() {
        return cameraZoom;
    }

    public int getCameraFps() {
        return cameraFps;
    }

    public boolean getCameraHighSpeed() {
        return cameraHighSpeed;
    }

    public boolean getCameraTorch() {
        return cameraTorch;
    }

    public boolean getShowTouches() {
        return showTouches;
    }

    public boolean getTurnScreenOff() {
        return turnScreenOff;
    }

    public boolean getStayAwake() {
        return stayAwake;
    }

    public int getScreenOffTimeout() {
        return screenOffTimeout;
    }

    public int getDisplayImePolicy() {
        return displayImePolicy;
    }

    public List<CodecOption> getVideoCodecOptions() {
        return videoCodecOptions;
    }

    public List<CodecOption> getAudioCodecOptions() {
        return audioCodecOptions;
    }

    public String getVideoEncoder() {
        return videoEncoder;
    }

    public String getAudioEncoder() {
        return audioEncoder;
    }

    public boolean getPowerOffScreenOnClose() {
        return this.powerOffScreenOnClose;
    }

    public boolean getClipboardAutosync() {
        return clipboardAutosync;
    }

    public boolean getDownsizeOnError() {
        return downsizeOnError;
    }

    public boolean getCleanup() {
        return cleanup;
    }

    public boolean getPowerOn() {
        return powerOn;
    }

    public NewDisplay getNewDisplay() {
        return newDisplay;
    }

    public String getStartApp() {
        return startApp;
    }

    public Orientation getCaptureOrientation() {
        return captureOrientation;
    }

    public Orientation.Lock getCaptureOrientationLock() {
        return captureOrientationLock;
    }

    public boolean getVDDestroyContent() {
        return vdDestroyContent;
    }

    public boolean getVDSystemDecorations() {
        return vdSystemDecorations;
    }

    public boolean getIgnoreVideoEncoderConstraints() {
        return ignoreVideoEncoderConstraints;
    }

    public boolean getKeepActive() {
        return keepActive;
    }

    public boolean getFlexDisplay() {
        return flexDisplay;
    }

    public boolean getList() {
        return listEncoders || listDisplays || listCameras || listCameraSizes || listApps || listAllApps;
    }

    public boolean getListEncoders() {
        return listEncoders;
    }

    public boolean getListDisplays() {
        return listDisplays;
    }

    public boolean getListCameras() {
        return listCameras;
    }

    public boolean getListCameraSizes() {
        return listCameraSizes;
    }

    public boolean getListApps() {
        return listApps;
    }

    public boolean getListAllApps() {
        return listAllApps;
    }

    public boolean getSendDeviceMeta() {
        return sendDeviceMeta;
    }

    public boolean getSendFrameMeta() {
        return sendFrameMeta;
    }

    public boolean getSendDummyByte() {
        return sendDummyByte;
    }

    public boolean getSendStreamMeta() {
        return sendStreamMeta;
    }

    public ServerMode getServerMode() {
        return serverMode;
    }

    public int getWsPort() {
        return wsPort;
    }

    public boolean getWsListenAll() {
        return wsListenAll;
    }

    /** Build stream {@link Options} for a WebSocket client from ws-scrcpy {@link com.genymobile.scrcpy.ws.VideoSettings}. */
    public Options copyForWebStream(com.genymobile.scrcpy.ws.VideoSettings settings) {
        Options copy = new Options();
        copy.serverMode = ServerMode.WEB;
        copy.logLevel = logLevel;
        copy.video = true;
        copy.audio = false;
        copy.control = control;
        copy.tunnelForward = false;
        copy.sendDeviceMeta = false;
        copy.sendFrameMeta = false;
        copy.sendStreamMeta = false;
        copy.sendDummyByte = false;
        copy.videoCodec = videoCodec;
        copy.videoBitRate = settings.getBitRate();
        copy.maxFps = settings.getMaxFps();
        int streamDisplayId = settings.getDisplayId();
        copy.displayId = streamDisplayId == Device.DISPLAY_ID_NONE
            ? Device.DISPLAY_ID_NONE
            : streamDisplayId;
        if (settings.getCrop() != null) {
            copy.crop = settings.getCrop();
        } else {
            copy.crop = crop;
        }
        if (settings.getBounds() != null) {
            int edge = Math.max(settings.getBounds().getWidth(), settings.getBounds().getHeight());
            copy.maxSize = edge;
        } else if (maxSize > 0) {
            copy.maxSize = maxSize;
        }
        copy.videoCodecOptions = settings.getCodecOptions() != null ? settings.getCodecOptions() : videoCodecOptions;
        if (settings.getEncoderName() != null) {
            copy.videoEncoder = settings.getEncoderName();
        } else {
            copy.videoEncoder = videoEncoder;
        }
        copy.showTouches = showTouches;
        copy.stayAwake = stayAwake;
        copy.clipboardAutosync = clipboardAutosync;
        copy.powerOn = powerOn;
        // Multi-client web cast: each WS owns a pipeline. Competing CleanUp
        // processes unlink the server jar and fight over global settings.
        copy.cleanup = false;
        copy.downsizeOnError = downsizeOnError;
        copy.audioSource = audioSource;
        copy.audioDup = audioDup;
        copy.audioBitRate = audioBitRate;
        copy.audioCodec = audioCodec;
        copy.audioEncoder = audioEncoder;
        copy.videoSource = videoSource;
        copy.cameraId = cameraId;
        copy.cameraSize = cameraSize;
        copy.cameraFacing = cameraFacing;
        copy.cameraAspectRatio = cameraAspectRatio;
        copy.cameraZoom = cameraZoom;
        copy.cameraFps = cameraFps;
        copy.cameraHighSpeed = cameraHighSpeed;
        copy.cameraTorch = cameraTorch;
        OptionsWebExtras.applyVideoStreamExtras(copy, settings);
        OptionsWebExtras.normalizeWebAudioOptions(copy);
        return copy;
    }

    public static Options parse(String... args) {
        return OptionsParsing.parse(args);
    }
}
