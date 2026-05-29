package com.yiyi.cloud_phone.cast;

import android.view.View;
import android.widget.HorizontalScrollView;
import android.widget.ImageButton;

import com.yiyi.cloud_phone.R;

final class CastToolbarController {
    private final HorizontalScrollView toolbarScroll;
    private final ImageButton toggleButton;
    private boolean collapsed;

    CastToolbarController(HorizontalScrollView toolbarScroll, ImageButton toggleButton) {
        this.toolbarScroll = toolbarScroll;
        this.toggleButton = toggleButton;
        toggleButton.setOnClickListener(v -> setCollapsed(!collapsed));
        setCollapsed(false);
    }

    void setCollapsed(boolean collapsed) {
        this.collapsed = collapsed;
        toolbarScroll.setVisibility(collapsed ? View.GONE : View.VISIBLE);
        updateToggleIcon();
    }

    boolean isCollapsed() {
        return collapsed;
    }

    private void updateToggleIcon() {
        if (collapsed) {
            toggleButton.setImageDrawable(CastUiIcons.toolbarExpand(toggleButton.getContext()));
            toggleButton.setContentDescription(
                    toggleButton.getContext().getString(R.string.cast_toolbar_expand)
            );
        } else {
            toggleButton.setImageDrawable(CastUiIcons.toolbarCollapse(toggleButton.getContext()));
            toggleButton.setContentDescription(
                    toggleButton.getContext().getString(R.string.cast_toolbar_collapse)
            );
        }
    }
}
