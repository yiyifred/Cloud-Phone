package com.yiyi.cloud_phone;

import android.app.Application;

import com.yiyi.cloud_phone.settings.AppLocaleStore;
import com.yiyi.cloud_phone.settings.AppThemeStore;

/** Community Material font is auto-registered via Jetpack Startup (Iconics typeface library). */
public class CloudPhoneApplication extends Application {
    @Override
    public void onCreate() {
        super.onCreate();
        AppThemeStore.applySaved(this);
        AppLocaleStore.applySaved(this);
    }
}
