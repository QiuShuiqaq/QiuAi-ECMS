<script setup>
import { computed, reactive, watch } from 'vue'

const props = defineProps({
  visible: {
    type: Boolean,
    default: false
  },
  mode: {
    type: String,
    default: 'software'
  },
  activationForm: {
    type: Object,
    default: () => ({})
  },
  softwarePackages: {
    type: Array,
    default: () => []
  },
  computePackages: {
    type: Array,
    default: () => []
  },
  rechargeForm: {
    type: Object,
    default: () => ({
      walletType: 'image',
      channel: 'alipay',
      amountCny: '1'
    })
  },
  isCatalogLoading: {
    type: Boolean,
    default: false
  },
  isSoftwareOrderSubmitting: {
    type: Boolean,
    default: false
  },
  isComputePackageOrderSubmitting: {
    type: Boolean,
    default: false
  },
  isRechargeSubmitting: {
    type: Boolean,
    default: false
  },
  isAgentQuoteLoading: {
    type: Boolean,
    default: false
  },
  agentQuoteState: {
    type: Object,
    default: () => ({
      verified: false,
      valid: false,
      message: '',
      agentDisplayName: '',
      packagePrices: {}
    })
  }
})

const emit = defineEmits([
  'close',
  'submit-software-order',
  'submit-compute-order',
  'submit-recharge-order',
  'update-activation-form',
  'update-recharge-form',
  'verify-agent-invite-code'
])

const selectionState = reactive({
  softwarePackageId: '',
  computePackageId: ''
})

const rechargeAmountPresets = ['10', '50', '100', '200', '500', '1000']

const isSoftwareMode = computed(() => props.mode === 'software')
const isComputeMode = computed(() => props.mode === 'compute')
const isRechargeMode = computed(() => props.mode === 'recharge')

const modeMeta = computed(() => {
  if (isComputeMode.value) {
    return {
      eyebrow: 'Compute Package',
      title: '算力购买',
      subtitle: '选择算力包，创建订单后会自动打开支付宝支付页面。'
    }
  }

  if (isRechargeMode.value) {
    return {
      eyebrow: 'Direct Recharge',
      title: '算力直充',
      subtitle: '选择余额类型与充值金额，创建订单后会自动打开支付宝支付页面。'
    }
  }

  return {
    eyebrow: 'Software License',
    title: '授权购买',
    subtitle: '填写用户名、手机号，必要时校验代理邀请码，支付完成后当前设备会自动尝试激活。'
  }
})

const visibleSoftwarePackages = computed(() => Array.isArray(props.softwarePackages) ? props.softwarePackages : [])
const visibleComputePackages = computed(() => Array.isArray(props.computePackages) ? props.computePackages : [])

function resolveSoftwareConcurrencyRank(pkg = {}) {
  const sourceText = `${pkg.code || ''} ${pkg.name || ''} ${pkg.description || ''}`
  const explicitMatch = sourceText.match(/(?:ENTERPRISE|PERSONAL)_(16|8|4|2)\b/i) || sourceText.match(/\b(16|8|4|2)\s*(?:并发|concurrency)\b/i)
  const concurrency = explicitMatch ? Number(explicitMatch[1]) : 0
  const rankMap = {
    16: 0,
    8: 1,
    4: 2,
    2: 3
  }
  return rankMap[concurrency] ?? 99
}

function resolveSoftwareDurationRank(pkg = {}) {
  const durationDays = Number(pkg.durationDays || 0)
  const code = String(pkg.code || '').toUpperCase()
  if (code.includes('THREE_YEAR') || durationDays > 500) return 0
  if (code.includes('ANNUAL') || (durationDays > 120 && durationDays <= 500)) return 1
  if (code.includes('QUARTER') || durationDays <= 120) return 2
  return 99
}

