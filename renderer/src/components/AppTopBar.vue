<script setup>
import { openExternalResource } from '../services/desktopBridge'

defineProps({
  brandLabel: {
    type: String,
    required: true
  },
  activationSummary: {
    type: Object,
    default: null
  },
  rechargeEnabled: {
    type: Boolean,
    default: false
  }
})

const emit = defineEmits([
  'cleanup-click',
  'purchase-license-click',
  'purchase-compute-click',
  'purchase-recharge-click',
  'show-model-pricing-click'
])

const websiteLabel = 'qiuaihub.com'
const websiteUrl = 'https://qiuaihub.com'

async function openOfficialWebsite() {
  try {
    await openExternalResource({ target: websiteUrl })
  } catch {
    if (typeof window !== 'undefined') {
      window.open(websiteUrl, '_blank', 'noopener,noreferrer')
    }
  }
}
</script>

<template>
  <header class="topbar-shell topbar-shell--compact">
    <div class="brand-button" role="img" aria-label="QiuAi">
      <span class="brand-mark">Q</span>
      <span class="brand-copy-wrap">
        <span class="brand-copy">{{ brandLabel }}</span>
        <span class="brand-meta">ECMS Studio</span>
      </span>
    </div>

    <div class="topbar-right-actions">
      <button class="topbar-recharge-button" type="button" @click="emit('purchase-license-click')">
        授权购买
      </button>

      <button class="topbar-recharge-button topbar-recharge-button--secondary" type="button" @click="emit('purchase-compute-click')">
        算力购买
      </button>

      <button class="topbar-recharge-button topbar-recharge-button--secondary" type="button" @click="emit('purchase-recharge-click')">
        算力直充
      </button>

      <button class="topbar-recharge-button topbar-recharge-button--secondary" type="button" @click="emit('show-model-pricing-click')">
        模型价格
      </button>

      <div v-if="activationSummary" class="topbar-activation-pill">
        <span>已授权</span>
        <strong>{{ activationSummary.customerName || '当前设备' }}</strong>
      </div>

      <button class="topbar-clean-button" type="button" aria-label="清理缓存" @click="emit('cleanup-click')">
        清理缓存
      </button>

      <div class="topbar-contact-actions">
        <button
          class="topbar-contact-button topbar-contact-button--link"
          type="button"
          :aria-label="websiteLabel"
          :title="websiteLabel"
          @click="openOfficialWebsite"
        >
          <span>{{ websiteLabel }}</span>
        </button>
      </div>
    </div>
  </header>
</template>
