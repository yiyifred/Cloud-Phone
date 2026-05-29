package com.yiyi.cloud_phone.workspace;

import androidx.annotation.NonNull;
import androidx.fragment.app.Fragment;
import androidx.fragment.app.FragmentActivity;
import androidx.viewpager2.adapter.FragmentStateAdapter;

import java.util.ArrayList;
import java.util.List;

public final class DeviceWorkspacePagerAdapter extends FragmentStateAdapter {
    private final List<TabSpec> tabs = new ArrayList<>();

    public DeviceWorkspacePagerAdapter(@NonNull FragmentActivity activity) {
        super(activity);
    }

    public void setMirrorTabs() {
        tabs.clear();
        tabs.add(new TabSpec("video", MirrorVideoSettingsFragment.class));
        tabs.add(new TabSpec("audio", MirrorAudioSettingsFragment.class));
        tabs.add(new TabSpec("device", MirrorDeviceSettingsFragment.class));
        tabs.add(new TabSpec("screen", MirrorScreenSettingsFragment.class));
        notifyDataSetChanged();
    }

    public void setCameraTabs() {
        tabs.clear();
        tabs.add(new TabSpec("camera", CameraMainSettingsFragment.class));
        tabs.add(new TabSpec("video", CameraVideoSettingsFragment.class));
        tabs.add(new TabSpec("audio", CameraAudioSettingsFragment.class));
        notifyDataSetChanged();
    }

    public String tabTitle(int position) {
        return tabs.get(position).title;
    }

    @NonNull
    @Override
    public Fragment createFragment(int position) {
        try {
            return tabs.get(position).fragmentClass.getDeclaredConstructor().newInstance();
        } catch (Exception error) {
            return new MirrorVideoSettingsFragment();
        }
    }

    @Override
    public int getItemCount() {
        return tabs.size();
    }

    @Override
    public long getItemId(int position) {
        return tabs.get(position).id.hashCode();
    }

    @Override
    public boolean containsItem(long itemId) {
        for (TabSpec tab : tabs) {
            if (tab.id.hashCode() == itemId) {
                return true;
            }
        }
        return false;
    }

    private static final class TabSpec {
        final String id;
        final String title;
        final Class<? extends Fragment> fragmentClass;

        TabSpec(String id, Class<? extends Fragment> fragmentClass) {
            this.id = id;
            this.fragmentClass = fragmentClass;
            this.title = titleFor(id);
        }

        private static String titleFor(String id) {
            switch (id) {
                case "video":
                    return "视频";
                case "audio":
                    return "音频";
                case "device":
                    return "设备";
                case "screen":
                    return "屏幕";
                case "camera":
                    return "摄像头";
                default:
                    return id;
            }
        }
    }
}
