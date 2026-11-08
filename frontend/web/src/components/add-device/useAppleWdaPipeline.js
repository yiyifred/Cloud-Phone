/**
 * 苹果（WebDriverAgent）接入流程的状态机（T-433 从 AddDeviceApplePanel 抽出）。
 *
 * 为什么单独成文件：面板组件原本 383 行，其中 script 部分占了 223 行（准备项检查、
 * 流水线轮询、步骤状态推导）。这些逻辑与模板无耦合，抽出来后组件只剩展示，
 * 状态与请求仍在同一处维护，避免被拆成多个组件后各自持有一份 pipelineJob。
 *
 * 对外返回值与原本 setup 内的同名 ref / 函数一一对应，父组件直接解构即可。
 */
import { computed, onBeforeUnmount, onMounted, ref } from "vue";
import { useI18n } from "vue-i18n";

import { getErrorMessage, requestJson } from "../../utils/api.js";

// 后端流水线的步骤顺序：进度条的当前步与每步状态都由它推导，改顺序必须与后端一致。
export const APPLE_PIPELINE_STEPS = ["prepare", "login", "sign", "install", "discover", "connect"];

export function useAppleWdaPipeline(options = {}) {
  const onConnected = options.onConnected ?? null;
  const { t } = useI18n();

  const STEPS = APPLE_PIPELINE_STEPS;

  const prepareInfo = ref(null);
  const prepareError = ref("");
  const loadingPrepare = ref(true);

  const appleId = ref("");
  const password = ref("");
  const skipInstall = ref(false);
  const skipSign = ref(false);

  const pipelineJob = ref(null);
  const pipelineError = ref("");
  const running = ref(false);
  const pollTimer = ref(null);

  const currentStepIndex = computed(() => {
    const step = pipelineJob.value?.step ?? "prepare";
    const index = STEPS.indexOf(step);
    return index >= 0 ? index : 0;
  });

  const overallProgress = computed(
    () => pipelineJob.value?.progress ?? (loadingPrepare.value ? 2 : 8),
  );

  const isCompleted = computed(() => pipelineJob.value?.status === "completed");
  const isFailed = computed(() => pipelineJob.value?.status === "error");

  const pipelineLogsText = computed(() => {
    const logs = pipelineJob.value?.logs;

    if (!Array.isArray(logs) || logs.length === 0) {
      return "";
    }

    return logs
      .map((entry) => {
        const step = entry.step ? `[${entry.step}] ` : "";
        const level = entry.level ? `${entry.level}: ` : "";
        return `${step}${level}${entry.message ?? ""}`.trim();
      })
      .filter(Boolean)
      .join("\n");
  });

  const stepItems = computed(() =>
    STEPS.map((id) => ({
      id,
      label: t(`devices.addDeviceModal.apple.pipeline.steps.${id}`),
      state: resolveStepState(id),
    })),
  );

  function resolveStepState(stepId) {
    const job = pipelineJob.value;

    // 还没有 job 时，只要准备项已就绪就把 prepare 标成完成（否则整条进度看起来像卡住）。
    if (!job) {
      return stepId === "prepare" && !loadingPrepare.value ? "done" : "pending";
    }

    if (job.status === "error" && job.step === stepId) {
      return "error";
    }

    const stepIndex = STEPS.indexOf(stepId);
    const activeIndex = STEPS.indexOf(job.step);

    if (job.status === "completed") {
      return "done";
    }

    if (stepIndex < activeIndex) {
      return "done";
    }

    if (stepIndex === activeIndex) {
      return job.status === "error" ? "error" : "active";
    }

    return "pending";
  }

  async function loadPrepare() {
    loadingPrepare.value = true;
    prepareError.value = "";

    try {
      prepareInfo.value = await requestJson("/api/devices/ios/wda/prepare");
    } catch (error) {
      prepareError.value = getErrorMessage(
        error,
        t("devices.addDeviceModal.apple.pipeline.prepareFailed"),
      );
    } finally {
      loadingPrepare.value = false;
    }
  }

  function stopPolling() {
    if (pollTimer.value) {
      clearInterval(pollTimer.value);
      pollTimer.value = null;
    }
  }

  async function pollPipeline(jobId) {
    const payload = await requestJson(
      `/api/devices/ios/wda/pipeline/${encodeURIComponent(jobId)}`,
    );
    pipelineJob.value = payload.job ?? null;

    if (pipelineJob.value?.status === "completed") {
      stopPolling();
      running.value = false;

      if (pipelineJob.value.result?.device) {
        onConnected?.(pipelineJob.value.result.device);
      }
    }

    if (pipelineJob.value?.status === "error") {
      stopPolling();
      running.value = false;
      pipelineError.value = pipelineJob.value.error || pipelineJob.value.message;
    }
  }

  function startPolling(jobId) {
    stopPolling();
    pollTimer.value = window.setInterval(() => {
      void pollPipeline(jobId).catch((error) => {
        pipelineError.value = getErrorMessage(
          error,
          t("devices.addDeviceModal.apple.pipeline.pollFailed"),
        );
        stopPolling();
        running.value = false;
      });
    }, 700);
  }

  async function startPipeline(submitOptions = {}) {
    pipelineError.value = "";

    const useSkipInstall = submitOptions.skipInstall ?? skipInstall.value;
    const useSkipSign = submitOptions.skipSign ?? skipSign.value;

    // 三个前置校验的先后顺序是有意的：先判登录信息、再判 IPA、最后判「跳过安装但没跳过签名」，
    // 用户看到的错误提示顺序与原实现保持一致。
    if (!useSkipSign && (!appleId.value.trim() || !password.value.trim())) {
      pipelineError.value = t("devices.addDeviceModal.apple.pipeline.loginRequired");
      return;
    }

    if (!prepareInfo.value?.prepare?.ipaExists && !useSkipInstall) {
      pipelineError.value = t("devices.addDeviceModal.apple.pipeline.ipaMissing");
      return;
    }

    if (!prepareInfo.value?.prepare?.ipaExists && useSkipInstall && !useSkipSign) {
      pipelineError.value = t("devices.addDeviceModal.apple.pipeline.ipaMissing");
      return;
    }

    running.value = true;
    pipelineJob.value = {
      status: "running",
      step: "prepare",
      progress: 0,
      message: t("devices.addDeviceModal.apple.pipeline.starting"),
    };

    try {
      const result = await requestJson("/api/devices/ios/wda/pipeline", {
        method: "POST",
        body: {
          appleId: appleId.value.trim(),
          password: password.value,
          skipInstall: useSkipInstall,
          skipSign: useSkipSign,
        },
      });

      pipelineJob.value = result.job;
      startPolling(result.job.id);
      await pollPipeline(result.job.id);
    } catch (error) {
      running.value = false;
      pipelineError.value = getErrorMessage(
        error,
        t("devices.addDeviceModal.apple.pipeline.startFailed"),
      );
      pipelineJob.value = {
        status: "error",
        step: "prepare",
        progress: 0,
        message: pipelineError.value,
        error: pipelineError.value,
      };
    }
  }

  function startSkipInstallPipeline() {
    skipInstall.value = true;
    skipSign.value = true;
    void startPipeline({ skipInstall: true, skipSign: true });
  }

  onMounted(() => {
    void loadPrepare();
  });

  // 轮询定时器必须在卸载时清掉：组件被弹窗关掉后继续请求会污染下一次进入的状态。
  onBeforeUnmount(() => {
    stopPolling();
  });

  return {
    prepareInfo,
    prepareError,
    loadingPrepare,
    appleId,
    password,
    skipInstall,
    skipSign,
    pipelineJob,
    pipelineError,
    running,
    currentStepIndex,
    overallProgress,
    isCompleted,
    isFailed,
    pipelineLogsText,
    stepItems,
    loadPrepare,
    startPipeline,
    startSkipInstallPipeline,
  };
}
