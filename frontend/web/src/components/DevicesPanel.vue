<script setup>
import { computed, ref, watch } from "vue";
import { useI18n } from "vue-i18n";
import { MonitorSmartphone } from "lucide-vue-next";

import AddDeviceModal from "./AddDeviceModal.vue";
import AppIcon from "./AppIcon.vue";
import DeviceCard from "./DeviceCard.vue";
import DeviceGalleryContextMenu from "./DeviceGalleryContextMenu.vue";
import EmptyState from "./ui/EmptyState.vue";
import PageHeader from "./ui/PageHeader.vue";
import PanelAlert from "./ui/PanelAlert.vue";
import SkeletonCard from "./ui/SkeletonCard.vue";
import { useAppFeedback } from "../composables/useAppFeedback.js";
import { getErrorMessage } from "../utils/api.js";
import { disconnectWirelessDevice } from "../utils/devices-api.js";
import { formatRefreshTime, summarizeDevices } from "../utils/device-format.js";
import { logInfo } from "../utils/app-event-logger.js";

const props = defineProps({
  devices: {
    type: Array,
    required: true,
  },
  loading: {
    type: Boolean,
    required: true,
  },
  error: {
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
});

const emit = defineEmits(["refresh", "open-device"]);

const { t } = useI18n();
const feedback = useAppFeedback();
const showAddDeviceModal = ref(false);
const contextMenu = ref(null);
const actionFeedback = ref("");

const summary = computed(() => summarizeDevices(props.devices));
const refreshLabel = computed(() => formatRefreshTime(props.lastRefreshedAt));
const showEmptyState = computed(
  () => !props.devices.length && !props.loading && !props.error,
);
// 首屏加载（无任何数据可展示）时用骨架卡占位：既有内容尺寸提示，
// 也避免空白面板在数据回来时突然撑开造成跳版
const showSkeleton = computed(() => Boolean(props.loading) && !props.devices.length && !props.error);
const statusText = computed(() => {
  if (props.loading && !props.devices.length) {
    return t("devices.loading");
  }

  if (!props.devices.length) {
    return t("devices.empty");
  }

  return t("devices.onlineSummary", {
    online: summary.value.online,
    total: summary.value.total,
  });
});

watch(actionFeedback, (message) => {
  if (message) {
    feedback.info(message);
  }
});

function openContextMenu(payload) {
  actionFeedback.value = "";
  contextMenu.value = payload;
}

function closeContextMenu() {
  contextMenu.value = null;
}

function handleViewDeviceDetails() {
  const device = contextMenu.value?.device;
  closeContextMenu();

  if (device) {
    emit("open-device", device);
  }
}

function handleRefreshDevices() {
  logInfo("device", "devices.refresh", "刷新设备列表");
  emit("refresh");
}

async function handleDisconnectDevice() {
  const device = contextMenu.value?.device;
  closeContextMenu();

  if (!device?.serial) {
    return;
  }

  const confirmed = window.confirm(
    t("devices.contextMenu.disconnectConfirm", { name: device.displayName }),
  );

  if (!confirmed) {
    return;
  }

  actionFeedback.value = "";

  try {
    await disconnectWirelessDevice(device.serial);
    actionFeedback.value = t("devices.contextMenu.disconnectSuccess", {
      name: device.displayName,
    });
    logInfo("device", "devices.disconnect", `断开无线设备：${device.displayName}`, {
      deviceSerial: device.serial,
      deviceName: device.displayName,
    });
    handleRefreshDevices();
  } catch (error) {
    actionFeedback.value = getErrorMessage(error, t("devices.contextMenu.disconnectFailed"));
  }
}
</script>

<template>
  <section class="devices-view">
    <PageHeader
      :eyebrow="t('devices.eyebrow')"
      :title="t('devices.title')"
      :help="t('devices.desc')"
      :meta="t('devices.lastUpdate', { time: refreshLabel })"
    >
      <template #actions>
        <span class="status-pill">{{ statusText }}</span>
        <button
          type="button"
          class="panel-header__add-device"
          :aria-label="t('devices.addDevice')"
          :title="t('devices.addDevice')"
          @click="showAddDeviceModal = true"
        >
          <AppIcon name="plus" />
        </button>
      </template>
    </PageHeader>

    <PanelAlert
      v-if="error"
      type="error"
      :message="error"
      :action-label="t('common.retry')"
      @action="handleRefreshDevices"
    />

    <PanelAlert
      v-if="summary.offline > 0"
      type="warning"
      :message="t('devices.offlineHint', { count: summary.offline })"
    />

    <SkeletonCard
      v-if="showSkeleton"
      :count="6"
      height="14rem"
      :label="t('devices.loading')"
    />

    <EmptyState
      v-else-if="showEmptyState"
      :icon="MonitorSmartphone"
      :title="t('devices.notFound')"
      :description="t('devices.connectHint')"
      :action-label="t('devices.addDevice')"
      @action="showAddDeviceModal = true"
    />

    <div v-else-if="devices.length" class="devices-view__gallery-wrap">
      <div class="device-gallery">
        <DeviceCard
          v-for="device in devices"
          :key="device.serial"
          :device="device"
          :screenshot-url="screenshotUrl(device.serial)"
          @open="emit('open-device', $event)"
          @contextmenu="openContextMenu"
        />
      </div>
    </div>

    <DeviceGalleryContextMenu
      :open="Boolean(contextMenu)"
      :x="contextMenu?.x ?? 0"
      :y="contextMenu?.y ?? 0"
      :device="contextMenu?.device ?? null"
      @close="closeContextMenu"
      @view-details="handleViewDeviceDetails"
      @disconnect="handleDisconnectDevice"
    />

    <AddDeviceModal
      v-if="showAddDeviceModal"
      :devices="devices"
      @close="showAddDeviceModal = false"
    />
  </section>
</template>
