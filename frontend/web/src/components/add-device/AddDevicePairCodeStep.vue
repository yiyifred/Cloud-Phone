<script setup>
/**
 * 添加设备弹窗的「配对码」页（T-430 从 AddDeviceModal 抽出）。
 * 表单对象由父组件持有（提交逻辑也在父组件），这里只写字段并抛 submit/back；
 * 不替换 form 引用，避免父子各自持有一份输入状态。
 */
import { useI18n } from "vue-i18n";

import AddDevicePairResult from "./AddDevicePairResult.vue";
import UiButton from "../ui/UiButton.vue";

const props = defineProps({
  form: {
    type: Object,
    required: true,
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

const emit = defineEmits(["submit", "back"]);

const { t } = useI18n();
</script>

<template>
  <div class="add-device-modal__pair-code">
    <div class="add-device-modal__pair-hint">
      <h3>{{ t("devices.addDeviceModal.pairCode.stepsTitle") }}</h3>
      <ol>
        <li>{{ t("devices.addDeviceModal.pairCode.stepDevOptions") }}</li>
        <li>{{ t("devices.addDeviceModal.pairCode.stepWirelessDebug") }}</li>
        <li>{{ t("devices.addDeviceModal.pairCode.stepUsePairCode") }}</li>
      </ol>
    </div>

    <form class="add-device-modal__pair-form" @submit.prevent="emit('submit')">
      <label>
        <span>{{ t("devices.addDeviceModal.pairCode.ipPort") }}</span>
        <div class="add-device-modal__pair-row">
          <input
            v-model.trim="props.form.host"
            type="text"
            required
            :placeholder="t('devices.addDeviceModal.pairCode.ipPlaceholder')"
          />
          <input
            v-model.trim="props.form.port"
            type="number"
            min="1"
            max="65535"
            required
            :placeholder="t('devices.addDeviceModal.pairCode.portPlaceholder')"
          />
        </div>
      </label>
      <label>
        <span>{{ t("devices.addDeviceModal.pairCode.codeLabel") }}</span>
        <input
          v-model.trim="props.form.pairingCode"
          type="text"
          required
          :placeholder="t('devices.addDeviceModal.pairCode.codePlaceholder')"
        />
      </label>

      <div class="add-device-modal__pair-actions">
        <UiButton variant="ghost" @click="emit('back')">{{ t("common.back") }}</UiButton>
        <UiButton variant="primary" attr-type="submit" :disabled="props.pending">
          {{
            props.pending
              ? t("devices.addDeviceModal.pairCode.pairing")
              : t("devices.addDeviceModal.pairCode.submit")
          }}
        </UiButton>
      </div>
    </form>

    <AddDevicePairResult v-if="props.result" :result="props.result" />
  </div>
</template>
