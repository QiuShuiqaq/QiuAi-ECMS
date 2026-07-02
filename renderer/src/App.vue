<script setup>
import { computed, onMounted, onUnmounted, reactive, ref, watch } from 'vue'
import AppTopBar from './components/AppTopBar.vue'
import ActivationGate from './components/ActivationGate.vue'
import CommerceOrderModal from './components/CommerceOrderModal.vue'
import ModelPricingModal from './components/ModelPricingModal.vue'
import PermissionActivationModal from './components/PermissionActivationModal.vue'
import UserAgreementModal from './components/UserAgreementModal.vue'
import WorkspaceSidebar from './components/WorkspaceSidebar.vue'
import GenerationCenterPage from './components/GenerationCenterPage.vue'
import GeneratorStudioPage from './components/GeneratorStudioPage.vue'
import TextGeneratorPage from './components/TextGeneratorPage.vue'
import DataCenterPage from './components/DataCenterPage.vue'
import ProjectTemplateCenterPage from './components/ProjectTemplateCenterPage.vue'
import PublishCenterPage from './components/PublishCenterPage.vue'
import AccountDevicePage from './components/AccountDevicePage.vue'
import SettingsCenterPage from './components/SettingsCenterPage.vue'
import PurchaseCenterPage from './components/PurchaseCenterPage.vue'
import SelectionCenterPage from './components/SelectionCenterPage.vue'
import studioMenuConfig from '../../shared/studio-menu-config.json'
import {
  buildProjectGeneratorDraft,
  buildProjectTextGeneratorDraft,
  buildWorkspaceRunDraft
} from './utils/generatorDraftBuilders'
import {
  createComputePackageOrderController,
  createRechargeOrderController,
  createSoftwareOrderController
} from './utils/purchaseControllerConfigs'
import { validateGeneratorTaskDraft } from './utils/generatorTaskValidation'
import { resolveGeneratorView } from './utils/generatorViews'
import { validatePublishDraftBeforeRemote } from './utils/publishDraftValidation'
import {
  fallbackPublishPlatformProfiles,
  normalizePublishPlatform,
  normalizeProjectPublishDraft,
  normalizePublishPlatformProfiles,
  publishPlatformOptions,
  resolvePublishTaskOperation
} from './utils/publishContract'
import {
  resolveImageOutputDirectory,
  resolveLatestRun,
  resolveVideoOutputDirectory
} from './utils/workspaceOutputLocators'
import { clearStudioRuntimeState } from './services/desktopBridge'
import {
  activationClient,
  catalogClient,
  complianceClient,
  commerceClient,
  projectTemplateClient,
  promptLibraryClient,
  publishClient,
  selectionClient,
  shellClient,
  workspaceClient
} from './services/platformClient'

/* legacy fallback menu removed
  { key: 'workbench', label: '工作台', section: '主线' },
  { key: 'purchase-center', label: '购买中心', section: '主线' },
  { key: 'prompt-library', label: '提示词库', section: '主线' },
  { key: 'account-device', label: '账户与用量', section: '支持' },
  { key: 'settings-center', label: '设置与支持', section: '支持' }
] */

const fallbackMenuItems = [
  { key: 'selection-center', label: 'Selection Center', section: '工作区' },
  { key: 'work-center', label: '工作中心', section: '工作区' },
  { key: 'data-center', label: '数据中心', section: '工作区' },
  { key: 'template-center', label: '模板中心', section: '工作区' },
  { key: 'publish-center', label: '发布中心', section: '工作区' },
  { key: 'title-generate', label: '标题生成', section: '生成区' },
  { key: 'description-generate', label: '描述生成', section: '生成区' },
  { key: 'series-generate', label: '套图生成', section: '生成区' },
  { key: 'video-generate', label: '视频生成', section: '生成区' },
  { key: 'prompt-library', label: '提示词库', section: '支持区' },
  { key: 'account-device', label: '账户设备', section: '支持区' }
]

const menuItems = Array.isArray(studioMenuConfig.primaryMenuItems)
  ? studioMenuConfig.primaryMenuItems
  : fallbackMenuItems
const activeMenu = ref('work-center')
const commerceOrderModalVisible = ref(false)
const commerceOrderModalMode = ref('software')
const modelPricingModalVisible = ref(false)
const permissionActivationModalVisible = ref(false)
const activeGeneratorMenu = ref('')
const submitButtonState = ref('idle')
const formDrafts = ref({})
const resultsByMenu = ref({})
const exportItemsByMenu = ref({})
const productProjects = ref([])
const projectRuns = ref([])
const activeProductProjectId = ref('')
const selectionManifest = ref({ generatedAt: '', boards: [] })
const selectionPlatforms = ref([])
const selectionSites = ref([])
const selectionItemsState = ref({
  platform: 'temu',
  boardType: 'hot-sale',
  siteCode: '',
  keyword: '',
  items: [],
  totalItems: 0,
  page: 1,
  pageSize: 10,
  isLoading: false,
  error: ''
})
const selectionUpdateStatus = ref('')
const publishState = ref({})
const publishConfigState = ref({
  platformOptions: publishPlatformOptions,
  platformProfiles: fallbackPublishPlatformProfiles,
  source: 'fallback',
  isLoading: false,
  error: ''
})

function normalizeSeriesSourceItems(sourceItems = [], fallbackAssignments = []) {
  const items = Array.isArray(sourceItems) ? sourceItems : []
  const assignments = Array.isArray(fallbackAssignments) ? fallbackAssignments : []

  return items
    .map((item, index) => {
      const sourceImage = item?.sourceImage || item?.image || null
      if (!sourceImage || typeof sourceImage !== 'object') {
        return null
      }

      const assignment = assignments[index] || {}
      return {
        id: String(item.id || sourceImage.id || `series-source-${index + 1}`),
        sourceImage,
        templateId: String(item.templateId || assignment.templateId || ''),
        prompt: String(item.prompt || assignment.prompt || ''),
        size: String(item.size || '').trim() || '1:1',
        imageType: String(item.imageType || assignment.imageType || '').trim(),
        differenceLevel: String(item.differenceLevel || assignment.differenceLevel || 'off').trim() || 'off'
      }
    })
    .filter(Boolean)
}

function buildSeriesSourceItemsFromFiles(files = [], fallbackAssignments = []) {
  return normalizeSeriesSourceItems(
    files.map((file, index) => {
      const assignment = fallbackAssignments[index] || {}
      return {
        id: String(file.id || `series-source-${index + 1}`),
        sourceImage: file,
        templateId: assignment.templateId || '',
        prompt: assignment.prompt || '',
        size: '1:1',
        imageType: assignment.imageType || '',
        differenceLevel: assignment.differenceLevel || 'off'
      }
    }),
    fallbackAssignments
  )
}
const studioTasks = ref([])
const studioAgentReadiness = ref({
  queue: {
    queuedCount: 0,
    runningCount: 0,
    isProcessing: false,
    queuedTaskIds: [],
    activeTaskIds: []
  },
  executionLog: []
})
const workspaceDashboard = ref({
  creditOverview: { ledgers: [] },
  creditMessages: { ledgers: [] }
})
const settingsSummary = ref({
  dashboardCreditState: {
    text: { balanceCny: 0, subscriptionBalanceCny: 0, permanentBalanceCny: 0, lastSyncedAt: '', syncStatus: 'idle' },
    image: { balanceCny: 0, subscriptionBalanceCny: 0, permanentBalanceCny: 0, lastSyncedAt: '', syncStatus: 'idle' },
    video: { balanceCny: 0, subscriptionBalanceCny: 0, permanentBalanceCny: 0, lastSyncedAt: '', syncStatus: 'idle' }
  }
})
const studioRemoteServiceCapacity = ref(null)
const promptTemplates = ref([])
const projectTemplates = ref([])
const activationState = ref({
  status: 'not_logged_in',
  customerName: '',
  deviceCode: '',
  activatedAt: '',
  message: '',
  mode: 'server-license'
})
const isDataCenterRefreshingBalances = ref(false)
const activationForm = ref({
  customerName: '',
  contact: '',
  inviteCode: ''
})
const userAgreementState = ref({
  title: '用户须知与使用协议暨责任认定书',
  version: 'QIUAI-ECMS-USER-NOTICE-v4.0',
  accepted: false,
  acceptedAt: '',
  shouldShow: false,
  userId: '',
  licenseId: '',
  deviceCode: '',
  customerName: '',
  source: 'DESKTOP_QIUAI'
})
const isActivationLoading = ref(true)
const isPermissionActivating = ref(false)
const isUserAgreementSubmitting = ref(false)
const isCatalogLoading = ref(false)
const isRechargeSubmitting = ref(false)
const isRechargeRefreshing = ref(false)
const isSoftwareOrderSubmitting = ref(false)
const isSoftwareOrderRefreshing = ref(false)
const isComputePackageOrderSubmitting = ref(false)
const isComputePackageOrderRefreshing = ref(false)
const currentRechargeOrder = ref(null)
const currentSoftwareOrder = ref(null)
const currentComputePackageOrder = ref(null)
const softwarePackages = ref([])
const computePackages = ref([])
const rechargeForm = reactive({
  walletType: 'image',
  channel: 'alipay',
  amountCny: '1'
})
const actionNotice = reactive({
  visible: false,
  type: 'success',
  title: '',
  message: ''
})
const runtimePollingIntervalMs = 1500
let runtimePollingTimer = null
let runtimePollingInFlight = false
let selectionManifestPollingTimer = null
let selectionManifestPollingInFlight = false
const publishTaskPollingProfile = {
  fastMs: 5000,
  runningMs: 15000,
  reviewMs: 300000
}
let publishTaskPollingTimer = null
let publishTaskPollingInFlight = false
let rechargeOrderController = null
let softwareOrderController = null
let computePackageOrderController = null
const purchaseOrderStorageKey = 'qiuai-purchase-orders'
const emptyGeneratorResultPayload = {
  textResults: [],
  comparisonResults: [],
  groupedResults: [],
  summary: null
}

function readPersistedPurchaseOrders() {
  if (typeof window === 'undefined' || !window.localStorage) {
    return {
      software: null,
      compute: null,
      recharge: null
    }
  }

  try {
    const raw = window.localStorage.getItem(purchaseOrderStorageKey)
    if (!raw) {
      return {
        software: null,
        compute: null,
        recharge: null
      }
    }

    const parsed = JSON.parse(raw)
    return {
      software: parsed?.software && typeof parsed.software === 'object' ? parsed.software : null,
      compute: parsed?.compute && typeof parsed.compute === 'object' ? parsed.compute : null,
      recharge: parsed?.recharge && typeof parsed.recharge === 'object' ? parsed.recharge : null
    }
  } catch {
    return {
      software: null,
      compute: null,
      recharge: null
    }
  }
}

function writePersistedPurchaseOrders(patch = {}) {
  if (typeof window === 'undefined' || !window.localStorage) {
    return
  }

  const current = readPersistedPurchaseOrders()
  const nextValue = {
    software: Object.prototype.hasOwnProperty.call(patch, 'software') ? patch.software : current.software,
    compute: Object.prototype.hasOwnProperty.call(patch, 'compute') ? patch.compute : current.compute,
    recharge: Object.prototype.hasOwnProperty.call(patch, 'recharge') ? patch.recharge : current.recharge
  }

  window.localStorage.setItem(purchaseOrderStorageKey, JSON.stringify(nextValue))
}

function persistPurchaseOrder(kind, order) {
  if (!kind) {
    return
  }

  writePersistedPurchaseOrders({
    [kind]: order && typeof order === 'object' ? order : null
  })
}

function restorePersistedPurchaseOrders() {
  const stored = readPersistedPurchaseOrders()
  currentSoftwareOrder.value = stored.software
  currentComputePackageOrder.value = stored.compute
  currentRechargeOrder.value = stored.recharge
}

const activeGeneratorMenuKey = computed(() => {
  const menuKey = String(activeGeneratorMenu.value || '').trim()
  return resolveGeneratorView(menuKey) ? menuKey : ''
})

const currentDraft = computed(() => {
  return formDrafts.value[activeGeneratorMenuKey.value] || {}
})

const currentResultPayload = computed(() => {
  return resultsByMenu.value[activeGeneratorMenuKey.value] || emptyGeneratorResultPayload
})

const currentExportItems = computed(() => {
  return exportItemsByMenu.value[activeGeneratorMenuKey.value] || []
})

const workspaceDraft = computed(() => formDrafts.value.workspace || {})
const workspaceResultPayload = computed(() => resultsByMenu.value.workspace || emptyGeneratorResultPayload)
const workspaceExportItems = computed(() => exportItemsByMenu.value.workspace || [])

const activeWorkspaceGeneratorView = computed(() => {
  const currentMenuKey = String(activeMenu.value || '').trim()
  if (!resolveGeneratorView(currentMenuKey)) {
    return null
  }

  return resolveGeneratorView(currentMenuKey)
})

