<script setup>
/**
 * 设置页「只读分享」卡片。
 *
 * 这个卡片存在的理由：以前想把画面给同事看，只能把管理密码交出去——
 * 等于连安装、卸载、终端一起给了。这里生成的是一个限时、只读、可吊销的链接。
 * 明文链接只在创建响应里出现一次（服务端只留哈希），所以生成后必须当场展示并复制。
 */
import { computed, onMounted, ref } from "vue";
import { useI18n } from "vue-i18n";
import { NInput, NSelect } from "naive-ui";

import UiButton from "../ui/UiButton.vue";
import { useAppFeedback } from "../../composables/useAppFeedback.js";
import { getErrorMessage } from "../../utils/api.js";
import { requestConfirm } from "../../utils/confirm-dialog.js";
import { formatDate } from "../../utils/format-date.js";
import { logInfo, logWarn } from "../../utils/app-event-logger.js";
import {
  SHARE_TTL_HOURS,
  createShareLink,
  fetchShareLinks,
  revokeShareLink,
} from "../../utils/share-api.js";

const { t } = useI18n();
const feedback = useAppFeedback();

const label = ref("");
const ttlHours = ref(SHARE_TTL_HOURS[2] ?? 24);
const generating = ref(false);
const loading = ref(false);
const denied = ref(false);
const links = ref([]);
/** 刚生成的链接：只在本次会话内留存，刷新页面即消失（服务端拿不回来） */
const fresh = ref(null);
const copied = ref(false);

const ttlOptions = computed(() =>
  SHARE_TTL_HOURS.map((hours) => ({ label: t("share.ttlHours", { hours }), value: hours })),
);

function describeError(error, fallbackKey) {
  return getErrorMessage(error, t(fallbackKey));
}

async function loadLinks() {
  loading.value = true;

  try {
    const result = await fetchShareLinks();
    denied.value = result.denied;
    links.value = result.items;

    if (result.denied) {
      logWarn("share", "share.list.denied", "当前凭据无法管理分享链接", {
        details: { message: result.message },
      });
    }
  } catch (error) {
    // 列表拉不到不能让「生成」也连带失败：只提示，表单继续可用
    feedback.error(describeError(error, "share.listFailed"));
    logWarn("share", "share.list.failed", "拉取分享链接失败");
  } finally {
    loading.value = false;
  }
}

async function handleGenerate() {
  if (generating.value) {
    return;
  }

  generating.value = true;
  copied.value = false;

  try {
    const result = await createShareLink({ label: label.value, ttlMinutes: ttlHours.value * 60 });
    fresh.value = {
      id: result.share?.id ?? "",
      label: result.share?.label ?? label.value,
      expiresAt: result.share?.expiresAt ?? null,
      link: result.link,
    };
    logInfo("share", "share.create", `生成只读分享链接：${fresh.value.label}`, {
      details: { ttlMinutes: ttlHours.value * 60 },
    });
    await loadLinks();
  } catch (error) {
    feedback.error(describeError(error, "share.createFailed"));
    logWarn("share", "share.create.failed", "生成只读分享链接失败");
  } finally {
    generating.value = false;
  }
}

async function writeToClipboard(text) {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text);
    return;
  }

  // 非安全上下文（http + 局域网 IP）没有 clipboard API，退回到选中复制
  const holder = document.createElement("textarea");
  holder.value = text;
  holder.setAttribute("readonly", "");
  holder.style.position = "fixed";
  holder.style.opacity = "0";
  document.body.appendChild(holder);
  holder.select();

  try {
    if (!document.execCommand("copy")) {
      throw new Error("copy command rejected");
    }
  } finally {
    document.body.removeChild(holder);
  }
}

async function handleCopy() {
  const link = fresh.value?.link;

  if (!link) {
    return;
  }

  try {
    await writeToClipboard(link);
    copied.value = true;
    feedback.success(t("share.copied"));
  } catch {
    // 不静默：复制失败时链接本身仍然可选中，提示用户手动复制
    copied.value = false;
    feedback.error(t("share.copyFailed"));
  }
}

