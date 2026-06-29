<script setup>
import { computed } from 'vue'

const props = defineProps({
  activationState: {
    type: Object,
    required: true
  },
  isRefreshingBalances: {
    type: Boolean,
    default: false
  },
  productProjects: {
    type: Array,
    default: () => []
  }
})

const emit = defineEmits(['refresh-balances'])
const decode = (value) => JSON.parse('"' + value + '"')

const copy = {
  title: decode('\\u6570\\u636e\\u4e2d\\u5fc3'),
  subtitle: decode('\\u67e5\\u770b\\u5f53\\u524d\\u4f59\\u989d\\u548c\\u5386\\u53f2\\u9879\\u76ee\\u8d44\\u4ea7\\u3002'),
  walletTitle: decode('\\u4f59\\u989d\\u8d44\\u4ea7'),
  permanentTitle: decode('\\u76f4\\u5145\\uff08\\u6c38\\u4e45\\uff09'),
  subscriptionTitle: decode('\\u7b97\\u529b\\u5305\\uff08\\u6708\\u5ea6\\u4f1a\\u5458\\uff09'),
  refresh: decode('\\u5237\\u65b0'),
  refreshing: decode('\\u5237\\u65b0\\u4e2d...'),
  historyTitle: decode('\\u5386\\u53f2\\u9879\\u76ee\\u8d44\\u4ea7'),
  projectCountSuffix: decode('\\u4e2a\\u9879\\u76ee'),
  updatedAtPrefix: decode('\\u66f4\\u65b0\\u4e8e'),
  titleMetric: decode('\\u6807\\u9898'),
  descriptionMetric: decode('\\u63cf\\u8ff0'),
  imageMetric: decode('\\u5957\\u56fe'),
  videoMetric: decode('\\u89c6\\u9891'),
  emptyTitle: decode('\\u6682\\u65e0\\u9879\\u76ee\\u8d44\\u4ea7'),
  emptyDescription: decode('\\u5b8c\\u6210\\u4efb\\u52a1\\u540e\\uff0c\\u6807\\u9898\\u3001\\u63cf\\u8ff0\\u3001\\u5957\\u56fe\\u548c\\u89c6\\u9891\\u8d44\\u4ea7\\u4f1a\\u5728\\u8fd9\\u91cc\\u7d2f\\u8ba1\\u3002'),
  unnamedProject: decode('\\u672a\\u547d\\u540d\\u9879\\u76ee'),
  textBalance: decode('\\u6587\\u672c'),
  imageBalance: decode('\\u56fe\\u7247'),
  videoBalance: decode('\\u89c6\\u9891'),
  unit: 'CNY'
}

function resolveWalletSourceBalance(resourceKey, sourceKey) {
  const walletSummary = props.activationState?.walletSummary || {}
  const splitBalance = walletSummary?.splitBalances?.[resourceKey]
  if (splitBalance && typeof splitBalance === 'object') {
    return Math.max(0, Number(splitBalance?.[sourceKey] || 0)).toFixed(2)
  }

  const legacyMap = {
    text: 'textBalanceCny',
    image: 'imageBalanceCny',
    video: 'videoBalanceCny'
  }

  if (sourceKey === 'permanentBalanceCny') {
    const subscription = Math.max(0, Number(walletSummary?.subscriptionBalances?.[resourceKey]) || 0)
    const permanent = Math.max(0, Number(walletSummary?.permanentBalances?.[resourceKey]) || 0)
    if (subscription + permanent > 0) {
      return permanent.toFixed(2)
    }
    return Math.max(0, Number(walletSummary?.[legacyMap[resourceKey]]) || 0).toFixed(2)
  }

  return Math.max(0, Number(walletSummary?.subscriptionBalances?.[resourceKey]) || 0).toFixed(2)
}

