<script setup>
import { computed, onBeforeUnmount, onMounted, reactive, ref } from 'vue'
import AppTopBar from './components/AppTopBar.vue'
import ActivationGate from './components/ActivationGate.vue'
import LegacyStudioApp from './components/LegacyStudioApp.vue'
import AdminApiKeyDialog from './components/AdminApiKeyDialog.vue'
import AdminPasswordDialog from './components/AdminPasswordDialog.vue'
import HotProductsPage from './components/ecms/HotProductsPage.vue'
import DraftBoardPage from './components/ecms/DraftBoardPage.vue'
import ListingCenterPage from './components/ecms/ListingCenterPage.vue'
import EcmsStudioPage from './components/ecms/EcmsStudioPage.vue'
import {
  clearStudioRuntimeState,
  createStudioTask,
  createWorkflowAsset,
  generateEcmsText,
  generateEcmsVideo,
  getEcmsVideoBillingSummary,
  getAdminStatus,
  getDeviceCode,
  getSourcingProducts,
  getActivationStatus,
  getSettings,
  getStudioSnapshot,
  importLicenseFile,
  listNegativePromptTemplates,
  listPromptTemplates,
  openOutputDirectory,
  openSafeExternalUrl,
  pickStudioInputAssets,
  reloadActivation,
  removeNegativePromptTemplate,
  removePromptTemplate,
  saveAdminApiKey,
  saveSettings,
  saveGlmApiKey,
  saveNegativePromptTemplate,
  savePromptTemplate,
  verifyAdminPassword
} from './services/desktopBridge'

const themeOptions = [{ label: 'Dark', value: 'dark' }]
const activeTheme = ref('dark')
const activeLanguage = ref('zh')
const activePage = ref('hot')
const rememberedTextMenu = ref('workspace')
const rememberedImageMenu = ref('workspace')
const rememberedVideoMenu = ref('workspace')
const legacyStudioKey = ref(0)
const imageWorkflowPayload = ref(null)
const textExternalFormAction = ref(null)
const videoExternalFormAction = ref(null)
const activeSourcingPlatform = ref('temu')
const activeSourcingScene = ref('hot')
const sourcingProducts = ref([])
const sourcingProductsLoading = ref(false)
const sourcingProductsLoaded = ref(false)
const sourcingAutoRefreshStatus = reactive({
  cacheDate: '',
  updatedAt: '',
  pending: false,
  mode: 'idle',
  message: '',
  phase: 'idle',
  progressPercent: 0,
  countdownMs: 0
})
const sourcingPrefetchState = reactive({
  total: 0,
  completed: 0,
  currentSceneKey: '',
  running: false
})
const draftItems = ref([])
const isDraftTargetDialogVisible = ref(false)
const pendingDraftPayload = ref(null)
const selectedDraftTargetId = ref('__new__')
const activationState = ref(null)
const isActivationLoading = ref(false)
const isActivationCenterOpen = ref(false)
const promptTemplates = ref([])
const negativePromptTemplates = ref([])
const sharedHostInfo = ref(createEmptyHostInfo())
const sharedCreditOverview = ref(createDefaultCreditOverview())
const sharedCreditMessages = ref(createDefaultCreditMessages())
const sharedNetworkMonitor = ref(createDefaultNetworkMonitor())
const videoCreditOverview = ref(createDefaultVideoBalanceOverview())
const videoCreditMessages = ref(createDefaultVideoCreditMessages())
const videoNetworkMonitor = ref(createDefaultNetworkMonitor())
const isRefreshingVideoBilling = ref(false)
const ecmsTaskRegistry = reactive({
  text: [],
  video: []
})
const ecmsExportRegistry = reactive({
  text: [],
  video: []
})
const ecmsSelectedExportIds = reactive({
  text: [],
  video: []
})
const ecmsDownloadCleanupEnabled = reactive({
  text: true,
  video: true
})
const glmConfigState = reactive({
  apiKey: '',
  maskedKey: '',
  configured: false,
  saving: false
})
const videoAdminConfigState = reactive({
  configured: false,
  saving: false
})
const adminStatusState = reactive({
  passwordConfigured: false,
  imageApiConfigured: false,
  videoApiConfigured: false
})
const sourcingWorkflowState = reactive({
  running: false,
  targetId: ''
})
const SOURCING_WORKFLOW_SETTINGS_KEY = 'sourcingWorkflowConfig'
const sourcingWorkflowConfig = reactive(createDefaultSourcingWorkflowConfig())
const sourcingWorkflowConfigDraft = reactive(createDefaultSourcingWorkflowConfig())
const isSourcingWorkflowConfigVisible = ref(false)
const sourcingWorkflowConfigMode = ref('edit')
const adminPasswordDraft = ref('')
const adminPasswordFeedback = ref('')
const adminApiKeyFeedback = ref('')
const isAdminPasswordDialogVisible = ref(false)
const isAdminPasswordSubmitting = ref(false)
const isAdminApiConfigUnlocked = ref(false)
const isAdminApiKeyDialogVisible = ref(false)
const adminImageApiKeyDraft = ref('')
const adminVideoApiKeyDraft = ref('')
const isAdminApiKeySaving = ref(false)

const VIDEO_MODEL_NAME = 'sora-2'
const videoSubmitStates = reactive({
  'video-generate': false
})
const videoStatusStates = reactive({
  'video-generate': createVideoStatusState({
    tone: 'info',
    title: 'Sora 视频模型待命',
    badge: '未检测',
    message: '正在准备 Sora 视频生成能力。',
    detail: '当前模型：sora-2'
  })
})

const notice = reactive({
  visible: false,
  type: 'success',
  title: '',
  message: ''
})

let noticeTimer = null
let sourcingProgressInterval = null
let sourcingPrefetchPromise = null
let hasScheduledSourcingPrefetch = false
let dailyTaskNameDate = ''
let dailyTaskNameCounter = 0

const APP_LANGUAGE_SETTINGS_KEY = 'appLanguage'
const APP_TRANSLATIONS = {
  zh: {
    'nav.hot': '选品',
    'nav.text': '文本',
    'nav.image': '生图',
    'nav.video': '视频',
    'nav.draft': '草稿',
    'nav.publish': '上架',
    'module.sourcing': '选品',
    'module.text': '文本',
    'module.image': '生图',
    'module.video': '视频',
    'module.draft': '草稿',
    'module.listing': '上架',
    'topbar.nav': '页面切换',
    'topbar.theme': '主题',
    'topbar.language': '语言切换',
    'topbar.cleanup': '一键清理',
    'topbar.activation': '激活状态',
    'topbar.authorizedDevice': '已授权设备',
    'topbar.close': '关闭',
    'topbar.github': 'GitHub',
    'topbar.githubDescription': '展示 GitHub 主页信息，可直接复制。',
    'topbar.githubHome': '主页地址',
    'topbar.email': '邮箱',
    'topbar.emailDescription': '点击邮箱地址可调用本地邮件客户端，也可以直接复制。',
    'topbar.qqMail': 'QQ 邮箱',
    'topbar.gmail': 'Gmail',
    'topbar.copy': '复制',
    'topbar.wechat': '微信',
    'topbar.wechatDescription': '点击图片可查看微信联系入口。',
    'topbar.previewSuffix': '预览',
    'studio.text.title': '文本工坊',
    'studio.text.description': '严格参照生图页的布局和切换逻辑，当前聚焦文本生成。',
    'studio.text.menu': '文本工作台',
    'studio.video.title': '视频工坊',
    'studio.video.description': '严格参照生图页的布局和切换逻辑，当前聚焦视频生成。',
    'studio.video.menu': '视频工作台',
    'listing.eyebrow': '上架中心',
    'listing.title': '待开发',
    'listing.description': '“上架”板块暂不开发，后续再按你的业务流程、平台接入方式和字段规则继续设计。',
    'listing.statusTitle': '模块状态',
    'listing.statusDescription': '当前页面仅保留占位，不展示半成品的上架编排逻辑。',
    'listing.lockedTitle': '当前授权未开通上架模块',
    'listing.pendingTitle': '上架功能待开发',
    'listing.lockedFallback': '请在独立授权工具中补充 listing 模块授权。',
    'listing.pendingFallback': '你后续补充平台、字段、发布流程和接口要求后，我再继续往下做。',
    'hot.title': '商品趋势列表',
    'hot.platformAria': '选品平台切换',
    'hot.categoryTitle': '选品分类',
    'hot.listTitle': '商品列表',
    'hot.summaryTop10': '总销量前 10',
    'hot.summaryCached': '已命中本地缓存',
    'hot.summaryPending': '等待今日缓存',
    'hot.headerImage': '商品图',
    'hot.headerInfo': '商品信息',
    'hot.headerMetrics': '核心指标',
    'hot.headerActions': '操作',
    'hot.viewProduct': '查看商品',
    'hot.oneClickEdit': '一键编辑',
    'hot.oneClickEditBusy': '处理中...',
    'hot.oneClickEditConfig': '一键编辑配置',
    'hot.oneClickGenerate': '一键生成',
    'hot.oneClickGenerateBusy': '生成中...',
    'hot.oneClickGenerateConfig': '一键生成配置',
    'hot.rankTag': '总销量优先',
    'hot.totalSold': '总销量',
    'hot.conversion': '转化参考',
    'hot.assetDirection': '素材方向',
    'hot.platform': '平台',
    'hot.loadingImage': '正在加载商品图',
    'hot.emptyImage': '暂无商品图',
    'hot.waitTitle': '等待缓存同步',
    'hot.waitDescription': '系统会优先展示本地缓存；如果当天还没有缓存数据，会在安全延迟后自动请求一次，并将结果保存到本地，第二天再自动覆盖。',
    'hot.emptyTitle': '暂无可展示商品',
    'hot.lockedTitle': '当前授权未开通选品模块',
    'hot.lockedFallback': '如需继续使用选品，请在授权工具中开通 sourcing 模块。',
    'hot.productCount.loading': '正在等待今日缓存数据',
    'hot.productCount.requesting': '正在按安全间隔同步今日数据',
    'hot.productCount.error': '当前平台暂未获取到数据',
    'hot.productCount.ready': '当前共 {count} 条商品',
    'hot.cache.pending': '系统会在安全延迟后自动同步一次今日数据',
    'hot.cache.readyPrefix': '本地缓存已更新：',
    'hot.cache.idle': '当前展示本地缓存或等待首次安全同步',
    'hot.progress.delay': '安全等待中',
    'hot.progress.request': '正在请求商品数据',
    'hot.progress.ready': '数据已就绪',
    'hot.progress.idle': '等待同步',
    'hot.progress.startIn': '后开始请求',
    'hot.prefetchPrefix': '后台正在补齐其他分类缓存：',
    'hot.currentPlatform': '当前平台',
    'hot.currentCategory': '当前分类',
    'admin.passwordTitleVerify': '管理员验证',
    'admin.passwordTitleInit': '初始化管理员口令',
    'admin.passwordDescriptionVerify': '请输入管理员口令',
    'admin.passwordDescriptionInit': '首次使用请设置管理员口令',
    'admin.passwordConfirmVerify': '验证并继续',
    'admin.passwordConfirmInit': '设置并继续'
  },
  en: {
    'nav.hot': 'Sourcing',
    'nav.text': 'Text',
    'nav.image': 'Image',
    'nav.video': 'Video',
    'nav.draft': 'Drafts',
    'nav.publish': 'Listing',
    'module.sourcing': 'Sourcing',
    'module.text': 'Text',
    'module.image': 'Image',
    'module.video': 'Video',
    'module.draft': 'Drafts',
    'module.listing': 'Listing',
    'topbar.nav': 'Page navigation',
    'topbar.theme': 'Theme',
    'topbar.language': 'Language switch',
    'topbar.cleanup': 'Quick Clean',
    'topbar.activation': 'Activation',
    'topbar.authorizedDevice': 'Authorized Device',
    'topbar.close': 'Close',
    'topbar.github': 'GitHub',
    'topbar.githubDescription': 'Displays the GitHub home page info and supports copy only.',
    'topbar.githubHome': 'Home Page',
    'topbar.email': 'Email',
    'topbar.emailDescription': 'Click an address to open your local mail client, or copy it directly.',
    'topbar.qqMail': 'QQ Mail',
    'topbar.gmail': 'Gmail',
    'topbar.copy': 'Copy',
    'topbar.wechat': 'WeChat',
    'topbar.wechatDescription': 'Click the image to view the WeChat contact entry.',
    'topbar.previewSuffix': ' Preview',
    'studio.text.title': 'Text Studio',
    'studio.text.description': 'Aligned with the image studio layout and switching logic, focused on text generation.',
    'studio.text.menu': 'Text Workspace',
    'studio.video.title': 'Video Studio',
    'studio.video.description': 'Aligned with the image studio layout and switching logic, focused on video generation.',
    'studio.video.menu': 'Video Workspace',
    'listing.eyebrow': 'Listing Center',
    'listing.title': 'Coming Soon',
    'listing.description': 'The listing module is intentionally deferred and will be designed later around your workflow, platform integrations, and field rules.',
    'listing.statusTitle': 'Module Status',
    'listing.statusDescription': 'This page is only a placeholder for now and does not expose unfinished listing logic.',
    'listing.lockedTitle': 'Listing module is not included in the current license',
    'listing.pendingTitle': 'Listing features are under development',
    'listing.lockedFallback': 'Please enable the listing module in the standalone authorization tool.',
    'listing.pendingFallback': 'Once you define the platform fields, publishing flow, and API requirements, I can continue building this section.',
    'hot.title': 'Trending Product List',
    'hot.platformAria': 'Sourcing platform switch',
    'hot.categoryTitle': 'Categories',
    'hot.listTitle': 'Products',
    'hot.summaryTop10': 'Top 10 by total sales',
    'hot.summaryCached': 'Using local cache',
    'hot.summaryPending': 'Waiting for today cache',
    'hot.headerImage': 'Image',
    'hot.headerInfo': 'Product Info',
    'hot.headerMetrics': 'Metrics',
    'hot.headerActions': 'Actions',
    'hot.viewProduct': 'Open Product',
    'hot.oneClickEdit': 'Quick Edit',
    'hot.oneClickEditBusy': 'Processing...',
    'hot.oneClickEditConfig': 'Quick Edit Settings',
    'hot.oneClickGenerate': 'Quick Generate',
    'hot.oneClickGenerateBusy': 'Generating...',
    'hot.oneClickGenerateConfig': 'Quick Generate Settings',
    'hot.rankTag': 'Sorted by total sales',
    'hot.totalSold': 'Total sales',
    'hot.conversion': 'Conversion',
    'hot.assetDirection': 'Asset direction',
    'hot.platform': 'Platform',
    'hot.loadingImage': 'Loading image',
    'hot.emptyImage': 'No image',
    'hot.waitTitle': 'Waiting for cache sync',
    'hot.waitDescription': 'The system prefers local cache. If no cache exists for the day, it waits for a safe interval, fetches once, stores locally, and refreshes again the next day.',
    'hot.emptyTitle': 'No products available',
    'hot.lockedTitle': 'Sourcing module is not included in the current license',
    'hot.lockedFallback': 'Enable the sourcing module in the authorization tool to continue.',
    'hot.productCount.loading': 'Waiting for today cache',
    'hot.productCount.requesting': 'Syncing today data with a safe interval',
    'hot.productCount.error': 'No data is currently available for this platform',
    'hot.productCount.ready': '{count} products loaded',
    'hot.cache.pending': 'The system will sync today data automatically after a safe delay',
    'hot.cache.readyPrefix': 'Local cache updated: ',
    'hot.cache.idle': 'Showing local cache or waiting for the first safe sync',
    'hot.progress.delay': 'Safe delay in progress',
    'hot.progress.request': 'Requesting product data',
    'hot.progress.ready': 'Data ready',
    'hot.progress.idle': 'Waiting to sync',
    'hot.progress.startIn': ' until request starts',
    'hot.prefetchPrefix': 'Background cache fill for other categories: ',
    'hot.currentPlatform': 'Platform',
    'hot.currentCategory': 'Category',
    'admin.passwordTitleVerify': 'Admin Verification',
    'admin.passwordTitleInit': 'Initialize Admin Password',
    'admin.passwordDescriptionVerify': 'Enter the admin password',
    'admin.passwordDescriptionInit': 'Set the admin password for first use',
    'admin.passwordConfirmVerify': 'Verify and Continue',
    'admin.passwordConfirmInit': 'Save and Continue'
  }
}

function t(key, variables = null) {
  const currentTable = APP_TRANSLATIONS[activeLanguage.value] || APP_TRANSLATIONS.zh
  const fallbackValue = APP_TRANSLATIONS.zh[key] ?? key
  let text = currentTable[key] ?? fallbackValue

  if (variables && typeof text === 'string') {
    Object.entries(variables).forEach(([name, value]) => {
      text = text.replaceAll(`{${name}}`, String(value))
    })
  }

  return text
}

const SOURCING_SAFE_DELAY_MS = 6500
const SOURCING_CACHE_SETTINGS_KEY = 'sourcingCache'
const SOURCING_CACHE_VERSION = '2026-05-27-total-sold-top10-v3-smt-preview'
const SOURCING_SCENE_KEYS = ['hot', 'hot_new', 'new_shop_hot', 'big_sale_new']
const SOURCING_PREFETCH_PLATFORM_KEYS = ['temu', 'shein', 'shopee', 'amazon', 'smt', 'tiktok']
const sourcingRequestStateMap = new Map()

