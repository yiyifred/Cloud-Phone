import http from "node:http";
import https from "node:https";

function buildUpgradeResponse(statusCode, statusMessage, headers) {
  const headerLines = Object.entries(headers ?? {})
    .map(([key, value]) => {
      if (value == null) {
        return "";
      }

      const normalized = Array.isArray(value) ? value.join(", ") : String(value);
      return `${key}: ${normalized}`;
    })
    .filter(Boolean);

  return `HTTP/1.1 ${statusCode} ${statusMessage}\r\n${headerLines.join("\r\n")}\r\n\r\n`;
}

function isLoopbackHost(hostname) {
  return hostname === "127.0.0.1" || hostname === "localhost" || hostname === "::1" || hostname === "[::1]";
}

function proxyUpgradeRequest(clientReq, clientSocket, clientHead, backendOrigin, requestUrl) {
  const backendUrl = new URL(backendOrigin);
  const isTls = backendUrl.protocol === "https:";
  const backendClient = isTls ? https : http;
  // 与 server.mjs 的 HTTP 反代保持同一套信任策略：环回后端接受自签证书。
  const insecure = process.env.BACKEND_TLS_INSECURE === "1" || isLoopbackHost(backendUrl.hostname);
  const proxyReq = backendClient.request({
    hostname: backendUrl.hostname,
    port: backendUrl.port || (isTls ? 443 : 80),
    path: `${requestUrl.pathname}${requestUrl.search}`,
    method: clientReq.method,
    ...(isTls ? { rejectUnauthorized: !insecure } : {}),
    headers: {
      ...clientReq.headers,
      host: backendUrl.host,
    },
  });

  const destroyBoth = () => {
    clientSocket.destroy();
    proxyReq.destroy();
  };

  proxyReq.on("error", destroyBoth);

  proxyReq.on("response", (proxyRes) => {
    proxyRes.resume();
    destroyBoth();
  });

  proxyReq.on("upgrade", (proxyRes, proxySocket, proxyHead) => {
    clientSocket.write(
      buildUpgradeResponse(proxyRes.statusCode ?? 101, proxyRes.statusMessage ?? "Switching Protocols", proxyRes.headers),
    );

    const pending = [];

    if (proxyHead?.length) {
      pending.push(proxyHead);
    }

    if (clientHead?.length) {
      pending.push(clientHead);
    }

    if (pending.length > 0) {
      proxySocket.write(Buffer.concat(pending));
    }

    proxySocket.pipe(clientSocket);
    clientSocket.pipe(proxySocket);

    proxySocket.on("error", () => clientSocket.destroy());
    clientSocket.on("error", () => proxySocket.destroy());
  });

  proxyReq.end();
}

/**
 * Forward browser WebSocket upgrades (/api/*) to the Node backend.
 * @param {import("node:http").Server | import("node:https").Server} server
 * @param {{ backendOrigin: string, frontendPort: number, frontendHttps?: boolean }} options
 */
export function attachApiWebSocketProxy(server, options) {
  const { backendOrigin, frontendPort, frontendHttps = false } = options;
  const pageScheme = frontendHttps ? "https" : "http";

  server.on("upgrade", (clientReq, clientSocket, clientHead) => {
    const requestUrl = new URL(clientReq.url ?? "/", `${pageScheme}://127.0.0.1:${frontendPort}`);

    if (!requestUrl.pathname.startsWith("/api/")) {
      clientSocket.destroy();
      return;
    }

    proxyUpgradeRequest(clientReq, clientSocket, clientHead, backendOrigin, requestUrl);
  });
}
