import { computed, onMounted, ref } from "vue";

import {
  LOG_CATEGORIES,
  LOG_LEVELS,
  clearAppEventLog,
  getAppEventLogState,
  loadAppEventLogPage,
  loadMoreAppEventLogs,
} from "../utils/app-event-logger.js";

export function useAppEventLog() {
  const state = getAppEventLogState();
  const activeLevel = ref("all");
  const activeCategory = ref("all");
  const searchQuery = ref("");
  const expandedIds = ref(new Set());

  onMounted(() => {
    void loadAppEventLogPage();
  });

  const levelCounts = computed(() => {
    const counts = { all: state.entries.length, debug: 0, info: 0, warn: 0, error: 0 };
    for (const entry of state.entries) {
      counts[entry.level] += 1;
    }
    return counts;
  });

  const filteredEntries = computed(() => {
    const query = searchQuery.value.trim().toLowerCase();
    return state.entries.filter((entry) => {
      if (activeLevel.value !== "all" && entry.level !== activeLevel.value) {
        return false;
      }
      if (activeCategory.value !== "all" && entry.category !== activeCategory.value) {
        return false;
      }
      if (!query) {
        return true;
      }
      const haystack = [
        entry.message,
        entry.event,
        entry.category,
        entry.level,
        entry.deviceSerial,
        entry.deviceName,
        entry.displayTime,
        entry.details ? JSON.stringify(entry.details) : "",
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return haystack.includes(query);
    });
  });

  function toggleExpanded(id) {
    const next = new Set(expandedIds.value);
    if (next.has(id)) {
      next.delete(id);
    } else {
      next.add(id);
    }
    expandedIds.value = next;
  }

  function isExpanded(id) {
    return expandedIds.value.has(id);
  }

  function clearLog() {
    void clearAppEventLog();
    expandedIds.value = new Set();
  }

  function formatDetails(details) {
    if (!details) {
      return "";
    }
    return JSON.stringify(details, null, 2);
  }

  function loadMore() {
    void loadMoreAppEventLogs();
  }

  return {
    entries: computed(() => state.entries),
    filteredEntries,
    levelCounts,
    activeLevel,
    activeCategory,
    searchQuery,
    loading: computed(() => state.loading),
    hasMore: computed(() => state.hasMore),
    logLevels: LOG_LEVELS,
    logCategories: LOG_CATEGORIES,
    toggleExpanded,
    isExpanded,
    clearLog,
    formatDetails,
    loadMore,
  };
}