const isWorkspaceGeneratorView = computed(() => Boolean(activeWorkspaceGeneratorView.value))
const activeTextGeneratorView = computed(() => {
  return activeWorkspaceGeneratorView.value?.mode === 'text' ? activeWorkspaceGeneratorView.value : null
})
const activeMediaGeneratorView = computed(() => {
  const mode = activeWorkspaceGeneratorView.value?.mode
  return mode === 'image' || mode === 'video' ? activeWorkspaceGeneratorView.value : null
})

const isWorkspaceHome = computed(() => {
  return activeMenu.value === 'work-center' && !isWorkspaceGeneratorView.value
})

const currentTextResultItems = computed(() => {
  const textKind = activeTextGeneratorView.value?.textKind
  if (!textKind) {
    return []
  }

  return (workspaceResultPayload.value.textResults || []).filter((item) => item?.kind === textKind)
})

const activationSummary = computed(() => {
  if (activationState.value.status !== 'activated') {
    return null
  }

  return {
    customerName: activationState.value.customerName || '已授权设备'
  }
})

const isActivated = computed(() => activationState.value.status === 'activated')
const canUseActivatedWorkspace = computed(() => isActivated.value && !userAgreementState.value.shouldShow)

const remoteServiceCapacity = computed(() => {
  return activationState.value.remoteServiceCapacity || studioRemoteServiceCapacity.value || null
})

const effectiveWalletSummary = computed(() => {
  const remoteWalletSummary = activationState.value?.walletSummary
  if (remoteWalletSummary && typeof remoteWalletSummary === 'object') {
    const hasSplitBalances = remoteWalletSummary.splitBalances && typeof remoteWalletSummary.splitBalances === 'object'
    const hasLegacyBalances = remoteWalletSummary.subscriptionBalances || remoteWalletSummary.permanentBalances
    if (hasSplitBalances || hasLegacyBalances) {
      return remoteWalletSummary
    }
  }

  const dashboardCreditState = settingsSummary.value?.dashboardCreditState || {}
  const buildResourceSummary = (resourceKey) => {
    const resourceState = dashboardCreditState?.[resourceKey] || {}
    const subscriptionBalanceCny = Math.max(0, Number(resourceState.subscriptionBalanceCny) || 0)
    const permanentBalanceCny = Math.max(0, Number(resourceState.permanentBalanceCny) || 0)
    const totalBalanceCny = Math.max(0, Number(resourceState.balanceCny) || (subscriptionBalanceCny + permanentBalanceCny))

    return {
      totalBalanceCny,
      subscriptionBalanceCny,
      permanentBalanceCny
    }
  }

  const text = buildResourceSummary('text')
  const image = buildResourceSummary('image')
  const video = buildResourceSummary('video')

  return {
    textBalanceCny: text.totalBalanceCny,
    imageBalanceCny: image.totalBalanceCny,
    videoBalanceCny: video.totalBalanceCny,
    subscriptionBalances: {
      text: text.subscriptionBalanceCny,
      image: image.subscriptionBalanceCny,
      video: video.subscriptionBalanceCny
    },
    permanentBalances: {
      text: text.permanentBalanceCny,
      image: image.permanentBalanceCny,
      video: video.permanentBalanceCny
    },
    splitBalances: {
      text,
      image,
      video
    },
    updatedAt: [
      dashboardCreditState?.text?.lastSyncedAt || '',
      dashboardCreditState?.image?.lastSyncedAt || '',
      dashboardCreditState?.video?.lastSyncedAt || ''
    ].filter(Boolean).sort().at(-1) || ''
  }
})

function getWalletBalanceSummary() {
  const walletSummary = effectiveWalletSummary.value
  const resolveBalance = (resourceKey) => {
    const splitBalance = walletSummary?.splitBalances?.[resourceKey]
    if (splitBalance && typeof splitBalance === 'object') {
      return Math.max(0, Number(splitBalance.totalBalanceCny) || 0)
    }

    const subscription = Math.max(0, Number(walletSummary?.subscriptionBalances?.[resourceKey]) || 0)
    const permanent = Math.max(0, Number(walletSummary?.permanentBalances?.[resourceKey]) || 0)
    const combined = subscription + permanent
    if (combined > 0) {
      return combined
    }

    return 0
  }

  return {
    text: resolveBalance('text'),
    image: resolveBalance('image'),
    video: resolveBalance('video')
  }
}

function assertClientSideBalanceForTask({ menuKey, draft, textKind = '' } = {}) {
  const balance = getWalletBalanceSummary()
  const seriesSourceItems = normalizeSeriesSourceItems(draft?.seriesSourceItems, draft?.promptAssignments)
  const hasSeriesInput = Boolean(seriesSourceItems.length || draft?.sourceImage)

  if (menuKey === 'workspace' && textKind) {
    if (balance.text <= 0) {
      return textKind === 'description'
        ? '文本余额不足，无法发起描述生成任务'
        : '文本余额不足，无法发起标题生成任务'
    }
    return ''
  }

  if (menuKey === 'series-generate' && balance.image <= 0) {
    return '图片余额不足，无法发起套图生成任务'
  }

  if (menuKey === 'video-generate' && balance.video <= 0) {
    return '视频余额不足，无法发起视频生成任务'
  }

  if (menuKey === 'workspace') {
    const enabledSteps = draft?.enabledSteps || {}
    if ((enabledSteps.title || enabledSteps.description) && balance.text <= 0) {
      return '文本余额不足，无法发起当前项目任务'
    }
    if (enabledSteps.image && hasSeriesInput && balance.image <= 0) {
      return '图片余额不足，无法发起当前项目任务'
    }
    if (enabledSteps.video && balance.video <= 0) {
      return '视频余额不足，无法发起当前项目任务'
    }
  }

  return ''
}

function showActionFeedback({ type = 'success', title = '', message = '' }) {
  actionNotice.visible = true
  actionNotice.type = type
  actionNotice.title = title
  actionNotice.message = message
  window.setTimeout(() => {
    actionNotice.visible = false
  }, 2400)
}

function ensureActivatedOrPromptPurchase(message = '请先购买授权并激活当前设备') {
  if (canUseActivatedWorkspace.value) {
    return true
  }

  openLicensePurchase()
  showActionFeedback({
    type: 'error',
    title: '当前未授权',
    message
  })
  return false
}

function buildErrorMessage(error, fallback = '请求失败') {
  const errorCode = String(error?.code || '').trim()
  if (errorCode === 'CONTACT_NAME_MISMATCH') {
    return '该手机号已经购买过产品，如有疑问请联系管理员'
  }

  if (errorCode === 'USERNAME_ALREADY_USED') {
    return '该用户名已被使用，请更换其他用户名'
  }

  if (errorCode === 'CONTACT_REQUIRED') {
    return '请输入手机号'
  }

  if (errorCode === 'CUSTOMER_NAME_REQUIRED') {
    return '请输入用户名'
  }

  return String(error?.message || fallback)
}

function applyProjectPatchLocally(project = {}, patch = {}) {
  const currentProject = project && typeof project === 'object' ? project : {}
  const nextPatch = patch && typeof patch === 'object' ? patch : {}
  const baseInfoPatch = nextPatch.baseInfo && typeof nextPatch.baseInfo === 'object' ? nextPatch.baseInfo : {}
  const generationConfigPatch = nextPatch.generationConfig && typeof nextPatch.generationConfig === 'object'
    ? nextPatch.generationConfig
    : {}
  const assetsPatch = nextPatch.assets && typeof nextPatch.assets === 'object' ? nextPatch.assets : {}
  const contentPatch = nextPatch.content && typeof nextPatch.content === 'object' ? nextPatch.content : {}
  const metadataPatch = nextPatch.metadata && typeof nextPatch.metadata === 'object' ? nextPatch.metadata : {}

  return {
    ...currentProject,
    ...nextPatch,
    baseInfo: {
      ...(currentProject.baseInfo || {}),
      ...baseInfoPatch
    },
    generationConfig: {
      ...(currentProject.generationConfig || {}),
      ...generationConfigPatch
    },
    assets: {
      ...(currentProject.assets || {}),
      ...assetsPatch
    },
    content: {
      ...(currentProject.content || {}),
      ...contentPatch
    },
    metadata: {
      ...(currentProject.metadata || {}),
      ...metadataPatch
    }
  }
}

function applyStudioRuntimeSnapshot(snapshot = {}) {
  resultsByMenu.value = snapshot.resultsByMenu || {}
  exportItemsByMenu.value = snapshot.exportItemsByMenu || {}
  productProjects.value = snapshot.productProjects || []
  projectRuns.value = snapshot.projectRuns || []
  activeProductProjectId.value = snapshot.activeProductProjectId || ''
  studioTasks.value = snapshot.tasks || []
  studioAgentReadiness.value = snapshot.agentReadiness || studioAgentReadiness.value
  studioRemoteServiceCapacity.value = snapshot.remoteServiceCapacity || studioRemoteServiceCapacity.value
  settingsSummary.value = snapshot.settingsSummary || settingsSummary.value
}

function isStudioTaskActive(task = {}) {
  const status = String(task?.status || '').trim()
  return [
    '等待中',
    '进行中',
    '处理中',
    'pending',
    'running',
    'submitting',
    'Preparing',
    'Queueing',
    'Processing'
  ].includes(status)
}

const hasActiveStudioTasks = computed(() => {
  return (studioTasks.value || []).some((task) => isStudioTaskActive(task)) ||
    Boolean(studioAgentReadiness.value?.queue?.isProcessing)
})

const publishTaskTerminalStatuses = new Set([
  'blocked',
  'succeeded',
  'failed-retryable',
  'failed-final',
  'cancelled'
])

function isPublishTaskActive(task = null) {
  const status = String(task?.status || '').trim()
  return Boolean(status) && !publishTaskTerminalStatuses.has(status)
}

function resolvePublishTaskBlockingIssues(task = null) {
  if (Array.isArray(task?.blockingIssues)) {
    return task.blockingIssues
  }

  const attempts = Array.isArray(task?.attempts) ? task.attempts : []
  const lastAttempt = attempts.length ? attempts[attempts.length - 1] : null
  return Array.isArray(lastAttempt?.normalizedErrors) ? lastAttempt.normalizedErrors : []
}

function buildPublishTaskFeedback(task = null, fallbackTitle = '发布任务已创建') {
  const status = String(task?.status || '').trim()
  if (status === 'blocked') {
    const blockingIssues = resolvePublishTaskBlockingIssues(task)
    return {
      type: 'error',
      title: '发布任务已阻塞',
      message: blockingIssues.length
        ? `检测到 ${blockingIssues.length} 项待处理问题，请先修正发布草稿后重试。`
        : (String(task?.lastErrorMessage || '').trim() || '发布任务已被阻塞，请检查当前发布草稿。')
    }
  }

  return {
    type: 'success',
    title: fallbackTitle,
    message: `发布任务状态：${status || 'queued'}`
  }
}

const hasActivePublishTasks = computed(() => {
  return Object.values(publishState.value || {}).some((state) => isPublishTaskActive(state?.latestTask))
})

function stopRuntimePolling() {
  if (runtimePollingTimer) {
    window.clearTimeout(runtimePollingTimer)
    runtimePollingTimer = null
  }
}

function stopPublishTaskPolling() {
  if (publishTaskPollingTimer) {
    window.clearTimeout(publishTaskPollingTimer)
    publishTaskPollingTimer = null
  }
}

function stopSelectionManifestPolling() {
  if (selectionManifestPollingTimer) {
    window.clearTimeout(selectionManifestPollingTimer)
    selectionManifestPollingTimer = null
  }
}

function queueSelectionManifestPolling(delayMs = 5000) {
  stopSelectionManifestPolling()
  selectionManifestPollingTimer = window.setTimeout(() => {
    void refreshSelectionManifest({ silent: true })
  }, delayMs)
}

function queueRuntimePolling(delayMs = runtimePollingIntervalMs) {
  stopRuntimePolling()
  runtimePollingTimer = window.setTimeout(() => {
    void pollStudioRuntimeSnapshot()
  }, delayMs)
}

function queuePublishTaskPolling(delayMs = publishTaskPollingProfile.runningMs) {
  stopPublishTaskPolling()
  publishTaskPollingTimer = window.setTimeout(() => {
    void pollPublishTasks()
  }, delayMs)
}

function getPublishTaskPollingDelayMs(task = null) {
  const advice = task && typeof task.pollingAdvice === 'object'
    ? task.pollingAdvice
    : null
  const recommendedIntervalMs = Number(advice?.recommendedIntervalMs)
  const minIntervalMs = Number(advice?.minIntervalMs)

  if (Number.isFinite(recommendedIntervalMs) && recommendedIntervalMs > 0) {
    const safeMinimum = Number.isFinite(minIntervalMs) && minIntervalMs > 0 ? minIntervalMs : 1000
    return Math.max(safeMinimum, recommendedIntervalMs)
  }

  if (Number.isFinite(recommendedIntervalMs) && recommendedIntervalMs === 0) {
    return 0
  }

  const status = String(task?.status || '').trim().toLowerCase()
  if (!status) {
    return publishTaskPollingProfile.runningMs
  }

  if (status === 'queued' || status === 'running' || status === 'validating') {
    return publishTaskPollingProfile.runningMs
  }

  if (status === 'awaiting-platform-review') {
    return publishTaskPollingProfile.reviewMs
  }

  return publishTaskPollingProfile.fastMs
}

