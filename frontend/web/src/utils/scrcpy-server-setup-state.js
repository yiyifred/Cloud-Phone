import { reactive } from "vue";

/**
 * Global open state for the scrcpy-server install dialog.
 *
 * Cast start can fail on any page (workspace, group control, multi app), so the
 * dialog is mounted once at the app shell and opened through this store.
 */
export const scrcpyServerSetup = reactive({
  open: false,
  reason: "",
  detail: null,
});

export function openScrcpyServerSetup({ reason = "", detail = null } = {}) {
  scrcpyServerSetup.reason = reason;
  scrcpyServerSetup.detail = detail;
  scrcpyServerSetup.open = true;
}

export function closeScrcpyServerSetup() {
  scrcpyServerSetup.open = false;
}
