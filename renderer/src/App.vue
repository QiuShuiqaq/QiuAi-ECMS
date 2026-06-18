<script setup>
import { computed, onMounted, onUnmounted, reactive, ref, watch } from 'vue'
import AppTopBar from './components/AppTopBar.vue'
import ActivationGate from './components/ActivationGate.vue'
import WorkspaceSidebar from './components/WorkspaceSidebar.vue'
import PromptLibraryPanel from './components/PromptLibraryPanel.vue'
import ProductWorkbench from './components/ProductWorkbench.vue'
import PurchaseCenterPage from './components/PurchaseCenterPage.vue'
import DataCenterPage from './components/DataCenterPage.vue'
import ProductTemplateDemoPage from './components/ProductTemplateDemoPage.vue'
import ModelConfigPage from './components/ModelConfigPage.vue'
import GeneratorStudioPage from './components/GeneratorStudioPage.vue'
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
  getSettings,
  getSoftwareOrder,
  getStudioRuntimeSnapshot,
  getStudioSnapshot,
  importLicenseFile,
  listComputePackages,
  listPromptTemplates,
  listSoftwarePackages,
  openOutputDirectory,
  openExternalResource,
  pickStudioInputAssets,
  removePromptTemplate,
  savePromptTemplate,
  saveProviderApiKeys,
  saveStudioDraft,
  updateStudioProject
} from './services/desktopBridge'

const themeOptions = [{ label: '深色', value: 'dark' }]

const menuItems = [
  { key: 'workspace', label: '工作台', section: '项目' },
  { key: 'purchase-center', label: '购买中心', section: '项目' },
  { key: 'data-center', label: '数据中心', section: '项目' },
  { key: 'product-template', label: '商品模板', section: '项目' },
  { key: 'title-generator', label: '标题生成', section: '生成' },
  { key: 'description-generator', label: '描述生成', section: '生成' },
  { key: 'series-generate', label: '套图生成', section: '生成' },
  { key: 'video-generate', label: '视频生成', section: '生成' },
  { key: 'model-pricing', label: '模型价格', section: '系统' },
  { key: 'prompt-library', label: '提示词库', section: '系统' },
  { key: 'model-config', label: '模型配置', section: '系统' }
]

const activeTheme = ref('dark')
const activeMenu = ref('workspace')
const submitButtonState = ref('idle')
const formDrafts = ref({})
const resultsByMenu = ref({})
const exportItemsByMenu = ref({})
const productProjects = ref([])
const projectRuns = ref([])
const activeProductProjectId = ref('')
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
const isModelConfigSaving = ref(false)
const modelConfigTextApiKeyDraft = ref('')
const modelConfigImageApiKeyDraft = ref('')
const modelConfigVideoApiKeyDraft = ref('')
const modelConfigFeedback = ref('')
const rechargeDialogVisible = ref(false)
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
let rechargeStatusPollingTimer = null
let softwareOrderPollingTimer = null
let computePackageOrderPollingTimer = null

const currentDraft = computed(() => {
  return formDrafts.value[activeMenu.value] || {}
})

const currentResultPayload = computed(() => {
  return resultsByMenu.value[activeMenu.value] || {
    textResults: [],
    comparisonResults: [],
    groupedResults: [],
    summary: null
  }
})

const currentExportItems = computed(() => {
  return exportItemsByMenu.value[activeMenu.value] || []
})

const fixedPromptTemplates = computed(() => {
  return promptTemplates.value.filter((item) => item.source === 'system-fixed')
})