function resolvePublishPollingDelayMs(projectEntries = []) {
  if (!Array.isArray(projectEntries) || !projectEntries.length) {
    return publishTaskPollingProfile.runningMs
  }

  return projectEntries.reduce((minDelay, [, state]) => {
    const nextDelay = getPublishTaskPollingDelayMs(state?.latestTask)
    return Math.min(minDelay, nextDelay)
  }, publishTaskPollingProfile.reviewMs)
}

async function pollStudioRuntimeSnapshot() {
  if (!isActivated.value || runtimePollingInFlight) {
    if (isActivated.value && hasActiveStudioTasks.value) {
      queueRuntimePolling()
    }
    return
  }

  runtimePollingInFlight = true
  try {
    const snapshot = await workspaceClient.getRuntimeSnapshot()
    applyStudioRuntimeSnapshot(snapshot)
  } catch {
    // Ignore transient polling failures while tasks are still active.
  } finally {
    runtimePollingInFlight = false
    if (isActivated.value && hasActiveStudioTasks.value) {
      queueRuntimePolling()
    } else {
      stopRuntimePolling()
    }
  }
}

async function pollPublishTasks() {
  if (!isActivated.value || publishTaskPollingInFlight) {
    if (isActivated.value && hasActivePublishTasks.value) {
      queuePublishTaskPolling(resolvePublishPollingDelayMs(
        Object.entries(publishState.value || {}).filter(([, state]) => isPublishTaskActive(state?.latestTask))
      ))
    }
    return
  }

  const activeProjectEntries = Object.entries(publishState.value || {}).filter(([, state]) => {
    return isPublishTaskActive(state?.latestTask)
  })

  if (!activeProjectEntries.length) {
    stopPublishTaskPolling()
    return
  }

  publishTaskPollingInFlight = true
  try {
    await Promise.all(activeProjectEntries.map(async ([projectId, state]) => {
      const taskId = String(state?.latestTask?.id || '').trim()
      if (!taskId) {
        return
      }

      try {
        const task = await publishClient.getTask({
          id: taskId
        })
        patchProjectPublishState(projectId, {
          latestTask: task
        })
      } catch {
        // Ignore transient polling failures and keep polling until the task reaches a terminal state.
      }
    }))
  } finally {
    publishTaskPollingInFlight = false
    if (isActivated.value && hasActivePublishTasks.value) {
      queuePublishTaskPolling(resolvePublishPollingDelayMs(
        Object.entries(publishState.value || {}).filter(([, state]) => isPublishTaskActive(state?.latestTask))
      ))
    } else {
      stopPublishTaskPolling()
    }
  }
}

async function loadPromptTemplateState() {
  promptTemplates.value = await promptLibraryClient.listTemplates()
}

async function loadProjectTemplateState() {
  projectTemplates.value = await projectTemplateClient.listTemplates()
}

async function loadActivationState() {
  isActivationLoading.value = true
  try {
    activationState.value = await activationClient.getStatus()
    if (activationState.value.customerName && !activationForm.value.customerName) {
      activationForm.value.customerName = activationState.value.customerName
    }
  } finally {
    isActivationLoading.value = false
  }
}

async function loadUserAgreementState() {
  if (activationState.value.status !== 'activated') {
    userAgreementState.value = {
      title: '用户须知与使用协议暨责任认定书',
      version: 'QIUAI-ECMS-USER-NOTICE-v4.0',
      accepted: false,
      acceptedAt: '',
      shouldShow: false,
      userId: '',
      licenseId: '',
      deviceCode: '',
      customerName: '',
      source: 'DESKTOP_QIUAI'
    }
    return
  }

  try {
    userAgreementState.value = await complianceClient.getUserAgreementStatus()
  } catch {
    userAgreementState.value = {
      title: '用户须知与使用协议暨责任认定书',
      version: 'QIUAI-ECMS-USER-NOTICE-v4.0',
      accepted: false,
      acceptedAt: '',
      shouldShow: true,
      userId: activationState.value.userId || '',
      licenseId: activationState.value.licenseId || '',
      deviceCode: activationState.value.deviceCode || '',
      customerName: activationState.value.customerName || '',
      source: 'DESKTOP_QIUAI'
    }
  }
}

async function loadStudioSnapshot() {
  const snapshot = await workspaceClient.getSnapshot()
  formDrafts.value = snapshot.formDrafts || {}
  workspaceDashboard.value = snapshot.workspaceDashboard || workspaceDashboard.value
  settingsSummary.value = snapshot.settingsSummary || settingsSummary.value
  applyStudioRuntimeSnapshot(snapshot)
}

async function loadActivatedWorkspace() {
  await Promise.all([
    loadStudioSnapshot(),
    loadPromptTemplateState(),
    loadProjectTemplateState(),
    loadPurchaseCenterCatalog(),
    loadSelectionAssistantState(),
    loadPublishConfigState()
  ])
}

async function handleRefreshDataCenterBalances() {
  if (isDataCenterRefreshingBalances.value) {
    return
  }

  isDataCenterRefreshingBalances.value = true
  try {
    await loadActivationState()
    await loadPurchaseCenterCatalog()
    showActionFeedback({
      type: 'success',
      title: '\u4f59\u989d\u5df2\u5237\u65b0',
      message: '\u5f53\u524d\u8d26\u53f7\u7684\u4f59\u989d\u72b6\u6001\u5df2\u66f4\u65b0'
    })
  } catch (error) {
    showActionFeedback({
      type: 'error',
      title: '\u5237\u65b0\u5931\u8d25',
      message: buildErrorMessage(error, '\u4f59\u989d\u72b6\u6001\u5237\u65b0\u5931\u8d25')
    })
  } finally {
    isDataCenterRefreshingBalances.value = false
  }
}

function getSelectionUpdateState() {
  return selectionManifest.value?.updateState || {}
}

function showSelectionUpdateFeedback(manifest = {}, { silent = false } = {}) {
  const nextStatus = String(manifest?.updateState?.status || '').trim()
  const previousStatus = String(selectionUpdateStatus.value || '').trim()
  selectionUpdateStatus.value = nextStatus

  if (silent || !nextStatus || nextStatus === previousStatus) {
    return
  }

  if (nextStatus === 'updating') {
    showActionFeedback({
      type: 'success',
      title: '选品数据开始更新',
      message: '更新期间请不要操作选品中心'
    })
    return
  }

  if (nextStatus === 'success' && previousStatus === 'updating') {
    showActionFeedback({
      type: 'success',
      title: '选品数据更新完成',
      message: '现在可以正常使用选品中心'
    })
    return
  }

  if (nextStatus === 'failed' || nextStatus === 'risk-stop') {
    showActionFeedback({
      type: 'error',
      title: '选品数据更新异常',
      message: manifest?.updateState?.message || '请联系管理员'
    })
  }
}

async function refreshSelectionManifest({ silent = false } = {}) {
  if (selectionManifestPollingInFlight) {
    return selectionManifest.value
  }

  selectionManifestPollingInFlight = true
  try {
    const manifest = await selectionClient.getManifest()
    selectionManifest.value = manifest || { generatedAt: '', boards: [] }
    showSelectionUpdateFeedback(selectionManifest.value, { silent })
  } finally {
    selectionManifestPollingInFlight = false
  }

  if (selectionManifest.value?.updateState?.isUpdating) {
    queueSelectionManifestPolling()
  } else {
    stopSelectionManifestPolling()
  }

  return selectionManifest.value
}

async function loadSelectionAssistantState() {
  await refreshSelectionManifest()
  selectionPlatforms.value = await selectionClient.listPlatforms()
  const availablePlatformKeys = new Set(selectionPlatforms.value.map((item) => String(item?.key || '').trim()).filter(Boolean))
  if (availablePlatformKeys.size && !availablePlatformKeys.has(selectionItemsState.value.platform)) {
    selectionItemsState.value = {
      ...selectionItemsState.value,
      platform: selectionPlatforms.value[0]?.key || 'temu',
      siteCode: '',
      page: 1
    }
  }
  await refreshSelectionSites(selectionItemsState.value.platform)
  await refreshSelectionItems()
}

async function loadPublishConfigState() {
  publishConfigState.value = {
    ...publishConfigState.value,
    isLoading: true,
    error: ''
  }

  try {
    const payload = await publishClient.getConfig({})
    const platformRows = Array.isArray(payload?.platforms) ? payload.platforms : []
    publishConfigState.value = {
      platformOptions: platformRows.length
        ? platformRows.map((item) => ({
            label: String(item.label || item.key || '').trim(),
            value: normalizePublishPlatform(item.key || '')
          }))
        : publishPlatformOptions,
      platformProfiles: normalizePublishPlatformProfiles(platformRows),
      source: 'server',
      isLoading: false,
      error: ''
    }
  } catch (error) {
    publishConfigState.value = {
      ...publishConfigState.value,
      source: 'fallback',
      isLoading: false,
      error: buildErrorMessage(error, '发布平台配置加载失败')
    }
  }
}

async function refreshSelectionSites(platform) {
  if (String(platform || '').trim().toLowerCase() !== 'shopee') {
    selectionSites.value = []
    selectionItemsState.value = {
      ...selectionItemsState.value,
      siteCode: ''
    }
    return
  }

  selectionSites.value = await selectionClient.listSites({ platform })
}

async function refreshSelectionItems(overrides = {}) {
  const nextState = {
    ...selectionItemsState.value,
    ...overrides
  }

  selectionItemsState.value = {
    ...nextState,
    isLoading: true,
    error: ''
  }

  try {
    await refreshSelectionManifest({ silent: true })
    const payload = await selectionClient.listItems({
      platform: nextState.platform,
      boardType: nextState.boardType,
      siteCode: nextState.siteCode,
      keyword: nextState.keyword,
      page: nextState.page,
      pageSize: nextState.pageSize
    })

    selectionItemsState.value = {
      ...nextState,
      items: Array.isArray(payload.items) ? payload.items : [],
      totalItems: Number(payload.totalItems) || 0,
      page: Number(payload.page) || nextState.page,
      pageSize: Number(payload.pageSize) || nextState.pageSize,
      isLoading: false,
      error: ''
    }
  } catch (error) {
    selectionItemsState.value = {
      ...nextState,
      items: [],
      totalItems: 0,
      isLoading: false,
      error: buildErrorMessage(error, '选品数据加载失败')
    }
  }
}

async function loadPurchaseCenterCatalog() {
  isCatalogLoading.value = true
  try {
    const softwareRows = await catalogClient.listSoftwarePackages()
    softwarePackages.value = Array.isArray(softwareRows) ? softwareRows : []

    if (!isActivated.value) {
      computePackages.value = []
      return
    }

    const computeRows = await catalogClient.listComputePackages()
    computePackages.value = Array.isArray(computeRows) ? computeRows : []
  } finally {
    isCatalogLoading.value = false
  }
}

function handleMenuSelect(menuKey) {
  activeGeneratorMenu.value = resolveGeneratorView(menuKey)?.mode ? menuKey : ''
  if (menuKey === 'work-center' && formDrafts.value.workspace?.projectId) {
    activeProductProjectId.value = formDrafts.value.workspace.projectId
  }
  if (menuKey === 'prompt-library' && (!Array.isArray(promptTemplates.value) || promptTemplates.value.length === 0)) {
    void loadPromptTemplateState()
  }
  activeMenu.value = menuKey
}

async function handleOpenProjectGenerator({ project, menuKey }) {
  if (!menuKey) {
    return
  }

  if (project?.id) {
    activeProductProjectId.value = project.id
    if (resolveGeneratorView(menuKey)?.mode === 'text') {
      await persistDraft('workspace', buildProjectTextGeneratorDraft(project, formDrafts.value.workspace || {}, resolveGeneratorView(menuKey)?.textKind))
    } else {
      await persistDraft(menuKey, buildProjectGeneratorDraft(project, menuKey))
    }
  }

  activeMenu.value = menuKey
  activeGeneratorMenu.value = menuKey
}

async function handleOpenProjectSettings(project) {
  if (!project?.id) {
    return
  }

  activeProductProjectId.value = project.id
  await persistDraft('workspace', buildWorkspaceRunDraft(project, {}))
  activeMenu.value = 'work-center'
  activeGeneratorMenu.value = ''
}

async function persistDraft(menuKey, patch) {
  const nextDraft = {
    ...(formDrafts.value[menuKey] || {}),
    ...patch
  }
  formDrafts.value = {
    ...formDrafts.value,
    [menuKey]: nextDraft
  }
  await workspaceClient.saveDraft({
    menuKey,
    patch
  })
}

