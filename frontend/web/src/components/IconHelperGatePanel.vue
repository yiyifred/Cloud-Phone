<script setup>
import { computed } from "vue";
import { useI18n } from "vue-i18n";
import { NModal, NProgress } from "naive-ui";

import UiButton from "./ui/UiButton.vue";

const props = defineProps({
  consentOpen: {
    type: Boolean,
    default: false,
  },
  busy: {
    type: Boolean,
    default: false,
  },
  progressPercent: {
    type: Number,
    default: 0,
  },
  progressLabel: {
    type: String,
    default: "",
  },
  currentPackage: {
    type: String,
    default: "",
  },
  deniedHint: {
    type: Boolean,
    default: false,
  },
  /** Prefer inline bar (start menu / app manager) over blocking modal. */
  inline: {
    type: Boolean,
    default: false,
  },
  /** Force indeterminate animation (e.g. package-name-only load). */
  indeterminate: {
    type: Boolean,
    default: false,
  },
});

const emit = defineEmits(["allow", "deny"]);

const { t } = useI18n();

const showProgress = computed(() => props.busy && !props.consentOpen);
const showModalProgress = computed(() => showProgress.value && !props.inline);
const showInlineProgress = computed(() => showProgress.value && props.inline);
const barPercent = computed(() =>
  props.indeterminate ? 0 : Math.max(0, Math.min(100, Number(props.progressPercent) || 0)),
);
</script>

<template>
  <NModal
    :show="consentOpen"
    preset="card"
    :title="t('iconHelper.consentTitle')"
    :mask-closable="false"
    :close-on-esc="false"
    style="width: min(420px, 92vw)"
    @update:show="(open) => !open && emit('deny')"
  >
    <p class="icon-helper-consent__body">{{ t("iconHelper.consentBody") }}</p>
    <div class="icon-helper-consent__actions">
      <UiButton variant="ghost" @click="emit('deny')">{{ t("iconHelper.deny") }}</UiButton>
      <UiButton variant="primary" @click="emit('allow')">{{ t("iconHelper.allow") }}</UiButton>
    </div>
  </NModal>

  <NModal
    :show="showModalProgress"
    preset="card"
    :title="progressLabel || t('iconHelper.extracting')"
    :mask-closable="false"
    :close-on-esc="false"
    :closable="false"
    style="width: min(420px, 92vw)"
  >
    <div class="icon-helper-progress">
      <p class="icon-helper-progress__label">
        {{ progressLabel || t("iconHelper.extracting") }}
        <span v-if="currentPackage"> · {{ currentPackage }}</span>
      </p>
      <NProgress type="line" :percentage="progressPercent" :show-indicator="true" />
    </div>
  </NModal>

  <div v-if="showInlineProgress" class="icon-helper-inline" role="status">
    <div class="icon-helper-inline__row">
      <span class="icon-helper-inline__label">
        {{ progressLabel || t("iconHelper.extracting") }}
        <span v-if="currentPackage"> · {{ currentPackage }}</span>
      </span>
      <span v-if="!indeterminate && progressPercent > 0" class="icon-helper-inline__pct">
        {{ Math.round(progressPercent) }}%
      </span>
    </div>
    <div class="icon-helper-inline__bar" aria-hidden="true">
      <div
        class="icon-helper-inline__fill"
        :class="{ 'icon-helper-inline__fill--indeterminate': indeterminate }"
        :style="indeterminate ? undefined : { width: `${barPercent}%` }"
      />
    </div>
  </div>

  <p v-if="deniedHint && !consentOpen && !showProgress" class="icon-helper-denied">
    {{ t("iconHelper.deniedHint") }}
  </p>
</template>

<style scoped>
.icon-helper-consent__body {
  margin: 0 0 1rem;
  color: var(--muted);
  line-height: 1.5;
  font-size: 0.92rem;
}

.icon-helper-consent__actions {
  display: flex;
  justify-content: flex-end;
  gap: 0.65rem;
}

.icon-helper-progress {
  display: grid;
  gap: 0.55rem;
}

.icon-helper-progress__label {
  margin: 0;
  font-size: 0.9rem;
  color: var(--muted);
  line-height: 1.45;
}

.icon-helper-denied {
  margin: 0.25rem 0 0.65rem;
  font-size: 0.82rem;
  color: var(--muted);
}

.icon-helper-inline {
  margin: 0.35rem 0.85rem 0.55rem;
  padding: 0.55rem 0.65rem;
  border: 1px solid rgba(0, 0, 0, 0.08);
  border-radius: 0.55rem;
  background: rgba(255, 255, 255, 0.72);
}

.icon-helper-inline__row {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 0.75rem;
  margin-bottom: 0.4rem;
}

.icon-helper-inline__label {
  font-size: 0.8rem;
  color: #555;
  line-height: 1.4;
}

.icon-helper-inline__pct {
  flex-shrink: 0;
  font-size: 0.75rem;
  color: #777;
}

.icon-helper-inline__bar {
  width: 100%;
  height: 8px;
  overflow: hidden;
  border-radius: 999px;
  background: rgba(0, 0, 0, 0.08);
}

.icon-helper-inline__fill {
  height: 100%;
  border-radius: 999px;
  background: #0078d4;
  transition: width 220ms ease;
}

.icon-helper-inline__fill--indeterminate {
  width: 42%;
  animation: icon-helper-inline-indeterminate 1.1s ease-in-out infinite;
}

@keyframes icon-helper-inline-indeterminate {
  0% {
    transform: translateX(-110%);
  }
  100% {
    transform: translateX(260%);
  }
}
</style>
