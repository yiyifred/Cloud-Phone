<script setup>
/**
 * 添加设备弹窗的 USB 等待页（T-430 从 AddDeviceModal 抽出）。
 *
 * Android 与鸿蒙两个分支长得几乎一样，差别只有三处：鸿蒙没有插线示意图、
 * 设备列表只显示「已连接」、空态文案不同。用 variant 区分，避免两份重复模板。
 */
import { computed } from "vue";
import { useI18n } from "vue-i18n";

import UiButton from "../ui/UiButton.vue";

const props = defineProps({
  // android | harmony
  variant: {
    type: String,
    default: "android",
  },
  devices: {
    type: Array,
    default: () => [],
  },
  summary: {
    type: Object,
    required: true,
  },
});

const emit = defineEmits(["back", "done"]);

const { t } = useI18n();

const isHarmony = computed(() => props.variant === "harmony");
const emptyText = computed(() =>
  isHarmony.value
    ? t("devices.addDeviceModal.harmonyUsb.empty")
    : t("devices.addDeviceModal.usb.empty"),
);
const desc = computed(() => (isHarmony.value ? t("devices.addDeviceModal.harmonyUsb.desc") : ""));
</script>

<template>
  <div class="add-device-modal__usb">
    <div class="add-device-modal__usb-layout">
      <div v-if="!isHarmony" class="add-device-modal__usb-hero" aria-hidden="true">
        <div class="usb-hero__phone" />
        <div class="usb-hero__cable">
          <span class="usb-hero__cable-line" />
          <span class="usb-hero__plug" />
        </div>
      </div>

      <div class="add-device-modal__usb-status">
        <p v-if="isHarmony">{{ desc }}</p>
        <p class="add-device-modal__usb-summary">
          {{
            t("devices.addDeviceModal.usb.summary", {
              total: props.summary.total,
              connected: props.summary.connected,
              unauthorized: props.summary.unauthorized,
            })
          }}
        </p>
        <p v-if="props.devices.length === 0" class="add-device-modal__usb-empty">
          {{ emptyText }}
        </p>
        <ul v-else class="add-device-modal__usb-list">
          <li
            v-for="device in props.devices"
            :key="device.serial"
            class="add-device-modal__usb-item"
          >
            <div class="add-device-modal__usb-item-main">
              <strong>{{ device.displayName || device.serial }}</strong>
              <span class="add-device-modal__usb-item-sub">{{ device.serial }}</span>
            </div>
            <!-- 鸿蒙分支只列出已连接设备，状态恒为「已连接」 -->
            <span
              class="add-device-modal__usb-state"
              :class="
                isHarmony
                  ? 'add-device-modal__usb-state--ok'
                  : {
                      'add-device-modal__usb-state--ok': device.connected,
                      'add-device-modal__usb-state--warn': device.state === 'unauthorized',
                    }
              "
            >
              {{
                isHarmony
                  ? t("devices.addDeviceModal.usb.stateConnected")
                  : device.connected
                    ? t("devices.addDeviceModal.usb.stateConnected")
                    : device.state === "unauthorized"
                      ? t("devices.addDeviceModal.usb.stateUnauthorized")
                      : t("devices.addDeviceModal.usb.stateDetecting")
              }}
            </span>
          </li>
        </ul>
      </div>
    </div>

    <div class="add-device-modal__usb-actions">
      <UiButton variant="ghost" @click="emit('back')">{{ t("common.back") }}</UiButton>
      <UiButton variant="primary" @click="emit('done')">
        {{ t("devices.addDeviceModal.usb.done") }}
      </UiButton>
    </div>
  </div>
</template>
