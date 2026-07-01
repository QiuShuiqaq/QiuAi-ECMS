<script setup>
import { computed } from 'vue'

const props = defineProps({
  activeProjectName: { type: String, default: '' },
  selectionManifest: { type: Object, default: () => ({ generatedAt: '', boards: [], updateState: {} }) },
  selectionPlatforms: { type: Array, default: () => [] },
  selectionState: {
    type: Object,
    default: () => ({
      items: [],
      totalItems: 0,
      platform: 'temu',
      boardType: 'hot-sale',
      keyword: '',
      page: 1,
      pageSize: 10,
      isLoading: false,
      error: ''
    })
  }
})

const emit = defineEmits([
  'selection-query-change',
  'selection-import',
  'selection-open-source'
])

const fallbackPlatformOptions = [
  { key: 'temu', label: 'TEMU' },
  { key: 'shein', label: 'SHEIN' },
  { key: 'amazon', label: 'Amazon' },
  { key: 'tiktok', label: 'TikTok' }
]

const boardOptions = [
  { label: '热销商品', value: 'hot-sale' },
  { label: '热销新品', value: 'hot-sale-new' },
  { label: '新店热销', value: 'new-mall-hot-sale' },
  { label: '大卖新品', value: 'big-sale-new' }
]

const updateState = computed(() => {
  return props.selectionManifest?.updateState && typeof props.selectionManifest.updateState === 'object'
    ? props.selectionManifest.updateState
    : {}
})

const isUpdateLocked = computed(() => Boolean(updateState.value?.isUpdating))

const platformOptions = computed(() => {
  const rows = Array.isArray(props.selectionPlatforms) ? props.selectionPlatforms.filter((item) => item?.key) : []
  return rows.length ? rows : fallbackPlatformOptions
})

const platformLabelMap = computed(() => {
  return new Map(platformOptions.value.map((item) => [String(item.key), String(item.label || item.key)]))
})

const selectionItems = computed(() => Array.isArray(props.selectionState?.items) ? props.selectionState.items : [])

const currentPage = computed(() => Math.max(1, Number(props.selectionState?.page) || 1))

const totalPages = computed(() => {
  const totalItems = Number(props.selectionState?.totalItems) || 0
  const pageSize = Math.max(1, Number(props.selectionState?.pageSize) || 10)
  return Math.max(1, Math.ceil(totalItems / pageSize))
})

const visibleRangeText = computed(() => {
  const totalItems = Number(props.selectionState?.totalItems) || 0
  if (!totalItems) {
    return '0-0 / 0'
  }

  const pageSize = Math.max(1, Number(props.selectionState?.pageSize) || 10)
  const start = (currentPage.value - 1) * pageSize + 1
  const end = Math.min(currentPage.value * pageSize, totalItems)
  return `${start}-${end} / ${totalItems}`
})

const progressPercent = computed(() => {
  if (!updateState.value?.isUpdating) {
    return 0
  }

  const rawValue = Number(updateState.value?.progressPercent)
  if (Number.isFinite(rawValue)) {
    return Math.max(0, Math.min(100, rawValue))
  }

  const completedJobs = Number(updateState.value?.completedJobs) || 0
  const totalJobs = Number(updateState.value?.totalJobs) || 0
  return totalJobs > 0 ? Math.round((completedJobs / totalJobs) * 100) : 0
})

const estimatedTimeText = computed(() => {
  if (!updateState.value?.isUpdating) {
    return ''
  }

  const totalJobs = Number(updateState.value?.totalJobs) || 0
  const completedJobs = Number(updateState.value?.completedJobs) || 0
  const startedAt = String(updateState.value?.startedAt || '').trim()
  if (!startedAt || completedJobs <= 0 || totalJobs <= 0) {
    return '预计 15-30 分钟'
  }

  const startedTime = new Date(startedAt).getTime()
  if (!Number.isFinite(startedTime) || startedTime <= 0) {
    return '预计 15-30 分钟'
  }

  const elapsedMs = Date.now() - startedTime
  if (elapsedMs <= 0) {
    return '预计 15-30 分钟'
  }

  const remainingJobs = Math.max(0, totalJobs - completedJobs)
  const avgPerJobMs = elapsedMs / completedJobs
  const remainingMinutes = Math.max(1, Math.ceil((remainingJobs * avgPerJobMs) / 60000))
  return `预计剩余 ${remainingMinutes} 分钟`
})