async function handleDraftUpdate({ field, value }) {
  if (!activeGeneratorMenuKey.value) {
    return
  }

  await persistDraft(activeGeneratorMenuKey.value, {
    [field]: value
  })
}

async function handleTextGeneratorDraftUpdate({ field, value }) {
  await persistDraft('workspace', {
    [field]: value
  })
}

async function handleCreateProject() {
  if (!ensureActivatedOrPromptPurchase('请先购买授权激活设备后再新建项目')) {
    return
  }

  try {
    const createdProject = await workspaceClient.createProject({
      productName: '',
      platform: 'temu',
      language: 'zh-CN'
    })
    await loadStudioSnapshot()
    if (createdProject?.id) {
      activeProductProjectId.value = createdProject.id
      const currentProject = (productProjects.value || []).find((item) => item?.id === createdProject.id) || createdProject
      await persistDraft('workspace', buildWorkspaceRunDraft(currentProject, {}))
    }
    showActionFeedback({
      type: 'success',
      title: '已创建',
      message: '项目卡已加入工作台'
    })
  } catch (error) {
    showActionFeedback({
      type: 'error',
      title: '新建失败',
      message: buildErrorMessage(error, '新建项目失败')
    })
  }
}

async function handleReplaceProjectImage(project) {
  try {
    const result = await workspaceClient.pickInputAssets({
      menuKey: 'workspace',
      allowMultiple: false
    })

    if (result.canceled || !result.files?.[0] || !project?.id) {
      return
    }

    await workspaceClient.updateProject({
      projectId: project.id,
      patch: {
        assets: {
          sourceImages: [result.files[0]]
        }
      }
    })
    await persistDraft('workspace', {
      sourceImage: result.files[0]
    })
    invalidateProjectPublishState(project.id, {
      markDraftSummaryStale: true
    })
    await loadStudioSnapshot()
  } catch (error) {
    showActionFeedback({
      type: 'error',
      title: '更新失败',
      message: buildErrorMessage(error, '更新样图失败')
    })
  }
}

async function handleProjectUpdate({ projectId, patch }) {
  const normalizedProjectId = String(projectId || '').trim()
  const existingProject = (productProjects.value || []).find((item) => String(item?.id || '').trim() === normalizedProjectId)

  if (existingProject) {
    const optimisticProject = applyProjectPatchLocally(existingProject, patch)
    productProjects.value = [
      optimisticProject,
      ...(productProjects.value || []).filter((item) => String(item?.id || '').trim() !== normalizedProjectId)
    ]
    activeProductProjectId.value = normalizedProjectId
  }

  try {
    const updatedProject = await workspaceClient.updateProject({
      projectId,
      patch
    })
    if (updatedProject?.id) {
      productProjects.value = [
        updatedProject,
        ...(productProjects.value || []).filter((item) => item?.id !== updatedProject.id)
      ]
      activeProductProjectId.value = updatedProject.id
    }
    const affectsPublishDraft = doesPatchAffectPublishDraft(patch)
    invalidateProjectPublishState(projectId, {
      clearDraftSummary: affectsPublishDraft ? false : true,
      markDraftSummaryStale: affectsPublishDraft
    })
    await loadStudioSnapshot()
  } catch (error) {
    showActionFeedback({
      type: 'error',
      title: '更新失败',
      message: buildErrorMessage(error, '更新项目失败')
    })
  }
}

async function handleProjectDelete(projectId) {
  try {
    await workspaceClient.deleteProject({ projectId })
    await loadStudioSnapshot()
  } catch (error) {
    showActionFeedback({
      type: 'error',
      title: '删除失败',
      message: buildErrorMessage(error, '删除项目失败')
    })
  }
}

async function handleSelectionQueryChange(patch = {}) {
  if (getSelectionUpdateState().isUpdating) {
    showActionFeedback({
      type: 'error',
      title: '选品数据更新中',
      message: '请等待当前更新完成后再操作'
    })
    return
  }

  const nextPlatform = Object.prototype.hasOwnProperty.call(patch, 'platform')
    ? patch.platform
    : selectionItemsState.value.platform

  if (Object.prototype.hasOwnProperty.call(patch, 'platform')) {
    await refreshSelectionSites(nextPlatform)
  }

  const shouldResetPage = (
    Object.prototype.hasOwnProperty.call(patch, 'platform') ||
    Object.prototype.hasOwnProperty.call(patch, 'boardType') ||
    Object.prototype.hasOwnProperty.call(patch, 'siteCode') ||
    Object.prototype.hasOwnProperty.call(patch, 'keyword')
  )

  await refreshSelectionItems({
    ...patch,
    platform: nextPlatform,
    page: shouldResetPage
      ? 1
      : (Object.prototype.hasOwnProperty.call(patch, 'page') ? patch.page : selectionItemsState.value.page),
    siteCode: nextPlatform === 'shopee'
      ? (Object.prototype.hasOwnProperty.call(patch, 'siteCode') ? patch.siteCode : selectionItemsState.value.siteCode)
      : ''
  })
}

async function handleSelectionOpenSource(target = '') {
  const normalizedTarget = String(target || '').trim()
  if (!normalizedTarget) {
    return
  }

  try {
    await shellClient.openExternalResource({ target: normalizedTarget })
  } catch (error) {
    showActionFeedback({
      type: 'error',
      title: '打开失败',
      message: buildErrorMessage(error, '无法打开源地址')
    })
  }
}

async function handleSelectionImport({ item, mode }) {
  if (!item?.id) {
    return
  }

  if (!ensureActivatedOrPromptPurchase('请先购买授权激活设备后再导入商品')) {
    return
  }

  if (getSelectionUpdateState().isUpdating) {
    showActionFeedback({
      type: 'error',
      title: '选品数据更新中',
      message: '更新期间暂时不能导入项目'
    })
    return
  }

  try {
    const detail = await selectionClient.getItemDetail({ id: item.id })
    const highlights = []
    if (detail.subtitle) highlights.push(detail.subtitle)
    if (detail.priceText) highlights.push(`价格：${detail.priceText}`)
    if (detail.salesVolumeText) highlights.push(`销量：${detail.salesVolumeText}`)
    if (detail.ratingText) highlights.push(`评分：${detail.ratingText}`)

    const patch = {
      name: detail.title || '选品项目',
      sourceImageImportUrl: detail.primaryImageUrl || '',
      platformTarget: [String(detail.platform || 'temu').trim().toLowerCase() || 'temu'],
      baseInfo: {
        productName: detail.title || '',
        category: detail.categoryText || '',
        highlights,
        keywords: Array.isArray(detail.extractedKeywords) ? detail.extractedKeywords : [],
        language: 'zh-CN'
      },
      metadata: {
        selectionSource: {
          itemId: detail.id,
          platform: detail.platform,
          boardType: detail.boardType,
          siteCode: detail.siteCode || '',
          boardLabel: detail.boardLabel || '',
          title: detail.title || '',
          subtitle: detail.subtitle || '',
          categoryText: detail.categoryText || '',
          priceText: detail.priceText || '',
          salesVolumeText: detail.salesVolumeText || '',
          ratingText: detail.ratingText || '',
          extractedKeywords: Array.isArray(detail.extractedKeywords) ? detail.extractedKeywords : [],
          primaryImageUrl: detail.primaryImageUrl || '',
          capturedAt: detail.capturedAt,
          sourceDetailUrl: detail.sourceDetailUrl || '',
          importedAt: new Date().toISOString()
        }
      }
    }

    let nextProjectId = ''
    if (mode === 'update' && activeProductProjectId.value) {
      const updatedProject = await workspaceClient.updateProject({
        projectId: activeProductProjectId.value,
        patch
      })
      nextProjectId = updatedProject?.id || activeProductProjectId.value
      invalidateProjectPublishState(nextProjectId, {
        markDraftSummaryStale: true
      })
    } else {
      const createdProject = await workspaceClient.createProject({
        productName: detail.title || '',
        platform: String(detail.platform || 'temu').trim().toLowerCase() || 'temu',
        language: 'zh-CN',
        patch
      })
      nextProjectId = createdProject?.id || ''
    }

    await loadStudioSnapshot()
    if (nextProjectId) {
      activeProductProjectId.value = nextProjectId
    }
    await persistDraft('workspace', {
      projectId: nextProjectId,
      projectName: detail.title || '',
      taskName: detail.title || '',
      productName: detail.title || '',
      platformTargetsText: String(detail.platform || 'temu').trim().toLowerCase() || 'temu',
      language: 'zh-CN',
      category: detail.categoryText || '',
      highlightsText: highlights.join(', '),
      keywordsText: Array.isArray(detail.extractedKeywords) ? detail.extractedKeywords.join(', ') : '',
      selectionSource: patch.metadata.selectionSource,
      sourceImage: detail.primaryImageUrl
        ? {
            name: `${detail.id || 'selection-item'}.jpg`,
            preview: detail.primaryImageUrl,
            url: detail.primaryImageUrl
          }
        : null
    })
    activeMenu.value = 'work-center'
    showActionFeedback({
      type: 'success',
      title: '已导入',
      message: mode === 'update' ? '已覆盖当前项目素材' : '已新建工作台项目'
    })
  } catch (error) {
    showActionFeedback({
      type: 'error',
      title: '导入失败',
      message: buildErrorMessage(error, '选品条目导入失败')
    })
  }
}

function getProjectPublishState(project = {}) {
  const projectId = String(project?.id || '').trim()
  const platform = normalizePublishPlatform(
    publishState.value?.[projectId]?.selectedPlatform || project?.platformTarget?.[0] || ''
  )

  if (!publishState.value[projectId]) {
    publishState.value = {
      ...publishState.value,
      [projectId]: {
        selectedPlatform: platform,
        selectedChannelAccountId: '',
        channelAccounts: [],
        isSyncing: false,
        isLoadingAccounts: false,
        isPreviewLoading: false,
        isTaskLoading: false,
        error: '',
        preview: null,
        latestTask: null,
        draftSummary: null,
        publishConfig: publishConfigState.value
      }
    }
  }

  if (publishState.value[projectId]?.publishConfig !== publishConfigState.value) {
    publishState.value = {
      ...publishState.value,
      [projectId]: {
        ...publishState.value[projectId],
        publishConfig: publishConfigState.value
      }
    }
  }

  return publishState.value[projectId]
}

function resolveProjectPublishTaskOperation(project = {}) {
  const profile = resolveProjectServerPublishPlatformProfile(project)
  if (!profile) {
    return ''
  }

  return resolvePublishTaskOperation(profile)
}

function resolveProjectServerPublishPlatformProfile(project = {}) {
  const state = getProjectPublishState(project)
  const selectedPlatform = normalizePublishPlatform(
    state.selectedPlatform || project?.platformTarget?.[0] || ''
  )
  const publishConfig = state.publishConfig && typeof state.publishConfig === 'object'
    ? state.publishConfig
    : null

  if (String(publishConfig?.source || '').trim().toLowerCase() !== 'server') {
    return null
  }

  const platformProfiles = publishConfig?.platformProfiles && typeof publishConfig.platformProfiles === 'object'
    ? publishConfig.platformProfiles
    : null

  return platformProfiles?.[selectedPlatform] || null
}

function assertProjectPublishPlatformReady(project = {}, operationType = '') {
  const state = getProjectPublishState(project)
  const selectedPlatform = normalizePublishPlatform(
    state.selectedPlatform || project?.platformTarget?.[0] || ''
  )
  const profile = resolveProjectServerPublishPlatformProfile(project)

  if (!profile) {
    throw new Error('Server publish config is not loaded yet. Refresh publish config before previewing or creating tasks.')
  }

  const normalizedOperationType = String(operationType || '').trim()
  const supportedOperations = Array.isArray(profile.supportedOperations)
    ? profile.supportedOperations.map((item) => String(item || '').trim()).filter(Boolean)
    : []

  if (normalizedOperationType && !supportedOperations.includes(normalizedOperationType)) {
    throw new Error(
      `Server publish config does not enable ${normalizedOperationType} for ${profile.label || selectedPlatform}.`
    )
  }

  return {
    selectedPlatform,
    profile
  }
}

function validateProjectPublishDraftBeforeRemote(project = {}, selectedPlatform = '', profile = null, operationType = 'create-listing') {
  return validatePublishDraftBeforeRemote({
    project,
    platform: selectedPlatform,
    profile,
    operationType
  })
}

function buildLocalPublishValidationMessage(validationError = null) {
  const message = String(validationError?.message || '').trim()
  const missingFieldLabels = Array.isArray(validationError?.missingFieldLabels)
    ? validationError.missingFieldLabels.map((item) => String(item || '').trim()).filter(Boolean)
    : []

  if (!missingFieldLabels.length) {
    return message
  }

  return `${message} Missing Fields: ${missingFieldLabels.join(', ')}`
}

function buildPublishDraftSummaryStaleMessage() {
  return 'Publish draft summary is outdated. Sync publish draft again to refresh readiness.'
}

