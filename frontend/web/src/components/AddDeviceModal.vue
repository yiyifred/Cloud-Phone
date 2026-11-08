<script setup>
import { computed, ref } from "vue";
import QRCode from "qrcode";
import { useI18n } from "vue-i18n";

import "../assets/add-device-modal.css";
import AddDeviceApplePanel from "./AddDeviceApplePanel.vue";
import AddDeviceAndroidDirectPanel from "./AddDeviceAndroidDirectPanel.vue";
import AddDeviceModalHeader from "./add-device/AddDeviceModalHeader.vue";
import AddDevicePairCodeStep from "./add-device/AddDevicePairCodeStep.vue";
import AddDevicePlatformStep from "./add-device/AddDevicePlatformStep.vue";
import AddDeviceQrStep from "./add-device/AddDeviceQrStep.vue";
import AddDeviceUsbStep from "./add-device/AddDeviceUsbStep.vue";
import { buildPairFailure, buildPairResult } from "./add-device/pair-result-message.js";
import { getErrorMessage, requestJson } from "../utils/api.js";

const props = defineProps({
  devices: {
    type: Array,
    default: () => [],
  },
});

const emit = defineEmits(["close"]);

const { t } = useI18n();

const step = ref("platforms"); // platforms | android-usb | android-pair-code | android-qr | android-direct | harmony-usb | apple-connect
const baselineSerials = ref(new Set());
const pairForm = ref({
  host: "",
  port: "",
  pairingCode: "",
});
const pairPending = ref(false);
const pairResult = ref(null);
const qrSession = ref(null);
const qrImageUrl = ref("");
const qrLoading = ref(false);

const currentDevices = computed(() => props.devices ?? []);

// USB 等待页只显示「开始等之后才出现」的设备：进入该步骤时记下基线序号，
// 这样插上线的设备才会冒出来，而不是把画廊里已有的全列一遍。
const trackedDevices = computed(() => {
  if (step.value !== "android-usb" && step.value !== "harmony-usb") {
    return [];
  }

  const platform = step.value === "harmony-usb" ? "harmony" : "android";
  return currentDevices.value.filter(
    (device) =>
      Boolean(device?.serial) &&
      (device.platform ?? "android") === platform &&
      !baselineSerials.value.has(device.serial),
  );
});

const trackedSummary = computed(() => {
  const list = trackedDevices.value;

  return {
    total: list.length,
    connected: list.filter((device) => device?.connected).length,
    unauthorized: list.filter((device) => device?.state === "unauthorized").length,
  };
});

// 进入 USB 等待页时先记快照：只有「此后才出现」的设备算新插入
function enterUsbStep(platform) {
  baselineSerials.value = new Set(
    (currentDevices.value ?? []).map((device) => device?.serial).filter(Boolean),
  );
  step.value = platform === "harmony" ? "harmony-usb" : "android-usb";
}

const enterAndroidUsb = () => enterUsbStep("android");
const enterHarmonyUsb = () => enterUsbStep("harmony");

/** 平台页只抛步骤 id，具体进入动作（是否重置表单 / 是否建二维码会话）由父组件决定 */
function handlePlatformSelect(nextStep) {
  ENTER_STEP[nextStep]?.();
}

// 结果对象与连接提示的拼装放在 add-device/pair-result-message.js（四条路径共用）
function setPairFailure(message) {
  pairResult.value = buildPairFailure(message, t);
}

async function submitPairCode() {
  pairPending.value = true;
  pairResult.value = null;

  try {
    const host = pairForm.value.host.trim();
    const port = Number.parseInt(pairForm.value.port, 10);
    const pairingCode = pairForm.value.pairingCode.trim();

    const result = await requestJson("/api/devices/pair-code", {
      method: "POST",
      allowFailure: true,
      body: { host, port, pairingCode },
    });

    pairResult.value = buildPairResult(result, t);
  } catch (error) {
    setPairFailure(getErrorMessage(error, t("devices.addDeviceModal.pairCode.pairFailed")));
  } finally {
    pairPending.value = false;
  }
}

