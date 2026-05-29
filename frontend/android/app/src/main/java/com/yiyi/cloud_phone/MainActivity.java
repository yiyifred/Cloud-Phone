package com.yiyi.cloud_phone;

import android.content.Intent;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.text.TextUtils;
import android.view.View;
import android.widget.LinearLayout;
import android.widget.ProgressBar;
import android.widget.TextView;
import android.widget.Toast;

import androidx.activity.EdgeToEdge;
import androidx.appcompat.app.AppCompatActivity;
import androidx.core.graphics.Insets;
import androidx.core.view.ViewCompat;
import androidx.core.view.WindowInsetsCompat;

import com.google.android.material.button.MaterialButton;
import com.google.android.material.textfield.TextInputEditText;

import java.io.IOException;
import java.net.CookieHandler;
import java.net.CookieManager;
import java.net.HttpURLConnection;
import java.net.URL;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

public class MainActivity extends AppCompatActivity {
    public static final String EXTRA_MANAGE_SERVER = "manage_server";

    private static final String PREF_NAME = "cloud_phone_settings";
    private static final String KEY_SERVER_HOST = "server_host";
    private static final String KEY_SERVER_PORT = "server_port";

    private LinearLayout serverPanel;
    private LinearLayout authContainer;
    private LinearLayout loginPanel;
    private LinearLayout setupPanel;
    private TextView textServerStatus;
    private TextView textAuthEyebrow;
    private TextView textAuthTitle;
    private TextView textAuthIntro;
    private ProgressBar progressAuth;
    private TextInputEditText editServerHost;
    private TextInputEditText editServerPort;
    private TextInputEditText editLoginPassword;
    private TextInputEditText editNewPassword;
    private TextInputEditText editConfirmPassword;
    private MaterialButton buttonLogin;
    private MaterialButton buttonSavePassword;

    private final AuthApiClient authApiClient = new AuthApiClient();
    private final ExecutorService networkExecutor = Executors.newSingleThreadExecutor();
    private final Handler mainHandler = new Handler(Looper.getMainLooper());

