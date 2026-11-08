<script setup>
/**
 * 苹果接入向导的进度区（T-433 从 AddDeviceApplePanel 抽出）。
 * 纯展示：步骤状态由 useAppleWdaPipeline 推导后以 props 传入，
 * 这里只负责当前步高亮与图标切换，不再自己判断 pipeline 状态。
 */
import { Icon } from "@iconify/vue";
import { useI18n } from "vue-i18n";

const props = defineProps({
  currentStepIndex: {
    type: Number,
    default: 0,
  },
  overallProgress: {
    type: Number,
    default: 0,
  },
  stepItems: {
    type: Array,
    required: true,
  },
  // 流水线返回的实时文案（可能是后端给出的一步一提示），为空时回落到固定副标题。
  message: {
    type: String,
    default: "",
  },
});

const { t } = useI18n();
</script>

<template>
  <div class="apple-wizard__progress-head">
    <div class="apple-wizard__progress-meta">
      <strong>{{ t("devices.addDeviceModal.apple.pipeline.title") }}</strong>
      <span>{{ props.message || t("devices.addDeviceModal.apple.pipeline.subtitle") }}</span>
    </div>
    <div class="apple-wizard__progress-value">{{ props.overallProgress }}%</div>
  </div>

  <div class="apple-wizard__progress-track" aria-hidden="true">
    <div class="apple-wizard__progress-bar" :style="{ width: `${props.overallProgress}%` }" />
  </div>

  <ol class="apple-wizard__steps">
    <li
      v-for="(step, index) in props.stepItems"
      :key="step.id"
      class="apple-wizard__step"
      :class="[
        `apple-wizard__step--${step.state}`,
        { 'apple-wizard__step--current': index === props.currentStepIndex },
      ]"
    >
      <span class="apple-wizard__step-index">
        <Icon
          v-if="step.state === 'done'"
          icon="lucide:check"
        />
        <Icon
          v-else-if="step.state === 'error'"
          icon="lucide:x"
        />
        <Icon
          v-else-if="step.state === 'active'"
          icon="lucide:loader-circle"
          class="apple-wizard__spin"
        />
        <template v-else>{{ index + 1 }}</template>
      </span>
      <span class="apple-wizard__step-label">{{ step.label }}</span>
    </li>
  </ol>
</template>