const walletPanels = computed(() => {
  return [
    {
      key: 'permanent',
      title: copy.permanentTitle,
      rows: [
        { key: 'text', label: copy.textBalance, value: resolveWalletSourceBalance('text', 'permanentBalanceCny') },
        { key: 'image', label: copy.imageBalance, value: resolveWalletSourceBalance('image', 'permanentBalanceCny') },
        { key: 'video', label: copy.videoBalance, value: resolveWalletSourceBalance('video', 'permanentBalanceCny') }
      ]
    },
    {
      key: 'subscription',
      title: copy.subscriptionTitle,
      rows: [
        { key: 'text', label: copy.textBalance, value: resolveWalletSourceBalance('text', 'subscriptionBalanceCny') },
        { key: 'image', label: copy.imageBalance, value: resolveWalletSourceBalance('image', 'subscriptionBalanceCny') },
        { key: 'video', label: copy.videoBalance, value: resolveWalletSourceBalance('video', 'subscriptionBalanceCny') }
      ]
    }
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
      name: String(project?.name || project?.baseInfo?.productName || copy.unnamedProject).trim() || copy.unnamedProject,
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

function handleRefresh() {
  emit('refresh-balances')
}
</script>

<template>
  <section class="data-center-page">
    <header class="data-center-page__hero">
      <div>
        <span class="data-center-page__eyebrow">Assets</span>
        <h1>{{ copy.title }}</h1>
        <p>{{ copy.subtitle }}</p>
      </div>
    </header>

    <section class="data-center-page__panel">
      <header class="data-center-page__panel-header">
        <strong>{{ copy.walletTitle }}</strong>
        <button
          class="data-center-page__refresh-button"
          type="button"
          :disabled="isRefreshingBalances"
          @click="handleRefresh"
        >
          {{ isRefreshingBalances ? copy.refreshing : copy.refresh }}
        </button>
      </header>

      <div class="data-center-page__wallet-grid">
        <article v-for="panel in walletPanels" :key="panel.key" class="data-center-page__wallet-card">
          <header class="data-center-page__wallet-card-header">
            <strong>{{ panel.title }}</strong>
          </header>
          <div class="data-center-page__wallet-rows">
            <div v-for="row in panel.rows" :key="`${panel.key}-${row.key}`" class="data-center-page__wallet-row">
              <span>{{ row.label }}</span>
              <div class="data-center-page__wallet-row-value">
                <strong>{{ row.value }}</strong>
                <small>{{ copy.unit }}</small>
              </div>
            </div>
          </div>
        </article>
      </div>
    </section>

    <section class="data-center-page__panel">
      <header class="data-center-page__panel-header">
        <strong>{{ copy.historyTitle }}</strong>
        <span>{{ historicalAssets.length }} {{ copy.projectCountSuffix }}</span>
      </header>

      <div v-if="historicalAssets.length" class="data-center-page__project-list">
        <article
          v-for="item in historicalAssets"
          :key="item.id"
          class="data-center-page__project-card"
        >
          <div class="data-center-page__project-copy">
            <strong>{{ item.name }}</strong>
            <span>{{ copy.updatedAtPrefix }} {{ formatDateTime(item.updatedAt) }}</span>
          </div>

          <div class="data-center-page__project-metrics">
            <span>{{ copy.titleMetric }} {{ item.hasTitle ? '1' : '0' }}</span>
            <span>{{ copy.descriptionMetric }} {{ item.hasDescription ? '1' : '0' }}</span>
            <span>{{ copy.imageMetric }} {{ item.imageCount }}</span>
            <span>{{ copy.videoMetric }} {{ item.videoCount }}</span>
          </div>
        </article>
      </div>

      <div v-else class="data-center-page__empty">
        <strong>{{ copy.emptyTitle }}</strong>
        <span>{{ copy.emptyDescription }}</span>
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
  align-items: center;
  gap: 12px;
}

.data-center-page__refresh-button {
  min-height: 34px;
  padding: 0 14px;
  border: 1px solid rgba(118, 173, 255, 0.28);
  border-radius: 999px;
  background: rgba(26, 36, 58, 0.9);
  color: rgba(240, 245, 255, 0.96);
  cursor: pointer;
  transition: background 0.18s ease, border-color 0.18s ease, opacity 0.18s ease;
}

.data-center-page__refresh-button:hover:enabled {
  background: rgba(34, 48, 77, 0.98);
  border-color: rgba(118, 173, 255, 0.42);
}

.data-center-page__refresh-button:disabled {
  opacity: 0.6;
  cursor: default;
}

.data-center-page__wallet-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 14px;
}

.data-center-page__wallet-card {
  display: flex;
  flex-direction: column;
  gap: 14px;
  padding: 18px;
}

.data-center-page__wallet-card-header strong {
  font-size: 18px;
}

.data-center-page__wallet-rows {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.data-center-page__wallet-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 12px 14px;
  border-radius: 16px;
  background: rgba(9, 13, 23, 0.72);
}

.data-center-page__wallet-row-value {
  display: flex;
  align-items: baseline;
  gap: 8px;
}

.data-center-page__wallet-row-value strong {
  font-size: 22px;
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
    align-items: stretch;
  }
}
</style>
