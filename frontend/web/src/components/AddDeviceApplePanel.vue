<script setup>
/**
 * 苹果（WebDriverAgent 签名安装）接入面板。
 *
 * 为什么这里只剩展示：状态与请求都搬到了 add-device/useAppleWdaPipeline.js，
 * 进度区/准备项/登录表单拆成三个子组件（T-433）。组件只做「把 composable 的
 * ref 解构出来 + 绑到子组件」这一件事，改动时不需要同时读模板和请求逻辑。
 *
 * 注意：解构是关键——`<script setup>` 只对顶层 ref 做模板自动解包，
 * 若写成 pipeline.appleId 再传给子组件会传成 Ref 对象而不是字符串。
 */
import { Icon } from "@iconify/vue";
import { useI18n } from "vue-i18n";

import AddDeviceAppleLoginForm from "./add-device/AddDeviceAppleLoginForm.vue";
import AddDeviceApplePrepareCard from "./add-device/AddDeviceApplePrepareCard.vue";
import AddDeviceAppleProgress from "./add-device/AddDeviceAppleProgress.vue";
import { useAppleWdaPipeline } from "./add-device/useAppleWdaPipeline.js";

const props = defineProps({
  onBack: {
    type: Function,
    default: null,
  },
  onConnected: {
    type: Function,
    default: null,
  },
});

const { t } = useI18n();

const {
  prepareInfo,
  prepareError,
  loadingPrepare,
  appleId,
  password,
  skipSign,
  skipInstall,
  pipelineJob,
  pipelineError,
  running,
  currentStepIndex,
  overallProgress,
  isCompleted,
  isFailed,
  pipelineLogsText,
  stepItems,
  startPipeline,
  startSkipInstallPipeline,
} = useAppleWdaPipeline({
  // 用 lambda 读 props：父组件在弹窗生命周期内可能替换 onConnected，取值必须是最新的。
  onConnected: (device) => props.onConnected?.(device),
});
</script>

<template>
  <div class="apple-panel apple-panel--wizard">
    <div class="apple-panel__hero" aria-hidden="true">
      <div class="apple-panel__glow" />
      <Icon icon="mdi:apple" class="apple-panel__hero-icon" />
      <div class="apple-panel__rings">
        <span />
        <span />
        <span />
      </div>
    </div>

    <div class="apple-panel__content">
      <AddDeviceAppleProgress
        :current-step-index="currentStepIndex"
        :overall-progress="overallProgress"
        :step-items="stepItems"
        :message="pipelineJob?.message || ''"
      />

      <AddDeviceApplePrepareCard
        :loading-prepare="loadingPrepare"
        :prepare-info="prepareInfo"
        :prepare-error="prepareError"
      />

      <AddDeviceAppleLoginForm
        v-model:apple-id="appleId"
        v-model:password="password"
        v-model:skip-sign="skipSign"
        v-model:skip-install="skipInstall"
        :running="running"
        :loading-prepare="loadingPrepare"
        @submit="startPipeline()"
        @back="props.onBack?.()"
        @skip-install="startSkipInstallPipeline"
      />

      <div v-if="pipelineError || isFailed" class="apple-panel__result is-fail">
        <Icon icon="lucide:alert-circle" />
        <span>{{ pipelineError || pipelineJob?.message }}</span>
      </div>

      <section v-if="pipelineLogsText" class="apple-wizard__card">
        <h3>{{ t("devices.addDeviceModal.apple.pipeline.logsTitle") }}</h3>
        <pre class="apple-wizard__logs">{{ pipelineLogsText }}</pre>
      </section>

      <div v-if="isCompleted" class="apple-panel__result is-ok">
        <Icon icon="lucide:check-circle-2" />
        <span>{{ pipelineJob?.message || t("devices.addDeviceModal.apple.pipeline.completed") }}</span>
      </div>
    </div>
  </div>
</template>
