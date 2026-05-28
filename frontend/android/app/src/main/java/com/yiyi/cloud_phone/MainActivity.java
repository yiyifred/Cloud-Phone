package com.yiyi.cloud_phone;

import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.text.TextUtils;
import android.view.View;
import android.widget.Button;
import android.widget.LinearLayout;
import android.widget.TextView;
import android.widget.Toast;

import androidx.activity.EdgeToEdge;
import androidx.appcompat.app.AppCompatActivity;
import androidx.core.graphics.Insets;
import androidx.core.view.ViewCompat;
import androidx.core.view.WindowInsetsCompat;

import com.google.android.material.textfield.TextInputEditText;

import java.io.IOException;
import java.net.HttpURLConnection;
import java.net.URL;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

public class MainActivity extends AppCompatActivity {
    private static final String PREF_NAME = "cloud_phone_settings";
    private static final String KEY_SERVER_HOST = "server_host";
    private static final String KEY_SERVER_PORT = "server_port";
    private static final String DEFAULT_SERVER_HOST = "127.0.0.1";
    private static final int DEFAULT_SERVER_PORT = 9000;

    private LinearLayout loginPanel;
    private LinearLayout setupPanel;
    private LinearLayout serverPanel;
    private Button buttonLoginTab;
    private Button buttonSetupTab;
    private TextView textServerStatus;
    private TextInputEditText editServerHost;
    private TextInputEditText editServerPort;

    private TextInputEditText editCurrentPassword;
    private TextInputEditText editNewPassword;
    private TextInputEditText editConfirmPassword;
    private TextInputEditText editLoginPassword;

    private final ExecutorService networkExecutor = Executors.newSingleThreadExecutor();
    private final Handler mainHandler = new Handler(Looper.getMainLooper());

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        EdgeToEdge.enable(this);
        setContentView(R.layout.activity_main);
        ViewCompat.setOnApplyWindowInsetsListener(findViewById(R.id.main), (v, insets) -> {
            Insets systemBars = insets.getInsets(WindowInsetsCompat.Type.systemBars());
            v.setPadding(systemBars.left, systemBars.top, systemBars.right, systemBars.bottom);
            return insets;
        });