const orderedSoftwarePackages = computed(() => {
  return [...visibleSoftwarePackages.value].sort((left, right) => {
    const durationDiff = resolveSoftwareDurationRank(left) - resolveSoftwareDurationRank(right)
    if (durationDiff !== 0) return durationDiff

    const concurrencyDiff = resolveSoftwareConcurrencyRank(left) - resolveSoftwareConcurrencyRank(right)
    if (concurrencyDiff !== 0) return concurrencyDiff

    return Number(right.priceAmount || 0) - Number(left.priceAmount || 0)
  })
})

const submitDisabled = computed(() => {
  if (isSoftwareMode.value) {
    return props.isSoftwareOrderSubmitting || !selectionState.softwarePackageId
  }

  if (isComputeMode.value) {
    return props.isComputePackageOrderSubmitting || !selectionState.computePackageId
  }

  return props.isRechargeSubmitting || !(Number(props.rechargeForm.amountCny) >= 1)
})

const submitLabel = computed(() => {
  if (isSoftwareMode.value) {
    return props.isSoftwareOrderSubmitting ? '正在创建订单...' : '下单并前往支付'
  }

  if (isComputeMode.value) {
    return props.isComputePackageOrderSubmitting ? '正在创建订单...' : '下单并前往支付'
  }

  return props.isRechargeSubmitting ? '正在创建订单...' : '下单并前往支付'
})

const verifiedAgentMessage = computed(() => {
  if (!isSoftwareMode.value) {
    return ''
  }

  if (props.isAgentQuoteLoading) {
    return '正在校验代理邀请码...'
  }

  if (props.agentQuoteState?.verified && props.agentQuoteState?.valid) {
    const displayName = String(props.agentQuoteState.agentDisplayName || '').trim()
    return displayName ? `已匹配代理：${displayName}` : '代理邀请码校验通过'
  }

  if (props.agentQuoteState?.verified && !props.agentQuoteState?.valid) {
    return props.agentQuoteState?.message || '代理邀请码无效'
  }

  return '未校验时默认显示官方价格'
})

watch(
  () => props.softwarePackages,
  (packages) => {
    if (!Array.isArray(packages) || !packages.length) {
      selectionState.softwarePackageId = ''
      return
    }

    const exists = packages.some((item) => item.id === selectionState.softwarePackageId)
    if (!exists) {
      selectionState.softwarePackageId = orderedSoftwarePackages.value[0]?.id || packages[0].id
    }
  },
  { immediate: true }
)

watch(
  () => props.computePackages,
  (packages) => {
    if (!Array.isArray(packages) || !packages.length) {
      selectionState.computePackageId = ''
      return
    }

    const exists = packages.some((item) => item.id === selectionState.computePackageId)
    if (!exists) {
      selectionState.computePackageId = packages[0].id
    }
  },
  { immediate: true }
)

function formatAmount(value) {
  const numericValue = Number(value || 0)
  return Number.isFinite(numericValue) ? numericValue.toFixed(2) : '0.00'
}

function formatBalanceAmount(value) {
  const numericValue = Number(value || 0)
  if (!Number.isFinite(numericValue)) return '0'
  return numericValue % 1 === 0 ? String(numericValue) : numericValue.toFixed(2)
}

function resolveSoftwarePackagePrice(pkg = {}) {
  const packagePrices = props.agentQuoteState?.packagePrices || {}
  const matchedQuote = packagePrices[pkg.id]

  if (props.agentQuoteState?.verified && props.agentQuoteState?.valid && matchedQuote) {
    return Number(matchedQuote.agentSalePriceAmount || pkg.agentSalePriceAmount || pkg.priceAmount || 0)
  }

  return Number(pkg.officialPriceAmount || pkg.priceAmount || 0)
}

function updateRechargeField(field, value) {
  emit('update-recharge-form', { field, value })
}

function updateActivationField(field, value) {
  emit('update-activation-form', { field, value })
}

function handleVerifyAgentInviteCode() {
  emit('verify-agent-invite-code')
}

