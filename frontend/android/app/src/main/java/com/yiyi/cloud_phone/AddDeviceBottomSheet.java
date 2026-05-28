package com.yiyi.cloud_phone;

import android.content.Context;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.text.TextUtils;
import android.view.LayoutInflater;
import android.view.View;
import android.view.ViewGroup;
import android.widget.ImageButton;
import android.widget.ImageView;
import android.widget.LinearLayout;
import android.widget.TextView;

import androidx.annotation.NonNull;
import androidx.annotation.Nullable;

import com.google.android.material.bottomsheet.BottomSheetDialogFragment;
import com.google.android.material.button.MaterialButton;
import com.google.android.material.textfield.TextInputEditText;

import org.json.JSONObject;

import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Set;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

public class AddDeviceBottomSheet extends BottomSheetDialogFragment {
    private static final String PREF_NAME = "cloud_phone_settings";
    private static final String KEY_SERVER_HOST = "server_host";
    private static final String KEY_SERVER_PORT = "server_port";

    private static final int STEP_PLATFORMS = 0;
    private static final int STEP_USB = 1;
    private static final int STEP_PAIR = 2;
    private static final int STEP_QR = 3;

    private final ExecutorService networkExecutor = Executors.newSingleThreadExecutor();
    private final Handler mainHandler = new Handler(Looper.getMainLooper());

    private int step = STEP_PLATFORMS;
    private Set<String> baselineSerials = new HashSet<>();
    private String qrServiceName = "";
    private String qrPairingCode = "";

    private TextView textSheetTitle;
    private TextView textSheetDesc;
    private View stepPlatforms;
    private View stepUsb;
    private View stepPairCode;
    private View stepQr;
    private LinearLayout usbDeviceList;
    private TextView textUsbSummary;
    private TextView textUsbEmpty;
    private TextInputEditText editPairHost;
    private TextInputEditText editPairPort;
    private TextInputEditText editPairCode;
    private TextView textPairResult;
    private ImageView imageQr;
    private TextView textQrLoading;
    private TextView textQrPairCode;
    private TextView textQrResult;
    private MaterialButton buttonPairSubmit;
    private MaterialButton buttonQrConfirm;

    private final Runnable usbRefreshRunnable = new Runnable() {
        @Override
        public void run() {
            refreshUsbList();
            if (step == STEP_USB && isAdded()) {
                mainHandler.postDelayed(this, 1000L);
            }
        }
    };

    static void show(@NonNull DevicesFragment host) {
        new AddDeviceBottomSheet().show(host.getChildFragmentManager(), "add_device");
    }

    @Nullable
    @Override
    public View onCreateView(
            @NonNull LayoutInflater inflater,
            @Nullable ViewGroup container,
            @Nullable Bundle savedInstanceState
    ) {
        return inflater.inflate(R.layout.bottom_sheet_add_device, container, false);
    }

    @Override
    public void onViewCreated(@NonNull View view, @Nullable Bundle savedInstanceState) {
        super.onViewCreated(view, savedInstanceState);
        bindViews(view);
        showStep(STEP_PLATFORMS);
    }

    @Override
    public void onDestroy() {
        mainHandler.removeCallbacks(usbRefreshRunnable);
        networkExecutor.shutdownNow();
        super.onDestroy();
    }

