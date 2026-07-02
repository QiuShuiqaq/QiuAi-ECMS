<script setup>
import { computed } from 'vue'

const props = defineProps({
  activationState: {
    type: Object,
    required: true
  },
  remoteServiceCapacity: {
    type: Object,
    default: null
  }
})

const emit = defineEmits(['copy-device-code', 'activate-permission', 'clear-permission'])

function resolveField(value, fallback = '--') {
  const text = String(value || '').trim()
  return text || fallback
}

const capabilitySummary = computed(() => {
  const activePackage = props.activationState?.activePackage || null
  const capability = activePackage?.capabilityConfig || null

  return {
    packageName: resolveField(activePackage?.name || activePackage?.code),
    editionLabel: resolveField(capability?.editionLabel),
    taskConcurrencyLimit: resolveField(capability?.taskConcurrencyLimit, '1'),
    authMode: resolveField(props.activationState?.mode, 'server-license')
  }
})
</script>

<template>
  <section class="account-device-page">
    <header class="account-device-page__hero">
      <div>
        <span class="account-device-page__eyebrow">Account</span>
        <h1>账户设备</h1>
      </div>
    </header>

    <div class="account-device-page__grid">
      <article class="account-device-page__card">
        <span>用户名</span>
        <strong>{{ resolveField(activationState.customerName) }}</strong>
      </article>
      <article class="account-device-page__card">
        <span>用户 ID</span>
        <strong>{{ resolveField(activationState.userId) }}</strong>
      </article>
      <article class="account-device-page__card">
        <span>授权 ID</span>
        <strong>{{ resolveField(activationState.licenseId) }}</strong>
      </article>
      <article class="account-device-page__card">
        <span>状态</span>
        <strong>{{ resolveField(activationState.status) }}</strong>
      </article>
    </div>

    <section class="account-device-page__panel">
      <header class="account-device-page__panel-header">
        <strong>设备</strong>
        <div class="account-device-page__panel-actions">
          <button class="secondary-action" type="button" @click="emit('activate-permission')">
            权限激活
          </button>
          <button class="secondary-action" type="button" @click="emit('clear-permission')">
            权限解除
          </button>
          <button class="secondary-action" type="button" @click="emit('copy-device-code')">
            复制设备码
          </button>
        </div>
      </header>
      <div class="account-device-page__detail-list">
        <div>
          <span>设备码</span>
          <strong>{{ resolveField(activationState.deviceCode) }}</strong>
        </div>
        <div>
          <span>激活时间</span>
          <strong>{{ resolveField(activationState.activatedAt) }}</strong>
        </div>
        <div>
          <span>到期时间</span>
          <strong>{{ resolveField(activationState.expiresAt) }}</strong>
        </div>
        <div>
          <span>远程状态</span>
          <strong>{{ resolveField(activationState.remoteStatus) }}</strong>
        </div>
      </div>
    </section>

    <section class="account-device-page__panel">
      <header class="account-device-page__panel-header">
        <strong>能力</strong>
      </header>
      <div class="account-device-page__detail-list">
        <div>
          <span>授权套餐</span>
          <strong>{{ capabilitySummary.packageName }}</strong>
        </div>
        <div>
          <span>授权版本</span>
          <strong>{{ capabilitySummary.editionLabel }}</strong>
        </div>
        <div>
          <span>任务并发上限</span>
          <strong>{{ capabilitySummary.taskConcurrencyLimit }}</strong>
        </div>
        <div>
          <span>授权模式</span>
          <strong>{{ capabilitySummary.authMode }}</strong>
        </div>
      </div>
    </section>
  </section>
</template>

<style scoped>
.account-device-page {
  display: flex;
  flex-direction: column;
  gap: 18px;
}

.account-device-page__hero,
.account-device-page__card,
.account-device-page__panel {
  border: 1px solid rgba(255, 255, 255, 0.08);
  background: rgba(14, 18, 30, 0.88);
  border-radius: 22px;
}

.account-device-page__hero,
.account-device-page__panel {
  padding: 22px;
}

.account-device-page__hero h1,
.account-device-page__panel-header {
  margin: 0;
}

.account-device-page__card span,
.account-device-page__detail-list span {
  color: rgba(205, 214, 238, 0.76);
}

.account-device-page__eyebrow {
  display: inline-flex;
  margin-bottom: 10px;
  font-size: 12px;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: rgba(118, 173, 255, 0.88);
}

.account-device-page__grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 14px;
}

.account-device-page__card {
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 18px;
}

.account-device-page__panel-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 16px;
}

.account-device-page__panel-actions {
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
}

.account-device-page__detail-list {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 14px;
  margin-top: 16px;
}

.account-device-page__detail-list div {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 14px 16px;
  border-radius: 16px;
  background: rgba(9, 13, 23, 0.72);
}

@media (max-width: 1080px) {
  .account-device-page__grid,
  .account-device-page__detail-list {
    grid-template-columns: 1fr;
  }

  .account-device-page__panel-header {
    flex-direction: column;
    align-items: flex-start;
  }
}
</style>
