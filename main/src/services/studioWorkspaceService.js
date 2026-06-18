const fs = require('node:fs/promises')
const fsSync = require('node:fs')
const path = require('node:path')
const crypto = require('node:crypto')
const os = require('node:os')
const { pathToFileURL } = require('node:url')
const { exportTaskDirectory: defaultExportTaskDirectory } = require('./taskExportService')
const {
  createStudioImageGenerationService,
  MAX_SERIES_GENERATE_GROUP_SIZE
} = require('./studioImageGenerationService')
const { createCopywritingGenerationService } = require('./copywritingGenerationService')
const { createStudioVideoGenerationService } = require('./studioVideoGenerationService')
const {
  ensureDirectory,
  getTaskDataDirectories,
  OUTPUT_ROOT_DIRECTORY,
  getFeatureDirectoryKey
} = require('./dataPathsService')
const { persistSourceFiles } = require('./inputAssetStorageService')

const STUDIO_WORKSPACE_KEY = 'studioWorkspace'

async function fileExists(targetPath) {
  try {
    await fs.access(targetPath)
    return true
  } catch {
    return false
  }
}

const themeOptions = [
  { label: '暗黑', value: 'dark' }
]

const menuItems = [
  { key: 'workspace', label: '工作台' },
  { key: 'data-center', label: '数据中心' },
  { key: 'product-template', label: '商品模板' },
  { key: 'title-generator', label: '标题生成' },
  { key: 'description-generator', label: '描述生成' },
  { key: 'series-generate', label: '套图生成' },
  { key: 'video-generate', label: '视频生成' },
  { key: 'model-pricing', label: '模型价格' },
  { key: 'prompt-library', label: '提示词库' },
  { key: 'model-config', label: '模型配置' }
]

const imageModelOptions = [
  { label: 'gpt-image-2', value: 'gpt-image-2' },
  { label: 'nano-banana-fast', value: 'nano-banana-fast' },
  { label: 'nano-banana-2', value: 'nano-banana-2' }
]

const videoModelOptions = [
  { label: 'MiniMax-Hailuo-2.3-Fast', value: 'MiniMax-Hailuo-2.3-Fast' }
]

const modelPricingCatalog = [
  { name: 'nano-banana-fast', credits: '440 / 次' },
  { name: 'gpt-image-2', credits: '600 / 次' },
  { name: 'nano-banana-2', credits: '1200 / 次' }
]
const modelCreditCostMap = Object.fromEntries(modelPricingCatalog.map((item) => {
  return [item.name, Number.parseInt(String(item.credits), 10) || 0]
}))

const batchOptions = [
  { label: '单批 4 个结果', value: 'batch-4' },
  { label: '单批 8 个结果', value: 'batch-8' },
  { label: '单批 12 个结果', value: 'batch-12' }
]

const menuLabelMap = Object.fromEntries(menuItems.map((item) => [item.key, item.label]))
const taskCategoryMap = {
  workspace: '工作台',
  'title-generator': '标题生成',
  'description-generator': '描述生成',
  'series-generate': '套图生成',
  'video-generate': '视频生成',
  'model-pricing': '模型价格'
}
const taskMenuMapByCategory = {
  工作台: 'workspace',
  标题生成: 'title-generator',
  描述生成: 'description-generator',
  '套图生成': 'series-generate'
}
const CREDIT_ACTIVITY_HISTORY_LIMIT = 20
const REQUEST_METRIC_HISTORY_LIMIT = 24
const TASK_SIZE_LIMITS = {
  'series-generate': {
    warn: 40,
    block: 120
  }
}
const DEFAULT_EMPTY_PROMPT_TEMPLATE_ID = 'image-default'
const SERIES_GENERATE_TEMPLATE_ID_BY_TYPE = {
  商品主图: 'image-main',
  白底图: 'image-white-bg',
  详情图: 'image-detail',
  细节图: 'image-closeup',
  尺寸图: 'image-size',
  颜色图: 'image-color',
  场景图: 'image-scene',
  模特图: 'image-model',
  换角度: 'image-angle',
  换场景: 'image-change-scene',
  换模特: 'image-change-model',
  全替换: 'image-replace-all'
}
const SERIES_GENERATE_TYPE_BY_TEMPLATE_ID = Object.fromEntries(
  Object.entries(SERIES_GENERATE_TEMPLATE_ID_BY_TYPE).map(([imageType, templateId]) => [templateId, imageType])
)
const SERIES_GENERATE_DEFAULT_TYPE_ORDER = [
  '商品主图',
  '白底图',
  '详情图',
  '细节图',
  '尺寸图',
  '颜色图',
  '场景图',
  '模特图',
  '换角度',
  '换场景',
  '换模特',
  '全替换'
]
const EXPORT_FREE_SPACE_MULTIPLIER = 3
const EXPORT_MIN_REQUIRED_BYTES = 1024
const workspaceDashboardSections = [
  { cardKey: 'titleStats', menuKey: 'title-generator', title: '标题生成统计' },
  { cardKey: 'descriptionStats', menuKey: 'description-generator', title: '描述生成统计' },
  { cardKey: 'seriesGenerateStats', menuKey: 'series-generate', title: '套图生成统计' }
]

function getModelOptionsByMenu() {
  return imageModelOptions
}

function getVideoModelOptionsByMenu() {
  return videoModelOptions
}

function resolveDefaultModelForMenu() {
  const modelOptions = getModelOptionsByMenu()
  return modelOptions[0]?.value || 'gpt-image-2'
}

function resolveTextModelForMenu(menuKey = '') {
  if (menuKey === 'description-generator') {
    return 'deepseek-v4-pro'
  }

  return 'deepseek-v4-flash'
}

function resolveVideoAspectRatioForMenu() {
  return '16:9'
}

async function safeRuntimeLog (runtimeLogger, payload) {
  if (!runtimeLogger || typeof runtimeLogger.log !== 'function') {
    return
  }

  try {
    await runtimeLogger.log(payload)
  } catch {
    // 运行日志失败时不影响主流程。
  }
}

function normalizeImageAsset(item = {}) {
  if (!item || !item.name) {
    return null
  }

  return {
    id: item.id || '',
    name: item.name,
    path: item.path || '',
    preview: item.preview || '',
    sizeLabel: item.sizeLabel || '',
    storedPath: item.storedPath || ''
  }
}

function normalizePromptAssignments(promptAssignments = [], count = 1) {
  const normalizedCount = Math.max(1, Math.min(MAX_SERIES_GENERATE_GROUP_SIZE, Number(count) || 1))
  const sourceAssignments = Array.isArray(promptAssignments) ? promptAssignments : []

  return Array.from({ length: normalizedCount }, (_unused, index) => {
    const currentAssignment = sourceAssignments[index] || {}
    const fallbackImageType = SERIES_GENERATE_DEFAULT_TYPE_ORDER[index] || '详情图'
    const inferredImageType = SERIES_GENERATE_TYPE_BY_TEMPLATE_ID[String(currentAssignment.templateId || '').trim()] || ''
    const nextImageType = String(currentAssignment.imageType || inferredImageType || fallbackImageType).trim() || fallbackImageType
    const nextTemplateId = String(
      currentAssignment.templateId ||
      SERIES_GENERATE_TEMPLATE_ID_BY_TYPE[nextImageType] ||
      DEFAULT_EMPTY_PROMPT_TEMPLATE_ID
    ).trim() || DEFAULT_EMPTY_PROMPT_TEMPLATE_ID
    const nextDifferenceLevel = ['off', 'low', 'medium', 'high'].includes(currentAssignment.differenceLevel)
      ? currentAssignment.differenceLevel
      : 'off'

    return {
      id: currentAssignment.id || `series-generate-${index + 1}`,
      index: index + 1,
      prompt: currentAssignment.prompt || '',
      templateId: nextTemplateId,
      imageType: nextImageType,
      differenceLevel: nextDifferenceLevel
    }
  })
}

function normalizeDraftForMenu(menuKey, draft = {}) {
  const defaultDraft = createDefaultDrafts()[menuKey] || {}
  if (menuKey === 'workspace') {
    return {
      ...defaultDraft,
      ...draft,
      taskName: String(draft.taskName || defaultDraft.taskName || ''),
      projectId: String(draft.projectId || defaultDraft.projectId || ''),
      projectName: String(draft.projectName || defaultDraft.projectName || ''),
      productName: String(draft.productName || defaultDraft.productName || ''),
      brand: String(draft.brand || defaultDraft.brand || ''),
      category: String(draft.category || defaultDraft.category || ''),
      highlightsText: String(draft.highlightsText || defaultDraft.highlightsText || ''),
      keywordsText: String(draft.keywordsText || defaultDraft.keywordsText || ''),
      platformTargetsText: String(draft.platformTargetsText || defaultDraft.platformTargetsText || ''),
      language: String(draft.language || defaultDraft.language || 'zh-CN'),
      titlePrompt: String(draft.titlePrompt || defaultDraft.titlePrompt || ''),
      descriptionPrompt: String(draft.descriptionPrompt || defaultDraft.descriptionPrompt || ''),
      titleQuantity: Math.max(1, Number(draft.titleQuantity) || defaultDraft.titleQuantity || 3),
      descriptionQuantity: Math.max(1, Number(draft.descriptionQuantity) || defaultDraft.descriptionQuantity || 2),
      model: String(draft.model || defaultDraft.model || 'gpt-4o-mini')
    }
  }

  if (menuKey === 'title-generator') {
    return {
      ...defaultDraft,
      ...draft,
      projectId: String(draft.projectId || defaultDraft.projectId || ''),
      taskName: String(draft.taskName || defaultDraft.taskName || ''),
      productName: String(draft.productName || defaultDraft.productName || ''),
      platformTargetsText: String(draft.platformTargetsText || defaultDraft.platformTargetsText || ''),
      language: String(draft.language || defaultDraft.language || 'zh-CN'),
      titlePrompt: String(draft.titlePrompt || defaultDraft.titlePrompt || ''),
      titleTemplateId: String(draft.titleTemplateId || defaultDraft.titleTemplateId || ''),
      titleMaxChars: Math.max(1, Number(draft.titleMaxChars) || defaultDraft.titleMaxChars || 60),
      titleQuantity: Math.max(1, Number(draft.titleQuantity) || defaultDraft.titleQuantity || 3),
      model: String(draft.model || defaultDraft.model || 'deepseek-v4-flash')
    }
  }

  if (menuKey === 'description-generator') {
    return {
      ...defaultDraft,
      ...draft,
      projectId: String(draft.projectId || defaultDraft.projectId || ''),
      taskName: String(draft.taskName || defaultDraft.taskName || ''),
      productName: String(draft.productName || defaultDraft.productName || ''),
      platformTargetsText: String(draft.platformTargetsText || defaultDraft.platformTargetsText || ''),
      language: String(draft.language || defaultDraft.language || 'zh-CN'),
      descriptionPrompt: String(draft.descriptionPrompt || defaultDraft.descriptionPrompt || ''),
      descriptionTemplateId: String(draft.descriptionTemplateId || defaultDraft.descriptionTemplateId || ''),
      descriptionMaxChars: Math.max(1, Number(draft.descriptionMaxChars) || defaultDraft.descriptionMaxChars || 300),
      descriptionQuantity: Math.max(1, Number(draft.descriptionQuantity) || defaultDraft.descriptionQuantity || 2),
      model: String(draft.model || defaultDraft.model || 'deepseek-v4-flash')
    }
  }

  const allowedModels = menuKey === 'video-generate'
    ? new Set(getVideoModelOptionsByMenu(menuKey).map((item) => item.value))
    : new Set(getModelOptionsByMenu(menuKey).map((item) => item.value))
  const preferredDraftModel = draft.model
  const nextModel = allowedModels.has(preferredDraftModel)
    ? preferredDraftModel
    : (defaultDraft.model || resolveDefaultModelForMenu(menuKey))

  if (menuKey === 'series-generate') {
    const generateCount = Math.max(1, Math.min(MAX_SERIES_GENERATE_GROUP_SIZE, Number(draft.generateCount) || defaultDraft.generateCount || 1))
    const normalizedAssignments = normalizePromptAssignments(draft.promptAssignments, generateCount)
    const migratedPrompt = String(draft.prompt || defaultDraft.prompt || '')
    const migratedImageType = String(draft.imageType || normalizedAssignments[0]?.imageType || defaultDraft.imageType || '')

    return {
      ...defaultDraft,
      ...draft,
      model: nextModel,
      taskName: String(draft.taskName || defaultDraft.taskName || ''),
      productName: String(draft.productName || defaultDraft.productName || ''),
      sourceImage: normalizeImageAsset(draft.sourceImage) || defaultDraft.sourceImage,
      prompt: migratedPrompt,
      imageTemplateId: String(draft.imageTemplateId || defaultDraft.imageTemplateId || ''),
      imageType: migratedImageType,
      generateCount,
      batchCount: Math.max(1, Number(draft.batchCount) || defaultDraft.batchCount || 1),
      size: draft.size || defaultDraft.size,
      promptAssignments: normalizedAssignments
    }
  }

  if (menuKey === 'video-generate') {
    return {
      ...defaultDraft,
      ...draft,
      projectId: String(draft.projectId || defaultDraft.projectId || ''),
      taskName: String(draft.taskName || defaultDraft.taskName || ''),
      productName: String(draft.productName || defaultDraft.productName || ''),
      sourceImage: normalizeImageAsset(draft.sourceImage) || defaultDraft.sourceImage,
      duration: String(draft.duration || defaultDraft.duration || '6s'),
      resolution: String(draft.resolution || defaultDraft.resolution || '768P'),
      aspectRatio: String(draft.aspectRatio || defaultDraft.aspectRatio || resolveVideoAspectRatioForMenu()).trim() || resolveVideoAspectRatioForMenu(),
      motionStrength: String(draft.motionStrength || defaultDraft.motionStrength || 'auto'),
      videoTemplateId: String(draft.videoTemplateId || defaultDraft.videoTemplateId || ''),
      prompt: String(draft.prompt || defaultDraft.prompt || ''),
      model: String(draft.model || defaultDraft.model || 'MiniMax-Hailuo-2.3-Fast'),
      videoQuantity: Math.max(1, Number(draft.videoQuantity) || defaultDraft.videoQuantity || 1)
    }
  }

  return {
    ...defaultDraft,
    ...draft,
    model: nextModel
  }
}

function formatDisplayDateTime(dateValue) {
  const date = new Date(dateValue)
  const parts = [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, '0'),
    String(date.getDate()).padStart(2, '0')
  ]
  const timeParts = [
    String(date.getHours()).padStart(2, '0'),
    String(date.getMinutes()).padStart(2, '0')
  ]
  return `${parts.join('-')} ${timeParts.join(':')}`
}

function createPreviewUrlFromSavedPath(savedPath = '') {
  if (!savedPath) {
    return ''
  }

  try {
    return pathToFileURL(path.resolve(savedPath)).href
  } catch {
    return ''
  }
}

function hydratePreviewForDisplay(item = {}) {
  return {
    ...item,
    preview: item.preview || createPreviewUrlFromSavedPath(item.savedPath)
  }
}

function hydrateResultPayloadForDisplay(resultPayload = {}) {
  return {
    ...resultPayload,
    comparisonResults: Array.isArray(resultPayload.comparisonResults)
      ? resultPayload.comparisonResults.map((item) => hydratePreviewForDisplay(item))
      : [],
    groupedResults: Array.isArray(resultPayload.groupedResults)
      ? resultPayload.groupedResults.map((group) => ({
          ...group,
          outputs: Array.isArray(group.outputs)
            ? group.outputs.map((item) => hydratePreviewForDisplay(item))
            : []
        }))
      : []
  }
}

function hydrateResultsByMenuForDisplay(resultsByMenu = {}) {
  return Object.fromEntries(Object.entries(resultsByMenu).map(([menuKey, resultPayload]) => {
    return [menuKey, hydrateResultPayloadForDisplay(resultPayload)]
  }))
}

function hydrateProjectRunForDisplay(projectRun = {}) {
  const normalizedProjectRun = normalizeProjectRun(projectRun)

  return {
    ...normalizedProjectRun,
    outputs: {
      ...normalizedProjectRun.outputs,
      images: Array.isArray(normalizedProjectRun.outputs.images)
        ? normalizedProjectRun.outputs.images.map((item) => hydratePreviewForDisplay(item))
        : [],
      video: normalizedProjectRun.outputs.video
        ? hydratePreviewForDisplay(normalizedProjectRun.outputs.video)
        : null
    }
  }
}

function hydrateProjectRunsForDisplay(projectRuns = []) {
  return normalizeProjectRuns(projectRuns).map((projectRun) => hydrateProjectRunForDisplay(projectRun))
}

function createDefaultDrafts() {
  return {
    workspace: {
      taskName: '',
      projectId: '',
      projectName: '',
      productName: '',
      brand: '',
      category: '',
      highlightsText: '',
      keywordsText: '',
      platformTargetsText: 'temu, ozon',
      language: 'zh-CN',
      titlePrompt: '生成适合跨境电商平台使用的商品标题，突出核心卖点，避免夸张和违规表达',
      descriptionPrompt: '生成适合电商详情页或上架页使用的商品描述，语气清晰、利于转化、避免空话',
      titleQuantity: 3,
      descriptionQuantity: 2,
      model: resolveTextModelForMenu('workspace')
    },
    'data-center': {},
    'product-template': {},
    'title-generator': {
      projectId: '',
      taskName: '',
      productName: '',
      platformTargetsText: 'temu',
      language: 'zh-CN',
      titlePrompt: '生成适合跨境电商平台使用的商品标题，突出核心卖点，避免夸张和违规表达',
      titleTemplateId: 'title-default',
      titleMaxChars: 60,
      titleQuantity: 3,
      model: resolveTextModelForMenu('title-generator')
    },
    'description-generator': {
      projectId: '',
      taskName: '',
      productName: '',
      platformTargetsText: 'temu',
      language: 'zh-CN',
      descriptionPrompt: '生成适合电商详情页或上架页使用的商品描述，语气清晰、利于转化、避免空话',
      descriptionTemplateId: 'description-default',
      descriptionMaxChars: 300,
      descriptionQuantity: 2,
      model: resolveTextModelForMenu('description-generator')
    },
    'series-generate': {
      prompt: '',
      productName: '',
      model: resolveDefaultModelForMenu('series-generate'),
      taskName: '',
      sourceImage: null,
      generateCount: 4,
      imageTemplateId: 'image-default',
      imageType: '商品主图',
      batchCount: 1,
      size: '1:1',
      promptAssignments: normalizePromptAssignments([], 4)
    },
    'video-generate': {
      projectId: '',
      taskName: '',
      productName: '',
      sourceImage: null,
      duration: '6s',
      resolution: '768P',
      aspectRatio: resolveVideoAspectRatioForMenu(),
      motionStrength: 'auto',
      videoTemplateId: 'video-main',
      prompt: '生成适合电商展示的商品视频，镜头稳定，突出主体与卖点',
      model: 'MiniMax-Hailuo-2.3-Fast',
      videoQuantity: 1
    },
    'model-pricing': {},
    'prompt-library': {},
    'model-config': {
      apiKey: '',
      titleModel: 'deepseek-v4-flash',
      descriptionModel: 'deepseek-v4-pro',
      imageModel: 'nano-banana-fast',
      videoModel: 'MiniMax-Hailuo-2.3-Fast'
    }
  }
}

