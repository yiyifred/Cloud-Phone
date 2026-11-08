<script setup>
import { computed, onMounted, reactive, ref, watch } from "vue";
import { useI18n } from "vue-i18n";

import AuthLayer from "./AuthLayer.vue";
import AuthPasswordModal from "./AuthPasswordModal.vue";
import ConsoleLayout from "./ConsoleLayout.vue";
import IconHelperGatePanel from "./IconHelperGatePanel.vue";
import ReadOnlyBanner from "./ReadOnlyBanner.vue";
import ConfirmDialog from "./ui/ConfirmDialog.vue";
import SkeletonCard from "./ui/SkeletonCard.vue";
import { markViewerSession, useAccessRole } from "../composables/useAccessRole.js";
import { useAppFeedback } from "../composables/useAppFeedback.js";
import { useAuth } from "../composables/useAuth.js";
import { useDevices } from "../composables/useDevices.js";
import { useOnlineDevicesAppsWarm } from "../composables/useOnlineDevicesAppsWarm.js";
import { logInfo } from "../utils/app-event-logger.js";
import {
  getCachedRuntimeState,
  hydrateLocalPersistence,
  migrateLegacyBrowserPersistence,
  persistLocalStatePatch,
} from "../utils/local-persistence-state.js";
import {
  loadSettings,
  normalizeDeviceInterval,
  normalizeScreenshotInterval,
  saveSettings,
} from "../utils/settings-store.js";

const {
  state: authState,
  showAuthLayer,
  showLoginModal,
  showPasswordChangeModal,
  passwordChangeMode,
  passwordStatusText,
  loadSession,
  submitLogin,
  submitPasswordChange,
  openPasswordChange,
  closePasswordChange,
  logout,
} = useAuth();

const { t } = useI18n();
const feedback = useAppFeedback();
// 角色是模块级单例：横幅、画廊、工具栏、设置页共读同一个值
const { readOnly, refresh: refreshAccessRole } = useAccessRole();

const activeTab = ref("devices");
const selectedDevice = ref(null);
const settingsForm = reactive(loadSettings());

const {
  devices,
  loading: deviceLoading,
  error: deviceError,
  lastRefreshedAt,
  adbPath,
  refresh: refreshDevices,
  screenshotUrl,
  start: startDevices,
  stop: stopDevices,
} = useDevices(
  () => settingsForm.deviceListIntervalSeconds,
  () => settingsForm.screenshotIntervalSeconds,
  () => authState.authenticated,
  () => authState.authenticated && activeTab.value === "devices" && !selectedDevice.value,
);

// 预热会装图标服务（写操作），只读访问下不触发
const warmDevices = computed(() => (readOnly.value ? [] : devices.value));
const {
  consentDialogOpen,
  phase,
  progress,
  progressPercent,
  showProgressUi,
  answerConsent,
} = useOnlineDevicesAppsWarm(warmDevices);

function applySettingsToForm(settings) {
  settingsForm.deviceListIntervalSeconds = normalizeDeviceInterval(
    settings.deviceListIntervalSeconds,
  );
  settingsForm.screenshotIntervalSeconds = normalizeScreenshotInterval(
    settings.screenshotIntervalSeconds,
  );
}

function applyRuntimeStateToUi(runtimeState) {
  activeTab.value = runtimeState.activeTab || "devices";
  const serial = String(runtimeState.selectedDeviceSerial || "");
  selectedDevice.value = serial
    ? devices.value.find((device) => device.serial === serial) ?? null
    : null;
}

async function hydrateAuthenticatedPersistence() {
  // viewer 无写权限（POST /api/local-persistence 会 403）：用本地缓存还原即可
  if (readOnly.value) {
    applyRuntimeStateToUi(getCachedRuntimeState());
    return;
  }

  try {
    await migrateLegacyBrowserPersistence();
    const payload = await hydrateLocalPersistence();
    applySettingsToForm(payload.settings);
    applyRuntimeStateToUi(payload.runtimeState);
  } catch {
    applyRuntimeStateToUi(getCachedRuntimeState());
  }
}

async function bootAuthenticatedConsole() {
  await hydrateAuthenticatedPersistence();
  startDevices();
}

onMounted(async () => {
  // 先问角色：分享链接进来的是 viewer，不能走「没有会话 → 弹登录框」那条路
  if ((await refreshAccessRole()).readOnly) {
    markViewerSession(authState);
    logInfo("auth", "auth.share.enter", "通过只读分享链接进入控制台");
    await bootAuthenticatedConsole();
    return;
  }

  const authenticated = await loadSession();
  if (authenticated) {
    await bootAuthenticatedConsole();
    void refreshAccessRole();
  }
});

watch(
  () => authState.authenticated,
  (authenticated) => {
    if (!authenticated) {
      stopDevices();
    }
  },
);

