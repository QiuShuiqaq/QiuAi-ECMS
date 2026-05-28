<script setup>
import { computed } from 'vue'

const props = defineProps({
  workspaceDashboard: {
    type: Object,
    required: true
  },
  hostInfo: {
    type: Object,
    required: true
  },
  isRefreshingTotalCredits: {
    type: Boolean,
    required: true
  },
  isRefreshingRemainingCredits: {
    type: Boolean,
    required: true
  },
  serviceConfig: {
    type: Object,
    default: () => ({
      title: '服务配置状态',
      mode: 'readonly',
      headline: 'API 已由服务端预配置',
      description: '如需更换配置，请联系服务方。',
      helperText: '',
      fields: [],
      actionLabel: '',
      actionBusyLabel: '',
      actionDisabled: false,
      actionBusy: false
    })
  }
})

const emit = defineEmits([
  'refresh-total-credits',
  'refresh-remaining-credits',
  'service-config-update',
  'save-service-config'
])

function createFallbackStatsCard(title) {
  return {
    title,
    items: []
  }
}

const resolvedServiceConfig = computed(() => {
  return {
    title: '服务配置状态',
    mode: 'readonly',
    headline: 'API 已由服务端预配置',
    description: '如需更换配置，请联系服务方。',
    helperText: '',
    defaultFields: [],
    actionLabel: '',
    actionBusyLabel: '',
    actionDisabled: false,
    actionBusy: false,
    ...(props.serviceConfig || {}),
    fields: Array.isArray(props.serviceConfig?.fields) ? props.serviceConfig.fields : []
  }
})

const showStatusOverview = computed(() => {
  return Boolean(props.workspaceDashboard?.statusOverview)
})

const statusOverviewCard = computed(() => {
  return props.workspaceDashboard.statusOverview || createFallbackStatsCard('信息状态栏')
})

const topStatisticsCards = computed(() => {
  return [
    props.workspaceDashboard.singleImageStats || createFallbackStatsCard('单图测试统计'),
    props.workspaceDashboard.singleDesignStats || createFallbackStatsCard('单图设计统计')
  ]
})

const middleStatisticsCards = computed(() => {
  return [
    props.workspaceDashboard.seriesDesignStats || createFallbackStatsCard('套图设计统计'),
    props.workspaceDashboard.seriesGenerateStats || createFallbackStatsCard('套图生成统计')
  ]
})

const networkMonitorCard = computed(() => {
  return props.workspaceDashboard.networkMonitor || {
    title: '网络监控',
    items: [],
    summary: {
      latestLatencyMs: 0,
      averageLatencyMs: 0,
      successRate: '0%'
    }
  }
})

const networkMonitorSummaryItems = computed(() => {
  const summary = networkMonitorCard.value.summary || {}
  return [
    {
      label: '最近请求延迟',
      value: `${summary.latestLatencyMs || 0} ms`
    },
    {
      label: '平均延迟',
      value: `${summary.averageLatencyMs || 0} ms`
    },
    {
      label: '成功率',
      value: summary.successRate || '0%'
    }
  ]
})

const networkMonitorChartItems = computed(() => {
  return [...(networkMonitorCard.value.items || [])].slice(0, 12).reverse()
})

const networkMonitorListItems = computed(() => {
  return (networkMonitorCard.value.items || []).slice(0, 6)
})

const networkMonitorPoints = computed(() => {
  const items = networkMonitorChartItems.value
  if (!items.length) {
    return ''
  }

  const maxLatency = Math.max(...items.map((item) => Number(item.elapsedMs) || 0), 1)
  const chartWidth = 360
  const chartHeight = 118
  const bottomPadding = 18
  const usableHeight = chartHeight - bottomPadding

  return items.map((item, index) => {
    const x = items.length === 1
      ? chartWidth / 2
      : Math.round((chartWidth / (items.length - 1)) * index)
    const y = Math.round(chartHeight - ((Math.max(0, Number(item.elapsedMs) || 0) / maxLatency) * usableHeight) - bottomPadding)
    return `${x},${y}`
  }).join(' ')
})

