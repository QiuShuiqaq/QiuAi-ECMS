<script setup>
import { computed } from 'vue'

const props = defineProps({
  activationState: { type: Object, required: true },
  walletSummary: { type: Object, default: null },
  softwarePackages: { type: Array, default: () => [] },
  computePackages: { type: Array, default: () => [] },
  currentSoftwareOrder: { type: Object, default: null },
  currentComputePackageOrder: { type: Object, default: null },
  currentRechargeOrder: { type: Object, default: null },
  rechargeForm: {
    type: Object,
    default: () => ({
      walletType: 'image',
      channel: 'alipay',
      amountCny: '1'
    })
  },
  isCatalogLoading: { type: Boolean, default: false },
  isRechargeSubmitting: { type: Boolean, default: false },
  isSoftwareOrderSubmitting: { type: Boolean, default: false },
  isSoftwareOrderRefreshing: { type: Boolean, default: false },
  isComputePackageOrderSubmitting: { type: Boolean, default: false },
  isComputePackageOrderRefreshing: { type: Boolean, default: false },
  isRechargeRefreshing: { type: Boolean, default: false },
  embedded: { type: Boolean, default: false }
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

const isActivated = computed(() => props.activationState?.status === 'activated')

function formatAmount(value) {
  const numericValue = Number(value || 0)
  return Number.isFinite(numericValue) ? numericValue.toFixed(2) : '0.00'
}

function resolveOrderStatusLabel(status) {
  if (status === 'paid') return '已支付'
  if (status === 'failed') return '失败'
  if (status === 'closed') return '已关闭'
  return '待支付'
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
      <div class="purchase-center__wallet-grid">
        <article v-for="card in walletCards" :key="card.key" class="purchase-center__wallet-card">
          <span>{{ card.label }}</span>
          <strong>{{ formatAmount(card.value) }}</strong>
          <small>CNY</small>
        </article>
      </div>
    </header>

    <section class="purchase-center__section">
      <div class="purchase-center__section-header">
        <h2>授权套餐</h2>
      </div>
      <div class="purchase-center__package-list">
        <article v-for="pkg in softwarePackages" :key="pkg.id" class="purchase-center__package-card">
          <div class="purchase-center__package-main">
            <strong>{{ pkg.name }}</strong>
            <span>{{ pkg.productName }}</span>
          </div>
          <div class="purchase-center__package-side">
            <strong class="purchase-center__price">{{ formatAmount(pkg.priceAmount) }}</strong>
            <button class="primary-action" type="button" :disabled="isSoftwareOrderSubmitting" @click="emit('create-software-order', pkg.id)">
              购买授权
            </button>
          </div>
        </article>
      </div>
      <div v-if="currentSoftwareOrder" class="purchase-center__order-panel">
        <span>订单 {{ currentSoftwareOrder.merchantOrderNo }}</span>
        <span>{{ resolveOrderStatusLabel(currentSoftwareOrder.status) }}</span>
        <button class="secondary-action" type="button" :disabled="isSoftwareOrderRefreshing" @click="emit('refresh-software-order')">刷新</button>
        <button class="secondary-action" type="button" @click="emit('open-software-order')">打开支付</button>
      </div>
    </section>

    <section v-if="isActivated" class="purchase-center__section">
      <div class="purchase-center__section-header">
        <h2>钱包直充</h2>
      </div>
      <div class="purchase-center__recharge-card">
        <div class="purchase-center__recharge-form">
          <label class="purchase-center__field">
            <span>钱包</span>
            <select :value="rechargeForm.walletType" @change="updateRechargeField('walletType', $event.target.value)">
              <option value="text">文本</option>
              <option value="image">图片</option>
              <option value="video">视频</option>
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
            <input :value="rechargeForm.amountCny" type="number" min="1" step="0.01" @input="updateRechargeField('amountCny', $event.target.value)">
          </label>
        </div>
        <div class="purchase-center__order-actions">
          <button class="primary-action" type="button" :disabled="isRechargeSubmitting" @click="emit('create-recharge')">创建订单</button>
          <button class="secondary-action" type="button" :disabled="!currentRechargeOrder || isRechargeRefreshing" @click="emit('refresh-recharge-order')">刷新</button>
          <button class="secondary-action" type="button" :disabled="!currentRechargeOrder" @click="emit('open-recharge-order')">打开支付</button>
        </div>
      </div>
    </section>

    <section v-if="isActivated" class="purchase-center__section">
      <div class="purchase-center__section-header">
        <h2>算力套餐</h2>
        <button class="secondary-action" type="button" :disabled="isCatalogLoading" @click="emit('refresh-catalog')">刷新套餐</button>
      </div>
      <div class="purchase-center__package-list">
        <article v-for="pkg in computePackages" :key="pkg.id" class="purchase-center__package-card">
          <div class="purchase-center__package-main">
            <strong>{{ pkg.name }}</strong>
            <span>{{ pkg.productName }}</span>
          </div>
          <div class="purchase-center__package-side">
            <strong class="purchase-center__price">{{ formatAmount(pkg.priceAmount) }}</strong>
            <button class="primary-action" type="button" :disabled="isComputePackageOrderSubmitting || pkg.canPurchase === false" @click="emit('create-compute-package-order', pkg.id)">
              购买算力包
            </button>
          </div>
        </article>
      </div>
      <div v-if="currentComputePackageOrder" class="purchase-center__order-panel">
        <span>订单 {{ currentComputePackageOrder.merchantOrderNo }}</span>
        <span>{{ resolveOrderStatusLabel(currentComputePackageOrder.status) }}</span>
        <button class="secondary-action" type="button" :disabled="isComputePackageOrderRefreshing" @click="emit('refresh-compute-package-order')">刷新</button>
        <button class="secondary-action" type="button" @click="emit('open-compute-package-order')">打开支付</button>
      </div>
    </section>
  </section>
</template>

<style scoped>
.purchase-center {
  display: flex;
  flex-direction: column;
  gap: 20px;
  min-width: 0;
}

.purchase-center__hero,
.purchase-center__section,
.purchase-center__wallet-card,
.purchase-center__recharge-card,
.purchase-center__order-panel,
.purchase-center__package-card {
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 20px;
  background: rgba(14, 18, 30, 0.88);
}

.purchase-center__hero {
  display: flex;
  flex-direction: column;
  gap: 16px;
  padding: 20px;
}

.purchase-center__eyebrow {
  font-size: 12px;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: rgba(118, 173, 255, 0.88);
}

.purchase-center__wallet-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
  gap: 12px;
}

.purchase-center__wallet-card,
.purchase-center__section,
.purchase-center__recharge-card,
.purchase-center__order-panel,
.purchase-center__package-card {
  padding: 16px;
}

.purchase-center__section {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.purchase-center__section-header,
.purchase-center__order-actions,
.purchase-center__order-panel,
.purchase-center__package-card,
.purchase-center__package-side {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  justify-content: space-between;
  gap: 12px;
}

.purchase-center__package-list,
.purchase-center__recharge-form {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.purchase-center__package-main,
.purchase-center__field {
  display: flex;
  flex-direction: column;
  gap: 6px;
  min-width: 0;
}

.purchase-center__package-main strong,
.purchase-center__package-main span {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.purchase-center__package-side {
  align-items: flex-end;
}

.purchase-center__recharge-form {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
}

.purchase-center__field input,
.purchase-center__field select,
.primary-action,
.secondary-action {
  border-radius: 12px;
}

@media (max-width: 960px) {
  .purchase-center__recharge-form {
    grid-template-columns: 1fr;
  }

  .purchase-center__order-actions,
  .purchase-center__package-side {
    align-items: stretch;
    width: 100%;
  }
}

@media (max-width: 720px) {
  .purchase-center__hero,
  .purchase-center__section,
  .purchase-center__wallet-card,
  .purchase-center__recharge-card,
  .purchase-center__order-panel,
  .purchase-center__package-card {
    padding: 14px;
  }

  .purchase-center__section-header,
  .purchase-center__order-panel,
  .purchase-center__package-card {
    align-items: flex-start;
    flex-direction: column;
  }

  .purchase-center__package-side,
  .purchase-center__order-actions {
    width: 100%;
  }

  .purchase-center__package-side .primary-action,
  .purchase-center__order-actions .primary-action,
  .purchase-center__order-actions .secondary-action {
    width: 100%;
  }
}
</style>