function submitOrder() {
  if (isSoftwareMode.value) {
    emit('submit-software-order', selectionState.softwarePackageId)
    return
  }

  if (isComputeMode.value) {
    emit('submit-compute-order', selectionState.computePackageId)
    return
  }

  emit('submit-recharge-order')
}
</script>

<template>
  <div
    v-if="visible"
    class="commerce-order-modal"
    role="dialog"
    aria-modal="true"
    :aria-label="modeMeta.title"
    @click.self="emit('close')"
  >
    <div
      class="commerce-order-modal__card"
      :class="{
        'commerce-order-modal__card--software': isSoftwareMode,
        'commerce-order-modal__card--compute': isComputeMode,
        'commerce-order-modal__card--recharge': isRechargeMode
      }"
    >
      <header class="commerce-order-modal__header">
        <div>
          <span class="commerce-order-modal__eyebrow">{{ modeMeta.eyebrow }}</span>
          <strong>{{ modeMeta.title }}</strong>
          <p>{{ modeMeta.subtitle }}</p>
        </div>

        <button type="button" class="secondary-action" @click="emit('close')">
          关闭
        </button>
      </header>

      <section v-if="isSoftwareMode" class="commerce-order-modal__section">
        <div class="commerce-order-modal__grid commerce-order-modal__grid--triple">
          <label class="commerce-order-modal__field">
            <span>用户名</span>
            <input
              :value="activationForm.customerName || ''"
              type="text"
              placeholder="请输入用户名"
              @input="updateActivationField('customerName', $event.target.value)"
            >
          </label>

          <label class="commerce-order-modal__field">
            <span>手机</span>
            <input
              :value="activationForm.contact || ''"
              type="text"
              placeholder="请输入手机号"
              @input="updateActivationField('contact', $event.target.value)"
            >
          </label>

          <div class="commerce-order-modal__field">
            <span>代理邀请码</span>
            <div class="commerce-order-modal__inline-field">
              <input
                :value="activationForm.agentInviteCode || ''"
                type="text"
                placeholder="选填"
                @input="updateActivationField('agentInviteCode', $event.target.value)"
              >
              <button
                type="button"
                class="secondary-action commerce-order-modal__verify-button"
                :disabled="props.isAgentQuoteLoading || !(activationForm.agentInviteCode || '').trim()"
                @click="handleVerifyAgentInviteCode"
              >
                {{ props.isAgentQuoteLoading ? '校验中' : '校验' }}
              </button>
            </div>
          </div>
        </div>

        <div class="commerce-order-modal__notice">
          <span>{{ verifiedAgentMessage }}</span>
        </div>

        <div class="commerce-order-modal__notice">
          <span>用户名和手机号均不可重复。手机号购买成功后再次使用相同手机号购买，会提示已购买过产品。</span>
        </div>
      </section>

      <section v-if="isRechargeMode" class="commerce-order-modal__section commerce-order-modal__section--recharge">
        <div class="commerce-order-modal__recharge-stack">
          <label class="commerce-order-modal__field">
            <span>充值到</span>
            <select :value="rechargeForm.walletType" @change="updateRechargeField('walletType', $event.target.value)">
              <option value="text">文本余额</option>
              <option value="image">图片余额</option>
              <option value="video">视频余额</option>
            </select>
          </label>

          <label class="commerce-order-modal__field">
            <span>支付方式</span>
            <select :value="rechargeForm.channel" @change="updateRechargeField('channel', $event.target.value)">
              <option value="alipay">支付宝</option>
            </select>
          </label>

          <label class="commerce-order-modal__field">
            <span>充值金额</span>
            <input
              :value="rechargeForm.amountCny"
              type="number"
              min="1"
              step="1"
              placeholder="1"
              @input="updateRechargeField('amountCny', $event.target.value)"
            >
          </label>

          <div class="commerce-order-modal__amount-presets" aria-label="常用充值档位">
            <button
              v-for="amount in rechargeAmountPresets"
              :key="amount"
              type="button"
              class="commerce-order-modal__amount-preset"
              :class="{ 'commerce-order-modal__amount-preset--active': Number(rechargeForm.amountCny) === Number(amount) }"
              @click="updateRechargeField('amountCny', amount)"
            >
              {{ amount }} 元
            </button>
          </div>
        </div>
      </section>

      <section v-if="!isRechargeMode" class="commerce-order-modal__section">
        <div class="commerce-order-modal__section-head">
          <span>{{ isSoftwareMode ? '授权套餐' : '算力套餐' }}</span>
          <span v-if="isCatalogLoading">加载中...</span>
        </div>

        <div v-if="isSoftwareMode" class="commerce-order-modal__list commerce-order-modal__list--software">
          <button
            v-for="pkg in orderedSoftwarePackages"
            :key="pkg.id"
            type="button"
            class="commerce-order-modal__option commerce-order-modal__option--software"
            :class="{ 'commerce-order-modal__option--active': selectionState.softwarePackageId === pkg.id }"
            @click="selectionState.softwarePackageId = pkg.id"
          >
            <div class="commerce-order-modal__option-copy">
              <strong>{{ pkg.name }}</strong>
            </div>
            <div class="commerce-order-modal__option-side">
              <strong>¥{{ formatAmount(resolveSoftwarePackagePrice(pkg)) }}</strong>
            </div>
          </button>
        </div>

        <div v-else-if="isComputeMode" class="commerce-order-modal__list commerce-order-modal__list--compute">
          <button
            v-for="pkg in visibleComputePackages"
            :key="pkg.id"
            type="button"
            class="commerce-order-modal__option commerce-order-modal__option--compute"
            :class="{ 'commerce-order-modal__option--active': selectionState.computePackageId === pkg.id }"
            @click="selectionState.computePackageId = pkg.id"
          >
            <div class="commerce-order-modal__option-copy commerce-order-modal__compute-head">
              <strong>{{ pkg.name }}</strong>
              <span>¥{{ formatAmount(pkg.priceAmount) }}</span>
            </div>
            <div class="commerce-order-modal__compute-balances">
              <span>
                <em>文本</em>
                <strong>{{ formatBalanceAmount(pkg.includedTextBalanceCny) }}</strong>
              </span>
              <span>
                <em>图片</em>
                <strong>{{ formatBalanceAmount(pkg.includedImageBalanceCny) }}</strong>
              </span>
              <span>
                <em>视频</em>
                <strong>{{ formatBalanceAmount(pkg.includedVideoBalanceCny) }}</strong>
              </span>
            </div>
          </button>
        </div>
      </section>

      <section v-if="!isRechargeMode" class="commerce-order-modal__section">
        <div class="commerce-order-modal__grid commerce-order-modal__grid--single">
          <label class="commerce-order-modal__field">
            <span>支付方式</span>
            <select :value="isRechargeMode ? rechargeForm.channel : 'alipay'" disabled>
              <option value="alipay">支付宝</option>
            </select>
          </label>
        </div>
      </section>

      <footer class="commerce-order-modal__footer">
        <button type="button" class="secondary-action" @click="emit('close')">
          取消
        </button>
        <button type="button" class="primary-action" :disabled="submitDisabled" @click="submitOrder">
          {{ submitLabel }}
        </button>
      </footer>
    </div>
  </div>