const creditOverviewCard = computed(() => {
  return props.workspaceDashboard.creditOverview || {
    title: '积分仪表盘',
    items: [
      { label: '剩余积分', value: '0' },
      { label: '总积分', value: '0' },
      { label: '冻结积分', value: '0' },
      { label: '已用积分', value: '0' }
    ]
  }
})

const gaugePrimaryLabel = computed(() => {
  const labels = (creditOverviewCard.value.items || []).map((item) => item.label)
  if (labels.includes('当前余额')) {
    return '当前余额'
  }
  return '剩余积分'
})

function resolveCreditOverviewValue(labels) {
  const normalizedLabels = Array.isArray(labels) ? labels : [labels]
  return computed(() => {
    const matchedItem = (creditOverviewCard.value.items || []).find((item) => normalizedLabels.includes(item.label))
    return matchedItem?.value || '0'
  })
}

const remainingCredits = computed(() => {
  const value = resolveCreditOverviewValue(['当前余额', '剩余积分']).value
  return value
})
const totalCredits = computed(() => {
  const value = resolveCreditOverviewValue(['总额度', '总积分', '累计充值积分']).value
  return value
})

const creditGaugeProgress = computed(() => {
  const currentValue = Number.parseInt(String(remainingCredits.value).replace(/[^\d]/g, ''), 10) || 0
  const maxValue = Number.parseInt(String(totalCredits.value).replace(/[^\d]/g, ''), 10) || currentValue || 1
  return Math.max(0, Math.min(100, Math.round((currentValue / maxValue) * 100)))
})

const creditGaugeGlow = computed(() => {
  const numericProgress = Number(creditGaugeProgress.value) || 0
  return Math.max(0.2, Math.min(0.95, numericProgress / 100))
})

const creditMessagesCard = computed(() => {
  return props.workspaceDashboard.creditMessages || {
    title: '本地任务积分记录',
    items: []
  }
})

const creditActionConfig = computed(() => {
  const source = props.workspaceDashboard?.creditActions
  if (!source || typeof source !== 'object') {
    return {
      mode: 'dual'
    }
  }

  return {
    mode: source.mode === 'single' ? 'single' : 'dual',
    primaryLabel: source.primaryLabel || '',
    primaryBusyLabel: source.primaryBusyLabel || '更新中...',
    primaryAction: source.primaryAction === 'refresh-remaining' ? 'refresh-remaining' : 'refresh-total'
  }
})

const hostInfoItems = computed(() => {
  return [
    { label: '主机名', value: props.hostInfo.systemName },
    { label: '登录用户', value: props.hostInfo.userName },
    { label: '系统平台', value: props.hostInfo.platformName },
    { label: '系统架构', value: props.hostInfo.architecture },
    { label: 'CPU 信息', value: props.hostInfo.cpuModel },
    { label: '运行时', value: props.hostInfo.runtimeName }
  ]
})

function refreshTotalCredits() {
  emit('refresh-total-credits')
}

function refreshRemainingCredits() {
  emit('refresh-remaining-credits')
}

const totalRefreshLabel = computed(() => {
  return gaugePrimaryLabel.value === '当前余额' ? '更新总额度' : '更新总积分'
})

const remainingRefreshLabel = computed(() => {
  return gaugePrimaryLabel.value === '当前余额' ? '更新当前余额' : '更新剩余积分'
})

function updateServiceConfigField(key, value) {
  emit('service-config-update', {
    key,
    value
  })
}

function saveServiceConfig() {
  emit('save-service-config')
}

function handlePrimaryCreditAction() {
  if (creditActionConfig.value.primaryAction === 'refresh-remaining') {
    refreshRemainingCredits()
    return
  }

  refreshTotalCredits()
}
</script>