        bindViews();
        bindEvents();
        loadServerConfig();
        forceServerSettingsMode(getString(R.string.server_status_checking));
        checkServerAndContinue();
    }

    private void bindViews() {
        serverPanel = findViewById(R.id.serverPanel);
        loginPanel = findViewById(R.id.loginPanel);
        setupPanel = findViewById(R.id.setupPanel);
        buttonLoginTab = findViewById(R.id.buttonLoginTab);
        buttonSetupTab = findViewById(R.id.buttonSetupTab);
        textServerStatus = findViewById(R.id.textServerStatus);
        editServerHost = findViewById(R.id.editServerHost);
        editServerPort = findViewById(R.id.editServerPort);

        editLoginPassword = findViewById(R.id.editLoginPassword);
        editCurrentPassword = findViewById(R.id.editCurrentPassword);
        editNewPassword = findViewById(R.id.editNewPassword);
        editConfirmPassword = findViewById(R.id.editConfirmPassword);
    }

    private void bindEvents() {
        buttonLoginTab.setOnClickListener(v -> {
            if (serverPanel.getVisibility() == View.VISIBLE) {
                return;
            }
            showLoginPanel();
        });
        buttonSetupTab.setOnClickListener(v -> {
            if (serverPanel.getVisibility() == View.VISIBLE) {
                return;
            }
            showSetupPanel();
        });

        findViewById(R.id.buttonSaveServer).setOnClickListener(v -> {
            if (!saveServerConfigFromInput()) {
                return;
            }
            textServerStatus.setText(getString(R.string.server_saved_and_checking));
            checkServerAndContinue();
        });

        findViewById(R.id.buttonLogin).setOnClickListener(v -> {
            String loginPassword = valueOf(editLoginPassword);
            if (loginPassword.isEmpty()) {
                editLoginPassword.setError(getString(R.string.auth_hint_password));
                return;
            }
            Toast.makeText(this, R.string.auth_message_login_demo, Toast.LENGTH_SHORT).show();
        });

        findViewById(R.id.buttonSavePassword).setOnClickListener(v -> {
            String nextPassword = valueOf(editNewPassword);
            String confirmPassword = valueOf(editConfirmPassword);
            if (nextPassword.length() < 6) {
                editNewPassword.setError(getString(R.string.auth_message_password_too_short));
                return;
            }
            if (!nextPassword.equals(confirmPassword)) {
                editConfirmPassword.setError(getString(R.string.auth_message_password_mismatch));
                return;
            }

            Toast.makeText(this, R.string.auth_message_setup_success, Toast.LENGTH_SHORT).show();
            showLoginPanel();
        });
    }

    private void loadServerConfig() {
        String host = getSharedPreferences(PREF_NAME, MODE_PRIVATE)
                .getString(KEY_SERVER_HOST, DEFAULT_SERVER_HOST);
        int port = getSharedPreferences(PREF_NAME, MODE_PRIVATE)
                .getInt(KEY_SERVER_PORT, DEFAULT_SERVER_PORT);
        editServerHost.setText(host);
        editServerPort.setText(String.valueOf(port));
    }

    private boolean saveServerConfigFromInput() {
        String host = valueOf(editServerHost);
        String portText = valueOf(editServerPort);
        if (host.isEmpty()) {
            editServerHost.setError(getString(R.string.server_host_hint));
            return false;
        }
        int port;
        try {
            port = Integer.parseInt(portText);
        } catch (NumberFormatException error) {
            editServerPort.setError(getString(R.string.server_invalid_port));
            return false;
        }
        if (port < 1 || port > 65535) {
            editServerPort.setError(getString(R.string.server_invalid_port));
            return false;
        }
        getSharedPreferences(PREF_NAME, MODE_PRIVATE)
                .edit()
                .putString(KEY_SERVER_HOST, host)
                .putInt(KEY_SERVER_PORT, port)
                .apply();
        return true;
    }

    private void checkServerAndContinue() {
        String host = valueOf(editServerHost);
        String portText = valueOf(editServerPort);
        if (TextUtils.isEmpty(host) || TextUtils.isEmpty(portText)) {
            forceServerSettingsMode(getString(R.string.server_status_offline));
            return;
        }
        int port;
        try {
            port = Integer.parseInt(portText);
        } catch (NumberFormatException error) {
            forceServerSettingsMode(getString(R.string.server_status_offline));
            return;
        }
        networkExecutor.execute(() -> {
            boolean online = pingServer(host, port);
            mainHandler.post(() -> {
                if (online) {
                    showAuthMode();
                } else {
                    forceServerSettingsMode(getString(R.string.server_status_offline));
                }
            });
        });
    }

    private boolean pingServer(String host, int port) {
        HttpURLConnection connection = null;
        try {
            URL url = new URL("http://" + host + ":" + port + "/api/ping");
            connection = (HttpURLConnection) url.openConnection();
            connection.setRequestMethod("GET");
            connection.setConnectTimeout(1800);
            connection.setReadTimeout(1800);
            int code = connection.getResponseCode();
            return code >= 200 && code < 300;
        } catch (IOException error) {
            return false;
        } finally {
            if (connection != null) {
                connection.disconnect();
            }
        }
    }

    private void forceServerSettingsMode(String statusText) {
        serverPanel.setVisibility(View.VISIBLE);
        loginPanel.setVisibility(View.GONE);
        setupPanel.setVisibility(View.GONE);
        textServerStatus.setText(statusText);
    }

    private void showAuthMode() {
        serverPanel.setVisibility(View.GONE);
        textServerStatus.setText(getString(R.string.server_status_online));
        showLoginPanel();
    }

    private void showLoginPanel() {
        loginPanel.setVisibility(View.VISIBLE);
        setupPanel.setVisibility(View.GONE);
        buttonLoginTab.setBackgroundTintList(getColorStateList(R.color.auth_primary));
        buttonSetupTab.setBackgroundTintList(getColorStateList(R.color.auth_primary_dark));
    }

    private void showSetupPanel() {
        loginPanel.setVisibility(View.GONE);
        setupPanel.setVisibility(View.VISIBLE);
        buttonLoginTab.setBackgroundTintList(getColorStateList(R.color.auth_primary_dark));
        buttonSetupTab.setBackgroundTintList(getColorStateList(R.color.auth_primary));
    }

    private String valueOf(TextInputEditText input) {
        if (input.getText() == null) {
            return "";
        }
        return input.getText().toString().trim();
    }

    @Override
    protected void onDestroy() {
        networkExecutor.shutdownNow();
        super.onDestroy();
    }
}