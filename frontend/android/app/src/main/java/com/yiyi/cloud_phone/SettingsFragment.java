package com.yiyi.cloud_phone;

import android.content.Intent;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.text.TextUtils;
import android.view.LayoutInflater;
import android.view.View;
import android.view.ViewGroup;
import android.widget.AdapterView;
import android.widget.ArrayAdapter;
import android.widget.Spinner;
import android.widget.TextView;
import android.widget.Toast;

import androidx.annotation.NonNull;
import androidx.annotation.Nullable;
import androidx.fragment.app.Fragment;

import com.google.android.material.button.MaterialButton;
import com.google.android.material.button.MaterialButtonToggleGroup;
import com.google.android.material.textfield.TextInputEditText;
import com.yiyi.cloud_phone.settings.AppLocaleStore;
import com.yiyi.cloud_phone.settings.AppPrefs;
import com.yiyi.cloud_phone.settings.AppThemeStore;
import com.yiyi.cloud_phone.settings.RefreshIntervalStore;
import com.yiyi.cloud_phone.settings.ServerEndpointStore;
import com.yiyi.cloud_phone.settings.SettingsDateFormat;

import java.net.CookieHandler;
import java.net.CookieManager;
import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

public class SettingsFragment extends Fragment {
    private final AuthApiClient authApiClient = new AuthApiClient();
    private final ExecutorService networkExecutor = Executors.newSingleThreadExecutor();
    private final Handler mainHandler = new Handler(Looper.getMainLooper());

    private TextView textPasswordStatus;
    private TextView textSessionExpiry;
    private TextView textRefreshFeedback;
    private TextInputEditText editDeviceInterval;
    private TextInputEditText editScreenshotInterval;
    private TextView textServerEndpoint;
    private MaterialButtonToggleGroup toggleTheme;
    private ServerEndpointStore.Endpoint endpoint;
    private List<AppLocaleStore.LocaleOption> localeOptions = new ArrayList<>();
    private boolean suppressLocaleCallback;

    @Nullable
    @Override
    public View onCreateView(
            @NonNull LayoutInflater inflater,
            @Nullable ViewGroup container,
            @Nullable Bundle savedInstanceState
    ) {
        return inflater.inflate(R.layout.fragment_settings, container, false);
    }

    @Override
    public void onViewCreated(@NonNull View view, @Nullable Bundle savedInstanceState) {
        super.onViewCreated(view, savedInstanceState);
        endpoint = ServerEndpointStore.read(requireContext());
        bindAccountSection(view);
        bindAppearanceSection(view);
        bindRefreshSection(view);
        bindServerSection(view);
        loadAccountInfo();
        bindAppearanceValues();
        bindRefreshValues();
        updateServerLabel();
    }

    @Override
    public void onResume() {
        super.onResume();
        endpoint = ServerEndpointStore.read(requireContext());
        updateServerLabel();
        loadAccountInfo();
    }

    @Override
    public void onDestroy() {
        networkExecutor.shutdownNow();
        super.onDestroy();
    }

    private void bindAccountSection(View root) {
        textPasswordStatus = root.findViewById(R.id.textPasswordStatus);
        textSessionExpiry = root.findViewById(R.id.textSessionExpiry);
        MaterialButton changePassword = root.findViewById(R.id.buttonChangePassword);
        MaterialButton logout = root.findViewById(R.id.buttonLogout);
        changePassword.setOnClickListener(v -> {
            if (endpoint == null || !endpoint.isValid()) {
                toast(R.string.settings_server_missing);
                return;
            }
            ChangePasswordBottomSheet.show(this, endpoint, this::loadAccountInfo);
        });
        logout.setOnClickListener(v -> performLogout());
    }

    private void bindAppearanceSection(View root) {
        Spinner spinner = root.findViewById(R.id.spinnerLocale);
        toggleTheme = root.findViewById(R.id.toggleTheme);
        localeOptions = AppLocaleStore.options();
        List<String> labels = new ArrayList<>();
        for (AppLocaleStore.LocaleOption option : localeOptions) {
            labels.add(getString(option.labelRes));
        }
        ArrayAdapter<String> adapter = new ArrayAdapter<>(
                requireContext(),
                android.R.layout.simple_spinner_dropdown_item,
                labels
        );
        spinner.setAdapter(adapter);
        spinner.setOnItemSelectedListener(new AdapterView.OnItemSelectedListener() {
            @Override
            public void onItemSelected(AdapterView<?> parent, View view, int position, long id) {
                if (suppressLocaleCallback || position < 0 || position >= localeOptions.size()) {
                    return;
                }
                AppLocaleStore.save(requireContext(), localeOptions.get(position).code);
            }

            @Override
            public void onNothingSelected(AdapterView<?> parent) {
                // no-op
            }
        });

        toggleTheme.addOnButtonCheckedListener((group, checkedId, isChecked) -> {
            if (!isChecked) {
                return;
            }
            String theme = checkedId == R.id.buttonThemeDark
                    ? AppPrefs.THEME_DARK
                    : AppPrefs.THEME_LIGHT;
            AppThemeStore.save(requireContext(), theme);
        });
    }

    private void bindRefreshSection(View root) {
        editDeviceInterval = root.findViewById(R.id.editDeviceInterval);
        editScreenshotInterval = root.findViewById(R.id.editScreenshotInterval);
        textRefreshFeedback = root.findViewById(R.id.textRefreshFeedback);
        MaterialButton save = root.findViewById(R.id.buttonSaveRefresh);
        save.setOnClickListener(v -> saveRefreshSettings());
    }