const statusText = computed(() => {
  if (updateState.value?.isUpdating) {
    const currentPlatform = platformLabelMap.value.get(String(updateState.value?.currentPlatform || '').trim()) ||
      String(updateState.value?.currentPlatform || '').trim().toUpperCase()
    const currentBoard = boardOptions.find((item) => item.value === updateState.value?.currentBoardType)?.label || ''
    const completedJobs = Number(updateState.value?.completedJobs) || 0
    const totalJobs = Number(updateState.value?.totalJobs) || 0
    const detail = [currentPlatform, currentBoard].filter(Boolean).join(' / ')
    return `更新中 ${completedJobs}/${totalJobs}${detail ? ` · ${detail}` : ''}`
  }

  if (updateState.value?.status === 'risk-stop') {
    return '数据源异常，请联系管理员'
  }

  if (updateState.value?.status === 'failed') {
    return '数据更新失败，请稍后重试'
  }

  if (props.selectionState?.error) {
    return props.selectionState.error
  }

  const nextRefreshAt = String(props.selectionManifest?.nextRefreshAt || '').trim()
  if (!nextRefreshAt) {
    return '下次更新：待生成'
  }

  return `下次更新：${nextRefreshAt.slice(0, 16).replace('T', ' ')}`
})

function emitSelectionQueryPatch(patch) {
  if (isUpdateLocked.value) {
    return
  }
  emit('selection-query-change', patch)
}

function goToPage(page) {
  const nextPage = Math.max(1, Math.min(totalPages.value, Number(page) || 1))
  if (nextPage === currentPage.value || isUpdateLocked.value) {
    return
  }
  emitSelectionQueryPatch({ page: nextPage })
}

function formatCapturedAt(value = '') {
  const normalizedValue = String(value || '').trim()
  if (!normalizedValue) {
    return '待同步'
  }
  return normalizedValue.slice(0, 16).replace('T', ' ')
}
</script>

