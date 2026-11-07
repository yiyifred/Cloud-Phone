import vue from "@vitejs/plugin-vue";
import basicSsl from "@vitejs/plugin-basic-ssl";
import { defineConfig } from "vite";

import { applyProjectEnv } from "../../tools/env-loader.js";

const { host, backendPort, frontendPort, backendOrigin } = applyProjectEnv();

const apiProxy = {
  target: backendOrigin,
  changeOrigin: true,
  ws: true,
  timeout: 120_000,
  proxyTimeout: 120_000,
  configure(proxy) {
    proxy.on("error", (error, request) => {
      console.error(
        `[vite] http proxy error: ${request?.url ?? "/api"} -> ${backendOrigin}`,
        error.message,
      );
      console.error(
        "[vite] Ensure backend is running: npm run dev (root) or npm run dev:backend",
      );
    });
  },
};

function backendHealthPlugin() {
  return {
    name: "cloud-phone-backend-health",
    configureServer(server) {
      server.httpServer?.once("listening", () => {
        fetch(`${backendOrigin}/health`)
          .then((response) => {
            // /health is protected and may return 401 when backend is healthy.
            if (!response.ok && ![401, 403].includes(response.status)) {
              throw new Error(`HTTP ${response.status}`);
            }
          })
          .catch(() => {
            console.warn(
              `\n[vite] Backend is not reachable at ${backendOrigin}.`,
            );
            console.warn("[vite] Start API first: npm run dev:backend\n");
          });
      });
    },
  };
}

export default defineConfig({
  plugins: [vue(), basicSsl(), backendHealthPlugin()],
  define: {
      // vue-i18n 的 esm-bundler 版本把这些能力开关留给构建方定义：不定义时走的是
      // 非 JIT 分支，消息在运行时用 new Function 拼装，会被 CSP 的 script-src 拦死
      // （现象是整页白屏、控制台只有一条 EvalError）。开启 JIT 后由 AST 直接组装
      // 渲染函数，全程不 eval，才能在不开 'unsafe-eval' 的前提下正常显示文案。
      __INTLIFY_JIT_COMPILATION__: true,
      __INTLIFY_DROP_MESSAGE_COMPILER__: false,
      __INTLIFY_PROD_DEVTOOLS__: false,
      __VUE_I18N_FULL_INSTALL__: true,
      __VUE_I18N_LEGACY_API__: false,
      __VUE_PROD_DEVTOOLS__: false,
      __VUE_PROD_HYDRATION_MISMATCH_DETAILS__: false,
  },
  server: {
    host,
    port: frontendPort,
    https: true,
    proxy: {
      "/api": apiProxy,
    },
  },
  preview: {
    host,
    port: frontendPort,
    proxy: {
      "/api": apiProxy,
    },
  },
  build: {
    outDir: "dist",
    emptyOutDir: true,
  },
});