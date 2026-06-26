<script setup>
import { computed, ref, watch } from 'vue'

const props = defineProps({
  visible: {
    type: Boolean,
    default: false
  },
  formState: {
    type: Object,
    required: true
  },
  softwarePackages: {
    type: Array,
    default: () => []
  },
  isCatalogLoading: {
    type: Boolean,
    default: false
  },
  isSubmitting: {
    type: Boolean,
    default: false
  }
})

const emit = defineEmits(['close', 'submit-order'])

const selectedPackageId = ref('')

const hasPackages = computed(() => Array.isArray(props.softwarePackages) && props.softwarePackages.length > 0)

watch(
  () => props.softwarePackages,
  (packages) => {
    if (!Array.isArray(packages) || !packages.length) {
      selectedPackageId.value = ''
      return
    }

    const exists = packages.some((item) => item.id === selectedPackageId.value)
    if (!exists) {
      selectedPackageId.value = packages[0].id
    }
  },
  { immediate: true }
)

function formatAmount(value) {
  const numericValue = Number(value || 0)
  return Number.isFinite(numericValue) ? numericValue.toFixed(2) : '0.00'
}

function submitOrder() {
  if (!selectedPackageId.value) {
    return
  }

  emit('submit-order', selectedPackageId.value)
}
</script>

<template>
  <div
    v-if="visible"
    class="authorization-purchase-modal"
    role="dialog"
    aria-modal="true"
    aria-label="购买授权"
    @click.self="emit('close')"
  >
    <div class="authorization-purchase-modal__card">
      <header class="authorization-purchase-modal__header">
        <div>
          <span class="authorization-purchase-modal__eyebrow">购买授权</span>
          <strong>激活当前设备</strong>
        </div>

        <button type="button" class="secondary-action" @click="emit('close')">
          关闭
        </button>
      </header>

      <div class="authorization-purchase-modal__form">
        <label class="authorization-purchase-modal__field">
          <span>用户名</span>
          <input v-model="formState.customerName" type="text" placeholder="请输入用户名">
        </label>

        <label class="authorization-purchase-modal__field">
          <span>手机号</span>
          <input v-model="formState.contact" type="text" placeholder="请输入手机号">
        </label>

        <label class="authorization-purchase-modal__field authorization-purchase-modal__field--full">
          <span>邀请码（选填）</span>
          <input v-model="formState.inviteCode" type="text" placeholder="没有可留空">
        </label>
      </div>

      <section class="authorization-purchase-modal__packages">
        <div class="authorization-purchase-modal__packages-header">
          <span>授权套餐</span>
        </div>

        <div v-if="isCatalogLoading" class="authorization-purchase-modal__empty">
          正在加载授权套餐...
        </div>

        <div v-else-if="!hasPackages" class="authorization-purchase-modal__empty">
          暂无可购买授权套餐
        </div>

        <div v-else class="authorization-purchase-modal__package-list">
          <button
            v-for="pkg in softwarePackages"
            :key="pkg.id"
            type="button"
            class="authorization-purchase-modal__package-card"
            :class="{ 'authorization-purchase-modal__package-card--active': selectedPackageId === pkg.id }"
            @click="selectedPackageId = pkg.id"
          >
            <div class="authorization-purchase-modal__package-main">
              <strong>{{ pkg.name }}</strong>
              <span>{{ pkg.description || pkg.productName }}</span>
            </div>

            <div class="authorization-purchase-modal__package-side">
              <span class="authorization-purchase-modal__package-price">{{ formatAmount(pkg.priceAmount) }}</span>
              <small>{{ pkg.currency || 'CNY' }}</small>
            </div>
          </button>
        </div>
      </section>

      <footer class="authorization-purchase-modal__footer">
        <button
          type="button"
          class="primary-action"
          :disabled="isSubmitting || !selectedPackageId"
          @click="submitOrder"
        >
          {{ isSubmitting ? '创建订单中' : '确认购买授权' }}
        </button>
      </footer>
    </div>
  </div>
</template>

<style scoped>
.authorization-purchase-modal {
  position: fixed;
  inset: 0;
  z-index: 80;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
  background: rgba(6, 10, 18, 0.72);
  backdrop-filter: blur(14px);
}

.authorization-purchase-modal__card {
  display: grid;
  gap: 20px;
  width: min(760px, 100%);
  padding: 24px;
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 24px;
  background: rgba(11, 16, 27, 0.96);
  box-shadow: 0 24px 60px rgba(0, 0, 0, 0.35);
}

.authorization-purchase-modal__header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
}

.authorization-purchase-modal__header strong {
  display: block;
  margin-top: 6px;
  font-size: 28px;
}

.authorization-purchase-modal__eyebrow {
  color: rgba(118, 173, 255, 0.88);
  font-size: 12px;
  font-weight: 700;
  letter-spacing: 0.14em;
  text-transform: uppercase;
}

.authorization-purchase-modal__form {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 14px;
}

.authorization-purchase-modal__field {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.authorization-purchase-modal__field--full {
  grid-column: 1 / -1;
}

.authorization-purchase-modal__field span,
.authorization-purchase-modal__packages-header span {
  color: rgba(205, 214, 238, 0.78);
  font-size: 13px;
}

.authorization-purchase-modal__packages {
  display: grid;
  gap: 12px;
}

.authorization-purchase-modal__package-list {
  display: grid;
  gap: 12px;
}

.authorization-purchase-modal__package-card {
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

.authorization-purchase-modal__package-card:hover,
.authorization-purchase-modal__package-card--active {
  border-color: rgba(118, 173, 255, 0.5);
  background: rgba(118, 173, 255, 0.08);
  transform: translateY(-1px);
}

.authorization-purchase-modal__package-main {
  display: grid;
  gap: 6px;
}

.authorization-purchase-modal__package-main strong {
  font-size: 17px;
}

.authorization-purchase-modal__package-main span,
.authorization-purchase-modal__empty {
  color: rgba(205, 214, 238, 0.72);
}

.authorization-purchase-modal__package-side {
  display: grid;
  justify-items: end;
  gap: 4px;
}

.authorization-purchase-modal__package-price {
  font-size: 24px;
  font-weight: 700;
}

.authorization-purchase-modal__footer {
  display: flex;
  justify-content: flex-end;
}

@media (max-width: 760px) {
  .authorization-purchase-modal {
    padding: 16px;
  }

  .authorization-purchase-modal__card {
    padding: 18px;
  }

  .authorization-purchase-modal__form,
  .authorization-purchase-modal__package-card {
    grid-template-columns: 1fr;
  }

  .authorization-purchase-modal__package-side,
  .authorization-purchase-modal__footer {
    justify-items: stretch;
    justify-content: stretch;
  }
}
</style>
