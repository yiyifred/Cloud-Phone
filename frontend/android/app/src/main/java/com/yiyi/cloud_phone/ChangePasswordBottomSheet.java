package com.yiyi.cloud_phone;

import android.os.Bundle;
import android.text.TextUtils;
import android.view.LayoutInflater;
import android.view.View;
import android.view.ViewGroup;
import android.widget.Toast;

import androidx.annotation.NonNull;
import androidx.annotation.Nullable;
import androidx.fragment.app.Fragment;

import com.google.android.material.bottomsheet.BottomSheetDialogFragment;
import com.google.android.material.button.MaterialButton;
import com.google.android.material.textfield.TextInputEditText;
import com.yiyi.cloud_phone.settings.ServerEndpointStore;

import org.json.JSONObject;

import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

public class ChangePasswordBottomSheet extends BottomSheetDialogFragment {
    public interface Listener {
        void onPasswordChanged();
    }

    private final ExecutorService executor = Executors.newSingleThreadExecutor();
    private ServerEndpointStore.Endpoint endpoint;
    private Listener listener;

    public static void show(Fragment host, ServerEndpointStore.Endpoint endpoint, Listener listener) {
        ChangePasswordBottomSheet sheet = new ChangePasswordBottomSheet();
        sheet.endpoint = endpoint;
        sheet.listener = listener;
        sheet.show(host.getParentFragmentManager(), "change_password");
    }

    @Nullable
    @Override
    public View onCreateView(
            @NonNull LayoutInflater inflater,
            @Nullable ViewGroup container,
            @Nullable Bundle savedInstanceState
    ) {
        return inflater.inflate(R.layout.bottom_sheet_change_password, container, false);
    }

    @Override
    public void onViewCreated(@NonNull View view, @Nullable Bundle savedInstanceState) {
        super.onViewCreated(view, savedInstanceState);
        TextInputEditText currentInput = view.findViewById(R.id.editCurrentPassword);
        TextInputEditText newInput = view.findViewById(R.id.editNewPassword);
        TextInputEditText confirmInput = view.findViewById(R.id.editConfirmPassword);
        MaterialButton submitButton = view.findViewById(R.id.buttonSubmitPassword);
        MaterialButton cancelButton = view.findViewById(R.id.buttonCancelPassword);

        cancelButton.setOnClickListener(v -> dismiss());
        submitButton.setOnClickListener(v -> submitPassword(currentInput, newInput, confirmInput, submitButton));
    }

    private void submitPassword(
            TextInputEditText currentInput,
            TextInputEditText newInput,
            TextInputEditText confirmInput,
            MaterialButton submitButton
    ) {
        String current = textOf(currentInput);
        String next = textOf(newInput);
        String confirm = textOf(confirmInput);
        if (current.isEmpty()) {
            currentInput.setError(getString(R.string.settings_password_current_required));
            return;
        }
        if (next.length() < 6) {
            newInput.setError(getString(R.string.auth_message_password_too_short));
            return;
        }
        if (!next.equals(confirm)) {
            confirmInput.setError(getString(R.string.auth_message_password_mismatch));
            return;
        }
        if (endpoint == null || !endpoint.isValid()) {
            toast(R.string.settings_server_missing);
            return;
        }
        submitButton.setEnabled(false);
        executor.execute(() -> {
            try {
                JSONObject body = CloudPhoneApiClient.changePassword(
                        requireContext().getApplicationContext(),
                        endpoint.host,
                        endpoint.port,
                        current,
                        next
                );
                if (!body.optBoolean("success", false)) {
                    throw new Exception(body.optString("message", "change_password_failed"));
                }
                String encryptionKey = body.optString("encryptionKey", "");
                if (!encryptionKey.isEmpty()) {
                    SessionKeyStore.save(requireContext().getApplicationContext(), encryptionKey);
                }
                SavedPasswordStore.save(
                        requireContext().getApplicationContext(),
                        endpoint.host,
                        endpoint.port,
                        next
                );
                requireActivity().runOnUiThread(() -> {
                    submitButton.setEnabled(true);
                    toast(R.string.settings_password_changed);
                    if (listener != null) {
                        listener.onPasswordChanged();
                    }
                    dismiss();
                });
            } catch (Exception error) {
                requireActivity().runOnUiThread(() -> {
                    submitButton.setEnabled(true);
                    String message = error.getMessage();
                    toast(TextUtils.isEmpty(message)
                            ? getString(R.string.auth_message_setup_failed)
                            : message);
                });
            }
        });
    }

    @Override
    public void onDestroy() {
        executor.shutdownNow();
        super.onDestroy();
    }

    private static String textOf(TextInputEditText input) {
        return input.getText() == null ? "" : input.getText().toString().trim();
    }

    private void toast(int resId) {
        Toast.makeText(requireContext(), resId, Toast.LENGTH_SHORT).show();
    }

    private void toast(String message) {
        Toast.makeText(requireContext(), message, Toast.LENGTH_SHORT).show();
    }
}
