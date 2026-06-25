<script setup>
import { computed } from 'vue'

import DataCenterPage from './DataCenterPage.vue'

const props = defineProps({
  activationState: {
    type: Object,
    required: true
  },
  remoteServiceCapacity: {
    type: Object,
    default: null
  },
  workspaceDashboard: {
    type: Object,
    required: true
  },
  tasks: {
    type: Array,
    default: () => []
  },
  currentRechargeOrder: {
    type: Object,
    default: null
  },
  currentSoftwareOrder: {
    type: Object,
    default: null
  },
  currentComputePackageOrder: {
    type: Object,
    default: null
  },
  projectCount: {
    type: Number,
    default: 0
  }
})

const summaryCards = computed(() => {
  const status = String(props.activationState?.status || '').trim()
  const profile = props.remoteServiceCapacity && typeof props.remoteServiceCapacity === 'object'
    ? props.remoteServiceCapacity
    : {}

  return [
    {
      key: 'license',
      label: '授权状态',
      value: status === 'activated' ? '已激活' : '待处理',
      note: props.activationState?.expiresAt
        ? `到期 ${String(props.activationState.expiresAt).slice(0, 10)}`
        : '未设置到期'
    },
    {
      key: 'projects',
      label: '项目数量',
      value: String(props.projectCount || 0),
      note: '当前工作区'
    },
    {
      key: 'imageConcurrency',
      label: '图片并发',
      value: String(Math.max(1, Number(profile.effectiveImageConcurrency) || 1)),
      note: `服务档位 ${String(profile.serviceTier || 'SHARED')}`
    },
    {
      key: 'recentTasks',
      label: '最近任务',
      value: String(Array.isArray(props.tasks) ? props.tasks.length : 0),
      note: '本地快照'
    }
  ]
})

const recentTasks = computed(() => {
  return (Array.isArray(props.tasks) ? props.tasks : [])
    .slice()
    .sort((left, right) => {
      const rightTime = new Date(right?.createdAt || right?.updatedAt || 0).getTime()
      const leftTime = new Date(left?.createdAt || left?.updatedAt || 0).getTime()
      return rightTime - leftTime
    })
    .slice(0, 6)
})

const walletCards = computed(() => {
  const walletSummary = props.activationState?.walletSummary || {}
  return [
    { key: 'text', label: '文本余额', value: Number(walletSummary.textBalanceCny || 0).toFixed(2) },
    { key: 'image', label: '图片余额', value: Number(walletSummary.imageBalanceCny || 0).toFixed(2) },
    { key: 'video', label: '视频余额', value: Number(walletSummary.videoBalanceCny || 0).toFixed(2) }
  ]
})

const recentOrders = computed(() => {
  return [
    props.currentRechargeOrder ? { type: '充值订单', order: props.currentRechargeOrder } : null,
    props.currentSoftwareOrder ? { type: '软件授权', order: props.currentSoftwareOrder } : null,
    props.currentComputePackageOrder ? { type: '算力套餐', order: props.currentComputePackageOrder } : null
  ].filter(Boolean)
})

const recentOutputs = computed(() => {
  return recentTasks.value.filter((task) => String(task?.outputDirectory || '').trim()).slice(0, 4)
})

function resolveTaskTitle(task = {}) {
  return String(task.title || task.taskName || task.taskNumber || '未命名任务').trim() || '未命名任务'
}

function resolveTaskMeta(task = {}) {
  const status = String(task.status || '').trim() || '处理中'
  const progress = Number(task.progress || 0)
  return `${status} / ${progress}%`
}

function resolveOrderNo(order = {}) {
  return String(order.merchantOrderNo || order.orderNo || order.id || '--').trim() || '--'
}

function resolveOrderStatus(order = {}) {
  return String(order.status || 'pending').trim() || 'pending'
}

function resolveOutputTitle(task = {}) {
  return String(task.title || task.taskName || task.taskNumber || '结果输出').trim() || '结果输出'
}

function resolveOutputPath(task = {}) {
  return String(task.outputDirectory || '').trim() || '--'
}
</script>