function doesPatchAffectPublishDraft(patch = {}) {
  if (!patch || typeof patch !== 'object') {
    return false
  }

  return [
    'name',
    'platformTarget',
    'baseInfo',
    'content',
    'assets',
    'publishDraft',
    'metadata'
  ].some((key) => Object.prototype.hasOwnProperty.call(patch, key))
}

function patchProjectPublishState(projectId, patch = {}) {
  const currentState = publishState.value[projectId] || {}
  publishState.value = {
    ...publishState.value,
    [projectId]: {
      ...currentState,
      ...patch
    }
  }
  return publishState.value[projectId]
}

function invalidateProjectPublishState(projectId = '', options = {}) {
  const normalizedProjectId = String(projectId || '').trim()
  if (!normalizedProjectId) {
    return null
  }

  const clearDraftSummary = options.clearDraftSummary !== false
  const markDraftSummaryStale = options.markDraftSummaryStale === true
  const staleMessage = String(options.staleMessage || '').trim()
  const currentState = publishState.value[normalizedProjectId] || {}
  const currentDraftSummary = currentState.draftSummary && typeof currentState.draftSummary === 'object'
    ? currentState.draftSummary
    : null
  return patchProjectPublishState(normalizedProjectId, {
    preview: null,
    latestTask: null,
    error: '',
    ...(clearDraftSummary
      ? { draftSummary: null }
      : markDraftSummaryStale && currentDraftSummary
        ? {
            draftSummary: {
              ...currentDraftSummary,
              isStale: true,
              staleMessage: staleMessage || buildPublishDraftSummaryStaleMessage()
            }
          }
        : {})
  })
}

function buildProjectPublishDraftPatchFromPreview(project = {}, preview = null, selectedPlatform = '') {
  const normalizedPlatform = normalizePublishPlatform(selectedPlatform || project.platformTarget?.[0] || '')
  if (!normalizedPlatform || !preview || typeof preview !== 'object') {
    return null
  }

  const currentPublishDraft = normalizeProjectPublishDraft(project)
  const currentPlatformDraft = currentPublishDraft.platformDrafts[normalizedPlatform] && typeof currentPublishDraft.platformDrafts[normalizedPlatform] === 'object'
    ? currentPublishDraft.platformDrafts[normalizedPlatform]
    : {}
  const currentAttributes = currentPlatformDraft.attributes && typeof currentPlatformDraft.attributes === 'object'
    ? currentPlatformDraft.attributes
    : {}

  const previewCategoryId = String(preview?.mappedDraft?.categoryId || '').trim()
  const previewRuleAttributes = Array.isArray(preview?.platformRule?.requiredAttributes)
    ? preview.platformRule.requiredAttributes
      .map((item) => ({
        key: String(item?.key || '').trim(),
        label: String(item?.label || item?.key || '').trim()
      }))
      .filter((item) => item.key)
    : []

  const nextAttributes = { ...currentAttributes }
  let hasAttributePlaceholderUpdate = false
  previewRuleAttributes.forEach((attribute) => {
    if (!Object.prototype.hasOwnProperty.call(nextAttributes, attribute.key)) {
      nextAttributes[attribute.key] = ''
      hasAttributePlaceholderUpdate = true
    }
  })

  const nextCategoryId = previewCategoryId || String(currentPlatformDraft.categoryId || '').trim()
  const hasCategoryUpdate = previewCategoryId && previewCategoryId !== String(currentPlatformDraft.categoryId || '').trim()

  if (!hasCategoryUpdate && !hasAttributePlaceholderUpdate) {
    return null
  }

  return {
    publishDraft: {
      ...currentPublishDraft,
      platformDrafts: {
        ...currentPublishDraft.platformDrafts,
        [normalizedPlatform]: {
          ...currentPlatformDraft,
          categoryId: nextCategoryId || null,
          attributes: nextAttributes
        }
      }
    }
  }
}

async function loadPublishChannelAccounts(project, { platform, preserveSelection = true } = {}) {
  const projectId = String(project?.id || '').trim()
  if (!projectId) {
    return []
  }

  const currentState = getProjectPublishState(project)
  const targetPlatform = normalizePublishPlatform(
    platform || currentState.selectedPlatform || project?.platformTarget?.[0] || ''
  )
  patchProjectPublishState(projectId, {
    selectedPlatform: targetPlatform,
    isLoadingAccounts: true,
    error: ''
  })

  try {
    const channelAccounts = await publishClient.listChannelAccounts({
      platform: targetPlatform
    })
    const accountRows = Array.isArray(channelAccounts) ? channelAccounts : []
    const nextSelectedChannelAccountId = preserveSelection && accountRows.some((item) => item.id === currentState.selectedChannelAccountId)
      ? currentState.selectedChannelAccountId
      : (accountRows[0]?.id || '')

    patchProjectPublishState(projectId, {
      channelAccounts: accountRows,
      selectedChannelAccountId: nextSelectedChannelAccountId,
      isLoadingAccounts: false
    })
    return accountRows
  } catch (error) {
    patchProjectPublishState(projectId, {
      channelAccounts: [],
      selectedChannelAccountId: '',
      isLoadingAccounts: false,
      error: buildErrorMessage(error, '发布账号加载失败')
    })
    throw error
  }
}

async function handlePublishPlatformChange({ project, platform }) {
  if (!project?.id) {
    return
  }

  try {
    invalidateProjectPublishState(project.id, { clearDraftSummary: false })
    await loadPublishChannelAccounts(project, {
      platform,
      preserveSelection: false
    })
  } catch {
    // Error already stored in state.
  }
}

function handlePublishChannelAccountChange({ project, channelAccountId }) {
  if (!project?.id) {
    return
  }

  invalidateProjectPublishState(project.id, { clearDraftSummary: false })
  patchProjectPublishState(project.id, {
    selectedChannelAccountId: String(channelAccountId || '').trim(),
    error: ''
  })
}

function resolveSelectedPublishChannelAccount(project = {}) {
  const state = getProjectPublishState(project)
  const selectedChannelAccountId = String(state.selectedChannelAccountId || '').trim()
  const channelAccounts = Array.isArray(state.channelAccounts) ? state.channelAccounts : []
  return channelAccounts.find((item) => String(item?.id || '').trim() === selectedChannelAccountId) || null
}

function isPublishChannelAccountReadyForSubmission(account = null) {
  if (!account || typeof account !== 'object') {
    return true
  }

  if (typeof account.isReadyForSubmission === 'boolean') {
    return account.isReadyForSubmission
  }

  return String(account.status || '').trim().toLowerCase() === 'active'
}

function assertPublishChannelAccountUsable(project = {}) {
  const account = resolveSelectedPublishChannelAccount(project)
  const status = String(account?.status || '').trim().toLowerCase()

  if (!account || isPublishChannelAccountReadyForSubmission(account)) {
    return
  }

  const sellerName = String(account?.sellerName || account?.sellerExternalIdMasked || account?.id || 'selected account').trim()
  const readinessMessage = String(account?.readinessMessage || '').trim()
  const readinessReason = String(account?.readinessReason || status || 'unknown').trim()
  throw new Error(`Selected publish account is not usable for task submission: ${sellerName} (${readinessReason}).${readinessMessage ? ` ${readinessMessage}` : ''}`)
}

async function ensurePublishDraftReady(project) {
  const draft = await publishClient.upsertDraft({
    projectId: project.id
  })
  patchProjectPublishState(project.id, {
    draftSummary: {
      id: draft.id,
      title: draft.title,
      status: draft.status,
      draftReadiness: draft.draftReadiness && typeof draft.draftReadiness === 'object'
        ? draft.draftReadiness
        : null,
      platformReadiness: draft.platformReadiness && typeof draft.platformReadiness === 'object'
        ? draft.platformReadiness
        : null
    }
  })
  return draft.id
}

async function ensurePublishChannelAccountReady(project) {
  const state = getProjectPublishState(project)
  if (state.selectedChannelAccountId) {
    assertPublishChannelAccountUsable(project)
    return state.selectedChannelAccountId
  }

  const channelAccounts = await loadPublishChannelAccounts(project, {
    platform: normalizePublishPlatform(state.selectedPlatform || project.platformTarget?.[0] || '')
  })
  const firstAccountId = String(channelAccounts?.[0]?.id || '').trim()
  if (!firstAccountId) {
    throw new Error('当前平台没有可用的发布账号。')
  }
  patchProjectPublishState(project.id, {
    selectedChannelAccountId: firstAccountId
  })
  assertPublishChannelAccountUsable({
    ...project,
    id: project.id
  })
  return firstAccountId
}

async function handleSyncPublishDraftFlow(project) {
  if (!project?.id) {
    return
  }

  try {
    getProjectPublishState(project)
    patchProjectPublishState(project.id, {
      isSyncing: true,
      error: ''
    })

    const draft = await publishClient.upsertDraft({
      projectId: project.id
    })

    const currentState = patchProjectPublishState(project.id, {
      draftSummary: {
        id: draft.id,
        title: draft.title,
        status: draft.status,
        draftReadiness: draft.draftReadiness && typeof draft.draftReadiness === 'object'
          ? draft.draftReadiness
          : null,
        platformReadiness: draft.platformReadiness && typeof draft.platformReadiness === 'object'
          ? draft.platformReadiness
          : null
      },
      preview: null,
      latestTask: null,
      isSyncing: false
    })

    if (!Array.isArray(currentState.channelAccounts) || !currentState.channelAccounts.length) {
      await loadPublishChannelAccounts(project, {
        platform: normalizePublishPlatform(currentState.selectedPlatform || project.platformTarget?.[0] || '')
      })
    }

    showActionFeedback({
      type: 'success',
      title: '草稿已同步',
      message: `发布草稿已同步到服务端：${draft.title || project.name || project.id}`
    })
  } catch (error) {
    patchProjectPublishState(project.id, {
      isSyncing: false,
      error: buildErrorMessage(error, '发布草稿同步失败')
    })
    showActionFeedback({
      type: 'error',
      title: '同步失败',
      message: buildErrorMessage(error, '发布草稿同步失败')
    })
  }
}

async function handlePublishPreview(project) {
  if (!project?.id) {
    return
  }

  const state = getProjectPublishState(project)
  patchProjectPublishState(project.id, {
    isPreviewLoading: true,
    error: ''
  })

  try {
    const { selectedPlatform, profile } = assertProjectPublishPlatformReady(project)
    const localValidationError = validateProjectPublishDraftBeforeRemote(project, selectedPlatform, profile, 'create-listing')
    if (localValidationError) {
      const localValidationMessage = buildLocalPublishValidationMessage(localValidationError)
      patchProjectPublishState(project.id, {
        isPreviewLoading: false,
        error: localValidationMessage
      })
      return showActionFeedback({
        type: 'error',
        title: localValidationError.title,
        message: localValidationMessage
      })
    }
    const draftId = await ensurePublishDraftReady(project)
    const channelAccountId = await ensurePublishChannelAccountReady(project)
    const preview = await publishClient.getDraftPreview({
      id: draftId,
      platform: selectedPlatform,
      channelAccountId
    })

    const publishDraftPatch = buildProjectPublishDraftPatchFromPreview(
      project,
      preview,
      state.selectedPlatform || project.platformTarget?.[0] || ''
    )

    if (publishDraftPatch) {
      await workspaceClient.updateProject({
        projectId: project.id,
        patch: publishDraftPatch
      })
      await loadStudioSnapshot()
    }

    patchProjectPublishState(project.id, {
      preview,
      isPreviewLoading: false
    })
    showActionFeedback({
      type: preview.isValid ? 'success' : 'error',
      title: preview.isValid ? '预览通过' : '预览未通过',
      message: preview.isValid ? '当前发布草稿已通过基础校验。' : `检测到 ${(preview.validationIssues || []).length} 项待处理问题`
    })
  } catch (error) {
    patchProjectPublishState(project.id, {
      isPreviewLoading: false,
      error: buildErrorMessage(error, '发布预览失败')
    })
    showActionFeedback({
      type: 'error',
      title: '预览失败',
      message: buildErrorMessage(error, '发布预览失败')
    })
  }
}