async function handleRevoke(item) {
  const name = item?.label || t("share.untitled");
  const confirmed = await requestConfirm({
    message: t("share.revokeConfirm", { label: name }),
    confirmText: t("share.revoke"),
    danger: true,
  });

  if (!confirmed) {
    return;
  }

  const result = await revokeShareLink(item.id);

  if (!result.ok) {
    feedback.error(result.message || t("share.revokeFailed"));
    logWarn("share", "share.revoke.failed", `吊销分享链接失败：${name}`);
    return;
  }

  if (fresh.value?.id && fresh.value.id === item.id) {
    fresh.value = null;
  }

  feedback.success(t("share.revoked"));
  logInfo("share", "share.revoke", `吊销分享链接：${name}`);
  await loadLinks();
}

onMounted(loadLinks);
</script>

<template>
  <div class="settings-section shell-panel-content">
    <p v-if="denied" class="share-denied">{{ t("share.adminOnly") }}</p>

    <template v-else>
      <p class="share-intro">{{ t("share.desc") }}</p>

      <form class="share-form" @submit.prevent="handleGenerate">
        <dl class="shell-form-rows">
          <div class="shell-form-row">
            <dt class="shell-form-row__label">{{ t("share.label") }}</dt>
            <dd class="shell-form-row__control">
              <NInput
                v-model:value="label"
                size="small"
                :maxlength="40"
                :placeholder="t('share.labelPlaceholder')"
              />
            </dd>
          </div>
          <div class="shell-form-row">
            <dt class="shell-form-row__label">{{ t("share.ttl") }}</dt>
            <dd class="shell-form-row__control">
              <NSelect v-model:value="ttlHours" :options="ttlOptions" size="small" />
            </dd>
          </div>
        </dl>

        <div class="shell-form-actions">
          <UiButton variant="primary" attr-type="submit" :loading="generating">
            {{ generating ? t("share.generating") : t("share.generate") }}
          </UiButton>
          <UiButton variant="ghost" :loading="loading" @click="loadLinks">
            {{ t("share.refresh") }}
          </UiButton>
        </div>
      </form>

      <section v-if="fresh" class="share-fresh">
        <h4 class="share-fresh__title">{{ t("share.createdTitle") }}</h4>
        <p class="share-fresh__hint">{{ t("share.createdHint") }}</p>
        <div class="share-fresh__row">
          <code class="share-fresh__link">{{ fresh.link }}</code>
          <UiButton size="small" :block="false" @click="handleCopy">
            {{ copied ? t("share.copied") : t("share.copy") }}
          </UiButton>
        </div>
        <p class="share-fresh__meta">
          {{ t("share.expiresAt", { time: formatDate(fresh.expiresAt) }) }}
        </p>
      </section>

      <h4 class="share-list__title">{{ t("share.listTitle") }}</h4>
      <p v-if="!links.length" class="share-list__empty">{{ t("share.listEmpty") }}</p>
      <ul v-else class="share-list">
        <li v-for="item in links" :key="item.id" class="share-list__item">
          <div class="share-list__main">
            <strong class="share-list__label">{{ item.label || t("share.untitled") }}</strong>
            <p class="share-list__meta">
              <span>{{ t("share.colExpires") }} · {{ formatDate(item.expiresAt) }}</span>
              <span>
                {{ t("share.colLastUsed") }} ·
                {{ item.lastUsedAt ? formatDate(item.lastUsedAt) : t("share.neverUsed") }}
              </span>
            </p>
          </div>
          <UiButton variant="ghost" size="small" @click="handleRevoke(item)">
            {{ t("share.revoke") }}
          </UiButton>
        </li>
      </ul>
    </template>
  </div>
</template>
