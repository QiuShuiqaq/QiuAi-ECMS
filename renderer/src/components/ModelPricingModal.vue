<script setup>
defineProps({
  visible: {
    type: Boolean,
    default: false
  }
})

const emit = defineEmits(['close'])

const textPricingItems = [
  { label: '标题生成', price: '0.01 元 / 次' },
  { label: '描述生成', price: '0.02 元 / 次' }
]

const imagePricingItems = [
  { model: 'gpt-image-2', price: '0.12 元 / 次' },
  { model: 'nano-banana-fast', price: '0.10 元 / 次' },
  { model: 'nano-banana-2', price: '0.18 元 / 次' }
]

const videoPricingItems = [
  { model: 'MiniMax-Hailuo-2.3-Fast', spec: '图生视频 / 768P / 6s', price: '2.70 元 / 条' },
  { model: 'MiniMax-Hailuo-2.3-Fast', spec: '图生视频 / 768P / 10s', price: '4.50 元 / 条' },
  { model: 'MiniMax-Hailuo-2.3-Fast', spec: '图生视频 / 1080P / 6s', price: '4.62 元 / 条' }
]
</script>

<template>
  <div
    v-if="visible"
    class="model-pricing-modal"
    role="dialog"
    aria-modal="true"
    aria-label="模型价格"
    @click.self="emit('close')"
  >
    <div class="model-pricing-modal__card">
      <header class="model-pricing-modal__header">
        <div>
          <span class="model-pricing-modal__eyebrow">Model Pricing</span>
          <strong>模型价格</strong>
          <p>文本、图片、视频分别按对应余额扣费，以下为当前客户端展示价格。</p>
        </div>

        <button class="secondary-action" type="button" @click="emit('close')">
          关闭
        </button>
      </header>

      <section class="model-pricing-modal__section">
        <div class="model-pricing-modal__section-title">
          <strong>文本生成</strong>
        </div>
        <div class="model-pricing-modal__simple-grid">
          <article v-for="item in textPricingItems" :key="item.label" class="model-pricing-modal__simple-card">
            <span>{{ item.label }}</span>
            <strong>{{ item.price }}</strong>
          </article>
        </div>
      </section>

      <section class="model-pricing-modal__section">
        <div class="model-pricing-modal__section-title">
          <strong>图片生成</strong>
        </div>
        <div class="model-pricing-modal__table">
          <div class="model-pricing-modal__row model-pricing-modal__row--head">
            <span>模型</span>
            <span>价格</span>
          </div>
          <div v-for="item in imagePricingItems" :key="item.model" class="model-pricing-modal__row">
            <span>{{ item.model }}</span>
            <strong>{{ item.price }}</strong>
          </div>
        </div>
      </section>

      <section class="model-pricing-modal__section">
        <div class="model-pricing-modal__section-title">
          <strong>视频生成</strong>
        </div>
        <div class="model-pricing-modal__table">
          <div class="model-pricing-modal__row model-pricing-modal__row--head model-pricing-modal__row--triple">
            <span>模型</span>
            <span>规格</span>
            <span>价格</span>
          </div>
          <div
            v-for="item in videoPricingItems"
            :key="`${item.model}-${item.spec}`"
            class="model-pricing-modal__row model-pricing-modal__row--triple"
          >
            <span>{{ item.model }}</span>
            <span>{{ item.spec }}</span>
            <strong>{{ item.price }}</strong>
          </div>
        </div>
      </section>
    </div>
  </div>
</template>

<style scoped>
.model-pricing-modal {
  position: fixed;
  inset: 0;
  z-index: 80;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
  background: rgba(4, 8, 15, 0.72);
  backdrop-filter: blur(14px);
}

.model-pricing-modal__card {
  width: min(920px, 100%);
  max-height: min(86vh, 900px);
  overflow: auto;
  border-radius: 28px;
  border: 1px solid rgba(255, 255, 255, 0.08);
  background: rgba(14, 18, 30, 0.96);
  box-shadow: 0 24px 80px rgba(0, 0, 0, 0.35);
}

.model-pricing-modal__header,
.model-pricing-modal__section {
  padding: 24px 26px;
}

.model-pricing-modal__header {
  display: flex;
  justify-content: space-between;
  gap: 16px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
}

.model-pricing-modal__header strong,
.model-pricing-modal__section-title strong {
  display: block;
  margin: 0;
}

.model-pricing-modal__header p,
.model-pricing-modal__eyebrow,
.model-pricing-modal__row span,
.model-pricing-modal__simple-card span {
  color: rgba(205, 214, 238, 0.76);
}

.model-pricing-modal__eyebrow {
  display: inline-flex;
  margin-bottom: 8px;
  font-size: 12px;
  letter-spacing: 0.14em;
  text-transform: uppercase;
}

.model-pricing-modal__section {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.model-pricing-modal__simple-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 14px;
}

.model-pricing-modal__simple-card {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 18px;
  border-radius: 18px;
  border: 1px solid rgba(255, 255, 255, 0.08);
  background: rgba(9, 13, 23, 0.72);
}

.model-pricing-modal__simple-card strong,
.model-pricing-modal__row strong {
  color: rgba(244, 248, 255, 0.96);
}

.model-pricing-modal__table {
  display: flex;
  flex-direction: column;
  border-radius: 18px;
  overflow: hidden;
  border: 1px solid rgba(255, 255, 255, 0.08);
}

.model-pricing-modal__row {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: 16px;
  align-items: center;
  padding: 16px 18px;
  background: rgba(9, 13, 23, 0.72);
}

.model-pricing-modal__row + .model-pricing-modal__row {
  border-top: 1px solid rgba(255, 255, 255, 0.06);
}

.model-pricing-modal__row--head {
  background: rgba(24, 32, 51, 0.9);
}

.model-pricing-modal__row--triple {
  grid-template-columns: minmax(220px, 1.2fr) minmax(0, 1fr) auto;
}

@media (max-width: 720px) {
  .model-pricing-modal {
    padding: 12px;
  }

  .model-pricing-modal__header {
    flex-direction: column;
  }

  .model-pricing-modal__simple-grid,
  .model-pricing-modal__row,
  .model-pricing-modal__row--triple {
    grid-template-columns: 1fr;
  }
}
</style>
