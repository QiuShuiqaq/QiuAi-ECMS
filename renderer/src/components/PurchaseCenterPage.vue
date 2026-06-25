<script setup>
import { computed } from 'vue'

const props = defineProps({
  activationState: {
    type: Object,
    required: true
  },
  walletSummary: {
    type: Object,
    default: null
  },
  softwarePackages: {
    type: Array,
    default: () => []
  },
  computePackages: {
    type: Array,
    default: () => []
  },
  currentSoftwareOrder: {
    type: Object,
    default: null
  },
  currentComputePackageOrder: {
    type: Object,
    default: null
  },
  currentRechargeOrder: {
    type: Object,
    default: null
  },
  rechargeForm: {
    type: Object,
    default: () => ({
      walletType: 'image',
      channel: 'alipay',
      amountCny: '0.01',
      couponCode: ''
    })
  },
  isCatalogLoading: {
    type: Boolean,
    default: false
  },
  isRechargeSubmitting: {
    type: Boolean,
    default: false
  },
  isSoftwareOrderSubmitting: {
    type: Boolean,
    default: false
  },
  isSoftwareOrderRefreshing: {
    type: Boolean,
    default: false
  },
  isComputePackageOrderSubmitting: {
    type: Boolean,
    default: false
  },
  isComputePackageOrderRefreshing: {
    type: Boolean,
    default: false
  },
  isRechargeRefreshing: {
    type: Boolean,
    default: false
  },
  embedded: {
    type: Boolean,
    default: false
  }
})

const emit = defineEmits([
  'refresh-catalog',
  'create-software-order',
  'refresh-software-order',
  'open-software-order',
  'create-compute-package-order',
  'refresh-compute-package-order',
  'open-compute-package-order',
  'update-recharge-form',
  'create-recharge',
  'refresh-recharge-order',
  'open-recharge-order'
])

const walletCards = computed(() => {
  const summary = props.walletSummary || {}
  return [
    { key: 'text', label: '文本余额', value: Number(summary.textBalanceCny || 0) },
    { key: 'image', label: '图片余额', value: Number(summary.imageBalanceCny || 0) },
    { key: 'video', label: '视频余额', value: Number(summary.videoBalanceCny || 0) }
  ]
})

const licenseStatusLabel = computed(() => {
  const status = String(props.activationState?.status || '')
  if (status === 'activated') return '已激活'
  if (status === 'expired') return '已过期'
  if (status === 'device_mismatch') return '设备不匹配'
  return '待激活'
})

const canUseLockedCommerce = computed(() => props.activationState?.status === 'activated')

function formatAmount(value) {
  const numericValue = Number(value || 0)
  return Number.isFinite(numericValue) ? numericValue.toFixed(2) : '0.00'
}

function formatDateTime(value) {
  if (!value) return '--'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '--'
  return date.toLocaleString('zh-CN', { hour12: false })
}

function resolveOrderStatusLabel(status) {
  if (status === 'paid') return '已支付'
  if (status === 'failed') return '失败'
  if (status === 'closed') return '已关闭'
  return '待支付'
}

function resolveTextPriorityLabel(value) {
  return String(value || '').trim().toUpperCase() === 'HIGH' ? '高优先级' : '标准'
}

function resolvePackageFeatures(pkg = {}) {
  const features = []
  const primaryServicePlan = pkg.primaryServicePlan || null

  if (pkg.durationDays) features.push(`时长 ${pkg.durationDays} 天`)
  if (pkg.deviceLimit) features.push(`设备 ${pkg.deviceLimit}`)
  if (Array.isArray(pkg.entitlementSummary) && pkg.entitlementSummary.length) {
    features.push(...pkg.entitlementSummary)
  }
  if (Number(pkg.includedTextBalanceCny || 0) > 0) features.push(`文本余额 ${formatAmount(pkg.includedTextBalanceCny)}`)
  if (Number(pkg.includedImageBalanceCny || 0) > 0) features.push(`图片余额 ${formatAmount(pkg.includedImageBalanceCny)}`)
  if (Number(pkg.includedVideoBalanceCny || 0) > 0) features.push(`视频余额 ${formatAmount(pkg.includedVideoBalanceCny)}`)
  if (pkg.overageEnabled) features.push('支持充值')
  if (pkg.tier === 'MEMBER') features.push('会员算力')
  if (pkg.tier === 'STANDARD') features.push('标准算力')
  if (primaryServicePlan?.tier) features.push(`服务档位 ${primaryServicePlan.tier}`)
  if (primaryServicePlan?.imageConcurrencyLimit > 0) features.push(`图片并发 ${primaryServicePlan.imageConcurrencyLimit}`)
  if (typeof primaryServicePlan?.videoConcurrencyLimit === 'number') features.push(`视频并发 ${primaryServicePlan.videoConcurrencyLimit}`)
  if (primaryServicePlan?.textPriorityClass) features.push(`文本优先级 ${resolveTextPriorityLabel(primaryServicePlan.textPriorityClass)}`)
  if (primaryServicePlan?.canBurst) features.push('支持突发')

  return features
}

