<script setup>
import AuthLoginModal from "./AuthLoginModal.vue";
import AuthPasswordModal from "./AuthPasswordModal.vue";
import { computed } from "vue";
import { useI18n } from "vue-i18n";

defineProps({
  showLoginModal: {
    type: Boolean,
    required: true,
  },
  showPasswordChangeModal: {
    type: Boolean,
    required: true,
  },
  passwordChangeMode: {
    type: String,
    default: "forced",
  },
  state: {
    type: Object,
    required: true,
  },
});

const emit = defineEmits(["login", "change-password"]);
const { t } = useI18n();

const securityStepState = computed(() => {
  if (props.state.passwordConfigured) {
    return t("auth.passwordUpdated");
  }

  if (props.showPasswordChangeModal) {
    return t("auth.defaultVerified");
  }

  return t("auth.passwordDefault");
});

const loginStepState = computed(() => {
  if (props.state.authenticated) {
    return t("auth.enteredConsole");
  }

  if (props.showPasswordChangeModal) {
    return t("auth.defaultVerified");
  }

  return props.state.sessionStateText || t("auth.sessionChecking");
});
</script>

<template>
  <div class="modal-layer modal-layer--auth">
    <div class="auth-stage">
      <aside class="auth-stage__aside">
        <p class="eyebrow">{{ t("auth.loginEyebrow") }}</p>
        <h1 class="auth-stage__title">{{ t("auth.loginTitle") }}</h1>
        <p class="auth-stage__desc">{{ t("auth.loginIntro") }}</p>

        <div class="auth-stage__cards">
          <article class="auth-stage__card">
            <h3>{{ t("auth.changeTitle") }}</h3>
            <p>{{ t("auth.changeIntro") }}</p>
          </article>
          <article class="auth-stage__card auth-stage__card--hint">
            <h3>{{ t("auth.defaultPasswordHint") }}</h3>
            <p>{{ state.sessionStateText || t("auth.sessionChecking") }}</p>
          </article>
        </div>

        <ol class="auth-stage__steps" aria-label="auth workflow">
          <li class="auth-stage__step">
            <strong>{{ t("auth.enterConsole") }}</strong>
            <span>{{ loginStepState }}</span>
          </li>
          <li class="auth-stage__step">
            <strong>{{ t("auth.changeTitleVoluntary") }}</strong>
            <span>{{ securityStepState }}</span>
          </li>
        </ol>
      </aside>

      <div class="auth-stage__panel">
        <AuthLoginModal
          v-if="showLoginModal"
          :state="state"
          @submit="emit('login')"
        />
        <AuthPasswordModal
          v-else-if="showPasswordChangeModal"
          :state="state"
          :mode="passwordChangeMode"
          @submit="emit('change-password')"
        />
      </div>
    </div>
  </div>
</template>
