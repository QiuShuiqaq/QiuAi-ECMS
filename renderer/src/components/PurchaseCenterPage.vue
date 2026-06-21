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
    { key: 'text', label: 'Text Balance', value: Number(summary.textBalanceCny || 0) },
    { key: 'image', label: 'Image Balance', value: Number(summary.imageBalanceCny || 0) },
    { key: 'video', label: 'Video Balance', value: Number(summary.videoBalanceCny || 0) }
  ]
})

const licenseStatusLabel = computed(() => {
  const status = String(props.activationState?.status || '')
  if (status === 'activated') return 'Activated'
  if (status === 'expired') return 'Expired'
  if (status === 'device_mismatch') return 'Device mismatch'
  return 'Pending activation'
})

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
  if (status === 'paid') return 'Paid'
  if (status === 'failed') return 'Failed'
  if (status === 'closed') return 'Closed'
  return 'Pending'
}

function resolveTextPriorityLabel(value) {
  return String(value || '').trim().toUpperCase() === 'HIGH' ? 'High' : 'Standard'
}

function resolvePackageFeatures(pkg = {}) {
  const features = []
  const primaryServicePlan = pkg.primaryServicePlan || null

  if (pkg.durationDays) features.push(`Duration ${pkg.durationDays} days`)
  if (pkg.deviceLimit) features.push(`Devices ${pkg.deviceLimit}`)
  if (Array.isArray(pkg.entitlementSummary) && pkg.entitlementSummary.length) {
    features.push(...pkg.entitlementSummary)
  }
  if (Number(pkg.includedTextBalanceCny || 0) > 0) features.push(`Text balance ${formatAmount(pkg.includedTextBalanceCny)} CNY`)
  if (Number(pkg.includedImageBalanceCny || 0) > 0) features.push(`Image balance ${formatAmount(pkg.includedImageBalanceCny)} CNY`)
  if (Number(pkg.includedVideoBalanceCny || 0) > 0) features.push(`Video balance ${formatAmount(pkg.includedVideoBalanceCny)} CNY`)
  if (pkg.overageEnabled) features.push('Overage recharge enabled')
  if (pkg.tier === 'MEMBER') features.push('Member compute package')
  if (pkg.tier === 'STANDARD') features.push('Standard compute package')
  if (primaryServicePlan?.tier) features.push(`Service tier ${primaryServicePlan.tier}`)
  if (primaryServicePlan?.imageConcurrencyLimit > 0) {
    features.push(`Image concurrency ${primaryServicePlan.imageConcurrencyLimit}`)
  }
  if (typeof primaryServicePlan?.videoConcurrencyLimit === 'number') {
    features.push(`Video concurrency ${primaryServicePlan.videoConcurrencyLimit}`)
  }
  if (primaryServicePlan?.textPriorityClass) {
    features.push(`Text priority ${resolveTextPriorityLabel(primaryServicePlan.textPriorityClass)}`)
  }
  if (primaryServicePlan?.canBurst) features.push('Burst enabled')
  if (Array.isArray(pkg.linkedServicePlans) && pkg.linkedServicePlans.length > 1) {
    features.push(`Linked service plans ${pkg.linkedServicePlans.length}`)
  }

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
        <h1>Licenses, compute plans, and direct recharge</h1>
        <p>
          Manage software licenses, monthly compute packages, and direct balance recharge in one place.
          After payment, the client can refresh the latest order and entitlement state here.
        </p>
      </div>

      <div class="purchase-center__hero-side">
        <div class="purchase-center__license-card">
          <span>Current license</span>
          <strong>{{ activationState.customerName || 'Unnamed customer' }}</strong>
          <div class="purchase-center__license-meta">
            <span>{{ licenseStatusLabel }}</span>
            <span>Expires: {{ activationState.expiresAt ? formatDateTime(activationState.expiresAt) : 'Permanent or not set' }}</span>
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

    <section class="purchase-center__section">
      <div class="purchase-center__section-header">
        <div>
          <span class="purchase-center__section-kicker">Recharge</span>
          <h2>Direct balance top-up</h2>
        </div>
      </div>

      <div class="purchase-center__recharge-card">
        <div class="purchase-center__recharge-main">
          <strong>Image / video direct recharge</strong>
          <p>Best for users who already have a valid license and only need more generation balance.</p>
          <div v-if="currentRechargeOrder" class="purchase-center__recharge-order">
            <span>Latest order: {{ currentRechargeOrder.merchantOrderNo }}</span>
            <span>Status: {{ resolveOrderStatusLabel(currentRechargeOrder.status) }}</span>
            <span>Amount: {{ formatAmount(currentRechargeOrder.payAmountCny) }} CNY</span>
          </div>
        </div>

        <div class="purchase-center__recharge-form">
          <label class="purchase-center__field">
            <span>Wallet</span>
            <select :value="rechargeForm.walletType" @change="updateRechargeField('walletType', $event.target.value)">
              <option value="image">Image balance</option>
              <option value="video">Video balance</option>
            </select>
          </label>
          <label class="purchase-center__field">
            <span>Channel</span>
            <select :value="rechargeForm.channel" @change="updateRechargeField('channel', $event.target.value)">
              <option value="alipay">Alipay</option>
              <option value="wechat">WeChat</option>
            </select>
          </label>
          <label class="purchase-center__field">
            <span>Amount</span>
            <input :value="rechargeForm.amountCny" type="number" min="0.01" step="0.01" @input="updateRechargeField('amountCny', $event.target.value)">
          </label>
          <label class="purchase-center__field">
            <span>Coupon</span>
            <input :value="rechargeForm.couponCode" type="text" placeholder="Optional" @input="updateRechargeField('couponCode', $event.target.value)">
          </label>
        </div>

        <div class="purchase-center__order-actions">
          <button class="primary-action" type="button" :disabled="isRechargeSubmitting" @click="emit('create-recharge')">
            {{ isRechargeSubmitting ? 'Creating' : 'Create recharge order' }}
          </button>
          <button
            class="secondary-action"
            type="button"
            :disabled="!currentRechargeOrder || isRechargeRefreshing"
            @click="emit('refresh-recharge-order')"
          >
            {{ isRechargeRefreshing ? 'Refreshing' : 'Refresh order' }}
          </button>
          <button
            class="secondary-action"
            type="button"
            :disabled="!currentRechargeOrder?.paymentPayload?.mockPayUrl"
            @click="emit('open-recharge-order')"
          >
            Open payment
          </button>
        </div>
      </div>
    </section>

    <section class="purchase-center__section">
      <div class="purchase-center__section-header">
        <div>
          <span class="purchase-center__section-kicker">Compute Plans</span>
          <h2>Monthly compute packages</h2>
        </div>
        <button class="secondary-action" type="button" :disabled="isCatalogLoading" @click="emit('refresh-catalog')">
          {{ isCatalogLoading ? 'Refreshing' : 'Refresh catalog' }}
        </button>
      </div>

      <div class="purchase-center__package-list">
        <article v-for="pkg in computePackages" :key="pkg.id" class="purchase-center__package-card">
          <div class="purchase-center__package-main">
            <div class="purchase-center__package-heading">
              <strong>{{ pkg.name }}</strong>
              <span>{{ pkg.productName }}</span>
            </div>
            <p>{{ pkg.description || 'No description' }}</p>
            <div class="purchase-center__feature-row">
              <span v-for="feature in resolvePackageFeatures(pkg)" :key="`${pkg.id}-${feature}`">{{ feature }}</span>
            </div>
          </div>

          <div class="purchase-center__package-side">
            <strong class="purchase-center__price">{{ formatAmount(pkg.priceAmount) }}</strong>
            <small>{{ pkg.currency || 'CNY' }}</small>
            <button
              class="primary-action"
              type="button"
              :disabled="isComputePackageOrderSubmitting || pkg.canPurchase === false"
              @click="emit('create-compute-package-order', pkg.id)"
            >
              {{ pkg.canPurchase === false ? 'Not available for current license' : (isComputePackageOrderSubmitting ? 'Creating' : 'Buy compute package') }}
            </button>
            <small v-if="pkg.canPurchase === false" class="purchase-center__blocked-tip">
              {{ pkg.purchaseBlockedReason || 'Current license edition cannot buy this compute package' }}
            </small>
          </div>
        </article>

        <article v-if="!computePackages.length" class="purchase-center__empty">
          <strong>No monthly compute packages available</strong>
          <span>When the platform exposes compute packages, they will appear here.</span>
        </article>
      </div>

      <div v-if="currentComputePackageOrder" class="purchase-center__order-panel">
        <div class="purchase-center__order-info">
          <strong>Latest compute package order</strong>
          <span>Order No: {{ currentComputePackageOrder.merchantOrderNo }}</span>
          <span>Status: {{ resolveOrderStatusLabel(currentComputePackageOrder.status) }}</span>
          <span>Amount: {{ formatAmount(currentComputePackageOrder.amountCny) }} CNY</span>
        </div>

        <div class="purchase-center__order-actions">
          <button
            class="secondary-action"
            type="button"
            :disabled="isComputePackageOrderRefreshing"
            @click="emit('refresh-compute-package-order')"
          >
            {{ isComputePackageOrderRefreshing ? 'Refreshing' : 'Refresh order' }}
          </button>
          <button
            class="secondary-action"
            type="button"
            :disabled="!currentComputePackageOrder.paymentPayload?.mockPayUrl"
            @click="emit('open-compute-package-order')"
          >
            Open payment
          </button>
        </div>
      </div>
    </section>

    <section class="purchase-center__section">
      <div class="purchase-center__section-header">
        <div>
          <span class="purchase-center__section-kicker">Software License</span>
          <h2>License packages</h2>
        </div>
      </div>

      <div class="purchase-center__package-list">
        <article v-for="pkg in softwarePackages" :key="pkg.id" class="purchase-center__package-card">
          <div class="purchase-center__package-main">
            <div class="purchase-center__package-heading">
              <strong>{{ pkg.name }}</strong>
              <span>{{ pkg.productName }}</span>
            </div>
            <p>{{ pkg.description || 'No description' }}</p>
            <div class="purchase-center__feature-row">
              <span v-for="feature in resolvePackageFeatures(pkg)" :key="`${pkg.id}-${feature}`">{{ feature }}</span>
            </div>
          </div>

          <div class="purchase-center__package-side">
            <strong class="purchase-center__price">{{ formatAmount(pkg.priceAmount) }}</strong>
            <small>{{ pkg.currency || 'CNY' }}</small>
            <button
              class="primary-action"
              type="button"
              :disabled="isSoftwareOrderSubmitting"
              @click="emit('create-software-order', pkg.id)"
            >
              {{ isSoftwareOrderSubmitting ? 'Creating' : 'Buy license' }}
            </button>
          </div>
        </article>

        <article v-if="!softwarePackages.length" class="purchase-center__empty">
          <strong>No software license packages available</strong>
          <span>When the platform publishes license packages, they will appear here.</span>
        </article>
      </div>

      <div v-if="currentSoftwareOrder" class="purchase-center__order-panel">
        <div class="purchase-center__order-info">
          <strong>Latest software order</strong>
          <span>Order No: {{ currentSoftwareOrder.merchantOrderNo }}</span>
          <span>Status: {{ resolveOrderStatusLabel(currentSoftwareOrder.status) }}</span>
          <span>Amount: {{ formatAmount(currentSoftwareOrder.amountCny || currentSoftwareOrder.effectiveSalePriceCny) }} CNY</span>
        </div>

        <div class="purchase-center__order-actions">
          <button
            class="secondary-action"
            type="button"
            :disabled="isSoftwareOrderRefreshing"
            @click="emit('refresh-software-order')"
          >
            {{ isSoftwareOrderRefreshing ? 'Refreshing' : 'Refresh order' }}
          </button>
          <button
            class="secondary-action"
            type="button"
            :disabled="!currentSoftwareOrder.paymentPayload?.mockPayUrl"
            @click="emit('open-software-order')"
          >
            Open payment
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
  color: rgba(240, 244, 255, 0.94);
}