function createDefaultResultsByMenu() {
  return {
    workspace: {
      textResults: [],
      comparisonResults: [],
      groupedResults: [],
      summary: null
    },
    'data-center': {
      textResults: [],
      comparisonResults: [],
      groupedResults: [],
      summary: null
    },
    'product-template': {
      textResults: [],
      comparisonResults: [],
      groupedResults: [],
      summary: null
    },
    'title-generator': {
      textResults: [],
      comparisonResults: [],
      groupedResults: [],
      summary: null
    },
    'description-generator': {
      textResults: [],
      comparisonResults: [],
      groupedResults: [],
      summary: null
    },
    'series-generate': {
      textResults: [],
      comparisonResults: [],
      groupedResults: [],
      summary: null
    },
    'video-generate': {
      textResults: [],
      comparisonResults: [],
      groupedResults: [],
      summary: null
    },
    'model-pricing': {
      textResults: [],
      comparisonResults: [],
      groupedResults: [],
      summary: null
    },
    'prompt-library': {
      textResults: [],
      comparisonResults: [],
      groupedResults: [],
      summary: null
    },
    'model-config': {
      textResults: [],
      comparisonResults: [],
      groupedResults: [],
      summary: null
    }
  }
}

function createDefaultExportItemsByMenu() {
  return Object.fromEntries(menuItems.map((item) => [
    item.key,
    []
  ]))
}

function normalizeStringList(values = []) {
  return Array.isArray(values)
    ? values
      .map((item) => String(item || '').trim())
      .filter(Boolean)
    : []
}

function createDefaultProjectGenerationConfig() {
  return {
    enabledSteps: {
      title: true,
      description: true,
      image: true,
      video: true
    },
    titleMaxChars: 60,
    descriptionMaxChars: 300,
    imageSize: '1:1',
    videoDuration: '6s',
    videoResolution: '768P',
    videoMotionStrength: 'auto',
    titleTemplateId: '',
    descriptionTemplateId: '',
    imageTemplateId: DEFAULT_EMPTY_PROMPT_TEMPLATE_ID,
    videoTemplateId: 'video-main',
    titlePrompt: '',
    descriptionPrompt: '',
    imagePrompt: '',
    videoPrompt: ''
  }
}

function normalizeProjectEnabledSteps(enabledSteps = {}) {
  const source = enabledSteps && typeof enabledSteps === 'object' ? enabledSteps : {}

  return {
    title: source.title !== false,
    description: source.description !== false,
    image: source.image !== false,
    video: source.video !== false
  }
}

function normalizeProjectGenerationConfig(generationConfig = {}) {
  const defaults = createDefaultProjectGenerationConfig()
  const source = generationConfig && typeof generationConfig === 'object' ? generationConfig : {}

  return {
    ...defaults,
    ...source,
    enabledSteps: normalizeProjectEnabledSteps(source.enabledSteps),
    titleMaxChars: Math.max(1, Number(source.titleMaxChars) || defaults.titleMaxChars),
    descriptionMaxChars: Math.max(1, Number(source.descriptionMaxChars) || defaults.descriptionMaxChars),
    imageSize: String(source.imageSize || defaults.imageSize).trim() || defaults.imageSize,
    videoDuration: String(source.videoDuration || defaults.videoDuration).trim() || defaults.videoDuration,
    videoResolution: String(source.videoResolution || defaults.videoResolution).trim() || defaults.videoResolution,
    aspectRatio: String(source.aspectRatio || defaults.aspectRatio || resolveVideoAspectRatioForMenu()).trim() || resolveVideoAspectRatioForMenu(),
    videoMotionStrength: String(source.videoMotionStrength || defaults.videoMotionStrength).trim() || defaults.videoMotionStrength,
    titleTemplateId: String(source.titleTemplateId || '').trim(),
    descriptionTemplateId: String(source.descriptionTemplateId || '').trim(),
    imageTemplateId: String(source.imageTemplateId || defaults.imageTemplateId).trim() || defaults.imageTemplateId,
    videoTemplateId: String(source.videoTemplateId || defaults.videoTemplateId).trim() || defaults.videoTemplateId,
    titlePrompt: String(source.titlePrompt || '').trim(),
    descriptionPrompt: String(source.descriptionPrompt || '').trim(),
    imagePrompt: String(source.imagePrompt || '').trim(),
    videoPrompt: String(source.videoPrompt || '').trim()
  }
}

function createDefaultProjectRunStepStates() {
  return {
    title: { status: 'pending', error: '', startedAt: '', completedAt: '' },
    description: { status: 'pending', error: '', startedAt: '', completedAt: '' },
    image: { status: 'pending', error: '', startedAt: '', completedAt: '' },
    video: { status: 'pending', error: '', startedAt: '', completedAt: '' }
  }
}

function normalizeProjectRunStepState(stepState = {}) {
  const source = stepState && typeof stepState === 'object' ? stepState : {}
  const supportedStatusSet = new Set(['pending', 'running', 'success', 'failed'])

  return {
    status: supportedStatusSet.has(source.status) ? source.status : 'pending',
    error: String(source.error || '').trim(),
    startedAt: typeof source.startedAt === 'string' ? source.startedAt : '',
    completedAt: typeof source.completedAt === 'string' ? source.completedAt : ''
  }
}

function normalizeProjectRun(projectRun = {}) {
  const source = projectRun && typeof projectRun === 'object' ? projectRun : {}
  const outputs = source.outputs && typeof source.outputs === 'object' ? source.outputs : {}
  const storage = source.storage && typeof source.storage === 'object' ? source.storage : {}
  const defaultStepStates = createDefaultProjectRunStepStates()

  return {
    id: typeof source.id === 'string' ? source.id : '',
    projectId: typeof source.projectId === 'string' ? source.projectId : '',
    taskId: typeof source.taskId === 'string' ? source.taskId : '',
    taskNumber: typeof source.taskNumber === 'string' ? source.taskNumber : '',
    triggerMenuKey: typeof source.triggerMenuKey === 'string' ? source.triggerMenuKey : '',
    status: ['pending', 'running', 'success', 'failed'].includes(source.status) ? source.status : 'pending',
    stepStates: {
      title: normalizeProjectRunStepState(source.stepStates?.title || defaultStepStates.title),
      description: normalizeProjectRunStepState(source.stepStates?.description || defaultStepStates.description),
      image: normalizeProjectRunStepState(source.stepStates?.image || defaultStepStates.image),
      video: normalizeProjectRunStepState(source.stepStates?.video || defaultStepStates.video)
    },
    outputs: {
      title: String(outputs.title || '').trim(),
      description: String(outputs.description || '').trim(),
      images: Array.isArray(outputs.images) ? outputs.images.slice() : [],
      video: outputs.video && typeof outputs.video === 'object'
        ? { ...outputs.video }
        : null
    },
    storage: {
      runDirectory: String(storage.runDirectory || '').trim(),
      titleFile: String(storage.titleFile || '').trim(),
      descriptionFile: String(storage.descriptionFile || '').trim(),
      imageDirectory: String(storage.imageDirectory || '').trim(),
      videoDirectory: String(storage.videoDirectory || '').trim()
    },
    createdAt: typeof source.createdAt === 'string' ? source.createdAt : '',
    completedAt: typeof source.completedAt === 'string' ? source.completedAt : ''
  }
}

function normalizeProjectRuns(projectRuns = []) {
  return Array.isArray(projectRuns)
    ? projectRuns
      .map((projectRun) => normalizeProjectRun(projectRun))
      .filter((projectRun) => projectRun.id || projectRun.projectId)
    : []
}

function normalizeProductProject(project = {}) {
  const source = project && typeof project === 'object' ? project : {}
  const baseInfo = source.baseInfo && typeof source.baseInfo === 'object' ? source.baseInfo : {}
  const assets = source.assets && typeof source.assets === 'object' ? source.assets : {}
  const content = source.content && typeof source.content === 'object' ? source.content : {}
  const publishDraft = source.publishDraft && typeof source.publishDraft === 'object' ? source.publishDraft : {}
  const generationConfig = source.generationConfig && typeof source.generationConfig === 'object' ? source.generationConfig : {}
  const supportedStatusSet = new Set(['draft', 'ready', 'archived'])

  return {
    id: typeof source.id === 'string' ? source.id : '',
    name: String(source.name || '').trim(),
    status: supportedStatusSet.has(source.status) ? source.status : 'draft',
    platformTarget: normalizeStringList(source.platformTarget),
    baseInfo: {
      productName: String(baseInfo.productName || '').trim(),
      brand: String(baseInfo.brand || '').trim(),
      category: String(baseInfo.category || '').trim(),
      highlights: normalizeStringList(baseInfo.highlights),
      keywords: normalizeStringList(baseInfo.keywords),
      language: String(baseInfo.language || 'zh-CN').trim() || 'zh-CN'
    },
    generationConfig: normalizeProjectGenerationConfig(generationConfig),
    assets: {
      sourceImages: Array.isArray(assets.sourceImages) ? assets.sourceImages.slice() : [],
      generatedImages: Array.isArray(assets.generatedImages) ? assets.generatedImages.slice() : [],
      generatedVideo: assets.generatedVideo && typeof assets.generatedVideo === 'object'
        ? { ...assets.generatedVideo }
        : null
    },
    content: {
      titleCandidates: normalizeStringList(content.titleCandidates),
      descriptionCandidates: normalizeStringList(content.descriptionCandidates),
      selectedTitle: String(content.selectedTitle || '').trim(),
      selectedDescription: String(content.selectedDescription || '').trim()
    },
    publishDraft: {
      attributes: publishDraft.attributes && typeof publishDraft.attributes === 'object'
        ? { ...publishDraft.attributes }
        : {},
      variants: Array.isArray(publishDraft.variants) ? publishDraft.variants.slice() : [],
      platformDrafts: publishDraft.platformDrafts && typeof publishDraft.platformDrafts === 'object'
        ? { ...publishDraft.platformDrafts }
        : {}
    },
    latestRunId: typeof source.latestRunId === 'string' ? source.latestRunId : '',
    runIds: normalizeStringList(source.runIds),
    taskRefs: normalizeStringList(source.taskRefs),
    createdAt: typeof source.createdAt === 'string' ? source.createdAt : '',
    updatedAt: typeof source.updatedAt === 'string' ? source.updatedAt : ''
  }
}

function normalizeProductProjects(productProjects = []) {
  return Array.isArray(productProjects)
    ? productProjects
      .map((project) => normalizeProductProject(project))
      .filter((project) => project.id || project.name)
    : []
}

function resolveActiveProductProjectId(productProjects = [], activeProductProjectId = '') {
  const normalizedActiveId = String(activeProductProjectId || '').trim()

  if (normalizedActiveId && productProjects.some((project) => project.id === normalizedActiveId)) {
    return normalizedActiveId
  }

  return productProjects[0]?.id || ''
}

function resolveActiveProjectRunId(projectRuns = [], activeProjectRunId = '') {
  const normalizedActiveId = String(activeProjectRunId || '').trim()

  if (normalizedActiveId && projectRuns.some((projectRun) => projectRun.id === normalizedActiveId)) {
    return normalizedActiveId
  }

  return projectRuns[0]?.id || ''
}

function upsertProjectRun(projectRuns = [], nextProjectRun = {}) {
  return [
    normalizeProjectRun(nextProjectRun),
    ...normalizeProjectRuns(projectRuns).filter((projectRun) => projectRun.id !== nextProjectRun.id)
  ]
}

function resolveProjectRunStepKey(menuKey = '') {
  if (menuKey === 'workspace') {
    return null
  }

  if (menuKey === 'title-generator') {
    return 'title'
  }

  if (menuKey === 'description-generator') {
    return 'description'
  }

  if (menuKey === 'series-generate') {
    return 'image'
  }

  if (menuKey === 'video-generate') {
    return 'video'
  }

  return null
}

function resolveWorkspaceEnabledRunSteps(draft = {}, currentProject = null) {
  const generationConfig = currentProject?.generationConfig || {}
  const enabledSteps = normalizeProjectEnabledSteps(generationConfig.enabledSteps)
  const hasSourceImage = Boolean(draft.sourceImage || draft.referenceImage || currentProject?.assets?.sourceImages?.length)

  return {
    title: enabledSteps.title !== false,
    description: enabledSteps.description !== false,
    image: enabledSteps.image !== false && hasSourceImage,
    video: enabledSteps.video !== false && hasSourceImage
  }
}

function buildProjectRunStepStatesForTask({ menuKey = '', draft = {}, currentProject = null, createdAt = '' } = {}) {
  const defaultStepStates = createDefaultProjectRunStepStates()
  const enabledSteps = menuKey === 'workspace'
    ? resolveWorkspaceEnabledRunSteps(draft, currentProject)
    : {
        title: false,
        description: false,
        image: false,
        video: false
      }

  if (menuKey !== 'workspace') {
    const stepKey = resolveProjectRunStepKey(menuKey)
    if (stepKey) {
      enabledSteps[stepKey] = true
    }
  }

  return Object.fromEntries(Object.entries(defaultStepStates).map(([stepKey, stepState]) => {
    if (!enabledSteps[stepKey]) {
      return [
        stepKey,
        {
          ...stepState,
          status: 'success',
          completedAt: createdAt || ''
        }
      ]
    }

    return [stepKey, stepState]
  }))
}

function buildProjectRunRecord({
  runId = '',
  projectId = '',
  menuKey = '',
  draft = {},
  currentProject = null,
  taskId = '',
  taskNumber = '',
  createdAt = '',
  runDirectory = ''
} = {}) {
  return normalizeProjectRun({
    id: runId,
    projectId,
    taskId,
    taskNumber,
    triggerMenuKey: menuKey,
    status: 'pending',
    stepStates: buildProjectRunStepStatesForTask({
      menuKey,
      draft,
      currentProject,
      createdAt
    }),
    outputs: {
      title: '',
      description: '',
      images: [],
      video: null
    },
    storage: {
      runDirectory: String(runDirectory || '').trim(),
      titleFile: '',
      descriptionFile: '',
      imageDirectory: '',
      videoDirectory: ''
    },
    createdAt,
    completedAt: ''
  })
}

function attachProjectRunToProject(project = {}, runId = '', updatedAt = '') {
  const normalizedRunId = String(runId || '').trim()
  const currentRunIds = normalizeStringList(project.runIds)

  return normalizeProductProject({
    ...project,
    latestRunId: normalizedRunId,
    runIds: normalizedRunId
      ? [
          normalizedRunId,
          ...currentRunIds.filter((item) => item !== normalizedRunId)
        ]
      : currentRunIds,
    updatedAt: updatedAt || project.updatedAt || ''
  })
}

function resolveProjectRunStatus(stepStates = {}) {
  const normalizedStepStates = stepStates && typeof stepStates === 'object'
    ? stepStates
    : createDefaultProjectRunStepStates()
  const statuses = Object.values(normalizedStepStates).map((stepState) => stepState?.status || 'pending')

  if (statuses.some((status) => status === 'failed')) {
    return 'failed'
  }

  if (statuses.every((status) => status === 'success')) {
    return 'success'
  }

  if (statuses.some((status) => status === 'running')) {
    return 'running'
  }

  return 'pending'
}

function resolveRunDirectoryFromExportItems(exportItems = [], outputDirectory = '') {
  const candidateDirectory = (Array.isArray(exportItems) ? exportItems : [])
    .map((item) => item?.directoryPath || item?.outputDirectory || '')
    .find(Boolean)

  if (candidateDirectory) {
    return path.resolve(candidateDirectory, '..')
  }

  return String(outputDirectory || '').trim()
}

function resolveTextStorageFromResultPayload(resultPayload = {}, exportItems = []) {
  const directories = (Array.isArray(exportItems) ? exportItems : [])
    .map((item) => item?.directoryPath || item?.outputDirectory || '')
    .filter(Boolean)

  if (!directories.length) {
    return {
      titleFile: '',
      descriptionFile: ''
    }
  }

  const groupDirectory = directories[0]
  const textResults = Array.isArray(resultPayload.textResults) ? resultPayload.textResults : []
  const titleIndex = textResults.findIndex((item) => item?.kind === 'title')
  const descriptionIndex = textResults.findIndex((item) => item?.kind === 'description')
  const titleItem = titleIndex >= 0 ? textResults[titleIndex] : null
  const descriptionItem = descriptionIndex >= 0 ? textResults[descriptionIndex] : null

  return {
    titleFile: titleItem
      ? path.resolve(groupDirectory, `${String(titleIndex).padStart(2, '0')}-${sanitizePathSegment(titleItem.title || `text-${titleIndex + 1}`, `text-${titleIndex + 1}`)}.txt`)
      : '',
    descriptionFile: descriptionItem
      ? path.resolve(groupDirectory, `${String(descriptionIndex).padStart(2, '0')}-${sanitizePathSegment(descriptionItem.title || `text-${descriptionIndex + 1}`, `text-${descriptionIndex + 1}`)}.txt`)
      : ''
  }
}

function buildStartedProjectRun({
  projectRun = {},
  menuKey = '',
  startedAt = ''
} = {}) {
  const normalizedProjectRun = normalizeProjectRun(projectRun)
  const nextStepStates = {
    ...normalizedProjectRun.stepStates
  }

  if (menuKey === 'workspace') {
    for (const stepKey of Object.keys(nextStepStates)) {
      if (nextStepStates[stepKey]?.status !== 'pending') {
        continue
      }

      nextStepStates[stepKey] = {
        ...nextStepStates[stepKey],
        status: 'running',
        startedAt
      }
    }
  } else {
    const stepKey = resolveProjectRunStepKey(menuKey)
    if (stepKey && nextStepStates[stepKey]?.status === 'pending') {
      nextStepStates[stepKey] = {
        ...nextStepStates[stepKey],
        status: 'running',
        startedAt
      }
    }
  }

  return normalizeProjectRun({
    ...normalizedProjectRun,
    status: 'running',
    stepStates: nextStepStates
  })
}

function resolveImageRunOutput(resultPayload = {}) {
  return (resultPayload.groupedResults || [])
    .flatMap((group) => group.outputs || [])
    .filter((item) => {
      const savedPath = String(item.savedPath || item.path || '').trim()
      return Boolean(savedPath) && !/\.mp4$/i.test(savedPath)
    })
    .map((item) => ({
      ...item,
      path: item.savedPath || item.path || '',
      savedPath: item.savedPath || item.path || ''
    }))
}

function resolveVideoRunOutput(resultPayload = {}) {
  return (resultPayload.groupedResults || [])
    .flatMap((group) => group.outputs || [])
    .find((item) => {
      const savedPath = String(item.savedPath || item.path || '').trim()
      return Boolean(savedPath) && /\.mp4$/i.test(savedPath)
    }) || null
}