    private String pendingCurrentPassword = AuthApiClient.DEFAULT_PASSWORD;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        if (CookieHandler.getDefault() == null) {
            CookieHandler.setDefault(new CookieManager());
        }

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
        if (getIntent().getBooleanExtra(EXTRA_MANAGE_SERVER, false)) {
            SessionKeyStore.clear(this);
            forceServerSettingsMode(getString(R.string.settings_change_server_intro));
            return;
        }
        forceServerSettingsMode(getString(R.string.server_status_checking));
        checkServerAndContinue();
    }

    private void bindViews() {
        serverPanel = findViewById(R.id.serverPanel);
        authContainer = findViewById(R.id.authContainer);
        loginPanel = findViewById(R.id.loginPanel);
        setupPanel = findViewById(R.id.setupPanel);
        textServerStatus = findViewById(R.id.textServerStatus);
        textAuthEyebrow = findViewById(R.id.textAuthEyebrow);
        textAuthTitle = findViewById(R.id.textAuthTitle);
        textAuthIntro = findViewById(R.id.textAuthIntro);
        progressAuth = findViewById(R.id.progressAuth);
        editServerHost = findViewById(R.id.editServerHost);
        editServerPort = findViewById(R.id.editServerPort);
        editLoginPassword = findViewById(R.id.editLoginPassword);
        editNewPassword = findViewById(R.id.editNewPassword);
        editConfirmPassword = findViewById(R.id.editConfirmPassword);
        buttonLogin = findViewById(R.id.buttonLogin);
        buttonSavePassword = findViewById(R.id.buttonSavePassword);
    }

    private void bindEvents() {
        findViewById(R.id.buttonSaveServer).setOnClickListener(v -> {
            if (!saveServerConfigFromInput()) {
                return;
            }
            textServerStatus.setText(getString(R.string.server_saved_and_checking));
            checkServerAndContinue();
        });

        buttonLogin.setOnClickListener(v -> submitLogin());
        buttonSavePassword.setOnClickListener(v -> submitPasswordSetup());
    }

    private void loadServerConfig() {
        String host = getSharedPreferences(PREF_NAME, MODE_PRIVATE)
                .getString(KEY_SERVER_HOST, LanServerDefaults.defaultHost());
        int port = getSharedPreferences(PREF_NAME, MODE_PRIVATE)
                .getInt(KEY_SERVER_PORT, LanServerDefaults.DEFAULT_PORT);
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
        android.content.SharedPreferences prefs = getSharedPreferences(PREF_NAME, MODE_PRIVATE);
        String previousHost = prefs.getString(KEY_SERVER_HOST, "");
        int previousPort = prefs.getInt(KEY_SERVER_PORT, LanServerDefaults.DEFAULT_PORT);
        prefs.edit()
                .putString(KEY_SERVER_HOST, host)
                .putInt(KEY_SERVER_PORT, port)
                .apply();
        if (!previousHost.isEmpty()
                && (!previousHost.equals(host) || previousPort != port)) {
            SavedPasswordStore.clear(this, previousHost, previousPort);
        }
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
                    beginAuthFlow(host, port);
                } else {
                    forceServerSettingsMode(getString(R.string.server_status_offline));
                }
            });
        });
    }

    private void beginAuthFlow(String host, int port) {
        serverPanel.setVisibility(View.GONE);
        authContainer.setVisibility(View.VISIBLE);
        textServerStatus.setText(getString(R.string.server_status_online));
        hideAuthPanels();
        setAuthLoading(true);

        networkExecutor.execute(() -> {
            try {
                AuthApiClient.SessionStatus status = authApiClient.fetchSession(host, port);
                if (status.authenticated) {
                    mainHandler.post(() -> {
                        setAuthLoading(false);
                        openConsole();
                    });
                    return;
                }
                if (!status.passwordConfigured) {
                    mainHandler.post(() -> {
                        setAuthLoading(false);
                        showFirstTimeSetup();
                    });
                    return;
                }
                String savedPassword = SavedPasswordStore.load(MainActivity.this, host, port);
                if (!savedPassword.isEmpty()) {
                    mainHandler.post(() ->
                            textAuthIntro.setText(getString(R.string.auth_auto_signing_in)));
                    try {
                        AuthApiClient.AuthResult loginResult = authApiClient.login(
                                host,
                                port,
                                savedPassword
                        );
                        mainHandler.post(() -> {
                            setAuthLoading(false);
                            handleLoginResult(loginResult, savedPassword, host, port, true);
                        });
                    } catch (Exception error) {
                        mainHandler.post(() -> {
                            SavedPasswordStore.clear(MainActivity.this, host, port);
                            setAuthLoading(false);
                            toast(getString(R.string.auth_auto_login_failed));
                            showLoginForm();
                        });
                    }
                    return;
                }
                mainHandler.post(() -> {
                    setAuthLoading(false);
                    showLoginForm();
                });
            } catch (Exception error) {
                mainHandler.post(() -> {
                    setAuthLoading(false);
                    showLoginForm();
                    toast(getString(R.string.auth_message_session_failed));
                });
            }
        });
    }

    private void submitLogin() {
        String password = valueOf(editLoginPassword);
        if (password.isEmpty()) {
            editLoginPassword.setError(getString(R.string.auth_enter_password));
            return;
        }

        ServerEndpoint endpoint = readServerEndpoint();
        if (endpoint == null) {
            return;
        }

        setAuthLoading(true);
        buttonLogin.setEnabled(false);
        networkExecutor.execute(() -> {
            try {
                AuthApiClient.AuthResult result = authApiClient.login(
                        endpoint.host,
                        endpoint.port,
                        password
                );
                mainHandler.post(() -> {
                    setAuthLoading(false);
                    buttonLogin.setEnabled(true);
                    handleLoginResult(result, password, endpoint.host, endpoint.port, false);
                });
            } catch (Exception error) {
                mainHandler.post(() -> {
                    setAuthLoading(false);
                    buttonLogin.setEnabled(true);
                    toast(getString(R.string.auth_message_login_failed));
                });
            }
        });
    }

    private void submitPasswordSetup() {
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

        ServerEndpoint endpoint = readServerEndpoint();
        if (endpoint == null) {
            return;
        }

        setAuthLoading(true);
        buttonSavePassword.setEnabled(false);
        String currentPassword = pendingCurrentPassword;
        networkExecutor.execute(() -> {
            try {
                AuthApiClient.AuthResult result = authApiClient.changePassword(
                        endpoint.host,
                        endpoint.port,
                        currentPassword,
                        nextPassword
                );
                mainHandler.post(() -> {
                    setAuthLoading(false);
                    buttonSavePassword.setEnabled(true);
                    if (!result.success || !result.authenticated) {
                        toast(TextUtils.isEmpty(result.message)
                                ? getString(R.string.auth_message_setup_failed)
                                : result.message);
                        return;
                    }
                    editNewPassword.setText("");
                    editConfirmPassword.setText("");
                    editLoginPassword.setText("");
                    SavedPasswordStore.save(
                            MainActivity.this,
                            endpoint.host,
                            endpoint.port,
                            nextPassword
                    );
                    SessionKeyStore.save(MainActivity.this, result.encryptionKey);
                    toast(getString(R.string.auth_message_setup_success));
                    openConsole();
                });
            } catch (Exception error) {
                mainHandler.post(() -> {
                    setAuthLoading(false);
                    buttonSavePassword.setEnabled(true);
                    toast(getString(R.string.auth_message_setup_failed));
                });
            }
        });
    }

    private void handleLoginResult(
            AuthApiClient.AuthResult result,
            String password,
            String host,
            int port,
            boolean autoAttempt
    ) {
        if (!result.success) {
            if (autoAttempt) {
                SavedPasswordStore.clear(this, host, port);
                toast(getString(R.string.auth_auto_login_failed));
                showLoginForm();
                return;
            }
            toast(TextUtils.isEmpty(result.message)
                    ? getString(R.string.auth_message_login_failed)
                    : result.message);
            return;
        }
        if (result.requiresPasswordChange) {
            pendingCurrentPassword = password;
            SavedPasswordStore.clear(this, host, port);
            showForcedPasswordSetup();
            return;
        }
        if (result.authenticated) {
            SavedPasswordStore.save(this, host, port, password);
            SessionKeyStore.save(this, result.encryptionKey);
            editLoginPassword.setText("");
            openConsole();
            return;
        }
        if (autoAttempt) {
            SavedPasswordStore.clear(this, host, port);
            toast(getString(R.string.auth_auto_login_failed));
            showLoginForm();
            return;
        }
        toast(getString(R.string.auth_message_login_failed));
    }

    private void showFirstTimeSetup() {
        pendingCurrentPassword = AuthApiClient.DEFAULT_PASSWORD;
        textAuthEyebrow.setText(R.string.auth_eyebrow_setup);
        textAuthTitle.setText(R.string.auth_setup_title);
        textAuthIntro.setText(R.string.auth_setup_intro);
        loginPanel.setVisibility(View.GONE);
        setupPanel.setVisibility(View.VISIBLE);
    }

    private void showForcedPasswordSetup() {
        textAuthEyebrow.setText(R.string.auth_eyebrow_setup);
        textAuthTitle.setText(R.string.auth_setup_title);
        textAuthIntro.setText(R.string.auth_setup_intro);
        loginPanel.setVisibility(View.GONE);
        setupPanel.setVisibility(View.VISIBLE);
    }

    private void showLoginForm() {
        textAuthEyebrow.setText(R.string.auth_eyebrow_login);
        textAuthTitle.setText(R.string.auth_login_title);
        textAuthIntro.setText(R.string.auth_login_intro);
        setupPanel.setVisibility(View.GONE);
        loginPanel.setVisibility(View.VISIBLE);
    }

    private void hideAuthPanels() {
        loginPanel.setVisibility(View.GONE);
        setupPanel.setVisibility(View.GONE);
    }

    private void openConsole() {
        startActivity(new Intent(this, ConsoleActivity.class));
        finish();
    }

    private void setAuthLoading(boolean loading) {
        progressAuth.setVisibility(loading ? View.VISIBLE : View.GONE);
        buttonLogin.setEnabled(!loading);
        buttonSavePassword.setEnabled(!loading);
    }

    private void forceServerSettingsMode(String statusText) {
        serverPanel.setVisibility(View.VISIBLE);
        authContainer.setVisibility(View.GONE);
        hideAuthPanels();
        setAuthLoading(false);
        textServerStatus.setText(statusText);
    }

    private ServerEndpoint readServerEndpoint() {
        String host = valueOf(editServerHost);
        String portText = valueOf(editServerPort);
        if (host.isEmpty() || portText.isEmpty()) {
            forceServerSettingsMode(getString(R.string.server_status_offline));
            return null;
        }
        try {
            return new ServerEndpoint(host, Integer.parseInt(portText));
        } catch (NumberFormatException error) {
            forceServerSettingsMode(getString(R.string.server_status_offline));
            return null;
        }
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

    private String valueOf(TextInputEditText input) {
        if (input.getText() == null) {
            return "";
        }
        return input.getText().toString().trim();
    }

    private void toast(String message) {
        Toast.makeText(this, message, Toast.LENGTH_SHORT).show();
    }

    @Override
    protected void onDestroy() {
        networkExecutor.shutdownNow();
        super.onDestroy();
    }

    private static final class ServerEndpoint {
        final String host;
        final int port;

        ServerEndpoint(String host, int port) {
            this.host = host;
            this.port = port;
        }
    }
}
