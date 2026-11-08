<script setup>
import { computed } from "vue";
import { useI18n } from "vue-i18n";
import { NButton, NInput, NPopconfirm } from "naive-ui";

import "../assets/logs-page.css";
import PageHeader from "./ui/PageHeader.vue";
import ShellSegmentTabs from "./ui/ShellSegmentTabs.vue";
import { useAppEventLog } from "../composables/useAppEventLog.js";

const props = defineProps({
  readOnly: {
    type: Boolean,
    default: false,
  },
});

const { t } = useI18n();

const {
  filteredEntries,
  levelCounts,
  activeLevel,
  activeCategory,
  searchQuery,
  logLevels,
  logCategories,
  loading,
  hasMore,
  toggleExpanded,
  isExpanded,
  clearLog,
  formatDetails,
  loadMore,
} = useAppEventLog();

const levelTabs = computed(() => [
  { name: "all", label: t("logs.levelAll"), count: levelCounts.value.all },
  ...logLevels.map((level) => ({
    name: level,
    label: t(`logs.level${level.charAt(0).toUpperCase()}${level.slice(1)}`),
    count: levelCounts.value[level],
  })),
]);

const categoryTabs = computed(() => [
  { name: "all", label: t("logs.categoryAll") },
  ...logCategories.map((category) => ({
    name: category,
    label: t(`logs.categories.${category}`),
  })),
]);

const emptyMessage = computed(() =>
  searchQuery.value.trim() || activeLevel.value !== "all" || activeCategory.value !== "all"
    ? t("logs.emptyFiltered")
    : t("logs.empty"),
);
</script>

<template>
  <section class="logs-page">
    <PageHeader
      :eyebrow="t('logs.eyebrow')"
      :title="t('logs.title')"
      :help="t('logs.desc')"
      :meta="t('logs.count', { count: filteredEntries.length })"
    />

    <div class="logs-page__toolbar">
      <NInput
        v-model:value="searchQuery"
        class="logs-page__search"
        clearable
        size="small"
        :placeholder="t('logs.searchPlaceholder')"
      />
      <!-- 清空日志是写操作（后端 POST），只读分享访问下直接禁用 -->
      <NPopconfirm v-if="!props.readOnly" @positive-click="clearLog">
        <template #trigger>
          <NButton secondary size="small">{{ t("logs.clear") }}</NButton>
        </template>
        {{ t("logs.clear") }}?
      </NPopconfirm>
    </div>

    <ShellSegmentTabs v-model="activeLevel" :tabs="levelTabs" :aria-label="t('logs.title')" />
    <ShellSegmentTabs v-model="activeCategory" :tabs="categoryTabs" class="shell-segment-tabs--compact" />

    <div v-if="filteredEntries.length" class="logs-page__list">
      <article
        v-for="entry in filteredEntries"
        :key="entry.id"
        class="logs-page__entry"
        :class="`logs-page__entry--${entry.level}`"
      >
        <button
          type="button"
          class="logs-page__entry-header"
          :aria-expanded="isExpanded(entry.id)"
          @click="toggleExpanded(entry.id)"
        >
          <div class="logs-page__entry-badges">
            <span class="logs-page__badge" :class="`logs-page__badge--${entry.level}`">
              {{ entry.level }}
            </span>
            <span class="logs-page__badge logs-page__badge--category">
              {{ t(`logs.categories.${entry.category}`) }}
            </span>
          </div>

          <div class="logs-page__entry-main">
            <p class="logs-page__entry-message">{{ entry.message }}</p>
            <div class="logs-page__entry-meta">
              <span>{{ entry.displayTime }}</span>
              <span v-if="entry.deviceName">{{ entry.deviceName }}</span>
              <span v-if="entry.deviceSerial">{{ entry.deviceSerial }}</span>
              <span>{{ entry.event }}</span>
            </div>
          </div>

          <span class="logs-page__entry-chevron" aria-hidden="true">
            {{ isExpanded(entry.id) ? "▾" : "▸" }}
          </span>
        </button>

        <div v-if="isExpanded(entry.id)" class="logs-page__entry-details">
          <pre v-if="entry.details" class="logs-page__details-pre">{{ formatDetails(entry.details) }}</pre>
          <pre v-else class="logs-page__details-pre">{{ entry.event }}</pre>
        </div>
      </article>

      <div v-if="hasMore" class="logs-page__more">
        <NButton :loading="loading" secondary size="small" @click="loadMore">
          {{ t("logs.loadMore") }}
        </NButton>
      </div>
    </div>

    <div v-else class="logs-page__empty">
      {{ loading ? t("logs.loading") : emptyMessage }}
    </div>
  </section>
</template>