async function handlePublishCreateTask(project) {
  if (!project?.id) {
    return
  }

  patchProjectPublishState(project.id, {
    isTaskLoading: true,
    error: ''
  })

  try {
    const operationType = resolveProjectPublishTaskOperation(project)
    const { selectedPlatform, profile } = assertProjectPublishPlatformReady(project, operationType)
    if (String(profile?.automationStatus || '').trim() === 'pending-development') {
      patchProjectPublishState(project.id, {
        isTaskLoading: false,
        error: 'Automatic marketplace publishing is pending development. Use draft sync, account checks, preview validation, and status diagnostics for now.'
      })
      return showActionFeedback({
        type: 'error',
        title: 'Auto Publish Pending',
        message: 'Automatic marketplace publishing is pending development. Use draft sync, account checks, preview validation, and status diagnostics for now.'
      })
    }
    const localValidationError = validateProjectPublishDraftBeforeRemote(project, selectedPlatform, profile, operationType)
    if (localValidationError) {
      const localValidationMessage = buildLocalPublishValidationMessage(localValidationError)
      patchProjectPublishState(project.id, {
        isTaskLoading: false,
        error: localValidationMessage
      })
      return showActionFeedback({
        type: 'error',
        title: localValidationError.title,
        message: localValidationMessage
      })
    }
    const draftId = await ensurePublishDraftReady(project)
    const channelAccountId = await ensurePublishChannelAccountReady(project)
    const createdTask = await publishClient.createTask({
      draftId,
      platform: selectedPlatform,
      channelAccountId,
      operationType
    })
    let task = createdTask

    try {
      task = await publishClient.getTask({
        id: createdTask.id
      })
    } catch {
      task = createdTask
    }

    patchProjectPublishState(project.id, {
      latestTask: task,
      isTaskLoading: false
    })
    if (isPublishTaskActive(task)) {
      queuePublishTaskPolling(0)
    }
    return showActionFeedback(buildPublishTaskFeedback(task, '发布任务已创建'))
  } catch (error) {
    patchProjectPublishState(project.id, {
      isTaskLoading: false,
      error: buildErrorMessage(error, '发布任务创建失败')
    })
    showActionFeedback({
      type: 'error',
      title: '创建失败',
      message: buildErrorMessage(error, '发布任务创建失败')
    })
  }
}

async function handlePublishSyncTask(project) {
  if (!project?.id) {
    return
  }

  patchProjectPublishState(project.id, {
    isTaskLoading: true,
    error: ''
  })

  try {
    const { selectedPlatform } = assertProjectPublishPlatformReady(project, 'sync-status')
    const draftId = await ensurePublishDraftReady(project)
    const channelAccountId = await ensurePublishChannelAccountReady(project)
    const createdTask = await publishClient.createTask({
      draftId,
      platform: selectedPlatform,
      channelAccountId,
      operationType: 'sync-status'
    })
    let task = createdTask

    try {
      task = await publishClient.getTask({
        id: createdTask.id
      })
    } catch {
      task = createdTask
    }

    patchProjectPublishState(project.id, {
      latestTask: task,
      isTaskLoading: false
    })
    if (isPublishTaskActive(task)) {
      queuePublishTaskPolling(0)
    }
    return showActionFeedback(buildPublishTaskFeedback(task, '同步任务已创建'))
  } catch (error) {
    patchProjectPublishState(project.id, {
      isTaskLoading: false,
      error: buildErrorMessage(error, '发布状态同步失败')
    })
    showActionFeedback({
      type: 'error',
      title: '状态同步失败',
      message: buildErrorMessage(error, '发布状态同步失败')
    })
  }
}

async function handlePublishRefreshTask(project) {
  if (!project?.id) {
    return
  }

  const state = getProjectPublishState(project)
  const taskId = String(state.latestTask?.id || '').trim()
  if (!taskId) {
    return
  }

  patchProjectPublishState(project.id, {
    isTaskLoading: true,
    error: ''
  })

  try {
    const task = await publishClient.getTask({
      id: taskId
    })
    patchProjectPublishState(project.id, {
      latestTask: task,
      isTaskLoading: false
    })
  } catch (error) {
    patchProjectPublishState(project.id, {
      isTaskLoading: false,
      error: buildErrorMessage(error, '任务状态刷新失败')
    })
    showActionFeedback({
      type: 'error',
      title: '刷新失败',
      message: buildErrorMessage(error, '任务状态刷新失败')
    })
  }
}

async function handlePublishRetryTask(project) {
  if (!project?.id) {
    return
  }

  const state = getProjectPublishState(project)
  const taskId = String(state.latestTask?.id || '').trim()
  if (!taskId) {
    return
  }

  patchProjectPublishState(project.id, {
    isTaskLoading: true,
    error: ''
  })

  try {
    const task = await publishClient.retryTask({
      id: taskId
    })
    patchProjectPublishState(project.id, {
      latestTask: task,
      isTaskLoading: false
    })
    if (isPublishTaskActive(task)) {
      queuePublishTaskPolling(0)
    }
    showActionFeedback({
      type: 'success',
      title: '已重试',
      message: `发布任务已重新入队：${task.status || 'queued'}`
    })
  } catch (error) {
    patchProjectPublishState(project.id, {
      isTaskLoading: false,
      error: buildErrorMessage(error, '任务重试失败')
    })
    showActionFeedback({
      type: 'error',
      title: '重试失败',
      message: buildErrorMessage(error, '任务重试失败')
    })
  }
}

async function handleSubmitTask(menuKey = activeGeneratorMenuKey.value) {
  if (!menuKey) {
    return
  }

  if (!ensureActivatedOrPromptPurchase('请先购买授权激活设备后再提交生成任务')) {
    return
  }

  submitButtonState.value = 'pending'
  try {
    const draft = formDrafts.value[menuKey] || {}
    const balanceError = assertClientSideBalanceForTask({
      menuKey,
      draft
    })
    if (balanceError) {
      showActionFeedback({
        type: 'error',
        title: '余额不足',
        message: balanceError
      })
      return
    }
    const validationError = validateGeneratorTaskDraft({
      menuKey,
      draft,
      capability: activationState.value.activePackage?.capabilityConfig || null,
      effectiveGenerationLimits: {
        imageConcurrency: Math.max(1, Number(remoteServiceCapacity.value?.effectiveImageConcurrency) || 1),
        videoConcurrency: Math.max(0, Number(remoteServiceCapacity.value?.effectiveVideoConcurrency) || 0),
        textConcurrency: Math.max(1, Number(remoteServiceCapacity.value?.effectiveTextConcurrency) || 1),
        serviceTier: String(remoteServiceCapacity.value?.serviceTier || 'SHARED')
      }
    })

    if (validationError) {
      showActionFeedback({
        type: 'error',
        title: validationError.title,
        message: validationError.message
      })
      return
    }

    await workspaceClient.createTask({
      menuKey,
      draft
    })
    await loadStudioSnapshot()
    showActionFeedback({
      type: 'success',
      title: '已提交',
      message: '任务已加入队列'
    })
  } catch (error) {
    showActionFeedback({
      type: 'error',
      title: '提交失败',
      message: buildErrorMessage(error, '任务提交失败')
    })
  } finally {
    submitButtonState.value = 'idle'
  }
}

function buildStandaloneTextDraft(textKind = 'title') {
  const normalizedKind = textKind === 'description' ? 'description' : 'title'
  return {
    ...workspaceDraft.value,
    enabledSteps: {
      title: normalizedKind === 'title',
      description: normalizedKind === 'description',
      image: false,
      video: false
    }
  }
}

async function handleSubmitTextGenerator(textKind = 'title') {
  if (!ensureActivatedOrPromptPurchase('请先购买授权激活设备后再提交文本任务')) {
    return
  }

  submitButtonState.value = 'pending'
  try {
    const textDraft = buildStandaloneTextDraft(textKind)
    const balanceError = assertClientSideBalanceForTask({
      menuKey: 'workspace',
      draft: textDraft,
      textKind
    })
    if (balanceError) {
      showActionFeedback({
        type: 'error',
        title: '余额不足',
        message: balanceError
      })
      return
    }
    await workspaceClient.createTask({
      menuKey: 'workspace',
      draft: textDraft
    })
    await loadStudioSnapshot()
    showActionFeedback({
      type: 'success',
      title: '已提交',
      message: textKind === 'description' ? '描述生成任务已加入队列' : '标题生成任务已加入队列'
    })
  } catch (error) {
    showActionFeedback({
      type: 'error',
      title: '提交失败',
      message: buildErrorMessage(error, textKind === 'description' ? '描述生成任务提交失败' : '标题生成任务提交失败')
    })
  } finally {
    submitButtonState.value = 'idle'
  }
}

async function handleRunProject(project) {
  if (!project?.id) {
    return
  }

  if (!ensureActivatedOrPromptPurchase('请先购买授权激活设备后再运行项目')) {
    return
  }

  submitButtonState.value = 'pending'
  try {
    const projectDraft = buildWorkspaceRunDraft(project, formDrafts.value.workspace || {})
    const balanceError = assertClientSideBalanceForTask({
      menuKey: 'workspace',
      draft: projectDraft
    })
    if (balanceError) {
      showActionFeedback({
        type: 'error',
        title: '余额不足',
        message: balanceError
      })
      return
    }
    await workspaceClient.createTask({
      menuKey: 'workspace',
      draft: projectDraft
    })
    await loadStudioSnapshot()
    showActionFeedback({
      type: 'success',
      title: '已提交',
      message: '项目任务已加入队列'
    })
  } catch (error) {
    showActionFeedback({
      type: 'error',
      title: '提交失败',
      message: buildErrorMessage(error, '项目任务提交失败')
    })
  } finally {
    submitButtonState.value = 'idle'
  }
}

async function handleCancelTask(payload = {}) {
  const projectId = String(payload?.projectId || payload?.id || '').trim()
  const taskId = String(payload?.taskId || '').trim()

  if (!projectId && !taskId) {
    return
  }

  try {
    await workspaceClient.cancelTask({
      projectId,
      taskId
    })
    await loadStudioSnapshot()
    showActionFeedback({
      type: 'success',
      title: '已停止',
      message: '任务已结束'
    })
  } catch (error) {
    showActionFeedback({
      type: 'error',
      title: '停止失败',
      message: buildErrorMessage(error, '任务停止失败')
    })
  }
}

async function handlePickGeneratorImage() {
  if (!activeGeneratorMenuKey.value) {
    return
  }

  try {
    const currentDraft = formDrafts.value[activeGeneratorMenuKey.value] || {}
    const fallbackAssignments = Array.isArray(currentDraft.promptAssignments) ? currentDraft.promptAssignments : []
    const allowMultiple = activeGeneratorMenuKey.value === 'series-generate'
    const result = await workspaceClient.pickInputAssets({
      menuKey: activeGeneratorMenuKey.value,
      allowMultiple
    })

    if (result.canceled || !result.files?.length) {
      return
    }

    if (activeGeneratorMenuKey.value === 'series-generate') {
      const seriesSourceItems = buildSeriesSourceItemsFromFiles(result.files, fallbackAssignments)
      await persistDraft(activeGeneratorMenuKey.value, {
        sourceImage: result.files[0],
        generateCount: Math.max(1, seriesSourceItems.length),
        promptAssignments: seriesSourceItems.map((item, index) => ({
          ...(fallbackAssignments[index] || {}),
          id: (fallbackAssignments[index] || {}).id || `series-generate-${index + 1}`,
          index: index + 1,
          prompt: item.prompt || '',
          templateId: item.templateId || '',
          imageType: item.imageType || '',
          differenceLevel: item.differenceLevel || 'off'
        })),
        seriesSourceItems
      })
      return
    }

    await persistDraft(activeGeneratorMenuKey.value, {
      sourceImage: result.files[0]
    })
  } catch (error) {
    showActionFeedback({
      type: 'error',
      title: '上传失败',
      message: buildErrorMessage(error, '上传样图失败')
    })
  }
}

function normalizeProjectRunPayload(payload = null) {
  if (payload && typeof payload === 'object' && payload.project) {
    return {
      project: payload.project,
      run: payload.run || null
    }
  }

  return {
    project: payload,
    run: null
  }
}

async function handleOpenImages(payload) {
  const { project, run } = normalizeProjectRunPayload(payload)
  const latestRun = resolveLatestRun(project, projectRuns.value, run)
  const imageDirectory = resolveImageOutputDirectory(project, latestRun)

  if (!imageDirectory) {
    return
  }

  await shellClient.openOutputDirectory({
    outputDirectory: imageDirectory
  })
}

async function handleOpenVideo(payload) {
  const { project, run } = normalizeProjectRunPayload(payload)
  const latestRun = resolveLatestRun(project, projectRuns.value, run)
  const videoDirectory = resolveVideoOutputDirectory(project, latestRun)

  if (!videoDirectory) {
    return
  }

  await shellClient.openOutputDirectory({
    outputDirectory: videoDirectory
  })
}

async function handleOpenResource(target) {
  if (!target) {
    return
  }

  await shellClient.openExternalResource({ target })
}

async function handleExportProject(projectId) {
  if (!ensureActivatedOrPromptPurchase('请先购买授权激活设备后再导出项目')) {
    return
  }

  try {
    await workspaceClient.exportProjectBundle({ projectId })
    showActionFeedback({
      type: 'success',
      title: '已导出',
      message: '项目包已生成'
    })
  } catch (error) {
    showActionFeedback({
      type: 'error',
      title: '导出失败',
      message: buildErrorMessage(error, '导出项目失败')
    })
  }
}

async function handleCopyText(text) {
  await navigator.clipboard.writeText(String(text || ''))
  showActionFeedback({
    type: 'success',
    title: '已复制',
    message: '内容已复制到剪贴板'
  })
}

