package com.yiyi.cloud_phone.logs;

import android.os.Bundle;
import android.text.Editable;
import android.text.TextWatcher;
import android.view.LayoutInflater;
import android.view.View;
import android.view.ViewGroup;
import android.widget.Button;
import android.widget.EditText;

import androidx.annotation.NonNull;
import androidx.annotation.Nullable;
import androidx.appcompat.app.AlertDialog;
import androidx.fragment.app.Fragment;
import androidx.recyclerview.widget.LinearLayoutManager;
import androidx.recyclerview.widget.RecyclerView;

import com.google.android.material.chip.Chip;
import com.google.android.material.chip.ChipGroup;
import com.yiyi.cloud_phone.R;

import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Set;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

public class LogsFragment extends Fragment {
    private final ExecutorService executor = Executors.newSingleThreadExecutor();
    private final List<LogEntry> loaded = new ArrayList<>();
    private final Set<Long> loadedIds = new HashSet<>();

    private LogEntryAdapter adapter;
    private Button loadMoreBtn;
    private String levelFilter = "all";
    private String categoryFilter = "all";
    private String searchQuery = "";
    private Long nextBeforeId;
    private boolean hasMore;
    private boolean loading;

    @Nullable
    @Override
    public View onCreateView(@NonNull LayoutInflater inflater, @Nullable ViewGroup container,
                             @Nullable Bundle savedInstanceState) {
        return inflater.inflate(R.layout.fragment_logs, container, false);
    }

    @Override
    public void onViewCreated(@NonNull View view, @Nullable Bundle savedInstanceState) {
        super.onViewCreated(view, savedInstanceState);
        AppEventLogger.get().attach(requireContext());

        RecyclerView recycler = view.findViewById(R.id.recyclerLogs);
        recycler.setLayoutManager(new LinearLayoutManager(requireContext()));
        adapter = new LogEntryAdapter();
        recycler.setAdapter(adapter);

        loadMoreBtn = view.findViewById(R.id.buttonLoadMoreLogs);
        loadMoreBtn.setOnClickListener(v -> loadMore());

        EditText searchEdit = view.findViewById(R.id.editLogSearch);
        searchEdit.addTextChangedListener(new TextWatcher() {
            @Override public void beforeTextChanged(CharSequence s, int st, int c, int a) {}
            @Override public void onTextChanged(CharSequence s, int st, int b, int c) {
                searchQuery = s.toString().toLowerCase();
                refreshList();
            }
            @Override public void afterTextChanged(Editable s) {}
        });

        Button clearBtn = view.findViewById(R.id.buttonClearLogs);
        clearBtn.setOnClickListener(v -> new AlertDialog.Builder(requireContext())
                .setTitle(R.string.logs_clear_confirm_title)
                .setMessage(R.string.logs_clear_confirm_message)
                .setPositiveButton(R.string.logs_clear, (d, w) -> {
                    AppEventLogger.get().clear();
                    loaded.clear();
                    loadedIds.clear();
                    nextBeforeId = null;
                    hasMore = false;
                    refreshList();
                    updateLoadMore();
                })
                .setNegativeButton(R.string.common_cancel, null)
                .show());

        setupLevelChips(view.findViewById(R.id.chipGroupLevel));
        setupCategoryChips(view.findViewById(R.id.chipGroupCategory));

        AppEventLogger.get().setOnLogChangedListener(() -> {
            if (isAdded()) {
                requireActivity().runOnUiThread(this::refreshList);
            }
        });

        reloadFirstPage();
    }

    private void reloadFirstPage() {
        if (loading) {
            return;
        }
        loading = true;
        updateLoadMore();
        executor.execute(() -> {
            try {
                AppLogsApi.Page page = AppLogsApi.fetchPage(requireContext(), null);
                if (!isAdded()) {
                    return;
                }
                requireActivity().runOnUiThread(() -> {
                    loaded.clear();
                    loadedIds.clear();
                    for (LogEntry entry : page.logs) {
                        if (loadedIds.add(entry.id)) {
                            loaded.add(entry);
                        }
                    }
                    nextBeforeId = page.nextBeforeId;
                    hasMore = page.hasMore;
                    loading = false;
                    refreshList();
                    updateLoadMore();
                });
            } catch (Exception ignored) {
                if (isAdded()) {
                    requireActivity().runOnUiThread(() -> {
                        loading = false;
                        refreshList();
                        updateLoadMore();
                    });
                }
            }
        });
    }

