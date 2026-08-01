<script setup>
import { toRef } from "vue";
import { useI18n } from "vue-i18n";
import { Icon } from "@iconify/vue";

import IconHelperGatePanel from "../IconHelperGatePanel.vue";
import { useStartMenuApps } from "../../composables/useStartMenuApps.js";
import { toggleBrowserFullscreen } from "../../utils/browser-fullscreen.js";

const emit = defineEmits(["launch", "toggle-fullscreen"]);

const props = defineProps({
  serial: {
    type: String,
    default: "",
  },
  active: {
    type: Boolean,
    default: false,
  },
  isFullscreen: {
    type: Boolean,
    default: false,
  },
});

const { t } = useI18n();
const {
  consentDialogOpen,
  progress,
  progressPercent,
  packageNamesOnly,
  answerConsent,
  searchQuery,
  apps,
  loading,
  errorMessage,
  hasLoadedOnce,
  gateBusy,
  showDeniedHint,
  progressLabel,
  showLoadProgress,
  progressIndeterminate,
  filteredApps,
  isSearching,
  initialsFor,
  displayName,
  launchPayload,
} = useStartMenuApps({
  serial: toRef(props, "serial"),
  active: toRef(props, "active"),
  t,
});

function launchApp(app) {
  emit("launch", launchPayload(app));
}

/**
 * Must run Fullscreen API in this gesture handler (Popover emit chain drops activation).
 */
function onToggleFullscreen(event) {
  event?.preventDefault?.();
  event?.stopPropagation?.();
  const workspace = document.querySelector(".device-workspace");
  void toggleBrowserFullscreen(workspace || document.documentElement);
  emit("toggle-fullscreen");
}
</script>

<template>
  <div class="win11-start-menu">
    <IconHelperGatePanel
      :consent-open="consentDialogOpen"
      :busy="showLoadProgress"
      :progress-percent="progressPercent"
      :progress-label="progressLabel"
      :current-package="packageNamesOnly ? '' : progress.current"
      :denied-hint="showDeniedHint"
      :inline="true"
      :indeterminate="progressIndeterminate"
      @allow="answerConsent(true)"
      @deny="answerConsent(false)"
    />

    <div class="win11-start-menu__search">
      <Icon icon="lucide:search" class="win11-start-menu__search-icon" :width="16" :height="16" />
      <input
        v-model="searchQuery"
        class="win11-start-menu__search-input"
        type="search"
        :placeholder="t('iconHelper.searchApps')"
        autocomplete="off"
        spellcheck="false"
      />
    </div>

    <div class="win11-start-menu__body">
      <p v-if="loading && !hasLoadedOnce && !gateBusy" class="win11-start-menu__status">
        {{ t("iconHelper.loadingApps") }}
      </p>
      <p v-else-if="errorMessage && !apps.length" class="win11-start-menu__status is-error">
        {{ errorMessage }}
      </p>
      <p v-else-if="isSearching && !filteredApps.length" class="win11-start-menu__status">
        {{ t("iconHelper.noMatch") }}
      </p>
      <p v-else-if="!filteredApps.length && !gateBusy && !loading" class="win11-start-menu__status">
        {{ t("iconHelper.emptyApps") }}
      </p>

      <ul v-else-if="isSearching && filteredApps.length" class="win11-start-menu__search-list">
        <li v-for="app in filteredApps" :key="`${app.packageName}:${app.activity}`">
          <button type="button" class="win11-start-menu__search-item" @click="launchApp(app)">
            <span class="win11-start-menu__search-icon-wrap" aria-hidden="true">
              <img v-if="app.iconDataUrl && !packageNamesOnly" :src="app.iconDataUrl" alt="" />
              <span v-else>{{ initialsFor(app) }}</span>
            </span>
            <span class="win11-start-menu__search-text">
              <strong>{{ displayName(app) }}</strong>
              <small>{{ t("iconHelper.appKind") }}</small>
            </span>
          </button>
        </li>
      </ul>

      <template v-else-if="filteredApps.length">
        <div class="win11-start-menu__grid">
          <button
            v-for="app in filteredApps"
            :key="`${app.packageName}:${app.activity}`"
            type="button"
            class="win11-start-menu__app"
            :title="displayName(app)"
            @click="launchApp(app)"
          >
            <span class="win11-start-menu__app-icon" aria-hidden="true">
              <img v-if="app.iconDataUrl && !packageNamesOnly" :src="app.iconDataUrl" alt="" />
              <span v-else>{{ initialsFor(app) }}</span>
            </span>
            <span class="win11-start-menu__app-name">{{ displayName(app) }}</span>
          </button>
        </div>
      </template>
    </div>

    <footer class="win11-start-menu__footer">
      <button
        type="button"
        class="win11-start-menu__power"
        :title="isFullscreen ? '取消全屏 (Esc)' : '全屏'"
        :aria-label="isFullscreen ? '取消全屏' : '全屏'"
        @pointerdown="onToggleFullscreen"
        @click.prevent.stop
      >
        <Icon
          :icon="isFullscreen ? 'lucide:minimize' : 'lucide:maximize'"
          :width="18"
          :height="18"
        />
        <span>{{ isFullscreen ? "取消全屏" : "全屏" }}</span>
      </button>
    </footer>
  </div>
</template>