</template>

<style scoped>
.commerce-order-modal {
  position: fixed;
  inset: 0;
  z-index: 90;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
  background: rgba(5, 9, 17, 0.76);
  backdrop-filter: blur(16px);
}

.commerce-order-modal__card {
  width: min(860px, 100%);
  display: grid;
  gap: 18px;
  max-height: min(88vh, 920px);
  min-width: 0;
  overflow-y: auto;
  padding: 24px;
  border-radius: 24px;
  border: 1px solid rgba(255, 255, 255, 0.08);
  background: rgba(11, 16, 27, 0.96);
  box-shadow: 0 24px 60px rgba(0, 0, 0, 0.35);
}

.commerce-order-modal__card--software,
.commerce-order-modal__card--compute {
  width: min(1020px, 100%);
}

.commerce-order-modal__card--recharge {
  width: min(520px, 100%);
  gap: 16px;
  padding: 22px;
}

.commerce-order-modal__header {
  display: flex;
  align-items: flex-start;
  flex-wrap: wrap;
  justify-content: space-between;
  gap: 16px;
}

.commerce-order-modal__header strong {
  display: block;
  margin-top: 6px;
  font-size: 28px;
}

.commerce-order-modal__header p {
  margin: 10px 0 0;
  color: rgba(205, 214, 238, 0.76);
  line-height: 1.6;
}

