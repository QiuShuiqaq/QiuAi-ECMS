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
  isCatalogLoading: {
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
  'open-recharge',
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
  if (status === 'failed') return '支付失败'
  if (status === 'closed') return '已关闭'
  return '待支付'
}

function resolvePackageFeatures(pkg = {}) {
  const features = []

  if (pkg.durationDays) features.push(`时长 ${pkg.durationDays} 天`)
  if (pkg.deviceLimit) features.push(`设备数 ${pkg.deviceLimit}`)
  if (Array.isArray(pkg.entitlementSummary) && pkg.entitlementSummary.length) {
    features.push(...pkg.entitlementSummary)
  }
  if (pkg.includedImageQuota) features.push(`图片额度 ${pkg.includedImageQuota}`)
  if (pkg.includedVideoQuota) features.push(`视频额度 ${pkg.includedVideoQuota}`)
  if (pkg.overageEnabled) features.push('支持超额续费')

  return features
}
</script>

<template>
  <section class="purchase-center" :class="{ 'purchase-center--embedded': embedded }">
    <header class="purchase-center__hero">
      <div class="purchase-center__hero-main">
        <span class="purchase-center__eyebrow">充值中心</span>
        <h1>授权、月套餐与余额充值</h1>
        <p>统一处理授权购买、月套餐购买和算力直充。支付后会自动回查订单状态并刷新授权与余额。</p>
      </div>

      <div class="purchase-center__hero-side">
        <div class="purchase-center__license-card">
          <span>当前授权</span>
          <strong>{{ activationState.customerName || '未命名客户' }}</strong>
          <div class="purchase-center__license-meta">
            <span>{{ licenseStatusLabel }}</span>
            <span>到期：{{ activationState.expiresAt ? formatDateTime(activationState.expiresAt) : '永久或未设置' }}</span>
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
          <span class="purchase-center__section-kicker">余额充值</span>
          <h2>算力直充</h2>
        </div>
      </div>

      <div class="purchase-center__recharge-card">
        <div class="purchase-center__recharge-main">
          <strong>图片 / 视频余额直充</strong>
          <p>适合已有授权用户直接补充算力，是最高频的付费入口。</p>
          <div v-if="currentRechargeOrder" class="purchase-center__recharge-order">
            <span>最近订单：{{ currentRechargeOrder.merchantOrderNo }}</span>
            <span>状态：{{ resolveOrderStatusLabel(currentRechargeOrder.status) }}</span>
            <span>金额：{{ formatAmount(currentRechargeOrder.payAmountCny) }} CNY</span>
          </div>
        </div>

        <div class="purchase-center__order-actions">
          <button class="primary-action" type="button" @click="emit('open-recharge')">
            新建充值订单
          </button>
          <button class="secondary-action" type="button" :disabled="!currentRechargeOrder || isRechargeRefreshing" @click="emit('refresh-recharge-order')">
            {{ isRechargeRefreshing ? '查询中' : '查询订单' }}
          </button>
          <button class="secondary-action" type="button" :disabled="!currentRechargeOrder?.paymentPayload?.mockPayUrl" @click="emit('open-recharge-order')">
            打开支付
          </button>
        </div>
      </div>
    </section>

    <section class="purchase-center__section">
      <div class="purchase-center__section-header">
        <div>
          <span class="purchase-center__section-kicker">月度算力</span>
          <h2>月套餐</h2>
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
            <p>{{ pkg.description || '暂无说明' }}</p>
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
              :disabled="isComputePackageOrderSubmitting"
              @click="emit('create-compute-package-order', pkg.id)"
            >
              {{ isComputePackageOrderSubmitting ? '创建中' : '购买月套餐' }}
            </button>
          </div>
        </article>

        <article v-if="!computePackages.length" class="purchase-center__empty">
          <strong>暂无可售月套餐</strong>
          <span>平台端未配置月套餐时，这里会保持为空。</span>
        </article>
      </div>

      <div v-if="currentComputePackageOrder" class="purchase-center__order-panel">
        <div class="purchase-center__order-info">
          <strong>最新月套餐订单</strong>
          <span>订单号：{{ currentComputePackageOrder.merchantOrderNo }}</span>
          <span>状态：{{ resolveOrderStatusLabel(currentComputePackageOrder.status) }}</span>
          <span>金额：{{ formatAmount(currentComputePackageOrder.amountCny) }} CNY</span>
        </div>

        <div class="purchase-center__order-actions">
          <button class="secondary-action" type="button" :disabled="isComputePackageOrderRefreshing" @click="emit('refresh-compute-package-order')">
            {{ isComputePackageOrderRefreshing ? '查询中' : '查询订单' }}
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
          <span class="purchase-center__section-kicker">软件授权</span>
          <h2>授权套餐</h2>
        </div>
      </div>

      <div class="purchase-center__package-list">
        <article v-for="pkg in softwarePackages" :key="pkg.id" class="purchase-center__package-card">
          <div class="purchase-center__package-main">
            <div class="purchase-center__package-heading">
              <strong>{{ pkg.name }}</strong>
              <span>{{ pkg.productName }}</span>
            </div>
            <p>{{ pkg.description || '暂无说明' }}</p>
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
              {{ isSoftwareOrderSubmitting ? '创建中' : '购买授权' }}
            </button>
          </div>
        </article>

        <article v-if="!softwarePackages.length" class="purchase-center__empty">
          <strong>暂无可售授权套餐</strong>
          <span>如果这里为空，说明平台端还未配置或还未同步出公开套餐接口。</span>
        </article>
      </div>

      <div v-if="currentSoftwareOrder" class="purchase-center__order-panel">
        <div class="purchase-center__order-info">
          <strong>最新授权订单</strong>
          <span>订单号：{{ currentSoftwareOrder.merchantOrderNo }}</span>
          <span>状态：{{ resolveOrderStatusLabel(currentSoftwareOrder.status) }}</span>
          <span>金额：{{ formatAmount(currentSoftwareOrder.amountCny || currentSoftwareOrder.effectiveSalePriceCny) }} CNY</span>
        </div>

        <div class="purchase-center__order-actions">
          <button class="secondary-action" type="button" :disabled="isSoftwareOrderRefreshing" @click="emit('refresh-software-order')">
            {{ isSoftwareOrderRefreshing ? '查询中' : '查询订单' }}
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

  .purchase-center__package-side,
  .purchase-center__order-actions {
    align-items: stretch;
    justify-content: flex-start;
  }
}
</style>
