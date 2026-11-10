import { computed, onMounted, ref } from "vue";

import {
  downloadScrcpyServer,
  getScrcpyServerStatus,
  uploadScrcpyServerJar,
} from "../utils/scrcpy-server-api.js";
import { closeScrcpyServerSetup } from "../utils/scrcpy-server-setup-state.js";

export function useScrcpyServerSetup() {
  const server = ref(null);
  const loading = ref(false);
  const busy = ref("");
  const feedback = ref("");
  const errorText = ref("");

  const ready = computed(() => Boolean(server.value?.ready));
  const expectedPath = computed(() => server.value?.targets?.expectedPath ?? "");
  const sources = computed(() => server.value?.sources ?? []);

  async function refresh() {
    loading.value = true;
    errorText.value = "";

    try {
      const payload = await getScrcpyServerStatus();
      server.value = payload?.server ?? null;
    } catch (error) {
      errorText.value = error instanceof Error ? error.message : "读取服务端状态失败";
    } finally {
      loading.value = false;
    }
  }

  async function upload(file) {
    if (!file) {
      return false;
    }

    busy.value = `上传 ${file.name}`;
    feedback.value = "";
    errorText.value = "";

    try {
      const payload = await uploadScrcpyServerJar(file);
      server.value = payload?.server ?? server.value;
      feedback.value = `已安装 ${payload?.installed?.size ?? 0} 字节，来源 upload`;
      return true;
    } catch (error) {
      errorText.value = error instanceof Error ? error.message : "上传失败";
      return false;
    } finally {
      busy.value = "";
    }
  }

  async function download(source) {
    busy.value = `下载 ${source}`;
    feedback.value = "";
    errorText.value = "";

    try {
      const payload = await downloadScrcpyServer(source);
      server.value = payload?.server ?? server.value;
      feedback.value = `已安装 ${payload?.installed?.size ?? 0} 字节，来源 ${payload?.installed?.source ?? source}`;
      return true;
    } catch (error) {
      errorText.value = error instanceof Error ? error.message : "下载失败";
      return false;
    } finally {
      busy.value = "";
    }
  }

  function close() {
    closeScrcpyServerSetup();
  }

  onMounted(refresh);

  return { server, loading, busy, feedback, errorText, ready, expectedPath, sources, refresh, upload, download, close };
}
