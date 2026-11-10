import { requestJson } from "./api.js";

export function startDeviceCast(serial, options = {}) {
  return requestJson(`/api/devices/${encodeURIComponent(serial)}/cast/start`, {
    method: "POST",
    body: options,
    // Cast start returns a typed error body (409 scrcpy_server_missing) that the
    // workspace turns into the install dialog, so failures must not throw.
    allowFailure: true,
  });
}

export function stopDeviceCast(serial, options = {}) {
  const sessionKey = options.sessionKey ? String(options.sessionKey) : "";
  return requestJson(`/api/devices/${encodeURIComponent(serial)}/cast/stop`, {
    method: "DELETE",
    body: sessionKey ? { sessionKey } : {},
    signal: options.signal,
  });
}

export function getDeviceCastStatus(serial) {
  return requestJson(`/api/devices/${encodeURIComponent(serial)}/cast/status`, {
    method: "GET",
  });
}
