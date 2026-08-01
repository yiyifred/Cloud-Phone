<script setup>
import { onBeforeUnmount, onMounted, ref, watch } from "vue";

import MultiAppWindow from "./MultiAppWindow.vue";
import MultiAppWindowStream from "./MultiAppWindowStream.vue";
import WindowsTaskbar from "./WindowsTaskbar.vue";
import IconHelperGatePanel from "../IconHelperGatePanel.vue";
import { useMultiAppIconWarm } from "../../composables/useMultiAppIconWarm.js";
import { useMultiAppWindows } from "../../composables/useMultiAppWindows.js";
import { fetchAppOrientation, forceStopDeviceApp, stopDeviceApp } from "../../utils/device-apps-api.js";
import {
  isBrowserFullscreenFor,
  toggleBrowserFullscreen,
} from "../../utils/browser-fullscreen.js";

const props = defineProps({
  device: {
    type: Object,
    required: true,
  },
});

const emit = defineEmits(["switch-mirror", "fullscreen-change"]);

const {
  consentDialogOpen,
  phase,
  progress,
  progressPercent,
  showProgressUi,
  answerConsent,
} = useMultiAppIconWarm(() => props.device?.serial || "");

const desktopRef = ref(null);
const canvasSize = ref({ width: 1280, height: 720 });
const isDesktopFullscreen = ref(false);
/** @type {import("vue").Ref<Record<string, object>>} */
const streamRefs = ref({});

const {
  windows,
  focusedId,
  taskbarWindows,
  openOrFocusApp,
  focusWindow,
  minimizeWindow,
  toggleMaximizeWindow,
  closeWindow,
  updateWindowBounds,
  getContentSize,
  TITLE_BAR_H,
  MIN_W,
  MIN_H,
} = useMultiAppWindows();

let desktopObserver = null;

function measureDesktop() {
  const el = desktopRef.value;
  if (!el) {
    return;
  }
  canvasSize.value = {
    width: el.clientWidth || 1280,
    height: el.clientHeight || 720,
  };
}

function setStreamRef(id, el) {
  if (el) {
    streamRefs.value[id] = el;
  } else {
    delete streamRefs.value[id];
  }
}

let launchChain = Promise.resolve();

function handleLaunch(app) {
  const serial = String(props.device?.serial || "");
  const packageName = String(app?.packageName || "").trim();
  const desktop = {
    canvasWidth: canvasSize.value.width,
    canvasHeight: canvasSize.value.height,
  };

  // Show the window immediately — do not wait for orientation / cast/start.
  const win = openOrFocusApp({ ...app, orientation: app?.orientation || "portrait" }, desktop);
  if (!serial || !packageName || !win) {
    return;
  }

  // Stagger cast/start work so type-101 does not race on a cold scrcpy process.
  // Orientation can refine bounds after the window is already visible.
  launchChain = launchChain.then(async () => {
    try {
      const result = await fetchAppOrientation(serial, packageName);
      if (result === "landscape" || result === "portrait") {
        if (win.orientation !== result) {
          win.orientation = result;
        }
      }
    } catch {
      // keep default
    }
    await new Promise((resolve) => setTimeout(resolve, 400));
  });
}

function handleFocus(id) {
  focusWindow(id);
}

function handleMinimize(id) {
  minimizeWindow(id);
}

function handleMaximize(id) {
  toggleMaximizeWindow(id, {
    canvasWidth: canvasSize.value.width,
    canvasHeight: canvasSize.value.height,
  });
}

function handleClose(id) {
  const win = windows.value.find((item) => item.id === id);
  if (!win || win.closing) {
    return;
  }
  const serial = String(props.device?.serial || "").trim();
  const packageName = String(win.packageName || "").trim();
  // Hide UI immediately; keep cast/VD mounted until the device app is stopped
  // (noVdDestroyContent would otherwise move the app onto the tablet).
  win.closing = true;
  if (focusedId.value === id) {
    const next = [...windows.value]
      .filter((item) => !item.minimized && !item.closing && item.id !== id)
      .sort((a, b) => b.zIndex - a.zIndex)[0];
    focusedId.value = next?.id || "";
  }
  void (async () => {
    if (serial && packageName) {
      try {
        await stopDeviceApp(serial, packageName);
      } catch {
        try {
          await forceStopDeviceApp(serial, packageName);
        } catch {
          // Still tear down even if stop fails.
        }
      }
    }
    closeWindow(id);
  })();
}