    private void bindViews(View view) {
        textSheetTitle = view.findViewById(R.id.textSheetTitle);
        textSheetDesc = view.findViewById(R.id.textSheetDesc);
        stepPlatforms = view.findViewById(R.id.stepPlatforms);
        stepUsb = view.findViewById(R.id.stepUsb);
        stepPairCode = view.findViewById(R.id.stepPairCode);
        stepQr = view.findViewById(R.id.stepQr);
        usbDeviceList = view.findViewById(R.id.usbDeviceList);
        textUsbSummary = view.findViewById(R.id.textUsbSummary);
        textUsbEmpty = view.findViewById(R.id.textUsbEmpty);
        editPairHost = view.findViewById(R.id.editPairHost);
        editPairPort = view.findViewById(R.id.editPairPort);
        editPairCode = view.findViewById(R.id.editPairCode);
        textPairResult = view.findViewById(R.id.textPairResult);
        imageQr = view.findViewById(R.id.imageQr);
        textQrLoading = view.findViewById(R.id.textQrLoading);
        textQrPairCode = view.findViewById(R.id.textQrPairCode);
        textQrResult = view.findViewById(R.id.textQrResult);
        buttonPairSubmit = view.findViewById(R.id.buttonPairSubmit);
        buttonQrConfirm = view.findViewById(R.id.buttonQrConfirm);

        ImageButton buttonClose = view.findViewById(R.id.buttonClose);
        buttonClose.setOnClickListener(v -> dismiss());

        view.findViewById(R.id.buttonModeUsb).setOnClickListener(v -> enterUsbStep());
        view.findViewById(R.id.buttonModePairCode).setOnClickListener(v -> showStep(STEP_PAIR));
        view.findViewById(R.id.buttonModeQr).setOnClickListener(v -> enterQrStep());

        view.findViewById(R.id.buttonUsbBack).setOnClickListener(v -> showStep(STEP_PLATFORMS));
        view.findViewById(R.id.buttonUsbDone).setOnClickListener(v -> dismiss());
        view.findViewById(R.id.buttonPairBack).setOnClickListener(v -> showStep(STEP_PLATFORMS));
        view.findViewById(R.id.buttonQrBack).setOnClickListener(v -> showStep(STEP_PLATFORMS));

        buttonPairSubmit.setOnClickListener(v -> submitPairCode());
        view.findViewById(R.id.buttonQrRefresh).setOnClickListener(v -> loadQrSession());
        buttonQrConfirm.setOnClickListener(v -> submitQrPairing());
    }

    private void enterUsbStep() {
        baselineSerials = new HashSet<>();
        DevicesFragment host = getDevicesHost();
        if (host != null) {
            for (DeviceItem device : host.getDisplayedDevices()) {
                baselineSerials.add(device.serial);
            }
        }
        showStep(STEP_USB);
        refreshUsbList();
        mainHandler.removeCallbacks(usbRefreshRunnable);
        mainHandler.post(usbRefreshRunnable);
    }

    private void enterQrStep() {
        showStep(STEP_QR);
        loadQrSession();
    }

    private void showStep(int nextStep) {
        step = nextStep;
        if (nextStep != STEP_USB) {
            mainHandler.removeCallbacks(usbRefreshRunnable);
        }
        stepPlatforms.setVisibility(nextStep == STEP_PLATFORMS ? View.VISIBLE : View.GONE);
        stepUsb.setVisibility(nextStep == STEP_USB ? View.VISIBLE : View.GONE);
        stepPairCode.setVisibility(nextStep == STEP_PAIR ? View.VISIBLE : View.GONE);
        stepQr.setVisibility(nextStep == STEP_QR ? View.VISIBLE : View.GONE);

        if (nextStep == STEP_PLATFORMS) {
            textSheetTitle.setText(R.string.add_device_title);
            textSheetDesc.setText(R.string.add_device_desc);
        } else if (nextStep == STEP_USB) {
            textSheetTitle.setText(R.string.add_device_usb_title);
            textSheetDesc.setText(R.string.add_device_usb_desc);
        } else if (nextStep == STEP_PAIR) {
            textSheetTitle.setText(R.string.add_device_pair_title);
            textSheetDesc.setText(R.string.add_device_pair_desc);
            textPairResult.setVisibility(View.GONE);
        } else {
            textSheetTitle.setText(R.string.add_device_qr_title);
            textSheetDesc.setText(R.string.add_device_pair_desc);
            textQrResult.setVisibility(View.GONE);
        }
    }

