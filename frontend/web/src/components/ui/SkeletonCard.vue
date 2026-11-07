<script setup>
import { computed } from "vue";

/**
 * 骨架卡：纯 CSS shimmer（不引入依赖），用于首屏/加载态占位。
 * count > 1 时按设备画廊同样的网格自适应排列，避免加载完成瞬间布局跳动。
 */
const props = defineProps({
  count: {
    type: Number,
    default: 1,
  },
  height: {
    type: [String, Number],
    default: "14rem",
  },
  /** 读屏提示文案（可选），卡片本身 aria-hidden */
  label: {
    type: String,
    default: "",
  },
});

const cardCount = computed(() => Math.max(1, Math.floor(Number(props.count) || 1)));

const cardStyle = computed(() => ({
  "--skeleton-card-height":
    typeof props.height === "number" ? `${props.height}px` : props.height || "14rem",
}));
</script>

<template>
  <div
    class="skeleton-grid"
    role="status"
    aria-busy="true"
    :aria-label="label || undefined"
  >
    <div
      v-for="index in cardCount"
      :key="index"
      class="skeleton-card"
      :style="cardStyle"
      aria-hidden="true"
    >
      <span class="skeleton-card__media" />
      <span class="skeleton-card__line skeleton-card__line--wide" />
      <span class="skeleton-card__line skeleton-card__line--narrow" />
    </div>
  </div>
</template>
