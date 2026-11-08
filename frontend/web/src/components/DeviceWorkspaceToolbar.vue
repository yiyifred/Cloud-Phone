<script setup>
import AppIcon from "./AppIcon.vue";

defineProps({
  actions: {
    type: Array,
    required: true,
  },
  volumeSubActions: {
    type: Array,
    required: true,
  },
  volumeMenuOpen: {
    type: Boolean,
    required: true,
  },
  isVolumeMenuAction: {
    type: Function,
    required: true,
  },
  actionLabel: {
    type: Function,
    required: true,
  },
  actionIcon: {
    type: Function,
    required: true,
  },
  actionTitle: {
    type: Function,
    required: true,
  },
  isActionDisabled: {
    type: Function,
    required: true,
  },
  usesPressHold: {
    type: Function,
    required: true,
  },
  isActionPressed: {
    type: Function,
    required: true,
  },
  isActionRecording: {
    type: Function,
    required: true,
  },
  onToolbarPointerDown: {
    type: Function,
    required: true,
  },
  onToolbarPointerUp: {
    type: Function,
    required: true,
  },
  handleToolbarClick: {
    type: Function,
    required: true,
  },
  handleVolumeSubAction: {
    type: Function,
    required: true,
  },
  longHorizontal: {
    type: Boolean,
    required: true,
  },
  floating: {
    type: Boolean,
    default: false,
  },
});
</script>

<template>
  <div
    class="device-workspace-toolbar-layer"
    :class="{ 'device-workspace-toolbar-layer--floating': floating }"
    aria-label="设备控制工具栏"
  >
    <div
      class="device-workspace__toolbar device-workspace-toolbar-layer__toolbar"
      :class="{
        'device-workspace-toolbar-layer__toolbar--docked': !floating,
        'device-workspace-toolbar-layer__toolbar--horizontal': floating && longHorizontal,
        'device-workspace-toolbar-layer__toolbar--vertical': floating && !longHorizontal,
      }"
      role="toolbar"
      aria-label="设备控制"
    >
      <!-- 控制权按钮插槽排在最前：它决定后面这些按键能不能按，先看到状态再动手 -->
      <slot name="lease" />
      <template v-for="action in actions" :key="action.id">
        <div
          v-if="isVolumeMenuAction(action)"
          class="device-workspace__action-anchor device-workspace__action-anchor--volume"
        >
          <button
            type="button"
            class="device-workspace__action"
            :class="{ 'device-workspace__action--menu-open': volumeMenuOpen }"
            :disabled="isActionDisabled(action)"
            :title="actionTitle(action)"
            :aria-expanded="volumeMenuOpen"
            aria-haspopup="true"
            @click="handleToolbarClick(action, $event)"
          >
            <span class="device-workspace__action-icon" aria-hidden="true">
              <AppIcon :name="actionIcon(action)" variant="toolbar" />
            </span>
            <span class="device-workspace__action-label">{{ actionLabel(action) }}</span>
          </button>
          <div
            v-show="volumeMenuOpen"
            class="device-workspace__volume-menu"
            role="group"
            aria-label="音量调节"
          >
            <button
              v-for="sub in volumeSubActions"
              :key="sub.id"
              type="button"
              class="device-workspace__action device-workspace__action--sub"
              :disabled="isActionDisabled(action)"
              :title="sub.label"
              @click.stop="handleVolumeSubAction(sub)"
            >
              <span class="device-workspace__action-icon" aria-hidden="true">
                <AppIcon :name="sub.icon" variant="toolbar" />
              </span>
              <span class="device-workspace__action-label">{{ sub.label }}</span>
            </button>
          </div>
        </div>
        <button
          v-else
          type="button"
          class="device-workspace__action"
          :class="{
            'device-workspace__action--hold': usesPressHold(action),
            'device-workspace__action--pressed': isActionPressed(action),
            'device-workspace__action--recording': isActionRecording(action),
          }"
          :disabled="isActionDisabled(action)"
          :title="actionTitle(action)"
          @pointerdown="onToolbarPointerDown(action, $event)"
          @pointerup="onToolbarPointerUp(action, $event)"
          @pointercancel="onToolbarPointerUp(action, $event)"
          @click="handleToolbarClick(action, $event)"
        >
          <span class="device-workspace__action-icon" aria-hidden="true">
            <AppIcon :name="actionIcon(action)" variant="toolbar" />
          </span>
          <span class="device-workspace__action-label">{{ actionLabel(action) }}</span>
        </button>
      </template>
    </div>
  </div>
</template>
