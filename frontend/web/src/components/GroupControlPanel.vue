<script setup>
import { computed, ref, toRef, watch } from "vue";

import { useI18n } from "vue-i18n";

import "../assets/group-control.css";

import { useGroupControlBatch } from "../composables/useGroupControlBatch.js";

import GroupControlActionBar from "./GroupControlActionBar.vue";
import GroupControlAppBatchModal from "./GroupControlAppBatchModal.vue";
import GroupControlDevicePickerModal from "./GroupControlDevicePickerModal.vue";
import GroupControlMasterModal from "./GroupControlMasterModal.vue";
import GroupControlResultModal from "./GroupControlResultModal.vue";
import GroupControlDeviceGrid from "./group-control/GroupControlDeviceGrid.vue";
import GroupControlHeaderActions from "./group-control/GroupControlHeaderActions.vue";
import { useGroupControlSelection } from "./group-control/useGroupControlSelection.js";
import PageHeader from "./ui/PageHeader.vue";
import PanelAlert from "./ui/PanelAlert.vue";

const props = defineProps({
  devices: {
    type: Array,
    required: true,
  },
  loading: {
    type: Boolean,
    default: false,
  },
  error: {
    type: String,
    default: "",
  },
  screenshotUrl: {
    type: Function,
    required: true,
  },
});

const emit = defineEmits(["refresh"]);

const { t } = useI18n();

const showPicker = ref(false);
const appBusy = ref(false);

// 网格/勾选状态机在 composable 里（T-430 拆分），实例仍属于本组件
const devicesRef = toRef(props, "devices");
const {
  gridSerials,
  activeSerials,
  gridDevices,
  activeDevices,
  handleConfirmGridSelection,
  toggleDeviceActive,
  selectAllActive,
  deselectAllActive,
  isDeviceActive,
} = useGroupControlSelection(devicesRef);

const showEmptyState = computed(() => !gridDevices.value.length && !props.loading && !props.error);

const {
  batchMode,
  masterSerial,
  showAppModal,
  showMasterModal,
  showResultModal,
  resultTitle,
  resultLines,
  registerSlot,
  broadcastNavigation,
  stopBatchMode,
  startBatchMode,
  handleControlRelay,
  getBatchRole,
  showResults,
  runBatchInstall,
  runBatchUninstall,
} = useGroupControlBatch({ activeDevicesRef: activeDevices });

function formatResultLine(line) {
  const key = `groupControl.resultModal.${line.kind}`;
  const base = t(key);

  if (line.detail) {
    return `${base}：${line.detail}`;
  }

  return base;
}

function showBatchResults(titleKey, lines) {
  showResults(
    t(titleKey),
    lines.map((line) => ({
      serial: line.serial,
      ok: line.ok,
      message: formatResultLine(line),
    })),
  );
}

async function handleBatchInstall(file) {
  appBusy.value = true;

  try {
    const lines = await runBatchInstall(file);
    showAppModal.value = false;
    showBatchResults("groupControl.resultModal.installTitle", lines);
  } finally {
    appBusy.value = false;
  }
}

async function handleBatchUninstall(packageName) {
  appBusy.value = true;

  try {
    const lines = await runBatchUninstall(packageName);
    showAppModal.value = false;
    showBatchResults("groupControl.resultModal.uninstallTitle", lines);
  } finally {
    appBusy.value = false;
  }
}

function handleConfirmPicker(serials) {
  handleConfirmGridSelection(serials);
  showPicker.value = false;
}

// 没有勾选任何设备时批量模式无法进行；主控设备被取消勾选也要退出批量模式
watch(activeSerials, (serials) => {
  if (!serials.length) {
    stopBatchMode();
    return;
  }

  if (batchMode.value && !serials.includes(masterSerial.value)) {
    stopBatchMode();
  }
});
</script>

<template>
  <section class="group-control-view">
    <PageHeader
      :eyebrow="t('groupControl.eyebrow')"
      :title="t('groupControl.title')"
      :help="t('groupControl.desc')"
    >
      <template #actions>
        <GroupControlHeaderActions
          :has-grid="Boolean(gridDevices.length)"
          :active-count="activeSerials.length"
          @select-all="selectAllActive"
          @deselect-all="deselectAllActive"
          @request-picker="showPicker = true"
        />
      </template>
    </PageHeader>

    <GroupControlActionBar
      v-if="activeSerials.length"
      :batch-mode="batchMode"
      @power="broadcastNavigation"
      @volume="broadcastNavigation"
      @open-apps="showAppModal = true"
      @open-batch="showMasterModal = true"
      @stop-batch="stopBatchMode"
    />

    <PanelAlert
      v-if="error"
      type="error"
      :message="error"
      :action-label="t('common.retry')"
      @action="emit('refresh')"
    />

    <div v-if="showEmptyState" class="empty-state">
      <p>{{ t("groupControl.empty") }}</p>
      <span>{{ t("groupControl.emptyHint") }}</span>
    </div>

    <GroupControlDeviceGrid
      v-else-if="gridDevices.length"
      :devices="gridDevices"
      :batch-mode="batchMode"
      :screenshot-url="screenshotUrl"
      :is-device-active="isDeviceActive"
      :get-batch-role="getBatchRole"
      :register-slot="registerSlot"
      @toggle-select="toggleDeviceActive"
      @control-relay="handleControlRelay"
    />

    <GroupControlDevicePickerModal
      v-if="showPicker"
      :devices="devices"
      :selected-serials="gridSerials"
      :screenshot-url="screenshotUrl"
      @close="showPicker = false"
      @confirm="handleConfirmPicker"
    />

    <GroupControlAppBatchModal
      v-if="showAppModal"
      :device-count="activeDevices.length"
      :busy="appBusy"
      @close="showAppModal = false"
      @install="handleBatchInstall"
      @uninstall="handleBatchUninstall"
    />

    <GroupControlMasterModal
      v-if="showMasterModal"
      :devices="activeDevices"
      :screenshot-url="screenshotUrl"
      @close="showMasterModal = false"
      @confirm="startBatchMode"
    />

    <GroupControlResultModal
      v-if="showResultModal"
      :title="resultTitle"
      :lines="resultLines"
      @close="showResultModal = false"
    />
  </section>
</template>