function updateRechargeField(field, value) {
  emit('update-recharge-form', { field, value })
}
</script>

<template>
  <section class="purchase-center" :class="{ 'purchase-center--embedded': embedded }">
    <header class="purchase-center__hero">
      <div class="purchase-center__hero-main">
        <span class="purchase-center__eyebrow">Purchase Center</span>
        <h1>购买中心</h1>
      </div>

      <div class="purchase-center__hero-side">
        <div class="purchase-center__license-card">
          <span>当前授权</span>
          <strong>{{ activationState.customerName || '未命名客户' }}</strong>
          <div class="purchase-center__license-meta">
            <span>{{ licenseStatusLabel }}</span>
            <span>到期 {{ activationState.expiresAt ? formatDateTime(activationState.expiresAt) : '长期或未设置' }}</span>
          </div>
        </div>

        <div class="purchase-center__wallet-grid">
          <article v-for="card in walletCards" :key="card.key" class="purchase-center__wallet-card">
            <span>{{ card.label }}</span>
            <strong>{{ formatAmount(card.value) }}</strong>
            <small>CNY</small>
          </article>
        </div>
      </div>
    </header>

    <section v-if="canUseLockedCommerce" class="purchase-center__section">
      <div class="purchase-center__section-header">
        <div>
          <span class="purchase-center__section-kicker">Recharge</span>
          <h2>充值</h2>
        </div>
      </div>

      <div class="purchase-center__recharge-card">
        <div class="purchase-center__recharge-main">
          <strong>充值订单</strong>
          <div v-if="currentRechargeOrder" class="purchase-center__recharge-order">
            <span>订单 {{ currentRechargeOrder.merchantOrderNo }}</span>
            <span>状态 {{ resolveOrderStatusLabel(currentRechargeOrder.status) }}</span>
            <span>金额 {{ formatAmount(currentRechargeOrder.payAmountCny) }} CNY</span>
          </div>
        </div>

        <div class="purchase-center__recharge-form">
          <label class="purchase-center__field">
            <span>钱包</span>
            <select :value="rechargeForm.walletType" @change="updateRechargeField('walletType', $event.target.value)">
              <option value="image">图片余额</option>
              <option value="video">视频余额</option>
            </select>
          </label>
          <label class="purchase-center__field">
            <span>渠道</span>
            <select :value="rechargeForm.channel" @change="updateRechargeField('channel', $event.target.value)">
              <option value="alipay">支付宝</option>
              <option value="wechat">微信</option>
            </select>
          </label>
          <label class="purchase-center__field">
            <span>金额</span>
            <input :value="rechargeForm.amountCny" type="number" min="0.01" step="0.01" @input="updateRechargeField('amountCny', $event.target.value)">
          </label>
          <label class="purchase-center__field">
            <span>优惠码</span>
            <input :value="rechargeForm.couponCode" type="text" placeholder="选填" @input="updateRechargeField('couponCode', $event.target.value)">
          </label>
        </div>

        <div class="purchase-center__order-actions">
          <button class="primary-action" type="button" :disabled="isRechargeSubmitting" @click="emit('create-recharge')">
            {{ isRechargeSubmitting ? '创建中' : '创建充值单' }}
          </button>
          <button class="secondary-action" type="button" :disabled="!currentRechargeOrder || isRechargeRefreshing" @click="emit('refresh-recharge-order')">
            {{ isRechargeRefreshing ? '刷新中' : '刷新订单' }}
          </button>
          <button class="secondary-action" type="button" :disabled="!currentRechargeOrder?.paymentPayload?.mockPayUrl" @click="emit('open-recharge-order')">
            打开支付
          </button>
        </div>
      </div>
    </section>

    <section v-if="canUseLockedCommerce" class="purchase-center__section">
      <div class="purchase-center__section-header">
        <div>
          <span class="purchase-center__section-kicker">Compute Plans</span>
          <h2>算力套餐</h2>
        </div>
        <button class="secondary-action" type="button" :disabled="isCatalogLoading" @click="emit('refresh-catalog')">
          {{ isCatalogLoading ? '刷新中' : '刷新套餐' }}
        </button>
      </div>

      <div class="purchase-center__package-list">
        <article v-for="pkg in computePackages" :key="pkg.id" class="purchase-center__package-card">
          <div class="purchase-center__package-main">
            <div class="purchase-center__package-heading">
              <strong>{{ pkg.name }}</strong>
              <span>{{ pkg.productName }}</span>
            </div>
            <p>{{ pkg.description || '--' }}</p>
            <div class="purchase-center__feature-row">
              <span v-for="feature in resolvePackageFeatures(pkg)" :key="`${pkg.id}-${feature}`">{{ feature }}</span>
            </div>
          </div>

          <div class="purchase-center__package-side">
            <strong class="purchase-center__price">{{ formatAmount(pkg.priceAmount) }}</strong>
            <small>{{ pkg.currency || 'CNY' }}</small>
            <button class="primary-action" type="button" :disabled="isComputePackageOrderSubmitting || pkg.canPurchase === false" @click="emit('create-compute-package-order', pkg.id)">
              {{ pkg.canPurchase === false ? '当前不可购买' : (isComputePackageOrderSubmitting ? '创建中' : '购买套餐') }}
            </button>
            <small v-if="pkg.canPurchase === false" class="purchase-center__blocked-tip">
              {{ pkg.purchaseBlockedReason || '当前授权不可购买' }}
            </small>
          </div>
        </article>

        <article v-if="!computePackages.length" class="purchase-center__empty">
          <strong>暂无算力套餐</strong>
        </article>
      </div>

      <div v-if="currentComputePackageOrder" class="purchase-center__order-panel">
        <div class="purchase-center__order-info">
          <strong>最近算力订单</strong>
          <span>订单 {{ currentComputePackageOrder.merchantOrderNo }}</span>
          <span>状态 {{ resolveOrderStatusLabel(currentComputePackageOrder.status) }}</span>
          <span>金额 {{ formatAmount(currentComputePackageOrder.amountCny) }} CNY</span>
        </div>

        <div class="purchase-center__order-actions">
          <button class="secondary-action" type="button" :disabled="isComputePackageOrderRefreshing" @click="emit('refresh-compute-package-order')">
            {{ isComputePackageOrderRefreshing ? '刷新中' : '刷新订单' }}
          </button>
          <button class="secondary-action" type="button" :disabled="!currentComputePackageOrder.paymentPayload?.mockPayUrl" @click="emit('open-compute-package-order')">
            打开支付
          </button>
        </div>
      </div>
    </section>

    <section class="purchase-center__section">
      <div class="purchase-center__section-header">
        <div>
          <span class="purchase-center__section-kicker">Software License</span>
          <h2>软件授权</h2>
        </div>
      </div>

      <div class="purchase-center__package-list">
        <article v-for="pkg in softwarePackages" :key="pkg.id" class="purchase-center__package-card">
          <div class="purchase-center__package-main">
            <div class="purchase-center__package-heading">
              <strong>{{ pkg.name }}</strong>
              <span>{{ pkg.productName }}</span>
            </div>
            <p>{{ pkg.description || '--' }}</p>
            <div class="purchase-center__feature-row">
              <span v-for="feature in resolvePackageFeatures(pkg)" :key="`${pkg.id}-${feature}`">{{ feature }}</span>
            </div>
          </div>

          <div class="purchase-center__package-side">
            <strong class="purchase-center__price">{{ formatAmount(pkg.priceAmount) }}</strong>
            <small>{{ pkg.currency || 'CNY' }}</small>
            <button class="primary-action" type="button" :disabled="isSoftwareOrderSubmitting" @click="emit('create-software-order', pkg.id)">
              {{ isSoftwareOrderSubmitting ? '创建中' : '购买授权' }}
            </button>
          </div>
        </article>

        <article v-if="!softwarePackages.length" class="purchase-center__empty">
          <strong>暂无授权套餐</strong>
        </article>
      </div>

      <div v-if="currentSoftwareOrder" class="purchase-center__order-panel">
        <div class="purchase-center__order-info">
          <strong>最近授权订单</strong>
          <span>订单 {{ currentSoftwareOrder.merchantOrderNo }}</span>
          <span>状态 {{ resolveOrderStatusLabel(currentSoftwareOrder.status) }}</span>
          <span>金额 {{ formatAmount(currentSoftwareOrder.amountCny || currentSoftwareOrder.effectiveSalePriceCny) }} CNY</span>
        </div>

        <div class="purchase-center__order-actions">
          <button class="secondary-action" type="button" :disabled="isSoftwareOrderRefreshing" @click="emit('refresh-software-order')">
            {{ isSoftwareOrderRefreshing ? '刷新中' : '刷新订单' }}
          </button>
          <button class="secondary-action" type="button" :disabled="!currentSoftwareOrder.paymentPayload?.mockPayUrl" @click="emit('open-software-order')">
            打开支付
          </button>
        </div>
      </div>
    </section>
  </section>
