<script setup>
import { computed, ref } from "vue";

import { useScrcpyServerSetup } from "../composables/useScrcpyServerSetup.js";
import { scrcpyServerSetup } from "../utils/scrcpy-server-setup-state.js";

const { server, loading, busy, feedback, errorText, ready, expectedPath, sources, refresh, upload, download, close } =
  useScrcpyServerSetup();

const fileInput = ref(null);
const copied = ref(false);

const statusText = computed(() => {
  if (loading.value) {
    return "读取中";
  }

  return ready.value ? "已安装" : "未安装";
});

function pickFile() {
  fileInput.value?.click();
}

async function onFileChange(event) {
  const file = event.target.files?.[0];
  event.target.value = "";
  const ok = await upload(file);

  if (ok) {
    copied.value = false;
  }
}

async function copyPath() {
  if (!expectedPath.value || typeof navigator === "undefined" || !navigator.clipboard) {
    return;
  }

  await navigator.clipboard.writeText(expectedPath.value);
  copied.value = true;
}
</script>

<template>
  <div
    v-if="scrcpyServerSetup.open"
    class="scrcpy-setup"
    role="dialog"
    aria-modal="true"
    aria-label="安装设备端 scrcpy-server"
  >
    <div class="scrcpy-setup__card">
      <header class="scrcpy-setup__header">
        <div>
          <h3 class="scrcpy-setup__title">安装设备端 scrcpy-server</h3>
          <p class="scrcpy-setup__sub">
            仓库不附带这个 jar，投屏前需要安装一次，之后所有设备共用。
          </p>
        </div>
        <button type="button" class="scrcpy-setup__close" title="关闭" @click="close">×</button>
      </header>

      <p class="scrcpy-setup__status">
        状态：<strong>{{ statusText }}</strong>
        <span v-if="ready && server?.size">，{{ server.size }} 字节</span>
        <span v-if="scrcpyServerSetup.reason">（{{ scrcpyServerSetup.reason }}）</span>
        <button type="button" class="scrcpy-setup__refresh" :disabled="loading" @click="refresh">
          刷新
        </button>
      </p>

      <section class="scrcpy-setup__option">
        <h4>1. 上传已下载的 jar</h4>
        <p>选择本地 scrcpy-server-android-5.0.1.jar。</p>
        <input ref="fileInput" type="file" accept=".jar,.apk" class="scrcpy-setup__file" @change="onFileChange" />
        <button type="button" class="scrcpy-setup__button" :disabled="Boolean(busy)" @click="pickFile">
          选择文件
        </button>
      </section>

      <section class="scrcpy-setup__option">
        <h4>2. 从网络下载</h4>
        <p>GitHub 直连失败时用 gh-proxy.com 加速。</p>
        <div class="scrcpy-setup__row">
          <button
            v-for="source in sources"
            :key="source.id"
            type="button"
            class="scrcpy-setup__button"
            :disabled="Boolean(busy)"
            @click="download(source.id)"
          >
            {{ source.label }}
          </button>
        </div>
      </section>

      <section class="scrcpy-setup__option">
        <h4>3. 手动放置</h4>
        <p>把 jar 复制到下面路径，文件名为 scrcpy-server，然后点刷新。</p>
        <p class="scrcpy-setup__path">{{ expectedPath || "（正在读取路径）" }}</p>
        <button type="button" class="scrcpy-setup__button" :disabled="!expectedPath" @click="copyPath">
          {{ copied ? "已复制" : "复制路径" }}
        </button>
      </section>

      <p v-if="busy" class="scrcpy-setup__note">进行中：{{ busy }}</p>
      <p v-if="feedback" class="scrcpy-setup__ok">{{ feedback }}</p>
      <p v-if="errorText" class="scrcpy-setup__error">{{ errorText }}</p>
    </div>
  </div>
</template>

<style scoped>
.scrcpy-setup {
  position: fixed;
  inset: 0;
  display: grid;
  place-items: center;
  padding: 24px;
  background: rgba(15, 23, 42, 0.55);
  z-index: 60;
}

.scrcpy-setup__card {
  width: min(560px, 100%);
  max-height: min(82vh, 720px);
  overflow: auto;
  padding: 20px 22px;
  border-radius: var(--radius-lg, 12px);
  background: var(--surface, #ffffff);
  color: var(--text, #0f172a);
  box-shadow: 0 24px 60px rgba(15, 23, 42, 0.28);
}

.scrcpy-setup__header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
}

.scrcpy-setup__title {
  margin: 0 0 4px;
  font-size: 17px;
}

.scrcpy-setup__sub {
  margin: 0;
  font-size: 13px;
  color: var(--text-muted, #475569);
}

.scrcpy-setup__close {
  border: 0;
  background: transparent;
  font-size: 20px;
  line-height: 1;
  cursor: pointer;
  color: inherit;
}

.scrcpy-setup__status {
  margin: 14px 0;
  font-size: 13px;
}

.scrcpy-setup__refresh {
  margin-left: 8px;
  border: 0;
  background: none;
  color: var(--primary, #15803d);
  cursor: pointer;
  text-decoration: underline;
}

.scrcpy-setup__option {
  padding: 12px 14px;
  margin-bottom: 10px;
  border: 1px solid var(--border, #e2e8f0);
  border-radius: var(--radius-md, 10px);
}

.scrcpy-setup__option h4 {
  margin: 0 0 6px;
  font-size: 14px;
}

.scrcpy-setup__option p {
  margin: 0 0 8px;
  font-size: 13px;
  color: var(--text-muted, #475569);
}

.scrcpy-setup__file {
  display: none;
}

.scrcpy-setup__row {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.scrcpy-setup__button {
  padding: 7px 14px;
  border-radius: var(--radius-sm, 8px);
  border: 1px solid var(--border, #cbd5e1);
  background: var(--surface-muted, #f8fafc);
  color: inherit;
  font-size: 13px;
  cursor: pointer;
}

.scrcpy-setup__button:disabled {
  opacity: 0.55;
  cursor: not-allowed;
}

.scrcpy-setup__path {
  padding: 8px 10px;
  border-radius: var(--radius-sm, 8px);
  background: var(--surface-muted, #f1f5f9);
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  font-size: 12px;
  word-break: break-all;
}

.scrcpy-setup__note,
.scrcpy-setup__ok,
.scrcpy-setup__error {
  margin: 8px 0 0;
  font-size: 13px;
}

.scrcpy-setup__ok {
  color: var(--primary, #15803d);
}

.scrcpy-setup__error {
  color: var(--danger, #b91c1c);
}
</style>
