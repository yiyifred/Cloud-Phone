<script setup>
import { onMounted, reactive, ref, watch } from "vue";
import { useI18n } from "vue-i18n";

import AuthLayer from "./AuthLayer.vue";
import AuthPasswordModal from "./AuthPasswordModal.vue";
import ConsoleLayout from "./ConsoleLayout.vue";
import IconHelperGatePanel from "./IconHelperGatePanel.vue";
import SkeletonCard from "./ui/SkeletonCard.vue";
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

const {
  consentDialogOpen,
  phase,
  progress,
  progressPercent,
  showProgressUi,
  answerConsent,
} = useOnlineDevicesAppsWarm(devices);

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
  const authenticated = await loadSession();
  if (authenticated) {
    await bootAuthenticatedConsole();
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
  if (authState.authenticated) {
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
  if (!authState.authenticated) {
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
    <ConsoleLayout
      v-else-if="authState.authenticated || authState.reauthenticating"
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
      @logout="handleLogout"
      @save-settings="saveSettingsForm"
      @change-password="openPasswordChange"
      @refresh-devices="refreshDevices"
    />
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
      v-if="authState.authenticated"
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
  </div>
</template>
