<script setup>
/**
 * 配对结果两行展示（T-430 从 AddDeviceModal 抽出）。
 * 配对码与二维码两条路径共用同一段「配对结果 / 连接结果」文案，抽出来避免两份漂移。
 */
import { useI18n } from "vue-i18n";

const props = defineProps({
  result: {
    type: Object,
    required: true,
  },
});

const { t } = useI18n();
</script>

<template>
  <div class="add-device-modal__pair-result">
    <p :class="props.result.ok ? 'result-ok' : 'result-fail'">
      {{
        props.result.ok
          ? t("devices.addDeviceModal.pairCode.pairSuccess")
          : t("devices.addDeviceModal.pairCode.pairFailed")
      }}
      ：{{ props.result.message }}
    </p>
    <p :class="props.result.connectOk ? 'result-ok' : 'result-fail'">
      {{
        props.result.connectOk
          ? t("devices.addDeviceModal.pairCode.connectSuccess")
          : t("devices.addDeviceModal.pairCode.connectFailed")
      }}
      ：{{ props.result.connectMessage }}
    </p>
  </div>
</template>
