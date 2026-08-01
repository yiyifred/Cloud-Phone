import { computed, ref } from "vue";

import {
  TITLE_BAR_H,
  defaultWindowBounds,
  resolveVdFromContent,
  resolveVdSize,
} from "../utils/multi-app-window-layout.js";

let windowSeq = 0;

/**
 * @typedef {{
 *   id: string,
 *   packageName: string,
 *   activity: string,
 *   label: string,
 *   iconDataUrl: string | null,
 *   orientation: "portrait" | "landscape",
 *   vdWidth: number,
 *   vdHeight: number,
 *   vdDpi: number,
 *   x: number,
 *   y: number,
 *   width: number,
 *   height: number,
 *   minimized: boolean,
 *   maximized: boolean,
 *   closing?: boolean,
 *   zIndex: number,
 *   restore: { x: number, y: number, width: number, height: number } | null,
 * }} MultiAppWindowState
 */

const MIN_W = 240;
const MIN_H = 320;

/**
 * Desktop window manager for multi-app mode.
 */
export function useMultiAppWindows() {
  /** @type {import("vue").Ref<MultiAppWindowState[]>} */
  const windows = ref([]);
  const focusedId = ref("");
  let zCounter = 10;

  const focusedWindow = computed(
    () => windows.value.find((item) => item.id === focusedId.value) ?? null,
  );

  const visibleWindows = computed(() =>
    windows.value.filter((item) => !item.minimized),
  );

  const taskbarWindows = computed(() =>
    windows.value.filter((item) => !item.closing),
  );

  /**
   * @param {{ packageName: string, activity?: string, label?: string, iconDataUrl?: string | null, orientation?: "portrait" | "landscape" }} app
   * @param {{ canvasWidth: number, canvasHeight: number }} desktop
   */
  function openOrFocusApp(app, desktop) {
    const packageName = String(app.packageName || "").trim();
    if (!packageName) {
      return null;
    }

    const existing = windows.value.find((item) => item.packageName === packageName);
    if (existing) {
      focusWindow(existing.id);
      if (existing.minimized) {
        existing.minimized = false;
      }
      return existing;
    }

    const orientation = app.orientation === "landscape" ? "landscape" : "portrait";
    const vd = resolveVdSize(orientation);
    const bounds = defaultWindowBounds(
      {
        canvasWidth: desktop.canvasWidth,
        canvasHeight: desktop.canvasHeight,
        windowIndex: windows.value.length,
      },
      orientation,
    );

    /** @type {MultiAppWindowState} */
    const win = {
      id: `win-${++windowSeq}`,
      packageName,
      activity: String(app.activity || ""),
      label: String(app.label || packageName),
      iconDataUrl: app.iconDataUrl || null,
      orientation,
      vdWidth: bounds.vdWidth || vd.width,
      vdHeight: bounds.vdHeight || vd.height,
      vdDpi: bounds.vdDpi || 320,
      x: bounds.x,
      y: bounds.y,
      width: bounds.width,
      height: bounds.height,
      minimized: false,
      maximized: false,
      zIndex: ++zCounter,
      restore: null,
    };

    windows.value = [...windows.value, win];
    focusedId.value = win.id;
    return win;
  }

  /**
   * @param {string} id
   */
  function focusWindow(id) {
    const win = windows.value.find((item) => item.id === id);
    if (!win) {
      return;
    }
    win.zIndex = ++zCounter;
    win.minimized = false;
    focusedId.value = id;
  }

  /**
   * @param {string} id
   */
  function minimizeWindow(id) {
    const win = windows.value.find((item) => item.id === id);
    if (!win) {
      return;
    }
    win.minimized = true;
    if (focusedId.value === id) {
      const next = [...windows.value]
        .filter((item) => !item.minimized && item.id !== id)
        .sort((a, b) => b.zIndex - a.zIndex)[0];
      focusedId.value = next?.id || "";
    }
  }

  /**
   * @param {string} id
   * @param {{ canvasWidth: number, canvasHeight: number }} desktop
   */
  function toggleMaximizeWindow(id, desktop) {
    const win = windows.value.find((item) => item.id === id);
    if (!win) {
      return;
    }

    focusWindow(id);

    if (win.maximized) {
      const restore = win.restore;
      win.maximized = false;
      win.restore = null;
      if (restore) {
        win.x = restore.x;
        win.y = restore.y;
        win.width = restore.width;
        win.height = restore.height;
      }
      syncWindowVdSize(win);
      return;
    }

    win.restore = {
      x: win.x,
      y: win.y,
      width: win.width,
      height: win.height,
    };
    win.maximized = true;
    win.minimized = false;
    win.x = 0;
    win.y = 0;
    win.width = Math.max(MIN_W, desktop.canvasWidth || win.width);
    win.height = Math.max(MIN_H, (desktop.canvasHeight || win.height) - 0);
    syncWindowVdSize(win);
  }

  /**
   * @param {string} id
   */
  function closeWindow(id) {
    windows.value = windows.value.filter((item) => item.id !== id);
    if (focusedId.value === id) {
      const next = [...windows.value]
        .filter((item) => !item.minimized)
        .sort((a, b) => b.zIndex - a.zIndex)[0];
      focusedId.value = next?.id || "";
    }
  }

  /**
   * @param {string} id
   * @param {{ x?: number, y?: number, width?: number, height?: number }} bounds
   */
  function updateWindowBounds(id, bounds) {
    const win = windows.value.find((item) => item.id === id);
    if (!win || win.maximized) {
      return;
    }

    if (typeof bounds.x === "number") {
      win.x = Math.max(0, bounds.x);
    }
    if (typeof bounds.y === "number") {
      win.y = Math.max(0, bounds.y);
    }

    let sized = false;
    if (typeof bounds.width === "number") {
      win.width = Math.max(MIN_W, bounds.width);
      sized = true;
    }
    if (typeof bounds.height === "number") {
      win.height = Math.max(MIN_H, bounds.height);
      sized = true;
    }

    if (sized) {
      syncWindowVdSize(win);
    }
  }

  /**
   * Keep virtual-display target in sync with window content size.
   * @param {MultiAppWindowState} win
   */
  function syncWindowVdSize(win) {
    const content = getContentSize(win);
    const vd = resolveVdFromContent(content.width, content.height);
    win.vdWidth = vd.width;
    win.vdHeight = vd.height;
    win.vdDpi = vd.dpi;
  }

  /**
   * Content area size (excludes title bar) for video layout.
   * @param {MultiAppWindowState} win
   */
  function getContentSize(win) {
    return {
      width: Math.max(1, Math.round(win.width)),
      height: Math.max(1, Math.round(win.height - TITLE_BAR_H)),
    };
  }

  function clearWindows() {
    windows.value = [];
    focusedId.value = "";
  }

  return {
    windows,
    focusedId,
    focusedWindow,
    visibleWindows,
    taskbarWindows,
    openOrFocusApp,
    focusWindow,
    minimizeWindow,
    toggleMaximizeWindow,
    closeWindow,
    updateWindowBounds,
    getContentSize,
    clearWindows,
    TITLE_BAR_H,
    MIN_W,
    MIN_H,
  };
}