function resolveExportItemDirectory(exportItem) {
  if (!exportItem || typeof exportItem !== 'object') {
    return ''
  }

  return exportItem.directoryPath ||
    exportItem.outputDirectory ||
    (exportItem.savedPath ? String(exportItem.savedPath).replace(/[\\/][^\\/]+$/, '') : '') ||
    ''
}

async function handleOpenGeneratorExportItem(exportItem) {
  const outputDirectory = resolveExportItemDirectory(exportItem)
  if (!outputDirectory) {
    showActionFeedback({
      type: 'error',
      title: '无法打开',
      message: '当前结果还没有可用的本地目录'
    })
    return
  }

  await shellClient.openOutputDirectory({
    outputDirectory
  })
}

async function handleExportCurrentResults(payload = {}) {
  if (!activeGeneratorMenuKey.value) {
    return
  }

  if (!ensureActivatedOrPromptPurchase('请先购买授权激活设备后再导出结果')) {
    return
  }

  const selectedExportIds = Array.isArray(payload?.selectedExportIds) && payload.selectedExportIds.length
    ? payload.selectedExportIds
    : currentExportItems.value.map((item) => item.id).filter(Boolean)

  if (!selectedExportIds.length) {
    return
  }

  try {
    const exportResult = await workspaceClient.exportResults({
      menuKey: activeGeneratorMenuKey.value,
      selectedExportIds
    })

    if (exportResult?.canceled) {
      return
    }

    showActionFeedback({
      type: 'success',
      title: '已导出',
      message: '结果压缩包已生成'
    })
  } catch (error) {
    showActionFeedback({
      type: 'error',
      title: '导出失败',
      message: buildErrorMessage(error, '结果导出失败')
    })
  }
}

async function handleExportTextResults() {
  if (!ensureActivatedOrPromptPurchase('请先购买授权激活设备后再导出文本结果')) {
    return
  }

  const selectedExportIds = workspaceExportItems.value.map((item) => item.id).filter(Boolean)
  if (!selectedExportIds.length) {
    return
  }

  try {
    const exportResult = await workspaceClient.exportResults({
      menuKey: 'workspace',
      selectedExportIds
    })

    if (exportResult?.canceled) {
      return
    }

    showActionFeedback({
      type: 'success',
      title: '已导出',
      message: '文本结果压缩包已生成'
    })
  } catch (error) {
    showActionFeedback({
      type: 'error',
      title: '导出失败',
      message: buildErrorMessage(error, '文本结果导出失败')
    })
  }
}

async function handleCopyDeviceCode() {
  await navigator.clipboard.writeText(activationState.value.deviceCode || '')
  showActionFeedback({
    type: 'success',
    title: '已复制',
    message: '设备码已复制'
  })
}

async function handleAcceptUserAgreement() {
  isUserAgreementSubmitting.value = true
  try {
    userAgreementState.value = await complianceClient.acceptUserAgreement()

    if (canUseActivatedWorkspace.value) {
      await loadActivatedWorkspace()
    }

    showActionFeedback({
      type: 'success',
      title: '协议已签署',
      message: '已记录你的协议签署，可继续使用软件'
    })
  } catch (error) {
    showActionFeedback({
      type: 'error',
      title: '签署失败',
      message: buildErrorMessage(error, '协议签署失败，请稍后重试')
    })
  } finally {
    isUserAgreementSubmitting.value = false
  }
}

function openClearRuntimeConfirm() {
  void clearStudioRuntimeState()
    .then(async () => {
      await loadStudioSnapshot()
      showActionFeedback({
        type: 'success',
        title: '已清理',
        message: '运行缓存已清空'
      })
    })
    .catch((error) => {
      showActionFeedback({
        type: 'error',
        title: '清理失败',
        message: buildErrorMessage(error, '运行缓存清理失败')
      })
    })
}

async function handleSavePromptTemplate(payload) {
  await promptLibraryClient.saveTemplate(payload)
  await loadPromptTemplateState()
}

async function handleRemovePromptTemplate(templateId) {
  await promptLibraryClient.removeTemplate({ id: templateId })
  await loadPromptTemplateState()
}

async function handleSaveProjectTemplate(project) {
  try {
    await projectTemplateClient.saveFromProject({
      projectId: project?.id || '',
      name: project?.name || project?.baseInfo?.productName || '未命名模板'
    })
    await loadProjectTemplateState()
    showActionFeedback({
      type: 'success',
      title: '已保存',
      message: '当前项目已保存到模板中心'
    })
  } catch (error) {
    showActionFeedback({
      type: 'error',
      title: '保存失败',
      message: buildErrorMessage(error, '保存项目模板失败')
    })
  }
}

async function handleApplyProjectTemplate(template) {
  try {
    const payload = await projectTemplateClient.applyTemplate({
      id: template?.id || ''
    })

    await persistDraft('workspace', {
      productName: payload?.summary?.productName || '',
      language: payload?.summary?.language || 'zh-CN',
      platformTargetsText: payload?.summary?.platformTargetsText || '',
      titlePrompt: payload?.parameters?.title?.prompt || '',
      descriptionPrompt: payload?.parameters?.description?.prompt || '',
      imagePrompt: payload?.parameters?.image?.prompt || '',
      videoPrompt: payload?.parameters?.video?.prompt || '',
      titleMaxChars: payload?.parameters?.title?.maxChars || 60,
      descriptionMaxChars: payload?.parameters?.description?.maxChars || 300,
      titleQuantity: payload?.parameters?.title?.quantity || 3,
      descriptionQuantity: payload?.parameters?.description?.quantity || 2,
      imageTemplateId: payload?.parameters?.image?.templateId || 'image-default',
      videoTemplateId: payload?.parameters?.video?.templateId || 'video-main',
      imageModel: payload?.parameters?.image?.model || formDrafts.value.workspace?.imageModel || 'gpt-image-2',
      videoModel: payload?.parameters?.video?.model || formDrafts.value.workspace?.videoModel || 'MiniMax-Hailuo-2.3-Fast',
      generateCount: payload?.parameters?.image?.generateCount || 4,
      promptAssignments: Array.isArray(payload?.parameters?.image?.promptAssignments)
        ? payload.parameters.image.promptAssignments
        : formDrafts.value.workspace?.promptAssignments || [],
      size: payload?.parameters?.image?.size || '1:1',
      duration: payload?.parameters?.video?.duration || '6s',
      resolution: payload?.parameters?.video?.resolution || '768P',
      motionStrength: payload?.parameters?.video?.motionStrength || 'auto',
      aspectRatio: payload?.parameters?.video?.aspectRatio || '16:9',
      selectedTitle: payload?.generatedTitle || '',
      selectedDescription: payload?.generatedDescription || '',
      sourceImage: payload?.sourceImage || null
    })

    activeMenu.value = 'work-center'
    showActionFeedback({
      type: 'success',
      title: '已应用',
      message: '模板参数已回填到工作中心'
    })
  } catch (error) {
    showActionFeedback({
      type: 'error',
      title: '应用失败',
      message: buildErrorMessage(error, '应用模板失败')
    })
  }
}

async function handleRemoveProjectTemplate(templateId) {
  try {
    await projectTemplateClient.removeTemplate({
      id: templateId
    })
    await loadProjectTemplateState()
    showActionFeedback({
      type: 'success',
      title: '已删除',
      message: '模板已从本地模板库移除'
    })
  } catch (error) {
    showActionFeedback({
      type: 'error',
      title: '删除失败',
      message: buildErrorMessage(error, '删除模板失败')
    })
  }
}

async function handleRenameProjectTemplate(payload) {
  try {
    await projectTemplateClient.updateTemplate(payload)
    await loadProjectTemplateState()
    showActionFeedback({
      type: 'success',
      title: '已更新',
      message: '模板名称已更新'
    })
  } catch (error) {
    showActionFeedback({
      type: 'error',
      title: '更新失败',
      message: buildErrorMessage(error, '更新模板失败')
    })
  }
}

function openLicensePurchase() {
  activeGeneratorMenu.value = ''
  commerceOrderModalMode.value = 'software'
  commerceOrderModalVisible.value = true
}

function openPermissionActivation() {
  activeGeneratorMenu.value = ''
  permissionActivationModalVisible.value = true
}

function openComputePurchase() {
  if (!isActivated.value) {
    openLicensePurchase()
    return
  }

  activeGeneratorMenu.value = ''
  commerceOrderModalMode.value = 'compute'
  commerceOrderModalVisible.value = true
}

function openRechargePurchase() {
  if (!isActivated.value) {
    openLicensePurchase()
    return
  }

  activeGeneratorMenu.value = ''
  commerceOrderModalMode.value = 'recharge'
  commerceOrderModalVisible.value = true
}

function openModelPricingModal() {
  activeGeneratorMenu.value = ''
  modelPricingModalVisible.value = true
}

function closeCommerceOrderModal() {
  commerceOrderModalVisible.value = false
}

function closeModelPricingModal() {
  modelPricingModalVisible.value = false
}

function closePermissionActivationModal() {
  permissionActivationModalVisible.value = false
}

async function handlePermissionActivation() {
  const customerName = String(activationForm.value.customerName || '').trim()
  const contact = String(activationForm.value.contact || '').trim()

  if (!customerName || !contact) {
    showActionFeedback({
      type: 'error',
      title: '激活失败',
      message: '请输入用户名和手机号'
    })
    return
  }

  isPermissionActivating.value = true
  try {
    await activationClient.activate({
      customerName,
      contact
    })
    await loadActivationState()
    await loadUserAgreementState()
    if (canUseActivatedWorkspace.value) {
      await loadActivatedWorkspace()
    }
    permissionActivationModalVisible.value = false
    showActionFeedback({
      type: 'success',
      title: '激活成功',
      message: '当前设备已绑定授权'
    })
  } catch (error) {
    showActionFeedback({
      type: 'error',
      title: '激活失败',
      message: buildErrorMessage(error, '未查询到可用授权')
    })
  } finally {
    isPermissionActivating.value = false
  }
}

async function handleClearPermission() {
  try {
    await activationClient.clearLocalAuth()
    activationForm.value.customerName = ''
    activationForm.value.contact = ''
    activationForm.value.inviteCode = ''
    permissionActivationModalVisible.value = false
    await loadActivationState()
    await loadUserAgreementState()
    await loadPurchaseCenterCatalog()
    showActionFeedback({
      type: 'success',
      title: '权限已解除',
      message: '本地会话和授权缓存已清空'
    })
  } catch (error) {
    showActionFeedback({
      type: 'error',
      title: '权限解除失败',
      message: buildErrorMessage(error, '清理本地授权状态失败')
    })
  }
}

async function handleCreateSoftwareOrder(productPackageId) {
  if (!productPackageId) {
    return
  }

  const nextOrder = await softwareOrderController?.create(productPackageId)

  if (nextOrder?.id) {
    await handleOpenSoftwareOrderLink()
    if (!isActivated.value) {
      commerceOrderModalVisible.value = false
    }
  }
}

async function handleOpenSoftwareOrderLink() {
  await softwareOrderController?.openPaymentLink()
}

function handleRechargeFormUpdate({ field, value }) {
  if (!field) {
    return
  }

  rechargeForm[field] = value
}

function handleActivationFormUpdate({ field, value }) {
  if (!field) {
    return
  }

  activationForm.value[field] = value
}

async function handleCreateRecharge() {
  const nextOrder = await rechargeOrderController?.create()

  if (nextOrder?.id) {
    await handleOpenRechargeLink()
  }
}

async function handleRefreshRechargeOrder() {
  await rechargeOrderController?.refresh()
}

async function handleOpenRechargeLink() {
  await rechargeOrderController?.openPaymentLink()
}

async function handleCreateComputePackageOrder(computePackageId) {
  if (!computePackageId) {
    return
  }

  const nextOrder = await computePackageOrderController?.create(computePackageId)

  if (nextOrder?.id) {
    await handleOpenComputePackageOrderLink()
  }
}

async function handleRefreshComputePackageOrder() {
  await computePackageOrderController?.refresh()
}

async function handleOpenComputePackageOrderLink() {
  await computePackageOrderController?.openPaymentLink()
}

rechargeOrderController = createRechargeOrderController({
  currentRechargeOrderRef: currentRechargeOrder,
  isRechargeSubmittingRef: isRechargeSubmitting,
  isRechargeRefreshingRef: isRechargeRefreshing,
  rechargeForm,
  createRechargeOrder: commerceClient.createRechargeOrder,
  getRechargeOrder: commerceClient.getRechargeOrder,
  openExternalResource: shellClient.openExternalResource,
  showActionFeedback,
  buildErrorMessage,
  loadStudioSnapshot,
  loadActivationState
})

