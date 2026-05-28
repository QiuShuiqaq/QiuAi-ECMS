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
  },
  closable: {
    type: Boolean,
    default: false
  }
})

const emit = defineEmits(['copy-device-code', 'import-license', 'refresh-license', 'close'])

const statusLabel = computed(() => {
  if (props.isLoading) {
    return '校验中'
  }

  if (props.activationState.status === 'activated') {
    return '已激活'
  }

  if (props.activationState.status === 'expired') {
    return '已过期'
  }

  if (props.activationState.status === 'mismatch') {
    return '设备不匹配'
  }

  if (props.activationState.status === 'invalid') {
    return '授权无效'
  }

  return '未激活'
})

const moduleList = computed(() => {
  return Array.isArray(props.activationState.modules) ? props.activationState.modules : []
})
</script>

<template>
  <section class="activation-gate">
    <div class="activation-gate__card">
      <div class="activation-gate__header">
        <div class="activation-gate__header-main">
          <span class="activation-gate__eyebrow">设备授权</span>
          <strong>QiuAi-ECMS 激活</strong>
          <p>当前版本使用离线签名授权。请复制设备码，在管理员授权工具中生成授权文件后导入。</p>
        </div>

        <button v-if="closable" type="button" class="secondary-action" @click="emit('close')">
          关闭
        </button>
      </div>

      <div class="activation-gate__status">
        <span class="activation-gate__status-label">状态</span>
        <span class="activation-gate__status-pill">{{ statusLabel }}</span>
      </div>

      <label class="activation-gate__field">
        <span>设备码</span>
        <textarea :value="activationState.deviceCode || ''" readonly rows="3" />
      </label>

      <div class="activation-gate__detail-grid">
        <label class="activation-gate__field">
          <span>客户名称</span>
          <input :value="activationState.customerName || '--'" type="text" readonly />
        </label>
        <label class="activation-gate__field">
          <span>授权版本</span>
          <input :value="activationState.edition || '--'" type="text" readonly />
        </label>
        <label class="activation-gate__field">
          <span>授权编号</span>
          <input :value="activationState.licenseId || '--'" type="text" readonly />
        </label>
        <label class="activation-gate__field">
          <span>激活时间</span>
          <input :value="activationState.activatedAt || '--'" type="text" readonly />
        </label>
        <label class="activation-gate__field">
          <span>到期时间</span>
          <input :value="activationState.expireAt || '永久'" type="text" readonly />
        </label>
        <label class="activation-gate__field">
          <span>许可版本上限</span>
          <input :value="activationState.maxVersion || '--'" type="text" readonly />
        </label>
      </div>

      <div v-if="moduleList.length" class="activation-gate__field">
        <span>已开通模块</span>
        <div class="activation-gate__tags">
          <span v-for="item in moduleList" :key="item">{{ item }}</span>
        </div>
      </div>

      <p class="activation-gate__message">
        {{ activationState.message || (activationState.status === 'activated' ? '已激活' : '未检测到授权文件') }}
      </p>

      <div class="activation-gate__actions">
        <button type="button" class="primary-action" @click="emit('copy-device-code')">
          复制设备码
        </button>
        <button type="button" class="primary-action" @click="emit('import-license')">
          导入授权文件
        </button>
        <button type="button" class="secondary-action" @click="emit('refresh-license')">
          刷新校验
        </button>
      </div>
    </div>
  </section>
</template>