    private void refreshUsbList() {
        DevicesFragment host = getDevicesHost();
        if (host == null || usbDeviceList == null) {
            return;
        }
        List<DeviceItem> tracked = new ArrayList<>();
        for (DeviceItem device : host.getDisplayedDevices()) {
            if (!baselineSerials.contains(device.serial)) {
                tracked.add(device);
            }
        }
        int connected = 0;
        int unauthorized = 0;
        for (DeviceItem device : tracked) {
            if (device.connected) {
                connected += 1;
            }
            if ("unauthorized".equals(device.state)) {
                unauthorized += 1;
            }
        }
        textUsbSummary.setText(getString(
                R.string.add_device_usb_summary,
                tracked.size(),
                connected,
                unauthorized
        ));
        usbDeviceList.removeAllViews();
        if (tracked.isEmpty()) {
            textUsbEmpty.setVisibility(View.VISIBLE);
            return;
        }
        textUsbEmpty.setVisibility(View.GONE);
        LayoutInflater inflater = LayoutInflater.from(requireContext());
        for (DeviceItem device : tracked) {
            View row = inflater.inflate(R.layout.item_usb_device, usbDeviceList, false);
            TextView name = row.findViewById(R.id.textUsbName);
            TextView serial = row.findViewById(R.id.textUsbSerial);
            TextView state = row.findViewById(R.id.textUsbState);
            name.setText(device.displayName);
            serial.setText(device.serial);
            if (device.connected) {
                state.setText(R.string.add_device_usb_state_connected);
            } else if ("unauthorized".equals(device.state)) {
                state.setText(R.string.add_device_usb_state_unauthorized);
            } else {
                state.setText(R.string.add_device_usb_state_detecting);
            }
            usbDeviceList.addView(row);
        }
    }

    private void submitPairCode() {
        ServerEndpoint endpoint = readServerEndpoint();
        if (endpoint == null) {
            return;
        }
        String host = valueOf(editPairHost);
        String portText = valueOf(editPairPort);
        String code = valueOf(editPairCode);
        if (host.isEmpty() || portText.isEmpty() || code.isEmpty()) {
            textPairResult.setVisibility(View.VISIBLE);
            textPairResult.setText(R.string.add_device_pair_invalid);
            return;
        }
        int devicePort;
        try {
            devicePort = Integer.parseInt(portText);
        } catch (NumberFormatException error) {
            textPairResult.setVisibility(View.VISIBLE);
            textPairResult.setText(R.string.add_device_pair_invalid);
            return;
        }
        buttonPairSubmit.setEnabled(false);
        Context appContext = requireContext().getApplicationContext();
        networkExecutor.execute(() -> {
            try {
                JSONObject result = CloudPhoneApiClient.pairWithCode(
                        appContext,
                        endpoint.host,
                        endpoint.port,
                        host,
                        devicePort,
                        code
                );
                String message = formatPairMessage(result);
                mainHandler.post(() -> {
                    buttonPairSubmit.setEnabled(true);
                    textPairResult.setVisibility(View.VISIBLE);
                    textPairResult.setText(message);
                    requestDevicesRefresh();
                });
            } catch (Exception error) {
                mainHandler.post(() -> {
                    buttonPairSubmit.setEnabled(true);
                    textPairResult.setVisibility(View.VISIBLE);
                    textPairResult.setText(error.getMessage());
                });
            }
        });
    }

