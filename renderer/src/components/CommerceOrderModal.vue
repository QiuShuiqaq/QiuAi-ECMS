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
      amountCny: '0.01',
      couponCode: ''
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
  }
})

const emit = defineEmits([
  'close',
  'submit-software-order',
  'submit-compute-order',
  'submit-recharge-order',
  'update-recharge-form'
])

const selectionState = reactive({
  softwarePackageId: '',
  computePackageId: ''
})

const isSoftwareMode = computed(() => props.mode === 'software')
const isComputeMode = computed(() => props.mode === 'compute')
const isRechargeMode = computed(() => props.mode === 'recharge')

const modeMeta = computed(() => {
  if (isComputeMode.value) {
    return {
      eyebrow: 'Compute Package',
      title: '算力购买',
      subtitle: '选择算力包，下单后自动在浏览器中打开支付宝支付页面。'
    }
  }

  if (isRechargeMode.value) {
    return {
      eyebrow: 'Direct Recharge',
      title: '算力直充',
      subtitle: '选择余额类型和充值金额，创建真实支付订单后跳转支付宝。'
    }
  }

  return {
    eyebrow: 'Software License',
    title: '授权购买',
    subtitle: '填写基础信息并选择授权套餐，支付完成后当前设备会自动尝试激活。'
  }
})

const visibleSoftwarePackages = computed(() => Array.isArray(props.softwarePackages) ? props.softwarePackages : [])
const visibleComputePackages = computed(() => Array.isArray(props.computePackages) ? props.computePackages : [])

