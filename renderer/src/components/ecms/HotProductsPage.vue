<script setup>
defineProps({
  platformCards: {
    type: Array,
    required: true
  },
  trendProducts: {
    type: Array,
    required: true
  },
  scoutingSteps: {
    type: Array,
    required: true
  }
})
</script>

<template>
  <section class="ecms-page">
    <div class="ecms-page__hero">
      <div>
        <span class="ecms-page__eyebrow">爆款雷达</span>
        <h1>爆款选品与趋势追踪</h1>
        <p>先用平台热度、成交增速和素材方向做初筛，后续再接入你指定的安全小规模爬取源。</p>
      </div>
      <div class="ecms-stat-grid">
        <article v-for="card in platformCards" :key="card.platform" class="ecms-stat-card">
          <span>{{ card.platform }}</span>
          <strong>{{ card.hotCount }}</strong>
          <small>{{ card.description }}</small>
        </article>
      </div>
    </div>

    <div class="ecms-board ecms-board--hot">
      <aside class="ecms-panel ecms-panel--rail">
        <header class="ecms-panel__header">
          <div>
            <h2>采集策略</h2>
            <p>先做策略设计，真正接爬虫时默认限频、限量、白名单域名。</p>
          </div>
        </header>

        <div class="ecms-step-list">
          <article v-for="step in scoutingSteps" :key="step.title" class="ecms-step-card">
            <strong>{{ step.title }}</strong>
            <p>{{ step.description }}</p>
          </article>
        </div>
      </aside>

      <section class="ecms-panel ecms-panel--main">
        <header class="ecms-panel__header">
          <div>
            <h2>平台热点池</h2>
            <p>按平台拆开看趋势，方便后续决定是做图、做文案还是直接跟拍视频。</p>
          </div>
        </header>

        <div class="hot-product-grid">
          <article v-for="item in trendProducts" :key="item.id" class="hot-product-card">
            <div class="hot-product-card__head">
              <span class="platform-badge">{{ item.platform }}</span>
              <span class="growth-badge">{{ item.growth }}</span>
            </div>
            <strong>{{ item.title }}</strong>
            <p>{{ item.summary }}</p>
            <div class="hot-product-card__meta">
              <span>搜索热度 {{ item.searchHeat }}</span>
              <span>成交转化 {{ item.conversion }}</span>
              <span>素材方向 {{ item.assetDirection }}</span>
            </div>
            <div class="hot-product-card__tags">
              <span v-for="tag in item.tags" :key="tag">{{ tag }}</span>
            </div>
          </article>
        </div>
      </section>

      <aside class="ecms-panel ecms-panel--rail">
        <header class="ecms-panel__header">
          <div>
            <h2>后续接入建议</h2>
            <p>等你给站点后，我们可以把风险边界先锁死。</p>
          </div>
        </header>

        <div class="ecms-note-stack">
          <article class="ecms-note-card">
            <strong>白名单域名</strong>
            <p>只抓你确认的网站，默认拒绝任意外部域名和跳转域名。</p>
          </article>
          <article class="ecms-note-card">
            <strong>低频采样</strong>
            <p>先用少量样本验证字段质量，不做大规模连续抓取。</p>
          </article>
          <article class="ecms-note-card">
            <strong>可回溯日志</strong>
            <p>记录抓取时间、来源和限频策略，方便后续排查与合规审计。</p>
          </article>
        </div>
      </aside>
    </div>
  </section>
</template>
