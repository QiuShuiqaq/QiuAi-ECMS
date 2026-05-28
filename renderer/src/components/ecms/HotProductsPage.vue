<script setup>
import { computed } from 'vue'

const props = defineProps({
  trendProducts: {
    type: Array,
    required: true
  },
  platformOptions: {
    type: Array,
    default: () => []
  },
  activePlatformKey: {
    type: String,
    default: ''
  },
  sceneOptions: {
    type: Array,
    default: () => []
  },
  activeSceneKey: {
    type: String,
    default: 'hot'
  },
  workflowTargetId: {
    type: String,
    default: ''
  },
  isWorkflowRunning: {
    type: Boolean,
    default: false
  },
  isLoadingProducts: {
    type: Boolean,
    default: false
  },
  moduleLocked: {
    type: Boolean,
    default: false
  },
  moduleLockMessage: {
    type: String,
    default: ''
  },
  hasLoadedProducts: {
    type: Boolean,
    default: false
  },
  autoRefreshStatus: {
    type: Object,
    default: () => ({
      cacheDate: '',
      updatedAt: '',
      pending: false,
      mode: 'idle',
      message: '',
      phase: 'idle',
      progressPercent: 0,
      countdownMs: 0
    })
  },
  prefetchState: {
    type: Object,
    default: () => ({
      total: 0,
      completed: 0,
      currentSceneKey: '',
      running: false
    })
  }
})

const emit = defineEmits([
  'one-click-edit',
  'one-click-generate',
  'open-one-click-config',
  'select-platform',
  'select-scene',
  'open-item-link'
])

const productCountText = computed(() => {
  if (!props.hasLoadedProducts) {
    if (props.autoRefreshStatus?.pending) {
      return '正在按安全间隔同步今日数据'
    }

    if (props.autoRefreshStatus?.mode === 'error') {
      return '当前平台暂未获取到数据'
    }

    return '正在等待今日缓存数据'
  }

  return `当前共 ${props.trendProducts.length} 条商品`
})

const cacheStatusText = computed(() => {
  if (props.autoRefreshStatus?.pending) {
    return '系统会在安全延迟后自动同步一次今日数据'
  }

  if (props.autoRefreshStatus?.mode && props.autoRefreshStatus?.message) {
    return props.autoRefreshStatus.message
  }

  if (props.autoRefreshStatus?.updatedAt) {
    return `本地缓存已更新：${props.autoRefreshStatus.updatedAt}`
  }

  return '当前展示本地缓存或等待首次安全同步'
})

const progressLabelText = computed(() => {
  if (props.autoRefreshStatus?.phase === 'delay') {
    return '安全等待中'
  }

  if (props.autoRefreshStatus?.phase === 'request') {
    return '正在请求商品数据'
  }

  if (props.autoRefreshStatus?.phase === 'ready') {
    return '数据已就绪'
  }

  return '等待同步'
})

const countdownText = computed(() => {
  const countdownMs = Number(props.autoRefreshStatus?.countdownMs || 0)
  if (props.autoRefreshStatus?.phase !== 'delay' || countdownMs <= 0) {
    return ''
  }

  return `${(countdownMs / 1000).toFixed(1)}s 后开始请求`
})

const prefetchStatusText = computed(() => {
  if (!props.prefetchState?.running || !props.prefetchState?.total) {
    return ''
  }

  return `后台正在补齐其他分类缓存：${props.prefetchState.completed}/${props.prefetchState.total}`
})

const activePlatformLabel = computed(() => {
  return props.platformOptions.find((platform) => platform.key === props.activePlatformKey)?.label || '当前平台'
})

const activeSceneLabel = computed(() => {
  return props.sceneOptions.find((scene) => scene.key === props.activeSceneKey)?.label || '当前分类'
})
</script>