function buildProjectRunUpdateFromResult({
  projectRun = {},
  menuKey = '',
  resultPayload = {},
  exportItems = [],
  outputDirectory = '',
  completedAt = ''
} = {}) {
  let nextProjectRun = normalizeProjectRun(projectRun)
  const runDirectory = resolveRunDirectoryFromExportItems(exportItems, outputDirectory)
  const stepStates = {
    ...nextProjectRun.stepStates
  }
  const nextOutputs = {
    ...nextProjectRun.outputs
  }
  const nextStorage = {
    ...nextProjectRun.storage,
    runDirectory
  }

  if (menuKey === 'workspace' || menuKey === 'title-generator') {
    const titleValue = menuKey === 'workspace'
      ? (resultPayload.textResults || []).find((item) => item.kind === 'title')?.content || ''
      : (resultPayload.textResults || [])[0]?.content || ''
    const titleStorage = resolveTextStorageFromResultPayload(resultPayload, exportItems)
    nextOutputs.title = String(titleValue || '').trim()
    nextStorage.titleFile = titleStorage.titleFile || nextStorage.titleFile
    stepStates.title = {
      ...stepStates.title,
      status: 'success',
      completedAt
    }
  }

  if (menuKey === 'workspace' || menuKey === 'description-generator') {
    const descriptionValue = menuKey === 'workspace'
      ? (resultPayload.textResults || []).find((item) => item.kind === 'description')?.content || ''
      : (resultPayload.textResults || [])[0]?.content || ''
    const textStorage = resolveTextStorageFromResultPayload(resultPayload, exportItems)
    nextOutputs.description = String(descriptionValue || '').trim()
    nextStorage.descriptionFile = textStorage.descriptionFile || nextStorage.descriptionFile
    stepStates.description = {
      ...stepStates.description,
      status: 'success',
      completedAt
    }
  }

  if (menuKey === 'workspace' || menuKey === 'series-generate') {
    const imageOutputs = resolveImageRunOutput(resultPayload)
    if (imageOutputs.length) {
      nextOutputs.images = imageOutputs
      nextStorage.imageDirectory = imageOutputs[0]?.savedPath
        ? path.dirname(imageOutputs[0].savedPath)
        : nextStorage.imageDirectory
    }
    stepStates.image = {
      ...stepStates.image,
      status: 'success',
      completedAt
    }
  }

  if (menuKey === 'workspace' || menuKey === 'video-generate') {
    const videoOutput = resolveVideoRunOutput(resultPayload)
    if (videoOutput) {
      nextOutputs.video = {
        ...videoOutput,
        path: videoOutput.savedPath || videoOutput.path || '',
        savedPath: videoOutput.savedPath || videoOutput.path || ''
      }
      nextStorage.videoDirectory = nextOutputs.video.savedPath
        ? path.dirname(nextOutputs.video.savedPath)
        : nextStorage.videoDirectory
    }
    stepStates.video = {
      ...stepStates.video,
      status: 'success',
      completedAt
    }
  }

  nextProjectRun = normalizeProjectRun({
    ...nextProjectRun,
    stepStates,
    outputs: nextOutputs,
    storage: nextStorage,
    completedAt
  })

  return normalizeProjectRun({
    ...nextProjectRun,
    status: resolveProjectRunStatus(nextProjectRun.stepStates)
  })
}

function buildFailedProjectRun({
  projectRun = {},
  menuKey = '',
  errorMessage = '',
  failedAt = ''
} = {}) {
  const normalizedProjectRun = normalizeProjectRun(projectRun)
  const nextStepStates = {
    ...normalizedProjectRun.stepStates
  }

  if (menuKey === 'workspace') {
    for (const stepKey of Object.keys(nextStepStates)) {
      const currentState = nextStepStates[stepKey]
      if (currentState.status === 'success') {
        continue
      }

      nextStepStates[stepKey] = {
        ...currentState,
        status: 'failed',
        error: String(errorMessage || '').trim(),
        completedAt: failedAt
      }
    }
  } else {
    const stepKey = resolveProjectRunStepKey(menuKey)
    if (stepKey) {
      nextStepStates[stepKey] = {
        ...nextStepStates[stepKey],
        status: 'failed',
        error: String(errorMessage || '').trim(),
        completedAt: failedAt
      }
    }
  }

  return normalizeProjectRun({
    ...normalizedProjectRun,
    status: 'failed',
    stepStates: nextStepStates,
    completedAt: failedAt
  })
}

function splitWorkspaceTextValues(value = '') {
  return String(value || '')
    .split(/[\r\n,，;；]+/)
    .map((item) => item.trim())
    .filter(Boolean)
}

function resolveWorkspaceProjectDisplayName(draft = {}) {
  const projectName = String(draft.projectName || '').trim()
  if (projectName) {
    return projectName
  }

  const productName = String(draft.productName || '').trim()
  if (productName) {
    return `${productName}项目`
  }

  return '未命名商品项目'
}

function upsertProductProject(productProjects = [], nextProject = {}) {
  return [
    nextProject,
    ...normalizeProductProjects(productProjects).filter((project) => project.id !== nextProject.id)
  ]
}

function attachTaskRefToProductProject(project = {}, taskId = '', updatedAt = '') {
  return normalizeProductProject({
    ...project,
    taskRefs: [
      taskId,
      ...normalizeStringList(project.taskRefs)
    ],
    updatedAt: updatedAt || project.updatedAt || ''
  })
}

function buildWorkspaceProjectDraft({
  currentProject = null,
  draft = {},
  projectId = '',
  createdAt = '',
  updatedAt = ''
} = {}) {
  return normalizeProductProject({
    ...(currentProject || {}),
    id: projectId,
    name: resolveWorkspaceProjectDisplayName(draft),
    status: currentProject?.status || 'draft',
    platformTarget: splitWorkspaceTextValues(draft.platformTargetsText),
    baseInfo: {
      ...(currentProject?.baseInfo || {}),
      productName: String(draft.productName || '').trim(),
      brand: String(draft.brand || '').trim(),
      category: String(draft.category || '').trim(),
      highlights: splitWorkspaceTextValues(draft.highlightsText),
      keywords: splitWorkspaceTextValues(draft.keywordsText),
      language: String(draft.language || 'zh-CN').trim() || 'zh-CN'
    },
    createdAt: currentProject?.createdAt || createdAt,
    updatedAt
  })
}

function applyWorkspaceTextResultsToProject(project = {}, resultPayload = {}, updatedAt = '') {
  const titleCandidates = (resultPayload.textResults || [])
    .filter((item) => item.kind === 'title')
    .map((item) => String(item.content || '').trim())
    .filter(Boolean)
  const descriptionCandidates = (resultPayload.textResults || [])
    .filter((item) => item.kind === 'description')
    .map((item) => String(item.content || '').trim())
    .filter(Boolean)

  return normalizeProductProject({
    ...project,
    status: titleCandidates.length || descriptionCandidates.length ? 'ready' : (project.status || 'draft'),
    content: {
      ...(project.content || {}),
      titleCandidates,
      descriptionCandidates,
      selectedTitle: titleCandidates[0] || project.content?.selectedTitle || '',
      selectedDescription: descriptionCandidates[0] || project.content?.selectedDescription || ''
    },
    updatedAt
  })
}

function applyTitleResultsToProject(project = {}, resultPayload = {}, updatedAt = '') {
  const titleCandidates = (resultPayload.textResults || [])
    .map((item) => String(item.content || '').trim())
    .filter(Boolean)

  return normalizeProductProject({
    ...project,
    status: titleCandidates.length ? 'ready' : (project.status || 'draft'),
    content: {
      ...(project.content || {}),
      titleCandidates,
      selectedTitle: titleCandidates[0] || project.content?.selectedTitle || ''
    },
    updatedAt
  })
}

function applyDescriptionResultsToProject(project = {}, resultPayload = {}, updatedAt = '') {
  const descriptionCandidates = (resultPayload.textResults || [])
    .map((item) => String(item.content || '').trim())
    .filter(Boolean)

  return normalizeProductProject({
    ...project,
    status: descriptionCandidates.length ? 'ready' : (project.status || 'draft'),
    content: {
      ...(project.content || {}),
      descriptionCandidates,
      selectedDescription: descriptionCandidates[0] || project.content?.selectedDescription || ''
    },
    updatedAt
  })
}

function applyImageResultsToProject(project = {}, resultPayload = {}, updatedAt = '') {
  const generatedImages = (resultPayload.groupedResults || []).flatMap((group) => {
    return (group.outputs || []).map((item) => ({
      ...item,
      path: item.savedPath || item.path || '',
      savedPath: item.savedPath || item.path || ''
    }))
  })

  return normalizeProductProject({
    ...project,
    status: generatedImages.length ? 'ready' : (project.status || 'draft'),
    assets: {
      ...(project.assets || {}),
      generatedImages
    },
    updatedAt
  })
}

function applyVideoResultsToProject(project = {}, resultPayload = {}, updatedAt = '') {
  const generatedVideo = (resultPayload.groupedResults || [])
    .flatMap((group) => group.outputs || [])
    .find((item) => {
      return String(item.savedPath || item.path || '').trim()
    }) || null

  return normalizeProductProject({
    ...project,
    status: generatedVideo ? 'ready' : (project.status || 'draft'),
    assets: {
      ...(project.assets || {}),
      generatedVideo: generatedVideo
        ? {
            ...generatedVideo,
            path: generatedVideo.savedPath || generatedVideo.path || '',
            savedPath: generatedVideo.savedPath || generatedVideo.path || ''
          }
        : project.assets?.generatedVideo || null
    },
    updatedAt
  })
}

function buildProjectCardFromAsset({
  asset = {},
  projectId = '',
  createdAt = '',
  platform = 'temu',
  language = 'zh-CN'
} = {}) {
  const fallbackName = String(asset.name || '').replace(/\.[^.]+$/, '').trim() || '未命名商品'

  return normalizeProductProject({
    id: projectId,
    name: fallbackName,
    status: 'draft',
    platformTarget: [platform],
    baseInfo: {
      productName: fallbackName,
      brand: '',
      category: '',
      highlights: [],
      keywords: [],
      language
    },
    assets: {
      sourceImages: [normalizeImageAsset(asset)].filter(Boolean),
      generatedImages: [],
      generatedVideo: null
    },
    content: {
      titleCandidates: [],
      descriptionCandidates: [],
      selectedTitle: '',
      selectedDescription: ''
    },
    createdAt,
    updatedAt: createdAt
  })
}

function buildEmptyProductProject({
  projectId = '',
  productName = '',
  platform = 'temu',
  language = 'zh-CN',
  createdAt = ''
} = {}) {
  const resolvedProductName = String(productName || '').trim()

  return normalizeProductProject({
    id: projectId,
    name: resolvedProductName,
    status: 'draft',
    platformTarget: [platform],
    baseInfo: {
      productName: resolvedProductName,
      brand: '',
      category: '',
      highlights: [],
      keywords: [],
      language
    },
    assets: {
      sourceImages: [],
      generatedImages: [],
      generatedVideo: null
    },
    content: {
      titleCandidates: [],
      descriptionCandidates: [],
      selectedTitle: '',
      selectedDescription: ''
    },
    createdAt,
    updatedAt: createdAt
  })
}

function updateProductProjectFields(project = {}, patch = {}, updatedAt = '') {
  const normalizedProject = normalizeProductProject(project)
  const nextPatch = patch && typeof patch === 'object' ? patch : {}
  const baseInfoPatch = nextPatch.baseInfo && typeof nextPatch.baseInfo === 'object' ? nextPatch.baseInfo : {}
  const assetsPatch = nextPatch.assets && typeof nextPatch.assets === 'object' ? nextPatch.assets : {}
  const contentPatch = nextPatch.content && typeof nextPatch.content === 'object' ? nextPatch.content : {}

  return normalizeProductProject({
    ...normalizedProject,
    ...nextPatch,
    name: Object.prototype.hasOwnProperty.call(nextPatch, 'name')
      ? String(nextPatch.name || '').trim()
      : normalizedProject.name,
    platformTarget: Object.prototype.hasOwnProperty.call(nextPatch, 'platformTarget')
      ? normalizeStringList(nextPatch.platformTarget)
      : normalizedProject.platformTarget,
    baseInfo: {
      ...normalizedProject.baseInfo,
      ...baseInfoPatch
    },
    assets: {
      ...normalizedProject.assets,
      ...assetsPatch,
      sourceImages: Object.prototype.hasOwnProperty.call(assetsPatch, 'sourceImages')
        ? (Array.isArray(assetsPatch.sourceImages) ? assetsPatch.sourceImages.map((item) => normalizeImageAsset(item)).filter(Boolean) : [])
        : normalizedProject.assets.sourceImages,
      generatedImages: Object.prototype.hasOwnProperty.call(assetsPatch, 'generatedImages')
        ? (Array.isArray(assetsPatch.generatedImages) ? assetsPatch.generatedImages.slice() : [])
        : normalizedProject.assets.generatedImages,
      generatedVideo: Object.prototype.hasOwnProperty.call(assetsPatch, 'generatedVideo')
        ? (assetsPatch.generatedVideo && typeof assetsPatch.generatedVideo === 'object'
            ? { ...assetsPatch.generatedVideo }
            : null)
        : normalizedProject.assets.generatedVideo
    },
    content: {
      ...normalizedProject.content,
      ...contentPatch
    },
    updatedAt
  })
}

function createDefaultTasks() {
  return []
}

function createDefaultRequestMetrics() {
  return []
}

function createDefaultState() {
  return {
    formDrafts: createDefaultDrafts(),
    resultsByMenu: createDefaultResultsByMenu(),
    exportItemsByMenu: createDefaultExportItemsByMenu(),
    productProjects: [],
    activeProductProjectId: '',
    projectRuns: [],
    activeProjectRunId: '',
    tasks: createDefaultTasks(),
    requestMetrics: createDefaultRequestMetrics()
  }
}

function normalizeRequestMetricEntry(entry = {}) {
  return {
    id: typeof entry.id === 'string' ? entry.id : '',
    createdAt: typeof entry.createdAt === 'string' ? entry.createdAt : '',
    method: typeof entry.method === 'string' ? entry.method : 'POST',
    requestPath: typeof entry.requestPath === 'string' ? entry.requestPath : '',
    elapsedMs: Math.max(0, Number(entry.elapsedMs) || 0),
    requestStatus: entry.requestStatus === 'failed' ? 'failed' : 'success'
  }
}

function normalizeRequestMetrics(requestMetrics = []) {
  return Array.isArray(requestMetrics)
    ? requestMetrics
      .map((entry) => normalizeRequestMetricEntry(entry))
      .filter((entry) => entry.requestPath)
      .slice(0, REQUEST_METRIC_HISTORY_LIMIT)
    : createDefaultRequestMetrics()
}

function appendRequestMetric(requestMetrics = [], entry = {}) {
  return [
    normalizeRequestMetricEntry(entry),
    ...normalizeRequestMetrics(requestMetrics)
  ].slice(0, REQUEST_METRIC_HISTORY_LIMIT)
}

function listDirectoryEntriesSync(directoryPath, {
  readdirSync = fsSync.readdirSync
} = {}) {
  try {
    return readdirSync(directoryPath, { withFileTypes: true })
  } catch {
    return []
  }
}

function statDirectorySync(directoryPath, {
  statSync = fsSync.statSync
} = {}) {
  try {
    return statSync(directoryPath)
  } catch {
    return null
  }
}

function buildScannedExportItemId({ menuKey, outputRootDirectory, directoryPath }) {
  const relativePath = path.relative(outputRootDirectory, directoryPath).replace(/\\/g, '/')
  return `${menuKey}:${relativePath}`
}

function resolveExportItemIdentity(item = {}) {
  return item.directoryPath || item.outputDirectory || item.savedPath || item.name || item.id || ''
}

function scanStoredExportItemsByMenu({
  outputRootDirectory = OUTPUT_ROOT_DIRECTORY,
  readdirSync = fsSync.readdirSync,
  statSync = fsSync.statSync
} = {}) {
  const exportItemsByMenu = createDefaultExportItemsByMenu()
  const supportedMenuKeys = [
    'workspace',
    'title-generator',
    'description-generator',
    'series-generate',
    'video-generate'
  ]

  for (const menuKey of supportedMenuKeys) {
    const featureRootDirectory = path.resolve(outputRootDirectory, getFeatureDirectoryKey(menuKey))
    const taskEntries = listDirectoryEntriesSync(featureRootDirectory, { readdirSync })
      .filter((entry) => entry.isDirectory())
    const scannedItems = []

    for (const taskEntry of taskEntries) {
      const taskDirectory = path.resolve(featureRootDirectory, taskEntry.name)
      const groupEntries = listDirectoryEntriesSync(taskDirectory, { readdirSync })
        .filter((entry) => entry.isDirectory())

      for (const groupEntry of groupEntries) {
        const groupDirectory = path.resolve(taskDirectory, groupEntry.name)
        const groupStats = statDirectorySync(groupDirectory, { statSync })
        const itemCount = listDirectoryEntriesSync(groupDirectory, { readdirSync }).length

        scannedItems.push({
          ...createFolderExportItem({
            id: buildScannedExportItemId({
              menuKey,
              outputRootDirectory,
              directoryPath: groupDirectory
            }),
            name: groupEntry.name,
            directoryPath: groupDirectory,
            itemCount,
            groupTitle: groupEntry.name
          }),
          updatedAt: groupStats?.mtime?.toISOString?.() || ''
        })
      }
    }

    exportItemsByMenu[menuKey] = scannedItems.sort((left, right) => {
      const rightTime = right.updatedAt ? new Date(right.updatedAt).getTime() : 0
      const leftTime = left.updatedAt ? new Date(left.updatedAt).getTime() : 0
      return rightTime - leftTime || String(left.name || '').localeCompare(String(right.name || ''))
    })
  }

  return exportItemsByMenu
}

function mergeExportItemsByMenu({
  scannedExportItemsByMenu,
  storedExportItemsByMenu
}) {
  const mergedExportItemsByMenu = createDefaultExportItemsByMenu()

  for (const menuKey of Object.keys(mergedExportItemsByMenu)) {
    const mergedItems = []
    const seenIdentities = new Set()

    for (const item of scannedExportItemsByMenu[menuKey] || []) {
      const identity = resolveExportItemIdentity(item)
      if (!identity || seenIdentities.has(identity)) {
        continue
      }

      seenIdentities.add(identity)
      mergedItems.push(item)
    }

    for (const item of storedExportItemsByMenu[menuKey] || []) {
      const identity = resolveExportItemIdentity(item)
      if (!identity || seenIdentities.has(identity)) {
        continue
      }

      seenIdentities.add(identity)
      mergedItems.push(item)
    }

    mergedExportItemsByMenu[menuKey] = mergedItems
  }

  return mergedExportItemsByMenu
}

function mergeStudioState(savedState = {}) {
  const defaultState = createDefaultState()
  const normalizedProductProjects = normalizeProductProjects(savedState.productProjects)
  const normalizedProjectRuns = normalizeProjectRuns(savedState.projectRuns)
  const mergedFormDrafts = {
    ...defaultState.formDrafts,
    ...(savedState.formDrafts || {})
  }
  const normalizedFormDrafts = Object.fromEntries(menuItems.map((item) => {
    return [
      item.key,
      normalizeDraftForMenu(item.key, mergedFormDrafts[item.key] || {})
    ]
  }))

  return {
    formDrafts: normalizedFormDrafts,
    resultsByMenu: Object.fromEntries(menuItems.map((item) => {
      return [
        item.key,
        {
          ...(defaultState.resultsByMenu[item.key] || {}),
          ...((savedState.resultsByMenu || {})[item.key] || {})
        }
      ]
    })),
    exportItemsByMenu: Object.fromEntries(menuItems.map((item) => {
      return [
        item.key,
        Array.isArray((savedState.exportItemsByMenu || {})[item.key])
          ? (savedState.exportItemsByMenu || {})[item.key]
          : (defaultState.exportItemsByMenu[item.key] || [])
      ]
    })),
    productProjects: normalizedProductProjects,
    activeProductProjectId: resolveActiveProductProjectId(
      normalizedProductProjects,
      savedState.activeProductProjectId
    ),
    projectRuns: normalizedProjectRuns,
    activeProjectRunId: resolveActiveProjectRunId(
      normalizedProjectRuns,
      savedState.activeProjectRunId
    ),
    tasks: Array.isArray(savedState.tasks) ? savedState.tasks : defaultState.tasks,
    requestMetrics: normalizeRequestMetrics(savedState.requestMetrics)
  }
}