.purchase-center--embedded {
  gap: 16px;
}

.purchase-center__hero {
  display: grid;
  grid-template-columns: minmax(0, 1.3fr) minmax(320px, 0.9fr);
  gap: 20px;
  padding: 24px;
  border-radius: 24px;
  background:
    radial-gradient(circle at top left, rgba(89, 160, 255, 0.16), transparent 34%),
    linear-gradient(145deg, rgba(15, 19, 31, 0.96), rgba(7, 10, 18, 0.9));
  border: 1px solid rgba(255, 255, 255, 0.08);
}

.purchase-center__hero-main h1,
.purchase-center__section-header h2 {
  margin: 0;
}

.purchase-center__hero-main p {
  margin: 12px 0 0;
  max-width: 640px;
  color: rgba(211, 221, 246, 0.78);
  line-height: 1.65;
}

.purchase-center__eyebrow,
.purchase-center__section-kicker {
  display: inline-flex;
  align-items: center;
  margin-bottom: 10px;
  font-size: 12px;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: rgba(118, 173, 255, 0.88);
}

.purchase-center__hero-side {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.purchase-center__license-card,
.purchase-center__wallet-card,
.purchase-center__section,
.purchase-center__order-panel,
.purchase-center__recharge-card,
.purchase-center__empty {
  border: 1px solid rgba(255, 255, 255, 0.08);
  background: rgba(14, 18, 30, 0.88);
}

.purchase-center__license-card {
  padding: 18px 20px;
  border-radius: 18px;
}

.purchase-center__license-card strong {
  display: block;
  margin-top: 8px;
  font-size: 20px;
}

.purchase-center__license-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  margin-top: 12px;
  color: rgba(205, 214, 238, 0.76);
  font-size: 13px;
}

