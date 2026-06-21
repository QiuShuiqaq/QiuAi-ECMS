<script setup>
import { computed, reactive } from 'vue'

const props = defineProps({
  activationState: {
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

const emit = defineEmits([
  'activate-remote',
  'copy-device-code'
])

const formState = reactive({
  customerName: '',
  contact: '',
  inviteCode: ''
})

const statusLabel = computed(() => {
  if (props.isLoading) {
    return '校验中'
  }
  if (props.activationState.status === 'activated') {
    return '已授权'
  }
  if (props.activationState.status === 'expired') {
    return '已过期'
  }
  if (props.activationState.status === 'device_mismatch') {
    return '设备不匹配'
  }
  if (props.activationState.status === 'invalid') {
    return '授权无效'
  }
  if (props.activationState.status === 'not_logged_in') {
    return '待激活'
  }
  return '待授权'
})

const primaryMessage = computed(() => {
  if (props.activationState.message) {
    return props.activationState.message
  }
  if (props.activationState.status === 'activated') {
    return '当前设备已通过授权校验'
  }
  if (props.activationState.status === 'expired') {
    return '当前授权已过期，请续费后重新激活'
  }
  if (props.activationState.status === 'device_mismatch') {
    return '当前设备与已绑定设备不一致，请联系管理员处理换机'
  }
  if (props.activationState.status === 'invalid') {
    return '授权信息无效，请重新获取授权'
  }
  return '输入基础信息后即可激活当前设备'
})

function submitActivation() {
  emit('activate-remote', {
    customerName: formState.customerName,
    contact: formState.contact,
    inviteCode: formState.inviteCode
  })
}
</script>

<template>
  <section class="activation-gate">
    <div class="activation-gate__card">
      <div class="activation-gate__header">
        <span class="activation-gate__eyebrow">设备授权</span>
        <strong>QiuAi 授权</strong>
        <p>{{ primaryMessage }}</p>
      </div>

      <div class="activation-gate__meta-grid">
        <div class="activation-gate__status">
          <span class="activation-gate__status-label">状态</span>
          <span class="activation-gate__status-pill">{{ statusLabel }}</span>
        </div>

        <div class="activation-gate__status">
          <span class="activation-gate__status-label">授权模式</span>
          <span class="activation-gate__status-pill">{{ activationState.mode || 'server-license' }}</span>
        </div>
      </div>

      <div class="activation-gate__form">
        <label class="activation-gate__field">
          <span>姓名</span>
          <input v-model="formState.customerName" type="text" placeholder="请输入姓名">
        </label>

        <label class="activation-gate__field">
          <span>联系方式</span>
          <input v-model="formState.contact" type="text" placeholder="请输入手机号或微信">
        </label>

        <label class="activation-gate__field">
          <span>邀请码</span>
          <input v-model="formState.inviteCode" type="text" placeholder="没有可留空">
        </label>

        <label class="activation-gate__field">
          <span>设备码</span>
          <textarea :value="activationState.deviceCode || ''" readonly rows="3" />
        </label>
      </div>

      <div class="activation-gate__actions">
        <button
          type="button"
          class="primary-action"
          :disabled="isLoading || isSubmitting"
          @click="submitActivation"
        >
          {{ isSubmitting ? '激活中' : '立即激活' }}
        </button>

        <button type="button" class="secondary-action" @click="emit('copy-device-code')">
          复制设备码
        </button>
      </div>
    </div>
  </section>
</template>
