package com.yiyi.cloud_phone;

import android.content.Context;
import android.content.Intent;
import android.os.Bundle;
import android.widget.ArrayAdapter;
import android.widget.AutoCompleteTextView;
import android.widget.ImageButton;
import android.widget.TextView;
import android.widget.Toast;

import androidx.annotation.Nullable;
import androidx.appcompat.app.AppCompatActivity;
import androidx.core.view.WindowCompat;
import androidx.viewpager2.widget.ViewPager2;

import com.google.android.material.button.MaterialButton;
import com.google.android.material.tabs.TabLayout;
import com.google.android.material.tabs.TabLayoutMediator;
import com.yiyi.cloud_phone.workspace.CastMode;
import com.yiyi.cloud_phone.workspace.CastSettingsStore;
import com.yiyi.cloud_phone.workspace.DeviceWorkspaceHost;
import com.yiyi.cloud_phone.workspace.DeviceWorkspacePagerAdapter;

import org.json.JSONObject;

public class DeviceWorkspaceActivity extends AppCompatActivity implements DeviceWorkspaceHost {
    public static final String EXTRA_SERIAL = "device_serial";
    public static final String EXTRA_DISPLAY_NAME = "device_display_name";
    public static final String EXTRA_CONNECTED = "device_connected";
    public static final String EXTRA_SDK = "device_sdk";
    public static final String EXTRA_STATE = "device_state";

    private String deviceSerial = "";
    private String deviceDisplayName = "";
    private boolean deviceConnected;
    private int deviceSdk;
    private CastMode castMode = CastMode.MIRROR;
    private JSONObject mirrorSettings;
    private JSONObject cameraSettings;

    private DeviceWorkspacePagerAdapter pagerAdapter;
    private TabLayoutMediator tabMediator;
    private AutoCompleteTextView inputCastMode;
    private TextView textHint;

    public static void open(Context context, DeviceItem device) {
        Intent intent = new Intent(context, DeviceWorkspaceActivity.class);
        intent.putExtra(EXTRA_SERIAL, device.serial);
        intent.putExtra(EXTRA_DISPLAY_NAME, device.displayName);
        intent.putExtra(EXTRA_CONNECTED, device.connected);
        intent.putExtra(EXTRA_SDK, parseSdk(device.sdkVersion));
        intent.putExtra(EXTRA_STATE, device.state);
        context.startActivity(intent);
    }

    @Override
    protected void onCreate(@Nullable Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        WindowCompat.setDecorFitsSystemWindows(getWindow(), true);
        setContentView(R.layout.activity_device_workspace);

        readIntentExtras();
        mirrorSettings = CastSettingsStore.loadMirror(this, deviceSerial);
        cameraSettings = CastSettingsStore.loadCamera(this, deviceSerial);
        castMode = CastSettingsStore.loadMode(this, deviceSerial);

        ImageButton buttonBack = findViewById(R.id.buttonBack);
        buttonBack.setImageDrawable(AppIcons.back(this));
        buttonBack.setOnClickListener(v -> finish());

        TextView textDeviceName = findViewById(R.id.textDeviceName);
        textDeviceName.setText(deviceDisplayName);

        textHint = findViewById(R.id.textHint);
        updateHint();

        MaterialButton buttonStartCast = findViewById(R.id.buttonStartCast);
        buttonStartCast.setEnabled(deviceConnected);
        buttonStartCast.setOnClickListener(v -> onStartCastRequested());

        setupCastModeSelector();
        setupSettingsPager();
    }

    private void readIntentExtras() {
        Intent intent = getIntent();
        deviceSerial = intent.getStringExtra(EXTRA_SERIAL);
        if (deviceSerial == null) {
            deviceSerial = "";
        }
        deviceDisplayName = intent.getStringExtra(EXTRA_DISPLAY_NAME);
        if (deviceDisplayName == null || deviceDisplayName.isEmpty()) {
            deviceDisplayName = deviceSerial;
        }
        deviceConnected = intent.getBooleanExtra(EXTRA_CONNECTED, false);
        deviceSdk = intent.getIntExtra(EXTRA_SDK, 0);
    }