.purchase-center__wallet-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 12px;
}

.purchase-center__wallet-card {
  padding: 16px;
  border-radius: 18px;
}

.purchase-center__wallet-card strong {
  display: block;
  margin-top: 10px;
  font-size: 24px;
}

.purchase-center__wallet-card small {
  display: inline-block;
  margin-top: 6px;
  color: rgba(205, 214, 238, 0.72);
}

.purchase-center__section {
  padding: 20px;
  border-radius: 22px;
}

.purchase-center__section-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  margin-bottom: 16px;
}

.purchase-center__package-list {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.purchase-center__package-card {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 180px;
  gap: 18px;
  align-items: center;
  padding: 18px 20px;
  border-radius: 18px;
  background: rgba(10, 14, 24, 0.76);
  border: 1px solid rgba(255, 255, 255, 0.06);
}

.purchase-center__package-heading {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
}

.purchase-center__package-heading strong {
  font-size: 18px;
}

.purchase-center__package-heading span,
.purchase-center__package-main p,
.purchase-center__empty span,
.purchase-center__recharge-main p {
  color: rgba(205, 214, 238, 0.76);
}

.purchase-center__package-main p,
.purchase-center__recharge-main p {
  margin: 10px 0 0;
  line-height: 1.65;
}

.purchase-center__feature-row {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 14px;
}

.purchase-center__feature-row span {
  display: inline-flex;
  align-items: center;
  padding: 6px 10px;
  border-radius: 999px;
  background: rgba(91, 140, 255, 0.14);
  color: rgba(221, 231, 255, 0.88);
  font-size: 12px;
}

.purchase-center__package-side {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 10px;
}

.purchase-center__price {
  font-size: 30px;
  line-height: 1;
}

.purchase-center__order-panel,
.purchase-center__recharge-card {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 18px;
  margin-top: 16px;
  padding: 18px 20px;
  border-radius: 18px;
}

.purchase-center__order-info,
.purchase-center__recharge-main {
  display: flex;
  flex-wrap: wrap;
  gap: 10px 16px;
  align-items: center;
}

.purchase-center__recharge-form {
  display: grid;
  grid-template-columns: repeat(2, minmax(160px, 1fr));
  gap: 12px;
  min-width: min(100%, 460px);
}

.purchase-center__field {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.purchase-center__field span {
  color: rgba(205, 214, 238, 0.76);
  font-size: 12px;
}

.purchase-center__field input,
.purchase-center__field select {
  min-height: 40px;
  border-radius: 12px;
  border: 1px solid rgba(255, 255, 255, 0.1);
  background: rgba(7, 10, 18, 0.72);
  color: rgba(240, 244, 255, 0.94);
  padding: 0 12px;
}

.purchase-center__order-info strong,
.purchase-center__recharge-main strong {
  width: 100%;
  font-size: 16px;
}

.purchase-center__order-actions {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
  justify-content: flex-end;
}

.purchase-center__recharge-order {
  display: flex;
  flex-wrap: wrap;
  gap: 10px 16px;
  color: rgba(205, 214, 238, 0.76);
  font-size: 13px;
}

.purchase-center__empty {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 22px;
  border-radius: 18px;
}

@media (max-width: 1080px) {
  .purchase-center__hero,
  .purchase-center__package-card,
  .purchase-center__order-panel,
  .purchase-center__recharge-card {
    grid-template-columns: 1fr;
    flex-direction: column;
    align-items: stretch;
  }

  .purchase-center__wallet-grid {
    grid-template-columns: 1fr;
  }

  .purchase-center__recharge-form {
    grid-template-columns: 1fr;
    min-width: 0;
  }

  .purchase-center__package-side,
  .purchase-center__order-actions {
    align-items: stretch;
    justify-content: flex-start;
  }
}
</style>
