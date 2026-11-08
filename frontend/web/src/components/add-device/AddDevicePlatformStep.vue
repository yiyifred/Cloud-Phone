<script setup>
/**
 * 添加设备弹窗的「选择平台」页（T-430 从 AddDeviceModal 抽出）。
 * 只负责把平台卡片画出来，选哪种连接方式用事件抛给父组件决定下一步；
 * 未实现的 mode 保留「即将支持」徽标（与拆分前一致）。
 */
import { Icon } from "@iconify/vue";
import { useI18n } from "vue-i18n";

const emit = defineEmits(["select"]);

const { t } = useI18n();

const platforms = [
  {
    id: "android",
    icon: "mdi:android",
    modes: ["usb", "qr", "pairCode", "direct"],
  },
  { id: "harmony", icon: "simple-icons:huawei", modes: ["usb"] },
  { id: "apple", icon: "mdi:apple", modes: ["connect"] },
];
</script>

<template>
  <div class="add-device-modal__grid">
    <article
      v-for="item in platforms"
      :key="item.id"
      class="add-device-modal__card"
      :class="{ 'add-device-modal__card--apple': item.id === 'apple' }"
    >
      <Icon :icon="item.icon" class="add-device-modal__icon" />
      <h3>{{ t(`devices.addDeviceModal.platforms.${item.id}`) }}</h3>
      <ul v-if="item.modes?.length" class="add-device-modal__modes">
        <li
          v-for="mode in item.modes"
          :key="mode"
          class="add-device-modal__mode"
          :class="{ 'add-device-modal__mode--active': item.id === 'android' && mode === 'usb' }"
        >
          <button
            v-if="item.id === 'harmony' && mode === 'usb'"
            type="button"
            class="add-device-modal__mode-btn"
            @click="emit('select', 'harmony-usb')"
          >
            <span>{{ t("devices.addDeviceModal.harmonyModes.usb") }}</span>
            <span class="add-device-modal__mode-badge">
              {{ t("devices.addDeviceModal.usb.action") }}
            </span>
          </button>
          <button
            v-else-if="item.id === 'android' && mode === 'usb'"
            type="button"
            class="add-device-modal__mode-btn"
            @click="emit('select', 'android-usb')"
          >
            <span>{{ t(`devices.addDeviceModal.androidModes.${mode}`) }}</span>
            <span class="add-device-modal__mode-badge">
              {{ t("devices.addDeviceModal.usb.action") }}
            </span>
          </button>
          <button
            v-else-if="item.id === 'apple' && mode === 'connect'"
            type="button"
            class="add-device-modal__mode-btn"
            @click="emit('select', 'apple-connect')"
          >
            <span>{{ t("devices.addDeviceModal.appleModes.connect") }}</span>
            <span class="add-device-modal__mode-badge">
              {{ t("devices.addDeviceModal.apple.action") }}
            </span>
          </button>
          <button
            v-else-if="item.id === 'android' && mode === 'direct'"
            type="button"
            class="add-device-modal__mode-btn"
            @click="emit('select', 'android-direct')"
          >
            <span>{{ t(`devices.addDeviceModal.androidModes.${mode}`) }}</span>
            <span class="add-device-modal__mode-badge">
              {{ t("devices.addDeviceModal.directConnect.action") }}
            </span>
          </button>
          <button
            v-else-if="item.id === 'android' && mode === 'pairCode'"
            type="button"
            class="add-device-modal__mode-btn"
            @click="emit('select', 'android-pair-code')"
          >
            <span>{{ t(`devices.addDeviceModal.androidModes.${mode}`) }}</span>
            <span class="add-device-modal__mode-badge">
              {{ t("devices.addDeviceModal.pairCode.action") }}
            </span>
          </button>
          <template v-else>
            <button
              v-if="item.id === 'android' && mode === 'qr'"
              type="button"
              class="add-device-modal__mode-btn"
              @click="emit('select', 'android-qr')"
            >
              <span>{{ t(`devices.addDeviceModal.androidModes.${mode}`) }}</span>
              <span class="add-device-modal__mode-badge">
                {{ t("devices.addDeviceModal.qr.action") }}
              </span>
            </button>
            <template v-else>
              <span>{{ t(`devices.addDeviceModal.androidModes.${mode}`) }}</span>
              <span class="add-device-modal__mode-badge">
                {{ t("devices.addDeviceModal.comingSoon") }}
              </span>
            </template>
          </template>
        </li>
      </ul>
    </article>
  </div>
</template>