    private void loadMore() {
        if (loading || !hasMore || nextBeforeId == null) {
            return;
        }
        loading = true;
        updateLoadMore();
        Long before = nextBeforeId;
        executor.execute(() -> {
            try {
                AppLogsApi.Page page = AppLogsApi.fetchPage(requireContext(), before);
                if (!isAdded()) {
                    return;
                }
                requireActivity().runOnUiThread(() -> {
                    for (LogEntry entry : page.logs) {
                        if (loadedIds.add(entry.id)) {
                            loaded.add(entry);
                        }
                    }
                    nextBeforeId = page.nextBeforeId;
                    hasMore = page.hasMore;
                    loading = false;
                    refreshList();
                    updateLoadMore();
                });
            } catch (Exception ignored) {
                if (isAdded()) {
                    requireActivity().runOnUiThread(() -> {
                        loading = false;
                        updateLoadMore();
                    });
                }
            }
        });
    }

    private void updateLoadMore() {
        if (loadMoreBtn == null) {
            return;
        }
        loadMoreBtn.setVisibility(hasMore ? View.VISIBLE : View.GONE);
        loadMoreBtn.setEnabled(!loading);
        loadMoreBtn.setText(loading ? R.string.logs_loading : R.string.logs_load_more);
    }

    private void setupLevelChips(ChipGroup group) {
        String[] levels = {"all", "debug", "info", "warn", "error"};
        int[] labels = {
                R.string.logs_level_all, R.string.logs_level_debug, R.string.logs_level_info,
                R.string.logs_level_warn, R.string.logs_level_error
        };
        for (int i = 0; i < levels.length; i++) {
            Chip chip = new Chip(requireContext());
            chip.setText(labels[i]);
            chip.setCheckable(true);
            chip.setChecked(i == 0);
            final String level = levels[i];
            chip.setOnCheckedChangeListener((btn, checked) -> {
                if (checked) {
                    levelFilter = level;
                    refreshList();
                }
            });
            group.addView(chip);
        }
        group.setSingleSelection(true);
    }

    private void setupCategoryChips(ChipGroup group) {
        String[] cats = {"all", "auth", "device", "cast", "files", "apps", "terminal", "group", "settings"};
        int[] labels = {
                R.string.logs_cat_all, R.string.logs_cat_auth, R.string.logs_cat_device,
                R.string.logs_cat_cast, R.string.logs_cat_files, R.string.logs_cat_apps,
                R.string.logs_cat_terminal, R.string.logs_cat_group, R.string.logs_cat_settings
        };
        for (int i = 0; i < cats.length; i++) {
            Chip chip = new Chip(requireContext());
            chip.setText(labels[i]);
            chip.setCheckable(true);
            chip.setChecked(i == 0);
            final String cat = cats[i];
            chip.setOnCheckedChangeListener((btn, checked) -> {
                if (checked) {
                    categoryFilter = cat;
                    refreshList();
                }
            });
            group.addView(chip);
        }
        group.setSingleSelection(true);
    }

    private void refreshList() {
        List<LogEntry> source = new ArrayList<>(loaded);
        // Prepend recent local entries that are not yet in the server page.
        for (LogEntry local : AppEventLogger.get().getEntries()) {
            if (local.id > 0 && loadedIds.contains(local.id)) {
                continue;
            }
            boolean duplicate = false;
            for (LogEntry existing : source) {
                if (existing.timestamp == local.timestamp && existing.message.equals(local.message)) {
                    duplicate = true;
                    break;
                }
            }
            if (!duplicate) {
                source.add(0, local);
            }
        }

        List<LogEntry> filtered = new ArrayList<>();
        for (LogEntry e : source) {
            if (!"all".equals(levelFilter) && !levelFilter.equals(e.level)) {
                continue;
            }
            if (!"all".equals(categoryFilter) && !categoryFilter.equals(e.category)) {
                continue;
            }
            if (!searchQuery.isEmpty()) {
                boolean match = e.message.toLowerCase().contains(searchQuery)
                        || (e.event != null && e.event.toLowerCase().contains(searchQuery))
                        || (e.category != null && e.category.toLowerCase().contains(searchQuery));
                if (!match) {
                    continue;
                }
            }
            filtered.add(e);
        }
        adapter.setEntries(filtered);
    }

    @Override
    public void onDestroyView() {
        AppEventLogger.get().setOnLogChangedListener(null);
        executor.shutdownNow();
        super.onDestroyView();
    }
}