.commerce-order-modal__eyebrow {
  color: rgba(118, 173, 255, 0.88);
  font-size: 12px;
  font-weight: 700;
  letter-spacing: 0.14em;
  text-transform: uppercase;
}

.commerce-order-modal__section {
  display: grid;
  gap: 12px;
}

.commerce-order-modal__notice {
  padding: 10px 12px;
  border-radius: 12px;
  border: 1px solid rgba(255, 255, 255, 0.08);
  background: rgba(255, 255, 255, 0.03);
  color: rgba(205, 214, 238, 0.8);
  font-size: 12px;
  line-height: 1.6;
}

.commerce-order-modal__section--recharge {
  padding: 16px;
  border-radius: 20px;
  border: 1px solid rgba(255, 255, 255, 0.08);
  background:
    radial-gradient(circle at 20% 0%, rgba(118, 173, 255, 0.12), transparent 34%),
    rgba(255, 255, 255, 0.03);
}

.commerce-order-modal__recharge-stack {
  display: grid;
  gap: 14px;
}

.commerce-order-modal__section-head {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  color: rgba(205, 214, 238, 0.78);
  font-size: 13px;
}

.commerce-order-modal__grid {
  display: grid;
  gap: 14px;
}

.commerce-order-modal__grid--triple {
  grid-template-columns: repeat(3, minmax(0, 1fr));
}

.commerce-order-modal__grid--single {
  grid-template-columns: minmax(0, 1fr);
}

.commerce-order-modal__field {
  display: flex;
  flex-direction: column;
  gap: 8px;
  min-width: 0;
}

.commerce-order-modal__field span {
  color: rgba(205, 214, 238, 0.78);
  font-size: 13px;
}

.commerce-order-modal__inline-field {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: 10px;
}

.commerce-order-modal__verify-button {
  min-width: 84px;
}

.commerce-order-modal__list {
  display: grid;
  gap: 12px;
}

.commerce-order-modal__list--software {
  grid-template-columns: repeat(4, minmax(160px, 1fr));
}

.commerce-order-modal__list--compute {
  grid-template-columns: repeat(4, minmax(160px, 1fr));
  gap: 10px;
}

.commerce-order-modal__option {
  display: grid;
  gap: 16px;
  align-items: center;
  width: 100%;
  padding: 16px 18px;
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 18px;
  background: rgba(255, 255, 255, 0.02);
  color: inherit;
  text-align: left;
  transition: border-color 0.2s ease, background 0.2s ease, transform 0.2s ease;
}

.commerce-order-modal__option--software {
  grid-template-columns: 1fr;
  justify-items: center;
  align-content: center;
  gap: 10px;
  min-height: 88px;
  padding: 14px 12px;
  text-align: center;
}

.commerce-order-modal__option--compute {
  grid-template-columns: 1fr;
  align-content: start;
  gap: 10px;
  min-height: 152px;
  padding: 13px 14px;
}

.commerce-order-modal__option:hover,
.commerce-order-modal__option--active {
  border-color: rgba(118, 173, 255, 0.5);
  background: rgba(118, 173, 255, 0.08);
  transform: translateY(-1px);
}

.commerce-order-modal__option-copy {
  display: grid;
  gap: 6px;
  min-width: 0;
}

