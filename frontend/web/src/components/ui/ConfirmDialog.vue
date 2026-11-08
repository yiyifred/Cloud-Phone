<script setup>
import { computed } from "vue";
import { NButton, NModal } from "naive-ui";
import { useI18n } from "vue-i18n";

import { confirmState, settleConfirm } from "../../utils/confirm-dialog.js";

const { t } = useI18n();

const show = computed({
  get: () => confirmState.open,
  set: (value) => {
    if (!value) {
      settleConfirm(false);
    }
  },
});

const title = computed(() => confirmState.title || t("common.confirmTitle"));
const message = computed(() => confirmState.message);
const confirmText = computed(() => confirmState.confirmText || t("common.confirm"));
const cancelText = computed(() => confirmState.cancelText || t("common.cancel"));

// 危险操作默认焦点落在"取消"上（见模板 autofocus），误触回车不会执行。
</script>

<template>
  <NModal
    v-model:show="show"
    preset="card"
    :title="title"
    :bordered="false"
    :mask-closable="true"
    style="width: min(28rem, calc(100vw - 2rem))"
  >
    <p class="confirm-dialog__message">{{ message }}</p>
    <template #footer>
      <div class="confirm-dialog__actions">
        <NButton quaternary class="confirm-dialog__cancel" autofocus @click="settleConfirm(false)">
          {{ cancelText }}
        </NButton>
        <NButton :type="confirmState.danger ? 'error' : 'primary'" @click="settleConfirm(true)">
          {{ confirmText }}
        </NButton>
      </div>
    </template>
  </NModal>
</template>

<style scoped>
.confirm-dialog__message {
  margin: 0;
  color: var(--text-secondary);
  font-size: var(--fs-base);
  line-height: var(--lh-relaxed, 1.6);
  white-space: pre-line;
}

.confirm-dialog__actions {
  display: flex;
  justify-content: flex-end;
  gap: 0.5rem;
}

@media (max-width: 560px) {
  .confirm-dialog__actions > * {
    min-height: 2.75rem;
  }
}
</style>
