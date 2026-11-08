<script setup>
import { computed, watch } from "vue";
import { useI18n } from "vue-i18n";

import AppIcon from "./AppIcon.vue";
import { buildControlLabel, useDeviceControl } from "../composables/useDeviceControl.js";
import { logWarn } from "../utils/app-event-logger.js";

/**
 * 设备控制权按钮（T-422）。
 *
 * 为什么独立成组件：租约的申请/心跳/释放与文案都只关心「这一台设备」，
 * 放进 DeviceWorkspace 会把一个 600 行的页面再撑大，也没法在画廊复用。
 * 只读状态向上抛（update:readonly），由工作区决定哪些工具栏按键要置灰。
 */
const props = defineProps({
  device: {
    type: Object,
    required: true,
  },
});

const emit = defineEmits(["update:readonly", "update:holder"]);

const { t } = useI18n();

const lease = useDeviceControl({
  getSerial: () => props.device?.serial ?? "",
  getLabel: () => buildControlLabel(props.device?.displayName ?? props.device?.serial),
});

const holderName = computed(
  () => lease.holderLabel.value || t("devices.control.anonymousHolder"),
);

// 被他人持有即只读。advisory 模式下服务端不会拦，但 UI 也不该让两个人对着同一块屏乱点。
const readonly = computed(() => Boolean(lease.control.value?.held) && !lease.mine.value);

watch(readonly, (value) => emit("update:readonly", value), { immediate: true });
watch(holderName, (value) => emit("update:holder", value), { immediate: true });

watch(
  () => lease.error.value,
  (message) => {
    // 失败原因（例如「设备正被其他会话控制」）进应用日志，不静默吞掉；
    // 界面上已经用按钮文案表达状态，不再叠一层 toast。
    if (message) {
      logWarn("device", "control.lease.error", message, { deviceSerial: props.device?.serial });
    }
  },
);

const button = computed(() => {
  if (lease.busy.value && !lease.control.value) {
    return {
      label: t("devices.control.syncing"),
      title: t("devices.control.syncingTitle"),
      tone: "busy",
      disabled: true,
      onClick: null,
    };
  }

  if (lease.mine.value) {
    return {
      label: t("devices.control.release"),
      title: t("devices.control.releaseTitle"),
      tone: "mine",
      disabled: lease.busy.value,
      onClick: () => void lease.release(),
    };
  }

  if (readonly.value) {
    return {
      label: t("devices.control.heldBy", { name: holderName.value }),
      title: t("devices.control.heldByTitle"),
      tone: "other",
      disabled: lease.busy.value,
      onClick: handleTakeOver,
    };
  }

  return {
    label: t("devices.control.acquire"),
    title: t("devices.control.acquireTitle"),
    tone: "free",
    disabled: lease.busy.value,
    onClick: () => void lease.acquire(),
  };
});

async function handleTakeOver() {
  // 抢占会打断对方正在进行的操作，必须二次确认；确认框文案里带上持有者标识
  const confirmed = window.confirm(
    t("devices.control.takeOverConfirm", { name: holderName.value }),
  );

  if (!confirmed) {
    return;
  }

  await lease.takeOver();
}
</script>

<template>
  <button
    type="button"
    class="device-workspace__action device-workspace__action--lease"
    :class="`device-workspace__action--lease-${button.tone}`"
    :disabled="button.disabled"
    :title="button.title"
    :aria-pressed="button.tone === 'mine'"
    @click="button.onClick?.($event)"
  >
    <span class="device-workspace__action-icon" aria-hidden="true">
      <AppIcon name="shield" variant="toolbar" />
    </span>
    <span class="device-workspace__action-label">{{ button.label }}</span>
  </button>
</template>