function sortTasks(tasks = []) {
  return [...tasks].sort((left, right) => {
    return new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime()
  })
}

function resolveTaskMenuKey(task = {}) {
  if (task.menuKey && menuLabelMap[task.menuKey]) {
    return task.menuKey
  }

  return taskMenuMapByCategory[task.category] || ''
}

function countStoredResults(exportItems = []) {
  return exportItems.filter((item) => {
    return item && (item.savedPath || item.directoryPath || item.outputDirectory || item.status === '已存储')
  }).length
}

function countCurrentResults(resultPayload = {}) {
  const groupedResultCount = (resultPayload.groupedResults || []).reduce((total, group) => {
    return total + (group.outputs || []).length
  }, 0)

  return (resultPayload.textResults || []).length + (resultPayload.comparisonResults || []).length + groupedResultCount
}

function buildWorkspaceStatsCard({ state, tasks = [], menuKey, title }) {
  const relatedTasks = sortTasks(tasks).filter((task) => resolveTaskMenuKey(task) === menuKey)
  const completedTaskCount = relatedTasks.filter((task) => task.status === '已完成').length
  const failedTaskCount = relatedTasks.filter((task) => task.status === '失败').length
  const exportItems = state.exportItemsByMenu[menuKey] || []
  const resultPayload = state.resultsByMenu[menuKey] || { textResults: [], images: [] }
  const items = [
    { label: '模型调用次数', value: String(relatedTasks.length) },
    { label: '任务总数', value: String(relatedTasks.length) },
    { label: '已完成任务', value: String(completedTaskCount) },
    { label: '失败任务', value: String(failedTaskCount) },
    { label: '当前结果数', value: String(countCurrentResults(resultPayload)) },
    { label: '已存储结果', value: String(countStoredResults(exportItems)) }
  ]

  return {
    title,
    items
  }
}

function normalizeCreditStateForDisplay(creditState = {}) {
  const source = creditState && typeof creditState === 'object' ? creditState : {}

  return {
    totalPurchasedCredits: Math.max(0, Number(source.totalPurchasedCredits) || 0),
    remainingCredits: Math.max(0, Number(source.remainingCredits) || 0),
    frozenCredits: Math.max(0, Number(source.frozenCredits) || 0),
    usedCredits: Math.max(0, Number(source.usedCredits) || 0),
    lastAdjustmentAt: typeof source.lastAdjustmentAt === 'string' ? source.lastAdjustmentAt : '',
    lastAdjustmentOperation: typeof source.lastAdjustmentOperation === 'string' ? source.lastAdjustmentOperation : '',
    lastAdjustmentAmount: Math.max(0, Number(source.lastAdjustmentAmount) || 0),
    adjustmentHistory: Array.isArray(source.adjustmentHistory) ? source.adjustmentHistory.slice() : [],
    activityHistory: Array.isArray(source.activityHistory)
      ? source.activityHistory.slice(0, CREDIT_ACTIVITY_HISTORY_LIMIT).map((entry = {}) => ({
          id: typeof entry.id === 'string' ? entry.id : '',
          type: typeof entry.type === 'string' ? entry.type : '',
          operation: entry.operation === 'decrease' ? 'decrease' : 'increase',
          amount: Math.max(0, Number(entry.amount) || 0),
          createdAt: typeof entry.createdAt === 'string' ? entry.createdAt : '',
          note: typeof entry.note === 'string' ? entry.note : '',
          taskId: typeof entry.taskId === 'string' ? entry.taskId : '',
          taskNumber: typeof entry.taskNumber === 'string' ? entry.taskNumber : '',
          taskName: typeof entry.taskName === 'string' ? entry.taskName : '',
          menuKey: typeof entry.menuKey === 'string' ? entry.menuKey : '',
          modelSummary: typeof entry.modelSummary === 'string' ? entry.modelSummary : ''
        }))
      : [],
    taskLedger: source.taskLedger && typeof source.taskLedger === 'object' ? { ...source.taskLedger } : {}
  }
}

function resolveModelCreditCost(modelName = '') {
  return modelCreditCostMap[modelName] || 0
}

function estimateTaskCredits(menuKey, draft = {}) {
  if (menuKey === 'title-generator' || menuKey === 'description-generator') {
    return 0
  }

  if (menuKey === 'workspace') {
    const imageCost = Math.max(1, Number(draft.generateCount) || 4) * resolveModelCreditCost(draft.imageModel || 'gpt-image-2')
    return (draft.sourceImage || draft.referenceImage) ? imageCost : 0
  }

  if (menuKey === 'series-generate') {
    return resolveGroupImageCount(menuKey, draft) * Math.max(1, Number(draft.batchCount) || 1) * resolveModelCreditCost(draft.model)
  }

  if (menuKey === 'video-generate') {
    return 0
  }

  return 0
}

function buildCreditOverview(settings = {}) {
  const creditState = normalizeCreditStateForDisplay(settings.creditState)
  const dashboardCreditState = settings.dashboardCreditState && typeof settings.dashboardCreditState === 'object'
    ? settings.dashboardCreditState
    : {}
  const textBalanceCny = Math.max(0, Number(dashboardCreditState.text?.balanceCny) || 0)
  const imageRemainingCredits = Math.max(0, Number(dashboardCreditState.image?.remainingCredits) || 0)
  const imageTotalCredits = Math.max(0, Number(dashboardCreditState.image?.totalCredits) || 0)
  const videoBalanceCny = Math.max(0, Number(dashboardCreditState.video?.balanceCny) || 0)
  const baseModelCreditCost = resolveModelCreditCost('gpt-image-2') || 600
  const latestAdjustmentLabel = creditState.lastAdjustmentAt
    ? `${creditState.lastAdjustmentOperation === 'decrease' ? '扣减' : '增加'} ${creditState.lastAdjustmentAmount}`
    : '--'

  return {
    ledgers: [
      {
        key: 'text',
        title: '文本',
        unit: 'CNY',
        value: textBalanceCny.toFixed(2),
        items: [
          { label: '充值余额', value: textBalanceCny.toFixed(2) }
        ]
      },
      {
        key: 'image',
        title: '图片',
        unit: '积分',
        value: String(imageRemainingCredits),
        items: [
          { label: '剩余积分', value: String(imageRemainingCredits) },
          { label: '总积分', value: String(imageTotalCredits) },
          { label: '冻结积分', value: String(creditState.frozenCredits) },
          { label: '已用积分', value: String(creditState.usedCredits) },
          { label: '最近调整', value: latestAdjustmentLabel },
          { label: '按 gpt-image-2 约可生成', value: String(Math.floor(imageRemainingCredits / baseModelCreditCost)) }
        ]
      },
      {
        key: 'video',
        title: '视频',
        unit: 'CNY',
        value: videoBalanceCny.toFixed(2),
        items: [
          { label: '可用额度', value: videoBalanceCny.toFixed(2) }
        ]
      }
    ]
  }
}

function appendCreditActivity(creditState, activityEntry = {}) {
  return [
    {
      id: String(activityEntry.id || ''),
      type: String(activityEntry.type || ''),
      operation: activityEntry.operation === 'decrease' ? 'decrease' : 'increase',
      amount: Math.max(0, Number(activityEntry.amount) || 0),
      createdAt: String(activityEntry.createdAt || ''),
      note: String(activityEntry.note || ''),
      taskId: String(activityEntry.taskId || ''),
      taskNumber: String(activityEntry.taskNumber || ''),
      taskName: String(activityEntry.taskName || ''),
      menuKey: String(activityEntry.menuKey || ''),
      modelSummary: String(activityEntry.modelSummary || '')
    },
    ...(Array.isArray(creditState.activityHistory) ? creditState.activityHistory : [])
  ].slice(0, CREDIT_ACTIVITY_HISTORY_LIMIT)
}

function resolveCreditActivityLabel(item = {}) {
  if (item.type === 'manual_increase') {
    return '手动增加积分'
  }
  if (item.type === 'manual_decrease') {
    return '手动扣减积分'
  }
  if (item.type === 'task_freeze') {
    return '任务冻结积分'
  }
  if (item.type === 'task_settle') {
    return '任务消耗积分'
  }
  if (item.type === 'task_refund') {
    return '任务返还积分'
  }
  return '积分变动'
}

function resolveCreditActivityDescription(item = {}) {
  if (item.taskNumber || item.taskName) {
    const taskHeader = [item.taskNumber, item.taskName].filter(Boolean).join(' / ')
    const modelText = item.modelSummary ? ` / ${item.modelSummary}` : ''
    return `${taskHeader || '任务'}${modelText}`
  }

  return item.note || '本地积分流水'
}

function buildCreditMessages(settings = {}) {
  const creditState = normalizeCreditStateForDisplay(settings.creditState)
  const dashboardCreditState = settings.dashboardCreditState && typeof settings.dashboardCreditState === 'object'
    ? settings.dashboardCreditState
    : {}

  return {
    ledgers: [
      {
        key: 'text',
        title: '文本记录',
        items: dashboardCreditState.text?.lastSyncedAt
          ? [{
              id: `text-sync-${dashboardCreditState.text.lastSyncedAt}`,
              createdAt: dashboardCreditState.text.lastSyncedAt,
              note: '文本余额同步',
              amount: Number(dashboardCreditState.text.balanceCny || 0).toFixed(2)
            }]
          : []
      },
      {
        key: 'image',
        title: '图片记录',
        items: creditState.activityHistory.map((item) => ({
          ...item,
          label: resolveCreditActivityLabel(item),
          description: resolveCreditActivityDescription(item),
          amountDisplay: `${item.operation === 'decrease' ? '-' : '+'}${item.amount}`
        }))
      },
      {
        key: 'video',
        title: '视频记录',
        items: dashboardCreditState.video?.lastSyncedAt
          ? [{
              id: `video-sync-${dashboardCreditState.video.lastSyncedAt}`,
              createdAt: dashboardCreditState.video.lastSyncedAt,
              note: '视频额度同步',
              amount: Number(dashboardCreditState.video.balanceCny || 0).toFixed(2)
            }]
          : []
      }
    ]
  }
}

function formatMonitorTimeLabel(dateValue = '') {
  const date = new Date(dateValue)
  if (Number.isNaN(date.getTime())) {
    return '--:--:--'
  }

  return [
    String(date.getHours()).padStart(2, '0'),
    String(date.getMinutes()).padStart(2, '0'),
    String(date.getSeconds()).padStart(2, '0')
  ].join(':')
}

function buildNetworkMonitor(state = {}) {
  const requestMetrics = normalizeRequestMetrics(state.requestMetrics).sort((left, right) => {
    const rightTime = right.createdAt ? new Date(right.createdAt).getTime() : 0
    const leftTime = left.createdAt ? new Date(left.createdAt).getTime() : 0
    return rightTime - leftTime
  })
  const totalCount = requestMetrics.length
  const successCount = requestMetrics.filter((item) => item.requestStatus === 'success').length
  const averageLatencyMs = totalCount
    ? Math.round(requestMetrics.reduce((sum, item) => sum + item.elapsedMs, 0) / totalCount)
    : 0

  return {
    title: '网络监控',
    items: requestMetrics.slice(0, 12).map((item) => ({
      id: item.id,
      createdAt: item.createdAt,
      timeLabel: formatMonitorTimeLabel(item.createdAt),
      method: item.method || 'POST',
      requestPath: item.requestPath,
      elapsedMs: item.elapsedMs,
      status: item.requestStatus
    })),
    summary: {
      latestLatencyMs: requestMetrics[0]?.elapsedMs || 0,
      averageLatencyMs,
      successRate: totalCount ? `${Math.round((successCount / totalCount) * 100)}%` : '0%'
    }
  }
}

function buildWorkspaceDashboard(state, tasks = [], settings = {}) {
  return {
    ...Object.fromEntries(workspaceDashboardSections.map((section) => [
      section.cardKey,
      buildWorkspaceStatsCard({
        state,
        tasks,
        menuKey: section.menuKey,
        title: section.title
      })
    ])),
    creditOverview: buildCreditOverview(settings),
    creditMessages: buildCreditMessages(settings),
    networkMonitor: buildNetworkMonitor(state)
  }
}

function safeResolveUserName() {
  try {
    return os.userInfo().username || 'unknown'
  } catch (_error) {
    return 'unknown'
  }
}

function buildHostInfo() {
  const cpuList = os.cpus() || []

  return {
    systemName: os.hostname(),
    platformName: `${os.platform()} ${os.release()}`,
    architecture: os.arch(),
    cpuModel: cpuList[0]?.model || 'Unknown CPU',
    userName: safeResolveUserName(),
    runtimeName: `Node ${process.versions.node}`
  }
}

function buildSettingsSummary(settings = {}) {
  return {
    apiKeys: Array.isArray(settings.apiKeys) ? settings.apiKeys.slice(0, 2) : ['', ''],
    activeApiKeyIndex: Number.isInteger(settings.activeApiKeyIndex) ? settings.activeApiKeyIndex : 0,
    dashboardCreditState: settings.dashboardCreditState && typeof settings.dashboardCreditState === 'object'
      ? settings.dashboardCreditState
      : {
          text: { balanceCny: 0, lastSyncedAt: '', syncStatus: 'idle' },
          image: { totalCredits: 0, remainingCredits: 0, lastSyncedAt: '', syncStatus: 'idle' },
          video: { balanceCny: 0, lastSyncedAt: '', syncStatus: 'idle' }
        },
    creditState: normalizeCreditStateForDisplay(settings.creditState)
  }
}

async function buildResultPayload(menuKey, draft, taskId, outputDirectory, {
  generateImageResults,
  generateCopywritingResults,
  generateVideoResults,
  onProgress
}) {
  if (menuKey === 'workspace') {
    const enabledSteps = normalizeProjectEnabledSteps(draft.enabledSteps)
    await onProgress?.({
      progress: 12,
      status: 'running'
    })

    const workspaceProjectName = resolveWorkspaceProjectDisplayName(draft)
    const highlightText = splitWorkspaceTextValues(draft.highlightsText).join('、') || '暂无'
    const keywordText = splitWorkspaceTextValues(draft.keywordsText).join('、') || '暂无'
    const platformText = splitWorkspaceTextValues(draft.platformTargetsText).join('、') || '通用电商平台'

    const titleResults = enabledSteps.title
      ? await generateCopywritingResults({
          taskId: `${taskId}-title`,
          draft: {
            model: draft.model,
            quantity: Math.max(1, Number(draft.titleQuantity) || 1),
            prompt: [
              `商品名称：${draft.productName || workspaceProjectName}`,
              `品牌：${draft.brand || '未提供'}`,
              `类目：${draft.category || '未提供'}`,
              `卖点：${highlightText}`,
              `关键词：${keywordText}`,
              `目标平台：${platformText}`,
              `语言：${draft.language || 'zh-CN'}`,
              `任务要求：${draft.titlePrompt || ''}`,
              `最大字数：${draft.titleMaxChars || 60}`,
              '请输出适合电商上架的商品标题，长度适中，优先突出商品主体、关键卖点和购买价值。'
            ].filter(Boolean).join('\n')
          }
        })
      : []

    await onProgress?.({
      progress: 58,
      status: 'running'
    })

    const descriptionResults = enabledSteps.description
      ? await generateCopywritingResults({
          taskId: `${taskId}-description`,
          draft: {
            model: draft.model,
            quantity: Math.max(1, Number(draft.descriptionQuantity) || 1),
            prompt: [
              `商品名称：${draft.productName || workspaceProjectName}`,
              `品牌：${draft.brand || '未提供'}`,
              `类目：${draft.category || '未提供'}`,
              `卖点：${highlightText}`,
              `关键词：${keywordText}`,
              `目标平台：${platformText}`,
              `语言：${draft.language || 'zh-CN'}`,
              `任务要求：${draft.descriptionPrompt || ''}`,
              `最大字数：${draft.descriptionMaxChars || 300}`,
              '请输出适合商品详情页或上架页的商品描述，要求信息清晰、卖点明确、语气自然，不要分点编号。'
            ].filter(Boolean).join('\n')
          }
        })
      : []

    await onProgress?.({
      progress: 72,
      status: 'running'
    })

    const workspaceImagePromptBase = String(
      draft.imagePrompt ||
      draft.globalPrompt ||
      '围绕商品生成一套适合电商展示的图片，突出主体、卖点和清晰质感'
    ).trim()
    const workspaceImageTypeLabels = SERIES_GENERATE_DEFAULT_TYPE_ORDER
    const imageDraft = {
      ...draft,
      sourceImage: draft.sourceImage || draft.referenceImage || null,
      model: draft.imageModel || 'gpt-image-2',
      generateCount: Math.max(1, Number(draft.generateCount) || 4),
      batchCount: 1,
      size: draft.size || draft.imageSize || '1:1',
      promptAssignments: normalizePromptAssignments(
        Array.from({ length: Math.max(1, Number(draft.generateCount) || 4) }, (_unused, index) => ({
          id: `workspace-series-${index + 1}`,
          prompt: `${workspaceImageTypeLabels[index] || '详情图'}：${workspaceImagePromptBase}`,
          templateId: SERIES_GENERATE_TEMPLATE_ID_BY_TYPE[workspaceImageTypeLabels[index] || '详情图'] || draft.imageTemplateId || DEFAULT_EMPTY_PROMPT_TEMPLATE_ID,
          imageType: workspaceImageTypeLabels[index] || '详情图',
          differenceLevel: 'off'
        })),
        Math.max(1, Number(draft.generateCount) || 4)
      )
    }

    const imageResults = enabledSteps.image && imageDraft.sourceImage
      ? await generateImageResults({
          menuKey: 'series-generate',
          draft: imageDraft,
          taskId: `${taskId}-series`,
          outputDirectory,
          onProgress: async ({ progress, status } = {}) => {
            const mappedProgress = 72 + Math.round((Math.max(0, Number(progress) || 0) * 0.18))
            await onProgress?.({
              progress: Math.min(90, mappedProgress),
              status
            })
          }
        })
      : {
          textResults: [],
          comparisonResults: [],
          groupedResults: [],
          summary: {
            title: '套图结果',
            description: '未提供样图，跳过套图生成'
          }
        }

    await onProgress?.({
      progress: 91,
      status: 'running'
    })

    const videoDraft = {
      ...draft,
      sourceImage: draft.sourceImage || draft.referenceImage || null,
      model: draft.videoModel || 'MiniMax-Hailuo-2.3-Fast',
      prompt: String(draft.videoPrompt || draft.prompt || '生成适合电商展示的商品视频，镜头稳定，突出主体与卖点').trim(),
      duration: draft.duration || draft.videoDuration || '6s',
      resolution: draft.resolution || draft.videoResolution || '768P',
      motionStrength: draft.motionStrength || draft.videoMotionStrength || 'auto',
      videoTemplateId: draft.videoTemplateId || 'video-main'
    }

    const videoResults = enabledSteps.video && videoDraft.sourceImage
      ? await generateVideoResults({
          draft: videoDraft,
          taskId: `${taskId}-video`,
          outputDirectory,
          onProgress: async ({ progress, status } = {}) => {
            const mappedProgress = 91 + Math.round((Math.max(0, Number(progress) || 0) * 0.09))
            await onProgress?.({
              progress: Math.min(100, mappedProgress),
              status
            })
          }
        })
      : {
          textResults: [],
          comparisonResults: [],
          groupedResults: [],
          summary: {
            title: '视频结果',
            description: '未提供样图，跳过视频生成'
          }
        }

    await onProgress?.({
      progress: 100,
      status: 'succeeded'
    })

    return {
      textResults: [
        ...titleResults.map((item, index) => ({
          ...item,
          id: `${taskId}-title-${index + 1}`,
          title: `标题 ${index + 1}`,
          kind: 'title'
        })),
        ...descriptionResults.map((item, index) => ({
          ...item,
          id: `${taskId}-description-${index + 1}`,
          title: `描述 ${index + 1}`,
          kind: 'description'
        }))
      ],
      comparisonResults: [],
      groupedResults: [
        ...(imageResults.groupedResults || []),
        ...(videoResults.groupedResults || [])
      ],
      summary: {
        title: `${workspaceProjectName} / 全链路生成结果`,
        description: `已生成 ${titleResults.length} 条标题、${descriptionResults.length} 条描述，并完成套图与视频流程`
      }
    }
  }

  if (menuKey === 'title-generator') {
    const titleResults = await generateCopywritingResults({
      taskId,
      draft: {
        model: draft.model || resolveTextModelForMenu(menuKey),
        quantity: draft.titleQuantity || 3,
        prompt: [
          `商品名称：${draft.productName || '未命名商品'}`,
          `目标平台：${draft.platformTargetsText || 'temu'}`,
          `语言：${draft.language || 'zh-CN'}`,
          `任务要求：${draft.titlePrompt || ''}`,
          `最大字数：${draft.titleMaxChars || 60}`,
          '请输出适合商品上架的商品标题，不要解释，不要编号。'
        ].join('\n')
      }
    })

    return {
      textResults: titleResults.map((item, index) => ({
        ...item,
        id: `${taskId}-title-${index + 1}`,
        kind: 'title',
        title: `标题 ${index + 1}`
      })),
      comparisonResults: [],
      groupedResults: [],
      summary: {
        title: '标题生成结果'
      }
    }
  }

  if (menuKey === 'description-generator') {
    const descriptionResults = await generateCopywritingResults({
      taskId,
      draft: {
        model: draft.model || resolveTextModelForMenu(menuKey),
        quantity: draft.descriptionQuantity || 2,
        prompt: [
          `商品名称：${draft.productName || '未命名商品'}`,
          `目标平台：${draft.platformTargetsText || 'temu'}`,
          `语言：${draft.language || 'zh-CN'}`,
          `任务要求：${draft.descriptionPrompt || ''}`,
          `最大字数：${draft.descriptionMaxChars || 300}`,
          '请输出适合商品详情页或上架页的商品描述，不要解释，不要编号。'
        ].join('\n')
      }
    })

    return {
      textResults: descriptionResults.map((item, index) => ({
        ...item,
        id: `${taskId}-description-${index + 1}`,
        kind: 'description',
        title: `描述 ${index + 1}`
      })),
      comparisonResults: [],
      groupedResults: [],
      summary: {
        title: '描述生成结果'
      }
    }
  }

  if (menuKey === 'series-generate') {
    return generateImageResults({
      menuKey,
      draft,
      taskId,
      outputDirectory,
      onProgress
    })
  }

  if (menuKey === 'video-generate') {
    return generateVideoResults({
      draft,
      taskId,
      outputDirectory,
      onProgress
    })
  }

  return {
    textResults: [],
    comparisonResults: [],
    groupedResults: [],
    summary: null
  }
}

