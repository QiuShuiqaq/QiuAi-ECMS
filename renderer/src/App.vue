<script setup>
import { computed, onMounted, onUnmounted, reactive, ref, watch } from 'vue'
import AppTopBar from './components/AppTopBar.vue'
import ActivationGate from './components/ActivationGate.vue'
import WorkspaceSidebar from './components/WorkspaceSidebar.vue'
import PromptLibraryPanel from './components/PromptLibraryPanel.vue'
import ProductWorkbench from './components/ProductWorkbench.vue'
import PurchaseCenterPage from './components/PurchaseCenterPage.vue'
import DataCenterPage from './components/DataCenterPage.vue'
import GeneratorStudioPage from './components/GeneratorStudioPage.vue'
import studioMenuConfig from '../../shared/studio-menu-config.json'
import { buildProjectGeneratorDraft, buildWorkspaceRunDraft } from './utils/generatorDraftBuilders'
import {
  createComputePackageOrderController,
  createRechargeOrderController,
  createSoftwareOrderController
} from './utils/purchaseControllerConfigs'
import { validateGeneratorTaskDraft } from './utils/generatorTaskValidation'
import { resolveGeneratorView } from './utils/generatorViews'
import {
  resolveImageOutputDirectory,
  resolveLatestRun,
  resolveVideoOutputDirectory
} from './utils/workspaceOutputLocators'
import {
  activateRemoteLicense,
  clearStudioRuntimeState,
  createComputePackageOrder,
  createRechargeOrder,
  createSoftwareOrder,
  createStudioProject,
  createStudioTask,
  deleteStudioProject,
  exportStudioResults,
  exportStudioProjectBundle,
  getActivationStatus,
  getComputePackageOrder,
  getRechargeOrder,
  getSoftwareOrder,
  getSelectionItemDetail,
  getSelectionManifest,
  getStudioRuntimeSnapshot,
  getStudioSnapshot,
  listComputePackages,
  listPromptTemplates,
  listSelectionItems,
  listSelectionPlatforms,
  listSelectionSites,
  listSoftwarePackages,
  openOutputDirectory,
  openExternalResource,
  pickStudioInputAssets,
  removePromptTemplate,
  savePromptTemplate,
  saveStudioDraft,
  updateStudioProject
} from './services/desktopBridge'

const fallbackMenuItems = [
  { key: 'workspace', label: '工作台', section: '核心' },
  { key: 'purchase-center', label: '购买中心', section: '核心' },
  { key: 'account-usage', label: '账户与用量', section: '核心' },
  { key: 'prompt-library', label: '提示词库', section: '配置' }
]

const menuItems = Array.isArray(studioMenuConfig.primaryMenuItems)
  ? studioMenuConfig.primaryMenuItems
  : fallbackMenuItems

const activeMenu = ref('workspace')
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
  pageSize: 20,
  isLoading: false,
  error: ''
})
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
const studioRemoteServiceCapacity = ref(null)
const promptTemplates = ref([])
const activationState = ref({
  status: 'not_logged_in',
  customerName: '',
  deviceCode: '',
  activatedAt: '',
  message: '',
  mode: 'server-license'
})
const isActivationLoading = ref(true)
const isActivationSubmitting = ref(false)
const isRechargeSubmitting = ref(false)
const isRechargeRefreshing = ref(false)
const isCatalogLoading = ref(false)
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
  amountCny: '0.01',
  couponCode: ''
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
let rechargeOrderController = null
let softwareOrderController = null
let computePackageOrderController = null

const activeGeneratorMenuKey = computed(() => {
  const menuKey = String(activeGeneratorMenu.value || '').trim()
  return resolveGeneratorView(menuKey) ? menuKey : ''
})

const currentDraft = computed(() => {
  return formDrafts.value[activeGeneratorMenuKey.value] || {}
})

const currentResultPayload = computed(() => {
  return resultsByMenu.value[activeGeneratorMenuKey.value] || {
    textResults: [],
    comparisonResults: [],
    groupedResults: [],
    summary: null
  }
})

