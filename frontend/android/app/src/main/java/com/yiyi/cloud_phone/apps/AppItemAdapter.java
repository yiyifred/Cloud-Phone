package com.yiyi.cloud_phone.apps;

import android.content.Context;
import android.graphics.Bitmap;
import android.graphics.BitmapFactory;
import android.graphics.Color;
import android.graphics.drawable.GradientDrawable;
import android.view.LayoutInflater;
import android.view.View;
import android.view.ViewGroup;
import android.widget.ImageView;
import android.widget.TextView;

import androidx.annotation.NonNull;
import androidx.recyclerview.widget.RecyclerView;

import com.yiyi.cloud_phone.R;

import java.util.ArrayList;
import java.util.List;

class AppItemAdapter extends RecyclerView.Adapter<AppItemAdapter.ViewHolder> {
    interface OnAppClickListener {
        void onAppClick(AppItem app);
    }

    private final List<AppItem> allApps = new ArrayList<>();
    private final List<AppItem> filteredApps = new ArrayList<>();
    private String query = "";
    private OnAppClickListener clickListener;
    private boolean showIcons = true;

    void setShowIcons(boolean showIcons) {
        this.showIcons = showIcons;
        notifyDataSetChanged();
    }

    void setApps(List<AppItem> apps) {
        allApps.clear();
        if (apps != null) allApps.addAll(apps);
        applyFilter();
    }

    void setFilter(String query) {
        this.query = query == null ? "" : query.toLowerCase();
        applyFilter();
    }

    void setOnAppClickListener(OnAppClickListener listener) {
        this.clickListener = listener;
    }

    private void applyFilter() {
        filteredApps.clear();
        if (query.isEmpty()) {
            filteredApps.addAll(allApps);
        } else {
            for (AppItem app : allApps) {
                if (app.label.toLowerCase().contains(query) || app.packageName.toLowerCase().contains(query)) {
                    filteredApps.add(app);
                }
            }
        }
        notifyDataSetChanged();
    }

    List<AppItem> getFilteredApps() {
        return filteredApps;
    }

    @NonNull
    @Override
    public ViewHolder onCreateViewHolder(@NonNull ViewGroup parent, int viewType) {
        View view = LayoutInflater.from(parent.getContext()).inflate(R.layout.item_app, parent, false);
        return new ViewHolder(view);
    }

    @Override
    public void onBindViewHolder(@NonNull ViewHolder holder, int position) {
        holder.bind(filteredApps.get(position));
    }

    @Override
    public int getItemCount() {
        return filteredApps.size();
    }

    class ViewHolder extends RecyclerView.ViewHolder {
        final TextView iconText;
        final ImageView iconImage;
        final TextView labelView;
        final TextView packageView;
        final TextView badgeSystem;
        final TextView badgeFrozen;

        ViewHolder(@NonNull View itemView) {
            super(itemView);
            iconText = itemView.findViewById(R.id.appIconText);
            iconImage = itemView.findViewById(R.id.appIconImage);
            labelView = itemView.findViewById(R.id.appLabel);
            packageView = itemView.findViewById(R.id.appPackage);
            badgeSystem = itemView.findViewById(R.id.badgeSystem);
            badgeFrozen = itemView.findViewById(R.id.badgeFrozen);
        }

        void bind(AppItem app) {
            boolean renderedIcon = false;
            if (showIcons && app.iconDataUrl != null && !app.iconDataUrl.isEmpty()) {
                Bitmap bitmap = decodeDataUrl(app.iconDataUrl);
                if (bitmap != null) {
                    iconImage.setImageBitmap(bitmap);
                    iconImage.setVisibility(View.VISIBLE);
                    iconText.setVisibility(View.GONE);
                    renderedIcon = true;
                }
            }

            if (!renderedIcon) {
                iconImage.setVisibility(View.GONE);
                iconText.setVisibility(View.VISIBLE);
                iconText.setText(app.getInitials());
                setIconColor(app.packageName);
            }
            labelView.setText(app.label);
            packageView.setText(app.packageName);
            badgeSystem.setVisibility(app.system ? View.VISIBLE : View.GONE);
            badgeFrozen.setVisibility(app.frozen ? View.VISIBLE : View.GONE);
            itemView.setOnClickListener(v -> {
                if (clickListener != null) clickListener.onAppClick(app);
            });
        }

        private void setIconColor(String seed) {
            int[] colors = {
                    0xFF5B8DEF, 0xFF56C595, 0xFFE5703A, 0xFF9C5FCE,
                    0xFFE84393, 0xFF00BCD4, 0xFF8BC34A, 0xFFFF7043
            };
            int color = colors[Math.abs(seed.hashCode()) % colors.length];
            GradientDrawable bg = new GradientDrawable();
            bg.setShape(GradientDrawable.OVAL);
            bg.setColor(color);
            iconText.setBackground(bg);
            iconText.setTextColor(Color.WHITE);
        }

        private Bitmap decodeDataUrl(String dataUrl) {
            try {
                int comma = dataUrl.indexOf(',');
                if (comma < 0) return null;
                byte[] bytes = android.util.Base64.decode(dataUrl.substring(comma + 1), android.util.Base64.DEFAULT);
                return BitmapFactory.decodeByteArray(bytes, 0, bytes.length);
            } catch (Exception ignored) {
                return null;
            }
        }
    }
}
