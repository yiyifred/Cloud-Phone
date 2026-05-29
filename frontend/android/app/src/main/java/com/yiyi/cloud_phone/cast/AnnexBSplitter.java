package com.yiyi.cloud_phone.cast;

import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;

final class AnnexBSplitter {
    private AnnexBSplitter() {
    }

    static List<byte[]> splitNals(byte[] data) {
        List<byte[]> nals = new ArrayList<>();
        if (data == null || data.length < 4) {
            return nals;
        }
        List<Integer> offsets = findStartOffsets(data);
        for (int index = 0; index < offsets.size(); index += 1) {
            int begin = offsets.get(index);
            int end = index + 1 < offsets.size() ? offsets.get(index + 1) : data.length;
            if (end > begin) {
                nals.add(Arrays.copyOfRange(data, begin, end));
            }
        }
        if (nals.isEmpty() && data.length >= 4) {
            nals.add(Arrays.copyOf(data, data.length));
        }
        return nals;
    }

    private static List<Integer> findStartOffsets(byte[] data) {
        List<Integer> offsets = new ArrayList<>();
        for (int index = 0; index + 3 < data.length; index += 1) {
            if (isStartCodeAt(data, index)) {
                offsets.add(index);
                index += 3;
            }
        }
        return offsets;
    }

    static boolean isStartCodeAt(byte[] bytes, int offset) {
        if (offset + 3 >= bytes.length) {
            return false;
        }
        if (bytes[offset] == 0 && bytes[offset + 1] == 0) {
            if (bytes[offset + 2] == 1) {
                return true;
            }
            return offset + 3 < bytes.length
                    && bytes[offset + 2] == 0
                    && bytes[offset + 3] == 1;
        }
        return false;
    }

    static int startCodeLength(byte[] bytes, int offset) {
        if (!isStartCodeAt(bytes, offset)) {
            return 0;
        }
        return bytes[offset + 2] == 1 ? 3 : 4;
    }

    static Integer nalTypeAt(byte[] bytes, int offset) {
        if (!isStartCodeAt(bytes, offset)) {
            return null;
        }
        int header = offset + startCodeLength(bytes, offset);
        if (header >= bytes.length) {
            return null;
        }
        return bytes[header] & 0x1f;
    }
}
