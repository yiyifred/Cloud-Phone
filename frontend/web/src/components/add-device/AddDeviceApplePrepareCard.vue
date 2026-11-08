<script setup>
/**
 * 苹果接入向导的「环境准备」卡片（T-433 从 AddDeviceApplePanel 抽出）。
 * 只做四项检查项的渲染；prepareInfo 由 useAppleWdaPipeline 拉取，避免子组件重复请求。
 */
import { Icon } from "@iconify/vue";
import { useI18n } from "vue-i18n";

const props = defineProps({
  loadingPrepare: {
    type: Boolean,
    default: false,
  },
  prepareInfo: {
    type: Object,
    default: null,
  },
  prepareError: {
    type: String,
    default: "",
  },
});

const { t } = useI18n();
</script>

<template>
  <section class="apple-wizard__card">
    <h3>{{ t("devices.addDeviceModal.apple.pipeline.prepareTitle") }}</h3>
    <p v-if="props.loadingPrepare" class="apple-panel__empty">
      {{ t("devices.addDeviceModal.apple.pipeline.prepareLoading") }}
    </p>
    <ul v-else-if="props.prepareInfo" class="apple-wizard__checklist">
      <li :class="{ 'is-ok': props.prepareInfo.prepare?.ipaExists, 'is-fail': !props.prepareInfo.prepare?.ipaExists }">
        <Icon :icon="props.prepareInfo.prepare?.ipaExists ? 'lucide:check' : 'lucide:x'" />
        {{ t("devices.addDeviceModal.apple.pipeline.checkIpa") }}
      </li>
      <li :class="{ 'is-ok': props.prepareInfo.python?.ok, 'is-fail': !props.prepareInfo.python?.ok }">
        <Icon :icon="props.prepareInfo.python?.ok ? 'lucide:check' : 'lucide:x'" />
        Python {{ props.prepareInfo.python?.version || props.prepareInfo.python?.error }}
      </li>
      <li :class="{ 'is-ok': props.prepareInfo.pymobiledevice3?.ok, 'is-fail': !props.prepareInfo.pymobiledevice3?.ok }">
        <Icon :icon="props.prepareInfo.pymobiledevice3?.ok ? 'lucide:check' : 'lucide:x'" />
        pymobiledevice3
      </li>
      <li :class="{ 'is-ok': props.prepareInfo.prepare?.zsignWasmAvailable, 'is-warn': !props.prepareInfo.prepare?.zsignWasmAvailable }">
        <Icon :icon="props.prepareInfo.prepare?.zsignWasmAvailable ? 'lucide:check' : 'lucide:alert-triangle'" />
        zsign-wasm
        <template v-if="props.prepareInfo.prepare?.zsignWasmVersion">
          (v{{ props.prepareInfo.prepare.zsignWasmVersion }})
        </template>
        <template v-else>
          ({{ t("devices.addDeviceModal.apple.pipeline.zsignWasmMissing") }})
        </template>
      </li>
    </ul>
    <p v-if="props.prepareInfo?.hints?.installHint" class="apple-wizard__hint">
      {{ props.prepareInfo.hints.installHint }}
    </p>
    <p v-if="props.prepareError" class="apple-wizard__error">{{ props.prepareError }}</p>
  </section>
</template>
