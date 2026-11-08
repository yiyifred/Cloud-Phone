<script setup>
/**
 * 苹果接入向导的「Apple ID 登录」卡片（T-433 从 AddDeviceApplePanel 抽出）。
 * 表单状态仍由 useAppleWdaPipeline 持有：这里通过 v-model:* 事件回写，
 * 保证「跳过签名」勾选后输入框 disabled、和提交前的校验读的是同一份值。
 */
import { computed } from "vue";
import { useI18n } from "vue-i18n";

import UiButton from "../ui/UiButton.vue";

const props = defineProps({
  appleId: {
    type: String,
    default: "",
  },
  password: {
    type: String,
    default: "",
  },
  skipSign: {
    type: Boolean,
    default: false,
  },
  skipInstall: {
    type: Boolean,
    default: false,
  },
  running: {
    type: Boolean,
    default: false,
  },
  loadingPrepare: {
    type: Boolean,
    default: false,
  },
});

const emit = defineEmits([
  "update:appleId",
  "update:password",
  "update:skipSign",
  "update:skipInstall",
  "submit",
  "back",
  "skip-install",
]);

const { t } = useI18n();

// 父组件只读 props，v-model 的写回统一走 emit，避免子组件直接改 props 触发警告。
const appleIdModel = computed({
  get: () => props.appleId,
  set: (value) => emit("update:appleId", value),
});

const passwordModel = computed({
  get: () => props.password,
  set: (value) => emit("update:password", value),
});

const skipSignModel = computed({
  get: () => props.skipSign,
  set: (value) => emit("update:skipSign", value),
});

const skipInstallModel = computed({
  get: () => props.skipInstall,
  set: (value) => emit("update:skipInstall", value),
});
</script>

<template>
  <section class="apple-wizard__card">
    <h3>{{ t("devices.addDeviceModal.apple.pipeline.loginTitle") }}</h3>
    <form class="apple-wizard__form" @submit.prevent="emit('submit')">
      <label>
        <span>Apple ID</span>
        <input
          v-model.trim="appleIdModel"
          type="email"
          autocomplete="username"
          :disabled="props.running || props.skipSign"
        />
      </label>
      <label>
        <span>{{ t("devices.addDeviceModal.apple.pipeline.passwordLabel") }}</span>
        <input
          v-model="passwordModel"
          type="password"
          autocomplete="current-password"
          :disabled="props.running || props.skipSign"
        />
      </label>

      <div class="apple-wizard__toggles">
        <label class="apple-wizard__toggle">
          <input v-model="skipSignModel" type="checkbox" :disabled="props.running" />
          <span>{{ t("devices.addDeviceModal.apple.pipeline.skipSign") }}</span>
        </label>
        <label class="apple-wizard__toggle">
          <input v-model="skipInstallModel" type="checkbox" :disabled="props.running" />
          <span>{{ t("devices.addDeviceModal.apple.pipeline.skipInstall") }}</span>
        </label>
      </div>

      <div class="apple-wizard__actions">
        <UiButton variant="ghost" :disabled="props.running" @click="emit('back')">
          {{ t("common.back") }}
        </UiButton>
        <div class="apple-wizard__actions-right">
          <UiButton
            variant="ghost"
            :disabled="props.running || props.loadingPrepare"
            @click="emit('skip-install')"
          >
            {{ t("devices.addDeviceModal.apple.pipeline.skipInstallButton") }}
          </UiButton>
          <UiButton variant="primary" attr-type="submit" :disabled="props.running || props.loadingPrepare">
            {{
              props.running
                ? t("devices.addDeviceModal.apple.pipeline.running")
                : t("devices.addDeviceModal.apple.pipeline.start")
            }}
          </UiButton>
        </div>
      </div>
    </form>
  </section>
</template>
