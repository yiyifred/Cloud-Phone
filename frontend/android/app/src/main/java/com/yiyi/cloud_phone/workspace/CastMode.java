package com.yiyi.cloud_phone.workspace;

public enum CastMode {
    MIRROR("mirror"),
    CAMERA("camera");

    public final String id;

    CastMode(String id) {
        this.id = id;
    }

    static CastMode fromId(String id) {
        if (CAMERA.id.equals(id)) {
            return CAMERA;
        }
        return MIRROR;
    }
}