</template>

<style scoped>
.purchase-center {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.purchase-center--embedded {
  gap: 18px;
}

.purchase-center__hero {
  display: grid;
  grid-template-columns: minmax(0, 1.15fr) minmax(320px, 0.85fr);
  gap: 18px;
  align-items: stretch;
}

.purchase-center__hero-main h1,
.purchase-center__section-header h2 {
  margin: 0;
}

.purchase-center__eyebrow,
.purchase-center__section-kicker {
  display: inline-flex;
  margin-bottom: 10px;
  font-size: 12px;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: rgba(118, 173, 255, 0.88);
}

.purchase-center__hero-side {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.purchase-center__license-card,
.purchase-center__wallet-card,
.purchase-center__section,
.purchase-center__order-panel,
.purchase-center__recharge-card,
.purchase-center__empty {
  border-radius: 22px;
  border: 1px solid rgba(255, 255, 255, 0.08);
  background: rgba(14, 18, 30, 0.88);
}

.purchase-center__license-card {
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 20px;
}

.purchase-center__license-card strong {
  font-size: 24px;
}

.purchase-center__license-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 10px 14px;
  color: rgba(205, 214, 238, 0.74);
  font-size: 13px;
}

.purchase-center__wallet-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 12px;
}

.purchase-center__wallet-card {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 16px;
}

