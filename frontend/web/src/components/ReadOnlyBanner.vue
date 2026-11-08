<script setup>
/**
 * 只读分享横幅。
 * 放在控制台最顶部（ConsoleLayout 之上）：viewer 一进来就必须知道
 * 「这不是我的管理后台，而是别人给的限时围观」，否则会以为是界面坏了。
 */
import { Eye } from "lucide-vue-next";
import { useI18n } from "vue-i18n";

defineProps({
  // 分享链接的备注名；后端在创建时允许为空（会回落成「只读分享」）
  label: {
    type: String,
    default: "",
  },
});

const { t } = useI18n();
</script>

<template>
  <div class="read-only-banner" role="status">
    <span class="read-only-banner__icon" aria-hidden="true">
      <Eye :size="18" :stroke-width="1.8" />
    </span>
    <div class="read-only-banner__text">
      <strong>{{ t("access.bannerTitle") }}</strong>
      <p>
        {{ t("access.bannerDesc", { label: label || t("access.bannerFallbackLabel") }) }}
      </p>
    </div>
  </div>
</template>
