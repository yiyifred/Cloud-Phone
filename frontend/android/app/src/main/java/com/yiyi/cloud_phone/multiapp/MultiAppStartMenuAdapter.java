package com.yiyi.cloud_phone.multiapp;

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

final class MultiAppStartMenuAdapter extends RecyclerView.Adapter<MultiAppStartMenuAdapter.Holder> {
    interface OnAppClickListener {
        void onAppClick(MultiAppStartMenuDialog.AppItem item);
    }

    private final List<MultiAppStartMenuDialog.AppItem> items = new ArrayList<>();
    private OnAppClickListener listener;

    void setItems(List<MultiAppStartMenuDialog.AppItem> next) {
        items.clear();
        if (next != null) {
            items.addAll(next);
        }
        notifyDataSetChanged();
    }

    void setOnAppClickListener(OnAppClickListener listener) {
        this.listener = listener;
    }

    @NonNull
    @Override
    public Holder onCreateViewHolder(@NonNull ViewGroup parent, int viewType) {
        View view = LayoutInflater.from(parent.getContext())
                .inflate(R.layout.item_multi_app_start_app, parent, false);
        return new Holder(view);
    }

    @Override
    public void onBindViewHolder(@NonNull Holder holder, int position) {
        holder.bind(items.get(position));
    }

    @Override
    public int getItemCount() {
        return items.size();
    }

    class Holder extends RecyclerView.ViewHolder {
        final ImageView icon;
        final TextView initial;
        final TextView name;

        Holder(@NonNull View itemView) {
            super(itemView);
            icon = itemView.findViewById(R.id.imageAppIcon);
            initial = itemView.findViewById(R.id.textAppInitial);
            name = itemView.findViewById(R.id.textAppName);
        }

        void bind(MultiAppStartMenuDialog.AppItem app) {
            String label = app.label == null || app.label.isEmpty() ? app.packageName : app.label;
            name.setText(label);
            MultiAppIconUtil.bindIcon(icon, initial, label, app.iconDataUrl);
            itemView.setOnClickListener(v -> {
                if (listener != null) {
                    listener.onAppClick(app);
                }
            });
        }
    }
}
