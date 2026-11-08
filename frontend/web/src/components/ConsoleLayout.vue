<script setup>
import { computed } from "vue";

import AppSidebar from "./AppSidebar.vue";
import DeviceWorkspace from "./DeviceWorkspace.vue";
import DevicesPanel from "./DevicesPanel.vue";
import GroupControlPanel from "./GroupControlPanel.vue";
import LogsPanel from "./LogsPanel.vue";
import MobileBottomNav from "./MobileBottomNav.vue";
import SettingsPanel from "./SettingsPanel.vue";
import { useMobileLayout } from "../composables/useMobileLayout.js";
import { logInfo } from "../utils/app-event-logger.js";

const props = defineProps({
  devices: {
    type: Array,
    required: true,
  },
  deviceLoading: {
    type: Boolean,
    required: true,
  },
  deviceError: {
    type: String,
    required: true,
  },
  lastRefreshedAt: {
    type: String,
    default: null,
  },
  adbPath: {
    type: String,
    default: "",
  },
  screenshotUrl: {
    type: Function,
    required: true,
  },
  settingsForm: {
    type: Object,
    required: true,
  },
  passwordStatusText: {
    type: String,
    required: true,
  },
  sessionExpiresAt: {
    type: String,
    default: null,
  },
  // 只读分享访问：所有写入口由各面板按这个标志禁用，壳本身不拦截渲染
  readOnly: {
    type: Boolean,
    default: false,
  },
});

const activeTab = defineModel("activeTab", { type: String, required: true });
const selectedDevice = defineModel("selectedDevice", { type: Object, default: null });
const { isMobileLayout } = useMobileLayout();

// viewer 不能做批量控制（全是往设备发写指令）；浏览器缓存里可能还留着上次的
// 分组 Tab，这里直接落回设备画廊，避免打开一个点不动的页面。
const effectiveTab = computed(() =>
  props.readOnly && activeTab.value === "group-control" ? "devices" : activeTab.value,
);

const workspaceDevice = computed(() => {
  const selected = selectedDevice.value;

  if (!selected?.serial) {
    return selected;
  }

  return props.devices.find((device) => device.serial === selected.serial) ?? selected;
});

const emit = defineEmits(["logout", "save-settings", "refresh-devices", "change-password"]);

function handleOpenDevice(device) {
  logInfo("device", "device.open", `打开设备工作区：${device.displayName ?? device.serial}`, {
    deviceSerial: device.serial,
    deviceName: device.displayName ?? device.serial,
    details: {
      platform: device.platform,
      state: device.state,
      connected: device.connected,
    },
  });
  selectedDevice.value = device;
}

function handleCloseWorkspace() {
  const device = selectedDevice.value;

  if (device?.serial) {
    logInfo("navigation", "workspace.close", `退出设备工作区：${device.displayName ?? device.serial}`, {
      deviceSerial: device.serial,
      deviceName: device.displayName ?? device.serial,
    });
  }

  selectedDevice.value = null;
}

function handleTabChange(tabId) {
  const previousTab = activeTab.value;
  activeTab.value = tabId;

  logInfo("navigation", "tab.change", `切换页面：${previousTab} → ${tabId}`, {
    details: {
      from: previousTab,
      to: tabId,
    },
  });

  if (tabId !== "devices") {
    if (selectedDevice.value?.serial) {
      logInfo("navigation", "workspace.close", `切换 Tab 关闭设备工作区：${selectedDevice.value.displayName ?? selectedDevice.value.serial}`, {
        deviceSerial: selectedDevice.value.serial,
        deviceName: selectedDevice.value.displayName ?? selectedDevice.value.serial,
        details: { reason: "tab-change", tab: tabId },
      });
    }

    selectedDevice.value = null;
  }
}
</script>

<template>
  <div class="console-layout" :class="{ 'console-layout--mobile': isMobileLayout }">
    <AppSidebar
      v-if="!isMobileLayout"
      :active-tab="effectiveTab"
      :read-only="readOnly"
      @update:active-tab="handleTabChange"
      @logout="emit('logout')"
    />
    <main
      class="main-panel"
      :class="{
        'main-panel--workspace': selectedDevice,
        'main-panel--devices': !selectedDevice && effectiveTab === 'devices',
        'main-panel--settings': !selectedDevice && effectiveTab === 'settings',
        'main-panel--group-control': !selectedDevice && effectiveTab === 'group-control',
        'main-panel--logs': !selectedDevice && effectiveTab === 'logs',
      }"
    >
      <DeviceWorkspace
        v-if="workspaceDevice"
        :device="workspaceDevice"
        @close="handleCloseWorkspace"
      />
      <DevicesPanel
        v-else-if="effectiveTab === 'devices'"
        :devices="devices"
        :loading="deviceLoading"
        :error="deviceError"
        :last-refreshed-at="lastRefreshedAt"
        :adb-path="adbPath"
        :screenshot-url="screenshotUrl"
        :read-only="readOnly"
        @refresh="emit('refresh-devices')"
        @open-device="handleOpenDevice"
      />
      <GroupControlPanel
        v-else-if="effectiveTab === 'group-control'"
        :devices="devices"
        :loading="deviceLoading"
        :error="deviceError"
        :screenshot-url="screenshotUrl"
        @refresh="emit('refresh-devices')"
      />
      <LogsPanel v-else-if="effectiveTab === 'logs'" :read-only="readOnly" />
      <SettingsPanel
        v-else-if="effectiveTab === 'settings'"
        :settings-form="settingsForm"
        :password-status-text="passwordStatusText"
        :session-expires-at="sessionExpiresAt"
        :show-logout="isMobileLayout"
        :read-only="readOnly"
        @save="emit('save-settings')"
        @change-password="emit('change-password')"
        @logout="emit('logout')"
      />
    </main>
    <MobileBottomNav
      v-if="isMobileLayout && !workspaceDevice"
      :active-tab="effectiveTab"
      :read-only="readOnly"
      @update:active-tab="handleTabChange"
    />
  </div>
</template>
