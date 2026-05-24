<script setup>
import { computed, ref } from 'vue'

const props = defineProps({
  draftItems: {
    type: Array,
    required: true
  }
})

const emit = defineEmits(['update-draft-field'])

const activeFilter = ref('all')

const normalizedItems = computed(() => {
  return props.draftItems.map((item) => {
    const checklist = item.draftPayload?.checklist || {}
    const completedCount = Object.values(checklist).filter(Boolean).length
    const totalCount = Object.keys(checklist).length || 0
    const isReady = totalCount > 0 && completedCount === totalCount
    const publishStatus = item.draftPayload?.editor?.publishStatus || '待整理'

    return {
      ...item,
      publishStatus,
      completedCount,
      totalCount,
      isReady
    }
  })
})

const filteredItems = computed(() => {
  if (activeFilter.value === 'ready') {
    return normalizedItems.value.filter((item) => item.isReady || item.publishStatus === '已可发布')
  }

  if (activeFilter.value === 'blocked') {
    return normalizedItems.value.filter((item) => !item.isReady && item.publishStatus !== '已可发布')
  }

  if (activeFilter.value === 'waiting') {
    return normalizedItems.value.filter((item) => item.publishStatus === '待上架')
  }

  return normalizedItems.value
})

const summaryCards = computed(() => {
  const total = normalizedItems.value.length
  const ready = normalizedItems.value.filter((item) => item.isReady || item.publishStatus === '已可发布').length
  const waiting = normalizedItems.value.filter((item) => item.publishStatus === '待上架').length
  const blocked = normalizedItems.value.filter((item) => !item.isReady && item.publishStatus !== '已可发布').length

  return [
    { label: '全部草稿', value: String(total), hint: '当前待编排的上架链接' },
    { label: '可发布', value: String(ready), hint: '检查项已齐或已标记可发布' },
    { label: '待上架', value: String(waiting), hint: '已排到发布队列' },
    { label: '待补齐', value: String(blocked), hint: '仍有字段或检查项缺失' }
  ]
})

function updateField(draftId, path, event) {
  emit('update-draft-field', {
    draftId,
    path,
    value: event?.target?.value ?? ''
  })
}

function resolveMissingItems(item) {
  const checklist = item.draftPayload?.checklist || {}
  const mapping = [
    ['titleReady', '标题'],
    ['descriptionReady', '描述'],
    ['imageReady', '图片素材'],
    ['videoReady', '视频素材'],
    ['categoryReady', '类目'],
    ['priceReady', '价格'],
    ['skuReady', 'SKU'],
    ['complianceReady', '合规']
  ]

  return mapping.filter(([key]) => !checklist[key]).map(([, label]) => label)
}
</script>