.commerce-order-modal__option--software .commerce-order-modal__option-copy strong {
  max-width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.commerce-order-modal__option-side {
  display: grid;
  justify-items: center;
  gap: 4px;
}

.commerce-order-modal__option-side strong {
  font-size: 22px;
  line-height: 1;
}

.commerce-order-modal__compute-head {
  gap: 6px;
}

.commerce-order-modal__compute-head strong {
  max-width: 100%;
  overflow: hidden;
  color: rgba(241, 246, 255, 0.96);
  font-size: 14px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.commerce-order-modal__compute-head span {
  color: rgba(118, 173, 255, 0.96);
  font-size: 18px;
  font-weight: 800;
  line-height: 1;
}

.commerce-order-modal__compute-balances {
  display: grid;
  gap: 6px;
}

.commerce-order-modal__compute-balances span {
  display: grid;
  grid-template-columns: 34px minmax(0, 1fr);
  align-items: center;
  gap: 6px;
  min-width: 0;
  min-height: 32px;
  padding: 6px 10px;
  border-radius: 10px;
  background: rgba(255, 255, 255, 0.035);
}

.commerce-order-modal__compute-balances em {
  color: rgba(205, 214, 238, 0.68);
  font-size: 11px;
  font-style: normal;
}

.commerce-order-modal__compute-balances strong {
  min-width: 0;
  color: rgba(241, 246, 255, 0.92);
  font-size: 13px;
  text-align: right;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.commerce-order-modal__amount-presets {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 8px;
}

.commerce-order-modal__amount-preset {
  min-height: 38px;
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 12px;
  background: rgba(255, 255, 255, 0.035);
  color: rgba(226, 232, 244, 0.9);
  font-size: 14px;
  font-weight: 700;
  cursor: pointer;
  transition: border-color 0.18s ease, background 0.18s ease, transform 0.18s ease;
}

.commerce-order-modal__amount-preset:hover,
.commerce-order-modal__amount-preset--active {
  border-color: rgba(118, 173, 255, 0.52);
  background: rgba(118, 173, 255, 0.12);
  transform: translateY(-1px);
}

.commerce-order-modal__footer {
  display: flex;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: 12px;
}

.commerce-order-modal__footer .primary-action,
.commerce-order-modal__footer .secondary-action {
  min-width: 120px;
}

@media (max-width: 1080px) {
  .commerce-order-modal__card--software,
  .commerce-order-modal__card--compute {
    width: min(900px, 100%);
  }

  .commerce-order-modal__list--software,
  .commerce-order-modal__list--compute {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }
}

.commerce-order-modal__card--recharge .commerce-order-modal__footer {
  display: grid;
  grid-template-columns: 1fr 1fr;
}

.commerce-order-modal__card--recharge .commerce-order-modal__footer button {
  width: 100%;
}

@media (max-width: 820px) {
  .commerce-order-modal {
    padding: 16px;
  }

  .commerce-order-modal__card {
    padding: 18px;
  }

  .commerce-order-modal__grid--triple {
    grid-template-columns: 1fr;
  }

  .commerce-order-modal__list--software {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .commerce-order-modal__list--compute {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .commerce-order-modal__inline-field {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 560px) {
  .commerce-order-modal {
    padding: 12px;
  }

  .commerce-order-modal__card {
    gap: 14px;
    max-height: 92vh;
    padding: 16px;
  }

  .commerce-order-modal__header strong {
    font-size: 22px;
  }

  .commerce-order-modal__list--software,
  .commerce-order-modal__list--compute,
  .commerce-order-modal__amount-presets,
  .commerce-order-modal__card--recharge .commerce-order-modal__footer {
    grid-template-columns: 1fr;
  }

  .commerce-order-modal__footer {
    justify-content: stretch;
  }

  .commerce-order-modal__footer .primary-action,
  .commerce-order-modal__footer .secondary-action {
    width: 100%;
  }
}
</style>