async function createQrSession() {
  qrLoading.value = true;
  pairResult.value = null;

  try {
    const result = await requestJson("/api/devices/qr-session", {
      method: "POST",
      body: {},
    });
    const session = {
      serviceName: String(result.serviceName ?? ""),
      pairingCode: String(result.pairingCode ?? ""),
      qrPayload: String(result.qrPayload ?? ""),
    };

    if (!session.serviceName || !session.pairingCode || !session.qrPayload) {
      throw new Error(t("devices.addDeviceModal.qr.invalid"));
    }

    qrSession.value = session;
    qrImageUrl.value = await QRCode.toDataURL(session.qrPayload, {
      margin: 1,
      width: 240,
    });
  } catch (error) {
    qrSession.value = null;
    qrImageUrl.value = "";
    setPairFailure(getErrorMessage(error, t("devices.addDeviceModal.qr.createFailed")));
  } finally {
    qrLoading.value = false;
  }
}

async function submitQrPairing() {
  if (!qrSession.value) {
    setPairFailure(t("devices.addDeviceModal.qr.createFailed"));
    return;
  }

  pairPending.value = true;
  pairResult.value = null;

  try {
    const result = await requestJson("/api/devices/pair-qr", {
      method: "POST",
      allowFailure: true,
      body: {
        serviceName: qrSession.value.serviceName,
        pairingCode: qrSession.value.pairingCode,
      },
    });

    pairResult.value = buildPairResult(result, t);
  } catch (error) {
    setPairFailure(getErrorMessage(error, t("devices.addDeviceModal.pairCode.pairFailed")));
  } finally {
    pairPending.value = false;
  }
}

function enterDirectConnectStep() {
  step.value = "android-direct";
  pairResult.value = null;
}

function enterPairCodeStep() {
  step.value = "android-pair-code";
  pairResult.value = null;
}

function enterQrStep() {
  step.value = "android-qr";
  qrSession.value = null;
  qrImageUrl.value = "";
  pairResult.value = null;
  createQrSession();
}

function enterAppleConnect() {
  step.value = "apple-connect";
  pairResult.value = null;
}

function backToPlatforms() {
  step.value = "platforms";
}

// 平台页抛的是步骤 id，这里维护 id → 进入动作的唯一映射
const ENTER_STEP = {
  "android-usb": enterAndroidUsb,
  "harmony-usb": enterHarmonyUsb,
  "android-pair-code": enterPairCodeStep,
  "android-qr": enterQrStep,
  "android-direct": enterDirectConnectStep,
  "apple-connect": enterAppleConnect,
};
</script>

<template>
  <div class="modal-layer" @click.self="emit('close')">
    <section
      class="add-device-modal"
      :class="{ 'add-device-modal--wide': step === 'apple-connect' }"
      role="dialog"
      aria-modal="true"
      :aria-label="t('devices.addDeviceModal.title')"
    >
      <AddDeviceModalHeader :step="step" @close="emit('close')" />

      <AddDevicePlatformStep v-if="step === 'platforms'" @select="handlePlatformSelect" />

      <AddDeviceApplePanel
        v-else-if="step === 'apple-connect'"
        :on-back="backToPlatforms"
        :on-connected="() => emit('close')"
      />

      <AddDeviceUsbStep
        v-else-if="step === 'harmony-usb'"
        variant="harmony"
        :devices="trackedDevices"
        :summary="trackedSummary"
        @back="backToPlatforms"
        @done="emit('close')"
      />

      <AddDeviceUsbStep
        v-else-if="step === 'android-usb'"
        variant="android"
        :devices="trackedDevices"
        :summary="trackedSummary"
        @back="backToPlatforms"
        @done="emit('close')"
      />

      <AddDeviceAndroidDirectPanel
        v-else-if="step === 'android-direct'"
        :on-back="backToPlatforms"
        :on-connected="() => emit('close')"
      />

      <AddDevicePairCodeStep
        v-else-if="step === 'android-pair-code'"
        :form="pairForm"
        :pending="pairPending"
        :result="pairResult"
        @submit="submitPairCode"
        @back="backToPlatforms"
      />

      <AddDeviceQrStep
        v-else-if="step === 'android-qr'"
        :image-url="qrImageUrl"
        :loading="qrLoading"
        :session="qrSession"
        :pending="pairPending"
        :result="pairResult"
        @back="backToPlatforms"
        @refresh="createQrSession"
        @confirm="submitQrPairing"
      />
    </section>
  </div>
</template>
