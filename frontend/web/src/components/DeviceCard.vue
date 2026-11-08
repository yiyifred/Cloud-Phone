<script setup>
import { computed, onBeforeUnmount, onMounted, ref, watch } from "vue";
import { useI18n } from "vue-i18n";

import AppIcon from "./AppIcon.vue";
import {
  formatAndroidVersion,
  formatManufacturerLine,
  getDeviceStateLabel,
} from "../utils/device-format.js";
import { fetchEncryptedBinary } from "../utils/api.js";
import { runScreenshotTask } from "../utils/device-screenshot-queue.js";

const props = defineProps({
  device: {
    type: Object,
    required: true,
  },
  screenshotUrl: {
    type: String,
    required: true,
  },
});

const emit = defineEmits(["open", "contextmenu"]);

const { t } = useI18n();
const cardRef = ref(null);
const isInView = ref(false);

function handleOpen() {
  emit("open", props.device);
}

function handleContextMenu(event) {
  event.preventDefault();
  emit("contextmenu", {
    device: props.device,
    x: event.clientX,
    y: event.clientY,
  });
}

function handleKeydown(event) {
  if (event.key === "Enter" || event.key === " ") {
    event.preventDefault();
    handleOpen();
  }
}

const displaySrc = ref("");
const screenshotFailed = ref(false);
let screenshotObjectUrl = "";
let screenshotRequestId = 0;
let visibilityObserver = null;

const manufacturerLine = computed(() => formatManufacturerLine(props.device));
const androidLine = computed(() => formatAndroidVersion(props.device));
const stateLabel = computed(() => getDeviceStateLabel(props.device.state));

const screenshotAlt = computed(() =>
  t("devices.screenshotAlt", { name: props.device.displayName }),
);

function revokeScreenshotObjectUrl() {
  if (screenshotObjectUrl) {
    URL.revokeObjectURL(screenshotObjectUrl);
    screenshotObjectUrl = "";
  }
}

async function preloadScreenshot(url) {
  const requestId = ++screenshotRequestId;

  if (!url || !props.device.connected || !isInView.value) {
    return;
  }

  screenshotFailed.value = false;

  try {
    const blob = await runScreenshotTask(() =>
      fetchEncryptedBinary(url, { mime: "image/png" }),
    );

    if (requestId !== screenshotRequestId) {
      return;
    }

    revokeScreenshotObjectUrl();
    screenshotObjectUrl = URL.createObjectURL(blob);
    displaySrc.value = screenshotObjectUrl;
  } catch {
    if (requestId === screenshotRequestId && !displaySrc.value) {
      screenshotFailed.value = true;
    }
  }
}

function queueScreenshotLoad() {
  if (!props.device.connected || !isInView.value) {
    return;
  }

  void preloadScreenshot(props.screenshotUrl);
}

onMounted(() => {
  const element = cardRef.value;

  if (!element || typeof IntersectionObserver === "undefined") {
    isInView.value = true;
    queueScreenshotLoad();
    return;
  }

  visibilityObserver = new IntersectionObserver(
    (entries) => {
      const visible = entries.some((entry) => entry.isIntersecting);
      isInView.value = visible;

      if (visible) {
        queueScreenshotLoad();
      }
    },
    { root: null, rootMargin: "160px", threshold: 0 },
  );

  visibilityObserver.observe(element);
});

onBeforeUnmount(() => {
  screenshotRequestId += 1;
  visibilityObserver?.disconnect();
  visibilityObserver = null;
  revokeScreenshotObjectUrl();
});

watch(
  () => props.screenshotUrl,
  () => {
    queueScreenshotLoad();
  },
);

watch(
  () => props.device.connected,
  (connected) => {
    if (!connected) {
      screenshotRequestId += 1;
      displaySrc.value = "";
      screenshotFailed.value = false;
      revokeScreenshotObjectUrl();
      return;
    }

    queueScreenshotLoad();
  },
);

watch(isInView, (visible) => {
  if (visible) {
    queueScreenshotLoad();
  }
});
</script>

<template>
  <article
    ref="cardRef"
    class="device-card device-card--clickable"
    :class="{ 'device-card--offline': !device.connected }"
    role="button"
    tabindex="0"
    @click="handleOpen"
    @contextmenu="handleContextMenu"
    @keydown="handleKeydown"
  >
    <div class="device-card__preview">
      <img
        v-if="device.connected && displaySrc && !screenshotFailed"
        :src="displaySrc"
        :alt="screenshotAlt"
        decoding="async"
        loading="lazy"
      />
      <div
        v-else-if="device.connected && screenshotFailed && !displaySrc"
        class="device-card__placeholder"
      >
        <AppIcon name="phone" />
        <span>{{ t("devices.screenshotFailed") }}</span>
      </div>
      <div v-else class="device-card__placeholder">
        <AppIcon name="phone" />
        <span>{{
          device.connected ? t("devices.waitingScreenshot") : t("devices.deviceOffline")
        }}</span>
      </div>
      <span
        class="device-card__status"
        :class="device.connected ? 'device-card__status--online' : 'device-card__status--offline'"
      >
        {{ stateLabel }}
      </span>
    </div>

    <div class="device-card__meta">
      <div class="device-card__title">
        <strong>{{ device.displayName }}</strong>
        <span v-if="manufacturerLine" class="device-card__subtitle">{{ manufacturerLine }}</span>
      </div>

      <dl class="device-card__facts">
        <div>
          <dt>{{ t("devices.ip") }}</dt>
          <dd>{{ device.ipAddress || "—" }}</dd>
        </div>
        <div v-if="device.product || device.device">
          <dt>{{ t("devices.product") }}</dt>
          <dd>{{ [device.product, device.device].filter(Boolean).join(" · ") }}</dd>
        </div>
        <div>
          <dt>{{ t("devices.system") }}</dt>
          <dd>{{ androidLine || "—" }}</dd>
        </div>
        <div>
          <dt>{{ t("devices.serial") }}</dt>
          <dd class="device-card__mono">{{ device.serial }}</dd>
        </div>
        <div>
          <dt>{{ t("devices.adbState") }}</dt>
          <dd>{{ stateLabel }}</dd>
        </div>
      </dl>
    </div>
  </article>
</template>