watch(selectedDevice, (device, previousDevice) => {
  if (authState.authenticated && !readOnly.value) {
    void persistLocalStatePatch({
      runtimeState: {
        selectedDeviceSerial: device?.serial ?? "",
      },
    });
  }
  if (!device && previousDevice) {
    refreshDevices();
  }
});

watch(activeTab, (tab) => {
  if (!authState.authenticated || readOnly.value) {
    return;
  }
  void persistLocalStatePatch({
    runtimeState: {
      activeTab: tab,
      selectedDeviceSerial: tab === "devices" ? selectedDevice.value?.serial ?? "" : "",
    },
  });
});

async function handleLogin() {
  if (await submitLogin()) {
    await bootAuthenticatedConsole();
    void refreshAccessRole();
  }
}

async function handlePasswordChange() {
  if (await submitPasswordChange()) {
    await bootAuthenticatedConsole();
  }
}

async function handlePasswordChangeFromSettings() {
  await handlePasswordChange();
}

async function handleLogout() {
  logInfo("auth", "auth.logout", "退出登录");
  await logout();
  stopDevices();
  void refreshAccessRole();
}

async function saveSettingsForm() {
  settingsForm.deviceListIntervalSeconds = normalizeDeviceInterval(
    settingsForm.deviceListIntervalSeconds,
  );
  settingsForm.screenshotIntervalSeconds = normalizeScreenshotInterval(
    settingsForm.screenshotIntervalSeconds,
  );
  const saved = await saveSettings({
    deviceListIntervalSeconds: settingsForm.deviceListIntervalSeconds,
    screenshotIntervalSeconds: settingsForm.screenshotIntervalSeconds,
  });
  applySettingsToForm(saved);
  feedback.success(
    t("settings.savedFeedback", {
      device: settingsForm.deviceListIntervalSeconds,
      screenshot: settingsForm.screenshotIntervalSeconds,
    }),
  );
  logInfo("settings", "settings.save", "保存刷新设置", {
    details: {
      deviceListIntervalSeconds: settingsForm.deviceListIntervalSeconds,
      screenshotIntervalSeconds: settingsForm.screenshotIntervalSeconds,
    },
  });

  if (authState.authenticated) {
    startDevices();
  }
}
</script>

<template>
  <div class="app-shell">
    <AuthLayer
      v-if="showAuthLayer"
      :show-login-modal="showLoginModal"
      :show-password-change-modal="showPasswordChangeModal"
      :password-change-mode="passwordChangeMode"
      :state="authState"
      @login="handleLogin"
      @change-password="handlePasswordChange"
    />
    <!-- 启动（booting）期间用骨架卡占位：状态文案保留可读，
         骨架给出与控制台一致的布局预期，避免整页空白后突然撑开 -->
    <div v-else-if="authState.booting" class="app-shell__boot" aria-busy="true">
      <p class="app-shell__boot-status" role="status">
        {{ authState.sessionStateText || "…" }}
      </p>
      <SkeletonCard :count="6" height="16rem" />
    </div>
    <template v-else-if="authState.authenticated || authState.reauthenticating">
      <!-- 只读分享横幅放在控制台之上：一进来就知道「这是围观，不是后台」 -->
      <ReadOnlyBanner v-if="readOnly" />
      <ConsoleLayout
        v-model:active-tab="activeTab"
        v-model:selected-device="selectedDevice"
        :devices="devices"
        :device-loading="deviceLoading"
        :device-error="deviceError"
        :last-refreshed-at="lastRefreshedAt"
        :adb-path="adbPath"
        :screenshot-url="screenshotUrl"
        :settings-form="settingsForm"
        :password-status-text="passwordStatusText"
        :session-expires-at="authState.sessionExpiresAt"
        :read-only="readOnly"
        @logout="handleLogout"
        @save-settings="saveSettingsForm"
        @change-password="openPasswordChange"
        @refresh-devices="refreshDevices"
      />
    </template>
    <div
      v-if="showPasswordChangeModal && authState.authenticated"
      class="modal-layer"
      @click.self="closePasswordChange"
    >
      <section class="auth-card-shell">
        <div class="auth-card-shell__body">
          <AuthPasswordModal
            :state="authState"
            mode="voluntary"
            @submit="handlePasswordChangeFromSettings"
            @cancel="closePasswordChange"
          />
        </div>
      </section>
    </div>
    <IconHelperGatePanel
      v-if="authState.authenticated && !readOnly"
      :consent-open="consentDialogOpen"
      :busy="showProgressUi"
      :progress-percent="progressPercent"
      :progress-label="
        phase === 'ensuring' ? t('iconHelper.installing') : t('iconHelper.extracting')
      "
      :current-package="progress.current"
      :denied-hint="false"
      @allow="answerConsent(true)"
      @deny="answerConsent(false)"
    />
    <!-- 全局确认框：所有 window.confirm 的替代品，样式/语言/危险态统一 -->
    <ConfirmDialog />
  </div>
</template>
