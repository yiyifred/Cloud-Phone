package com.genymobile.scrcpy;

import com.genymobile.scrcpy.audio.AudioCodec;
import com.genymobile.scrcpy.audio.AudioSource;
import com.genymobile.scrcpy.device.Device;
import com.genymobile.scrcpy.model.CodecOption;
import com.genymobile.scrcpy.model.Orientation;
import com.genymobile.scrcpy.model.Size;
import com.genymobile.scrcpy.util.Ln;
import com.genymobile.scrcpy.video.CameraAspectRatio;
import com.genymobile.scrcpy.video.CameraFacing;
import com.genymobile.scrcpy.video.VideoCodec;
import com.genymobile.scrcpy.video.VideoSource;

import android.util.Pair;

import java.util.Locale;

final class OptionsParsing {

    private OptionsParsing() {
    }

    static Options parse(String... args) {
        if (args.length < 1) {
            throw new IllegalArgumentException("Missing client version");
        }

        String clientVersion = args[0];
        if (!clientVersion.equals(BuildConfig.VERSION_NAME)) {
            throw new IllegalArgumentException(
                    "The server version (" + BuildConfig.VERSION_NAME + ") does not match the client " + "(" + clientVersion + ")");
        }

        Options options = new Options();

        if (args.length > 1 && "web".equalsIgnoreCase(args[1])) {
            options.serverMode = Options.ServerMode.WEB;
            options.video = true;
            options.audio = false;
            options.control = true;
            options.tunnelForward = false;
            options.sendDeviceMeta = false;
            options.sendFrameMeta = false;
            options.sendStreamMeta = false;
            options.sendDummyByte = false;
            if (args.length > 2) {
                options.logLevel = Ln.Level.valueOf(args[2].toUpperCase(Locale.ENGLISH));
            }
            if (args.length > 3) {
                options.wsPort = Integer.parseInt(args[3]);
            }
            if (args.length > 4) {
                options.wsListenAll = Boolean.parseBoolean(args[4]);
            }
            return options;
        }

        for (int i = 1; i < args.length; ++i) {
            String arg = args[i];
            int equalIndex = arg.indexOf('=');
            if (equalIndex == -1) {
                throw new IllegalArgumentException("Invalid key=value pair: \"" + arg + "\"");
            }
            String key = arg.substring(0, equalIndex);
            String value = arg.substring(equalIndex + 1);
            switch (key) {
                case "scid":
                    int scid = Integer.parseInt(value, 0x10);
                    if (scid < -1) {
                        throw new IllegalArgumentException("scid may not be negative (except -1 for 'none'): " + scid);
                    }
                    options.scid = scid;
                    break;
                case "log_level":
                    options.logLevel = Ln.Level.valueOf(value.toUpperCase(Locale.ENGLISH));
                    break;
                case "video":
                    options.video = Boolean.parseBoolean(value);
                    break;
                case "audio":
                    options.audio = Boolean.parseBoolean(value);
                    break;
                case "video_codec":
                    VideoCodec videoCodec = VideoCodec.findByName(value);
                    if (videoCodec == null) {
                        throw new IllegalArgumentException("Video codec " + value + " not supported");
                    }
                    options.videoCodec = videoCodec;
                    break;
                case "audio_codec":
                    AudioCodec audioCodec = AudioCodec.findByName(value);
                    if (audioCodec == null) {
                        throw new IllegalArgumentException("Audio codec " + value + " not supported");
                    }
                    options.audioCodec = audioCodec;
                    break;
                case "video_source":
                    VideoSource videoSource = VideoSource.findByName(value);
                    if (videoSource == null) {
                        throw new IllegalArgumentException("Video source " + value + " not supported");
                    }
                    options.videoSource = videoSource;
                    break;
                case "audio_source":
                    AudioSource audioSource = AudioSource.findByName(value);
                    if (audioSource == null) {
                        throw new IllegalArgumentException("Audio source " + value + " not supported");
                    }
                    options.audioSource = audioSource;
                    break;
                case "audio_dup":
                    options.audioDup = Boolean.parseBoolean(value);
                    break;
                case "max_size":
                    options.maxSize = Integer.parseInt(value);
                    break;
                case "min_size_alignment":
                    int align = Integer.parseInt(value);
                    if (align < 1 || align > 16 || (align & (align - 1)) != 0) {
                        throw new IllegalArgumentException("min_size_alignment (" + align + ") must be 1, 2, 4, 8 or 16");
                    }
                    options.minSizeAlignment = align;
                    break;
                case "video_bit_rate":
                    options.videoBitRate = Integer.parseInt(value);
                    break;
                case "audio_bit_rate":
                    options.audioBitRate = Integer.parseInt(value);
                    break;
                case "max_fps":
                    options.maxFps = OptionsValueParsers.parseFloat("max_fps", value);
                    break;
                case "angle":
                    options.angle = OptionsValueParsers.parseFloat("angle", value);
                    break;
                case "tunnel_forward":
                    options.tunnelForward = Boolean.parseBoolean(value);
                    break;
                case "crop":
                    if (!value.isEmpty()) {
                        options.crop = OptionsValueParsers.parseCrop(value);
                    }
                    break;
                case "control":
                    options.control = Boolean.parseBoolean(value);
                    break;
                case "display_id":
                    options.displayId = Integer.parseInt(value);
                    break;
                case "show_touches":
                    options.showTouches = Boolean.parseBoolean(value);
                    break;
                case "stay_awake":
                    options.stayAwake = Boolean.parseBoolean(value);
                    break;
                case "screen_off_timeout":
                    options.screenOffTimeout = Integer.parseInt(value);
                    if (options.screenOffTimeout < -1) {
                        throw new IllegalArgumentException("Invalid screen off timeout: " + options.screenOffTimeout);
                    }
                    break;
                case "video_codec_options":
                    options.videoCodecOptions = CodecOption.parse(value);
                    break;
                case "audio_codec_options":
                    options.audioCodecOptions = CodecOption.parse(value);
                    break;
                case "video_encoder":
                    if (!value.isEmpty()) {
                        options.videoEncoder = value;
                    }
                    break;
                case "audio_encoder":
                    if (!value.isEmpty()) {
                        options.audioEncoder = value;
                    }
                    break;
                case "power_off_on_close":
                    options.powerOffScreenOnClose = Boolean.parseBoolean(value);
                    break;
                case "clipboard_autosync":
                    options.clipboardAutosync = Boolean.parseBoolean(value);
                    break;
                case "downsize_on_error":
                    options.downsizeOnError = Boolean.parseBoolean(value);
                    break;
                case "cleanup":
                    options.cleanup = Boolean.parseBoolean(value);
                    break;
                case "power_on":
                    options.powerOn = Boolean.parseBoolean(value);
                    break;
                case "list_encoders":
                    options.listEncoders = Boolean.parseBoolean(value);
                    break;
                case "list_displays":
                    options.listDisplays = Boolean.parseBoolean(value);
                    break;
                case "list_cameras":
                    options.listCameras = Boolean.parseBoolean(value);
                    break;
                case "list_camera_sizes":
                    options.listCameraSizes = Boolean.parseBoolean(value);
                    break;
                case "list_apps":
                    options.listApps = Boolean.parseBoolean(value);
                    break;
                case "list_all_apps":
                    options.listAllApps = Boolean.parseBoolean(value);
                    break;
                case "camera_id":
                    if (!value.isEmpty()) {
                        options.cameraId = value;
                    }
                    break;
                case "camera_size":
                    if (!value.isEmpty()) {
                        options.cameraSize = OptionsValueParsers.parseSize(value);
                    }
                    break;
                case "camera_facing":
                    if (!value.isEmpty()) {
                        CameraFacing facing = CameraFacing.findByName(value);
                        if (facing == null) {
                            throw new IllegalArgumentException("Camera facing " + value + " not supported");
                        }
                        options.cameraFacing = facing;
                    }
                    break;
                case "camera_ar":
                    if (!value.isEmpty()) {
                        options.cameraAspectRatio = OptionsValueParsers.parseCameraAspectRatio(value);
                    }
                    break;
                case "camera_zoom":
                    if (!value.isEmpty()) {
                        options.cameraZoom = Float.parseFloat(value);
                    }
                    break;
                case "camera_fps":
                    options.cameraFps = Integer.parseInt(value);
                    break;
                case "camera_high_speed":
                    options.cameraHighSpeed = Boolean.parseBoolean(value);
                    break;
                case "camera_torch":
                    options.cameraTorch = Boolean.parseBoolean(value);
                    break;
                case "new_display":
                    options.newDisplay = OptionsValueParsers.parseNewDisplay(value);
                    break;
                case "vd_destroy_content":
                    options.vdDestroyContent = Boolean.parseBoolean(value);
                    break;
                case "vd_system_decorations":
                    options.vdSystemDecorations = Boolean.parseBoolean(value);
                    break;
                case "flex_display":
                    options.flexDisplay = Boolean.parseBoolean(value);
                    break;
                case "capture_orientation":
                    Pair<Orientation.Lock, Orientation> pair = OptionsValueParsers.parseCaptureOrientation(value);
                    options.captureOrientationLock = pair.first;
                    options.captureOrientation = pair.second;
                    break;
                case "display_ime_policy":
                    options.displayImePolicy = OptionsValueParsers.parseDisplayImePolicy(value);
                    break;
                case "ignore_video_encoder_constraints":
                    options.ignoreVideoEncoderConstraints = Boolean.parseBoolean(value);
                    break;
                case "keep_active":
                    options.keepActive = Boolean.parseBoolean(value);
                    break;
                case "send_device_meta":
                    options.sendDeviceMeta = Boolean.parseBoolean(value);
                    break;
                case "send_frame_meta":
                    options.sendFrameMeta = Boolean.parseBoolean(value);
                    break;
                case "send_dummy_byte":
                    options.sendDummyByte = Boolean.parseBoolean(value);
                    break;
                case "send_stream_meta":
                    options.sendStreamMeta = Boolean.parseBoolean(value);
                    break;
                case "raw_stream":
                    boolean rawStream = Boolean.parseBoolean(value);
                    if (rawStream) {
                        options.sendDeviceMeta = false;
                        options.sendFrameMeta = false;
                        options.sendDummyByte = false;
                        options.sendStreamMeta = false;
                    }
                    break;
                case "server_mode":
                    if ("web".equalsIgnoreCase(value) || "websocket".equalsIgnoreCase(value)) {
                        options.serverMode = Options.ServerMode.WEB;
                    } else {
                        options.serverMode = Options.ServerMode.LOCAL;
                    }
                    break;
                case "ws_port":
                    options.wsPort = Integer.parseInt(value);
                    break;
                case "ws_listen_all":
                    options.wsListenAll = Boolean.parseBoolean(value);
                    break;
                default:
                    Ln.w("Unknown server option: " + key);
                    break;
            }
        }

        if (options.newDisplay != null) {
            assert options.displayId == 0 : "Must not set both displayId and newDisplay";
            options.displayId = Device.DISPLAY_ID_NONE;
        }

        return options;
    }
}