<template>
  <section class="selection-center-page">
    <section class="selection-toolbar">
      <label class="selection-toolbar__field">
        <span>平台</span>
        <select :value="selectionState.platform || 'temu'" :disabled="isUpdateLocked" @change="emitSelectionQueryPatch({ platform: $event.target.value, page: 1 })">
          <option v-for="option in platformOptions" :key="`selection-platform-${option.key}`" :value="option.key">
            {{ option.label }}
          </option>
        </select>
      </label>

      <label class="selection-toolbar__field">
        <span>榜单</span>
        <select :value="selectionState.boardType || 'hot-sale'" :disabled="isUpdateLocked" @change="emitSelectionQueryPatch({ boardType: $event.target.value, page: 1 })">
          <option v-for="option in boardOptions" :key="`selection-board-${option.value}`" :value="option.value">
            {{ option.label }}
          </option>
        </select>
      </label>

      <label class="selection-toolbar__field selection-toolbar__field--keyword">
        <span>关键词</span>
        <input
          :value="selectionState.keyword || ''"
          type="text"
          placeholder="按标题筛选"
          :disabled="isUpdateLocked"
          @change="emitSelectionQueryPatch({ keyword: $event.target.value, page: 1 })"
        >
      </label>

      <div class="selection-toolbar__status" :class="{ 'selection-toolbar__status--warning': isUpdateLocked }">
        <span>状态</span>
        <strong>{{ statusText }}</strong>
      </div>
    </section>

    <section v-if="isUpdateLocked" class="selection-progress-panel">
      <div class="selection-progress-panel__header">
        <strong>数据更新中</strong>
        <span>{{ estimatedTimeText }}</span>
      </div>
      <div class="selection-progress-bar">
        <div class="selection-progress-bar__fill" :style="{ width: `${progressPercent}%` }"></div>
      </div>
      <div class="selection-progress-panel__footer">
        <span>更新期间请不要操作</span>
        <span>{{ `${progressPercent}%` }}</span>
      </div>
    </section>

    <section class="selection-table-panel">
      <div class="selection-table-panel__header">
        <strong>商品列表</strong>
        <div class="selection-table-panel__meta">
          <span>{{ visibleRangeText }}</span>
          <span v-if="activeProjectName">{{ `当前项目：${activeProjectName}` }}</span>
        </div>
      </div>

      <div class="selection-table-panel__body">
        <div class="selection-table selection-table--header">
          <span>商品</span>
          <span>平台</span>
          <span>销量</span>
          <span>价格</span>
          <span>快照时间</span>
          <span>操作</span>
        </div>

        <div v-if="selectionItems.length" class="selection-table__rows">
          <article v-for="item in selectionItems" :key="item.id" class="selection-table selection-table--row">
            <div class="selection-row__product">
              <img class="selection-row__preview" :src="item.primaryImageUrl" :alt="item.title || '商品预览'">
              <div class="selection-row__copy">
                <strong>{{ item.title || '未命名商品' }}</strong>
                <span>{{ item.categoryText || '未分类' }}</span>
              </div>
            </div>
            <span>{{ platformLabelMap.get(item.platform) || item.platform }}</span>
            <span>{{ item.salesVolumeText || '待补' }}</span>
            <span>{{ item.priceText || '待补' }}</span>
            <span>{{ formatCapturedAt(item.capturedAt) }}</span>
            <div class="selection-row__actions">
              <button class="secondary-action" type="button" @click="emit('selection-open-source', item.sourceDetailUrl)">源地址</button>
              <button class="primary-action" type="button" :disabled="isUpdateLocked" @click="emit('selection-import', { item, mode: 'create' })">导入商品</button>
            </div>
          </article>
        </div>

        <div v-else-if="selectionState.isLoading" class="product-result-empty selection-table-panel__empty">
          <span>正在加载数据</span>
        </div>

        <div v-else class="product-result-empty selection-table-panel__empty">
          <span>当前条件下暂无数据</span>
        </div>
      </div>

      <footer class="selection-pagination">
        <button class="secondary-action" type="button" :disabled="currentPage <= 1 || isUpdateLocked" @click="goToPage(currentPage - 1)">上一页</button>
        <span>{{ `第 ${currentPage} / ${totalPages} 页` }}</span>
        <button class="secondary-action" type="button" :disabled="currentPage >= totalPages || isUpdateLocked" @click="goToPage(currentPage + 1)">下一页</button>
      </footer>
    </section>
  </section>
</template>

<style scoped>
.selection-center-page {
  display: grid;
  grid-template-rows: auto auto minmax(0, 1fr);
  gap: 16px;
  min-height: calc(100vh - 180px);
}

.selection-toolbar {
  display: grid;
  grid-template-columns: 180px 180px minmax(240px, 1fr) minmax(280px, 360px);
  gap: 12px;
  align-items: end;
}

.selection-toolbar__field,
.selection-toolbar__status {
  display: grid;
  gap: 8px;
  padding: 14px 16px;
  border: 1px solid rgba(255, 255, 255, 0.06);
  border-radius: 18px;
  background: rgba(255, 255, 255, 0.024);
}

