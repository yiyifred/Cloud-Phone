<script setup>
/**
 * 群控页头部的选择操作区（T-430 从 GroupControlPanel 抽出）。
 * 只负责展示计数与三个按钮，勾选状态仍由父组件持有，通过事件回传意图。
 */
import { useI18n } from "vue-i18n";

import AppIcon from "../AppIcon.vue";
import UiButton from "../ui/UiButton.vue";

const props = defineProps({
  // 网格里是否有设备：没有设备时不摆「全选/反选/加号」，与拆分前一致
  hasGrid: {
    type: Boolean,
    default: false,
  },
  activeCount: {
    type: Number,
    default: 0,
  },
});

const emit = defineEmits(["select-all", "deselect-all", "request-picker"]);

const { t } = useI18n();
</script>

<template>
  <span v-if="props.hasGrid" class="status-pill">
    {{ t("groupControl.deviceCount", { count: props.activeCount }) }}
  </span>
  <template v-if="props.hasGrid">
    <UiButton variant="ghost" size="small" @click="emit('select-all')">
      {{ t("groupControl.selectAll") }}
    </UiButton>
    <UiButton variant="ghost" size="small" @click="emit('deselect-all')">
      {{ t("groupControl.deselectAll") }}
    </UiButton>
  </template>
  <button
    type="button"
    class="panel-header__add-device"
    :aria-label="t('groupControl.addDevice')"
    :title="t('groupControl.addDevice')"
    @click="emit('request-picker')"
  >
    <AppIcon name="plus" />
  </button>
</template>
