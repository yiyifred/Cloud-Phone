<script setup>
import { useI18n } from "vue-i18n";
import { NInputNumber } from "naive-ui";

import HelpHint from "../ui/HelpHint.vue";
import UiButton from "../ui/UiButton.vue";

defineProps({
  settingsForm: {
    type: Object,
    required: true,
  },
  readOnly: {
    type: Boolean,
    default: false,
  },
});

const emit = defineEmits(["save"]);
const { t } = useI18n();
</script>

<template>
  <div class="settings-section shell-panel-content">
    <!-- 刷新间隔存在后端（POST /api/local-persistence），viewer 提交会 403 -->
    <p v-if="readOnly" class="share-intro">{{ t("access.readOnlyAction") }}</p>

    <form @submit.prevent="readOnly ? null : emit('save')">
      <dl class="shell-form-rows">
        <div class="shell-form-row">
          <dt class="shell-form-row__label">
            <span class="form-label-row">
              {{ t("settings.deviceInterval") }}
              <HelpHint :content="t('settings.intervalHint')" :title="t('settings.deviceInterval')" size="sm" />
            </span>
          </dt>
          <dd class="shell-form-row__control">
            <NInputNumber
              v-model:value="settingsForm.deviceListIntervalSeconds"
              :min="1"
              :max="120"
              :step="1"
              size="small"
              :disabled="readOnly"
              class="shell-input-number"
            />
          </dd>
        </div>
        <div class="shell-form-row">
          <dt class="shell-form-row__label">
            <span class="form-label-row">
              {{ t("settings.screenshotInterval") }}
              <HelpHint :content="t('settings.intervalHint')" :title="t('settings.screenshotInterval')" size="sm" />
            </span>
          </dt>
          <dd class="shell-form-row__control">
            <NInputNumber
              v-model:value="settingsForm.screenshotIntervalSeconds"
              :min="1"
              :max="120"
              :step="1"
              size="small"
              :disabled="readOnly"
              class="shell-input-number"
            />
          </dd>
        </div>
      </dl>
      <div class="shell-form-actions">
        <UiButton variant="primary" attr-type="submit" :disabled="readOnly">
          {{ t("settings.save") }}
        </UiButton>
      </div>
    </form>
  </div>
</template>