const submitDisabled = computed(() => {
  if (isSoftwareMode.value) {
    return props.isSoftwareOrderSubmitting || !selectionState.softwarePackageId
  }

  if (isComputeMode.value) {
    return props.isComputePackageOrderSubmitting || !selectionState.computePackageId
  }

  return props.isRechargeSubmitting || !(Number(props.rechargeForm.amountCny) >= 0.01)
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

watch(
  () => props.softwarePackages,
  (packages) => {
    if (!Array.isArray(packages) || !packages.length) {
      selectionState.softwarePackageId = ''
      return
    }

    const exists = packages.some((item) => item.id === selectionState.softwarePackageId)
    if (!exists) {
      selectionState.softwarePackageId = packages[0].id
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

function updateRechargeField(field, value) {
  emit('update-recharge-form', { field, value })
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
    <div class="commerce-order-modal__card">
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
            <input v-model="activationForm.customerName" type="text" placeholder="请输入用户名">
          </label>

          <label class="commerce-order-modal__field">
            <span>手机号</span>
            <input v-model="activationForm.contact" type="text" placeholder="请输入手机号">
          </label>

          <label class="commerce-order-modal__field">
            <span>邀请码</span>
            <input v-model="activationForm.inviteCode" type="text" placeholder="选填">
          </label>
        </div>
      </section>

      <section v-if="isRechargeMode" class="commerce-order-modal__section">
        <div class="commerce-order-modal__grid commerce-order-modal__grid--triple">
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
              min="0.01"
              step="0.01"
              placeholder="0.01"
              @input="updateRechargeField('amountCny', $event.target.value)"
            >
          </label>
        </div>
      </section>

      <section class="commerce-order-modal__section">
        <div class="commerce-order-modal__section-head">
          <span>{{ isSoftwareMode ? '授权套餐' : (isComputeMode ? '算力套餐' : '订单信息') }}</span>
          <span v-if="isCatalogLoading && !isRechargeMode">加载中...</span>
        </div>

        <div v-if="isSoftwareMode" class="commerce-order-modal__list">
          <button
            v-for="pkg in visibleSoftwarePackages"
            :key="pkg.id"
            type="button"
            class="commerce-order-modal__option"
            :class="{ 'commerce-order-modal__option--active': selectionState.softwarePackageId === pkg.id }"
            @click="selectionState.softwarePackageId = pkg.id"
          >
            <div class="commerce-order-modal__option-copy">
              <strong>{{ pkg.name }}</strong>
              <span>{{ pkg.description || pkg.productName }}</span>
            </div>
            <div class="commerce-order-modal__option-side">
              <strong>{{ formatAmount(pkg.priceAmount) }}</strong>
              <small>{{ pkg.currency || 'CNY' }}</small>
            </div>
          </button>
        </div>

        <div v-else-if="isComputeMode" class="commerce-order-modal__list">
          <button
            v-for="pkg in visibleComputePackages"
            :key="pkg.id"
            type="button"
            class="commerce-order-modal__option"
            :class="{ 'commerce-order-modal__option--active': selectionState.computePackageId === pkg.id }"
            @click="selectionState.computePackageId = pkg.id"
          >
            <div class="commerce-order-modal__option-copy">
              <strong>{{ pkg.name }}</strong>
              <span>{{ pkg.description || pkg.productName }}</span>
            </div>
            <div class="commerce-order-modal__option-side">
              <strong>{{ formatAmount(pkg.priceAmount) }}</strong>
              <small>{{ pkg.currency || 'CNY' }}</small>
            </div>
          </button>
        </div>

        <div v-else class="commerce-order-modal__summary">
          <div class="commerce-order-modal__summary-item">
            <span>支付方式</span>
            <strong>{{ rechargeForm.channel === 'wechat' ? '微信' : '支付宝' }}</strong>
          </div>
          <div class="commerce-order-modal__summary-item">
            <span>充值到</span>
            <strong>{{ rechargeForm.walletType === 'video' ? '视频余额' : (rechargeForm.walletType === 'text' ? '文本余额' : '图片余额') }}</strong>
          </div>
          <div class="commerce-order-modal__summary-item">
            <span>订单金额</span>
            <strong>{{ formatAmount(rechargeForm.amountCny) }} CNY</strong>
          </div>
        </div>
      </section>

      <section class="commerce-order-modal__section">
        <div class="commerce-order-modal__grid commerce-order-modal__grid--single">
          <label class="commerce-order-modal__field">
            <span>支付方式</span>
            <select
              :value="isRechargeMode ? rechargeForm.channel : 'alipay'"
              :disabled="true"
            >
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
  padding: 24px;
  border-radius: 24px;
  border: 1px solid rgba(255, 255, 255, 0.08);
  background: rgba(11, 16, 27, 0.96);
  box-shadow: 0 24px 60px rgba(0, 0, 0, 0.35);
}

.commerce-order-modal__header {
  display: flex;
  align-items: flex-start;
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
}

.commerce-order-modal__field span {
  color: rgba(205, 214, 238, 0.78);
  font-size: 13px;
}

.commerce-order-modal__list {
  display: grid;
  gap: 12px;
  max-height: 320px;
  overflow: auto;
  padding-right: 4px;
}

.commerce-order-modal__option {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
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

.commerce-order-modal__option:hover,
.commerce-order-modal__option--active {
  border-color: rgba(118, 173, 255, 0.5);
  background: rgba(118, 173, 255, 0.08);
  transform: translateY(-1px);
}

.commerce-order-modal__option-copy {
  display: grid;
  gap: 6px;
}

.commerce-order-modal__option-copy span {
  color: rgba(205, 214, 238, 0.72);
}

.commerce-order-modal__option-side {
  display: grid;
  justify-items: end;
  gap: 4px;
}

.commerce-order-modal__option-side strong {
  font-size: 24px;
}

.commerce-order-modal__summary {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 12px;
}

.commerce-order-modal__summary-item {
  display: grid;
  gap: 8px;
  padding: 14px 16px;
  border-radius: 18px;
  background: rgba(255, 255, 255, 0.03);
  border: 1px solid rgba(255, 255, 255, 0.06);
}

.commerce-order-modal__summary-item span {
  color: rgba(205, 214, 238, 0.72);
  font-size: 12px;
}

.commerce-order-modal__summary-item strong {
  font-size: 18px;
}

.commerce-order-modal__footer {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
}

@media (max-width: 820px) {
  .commerce-order-modal {
    padding: 16px;
  }

  .commerce-order-modal__card {
    padding: 18px;
  }

  .commerce-order-modal__grid--triple,
  .commerce-order-modal__option,
  .commerce-order-modal__summary {
    grid-template-columns: 1fr;
  }

  .commerce-order-modal__option-side,
  .commerce-order-modal__footer {
    justify-items: stretch;
    justify-content: stretch;
  }
}
</style>
