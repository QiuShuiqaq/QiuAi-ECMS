<script setup>
defineProps({
  moduleLocked: {
    type: Boolean,
    default: false
  },
  moduleLockMessage: {
    type: String,
    default: ''
  },
  localeText: {
    type: Object,
    default: () => ({
      eyebrow: '上架中心',
      title: '待开发',
      description: '“上架”板块暂不开发，后续再按你的业务流程、平台接入方式和字段规则继续设计。',
      statusTitle: '模块状态',
      statusDescription: '当前页面仅保留占位，不展示半成品的上架编排逻辑。',
      lockedTitle: '当前授权未开通上架模块',
      pendingTitle: '上架功能待开发',
      lockedFallback: '请在独立授权工具中补充 listing 模块授权。',
      pendingFallback: '你后续补充平台、字段、发布流程和接口要求后，我再继续往下做。'
    })
  }
})
</script>

<template>
  <section class="ecms-page">
    <div class="ecms-page__hero">
      <div>
        <span class="ecms-page__eyebrow">{{ localeText.eyebrow }}</span>
        <h1>{{ localeText.title }}</h1>
        <p>{{ localeText.description }}</p>
      </div>
    </div>

    <div class="ecms-board">
      <section class="ecms-panel ecms-panel--main">
        <header class="ecms-panel__header">
          <div>
            <h2>{{ localeText.statusTitle }}</h2>
            <p>{{ localeText.statusDescription }}</p>
          </div>
        </header>

        <div class="empty-state">
          <strong>{{ moduleLocked ? localeText.lockedTitle : localeText.pendingTitle }}</strong>
          <p>{{ moduleLocked ? (moduleLockMessage || localeText.lockedFallback) : localeText.pendingFallback }}</p>
        </div>
      </section>
    </div>
  </section>
</template>
