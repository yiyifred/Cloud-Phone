<script setup>
/**
 * 添加设备弹窗的头部（T-430 从 AddDeviceModal 抽出）。
 * 标题/副标题按当前步骤切换；未知步骤（platforms、harmony-usb、android-qr）走默认文案，
 * 与拆分前那串三元判断完全一致——这里的顺序就是原来的优先级。
 */
import { useI18n } from "vue-i18n";

const props = defineProps({
  step: {
    type: String,
    required: true,
  },
});

const emit = defineEmits(["close"]);

const { t } = useI18n();
</script>

<template>
  <header class="add-device-modal__header">
    <div>
      <h2>
        {{
          props.step === "android-usb"
            ? t("devices.addDeviceModal.usb.title")
            : props.step === "android-pair-code"
              ? t("devices.addDeviceModal.pairCode.title")
              : props.step === "android-direct"
                ? t("devices.addDeviceModal.directConnect.title")
                : props.step === "apple-connect"
                  ? t("devices.addDeviceModal.apple.title")
                  : t("devices.addDeviceModal.title")
        }}
      </h2>
      <p>
        {{
          props.step === "android-usb"
            ? t("devices.addDeviceModal.usb.desc")
            : props.step === "android-pair-code"
              ? t("devices.addDeviceModal.pairCode.desc")
              : props.step === "android-direct"
                ? t("devices.addDeviceModal.directConnect.desc")
                : props.step === "apple-connect"
                  ? t("devices.addDeviceModal.apple.desc")
                  : t("devices.addDeviceModal.desc")
        }}
      </p>
    </div>
    <button
      type="button"
      class="add-device-modal__close"
      :aria-label="t('devices.addDeviceModal.close')"
      @click="emit('close')"
    >
      ×
    </button>
  </header>
</template>
