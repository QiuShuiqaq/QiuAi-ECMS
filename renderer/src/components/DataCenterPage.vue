<script setup>
import { computed } from 'vue'

const props = defineProps({
  workspaceDashboard: {
    type: Object,
    required: true
  }
})

const gauges = [
  { key: 'text', title: '文本余额', unit: 'CNY', color: 'var(--accent-strong)' },
  { key: 'image', title: '图片余额', unit: 'CNY', color: '#6ce7b2' },
  { key: 'video', title: '视频余额', unit: 'CNY', color: '#ffb86b' }
]

function resolveLedger(key = '') {
  return props.workspaceDashboard.creditOverview?.ledgers?.find((item) => item.key === key) || null
}

function resolveLedgerValue(key = '') {
  return resolveLedger(key)?.value || '0.00'
}

function resolveLedgerRecords(key = '') {
  return props.workspaceDashboard.creditMessages?.ledgers?.find((item) => item.key === key)?.items || []
}

const visibleRecords = computed(() => {
  return gauges.map((gauge) => {
    return {
      ...gauge,
      items: resolveLedgerRecords(gauge.key)
    }
  })
})
</script>

<template>
  <section class="data-center-page">
    <div class="data-center-panel">
      <div class="data-center-gauge-row">
        <article v-for="gauge in gauges" :key="gauge.key" class="credit-gauge-card">
          <span>{{ gauge.title }}</span>
          <strong>
            {{ resolveLedgerValue(gauge.key) }}
            <small>{{ gauge.unit }}</small>
          </strong>
          <div class="credit-gauge-card__ring" :style="{ '--ring-color': gauge.color }"></div>
        </article>
      </div>

      <section v-for="ledger in visibleRecords" :key="`${ledger.key}-records`" class="credit-record-group">
        <header class="credit-record-group__header">
          <strong>{{ ledger.title }}记录</strong>
        </header>

        <div class="credit-record-panel">
          <article
            v-for="item in ledger.items"
            :key="item.id || `${item.createdAt}-${item.amount}`"
            class="credit-record-row"
          >
            <span>{{ item.createdAt || '--' }}</span>
            <strong>{{ item.note || item.label || `${ledger.title}记录` }}</strong>
            <span>{{ item.amountDisplay || item.amount || 0 }}</span>
          </article>

          <article v-if="!ledger.items.length" class="credit-record-row credit-record-row--empty">
            <span>--</span>
            <strong>暂无记录</strong>
            <span>--</span>
          </article>
        </div>
      </section>
    </div>
  </section>
</template>
