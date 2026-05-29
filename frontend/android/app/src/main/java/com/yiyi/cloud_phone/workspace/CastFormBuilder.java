package com.yiyi.cloud_phone.workspace;

import android.content.Context;
import android.text.InputType;
import android.view.View;
import android.widget.AdapterView;
import android.widget.ArrayAdapter;
import android.widget.LinearLayout;
import android.widget.Spinner;
import android.widget.TextView;

import androidx.annotation.Nullable;

import com.google.android.material.materialswitch.MaterialSwitch;
import com.google.android.material.textfield.TextInputEditText;
import com.google.android.material.textfield.TextInputLayout;

import java.util.ArrayList;
import java.util.List;

final class CastFormBuilder {
    private final Context context;
    private final LinearLayout container;
    private final boolean locked;

    CastFormBuilder(Context context, LinearLayout container, boolean locked) {
        this.context = context;
        this.container = container;
        this.locked = locked;
    }

    void addBanner(String text) {
        TextView view = new TextView(context);
        view.setText(text);
        view.setTextColor(context.getColor(com.yiyi.cloud_phone.R.color.auth_text_secondary));
        view.setTextSize(12f);
        int pad = dp(12);
        view.setPadding(pad, pad, pad, dp(4));
        container.addView(view);
    }

    MaterialSwitch addSwitch(String label, String help, boolean checked, BoolWriter writer) {
        addLabel(label, help);
        MaterialSwitch toggle = new MaterialSwitch(context);
        toggle.setChecked(checked);
        toggle.setEnabled(!locked);
        toggle.setOnCheckedChangeListener((button, value) -> writer.write(value));
        container.addView(toggle, fieldLayoutParams());
        addSpacer();
        return toggle;
    }

    Spinner addSpinner(
            String label,
            String help,
            List<CastOptionLists.Option> options,
            String selected,
            TextWriter writer
    ) {
        addLabel(label, help);
        Spinner spinner = new Spinner(context);
        List<String> labels = new ArrayList<>();
        for (CastOptionLists.Option option : options) {
            labels.add(option.label);
        }
        ArrayAdapter<String> adapter = new ArrayAdapter<>(
                context,
                android.R.layout.simple_spinner_dropdown_item,
                labels
        );
        spinner.setAdapter(adapter);
        spinner.setSelection(CastOptionLists.indexOf(options, selected));
        spinner.setEnabled(!locked);
        spinner.setOnItemSelectedListener(new AdapterView.OnItemSelectedListener() {
            @Override
            public void onItemSelected(AdapterView<?> parent, View view, int position, long id) {
                writer.write(options.get(position).value);
            }

            @Override
            public void onNothingSelected(AdapterView<?> parent) {
                // no-op
            }
        });
        container.addView(spinner, fieldLayoutParams());
        addSpacer();
        return spinner;
    }

    TextInputEditText addNumberField(
            String label,
            String help,
            String initial,
            boolean allowDecimal,
            TextWriter writer
    ) {
        return addTextField(label, help, initial, allowDecimal ? InputType.TYPE_CLASS_NUMBER
                | InputType.TYPE_NUMBER_FLAG_DECIMAL : InputType.TYPE_CLASS_NUMBER, writer);
    }

    TextInputEditText addTextField(String label, String help, String initial, TextWriter writer) {
        return addTextField(label, help, initial, InputType.TYPE_CLASS_TEXT, writer);
    }

    private TextInputEditText addTextField(
            String label,
            String help,
            String initial,
            int inputType,
            TextWriter writer
    ) {
        TextInputLayout layout = new TextInputLayout(context);
        layout.setHint(label);
        layout.setEnabled(!locked);
        if (help != null && !help.isEmpty()) {
            layout.setHelperText(help);
        }
        TextInputEditText field = new TextInputEditText(context);
        field.setInputType(inputType);
        field.setText(initial);
        field.setEnabled(!locked);
        field.setOnFocusChangeListener((view, hasFocus) -> {
            if (!hasFocus) {
                writer.write(field.getText() == null ? "" : field.getText().toString().trim());
            }
        });
        layout.addView(field);
        container.addView(layout, fieldLayoutParams());
        addSpacer();
        return field;
    }

    private void addLabel(String label, @Nullable String help) {
        TextView title = new TextView(context);
        title.setText(label);
        title.setTextColor(context.getColor(com.yiyi.cloud_phone.R.color.auth_text_primary));
        title.setTextSize(14f);
        title.setPadding(dp(12), dp(8), dp(12), dp(2));
        container.addView(title);

        if (help != null && !help.isEmpty()) {
            TextView hint = new TextView(context);
            hint.setText(help);
            hint.setTextColor(context.getColor(com.yiyi.cloud_phone.R.color.auth_text_secondary));
            hint.setTextSize(11f);
            hint.setPadding(dp(12), 0, dp(12), dp(4));
            container.addView(hint);
        }
    }

    private void addSpacer() {
        View spacer = new View(context);
        spacer.setLayoutParams(new LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT,
                dp(8)
        ));
        container.addView(spacer);
    }

    private LinearLayout.LayoutParams fieldLayoutParams() {
        LinearLayout.LayoutParams params = new LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT,
                LinearLayout.LayoutParams.WRAP_CONTENT
        );
        int horizontal = dp(12);
        params.setMargins(horizontal, 0, horizontal, 0);
        return params;
    }

    private int dp(int value) {
        float density = context.getResources().getDisplayMetrics().density;
        return Math.round(value * density);
    }

    interface BoolWriter {
        void write(boolean value);
    }

    interface TextWriter {
        void write(String value);
    }
}
