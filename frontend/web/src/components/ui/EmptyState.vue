<script setup>
/**
 * 空态卡片：图标 + 标题 + 描述 + 主操作。
 * 统一各面板的「没有数据」呈现，文案由调用方传 i18n 结果，组件内不持有文案。
 */
defineProps({
  icon: {
    type: [Object, Function],
    default: null,
  },
  title: {
    type: String,
    default: "",
  },
  description: {
    type: String,
    default: "",
  },
  actionLabel: {
    type: String,
    default: "",
  },
});

const emit = defineEmits(["action"]);
</script>

<template>
  <div class="empty-state-card">
    <span v-if="icon" class="empty-state-card__icon" aria-hidden="true">
      <component :is="icon" :size="30" :stroke-width="1.6" />
    </span>
    <h3 v-if="title" class="empty-state-card__title">{{ title }}</h3>
    <p v-if="description" class="empty-state-card__desc">{{ description }}</p>
    <button
      v-if="actionLabel"
      type="button"
      class="empty-state-card__action"
      @click="emit('action')"
    >
      {{ actionLabel }}
    </button>
  </div>
</template>
