<script setup>
/**
 * 群控设备网格（T-430 从 GroupControlPanel 抽出）。
 * 只负责把每台设备渲染成一个投屏槽位并把勾选/控制中继事件抛回父组件，
 * 勾选集合、批量模式角色都由父组件算好后下发，组件内部不持有状态。
 */
import GroupControlCastSlot from "../GroupControlCastSlot.vue";

const props = defineProps({
  devices: {
    type: Array,
    required: true,
  },
  batchMode: {
    type: Boolean,
    default: false,
  },
  screenshotUrl: {
    type: Function,
    required: true,
  },
  isDeviceActive: {
    type: Function,
    required: true,
  },
  getBatchRole: {
    type: Function,
    required: true,
  },
  registerSlot: {
    type: Function,
    required: true,
  },
});

const emit = defineEmits(["toggle-select", "control-relay"]);

function isActive(serial) {
  return props.isDeviceActive(serial);
}

function batchRoleFor(serial) {
  return props.getBatchRole(serial);
}
</script>

<template>
  <div class="group-control-grid">
    <GroupControlCastSlot
      v-for="device in props.devices"
      :key="device.serial"
      :device="device"
      :selected="isActive(device.serial)"
      :screenshot-url="props.screenshotUrl(device.serial)"
      :batch-mode="props.batchMode"
      :batch-role="batchRoleFor(device.serial)"
      :register-slot="props.registerSlot"
      @toggle-select="emit('toggle-select', device.serial)"
      @control-relay="emit('control-relay', $event)"
    />
  </div>
</template>
