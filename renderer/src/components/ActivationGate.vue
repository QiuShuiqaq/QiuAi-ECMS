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

const statusText = computed(() => {
  if (props.isLoading) return '正在检查设备授权状态...'
  if (props.activationState.status === 'expired') return '检测到当前授权已过期，请重新购买授权。'
  if (props.activationState.status === 'device_mismatch') return '当前设备还没有可用授权，请购买授权后激活。'
  if (props.activationState.status === 'invalid') return '当前授权状态不可用，请重新购买授权。'
  return '点击顶部“购买授权”，完成支付后会自动尝试激活当前设备。'
})
</script>

<template>
  <section class="activation-gate">
    <div class="activation-gate__card activation-gate__card--empty">
      <div class="activation-gate__header activation-gate__header--centered">
        <span class="activation-gate__eyebrow">Device License</span>
        <strong>请购买授权激活设备</strong>
        <p>{{ statusText }}</p>
      </div>
    </div>
  </section>
</template>
