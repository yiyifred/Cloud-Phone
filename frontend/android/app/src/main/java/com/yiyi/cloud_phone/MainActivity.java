package com.yiyi.cloud_phone;

import android.os.Bundle;
import android.widget.Button;
import android.widget.LinearLayout;
import android.widget.Toast;

import androidx.activity.EdgeToEdge;
import androidx.appcompat.app.AppCompatActivity;
import androidx.core.graphics.Insets;
import androidx.core.view.ViewCompat;
import androidx.core.view.WindowInsetsCompat;

import com.google.android.material.textfield.TextInputEditText;

public class MainActivity extends AppCompatActivity {
    private LinearLayout loginPanel;
    private LinearLayout setupPanel;
    private Button buttonLoginTab;
    private Button buttonSetupTab;

    private TextInputEditText editCurrentPassword;
    private TextInputEditText editNewPassword;
    private TextInputEditText editConfirmPassword;
    private TextInputEditText editLoginPassword;

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
        showLoginPanel();
    }

    private void bindViews() {
        loginPanel = findViewById(R.id.loginPanel);
        setupPanel = findViewById(R.id.setupPanel);
        buttonLoginTab = findViewById(R.id.buttonLoginTab);
        buttonSetupTab = findViewById(R.id.buttonSetupTab);

        editLoginPassword = findViewById(R.id.editLoginPassword);
        editCurrentPassword = findViewById(R.id.editCurrentPassword);
        editNewPassword = findViewById(R.id.editNewPassword);
        editConfirmPassword = findViewById(R.id.editConfirmPassword);
    }

    private void bindEvents() {
        buttonLoginTab.setOnClickListener(v -> showLoginPanel());
        buttonSetupTab.setOnClickListener(v -> showSetupPanel());

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

    private void showLoginPanel() {
        loginPanel.setVisibility(LinearLayout.VISIBLE);
        setupPanel.setVisibility(LinearLayout.GONE);
        buttonLoginTab.setBackgroundTintList(getColorStateList(R.color.auth_primary));
        buttonSetupTab.setBackgroundTintList(getColorStateList(R.color.auth_primary_dark));
    }

    private void showSetupPanel() {
        loginPanel.setVisibility(LinearLayout.GONE);
        setupPanel.setVisibility(LinearLayout.VISIBLE);
        buttonLoginTab.setBackgroundTintList(getColorStateList(R.color.auth_primary_dark));
        buttonSetupTab.setBackgroundTintList(getColorStateList(R.color.auth_primary));
    }

    private String valueOf(TextInputEditText input) {
        if (input.getText() == null) {
            return "";
        }
        return input.getText().toString().trim();
    }
}