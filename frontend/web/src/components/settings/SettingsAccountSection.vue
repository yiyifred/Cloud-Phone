<script setup>
import { computed, ref, watch } from "vue";
import { useI18n } from "vue-i18n";
import { NSelect, NTag } from "naive-ui";

import HelpHint from "../ui/HelpHint.vue";
import UiButton from "../ui/UiButton.vue";
import { formatDate } from "../../utils/format-date.js";
import {
  getIconHelperPreference,
  setIconHelperPreference,
} from "../../utils/icon-helper-consent.js";

defineProps({
  passwordStatusText: {
    type: String,
    required: true,
  },
  sessionExpiresAt: {
    type: String,
    default: null,
  },
  showLogout: {
    type: Boolean,
    default: false,
  },
  readOnly: {
    type: Boolean,
    default: false,
  },
});

const emit = defineEmits(["change-password", "logout"]);
const { t } = useI18n();

const iconHelperPreference = ref(getIconHelperPreference());

const iconHelperOptions = computed(() => [
  { label: t("settings.iconHelperAsk"), value: "ask" },
  { label: t("settings.iconHelperAllow"), value: "allow" },
  { label: t("settings.iconHelperNever"), value: "never" },
]);

watch(iconHelperPreference, (value) => {
  setIconHelperPreference(value);
});
</script>

<template>
  <div class="settings-section shell-panel-content">
    <!-- viewer 不是账号：密码、会话、图标服务偏好都归分享者管 -->
    <p v-if="readOnly" class="share-intro">{{ t("access.viewerAccount") }}</p>

    <dl class="shell-form-rows">
      <div v-if="!readOnly" class="shell-form-row">
        <dt class="shell-form-row__label">{{ t("settings.passwordStatus") }}</dt>
        <dd><NTag round type="success" size="small">{{ passwordStatusText }}</NTag></dd>
      </div>
      <div v-if="!readOnly" class="shell-form-row">
        <dt class="shell-form-row__label">{{ t("settings.sessionExpiry") }}</dt>
        <dd><NTag round size="small">{{ formatDate(sessionExpiresAt) }}</NTag></dd>
      </div>
      <!-- 图标服务偏好是写操作（保存到后端），只读访问下不提供 -->
      <div v-if="!readOnly" class="shell-form-row">
        <dt class="shell-form-row__label">
          <span class="form-label-row">
            {{ t("settings.iconHelper") }}
            <HelpHint
              :content="t('settings.iconHelperHint')"
              :title="t('settings.iconHelper')"
              size="sm"
            />
          </span>
        </dt>
        <dd class="shell-form-row__control">
          <NSelect
            v-model:value="iconHelperPreference"
            :options="iconHelperOptions"
            size="small"
          />
        </dd>
      </div>
    </dl>

    <div v-if="!readOnly" class="shell-form-actions shell-form-actions--stack">
      <UiButton variant="primary" @click="emit('change-password')">
        {{ t("settings.sections.account.changePassword") }}
      </UiButton>
      <UiButton v-if="showLogout" variant="ghost" @click="emit('logout')">
        {{ t("sidebar.logout") }}
      </UiButton>
    </div>
  </div>
</template>