.purchase-center__wallet-card strong {
  font-size: 22px;
}

.purchase-center__wallet-card small {
  color: rgba(205, 214, 238, 0.72);
}

.purchase-center__section {
  display: flex;
  flex-direction: column;
  gap: 18px;
  padding: 20px;
}

.purchase-center__section-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
}

.purchase-center__package-list {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.purchase-center__package-card {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 240px;
  gap: 16px;
  padding: 18px;
  border-radius: 18px;
  background: rgba(9, 13, 23, 0.72);
}

.purchase-center__package-heading {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px 12px;
}

.purchase-center__package-heading strong {
  font-size: 18px;
}

.purchase-center__package-heading span,
.purchase-center__package-main p,
.purchase-center__empty span,
.purchase-center__recharge-main p {
  color: rgba(205, 214, 238, 0.72);
}

.purchase-center__package-main p,
.purchase-center__recharge-main p {
  margin: 10px 0 0;
}

.purchase-center__feature-row {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 12px;
}

.purchase-center__feature-row span {
  padding: 6px 10px;
  border-radius: 999px;
  background: rgba(118, 173, 255, 0.12);
  color: rgba(220, 230, 248, 0.92);
  font-size: 12px;
  line-height: 1.2;
}

.purchase-center__package-side {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  justify-content: center;
  gap: 10px;
}

.purchase-center__price {
  font-size: 28px;
}

.purchase-center__order-panel,
.purchase-center__recharge-card {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(280px, 0.9fr) 220px;
  gap: 18px;
  padding: 18px;
}

.purchase-center__order-info,
.purchase-center__recharge-main {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.purchase-center__recharge-form {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
  align-content: flex-start;
}

.purchase-center__field {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.purchase-center__field span {
  color: rgba(205, 214, 238, 0.76);
  font-size: 13px;
}

.purchase-center__field input,
.purchase-center__field select {
  width: 100%;
}

.purchase-center__order-info strong,
.purchase-center__recharge-main strong {
  font-size: 18px;
}

.purchase-center__order-actions {
  display: flex;
  flex-direction: column;
  justify-content: center;
  gap: 10px;
}

.purchase-center__recharge-order {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 12px 14px;
  border-radius: 14px;
  background: rgba(118, 173, 255, 0.08);
  color: rgba(223, 232, 246, 0.9);
}

.purchase-center__empty {
  padding: 20px;
}

.purchase-center__blocked-tip {
  color: rgba(255, 195, 126, 0.92);
  text-align: right;
}

@media (max-width: 1180px) {
  .purchase-center__hero,
  .purchase-center__package-card,
  .purchase-center__order-panel,
  .purchase-center__recharge-card {
    grid-template-columns: 1fr;
  }

  .purchase-center__wallet-grid {
    grid-template-columns: 1fr;
  }

  .purchase-center__recharge-form {
    grid-template-columns: 1fr;
  }

  .purchase-center__package-side,
  .purchase-center__order-actions {
    align-items: stretch;
  }
}
</style>
