<script setup>
import { computed } from 'vue'

const props = defineProps({
  activationState: {
    type: Object,
    required: true
  },
  isLoading: {
    type: Boolean,
    default: false
  }
})

const titleText = '\u8bf7\u8d2d\u4e70\u6388\u6743\u6fc0\u6d3b\u8bbe\u5907'
const deviceCodeLabel = '\u8bbe\u5907\u7801'
const statusLabel = '\u5f53\u524d\u72b6\u6001'
const loadingText = '\u6b63\u5728\u68c0\u67e5\u8bbe\u5907\u6388\u6743\u72b6\u6001...'
const expiredText = '\u68c0\u6d4b\u5230\u5f53\u524d\u6388\u6743\u5df2\u8fc7\u671f\uff0c\u8bf7\u91cd\u65b0\u8d2d\u4e70\u6388\u6743\u3002'
const mismatchText = '\u5f53\u524d\u8bbe\u5907\u8fd8\u6ca1\u6709\u53ef\u7528\u6388\u6743\uff0c\u8bf7\u8d2d\u4e70\u6388\u6743\u540e\u518d\u6fc0\u6d3b\u3002'
const invalidText = '\u5f53\u524d\u6388\u6743\u72b6\u6001\u4e0d\u53ef\u7528\uff0c\u8bf7\u91cd\u65b0\u8d2d\u4e70\u6388\u6743\u3002'
const defaultText = '\u70b9\u51fb\u9876\u90e8\u201c\u8d2d\u4e70\u6388\u6743\u201d\uff0c\u5b8c\u6210\u652f\u4ed8\u540e\u7cfb\u7edf\u4f1a\u81ea\u52a8\u5c1d\u8bd5\u6fc0\u6d3b\u5f53\u524d\u8bbe\u5907\u3002'
const loadingDeviceCodeText = '\u8bfb\u53d6\u4e2d...'

const statusText = computed(() => {
  if (props.isLoading) return loadingText
  if (props.activationState.status === 'expired') return expiredText
  if (props.activationState.status === 'device_mismatch') return mismatchText
  if (props.activationState.status === 'invalid') return invalidText
  return defaultText
})

const deviceCodeText = computed(() => {
  return props.activationState.deviceCode || loadingDeviceCodeText
})
</script>

<template>
  <section class="activation-gate">
    <div class="activation-gate__card activation-gate__card--empty">
      <div class="activation-gate__header activation-gate__header--centered">
        <span class="activation-gate__eyebrow">Device License</span>
        <strong>{{ titleText }}</strong>
        <p>{{ statusText }}</p>
      </div>

      <div class="activation-gate__meta-grid">
        <div class="activation-gate__field">
          <span>{{ deviceCodeLabel }}</span>
          <strong>{{ deviceCodeText }}</strong>
        </div>
        <div class="activation-gate__field">
          <span>{{ statusLabel }}</span>
          <span class="activation-gate__status-pill">{{ activationState.status || 'pending' }}</span>
        </div>
      </div>
    </div>
  </section>
</template>