<template>
  <section class="overview-page">
    <header class="overview-page__hero">
      <div>
        <span class="overview-page__eyebrow">Workbench</span>
        <h1>QiuAi 工作台</h1>
      </div>
    </header>

    <div class="overview-page__grid">
      <article v-for="card in summaryCards" :key="card.key" class="overview-page__card">
        <span>{{ card.label }}</span>
        <strong>{{ card.value }}</strong>
        <small>{{ card.note }}</small>
      </article>
    </div>

    <section class="overview-page__panel">
      <header class="overview-page__panel-header">
        <strong>最小闭环</strong>
      </header>
      <div class="overview-page__mini-grid">
        <article v-for="card in walletCards" :key="card.key" class="overview-page__mini-card">
          <span>{{ card.label }}</span>
          <strong>{{ card.value }}</strong>
          <small>CNY</small>
        </article>
      </div>
    </section>

    <section class="overview-page__split">
      <section class="overview-page__panel">
        <header class="overview-page__panel-header">
          <strong>最近订单</strong>
        </header>
        <div class="overview-page__task-list">
          <article
            v-for="item in recentOrders"
            :key="`${item.type}-${resolveOrderNo(item.order)}`"
            class="overview-page__task-item"
          >
            <strong>{{ item.type }} / {{ resolveOrderNo(item.order) }}</strong>
            <span>{{ resolveOrderStatus(item.order) }}</span>
          </article>
          <article v-if="!recentOrders.length" class="overview-page__task-item overview-page__task-item--empty">
            <strong>暂无订单</strong>
          </article>
        </div>
      </section>

      <section class="overview-page__panel">
        <header class="overview-page__panel-header">
          <strong>最近结果</strong>
        </header>
        <div class="overview-page__task-list">
          <article v-for="task in recentOutputs" :key="task.id || task.taskNumber" class="overview-page__task-item">
            <strong>{{ resolveOutputTitle(task) }}</strong>
            <span>{{ resolveOutputPath(task) }}</span>
          </article>
          <article v-if="!recentOutputs.length" class="overview-page__task-item overview-page__task-item--empty">
            <strong>暂无结果</strong>
          </article>
        </div>
      </section>
    </section>

    <section class="overview-page__panel">
      <header class="overview-page__panel-header">
        <strong>最近任务</strong>
      </header>
      <div class="overview-page__task-list">
        <article v-for="task in recentTasks" :key="task.id || task.taskNumber" class="overview-page__task-item">
          <strong>{{ resolveTaskTitle(task) }}</strong>
          <span>{{ resolveTaskMeta(task) }}</span>
        </article>
        <article v-if="!recentTasks.length" class="overview-page__task-item overview-page__task-item--empty">
          <strong>暂无任务</strong>
        </article>
      </div>
    </section>

    <section class="overview-page__panel">
      <header class="overview-page__panel-header">
        <strong>余额与用量</strong>
      </header>
      <DataCenterPage :workspace-dashboard="workspaceDashboard" />
    </section>
  </section>
</template>

<style scoped>
.overview-page {
  display: flex;
  flex-direction: column;
  gap: 18px;
}

.overview-page__hero,
.overview-page__card,
.overview-page__panel {
  border: 1px solid rgba(255, 255, 255, 0.08);
  background: rgba(14, 18, 30, 0.88);
  border-radius: 22px;
}

.overview-page__hero,
.overview-page__panel {
  padding: 22px;
}

.overview-page__hero h1,
.overview-page__panel-header {
  margin: 0;
}

.overview-page__eyebrow {
  display: inline-flex;
  margin-bottom: 10px;
  font-size: 12px;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: rgba(118, 173, 255, 0.88);
}

.overview-page__grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 14px;
}

.overview-page__mini-grid,
.overview-page__split {
  display: grid;
  gap: 14px;
}

.overview-page__mini-grid {
  grid-template-columns: repeat(3, minmax(0, 1fr));
}

.overview-page__split {
  grid-template-columns: repeat(2, minmax(0, 1fr));
}

.overview-page__card {
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 18px;
}

.overview-page__mini-card {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 18px;
  border-radius: 16px;
  background: rgba(9, 13, 23, 0.72);
}

.overview-page__card strong {
  font-size: 24px;
}

.overview-page__mini-card strong {
  font-size: 22px;
}

.overview-page__card small,
.overview-page__mini-card small,
.overview-page__task-item span {
  color: rgba(205, 214, 238, 0.72);
}

.overview-page__task-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.overview-page__task-item {
  display: flex;
  justify-content: space-between;
  gap: 16px;
  padding: 14px 16px;
  border-radius: 16px;
  background: rgba(9, 13, 23, 0.72);
}

.overview-page__task-item--empty {
  justify-content: flex-start;
  flex-direction: column;
}

@media (max-width: 1080px) {
  .overview-page__grid,
  .overview-page__mini-grid,
  .overview-page__split {
    grid-template-columns: 1fr;
  }

  .overview-page__task-item {
    flex-direction: column;
  }
}
</style>