    private void bindServerSection(View root) {
        textServerEndpoint = root.findViewById(R.id.textServerEndpoint);
        MaterialButton changeServer = root.findViewById(R.id.buttonChangeServer);
        changeServer.setOnClickListener(v -> openServerManager());
    }

    private void bindAppearanceValues() {
        Spinner spinner = requireView().findViewById(R.id.spinnerLocale);
        String locale = AppLocaleStore.load(requireContext());
        suppressLocaleCallback = true;
        for (int index = 0; index < localeOptions.size(); index += 1) {
            if (localeOptions.get(index).code.equals(locale)) {
                spinner.setSelection(index);
                break;
            }
        }
        suppressLocaleCallback = false;

        String theme = AppThemeStore.load(requireContext());
        toggleTheme.check(AppPrefs.THEME_DARK.equals(theme)
                ? R.id.buttonThemeDark
                : R.id.buttonThemeLight);
    }

    private void bindRefreshValues() {
        editDeviceInterval.setText(String.valueOf(RefreshIntervalStore.deviceIntervalSeconds(requireContext())));
        editScreenshotInterval.setText(String.valueOf(RefreshIntervalStore.screenshotIntervalSeconds(requireContext())));
    }

    private void saveRefreshSettings() {
        int deviceSeconds = parseInterval(editDeviceInterval, RefreshIntervalStore.DEFAULT_DEVICE_SECONDS);
        int screenshotSeconds = parseInterval(
                editScreenshotInterval,
                RefreshIntervalStore.DEFAULT_SCREENSHOT_SECONDS
        );
        RefreshIntervalStore.save(requireContext(), deviceSeconds, screenshotSeconds);
        textRefreshFeedback.setVisibility(View.VISIBLE);
        textRefreshFeedback.setText(getString(
                R.string.settings_saved_feedback,
                deviceSeconds,
                screenshotSeconds
        ));
    }

    private void loadAccountInfo() {
        if (endpoint == null || !endpoint.isValid()) {
            textPasswordStatus.setText(R.string.settings_session_unset);
            textSessionExpiry.setText(R.string.settings_session_unset);
            return;
        }
        networkExecutor.execute(() -> {
            try {
                AuthApiClient.SessionStatus status = authApiClient.fetchSession(endpoint.host, endpoint.port);
                mainHandler.post(() -> {
                    if (!isAdded()) {
                        return;
                    }
                    int passwordRes = status.passwordConfigured
                            ? R.string.settings_password_updated
                            : R.string.settings_password_default;
                    textPasswordStatus.setText(passwordRes);
                    textSessionExpiry.setText(SettingsDateFormat.formatSessionExpiry(
                            requireContext(),
                            status.sessionExpiresAt
                    ));
                });
            } catch (Exception error) {
                mainHandler.post(() -> {
                    if (!isAdded()) {
                        return;
                    }
                    textSessionExpiry.setText(R.string.settings_session_load_failed);
                });
            }
        });
    }

    private void performLogout() {
        if (endpoint == null || !endpoint.isValid()) {
            openServerManager();
            return;
        }
        networkExecutor.execute(() -> {
            try {
                CloudPhoneApiClient.logout(
                        requireContext().getApplicationContext(),
                        endpoint.host,
                        endpoint.port
                );
            } catch (Exception ignored) {
                // still clear local session
            }
            mainHandler.post(() -> {
                if (!isAdded()) {
                    return;
                }
                SessionKeyStore.clear(requireContext());
                if (endpoint != null) {
                    SavedPasswordStore.clear(requireContext(), endpoint.host, endpoint.port);
                }
                CookieHandler handler = CookieHandler.getDefault();
                if (handler instanceof CookieManager) {
                    ((CookieManager) handler).getCookieStore().removeAll();
                }
                Intent intent = new Intent(requireContext(), MainActivity.class);
                intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TASK);
                startActivity(intent);
                requireActivity().finish();
            });
        });
    }

    private void openServerManager() {
        SessionKeyStore.clear(requireContext());
        if (endpoint != null && endpoint.isValid()) {
            SavedPasswordStore.clear(requireContext(), endpoint.host, endpoint.port);
        }
        CookieHandler handler = CookieHandler.getDefault();
        if (handler instanceof CookieManager) {
            ((CookieManager) handler).getCookieStore().removeAll();
        }
        Intent intent = new Intent(requireContext(), MainActivity.class);
        intent.putExtra(MainActivity.EXTRA_MANAGE_SERVER, true);
        intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TASK);
        startActivity(intent);
        requireActivity().finish();
    }

    private void updateServerLabel() {
        if (textServerEndpoint == null) {
            return;
        }
        if (endpoint == null || !endpoint.isValid()) {
            textServerEndpoint.setText(R.string.settings_server_missing);
            return;
        }
        textServerEndpoint.setText(endpoint.label());
    }

    private int parseInterval(TextInputEditText input, int fallback) {
        String raw = input.getText() == null ? "" : input.getText().toString().trim();
        if (raw.isEmpty()) {
            return fallback;
        }
        try {
            return Integer.parseInt(raw);
        } catch (NumberFormatException error) {
            return fallback;
        }
    }

    private void toast(int resId) {
        Toast.makeText(requireContext(), resId, Toast.LENGTH_SHORT).show();
    }
}
