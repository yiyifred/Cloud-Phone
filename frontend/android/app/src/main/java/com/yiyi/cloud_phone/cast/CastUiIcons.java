package com.yiyi.cloud_phone.cast;

import android.content.Context;
import android.content.res.ColorStateList;
import android.util.TypedValue;

import androidx.core.content.ContextCompat;

import com.mikepenz.iconics.IconicsDrawable;
import com.yiyi.cloud_phone.R;

final class CastUiIcons {
    private CastUiIcons() {
    }

    static IconicsDrawable back(Context context) {
        return icon(context, "cmd_arrow_left", android.R.color.white, 22);
    }

    static String actionLabel(Context context, String actionId) {
        switch (actionId) {
            case "home":
                return context.getString(R.string.cast_action_home);
            case "back":
                return context.getString(R.string.cast_action_back);
            case "recents":
                return context.getString(R.string.cast_action_recents);
            case "power":
                return context.getString(R.string.cast_action_power);
            case "volume-up":
                return context.getString(R.string.cast_action_volume_up);
            case "volume-down":
                return context.getString(R.string.cast_action_volume_down);
            case "rotate":
                return context.getString(R.string.cast_action_rotate);
            case "stop":
                return context.getString(R.string.cast_action_stop);
            default:
                return actionId;
        }
    }

    static IconicsDrawable action(Context context, String actionId) {
        String iconKey;
        switch (actionId) {
            case "home":
                iconKey = "cmd_home";
                break;
            case "back":
                iconKey = "cmd_arrow_left";
                break;
            case "recents":
                iconKey = "cmd_apps";
                break;
            case "power":
                iconKey = "cmd_power";
                break;
            case "volume-up":
                iconKey = "cmd_volume_high";
                break;
            case "volume-down":
                iconKey = "cmd_volume_low";
                break;
            case "rotate":
                iconKey = "cmd_rotate_right";
                break;
            case "stop":
                iconKey = "cmd_stop";
                break;
            default:
                iconKey = "cmd_dots_horizontal";
                break;
        }
        return icon(context, iconKey, android.R.color.white, 22);
    }

    private static IconicsDrawable icon(Context context, String iconKey, int colorRes, int sizeDp) {
        IconicsDrawable drawable = new IconicsDrawable(context, iconKey);
        drawable.setColorList(ColorStateList.valueOf(ContextCompat.getColor(context, colorRes)));
        int px = Math.round(TypedValue.applyDimension(
                TypedValue.COMPLEX_UNIT_DIP,
                sizeDp,
                context.getResources().getDisplayMetrics()
        ));
        drawable.setSizeXPx(px);
        drawable.setSizeYPx(px);
        return drawable;
    }
}