    private void loadQrSession() {
        ServerEndpoint endpoint = readServerEndpoint();
        if (endpoint == null) {
            return;
        }
        textQrLoading.setVisibility(View.VISIBLE);
        imageQr.setVisibility(View.GONE);
        textQrPairCode.setVisibility(View.GONE);
        Context appContext = requireContext().getApplicationContext();
        networkExecutor.execute(() -> {
            try {
                JSONObject result = CloudPhoneApiClient.createQrSession(
                        appContext,
                        endpoint.host,
                        endpoint.port
                );
                String serviceName = result.optString("serviceName", "");
                String pairingCode = result.optString("pairingCode", "");
                String payload = result.optString("qrPayload", "");
                if (serviceName.isEmpty() || pairingCode.isEmpty() || payload.isEmpty()) {
                    throw new IllegalStateException(getString(R.string.add_device_qr_invalid));
                }
                android.graphics.Bitmap bitmap = QrCodeHelper.encode(payload, 720);
                mainHandler.post(() -> {
                    qrServiceName = serviceName;
                    qrPairingCode = pairingCode;
                    textQrLoading.setVisibility(View.GONE);
                    imageQr.setImageBitmap(bitmap);
                    imageQr.setVisibility(View.VISIBLE);
                    textQrPairCode.setVisibility(View.VISIBLE);
                    textQrPairCode.setText(getString(R.string.add_device_qr_code_hint, pairingCode));
                });
            } catch (Exception error) {
                mainHandler.post(() -> {
                    textQrLoading.setVisibility(View.GONE);
                    textQrResult.setVisibility(View.VISIBLE);
                    textQrResult.setText(error.getMessage());
                });
            }
        });
    }

    private void submitQrPairing() {
        if (qrServiceName.isEmpty() || qrPairingCode.isEmpty()) {
            textQrResult.setVisibility(View.VISIBLE);
            textQrResult.setText(R.string.add_device_qr_create_failed);
            return;
        }
        ServerEndpoint endpoint = readServerEndpoint();
        if (endpoint == null) {
            return;
        }
        buttonQrConfirm.setEnabled(false);
        Context appContext = requireContext().getApplicationContext();
        networkExecutor.execute(() -> {
            try {
                JSONObject result = CloudPhoneApiClient.pairWithQr(
                        appContext,
                        endpoint.host,
                        endpoint.port,
                        qrServiceName,
                        qrPairingCode
                );
                String message = formatPairMessage(result);
                mainHandler.post(() -> {
                    buttonQrConfirm.setEnabled(true);
                    textQrResult.setVisibility(View.VISIBLE);
                    textQrResult.setText(message);
                    requestDevicesRefresh();
                });
            } catch (Exception error) {
                mainHandler.post(() -> {
                    buttonQrConfirm.setEnabled(true);
                    textQrResult.setVisibility(View.VISIBLE);
                    textQrResult.setText(error.getMessage());
                });
            }
        });
    }

    private String formatPairMessage(JSONObject result) {
        boolean success = result.optBoolean("success", false);
        JSONObject pair = result.optJSONObject("pair");
        JSONObject connect = result.optJSONObject("connect");
        String pairText = pair != null ? pair.optString("output", "") : "";
        String connectText = connect != null
                ? connect.optString("connectedEndpoint", connect.optString("message", ""))
                : "";
        int pairLabel = success
                ? R.string.add_device_pair_success
                : R.string.add_device_pair_failed;
        int connectLabel = connect != null && connect.optBoolean("success", false)
                ? R.string.add_device_connect_success
                : R.string.add_device_connect_failed;
        return getString(pairLabel) + "：" + pairText + "\n"
                + getString(connectLabel) + "：" + connectText;
    }

    private void requestDevicesRefresh() {
        DevicesFragment host = getDevicesHost();
        if (host != null) {
            host.refreshDevicesNow();
        }
    }

    @Nullable
    private DevicesFragment getDevicesHost() {
        if (getParentFragment() instanceof DevicesFragment) {
            return (DevicesFragment) getParentFragment();
        }
        return null;
    }

    private ServerEndpoint readServerEndpoint() {
        Context context = getContext();
        if (context == null) {
            return null;
        }
        String host = context.getSharedPreferences(PREF_NAME, Context.MODE_PRIVATE)
                .getString(KEY_SERVER_HOST, "");
        int port = context.getSharedPreferences(PREF_NAME, Context.MODE_PRIVATE)
                .getInt(KEY_SERVER_PORT, LanServerDefaults.DEFAULT_PORT);
        if (host.isEmpty()) {
            return null;
        }
        return new ServerEndpoint(host, port);
    }

    private String valueOf(TextInputEditText input) {
        if (input.getText() == null) {
            return "";
        }
        return input.getText().toString().trim();
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
