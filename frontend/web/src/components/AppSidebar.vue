<script setup>
import { computed } from "vue";
import { useI18n } from "vue-i18n";

import AppIcon from "./AppIcon.vue";
import ThemeToggle from "./ThemeToggle.vue";
const props = defineProps({
  activeTab: {
    type: String,
    required: true,
  },
  readOnly: {
    type: Boolean,
    default: false,
  },
});

const emit = defineEmits(["update:activeTab", "logout"]);

const { t } = useI18n();

const tabs = computed(() => {
  const items = [
    { id: "devices", label: t("sidebar.devices"), icon: "devices" },
    { id: "group-control", label: t("sidebar.groupControl"), icon: "group-control" },
    { id: "logs", label: t("sidebar.logs"), icon: "logs" },
    { id: "settings", label: t("sidebar.settings"), icon: "settings" },
  ];

  // 分组控制全是往设备发写指令，只读分享访问下连入口都不给
  return props.readOnly ? items.filter((tab) => tab.id !== "group-control") : items;
});
</script>

<template>
  <aside class="sidebar">
    <div class="sidebar__brand">
      <div class="sidebar__logo" aria-hidden="true">
        <AppIcon name="phone" />
      </div>
      <div>
        <p class="eyebrow">Cloud Phone</p>
        <strong>{{ t("sidebar.brandTitle") }}</strong>
      </div>
    </div>

    <nav class="sidebar__tabs" :aria-label="t('sidebar.navLabel')">
      <button
        v-for="tab in tabs"
        :key="tab.id"
        type="button"
        class="sidebar__tab"
        :class="{ 'sidebar__tab--active': props.activeTab === tab.id }"
        @click="emit('update:activeTab', tab.id)"
      >
        <AppIcon :name="tab.icon" />
        <span>{{ tab.label }}</span>
      </button>
    </nav>

    <div class="sidebar__footer">
      <ThemeToggle />
      <!-- viewer 无法调用 /api/auth/logout（会被 403），不摆一个按不动的按钮 -->
      <button
        v-if="!readOnly"
        type="button"
        class="sidebar__logout"
        @click="emit('logout')"
      >
        <AppIcon name="logout" />
        <span>{{ t("sidebar.logout") }}</span>
      </button>
    </div>
  </aside>
</template>