const currentExportItems = computed(() => {
  return exportItemsByMenu.value[activeGeneratorMenuKey.value] || []
})

const activeWorkspaceGeneratorView = computed(() => {
  if (activeMenu.value !== 'workspace') {
    return null
  }

  return resolveGeneratorView(activeGeneratorMenuKey.value)
})

const isWorkspaceGeneratorView = computed(() => Boolean(activeWorkspaceGeneratorView.value))

const isWorkspaceHome = computed(() => {
  return activeMenu.value === 'workspace' && !isWorkspaceGeneratorView.value
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

const remoteServiceCapacity = computed(() => {
  return activationState.value.remoteServiceCapacity || studioRemoteServiceCapacity.value || null
})

const rechargeStatusLabel = computed(() => {
  const status = currentRechargeOrder.value?.status || ''
  if (status === 'paid') {
    return '已支付'
  }
  if (status === 'failed') {
    return '支付失败'
  }
  if (status === 'closed') {
    return '已关闭'
  }
  return '待支付'
})

function showActionFeedback({ type = 'success', title = '', message = '' }) {
  actionNotice.visible = true
  actionNotice.type = type
  actionNotice.title = title
  actionNotice.message = message
  window.setTimeout(() => {
    actionNotice.visible = false
  }, 2400)
}

function buildErrorMessage(error, fallback = '请求失败') {
  return String(error?.message || fallback)
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

function stopRuntimePolling() {
  if (runtimePollingTimer) {
    window.clearTimeout(runtimePollingTimer)
    runtimePollingTimer = null
  }
}

function queueRuntimePolling(delayMs = runtimePollingIntervalMs) {
  stopRuntimePolling()
  runtimePollingTimer = window.setTimeout(() => {
    void pollStudioRuntimeSnapshot()
  }, delayMs)
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
    const snapshot = await getStudioRuntimeSnapshot()
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

async function loadPromptTemplateState() {
  promptTemplates.value = await listPromptTemplates()
}

async function loadActivationState() {
  isActivationLoading.value = true
  try {
    activationState.value = await getActivationStatus()
  } finally {
    isActivationLoading.value = false
  }
}

async function loadStudioSnapshot() {
  const snapshot = await getStudioSnapshot()
  formDrafts.value = snapshot.formDrafts || {}
  workspaceDashboard.value = snapshot.workspaceDashboard || workspaceDashboard.value
  applyStudioRuntimeSnapshot(snapshot)
}

async function loadActivatedWorkspace() {
  await Promise.all([
    loadStudioSnapshot(),
    loadPromptTemplateState(),
    loadPurchaseCenterCatalog(),
    loadSelectionAssistantState()
  ])
}

async function loadSelectionAssistantState() {
  selectionManifest.value = await getSelectionManifest()
  selectionPlatforms.value = await listSelectionPlatforms()
  await refreshSelectionSites(selectionItemsState.value.platform)
  await refreshSelectionItems()
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

  selectionSites.value = await listSelectionSites({ platform })
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
    const payload = await listSelectionItems({
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
  if (!isActivated.value) {
    softwarePackages.value = []
    computePackages.value = []
    return
  }

  isCatalogLoading.value = true
  try {
    const [softwareRows, computeRows] = await Promise.all([
      listSoftwarePackages(),
      listComputePackages()
    ])
    softwarePackages.value = Array.isArray(softwareRows) ? softwareRows : []
    computePackages.value = Array.isArray(computeRows) ? computeRows : []
  } finally {
    isCatalogLoading.value = false
  }
}

function handleMenuSelect(menuKey) {
  activeGeneratorMenu.value = ''
  if (menuKey === 'workspace' && formDrafts.value.workspace?.projectId) {
    activeProductProjectId.value = formDrafts.value.workspace.projectId
  }
  activeMenu.value = menuKey
}

async function handleOpenProjectGenerator({ project, menuKey }) {
  if (!project?.id || !menuKey) {
    return
  }

  activeProductProjectId.value = project.id
  await persistDraft(menuKey, buildProjectGeneratorDraft(project, menuKey))
  activeMenu.value = 'workspace'
  activeGeneratorMenu.value = menuKey
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
  await saveStudioDraft({
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

async function handleCreateProject() {
  try {
    const createdProject = await createStudioProject({
      productName: '',
      platform: 'temu',
      language: 'zh-CN'
    })
    await loadStudioSnapshot()
    if (createdProject?.id) {
      activeProductProjectId.value = createdProject.id
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
    const result = await pickStudioInputAssets({
      menuKey: 'workspace',
      allowMultiple: false
    })

    if (result.canceled || !result.files?.[0] || !project?.id) {
      return
    }

    await updateStudioProject({
      projectId: project.id,
      patch: {
        assets: {
          sourceImages: [result.files[0]]
        }
      }
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
  try {
    await updateStudioProject({
      projectId,
      patch
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
    await deleteStudioProject({ projectId })
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
  const nextPlatform = Object.prototype.hasOwnProperty.call(patch, 'platform')
    ? patch.platform
    : selectionItemsState.value.platform

  if (Object.prototype.hasOwnProperty.call(patch, 'platform')) {
    await refreshSelectionSites(nextPlatform)
  }

  await refreshSelectionItems({
    ...patch,
    platform: nextPlatform,
    page: 1,
    siteCode: nextPlatform === 'shopee'
      ? (Object.prototype.hasOwnProperty.call(patch, 'siteCode') ? patch.siteCode : selectionItemsState.value.siteCode)
      : ''
  })
}

async function handleSelectionImport({ item, mode }) {
  if (!item?.id) {
    return
  }

  try {
    const detail = await getSelectionItemDetail({ id: item.id })
    const highlights = []
    if (detail.subtitle) highlights.push(detail.subtitle)
    if (detail.priceText) highlights.push(`价格：${detail.priceText}`)
    if (detail.salesVolumeText) highlights.push(`销量：${detail.salesVolumeText}`)
    if (detail.ratingText) highlights.push(`评分：${detail.ratingText}`)

    const patch = {
      name: detail.title || '选品项目',
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
          capturedAt: detail.capturedAt,
          sourceDetailUrl: detail.sourceDetailUrl || '',
          importedAt: new Date().toISOString()
        }
      }
    }

    let nextProjectId = ''
    if (mode === 'update' && activeProductProjectId.value) {
      const updatedProject = await updateStudioProject({
        projectId: activeProductProjectId.value,
        patch
      })
      nextProjectId = updatedProject?.id || activeProductProjectId.value
    } else {
      const createdProject = await createStudioProject({
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

async function handleSubmitTask(menuKey = activeGeneratorMenuKey.value) {
  if (!menuKey) {
    return
  }

  submitButtonState.value = 'pending'
  try {
    const draft = formDrafts.value[menuKey] || {}
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

    await createStudioTask({
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

async function handleRunProject(project) {
  if (!project?.id) {
    return
  }

  submitButtonState.value = 'pending'
  try {
    await createStudioTask({
      menuKey: 'workspace',
      draft: buildWorkspaceRunDraft(project, formDrafts.value.workspace || {})
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

async function handlePickGeneratorImage() {
  if (!activeGeneratorMenuKey.value) {
    return
  }

  try {
    const result = await pickStudioInputAssets({
      menuKey: activeGeneratorMenuKey.value,
      allowMultiple: false
    })

    if (result.canceled || !result.files?.[0]) {
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

async function handleOpenImages(project) {
  const latestRun = resolveLatestRun(project, projectRuns.value)
  const imageDirectory = resolveImageOutputDirectory(project, latestRun)

  if (!imageDirectory) {
    return
  }

  await openOutputDirectory({
    outputDirectory: imageDirectory
  })
}

async function handleOpenVideo(project) {
  const latestRun = resolveLatestRun(project, projectRuns.value)
  const videoDirectory = resolveVideoOutputDirectory(project, latestRun)

  if (!videoDirectory) {
    return
  }

  await openOutputDirectory({
    outputDirectory: videoDirectory
  })
}

async function handleOpenResource(target) {
  if (!target) {
    return
  }

  await openExternalResource({ target })
}

async function handleExportProject(projectId) {
  try {
    await exportStudioProjectBundle({ projectId })
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

  await openOutputDirectory({
    outputDirectory
  })
}

async function handleExportCurrentResults(payload = {}) {
  if (!activeGeneratorMenuKey.value) {
    return
  }

  const selectedExportIds = Array.isArray(payload?.selectedExportIds) && payload.selectedExportIds.length
    ? payload.selectedExportIds
    : currentExportItems.value.map((item) => item.id).filter(Boolean)

  if (!selectedExportIds.length) {
    return
  }

  try {
    const exportResult = await exportStudioResults({
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

async function handleCopyDeviceCode() {
  await navigator.clipboard.writeText(activationState.value.deviceCode || '')
  showActionFeedback({
    type: 'success',
    title: '已复制',
    message: '设备码已复制'
  })
}

async function handleActivateRemote(payload) {
  isActivationSubmitting.value = true
  try {
    activationState.value = await activateRemoteLicense({
      customerName: payload.customerName,
      contact: payload.contact,
      inviteCode: payload.inviteCode,
      deviceName: 'QiuAi Desktop'
    })

    if (activationState.value.status === 'activated') {
      await loadActivatedWorkspace()
      showActionFeedback({
        type: 'success',
        title: '激活成功',
        message: '当前设备已授权'
      })
    }
  } catch (error) {
    showActionFeedback({
      type: 'error',
      title: '激活失败',
      message: buildErrorMessage(error, '设备激活失败')
    })
  } finally {
    isActivationSubmitting.value = false
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
  await savePromptTemplate(payload)
  await loadPromptTemplateState()
}

async function handleRemovePromptTemplate(templateId) {
  await removePromptTemplate({ id: templateId })
  await loadPromptTemplateState()
}

function openPurchaseCenter() {
  activeGeneratorMenu.value = ''
  activeMenu.value = 'purchase-center'
}

function handleRechargeFormUpdate({ field, value }) {
  if (!field) {
    return
  }

  rechargeForm[field] = value
}

async function handleCreateRecharge() {
  await rechargeOrderController?.create()
}

async function handleRefreshRechargeOrder() {
  await rechargeOrderController?.refresh()
}

async function handleCreateSoftwareOrder(productPackageId) {
  if (!productPackageId) {
    return
  }
  await softwareOrderController?.create(productPackageId)
}

async function handleRefreshSoftwareOrder() {
  await softwareOrderController?.refresh()
}

async function handleOpenSoftwareOrderLink() {
  await softwareOrderController?.openPaymentLink()
}

async function handleCreateComputePackageOrder(computePackageId) {
  if (!computePackageId) {
    return
  }
  await computePackageOrderController?.create(computePackageId)
}

async function handleRefreshComputePackageOrder() {
  await computePackageOrderController?.refresh()
}

async function handleOpenComputePackageOrderLink() {
  await computePackageOrderController?.openPaymentLink()
}

async function handleOpenRechargeLink() {
  await rechargeOrderController?.openPaymentLink()
}

rechargeOrderController = createRechargeOrderController({
  currentRechargeOrderRef: currentRechargeOrder,
  isRechargeSubmittingRef: isRechargeSubmitting,
  isRechargeRefreshingRef: isRechargeRefreshing,
  rechargeForm,
  createRechargeOrder,
  getRechargeOrder,
  openExternalResource,
  showActionFeedback,
  buildErrorMessage,
  loadStudioSnapshot,
  loadActivationState
})

softwareOrderController = createSoftwareOrderController({
  currentSoftwareOrderRef: currentSoftwareOrder,
  isSoftwareOrderSubmittingRef: isSoftwareOrderSubmitting,
  isSoftwareOrderRefreshingRef: isSoftwareOrderRefreshing,
  createSoftwareOrder,
  getSoftwareOrder,
  openExternalResource,
  showActionFeedback,
  buildErrorMessage,
  loadActivationState,
  loadStudioSnapshot,
  loadPurchaseCenterCatalog
})

computePackageOrderController = createComputePackageOrderController({
  currentComputePackageOrderRef: currentComputePackageOrder,
  isComputePackageOrderSubmittingRef: isComputePackageOrderSubmitting,
  isComputePackageOrderRefreshingRef: isComputePackageOrderRefreshing,
  computePackagesRef: computePackages,
  createComputePackageOrder,
  getComputePackageOrder,
  openExternalResource,
  showActionFeedback,
  buildErrorMessage,
  loadActivationState,
  loadStudioSnapshot,
  loadPurchaseCenterCatalog
})

onMounted(() => {
  void (async () => {
    await loadActivationState()
    if (isActivated.value) {
      await loadActivatedWorkspace()
    }
  })()
})

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

onUnmounted(() => {
  stopRuntimePolling()
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
      @recharge-click="openPurchaseCenter"
    />

    <div v-if="actionNotice.visible" class="app-notice-layer" role="status" aria-live="polite">
      <div class="app-notice" :class="`app-notice--${actionNotice.type}`">
        <strong>{{ actionNotice.title }}</strong>
        <span>{{ actionNotice.message }}</span>
      </div>
    </div>

    <section v-if="isActivationLoading || !isActivated" class="activation-shell">
      <ActivationGate
        :activation-state="activationState"
        :is-loading="isActivationLoading"
        :is-submitting="isActivationSubmitting"
        @activate-remote="handleActivateRemote"
        @copy-device-code="handleCopyDeviceCode"
      />
    </section>

    <section v-else class="shell-grid shell-grid--simple">
      <aside class="shell-grid__sidebar">
        <WorkspaceSidebar
          :menu-items="menuItems"
          :active-menu="activeMenu"
          @menu-select="handleMenuSelect"
        />
      </aside>

      <section class="shell-grid__workspace">
        <ProductWorkbench
          v-if="isWorkspaceHome"
          :product-projects="productProjects"
          :project-runs="projectRuns"
          :active-project-id="activeProductProjectId"
          :focus-project-id="activeProductProjectId"
          :submit-button-state="submitButtonState"
          :selection-manifest="selectionManifest"
          :selection-platforms="selectionPlatforms"
          :selection-sites="selectionSites"
          :selection-state="selectionItemsState"
          @create-project="handleCreateProject"
          @run-project="handleRunProject"
          @replace-project-image="handleReplaceProjectImage"
          @update-project="handleProjectUpdate"
          @delete-project="handleProjectDelete"
          @copy-text="handleCopyText"
          @open-images="handleOpenImages"
          @open-video="handleOpenVideo"
          @open-resource="handleOpenResource"
          @export-project="handleExportProject"
          @open-generator="handleOpenProjectGenerator"
          @selection-query-change="handleSelectionQueryChange"
          @selection-import="handleSelectionImport"
        />

        <GeneratorStudioPage
          v-else-if="isWorkspaceGeneratorView"
          :title="activeWorkspaceGeneratorView.title"
          :mode="activeWorkspaceGeneratorView.mode"
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
          :wallet-summary="activationState.walletSummary || null"
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
          @refresh-software-order="handleRefreshSoftwareOrder"
          @open-software-order="handleOpenSoftwareOrderLink"
          @create-compute-package-order="handleCreateComputePackageOrder"
          @refresh-compute-package-order="handleRefreshComputePackageOrder"
          @open-compute-package-order="handleOpenComputePackageOrderLink"
          @update-recharge-form="handleRechargeFormUpdate"
          @create-recharge="handleCreateRecharge"
          @refresh-recharge-order="handleRefreshRechargeOrder"
          @open-recharge-order="handleOpenRechargeLink"
        />

        <DataCenterPage
          v-else-if="activeMenu === 'account-usage'"
          :workspace-dashboard="workspaceDashboard"
        />

        <PromptLibraryPanel
          v-else-if="activeMenu === 'prompt-library'"
          :prompt-templates="promptTemplates"
          @save-template="handleSavePromptTemplate"
          @remove-template="handleRemovePromptTemplate"
        />
      </section>
    </section>

  </main>
</template>
