package com.yiyi.cloud_phone;

import android.content.Intent;
import android.os.Bundle;

import androidx.activity.EdgeToEdge;
import androidx.appcompat.app.AppCompatActivity;
import androidx.core.graphics.Insets;
import androidx.core.view.ViewCompat;
import androidx.core.view.WindowInsetsCompat;
import androidx.fragment.app.Fragment;

import com.google.android.material.navigation.NavigationBarView;
import com.yiyi.cloud_phone.group.GroupControlFragment;
import com.yiyi.cloud_phone.logs.LogsFragment;

public class ConsoleActivity extends AppCompatActivity {
    private static final String KEY_SELECTED_NAV = "selected_nav";

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        if (SessionKeyStore.load(this).isEmpty()) {
            startActivity(new Intent(this, MainActivity.class));
            finish();
            return;
        }
        EdgeToEdge.enable(this);
        setContentView(R.layout.activity_console);
        com.yiyi.cloud_phone.logs.AppEventLogger.get().attach(this);

        ViewCompat.setOnApplyWindowInsetsListener(findViewById(R.id.consoleRoot), (view, insets) -> {
            Insets systemBars = insets.getInsets(WindowInsetsCompat.Type.systemBars());
            view.setPadding(systemBars.left, systemBars.top, systemBars.right, 0);
            return insets;
        });

        NavigationBarView bottomNav = findViewById(R.id.bottomNav);
        bottomNav.getMenu().findItem(R.id.nav_devices).setIcon(AppIcons.tabDevices(this));
        bottomNav.getMenu().findItem(R.id.nav_group).setIcon(AppIcons.tabGroup(this));
        bottomNav.getMenu().findItem(R.id.nav_logs).setIcon(AppIcons.tabLogs(this));
        bottomNav.getMenu().findItem(R.id.nav_settings).setIcon(AppIcons.tabSettings(this));

        ViewCompat.setOnApplyWindowInsetsListener(bottomNav, (view, insets) -> {
            Insets navBars = insets.getInsets(WindowInsetsCompat.Type.systemBars());
            view.setPadding(view.getPaddingLeft(), view.getPaddingTop(), view.getPaddingRight(), navBars.bottom);
            return insets;
        });

        bottomNav.setOnItemSelectedListener(item -> {
            showTab(item.getItemId());
            return true;
        });

        if (savedInstanceState == null) {
            bottomNav.setSelectedItemId(R.id.nav_devices);
        } else {
            bottomNav.setSelectedItemId(
                    savedInstanceState.getInt(KEY_SELECTED_NAV, R.id.nav_devices)
            );
        }
    }

    @Override
    protected void onSaveInstanceState(Bundle outState) {
        super.onSaveInstanceState(outState);
        NavigationBarView bottomNav = findViewById(R.id.bottomNav);
        outState.putInt(KEY_SELECTED_NAV, bottomNav.getSelectedItemId());
    }

    private void showTab(int itemId) {
        Fragment fragment;
        if (itemId == R.id.nav_settings) {
            fragment = new SettingsFragment();
        } else if (itemId == R.id.nav_group) {
            fragment = new GroupControlFragment();
        } else if (itemId == R.id.nav_logs) {
            fragment = new LogsFragment();
        } else {
            fragment = new DevicesFragment();
        }
        getSupportFragmentManager()
                .beginTransaction()
                .replace(R.id.fragmentContainer, fragment)
                .commit();
    }
}