<template>
  <section class="ecms-page">
    <header class="ecms-page__hero ecms-page__hero--compact">
      <div class="ecms-page__hero-copy">
        <div class="ecms-page__hero-heading">
          <div class="ecms-page__hero-titleline">
            <h1>商品趋势列表</h1>
            <div v-if="platformOptions.length" class="ecms-platform-switcher" role="tablist" aria-label="选品平台切换">
              <template v-for="(platform, index) in platformOptions" :key="platform.key">
                <span v-if="index > 0" class="ecms-platform-divider" aria-hidden="true">|</span>
                <button
                  :class="['ecms-platform-chip', { 'ecms-platform-chip--active': platform.key === activePlatformKey }]"
                  type="button"
                  @click="emit('select-platform', platform.key)"
                >
                  {{ platform.label }}
                </button>
              </template>
            </div>
          </div>
        </div>
        <div class="ecms-hot-hero-summary">
          <span>{{ activePlatformLabel }}</span>
          <span>{{ activeSceneLabel }}</span>
          <span>总销量前 10</span>
          <span>{{ hasLoadedProducts ? '已命中本地缓存' : '等待今日缓存' }}</span>
        </div>
      </div>
    </header>

    <div class="ecms-board ecms-board--hot">
      <aside class="ecms-panel ecms-panel--rail">
        <header class="ecms-panel__header">
          <div>
            <h2>选品分类</h2>
          </div>
        </header>

        <div class="ecms-sidebar-list ecms-sidebar-list--hot-scenes">
          <button
            v-for="scene in sceneOptions"
            :key="scene.key"
            :class="[
              'ecms-sidebar-button',
              'ecms-sidebar-button--hot-scene',
              { 'ecms-sidebar-button--active': scene.key === activeSceneKey }
            ]"
            type="button"
            @click="emit('select-scene', scene.key)"
          >
            <strong>{{ scene.label }}</strong>
          </button>
        </div>
      </aside>

      <section class="ecms-panel ecms-panel--main">
        <header class="ecms-panel__header">
          <div>
            <h2>商品列表</h2>
            <p>{{ productCountText }}</p>
          </div>
          <span class="ecms-inline-status ecms-inline-status--panel">{{ cacheStatusText }}</span>
        </header>

        <div v-if="autoRefreshStatus?.pending || autoRefreshStatus?.phase === 'ready'" class="sourcing-progress-card">
          <div class="sourcing-progress-card__head">
            <strong>{{ progressLabelText }}</strong>
            <span>{{ countdownText || `${Math.max(0, Math.min(100, Number(autoRefreshStatus?.progressPercent || 0)))}%` }}</span>
          </div>
          <div class="sourcing-progress-bar" aria-hidden="true">
            <span class="sourcing-progress-bar__fill" :style="{ width: `${Math.max(0, Math.min(100, Number(autoRefreshStatus?.progressPercent || 0)))}%` }"></span>
          </div>
          <p v-if="prefetchStatusText" class="sourcing-progress-card__helper">{{ prefetchStatusText }}</p>
        </div>

        <div class="hot-product-table-head" aria-hidden="true">
          <span>商品图</span>
          <span>商品信息</span>
          <span>核心指标</span>
          <span>操作</span>
        </div>

        <div class="hot-product-list">
          <article v-for="item in trendProducts" :key="item.id" class="hot-product-row">
            <div class="hot-product-row__preview">
              <img v-if="item.preview" :src="item.preview" :alt="item.title" />
              <div v-else class="hot-product-row__preview-empty">
                {{ isLoadingProducts ? '正在加载商品图' : '暂无商品图' }}
              </div>
            </div>

            <div class="hot-product-row__main">
              <div class="hot-product-card__head">
                <span class="platform-badge">{{ item.platform }}</span>
                <span class="growth-badge">{{ item.growth }}</span>
              </div>
              <div class="hot-product-rank-chip">总销量优先</div>
              <strong class="hot-product-row__title">{{ item.title }}</strong>
              <p class="hot-product-row__summary">{{ item.summary }}</p>
              <div class="hot-product-card__tags">
                <span v-for="tag in item.tags" :key="tag">{{ tag }}</span>
              </div>
            </div>

            <div class="hot-product-row__metrics">
              <div class="hot-product-card__meta hot-product-card__meta--stacked">
                <span>总销量 {{ item.searchHeat }}</span>
                <span>转化参考 {{ item.conversion }}</span>
              </div>
              <div class="hot-product-card__meta hot-product-card__meta--stacked">
                <span>素材方向 {{ item.assetDirection }}</span>
                <span>平台 {{ item.platform }}</span>
              </div>
            </div>

            <div class="hot-product-card__actions hot-product-card__actions--column">
              <div class="hot-product-action-pair hot-product-action-pair--single">
                <button
                  class="secondary-action secondary-action--compact hot-product-link-button hot-product-action-pair__main"
                  type="button"
                  :disabled="moduleLocked || !item.sourceUrl"
                  @click="emit('open-item-link', item)"
                >
                  查看商品
                </button>
                <span class="hot-product-action-pair__ghost" aria-hidden="true"></span>
              </div>
              <div class="hot-product-action-pair">
                <button
                  class="primary-action primary-action--compact hot-product-action-pair__main"
                  type="button"
                  :disabled="moduleLocked || isWorkflowRunning"
                  @click="emit('one-click-edit', item)"
                >
                  {{ isWorkflowRunning && workflowTargetId === item.id ? '处理中...' : '一键编辑' }}
                </button>
                <button
                  class="secondary-action secondary-action--compact hot-product-gear-button"
                  type="button"
                  aria-label="一键编辑配置"
                  title="一键编辑配置"
                  :disabled="moduleLocked || isWorkflowRunning"
                  @click="emit('open-one-click-config', 'edit')"
                >
                  ⚙
                </button>
              </div>
              <div class="hot-product-action-pair">
                <button
                  class="primary-action primary-action--compact hot-product-action-pair__main"
                  type="button"
                  :disabled="moduleLocked || isWorkflowRunning"
                  @click="emit('one-click-generate', item)"
                >
                  {{ isWorkflowRunning && workflowTargetId === item.id ? '生成中...' : '一键生成' }}
                </button>
                <button
                  class="secondary-action secondary-action--compact hot-product-gear-button"
                  type="button"
                  aria-label="一键生成配置"
                  title="一键生成配置"
                  :disabled="moduleLocked || isWorkflowRunning"
                  @click="emit('open-one-click-config', 'generate')"
                >
                  ⚙
                </button>
              </div>
            </div>
          </article>
        </div>

        <div v-if="!hasLoadedProducts && !isLoadingProducts" class="ecms-note-card">
          <strong>等待缓存同步</strong>
          <p>系统会优先展示本地缓存；如果当天还没有缓存数据，会在安全延迟后自动请求一次，并将结果保存到本地，第二天再自动覆盖。</p>
        </div>

        <div v-else-if="!trendProducts.length && !isLoadingProducts" class="ecms-note-card">
          <strong>暂无可展示商品</strong>
          <p>{{ autoRefreshStatus?.message || '当前平台热销商品还没有成功加载，稍后可以再试一次。' }}</p>
        </div>

        <div v-if="moduleLocked" class="ecms-note-card ecms-note-card--locked">
          <strong>当前授权未开通选品模块</strong>
          <p>{{ moduleLockMessage || '如需继续使用选品，请在授权工具中开通 sourcing 模块。' }}</p>
        </div>
      </section>
    </div>
  </section>
</template>