softwareOrderController = createSoftwareOrderController({
  currentSoftwareOrderRef: currentSoftwareOrder,
  isSoftwareOrderSubmittingRef: isSoftwareOrderSubmitting,
  isSoftwareOrderRefreshingRef: isSoftwareOrderRefreshing,
  activationFormRef: activationForm,
  createSoftwareOrder: commerceClient.createSoftwareOrder,
  getSoftwareOrder: commerceClient.getSoftwareOrder,
  openExternalResource: shellClient.openExternalResource,
  showActionFeedback,
  buildErrorMessage,
  activateRemoteLicense: activationClient.activate,
  loadActivationState,
  loadUserAgreementState,
  loadStudioSnapshot,
  loadPurchaseCenterCatalog
})

computePackageOrderController = createComputePackageOrderController({
  currentComputePackageOrderRef: currentComputePackageOrder,
  isComputePackageOrderSubmittingRef: isComputePackageOrderSubmitting,
  isComputePackageOrderRefreshingRef: isComputePackageOrderRefreshing,
  computePackagesRef: computePackages,
  createComputePackageOrder: commerceClient.createComputePackageOrder,
  getComputePackageOrder: commerceClient.getComputePackageOrder,
  openExternalResource: shellClient.openExternalResource,
  showActionFeedback,
  buildErrorMessage,
  loadActivationState,
  loadStudioSnapshot,
  loadPurchaseCenterCatalog
})

onMounted(() => {
  void (async () => {
    restorePersistedPurchaseOrders()
    await loadActivationState()
    await loadPromptTemplateState()
    await loadPurchaseCenterCatalog()
    await loadUserAgreementState()
    if (currentSoftwareOrder.value?.id) {
      await softwareOrderController?.refresh()
      if (String(currentSoftwareOrder.value?.status || '') === 'pending') {
        softwareOrderController?.startPolling()
      }
    }
    if (currentComputePackageOrder.value?.id) {
      await computePackageOrderController?.refresh()
      if (String(currentComputePackageOrder.value?.status || '') === 'pending') {
        computePackageOrderController?.startPolling()
      }
    }
    if (currentRechargeOrder.value?.id) {
      await rechargeOrderController?.refresh()
      if (String(currentRechargeOrder.value?.status || '') === 'pending') {
        rechargeOrderController?.startPolling()
      }
    }
    if (canUseActivatedWorkspace.value) {
      await loadActivatedWorkspace()
    }
  })()
})

watch(
  currentSoftwareOrder,
  (value) => {
    persistPurchaseOrder('software', value)
  },
  { deep: true }
)

watch(
  currentComputePackageOrder,
  (value) => {
    persistPurchaseOrder('compute', value)
  },
  { deep: true }
)

watch(
  currentRechargeOrder,
  (value) => {
    persistPurchaseOrder('recharge', value)
  },
  { deep: true }
)

watch(
  isActivated,
  (activated) => {
    if (activated) {
      commerceOrderModalVisible.value = false
    }
  }
)

watch(
  [isActivated, hasActiveStudioTasks],
  ([activated, hasActive]) => {
    if (activated && hasActive) {
      queueRuntimePolling(0)
      return
    }

    stopRuntimePolling()
  },
  { immediate: true }
)

watch(
  [isActivated, hasActivePublishTasks],
  ([activated, hasActive]) => {
    if (activated && hasActive) {
      queuePublishTaskPolling(0)
      return
    }

    stopPublishTaskPolling()
  },
  { immediate: true }
)

onUnmounted(() => {
  stopRuntimePolling()
  stopPublishTaskPolling()
  stopSelectionManifestPolling()
  rechargeOrderController?.stopPolling()
  softwareOrderController?.stopPolling()
  computePackageOrderController?.stopPolling()
})
</script>

<template>
  <main class="app-shell" data-theme="dark">
    <AppTopBar
      brand-label="QiuAi"
      :activation-summary="activationSummary"
      :recharge-enabled="isActivated"
      @cleanup-click="openClearRuntimeConfirm"
      @purchase-license-click="openLicensePurchase"
      @purchase-compute-click="openComputePurchase"
      @purchase-recharge-click="openRechargePurchase"
      @show-model-pricing-click="openModelPricingModal"
    />

    <div v-if="actionNotice.visible" class="app-notice-layer" role="status" aria-live="polite">
      <div class="app-notice" :class="`app-notice--${actionNotice.type}`">
        <strong>{{ actionNotice.title }}</strong>
        <span>{{ actionNotice.message }}</span>
      </div>
    </div>

    <CommerceOrderModal
      :visible="commerceOrderModalVisible"
      :mode="commerceOrderModalMode"
      :activation-form="activationForm"
      :software-packages="softwarePackages"
      :compute-packages="computePackages"
      :recharge-form="rechargeForm"
      :is-catalog-loading="isCatalogLoading"
      :is-software-order-submitting="isSoftwareOrderSubmitting"
      :is-compute-package-order-submitting="isComputePackageOrderSubmitting"
      :is-recharge-submitting="isRechargeSubmitting"
      @close="closeCommerceOrderModal"
      @submit-software-order="handleCreateSoftwareOrder"
      @submit-compute-order="handleCreateComputePackageOrder"
      @submit-recharge-order="handleCreateRecharge"
      @update-activation-form="handleActivationFormUpdate"
      @update-recharge-form="handleRechargeFormUpdate"
    />

    <ModelPricingModal
      :visible="modelPricingModalVisible"
      @close="closeModelPricingModal"
    />

    <PermissionActivationModal
      :visible="permissionActivationModalVisible"
      :form-state="activationForm"
      :is-submitting="isPermissionActivating"
      @close="closePermissionActivationModal"
      @submit="handlePermissionActivation"
    />

    <UserAgreementModal
      :visible="userAgreementState.shouldShow"
      :agreement-state="userAgreementState"
      :is-submitting="isUserAgreementSubmitting"
      @accept="handleAcceptUserAgreement"
    />


    <section class="shell-grid shell-grid--simple">
      <aside class="shell-grid__sidebar">
        <WorkspaceSidebar
          :menu-items="menuItems"
          :active-menu="activeMenu"
          @menu-select="handleMenuSelect"
        />
      </aside>

      <section class="shell-grid__workspace">
        <ActivationGate
          v-if="isActivationLoading"
          :activation-state="activationState"
          :is-loading="isActivationLoading"
        />

        <GenerationCenterPage
          v-else-if="isWorkspaceHome"
          :product-projects="productProjects"
          :project-runs="projectRuns"
          :active-project-id="activeProductProjectId"
          :focus-project-id="activeProductProjectId"
          :draft="workspaceDraft"
          :submit-button-state="submitButtonState"
          :prompt-templates="promptTemplates"
          :publish-state="publishState"
          :selection-manifest="selectionManifest"
          :selection-platforms="selectionPlatforms"
          :selection-sites="selectionSites"
          :selection-state="selectionItemsState"
          @create-project="handleCreateProject"
          @run-project="handleRunProject"
          @cancel-task="handleCancelTask"
          @update-draft="handleTextGeneratorDraftUpdate"
          @save-project-template="handleSaveProjectTemplate"
          @replace-project-image="handleReplaceProjectImage"
          @update-project="handleProjectUpdate"
          @delete-project="handleProjectDelete"
          @copy-text="handleCopyText"
          @open-images="handleOpenImages"
          @open-video="handleOpenVideo"
          @open-resource="handleOpenResource"
          @export-project="handleExportProject"
          @open-generator="handleOpenProjectGenerator"
          @open-project-settings="handleOpenProjectSettings"
          @sync-publish-draft="handleSyncPublishDraftFlow"
          @publish-platform-change="handlePublishPlatformChange"
          @publish-channel-account-change="handlePublishChannelAccountChange"
          @publish-preview="handlePublishPreview"
          @publish-create-task="handlePublishCreateTask"
          @publish-sync-task="handlePublishSyncTask"
          @publish-refresh-task="handlePublishRefreshTask"
          @publish-retry-task="handlePublishRetryTask"
          @selection-query-change="handleSelectionQueryChange"
          @selection-import="handleSelectionImport"
          @selection-open-source="handleSelectionOpenSource"
        />

        <SelectionCenterPage
          v-else-if="activeMenu === 'selection-center'"
          :active-project-id="activeProductProjectId"
          :active-project-name="productProjects.find((item) => item.id === activeProductProjectId)?.name || productProjects.find((item) => item.id === activeProductProjectId)?.baseInfo?.productName || ''"
          :selection-manifest="selectionManifest"
          :selection-platforms="selectionPlatforms"
          :selection-sites="selectionSites"
          :selection-state="selectionItemsState"
          @selection-query-change="handleSelectionQueryChange"
          @selection-import="handleSelectionImport"
          @selection-open-source="handleSelectionOpenSource"
        />

        <DataCenterPage
          v-else-if="activeMenu === 'data-center'"
          :activation-state="activationState"
          :wallet-summary="effectiveWalletSummary"
          :is-refreshing-balances="isDataCenterRefreshingBalances"
          :product-projects="productProjects"
          :project-runs="projectRuns"
          @refresh-balances="handleRefreshDataCenterBalances"
        />

        <ProjectTemplateCenterPage
          v-else-if="activeMenu === 'template-center'"
          :templates="projectTemplates"
          @apply-template="handleApplyProjectTemplate"
          @remove-template="handleRemoveProjectTemplate"
          @rename-template="handleRenameProjectTemplate"
        />

        <PublishCenterPage
          v-else-if="activeMenu === 'publish-center'"
        />

        <TextGeneratorPage
          v-else-if="activeTextGeneratorView"
          :title="activeTextGeneratorView.title"
          :text-kind="activeTextGeneratorView.textKind"
          :draft="workspaceDraft"
          :result-items="currentTextResultItems"
          :export-items="workspaceExportItems"
          :prompt-templates="promptTemplates"
          @update-draft="handleTextGeneratorDraftUpdate"
          @submit-task="handleSubmitTextGenerator(activeTextGeneratorView.textKind)"
          @copy-text="handleCopyText"
          @export-results="handleExportTextResults"
          @open-export-item="handleOpenGeneratorExportItem"
        />

        <GeneratorStudioPage
          v-else-if="activeMediaGeneratorView"
          :title="activeMediaGeneratorView.title"
          :mode="activeMediaGeneratorView.mode"
          :draft="currentDraft"
          :result-payload="currentResultPayload"
          :export-items="currentExportItems"
          :tasks="studioTasks"
          :agent-readiness="studioAgentReadiness"
          :prompt-templates="promptTemplates"
          :remote-service-capacity="remoteServiceCapacity"
          @update-draft="handleDraftUpdate"
          @submit-task="handleSubmitTask(activeGeneratorMenuKey)"
          @pick-image="handlePickGeneratorImage"
          @copy-text="handleCopyText"
          @open-export-item="handleOpenGeneratorExportItem"
          @export-results="handleExportCurrentResults"
        />

        <PurchaseCenterPage
          v-else-if="activeMenu === 'purchase-center'"
          :activation-state="activationState"
          :wallet-summary="effectiveWalletSummary"
          :software-packages="softwarePackages"
          :compute-packages="computePackages"
          :current-software-order="currentSoftwareOrder"
          :current-compute-package-order="currentComputePackageOrder"
          :current-recharge-order="currentRechargeOrder"
          :recharge-form="rechargeForm"
          :is-catalog-loading="isCatalogLoading"
          :is-recharge-submitting="isRechargeSubmitting"
          :is-software-order-submitting="isSoftwareOrderSubmitting"
          :is-software-order-refreshing="isSoftwareOrderRefreshing"
          :is-compute-package-order-submitting="isComputePackageOrderSubmitting"
          :is-compute-package-order-refreshing="isComputePackageOrderRefreshing"
          :is-recharge-refreshing="isRechargeRefreshing"
          @refresh-catalog="loadPurchaseCenterCatalog"
          @create-software-order="handleCreateSoftwareOrder"
          @refresh-software-order="softwareOrderController?.refresh()"
          @open-software-order="handleOpenSoftwareOrderLink"
          @create-compute-package-order="handleCreateComputePackageOrder"
          @refresh-compute-package-order="handleRefreshComputePackageOrder"
          @open-compute-package-order="handleOpenComputePackageOrderLink"
          @update-recharge-form="handleRechargeFormUpdate"
          @create-recharge="handleCreateRecharge"
          @refresh-recharge-order="handleRefreshRechargeOrder"
          @open-recharge-order="handleOpenRechargeLink"
        />

        <AccountDevicePage
          v-else-if="activeMenu === 'account-device'"
          :activation-state="activationState"
          :remote-service-capacity="remoteServiceCapacity"
          @copy-device-code="handleCopyDeviceCode"
          @activate-permission="openPermissionActivation"
          @clear-permission="handleClearPermission"
        />

        <SettingsCenterPage
          v-else-if="activeMenu === 'prompt-library'"
          :prompt-templates="promptTemplates"
          @save-template="handleSavePromptTemplate"
          @remove-template="handleRemovePromptTemplate"
        />

        <ActivationGate
          v-else
          :activation-state="activationState"
          :is-loading="false"
        />
      </section>
    </section>
  </main>
</template>
