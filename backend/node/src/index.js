import { serverConfig } from "./config/env.js";
import { createApp } from "./app.js";
import { APP_VERSION } from "./config/version.js";
import { getHostNetworkSummary } from "./utils/host-networks.js";
import { startMdnsService } from "./services/mdns-service.js";
import { setupDeviceWebSocket } from "./ws/device-websocket-server.js";

const { host, backendPort } = serverConfig;

const server = createApp();
setupDeviceWebSocket(server);

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
  console.log(`Cloud Phone backend API listening on http://${host}:${backendPort}`);
  if (host === "0.0.0.0" || host === "::") {
    console.warn(
      `[backend] WARNING: bound to ${host} — the API is reachable over plain HTTP from the LAN. ` +
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
