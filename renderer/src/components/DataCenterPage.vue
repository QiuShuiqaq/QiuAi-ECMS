<script setup>
import { computed } from 'vue'

const props = defineProps({
  activationState: {
    type: Object,
    required: true
  },
  productProjects: {
    type: Array,
    default: () => []
  }
})

const walletCards = computed(() => {
  const walletSummary = props.activationState?.walletSummary || {}
  return [
    { key: 'text', label: '文本余额', value: Number(walletSummary.textBalanceCny || 0).toFixed(2), unit: 'CNY' },
    { key: 'image', label: '图片余额', value: Number(walletSummary.imageBalanceCny || 0).toFixed(2), unit: 'CNY' },
    { key: 'video', label: '视频余额', value: Number(walletSummary.videoBalanceCny || 0).toFixed(2), unit: 'CNY' }
  ]
})

const historicalAssets = computed(() => {
  return (props.productProjects || []).map((project) => {
    const generatedImages = Array.isArray(project?.assets?.generatedImages) ? project.assets.generatedImages.length : 0
    const generatedVideo = project?.assets?.generatedVideo ? 1 : 0
    const title = String(project?.content?.selectedTitle || '').trim()
    const description = String(project?.content?.selectedDescription || '').trim()

    return {
      id: project.id,
      name: String(project?.name || project?.baseInfo?.productName || '未命名项目').trim() || '未命名项目',
      imageCount: generatedImages,
      videoCount: generatedVideo,
      hasTitle: Boolean(title),
      hasDescription: Boolean(description),
      updatedAt: String(project?.updatedAt || project?.createdAt || '').trim()
    }
  }).sort((left, right) => {
    const rightTime = new Date(right.updatedAt || 0).getTime()
    const leftTime = new Date(left.updatedAt || 0).getTime()
    return rightTime - leftTime
  })
})

function formatDateTime(value = '') {
  const text = String(value || '').trim()
  return text ? text.replace('T', ' ').slice(0, 19) : '--'
}
</script>

<template>
  <section class="data-center-page">
    <header class="data-center-page__hero">
      <div>
        <span class="data-center-page__eyebrow">Assets</span>
        <h1>数据中心</h1>
        <p>查看当前余额和历史项目资产沉淀。</p>
      </div>
    </header>

    <section class="data-center-page__panel">
      <header class="data-center-page__panel-header">
        <strong>余额资产</strong>
      </header>

      <div class="data-center-page__wallet-grid">
        <article v-for="card in walletCards" :key="card.key" class="data-center-page__wallet-card">
          <span>{{ card.label }}</span>
          <strong>{{ card.value }}</strong>
          <small>{{ card.unit }}</small>
        </article>
      </div>
    </section>

    <section class="data-center-page__panel">
      <header class="data-center-page__panel-header">
        <strong>历史项目资产</strong>
        <span>{{ historicalAssets.length }} 个项目</span>
      </header>

      <div v-if="historicalAssets.length" class="data-center-page__project-list">
        <article
          v-for="item in historicalAssets"
          :key="item.id"
          class="data-center-page__project-card"
        >
          <div class="data-center-page__project-copy">
            <strong>{{ item.name }}</strong>
            <span>更新于 {{ formatDateTime(item.updatedAt) }}</span>
          </div>

          <div class="data-center-page__project-metrics">
            <span>标题 {{ item.hasTitle ? '1' : '0' }}</span>
            <span>描述 {{ item.hasDescription ? '1' : '0' }}</span>
            <span>套图 {{ item.imageCount }}</span>
            <span>视频 {{ item.videoCount }}</span>
          </div>
        </article>
      </div>

      <div v-else class="data-center-page__empty">
        <strong>暂无项目资产</strong>
        <span>完成任务后，标题、描述、套图和视频资产会在这里累计。</span>
      </div>
    </section>
  </section>
</template>

<style scoped>
.data-center-page {
  display: flex;
  flex-direction: column;
  gap: 18px;
}

.data-center-page__hero,
.data-center-page__panel,
.data-center-page__wallet-card,
.data-center-page__project-card,
.data-center-page__empty {
  border-radius: 22px;
  border: 1px solid rgba(255, 255, 255, 0.08);
  background: rgba(14, 18, 30, 0.88);
}

.data-center-page__hero,
.data-center-page__panel {
  padding: 22px;
}

.data-center-page__eyebrow {
  display: inline-flex;
  margin-bottom: 10px;
  font-size: 12px;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: rgba(118, 173, 255, 0.88);
}

.data-center-page__hero h1,
.data-center-page__panel-header strong {
  margin: 0;
}

.data-center-page__hero p,
.data-center-page__panel-header span,
.data-center-page__wallet-card span,
.data-center-page__wallet-card small,
.data-center-page__project-copy span,
.data-center-page__empty span {
  color: rgba(205, 214, 238, 0.76);
}

.data-center-page__panel {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.data-center-page__panel-header {
  display: flex;
  justify-content: space-between;
  gap: 12px;
}

.data-center-page__wallet-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 14px;
}

.data-center-page__wallet-card {
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 18px;
}

.data-center-page__wallet-card strong {
  font-size: 28px;
}

.data-center-page__project-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.data-center-page__project-card {
  display: flex;
  justify-content: space-between;
  gap: 16px;
  padding: 16px 18px;
}

.data-center-page__project-copy,
.data-center-page__project-metrics {
  display: flex;
  gap: 10px;
}

.data-center-page__project-copy {
  flex-direction: column;
}

.data-center-page__project-metrics {
  flex-wrap: wrap;
  align-items: center;
}

.data-center-page__project-metrics span {
  padding: 8px 12px;
  border-radius: 999px;
  background: rgba(9, 13, 23, 0.72);
  color: rgba(226, 232, 244, 0.9);
}

.data-center-page__empty {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 18px;
}

@media (max-width: 1080px) {
  .data-center-page__wallet-grid {
    grid-template-columns: 1fr;
  }

  .data-center-page__project-card,
  .data-center-page__panel-header {
    flex-direction: column;
  }
}
</style>
