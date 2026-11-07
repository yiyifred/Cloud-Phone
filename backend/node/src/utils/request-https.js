/**
 * Decide whether the browser reached us over TLS.
 *
 * The backend speaks plain HTTP on loopback; the frontend proxy is the TLS
 * terminator and forwards x-forwarded-proto. Cookie Secure is only added when
 * a real https origin exists, otherwise plain-HTTP LAN setups would silently
 * lose their session on every request.
 */
export function isSecureRequest(req) {
  if (!req || typeof req !== "object") {
    return false;
  }

  if (req.socket?.encrypted) {
    return true;
  }

  const forwarded = String(req.headers?.["x-forwarded-proto"] ?? "");
  return forwarded.split(",")[0].trim().toLowerCase() === "https";
}

/** Coarse client identity for throttling (proxy aware, no port). */
export function getClientIp(req) {
  const forwarded = String(req.headers?.["x-forwarded-for"] ?? "");
  const first = forwarded.split(",")[0].trim();
  if (first) {
    return first;
  }
  const address = req?.socket?.remoteAddress ?? "unknown";
  // ::ffff:192.168.1.20 -> 192.168.1.20
  return address.startsWith("::ffff:") ? address.slice(7) : address;
}
