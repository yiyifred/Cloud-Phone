<script setup>
/**
 * 添加设备弹窗的「二维码配对」页（T-430 从 AddDeviceModal 抽出）。
 * 二维码图片与配对码都来自父组件的会话状态，这里只负责展示与三个动作按钮。
 */
import { useI18n } from "vue-i18n";

import AddDevicePairResult from "./AddDevicePairResult.vue";
import UiButton from "../ui/UiButton.vue";

const props = defineProps({
  imageUrl: {
    type: String,
    default: "",
  },
  loading: {
    type: Boolean,
    default: false,
  },
  session: {
    type: Object,
    default: null,
  },
  pending: {
    type: Boolean,
    default: false,
  },
  result: {
    type: Object,
    default: null,
  },
});

const emit = defineEmits(["back", "refresh", "confirm"]);

const { t } = useI18n();
</script>

<template>
  <div class="add-device-modal__pair-code">
    <div class="add-device-modal__pair-hint">
      <h3>{{ t("devices.addDeviceModal.qr.stepsTitle") }}</h3>
      <ol>
        <li>{{ t("devices.addDeviceModal.qr.stepWirelessDebug") }}</li>
        <li>{{ t("devices.addDeviceModal.qr.stepPairQr") }}</li>
        <li>{{ t("devices.addDeviceModal.qr.stepScanFromPhone") }}</li>
      </ol>
    </div>

    <form class="add-device-modal__pair-form">
      <div class="add-device-modal__qr-panel">
        <p class="add-device-modal__qr-title">
          {{ t("devices.addDeviceModal.qr.imageTitle") }}
        </p>
        <div v-if="props.loading" class="add-device-modal__qr-loading">
          {{ t("devices.addDeviceModal.qr.generating") }}
        </div>
        <img
          v-else-if="props.imageUrl"
          class="add-device-modal__qr-image"
          :src="props.imageUrl"
          :alt="t('devices.addDeviceModal.qr.imageAlt')"
        />
        <p v-if="props.session" class="add-device-modal__qr-code">
          {{
            t("devices.addDeviceModal.qr.pairCodeHint", { code: props.session.pairingCode })
          }}
        </p>
      </div>
    </form>

    <div class="add-device-modal__pair-actions add-device-modal__pair-actions--full">
      <UiButton variant="ghost" @click="emit('back')">{{ t("common.back") }}</UiButton>
      <UiButton variant="ghost" :disabled="props.loading || props.pending" @click="emit('refresh')">
        {{ t("devices.addDeviceModal.qr.refresh") }}
      </UiButton>
      <UiButton variant="primary" :disabled="props.pending" @click="emit('confirm')">
        {{
          props.pending
            ? t("devices.addDeviceModal.pairCode.pairing")
            : t("devices.addDeviceModal.qr.confirmScanned")
        }}
      </UiButton>
    </div>

    <AddDevicePairResult v-if="props.result" :result="props.result" />
  </div>
</template>
