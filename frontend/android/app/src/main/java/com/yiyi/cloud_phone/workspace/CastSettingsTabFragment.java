package com.yiyi.cloud_phone.workspace;

import android.os.Bundle;
import android.view.LayoutInflater;
import android.view.View;
import android.view.ViewGroup;
import android.widget.LinearLayout;

import androidx.annotation.NonNull;
import androidx.annotation.Nullable;
import androidx.fragment.app.Fragment;

import com.yiyi.cloud_phone.R;

public abstract class CastSettingsTabFragment extends Fragment {
    protected DeviceWorkspaceHost host;
    protected LinearLayout formContainer;

    @Override
    public void onAttach(@NonNull android.content.Context context) {
        super.onAttach(context);
        if (!(context instanceof DeviceWorkspaceHost)) {
            throw new IllegalStateException("Host must implement DeviceWorkspaceHost");
        }
        host = (DeviceWorkspaceHost) context;
    }

    @Nullable
    @Override
    public View onCreateView(
            @NonNull LayoutInflater inflater,
            @Nullable ViewGroup container,
            @Nullable Bundle savedInstanceState
    ) {
        return inflater.inflate(R.layout.fragment_cast_settings_tab, container, false);
    }

    @Override
    public void onViewCreated(@NonNull View view, @Nullable Bundle savedInstanceState) {
        super.onViewCreated(view, savedInstanceState);
        formContainer = view.findViewById(R.id.formContainer);
        buildForm(new CastFormBuilder(requireContext(), formContainer, host.isSettingsLocked()));
    }

    protected abstract void buildForm(CastFormBuilder form);

    @Override
    public void onPause() {
        host.persistSettings();
        super.onPause();
    }
}
