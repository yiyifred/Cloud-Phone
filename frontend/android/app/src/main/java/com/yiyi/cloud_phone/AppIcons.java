package com.yiyi.cloud_phone;

import android.content.Context;
import android.content.res.ColorStateList;
import android.util.TypedValue;

import androidx.annotation.ColorRes;
import androidx.core.content.ContextCompat;

import com.mikepenz.iconics.IconicsDrawable;

final class AppIcons {
    private AppIcons() {
    }

    private static int toPx(Context context, int dp) {
        return Math.round(TypedValue.applyDimension(
                TypedValue.COMPLEX_UNIT_DIP,
                dp,
                context.getResources().getDisplayMetrics()
        ));
    }

    private static void applySize(IconicsDrawable drawable, Context context, int sizeDp) {
        int px = toPx(context, sizeDp);
        drawable.setSizeXPx(px);
        drawable.setSizeYPx(px);
    }

    private static IconicsDrawable drawable(
            Context context,
            String iconKey,
            @ColorRes int colorRes,
            int sizeDp
    ) {
        IconicsDrawable drawable = new IconicsDrawable(context, iconKey);
        drawable.setColorList(ColorStateList.valueOf(ContextCompat.getColor(context, colorRes)));
        applySize(drawable, context, sizeDp);
        return drawable;
    }

    private static IconicsDrawable navIcon(Context context, String iconKey) {
        IconicsDrawable drawable = new IconicsDrawable(context, iconKey);
        drawable.setColorList(ContextCompat.getColorStateList(context, R.color.console_nav_item));
        applySize(drawable, context, 22);
        return drawable;
    }

    static IconicsDrawable addDevice(Context context) {
        return drawable(context, "cmd_plus", R.color.auth_primary_text, 22);
    }

    static IconicsDrawable close(Context context) {
        return drawable(context, "cmd_close", R.color.auth_text_secondary, 22);
    }

    static IconicsDrawable devicePlaceholder(Context context) {
        return drawable(context, "cmd_cellphone", R.color.auth_text_secondary, 28);
    }

    static IconicsDrawable tabDevices(Context context) {
        return navIcon(context, "cmd_cellphone_link");
    }

    static IconicsDrawable tabSettings(Context context) {
        return navIcon(context, "cmd_cog");
    }

    static IconicsDrawable androidPlatform(Context context) {
        return drawable(context, "cmd_android", R.color.auth_text_primary, 28);
    }

    static IconicsDrawable modeUsb(Context context) {
        return drawable(context, "cmd_usb", R.color.auth_text_primary, 20);
    }

    static IconicsDrawable modePairCode(Context context) {
        return drawable(context, "cmd_key_variant", R.color.auth_text_primary, 20);
    }

    static IconicsDrawable modeQr(Context context) {
        return drawable(context, "cmd_qrcode", R.color.auth_text_primary, 20);
    }
}
