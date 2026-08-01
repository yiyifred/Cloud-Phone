<script setup>
import { computed, onBeforeUnmount, ref } from "vue";
import { Icon } from "@iconify/vue";

const props = defineProps({
  window: {
    type: Object,
    required: true,
  },
  focused: {
    type: Boolean,
    default: false,
  },
  titleBarHeight: {
    type: Number,
    default: 36,
  },
  minWidth: {
    type: Number,
    default: 280,
  },
  minHeight: {
    type: Number,
    default: 360,
  },
});

const emit = defineEmits([
  "focus",
  "back",
  "minimize",
  "maximize",
  "close",
  "move",
  "resize",
]);

const rootRef = ref(null);

const style = computed(() => ({
  left: `${props.window.x}px`,
  top: `${props.window.y}px`,
  width: `${props.window.width}px`,
  height: `${props.window.height}px`,
  zIndex: props.window.zIndex,
}));

const displayName = computed(
  () => props.window.label || props.window.packageName || "App",
);

const initials = computed(() =>
  String(displayName.value).trim().slice(0, 1).toUpperCase(),
);

/** @type {{ mode: string, startX: number, startY: number, orig: object } | null} */
let dragState = null;

function onTitlePointerDown(event) {
  if (event.button !== 0 || props.window.maximized) {
    return;
  }
  emit("focus");
  dragState = {
    mode: "move",
    startX: event.clientX,
    startY: event.clientY,
    orig: { x: props.window.x, y: props.window.y },
  };
  window.addEventListener("pointermove", onPointerMove);
  window.addEventListener("pointerup", onPointerUp);
}

/**
 * @param {PointerEvent} event
 * @param {string} edge
 */
function onResizePointerDown(event, edge) {
  if (event.button !== 0 || props.window.maximized) {
    return;
  }
  event.stopPropagation();
  emit("focus");
  dragState = {
    mode: edge,
    startX: event.clientX,
    startY: event.clientY,
    orig: {
      x: props.window.x,
      y: props.window.y,
      width: props.window.width,
      height: props.window.height,
    },
  };
  window.addEventListener("pointermove", onPointerMove);
  window.addEventListener("pointerup", onPointerUp);
}

function onPointerMove(event) {
  if (!dragState) {
    return;
  }

  const dx = event.clientX - dragState.startX;
  const dy = event.clientY - dragState.startY;
  const { orig, mode } = dragState;

  if (mode === "move") {
    emit("move", { x: orig.x + dx, y: orig.y + dy });
    return;
  }

  let x = orig.x;
  let y = orig.y;
  let width = orig.width;
  let height = orig.height;

  if (mode.includes("e")) {
    width = Math.max(props.minWidth, orig.width + dx);
  }
  if (mode.includes("s")) {
    height = Math.max(props.minHeight, orig.height + dy);
  }
  if (mode.includes("w")) {
    width = Math.max(props.minWidth, orig.width - dx);
    x = orig.x + (orig.width - width);
  }
  if (mode.includes("n")) {
    height = Math.max(props.minHeight, orig.height - dy);
    y = orig.y + (orig.height - height);
  }

  emit("resize", { x, y, width, height });
}

function onPointerUp() {
  dragState = null;
  window.removeEventListener("pointermove", onPointerMove);
  window.removeEventListener("pointerup", onPointerUp);
}

onBeforeUnmount(() => {
  onPointerUp();
});
</script>

<template>
  <div
    v-show="!window.minimized"
    ref="rootRef"
    class="win11-window"
    :class="{ 'is-focused': focused, 'is-maximized': window.maximized }"
    :style="style"
    @mousedown="emit('focus')"
  >
    <header
      class="win11-window__titlebar"
      :style="{ height: `${titleBarHeight}px` }"
      @pointerdown="onTitlePointerDown"
      @dblclick="emit('maximize')"
    >
      <div class="win11-window__title-left">
        <button
          type="button"
          class="win11-window__back"
          title="返回"
          @pointerdown.stop
          @click.stop="emit('back')"
          @dblclick.stop
        >
          <Icon icon="lucide:arrow-left" :width="16" :height="16" />
        </button>
        <span class="win11-window__app-icon" aria-hidden="true">
          <img v-if="window.iconDataUrl" :src="window.iconDataUrl" alt="" />
          <span v-else>{{ initials }}</span>
        </span>
        <span class="win11-window__title">{{ displayName }}</span>
      </div>
      <div class="win11-window__title-right">
        <button
          type="button"
          class="win11-window__chrome-btn"
          title="最小化"
          @pointerdown.stop
          @click.stop="emit('minimize')"
          @dblclick.stop
        >
          <Icon icon="lucide:minus" :width="14" :height="14" />
        </button>
        <button
          type="button"
          class="win11-window__chrome-btn"
          :title="window.maximized ? '向下还原' : '最大化'"
          @pointerdown.stop
          @click.stop="emit('maximize')"
          @dblclick.stop
        >
          <Icon
            :icon="window.maximized ? 'lucide:copy' : 'lucide:square'"
            :width="13"
            :height="13"
          />
        </button>
        <button
          type="button"
          class="win11-window__chrome-btn is-close"
          title="关闭"
          @pointerdown.stop
          @click.stop="emit('close')"
          @dblclick.stop
        >
          <Icon icon="lucide:x" :width="14" :height="14" />
        </button>
      </div>
    </header>

    <div class="win11-window__body">
      <slot />
    </div>

    <template v-if="!window.maximized">
      <div class="win11-window__edge is-n" @pointerdown="onResizePointerDown($event, 'n')" />
      <div class="win11-window__edge is-s" @pointerdown="onResizePointerDown($event, 's')" />
      <div class="win11-window__edge is-e" @pointerdown="onResizePointerDown($event, 'e')" />
      <div class="win11-window__edge is-w" @pointerdown="onResizePointerDown($event, 'w')" />
      <div class="win11-window__edge is-ne" @pointerdown="onResizePointerDown($event, 'ne')" />
      <div class="win11-window__edge is-nw" @pointerdown="onResizePointerDown($event, 'nw')" />
      <div class="win11-window__edge is-se" @pointerdown="onResizePointerDown($event, 'se')" />
      <div class="win11-window__edge is-sw" @pointerdown="onResizePointerDown($event, 'sw')" />
    </template>
  </div>
</template>
