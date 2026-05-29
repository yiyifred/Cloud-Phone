package com.yiyi.cloud_phone.cast;

import android.app.Activity;
import android.content.Intent;
import android.view.View;
import android.view.animation.Animation;
import android.view.animation.AnimationUtils;

import com.yiyi.cloud_phone.R;

final class CastMotion {
    private CastMotion() {
    }

    static void openCast(Activity activity, Intent intent) {
        activity.startActivity(intent);
        activity.overridePendingTransition(R.anim.cast_fade_in, R.anim.cast_fade_out);
    }

    static void closeCast(Activity activity) {
        activity.finish();
        activity.overridePendingTransition(R.anim.cast_fade_in, R.anim.cast_fade_out);
    }

    static void fadeIn(View view) {
        if (view == null) {
            return;
        }
        view.setAlpha(0f);
        view.setVisibility(View.VISIBLE);
        view.animate().alpha(1f).setDuration(220L).start();
    }

    static void fadeOut(View view, Runnable onEnd) {
        if (view == null) {
            if (onEnd != null) {
                onEnd.run();
            }
            return;
        }
        view.animate()
                .alpha(0f)
                .setDuration(180L)
                .withEndAction(() -> {
                    view.setVisibility(View.GONE);
                    view.setAlpha(1f);
                    if (onEnd != null) {
                        onEnd.run();
                    }
                })
                .start();
    }

    static void playScreenshotFlash(View flashView) {
        if (flashView == null) {
            return;
        }
        Animation animation = AnimationUtils.loadAnimation(flashView.getContext(), R.anim.cast_flash);
        flashView.setVisibility(View.VISIBLE);
        flashView.startAnimation(animation);
        flashView.postDelayed(() -> flashView.setVisibility(View.GONE), 560L);
    }

    static void pulseLiveDot(View dot) {
        if (dot == null) {
            return;
        }
        dot.animate().scaleX(1.25f).scaleY(1.25f).setDuration(500L).withEndAction(() -> {
            dot.animate().scaleX(1f).scaleY(1f).setDuration(500L).withEndAction(() -> pulseLiveDot(dot)).start();
        }).start();
    }
}
