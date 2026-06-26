<script setup>
import { computed } from 'vue'

const props = defineProps({
  activationState: {
    type: Object,
    required: true
  },
  formState: {
    type: Object,
    required: true
  },
  isLoading: {
    type: Boolean,
    default: false
  },
  isSubmitting: {
    type: Boolean,
    default: false
  }
})

const emit = defineEmits(['activate-remote', 'copy-device-code'])

const statusLabel = computed(() => {
  if (props.isLoading) return '校验中'
  if (props.activationState.status === 'activated') return '已授权'
  if (props.activationState.status === 'expired') return '已过期'
  if (props.activationState.status === 'device_mismatch') return '设备不匹配'
  if (props.activationState.status === 'invalid') return '授权无效'
  return '待授权'
})

function submitActivation() {
  emit('activate-remote', {
    customerName: props.formState.customerName,
    contact: props.formState.contact,
    inviteCode: props.formState.inviteCode
  })
}
</script>

<template>
  <section class="activation-gate">
    <div class="activation-gate__card">
      <div class="activation-gate__header">
        <span class="activation-gate__eyebrow">Device License</span>
        <strong>设备授权</strong>
        <p>先填写用户名和手机号，再完成授权购买或激活。</p>
      </div>

      <div class="activation-gate__meta-grid">
        <div class="activation-gate__status">
          <span class="activation-gate__status-label">当前状态</span>
          <span class="activation-gate__status-pill">{{ statusLabel }}</span>
        </div>

        <div class="activation-gate__status">
          <span class="activation-gate__status-label">授权模式</span>
          <span class="activation-gate__status-pill">{{ activationState.mode || 'server-license' }}</span>
        </div>
      </div>

      <div class="activation-gate__form">
        <label class="activation-gate__field">
          <span>用户名</span>
          <input v-model="formState.customerName" type="text" placeholder="请输入用户名">
        </label>

        <label class="activation-gate__field">
          <span>手机号</span>
          <input v-model="formState.contact" type="text" placeholder="请输入手机号">
        </label>
      </div>

      <details class="activation-gate__advanced">
        <summary>更多设置</summary>

        <div class="activation-gate__form activation-gate__form--advanced">
          <label class="activation-gate__field">
            <span>邀请码</span>
            <input v-model="formState.inviteCode" type="text" placeholder="没有可留空">
          </label>

          <label class="activation-gate__field">
            <span>设备码</span>
            <textarea :value="activationState.deviceCode || ''" readonly rows="3" />
          </label>
        </div>
      </details>

      <div class="activation-gate__actions">
        <button
          type="button"
          class="primary-action"
          :disabled="isLoading || isSubmitting"
          @click="submitActivation"
        >
          {{ isSubmitting ? '提交中' : '立即激活' }}
        </button>

        <button type="button" class="secondary-action" @click="emit('copy-device-code')">
          复制设备码
        </button>
      </div>
    </div>
  </section>
</template>
