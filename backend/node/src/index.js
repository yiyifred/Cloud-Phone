import https from "node:https";

import { serverConfig } from "./config/env.js";
import { createApp, createRequestHandler } from "./app.js";
import { describeTlsCertificate, loadBackendTlsOptions } from "./utils/backend-tls.js";
import { APP_VERSION } from "./config/version.js";
import { getHostNetworkSummary } from "./utils/host-networks.js";
import { startMdnsService } from "./services/mdns-service.js";
import { setupDeviceWebSocket } from "./ws/device-websocket-server.js";
import { startControlLeaseSweeper } from "./services/device-control-lease.js";

const { host, backendPort } = serverConfig;

// BACKEND_TLS=1 时后端自己上 TLS：浏览器 https 页面直连后端、Cookie 才能带 Secure，
// Android 客户端也才有条件关掉 usesCleartextTraffic。
const tlsOptions = serverConfig.backendTls ? loadBackendTlsOptions() : null;
const server = tlsOptions ? https.createServer(tlsOptions, createRequestHandler()) : createApp();
const backendScheme = tlsOptions ? "https" : "http";
setupDeviceWebSocket(server);
// 控制权租约 45 秒过期：定时清理，避免浏览器崩掉后设备一直被占用
startControlLeaseSweeper();

// Slow-loris hardening: Node keeps sockets open indefinitely by default, so an
// unauthenticated client could hold thousands of half-finished uploads.
server.requestTimeout = 120_000;
server.headersTimeout = 30_000;
server.keepAliveTimeout = 5_000;
let stopMdns = async () => {};

process.on("unhandledRejection", (reason) => {
  console.error("[backend] unhandledRejection:", reason);
});

process.on("uncaughtException", (error) => {
  console.error("[backend] uncaughtException:", error);
});

server.listen(backendPort, host, () => {
  console.log(`Cloud Phone backend API listening on ${backendScheme}://${host}:${backendPort}`);

  if (tlsOptions) {
    const info = describeTlsCertificate(tlsOptions);
    console.log(
      info
        ? `[backend] TLS subject=${info.subject} validTo=${info.validTo} sha256=${info.fingerprint}…`
        : "[backend] TLS enabled (custom certificate)",
    );
  }

  if (host === "0.0.0.0" || host === "::") {
    console.warn(
      tlsOptions
        ? `[backend] bound to ${host} over TLS — clients must trust this certificate (self-signed by default).`
        : `[backend] WARNING: bound to ${host} — the API is reachable over plain HTTP from the LAN. ` +
            "Put it behind the https frontend and keep AUTH_COOKIE secure, or set HOST=127.0.0.1.",
    );
  }
  stopMdns = startMdnsService({
    host,
    port: backendPort,
    version: APP_VERSION,
    lanIpv4Addresses: getHostNetworkSummary(host).lanIpv4Addresses,
  });
  console.log("Start frontend: cd frontend/web && npm run dev");
});

async function shutdown(signal) {
  console.log(`[backend] received ${signal}, shutting down...`);
  await stopMdns();
  server.close(() => {
    process.exit(0);
  });
}

process.on("SIGINT", () => {
  shutdown("SIGINT");
});

process.on("SIGTERM", () => {
  shutdown("SIGTERM");
});