<template>
  <section class="workspace-dashboard">
    <div class="workspace-dashboard__inner">
      <div :class="['dashboard-column', showStatusOverview ? 'dashboard-column--stats-compact' : 'dashboard-column--stats-stack']">
        <template v-if="showStatusOverview">
          <article class="dashboard-stat-card dashboard-stat-card--status-overview">
            <header class="dashboard-card__header">
              <div>
                <h2>{{ statusOverviewCard.title }}</h2>
              </div>
            </header>

            <div class="dashboard-card__content dashboard-card__content--status-overview">
              <div class="dashboard-status-list">
                <div
                  v-for="item in statusOverviewCard.items"
                  :key="`${statusOverviewCard.title}-${item.label}`"
                  class="dashboard-status-row"
                >
                  <span>{{ item.label }}</span>
                  <strong>{{ item.value }}</strong>
                </div>
              </div>
            </div>
          </article>
        </template>

        <template v-else>
          <div class="dashboard-column__stack">
            <article
              v-for="card in topStatisticsCards"
              :key="card.title"
              class="dashboard-stat-card"
            >
              <header class="dashboard-card__header">
                <div>
                  <h2>{{ card.title }}</h2>
                </div>
              </header>

              <div class="dashboard-card__content dashboard-card__content--stats">
                <div class="dashboard-stat-list">
                  <div v-for="item in card.items" :key="`${card.title}-${item.label}`" class="dashboard-stat-row">
                    <span>{{ item.label }}</span>
                    <strong>{{ item.value }}</strong>
                  </div>
                </div>
              </div>
            </article>
          </div>

          <div class="dashboard-column__stack">
            <article
              v-for="card in middleStatisticsCards"
              :key="card.title"
              class="dashboard-stat-card"
            >
              <header class="dashboard-card__header">
                <div>
                  <h2>{{ card.title }}</h2>
                </div>
              </header>

              <div class="dashboard-card__content dashboard-card__content--stats">
                <div class="dashboard-stat-list">
                  <div v-for="item in card.items" :key="`${card.title}-${item.label}`" class="dashboard-stat-row">
                    <span>{{ item.label }}</span>
                    <strong>{{ item.value }}</strong>
                  </div>
                </div>
              </div>
            </article>
          </div>
        </template>

        <article class="dashboard-stat-card dashboard-network-monitor">
          <header class="dashboard-card__header">
            <div>
              <h2>{{ networkMonitorCard.title }}</h2>
            </div>
          </header>

          <div class="dashboard-card__content dashboard-card__content--network">
            <div class="dashboard-network-monitor__chart">
              <svg viewBox="0 0 360 140" aria-hidden="true">
                <defs>
                  <linearGradient id="networkMonitorGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                    <stop offset="0%" stop-color="#22d3ee" />
                    <stop offset="50%" stop-color="#7c3aed" />
                    <stop offset="100%" stop-color="#38d9ff" />
                  </linearGradient>
                </defs>

                <path
                  class="dashboard-network-monitor__track"
                  d="M 0 122 L 360 122"
                />
                <polyline
                  v-if="networkMonitorPoints"
                  class="dashboard-network-monitor__polyline"
                  :points="networkMonitorPoints"
                />
              </svg>
            </div>

            <div class="dashboard-network-monitor__metrics">
              <div
                v-for="item in networkMonitorSummaryItems"
                :key="item.label"
                class="dashboard-network-monitor__metric"
              >
                <span>{{ item.label }}</span>
                <strong>{{ item.value }}</strong>
              </div>
            </div>

            <div v-if="networkMonitorListItems.length" class="dashboard-network-monitor__list">
              <div
                v-for="item in networkMonitorListItems"
                :key="item.id || `${item.requestPath}-${item.createdAt}`"
                class="dashboard-network-monitor__row"
              >
                <div class="dashboard-network-monitor__copy">
                  <strong>{{ item.method }} {{ item.requestPath }}</strong>
                  <span>{{ item.timeLabel || item.createdAt || '--' }}</span>
                </div>

                <strong :class="['dashboard-network-monitor__status', `dashboard-network-monitor__status--${item.status}`]">
                  {{ item.elapsedMs }} ms
                </strong>
              </div>
            </div>

            <div v-else class="task-sidebar-empty">
              <p>暂无请求记录</p>
            </div>
          </div>
        </article>
      </div>

      <div class="dashboard-column dashboard-column--credit">
        <article class="dashboard-stat-card">
          <header class="dashboard-card__header">
            <div>
              <h2>{{ creditOverviewCard.title }}</h2>
            </div>
          </header>

          <div class="dashboard-card__content dashboard-card__content--credit-gauge">
            <div class="dashboard-credit-gauge">
              <div class="dashboard-credit-gauge__dial">
                <svg class="dashboard-credit-gauge__svg" viewBox="0 0 320 220" aria-hidden="true">
                  <defs>
                    <linearGradient id="creditGaugeGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                      <stop offset="0%" stop-color="#ff5f6d" />
                      <stop offset="50%" stop-color="#4ade80" />
                      <stop offset="100%" stop-color="#38d9ff" />
                    </linearGradient>
                    <radialGradient id="creditGaugeCoreGlow" cx="50%" cy="68%" r="70%">
                      <stop offset="0%" stop-color="rgba(223, 193, 255, 0.26)" />
                      <stop offset="55%" stop-color="rgba(137, 97, 255, 0.1)" />
                      <stop offset="100%" stop-color="rgba(137, 97, 255, 0)" />
                    </radialGradient>
                  </defs>

                  <path
                    class="dashboard-credit-gauge__halo"
                    d="M 24 168 A 136 136 0 0 1 296 168"
                    pathLength="100"
                  />
                  <path
                    class="dashboard-credit-gauge__track"
                    d="M 24 168 A 136 136 0 0 1 296 168"
                    pathLength="100"
                  />
                  <path
                    class="dashboard-credit-gauge__arc dashboard-credit-gauge__arc--active dashboard-credit-gauge__progress-band"
                    d="M 24 168 A 136 136 0 0 1 296 168"
                    pathLength="100"
                    :style="{
                      strokeDasharray: `${creditGaugeProgress} 100`,
                      strokeDashoffset: `${100 - creditGaugeProgress}`,
                      opacity: creditGaugeGlow
                    }"
                  />

                  <circle class="dashboard-credit-gauge__core-glow" cx="160" cy="168" r="76" />
                </svg>

                <div class="dashboard-credit-gauge__center">
                  <span class="dashboard-credit-gauge__caption">{{ gaugePrimaryLabel }}</span>
                  <strong class="dashboard-credit-gauge__value">{{ remainingCredits }} / {{ totalCredits }}</strong>
                </div>
              </div>
            </div>
          </div>

          <footer class="dashboard-card__footer dashboard-card__footer--compact">
            <div class="dashboard-credit-adjust">
              <div class="dashboard-credit-adjust__grid">
                <template v-if="creditActionConfig.mode === 'single'">
                  <div class="dashboard-credit-adjust__action-group">
                    <button
                      class="secondary-action secondary-action--compact refresh-remaining-credits"
                      type="button"
                      :disabled="isRefreshingRemainingCredits || isRefreshingTotalCredits"
                      @click="handlePrimaryCreditAction"
                    >
                      {{ (isRefreshingRemainingCredits || isRefreshingTotalCredits) ? creditActionConfig.primaryBusyLabel : creditActionConfig.primaryLabel }}
                    </button>
                  </div>
                </template>

                <template v-else>
                  <div class="dashboard-credit-adjust__action-group">
                    <button
                      class="secondary-action secondary-action--compact refresh-total-credits"
                      type="button"
                      :disabled="isRefreshingTotalCredits"
                      @click="refreshTotalCredits"
                    >
                      {{ isRefreshingTotalCredits ? '更新中...' : totalRefreshLabel }}
                    </button>
                  </div>

                  <div class="dashboard-credit-adjust__action-group">
                    <button
                      class="secondary-action secondary-action--compact refresh-remaining-credits"
                      type="button"
                      :disabled="isRefreshingRemainingCredits"
                      @click="refreshRemainingCredits"
                    >
                      {{ isRefreshingRemainingCredits ? '更新中...' : remainingRefreshLabel }}
                    </button>
                  </div>
                </template>
              </div>

              <div class="dashboard-credit-adjust__actions" />
            </div>
          </footer>
        </article>

        <article class="dashboard-config-card">
          <header class="dashboard-card__header">
            <div>
              <h2>{{ creditMessagesCard.title }}</h2>
            </div>
          </header>

          <div class="dashboard-card__content">
            <div v-if="creditMessagesCard.items.length" class="dashboard-credit-message-list scrollbar-hidden">
              <div
                v-for="item in creditMessagesCard.items"
                :key="item.id || `${item.type}-${item.createdAt}`"
                class="dashboard-credit-message-row"
              >
                <div class="dashboard-credit-message-copy">
                  <strong>{{ item.label }}</strong>
                  <span>{{ item.description }}</span>
                </div>

                <div class="dashboard-credit-message-meta">
                  <strong>{{ item.amountDisplay }}</strong>
                  <span>{{ item.createdAt || '--' }}</span>
                </div>
              </div>
            </div>

            <div v-else class="task-sidebar-empty">
              <p>暂无积分变动记录</p>
            </div>
          </div>
        </article>
      </div>

      <div class="dashboard-column dashboard-column--split">
        <article class="dashboard-config-card">
          <header class="dashboard-card__header">
            <div>
              <h2>{{ resolvedServiceConfig.title }}</h2>
            </div>
          </header>

          <div class="dashboard-card__content">
            <div v-if="resolvedServiceConfig.mode === 'editable'" class="dashboard-api-config">
              <div class="dashboard-service-config dashboard-service-config--start">
                <strong>{{ resolvedServiceConfig.headline }}</strong>
                <p>{{ resolvedServiceConfig.description }}</p>
              </div>

              <label
                v-for="field in resolvedServiceConfig.fields"
                :key="field.key"
                class="form-field"
              >
                <span>{{ field.label }}</span>
                <input
                  :type="field.type || 'text'"
                  :placeholder="field.placeholder || ''"
                  :value="field.value || ''"
                  @input="updateServiceConfigField(field.key, $event.target.value)"
                />
              </label>

              <button
                class="primary-action"
                type="button"
                :disabled="resolvedServiceConfig.actionDisabled || resolvedServiceConfig.actionBusy"
                @click="saveServiceConfig"
              >
                {{ resolvedServiceConfig.actionBusy ? resolvedServiceConfig.actionBusyLabel : resolvedServiceConfig.actionLabel }}
              </button>
            </div>

            <div v-else class="dashboard-service-config">
              <strong>{{ resolvedServiceConfig.headline }}</strong>
              <p>{{ resolvedServiceConfig.description }}</p>
              <button
                v-if="resolvedServiceConfig.actionLabel"
                class="primary-action"
                type="button"
                :disabled="resolvedServiceConfig.actionDisabled || resolvedServiceConfig.actionBusy"
                @click="saveServiceConfig"
              >
                {{ resolvedServiceConfig.actionBusy ? resolvedServiceConfig.actionBusyLabel : resolvedServiceConfig.actionLabel }}
              </button>
            </div>
          </div>
        </article>

        <article class="dashboard-config-card">
          <header class="dashboard-card__header">
            <div>
              <h2>用户主机信息</h2>
            </div>
          </header>

          <div class="dashboard-card__content">
            <div class="dashboard-info-list">
              <div v-for="item in hostInfoItems" :key="item.label" class="dashboard-info-row">
                <span>{{ item.label }}</span>
                <strong>{{ item.value }}</strong>
              </div>
            </div>
          </div>
        </article>
      </div>
    </div>
  </section>
</template>
