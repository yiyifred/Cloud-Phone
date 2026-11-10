<script setup>
import { watch } from "vue";
import { NFormItem, NSpace } from "naive-ui";

import HelpHint from "../ui/HelpHint.vue";
import MirrorSettingHelp from "./MirrorSettingHelp.vue";

defineProps({
  label: {
    type: String,
    required: true,
  },
  help: {
    type: String,
    default: "",
  },
  variant: {
    type: String,
    default: "field",
    validator: (value) => ["field", "checkbox", "banner"].includes(value),
  },
  nested: {
    type: Boolean,
    default: false,
  },
});
</script>

<template>
  <div v-if="variant === 'banner'" class="mirror-setting-banner">
    <span>{{ label }}</span>
    <HelpHint v-if="help" :content="help" :title="label" size="sm" />
  </div>

  <div v-else class="mirror-setting-row" :class="{ 'mirror-setting-row--nested': nested }">
    <label class="mirror-setting-row__label" :title="label">{{ label }}</label>
    <div class="mirror-setting-row__control">
      <slot />
    </div>
    <MirrorSettingHelp v-if="help" :text="help" />
  </div>
</template>