const customPromptTemplates = computed(() => {
  return promptTemplates.value.filter((item) => item.source !== 'system-fixed')
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

const walletSummary = computed(() => {
  return activationState.value.walletSummary || null
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

const pricingCards = computed(() => {
  return [
    {
      categoryKey: 'text',
      categoryLabel: '文本',
      title: 'deepseek-v4-flash',
      unit: 'CNY',
      accent: 'text',
      items: [
        { label: '输入 缓存命中', value: '0.02 / 百万 tokens' },
        { label: '输入 缓存未命中', value: '1.00 / 百万 tokens' },
        { label: '输出', value: '2.00 / 百万 tokens' }
      ]
    },
    {
      categoryKey: 'text',
      categoryLabel: '文本',
      title: 'deepseek-v4-pro',
      unit: 'CNY',
      accent: 'text',
      items: [
        { label: '输入 缓存命中', value: '0.025 / 百万 tokens' },
        { label: '输入 缓存未命中', value: '3.00 / 百万 tokens' },
        { label: '输出', value: '6.00 / 百万 tokens' }
      ]
    },
    {
      categoryKey: 'image',
      categoryLabel: '图片',
      title: 'nano-banana-fast',
      unit: 'CNY',
      accent: 'image',
      items: [
        { label: '单次生成', value: '0.06 / 次' }
      ]
    },
    {
      categoryKey: 'image',
      categoryLabel: '图片',
      title: 'gpt-image-2',
      unit: 'CNY',
      accent: 'image',
      items: [
        { label: '单次生成', value: '0.12 / 次' }
      ]
    },
    {
      categoryKey: 'image',
      categoryLabel: '图片',
      title: 'nano-banana-2',
      unit: 'CNY',
      accent: 'image',
      items: [
        { label: '单次生成', value: '0.20 / 次' }
      ]
    },
    {
      categoryKey: 'video',
      categoryLabel: '视频',
      title: 'MiniMax-Hailuo-2.3-Fast',
      unit: 'CNY',
      accent: 'video',
      items: [
        { label: '图生视频 768P 6s', value: '2.70 CNY' },
        { label: '图生视频 768P 10s', value: '4.50 CNY' },
        { label: '图生视频 1080P 6s', value: '4.62 CNY' }
      ]
    }
  ]
})

const pricingSections = computed(() => {
  const sectionOrder = [
    { key: 'text', label: '文本' },
    { key: 'image', label: '图片' },
    { key: 'video', label: '视频' }
  ]

  return sectionOrder
    .map((section) => {
      return {
        ...section,
        cards: pricingCards.value.filter((item) => item.categoryKey === section.key)
      }
    })
    .filter((section) => section.cards.length)
})

const pricingSectionStyleMap = {
  text: {
    background: `
      radial-gradient(circle at top right, rgba(78, 119, 255, 0.14), transparent 34%),
      linear-gradient(180deg, rgba(255, 255, 255, 0.035), rgba(255, 255, 255, 0.01)),
      rgba(10, 12, 22, 0.72)
    `
  },
  image: {
    background: `
      radial-gradient(circle at top right, rgba(73, 213, 159, 0.14), transparent 34%),
      linear-gradient(180deg, rgba(255, 255, 255, 0.035), rgba(255, 255, 255, 0.01)),
      rgba(10, 12, 22, 0.72)
    `
  },
  video: {
    background: `
      radial-gradient(circle at top right, rgba(255, 184, 107, 0.14), transparent 34%),
      linear-gradient(180deg, rgba(255, 255, 255, 0.035), rgba(255, 255, 255, 0.01)),
      rgba(10, 12, 22, 0.72)
    `
  }
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
  activeTheme.value = snapshot.themeMode || 'dark'
  formDrafts.value = snapshot.formDrafts || {}
  workspaceDashboard.value = snapshot.workspaceDashboard || workspaceDashboard.value
  applyStudioRuntimeSnapshot(snapshot)
}

async function loadSettingsState() {
  const settings = await getSettings()
  modelConfigImageApiKeyDraft.value = settings.apiKey || ''
  modelConfigTextApiKeyDraft.value = settings.providerApiKeys?.deepseek || ''
  modelConfigVideoApiKeyDraft.value = settings.providerApiKeys?.minimax || ''
  return settings
}

async function loadActivatedWorkspace() {
  await Promise.all([
    loadStudioSnapshot(),
    loadPromptTemplateState(),
    loadPurchaseCenterCatalog()
  ])
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

function handleThemeChange(value) {
  activeTheme.value = value
}

function handleMenuSelect(menuKey) {
  if (menuKey === 'workspace' && currentDraft.value?.projectId) {
    activeProductProjectId.value = currentDraft.value.projectId
  }
  activeMenu.value = menuKey
}

const seriesGenerateDefaultTypes = [
  { imageType: '商品主图', templateId: 'image-main' },
  { imageType: '白底图', templateId: 'image-white-bg' },
  { imageType: '详情图', templateId: 'image-detail' },
  { imageType: '细节图', templateId: 'image-closeup' },
  { imageType: '尺寸图', templateId: 'image-size' },
  { imageType: '颜色图', templateId: 'image-color' },
  { imageType: '场景图', templateId: 'image-scene' },
  { imageType: '模特图', templateId: 'image-model' },
  { imageType: '换角度', templateId: 'image-angle' },
  { imageType: '换场景', templateId: 'image-change-scene' },
  { imageType: '换模特', templateId: 'image-change-model' },
  { imageType: '全替换', templateId: 'image-replace-all' }
]

function buildSeriesPromptAssignments({
  count = 4,
  sharedPrompt = ''
} = {}) {
  const normalizedCount = Math.max(1, Number(count) || 4)

  return Array.from({ length: normalizedCount }, (_unused, index) => {
    const fallback = seriesGenerateDefaultTypes[index] || seriesGenerateDefaultTypes[2]
    return {
      id: `series-generate-${index + 1}`,
      index: index + 1,
      prompt: sharedPrompt || '',
      templateId: fallback.templateId,
      imageType: fallback.imageType,
      differenceLevel: 'off'
    }
  })
}

async function handleOpenProjectGenerator({ project, menuKey }) {
  if (!project?.id || !menuKey) {
    return
  }

  activeProductProjectId.value = project.id
  const generationConfig = project.generationConfig || {}
  const basePatch = {
    projectId: project.id,
    projectName: project.name || project.baseInfo?.productName || '',
    taskName: project.name || project.baseInfo?.productName || '',
    productName: project.baseInfo?.productName || project.name || '',
    platformTargetsText: (project.platformTarget || []).join(', '),
    language: project.baseInfo?.language || 'zh-CN',
    keywordsText: (project.baseInfo?.keywords || []).join(', '),
    sourceImage: project.assets?.sourceImages?.[0] || null
  }

  const modePatchMap = {
    'title-generator': {
      titleMaxChars: generationConfig.titleMaxChars || 60,
      titlePrompt: generationConfig.titlePrompt || '',
      titleTemplateId: generationConfig.titleTemplateId || ''
    },
    'description-generator': {
      descriptionMaxChars: generationConfig.descriptionMaxChars || 300,
      descriptionPrompt: generationConfig.descriptionPrompt || '',
      descriptionTemplateId: generationConfig.descriptionTemplateId || ''
    },
    'series-generate': {
      model: generationConfig.imageModel || 'gpt-image-2',
      size: generationConfig.imageSize || '1:1',
      imageSize: generationConfig.imageSize || '1:1',
      generateCount: 4,
      batchCount: 1,
      prompt: generationConfig.imagePrompt || '',
      imageTemplateId: generationConfig.imageTemplateId || 'image-default',
      imageType: '商品主图',
      promptAssignments: buildSeriesPromptAssignments({
        count: 4,
        sharedPrompt: generationConfig.imagePrompt || ''
      })
    },
    'video-generate': {
      duration: generationConfig.videoDuration || '6s',
      resolution: generationConfig.videoResolution || '768P',
      aspectRatio: generationConfig.aspectRatio || '16:9',
      motionStrength: generationConfig.videoMotionStrength || 'auto',
      prompt: generationConfig.videoPrompt || '',
      videoTemplateId: generationConfig.videoTemplateId || 'video-main',
      model: generationConfig.videoModel || 'MiniMax-Hailuo-2.3-Fast',
      videoQuantity: Math.max(1, Number(generationConfig.videoQuantity) || 1)
    }
  }

  await persistDraft(menuKey, {
    ...basePatch,
    ...(modePatchMap[menuKey] || {})
  })
  activeMenu.value = menuKey
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
  await persistDraft(activeMenu.value, {
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

async function handleSubmitTask(menuKey = activeMenu.value) {
  submitButtonState.value = 'pending'
  try {
    const draft = formDrafts.value[menuKey] || {}
    if ((menuKey === 'series-generate' || menuKey === 'video-generate') && !draft.sourceImage) {
      showActionFeedback({
        type: 'error',
        title: '请先上传样图',
        message: '套图生成和视频生成都需要先上传样图'
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
    const sourceImage = project.assets?.sourceImages?.[0] || null
    const generationConfig = project.generationConfig || {}
    await createStudioTask({
      menuKey: 'workspace',
      draft: {
        ...(formDrafts.value.workspace || {}),
        projectId: project.id,
        projectName: project.name || project.baseInfo?.productName || '',
        productName: project.baseInfo?.productName || project.name || '',
        taskName: project.name || project.baseInfo?.productName || '',
        brand: project.baseInfo?.brand || '',
        category: project.baseInfo?.category || '',
        highlightsText: (project.baseInfo?.highlights || []).join(', '),
        platformTargetsText: (project.platformTarget || []).join(', '),
        language: project.baseInfo?.language || 'zh-CN',
        keywordsText: [formDrafts.value.workspace?.keywordsText || '', ...(project.baseInfo?.keywords || [])]
          .filter(Boolean)
          .join(', '),
        sourceImage,
        enabledSteps: generationConfig.enabledSteps || undefined,
        titleMaxChars: generationConfig.titleMaxChars || formDrafts.value.workspace?.titleMaxChars || 60,
        descriptionMaxChars: generationConfig.descriptionMaxChars || formDrafts.value.workspace?.descriptionMaxChars || 300,
        titlePrompt: generationConfig.titlePrompt || formDrafts.value.workspace?.titlePrompt || '',
        descriptionPrompt: generationConfig.descriptionPrompt || formDrafts.value.workspace?.descriptionPrompt || '',
        imagePrompt: generationConfig.imagePrompt || '',
        videoPrompt: generationConfig.videoPrompt || '',
        imageSize: generationConfig.imageSize || '1:1',
        size: generationConfig.imageSize || '1:1',
        videoDuration: generationConfig.videoDuration || '6s',
        duration: generationConfig.videoDuration || '6s',
        videoResolution: generationConfig.videoResolution || '768P',
        resolution: generationConfig.videoResolution || '768P',
        aspectRatio: generationConfig.aspectRatio || '16:9',
        videoMotionStrength: generationConfig.videoMotionStrength || 'auto',
        motionStrength: generationConfig.videoMotionStrength || 'auto',
        titleTemplateId: generationConfig.titleTemplateId || '',
        descriptionTemplateId: generationConfig.descriptionTemplateId || '',
        imageTemplateId: generationConfig.imageTemplateId || 'image-default',
        videoTemplateId: generationConfig.videoTemplateId || 'video-main',
        model: generationConfig.videoModel || 'MiniMax-Hailuo-2.3-Fast'
      }
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
  try {
    const result = await pickStudioInputAssets({
      menuKey: activeMenu.value,
      allowMultiple: false
    })

    if (result.canceled || !result.files?.[0]) {
      return
    }

    await persistDraft(activeMenu.value, {
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
  const payload = project && typeof project === 'object' && Object.prototype.hasOwnProperty.call(project, 'project')
    ? project
    : { project, run: null }
  const latestRun = payload.run || projectRuns.value.find((item) => item.id === payload.project?.latestRunId) || null
  const imageDirectory = latestRun?.storage?.imageDirectory ||
    (latestRun?.outputs?.images?.[0]?.savedPath ? latestRun.outputs.images[0].savedPath.replace(/[\\/][^\\/]+$/, '') : '') ||
    payload.project?.assets?.generatedImages?.[0]?.savedPath?.replace(/[\\/][^\\/]+$/, '') ||
    payload.project?.assets?.generatedImages?.[0]?.path?.replace(/[\\/][^\\/]+$/, '')

  if (!imageDirectory) {
    return
  }

  await openOutputDirectory({
    outputDirectory: imageDirectory
  })
}

async function handleOpenVideo(project) {
  const payload = project && typeof project === 'object' && Object.prototype.hasOwnProperty.call(project, 'project')
    ? project
    : { project, run: null }
  const latestRun = payload.run || projectRuns.value.find((item) => item.id === payload.project?.latestRunId) || null
  const videoDirectory = latestRun?.storage?.videoDirectory ||
    (latestRun?.outputs?.video?.savedPath ? latestRun.outputs.video.savedPath.replace(/[\\/][^\\/]+$/, '') : '') ||
    payload.project?.assets?.generatedVideo?.savedPath?.replace(/[\\/][^\\/]+$/, '')

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
  const selectedExportIds = Array.isArray(payload?.selectedExportIds) && payload.selectedExportIds.length
    ? payload.selectedExportIds
    : currentExportItems.value.map((item) => item.id).filter(Boolean)

  if (!selectedExportIds.length) {
    return
  }

  try {
    const exportResult = await exportStudioResults({
      menuKey: activeMenu.value,
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

async function handleImportLicense() {
  await importLicenseFile()
  await loadActivationState()
  if (isActivated.value) {
    await loadActivatedWorkspace()
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
    await loadSettingsState()

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

async function handleSaveModelConfig() {
  isModelConfigSaving.value = true
  modelConfigFeedback.value = ''
  try {
    const settings = await saveProviderApiKeys({
      textApiKey: modelConfigTextApiKeyDraft.value,
      imageApiKey: modelConfigImageApiKeyDraft.value,
      videoApiKey: modelConfigVideoApiKeyDraft.value
    })

    modelConfigImageApiKeyDraft.value = settings.apiKey || ''
    modelConfigTextApiKeyDraft.value = settings.providerApiKeys?.deepseek || ''
    modelConfigVideoApiKeyDraft.value = settings.providerApiKeys?.minimax || ''

    showActionFeedback({
      type: 'success',
      title: '保存成功',
      message: '模型配置已更新'
    })
  } catch (error) {
    modelConfigFeedback.value = buildErrorMessage(error, '保存失败')
  } finally {
    isModelConfigSaving.value = false
  }
}

async function handleSavePromptTemplate(payload) {
  await savePromptTemplate(payload)
  await loadPromptTemplateState()
}

async function handleRemovePromptTemplate(templateId) {
  await removePromptTemplate({ id: templateId })
  await loadPromptTemplateState()
}

function openRechargeDialog() {
  rechargeDialogVisible.value = true
}

function closeRechargeDialog() {
  rechargeDialogVisible.value = false
  currentRechargeOrder.value = null
}

async function handleCreateRecharge() {
  isRechargeSubmitting.value = true
  try {
    currentRechargeOrder.value = await createRechargeOrder({
      walletType: rechargeForm.walletType,
      channel: rechargeForm.channel,
      amountCny: Number(rechargeForm.amountCny),
      couponCode: rechargeForm.couponCode
    })
    startRechargeStatusPolling()

    showActionFeedback({
      type: 'success',
      title: '订单已创建',
      message: '请继续完成支付'
    })
  } catch (error) {
    showActionFeedback({
      type: 'error',
      title: '创建失败',
      message: buildErrorMessage(error, '充值订单创建失败')
    })
  } finally {
    isRechargeSubmitting.value = false
  }
}

async function handleRefreshRechargeOrder() {
  if (!currentRechargeOrder.value?.id) {
    return
  }

  isRechargeRefreshing.value = true
  try {
    currentRechargeOrder.value = await getRechargeOrder({
      id: currentRechargeOrder.value.id
    })

    if (currentRechargeOrder.value.status === 'paid') {
      await Promise.all([
        loadStudioSnapshot(),
        loadActivationState()
      ])
      showActionFeedback({
        type: 'success',
        title: '到账成功',
        message: '余额已更新'
      })
    }
  } catch (error) {
    showActionFeedback({
      type: 'error',
      title: '查询失败',
      message: buildErrorMessage(error, '订单状态查询失败')
    })
  } finally {
    isRechargeRefreshing.value = false
  }
}

async function handleCreateSoftwareOrder(productPackageId) {
  if (!productPackageId) {
    return
  }

  isSoftwareOrderSubmitting.value = true
  try {
    currentSoftwareOrder.value = await createSoftwareOrder({
      productPackageId,
      channel: 'alipay'
    })
    startSoftwareOrderPolling()

    showActionFeedback({
      type: 'success',
      title: '授权订单已创建',
      message: '请继续完成支付'
    })
  } catch (error) {
    showActionFeedback({
      type: 'error',
      title: '创建失败',
      message: buildErrorMessage(error, '授权订单创建失败')
    })
  } finally {
    isSoftwareOrderSubmitting.value = false
  }
}

async function handleRefreshSoftwareOrder() {
  if (!currentSoftwareOrder.value?.id) {
    return
  }

  isSoftwareOrderRefreshing.value = true
  try {
    currentSoftwareOrder.value = await getSoftwareOrder({
      id: currentSoftwareOrder.value.id
    })

    if (currentSoftwareOrder.value?.status === 'paid') {
      await Promise.all([
        loadActivationState(),
        loadStudioSnapshot(),
        loadPurchaseCenterCatalog()
      ])
      showActionFeedback({
        type: 'success',
        title: '授权已到账',
        message: '已同步最新授权状态'
      })
    }
  } catch (error) {
    showActionFeedback({
      type: 'error',
      title: '查询失败',
      message: buildErrorMessage(error, '授权订单查询失败')
    })
  } finally {
    isSoftwareOrderRefreshing.value = false
  }
}

async function handleOpenSoftwareOrderLink() {
  const payUrl = currentSoftwareOrder.value?.paymentPayload?.mockPayUrl || ''
  if (!payUrl) {
    return
  }

  await navigator.clipboard.writeText(payUrl)
  await openExternalResource({ target: payUrl })
  showActionFeedback({
    type: 'success',
    title: '已打开支付',
    message: '授权订单支付链接已在浏览器打开'
  })
}

async function handleCreateComputePackageOrder(computePackageId) {
  if (!computePackageId) {
    return
  }

  isComputePackageOrderSubmitting.value = true
  try {
    currentComputePackageOrder.value = await createComputePackageOrder({
      computePackageId,
      channel: 'alipay'
    })
    startComputePackageOrderPolling()

    showActionFeedback({
      type: 'success',
      title: '月套餐订单已创建',
      message: '请继续完成支付'
    })
  } catch (error) {
    showActionFeedback({
      type: 'error',
      title: '创建失败',
      message: buildErrorMessage(error, '月套餐订单创建失败')
    })
  } finally {
    isComputePackageOrderSubmitting.value = false
  }
}

async function handleRefreshComputePackageOrder() {
  if (!currentComputePackageOrder.value?.id) {
    return
  }

  isComputePackageOrderRefreshing.value = true
  try {
    currentComputePackageOrder.value = await getComputePackageOrder({
      id: currentComputePackageOrder.value.id
    })

    if (currentComputePackageOrder.value?.status === 'paid') {
      await Promise.all([
        loadActivationState(),
        loadStudioSnapshot(),
        loadPurchaseCenterCatalog()
      ])
      showActionFeedback({
        type: 'success',
        title: '月套餐已到账',
        message: '已同步最新算力额度'
      })
    }
  } catch (error) {
    showActionFeedback({
      type: 'error',
      title: '查询失败',
      message: buildErrorMessage(error, '月套餐订单查询失败')
    })
  } finally {
    isComputePackageOrderRefreshing.value = false
  }
}

async function handleOpenComputePackageOrderLink() {
  const payUrl = currentComputePackageOrder.value?.paymentPayload?.mockPayUrl || ''
  if (!payUrl) {
    return
  }

  await navigator.clipboard.writeText(payUrl)
  await openExternalResource({ target: payUrl })
  showActionFeedback({
    type: 'success',
    title: '已打开支付',
    message: '月套餐订单支付链接已在浏览器打开'
  })
}

function stopRechargeStatusPolling() {
  if (rechargeStatusPollingTimer) {
    clearInterval(rechargeStatusPollingTimer)
    rechargeStatusPollingTimer = null
  }
}

function stopSoftwareOrderPolling() {
  if (softwareOrderPollingTimer) {
    clearInterval(softwareOrderPollingTimer)
    softwareOrderPollingTimer = null
  }
}

function stopComputePackageOrderPolling() {
  if (computePackageOrderPollingTimer) {
    clearInterval(computePackageOrderPollingTimer)
    computePackageOrderPollingTimer = null
  }
}

function startRechargeStatusPolling() {
  stopRechargeStatusPolling()

  rechargeStatusPollingTimer = setInterval(() => {
    if (!currentRechargeOrder.value?.id || isRechargeRefreshing.value) {
      return
    }

    if (['paid', 'failed', 'closed'].includes(currentRechargeOrder.value.status)) {
      stopRechargeStatusPolling()
      return
    }

    void handleRefreshRechargeOrder()
  }, 5000)
}

function startSoftwareOrderPolling() {
  stopSoftwareOrderPolling()

  softwareOrderPollingTimer = setInterval(() => {
    if (!currentSoftwareOrder.value?.id || isSoftwareOrderRefreshing.value) {
      return
    }

    if (['paid', 'failed', 'closed'].includes(currentSoftwareOrder.value.status)) {
      stopSoftwareOrderPolling()
      return
    }

    void handleRefreshSoftwareOrder()
  }, 5000)
}

function startComputePackageOrderPolling() {
  stopComputePackageOrderPolling()

  computePackageOrderPollingTimer = setInterval(() => {
    if (!currentComputePackageOrder.value?.id || isComputePackageOrderRefreshing.value) {
      return
    }

    if (['paid', 'failed', 'closed'].includes(currentComputePackageOrder.value.status)) {
      stopComputePackageOrderPolling()
      return
    }

    void handleRefreshComputePackageOrder()
  }, 5000)
}

async function handleOpenRechargeLink() {
  const payUrl = currentRechargeOrder.value?.paymentPayload?.mockPayUrl || ''
  if (!payUrl) {
    return
  }

  await navigator.clipboard.writeText(payUrl)
  await openExternalResource({ target: payUrl })
  showActionFeedback({
    type: 'success',
    title: '已打开',
    message: '支付链接已在新窗口打开'
  })
}

onMounted(() => {
  void (async () => {
    await loadActivationState()
    await loadSettingsState()
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
  stopRechargeStatusPolling()
  stopSoftwareOrderPolling()
  stopComputePackageOrderPolling()
})
</script>

<template>
  <main class="app-shell" :data-theme="activeTheme">
    <AppTopBar
      brand-label="QiuAi"
      :theme-options="themeOptions"
      :active-theme="activeTheme"
      :activation-summary="activationSummary"
      :recharge-enabled="isActivated"
      @cleanup-click="openClearRuntimeConfirm"
      @theme-change="handleThemeChange"
      @recharge-click="openRechargeDialog"
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
        @import-license="handleImportLicense"
        @refresh-license="loadActivationState"
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
          v-if="activeMenu === 'workspace'"
          :product-projects="productProjects"
          :project-runs="projectRuns"
          :active-project-id="activeProductProjectId"
          :focus-project-id="activeProductProjectId"
          :prompt-templates="promptTemplates"
          :submit-button-state="submitButtonState"
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
        />

        <DataCenterPage
          v-else-if="activeMenu === 'data-center'"
          :workspace-dashboard="workspaceDashboard"
        />

        <PurchaseCenterPage
          v-else-if="activeMenu === 'purchase-center'"
          :activation-state="activationState"
          :wallet-summary="walletSummary"
          :software-packages="softwarePackages"
          :compute-packages="computePackages"
          :current-software-order="currentSoftwareOrder"
          :current-compute-package-order="currentComputePackageOrder"
          :current-recharge-order="currentRechargeOrder"
          :is-catalog-loading="isCatalogLoading"
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
          @open-recharge="openRechargeDialog"
          @refresh-recharge-order="handleRefreshRechargeOrder"
          @open-recharge-order="handleOpenRechargeLink"
        />

        <ProductTemplateDemoPage
          v-else-if="activeMenu === 'product-template'"
        />

        <GeneratorStudioPage
          v-else-if="activeMenu === 'title-generator'"
          title="标题生成"
          mode="title"
          :draft="currentDraft"
          :result-payload="currentResultPayload"
          :export-items="currentExportItems"
          :tasks="studioTasks"
          :agent-readiness="studioAgentReadiness"
          :prompt-templates="promptTemplates"
          @update-draft="handleDraftUpdate"
          @submit-task="handleSubmitTask('title-generator')"
          @pick-image="handlePickGeneratorImage"
          @copy-text="handleCopyText"
          @open-export-item="handleOpenGeneratorExportItem"
          @export-results="handleExportCurrentResults"
        />

        <GeneratorStudioPage
          v-else-if="activeMenu === 'description-generator'"
          title="描述生成"
          mode="description"
          :draft="currentDraft"
          :result-payload="currentResultPayload"
          :export-items="currentExportItems"
          :tasks="studioTasks"
          :agent-readiness="studioAgentReadiness"
          :prompt-templates="promptTemplates"
          @update-draft="handleDraftUpdate"
          @submit-task="handleSubmitTask('description-generator')"
          @pick-image="handlePickGeneratorImage"
          @copy-text="handleCopyText"
          @open-export-item="handleOpenGeneratorExportItem"
          @export-results="handleExportCurrentResults"
        />

        <GeneratorStudioPage
          v-else-if="activeMenu === 'series-generate'"
          title="套图生成"
          mode="image"
          :draft="currentDraft"
          :result-payload="currentResultPayload"
          :export-items="currentExportItems"
          :tasks="studioTasks"
          :agent-readiness="studioAgentReadiness"
          :prompt-templates="promptTemplates"
          @update-draft="handleDraftUpdate"
          @submit-task="handleSubmitTask('series-generate')"
          @pick-image="handlePickGeneratorImage"
          @copy-text="handleCopyText"
          @open-export-item="handleOpenGeneratorExportItem"
          @export-results="handleExportCurrentResults"
        />

        <GeneratorStudioPage
          v-else-if="activeMenu === 'video-generate'"
          title="视频生成"
          mode="video"
          :draft="currentDraft"
          :result-payload="currentResultPayload"
          :export-items="currentExportItems"
          :tasks="studioTasks"
          :agent-readiness="studioAgentReadiness"
          :prompt-templates="promptTemplates"
          @update-draft="handleDraftUpdate"
          @submit-task="handleSubmitTask('video-generate')"
          @pick-image="handlePickGeneratorImage"
          @copy-text="handleCopyText"
          @open-export-item="handleOpenGeneratorExportItem"
          @export-results="handleExportCurrentResults"
        />

        <section v-else-if="activeMenu === 'model-pricing'" class="pricing-page">
          <section
            v-for="section in pricingSections"
            :key="section.key"
            class="pricing-section"
            :style="pricingSectionStyleMap[section.key]"
          >
            <header class="pricing-section__header">
              <span>{{ section.label }}</span>
              <strong>{{ section.label }}模型</strong>
            </header>

            <div class="pricing-section__grid">
              <article
                v-for="card in section.cards"
                :key="card.title"
                class="pricing-card"
                :class="`pricing-card--${card.accent}`"
              >
                <div class="pricing-card__top">
                  <span class="pricing-card__tag">{{ card.unit }}</span>
                  <strong>{{ card.title }}</strong>
                </div>

                <div class="pricing-card__rows">
                  <div
                    v-for="item in card.items"
                    :key="`${card.title}-${item.label}`"
                    class="pricing-card__row"
                  >
                    <span>{{ item.label }}</span>
                    <strong>{{ item.value }}</strong>
                  </div>
                </div>
              </article>
            </div>
          </section>
        </section>

        <PromptLibraryPanel
          v-else-if="activeMenu === 'prompt-library'"
          :fixed-prompt-templates="fixedPromptTemplates"
          :custom-prompt-templates="customPromptTemplates"
          @save-template="handleSavePromptTemplate"
          @remove-template="handleRemovePromptTemplate"
        />

        <ModelConfigPage
          v-else-if="activeMenu === 'model-config'"
          :text-api-key="modelConfigTextApiKeyDraft"
          :image-api-key="modelConfigImageApiKeyDraft"
          :video-api-key="modelConfigVideoApiKeyDraft"
          :is-saving="isModelConfigSaving"
          :feedback-message="modelConfigFeedback"
          @update-text-api-key="modelConfigTextApiKeyDraft = $event"
          @update-image-api-key="modelConfigImageApiKeyDraft = $event"
          @update-video-api-key="modelConfigVideoApiKeyDraft = $event"
          @save="handleSaveModelConfig"
        />
      </section>
    </section>

    <div
      v-if="rechargeDialogVisible"
      class="recharge-modal"
      role="dialog"
      aria-modal="true"
      aria-label="充值"
      @click.self="closeRechargeDialog"
    >
      <div class="recharge-modal__card">
        <header class="recharge-modal__header">
          <div>
            <strong>充值</strong>
            <span>{{ currentRechargeOrder ? rechargeStatusLabel : '创建订单后可查询状态' }}</span>
          </div>

          <button class="secondary-action" type="button" @click="closeRechargeDialog">
            关闭
          </button>
        </header>

        <div class="recharge-modal__form">
          <label class="recharge-modal__field">
            <span>账户</span>
            <select v-model="rechargeForm.walletType">
              <option value="image">图片余额</option>
              <option value="video">视频余额</option>
            </select>
          </label>

          <label class="recharge-modal__field">
            <span>方式</span>
            <select v-model="rechargeForm.channel">
              <option value="alipay">支付宝</option>
              <option value="wechat">微信支付</option>
            </select>
          </label>

          <label class="recharge-modal__field">
            <span>金额</span>
            <input v-model="rechargeForm.amountCny" type="number" min="0.01" step="0.01">
          </label>

          <label class="recharge-modal__field">
            <span>优惠码</span>
            <input v-model="rechargeForm.couponCode" type="text" placeholder="没有可留空">
          </label>
        </div>

        <div class="recharge-modal__actions">
          <button class="primary-action" type="button" :disabled="isRechargeSubmitting" @click="handleCreateRecharge">
            {{ isRechargeSubmitting ? '创建中' : '创建订单' }}
          </button>

          <button
            class="secondary-action"
            type="button"
            :disabled="!currentRechargeOrder || isRechargeRefreshing"
            @click="handleRefreshRechargeOrder"
          >
            {{ isRechargeRefreshing ? '查询中' : '查询状态' }}
          </button>

          <button
            class="secondary-action"
            type="button"
            :disabled="!currentRechargeOrder?.paymentPayload?.mockPayUrl"
            @click="handleOpenRechargeLink"
          >
            打开支付
          </button>
        </div>

        <div v-if="currentRechargeOrder" class="recharge-modal__result">
          <div class="recharge-modal__result-row">
            <span>订单号</span>
            <strong>{{ currentRechargeOrder.merchantOrderNo }}</strong>
          </div>

          <div class="recharge-modal__result-row">
            <span>支付金额</span>
            <strong>{{ currentRechargeOrder.payAmountCny }} CNY</strong>
          </div>

          <div class="recharge-modal__result-row">
            <span>赠送金额</span>
            <strong>{{ currentRechargeOrder.bonusAmountCny }} CNY</strong>
          </div>

          <div class="recharge-modal__result-row">
            <span>状态</span>
            <strong>{{ rechargeStatusLabel }}</strong>
          </div>
        </div>
      </div>
    </div>
  </main>
</template>