function parseDataUrlPayload(dataUrl = '') {
  const matched = /^data:([^;]+);base64,(.+)$/i.exec(dataUrl)
  if (!matched) {
    return null
  }

  const mimeType = matched[1] || 'application/octet-stream'
  const payload = matched[2] || ''
  const extensionMap = {
    'image/png': '.png',
    'image/jpeg': '.jpg',
    'image/jpg': '.jpg',
    'image/webp': '.webp',
    'image/svg+xml': '.svg'
  }

  return {
    buffer: Buffer.from(payload, 'base64'),
    extension: extensionMap[mimeType] || '.bin'
  }
}

function sanitizePathSegment(value, fallbackValue = 'result') {
  const sanitizedValue = String(value || fallbackValue)
    .replace(/[<>:"/\\|?*\s]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')

  return sanitizedValue || fallbackValue
}

function isPathInsideDirectory(targetPath, rootDirectory) {
  const normalizedRootDirectory = path.resolve(rootDirectory)
  const normalizedTargetPath = path.resolve(targetPath)
  const relativePath = path.relative(normalizedRootDirectory, normalizedTargetPath)

  return relativePath !== '' && !relativePath.startsWith('..') && !path.isAbsolute(relativePath)
}

function resolveTaskFolderBaseName({ draft, menuKey, taskId }) {
  return sanitizePathSegment(draft.taskName || '', `${menuKey}-${taskId}`)
}

function createFolderExportItem({ id, name, directoryPath, itemCount, groupTitle }) {
  return {
    id,
    name,
    status: '已存储',
    type: 'FOLDER',
    directoryPath,
    outputDirectory: directoryPath,
    groupTitle,
    itemCount
  }
}

function createDefaultTaskNumber() {
  const now = new Date()
  const dateSegment = [
    now.getFullYear(),
    String(now.getMonth() + 1).padStart(2, '0'),
    String(now.getDate()).padStart(2, '0')
  ].join('')

  return `QAI-${dateSegment}-${crypto.randomBytes(3).toString('hex').toUpperCase()}`
}

async function saveStudioResults({
  menuKey,
  taskId,
  draft,
  resultPayload,
  outputDirectory,
  writeFile = fs.writeFile
}) {
  const exportItems = []
  const persistedResultPayload = {
    ...resultPayload,
    textResults: Array.isArray(resultPayload.textResults) ? resultPayload.textResults.slice() : [],
    comparisonResults: [],
    groupedResults: []
  }
  const folderBaseName = resolveTaskFolderBaseName({
    draft,
    menuKey,
    taskId
  })

  await ensureDirectory(outputDirectory)

  if ((resultPayload.textResults || []).length) {
    const folderName = `${folderBaseName}0`
    const groupDirectory = path.resolve(outputDirectory, folderName)
    await ensureDirectory(groupDirectory)

    for (const [index, text] of (resultPayload.textResults || []).entries()) {
      const savedPath = path.resolve(groupDirectory, `${String(index).padStart(2, '0')}-${sanitizePathSegment(text.title || `text-${index + 1}`, `text-${index + 1}`)}.txt`)
      await writeFile(savedPath, text.content || String(text), 'utf8')
    }

    exportItems.push(createFolderExportItem({
      id: `${taskId}-export-folder-0`,
      name: folderName,
      directoryPath: groupDirectory,
      itemCount: (resultPayload.textResults || []).length,
      groupTitle: folderName
    }))
  }

  if ((resultPayload.comparisonResults || []).length) {
    const folderName = `${folderBaseName}0`
    const groupDirectory = path.resolve(outputDirectory, folderName)
    await ensureDirectory(groupDirectory)

    for (const [index, image] of (resultPayload.comparisonResults || []).entries()) {
      let savedPath = image.savedPath || ''

      if (!savedPath || !await fileExists(savedPath)) {
        const parsedPreview = parseDataUrlPayload(image.preview || '')
        if (!parsedPreview) {
          continue
        }

        savedPath = path.resolve(groupDirectory, `${String(index).padStart(2, '0')}-${sanitizePathSegment(image.model || 'image', 'image')}${parsedPreview.extension}`)
        await writeFile(savedPath, parsedPreview.buffer)
      } else {
        const targetPath = path.resolve(groupDirectory, `${String(index).padStart(2, '0')}-${path.basename(savedPath)}`)
        if (path.resolve(savedPath) !== path.resolve(targetPath)) {
          await fs.copyFile(savedPath, targetPath)
        }
        savedPath = targetPath
      }

      persistedResultPayload.comparisonResults.push({
        ...image,
        preview: '',
        savedPath
      })
    }

    exportItems.push(createFolderExportItem({
      id: `${taskId}-export-folder-0`,
      name: folderName,
      directoryPath: groupDirectory,
      itemCount: (resultPayload.comparisonResults || []).length,
      groupTitle: folderName
    }))
  }

  for (const [groupIndex, group] of (resultPayload.groupedResults || []).entries()) {
    const folderName = `${folderBaseName}${groupIndex}`
    const groupDirectory = path.resolve(outputDirectory, folderName)
    await ensureDirectory(groupDirectory)
    const defaultCompletedCount = (group.outputs || []).length
    const persistedGroup = {
      ...group,
      groupIndex: Number.isInteger(group.groupIndex) ? group.groupIndex : groupIndex,
      status: group.status || 'succeeded',
      completedCount: Number(group.completedCount ?? defaultCompletedCount),
      failedCount: Number(group.failedCount ?? 0),
      outputs: []
    }

    for (const [index, output] of (group.outputs || []).entries()) {
      let savedPath = ''
      const parsedPreview = parseDataUrlPayload(output.preview || '')
      const outputBaseName = sanitizePathSegment(output.title || `result-${index + 1}`, `result-${index + 1}`)

      if (parsedPreview) {
        savedPath = path.resolve(groupDirectory, `${String(index).padStart(2, '0')}-${outputBaseName}${parsedPreview.extension}`)
        await writeFile(savedPath, parsedPreview.buffer)
      } else if (output.savedPath && await fileExists(output.savedPath)) {
        savedPath = path.resolve(groupDirectory, `${String(index).padStart(2, '0')}-${outputBaseName}${path.extname(output.savedPath) || ''}`)
        if (path.resolve(output.savedPath) !== path.resolve(savedPath)) {
          await fs.copyFile(output.savedPath, savedPath)
        }
      } else {
        continue
      }

      persistedGroup.outputs.push({
        ...output,
        status: output.status || '已完成',
        preview: '',
        savedPath
      })
    }

    persistedResultPayload.groupedResults.push(persistedGroup)

    exportItems.push(createFolderExportItem({
      id: `${group.id}-export-folder`,
      name: folderName,
      directoryPath: groupDirectory,
      itemCount: (group.outputs || []).length,
      groupTitle: folderName
    }))
  }

  if (!exportItems.length) {
    const folderName = `${folderBaseName}0`
    const groupDirectory = path.resolve(outputDirectory, folderName)
    const savedPath = path.resolve(groupDirectory, `${menuKey}-${taskId}-result.txt`)
    await ensureDirectory(groupDirectory)
    await writeFile(savedPath, `${menuLabelMap[menuKey]} 结果占位`, 'utf8')
    exportItems.push(createFolderExportItem({
      id: `${taskId}-export-folder-fallback`,
      name: folderName,
      directoryPath: groupDirectory,
      itemCount: 1,
      groupTitle: folderName
    }))
  }

  return {
    exportItems,
    persistedResultPayload
  }
}

function resolveInputCount(menuKey, draft) {
  if (menuKey === 'workspace') {
    return (draft.projectId && (draft.sourceImage || draft.referenceImage)) ? 1 : 0
  }

  if (menuKey === 'series-generate') {
    return draft.sourceImage ? 1 : 0
  }

  if (menuKey === 'video-generate') {
    return draft.sourceImage ? 1 : 0
  }

  return 0
}

function resolvePlannedOutputCount(resultPayload = {}) {
  return countCurrentResults(resultPayload)
}

function formatElapsedLabel(elapsedMilliseconds = 0) {
  const normalizedElapsedMilliseconds = Number.isFinite(elapsedMilliseconds) ? Math.max(0, elapsedMilliseconds) : 0
  return `生成耗时 ${(normalizedElapsedMilliseconds / 1000).toFixed(1)} 秒`
}

function resolveSummaryModels(menuKey, draft = {}, resultPayload = {}) {
  if (menuKey === 'series-generate') {
    const groupedModels = (resultPayload.groupedResults || []).flatMap((group) => {
      return (group.outputs || []).map((item) => item.model).filter(Boolean)
    })
    return [...new Set(groupedModels)]
  }

  return draft.model ? [draft.model] : []
}

function enrichResultPayloadSummary({ menuKey, draft, resultPayload, elapsedMilliseconds }) {
  const summary = resultPayload.summary || {}
  const resultCount = countCurrentResults(resultPayload)
  const models = resolveSummaryModels(menuKey, draft, resultPayload)

  return {
    ...resultPayload,
    summary: {
      ...summary,
      statusLabel: '已完成',
      modelLabel: models.length ? `浣跨敤妯″瀷 ${models.join(' / ')}` : '',
      resultCountLabel: `缁撴灉鏁伴噺 ${resultCount}`,
      elapsedLabel: formatElapsedLabel(elapsedMilliseconds)
    }
  }
}

function resolveEstimatedInputCount(menuKey, draft = {}) {
  if (menuKey === 'workspace') {
    return (draft.projectId && (draft.sourceImage || draft.referenceImage)) ? 1 : 0
  }

  if (menuKey === 'series-generate') {
    return draft.sourceImage ? 1 : 0
  }

  if (menuKey === 'video-generate') {
    return draft.sourceImage ? 1 : 0
  }

  return 0
}

function resolveEstimatedPlannedOutputCount(menuKey, draft = {}) {
  if (menuKey === 'workspace') {
    return Math.max(1, Number(draft.titleQuantity) || 0) +
      Math.max(1, Number(draft.descriptionQuantity) || 0) +
      ((draft.sourceImage || draft.referenceImage) ? (Math.max(1, Number(draft.generateCount) || 4) + 1) : 0)
  }

  if (menuKey === 'series-generate') {
    return Math.max(1, Number(draft.batchCount) || 1) * resolveGroupImageCount(menuKey, draft)
  }

  if (menuKey === 'title-generator') {
    return Math.max(1, Number(draft.titleQuantity) || 1)
  }

  if (menuKey === 'description-generator') {
    return Math.max(1, Number(draft.descriptionQuantity) || 1)
  }

  return 0
}

function resolveTaskTitle(menuKey, draft = {}) {
  if (menuKey === 'workspace') {
    return `${resolveWorkspaceProjectDisplayName(draft)} / 全链路生成`
  }

  if (menuKey === 'title-generator') {
    return '标题生成'
  }

  if (menuKey === 'description-generator') {
    return '描述生成'
  }

  if (menuKey === 'series-generate') {
    return `套图生成 ${Math.max(1, Number(draft.batchCount) || 1)} 批 x ${resolveGroupImageCount(menuKey, draft)} 张`
  }

  if (menuKey === 'video-generate') {
    return `视频生成 ${Math.max(1, Number(draft.videoQuantity) || 1)} 条`
  }

  return `${menuLabelMap[menuKey]}任务`
}

function resolveTaskModelSummary(menuKey, draft = {}) {
  return draft.model || ''
}

function resolveGroupImageCount(menuKey, draft = {}) {
  if (menuKey === 'series-generate') {
    return Math.max(1, Math.min(MAX_SERIES_GENERATE_GROUP_SIZE, Number(draft.generateCount) || 1))
  }

  return 0
}

function resolveGroupedTaskBaseState(menuKey, draft = {}) {
  if (menuKey === 'series-generate') {
    const groupImageCount = resolveGroupImageCount(menuKey, draft)
    return {
      groupImageCount,
      totalSubtaskCount: groupImageCount * Math.max(1, Number(draft.batchCount) || 1),
      completedSubtaskCount: 0,
      failedSubtaskCount: 0,
      currentGroupIndex: 0,
      currentGroupCompletedCount: 0,
      currentGroupTotalCount: groupImageCount
    }
  }

  return {
    groupImageCount: 0,
    totalSubtaskCount: 0,
    completedSubtaskCount: 0,
    failedSubtaskCount: 0,
    currentGroupIndex: 0,
    currentGroupCompletedCount: 0,
    currentGroupTotalCount: 0
  }
}

function resolveGroupedProgressState(menuKey, draft = {}, resultPayload = {}) {
  const baseState = resolveGroupedTaskBaseState(menuKey, draft)
  const groups = Array.isArray(resultPayload.groupedResults) ? resultPayload.groupedResults : []

  if (!groups.length || menuKey !== 'series-generate') {
    return baseState
  }

  const completedSubtaskCount = groups.reduce((total, group) => {
    if (Number.isFinite(group.completedCount)) {
      return total + Number(group.completedCount)
    }

    return total + (group.outputs || []).length
  }, 0)

  const failedSubtaskCount = groups.reduce((total, group) => {
    return total + (Number(group.failedCount) || 0)
  }, 0)

  const currentGroup = groups[groups.length - 1] || null
  const currentGroupIndex = currentGroup && Number.isInteger(currentGroup.groupIndex)
    ? currentGroup.groupIndex
    : Math.max(0, groups.length - 1)
  const currentGroupCompletedCount = currentGroup
    ? (
        Number.isFinite(currentGroup.completedCount)
          ? Number(currentGroup.completedCount)
          : (currentGroup.outputs || []).length
      )
    : 0

  return {
    ...baseState,
    completedSubtaskCount,
    failedSubtaskCount,
    currentGroupIndex,
    currentGroupCompletedCount
  }
}

function buildTaskRecord({
  menuKey,
  draft,
  taskId,
  taskNumber,
  createdAt,
  inputDirectory,
  outputDirectory,
  inputCount,
  plannedOutputCount,
  batchCount,
  status,
  progress,
  estimatedCredits = 0,
  error = '',
  groupImageCount = 0,
  totalSubtaskCount = 0,
  completedSubtaskCount = 0,
  failedSubtaskCount = 0,
  currentGroupIndex = 0,
  currentGroupCompletedCount = 0,
  currentGroupTotalCount = 0
}) {
  const nextTask = {
    id: taskId,
    taskNumber,
    menuKey,
    category: taskCategoryMap[menuKey] || '工作台',
    title: resolveTaskTitle(menuKey, draft, plannedOutputCount),
    modelSummary: resolveTaskModelSummary(menuKey, draft),
    inputCount,
    plannedOutputCount,
    batchCount,
    status,
    progress,
    estimatedCredits,
    createdAt,
    inputDirectory,
    outputDirectory,
    groupImageCount,
    totalSubtaskCount,
    completedSubtaskCount,
    failedSubtaskCount,
    currentGroupIndex,
    currentGroupCompletedCount,
    currentGroupTotalCount
  }

  if (error) {
    nextTask.error = error
  }

  return nextTask
}

function buildQueuedTaskSummary({ menuKey, draft, taskId, taskNumber, createdAt, inputDirectory, outputDirectory }) {
  const groupedProgress = resolveGroupedTaskBaseState(menuKey, draft)

  return buildTaskRecord({
    menuKey,
    draft,
    taskId,
    taskNumber,
    createdAt,
    inputDirectory,
    outputDirectory,
    inputCount: resolveEstimatedInputCount(menuKey, draft),
    plannedOutputCount: resolveEstimatedPlannedOutputCount(menuKey, draft),
    batchCount: menuKey === 'series-generate'
      ? Math.max(1, Number(draft.batchCount) || 1)
      : 1,
    status: '等待中',
    progress: 0,
    estimatedCredits: estimateTaskCredits(menuKey, draft),
    ...groupedProgress
  })
}

function buildRunningTaskSummary({ menuKey, draft, taskId, taskNumber, createdAt, inputDirectory, outputDirectory }) {
  return {
    ...buildQueuedTaskSummary({
      menuKey,
      draft,
      taskId,
      taskNumber,
      createdAt,
      inputDirectory,
      outputDirectory
    }),
    status: '进行中',
    progress: 0
  }
}

function normalizeTaskProgress(progressValue, fallbackValue = 0) {
  const numericProgress = Number(progressValue)
  if (!Number.isFinite(numericProgress)) {
    return fallbackValue
  }

  return Math.max(0, Math.min(100, Math.round(numericProgress)))
}

function buildTaskSummary({ menuKey, draft, taskId, taskNumber, createdAt, inputDirectory, outputDirectory, resultPayload }) {
  const groupedProgress = resolveGroupedProgressState(menuKey, draft, resultPayload)

  return buildTaskRecord({
    menuKey,
    draft,
    taskId,
    taskNumber,
    createdAt,
    inputDirectory,
    outputDirectory,
    inputCount: resolveInputCount(menuKey, draft, resultPayload),
    plannedOutputCount: resolvePlannedOutputCount(resultPayload),
    batchCount: menuKey === 'series-generate'
      ? Math.max(1, Number(draft.batchCount) || 1)
      : 1,
    status: '已完成',
    progress: 100,
    estimatedCredits: estimateTaskCredits(menuKey, draft),
    ...groupedProgress
  })
}

function buildFailedTaskSummary({ menuKey, draft, taskId, taskNumber, createdAt, inputDirectory, outputDirectory, errorMessage }) {
  const groupedProgress = resolveGroupedTaskBaseState(menuKey, draft)

  return buildTaskRecord({
    menuKey,
    draft,
    taskId,
    taskNumber,
    createdAt,
    inputDirectory,
    outputDirectory,
    inputCount: resolveEstimatedInputCount(menuKey, draft),
    plannedOutputCount: 0,
    batchCount: menuKey === 'series-generate'
      ? Math.max(1, Number(draft.batchCount) || 1)
      : 1,
    status: '失败',
    progress: 100,
    estimatedCredits: estimateTaskCredits(menuKey, draft),
    error: errorMessage,
    ...groupedProgress
  })
}

function resolveTaskSize(menuKey, draft = {}) {
  if (menuKey === 'workspace') {
    return Math.max(1, Number(draft.generateCount) || 4) + 1
  }

  if (menuKey === 'series-generate') {
    return Math.max(1, Number(draft.batchCount) || 1) * resolveGroupImageCount(menuKey, draft)
  }

  return 0
}

function validateTaskScale(menuKey, draft = {}) {
  const limits = TASK_SIZE_LIMITS[menuKey]
  if (!limits) {
    return {
      totalSubtasks: resolveTaskSize(menuKey, draft),
      level: 'safe'
    }
  }

  const totalSubtasks = resolveTaskSize(menuKey, draft)
  if (totalSubtasks > limits.block) {
    const error = new Error('当前任务量过大，请拆分后再提交')
    error.code = 'TASK_SCALE_EXCEEDED'
    error.details = {
      menuKey,
      totalSubtasks,
      warnThreshold: limits.warn,
      blockThreshold: limits.block
    }
    throw error
  }

  return {
    totalSubtasks,
    level: totalSubtasks > limits.warn ? 'warn' : 'safe',
    warnThreshold: limits.warn,
    blockThreshold: limits.block
  }
}

async function getAvailableDiskSpaceBytes(targetPath = process.cwd(), {
  statfs = fs.statfs
} = {}) {
  let resolvedPath = path.resolve(targetPath || process.cwd())

  if (!fsSync.existsSync(resolvedPath)) {
    resolvedPath = path.dirname(resolvedPath)
  }

  while (!fsSync.existsSync(resolvedPath)) {
    const parentPath = path.dirname(resolvedPath)
    if (parentPath === resolvedPath) {
      resolvedPath = process.cwd()
      break
    }
    resolvedPath = parentPath
  }

  const stats = await statfs(resolvedPath)
  const blockSize = Number(stats?.bsize || stats?.frsize || 0)
  const freeBlocks = Number(stats?.bavail || stats?.bfree || 0)

  if (!Number.isFinite(blockSize) || !Number.isFinite(freeBlocks) || blockSize <= 0 || freeBlocks < 0) {
    throw new Error('无法读取磁盘可用空间')
  }

  return blockSize * freeBlocks
}

function estimateExportRequiredBytes(selectedItems = []) {
  const itemCount = Math.max(1, Array.isArray(selectedItems) ? selectedItems.length : 0)
  return Math.max(EXPORT_MIN_REQUIRED_BYTES, itemCount * EXPORT_MIN_REQUIRED_BYTES * EXPORT_FREE_SPACE_MULTIPLIER)
}

function buildStoppedTaskSummary(task = {}, errorMessage = '用户手动结束任务') {
  return {
    ...task,
    status: '失败',
    progress: task.status === '等待中'
      ? 0
      : Math.max(0, Math.min(100, Number(task.progress) || 0)),
    error: errorMessage
  }
}

function buildPendingConfirmationTaskSummary(
  task = {},
  errorMessage = '任务状态待确认：软件重启前任务可能仍在远端处理中，请手动结束或重新提交'
) {
  return {
    ...task,
    status: '待确认',
    progress: Math.max(0, Math.min(100, Number(task.progress) || 0)),
    error: errorMessage
  }
}

function buildTaskLedgerEntry({ taskId, taskNumber, menuKey, draft = {}, estimatedCredits = 0, createdAt, status }) {
  return {
    taskId,
    taskNumber,
    menuKey,
    taskName: String(draft.taskName || ''),
    modelSummary: resolveTaskModelSummary(menuKey, draft),
    estimatedCredits: Math.max(0, Number(estimatedCredits) || 0),
    status,
    createdAt,
    updatedAt: createdAt
  }
}

function freezeCreditsForTask({ creditState, taskId, taskNumber, menuKey, draft, estimatedCredits, createdAt }) {
  const normalizedCreditState = normalizeCreditStateForDisplay(creditState)
  const normalizedEstimatedCredits = Math.max(0, Number(estimatedCredits) || 0)

  if (!normalizedEstimatedCredits) {
    return normalizedCreditState
  }

  if (normalizedCreditState.remainingCredits < normalizedEstimatedCredits) {
    throw new Error(`积分不足：当前可用 ${normalizedCreditState.remainingCredits}，需要 ${normalizedEstimatedCredits}`)
  }

  const modelSummary = resolveTaskModelSummary(menuKey, draft)

  return normalizeCreditStateForDisplay({
    ...normalizedCreditState,
    remainingCredits: normalizedCreditState.remainingCredits - normalizedEstimatedCredits,
    frozenCredits: normalizedCreditState.frozenCredits + normalizedEstimatedCredits,
    activityHistory: appendCreditActivity(normalizedCreditState, {
      id: `task-freeze-${taskId}-${createdAt}`,
      type: 'task_freeze',
      operation: 'decrease',
      amount: normalizedEstimatedCredits,
      createdAt,
      taskId,
      taskNumber,
      taskName: String(draft.taskName || ''),
      menuKey,
      modelSummary
    }),
    taskLedger: {
      ...normalizedCreditState.taskLedger,
      [taskId]: buildTaskLedgerEntry({
        taskId,
        taskNumber,
        menuKey,
        draft,
        modelSummary,
        estimatedCredits: normalizedEstimatedCredits,
        createdAt,
        status: 'frozen'
      })
    }
  })
}

function settleCreditsForTask({ creditState, taskId, updatedAt }) {
  const normalizedCreditState = normalizeCreditStateForDisplay(creditState)
  const currentLedger = normalizedCreditState.taskLedger[taskId]

  if (!currentLedger || currentLedger.status === 'settled') {
    return normalizedCreditState
  }

  const estimatedCredits = Math.max(0, Number(currentLedger.estimatedCredits) || 0)

  return normalizeCreditStateForDisplay({
    ...normalizedCreditState,
    frozenCredits: Math.max(0, normalizedCreditState.frozenCredits - estimatedCredits),
    usedCredits: normalizedCreditState.usedCredits + estimatedCredits,
    activityHistory: appendCreditActivity(normalizedCreditState, {
      id: `task-settle-${taskId}-${updatedAt}`,
      type: 'task_settle',
      operation: 'decrease',
      amount: estimatedCredits,
      createdAt: updatedAt,
      taskId,
      taskNumber: currentLedger.taskNumber,
      taskName: currentLedger.taskName,
      menuKey: currentLedger.menuKey,
      modelSummary: currentLedger.modelSummary
    }),
    taskLedger: {
      ...normalizedCreditState.taskLedger,
      [taskId]: {
        ...currentLedger,
        status: 'settled',
        updatedAt
      }
    }
  })
}

function refundCreditsForTask({ creditState, taskId, updatedAt }) {
  const normalizedCreditState = normalizeCreditStateForDisplay(creditState)
  const currentLedger = normalizedCreditState.taskLedger[taskId]

  if (!currentLedger || currentLedger.status === 'refunded') {
    return normalizedCreditState
  }

  const estimatedCredits = Math.max(0, Number(currentLedger.estimatedCredits) || 0)

  return normalizeCreditStateForDisplay({
    ...normalizedCreditState,
    remainingCredits: normalizedCreditState.remainingCredits + estimatedCredits,
    frozenCredits: Math.max(0, normalizedCreditState.frozenCredits - estimatedCredits),
    activityHistory: appendCreditActivity(normalizedCreditState, {
      id: `task-refund-${taskId}-${updatedAt}`,
      type: 'task_refund',
      operation: 'increase',
      amount: estimatedCredits,
      createdAt: updatedAt,
      taskId,
      taskNumber: currentLedger.taskNumber,
      taskName: currentLedger.taskName,
      menuKey: currentLedger.menuKey,
      modelSummary: currentLedger.modelSummary
    }),
    taskLedger: {
      ...normalizedCreditState.taskLedger,
      [taskId]: {
        ...currentLedger,
        status: 'refunded',
        updatedAt
      }
    }
  })
}

function createStudioWorkspaceService({
  store,
  settingsService,
  apiKeyCreditService,
  deepseekBalanceService,
  promptTemplateService,
  remoteLicensePlatformClient,
  messageRecorder,
  runtimeLogger,
  outputRootDirectory = OUTPUT_ROOT_DIRECTORY,
  createId = () => crypto.randomUUID(),
  createTaskNumber = createDefaultTaskNumber,
  getNow = () => new Date().toISOString(),
  ensureDirectory: ensureDirectoryDependency = ensureDirectory,
  persistSourceFiles: persistSourceFilesDependency = persistSourceFiles,
  writeFile = fs.writeFile,
  mkdtemp = fs.mkdtemp,
  copyFile = fs.copyFile,
  copyDirectory = (sourceDirectory, targetDirectory) => fs.cp(sourceDirectory, targetDirectory, { recursive: true }),
  removeDirectory = (targetPath) => fs.rm(targetPath, { recursive: true, force: true }),
  readdirSync = fsSync.readdirSync,
  statSync = fsSync.statSync,
  getAvailableDiskSpaceBytes: getAvailableDiskSpaceBytesDependency = (targetPath) => getAvailableDiskSpaceBytes(targetPath),
  getNowMs = () => Date.now(),
  exportScanCacheTtlMs = 3000,
  exportTaskDirectory: exportTaskDirectoryDependency = defaultExportTaskDirectory,
  generateImageResults,
  generateCopywritingResults,
  generateVideoResults,
  taskManagerService
}) {
  const studioImageGenerationService = createStudioImageGenerationService({
    settingsService,
    promptTemplateService,
    messageRecorder,
    runtimeLogger,
    requestMetricRecorder: async (metric) => {
      const latestState = getStoredState()
      saveState({
        ...latestState,
        requestMetrics: appendRequestMetric(latestState.requestMetrics, {
          id: createId(),
          createdAt: getNow(),
          ...metric
        })
      })
    }
  })
  const studioVideoGenerationService = createStudioVideoGenerationService({
    settingsService,
    messageRecorder,
    runtimeLogger,
    requestMetricRecorder: async (metric) => {
      const latestState = getStoredState()
      saveState({
        ...latestState,
        requestMetrics: appendRequestMetric(latestState.requestMetrics, {
          id: createId(),
          createdAt: getNow(),
          ...metric
        })
      })
    }
  })
  const generateImageResultsDependency = generateImageResults || studioImageGenerationService.generateImageResults
  const generateCopywritingResultsDependency = generateCopywritingResults || createCopywritingGenerationService({
    settingsService,
    messageRecorder
  }).generateCopywritingResults
  const generateVideoResultsDependency = generateVideoResults || studioVideoGenerationService.generateVideoResults
  const queuedTaskExecutions = []
  const activeTaskControllers = new Map()
  let isTaskQueueRunning = false
  let taskQueuePromise = Promise.resolve()
  let cachedExportItemsByMenu = null
  let cachedExportItemsAt = 0
  let isExportItemsCacheDirty = true

  function buildBaseSnapshot() {
    const state = getStoredState()
    const settings = settingsService.getSettings()
    const tasks = getStoredTasks(state)
    const exportItemsByMenu = getResolvedExportItemsByMenu(state)
    const derivedState = {
      ...state,
      exportItemsByMenu
    }

    return {
      state,
      settings,
      tasks,
      exportItemsByMenu,
      derivedState
    }
  }

  function buildAgentReadinessSnapshot(tasks = getStoredTasks()) {
    const queuedTaskIds = queuedTaskExecutions
      .map((item) => String(item?.taskId || '').trim())
      .filter(Boolean)
    const activeTaskIds = Array.from(activeTaskControllers.keys()).filter(Boolean)

    return {
      queue: {
        queuedCount: queuedTaskIds.length,
        runningCount: activeTaskIds.length,
        isProcessing: isTaskQueueRunning,
        queuedTaskIds,
        activeTaskIds
      },
      executionLog: tasks
        .slice(0, 20)
        .map((task) => ({
          taskId: task.id,
          taskNumber: task.taskNumber || '',
          menuKey: task.menuKey || '',
          title: task.title || '',
          status: task.status || '',
          progress: Number(task.progress || 0),
          createdAt: task.createdAt || '',
          outputDirectory: task.outputDirectory || ''
        }))
    }
  }

  function createTaskExecutionController(taskId) {
    let stopped = false
    let stopReason = ''
    let resolveStopSignal = null
    const stopSignal = new Promise((resolve) => {
      resolveStopSignal = resolve
    })

    return {
      isStopped() {
        return stopped
      },
      waitForStop() {
        return stopSignal
      },
      stop(reason = '用户手动结束任务') {
        if (stopped) {
          return false
        }

        stopped = true
        stopReason = reason || '用户手动结束任务'
        resolveStopSignal?.({
          stopped: true,
          reason: stopReason,
          taskId
        })
        return true
      },
      getReason() {
        return stopReason || '用户手动结束任务'
      }
    }
  }

  function invalidateExportItemsCache() {
    cachedExportItemsByMenu = null
    cachedExportItemsAt = 0
    isExportItemsCacheDirty = true
  }

  async function persistTaskAndState({
    task,
    formDraftPatch = null,
    resultsByMenuPatch = null,
    exportItemsByMenuPatch = null,
    productProjectsPatch = null,
    activeProductProjectId = null,
    projectRunsPatch = null,
    activeProjectRunId = null
  }) {
    const latestState = getStoredState()
    const nextTasks = [
      task,
      ...getStoredTasks(latestState).filter((item) => item.id !== task.id)
    ]

    saveState({
      ...latestState,
      formDrafts: formDraftPatch
        ? {
            ...latestState.formDrafts,
            ...formDraftPatch
          }
        : latestState.formDrafts,
      resultsByMenu: resultsByMenuPatch
        ? {
            ...latestState.resultsByMenu,
            ...resultsByMenuPatch
          }
        : latestState.resultsByMenu,
      exportItemsByMenu: exportItemsByMenuPatch
        ? {
            ...latestState.exportItemsByMenu,
            ...exportItemsByMenuPatch
          }
        : latestState.exportItemsByMenu,
      productProjects: Array.isArray(productProjectsPatch)
        ? productProjectsPatch
        : latestState.productProjects,
      activeProductProjectId: typeof activeProductProjectId === 'string'
        ? activeProductProjectId
        : latestState.activeProductProjectId,
      projectRuns: Array.isArray(projectRunsPatch)
        ? projectRunsPatch
        : latestState.projectRuns,
      activeProjectRunId: typeof activeProjectRunId === 'string'
        ? activeProjectRunId
        : latestState.activeProjectRunId,
      tasks: nextTasks
    })

    if (exportItemsByMenuPatch) {
      invalidateExportItemsCache()
    }

    if (taskManagerService && typeof taskManagerService.saveTask === 'function') {
      await taskManagerService.saveTask(task)
    }

    return task
  }

  async function prepareDraftForExecution({ menuKey, draft, inputDirectory, outputDirectory }) {
    await ensureDirectoryDependency(inputDirectory)
    await ensureDirectoryDependency(outputDirectory)

    const sourcePaths = []
    const sourcePathAssignments = []

    if (menuKey === 'series-generate') {
      const sourcePath = draft.sourceImage?.path || draft.sourceImage?.storedPath || ''
      if (sourcePath) {
        sourcePathAssignments.push({ type: 'series-generate-source' })
        sourcePaths.push(sourcePath)
      }
    }

    if (menuKey === 'video-generate') {
      const sourcePath = draft.sourceImage?.path || draft.sourceImage?.storedPath || ''
      if (sourcePath) {
        sourcePathAssignments.push({ type: 'video-generate-source' })
        sourcePaths.push(sourcePath)
      }
    }

    const persistedSourcePaths = sourcePaths.length
      ? await persistSourceFilesDependency({
          sourcePaths,
          targetDirectory: inputDirectory
        })
      : []

    const preparedDraft = JSON.parse(JSON.stringify(draft))
    sourcePathAssignments.forEach((assignment, index) => {
      const storedPath = persistedSourcePaths[index] || ''
      if (!storedPath) {
        return
      }

      if (assignment.type === 'series-generate-source' && preparedDraft.sourceImage) {
        preparedDraft.sourceImage.storedPath = storedPath
      }

      if (assignment.type === 'video-generate-source' && preparedDraft.sourceImage) {
        preparedDraft.sourceImage.storedPath = storedPath
      }
    })

    return preparedDraft
  }

  async function runQueuedTaskExecution({
    menuKey,
    draft,
    taskId,
    taskNumber,
    createdAt,
    inputDirectory,
    outputDirectory,
    projectRunId = ''
  }) {
    const executionController = createTaskExecutionController(taskId)
    activeTaskControllers.set(taskId, executionController)
    const executionUpdatedAt = getNow()
    const latestStateBeforeRun = getStoredState()
    const currentProjectRun = projectRunId
      ? normalizeProjectRuns(latestStateBeforeRun.projectRuns).find((projectRun) => projectRun.id === projectRunId) || null
      : null
    const runningTask = buildRunningTaskSummary({
      menuKey,
      draft,
      taskId,
      taskNumber,
      createdAt,
      inputDirectory,
      outputDirectory
    })

    await persistTaskAndState({
      task: runningTask,
      projectRunsPatch: currentProjectRun
        ? upsertProjectRun(
            latestStateBeforeRun.projectRuns,
            buildStartedProjectRun({
              projectRun: currentProjectRun,
              menuKey,
              startedAt: executionUpdatedAt
            })
          )
        : null,
      activeProjectRunId: currentProjectRun ? currentProjectRun.id : null
    })

    try {
      let latestRunningTask = runningTask
      const executionStartedAt = new Date(getNow()).getTime()
      const preparedDraft = await prepareDraftForExecution({
        menuKey,
        draft,
        inputDirectory,
        outputDirectory
      })
      if (executionController.isStopped()) {
        return
      }
      const handleTaskProgress = async ({ progress, status } = {}) => {
        if (executionController.isStopped()) {
          return
        }

        const normalizedProgress = normalizeTaskProgress(progress, latestRunningTask.progress)
        const cappedProgress = status === 'succeeded'
          ? Math.min(99, normalizedProgress)
          : normalizedProgress

        if (cappedProgress <= latestRunningTask.progress) {
          return
        }

        latestRunningTask = {
          ...latestRunningTask,
          progress: cappedProgress
        }

        await persistTaskAndState({
          task: latestRunningTask
        })
      }
      const resultPayloadOutcome = await Promise.race([
        Promise.resolve(buildResultPayload(menuKey, preparedDraft, taskId, outputDirectory, {
          generateImageResults: generateImageResultsDependency,
          generateCopywritingResults: generateCopywritingResultsDependency,
          generateVideoResults: generateVideoResultsDependency,
          onProgress: handleTaskProgress
        })).then((resultPayload) => ({
          type: 'result',
          resultPayload
        })).catch((error) => ({
          type: 'error',
          error
        })),
        executionController.waitForStop()
      ])

      if (resultPayloadOutcome?.stopped) {
        return
      }

      if (resultPayloadOutcome?.type === 'error') {
        throw resultPayloadOutcome.error
      }

      const resultPayload = resultPayloadOutcome.resultPayload
      if (executionController.isStopped()) {
        return
      }

      const {
        exportItems,
        persistedResultPayload
      } = await saveStudioResults({
        menuKey,
        taskId,
        draft: preparedDraft,
        resultPayload,
        outputDirectory,
        writeFile
      })
      if (executionController.isStopped()) {
        return
      }
      const executionCompletedAt = new Date(getNow()).getTime()
      const enrichedResultPayload = enrichResultPayloadSummary({
        menuKey,
        draft: preparedDraft,
        resultPayload: persistedResultPayload,
        elapsedMilliseconds: executionCompletedAt - executionStartedAt
      })
      const completedTask = buildTaskSummary({
        menuKey,
        draft: preparedDraft,
        taskId,
        taskNumber,
        createdAt,
        inputDirectory,
        outputDirectory,
        resultPayload: enrichedResultPayload
      })
      const latestState = getStoredState()
      const currentProject = preparedDraft.projectId
        ? (
            latestState.productProjects.find((project) => project.id === preparedDraft.projectId) || buildWorkspaceProjectDraft({
              draft: preparedDraft,
              projectId: preparedDraft.projectId,
              createdAt,
              updatedAt: getNow()
            })
          )
        : null
      const currentProjectRunAfterExecution = projectRunId
        ? normalizeProjectRuns(latestState.projectRuns).find((projectRun) => projectRun.id === projectRunId) || null
        : null
      let nextProductProjects = latestState.productProjects
      let nextProjectRuns = latestState.projectRuns

      if (currentProject && menuKey === 'workspace') {
        const projectWithTaskRef = attachTaskRefToProductProject(currentProject, taskId, getNow())
        const projectWithText = applyWorkspaceTextResultsToProject(
          projectWithTaskRef,
          enrichedResultPayload,
          getNow()
        )
        const projectWithImages = applyImageResultsToProject(
          projectWithText,
          enrichedResultPayload,
          getNow()
        )
        nextProductProjects = upsertProductProject(
          latestState.productProjects,
          applyVideoResultsToProject(
            projectWithImages,
            enrichedResultPayload,
            getNow()
          )
        )
      }

      if (currentProject && menuKey === 'title-generator') {
        nextProductProjects = upsertProductProject(
          latestState.productProjects,
          applyTitleResultsToProject(
            attachTaskRefToProductProject(currentProject, taskId, getNow()),
            enrichedResultPayload,
            getNow()
          )
        )
      }

      if (currentProject && menuKey === 'description-generator') {
        nextProductProjects = upsertProductProject(
          latestState.productProjects,
          applyDescriptionResultsToProject(
            attachTaskRefToProductProject(currentProject, taskId, getNow()),
            enrichedResultPayload,
            getNow()
          )
        )
      }

      if (currentProject && menuKey === 'series-generate') {
        nextProductProjects = upsertProductProject(
          latestState.productProjects,
          applyImageResultsToProject(
            attachTaskRefToProductProject(currentProject, taskId, getNow()),
            enrichedResultPayload,
            getNow()
          )
        )
      }

      if (currentProject && menuKey === 'video-generate') {
        nextProductProjects = upsertProductProject(
          latestState.productProjects,
          applyVideoResultsToProject(
            attachTaskRefToProductProject(currentProject, taskId, getNow()),
            enrichedResultPayload,
            getNow()
          )
        )
      }

      if (currentProjectRunAfterExecution) {
        nextProjectRuns = upsertProjectRun(
          latestState.projectRuns,
          buildProjectRunUpdateFromResult({
            projectRun: currentProjectRunAfterExecution,
            menuKey,
            resultPayload: enrichedResultPayload,
            exportItems,
            outputDirectory,
            completedAt: getNow()
          })
        )
      }

      await persistTaskAndState({
        task: completedTask,
        formDraftPatch: {
          [menuKey]: preparedDraft
        },
        resultsByMenuPatch: {
          [menuKey]: enrichedResultPayload
        },
        exportItemsByMenuPatch: {
          [menuKey]: exportItems
        },
        productProjectsPatch: nextProductProjects,
        activeProductProjectId: preparedDraft.projectId || null,
        projectRunsPatch: nextProjectRuns,
        activeProjectRunId: currentProjectRunAfterExecution?.id || null
      })

      const settledCreditState = settleCreditsForTask({
        creditState: settingsService.getSettings().creditState,
        taskId,
        updatedAt: getNow()
      })
      await settingsService.saveSettings({
        creditState: settledCreditState
      })

      await safeRuntimeLog(runtimeLogger, {
        level: 'info',
        event: 'studio-task-succeeded',
        taskId,
        menuKey,
        outputDirectory
      })
    } catch (error) {
      const failedTask = buildFailedTaskSummary({
        menuKey,
        draft,
        taskId,
        taskNumber,
        createdAt,
        inputDirectory,
        outputDirectory,
        errorMessage: error.message
      })
      const latestState = getStoredState()
      const currentProjectRun = projectRunId
        ? normalizeProjectRuns(latestState.projectRuns).find((projectRun) => projectRun.id === projectRunId) || null
        : null

      await persistTaskAndState({
        task: failedTask,
        projectRunsPatch: currentProjectRun
          ? upsertProjectRun(
              latestState.projectRuns,
              buildFailedProjectRun({
                projectRun: currentProjectRun,
                menuKey,
                errorMessage: error.message,
                failedAt: getNow()
              })
            )
          : null,
        activeProjectRunId: currentProjectRun?.id || null
      })

      const refundedCreditState = refundCreditsForTask({
        creditState: settingsService.getSettings().creditState,
        taskId,
        updatedAt: getNow()
      })
      await settingsService.saveSettings({
        creditState: refundedCreditState
      })

      await safeRuntimeLog(runtimeLogger, {
        level: 'error',
        event: 'studio-task-failed',
        taskId,
        menuKey,
        outputDirectory,
        error: error.message
      })
    } finally {
      activeTaskControllers.delete(taskId)
    }
  }

  async function processQueuedTasks() {
    if (isTaskQueueRunning) {
      return taskQueuePromise
    }

    isTaskQueueRunning = true

    try {
      while (queuedTaskExecutions.length) {
        const nextExecution = queuedTaskExecutions.shift()
        await runQueuedTaskExecution(nextExecution)
      }
    } finally {
      isTaskQueueRunning = false
    }
  }

  function enqueueTaskExecution(executionPayload) {
    queuedTaskExecutions.push(executionPayload)

    if (!isTaskQueueRunning) {
      taskQueuePromise = processQueuedTasks()
    }
  }

  async function stopTask({ taskId = '' } = {}) {
    const normalizedTaskId = String(taskId || '').trim()

    if (!normalizedTaskId) {
      throw new Error('任务 ID 不存在')
    }

    const targetTask = getStoredTasks().find((task) => task.id === normalizedTaskId)

    if (!targetTask) {
      throw new Error('未找到可结束的任务')
    }

    if (!['等待中', '进行中', '待确认'].includes(targetTask.status)) {
      throw new Error('只有等待中、进行中或待确认的任务可以结束')
    }

    for (let index = queuedTaskExecutions.length - 1; index >= 0; index -= 1) {
      if (queuedTaskExecutions[index]?.taskId === normalizedTaskId) {
        queuedTaskExecutions.splice(index, 1)
      }
    }

    activeTaskControllers.get(normalizedTaskId)?.stop('用户手动结束任务')

    const stoppedTask = buildStoppedTaskSummary(targetTask, '用户手动结束任务')

    await persistTaskAndState({
      task: stoppedTask
    })

    const refundedCreditState = refundCreditsForTask({
      creditState: settingsService.getSettings().creditState,
      taskId: normalizedTaskId,
      updatedAt: getNow()
    })
    await settingsService.saveSettings({
      creditState: refundedCreditState
    })

    await safeRuntimeLog(runtimeLogger, {
      level: 'warn',
      event: 'studio-task-stopped',
      taskId: normalizedTaskId,
      menuKey: targetTask.menuKey,
      outputDirectory: targetTask.outputDirectory
    })

    return stoppedTask
  }

  function getStoredState() {
    return mergeStudioState(store.get(STUDIO_WORKSPACE_KEY, {}))
  }

  function getStoredTasks(state = getStoredState()) {
    if (taskManagerService && typeof taskManagerService.listTasks === 'function') {
      return sortTasks(taskManagerService.listTasks())
    }

    return sortTasks(state.tasks)
  }

  function saveState(nextState) {
    store.set(STUDIO_WORKSPACE_KEY, nextState)
    return nextState
  }

  async function reconcileOrphanedActiveTasks(tasks = getStoredTasks()) {
    const activeTasks = tasks.filter((task) => ['等待中', '进行中'].includes(task.status))

    if (!activeTasks.length) {
      return []
    }

    const reconciledTasks = []
    for (const task of activeTasks) {
      const isQueuedLocally = queuedTaskExecutions.some((item) => item?.taskId === task.id)
      const hasActiveController = activeTaskControllers.has(task.id)

      if (isQueuedLocally || hasActiveController) {
        continue
      }

      const pendingTask = buildPendingConfirmationTaskSummary(task)
      await persistTaskAndState({
        task: pendingTask
      })
      reconciledTasks.push(pendingTask)
    }

    if (reconciledTasks.length) {
      await safeRuntimeLog(runtimeLogger, {
        level: 'warn',
        scope: 'studio-workspace',
        message: 'Marked orphaned active studio tasks as pending confirmation before runtime cleanup',
        taskIds: reconciledTasks.map((task) => task.id)
      })
    }

    return reconciledTasks
  }

  function getResolvedExportItemsByMenu(state = getStoredState()) {
    const now = getNowMs()
    const shouldReuseCache = !isExportItemsCacheDirty &&
      cachedExportItemsByMenu &&
      now - cachedExportItemsAt <= exportScanCacheTtlMs

    const scannedExportItemsByMenu = shouldReuseCache
      ? cachedExportItemsByMenu
      : scanStoredExportItemsByMenu({
          outputRootDirectory,
          readdirSync,
          statSync
        })

    if (!shouldReuseCache) {
      cachedExportItemsByMenu = scannedExportItemsByMenu
      cachedExportItemsAt = now
      isExportItemsCacheDirty = false
    }

    return mergeExportItemsByMenu({
      scannedExportItemsByMenu,
      storedExportItemsByMenu: state.exportItemsByMenu || {}
    })
  }

  function getSnapshot() {
    const {
      state,
      settings,
      tasks,
      exportItemsByMenu,
      derivedState
    } = buildBaseSnapshot()

    return {
      themeMode: settings.themeMode || 'dark',
      themeOptions,
      menuItems,
      batchOptions,
      imageModelOptions,
      modelPricingCatalog,
      productProjects: state.productProjects,
      activeProductProjectId: state.activeProductProjectId,
      projectRuns: hydrateProjectRunsForDisplay(state.projectRuns),
      activeProjectRunId: state.activeProjectRunId,
      formDrafts: state.formDrafts,
      resultsByMenu: hydrateResultsByMenuForDisplay(state.resultsByMenu),
      exportItemsByMenu,
      tasks,
      agentReadiness: buildAgentReadinessSnapshot(tasks),
      workspaceDashboard: buildWorkspaceDashboard(derivedState, tasks, settings),
      settingsSummary: buildSettingsSummary(settings),
      hostInfo: buildHostInfo()
    }
  }

  async function refreshDashboardCredits({
    target = 'image'
  } = {}) {
    const settings = settingsService.getSettings()
    const currentDashboardCreditState = settings.dashboardCreditState && typeof settings.dashboardCreditState === 'object'
      ? settings.dashboardCreditState
      : {
          text: { balanceCny: 0, lastSyncedAt: '', syncStatus: 'idle' },
          image: { totalCredits: 0, remainingCredits: 0, lastSyncedAt: '', syncStatus: 'idle' },
          video: { balanceCny: 0, lastSyncedAt: '', syncStatus: 'idle' }
        }
    let nextDashboardCreditState = currentDashboardCreditState

    if (target === 'text' || target === 'all') {
      const realtimeTextBalance = deepseekBalanceService && typeof deepseekBalanceService.getRealtimeBalance === 'function'
        ? await deepseekBalanceService.getRealtimeBalance()
        : null

      if (realtimeTextBalance && Number.isFinite(Number(realtimeTextBalance.balanceCny))) {
        nextDashboardCreditState = {
          ...nextDashboardCreditState,
          text: {
            balanceCny: Math.max(0, Number(realtimeTextBalance.balanceCny) || 0),
            lastSyncedAt: realtimeTextBalance.lastSyncedAt || getNow(),
            syncStatus: realtimeTextBalance.syncStatus || 'success'
          }
        }
      }
    }

    if (target === 'image' || target === 'all') {
      const authPlatform = settings.authPlatform && typeof settings.authPlatform === 'object'
        ? settings.authPlatform
        : { enabled: false, sessionToken: '' }
      const shouldUseRemoteWallet = authPlatform.enabled !== false && typeof authPlatform.sessionToken === 'string' && authPlatform.sessionToken.trim()

      if (shouldUseRemoteWallet && remoteLicensePlatformClient && typeof remoteLicensePlatformClient.getWalletSummary === 'function') {
        try {
          const walletSummary = await remoteLicensePlatformClient.getWalletSummary({
            sessionToken: authPlatform.sessionToken
          })
          nextDashboardCreditState = {
            ...nextDashboardCreditState,
            image: {
              totalCredits: Math.max(0, Number(nextDashboardCreditState.image?.totalCredits) || 0),
              remainingCredits: Math.max(0, Number(nextDashboardCreditState.image?.remainingCredits) || 0),
              balanceCny: Math.max(0, Number(walletSummary?.imageBalanceCny) || 0),
              lastSyncedAt: walletSummary?.updatedAt || getNow(),
              syncStatus: 'success'
            },
            video: {
              balanceCny: Math.max(0, Number(walletSummary?.videoBalanceCny) || 0),
              lastSyncedAt: walletSummary?.updatedAt || getNow(),
              syncStatus: 'success'
            }
          }
        } catch {
          nextDashboardCreditState = {
            ...nextDashboardCreditState,
            image: {
              ...nextDashboardCreditState.image,
              syncStatus: 'remote-failed'
            },
            video: {
              ...nextDashboardCreditState.video,
              syncStatus: 'remote-failed'
            }
          }
        }
      }

      const realtimeCredits = apiKeyCreditService && typeof apiKeyCreditService.getRealtimeCredits === 'function'
        ? await apiKeyCreditService.getRealtimeCredits()
        : null

      if (realtimeCredits && Number.isFinite(Number(realtimeCredits.remainingCredits))) {
        const fetchedCredits = Math.max(0, Math.round(Number(realtimeCredits.remainingCredits)))
        nextDashboardCreditState = {
          ...nextDashboardCreditState,
          image: target === 'total'
            ? {
                totalCredits: fetchedCredits,
                remainingCredits: Math.min(
                  Math.max(0, Number(nextDashboardCreditState.image?.remainingCredits) || 0),
                  fetchedCredits
                ),
                balanceCny: Math.max(0, Number(nextDashboardCreditState.image?.balanceCny) || 0),
                lastSyncedAt: realtimeCredits.lastSyncedAt || getNow(),
                syncStatus: realtimeCredits.syncStatus || 'success'
              }
            : {
                totalCredits: Math.max(0, Number(nextDashboardCreditState.image?.totalCredits) || 0),
                remainingCredits: fetchedCredits,
                balanceCny: Math.max(0, Number(nextDashboardCreditState.image?.balanceCny) || 0),
                lastSyncedAt: realtimeCredits.lastSyncedAt || getNow(),
                syncStatus: realtimeCredits.syncStatus || 'success'
              }
        }
      }
    }

    if (nextDashboardCreditState === currentDashboardCreditState) {
      return currentDashboardCreditState
    }

    await settingsService.saveSettings({
      dashboardCreditState: nextDashboardCreditState
    })

    return nextDashboardCreditState
  }

  async function syncCreditStateWithRealtimeBalance() {
    const settings = settingsService.getSettings()
    const currentDashboardCreditState = settings.dashboardCreditState && typeof settings.dashboardCreditState === 'object'
      ? settings.dashboardCreditState
      : {
          text: { balanceCny: 0, lastSyncedAt: '', syncStatus: 'idle' },
          image: { totalCredits: 0, remainingCredits: 0, lastSyncedAt: '', syncStatus: 'idle' },
          video: { balanceCny: 0, lastSyncedAt: '', syncStatus: 'idle' }
        }
    const currentCreditState = normalizeCreditStateForDisplay(settings.creditState)
    const realtimeCredits = apiKeyCreditService && typeof apiKeyCreditService.getRealtimeCredits === 'function'
      ? await apiKeyCreditService.getRealtimeCredits()
      : null

    let nextDashboardCreditState = currentDashboardCreditState
    let resolvedRemainingCredits = null

    if (realtimeCredits && Number.isFinite(Number(realtimeCredits.remainingCredits))) {
      resolvedRemainingCredits = Math.max(0, Math.round(Number(realtimeCredits.remainingCredits)))
      nextDashboardCreditState = {
        ...currentDashboardCreditState,
        image: {
          totalCredits: Math.max(0, Number(currentDashboardCreditState.image?.totalCredits) || 0),
          remainingCredits: resolvedRemainingCredits,
          lastSyncedAt: realtimeCredits.lastSyncedAt || getNow(),
          syncStatus: realtimeCredits.syncStatus || 'success'
        }
      }
    } else if (Number.isFinite(Number(currentDashboardCreditState.image?.remainingCredits)) && Number(currentDashboardCreditState.image?.remainingCredits) > 0) {
      resolvedRemainingCredits = Math.max(0, Math.round(Number(currentDashboardCreditState.image?.remainingCredits)))
    }

    if (resolvedRemainingCredits === null) {
      return {
        synced: false,
        creditState: currentCreditState,
        dashboardCreditState: currentDashboardCreditState
      }
    }

    const nextCreditState = normalizeCreditStateForDisplay({
      ...currentCreditState,
      remainingCredits: Math.max(0, resolvedRemainingCredits - currentCreditState.frozenCredits)
    })

    await settingsService.saveSettings({
      dashboardCreditState: nextDashboardCreditState,
      creditState: nextCreditState
    })

    return {
      synced: true,
      creditState: nextCreditState,
      dashboardCreditState: nextDashboardCreditState
    }
  }

  async function getDisplaySnapshot() {
    await refreshDashboardCredits({
      target: 'all'
    })
    const {
      state,
      settings,
      tasks,
      exportItemsByMenu,
      derivedState
    } = buildBaseSnapshot()

    return {
      themeMode: settings.themeMode || 'dark',
      themeOptions,
      menuItems,
      batchOptions,
      imageModelOptions,
      modelPricingCatalog,
      productProjects: state.productProjects,
      activeProductProjectId: state.activeProductProjectId,
      projectRuns: state.projectRuns,
      activeProjectRunId: state.activeProjectRunId,
      formDrafts: state.formDrafts,
      resultsByMenu: hydrateResultsByMenuForDisplay(state.resultsByMenu),
      exportItemsByMenu,
      tasks,
      agentReadiness: buildAgentReadinessSnapshot(tasks),
      workspaceDashboard: buildWorkspaceDashboard(derivedState, tasks, settings),
      settingsSummary: buildSettingsSummary(settings),
      hostInfo: buildHostInfo()
    }
  }

  function getRuntimeSnapshot() {
    const {
      state,
      tasks,
      exportItemsByMenu
    } = buildBaseSnapshot()

    return {
      productProjects: state.productProjects,
      activeProductProjectId: state.activeProductProjectId,
      projectRuns: hydrateProjectRunsForDisplay(state.projectRuns),
      activeProjectRunId: state.activeProjectRunId,
      formDrafts: state.formDrafts,
      resultsByMenu: hydrateResultsByMenuForDisplay(state.resultsByMenu),
      exportItemsByMenu,
      tasks,
      agentReadiness: buildAgentReadinessSnapshot(tasks)
    }
  }

  async function saveDraft({ menuKey = 'workspace', patch = {} } = {}) {
    const state = getStoredState()
    const nextDraft = normalizeDraftForMenu(menuKey, {
      ...(state.formDrafts[menuKey] || createDefaultDrafts()[menuKey] || {}),
      ...patch
    })

    saveState({
      ...state,
      formDrafts: {
        ...state.formDrafts,
        [menuKey]: nextDraft
      }
    })

    return nextDraft
  }

  async function createProject({
    productName = '',
    platform = 'temu',
    language = 'zh-CN'
  } = {}) {
    const state = getStoredState()
    const createdAt = getNow()
    const createdProject = buildEmptyProductProject({
      projectId: `project-${createId()}`,
      productName,
      platform,
      language,
      createdAt
    })

    const nextProjects = [
      createdProject,
      ...normalizeProductProjects(state.productProjects)
    ]

    saveState({
      ...state,
      productProjects: nextProjects,
      activeProductProjectId: createdProject.id
    })

    return createdProject
  }

  async function createProjectsFromAssets({
    files = [],
    platform = 'temu',
    language = 'zh-CN'
  } = {}) {
    const normalizedFiles = Array.isArray(files) ? files.map((item) => normalizeImageAsset(item)).filter(Boolean) : []

    if (!normalizedFiles.length) {
      return {
        createdProjects: [],
        activeProductProjectId: ''
      }
    }

    const state = getStoredState()
    const createdAt = getNow()
    const createdProjects = normalizedFiles.map((asset, index) => {
      return buildProjectCardFromAsset({
        asset,
        projectId: `project-${createId()}-${index + 1}`,
        createdAt,
        platform,
        language
      })
    })

    const nextProjects = [
      ...createdProjects,
      ...normalizeProductProjects(state.productProjects)
    ]

    saveState({
      ...state,
      productProjects: nextProjects,
      activeProductProjectId: createdProjects[0]?.id || state.activeProductProjectId
    })

    return {
      createdProjects,
      activeProductProjectId: createdProjects[0]?.id || ''
    }
  }

  async function updateProject({
    projectId = '',
    patch = {}
  } = {}) {
    const normalizedProjectId = String(projectId || '').trim()
    if (!normalizedProjectId) {
      throw new Error('商品项目 ID 不能为空')
    }

    const state = getStoredState()
    const existingProject = normalizeProductProjects(state.productProjects).find((item) => item.id === normalizedProjectId)
    if (!existingProject) {
      throw new Error('未找到需要更新的商品项目')
    }

    const nextProject = updateProductProjectFields(existingProject, patch, getNow())
    const nextProjects = upsertProductProject(state.productProjects, nextProject)

    saveState({
      ...state,
      productProjects: nextProjects,
      activeProductProjectId: normalizedProjectId
    })

    return nextProject
  }

  async function deleteProject({
    projectId = ''
  } = {}) {
    const normalizedProjectId = String(projectId || '').trim()
    if (!normalizedProjectId) {
      throw new Error('商品项目 ID 不能为空')
    }

    const state = getStoredState()
    const nextProjects = normalizeProductProjects(state.productProjects).filter((item) => item.id !== normalizedProjectId)
    const nextActiveProductProjectId = resolveActiveProductProjectId(nextProjects, state.activeProductProjectId === normalizedProjectId ? '' : state.activeProductProjectId)

    saveState({
      ...state,
      productProjects: nextProjects,
      activeProductProjectId: nextActiveProductProjectId
    })

    return {
      deleted: true,
      projectId: normalizedProjectId
    }
  }

  async function createTask({ menuKey = 'workspace', draft: incomingDraft } = {}) {
    const state = getStoredState()
    let settings = settingsService.getSettings()
    const taskId = createId()
    const projectRunId = `run-${createId()}`
    const taskNumber = createTaskNumber()
    let draft = normalizeDraftForMenu(menuKey, {
      ...(state.formDrafts[menuKey] || createDefaultDrafts()[menuKey] || {}),
      ...(incomingDraft || {})
    })
    let nextProductProjects = state.productProjects
    let nextActiveProductProjectId = state.activeProductProjectId
    let nextProjectRuns = state.projectRuns
    let nextActiveProjectRunId = state.activeProjectRunId
    let currentProjectForRun = null
    const createdAt = formatDisplayDateTime(getNow())
    const {
      inputDirectory,
      outputDirectory
    } = getTaskDataDirectories({
      featureKey: menuKey,
      taskId
    })

    if (menuKey === 'workspace') {
      const existingProject = state.productProjects.find((project) => {
        return project.id === draft.projectId || project.id === state.activeProductProjectId
      }) || null
      const projectId = draft.projectId || existingProject?.id || `project-${createId()}`
      const updatedProject = attachTaskRefToProductProject(
        buildWorkspaceProjectDraft({
          currentProject: existingProject,
          draft,
          projectId,
          createdAt: existingProject?.createdAt || getNow(),
          updatedAt: getNow()
        }),
        taskId,
        getNow()
      )
      currentProjectForRun = updatedProject
      nextProductProjects = upsertProductProject(
        state.productProjects,
        attachProjectRunToProject(updatedProject, projectRunId, getNow())
      )
      nextActiveProductProjectId = projectId
      draft = {
        ...draft,
        projectId,
        projectName: updatedProject.name
      }
    } else if (draft.projectId) {
      const existingProject = normalizeProductProjects(state.productProjects).find((project) => project.id === draft.projectId) || null
      if (existingProject) {
        currentProjectForRun = attachTaskRefToProductProject(existingProject, taskId, getNow())
        nextProductProjects = upsertProductProject(
          state.productProjects,
          attachProjectRunToProject(currentProjectForRun, projectRunId, getNow())
        )
        nextActiveProductProjectId = existingProject.id
      }
    }

    if (draft.projectId && currentProjectForRun) {
      const runDirectory = path.resolve(outputDirectory)
      const createdProjectRun = buildProjectRunRecord({
        runId: projectRunId,
        projectId: draft.projectId,
        menuKey,
        draft,
        currentProject: currentProjectForRun,
        taskId,
        taskNumber,
        createdAt,
        runDirectory
      })

      nextProjectRuns = upsertProjectRun(state.projectRuns, createdProjectRun)
      nextActiveProjectRunId = createdProjectRun.id
    }

    validateTaskScale(menuKey, draft)
    const estimatedCredits = estimateTaskCredits(menuKey, draft)
    const queuedTask = buildQueuedTaskSummary({
      menuKey,
      draft,
      taskId,
      taskNumber,
      createdAt,
      inputDirectory,
      outputDirectory
    })

    if (estimatedCredits > 0) {
      const creditSyncResult = await syncCreditStateWithRealtimeBalance()
      if (creditSyncResult.synced) {
        settings = settingsService.getSettings()
      }

      const frozenCreditState = freezeCreditsForTask({
        creditState: settings.creditState,
        taskId,
        taskNumber,
        menuKey,
        draft,
        estimatedCredits,
        createdAt
      })

      await settingsService.saveSettings({
        creditState: frozenCreditState
      })
    }

    try {
      await persistTaskAndState({
        task: queuedTask,
        formDraftPatch: {
          [menuKey]: draft
        },
        resultsByMenuPatch: {
          [menuKey]: createDefaultResultsByMenu()[menuKey]
        },
        exportItemsByMenuPatch: {
          [menuKey]: []
        },
        productProjectsPatch: nextProductProjects,
        activeProductProjectId: nextActiveProductProjectId,
        projectRunsPatch: nextProjectRuns,
        activeProjectRunId: nextActiveProjectRunId
      })

      enqueueTaskExecution({
        menuKey,
        draft,
        taskId,
        taskNumber,
        createdAt,
        inputDirectory,
        outputDirectory,
        projectRunId: draft.projectId && currentProjectForRun ? projectRunId : ''
      })

      return queuedTask
    } catch (error) {
      if (estimatedCredits > 0) {
        const refundedCreditState = refundCreditsForTask({
          creditState: settingsService.getSettings().creditState,
          taskId,
          updatedAt: getNow()
        })
        await settingsService.saveSettings({
          creditState: refundedCreditState
        })
      }

      throw error
    }
  }

  async function exportProjectBundle({
    projectId = '',
    targetZipPath = ''
  } = {}) {
    const normalizedProjectId = String(projectId || '').trim()
    if (!normalizedProjectId) {
      throw new Error('商品项目 ID 不能为空')
    }

    if (!targetZipPath) {
      throw new Error('导出压缩包路径不能为空')
    }

    const state = getStoredState()
    const project = normalizeProductProjects(state.productProjects).find((item) => item.id === normalizedProjectId)

    if (!project) {
      throw new Error('未找到可导出的商品项目')
    }

    const stagingDirectory = await mkdtemp(path.join(os.tmpdir(), 'qiuai-project-export-'))
    const projectDirectory = path.resolve(stagingDirectory, sanitizePathSegment(project.name || 'product-project', 'product-project'))

    try {
      await ensureDirectoryDependency(projectDirectory)

      const titleText = project.content?.selectedTitle || (project.content?.titleCandidates || []).join('\n')
      const descriptionText = project.content?.selectedDescription || (project.content?.descriptionCandidates || []).join('\n')

      await writeFile(path.resolve(projectDirectory, 'title.txt'), `${String(titleText || '')}\n`, 'utf8')
      await writeFile(path.resolve(projectDirectory, 'description.txt'), `${String(descriptionText || '')}\n`, 'utf8')

      if (Array.isArray(project.assets?.generatedImages) && project.assets.generatedImages.length) {
        const imagesDirectory = path.resolve(projectDirectory, 'images')
        await ensureDirectoryDependency(imagesDirectory)

        for (const [index, image] of project.assets.generatedImages.entries()) {
          const sourcePath = image.savedPath || image.path || image.storedPath || ''
          if (!sourcePath) {
            continue
          }

          await copyFile(
            sourcePath,
            path.resolve(imagesDirectory, `${String(index + 1).padStart(2, '0')}-${path.basename(sourcePath)}`)
          )
        }
      }

      if (project.assets?.generatedVideo?.savedPath) {
        const videoPath = project.assets.generatedVideo.savedPath
        await copyFile(videoPath, path.resolve(projectDirectory, path.basename(videoPath)))
      }

      const exportedArchive = await exportTaskDirectoryDependency({
        sourceDirectory: projectDirectory,
        targetZipPath
      })

      return {
        canceled: false,
        projectId: normalizedProjectId,
        targetZipPath: exportedArchive.targetZipPath
      }
    } finally {
      await removeDirectory(stagingDirectory).catch(() => {})
    }
  }

  async function clearRuntimeState() {
    await reconcileOrphanedActiveTasks()

    const state = getStoredState()
    const tasks = getStoredTasks(state)
    const hasActiveTasks = tasks.some((task) => ['等待中', '进行中'].includes(task.status))

    if (hasActiveTasks) {
      throw new Error('当前存在进行中的任务，暂不能一键清理')
    }

    saveState({
      ...state,
      formDrafts: createDefaultDrafts(),
      resultsByMenu: createDefaultResultsByMenu(),
      exportItemsByMenu: createDefaultExportItemsByMenu(),
      requestMetrics: createDefaultRequestMetrics()
    })
    invalidateExportItemsCache()

    await safeRuntimeLog(runtimeLogger, {
      level: 'info',
      scope: 'studio-workspace',
      message: 'Cleared runtime studio state while preserving exports and settings'
    })

    return {
      cleared: true
    }
  }

  async function deleteExportItem({
    menuKey = 'workspace',
    exportItemId = ''
  } = {}) {
    if (!exportItemId) {
      throw new Error('导出结果编号不能为空')
    }

    const state = getStoredState()
    const exportItems = getResolvedExportItemsByMenu(state)[menuKey] || []
    const exportItem = exportItems.find((item) => item.id === exportItemId)

    if (!exportItem) {
      throw new Error('未找到对应的导出结果')
    }

    const candidateDirectory = exportItem.directoryPath ||
      exportItem.outputDirectory ||
      (exportItem.savedPath ? path.dirname(exportItem.savedPath) : '')

    if (!candidateDirectory) {
      throw new Error('未找到可删除的结果目录')
    }

    if (!isPathInsideDirectory(candidateDirectory, outputRootDirectory)) {
      throw new Error('结果目录不在允许删除的输出目录范围内')
    }

    await removeDirectory(candidateDirectory)

    const storedExportItems = state.exportItemsByMenu[menuKey] || []

    saveState({
      ...state,
      exportItemsByMenu: {
        ...state.exportItemsByMenu,
        [menuKey]: storedExportItems.filter((item) => {
          const itemDirectory = item.directoryPath || item.outputDirectory || (item.savedPath ? path.dirname(item.savedPath) : '')
          return item.id !== exportItemId && itemDirectory !== candidateDirectory
        })
      }
    })
    invalidateExportItemsCache()

    await safeRuntimeLog(runtimeLogger, {
      level: 'info',
      scope: 'studio-workspace',
      message: 'Deleted stored studio export item',
      details: {
        menuKey,
        exportItemId,
        targetDirectory: candidateDirectory
      }
    })

    return {
      menuKey,
      exportItemId,
      deleted: true
    }
  }

  async function exportSelectedResults({
    menuKey = 'workspace',
    selectedExportIds = [],
    targetZipPath = ''
  } = {}) {
    if (!targetZipPath) {
      throw new Error('导出压缩包路径不能为空')
    }

    const normalizedSelectedIds = Array.isArray(selectedExportIds)
      ? selectedExportIds.filter(Boolean)
      : []

    if (!normalizedSelectedIds.length) {
      throw new Error('请选择至少一个导出结果')
    }

    const state = getStoredState()
    const exportItems = getResolvedExportItemsByMenu(state)[menuKey] || []
    const selectedIdSet = new Set(normalizedSelectedIds)
    const selectedItems = exportItems.filter((item) => selectedIdSet.has(item.id))

    if (!selectedItems.length) {
      throw new Error('未找到已选中的导出结果')
    }

    const estimatedRequiredBytes = estimateExportRequiredBytes(selectedItems)
    const targetDiskFreeBytes = await getAvailableDiskSpaceBytesDependency(path.dirname(targetZipPath))
    const tempDiskFreeBytes = await getAvailableDiskSpaceBytesDependency(os.tmpdir())
    const minimumFreeBytes = estimatedRequiredBytes * EXPORT_FREE_SPACE_MULTIPLIER

    if (targetDiskFreeBytes < minimumFreeBytes || tempDiskFreeBytes < minimumFreeBytes) {
      throw new Error('导出空间不足，请清理磁盘后重试')
    }

    const stagingDirectory = await mkdtemp(path.join(os.tmpdir(), 'qiuai-studio-export-'))

    try {
      for (const [index, item] of selectedItems.entries()) {
        const sourceDirectory = item.directoryPath || item.outputDirectory || ''
        if (sourceDirectory) {
          const targetDirectory = path.resolve(
            stagingDirectory,
            `${String(index).padStart(2, '0')}-${sanitizePathSegment(item.name || item.groupTitle || 'result-group', 'result-group')}`
          )
          await copyDirectory(sourceDirectory, targetDirectory)
          continue
        }

        const sourcePath = item.savedPath || ''
        if (!sourcePath) {
          throw new Error(`结果文件缺失：${item.name || item.id}`)
        }

        const groupDirectory = path.resolve(stagingDirectory, sanitizePathSegment(item.groupTitle || menuLabelMap[menuKey] || 'result-group', 'result-group'))
        const targetFilePath = path.resolve(groupDirectory, `${String(index + 1).padStart(2, '0')}-${path.basename(sourcePath)}`)
        await ensureDirectoryDependency(groupDirectory)
        await copyFile(sourcePath, targetFilePath)
      }

      const exportedArchive = await exportTaskDirectoryDependency({
        sourceDirectory: stagingDirectory,
        targetZipPath
      })

      return {
        menuKey,
        exportedCount: selectedItems.length,
        targetZipPath: exportedArchive.targetZipPath
      }
    } finally {
      await removeDirectory(stagingDirectory).catch(() => {})
    }
  }

  return {
    getSnapshot,
    getDisplaySnapshot,
    getRuntimeSnapshot,
    createProject,
    createProjectsFromAssets,
    updateProject,
    deleteProject,
    refreshDashboardCredits,
    saveDraft,
    createTask,
    stopTask,
    clearRuntimeState,
    deleteExportItem,
    exportSelectedResults,
    exportProjectBundle,
    waitForIdle: async () => {
      await taskQueuePromise
    }
  }
}

module.exports = {
  STUDIO_WORKSPACE_KEY,
  themeOptions,
  menuItems,
  batchOptions,
  imageModelOptions,
  modelPricingCatalog,
  createStudioWorkspaceService
}