function getTodayCacheDate() {
  const now = new Date()
  const year = now.getFullYear()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const day = String(now.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function createSourcingCacheKey(platformKey = '', sceneKey = '') {
  return `${platformKey || 'unknown'}::${sceneKey || 'hot'}`
}

function createDefaultSourcingWorkflowConfig() {
  return {
    edit: {
      text: {
        enabled: true,
        batchCount: 3,
        lengthLimit: '标题 24-30 字；描述 80-120 字',
        promptInput: '基于商品标题，生成更适合电商平台搜索与转化的新标题和详情描述。'
      },
      image: {
        enabled: true,
        batchCount: 1,
        size: '1:1',
        globalPrompt: '',
        promptTitles: ['主图方案']
      },
      video: {
        enabled: true,
        operation: 'auto',
        duration: '8 秒',
        aspectRatio: '9:16',
        size: 'large',
        promptInput: ''
      }
    },
    generate: {
      text: {
        enabled: true,
        batchCount: 3,
        lengthLimit: '标题 24-30 字；描述 80-120 字',
        promptInput: '基于商品标题、卖点和平台规则，批量生成可直接用于草稿的标题与详情描述。'
      },
      image: {
        enabled: true,
        batchCount: 1,
        size: '1:1',
        globalPrompt: '',
        promptTitles: ['主图方案']
      },
      video: {
        enabled: true,
        operation: 'auto',
        duration: '8 秒',
        aspectRatio: '9:16',
        size: 'large',
        promptInput: '围绕商品核心卖点生成适合电商转化的视频提示词。'
      }
    }
  }
}

function cloneSourcingWorkflowConfig(config = {}) {
  return JSON.parse(JSON.stringify(config || createDefaultSourcingWorkflowConfig()))
}

function normalizePositiveInteger(value, fallback = 1, max = 12) {
  const numericValue = Number(value)
  if (!Number.isFinite(numericValue) || numericValue <= 0) {
    return fallback
  }

  return Math.max(1, Math.min(max, Math.round(numericValue)))
}

function normalizePromptTitleList(value = '') {
  const lines = String(value || '')
    .split(/\r?\n/)
    .map((item) => item.trim())
    .filter(Boolean)

  return lines.length ? lines : ['主图方案']
}

function normalizeSourcingWorkflowConfig(config = {}) {
  const defaults = createDefaultSourcingWorkflowConfig()
  const nextConfig = cloneSourcingWorkflowConfig(defaults)

  ;['edit', 'generate'].forEach((modeKey) => {
    const currentMode = config?.[modeKey] && typeof config[modeKey] === 'object' ? config[modeKey] : {}
    const currentText = currentMode.text && typeof currentMode.text === 'object' ? currentMode.text : {}
    const currentImage = currentMode.image && typeof currentMode.image === 'object' ? currentMode.image : {}
    const currentVideo = currentMode.video && typeof currentMode.video === 'object' ? currentMode.video : {}

    nextConfig[modeKey].text.enabled = currentText.enabled !== undefined ? Boolean(currentText.enabled) : defaults[modeKey].text.enabled
    nextConfig[modeKey].text.batchCount = normalizePositiveInteger(currentText.batchCount, defaults[modeKey].text.batchCount, 20)
    nextConfig[modeKey].text.lengthLimit = String(currentText.lengthLimit || defaults[modeKey].text.lengthLimit)
    nextConfig[modeKey].text.promptInput = String(currentText.promptInput || defaults[modeKey].text.promptInput)

    nextConfig[modeKey].image.enabled = currentImage.enabled !== undefined ? Boolean(currentImage.enabled) : defaults[modeKey].image.enabled
    nextConfig[modeKey].image.batchCount = normalizePositiveInteger(currentImage.batchCount, defaults[modeKey].image.batchCount, 8)
    nextConfig[modeKey].image.size = String(currentImage.size || defaults[modeKey].image.size)
    nextConfig[modeKey].image.globalPrompt = String(currentImage.globalPrompt || defaults[modeKey].image.globalPrompt)
    nextConfig[modeKey].image.promptTitles = Array.isArray(currentImage.promptTitles) && currentImage.promptTitles.length
      ? currentImage.promptTitles.map((item) => String(item || '').trim()).filter(Boolean)
      : defaults[modeKey].image.promptTitles

    nextConfig[modeKey].video.enabled = currentVideo.enabled !== undefined ? Boolean(currentVideo.enabled) : defaults[modeKey].video.enabled
    nextConfig[modeKey].video.operation = String(currentVideo.operation || defaults[modeKey].video.operation)
    nextConfig[modeKey].video.duration = String(currentVideo.duration || defaults[modeKey].video.duration)
    nextConfig[modeKey].video.aspectRatio = String(currentVideo.aspectRatio || defaults[modeKey].video.aspectRatio)
    nextConfig[modeKey].video.size = String(currentVideo.size || defaults[modeKey].video.size)
    nextConfig[modeKey].video.promptInput = String(currentVideo.promptInput || defaults[modeKey].video.promptInput)
  })

  return nextConfig
}

function applySourcingWorkflowConfig(config = {}) {
  const normalizedConfig = normalizeSourcingWorkflowConfig(config)
  const clonedConfig = cloneSourcingWorkflowConfig(normalizedConfig)
  Object.assign(sourcingWorkflowConfig, clonedConfig)
  Object.assign(sourcingWorkflowConfigDraft, cloneSourcingWorkflowConfig(normalizedConfig))
}

function openSourcingWorkflowConfig(mode = 'edit') {
  sourcingWorkflowConfigMode.value = mode === 'generate' ? 'generate' : 'edit'
  Object.assign(sourcingWorkflowConfigDraft, cloneSourcingWorkflowConfig(sourcingWorkflowConfig))
  isSourcingWorkflowConfigVisible.value = true
}

function closeSourcingWorkflowConfig() {
  isSourcingWorkflowConfigVisible.value = false
}

async function saveSourcingWorkflowConfig() {
  const normalizedConfig = normalizeSourcingWorkflowConfig(sourcingWorkflowConfigDraft)
  await saveSettings({
    [SOURCING_WORKFLOW_SETTINGS_KEY]: normalizedConfig
  })
  applySourcingWorkflowConfig(normalizedConfig)
  isSourcingWorkflowConfigVisible.value = false
  showNotice('success', '联动配置已保存', '一键编辑和一键生成的联动规则已更新。')
}

function getActiveSourcingWorkflowConfig(mode = 'edit') {
  return sourcingWorkflowConfig[mode === 'generate' ? 'generate' : 'edit'] || createDefaultSourcingWorkflowConfig().edit
}

function getSourcingProductSortValue(item = {}) {
  const directValue = Number(item?.totalSoldValue)
  if (Number.isFinite(directValue)) {
    return directValue
  }

  const raw = item?.raw && typeof item.raw === 'object' ? item.raw : {}
  const fallbackValue = Number(
    raw.sales ??
    raw.totalSold ??
    raw.sold ??
    raw.monthSold ??
    raw.reviewNum ??
    0
  )

  return Number.isFinite(fallbackValue) ? fallbackValue : 0
}

function normalizeSourcingProductList(items = []) {
  if (!Array.isArray(items)) {
    return []
  }

  return [...items]
    .sort((leftItem, rightItem) => getSourcingProductSortValue(rightItem) - getSourcingProductSortValue(leftItem))
    .slice(0, 10)
}

function isActiveSourcingView(platformKey = '', sceneKey = '') {
  return activeSourcingPlatform.value === platformKey && activeSourcingScene.value === sceneKey
}

function getSourcingRequestState(platformKey = '', sceneKey = '') {
  const cacheKey = createSourcingCacheKey(platformKey, sceneKey)
  if (!sourcingRequestStateMap.has(cacheKey)) {
    sourcingRequestStateMap.set(cacheKey, {
      timer: null,
      promise: null
    })
  }

  return sourcingRequestStateMap.get(cacheKey)
}

function clearSourcingRequestState(platformKey = '', sceneKey = '') {
  const requestState = getSourcingRequestState(platformKey, sceneKey)
  if (requestState.timer) {
    clearTimeout(requestState.timer)
    requestState.timer = null
  }
  requestState.promise = null
}

function readSourcingCacheEntry(settings = {}, platformKey = activeSourcingPlatform.value, sceneKey = activeSourcingScene.value) {
  const entries = settings?.[SOURCING_CACHE_SETTINGS_KEY]?.entries || {}
  const entry = entries[createSourcingCacheKey(platformKey, sceneKey)]

  if (!entry || typeof entry !== 'object') {
    return null
  }

  return entry
}

async function writeSourcingCacheEntry({ platformKey = '', sceneKey = '', items = [] } = {}) {
  const currentSettings = await getSettings().catch(() => ({}))
  const currentEntries = currentSettings?.[SOURCING_CACHE_SETTINGS_KEY]?.entries || {}
  const cacheDate = getTodayCacheDate()
  const updatedAt = new Date().toISOString()
  const normalizedItems = normalizeSourcingProductList(items)
  const nextEntry = {
    platformKey,
    sceneKey,
    version: SOURCING_CACHE_VERSION,
    cacheDate,
    updatedAt,
    items: normalizedItems
  }

  await saveSettings({
    [SOURCING_CACHE_SETTINGS_KEY]: {
      entries: {
        ...currentEntries,
        [createSourcingCacheKey(platformKey, sceneKey)]: nextEntry
      }
    }
  })

  return nextEntry
}

function applySourcingProducts(items = [], cacheEntry = null) {
  sourcingProducts.value = normalizeSourcingProductList(items)
  sourcingProductsLoaded.value = true
  sourcingAutoRefreshStatus.cacheDate = cacheEntry?.cacheDate || ''
  sourcingAutoRefreshStatus.updatedAt = cacheEntry?.updatedAt || ''
  sourcingAutoRefreshStatus.mode = 'ready'
  sourcingAutoRefreshStatus.message = ''
  sourcingAutoRefreshStatus.phase = 'ready'
  sourcingAutoRefreshStatus.progressPercent = 100
  sourcingAutoRefreshStatus.countdownMs = 0
}

function clearSourcingProductsView() {
  sourcingProducts.value = []
  sourcingProductsLoaded.value = false
  sourcingAutoRefreshStatus.cacheDate = ''
  sourcingAutoRefreshStatus.updatedAt = ''
  sourcingAutoRefreshStatus.mode = 'idle'
  sourcingAutoRefreshStatus.message = ''
  sourcingAutoRefreshStatus.phase = 'idle'
  sourcingAutoRefreshStatus.progressPercent = 0
  sourcingAutoRefreshStatus.countdownMs = 0
}

function applySourcingViewState({ items = [], cacheEntry = null, mode = 'ready', message = '' } = {}) {
  applySourcingProducts(items, cacheEntry)
  sourcingAutoRefreshStatus.mode = mode
  sourcingAutoRefreshStatus.message = message
}

function resetSourcingPrefetchState() {
  sourcingPrefetchState.total = 0
  sourcingPrefetchState.completed = 0
  sourcingPrefetchState.currentSceneKey = ''
  sourcingPrefetchState.running = false
}

function stopSourcingProgressTicker() {
  if (sourcingProgressInterval) {
    clearInterval(sourcingProgressInterval)
    sourcingProgressInterval = null
  }
}

function startSourcingDelayFeedback(delayMs = SOURCING_SAFE_DELAY_MS) {
  stopSourcingProgressTicker()
  const startedAt = Date.now()
  sourcingAutoRefreshStatus.phase = 'delay'
  sourcingAutoRefreshStatus.progressPercent = 6
  sourcingAutoRefreshStatus.countdownMs = delayMs

  sourcingProgressInterval = window.setInterval(() => {
    const elapsedMs = Date.now() - startedAt
    const remainingMs = Math.max(0, delayMs - elapsedMs)
    const progressRatio = Math.min(1, elapsedMs / delayMs)

    sourcingAutoRefreshStatus.countdownMs = remainingMs
    sourcingAutoRefreshStatus.progressPercent = Math.min(92, 6 + Math.round(progressRatio * 80))

    if (remainingMs <= 0) {
      stopSourcingProgressTicker()
    }
  }, 200)
}

function startSourcingRequestFeedback() {
  stopSourcingProgressTicker()
  sourcingAutoRefreshStatus.phase = 'request'
  sourcingAutoRefreshStatus.countdownMs = 0
  sourcingAutoRefreshStatus.progressPercent = Math.max(sourcingAutoRefreshStatus.progressPercent, 94)
}

function createWorkspaceStatusOverview({
  moduleKey = 'text',
  moduleLabel = '文本',
  defaultModel = '--',
  platformLabel = '--',
  resultLabel = '文本组',
  balanceLabel = '剩余积分',
  balanceValue = '0'
} = {}) {
  const currentTasks = Array.isArray(ecmsTaskRegistry[moduleKey]) ? ecmsTaskRegistry[moduleKey] : []
  const currentExports = Array.isArray(ecmsExportRegistry[moduleKey]) ? ecmsExportRegistry[moduleKey] : []
  const latestTask = currentTasks[0] || null
  const completedCount = currentTasks.filter((item) => item?.status === '已完成').length
  const pendingCount = currentTasks.filter((item) => item?.status === '进行中' || item?.status === '等待中' || item?.status === '待确认').length

  return {
    title: `${moduleLabel}信息状态栏`,
    items: [
      { label: '模块状态', value: hasModuleAccess(moduleKey) ? '已开通' : '未开通' },
      { label: '当前模型', value: defaultModel },
      { label: '平台格式', value: platformLabel || '--' },
      { label: '任务总数', value: String(currentTasks.length) },
      { label: '进行中任务', value: String(pendingCount) },
      { label: '已完成任务', value: String(completedCount) },
      { label: '当前结果数', value: `${currentExports.length} ${resultLabel}` },
      { label: '草稿总数', value: `${draftItems.value.length} 组` },
      { label: balanceLabel, value: balanceValue || '0' },
      { label: '最近任务', value: latestTask?.taskNumber || '暂无' },
      { label: '最近状态', value: latestTask?.status || '待命' },
      { label: '最近进度', value: latestTask ? `${Math.max(0, Math.min(100, Number(latestTask.progress) || 0))}%` : '0%' }
    ]
  }
}

function createEmptyHostInfo() {
  return {
    systemName: '--',
    platformName: '--',
    architecture: '--',
    cpuModel: '--',
    userName: '--',
    runtimeName: 'QiuAi-ECMS Desktop'
  }
}

function createDefaultCreditOverview() {
  return {
    title: '积分仪表盘',
    items: [
      { label: '剩余积分', value: '0' },
      { label: '冻结积分', value: '0' },
      { label: '已用积分', value: '0' },
      { label: '累计充值积分', value: '0' },
      { label: '最近调整', value: '--' },
      { label: '按 gpt-image-2 约可生成', value: '0' }
    ]
  }
}

function createDefaultCreditMessages() {
  return {
    title: '积分消息记录',
    helperText: '当前先复用生图工作台的积分视图，后续可按文本/视频任务单独计费。',
    items: [
      {
        id: 'credit-message-text-video-1',
        label: '电商内容工坊已接入统一积分面板',
        description: '文本 / 视频当前与生图共用积分口径，后续再拆分到独立任务维度。',
        amountDisplay: '系统说明',
        createdAt: '刚刚'
      }
    ]
  }
}

function createDefaultNetworkMonitor() {
  return {
    title: '网络监控',
    summary: {
      latestLatencyMs: 186,
      averageLatencyMs: 214,
      successRate: '99.2%'
    },
    items: [
      { id: 'network-1', method: 'POST', requestPath: '/ecms/text/tasks', elapsedMs: 228, status: 'completed', timeLabel: '刚刚' },
      { id: 'network-2', method: 'POST', requestPath: '/ecms/video/tasks', elapsedMs: 242, status: 'completed', timeLabel: '1 分钟前' },
      { id: 'network-3', method: 'GET', requestPath: '/ecms/prompts', elapsedMs: 154, status: 'completed', timeLabel: '2 分钟前' },
      { id: 'network-4', method: 'GET', requestPath: '/studio/dashboard', elapsedMs: 196, status: 'completed', timeLabel: '3 分钟前' },
      { id: 'network-5', method: 'POST', requestPath: '/drafts/create', elapsedMs: 266, status: 'completed', timeLabel: '5 分钟前' },
      { id: 'network-6', method: 'GET', requestPath: '/activation/status', elapsedMs: 124, status: 'completed', timeLabel: '8 分钟前' }
    ]
  }
}

function normalizeHostInfo(hostInfo = {}, runtimeName) {
  return {
    systemName: hostInfo.systemName || '--',
    platformName: hostInfo.platformName || '--',
    architecture: hostInfo.architecture || '--',
    cpuModel: hostInfo.cpuModel || '--',
    userName: hostInfo.userName || '--',
    runtimeName: runtimeName || hostInfo.runtimeName || 'QiuAi-ECMS Desktop'
  }
}

function createModelPriceCard({
  name,
  status = '',
  billing = '',
  credits = '',
  priceSummary = '',
  outputSummary = '',
  refundPolicy = '',
  features = []
} = {}) {
  return {
    name,
    status,
    billing,
    credits,
    priceSummary,
    outputSummary,
    refundPolicy,
    features: Array.isArray(features) ? features : []
  }
}

function createTextWorkspaceDashboard() {
  return {
    statusOverview: createWorkspaceStatusOverview({
      moduleKey: 'text',
      moduleLabel: '文本',
      defaultModel: textServiceConfig.value.fields?.find((item) => item.key === 'glm_model_name')?.value || 'GLM-4.7-Flash',
      platformLabel: textParameterSections['text-generate']?.groups?.[0]?.fields?.find((item) => item.key === 'text_platform_format')?.value || 'TEMU',
      resultLabel: '组',
      balanceLabel: '剩余积分',
      balanceValue: sharedCreditOverview.value.items?.find((item) => item.label === '剩余积分')?.value || '0'
    }),
    creditOverview: sharedCreditOverview.value,
    creditMessages: sharedCreditMessages.value,
    networkMonitor: sharedNetworkMonitor.value
  }
}

function createDefaultVideoBalanceOverview() {
  return {
    title: '视频余额仪表盘',
    items: [
      { label: '当前余额', value: '$0.00' },
      { label: '总额度', value: '$0.00' },
      { label: '今日用量', value: '$0.00' },
      { label: '访问有效期', value: '--' },
      { label: '当前令牌', value: '--' },
      { label: '余额状态', value: '待查询' }
    ]
  }
}

function createVideoWorkspaceDashboard() {
  return {
    statusOverview: createWorkspaceStatusOverview({
      moduleKey: 'video',
      moduleLabel: '视频',
      defaultModel: 'sora-2',
      platformLabel: videoParameterSections['video-generate']?.groups?.[0]?.fields?.find((item) => item.key === 'video_platform')?.value || 'TikTok',
      resultLabel: '条',
      balanceLabel: '当前余额',
      balanceValue: videoCreditOverview.value.items?.find((item) => item.label === '当前余额')?.value || '$0.00'
    }),
    creditActions: {
      mode: 'single',
      primaryLabel: '余额查询',
      primaryBusyLabel: '查询中...',
      primaryAction: 'refresh-remaining'
    },
    creditOverview: videoCreditOverview.value,
    creditMessages: videoCreditMessages.value,
    networkMonitor: videoNetworkMonitor.value
  }
}

const textWorkspaceDashboard = computed(() => createTextWorkspaceDashboard())
const videoWorkspaceDashboard = computed(() => createVideoWorkspaceDashboard())
const textHostInfo = computed(() => normalizeHostInfo(sharedHostInfo.value, 'QiuAi ECMS / 文本工坊'))
const videoHostInfo = computed(() => normalizeHostInfo(sharedHostInfo.value, 'QiuAi ECMS / 视频工坊'))

const textSidebarTasks = computed(() => ecmsTaskRegistry.text)
const videoSidebarTasks = computed(() => ecmsTaskRegistry.video)
const textExportItems = computed(() => ecmsExportRegistry.text)
const videoExportItems = computed(() => ecmsExportRegistry.video)
const textExportMenuKeys = ['text-generate']
const videoExportMenuKeys = ['video-generate']

const modelPricingCatalog = [
  createModelPriceCard({ name: 'nano-banana-fast', status: '可用', billing: '按次计费', credits: '440 / 次', priceSummary: '当前生图基础款', features: ['文生图', '图生图'] }),
  createModelPriceCard({ name: 'gpt-image-2', status: '可用', billing: '按次计费', credits: '600 / 次', priceSummary: '当前生图通用款', features: ['文生图', '图生图'] }),
  createModelPriceCard({ name: 'gpt-image-2-vip', status: '可用', billing: '按次计费', credits: '1300 / 次', priceSummary: '¥0.065 ~ ¥0.13 / 次', refundPolicy: '违规返还 / 失败返还支持', features: ['文生图', '图生图', '1K', '2K', '4K'] }),
  createModelPriceCard({ name: 'nano-banana-2', status: '可用', billing: '按次计费', credits: '1200 / 次', priceSummary: '进阶生图', features: ['文生图', '图生图'] }),
  createModelPriceCard({ name: 'nano-banana', status: '可用', billing: '按次计费', credits: '1400 / 次', priceSummary: '高质量生图', features: ['文生图', '图生图'] }),
  createModelPriceCard({ name: 'nano-banana-2-cl', status: '可用', billing: '按次计费', credits: '1600 / 次', priceSummary: '精细控制版', features: ['文生图', '图生图'] }),
  createModelPriceCard({ name: 'nano-banana-pro', status: '可用', billing: '按次计费', credits: '1800 / 次', priceSummary: '专业款', features: ['文生图', '图生图'] }),
  createModelPriceCard({ name: 'nano-banana-pro-vt', status: '可用', billing: '按次计费', credits: '1800 / 次', priceSummary: '专业视频素材适配', features: ['文生图', '图生图'] }),
  createModelPriceCard({ name: 'nano-banana-2-4k-cl', status: '可用', billing: '按次计费', credits: '3000 / 次', priceSummary: '4K 控制版', features: ['文生图', '图生图', '4K'] }),
  createModelPriceCard({ name: 'nano-banana-pro-cl', status: '可用', billing: '按次计费', credits: '6000 / 次', priceSummary: '专业高阶控制', features: ['文生图', '图生图'] }),
  createModelPriceCard({ name: 'nano-banana-pro-vip', status: '可用', billing: '按次计费', credits: '10000 / 次', priceSummary: 'VIP 生图', features: ['文生图', '图生图'] }),
  createModelPriceCard({ name: 'nano-banana-pro-4k-vip', status: '可用', billing: '按次计费', credits: '16000 / 次', priceSummary: 'VIP 4K 生图', features: ['文生图', '图生图', '4K'] })
]

void modelPricingCatalog

const textModelPricingCatalog = [
  createModelPriceCard({ name: 'GLM-4.7-Flash', status: '免费', billing: '免费调用', credits: '免费模型', priceSummary: '用户自备 GLM Key 可直接调用', features: ['对话', '标题生成', '描述生成'] }),
  createModelPriceCard({ name: 'gpt-5.5', status: '可用', billing: '按 Token 计费', priceSummary: 'input: ¥2.2-¥4.4 / M Tokens', outputSummary: 'output: ¥13.5-¥27 / M Tokens' }),
  createModelPriceCard({ name: 'gpt-5.4', status: '可用', billing: '按 Token 计费', priceSummary: 'input: ¥0.7-¥1.4 / M Tokens', outputSummary: 'output: ¥6-¥12 / M Tokens' }),
  createModelPriceCard({ name: 'gemini-3.5-flash', status: '可用', billing: '按 Token 计费', priceSummary: 'input: ¥1.2-¥2.4 / M Tokens', outputSummary: 'output: ¥10-¥20 / M Tokens', features: ['对话', '识图', '推理'] }),
  createModelPriceCard({ name: 'gemini-3.1-pro', status: '可用', billing: '按 Token 计费', priceSummary: 'input: ¥1.5-¥3 / M Tokens', outputSummary: 'output: ¥7-¥14 / M Tokens', features: ['对话', '识图', '推理'] }),
  createModelPriceCard({ name: 'gemini-3.1-flash-lite', status: '可用', billing: '按 Token 计费', priceSummary: 'input: ¥0.25-¥0.5 / M Tokens', outputSummary: 'output: ¥1.5-¥3 / M Tokens', features: ['对话', '识图'] }),
  createModelPriceCard({ name: 'gemini-3-pro', status: '可用', billing: '按 Token 计费', priceSummary: 'input: ¥1.5-¥3 / M Tokens', outputSummary: 'output: ¥7-¥14 / M Tokens', features: ['对话', '识图', '推理'] }),
  createModelPriceCard({ name: 'gemini-3-flash', status: '可用', billing: '按 Token 计费', priceSummary: 'input: ¥0.4-¥0.8 / M Tokens', outputSummary: 'output: ¥3-¥6 / M Tokens', features: ['对话', '识图'] }),
  createModelPriceCard({ name: 'gemini-2.5-pro', status: '可用', billing: '按 Token 计费', priceSummary: 'input: ¥1.25-¥2.5 / M Tokens', outputSummary: 'output: ¥6.25-¥12.5 / M Tokens', features: ['对话', '识图', '推理'] }),
  createModelPriceCard({ name: 'gemini-2.5-flash', status: '可用', billing: '按 Token 计费', priceSummary: 'input: ¥0.3-¥0.6 / M Tokens', outputSummary: 'output: ¥2-¥4 / M Tokens', features: ['对话', '识图'] })
]

const textModelOptions = textModelPricingCatalog.map((item) => item.name)

const videoModelPricingCatalog = [
  createModelPriceCard({ name: 'sora-2', status: '可用', billing: '异步 / 按秒计费', credits: '平台价 $0.07 / 秒', priceSummary: '官方价 $0.10 / 秒', outputSummary: '折扣 30%', features: ['文生视频', '图生视频', '支持私密输出'] }),
  createModelPriceCard({ name: 'sora-2-all', status: '可用', billing: '异步 / 按秒计费', credits: '图生视频推荐通道', priceSummary: '用于带图输入的视频生成', outputSummary: '自动适配图生视频', features: ['图生视频', '竖屏 / 横屏', '支持私密输出'] }),
  createModelPriceCard({ name: 'sora-2-pro', status: '可用', billing: '异步 / 按秒计费', credits: '平台价 $0.21 ~ $0.49 / 秒', priceSummary: '官方价 $0.30 ~ $0.70 / 秒', outputSummary: '折扣 30%', features: ['文生视频', '图生视频', '质量更高'] }),
  createModelPriceCard({ name: 'sora-2-characters', status: '待扩展', billing: '文档已提供能力入口', credits: '角色能力待补全', priceSummary: '适合角色化视频流程', outputSummary: '需要独立角色配置字段', features: ['Character', '后续接入'] }),
  createModelPriceCard({ name: 'sora-2-pro-storyboard', status: '待扩展', billing: '按次计费', credits: '平台价 $0.525 ~ $0.945 / 次', priceSummary: '官方价 $0.75 ~ $1.35 / 次', outputSummary: '适合 Storyboard 流程', features: ['图生视频', '后续接入'] })
]

const navItems = computed(() => {
  return [
    { key: 'hot', label: '选品', disabled: !hasModuleAccess('sourcing') },
    { key: 'text', label: '文本', disabled: !hasModuleAccess('text') },
    { key: 'image', label: '生图', disabled: !hasModuleAccess('image') },
    { key: 'video', label: '视频', disabled: !hasModuleAccess('video') },
    { key: 'draft', label: '草稿', badge: draftItems.value.length ? String(draftItems.value.length) : '', disabled: !hasModuleAccess('draft') },
    { key: 'publish', label: '上架', disabled: !hasModuleAccess('listing') }
  ]
})

const activationSummary = computed(() => {
  if (!activationState.value || activationState.value.status !== 'activated') {
    return null
  }

  return {
    customerName: activationState.value.customerName || '已激活',
    edition: activationState.value.edition || '',
    licenseId: activationState.value.licenseId || ''
  }
})

const isActivationReady = computed(() => {
  return activationState.value?.status === 'activated'
})

const sourcingPlatformOptions = [
  { key: 'temu', label: 'TEMU', siteLabel: 'TEMU 数据热销榜', siteUrl: 'https://www.temaishuju.com/goods/hot-sale' },
  { key: 'shein', label: 'SHEIN', siteLabel: 'SHEIN 数据热销榜', siteUrl: 'https://www.sheinshuju.com/goods/hot-sale' },
  { key: 'shopee', label: '虾皮', siteLabel: '虾皮数据热销榜', siteUrl: 'https://www.xiapishuju.com/goods/hot-sale' },
  { key: 'amazon', label: '亚马逊', siteLabel: '亚马逊数据热销榜', siteUrl: 'https://www.amazonshuju.com/goods/hot-sale' },
  { key: 'smt', label: '速卖通', siteLabel: '速卖通数据热销榜', siteUrl: 'https://www.sumaitongshuju.com/goods/hot-sale' },
  { key: 'tiktok', label: 'TikTok', siteLabel: 'TikTok 数据热销榜', siteUrl: 'https://www.tiktokshuju.com/goods/hot-sale' }
]

const sourcingSceneOptions = [
  { key: 'hot', label: '热销商品' },
  { key: 'hot_new', label: '热销新品' },
  { key: 'new_shop_hot', label: '新店热销' },
  { key: 'big_sale_new', label: '大卖新品' }
]

const topBarLocaleText = computed(() => ({
  navAriaLabel: t('topbar.nav'),
  themeLabel: t('topbar.theme'),
  languageLabel: t('topbar.language'),
  cleanupLabel: t('topbar.cleanup'),
  activationLabel: t('topbar.activation'),
  authorizedDeviceLabel: t('topbar.authorizedDevice'),
  closeLabel: t('topbar.close'),
  copyLabel: t('topbar.copy'),
  githubLabel: t('topbar.github'),
  githubDescription: t('topbar.githubDescription'),
  githubHomeLabel: t('topbar.githubHome'),
  emailLabel: t('topbar.email'),
  emailDescription: t('topbar.emailDescription'),
  qqMailLabel: t('topbar.qqMail'),
  gmailLabel: t('topbar.gmail'),
  wechatLabel: t('topbar.wechat'),
  wechatDescription: t('topbar.wechatDescription'),
  previewSuffix: t('topbar.previewSuffix')
}))

const localizedNavItems = computed(() => {
  return navItems.value.map((item) => ({
    ...item,
    label: t(`nav.${item.key}`)
  }))
})

const localizedActivationSummary = computed(() => {
  const summary = activationSummary.value
  if (!summary) {
    return null
  }

  return {
    ...summary,
    customerName: activationState.value.customerName || t('topbar.authorizedDevice'),
    edition: summary.edition || '',
    licenseId: summary.licenseId || ''
  }
})

const localizedSourcingPlatformOptions = computed(() => {
  return sourcingPlatformOptions.map((item) => {
    if (item.key === 'shopee') {
      return { ...item, label: 'Shopee', siteLabel: 'Shopee Hot Sale' }
    }
    if (item.key === 'amazon') {
      return { ...item, label: 'Amazon', siteLabel: 'Amazon Hot Sale' }
    }
    if (item.key === 'smt') {
      return { ...item, label: 'AliExpress', siteLabel: 'AliExpress Hot Sale' }
    }
    return { ...item }
  })
})

const localizedSourcingSceneOptions = computed(() => {
  return [
    { key: 'hot', label: activeLanguage.value === 'zh' ? '热销商品' : 'Hot Sale' },
    { key: 'hot_new', label: activeLanguage.value === 'zh' ? '热销新品' : 'Hot New' },
    { key: 'new_shop_hot', label: activeLanguage.value === 'zh' ? '新店热销' : 'New Store Hot' },
    { key: 'big_sale_new', label: activeLanguage.value === 'zh' ? '大卖新品' : 'Best Seller New' }
  ]
})

const hotProductsLocaleText = computed(() => ({
  title: t('hot.title'),
  platformAria: t('hot.platformAria'),
  categoryTitle: t('hot.categoryTitle'),
  listTitle: t('hot.listTitle'),
  summaryTop10: t('hot.summaryTop10'),
  summaryCached: t('hot.summaryCached'),
  summaryPending: t('hot.summaryPending'),
  headerImage: t('hot.headerImage'),
  headerInfo: t('hot.headerInfo'),
  headerMetrics: t('hot.headerMetrics'),
  headerActions: t('hot.headerActions'),
  viewProduct: t('hot.viewProduct'),
  oneClickEdit: t('hot.oneClickEdit'),
  oneClickEditBusy: t('hot.oneClickEditBusy'),
  oneClickEditConfig: t('hot.oneClickEditConfig'),
  oneClickGenerate: t('hot.oneClickGenerate'),
  oneClickGenerateBusy: t('hot.oneClickGenerateBusy'),
  oneClickGenerateConfig: t('hot.oneClickGenerateConfig'),
  rankTag: t('hot.rankTag'),
  totalSold: t('hot.totalSold'),
  conversion: t('hot.conversion'),
  assetDirection: t('hot.assetDirection'),
  platform: t('hot.platform'),
  loadingImage: t('hot.loadingImage'),
  emptyImage: t('hot.emptyImage'),
  waitTitle: t('hot.waitTitle'),
  waitDescription: t('hot.waitDescription'),
  emptyTitle: t('hot.emptyTitle'),
  lockedTitle: t('hot.lockedTitle'),
  lockedFallback: t('hot.lockedFallback'),
  currentPlatform: t('hot.currentPlatform'),
  currentCategory: t('hot.currentCategory'),
  productCountLoading: t('hot.productCount.loading'),
  productCountRequesting: t('hot.productCount.requesting'),
  productCountError: t('hot.productCount.error'),
  cachePending: t('hot.cache.pending'),
  cacheReadyPrefix: t('hot.cache.readyPrefix'),
  cacheIdle: t('hot.cache.idle'),
  progressDelay: t('hot.progress.delay'),
  progressRequest: t('hot.progress.request'),
  progressReady: t('hot.progress.ready'),
  progressIdle: t('hot.progress.idle'),
  progressStartIn: t('hot.progress.startIn'),
  prefetchPrefix: t('hot.prefetchPrefix')
}))

const listingLocaleText = computed(() => ({
  eyebrow: t('listing.eyebrow'),
  title: t('listing.title'),
  description: t('listing.description'),
  statusTitle: t('listing.statusTitle'),
  statusDescription: t('listing.statusDescription'),
  lockedTitle: t('listing.lockedTitle'),
  pendingTitle: t('listing.pendingTitle'),
  lockedFallback: t('listing.lockedFallback'),
  pendingFallback: t('listing.pendingFallback')
}))

const sourcingPlatformContentMap = {
  temu: {
    platformCards: [
      { platform: '家居', hotCount: '126', description: '适合主图与详情页联动出图' },
      { platform: '宠物', hotCount: '84', description: '适合先跑标题、视频、封面组合' },
      { platform: '美妆', hotCount: '59', description: '更偏种草内容与场景图' },
      { platform: '服饰', hotCount: '71', description: '转化逻辑更偏价格和卖点直给' }
    ],
    trendProducts: []
  },
  shein: {
    platformCards: [
      { platform: '女装', hotCount: '93', description: '更适合做场景穿搭与模特展示' },
      { platform: '配饰', hotCount: '68', description: '适合细节图、风格标题与套图快转化' },
      { platform: '美妆', hotCount: '54', description: '适合妆效、色号和种草表达' },
      { platform: '家居', hotCount: '37', description: '适合轻家居和生活方式内容' }
    ],
    trendProducts: []
  },
  shopee: {
    platformCards: [
      { platform: '3C', hotCount: '109', description: '适合参数图和卖点直给型素材' },
      { platform: '家居', hotCount: '77', description: '适合功能图和场景图一起推' },
      { platform: '个护', hotCount: '58', description: '适合使用前后对比与测评文案' },
      { platform: '母婴', hotCount: '42', description: '适合安全感与细节说明' }
    ],
    trendProducts: []
  },
  amazon: {
    platformCards: [
      { platform: '家居', hotCount: '118', description: '适合规范详情和尺寸说明图' },
      { platform: '厨房', hotCount: '83', description: '适合使用步骤与场景演示' },
      { platform: '宠物', hotCount: '57', description: '适合功能卖点和口碑场景' },
      { platform: '户外', hotCount: '45', description: '适合耐用、材质、性能说明' }
    ],
    trendProducts: []
  },
  smt: {
    platformCards: [
      { platform: '汽配', hotCount: '88', description: '适合参数、接口和适配说明' },
      { platform: '家装', hotCount: '64', description: '适合安装步骤和前后对比' },
      { platform: '工具', hotCount: '53', description: '适合结构特写与功能拆解' },
      { platform: '数码', hotCount: '41', description: '适合跨境规范详情页' }
    ],
    trendProducts: []
  },
  tiktok: {
    platformCards: [
      { platform: '家居', hotCount: '132', description: '适合短视频挂车和前后对比打法' },
      { platform: '美妆', hotCount: '91', description: '适合种草视频和强节奏封面' },
      { platform: '配件', hotCount: '66', description: '适合高点击标题和口播钩子' },
      { platform: '个护', hotCount: '48', description: '适合使用结果感和体验式内容' }
    ],
    trendProducts: []
  }
}

const activeSourcingContent = computed(() => {
  const matchedContent = sourcingPlatformContentMap[activeSourcingPlatform.value] || sourcingPlatformContentMap.temu
  return {
    ...matchedContent,
    trendProducts: sourcingProducts.value.length ? sourcingProducts.value : matchedContent?.trendProducts || []
  }
})

const textMenuItems = [
  { key: 'workspace', label: '工作台' },
  { key: 'text-generate', label: '文本生成' },
  { key: 'model-pricing', label: '模型价格' },
  { key: 'prompt-library', label: '提示词库' }
]

const videoMenuItems = [
  { key: 'workspace', label: '工作台' },
  { key: 'video-generate', label: '视频生成' },
  { key: 'model-pricing', label: '模型价格' },
  { key: 'prompt-library', label: '提示词库' }
]

const textOverviewCards = [
  { title: '文本工作流', description: '围绕商品标题、详情说明和平台规则一次生成整组文本结果。', tags: ['文本生成', '平台规则', '草稿联动'] },
  { title: '选品联动', description: '可直接接收选品页的一键编辑与一键生成预填内容，减少重复录入。', tags: ['选品联动', '一键生成', '工作台'] },
  { title: '批量导出', description: '文本结果支持单独批量使用、复制与后续导出，不依赖其他模块才能使用。', tags: ['批量任务', '结果导出'] }
]

const videoOverviewCards = [
  { title: '视频工作流', description: '围绕单个视频方案输出，一条视频结果就是一组，适合直接沉淀到草稿。', tags: ['视频生成', '镜头脚本', '草稿联动'] },
  { title: '选品联动', description: '支持从选品页直接带入商品标题与商品图，省去复制标题和重复上传素材。', tags: ['图生视频', '文生视频', '工作台'] },
  { title: '价格与模板', description: '模型价格和提示词库延续统一卡片结构，但内容表达会更贴近视频业务。', tags: ['模型价格', '提示词库'] }
]

const textParameterSections = {
  'text-generate': {
    description: '文本生成保持和生图一致的板式，只保留任务名称、模型、平台格式、批次、字数、提示词和图片上传这些关键字段。',
    groups: [
      {
        title: '文本生成工作区',
        copy: '像生图一样把本轮任务参数集中在一个工作区里。先确定任务名称、模型、平台、批次和字数，再输入提示词或直接套用提示词库模板。',
        fields: [
          { key: 'text_task_name', label: '任务名称', placeholder: '例如：2026-05-28-01', value: '', layout: 'half' },
          { key: 'text_model', label: '文本模型', type: 'select', options: textModelOptions, value: 'GLM-4.7-Flash', layout: 'half' },
          { key: 'text_platform_format', label: '选择平台格式', type: 'select', options: ['TEMU', 'SHEIN', '虾皮', '亚马逊', '速卖通', 'TikTok', '淘宝', '抖音', '小红书', '拼多多'], value: 'TEMU', layout: 'half' },
          { key: 'text_language', label: '语言', type: 'select', options: ['中文', '英文', '西班牙语', '葡萄牙语', '法语', '德语', '意大利语', '日语', '韩语', '泰语', '越南语', '印尼语', '马来语', '阿拉伯语', '俄语', '土耳其语', '荷兰语', '波兰语', '捷克语', '罗马尼亚语', '匈牙利语', '希腊语', '希伯来语', '印地语', '孟加拉语', '乌尔都语', '泰米尔语', '菲律宾语', '乌克兰语'], value: '中文', layout: 'half' },
          { key: 'text_batch_count', label: '批次', type: 'number', placeholder: '例如 3', value: 3, hint: '每一组会同时产出 1 条标题和 1 条详情。', layout: 'half' },
          { key: 'text_length_limit', label: '字数', placeholder: '例如：标题 24-30 字；详情 80-140 字', value: '标题 24-30 字；详情 80-140 字', layout: 'half' },
          { key: 'text_product_name', label: '商品名称', placeholder: '输入商品名称', value: '', layout: 'half' },
          {
            key: 'text_prompt_input',
            label: '提示词输入',
            type: 'textarea',
            rows: 8,
            placeholder: '输入商品标题、卖点、场景、人群、结构要求等，或直接套用提示词库模板。',
            value: '围绕商品标题、卖点、适用场景和目标平台，生成适合电商上架的新标题和详情文案。标题更适合搜索与点击，详情更适合直接进入草稿。',
            templateEnabled: true,
            layout: 'full'
          },
          { key: 'text_reference_image', label: '图片上传', type: 'asset', buttonLabel: '上传图片', value: null, layout: 'full' }
        ]
      }
    ]
  }
}

const videoParameterSections = {
  'video-generate': {
    description: '视频生成保持和生图一致的板式，只保留业务真正需要的关键参数，让视频工作台更直接。',
    groups: [
      {
        title: '视频生成工作区',
        copy: '像生图一样把视频任务参数收进一个工作区里。先确定模型、生成方式、平台和成片规格，再输入脚本提示词或直接套用提示词库模板。',
        fields: [
          { key: 'video_task_name', label: '任务名称', placeholder: '例如：2026-05-28-01', value: '', layout: 'half' },
          { key: 'video_model', label: '视频模型', type: 'select', options: ['sora-2', 'sora-2-pro'], value: 'sora-2', layout: 'half' },
          { key: 'video_operation', label: '生成方式', type: 'select', options: ['文生视频', '图生视频'], value: '文生视频', layout: 'half' },
          { key: 'video_platform', label: '选择平台格式', type: 'select', options: ['TEMU', 'SHEIN', '虾皮', '亚马逊', '速卖通', 'TikTok', '抖音', '小红书'], value: 'TikTok', layout: 'half' },
          { key: 'video_batch_count', label: '批次', type: 'number', placeholder: '例如 2', value: 1, hint: '每个批次会生成一条视频结果。', layout: 'half' },
          { key: 'video_duration', label: '视频时长', type: 'select', options: ['4 秒', '8 秒', '12 秒'], value: '8 秒', layout: 'half' },
          { key: 'video_aspect_ratio', label: '视频比例', type: 'select', options: ['9:16', '16:9'], value: '9:16', layout: 'half' },
          { key: 'video_size', label: '清晰规格', type: 'select', options: ['small', 'large'], value: 'large', layout: 'half' },
          { key: 'video_output_goal', label: '本轮目标', type: 'select', options: ['商品转化', '详情视频位', '种草引流', '起量测试'], value: '商品转化', layout: 'half' },
          { key: 'video_product_name', label: '商品名称', placeholder: '输入商品名称', value: '', layout: 'half' },
          {
            key: 'video_prompt_input',
            label: '提示词输入',
            type: 'textarea',
            rows: 8,
            placeholder: '输入镜头思路、卖点、场景、节奏要求等，或直接套用提示词库模板。',
            value: '',
            templateEnabled: true,
            layout: 'full'
          },
          { key: 'video_reference_image', label: '图片上传', type: 'asset', buttonLabel: '上传图片', value: null, layout: 'full' },
          { key: 'video_cover_title', label: '封面标题方向', placeholder: '例如：三秒装好，台面立刻清爽', value: '', layout: 'half' },
          { key: 'video_private_output', label: '私密输出', type: 'select', options: ['是', '否'], value: '是', layout: 'half' },
          { key: 'video_watermark_mode', label: '去水印模式', type: 'select', options: ['强制无水印', '自动兜底'], value: '强制无水印', layout: 'half' },
          { key: 'video_length_note', label: '补充说明', placeholder: '例如：镜头切换不要过杂，先结果感后过程', value: '', layout: 'half' }
        ]
      }
    ]
  }
}

const initialTextResultSections = {
  'text-generate': {
    description: '效果展示保持与生图一致的结果区结构，每一组同时包含 1 条标题和 1 条详情，可直接发送到草稿。',
    groups: [
      {
        id: 'text-1',
        title: '文本组 01',
        subtitle: '标题 + 详情',
        outputTitle: '免打孔旋转纸巾架，厨房台面立刻清爽一半',
        summary: '免打孔安装，抽取顺手，防潮防油烟，转角也能充分利用，让厨房纸巾真正回到顺手的位置。',
        detail: '适用方向：标题点击 + 详情承接，可直接送入草稿。',
        metadata: [
          { label: '平台', value: 'TEMU' },
          { label: '类型', value: '标题 + 详情' }
        ],
        tags: ['文本', '标题', '描述'],
        draftPayload: {
          draftType: 'listing_bundle',
          productName: '免打孔旋转纸巾架',
          targetPlatform: 'TEMU',
          contentType: '标题 / 描述',
          listingTitle: '免打孔旋转纸巾架，厨房台面立刻清爽一半',
          listingDescription: '免打孔安装，抽取顺手，防潮防油烟，转角也能充分利用，让厨房纸巾真正回到顺手的位置。',
          sellingPoint: '结果感强，适合点击率测试和详情承接',
          nextAction: '进入草稿后可继续联动套图和视频'
        }
      },
      {
        id: 'text-2',
        title: '文本组 02',
        subtitle: '标题 + 详情',
        outputTitle: '不占台面不伤墙，宿舍厨房都能挂的旋转纸巾架',
        summary: '厨房、宿舍、浴室都能快速上墙，整洁不占地，抽纸时不用再一手扶盒一手抽纸。',
        detail: '适用方向：多场景铺开，适合图文详情和短视频文案承接。',
        metadata: [
          { label: '平台', value: 'TikTok' },
          { label: '类型', value: '标题 + 详情' }
        ],
        tags: ['文本', '场景化', '转化'],
        draftPayload: {
          draftType: 'listing_bundle',
          productName: '免打孔旋转纸巾架',
          targetPlatform: 'TikTok',
          contentType: '标题 / 描述',
          listingTitle: '不占台面不伤墙，宿舍厨房都能挂的旋转纸巾架',
          listingDescription: '厨房、宿舍、浴室都能快速上墙，整洁不占地，抽纸时不用再一手扶盒一手抽纸。',
          sellingPoint: '双场景覆盖，适合详情页、商品卡和短视频承接',
          nextAction: '进入草稿后可继续关联详情图和视频'
        }
      }
    ]
  }
}

function createPreview(title, accent) {
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="640" height="360" viewBox="0 0 640 360">
      <defs>
        <linearGradient id="bg" x1="0%" x2="100%" y1="0%" y2="100%">
          <stop offset="0%" stop-color="#18122b" />
          <stop offset="100%" stop-color="${accent}" />
        </linearGradient>
      </defs>
      <rect width="640" height="360" rx="28" fill="url(#bg)" />
      <rect x="34" y="34" width="240" height="292" rx="22" fill="rgba(255,255,255,0.08)" />
      <rect x="308" y="52" width="250" height="16" rx="8" fill="rgba(255,255,255,0.72)" />
      <rect x="308" y="88" width="198" height="12" rx="6" fill="rgba(255,255,255,0.34)" />
      <rect x="308" y="122" width="280" height="98" rx="18" fill="rgba(255,255,255,0.1)" />
      <rect x="308" y="240" width="140" height="40" rx="20" fill="rgba(255,255,255,0.82)" />
      <text x="308" y="316" fill="white" font-size="28" font-family="Segoe UI, PingFang SC, sans-serif">${title}</text>
    </svg>
  `

  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`
}

const initialVideoResultSections = {
  'video-generate': {
    description: '效果展示保持与生图一致的结果区结构，单个视频就是一组。',
    groups: [
      {
        id: 'video-1',
        title: '视频组 01',
        subtitle: '单视频结果',
        outputTitle: '30 秒转化短视频',
        summary: '先展示台面凌乱，再演示安装，最后展示抽取和收纳效果，节奏清晰。',
        detail: '适用方向：抖音短视频 / 商品橱窗内容 / 详情页视频位',
        metadata: [
          { label: '平台', value: '抖音' },
          { label: '时长', value: '30 秒' }
        ],
        tags: ['视频', '转化', '安装演示'],
        preview: createPreview('视频方案 01', '#f97316'),
        draftPayload: {
          draftType: 'listing_video',
          productName: '免打孔旋转纸巾架',
          targetPlatform: '抖音',
          contentType: '视频',
          videoTheme: '30 秒转化短视频',
          coverDirection: '台面整洁前后对比',
          sellingPoint: '安装快、结果明显、镜头转化路径清晰',
          nextAction: '进入草稿后可继续绑定封面和标题'
        }
      },
      {
        id: 'video-2',
        title: '视频组 02',
        subtitle: '单视频结果',
        outputTitle: '场景型种草短视频',
        summary: '突出宿舍与厨房双场景切换，强化“不占地、不伤墙、顺手抽取”的体验感。',
        detail: '适用方向：小红书 / 场景种草 / 多平台分发',
        metadata: [
          { label: '平台', value: '小红书' },
          { label: '时长', value: '20 秒' }
        ],
        tags: ['视频', '种草', '双场景'],
        preview: createPreview('视频方案 02', '#22c55e'),
        draftPayload: {
          draftType: 'listing_video',
          productName: '免打孔旋转纸巾架',
          targetPlatform: '小红书',
          contentType: '视频',
          videoTheme: '双场景种草短视频',
          coverDirection: '宿舍 / 厨房切换感',
          sellingPoint: '更适合种草与生活化内容',
          nextAction: '进入草稿后可继续补口播和配图'
        }
      }
    ]
  }
}

const textResultSections = ref(cloneResultSections(initialTextResultSections))
const videoResultSections = ref(cloneResultSections(initialVideoResultSections))

const textQueueCards = [
  { title: '草稿联动', description: '文本生成的每一组结果都可以直接发送到草稿。' },
  { title: '独立使用', description: '文本工作台支持单独批量生成和结果导出，不依赖生图或视频模块。' },
  { title: '上架承接', description: '草稿页会按上架链接逻辑继续承接文本、套图和视频。' }
]

const videoQueueCards = [
  { title: '草稿联动', description: '视频生成的每一组结果都可以直接发送到草稿，便于和标题、套图合并管理。' },
  { title: '后续细化', description: '镜头、封面、口播规则后续继续展开，这一版先把核心工作流收紧。' },
  { title: '跨页协同', description: '后续可以继续把文本页标题与描述自动带入视频页，形成完整内容链路。' }
]

const TEXT_MODEL_NAME = 'GLM-4.7-Flash'

function createDailyTaskName() {
  const dateKey = getTodayCacheDate()
  if (dailyTaskNameDate !== dateKey) {
    dailyTaskNameDate = dateKey
    dailyTaskNameCounter = 0
  }

  dailyTaskNameCounter += 1
  return `${dateKey}-${String(dailyTaskNameCounter).padStart(2, '0')}`
}

function resolveTaskName(value = '') {
  const normalizedValue = String(value || '').trim()
  return normalizedValue || createDailyTaskName()
}
const textSubmitStates = reactive({
  'text-generate': false
})
const textStatusStates = reactive({
  'text-generate': createTextStatusState({
    tone: 'info',
    title: '文本模型待命',
    badge: '未检测',
    message: '正在准备 GLM-4.7-Flash 文本能力。',
    detail: '当前模型：GLM-4.7-Flash'
  })
})

function cloneResultSections(sectionMap = {}) {
  return JSON.parse(JSON.stringify(sectionMap))
}

function createTextStatusState({
  tone = 'info',
  title = '',
  badge = '',
  message = '',
  detail = ''
} = {}) {
  return {
    tone,
    title,
    badge,
    message,
    detail
  }
}

function createVideoStatusState({
  tone = 'info',
  title = '',
  badge = '',
  message = '',
  detail = ''
} = {}) {
  return {
    tone,
    title,
    badge,
    message,
    detail
  }
}

function applyTextStatusState(statusState = {}) {
  textStatusStates['text-generate'] = {
    ...createTextStatusState(statusState)
  }
}

function buildReadyTextStatusState() {
  return createTextStatusState({
    tone: 'info',
    title: '文本模型待命',
    badge: '已连接',
    message: 'GLM-4.7-Flash 文本能力已就绪，可直接生成标题和描述。',
    detail: '当前模型：GLM-4.7-Flash'
  })
}

function buildMissingTextKeyStatusState() {
  return createTextStatusState({
    tone: 'warning',
    title: '缺少 GLM API-Key',
    badge: '待配置',
    message: '请先在工作台服务配置中保存你的 GLM API-Key，再发起文本任务。',
    detail: '当前模型：GLM-4.7-Flash'
  })
}

function syncAdminStatusState(status = {}) {
  adminStatusState.passwordConfigured = Boolean(status?.passwordConfigured)
  adminStatusState.imageApiConfigured = Boolean(status?.imageApiConfigured)
  adminStatusState.videoApiConfigured = Boolean(status?.videoApiConfigured)
  videoAdminConfigState.configured = adminStatusState.videoApiConfigured
}

function buildSuccessTextStatusState(groupCount) {
  return createTextStatusState({
    tone: 'success',
    title: '文本生成完成',
    badge: '成功',
    message: '本次已生成 ' + groupCount + ' 组文本结果，可以继续发送到草稿。',
    detail: '结果已同步到文本结果区'
  })
}

function classifyTextStatusState(error) {
  const errorMessage = String(error?.message || '').trim()
  const normalizedMessage = errorMessage.toLowerCase()

  if (!errorMessage) {
    return createTextStatusState({
      tone: 'error',
      title: '文本生成失败',
      badge: '异常',
      message: '未获取到明确报错信息，请稍后重试。',
      detail: '请检查 GLM 服务状态'
    })
  }

  if (normalizedMessage.includes('api-key') || normalizedMessage.includes('api key') || normalizedMessage.includes('glm')) {
    return buildMissingTextKeyStatusState()
  }

  if (normalizedMessage.includes('timeout') || normalizedMessage.includes('超时')) {
    return createTextStatusState({
      tone: 'error',
      title: '文本任务超时',
      badge: '超时',
      message: '等待文本结果时间过长，建议稍后重新提交。',
      detail: errorMessage
    })
  }

  return createTextStatusState({
    tone: 'error',
    title: '文本生成异常',
    badge: '失败',
    message: '文本任务执行未成功，请检查当前参数或稍后重试。',
    detail: errorMessage
  })
}

function applyVideoStatusState(statusState = {}) {
  videoStatusStates['video-generate'] = {
    ...createVideoStatusState(statusState)
  }
}

function buildReadyVideoStatusState() {
  return createVideoStatusState({
    tone: 'info',
    title: 'Sora 视频模型待命',
    badge: '已连接',
    message: '视频能力已经就绪，填写任务参数后即可开始生成。',
    detail: '当前默认模型：sora-2'
  })
}

function buildMissingVideoKeyStatusState() {
  return createVideoStatusState({
    tone: 'warning',
    title: '缺少视频 API-Key',
    badge: '待配置',
    message: '请先在管理员配置中保存视频 API-Key，然后再发起 Sora 视频任务。',
    detail: '当前默认模型：sora-2'
  })
}

function buildSuccessVideoStatusState(groupCount) {
  return createVideoStatusState({
    tone: 'success',
    title: '视频生成完成',
    badge: '成功',
    message: '本次已生成 ' + groupCount + ' 组视频结果，可以继续发送到草稿。',
    detail: '结果已同步到 Sora 视频结果区'
  })
}

function classifyVideoStatusState(error) {
  const errorMessage = String(error?.message || '').trim()
  const normalizedMessage = errorMessage.toLowerCase()

  if (!errorMessage) {
    return createVideoStatusState({
      tone: 'error',
      title: '视频生成失败',
      badge: '异常',
      message: '未获取到明确报错信息，请稍后重试。',
      detail: '请检查 Sora 视频服务状态'
    })
  }

  if (normalizedMessage.includes('api-key') || normalizedMessage.includes('api key') || errorMessage.includes('视频 API-Key')) {
    return buildMissingVideoKeyStatusState()
  }

  if (normalizedMessage.includes('负载已饱和') || normalizedMessage.includes('稍后再试') || normalizedMessage.includes('temporarily unavailable') || normalizedMessage.includes('rate limit')) {
    return createVideoStatusState({
      tone: 'warning',
      title: '视频通道繁忙',
      badge: '拥堵',
      message: '当前上游视频通道负载较高，任务已发出但暂时无法稳定受理，建议稍后重试。',
      detail: errorMessage
    })
  }

  if (normalizedMessage.includes('timeout') || normalizedMessage.includes('超时')) {
    return createVideoStatusState({
      tone: 'error',
      title: '视频任务超时',
      badge: '超时',
      message: '等待视频结果时间过长，建议稍后重新提交。',
      detail: errorMessage
    })
  }

  if (
    normalizedMessage.includes('distributor') ||
    normalizedMessage.includes('无可用渠道') ||
    normalizedMessage.includes('不可用渠道') ||
    normalizedMessage.includes('no available channel')
  ) {
    return createVideoStatusState({
      tone: 'warning',
      title: '视频通道暂不可用',
      badge: '渠道受限',
      message: '当前上游分组没有为这个模型分发可用视频通道。系统已自动尝试稳定候选模型，若仍失败，需要等待上游恢复或更换可用分组。',
      detail: errorMessage
    })
  }

  if (normalizedMessage.includes('图片') || normalizedMessage.includes('image')) {
    return createVideoStatusState({
      tone: 'warning',
      title: '图生视频参数不完整',
      badge: '待补充',
      message: '当前任务选择了图生视频，请补充可访问的图片 URL 后再提交。',
      detail: errorMessage
    })
  }

  if (normalizedMessage.includes('时长') || normalizedMessage.includes('duration')) {
    return createVideoStatusState({
      tone: 'warning',
      title: '视频时长不支持',
      badge: '参数限制',
      message: '当前 Sora 通道请使用 4 秒、8 秒或 12 秒；系统也会在旧配置残留 10 秒时自动纠偏。',
      detail: errorMessage
    })
  }

  return createVideoStatusState({
    tone: 'error',
    title: '视频生成异常',
    badge: '失败',
    message: '视频任务执行未成功，请检查当前参数或稍后重试。',
    detail: errorMessage
  })
}

function buildTextGenerationDraft(formState = {}) {
  return {
    mode: 'text-generate',
    model: formState.text_model || TEXT_MODEL_NAME,
    quantity: normalizeTextCount(formState.text_batch_count, 3),
    copyMode: formState.text_reference_image ? 'image-reference' : 'text-only',
    referenceImages: formState.text_reference_image ? [formState.text_reference_image] : [],
    prompt: buildTextPrompt({
      ...formState,
      text_task_name: resolveTaskName(formState.text_task_name)
    })
  }
}

function normalizeTextCount(value, fallback = 8) {
  const numericValue = Number(value)
  if (!Number.isFinite(numericValue) || numericValue <= 0) {
    return fallback
  }

  return Math.max(1, Math.min(50, Math.round(numericValue)))
}

function normalizeVideoCount(value, fallback = 1) {
  const numericValue = Number(value)
  if (!Number.isFinite(numericValue) || numericValue <= 0) {
    return fallback
  }

  return Math.max(1, Math.min(12, Math.round(numericValue)))
}

function buildTextPrompt(formState = {}) {
  return [
    `任务名称：${formState.text_task_name || ''}`,
    `文本模型：${formState.text_model || TEXT_MODEL_NAME}`,
    `平台格式：${formState.text_platform_format || ''}`,
    `输出语言：${formState.text_language || '中文'}`,
    `商品名称：${formState.text_product_name || ''}`,
    `批次：${normalizeTextCount(formState.text_batch_count, 3)}`,
    `字数要求：${formState.text_length_limit || ''}`,
    formState.text_reference_image ? '已上传参考商品图，请保证图文一致。' : '',
    `核心提示词：${formState.text_prompt_input || ''}`,
    '请按批次输出多组电商文本结果。',
    '每一组都必须同时包含：1. 商品标题；2. 商品详情。',
    `所有输出内容必须使用${formState.text_language || '中文'}。`,
    '标题要更适合搜索与点击，详情要更适合详情页与草稿承接。',
    '不要输出解释，不要编号，不要输出多余前缀。',
    '每组结果请先写标题，再换行写详情。'
  ].filter(Boolean).join('\n')
}

function padGroupIndex(index = 0) {
  return String(index + 1).padStart(2, '0')
}

function createLocalAssetFromFile(file = {}) {
  if (!file?.name) {
    return null
  }

  return {
    id: `asset-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    name: file.name,
    path: file.path || '',
    size: Number(file.size) || 0,
    sizeLabel: `${Math.max(1, Math.round((Number(file.size) || 0) / 1024))} KB`,
    preview: file.preview || '',
    storedPath: file.path || ''
  }
}

function buildSourcingTextFormState(sourceItem = {}, mode = 'edit') {
  const workflowConfig = getActiveSourcingWorkflowConfig(mode)
  const textConfig = workflowConfig.text || {}
  const sourceContext = createWorkflowSourceContext(sourceItem)
  const sourceSummary = [sourceItem.title, sourceItem.summary]
    .map((item) => String(item || '').trim())
    .filter(Boolean)
    .join('\n')

  return {
    text_task_name: createDailyTaskName(),
    text_model: TEXT_MODEL_NAME,
    text_platform_format: sourceItem.platform || 'TEMU',
    text_language: '中文',
    text_batch_count: normalizeTextCount(textConfig.batchCount, 3),
    text_length_limit: textConfig.lengthLimit || '标题 24-30 字；详情 80-140 字',
    text_product_name: sourceItem.title || '',
    text_prompt_input: textConfig.promptInput
      ? `${textConfig.promptInput}\n${sourceSummary}`.trim()
      : sourceSummary,
    text_reference_image: null,
    workflowGroupId: sourceContext.workflowGroupId,
    sourcePlatform: sourceContext.sourcePlatform,
    sourceProductId: sourceContext.sourceProductId,
    sourceScene: sourceContext.sourceScene,
    sourceMetadata: sourceContext.sourceMetadata
  }
}

function createDefaultVideoCreditMessages() {
  return {
    title: '视频消费记录',
    helperText: '展示当前视频通道的余额相关消费记录。',
    items: []
  }
}

function formatUsdAmount(value = 0) {
  const numeric = Number(value || 0)
  if (!Number.isFinite(numeric)) {
    return '$0.00'
  }
  return `$${numeric.toFixed(2)}`
}

function formatAccessUntilLabel(value = 0) {
  const seconds = Number(value || 0)
  if (!Number.isFinite(seconds) || seconds <= 0) {
    return '--'
  }

  const date = new Date(seconds * 1000)
  if (Number.isNaN(date.getTime())) {
    return '--'
  }

  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function applyVideoBillingSummary(summary = {}) {
  if (summary?.unsupported) {
    videoCreditOverview.value = {
      title: '视频余额仪表盘',
      items: [
        { label: '当前余额', value: '--' },
        { label: '总额度', value: '--' },
        { label: '今日用量', value: '--' },
        { label: '访问有效期', value: '--' },
        { label: '当前令牌', value: '--' },
        { label: '余额状态', value: '待接入' }
      ]
    }

    videoCreditMessages.value = {
      title: '视频消费记录',
      helperText: summary?.message || '当前视频通道尚未接入准确余额查询接口。',
      items: []
    }
    return
  }

  const totalBalanceUsd = Number(summary?.totalBalanceUsd || 0)
  const usageUsd = Number(summary?.usageUsd || 0)
  const remainingBalanceUsd = Number(summary?.remainingBalanceUsd || 0)
  const tokenName = String(summary?.tokenName || '').trim()
  const accessUntilLabel = formatAccessUntilLabel(summary?.accessUntil || 0)
  const logs = Array.isArray(summary?.logs) ? summary.logs : []

  videoCreditOverview.value = {
    title: '视频余额仪表盘',
    items: [
      { label: '当前余额', value: formatUsdAmount(remainingBalanceUsd) },
      { label: '总额度', value: formatUsdAmount(totalBalanceUsd) },
      { label: '今日用量', value: formatUsdAmount(usageUsd) },
      { label: '访问有效期', value: accessUntilLabel },
      { label: '当前令牌', value: tokenName || '--' },
      { label: '余额状态', value: remainingBalanceUsd > 0 ? '可用' : '待充值 / 已耗尽' }
    ]
  }

  videoCreditMessages.value = {
    title: '视频消费记录',
    helperText: '展示当前视频通道的余额相关消费记录。',
    items: logs.map((item, index) => ({
      id: item.id || `video-billing-${index + 1}`,
      label: item.model || item.type || '视频消费',
      description: item.status || '视频通道消费记录',
      amountDisplay: formatUsdAmount(item.amount || 0),
      createdAt: item.createdAtLabel || '--'
    }))
  }
}

function buildSourcingVideoFormState(sourceItem = {}) {
  return buildSourcingVideoFormStateV2(sourceItem)
  // eslint-disable-next-line no-unreachable
  const tags = Array.isArray(sourceItem.tags) ? sourceItem.tags.join('、') : ''
  const sourceContext = createWorkflowSourceContext(sourceItem)
  return {
    video_task_name: `${sourceItem.title || '商品'}视频自动编排`,
    video_model: VIDEO_MODEL_NAME,
    video_operation: '图生视频',
    video_platform: sourceItem.platform || 'TikTok',
    video_duration: '8 秒',
    video_aspect_ratio: '9:16',
    video_product_name: sourceItem.title || '',
    video_prompt_input: [
      sourceItem.title ? `原商品标题：${sourceItem.title}` : '',
      sourceItem.summary ? `商品卖点：${sourceItem.summary}` : '',
      tags ? `场景/类目：${tags}` : '',
      sourceItem.assetDirection ? `素材方向：${sourceItem.assetDirection}` : '',
      '请生成适合电商转化的视频。'
    ].filter(Boolean).join('\n'),
    video_reference_image: null,
    video_output_goal: '商品转化',
    video_cover_title: sourceItem.title || '',
    video_length_note: '默认有声，先结果感后过程，镜头切换不要过杂。',
    workflowGroupId: sourceContext.workflowGroupId,
    sourcePlatform: sourceContext.sourcePlatform,
    sourceProductId: sourceContext.sourceProductId,
    sourceScene: sourceContext.sourceScene,
    sourceMetadata: sourceContext.sourceMetadata
  }
}

function buildSourcingVideoFormStateV2(sourceItem = {}, mode = 'edit') {
  const workflowConfig = getActiveSourcingWorkflowConfig(mode)
  const videoConfig = workflowConfig.video || {}
  const sourceContext = createWorkflowSourceContext(sourceItem)
  return {
    video_task_name: createDailyTaskName(),
    video_model: VIDEO_MODEL_NAME,
    video_operation: videoConfig.operation === 'image'
      ? '图生视频'
      : videoConfig.operation === 'text'
        ? '文生视频'
        : (sourceItem.preview ? '图生视频' : '文生视频'),
    video_platform: sourceItem.platform || 'TikTok',
    video_duration: videoConfig.duration || '8 秒',
    video_aspect_ratio: videoConfig.aspectRatio || '9:16',
    video_size: videoConfig.size || 'large',
    video_product_name: '',
    video_prompt_input: videoConfig.promptInput || '',
    video_reference_image: null,
    video_output_goal: '商品转化',
    video_cover_title: '',
    video_length_note: '',
    video_private_output: '是',
    video_watermark_mode: '强制无水印',
    workflowGroupId: sourceContext.workflowGroupId,
    sourcePlatform: sourceContext.sourcePlatform,
    sourceProductId: sourceContext.sourceProductId,
    sourceScene: sourceContext.sourceScene,
    sourceMetadata: sourceContext.sourceMetadata
  }
}

function buildSourcingVideoFormStateForGenerationV2(sourceItem = {}, sourceImage = null) {
  const workflowConfig = getActiveSourcingWorkflowConfig('generate')
  const videoConfig = workflowConfig.video || {}
  const baseState = buildSourcingVideoFormStateV2(sourceItem, 'generate')
  if (sourceImage?.storedPath || sourceImage?.path) {
    return {
      ...baseState,
      video_operation: videoConfig.operation === 'text' ? '文生视频' : '图生视频',
      video_duration: videoConfig.duration || baseState.video_duration,
      video_aspect_ratio: videoConfig.aspectRatio || baseState.video_aspect_ratio,
      video_size: videoConfig.size || baseState.video_size,
      video_prompt_input: videoConfig.promptInput || baseState.video_prompt_input,
      video_reference_image: sourceImage
    }
  }

  return {
    ...baseState,
    video_operation: '文生视频',
    video_duration: videoConfig.duration || baseState.video_duration,
    video_aspect_ratio: videoConfig.aspectRatio || baseState.video_aspect_ratio,
    video_size: videoConfig.size || baseState.video_size,
    video_prompt_input: videoConfig.promptInput || baseState.video_prompt_input,
    video_reference_image: null,
    video_length_note: [
      baseState.video_length_note || '',
      '当前未取到商品图，已自动降级为文生视频。'
    ].filter(Boolean).join(' ')
  }
}

function createDefaultActivationState() {
  return {
    status: 'loading',
    product: 'QiuAi-ECMS',
    licenseId: '',
    customerId: '',
    customerName: '',
    edition: '',
    deviceCode: '',
    activatedAt: '',
    expireAt: '',
    maxVersion: '',
    modules: [],
    features: [],
    remark: '',
    licenseFilePath: '',
    message: '正在校验授权状态'
  }
}

const moduleKeyByPage = {
  hot: 'sourcing',
  text: 'text',
  image: 'image',
  video: 'video',
  draft: 'draft',
  publish: 'listing'
}

function normalizeLicenseModules(modules = []) {
  return Array.isArray(modules)
    ? modules.map((item) => String(item || '').trim()).filter(Boolean)
    : []
}

function hasModuleAccess(moduleKey = '') {
  const normalizedModuleKey = String(moduleKey || '').trim()
  if (!normalizedModuleKey) {
    return true
  }

  const activationModules = normalizeLicenseModules(activationState.value?.modules)
  if (!activationModules.length) {
    return true
  }

  return activationModules.includes(normalizedModuleKey)
}

async function initializeAuthorizedWorkspaceData() {
  const [, prompts, negativePrompts, snapshot] = await Promise.all([
    initializeTextStatusState(),
    listPromptTemplates().catch(() => []),
    listNegativePromptTemplates().catch(() => []),
    getStudioSnapshot().catch(() => null)
  ])

  promptTemplates.value = Array.isArray(prompts) ? prompts : []
  negativePromptTemplates.value = Array.isArray(negativePrompts) ? negativePrompts : []

  if (snapshot?.hostInfo) {
    sharedHostInfo.value = normalizeHostInfo(snapshot.hostInfo)
  }

  if (snapshot?.workspaceDashboard?.creditOverview) {
    sharedCreditOverview.value = snapshot.workspaceDashboard.creditOverview
  }

  if (snapshot?.workspaceDashboard?.creditMessages) {
    sharedCreditMessages.value = snapshot.workspaceDashboard.creditMessages
  }

  if (snapshot?.workspaceDashboard?.networkMonitor) {
    sharedNetworkMonitor.value = snapshot.workspaceDashboard.networkMonitor
  }

  if (snapshot?.videoWorkspaceDashboard?.creditOverview) {
    videoCreditOverview.value = snapshot.videoWorkspaceDashboard.creditOverview
  }

  if (snapshot?.videoWorkspaceDashboard?.creditMessages) {
    videoCreditMessages.value = snapshot.videoWorkspaceDashboard.creditMessages
  }

  if (snapshot?.videoWorkspaceDashboard?.networkMonitor) {
    videoNetworkMonitor.value = snapshot.videoWorkspaceDashboard.networkMonitor
  }

  await handleRefreshVideoRemainingCredits({
    silent: true
  }).catch(() => {})

  await ensureSourcingProductsReady({
    platformKey: activeSourcingPlatform.value,
    sceneKey: activeSourcingScene.value
  }).then(() => {
    if (!hasScheduledSourcingPrefetch) {
      hasScheduledSourcingPrefetch = true
      prefetchSourcingPlatformScenes(activeSourcingPlatform.value, activeSourcingScene.value).catch(() => {})
    }
  }).catch(() => {})
}

function buildSourcingSourceMetadata(sourceItem = {}) {
  const workflowGroupId = createWorkflowGroupIdFromSourceItem(sourceItem)
  return {
    platform: sourceItem.platform || '',
    scene: activeSourcingScene.value || '',
    sourceUrl: sourceItem.sourceUrl || '',
    sourceProductId: sourceItem.id || '',
    totalSold: sourceItem.searchHeat || '',
    imageUrl: sourceItem.preview || '',
    workflowGroupId
  }
}

function createWorkflowGroupIdFromSourceItem(sourceItem = {}) {
  const platform = String(sourceItem.platform || '').trim().toLowerCase()
  const sourceProductId = String(sourceItem.id || '').trim()
  const scene = String(activeSourcingScene.value || '').trim().toLowerCase()
  if (platform && sourceProductId) {
    return `sourcing:${platform}:${sourceProductId}`
  }

  const title = String(sourceItem.title || '').trim().toLowerCase()
  const preview = String(sourceItem.preview || '').trim()
  return `sourcing:${platform || 'unknown'}:${sourceProductId || title || preview || Date.now()}:${scene || 'hot'}`
}

function createWorkflowSourceContext(sourceItem = {}) {
  const sourceMetadata = buildSourcingSourceMetadata(sourceItem)
  return {
    workflowGroupId: sourceMetadata.workflowGroupId || '',
    sourceProductId: sourceMetadata.sourceProductId || '',
    sourcePlatform: sourceMetadata.platform || '',
    sourceScene: sourceMetadata.scene || '',
    sourceMetadata
  }
}

function getNormalizedDraftTimestamp() {
  return new Intl.DateTimeFormat('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false
  }).format(new Date())
}

function resolveDraftDisplayTitle(item = {}) {
  return item?.draftPayload?.productName || item?.draftPayload?.listingTitle || item?.title || '未命名草稿'
}

function resolveDraftWorkflowKey(payload = {}) {
  const draftPayload = payload?.draftPayload && typeof payload.draftPayload === 'object'
    ? payload.draftPayload
    : {}
  const sourceMetadata = payload?.sourceMetadata && typeof payload.sourceMetadata === 'object'
    ? payload.sourceMetadata
    : (draftPayload.sourceMetadata && typeof draftPayload.sourceMetadata === 'object' ? draftPayload.sourceMetadata : {})

  const workflowGroupId = String(
    payload?.workflowGroupId ||
    draftPayload?.workflowGroupId ||
    sourceMetadata?.workflowGroupId ||
    ''
  ).trim()
  if (workflowGroupId) {
    return workflowGroupId
  }

  const platform = String(
    payload?.sourcePlatform ||
    draftPayload?.sourcePlatform ||
    sourceMetadata?.platform ||
    draftPayload?.targetPlatform ||
    ''
  ).trim().toLowerCase()
  const productId = String(
    payload?.sourceProductId ||
    draftPayload?.sourceProductId ||
    sourceMetadata?.sourceProductId ||
    ''
  ).trim()

  if (platform && productId) {
    return `sourcing:${platform}:${productId}`
  }

  return ''
}

function mergeUniqueStrings(baseList = [], extraList = []) {
  const next = []
  const seen = new Set()

  ;[...(Array.isArray(baseList) ? baseList : []), ...(Array.isArray(extraList) ? extraList : [])].forEach((item) => {
    const value = String(item || '').trim()
    if (!value || seen.has(value)) {
      return
    }
    seen.add(value)
    next.push(value)
  })

  return next
}

function mergeMetadataRows(baseRows = [], extraRows = []) {
  const normalized = new Map()

  ;[...(Array.isArray(baseRows) ? baseRows : []), ...(Array.isArray(extraRows) ? extraRows : [])].forEach((item) => {
    const label = String(item?.label || '').trim()
    const value = String(item?.value || '').trim()
    if (!label || !value) {
      return
    }
    normalized.set(label, { label, value })
  })

  return [...normalized.values()]
}

function mergeChecklist(baseChecklist = {}, nextChecklist = {}) {
  const merged = { ...(baseChecklist || {}) }
  Object.entries(nextChecklist || {}).forEach(([key, value]) => {
    merged[key] = Boolean(merged[key] || value)
  })
  return merged
}

function normalizeDraftAssets(assets = {}) {
  const normalizedAssets = assets && typeof assets === 'object' ? assets : {}
  return {
    textGroups: Array.isArray(normalizedAssets.textGroups) ? normalizedAssets.textGroups : [],
    imageGroups: Array.isArray(normalizedAssets.imageGroups) ? normalizedAssets.imageGroups : [],
    videoGroups: Array.isArray(normalizedAssets.videoGroups) ? normalizedAssets.videoGroups : []
  }
}

function mergeAssetEntries(baseEntries = [], incomingEntries = [], identityKeys = []) {
  const merged = [...(Array.isArray(baseEntries) ? baseEntries : [])]

  ;(Array.isArray(incomingEntries) ? incomingEntries : []).forEach((entry) => {
    if (!entry || typeof entry !== 'object') {
      return
    }

    const incomingIdentity = identityKeys.map((key) => String(entry[key] || '').trim()).join('::')
    const matchedIndex = merged.findIndex((current) => {
      const currentIdentity = identityKeys.map((key) => String(current?.[key] || '').trim()).join('::')
      return incomingIdentity && currentIdentity === incomingIdentity
    })

    if (matchedIndex >= 0) {
      merged[matchedIndex] = {
        ...merged[matchedIndex],
        ...entry
      }
      return
    }

    merged.push(entry)
  })

  return merged
}

function buildDraftAssetsFromPayload(payload = {}, normalizedDraftPayload = {}) {
  const draftPayload = normalizedDraftPayload && typeof normalizedDraftPayload === 'object'
    ? normalizedDraftPayload
    : {}
  const editor = draftPayload.editor || {}
  const textAsset = (
    draftPayload.listingTitle ||
    draftPayload.listingDescription ||
    draftPayload.sellingPoint
  )
    ? [{
        id: String(payload?.raw?.id || payload?.title || draftPayload.listingTitle || `text-${Date.now()}`).trim(),
        title: draftPayload.listingTitle || payload.title || draftPayload.productName || '文本结果',
        description: draftPayload.listingDescription || '',
        sellingPoint: draftPayload.sellingPoint || '',
        sourceModule: draftPayload.sourceModule || payload.module || payload.source || '',
        sourceMenu: draftPayload.sourceMenu || '',
        createdAt: payload.createdAt || ''
      }]
    : []
  const imageAsset = (
    payload.preview ||
    editor.coverImage ||
    editor.mainImagePlan ||
    editor.detailImagePlan
  )
    ? [{
        id: String(payload?.raw?.id || payload?.title || editor.coverImage || `image-${Date.now()}`).trim(),
        title: payload.title || draftPayload.productName || '图片结果',
        preview: payload.preview || editor.coverImage || '',
        coverImage: editor.coverImage || payload.preview || '',
        mainImagePlan: editor.mainImagePlan || '',
        detailImagePlan: editor.detailImagePlan || '',
        sourceModule: draftPayload.sourceModule || payload.module || payload.source || '',
        sourceMenu: draftPayload.sourceMenu || '',
        createdAt: payload.createdAt || ''
      }]
    : []
  const videoAsset = (
    editor.videoAssetPlan ||
    editor.videoScriptNote ||
    draftPayload.videoTheme
  )
    ? [{
        id: String(payload?.raw?.id || payload?.title || editor.videoAssetPlan || `video-${Date.now()}`).trim(),
        title: payload.title || draftPayload.productName || '视频结果',
        preview: payload.preview || editor.coverImage || '',
        videoAssetPlan: editor.videoAssetPlan || '',
        videoScriptNote: editor.videoScriptNote || '',
        videoTheme: draftPayload.videoTheme || '',
        sourceModule: draftPayload.sourceModule || payload.module || payload.source || '',
        sourceMenu: draftPayload.sourceMenu || '',
        createdAt: payload.createdAt || ''
      }]
    : []

  return {
    textGroups: textAsset,
    imageGroups: imageAsset,
    videoGroups: videoAsset
  }
}

function mergeDraftAssets(existingAssets = {}, incomingAssets = {}) {
  const normalizedExisting = normalizeDraftAssets(existingAssets)
  const normalizedIncoming = normalizeDraftAssets(incomingAssets)
  return {
    textGroups: mergeAssetEntries(normalizedExisting.textGroups, normalizedIncoming.textGroups, ['id', 'title']),
    imageGroups: mergeAssetEntries(normalizedExisting.imageGroups, normalizedIncoming.imageGroups, ['id', 'coverImage']),
    videoGroups: mergeAssetEntries(normalizedExisting.videoGroups, normalizedIncoming.videoGroups, ['id', 'videoAssetPlan'])
  }
}

function mergeMultilineField(currentValue = '', incomingValue = '') {
  const normalizedCurrent = String(currentValue || '').trim()
  const normalizedIncoming = String(incomingValue || '').trim()
  if (!normalizedIncoming) {
    return normalizedCurrent
  }
  if (!normalizedCurrent) {
    return normalizedIncoming
  }
  if (normalizedCurrent.includes(normalizedIncoming)) {
    return normalizedCurrent
  }
  return `${normalizedCurrent}\n${normalizedIncoming}`
}

function mergeDraftPayload(existingDraftPayload = {}, incomingDraftPayload = {}, fallbackPreview = '') {
  const existingEditor = existingDraftPayload?.editor || {}
  const incomingEditor = incomingDraftPayload?.editor || {}
  const existingSourceMetadata = existingDraftPayload?.sourceMetadata || {}
  const incomingSourceMetadata = incomingDraftPayload?.sourceMetadata || {}
  const mergedAssets = mergeDraftAssets(existingDraftPayload.assets, incomingDraftPayload.assets)
  const mergedCoverImage = incomingEditor.coverImage || existingEditor.coverImage || incomingSourceMetadata.imageUrl || existingSourceMetadata.imageUrl || fallbackPreview || ''
  const mergedVideoAssetPlan = mergeMultilineField(existingEditor.videoAssetPlan, incomingEditor.videoAssetPlan)
  const mergedMainImagePlan = mergeMultilineField(existingEditor.mainImagePlan, incomingEditor.mainImagePlan)
  const mergedDetailImagePlan = mergeMultilineField(existingEditor.detailImagePlan, incomingEditor.detailImagePlan)
  const mergedVideoScriptNote = mergeMultilineField(existingEditor.videoScriptNote, incomingEditor.videoScriptNote)
  const mergedRemarks = mergeMultilineField(existingEditor.remarks, incomingEditor.remarks)

  return {
    ...existingDraftPayload,
    ...incomingDraftPayload,
    draftType: existingDraftPayload.draftType || incomingDraftPayload.draftType || 'listing_bundle',
    productName: incomingDraftPayload.productName || existingDraftPayload.productName || '',
    targetPlatform: incomingDraftPayload.targetPlatform || existingDraftPayload.targetPlatform || '',
    contentType: mergeUniqueStrings(
      String(existingDraftPayload.contentType || '').split('/'),
      String(incomingDraftPayload.contentType || '').split('/')
    ).join(' / '),
    listingTitle: incomingDraftPayload.listingTitle || existingDraftPayload.listingTitle || '',
    listingDescription: incomingDraftPayload.listingDescription || existingDraftPayload.listingDescription || '',
    videoTheme: incomingDraftPayload.videoTheme || existingDraftPayload.videoTheme || '',
    coverDirection: incomingDraftPayload.coverDirection || existingDraftPayload.coverDirection || '',
    sellingPoint: incomingDraftPayload.sellingPoint || existingDraftPayload.sellingPoint || '',
    nextAction: incomingDraftPayload.nextAction || existingDraftPayload.nextAction || '',
    workflowGroupId: incomingDraftPayload.workflowGroupId || existingDraftPayload.workflowGroupId || incomingSourceMetadata.workflowGroupId || existingSourceMetadata.workflowGroupId || '',
    sourcePlatform: incomingDraftPayload.sourcePlatform || existingDraftPayload.sourcePlatform || incomingSourceMetadata.platform || existingSourceMetadata.platform || '',
    sourceProductId: incomingDraftPayload.sourceProductId || existingDraftPayload.sourceProductId || incomingSourceMetadata.sourceProductId || existingSourceMetadata.sourceProductId || '',
    sourceMetadata: {
      ...existingSourceMetadata,
      ...incomingSourceMetadata,
      workflowGroupId: incomingSourceMetadata.workflowGroupId || existingSourceMetadata.workflowGroupId || '',
      platform: incomingSourceMetadata.platform || existingSourceMetadata.platform || '',
      scene: incomingSourceMetadata.scene || existingSourceMetadata.scene || '',
      sourceUrl: incomingSourceMetadata.sourceUrl || existingSourceMetadata.sourceUrl || '',
      sourceProductId: incomingSourceMetadata.sourceProductId || existingSourceMetadata.sourceProductId || '',
      totalSold: incomingSourceMetadata.totalSold || existingSourceMetadata.totalSold || '',
      imageUrl: incomingSourceMetadata.imageUrl || existingSourceMetadata.imageUrl || mergedCoverImage
    },
    assets: mergedAssets,
    editor: {
      ...existingEditor,
      ...incomingEditor,
      categoryPath: incomingEditor.categoryPath || existingEditor.categoryPath || '',
      brandName: incomingEditor.brandName || existingEditor.brandName || '',
      storeName: incomingEditor.storeName || existingEditor.storeName || '',
      priceMin: incomingEditor.priceMin || existingEditor.priceMin || '',
      priceMax: incomingEditor.priceMax || existingEditor.priceMax || '',
      marketPrice: incomingEditor.marketPrice || existingEditor.marketPrice || '',
      skuName: incomingEditor.skuName || existingEditor.skuName || '',
      skuValue: incomingEditor.skuValue || existingEditor.skuValue || '',
      inventory: incomingEditor.inventory || existingEditor.inventory || '',
      shippingTemplate: incomingEditor.shippingTemplate || existingEditor.shippingTemplate || '',
      coverImage: mergedCoverImage,
      mainImagePlan: mergedMainImagePlan,
      detailImagePlan: mergedDetailImagePlan,
      videoAssetPlan: mergedVideoAssetPlan,
      videoScriptNote: mergedVideoScriptNote,
      publishStatus: incomingEditor.publishStatus || existingEditor.publishStatus || '待整理',
      publishWindow: incomingEditor.publishWindow || existingEditor.publishWindow || '',
      operator: incomingEditor.operator || existingEditor.operator || '',
      remarks: mergedRemarks,
      lastSyncedAt: incomingEditor.lastSyncedAt || existingEditor.lastSyncedAt || ''
    },
    checklist: mergeChecklist(existingDraftPayload.checklist || {}, incomingDraftPayload.checklist || {})
  }
}

function mergeDraftIntoExistingGroup(existingDraft = {}, payload = {}, createdAt = '') {
  const normalizedIncomingDraftPayload = createDraftEditorPayload({
    ...payload,
    sourceMetadata: payload.sourceMetadata || {}
  }, createdAt)
  normalizedIncomingDraftPayload.assets = mergeDraftAssets(
    existingDraft?.draftPayload?.assets,
    buildDraftAssetsFromPayload(
      {
        ...payload,
        createdAt
      },
      normalizedIncomingDraftPayload
    )
  )
  const mergedDraftPayload = mergeDraftPayload(existingDraft.draftPayload || {}, normalizedIncomingDraftPayload, payload.preview || existingDraft.preview || '')
  const mergedPreview = payload.preview || existingDraft.preview || mergedDraftPayload?.editor?.coverImage || ''
  const mergedRaw = {
    existing: existingDraft.raw || null,
    latest: payload.raw || null
  }

  return {
    ...existingDraft,
    createdAt,
    source: existingDraft.source || payload.source || '未知来源',
    module: payload.module || existingDraft.module || '未命名模块',
    section: payload.section || existingDraft.section || '默认分组',
    title: payload.title || existingDraft.title || mergedDraftPayload.listingTitle || '未命名草稿',
    summary: payload.summary || existingDraft.summary || mergedDraftPayload.listingDescription || '',
    preview: mergedPreview,
    tags: mergeUniqueStrings(existingDraft.tags || [], payload.tags || []),
    metadata: mergeMetadataRows(existingDraft.metadata || [], payload.metadata || []),
    draftPayload: createDraftEditorPayload({
      ...payload,
      draftPayload: mergedDraftPayload,
      preview: mergedPreview,
      sourceMetadata: mergedDraftPayload.sourceMetadata || {}
    }, createdAt),
    raw: mergedRaw
  }
}

function createStandaloneDraftFromPayload(payload = {}, createdAt = '') {
  const normalizedDraftPayload = createDraftEditorPayload({
    ...payload,
    sourceMetadata: payload.sourceMetadata || {}
  }, createdAt)
  normalizedDraftPayload.assets = buildDraftAssetsFromPayload(
    {
      ...payload,
      createdAt
    },
    normalizedDraftPayload
  )
  return {
    id: `draft-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    createdAt,
    source: payload.source || '未知来源',
    module: payload.module || '未命名模块',
    section: payload.section || '默认分组',
    title: payload.title || '未命名草稿',
    summary: payload.summary || '待补充摘要',
    preview: payload.preview || '',
    tags: Array.isArray(payload.tags) ? payload.tags : [],
    metadata: Array.isArray(payload.metadata) ? payload.metadata : [],
    draftPayload: normalizedDraftPayload,
    raw: payload.raw || null
  }
}

function upsertDraftItemByWorkflow(payload = {}, {
  targetDraftId = '',
  forceNew = false
} = {}) {
  const createdAt = getNormalizedDraftTimestamp()
  const normalizedTargetDraftId = String(targetDraftId || '').trim()
  if (normalizedTargetDraftId) {
    const targetIndex = draftItems.value.findIndex((item) => item.id === normalizedTargetDraftId)
    if (targetIndex >= 0) {
      const targetDraft = draftItems.value[targetIndex]
      const mergedDraft = mergeDraftIntoExistingGroup(targetDraft, payload, createdAt)
      draftItems.value = [
        mergedDraft,
        ...draftItems.value.filter((_item, index) => index !== targetIndex)
      ]
      return { merged: true, draft: mergedDraft, targetMode: 'selected' }
    }
  }

  if (forceNew) {
    const nextDraft = createStandaloneDraftFromPayload(payload, createdAt)
    draftItems.value = [
      nextDraft,
      ...draftItems.value
    ]
    return { merged: false, draft: nextDraft, targetMode: 'new' }
  }

  const workflowKey = resolveDraftWorkflowKey(payload)
  const existingIndex = workflowKey
    ? draftItems.value.findIndex((item) => resolveDraftWorkflowKey(item) === workflowKey)
    : -1

  if (existingIndex >= 0) {
    const existingDraft = draftItems.value[existingIndex]
    const mergedDraft = mergeDraftIntoExistingGroup(existingDraft, payload, createdAt)
    draftItems.value = [
      mergedDraft,
      ...draftItems.value.filter((_item, index) => index !== existingIndex)
    ]
    return { merged: true, draft: mergedDraft, targetMode: 'workflow' }
  }

  const nextDraft = createStandaloneDraftFromPayload(payload, createdAt)
  draftItems.value = [
    nextDraft,
    ...draftItems.value
  ]
  return { merged: false, draft: nextDraft, targetMode: 'new' }
}

function openDraftTargetDialog(payload = {}) {
  pendingDraftPayload.value = payload
  const workflowKey = resolveDraftWorkflowKey(payload)
  const matchedDraft = workflowKey
    ? draftItems.value.find((item) => resolveDraftWorkflowKey(item) === workflowKey)
    : null
  selectedDraftTargetId.value = matchedDraft?.id || '__new__'
  isDraftTargetDialogVisible.value = true
}

function closeDraftTargetDialog() {
  isDraftTargetDialogVisible.value = false
  pendingDraftPayload.value = null
  selectedDraftTargetId.value = '__new__'
}

function confirmDraftTargetSelection() {
  const payload = pendingDraftPayload.value
  if (!payload) {
    closeDraftTargetDialog()
    return
  }

  const useNewDraft = selectedDraftTargetId.value === '__new__'
  const result = upsertDraftItemByWorkflow(payload, useNewDraft
    ? { forceNew: true }
    : { targetDraftId: selectedDraftTargetId.value })

  closeDraftTargetDialog()
  showNotice(
    'success',
    result.merged ? '已更新草稿' : '已加入草稿',
    `${payload.title || '当前结果'} ${result.merged ? '已并入所选草稿。' : '已新建草稿。'}`
  )
}

// eslint-disable-next-line no-unused-vars
function buildSourcingVideoFormStateForGeneration(sourceItem = {}, sourceImage = null) {
  return buildSourcingVideoFormStateForGenerationV2(sourceItem, sourceImage)
  // eslint-disable-next-line no-unreachable
  void buildSourcingVideoFormStateForGeneration
  const baseState = buildSourcingVideoFormState(sourceItem)
  if (sourceImage?.storedPath || sourceImage?.path) {
    return {
      ...baseState,
      video_reference_image: sourceImage
    }
  }

  return {
    ...baseState,
    video_operation: '文生视频',
    video_reference_image: null,
    video_length_note: [
      baseState.video_length_note || '',
      '当前未取到商品图，已自动降级为文生视频。'
    ].filter(Boolean).join(' ')
  }
}

async function createWorkflowSourceImageFromProduct(sourceItem = {}) {
  const preview = String(sourceItem.preview || '').trim()
  if (!preview) {
    return null
  }

  try {
    const asset = preview.startsWith('data:')
      ? await createWorkflowAsset({
          fileName: sourceItem.title || 'product-reference',
          dataUrl: preview
        })
      : await createWorkflowAsset({
          fileName: sourceItem.title || 'product-reference',
          remoteUrl: preview
        })

    return {
      path: asset.path,
      storedPath: asset.path,
      name: asset.name,
      size: asset.size,
      sizeLabel: `${Math.max(1, Math.round((Number(asset.size) || 0) / 1024))} KB`,
      preview
    }
  } catch (error) {
    console.warn('Failed to create workflow source image from product preview', {
      productId: sourceItem?.id || '',
      message: error?.message || 'unknown error'
    })
    return null
  }
}

function buildImageWorkflowPayload(sourceItem = {}, sourceImage = null, mode = 'edit') {
  const workflowConfig = getActiveSourcingWorkflowConfig(mode)
  const imageConfig = workflowConfig.image || {}
  const workflowContext = createWorkflowSourceContext(sourceItem)

  return {
    token: `workflow-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    targetMenu: 'series-generate',
    taskName: createDailyTaskName(),
    globalPrompt: imageConfig.globalPrompt || '',
    promptTitles: Array.isArray(imageConfig.promptTitles) && imageConfig.promptTitles.length ? imageConfig.promptTitles : [''],
    description: '',
    assetDirection: '',
    sourceItem,
    workflowContext,
    batchCount: normalizePositiveInteger(imageConfig.batchCount, 1, 8),
    size: imageConfig.size || '1:1',
    model: 'gpt-image-2',
    sourceImage
  }
}

async function waitForStudioTaskResult(taskId = '', timeoutMs = 300000) {
  const startedAt = Date.now()

  while (Date.now() - startedAt < timeoutMs) {
    const snapshot = await getStudioSnapshot()
    const tasks = Array.isArray(snapshot?.tasks) ? snapshot.tasks : []
    const matchedTask = tasks.find((task) => task?.id === taskId)

    if (matchedTask?.status === '已完成') {
      return {
        snapshot,
        task: matchedTask
      }
    }

    if (matchedTask?.status === '失败') {
      throw new Error(matchedTask?.error || '套图生成任务失败')
    }

    await new Promise((resolve) => {
      window.setTimeout(resolve, 1600)
    })
  }

  throw new Error('等待套图生成结果超时')
}

function createSourcingDraftFromOutputs({
  sourceItem = {},
  textGroup = null,
  videoGroup = null,
  imageOutputs = [],
  imageWorkflowName = '',
  draftTitle = '',
  batchIndex = 0,
  batchCount = 1
} = {}) {
  const createdAt = getNormalizedDraftTimestamp()
  const sourceContext = createWorkflowSourceContext(sourceItem)

  const preview = imageOutputs[0]?.preview || videoGroup?.preview || sourceItem.preview || ''
  const listingTitle = textGroup?.draftPayload?.listingTitle || sourceItem.title || ''
  const listingDescription = textGroup?.draftPayload?.listingDescription || sourceItem.summary || ''
  const videoPlan = videoGroup?.raw?.videoUrl || videoGroup?.draftPayload?.editor?.videoAssetPlan || ''
  const imagePlan = imageOutputs.map((item) => item.savedPath || item.preview || '').filter(Boolean).join('\n')
  const normalizedBatchIndex = Math.max(0, Number(batchIndex) || 0)
  const hasMultipleBatches = Math.max(1, Number(batchCount) || 1) > 1
  const groupLabel = hasMultipleBatches ? `第 ${normalizedBatchIndex + 1} 组` : '自动生成'
  const resolvedTitle = draftTitle || textGroup?.outputTitle || sourceItem.title || '未命名商品'

  return {
    id: `draft-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    createdAt,
    source: '选品',
    module: '选品工作台',
    section: `一键生成 / ${groupLabel}`,
    title: resolvedTitle,
    summary: listingDescription || '已从选品自动完成文本、套图和视频生成。',
    preview,
    tags: ['选品', sourceItem.platform, ...(sourceItem.tags || [])].filter(Boolean),
    metadata: [
      { label: '来源平台', value: sourceItem.platform || '未设置' },
      { label: '生成分组', value: groupLabel },
      { label: '总销量', value: sourceItem.searchHeat || '--' },
      { label: '视频', value: videoGroup ? '已生成' : '未生成' },
      { label: '套图', value: imageWorkflowName || `${imageOutputs.length} 张` }
    ],
    draftPayload: createDraftEditorPayload({
      draftPayload: {
        draftType: 'listing_bundle',
        productName: sourceItem.title || '',
        targetPlatform: sourceItem.platform || '',
        workflowGroupId: sourceContext.workflowGroupId,
        sourcePlatform: sourceContext.sourcePlatform,
        sourceProductId: sourceContext.sourceProductId,
        contentType: '标题 / 描述 / 套图 / 视频',
        listingTitle,
        listingDescription,
        sellingPoint: sourceItem.summary || '',
        nextAction: '已自动收口到草稿，可继续检查和补充上架字段。',
        sourceMetadata: sourceContext.sourceMetadata,
        editor: {
          categoryPath: Array.isArray(sourceItem.tags) ? sourceItem.tags.join(' > ') : '',
          coverImage: preview,
          mainImagePlan: imagePlan,
          detailImagePlan: imagePlan,
          videoAssetPlan: videoPlan,
          remarks: sourceItem.assetDirection || ''
        },
        checklist: {
          titleReady: Boolean(listingTitle),
          descriptionReady: Boolean(listingDescription),
          imageReady: imageOutputs.length > 0,
          videoReady: Boolean(videoPlan),
          categoryReady: Boolean((sourceItem.tags || []).length),
          priceReady: false,
          skuReady: false,
          complianceReady: false
        }
      },
      preview
    }, createdAt),
    raw: {
      sourceItem,
      textGroup,
      videoGroup,
      imageOutputs
    }
  }
}

function buildVideoPrompt(formState = {}) {
  return buildVideoPromptForProvider(formState)
  // eslint-disable-next-line no-unreachable
  return [
    `商品名称：${formState.video_product_name || ''}`,
    `发布平台：${formState.video_platform || ''}`,
    `生成方式：${formState.video_operation || ''}`,
    `视频提示词：${formState.video_prompt_input || ''}`,
    `封面标题方向：${formState.video_cover_title || ''}`,
    `本轮目标：${formState.video_output_goal || ''}`,
    `补充说明：${formState.video_length_note || ''}`,
    '请输出适合电商短视频生成的中文视频提示词，突出商品卖点、镜头节奏和转化目标。'
  ].filter(Boolean).join('\n')
}

// eslint-disable-next-line no-unused-vars
function buildVideoGenerationDraft(formState = {}) {
  return buildVideoGenerationDraftForProvider(formState)
  // eslint-disable-next-line no-unreachable
  const isImageToVideo = formState.video_operation === '图生视频'
  const assetPath = String(
    formState.video_reference_image?.storedPath ||
    formState.video_reference_image?.path ||
    ''
  ).trim()
  return {
    model: formState.video_model || VIDEO_MODEL_NAME,
    prompt: buildVideoPrompt(formState),
    operation: isImageToVideo ? 'image-to-video' : 'text-to-video',
    duration: formState.video_duration || '8 秒',
    aspectRatio: formState.video_aspect_ratio || '9:16',
    imageUrl: isImageToVideo ? assetPath : '',
    outputAudio: !String(formState.video_model || '').includes('characters')
  }
}

const textServiceConfig = computed(() => {
  return {
    title: '文本服务配置',
    mode: 'editable',
    headline: 'GLM 免费文本模型配置',
    description: '文本功能默认接入 GLM-4.7-Flash。这里只开放 GLM Key 的用户自配入口。',
    helperText: '',
    fields: [
      {
        key: 'glmApiKey',
        label: 'GLM API-Key',
        type: 'password',
        placeholder: '请输入你的 GLM API-Key',
        value: glmConfigState.apiKey,
        hint: glmConfigState.configured && glmConfigState.maskedKey
          ? `已配置：${glmConfigState.maskedKey}`
          : '保存后将用于文本生成能力。'
      }
    ],
    actionLabel: '保存 GLM 配置',
    actionBusyLabel: '保存中...',
    actionBusy: glmConfigState.saving,
    actionDisabled: !String(glmConfigState.apiKey || '').trim()
  }
})

const videoServiceConfig = computed(() => {
  return {
    title: '视频服务状态',
    mode: 'readonly',
    headline: videoAdminConfigState.configured ? '视频主通道已配置' : '视频主通道待配置',
    description: videoAdminConfigState.configured
      ? '当前可直接发起 Sora 视频任务。'
      : '请先完成管理员验证并配置视频主通道。',
    helperText: '',
    actionLabel: '管理员配置视频通道',
    actionBusyLabel: '处理中...',
    actionBusy: false,
    actionDisabled: false
  }
})

function buildVideoPromptForProvider(formState = {}) {
  return [
    `商品名称：${formState.video_product_name || ''}`,
    `发布平台：${formState.video_platform || ''}`,
    `生成方式：${formState.video_operation || ''}`,
    `视频模型：${formState.video_model || VIDEO_MODEL_NAME}`,
    `视频时长：${formState.video_duration || '8 秒'}`,
    `画面比例：${formState.video_aspect_ratio || '9:16'}`,
    `清晰规格：${formState.video_size || 'large'}`,
    `视频提示词：${formState.video_prompt_input || ''}`,
    `封面标题方向：${formState.video_cover_title || ''}`,
    `本轮目标：${formState.video_output_goal || ''}`,
    `补充说明：${formState.video_length_note || ''}`,
    '请输出适合电商短视频生成的中文视频提示词，突出商品卖点、镜头节奏和转化目标。'
  ].filter(Boolean).join('\n')
}

function buildVideoGenerationDraftForProvider(formState = {}) {
  const isImageToVideo = formState.video_operation === '图生视频'
  const resolvedTaskName = resolveTaskName(formState.video_task_name)
  const assetPath = String(
    formState.video_reference_image?.storedPath ||
    formState.video_reference_image?.path ||
    ''
  ).trim()
  const forceNoWatermark = String(formState.video_watermark_mode || '').trim() !== '自动兜底'
  const isPrivateOutput = String(formState.video_private_output || '').trim() !== '否'

  return {
    model: formState.video_model || VIDEO_MODEL_NAME,
    prompt: buildVideoPromptForProvider({
      ...formState,
      video_task_name: resolvedTaskName
    }),
    quantity: normalizeVideoCount(formState.video_batch_count, 1),
    operation: isImageToVideo ? 'image-to-video' : 'text-to-video',
    duration: formState.video_duration || '8 秒',
    aspectRatio: formState.video_aspect_ratio || '9:16',
    size: formState.video_size || 'large',
    imageUrl: isImageToVideo ? assetPath : '',
    watermark: !forceNoWatermark,
    private: isPrivateOutput
  }
}

function updateVideoResultGroups(groups = []) {
  const currentSections = videoResultSections.value || {}
  const currentSection = currentSections['video-generate'] || initialVideoResultSections['video-generate'] || { description: '', groups: [] }

  videoResultSections.value = {
    ...currentSections,
    'video-generate': {
      ...currentSection,
      groups
    }
  }
}

function createVideoResultGroup(item, index, formState = {}) {
  const order = padGroupIndex(index)
  const duration = formState.video_duration || ((item.duration || 8) + ' 秒')
  const operationLabel = formState.video_operation || '文生视频'
  const platform = formState.video_platform || '未设置平台'
  const aspectRatio = formState.video_aspect_ratio || item.aspectRatio || '9:16'
  const thumbnail = item.thumbnailUrl || createPreview('视频结果 ' + order, '#0ea5e9')
  const sourceMetadata = formState.sourceMetadata && typeof formState.sourceMetadata === 'object'
    ? formState.sourceMetadata
    : {}

  return {
    id: item.id || ('video-' + order),
    title: '视频组 ' + order,
    subtitle: '单视频结果',
    outputTitle: (formState.video_model || VIDEO_MODEL_NAME) + ' ' + operationLabel + ' 输出',
    summary: (formState.video_task_name || '未命名任务') + ' 已完成一组视频方案，可继续联动草稿并补充封面、口播与上架信息。',
    detail: '适用平台：' + platform + ' / 时长：' + duration + ' / 目标：' + (formState.video_output_goal || '未设置目标') + ' / 比例：' + aspectRatio,
    metadata: [
      { label: '平台', value: platform },
      { label: '时长', value: duration },
      { label: '方式', value: operationLabel },
      { label: '比例', value: aspectRatio }
    ],
    tags: ['视频', formState.video_model || VIDEO_MODEL_NAME, operationLabel].filter(Boolean),
    preview: thumbnail,
    draftPayload: {
      draftType: 'listing_video',
      productName: formState.video_product_name || '',
      targetPlatform: platform,
      workflowGroupId: formState.workflowGroupId || sourceMetadata.workflowGroupId || '',
      sourcePlatform: formState.sourcePlatform || sourceMetadata.platform || '',
      sourceProductId: formState.sourceProductId || sourceMetadata.sourceProductId || '',
      contentType: '视频',
      videoTheme: formState.video_prompt_input || (operationLabel + ' 视频方案'),
      coverDirection: formState.video_cover_title || '',
      sellingPoint: formState.video_output_goal || '',
      nextAction: '进入草稿后可继续补充封面、口播和上架信息',
      sourceMetadata,
      editor: {
        videoAssetPlan: item.videoUrl || '',
        videoScriptNote: buildVideoPromptForProvider(formState),
        coverImage: thumbnail
      }
    },
    raw: item
  }
}

function splitTextBundleContent(content = '') {
  const normalized = String(content || '').trim()
  if (!normalized) {
    return {
      title: '',
      description: ''
    }
  }

  const lines = normalized
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)

  if (!lines.length) {
    return {
      title: normalized,
      description: ''
    }
  }

  const title = lines[0]
  const description = lines.slice(1).join('\n').trim()

  return {
    title,
    description: description || title
  }
}

function createTextResultGroup(item, index, formState = {}) {
  const order = padGroupIndex(index)
  const bundle = {
    title: String(item?.titleText || '').trim(),
    description: String(item?.descriptionText || '').trim()
  }
  const fallbackBundle = (!bundle.title && !bundle.description)
    ? splitTextBundleContent(item?.content)
    : {
        title: bundle.title,
        description: bundle.description || bundle.title
      }
  const resolvedBundle = {
    title: fallbackBundle.title || formState.text_product_name || `文本结果 ${order}`,
    description: fallbackBundle.description || fallbackBundle.title || ''
  }
  const sourceSummary = String(formState.text_prompt_input || '').trim()
  const sourceMetadata = formState.sourceMetadata && typeof formState.sourceMetadata === 'object'
    ? formState.sourceMetadata
    : {}

  return {
    id: item.id || `text-${order}`,
    title: `文本组 ${order}`,
    subtitle: '标题 + 详情',
    outputTitle: resolvedBundle.title,
    summary: resolvedBundle.description || resolvedBundle.title || '',
    metadata: [
      { label: '平台', value: formState.text_platform_format || '未设置' },
      { label: '模型', value: formState.text_model || TEXT_MODEL_NAME },
      { label: '语言', value: formState.text_language || '中文' },
      { label: '批次', value: `${order} / ${normalizeTextCount(formState.text_batch_count, 3)}` },
      { label: '字数', value: formState.text_length_limit || '未设置' }
    ],
    tags: ['文本', '标题', '详情', formState.text_platform_format || '电商'].filter(Boolean),
    draftPayload: {
      draftType: 'listing_bundle',
      productName: formState.text_product_name || '',
      targetPlatform: formState.text_platform_format || '',
      workflowGroupId: formState.workflowGroupId || sourceMetadata.workflowGroupId || '',
      sourcePlatform: formState.sourcePlatform || sourceMetadata.platform || '',
      sourceProductId: formState.sourceProductId || sourceMetadata.sourceProductId || '',
      contentType: '标题 / 详情',
      listingTitle: resolvedBundle.title,
      listingDescription: resolvedBundle.description,
      sellingPoint: sourceSummary,
      nextAction: '可继续进入草稿整理，或联动生图和视频',
      sourceMetadata,
      editor: {
        categoryPath: '',
        coverImage: formState.text_reference_image?.preview || '',
        mainImagePlan: formState.text_reference_image ? '已绑定商品参考图，可继续联动生图。' : '',
        detailImagePlan: '',
        videoAssetPlan: '',
        videoScriptNote: '',
        remarks: `${formState.text_task_name || ''}${formState.text_model ? ` / ${formState.text_model}` : ''}`
      },
      checklist: {
        titleReady: Boolean(resolvedBundle.title),
        descriptionReady: Boolean(resolvedBundle.description),
        imageReady: Boolean(formState.text_reference_image?.preview),
        videoReady: false,
        categoryReady: false,
        priceReady: false,
        skuReady: false,
        complianceReady: false
      }
    }
  }
}

function updateTextResultGroups(menuKey, groups = []) {
  const currentSections = textResultSections.value || {}
  const currentSection = currentSections[menuKey] || initialTextResultSections[menuKey] || { description: '', groups: [] }

  textResultSections.value = {
    ...currentSections,
    [menuKey]: {
      ...currentSection,
      groups
    }
  }
}

async function handleTextSubmit({ menuKey, formState } = {}) {
  if (!hasModuleAccess('text')) {
    showNotice('error', '当前授权未开通', '当前授权未开通文本模块。')
    return
  }

  if (menuKey !== 'text-generate' || textSubmitStates[menuKey]) {
    return
  }

  textSubmitStates[menuKey] = true
  const resolvedTaskName = resolveTaskName(formState.text_task_name)
  const textTaskId = `ecms-text-${menuKey}-${Date.now()}`
  upsertEcmsTask('text', createEcmsTaskEntry({
    moduleKey: 'text',
    menuKey,
    taskId: textTaskId,
    taskName: resolvedTaskName,
    progress: 12
  }))

  try {
    upsertEcmsTask('text', createEcmsTaskEntry({
      moduleKey: 'text',
      menuKey,
      taskId: textTaskId,
      taskName: resolvedTaskName,
      progress: 28,
      status: '进行中'
    }))
    const draft = buildTextGenerationDraft(formState)
    upsertEcmsTask('text', createEcmsTaskEntry({
      moduleKey: 'text',
      menuKey,
      taskId: textTaskId,
      taskName: resolvedTaskName,
      progress: 58,
      status: '进行中'
    }))
    const results = await generateEcmsText({
      taskId: textTaskId,
      draft
    })
    upsertEcmsTask('text', createEcmsTaskEntry({
      moduleKey: 'text',
      menuKey,
      taskId: textTaskId,
      taskName: resolvedTaskName,
      progress: 86,
      status: '进行中'
    }))
    const groups = (Array.isArray(results) ? results : []).map((item, index) => {
      return createTextResultGroup(item, index, formState)
    })

    if (!groups.length) {
      throw new Error('文本模型没有返回可展示的结果')
    }

    updateTextResultGroups(menuKey, groups)
    replaceEcmsExportItems('text', createEcmsExportItems('text', groups, resolvedTaskName))
    upsertEcmsTask('text', createEcmsTaskEntry({
      moduleKey: 'text',
      menuKey,
      taskId: textTaskId,
      taskName: resolvedTaskName,
      progress: 100,
      status: '已完成'
    }))
    applyTextStatusState(buildSuccessTextStatusState(groups.length))
    showNotice('success', '文本生成完成', `已生成 ${groups.length} 组文本结果`)
  } catch (error) {
    upsertEcmsTask('text', createEcmsTaskEntry({
      moduleKey: 'text',
      menuKey,
      taskId: textTaskId,
      taskName: resolvedTaskName,
      progress: 100,
      status: '失败',
      error: error?.message || '文本生成失败'
    }))
    const statusState = classifyTextStatusState(error)
    applyTextStatusState(statusState)
    showNotice('error', statusState.title || '文本生成失败', statusState.detail || statusState.message || error?.message || '请检查 API-Key 或网络后重试')
  } finally {
    textSubmitStates[menuKey] = false
  }
}

async function handleVideoSubmit({ menuKey, formState } = {}) {
  if (!hasModuleAccess('video')) {
    showNotice('error', '当前授权未开通', '当前授权未开通视频模块。')
    return
  }

  if (menuKey !== 'video-generate' || videoSubmitStates[menuKey]) {
    return
  }

  videoSubmitStates[menuKey] = true
  const resolvedTaskName = resolveTaskName(formState.video_task_name)
  const videoTaskId = 'ecms-video-' + Date.now()
  upsertEcmsTask('video', createEcmsTaskEntry({
    moduleKey: 'video',
    menuKey,
    taskId: videoTaskId,
    taskName: resolvedTaskName,
    progress: 10
  }))
  applyVideoStatusState(createVideoStatusState({
    tone: 'info',
    title: '视频任务提交中',
    badge: '处理中',
    message: '正在向视频通道发起任务，请耐心等待返回结果。',
    detail: '当前模型：' + (formState.video_model || VIDEO_MODEL_NAME)
  }))

  try {
    upsertEcmsTask('video', createEcmsTaskEntry({
      moduleKey: 'video',
      menuKey,
      taskId: videoTaskId,
      taskName: resolvedTaskName,
      progress: 24,
      status: '进行中'
    }))
    const draft = buildVideoGenerationDraftForProvider(formState)
    if (draft.operation === 'image-to-video' && !draft.imageUrl) {
      throw new Error('图生视频需要填写可访问的图片 URL')
    }

    upsertEcmsTask('video', createEcmsTaskEntry({
      moduleKey: 'video',
      menuKey,
      taskId: videoTaskId,
      taskName: resolvedTaskName,
      progress: 52,
      status: '进行中'
    }))
    const results = await generateEcmsVideo({
      taskId: videoTaskId,
      draft
    })

    upsertEcmsTask('video', createEcmsTaskEntry({
      moduleKey: 'video',
      menuKey,
      taskId: videoTaskId,
      taskName: resolvedTaskName,
      progress: 84,
      status: '进行中'
    }))
    const groups = (Array.isArray(results) ? results : []).map((item, index) => {
      return createVideoResultGroup(item, index, formState)
    })

    if (!groups.length) {
      throw new Error('视频模型没有返回可展示的结果')
    }

    updateVideoResultGroups(groups)
    replaceEcmsExportItems('video', createEcmsExportItems('video', groups, resolvedTaskName))
    upsertEcmsTask('video', createEcmsTaskEntry({
      moduleKey: 'video',
      menuKey,
      taskId: videoTaskId,
      taskName: resolvedTaskName,
      progress: 100,
      status: '已完成'
    }))
    applyVideoStatusState(buildSuccessVideoStatusState(groups.length))
    showNotice('success', '视频生成完成', '已生成 ' + groups.length + ' 组视频结果')
  } catch (error) {
    upsertEcmsTask('video', createEcmsTaskEntry({
      moduleKey: 'video',
      menuKey,
      taskId: videoTaskId,
      taskName: resolvedTaskName,
      progress: 100,
      status: '失败',
      error: error?.message || '视频生成失败'
    }))
    const statusState = classifyVideoStatusState(error)
    applyVideoStatusState(statusState)
    showNotice('error', statusState.title || '视频生成失败', statusState.detail || statusState.message || error?.message || '请检查参数或稍后重试')
  } finally {
    videoSubmitStates[menuKey] = false
  }
}

function showNotice(type, title, message) {
  if (noticeTimer) {
    clearTimeout(noticeTimer)
  }

  notice.visible = true
  notice.type = type
  notice.title = title
  notice.message = message

  noticeTimer = setTimeout(() => {
    notice.visible = false
    noticeTimer = null
  }, 2200)
}

function createEcmsTaskEntry({
  moduleKey = 'text',
  menuKey = '',
  taskId = '',
  taskName = '',
  progress = 0,
  status = '进行中',
  error = ''
} = {}) {
  return {
    id: taskId || `${moduleKey}-${Date.now()}`,
    taskNumber: taskName || createDailyTaskName(),
    menuKey,
    createdAt: getNormalizedDraftTimestamp(),
    progress: Math.max(0, Math.min(100, Number(progress) || 0)),
    status,
    error
  }
}

function upsertEcmsTask(moduleKey = 'text', nextTask = {}) {
  const taskId = nextTask?.id
  if (!taskId) {
    return
  }

  const currentTasks = Array.isArray(ecmsTaskRegistry[moduleKey]) ? ecmsTaskRegistry[moduleKey] : []
  ecmsTaskRegistry[moduleKey] = [
    nextTask,
    ...currentTasks.filter((item) => item.id !== taskId)
  ]
}

function replaceEcmsExportItems(moduleKey = 'text', nextItems = []) {
  ecmsExportRegistry[moduleKey] = Array.isArray(nextItems) ? nextItems : []
  ecmsSelectedExportIds[moduleKey] = []
}

function createEcmsExportItems(moduleKey = 'text', groups = [], taskName = '') {
  return (Array.isArray(groups) ? groups : []).map((group, index) => ({
    id: `${moduleKey}-export-${Date.now()}-${index + 1}`,
    name: `${taskName || moduleKey}-${String(index + 1).padStart(2, '0')}`,
    type: moduleKey === 'video' ? '视频结果' : '文本结果',
    status: '已生成',
    itemCount: 1,
    groupTitle: group.title || `${moduleKey}-${index + 1}`,
    outputDirectory: '',
    directoryPath: '',
    savedPath: ''
  }))
}

function toggleEcmsExportItem(moduleKey = 'text', itemId = '') {
  const currentSelectedIds = new Set(ecmsSelectedExportIds[moduleKey] || [])
  if (currentSelectedIds.has(itemId)) {
    currentSelectedIds.delete(itemId)
  } else {
    currentSelectedIds.add(itemId)
  }
  ecmsSelectedExportIds[moduleKey] = [...currentSelectedIds]
}

function handleEcmsToggleExportItem(moduleKey = 'text', itemId = '') {
  toggleEcmsExportItem(moduleKey, itemId)
}

function handleEcmsToggleDownloadCleanup(moduleKey = 'text', value = true) {
  ecmsDownloadCleanupEnabled[moduleKey] = Boolean(value)
}

function handleEcmsOpenOutputDirectory(directoryPath = '') {
  if (!directoryPath) {
    showNotice('error', '无法打开目录', '当前结果尚未生成本地目录。')
    return
  }

  void openOutputDirectory({
    outputDirectory: directoryPath
  }).catch((error) => {
    showNotice('error', '打开目录失败', error?.message || '本地目录打开未完成')
  })
}

function handleEcmsDeleteExportItem(moduleKey = 'text', exportItemId = '') {
  const currentItems = Array.isArray(ecmsExportRegistry[moduleKey]) ? ecmsExportRegistry[moduleKey] : []
  ecmsExportRegistry[moduleKey] = currentItems.filter((item) => item.id !== exportItemId)
  ecmsSelectedExportIds[moduleKey] = (ecmsSelectedExportIds[moduleKey] || []).filter((itemId) => itemId !== exportItemId)
}

function handleEcmsBatchDownload(moduleKey = 'text') {
  const selectedIds = ecmsSelectedExportIds[moduleKey] || []
  if (!selectedIds.length) {
    showNotice('error', '请先选择结果', '右侧结果导出里至少勾选一项后再批量导出。')
    return
  }

  showNotice('success', '批量导出已就绪', `${moduleKey === 'video' ? '视频' : '文本'}结果已完成勾选，可继续接入本地压缩导出。`)
}

function createDraftEditorPayload(payload = {}, createdAt = '') {
  const baseDraft = payload.draftPayload || {}
  const draftType = baseDraft.draftType || 'listing_content'
  const productName = baseDraft.productName || '待补商品名'
  const targetPlatform = baseDraft.targetPlatform || '待选平台'
  const contentType = baseDraft.contentType || '待定内容'
  const listingTitle = baseDraft.listingTitle || payload.title || ''
  const listingDescription = baseDraft.listingDescription || payload.summary || ''
  const videoTheme = baseDraft.videoTheme || ''
  const coverDirection = baseDraft.coverDirection || ''
  const sellingPoint = baseDraft.sellingPoint || ''
  const nextAction = baseDraft.nextAction || '继续补齐上架字段'
  const preview = payload.preview || ''
  const sourceMetadata = payload.sourceMetadata && typeof payload.sourceMetadata === 'object'
    ? payload.sourceMetadata
    : (baseDraft.sourceMetadata && typeof baseDraft.sourceMetadata === 'object' ? baseDraft.sourceMetadata : {})

  return {
    ...baseDraft,
    draftType,
    productName,
    targetPlatform,
    contentType,
    listingTitle,
    listingDescription,
    videoTheme,
    coverDirection,
    sellingPoint,
    nextAction,
    sourceMetadata: {
      platform: sourceMetadata.platform || '',
      scene: sourceMetadata.scene || '',
      sourceUrl: sourceMetadata.sourceUrl || '',
      sourceProductId: sourceMetadata.sourceProductId || '',
      totalSold: sourceMetadata.totalSold || '',
      imageUrl: sourceMetadata.imageUrl || preview
    },
    editor: {
      categoryPath: baseDraft.editor?.categoryPath || '',
      brandName: baseDraft.editor?.brandName || '',
      storeName: baseDraft.editor?.storeName || '',
      priceMin: baseDraft.editor?.priceMin || '',
      priceMax: baseDraft.editor?.priceMax || '',
      marketPrice: baseDraft.editor?.marketPrice || '',
      skuName: baseDraft.editor?.skuName || '默认款',
      skuValue: baseDraft.editor?.skuValue || '标准版',
      inventory: baseDraft.editor?.inventory || '100',
      shippingTemplate: baseDraft.editor?.shippingTemplate || '',
      coverImage: baseDraft.editor?.coverImage || preview,
      mainImagePlan: baseDraft.editor?.mainImagePlan || (preview ? '已从来源结果挂载一张主视觉' : ''),
      detailImagePlan: baseDraft.editor?.detailImagePlan || '',
      videoAssetPlan: baseDraft.editor?.videoAssetPlan || videoTheme,
      videoScriptNote: baseDraft.editor?.videoScriptNote || '',
      publishStatus: baseDraft.editor?.publishStatus || '待整理',
      publishWindow: baseDraft.editor?.publishWindow || '',
      operator: baseDraft.editor?.operator || '',
      remarks: baseDraft.editor?.remarks || '',
      lastSyncedAt: createdAt
    },
    checklist: {
      titleReady: baseDraft.checklist?.titleReady ?? Boolean(listingTitle),
      descriptionReady: baseDraft.checklist?.descriptionReady ?? Boolean(listingDescription),
      imageReady: baseDraft.checklist?.imageReady ?? Boolean(preview || baseDraft.editor?.mainImagePlan),
      videoReady: baseDraft.checklist?.videoReady ?? Boolean(videoTheme || baseDraft.editor?.videoAssetPlan),
      categoryReady: baseDraft.checklist?.categoryReady ?? false,
      priceReady: baseDraft.checklist?.priceReady ?? false,
      skuReady: baseDraft.checklist?.skuReady ?? false,
      complianceReady: baseDraft.checklist?.complianceReady ?? false
    }
  }
}

function updateNestedValue(target, path, value) {
  const segments = Array.isArray(path) ? path : String(path || '').split('.').filter(Boolean)
  if (!segments.length) {
    return target
  }

  const clone = Array.isArray(target) ? [...target] : { ...(target || {}) }
  let current = clone

  for (let index = 0; index < segments.length - 1; index += 1) {
    const segment = segments[index]
    const nextValue = current[segment]
    current[segment] = Array.isArray(nextValue) ? [...nextValue] : { ...(nextValue || {}) }
    current = current[segment]
  }

  current[segments[segments.length - 1]] = value
  return clone
}

async function handleCleanupClick() {
  try {
    await clearStudioRuntimeState()
    legacyStudioKey.value += 1
    showNotice('success', '清理完成', '运行态数据已清理，生图页会重新加载。')
  } catch (error) {
    showNotice('error', '清理失败', error?.message || '一键清理未完成')
  }
}

async function handleSourcingOneClickEdit(sourceItem = {}) {
  const capability = getSourcingWorkflowCapability('edit')
  if (!capability.sourcing) {
    showNotice('error', '授权不足', '当前授权未开通选品模块。')
    return
  }

  if (!capability.text && !capability.image && !capability.video) {
    showNotice('error', '授权不足', '一键编辑至少需要开通文本、生图、视频中的一个模块。')
    return
  }

  if (!sourceItem?.id || sourcingWorkflowState.running) {
    return
  }

  sourcingWorkflowState.running = true
  sourcingWorkflowState.targetId = sourceItem.id

  try {
    const textFormState = capability.text ? buildSourcingTextFormState(sourceItem, 'edit') : {}
    const videoFormState = capability.video ? buildSourcingVideoFormStateV2(sourceItem, 'edit') : {}
    const sourceImage = await createWorkflowSourceImageFromProduct(sourceItem)

    if (capability.text) {
      textExternalFormAction.value = {
        token: `text-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        menuKey: 'text-generate',
        values: {
          ...textFormState,
          text_reference_image: sourceImage
        }
      }
    }

    if (capability.video) {
      videoExternalFormAction.value = {
        token: `video-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        menuKey: 'video-generate',
        values: {
          ...videoFormState,
          video_reference_image: sourceImage
        }
      }
    }

    if (capability.image) {
      imageWorkflowPayload.value = buildImageWorkflowPayload(sourceItem, sourceImage, 'edit')
      legacyStudioKey.value += 1
    }

    if (capability.text) {
      activePage.value = 'text'
    } else if (capability.image) {
      activePage.value = 'image'
    } else if (capability.video) {
      activePage.value = 'video'
    }

    const workflowSummary = buildSourcingWorkflowSummary(capability)
    const message = workflowSummary.skippedLabels.length
      ? `已预填：${workflowSummary.enabledLabels.join('、')}；未开通并已跳过：${workflowSummary.skippedLabels.join('、')}`
      : '已把商品标题和图片预填到文本、生图、视频页面，等待你确认后再生成。'
    showNotice('success', '一键编辑已准备完成', message)
  } catch (error) {
    showNotice('error', '一键编辑失败', error?.message || '自动编排未完成，请检查文本配置后重试')
  } finally {
    sourcingWorkflowState.running = false
    sourcingWorkflowState.targetId = ''
  }
}

async function handleSourcingOneClickGenerate(sourceItem = {}) {
  const capability = getSourcingWorkflowCapability('generate')
  if (!capability.sourcing) {
    showNotice('error', '授权不足', '当前授权未开通选品模块。')
    return
  }

  if (!capability.text && !capability.image && !capability.video) {
    showNotice('error', '授权不足', '一键生成至少需要开通文本、生图、视频中的一个模块。')
    return
  }

  if (!sourceItem?.id || sourcingWorkflowState.running) {
    return
  }

  sourcingWorkflowState.running = true
  sourcingWorkflowState.targetId = sourceItem.id

  try {
    const textFormState = capability.text ? buildSourcingTextFormState(sourceItem, 'generate') : {}
    const sourceImage = await createWorkflowSourceImageFromProduct(sourceItem)
    const videoFormState = capability.video ? buildSourcingVideoFormStateForGenerationV2(sourceItem, sourceImage) : {}
    const workflowSummary = buildSourcingWorkflowSummary(capability)

    if (capability.text) {
      textExternalFormAction.value = {
        token: `text-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        menuKey: 'text-generate',
        values: {
          ...textFormState,
          text_reference_image: sourceImage
        }
      }
    }

    if (capability.video) {
      videoExternalFormAction.value = {
        token: `video-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        menuKey: 'video-generate',
        values: {
          ...videoFormState,
          video_reference_image: sourceImage
        }
      }
    }

    const textGroups = []
    if (capability.text) {
      const textResults = await generateEcmsText({
        taskId: `ecms-sourcing-text-${Date.now()}`,
        draft: buildTextGenerationDraft({
          ...textFormState,
          text_reference_image: sourceImage
        })
      })
      const resolvedTextGroups = (Array.isArray(textResults) ? textResults : []).map((item, index) => {
        return createTextResultGroup(item, index, {
          ...textFormState,
          text_reference_image: sourceImage
        })
      })

      if (!resolvedTextGroups.length) {
        throw new Error('文本生成没有返回结果')
      }

      textGroups.push(...resolvedTextGroups)
      updateTextResultGroups('text-generate', resolvedTextGroups)
      applyTextStatusState(buildSuccessTextStatusState(resolvedTextGroups.length))
    }

    const normalizedTextGroups = textGroups.length ? textGroups : [
      createTextResultGroup({
        id: `text-fallback-${Date.now()}`,
        titleText: sourceItem.title || '未命名商品',
        descriptionText: sourceItem.summary || '未生成文本结果，先保留来源商品摘要。'
      }, 0, buildSourcingTextFormState(sourceItem, 'generate'))
    ]

    let groupedResults = []
    let imageOutputs = []
    if (capability.image) {
      imageWorkflowPayload.value = buildImageWorkflowPayload(sourceItem, sourceImage, 'generate')
      legacyStudioKey.value += 1

      const studioTask = await createStudioTask({
        menuKey: 'series-generate',
        draft: {
          taskName: imageWorkflowPayload.value.taskName,
          model: imageWorkflowPayload.value.model,
          size: imageWorkflowPayload.value.size,
          sourceImage: imageWorkflowPayload.value.sourceImage,
          generateCount: imageWorkflowPayload.value.batchCount,
          batchCount: 1,
          globalPrompt: imageWorkflowPayload.value.globalPrompt,
          promptAssignments: (imageWorkflowPayload.value.promptTitles || []).map((promptTitle, index) => {
            return {
              id: `prefill-${index + 1}`,
              index: index + 1,
              prompt: [
                promptTitle,
                sourceItem.summary || '',
                sourceItem.assetDirection || ''
              ].filter(Boolean).join('\n'),
              templateId: 'system-empty-image-type',
              imageType: `套图 ${index + 1}`,
              differentialEnabled: false,
              batchPrompts: ['']
            }
          })
        }
      })

      const completedStudioTask = await waitForStudioTaskResult(studioTask?.id || '')
      groupedResults = completedStudioTask?.task?.resultPayload?.groupedResults || []
      imageOutputs = groupedResults.flatMap((group) => Array.isArray(group?.outputs) ? group.outputs : [])
    }

    let videoGroups = []
    if (capability.video) {
      const videoResults = await generateEcmsVideo({
        taskId: `ecms-sourcing-video-${Date.now()}`,
        draft: buildVideoGenerationDraftForProvider({
          ...videoFormState,
          video_reference_image: sourceImage
        })
      })
      videoGroups = (Array.isArray(videoResults) ? videoResults : []).map((item, index) => {
        return createVideoResultGroup(item, index, {
          ...videoFormState,
          video_reference_image: sourceImage
        })
      })

      if (!videoGroups.length) {
        throw new Error('视频生成没有返回结果')
      }

      updateVideoResultGroups(videoGroups)
      applyVideoStatusState(buildSuccessVideoStatusState(videoGroups.length))
    }

    if (capability.draft) {
      const nextDraftItems = normalizedTextGroups.map((textGroup, index) => {
        const matchedImageGroup = groupedResults[index] || null
        const matchedImageOutputs = Array.isArray(matchedImageGroup?.outputs) ? matchedImageGroup.outputs : []
        const matchedVideoGroup = videoGroups[index] || videoGroups[0] || null
        return createSourcingDraftFromOutputs({
          sourceItem,
          textGroup,
          videoGroup: matchedVideoGroup,
          imageOutputs: matchedImageOutputs.length ? matchedImageOutputs : imageOutputs,
          imageWorkflowName: imageWorkflowPayload.value?.taskName || '',
          draftTitle: textGroup?.outputTitle || sourceItem.title || '',
          batchIndex: index,
          batchCount: normalizedTextGroups.length
        })
      })

      nextDraftItems.forEach((draftItem) => {
        upsertDraftItemByWorkflow(draftItem)
      })
      activePage.value = 'draft'
    } else if (capability.text) {
      activePage.value = 'text'
    } else if (capability.image) {
      activePage.value = 'image'
    } else if (capability.video) {
      activePage.value = 'video'
    }

    const message = workflowSummary.skippedLabels.length
      ? `已执行：${workflowSummary.enabledLabels.join('、')}；未开通并已跳过：${workflowSummary.skippedLabels.join('、')}`
      : '文本、套图、视频已完成并自动收录到草稿。'
    showNotice('success', '一键生成完成', message)
  } catch (error) {
    const textStatusState = classifyTextStatusState(error)
    const videoStatusState = classifyVideoStatusState(error)
    applyTextStatusState(textStatusState)
    applyVideoStatusState(videoStatusState)
    showNotice('error', '一键生成失败', error?.message || '自动生成流程未完成，请检查配置后重试')
  } finally {
    sourcingWorkflowState.running = false
    sourcingWorkflowState.targetId = ''
  }
}

async function refreshSourcingProducts(platformKey = activeSourcingPlatform.value, sceneKey = activeSourcingScene.value) {
  const shouldUpdateActiveView = isActiveSourcingView(platformKey, sceneKey)

  if (shouldUpdateActiveView) {
    sourcingProductsLoading.value = true
  }

  try {
    const products = await getSourcingProducts({
      platformKey,
      sceneKey
    })
    const normalizedProducts = normalizeSourcingProductList(products)
    const cacheEntry = await writeSourcingCacheEntry({
      platformKey,
      sceneKey,
      items: normalizedProducts
    })

    if (shouldUpdateActiveView) {
      applySourcingViewState({
        items: normalizedProducts,
        cacheEntry
      })

      if (!normalizedProducts.length) {
        sourcingAutoRefreshStatus.mode = 'empty'
        sourcingAutoRefreshStatus.message = '当前平台这一分类暂未同步到商品数据'
      }
    }
  } catch (error) {
    if (shouldUpdateActiveView && sourcingProductsLoaded.value && sourcingProducts.value.length) {
      sourcingAutoRefreshStatus.mode = 'cached'
      sourcingAutoRefreshStatus.message = error?.message || '今日同步失败，当前继续展示本地缓存'
    } else if (shouldUpdateActiveView) {
      clearSourcingProductsView()
      sourcingAutoRefreshStatus.mode = 'error'
      sourcingAutoRefreshStatus.message = error?.message || '热销商品列表加载未完成'
    }

    showNotice('error', '选品加载失败', error?.message || '热销商品列表加载未完成')
  } finally {
    if (shouldUpdateActiveView) {
      sourcingProductsLoading.value = false
      sourcingAutoRefreshStatus.pending = false
      stopSourcingProgressTicker()
    }
  }
}

async function restoreSourcingProductsFromCache(platformKey = activeSourcingPlatform.value, sceneKey = activeSourcingScene.value) {
  const settings = await getSettings().catch(() => ({}))
  const cacheEntry = readSourcingCacheEntry(settings, platformKey, sceneKey)
  const shouldUpdateActiveView = isActiveSourcingView(platformKey, sceneKey)

  if (
    !cacheEntry ||
    cacheEntry.version !== SOURCING_CACHE_VERSION ||
    !Array.isArray(cacheEntry.items) ||
    !cacheEntry.items.length
  ) {
    if (shouldUpdateActiveView) {
      clearSourcingProductsView()
    }

    return {
      hit: false,
      stale: true
    }
  }

  if (shouldUpdateActiveView) {
    applySourcingViewState({
      items: normalizeSourcingProductList(cacheEntry.items),
      cacheEntry
    })
  }

  return {
    hit: true,
    stale: cacheEntry.cacheDate !== getTodayCacheDate()
  }
}

async function ensureSourcingProductsReady({ platformKey = activeSourcingPlatform.value, sceneKey = activeSourcingScene.value, forceRefresh = false } = {}) {
  const shouldUpdateActiveView = isActiveSourcingView(platformKey, sceneKey)
  const cacheState = await restoreSourcingProductsFromCache(platformKey, sceneKey)
  const shouldRefresh = forceRefresh || !cacheState.hit || cacheState.stale

  if (!shouldRefresh) {
    if (shouldUpdateActiveView) {
      sourcingAutoRefreshStatus.pending = false
    }
    return
  }

  const requestState = getSourcingRequestState(platformKey, sceneKey)
  if (requestState.promise) {
    return requestState.promise
  }

  if (shouldUpdateActiveView) {
    sourcingAutoRefreshStatus.pending = true
    startSourcingDelayFeedback(SOURCING_SAFE_DELAY_MS)
  }

  requestState.promise = new Promise((resolve) => {
    requestState.timer = window.setTimeout(async () => {
      try {
        if (isActiveSourcingView(platformKey, sceneKey)) {
          startSourcingRequestFeedback()
        }
        await refreshSourcingProducts(platformKey, sceneKey)
      } finally {
        clearSourcingRequestState(platformKey, sceneKey)
        resolve()
      }
    }, SOURCING_SAFE_DELAY_MS)
  })

  return requestState.promise
}

function createSourcingPrefetchQueue(initialPlatformKey = activeSourcingPlatform.value, initialSceneKey = activeSourcingScene.value) {
  const queue = []
  const queuedKeys = new Set()

  const pushQueueItem = (platformKey, sceneKey) => {
    const cacheKey = createSourcingCacheKey(platformKey, sceneKey)
    if (queuedKeys.has(cacheKey)) {
      return
    }

    queuedKeys.add(cacheKey)
    queue.push({ platformKey, sceneKey })
  }

  pushQueueItem(initialPlatformKey, initialSceneKey)

  for (const sceneKey of SOURCING_SCENE_KEYS) {
    pushQueueItem(initialPlatformKey, sceneKey)
  }

  for (const platformKey of SOURCING_PREFETCH_PLATFORM_KEYS) {
    for (const sceneKey of SOURCING_SCENE_KEYS) {
      pushQueueItem(platformKey, sceneKey)
    }
  }

  return queue
}

async function prefetchSourcingPlatformScenes(platformKey = activeSourcingPlatform.value, sceneKey = activeSourcingScene.value) {
  if (sourcingPrefetchPromise) {
    return sourcingPrefetchPromise
  }

  const queue = createSourcingPrefetchQueue(platformKey, sceneKey)
    .filter((item) => !(item.platformKey === activeSourcingPlatform.value && item.sceneKey === activeSourcingScene.value))
    .filter((item) => {
      const requestState = getSourcingRequestState(item.platformKey, item.sceneKey)
      return !requestState.promise
    })
  sourcingPrefetchState.total = queue.length
  sourcingPrefetchState.completed = 0
  sourcingPrefetchState.currentSceneKey = ''
  sourcingPrefetchState.running = queue.length > 0

  if (!queue.length) {
    resetSourcingPrefetchState()
    return
  }

  sourcingPrefetchPromise = (async () => {
    try {
      for (const queueItem of queue) {
        sourcingPrefetchState.currentSceneKey = `${queueItem.platformKey}:${queueItem.sceneKey}`
        await ensureSourcingProductsReady({
          platformKey: queueItem.platformKey,
          sceneKey: queueItem.sceneKey
        }).catch(() => {})
        sourcingPrefetchState.completed += 1
      }
    } finally {
      resetSourcingPrefetchState()
      sourcingPrefetchPromise = null
    }
  })()

  return sourcingPrefetchPromise
}

function handleSelectSourcingPlatform(platformKey = '') {
  const matchedPlatform = sourcingPlatformOptions.find((item) => item.key === platformKey)
  if (!matchedPlatform) {
    return
  }

  activeSourcingPlatform.value = matchedPlatform.key
  ensureSourcingProductsReady({
    platformKey: matchedPlatform.key,
    sceneKey: activeSourcingScene.value
  }).catch(() => {})
}

function handleSelectSourcingScene(sceneKey = '') {
  const matchedScene = sourcingSceneOptions.find((item) => item.key === sceneKey)
  if (!matchedScene) {
    return
  }

  activeSourcingScene.value = matchedScene.key
  ensureSourcingProductsReady({
    platformKey: activeSourcingPlatform.value,
    sceneKey: matchedScene.key
  }).catch(() => {})
}

async function handleOpenSourcingItemLink(item = {}) {
  try {
    await openSafeExternalUrl({
      targetUrl: item.sourceUrl || ''
    })
    showNotice('success', '已打开原商品', '已通过系统浏览器打开原商品链接。')
  } catch (error) {
    showNotice('error', '打开失败', error?.message || '原商品链接打开未完成')
  }
}

async function handleEcmsAssetPick({ moduleKey = '', fieldKey = '' } = {}) {
  if (!moduleKey || !fieldKey) {
    return
  }

  try {
    const result = await pickStudioInputAssets({
      menuKey: 'series-generate',
      allowMultiple: false
    })
    const file = Array.isArray(result?.files) ? result.files[0] : null
    const asset = createLocalAssetFromFile(file)

    if (!asset) {
      return
    }

    if (moduleKey === 'text') {
      textExternalFormAction.value = {
        token: `text-asset-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        values: {
          [fieldKey]: asset
        }
      }
      return
    }

    if (moduleKey === 'video') {
      videoExternalFormAction.value = {
        token: `video-asset-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        values: {
          [fieldKey]: asset
        }
      }
    }
  } catch (error) {
    showNotice('error', '图片选择失败', error?.message || '图片选择未完成')
  }
}

function handleSendToDraft(payload) {
  if (!hasModuleAccess('draft')) {
    showNotice('error', '当前授权未开通', '当前授权未开通草稿模块。')
    return
  }

  if (!draftItems.value.length) {
    const result = upsertDraftItemByWorkflow(payload, { forceNew: true })
    showNotice(
      'success',
      result.merged ? '已更新草稿' : '已加入草稿',
      `${payload.title || '当前结果'} 已新建草稿。`
    )
    return
  }

  openDraftTargetDialog(payload)
}

function handleDraftFieldUpdate({ draftId, path, value }) {
  if (!draftId || !path) {
    return
  }

  draftItems.value = draftItems.value.map((item) => {
    if (item.id !== draftId) {
      return item
    }

    return {
      ...item,
      createdAt: getNormalizedDraftTimestamp(),
      draftPayload: updateNestedValue(item.draftPayload || {}, path, value)
    }
  })
}

async function handleCopyDraftAsset(value = '', successLabel = '内容') {
  try {
    const normalizedValue = String(value || '').trim()
    if (!normalizedValue) {
      throw new Error('没有可复制的内容')
    }
    if (!navigator?.clipboard?.writeText) {
      throw new Error('当前环境不支持自动复制')
    }

    await navigator.clipboard.writeText(normalizedValue)
    showNotice('success', `${successLabel}已复制`, '你可以直接粘贴到后续流程里继续使用。')
  } catch (error) {
    showNotice('error', '复制失败', error?.message || '复制内容未完成')
  }
}

async function handleOpenExternalResultLink({ targetUrl = '', label = '链接' } = {}) {
  try {
    const normalizedUrl = String(targetUrl || '').trim()
    if (!normalizedUrl) {
      throw new Error('没有可打开的链接')
    }

    await openSafeExternalUrl({
      targetUrl: normalizedUrl
    })
    showNotice('success', `${label}已打开`, '已通过系统浏览器打开当前结果链接。')
  } catch (error) {
    showNotice('error', `打开${label}失败`, error?.message || '当前链接未能成功打开')
  }
}

async function handleTopbarCopyEmail(entry = {}) {
  const address = String(entry?.address || '').trim()
  const label = String(entry?.label || topBarLocaleText.value.emailLabel || '邮箱').trim()
  await handleCopyDraftAsset(address, label)
}

async function handleTopbarCopyGithub(entry = {}) {
  const value = String(entry?.value || '').trim()
  const label = String(entry?.label || topBarLocaleText.value.githubLabel || 'GitHub').trim()
  await handleCopyDraftAsset(value, label)
}

function handleOpenDraftAssetPreview(previewUrl = '') {
  const normalizedPreviewUrl = String(previewUrl || '').trim()
  if (!normalizedPreviewUrl) {
    showNotice('error', '无法预览', '当前资产没有可预览的图片。')
    return
  }

  window.open(normalizedPreviewUrl, '_blank', 'noopener,noreferrer')
}

function handleJumpToDraftSource(moduleKey = '') {
  const normalizedModuleKey = String(moduleKey || '').trim()
  const pageKeyMap = {
    text: 'text',
    image: 'image',
    video: 'video'
  }
  const targetPage = pageKeyMap[normalizedModuleKey]
  if (!targetPage) {
    showNotice('error', '无法定位', '当前资产没有可跳转的来源模块。')
    return
  }

  handleNavSelect(targetPage)
  showNotice('success', '已跳转来源模块', '你可以继续在对应模块里补充或重新生成当前商品资产。')
}

async function handleSavePromptTemplate(payload) {
  try {
    await savePromptTemplate(payload)
    promptTemplates.value = await listPromptTemplates().catch(() => promptTemplates.value)
    showNotice('success', '保存成功', '提示词模板已更新。')
  } catch (error) {
    showNotice('error', '保存失败', error?.message || '提示词模板保存未完成')
  }
}

async function handleRemovePromptTemplate(templateId) {
  try {
    await removePromptTemplate({
      id: templateId
    })
    promptTemplates.value = await listPromptTemplates().catch(() => promptTemplates.value)
    showNotice('success', '删除成功', '提示词模板已删除。')
  } catch (error) {
    showNotice('error', '删除失败', error?.message || '提示词模板删除未完成')
  }
}

async function handleSaveNegativePromptTemplate(payload) {
  try {
    await saveNegativePromptTemplate(payload)
    negativePromptTemplates.value = await listNegativePromptTemplates().catch(() => negativePromptTemplates.value)
    showNotice('success', '保存成功', '反向提示词模板已更新。')
  } catch (error) {
    showNotice('error', '保存失败', error?.message || '反向提示词模板保存未完成')
  }
}

async function handleRemoveNegativePromptTemplate(templateId) {
  try {
    await removeNegativePromptTemplate({
      id: templateId
    })
    negativePromptTemplates.value = await listNegativePromptTemplates().catch(() => negativePromptTemplates.value)
    showNotice('success', '删除成功', '反向提示词模板已删除。')
  } catch (error) {
    showNotice('error', '删除失败', error?.message || '反向提示词模板删除未完成')
  }
}

function handleTextServiceConfigUpdate({ key, value } = {}) {
  if (key === 'glmApiKey') {
    glmConfigState.apiKey = value || ''
  }
}

async function handleSaveTextServiceConfig() {
  if (!String(glmConfigState.apiKey || '').trim() || glmConfigState.saving) {
    return
  }

  glmConfigState.saving = true

  try {
    await saveGlmApiKey({
      apiKey: glmConfigState.apiKey
    })
    applyTextStatusState(buildReadyTextStatusState())
    showNotice('success', 'GLM 配置已保存', '文本工作台现在可以直接发起标题和描述任务。')
  } catch (error) {
    applyTextStatusState(buildMissingTextKeyStatusState())
    showNotice('error', 'GLM 配置失败', error?.message || '请检查你的 GLM API-Key 后重试')
  } finally {
    glmConfigState.saving = false
  }
}

async function handleRefreshTextTotalCredits() {
  const snapshot = await getStudioSnapshot().catch(() => null)
  if (snapshot?.workspaceDashboard?.creditOverview) {
    sharedCreditOverview.value = snapshot.workspaceDashboard.creditOverview
  }
}

async function handleRefreshTextRemainingCredits() {
  const snapshot = await getStudioSnapshot().catch(() => null)
  if (snapshot?.workspaceDashboard?.creditOverview) {
    sharedCreditOverview.value = snapshot.workspaceDashboard.creditOverview
  }
  if (snapshot?.workspaceDashboard?.creditMessages) {
    sharedCreditMessages.value = snapshot.workspaceDashboard.creditMessages
  }
  if (snapshot?.workspaceDashboard?.networkMonitor) {
    sharedNetworkMonitor.value = snapshot.workspaceDashboard.networkMonitor
  }
}

async function handleRefreshVideoTotalCredits() {
  return handleRefreshVideoRemainingCredits({
    silent: false
  })
}

async function handleRefreshVideoRemainingCredits({ silent = false } = {}) {
  if (isRefreshingVideoBilling.value) {
    return null
  }

  isRefreshingVideoBilling.value = true

  try {
    const billing = await getEcmsVideoBillingSummary({
      page: 1,
      pageSize: 10
    })

    applyVideoBillingSummary(billing)

    if (billing?.unsupported) {
      if (!silent) {
        showNotice('error', '余额接口待接入', billing?.message || '当前视频通道尚未接入准确余额查询接口。')
      }
      return billing
    }

    if (!silent) {
      showNotice('success', '余额查询完成', '视频工作台余额、今日用量和消费记录已更新。')
    }

    return billing
  } catch (error) {
    const errorMessage = error?.message || '视频余额查询未完成，请检查视频 API-Key 或稍后重试'
    showNotice('error', '余额查询失败', errorMessage)
    throw error
  } finally {
    isRefreshingVideoBilling.value = false
  }
}

function openVideoAdminConfig() {
  adminPasswordFeedback.value = ''
  adminApiKeyFeedback.value = ''
  isAdminPasswordSubmitting.value = false
  isAdminApiKeySaving.value = false
  isAdminApiConfigUnlocked.value = false
  isAdminApiKeyDialogVisible.value = false
  isAdminPasswordDialogVisible.value = true
}

function handleCloseAdminPasswordDialog() {
  isAdminPasswordDialogVisible.value = false
  isAdminPasswordSubmitting.value = false
  isAdminApiConfigUnlocked.value = false
  adminPasswordDraft.value = ''
  adminPasswordFeedback.value = ''
}

async function handleConfirmAdminPassword() {
  isAdminPasswordSubmitting.value = true
  adminPasswordFeedback.value = ''

  try {
    const result = await verifyAdminPassword({
      password: adminPasswordDraft.value
    })

    syncAdminStatusState(result?.adminStatus || {})
    isAdminPasswordDialogVisible.value = false
    isAdminApiConfigUnlocked.value = true
    isAdminApiKeyDialogVisible.value = true
    adminApiKeyFeedback.value = result?.requiresSetup
      ? '首次配置，请先设置管理员口令并保存 API-Key。'
      : '管理员验证通过，请继续保存 API-Key。'
  } catch (error) {
    adminPasswordFeedback.value = error?.message || '管理员验证失败'
    showNotice('error', '管理员验证失败', error?.message || '请重新输入管理员口令。')
  } finally {
    isAdminPasswordSubmitting.value = false
  }
}

function handleCloseAdminApiKeyDialog() {
  isAdminApiKeyDialogVisible.value = false
  isAdminApiConfigUnlocked.value = false
  adminPasswordDraft.value = ''
  adminPasswordFeedback.value = ''
  adminApiKeyFeedback.value = ''
}

async function handleSaveAdminApiKey() {
  if (isAdminApiKeySaving.value) {
    return
  }

  isAdminApiKeySaving.value = true
  adminApiKeyFeedback.value = ''

  try {
    const savedSettings = await saveAdminApiKey({
      apiKey: adminImageApiKeyDraft.value,
      videoApiKey: adminVideoApiKeyDraft.value,
      password: adminPasswordDraft.value
    })

    syncAdminStatusState(savedSettings?.adminStatus || {})
    adminImageApiKeyDraft.value = ''
    adminVideoApiKeyDraft.value = ''
    isAdminApiConfigUnlocked.value = true
    adminApiKeyFeedback.value = '管理员 API-Key 已保存成功'
    applyVideoStatusState(buildReadyVideoStatusState())
    showNotice('success', '视频通道已配置', '管理员付费模型通道已保存成功。')
  } catch (error) {
    adminApiKeyFeedback.value = error?.message || '管理员配置保存未完成'
    applyVideoStatusState(buildMissingVideoKeyStatusState())
    showNotice('error', '视频通道配置失败', error?.message || '请检查管理员配置后重试')
  } finally {
    isAdminApiKeySaving.value = false
  }
}

async function initializeTextStatusState() {
  const [settings, adminStatus] = await Promise.all([
    getSettings().catch(() => ({})),
    getAdminStatus().catch(() => ({}))
  ])

  glmConfigState.apiKey = ''
  glmConfigState.maskedKey = settings?.glmApiKeyMasked || ''
  glmConfigState.configured = Boolean(settings?.glmConfigured)
  applySourcingWorkflowConfig(settings?.[SOURCING_WORKFLOW_SETTINGS_KEY] || {})
  syncAdminStatusState(adminStatus)
  adminImageApiKeyDraft.value = ''
  adminVideoApiKeyDraft.value = ''

  applyTextStatusState(
    glmConfigState.configured
      ? buildReadyTextStatusState()
      : buildMissingTextKeyStatusState()
  )

  applyVideoStatusState(
    videoAdminConfigState.configured
      ? buildReadyVideoStatusState()
      : buildMissingVideoKeyStatusState()
  )

  return {
    ready: Boolean(glmConfigState.configured)
  }
}

async function loadActivationState({ silent = false } = {}) {
  if (!silent) {
    isActivationLoading.value = true
  }

  try {
    const nextState = await (silent ? reloadActivation() : getActivationStatus())
    activationState.value = {
      ...createDefaultActivationState(),
      ...(nextState || {})
    }
  } catch (error) {
    activationState.value = {
      ...createDefaultActivationState(),
      status: 'invalid',
      message: error?.message || '授权状态读取失败'
    }
  } finally {
    isActivationLoading.value = false
  }
}

async function handleCopyDeviceCode() {
  try {
    const payload = activationState.value?.deviceCode
      ? { deviceCode: activationState.value.deviceCode }
      : await getDeviceCode()
    const deviceCode = String(payload?.deviceCode || '').trim()

    if (!deviceCode) {
      throw new Error('未获取到设备码')
    }

    if (!navigator?.clipboard?.writeText) {
      throw new Error('当前环境不支持自动复制')
    }

    await navigator.clipboard.writeText(deviceCode)
    showNotice('success', '设备码已复制', '请在管理员授权工具中基于该设备码生成授权文件。')
  } catch (error) {
    showNotice('error', '复制失败', error?.message || '复制设备码未完成')
  }
}

async function handleImportLicense() {
  try {
    const result = await importLicenseFile()
    if (result?.canceled) {
      return
    }

    activationState.value = {
      ...createDefaultActivationState(),
      ...(result || {})
    }

    if (result?.status === 'activated') {
      await initializeAuthorizedWorkspaceData()
      isActivationCenterOpen.value = false
      showNotice('success', '授权导入成功', result?.message || '当前设备已完成授权。')
      return
    }

    showNotice('error', '授权导入失败', result?.message || '请检查授权文件后重试')
  } catch (error) {
    showNotice('error', '授权导入失败', error?.message || '导入授权文件未完成')
  }
}

function handleActivationEntry() {
  isActivationCenterOpen.value = true
}

async function loadAppLanguagePreference() {
  const settings = await getSettings().catch(() => ({}))
  const savedLanguage = String(settings?.[APP_LANGUAGE_SETTINGS_KEY] || '').trim().toLowerCase()

  if (savedLanguage === 'zh' || savedLanguage === 'en') {
    activeLanguage.value = savedLanguage
  }
}

async function handleLanguageChange(nextLanguage = 'zh') {
  const normalizedLanguage = String(nextLanguage || '').trim().toLowerCase() === 'en' ? 'en' : 'zh'

  if (activeLanguage.value === normalizedLanguage) {
    return
  }

  activeLanguage.value = normalizedLanguage
  await saveSettings({
    [APP_LANGUAGE_SETTINGS_KEY]: normalizedLanguage
  }).catch(() => {})
}

function getModuleLockMessage(moduleKey = '', moduleLabel = '') {
  if (!moduleKey || hasModuleAccess(moduleKey)) {
    return ''
  }

  return `当前授权未开通“${moduleLabel || moduleKey}”模块，请在独立授权工具中补充该模块授权。`
}

function getLocalizedModuleLockMessage(moduleKey = '', moduleLabel = '') {
  if (activeLanguage.value === 'en') {
    const label = moduleLabel || t(`module.${moduleKey}`) || moduleKey
    return `The current license does not include the ${label} module. Please enable it in the standalone authorization tool.`
  }

  return getModuleLockMessage(moduleKey, moduleLabel)
}

function getSourcingWorkflowCapability(mode = 'edit') {
  const workflowConfig = getActiveSourcingWorkflowConfig(mode)
  return {
    sourcing: hasModuleAccess('sourcing'),
    text: hasModuleAccess('text') && Boolean(workflowConfig?.text?.enabled),
    image: hasModuleAccess('image') && Boolean(workflowConfig?.image?.enabled),
    video: hasModuleAccess('video') && Boolean(workflowConfig?.video?.enabled),
    draft: hasModuleAccess('draft')
  }
}

function buildSourcingWorkflowSummary(capability = {}) {
  const enabledLabels = []
  const skippedLabels = []

  if (capability.text) enabledLabels.push('文本')
  else skippedLabels.push('文本')

  if (capability.image) enabledLabels.push('生图')
  else skippedLabels.push('生图')

  if (capability.video) enabledLabels.push('视频')
  else skippedLabels.push('视频')

  if (capability.draft) enabledLabels.push('草稿')
  else skippedLabels.push('草稿')

  return {
    enabledLabels,
    skippedLabels
  }
}

function handleNavSelect(nextPage = '') {
  const pageKey = String(nextPage || '').trim()
  if (!pageKey) {
    return
  }

  const requiredModule = moduleKeyByPage[pageKey]
  if (requiredModule && !hasModuleAccess(requiredModule)) {
    const pageLabel = localizedNavItems.value.find((item) => item.key === pageKey)?.label || pageKey
    if (activeLanguage.value === 'en') {
      showNotice('error', 'Module unavailable', `The current license does not include the ${pageLabel} module.`)
    } else {
      showNotice('error', '当前授权未开通', `当前授权未开通“${pageLabel}”模块。`)
    }
    return
  }

  activePage.value = pageKey
}

onMounted(async () => {
  await loadAppLanguagePreference()
  await loadActivationState()

  if (isActivationReady.value) {
    await initializeAuthorizedWorkspaceData()
  } else {
    isActivationCenterOpen.value = true
  }
})

onBeforeUnmount(() => {
  if (noticeTimer) {
    clearTimeout(noticeTimer)
  }

  for (const requestState of sourcingRequestStateMap.values()) {
    if (requestState?.timer) {
      clearTimeout(requestState.timer)
    }
  }

  stopSourcingProgressTicker()
})
</script>

<template>
  <main class="app-shell" :data-theme="activeTheme">
    <AppTopBar
      brand-label="QiuAi-ECMS"
      :theme-options="themeOptions"
      :active-theme="activeTheme"
      :active-language="activeLanguage"
      :locale-text="topBarLocaleText"
      :activation-summary="localizedActivationSummary"
      :nav-items="localizedNavItems"
      :active-nav="activePage"
      @nav-select="handleNavSelect"
      @language-change="handleLanguageChange"
      @copy-github="handleTopbarCopyGithub"
      @copy-email="handleTopbarCopyEmail"
      @cleanup-click="handleCleanupClick"
      @activation-click="handleActivationEntry"
    />

    <div v-if="notice.visible" class="app-notice-layer" role="status" aria-live="polite">
      <div class="app-notice" :class="`app-notice--${notice.type}`">
        <strong>{{ notice.title }}</strong>
        <span>{{ notice.message }}</span>
      </div>
    </div>

    <section v-if="!isActivationReady" class="activation-shell">
      <ActivationGate
        :activation-state="activationState || createDefaultActivationState()"
        :is-loading="isActivationLoading"
        @copy-device-code="handleCopyDeviceCode"
        @import-license="handleImportLicense"
        @refresh-license="loadActivationState"
      />
    </section>

    <section v-else class="ecms-shell">
      <HotProductsPage
        v-if="activePage === 'hot'"
        :platform-options="localizedSourcingPlatformOptions"
        :active-platform-key="activeSourcingPlatform"
        :scene-options="localizedSourcingSceneOptions"
        :active-scene-key="activeSourcingScene"
        :trend-products="activeSourcingContent.trendProducts"
        :workflow-target-id="sourcingWorkflowState.targetId"
        :is-workflow-running="sourcingWorkflowState.running"
        :is-loading-products="sourcingProductsLoading"
        :module-locked="!hasModuleAccess('sourcing')"
        :module-lock-message="getLocalizedModuleLockMessage('sourcing', t('module.sourcing'))"
        :has-loaded-products="sourcingProductsLoaded"
        :auto-refresh-status="sourcingAutoRefreshStatus"
        :prefetch-state="sourcingPrefetchState"
        :locale-text="hotProductsLocaleText"
        @one-click-edit="handleSourcingOneClickEdit"
        @one-click-generate="handleSourcingOneClickGenerate"
        @open-one-click-config="openSourcingWorkflowConfig"
        @select-platform="handleSelectSourcingPlatform"
        @select-scene="handleSelectSourcingScene"
        @open-item-link="handleOpenSourcingItemLink"
      />

      <EcmsStudioPage
        v-else-if="activePage === 'text'"
        :title="t('studio.text.title')"
        :description="t('studio.text.description')"
        :menu-items="textMenuItems"
        :overview-cards="textOverviewCards"
        :parameter-sections="textParameterSections"
        :result-sections="textResultSections"
        :queue-cards="textQueueCards"
        :tasks="textSidebarTasks"
        :menu-label="t('studio.text.menu')"
        :export-items="textExportItems"
        :selected-export-ids="ecmsSelectedExportIds.text"
        :download-cleanup-enabled="ecmsDownloadCleanupEnabled.text"
        :export-menu-keys="textExportMenuKeys"
        :workspace-dashboard="textWorkspaceDashboard"
        :host-info="textHostInfo"
        :model-pricing-catalog="textModelPricingCatalog"
        :service-config="textServiceConfig"
        :status-states="textStatusStates"
        :submit-states="textSubmitStates"
        :prompt-templates="promptTemplates"
        :negative-prompt-templates="negativePromptTemplates"
        module-key="text"
        :module-locked="!hasModuleAccess('text')"
        :module-lock-message="getLocalizedModuleLockMessage('text', t('module.text'))"
        :external-form-action="textExternalFormAction"
        default-menu="workspace"
        :remembered-menu="rememberedTextMenu"
        :is-refreshing-total-credits="false"
        :is-refreshing-remaining-credits="false"
        @menu-change="rememberedTextMenu = $event"
        @send-to-draft="handleSendToDraft"
        @copy-result="handleCopyDraftAsset"
        @open-result-link="handleOpenExternalResultLink"
        @submit-task="handleTextSubmit"
        @pick-asset="handleEcmsAssetPick"
        @save-template="handleSavePromptTemplate"
        @remove-template="handleRemovePromptTemplate"
        @save-negative-template="handleSaveNegativePromptTemplate"
        @remove-negative-template="handleRemoveNegativePromptTemplate"
        @service-config-update="handleTextServiceConfigUpdate"
        @refresh-total-credits="handleRefreshTextTotalCredits"
        @refresh-remaining-credits="handleRefreshTextRemainingCredits"
        @save-service-config="handleSaveTextServiceConfig"
        @toggle-export-item="handleEcmsToggleExportItem('text', $event)"
        @batch-download="handleEcmsBatchDownload('text')"
        @open-output-directory="handleEcmsOpenOutputDirectory('text', $event)"
        @delete-export-item="handleEcmsDeleteExportItem('text', $event)"
        @toggle-download-cleanup="handleEcmsToggleDownloadCleanup('text', $event)"
      />

      <section v-else-if="activePage === 'image'" class="ecms-page ecms-page--legacy">
        <LegacyStudioApp
          :key="legacyStudioKey"
          embedded
          :default-menu="rememberedImageMenu"
          :module-locked="!hasModuleAccess('image')"
          :module-lock-message="getLocalizedModuleLockMessage('image', t('module.image'))"
          :external-workflow-payload="imageWorkflowPayload"
          @menu-change="rememberedImageMenu = $event"
          @send-to-draft="handleSendToDraft"
        />
      </section>

      <EcmsStudioPage
        v-else-if="activePage === 'video'"
        :title="t('studio.video.title')"
        :description="t('studio.video.description')"
        :menu-items="videoMenuItems"
        :overview-cards="videoOverviewCards"
        :parameter-sections="videoParameterSections"
        :result-sections="videoResultSections"
        :queue-cards="videoQueueCards"
        :tasks="videoSidebarTasks"
        :menu-label="t('studio.video.menu')"
        :export-items="videoExportItems"
        :selected-export-ids="ecmsSelectedExportIds.video"
        :download-cleanup-enabled="ecmsDownloadCleanupEnabled.video"
        :export-menu-keys="videoExportMenuKeys"
        :workspace-dashboard="videoWorkspaceDashboard"
        :host-info="videoHostInfo"
        :model-pricing-catalog="videoModelPricingCatalog"
        :status-states="videoStatusStates"
        :submit-states="videoSubmitStates"
        :service-config="videoServiceConfig"
        :prompt-templates="promptTemplates"
        :negative-prompt-templates="negativePromptTemplates"
        module-key="video"
        :module-locked="!hasModuleAccess('video')"
        :module-lock-message="getLocalizedModuleLockMessage('video', t('module.video'))"
        :external-form-action="videoExternalFormAction"
        default-menu="workspace"
        :remembered-menu="rememberedVideoMenu"
        :is-refreshing-total-credits="isRefreshingVideoBilling"
        :is-refreshing-remaining-credits="isRefreshingVideoBilling"
        @menu-change="rememberedVideoMenu = $event"
        @send-to-draft="handleSendToDraft"
        @copy-result="handleCopyDraftAsset"
        @open-result-link="handleOpenExternalResultLink"
        @submit-task="handleVideoSubmit"
        @pick-asset="handleEcmsAssetPick"
        @save-template="handleSavePromptTemplate"
        @remove-template="handleRemovePromptTemplate"
        @save-negative-template="handleSaveNegativePromptTemplate"
        @remove-negative-template="handleRemoveNegativePromptTemplate"
        @refresh-total-credits="handleRefreshVideoTotalCredits"
        @refresh-remaining-credits="handleRefreshVideoRemainingCredits"
        @save-service-config="openVideoAdminConfig"
        @toggle-export-item="handleEcmsToggleExportItem('video', $event)"
        @batch-download="handleEcmsBatchDownload('video')"
        @open-output-directory="handleEcmsOpenOutputDirectory('video', $event)"
        @delete-export-item="handleEcmsDeleteExportItem('video', $event)"
        @toggle-download-cleanup="handleEcmsToggleDownloadCleanup('video', $event)"
      />

      <DraftBoardPage
        v-else-if="activePage === 'draft'"
        :draft-items="draftItems"
        :module-locked="!hasModuleAccess('draft')"
        :module-lock-message="getLocalizedModuleLockMessage('draft', t('module.draft'))"
        @update-draft-field="handleDraftFieldUpdate"
        @copy-asset="handleCopyDraftAsset"
        @preview-asset="handleOpenDraftAssetPreview"
        @jump-to-source="handleJumpToDraftSource"
      />

      <ListingCenterPage
        v-else
        :draft-items="draftItems"
        :module-locked="!hasModuleAccess('listing')"
        :module-lock-message="getLocalizedModuleLockMessage('listing', t('module.listing'))"
        :locale-text="listingLocaleText"
        @update-draft-field="handleDraftFieldUpdate"
      />
    </section>

    <div
      v-if="isDraftTargetDialogVisible"
      class="draft-target-dialog"
      @click.self="closeDraftTargetDialog"
    >
      <div class="draft-target-dialog__card">
        <div class="draft-target-dialog__header">
          <strong>发送到草稿</strong>
          <button type="button" class="secondary-action secondary-action--compact" @click="closeDraftTargetDialog">
            关闭
          </button>
        </div>

        <div class="draft-target-dialog__body">
          <label class="draft-target-option" :class="{ 'draft-target-option--active': selectedDraftTargetId === '__new__' }">
            <input v-model="selectedDraftTargetId" type="radio" value="__new__" />
            <div>
              <strong>新建草稿</strong>
              <span>把当前结果单独建成一个新草稿</span>
            </div>
          </label>

          <div class="draft-target-dialog__list module-scroll scrollbar-hidden">
            <label
              v-for="item in draftItems"
              :key="item.id"
              class="draft-target-option"
              :class="{ 'draft-target-option--active': selectedDraftTargetId === item.id }"
            >
              <input v-model="selectedDraftTargetId" type="radio" :value="item.id" />
              <div class="draft-target-option__content">
                <div v-if="item.preview" class="draft-target-option__preview">
                  <img :src="item.preview" :alt="resolveDraftDisplayTitle(item)" />
                </div>
                <div class="draft-target-option__copy">
                  <strong>{{ resolveDraftDisplayTitle(item) }}</strong>
                  <span>{{ item.draftPayload?.targetPlatform || item.source || '未分平台' }}</span>
                </div>
              </div>
            </label>
          </div>
        </div>

        <div class="draft-target-dialog__footer">
          <button type="button" class="secondary-action" @click="closeDraftTargetDialog">
            取消
          </button>
          <button type="button" class="primary-action" @click="confirmDraftTargetSelection">
            确认发送
          </button>
        </div>
      </div>
    </div>

    <div
      v-if="isActivationReady && isActivationCenterOpen"
      class="activation-center-modal"
      role="dialog"
      aria-modal="true"
      aria-label="授权中心"
      @click.self="isActivationCenterOpen = false"
    >
      <ActivationGate
        :activation-state="activationState || createDefaultActivationState()"
        :is-loading="isActivationLoading"
        closable
        @copy-device-code="handleCopyDeviceCode"
        @import-license="handleImportLicense"
        @refresh-license="loadActivationState"
        @close="isActivationCenterOpen = false"
      />
    </div>

    <AdminPasswordDialog
      :visible="isAdminPasswordDialogVisible"
      :password="adminPasswordDraft"
      :is-submitting="isAdminPasswordSubmitting"
      :feedback-message="adminPasswordFeedback"
      :title="adminStatusState.passwordConfigured ? t('admin.passwordTitleVerify') : t('admin.passwordTitleInit')"
      :description="adminStatusState.passwordConfigured ? t('admin.passwordDescriptionVerify') : t('admin.passwordDescriptionInit')"
      :confirm-label="adminStatusState.passwordConfigured ? t('admin.passwordConfirmVerify') : t('admin.passwordConfirmInit')"
      @update-password="adminPasswordDraft = $event"
      @confirm="handleConfirmAdminPassword"
      @close="handleCloseAdminPasswordDialog"
    />

    <AdminApiKeyDialog
      :visible="isAdminApiConfigUnlocked && isAdminApiKeyDialogVisible"
      :api-key="adminImageApiKeyDraft"
      :video-api-key="adminVideoApiKeyDraft"
      :is-saving="isAdminApiKeySaving"
      :feedback-message="adminApiKeyFeedback"
      @update-api-key="adminImageApiKeyDraft = $event"
      @update-video-api-key="adminVideoApiKeyDraft = $event"
      @save="handleSaveAdminApiKey"
      @close="handleCloseAdminApiKeyDialog"
    />

    <div
      v-if="isSourcingWorkflowConfigVisible"
      class="sourcing-workflow-config-modal"
      role="dialog"
      aria-modal="true"
      :aria-label="sourcingWorkflowConfigMode === 'generate' ? '一键生成联动配置' : '一键编辑联动配置'"
      @click.self="closeSourcingWorkflowConfig"
    >
      <div class="sourcing-workflow-config-modal__card">
        <header class="sourcing-workflow-config-modal__header">
          <strong>{{ sourcingWorkflowConfigMode === 'generate' ? '一键生成联动配置' : '一键编辑联动配置' }}</strong>
          <span>配置选品和“文本 / 生图 / 视频”的联动默认规则，保存后会直接影响当前快捷流程。</span>
        </header>

        <section class="sourcing-workflow-config-panel">
          <div class="sourcing-workflow-config-panel__block">
            <div class="sourcing-workflow-config-panel__title">
              <strong>文本</strong>
              <label class="sourcing-workflow-config-toggle">
                <input v-model="sourcingWorkflowConfigDraft[sourcingWorkflowConfigMode].text.enabled" type="checkbox" />
                <span>参与联动</span>
              </label>
            </div>
            <div class="sourcing-workflow-config-panel__grid">
              <label class="form-field">
                <span>批次</span>
                <input v-model="sourcingWorkflowConfigDraft[sourcingWorkflowConfigMode].text.batchCount" type="number" min="1" max="20" />
              </label>
              <label class="form-field">
                <span>字数要求</span>
                <input v-model="sourcingWorkflowConfigDraft[sourcingWorkflowConfigMode].text.lengthLimit" type="text" />
              </label>
            </div>
            <label class="form-field">
              <span>默认提示词</span>
              <textarea v-model="sourcingWorkflowConfigDraft[sourcingWorkflowConfigMode].text.promptInput" rows="4"></textarea>
            </label>
          </div>

          <div class="sourcing-workflow-config-panel__block">
            <div class="sourcing-workflow-config-panel__title">
              <strong>生图</strong>
              <label class="sourcing-workflow-config-toggle">
                <input v-model="sourcingWorkflowConfigDraft[sourcingWorkflowConfigMode].image.enabled" type="checkbox" />
                <span>参与联动</span>
              </label>
            </div>
            <div class="sourcing-workflow-config-panel__grid">
              <label class="form-field">
                <span>套图组数</span>
                <input v-model="sourcingWorkflowConfigDraft[sourcingWorkflowConfigMode].image.batchCount" type="number" min="1" max="8" />
              </label>
              <label class="form-field">
                <span>默认比例</span>
                <input v-model="sourcingWorkflowConfigDraft[sourcingWorkflowConfigMode].image.size" type="text" />
              </label>
            </div>
            <label class="form-field">
              <span>全局提示词</span>
              <textarea v-model="sourcingWorkflowConfigDraft[sourcingWorkflowConfigMode].image.globalPrompt" rows="4"></textarea>
            </label>
            <label class="form-field">
              <span>提示词标题</span>
              <textarea
                :value="(sourcingWorkflowConfigDraft[sourcingWorkflowConfigMode].image.promptTitles || []).join('\n')"
                rows="3"
                @input="sourcingWorkflowConfigDraft[sourcingWorkflowConfigMode].image.promptTitles = normalizePromptTitleList($event.target.value)"
              ></textarea>
            </label>
          </div>

          <div class="sourcing-workflow-config-panel__block">
            <div class="sourcing-workflow-config-panel__title">
              <strong>视频</strong>
              <label class="sourcing-workflow-config-toggle">
                <input v-model="sourcingWorkflowConfigDraft[sourcingWorkflowConfigMode].video.enabled" type="checkbox" />
                <span>参与联动</span>
              </label>
            </div>
            <div class="sourcing-workflow-config-panel__grid">
              <label class="form-field">
                <span>生成方式</span>
                <select v-model="sourcingWorkflowConfigDraft[sourcingWorkflowConfigMode].video.operation">
                  <option value="auto">自动判断</option>
                  <option value="image">优先图生视频</option>
                  <option value="text">优先文生视频</option>
                </select>
              </label>
              <label class="form-field">
                <span>时长</span>
                <input v-model="sourcingWorkflowConfigDraft[sourcingWorkflowConfigMode].video.duration" type="text" />
              </label>
              <label class="form-field">
                <span>比例</span>
                <input v-model="sourcingWorkflowConfigDraft[sourcingWorkflowConfigMode].video.aspectRatio" type="text" />
              </label>
              <label class="form-field">
                <span>规格</span>
                <input v-model="sourcingWorkflowConfigDraft[sourcingWorkflowConfigMode].video.size" type="text" />
              </label>
            </div>
            <label class="form-field">
              <span>默认提示词</span>
              <textarea v-model="sourcingWorkflowConfigDraft[sourcingWorkflowConfigMode].video.promptInput" rows="4"></textarea>
            </label>
          </div>
        </section>

        <footer class="sourcing-workflow-config-modal__actions">
          <button class="secondary-action" type="button" @click="closeSourcingWorkflowConfig">
            取消
          </button>
          <button class="primary-action" type="button" @click="saveSourcingWorkflowConfig">
            保存配置
          </button>
        </footer>
      </div>
    </div>
  </main>
</template>
