package com.yiyi.cloud_phone.cast;

import android.graphics.SurfaceTexture;
import android.media.MediaCodec;
import android.media.MediaFormat;
import android.os.Handler;
import android.os.HandlerThread;
import android.view.Surface;

import java.nio.ByteBuffer;
import java.util.Arrays;
import java.util.List;

public final class AnnexBH264Decoder {
    public interface Listener {
        void onVideoFrameSize(int width, int height);

        void onFrameRendered();
    }

    private static final String MIME = "video/avc";

    private final HandlerThread codecThread = new HandlerThread("cast-h264");
    private Handler codecHandler;

    private MediaCodec codec;
    private Surface surface;
    private SurfaceTexture surfaceTexture;
    private byte[] buffer;
    private boolean bufferedSps;
    private boolean bufferedPps;
    private boolean hadIdr;
    private long timestampUs;
    private int videoWidth;
    private int videoHeight;
    private Listener listener;
    private String lastError = "";

    public AnnexBH264Decoder() {
        codecThread.start();
        codecHandler = new Handler(codecThread.getLooper());
    }

    public void setListener(Listener listener) {
        this.listener = listener;
    }

    public void attachSurface(Surface nextSurface, SurfaceTexture texture) {
        codecHandler.post(() -> {
            surface = nextSurface;
            surfaceTexture = texture;
            if (surfaceTexture != null && videoWidth > 0 && videoHeight > 0) {
                surfaceTexture.setDefaultBufferSize(videoWidth, videoHeight);
            }
            releaseCodecInternal();
        });
    }

    public String getLastError() {
        return lastError;
    }

    public int getVideoWidth() {
        return videoWidth;
    }

    public int getVideoHeight() {
        return videoHeight;
    }

    public void pushFrame(byte[] data) {
        if (data == null || data.length < 4) {
            return;
        }
        byte[] copy = Arrays.copyOf(data, data.length);
        codecHandler.post(() -> handlePacket(copy));
    }

    public void release() {
        codecHandler.post(this::releaseCodecInternal);
        codecThread.quitSafely();
    }

    private void handlePacket(byte[] data) {
        List<byte[]> nals = AnnexBSplitter.splitNals(data);
        if (nals.isEmpty()) {
            return;
        }
        for (byte[] nal : nals) {
            handleNal(nal);
        }
    }

    private void handleNal(byte[] data) {
        Integer nalType = AnnexBSplitter.nalTypeAt(data, 0);
        if (nalType == null) {
            return;
        }
        if (nalType == 7) {
            bufferedSps = true;
            buffer = appendToBuffer(data);
            hadIdr = false;
            return;
        }
        if (nalType == 8) {
            bufferedPps = true;
            buffer = appendToBuffer(data);
            if (bufferedSps && codec == null) {
                configureCodecFromBuffer();
            }
            return;
        }
        if (nalType == 6 && (!bufferedSps || !bufferedPps)) {
            return;
        }
        byte[] merged = appendToBuffer(data);
        hadIdr = hadIdr || nalType == 5;
        if (codec == null || !hadIdr) {
            return;
        }
        decodeChunk(merged, nalType == 5);
        buffer = null;
        bufferedPps = false;
        bufferedSps = false;
    }

    private void decodeChunk(byte[] chunk, boolean keyFrame) {
        try {
            drainOutput(false);
            int inputIndex = codec.dequeueInputBuffer(20_000);
            if (inputIndex < 0) {
                return;
            }
            ByteBuffer inputBuffer = codec.getInputBuffer(inputIndex);
            if (inputBuffer == null) {
                return;
            }
            inputBuffer.clear();
            inputBuffer.put(chunk);
            int flags = keyFrame ? MediaCodec.BUFFER_FLAG_KEY_FRAME : 0;
            codec.queueInputBuffer(inputIndex, 0, chunk.length, timestampUs, flags);
            timestampUs += 33_333;
            drainOutput(false);
        } catch (Exception error) {
            lastError = error.getMessage() == null ? "decode_failed" : error.getMessage();
        }
    }

    private void drainOutput(boolean endOfStream) {
        if (codec == null) {
            return;
        }
        MediaCodec.BufferInfo info = new MediaCodec.BufferInfo();
        while (true) {
            int outputIndex = codec.dequeueOutputBuffer(info, 0);
            if (outputIndex == MediaCodec.INFO_TRY_AGAIN_LATER) {
                break;
            }
            if (outputIndex == MediaCodec.INFO_OUTPUT_FORMAT_CHANGED) {
                MediaFormat format = codec.getOutputFormat();
                int width = format.getInteger(MediaFormat.KEY_WIDTH);
                int height = format.getInteger(MediaFormat.KEY_HEIGHT);
                updateVideoSize(width, height);
                continue;
            }
            if (outputIndex >= 0) {
                boolean render = info.size > 0;
                codec.releaseOutputBuffer(outputIndex, render);
                if (render && listener != null) {
                    listener.onFrameRendered();
                }
                if ((info.flags & MediaCodec.BUFFER_FLAG_END_OF_STREAM) != 0) {
                    break;
                }
            }
        }
        if (endOfStream) {
            // no-op
        }
    }

    private void configureCodecFromBuffer() {
        if (surface == null || buffer == null) {
            return;
        }
        byte[] spsFrame = findNalFrame(buffer, 7);
        byte[] ppsFrame = findNalFrame(buffer, 8);
        if (spsFrame == null || ppsFrame == null) {
            return;
        }
        try {
            releaseCodecInternal();
            byte[] csd = new byte[spsFrame.length + ppsFrame.length];
            System.arraycopy(spsFrame, 0, csd, 0, spsFrame.length);
            System.arraycopy(ppsFrame, 0, csd, spsFrame.length, ppsFrame.length);
            MediaFormat format = MediaFormat.createVideoFormat(MIME, 1280, 720);
            format.setByteBuffer("csd-0", ByteBuffer.wrap(csd));
            codec = MediaCodec.createDecoderByType(MIME);
            codec.configure(format, surface, null, 0);
            codec.start();
            lastError = "";
        } catch (Exception error) {
            lastError = error.getMessage() == null ? "configure_failed" : error.getMessage();
        }
    }

    private static byte[] findNalFrame(byte[] annexB, int targetType) {
        List<byte[]> nals = AnnexBSplitter.splitNals(annexB);
        for (byte[] nal : nals) {
            Integer type = AnnexBSplitter.nalTypeAt(nal, 0);
            if (type != null && type == targetType) {
                return nal;
            }
        }
        return null;
    }

    private void updateVideoSize(int width, int height) {
        if (width <= 0 || height <= 0) {
            return;
        }
        if (videoWidth == width && videoHeight == height) {
            return;
        }
        videoWidth = width;
        videoHeight = height;
        if (surfaceTexture != null) {
            surfaceTexture.setDefaultBufferSize(width, height);
        }
        if (listener != null) {
            listener.onVideoFrameSize(width, height);
        }
    }

    private void releaseCodecInternal() {
        if (codec == null) {
            return;
        }
        try {
            codec.stop();
        } catch (Exception ignored) {
            // ignore
        }
        try {
            codec.release();
        } catch (Exception ignored) {
            // ignore
        }
        codec = null;
    }

    private byte[] appendToBuffer(byte[] data) {
        if (buffer == null) {
            return Arrays.copyOf(data, data.length);
        }
        byte[] merged = new byte[buffer.length + data.length];
        System.arraycopy(buffer, 0, merged, 0, buffer.length);
        System.arraycopy(data, 0, merged, buffer.length, data.length);
        return merged;
    }
}