function handleMove(id, bounds) {
  updateWindowBounds(id, bounds);
}

function handleResize(id, bounds) {
  updateWindowBounds(id, bounds);
}

function handleBack(id) {
  streamRefs.value[id]?.sendBack?.();
}

function getWorkspaceEl() {
  return (
    desktopRef.value?.closest?.(".device-workspace") ||
    document.querySelector(".device-workspace") ||
    null
  );
}

function syncDesktopFullscreen() {
  const workspaceEl = getWorkspaceEl();
  const next = isBrowserFullscreenFor(workspaceEl);
  if (isDesktopFullscreen.value === next) {
    return;
  }
  isDesktopFullscreen.value = next;
  emit("fullscreen-change", next);
}

/** Fallback if Start menu did not fire; prefer Start menu pointerdown path. */
function toggleDesktopFullscreen() {
  const workspaceEl = getWorkspaceEl();
  void toggleBrowserFullscreen(workspaceEl || document.documentElement);
}

function contentSize(win) {
  return getContentSize(win);
}

onMounted(() => {
  measureDesktop();
  desktopObserver = new ResizeObserver(() => measureDesktop());
  if (desktopRef.value) {
    desktopObserver.observe(desktopRef.value);
  }
  document.addEventListener("fullscreenchange", syncDesktopFullscreen);
  syncDesktopFullscreen();
});

onBeforeUnmount(() => {
  desktopObserver?.disconnect();
  document.removeEventListener("fullscreenchange", syncDesktopFullscreen);
});

watch(
  () => props.device?.serial,
  () => measureDesktop(),
);
</script>

<template>
  <div class="multi-app-desktop">
    <div class="multi-app-desktop__wallpaper" aria-hidden="true" />

    <div ref="desktopRef" class="multi-app-desktop__canvas" aria-label="Windows 桌面">
      <MultiAppWindow
        v-for="win in windows"
        v-show="!win.closing"
        :key="win.id"
        :window="win"
        :focused="focusedId === win.id"
        :title-bar-height="TITLE_BAR_H"
        :min-width="MIN_W"
        :min-height="MIN_H"
        @focus="handleFocus(win.id)"
        @back="handleBack(win.id)"
        @minimize="handleMinimize(win.id)"
        @maximize="handleMaximize(win.id)"
        @close="handleClose(win.id)"
        @move="handleMove(win.id, $event)"
        @resize="handleResize(win.id, $event)"
      >
        <MultiAppWindowStream
          :ref="(el) => setStreamRef(win.id, el)"
          :device="device"
          :window="win"
          :focused="focusedId === win.id"
          :content-width="contentSize(win).width"
          :content-height="contentSize(win).height"
          @close-window="handleClose(win.id)"
          @switch-mirror="emit('switch-mirror')"
        />
      </MultiAppWindow>
    </div>

    <WindowsTaskbar
      :serial="device.serial"
      :windows="taskbarWindows"
      :focused-id="focusedId"
      :is-fullscreen="isDesktopFullscreen"
      @launch="handleLaunch"
      @focus-window="handleFocus"
      @toggle-fullscreen="toggleDesktopFullscreen"
    />

    <IconHelperGatePanel
      :consent-open="consentDialogOpen"
      :busy="showProgressUi"
      :progress-percent="progressPercent"
      :progress-label="phase === 'ensuring' ? '正在连接 Icon Helper…' : '正在提取应用图标…'"
      :current-package="progress.current"
      :denied-hint="false"
      @allow="answerConsent(true)"
      @deny="answerConsent(false)"
    />
  </div>
</template>