<template>
  <section class="ecms-page">
    <div class="ecms-page__hero">
      <div>
        <span class="ecms-page__eyebrow">上架中心</span>
        <h1>平台上架编排台</h1>
        <p>这里已经开始直接读取草稿池的编辑字段，用来形成待发布列表、发布安排和阻塞项视图。</p>
      </div>
      <div class="ecms-stat-grid">
        <article v-for="card in summaryCards" :key="card.label" class="ecms-stat-card">
          <span>{{ card.label }}</span>
          <strong>{{ card.value }}</strong>
          <small>{{ card.hint }}</small>
        </article>
      </div>
    </div>

    <div class="ecms-board ecms-board--publish">
      <aside class="ecms-panel ecms-panel--rail">
        <header class="ecms-panel__header">
          <div>
            <h2>发布筛选</h2>
            <p>先用状态把发布队列分开看。</p>
          </div>
        </header>

        <div class="ecms-sidebar-list">
          <button :class="['ecms-sidebar-button', { 'ecms-sidebar-button--active': activeFilter === 'all' }]" type="button" @click="activeFilter = 'all'">
            <strong>全部</strong>
            <span>查看当前所有上架草稿</span>
          </button>
          <button :class="['ecms-sidebar-button', { 'ecms-sidebar-button--active': activeFilter === 'ready' }]" type="button" @click="activeFilter = 'ready'">
            <strong>可发布</strong>
            <span>检查项齐全或已标记可发布</span>
          </button>
          <button :class="['ecms-sidebar-button', { 'ecms-sidebar-button--active': activeFilter === 'waiting' }]" type="button" @click="activeFilter = 'waiting'">
            <strong>待上架</strong>
            <span>已排入发布时间窗口</span>
          </button>
          <button :class="['ecms-sidebar-button', { 'ecms-sidebar-button--active': activeFilter === 'blocked' }]" type="button" @click="activeFilter = 'blocked'">
            <strong>待补齐</strong>
            <span>还有字段或检查项未完成</span>
          </button>
        </div>
      </aside>

      <section class="ecms-panel ecms-panel--main">
        <header class="ecms-panel__header">
          <div>
            <h2>待发布列表</h2>
            <p>在这里直接编排发布状态、时间和负责人，后续再接平台 API 时可以沿用这套结构。</p>
          </div>
        </header>

        <div v-if="filteredItems.length" class="publish-queue-grid">
          <article v-for="item in filteredItems" :key="item.id" class="publish-queue-card">
            <div class="publish-queue-card__header">
              <div>
                <strong>{{ item.draftPayload?.productName || item.title }}</strong>
                <span>{{ item.draftPayload?.targetPlatform || '待选平台' }} / {{ item.draftPayload?.contentType || '待定内容' }}</span>
              </div>
              <span :class="['publish-status-pill', { 'publish-status-pill--ready': item.isReady || item.publishStatus === '已可发布' }]">
                {{ item.publishStatus }}
              </span>
            </div>

            <div class="publish-queue-card__metrics">
              <span>检查进度 {{ item.completedCount }} / {{ item.totalCount }}</span>
              <span>SKU {{ item.draftPayload?.editor?.skuName || '--' }} / {{ item.draftPayload?.editor?.skuValue || '--' }}</span>
              <span>价格 {{ item.draftPayload?.editor?.priceMin || '--' }} ~ {{ item.draftPayload?.editor?.priceMax || '--' }}</span>
            </div>

            <div class="publish-queue-card__fields">
              <label class="form-field">
                <span>发布状态</span>
                <select :value="item.publishStatus" @change="updateField(item.id, 'draftPayload.editor.publishStatus', $event)">
                  <option value="待整理">待整理</option>
                  <option value="待补素材">待补素材</option>
                  <option value="待定价">待定价</option>
                  <option value="待上架">待上架</option>
                  <option value="已可发布">已可发布</option>
                </select>
              </label>
              <label class="form-field">
                <span>计划时间</span>
                <input :value="item.draftPayload?.editor?.publishWindow || ''" type="text" placeholder="例如：本周五 20:00" @input="updateField(item.id, 'draftPayload.editor.publishWindow', $event)" />
              </label>
              <label class="form-field">
                <span>负责人</span>
                <input :value="item.draftPayload?.editor?.operator || ''" type="text" placeholder="例如：运营 A" @input="updateField(item.id, 'draftPayload.editor.operator', $event)" />
              </label>
              <label class="form-field">
                <span>店铺 / 账号</span>
                <input :value="item.draftPayload?.editor?.storeName || ''" type="text" placeholder="例如：QiuAi 家居店" @input="updateField(item.id, 'draftPayload.editor.storeName', $event)" />
              </label>
            </div>

            <label class="form-field">
              <span>拟上架标题</span>
              <textarea :value="item.draftPayload?.listingTitle || ''" rows="3" @input="updateField(item.id, 'draftPayload.listingTitle', $event)"></textarea>
            </label>

            <label class="form-field">
              <span>备注</span>
              <textarea :value="item.draftPayload?.editor?.remarks || ''" rows="3" placeholder="记录发布提醒、平台限制、待补素材等" @input="updateField(item.id, 'draftPayload.editor.remarks', $event)"></textarea>
            </label>
          </article>
        </div>

        <div v-else class="empty-state">
          <strong>当前筛选下没有草稿</strong>
          <p>先到草稿池补齐内容，或切换一下筛选状态。</p>
        </div>
      </section>

      <aside class="ecms-panel ecms-panel--rail">
        <header class="ecms-panel__header">
          <div>
            <h2>阻塞项</h2>
            <p>快速看每条链接还缺什么。</p>
          </div>
        </header>

        <div class="ecms-note-stack">
          <article v-for="item in filteredItems" :key="`${item.id}-missing`" class="ecms-note-card">
            <strong>{{ item.draftPayload?.productName || item.title }}</strong>
            <p v-if="resolveMissingItems(item).length">
              未完成：{{ resolveMissingItems(item).join(' / ') }}
            </p>
            <p v-else>
              当前检查项已齐，可以进入发布队列。
            </p>
          </article>
        </div>
      </aside>
    </div>
  </section>
</template>