.selection-toolbar__field span,
.selection-toolbar__status span {
  color: #a8a2bb;
  font-size: 11px;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.selection-toolbar__field select,
.selection-toolbar__field input {
  width: 100%;
  min-width: 0;
  border: 1px solid rgba(255, 255, 255, 0.08);
  background: rgba(255, 255, 255, 0.04);
  color: #f5efff;
  border-radius: 14px;
  padding: 12px 14px;
  outline: none;
}

.selection-toolbar__status strong {
  color: #f7f2ff;
  font-size: 13px;
  line-height: 1.5;
}

.selection-toolbar__status--warning {
  border-color: rgba(255, 183, 77, 0.32);
  background: rgba(255, 183, 77, 0.08);
}

.selection-progress-panel,
.selection-table-panel {
  border: 1px solid rgba(255, 255, 255, 0.06);
  border-radius: 20px;
  background: rgba(255, 255, 255, 0.024);
  padding: 16px 18px;
}

.selection-progress-panel {
  display: grid;
  gap: 10px;
}

.selection-progress-panel__header,
.selection-progress-panel__footer,
.selection-table-panel__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.selection-pagination {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
}

.selection-progress-panel__header strong,
.selection-table-panel__header strong {
  color: #f7f2ff;
}

.selection-progress-panel__header span,
.selection-progress-panel__footer span,
.selection-table-panel__meta span,
.selection-pagination span {
  color: #c4bdd8;
  font-size: 12px;
}

.selection-progress-bar {
  height: 10px;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.08);
  overflow: hidden;
}

.selection-progress-bar__fill {
  height: 100%;
  border-radius: 999px;
  background: linear-gradient(90deg, #84f7be 0%, #55d6ff 100%);
  transition: width 0.25s ease;
}

.selection-table-panel {
  display: grid;
  grid-template-rows: auto minmax(0, 1fr) auto;
  gap: 14px;
  min-height: 0;
}

.selection-table-panel__meta {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
}

.selection-table-panel__body {
  min-height: 0;
  max-height: calc(100vh - 390px);
  overflow: auto;
  padding-right: 8px;
  scrollbar-width: thin;
  scrollbar-color: rgba(132, 247, 190, 0.42) rgba(255, 255, 255, 0.04);
}

.selection-table-panel__body::-webkit-scrollbar:vertical {
  width: 10px;
}

.selection-table-panel__body::-webkit-scrollbar-track:vertical {
  background: rgba(255, 255, 255, 0.04);
  border-radius: 999px;
}

.selection-table-panel__body::-webkit-scrollbar-thumb:vertical {
  background: rgba(132, 247, 190, 0.42);
  border-radius: 999px;
}

.selection-table {
  display: grid;
  grid-template-columns: minmax(360px, 2.2fr) 0.7fr 0.8fr 0.8fr 1fr minmax(188px, 1.35fr);
  gap: 14px;
  align-items: center;
}

.selection-table--header {
  position: sticky;
  top: 0;
  z-index: 1;
  padding: 0 0 10px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.06);
  color: #a8a2bb;
  font-size: 12px;
  background: rgba(19, 22, 32, 0.95);
}

.selection-table__rows {
  display: grid;
}

.selection-table--row {
  padding: 12px 0;
  border-bottom: 1px solid rgba(255, 255, 255, 0.05);
}

.selection-row__product {
  display: grid;
  grid-template-columns: 72px minmax(0, 1fr);
  gap: 12px;
  align-items: center;
  min-width: 0;
}

.selection-row__preview {
  width: 72px;
  height: 72px;
  border-radius: 12px;
  object-fit: cover;
  background: rgba(255, 255, 255, 0.04);
}

.selection-row__copy {
  display: grid;
  gap: 6px;
  min-width: 0;
}

.selection-row__copy strong {
  display: -webkit-box;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
  overflow: hidden;
  color: #f7f2ff;
  line-height: 1.45;
}

.selection-row__copy span {
  color: #a8a2bb;
  font-size: 12px;
}

.selection-row__actions {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  align-items: center;
  gap: 8px;
  min-width: 0;
}

.selection-row__actions .secondary-action,
.selection-row__actions .primary-action {
  width: 100%;
  min-width: 0;
  padding-inline: 10px;
  white-space: nowrap;
}

.selection-table--row > span {
  color: #d7d1e7;
  font-size: 13px;
}

.selection-table-panel__empty {
  min-height: 180px;
}

select option {
  background: #171424;
  color: #f5efff;
}
</style>
