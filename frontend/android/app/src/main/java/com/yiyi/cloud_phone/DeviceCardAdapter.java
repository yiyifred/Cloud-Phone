package com.yiyi.cloud_phone;

import android.content.Context;
import android.graphics.BitmapFactory;
import android.view.LayoutInflater;
import android.view.View;
import android.view.ViewGroup;
import android.widget.ImageView;
import android.widget.LinearLayout;
import android.widget.TextView;

import androidx.annotation.NonNull;
import androidx.recyclerview.widget.RecyclerView;

import java.util.ArrayList;
import java.util.List;
final class DeviceCardAdapter extends RecyclerView.Adapter<DeviceCardAdapter.Holder> {
    interface DeviceClickListener {
        void onDeviceClick(DeviceItem device);
    }

    interface ScreenshotRequester {
        void requestScreenshot(String serial, long tick, ScreenshotCallback callback);
    }

    interface ScreenshotCallback {
        void onSuccess(String serial, byte[] pngBytes);

        void onFailure(String serial);
    }

    private final Context context;
    private final ScreenshotRequester screenshotRequester;
    private final DeviceClickListener deviceClickListener;
    private final List<DeviceItem> devices = new ArrayList<>();
    private long screenshotTick;

    DeviceCardAdapter(
            Context context,
            ScreenshotRequester screenshotRequester,
            DeviceClickListener deviceClickListener
    ) {
        this.context = context.getApplicationContext();
        this.screenshotRequester = screenshotRequester;
        this.deviceClickListener = deviceClickListener;
    }

    void submitList(List<DeviceItem> nextDevices) {
        devices.clear();
        devices.addAll(nextDevices);
        notifyDataSetChanged();
    }

    void bumpScreenshotTick(long tick) {
        screenshotTick = tick;
        notifyDataSetChanged();
    }

    @NonNull
    @Override
    public Holder onCreateViewHolder(@NonNull ViewGroup parent, int viewType) {
        View view = LayoutInflater.from(parent.getContext())
                .inflate(R.layout.item_device_card, parent, false);
        return new Holder(view);
    }

    @Override
    public void onBindViewHolder(@NonNull Holder holder, int position) {
        DeviceItem device = devices.get(position);
        holder.bind(device, screenshotTick);
    }

    @Override
    public int getItemCount() {
        return devices.size();
    }

    final class Holder extends RecyclerView.ViewHolder {
        private final ImageView imageScreenshot;
        private final ImageView imagePlaceholderIcon;
        private final LinearLayout placeholderContainer;
        private final TextView textPlaceholder;
        private final TextView textStatusBadge;
        private final TextView textDisplayName;
        private final TextView textSubtitle;
        private final TextView textIp;
        private final TextView textProduct;
        private final TextView textSystem;
        private final TextView textSerial;
        private final TextView textAdbState;
        private String boundSerial = "";
        private long boundTick = -1L;

        Holder(@NonNull View itemView) {
            super(itemView);
            imageScreenshot = itemView.findViewById(R.id.imageScreenshot);
            imagePlaceholderIcon = itemView.findViewById(R.id.imagePlaceholderIcon);
            imagePlaceholderIcon.setImageDrawable(AppIcons.devicePlaceholder(context));
            placeholderContainer = itemView.findViewById(R.id.placeholderContainer);
            textPlaceholder = itemView.findViewById(R.id.textPlaceholder);
            textStatusBadge = itemView.findViewById(R.id.textStatusBadge);
            textDisplayName = itemView.findViewById(R.id.textDisplayName);
            textSubtitle = itemView.findViewById(R.id.textSubtitle);
            textIp = itemView.findViewById(R.id.textIp);
            textProduct = itemView.findViewById(R.id.textProduct);
            textSystem = itemView.findViewById(R.id.textSystem);
            textSerial = itemView.findViewById(R.id.textSerial);
            textAdbState = itemView.findViewById(R.id.textAdbState);
            itemView.setOnClickListener(v -> {
                int position = getBindingAdapterPosition();
                if (position == RecyclerView.NO_POSITION || deviceClickListener == null) {
                    return;
                }
                deviceClickListener.onDeviceClick(devices.get(position));
            });
        }

        void bind(DeviceItem device, long tick) {
            boundSerial = device.serial;
            itemView.setAlpha(device.connected ? 1f : 0.88f);

            textDisplayName.setText(device.displayName);
            String subtitle = DeviceFormatter.manufacturerLine(device);
            textSubtitle.setText(subtitle);
            textSubtitle.setVisibility(subtitle.isEmpty() ? View.GONE : View.VISIBLE);

            textIp.setText(device.ipAddress.isEmpty() ? "—" : device.ipAddress);
            textProduct.setText(DeviceFormatter.productLine(device));
            String androidLine = DeviceFormatter.androidLine(device);
            textSystem.setText(androidLine.isEmpty() ? "—" : androidLine);
            textSerial.setText(device.serial);
            textAdbState.setText(device.state);

            String stateLabel = DeviceFormatter.stateLabel(context, device.state);
            textStatusBadge.setText(stateLabel);
            if (device.connected) {
                textStatusBadge.setBackgroundResource(R.drawable.bg_status_online);
                textStatusBadge.setTextColor(context.getColor(R.color.auth_primary));
            } else {
                textStatusBadge.setBackgroundResource(R.drawable.bg_status_offline);
                textStatusBadge.setTextColor(context.getColor(R.color.auth_text_secondary));
            }

            if (!device.connected) {
                boundTick = -1L;
                showPlaceholder(context.getString(R.string.devices_device_offline));
                return;
            }

            if (tick == boundTick && imageScreenshot.getVisibility() == View.VISIBLE) {
                return;
            }

            boundTick = tick;
            showPlaceholder(context.getString(R.string.devices_waiting_screenshot));
            screenshotRequester.requestScreenshot(
                    device.serial,
                    tick,
                    new ScreenshotCallback() {
                        @Override
                        public void onSuccess(String serial, byte[] pngBytes) {
                            if (!serial.equals(boundSerial)) {
                                return;
                            }
                            itemView.post(() -> {
                                if (!serial.equals(boundSerial)) {
                                    return;
                                }
                                try {
                                    imageScreenshot.setImageBitmap(
                                            BitmapFactory.decodeByteArray(pngBytes, 0, pngBytes.length)
                                    );
                                    imageScreenshot.setVisibility(View.VISIBLE);
                                    placeholderContainer.setVisibility(View.GONE);
                                } catch (Exception error) {
                                    showPlaceholder(context.getString(R.string.devices_screenshot_failed));
                                }
                            });
                        }

                        @Override
                        public void onFailure(String serial) {
                            if (!serial.equals(boundSerial)) {
                                return;
                            }
                            itemView.post(() -> showPlaceholder(
                                    context.getString(R.string.devices_screenshot_failed)
                            ));
                        }
                    }
            );
        }

        private void showPlaceholder(String message) {
            imageScreenshot.setVisibility(View.GONE);
            placeholderContainer.setVisibility(View.VISIBLE);
            textPlaceholder.setText(message);
        }
    }
}