    private void setupCastModeSelector() {
        inputCastMode = findViewById(R.id.inputCastMode);
        String[] labels = new String[] { "镜像投屏", "摄像头" };
        ArrayAdapter<String> adapter = new ArrayAdapter<>(
                this,
                android.R.layout.simple_list_item_1,
                labels
        );
        inputCastMode.setAdapter(adapter);
        inputCastMode.setText(castMode == CastMode.CAMERA ? labels[1] : labels[0], false);
        inputCastMode.setOnItemClickListener((parent, view, position, id) -> {
            CastMode next = position == 1 ? CastMode.CAMERA : CastMode.MIRROR;
            if (next != castMode) {
                persistSettings();
                setCastMode(next);
            }
        });
    }

    private void setupSettingsPager() {
        ViewPager2 pager = findViewById(R.id.settingsPager);
        TabLayout tabs = findViewById(R.id.settingsTabs);
        pagerAdapter = new DeviceWorkspacePagerAdapter(this);
        applyCastModeTabs(pager, tabs);
    }

    private void applyCastModeTabs(ViewPager2 pager, TabLayout tabs) {
        if (castMode == CastMode.CAMERA) {
            pagerAdapter.setCameraTabs();
        } else {
            pagerAdapter.setMirrorTabs();
        }
        pager.setAdapter(pagerAdapter);
        pager.setCurrentItem(0, false);
        if (tabMediator != null) {
            tabMediator.detach();
        }
        tabMediator = new TabLayoutMediator(tabs, pager, (tab, position) -> {
            tab.setText(pagerAdapter.tabTitle(position));
        });
        tabMediator.attach();
    }

    private void updateHint() {
        if (!deviceConnected) {
            textHint.setText(R.string.workspace_offline_hint);
            return;
        }
        textHint.setText(R.string.workspace_settings_hint);
    }

    @Override
    public String getDeviceSerial() {
        return deviceSerial;
    }

    @Override
    public String getDeviceDisplayName() {
        return deviceDisplayName;
    }

    @Override
    public int getDeviceSdk() {
        return deviceSdk;
    }

    @Override
    public boolean isDeviceConnected() {
        return deviceConnected;
    }

    @Override
    public CastMode getCastMode() {
        return castMode;
    }

    @Override
    public void setCastMode(CastMode mode) {
        castMode = mode;
        CastSettingsStore.saveMode(this, deviceSerial, castMode);
        ViewPager2 pager = findViewById(R.id.settingsPager);
        TabLayout tabs = findViewById(R.id.settingsTabs);
        applyCastModeTabs(pager, tabs);
    }

    @Override
    public JSONObject getMirrorSettings() {
        return mirrorSettings;
    }

    @Override
    public JSONObject getCameraSettings() {
        return cameraSettings;
    }

    @Override
    public boolean isSettingsLocked() {
        return false;
    }

    @Override
    public void persistSettings() {
        CastSettingsStore.saveMirror(this, deviceSerial, mirrorSettings);
        CastSettingsStore.saveCamera(this, deviceSerial, cameraSettings);
        CastSettingsStore.saveMode(this, deviceSerial, castMode);
    }

    @Override
    public void onStartCastRequested() {
        persistSettings();
        if (!deviceConnected) {
            Toast.makeText(this, R.string.workspace_offline_hint, Toast.LENGTH_SHORT).show();
            return;
        }
        Toast.makeText(this, R.string.workspace_settings_saved, Toast.LENGTH_SHORT).show();
    }

    @Override
    protected void onPause() {
        persistSettings();
        super.onPause();
    }

    @Override
    protected void onDestroy() {
        if (tabMediator != null) {
            tabMediator.detach();
        }
        super.onDestroy();
    }

    private static int parseSdk(String raw) {
        try {
            return Integer.parseInt(raw);
        } catch (Exception error) {
            return 0;
        }
    }
}
