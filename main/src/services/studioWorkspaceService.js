const fs = require('node:fs/promises')
const fsSync = require('node:fs')
const path = require('node:path')
const crypto = require('node:crypto')
const axios = require('axios')
const studioMenuConfig = require('../../../shared/studio-menu-config.json')
const { createWorkspaceExportService } = require('./workspaceExportService')
const { getAvailableDiskSpaceBytes } = require('./workspaceExportService')
const { createWorkspaceCreditService } = require('./workspaceCreditService')
const { createWorkspaceProductProjectService } = require('./workspaceProductProjectService')
const { createWorkspaceProjectRunService } = require('./workspaceProjectRunService')
const { createWorkspaceSnapshotService } = require('./workspaceSnapshotService')
const { createWorkspaceStateMaintenanceService } = require('./workspaceStateMaintenanceService')
const { createWorkspaceTaskLifecycleService } = require('./workspaceTaskLifecycleService')
const { createWorkspaceTaskExecutionService } = require('./workspaceTaskExecutionService')
const { exportTaskDirectory: defaultExportTaskDirectory } = require('./taskExportService')
const { MAX_SERIES_GENERATE_GROUP_SIZE } = require('./studioGenerationConstants')
const {
  ensureDirectory,
  getTaskDataDirectories,
  INPUT_ROOT_DIRECTORY,
  OUTPUT_ROOT_DIRECTORY,
  getFeatureDirectoryKey
} = require('./dataPathsService')
const { persistSourceFiles } = require('./inputAssetStorageService')
const { ensureDraftWithinCapability, getActiveCapabilityConfig } = require('./packageCapabilityService')
const { createLocalMediaPreviewUrl } = require('./localMediaPreviewService')
const { resolveCompatibleLocalPath } = require('./pathMigrationService')

const STUDIO_WORKSPACE_KEY = 'studioWorkspace'

function createMissingGenerationDependencyError(capabilityName = '') {
  const error = new Error(`${capabilityName} generation dependency is required for the current desktop runtime.`)
  error.code = 'MISSING_GENERATION_DEPENDENCY'
  return error
}

function createMissingGenerationDependency(capabilityName = '') {
  return async () => {
    throw createMissingGenerationDependencyError(capabilityName)
  }
}

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

const primaryMenuItems = Array.isArray(studioMenuConfig.primaryMenuItems)
  ? studioMenuConfig.primaryMenuItems
  : []
const runtimeStateMenuItems = Array.isArray(studioMenuConfig.runtimeTaskMenuItems)
  ? studioMenuConfig.runtimeTaskMenuItems
  : primaryMenuItems.filter((item) => {
      return Array.isArray(studioMenuConfig.runtimeTaskMenuKeys) &&
        studioMenuConfig.runtimeTaskMenuKeys.includes(item.key)
    })
const runtimeStateMenuKeySet = new Set(runtimeStateMenuItems.map((item) => item.key))

const imageModelOptions = [
  { label: 'gpt-image-2', value: 'gpt-image-2' },
  { label: 'nano-banana-fast', value: 'nano-banana-fast' },
  { label: 'nano-banana-2', value: 'nano-banana-2' }
]

const videoModelOptions = [
  { label: 'MiniMax-Hailuo-2.3-Fast', value: 'MiniMax-Hailuo-2.3-Fast' }
]

const batchOptions = [
  { label: '单批 4 个结果', value: 'batch-4' },
  { label: '单批 8 个结果', value: 'batch-8' },
  { label: '单批 12 个结果', value: 'batch-12' }
]

const menuItems = primaryMenuItems
const menuLabelMap = Object.fromEntries(runtimeStateMenuItems.map((item) => [item.key, item.label]))
const taskCategoryMap = {
  workspace: '工作台',
  'title-generate': '标题生成',
  'description-generate': '描述生成',
  'series-generate': '套图生成',
  'video-generate': '视频生成'
}
const taskMenuMapByCategory = {
  工作台: 'workspace',
  '套图生成': 'series-generate'
}
const workspaceStepOptionsLabelMap = {
  title: '标题',
  description: '描述',
  image: '套图',
  video: '视频'
}
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
const workspaceDashboardSections = [
  { cardKey: 'seriesGenerateStats', menuKey: 'series-generate', title: '套图生成统计' }
]

const publicSnapshotMenuItems = primaryMenuItems
const runtimeStateMenuLabelMap = Object.fromEntries(runtimeStateMenuItems.map((item) => [item.key, item.label]))
const publicSnapshotTaskMenuMapByCategory = taskMenuMapByCategory
const publicWorkspaceDashboardSections = workspaceDashboardSections

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

function resolveTextModelForMenu() {
  return 'deepseek-chat'
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

function normalizeLocalRuntimePath(value = '') {
  const normalizedValue = typeof value === 'string' ? value.trim() : ''
  return normalizedValue ? resolveCompatibleLocalPath(normalizedValue) : ''
}

function normalizeImageAsset(item = {}) {
  if (!item || !item.name) {
    return null
  }

  return {
    id: item.id || '',
    name: item.name,
    path: normalizeLocalRuntimePath(item.path || item.storedPath || ''),
    preview: item.preview || '',
    sizeLabel: item.sizeLabel || '',
    storedPath: normalizeLocalRuntimePath(item.storedPath || item.path || '')
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

function normalizeSeriesSourceItems(seriesSourceItems = [], promptAssignments = [], fallbackSize = '1:1') {
  const sourceItems = Array.isArray(seriesSourceItems) ? seriesSourceItems : []
  const assignments = Array.isArray(promptAssignments) ? promptAssignments : []

  return sourceItems
    .map((item, index) => {
      const sourceImage = normalizeImageAsset(item?.sourceImage || item?.image || item)
      if (!sourceImage) {
        return null
      }

      const assignment = assignments[index] || {}
      return {
        id: String(item?.id || sourceImage.id || `series-source-${index + 1}`),
        sourceImage,
        templateId: String(item?.templateId || assignment.templateId || '').trim() || DEFAULT_EMPTY_PROMPT_TEMPLATE_ID,
        prompt: String(item?.prompt || assignment.prompt || '').trim(),
        size: String(item?.size || fallbackSize || '1:1').trim() || '1:1',
        imageType: String(item?.imageType || assignment.imageType || '').trim(),
        differenceLevel: ['off', 'low', 'medium', 'high'].includes(item?.differenceLevel)
          ? item.differenceLevel
          : (['off', 'low', 'medium', 'high'].includes(assignment?.differenceLevel) ? assignment.differenceLevel : 'off')
      }
    })
    .filter(Boolean)
}

function normalizeDraftForMenu(menuKey, draft = {}) {
  const defaultDraft = createDefaultDrafts()[menuKey] || {}
  if (!runtimeStateMenuKeySet.has(menuKey)) {
    return {}
  }

  if (menuKey === 'workspace') {
    const workspaceGenerateCount = Math.max(
      1,
      Math.min(MAX_SERIES_GENERATE_GROUP_SIZE, Number(draft.generateCount) || defaultDraft.generateCount || 4)
    )

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
      sourceImage: normalizeImageAsset(draft.sourceImage) || defaultDraft.sourceImage,
      enabledSteps: normalizeProjectEnabledSteps(draft.enabledSteps || defaultDraft.enabledSteps),
      titlePrompt: String(draft.titlePrompt || defaultDraft.titlePrompt || ''),
      descriptionPrompt: String(draft.descriptionPrompt || defaultDraft.descriptionPrompt || ''),
      imagePrompt: String(draft.imagePrompt || defaultDraft.imagePrompt || ''),
      videoPrompt: String(draft.videoPrompt || defaultDraft.videoPrompt || ''),
      imageModel: String(draft.imageModel || defaultDraft.imageModel || resolveDefaultModelForMenu('series-generate')),
      videoModel: String(draft.videoModel || defaultDraft.videoModel || 'MiniMax-Hailuo-2.3-Fast'),
      imageTemplateId: String(draft.imageTemplateId || defaultDraft.imageTemplateId || DEFAULT_EMPTY_PROMPT_TEMPLATE_ID),
      videoTemplateId: String(draft.videoTemplateId || defaultDraft.videoTemplateId || 'video-main'),
      titleMaxChars: Math.max(1, Number(draft.titleMaxChars) || defaultDraft.titleMaxChars || 60),
      descriptionMaxChars: Math.max(1, Number(draft.descriptionMaxChars) || defaultDraft.descriptionMaxChars || 300),
      titleQuantity: Math.max(1, Number(draft.titleQuantity) || defaultDraft.titleQuantity || 3),
      descriptionQuantity: Math.max(1, Number(draft.descriptionQuantity) || defaultDraft.descriptionQuantity || 2),
      generateCount: workspaceGenerateCount,
      promptAssignments: normalizePromptAssignments(draft.promptAssignments, workspaceGenerateCount),
      size: String(draft.size || defaultDraft.size || '1:1').trim() || '1:1',
      duration: String(draft.duration || defaultDraft.duration || '6s').trim() || '6s',
      resolution: String(draft.resolution || defaultDraft.resolution || '768P').trim() || '768P',
      aspectRatio: String(draft.aspectRatio || defaultDraft.aspectRatio || resolveVideoAspectRatioForMenu()).trim() || resolveVideoAspectRatioForMenu(),
      motionStrength: String(draft.motionStrength || defaultDraft.motionStrength || 'auto').trim() || 'auto',
      model: String(draft.model || defaultDraft.model || resolveTextModelForMenu())
    }
  }

  if (menuKey === 'title-generate') {
    return {
      ...defaultDraft,
      ...draft,
      taskName: String(draft.taskName || defaultDraft.taskName || ''),
      productName: String(draft.productName || defaultDraft.productName || ''),
      platformTargetsText: String(draft.platformTargetsText || defaultDraft.platformTargetsText || ''),
      language: String(draft.language || defaultDraft.language || 'zh-CN'),
      titlePrompt: String(draft.titlePrompt || defaultDraft.titlePrompt || ''),
      titleMaxChars: Math.max(1, Number(draft.titleMaxChars) || defaultDraft.titleMaxChars || 60),
      titleQuantity: Math.max(1, Number(draft.titleQuantity) || defaultDraft.titleQuantity || 3),
      taskKind: 'title',
      model: String(draft.model || defaultDraft.model || resolveTextModelForMenu())
    }
  }

  if (menuKey === 'description-generate') {
    return {
      ...defaultDraft,
      ...draft,
      taskName: String(draft.taskName || defaultDraft.taskName || ''),
      productName: String(draft.productName || defaultDraft.productName || ''),
      platformTargetsText: String(draft.platformTargetsText || defaultDraft.platformTargetsText || ''),
      language: String(draft.language || defaultDraft.language || 'zh-CN'),
      descriptionPrompt: String(draft.descriptionPrompt || defaultDraft.descriptionPrompt || ''),
      descriptionMaxChars: Math.max(1, Number(draft.descriptionMaxChars) || defaultDraft.descriptionMaxChars || 300),
      descriptionQuantity: Math.max(1, Number(draft.descriptionQuantity) || defaultDraft.descriptionQuantity || 2),
      taskKind: 'description',
      model: String(draft.model || defaultDraft.model || resolveTextModelForMenu())
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
    const normalizedSourceItems = normalizeSeriesSourceItems(
      draft.seriesSourceItems,
      normalizedAssignments,
      draft.size || defaultDraft.size
    )
    const fallbackSourceImage = normalizeImageAsset(draft.sourceImage) || normalizedSourceItems[0]?.sourceImage || defaultDraft.sourceImage

    return {
      ...defaultDraft,
      ...draft,
      model: nextModel,
      taskName: String(draft.taskName || defaultDraft.taskName || ''),
      productName: String(draft.productName || defaultDraft.productName || ''),
      sourceImage: fallbackSourceImage,
      prompt: migratedPrompt,
      imageTemplateId: String(draft.imageTemplateId || defaultDraft.imageTemplateId || ''),
      imageType: migratedImageType,
      generateCount: Math.max(1, normalizedSourceItems.length || generateCount),
      batchCount: Math.max(1, Number(draft.batchCount) || defaultDraft.batchCount || 1),
      size: draft.size || defaultDraft.size,
      promptAssignments: normalizedAssignments.slice(0, Math.max(1, normalizedSourceItems.length || generateCount)),
      seriesSourceItems: normalizedSourceItems
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
  return createLocalMediaPreviewUrl(savedPath)
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

function trimString(value = '') {
  return typeof value === 'string' ? value.trim() : ''
}

function normalizeBaseUrl(baseUrl = '') {
  return trimString(baseUrl).replace(/\/+$/, '')
}

function isAbsoluteHttpUrl(value = '') {
  return /^https?:\/\//i.test(trimString(value))
}

function buildDataUrlFromBuffer(buffer, mimeType = 'image/png') {
  if (!Buffer.isBuffer(buffer) || !buffer.length) {
    return ''
  }

  return `data:${mimeType};base64,${buffer.toString('base64')}`
}

function inferMimeTypeFromUrl(url = '') {
  const normalizedUrl = trimString(url).toLowerCase()
  if (normalizedUrl.endsWith('.jpg') || normalizedUrl.endsWith('.jpeg')) {
    return 'image/jpeg'
  }
  if (normalizedUrl.endsWith('.webp')) {
    return 'image/webp'
  }
  return 'image/png'
}

function inferImageExtension({ contentType = '', url = '' } = {}) {
  const normalizedContentType = trimString(contentType).toLowerCase()
  if (normalizedContentType.includes('image/jpeg')) {
    return '.jpg'
  }
  if (normalizedContentType.includes('image/webp')) {
    return '.webp'
  }
  if (normalizedContentType.includes('image/png')) {
    return '.png'
  }

  const normalizedUrl = trimString(url).toLowerCase()
  if (normalizedUrl.endsWith('.jpg') || normalizedUrl.endsWith('.jpeg')) {
    return '.jpg'
  }
  if (normalizedUrl.endsWith('.webp')) {
    return '.webp'
  }
  return '.png'
}

function formatAssetSizeLabel(size = 0) {
  const numericSize = Number(size) || 0
  if (numericSize <= 0) {
    return ''
  }

  if (numericSize >= 1024 * 1024) {
    return `${(numericSize / (1024 * 1024)).toFixed(1)} MB`
  }

  return `${Math.max(1, Math.round(numericSize / 1024))} KB`
}

function hydrateProjectRunsForDisplay(projectRuns = []) {
  return normalizeProjectRuns(projectRuns).map((projectRun) => hydrateProjectRunForDisplay(projectRun))
}

function hydrateProductProjectForDisplay(project = {}) {
  const normalizedProject = normalizeProductProject(project)
  const assets = normalizedProject.assets || {}

  return {
    ...normalizedProject,
    assets: {
      ...assets,
      sourceImages: Array.isArray(assets.sourceImages)
        ? assets.sourceImages.map((item) => ({
            ...item,
            preview: item.preview || createPreviewUrlFromSavedPath(item.storedPath || item.path)
          }))
        : [],
      generatedImages: Array.isArray(assets.generatedImages)
        ? assets.generatedImages.map((item) => hydratePreviewForDisplay(item))
        : [],
      generatedVideo: assets.generatedVideo
        ? hydratePreviewForDisplay(assets.generatedVideo)
        : null
    }
  }
}

function hydrateProductProjectsForDisplay(productProjects = []) {
  return normalizeProductProjects(productProjects).map((project) => hydrateProductProjectForDisplay(project))
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
      sourceImage: null,
      enabledSteps: normalizeProjectEnabledSteps(),
      titlePrompt: '生成适合跨境电商平台使用的商品标题，突出核心卖点，避免夸张和违规表达',
      descriptionPrompt: '生成适合电商详情页或上架页使用的商品描述，语气清晰、利于转化、避免空话',
      imagePrompt: '',
      videoPrompt: '',
      imageModel: resolveDefaultModelForMenu('series-generate'),
      videoModel: 'MiniMax-Hailuo-2.3-Fast',
      imageTemplateId: DEFAULT_EMPTY_PROMPT_TEMPLATE_ID,
      videoTemplateId: 'video-main',
      titleMaxChars: 60,
      descriptionMaxChars: 300,
      titleQuantity: 3,
      descriptionQuantity: 2,
      generateCount: 4,
      promptAssignments: normalizePromptAssignments([], 4),
      size: '1:1',
      duration: '6s',
      resolution: '768P',
      aspectRatio: resolveVideoAspectRatioForMenu(),
      motionStrength: 'auto',
      model: resolveTextModelForMenu('workspace')
    },
    'title-generate': {
      taskName: '',
      productName: '',
      platformTargetsText: 'temu, ozon',
      language: 'zh-CN',
      titlePrompt: '生成适合跨境电商平台使用的商品标题，突出核心卖点，避免夸张和违规表达',
      titleMaxChars: 60,
      titleQuantity: 3,
      model: resolveTextModelForMenu('workspace')
    },
    'description-generate': {
      taskName: '',
      productName: '',
      platformTargetsText: 'temu, ozon',
      language: 'zh-CN',
      descriptionPrompt: '生成适合电商详情页或上架页使用的商品描述，语气清晰、利于转化、避免空话',
      descriptionMaxChars: 300,
      descriptionQuantity: 2,
      model: resolveTextModelForMenu('workspace')
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
      promptAssignments: normalizePromptAssignments([], 4),
      seriesSourceItems: []
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
    }
  }
}

function createDefaultResultsByMenu() {
  return Object.fromEntries(runtimeStateMenuItems.map((item) => [
    item.key,
    {
      textResults: [],
      comparisonResults: [],
      groupedResults: [],
      usageSummary: null,
      summary: null
    }
  ]))
}

function createDefaultExportItemsByMenu() {
  return Object.fromEntries(runtimeStateMenuItems.map((item) => [
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
    imageModel: resolveDefaultModelForMenu(),
    size: '1:1',
    generateCount: 4,
    videoModel: 'MiniMax-Hailuo-2.3-Fast',
    duration: '6s',
    resolution: '768P',
    motionStrength: 'auto',
    imageTemplateId: DEFAULT_EMPTY_PROMPT_TEMPLATE_ID,
    promptAssignments: normalizePromptAssignments([], 4),
    videoTemplateId: 'video-main',
    titlePrompt: '',
    descriptionPrompt: '',
    imagePrompt: '',
    videoPrompt: '',
    notes: ''
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
    enabledSteps: normalizeProjectEnabledSteps(source.enabledSteps),
    titleMaxChars: Math.max(1, Number(source.titleMaxChars) || defaults.titleMaxChars),
    descriptionMaxChars: Math.max(1, Number(source.descriptionMaxChars) || defaults.descriptionMaxChars),
    imageModel: String(source.imageModel || defaults.imageModel || resolveDefaultModelForMenu()).trim() || resolveDefaultModelForMenu(),
    size: String(source.size || source.imageSize || defaults.size).trim() || defaults.size,
    generateCount: Math.max(1, Math.min(MAX_SERIES_GENERATE_GROUP_SIZE, Number(source.generateCount) || defaults.generateCount || 4)),
    videoModel: String(source.videoModel || defaults.videoModel || 'MiniMax-Hailuo-2.3-Fast').trim() || 'MiniMax-Hailuo-2.3-Fast',
    duration: String(source.duration || source.videoDuration || defaults.duration).trim() || defaults.duration,
    resolution: String(source.resolution || source.videoResolution || defaults.resolution).trim() || defaults.resolution,
    aspectRatio: String(source.aspectRatio || source.videoAspectRatio || defaults.aspectRatio || resolveVideoAspectRatioForMenu()).trim() || resolveVideoAspectRatioForMenu(),
    motionStrength: String(source.motionStrength || source.videoMotionStrength || defaults.motionStrength).trim() || defaults.motionStrength,
    titleTemplateId: String(source.titleTemplateId || defaults.titleTemplateId || '').trim(),
    descriptionTemplateId: String(source.descriptionTemplateId || defaults.descriptionTemplateId || '').trim(),
    imageTemplateId: String(source.imageTemplateId || defaults.imageTemplateId).trim() || defaults.imageTemplateId,
    promptAssignments: normalizePromptAssignments(
      source.promptAssignments,
      Math.max(1, Math.min(MAX_SERIES_GENERATE_GROUP_SIZE, Number(source.generateCount) || defaults.generateCount || 4))
    ),
    videoTemplateId: String(source.videoTemplateId || defaults.videoTemplateId).trim() || defaults.videoTemplateId,
    titlePrompt: String(source.titlePrompt || '').trim(),
    descriptionPrompt: String(source.descriptionPrompt || '').trim(),
    imagePrompt: String(source.imagePrompt || '').trim(),
    videoPrompt: String(source.videoPrompt || '').trim(),
    notes: String(source.notes || '').trim()
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
  const usage = source.usage && typeof source.usage === 'object' ? source.usage : {}
  const defaultStepStates = createDefaultProjectRunStepStates()

  return {
    id: typeof source.id === 'string' ? source.id : '',
    projectId: typeof source.projectId === 'string' ? source.projectId : '',
    taskId: typeof source.taskId === 'string' ? source.taskId : '',
    taskNumber: typeof source.taskNumber === 'string' ? source.taskNumber : '',
    triggerMenuKey: typeof source.triggerMenuKey === 'string' ? source.triggerMenuKey : '',
    status: ['pending', 'running', 'success', 'failed', 'partial'].includes(source.status) ? source.status : 'pending',
    progress: Math.max(0, Math.min(100, Number(source.progress) || 0)),
    error: String(source.error || '').trim(),
    stepStates: {
      title: normalizeProjectRunStepState(source.stepStates?.title || defaultStepStates.title),
      description: normalizeProjectRunStepState(source.stepStates?.description || defaultStepStates.description),
      image: normalizeProjectRunStepState(source.stepStates?.image || defaultStepStates.image),
      video: normalizeProjectRunStepState(source.stepStates?.video || defaultStepStates.video)
    },
    outputs: {
      title: String(outputs.title || '').trim(),
      description: String(outputs.description || '').trim(),
      titleCandidates: normalizeStringList(outputs.titleCandidates),
      descriptionCandidates: normalizeStringList(outputs.descriptionCandidates),
      selectedTitle: String(outputs.selectedTitle || '').trim(),
      selectedDescription: String(outputs.selectedDescription || '').trim(),
      images: Array.isArray(outputs.images) ? outputs.images.map((item) => normalizeGeneratedMediaOutput(item)) : [],
      video: outputs.video && typeof outputs.video === 'object'
        ? normalizeGeneratedMediaOutput(outputs.video)
        : null
    },
    storage: {
      runDirectory: normalizeLocalRuntimePath(storage.runDirectory || ''),
      titleFile: normalizeLocalRuntimePath(storage.titleFile || ''),
      descriptionFile: normalizeLocalRuntimePath(storage.descriptionFile || ''),
      imageDirectory: normalizeLocalRuntimePath(storage.imageDirectory || ''),
      videoDirectory: normalizeLocalRuntimePath(storage.videoDirectory || '')
    },
    usage: {
      totalAmountCny: Math.max(0, Number(usage.totalAmountCny) || 0),
      currency: String(usage.currency || 'CNY').trim() || 'CNY',
      billedAt: typeof usage.billedAt === 'string' ? usage.billedAt : '',
      lines: Array.isArray(usage.lines)
        ? usage.lines.map((line) => ({
            kind: String(line?.kind || '').trim(),
            label: String(line?.label || '').trim(),
            model: String(line?.model || '').trim(),
            units: Math.max(0, Number(line?.units) || 0),
            unitPriceCny: Math.max(0, Number(line?.unitPriceCny) || 0),
            amountCny: Math.max(0, Number(line?.amountCny) || 0)
          }))
        : []
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
  const metadata = source.metadata && typeof source.metadata === 'object' ? source.metadata : {}
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
      sourceImages: Array.isArray(assets.sourceImages)
        ? assets.sourceImages.map((item) => normalizeImageAsset(item)).filter(Boolean)
        : [],
      generatedImages: Array.isArray(assets.generatedImages)
        ? assets.generatedImages.map((item) => normalizeGeneratedMediaOutput(item))
        : [],
      generatedVideo: assets.generatedVideo && typeof assets.generatedVideo === 'object'
        ? normalizeGeneratedMediaOutput(assets.generatedVideo)
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
    metadata: {
      selectionSource: metadata.selectionSource && typeof metadata.selectionSource === 'object'
        ? { ...metadata.selectionSource }
        : null,
      resultLanding: metadata.resultLanding && typeof metadata.resultLanding === 'object'
        ? {
            titleRunId: String(metadata.resultLanding.titleRunId || '').trim(),
            descriptionRunId: String(metadata.resultLanding.descriptionRunId || '').trim(),
            imageRunId: String(metadata.resultLanding.imageRunId || '').trim(),
            videoRunId: String(metadata.resultLanding.videoRunId || '').trim()
          }
        : {
            titleRunId: '',
            descriptionRunId: '',
            imageRunId: '',
            videoRunId: ''
          }
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
  const enabledSteps = normalizeProjectEnabledSteps(
    draft.enabledSteps || generationConfig.enabledSteps
  )
  const hasSourceImage = Boolean(
    normalizeImageAsset(draft.sourceImage) ||
    currentProject?.assets?.sourceImages?.length
  )

  return {
    title: enabledSteps.title !== false,
    description: enabledSteps.description !== false,
    image: enabledSteps.image !== false && hasSourceImage,
    video: enabledSteps.video !== false && hasSourceImage
  }
}

function splitWorkspaceTextValues(value = '') {
  return String(value || '')
    .split(/[\r\n,，;；]+/)
    .map((item) => item.trim())
    .filter(Boolean)
}

function normalizeSelectionSource(selectionSource = null) {
  const source = selectionSource && typeof selectionSource === 'object' ? selectionSource : null
  if (!source) {
    return null
  }

  return {
    itemId: String(source.itemId || '').trim(),
    platform: String(source.platform || '').trim(),
    boardType: String(source.boardType || '').trim(),
    boardLabel: String(source.boardLabel || '').trim(),
    siteCode: String(source.siteCode || '').trim(),
    title: String(source.title || '').trim(),
    subtitle: String(source.subtitle || '').trim(),
    categoryText: String(source.categoryText || '').trim(),
    priceText: String(source.priceText || '').trim(),
    salesVolumeText: String(source.salesVolumeText || '').trim(),
    ratingText: String(source.ratingText || '').trim(),
    extractedKeywords: normalizeStringList(source.extractedKeywords),
    primaryImageUrl: String(source.primaryImageUrl || '').trim(),
    capturedAt: String(source.capturedAt || '').trim(),
    sourceDetailUrl: String(source.sourceDetailUrl || '').trim(),
    importedAt: String(source.importedAt || '').trim()
  }
}

function buildWorkspaceSelectionContextLines(selectionSource = null) {
  const normalizedSelectionSource = normalizeSelectionSource(selectionSource)
  if (!normalizedSelectionSource) {
    return []
  }

  return [
    `选品平台：${normalizedSelectionSource.platform || '未提供'}`,
    `选品榜单：${normalizedSelectionSource.boardLabel || normalizedSelectionSource.boardType || '未提供'}`,
    `选品站点：${normalizedSelectionSource.siteCode || '默认站点'}`,
    `选品标题：${normalizedSelectionSource.title || '未提供'}`,
    `选品副标题：${normalizedSelectionSource.subtitle || '未提供'}`,
    `选品类目：${normalizedSelectionSource.categoryText || '未提供'}`,
    `选品价格：${normalizedSelectionSource.priceText || '未提供'}`,
    `选品销量：${normalizedSelectionSource.salesVolumeText || '未提供'}`,
    `选品评分：${normalizedSelectionSource.ratingText || '未提供'}`,
    `选品关键词：${normalizedSelectionSource.extractedKeywords.join('、') || '未提供'}`
  ]
}

function buildProjectScopedGenerationContextLines(draft = {}) {
  const selectionContextLines = buildWorkspaceSelectionContextLines(draft.selectionSource)
  const selectedTitle = String(draft.selectedTitle || '').trim()
  const selectedDescription = String(draft.selectedDescription || '').trim()

  return [
    selectedTitle ? `参考标题：${selectedTitle}` : '',
    selectedDescription ? `参考描述：${selectedDescription}` : '',
    ...selectionContextLines
  ].filter(Boolean)
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
  const currentGenerationConfig = normalizeProjectGenerationConfig(currentProject?.generationConfig)
  const workspaceGenerateCount = Math.max(
    1,
    Math.min(
      MAX_SERIES_GENERATE_GROUP_SIZE,
      Number(draft.generateCount) || currentGenerationConfig.generateCount || 4
    )
  )

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
    generationConfig: {
      ...currentGenerationConfig,
      enabledSteps: normalizeProjectEnabledSteps(draft.enabledSteps || currentGenerationConfig.enabledSteps),
      titleMaxChars: Math.max(1, Number(draft.titleMaxChars) || currentGenerationConfig.titleMaxChars || 60),
      descriptionMaxChars: Math.max(1, Number(draft.descriptionMaxChars) || currentGenerationConfig.descriptionMaxChars || 300),
      imageLanguage: String(draft.imageLanguage || currentGenerationConfig.imageLanguage || draft.language || currentProject?.baseInfo?.language || 'zh-CN').trim() || 'zh-CN',
      imageModel: String(draft.imageModel || currentGenerationConfig.imageModel || resolveDefaultModelForMenu()).trim() || resolveDefaultModelForMenu(),
      size: String(draft.size || currentGenerationConfig.size || '1:1').trim() || '1:1',
      generateCount: workspaceGenerateCount,
      videoModel: String(draft.videoModel || currentGenerationConfig.videoModel || 'MiniMax-Hailuo-2.3-Fast').trim() || 'MiniMax-Hailuo-2.3-Fast',
      duration: String(draft.duration || currentGenerationConfig.duration || '6s').trim() || '6s',
      resolution: String(draft.resolution || currentGenerationConfig.resolution || '768P').trim() || '768P',
      aspectRatio: String(draft.aspectRatio || currentGenerationConfig.aspectRatio || resolveVideoAspectRatioForMenu()).trim() || resolveVideoAspectRatioForMenu(),
      motionStrength: String(draft.motionStrength || currentGenerationConfig.motionStrength || 'auto').trim() || 'auto',
      titleTemplateId: String(draft.titleTemplateId || currentGenerationConfig.titleTemplateId || '').trim(),
      descriptionTemplateId: String(draft.descriptionTemplateId || currentGenerationConfig.descriptionTemplateId || '').trim(),
      imageTemplateId: String(draft.imageTemplateId || currentGenerationConfig.imageTemplateId || DEFAULT_EMPTY_PROMPT_TEMPLATE_ID).trim() || DEFAULT_EMPTY_PROMPT_TEMPLATE_ID,
      promptAssignments: normalizePromptAssignments(draft.promptAssignments, workspaceGenerateCount),
      videoTemplateId: String(draft.videoTemplateId || currentGenerationConfig.videoTemplateId || 'video-main').trim() || 'video-main',
      titlePrompt: String(draft.titlePrompt || currentGenerationConfig.titlePrompt || '').trim(),
      descriptionPrompt: String(draft.descriptionPrompt || currentGenerationConfig.descriptionPrompt || '').trim(),
      imagePrompt: String(draft.imagePrompt || currentGenerationConfig.imagePrompt || '').trim(),
      videoPrompt: String(draft.videoPrompt || currentGenerationConfig.videoPrompt || '').trim(),
      notes: String(draft.notes || currentGenerationConfig.notes || '').trim()
    },
    createdAt: currentProject?.createdAt || createdAt,
    updatedAt
  })
}

function applyWorkspaceTextResultsToProject(project = {}, resultPayload = {}, updatedAt = '') {
  const workspaceResult = resultPayload.workspaceResult && typeof resultPayload.workspaceResult === 'object'
    ? resultPayload.workspaceResult
    : {}
  const titleCandidates = Array.isArray(workspaceResult.titleCandidates)
    ? workspaceResult.titleCandidates.map((item) => String(item || '').trim()).filter(Boolean)
    : (resultPayload.textResults || [])
      .filter((item) => item.kind === 'title')
      .map((item) => String(item.content || '').trim())
      .filter(Boolean)
  const descriptionCandidates = Array.isArray(workspaceResult.descriptionCandidates)
    ? workspaceResult.descriptionCandidates.map((item) => String(item || '').trim()).filter(Boolean)
    : (resultPayload.textResults || [])
      .filter((item) => item.kind === 'description')
      .map((item) => String(item.content || '').trim())
      .filter(Boolean)
  const selectedTitle = String(workspaceResult.selectedTitle || titleCandidates[0] || project.content?.selectedTitle || '').trim()
  const selectedDescription = String(workspaceResult.selectedDescription || descriptionCandidates[0] || project.content?.selectedDescription || '').trim()

  return normalizeProductProject({
    ...project,
    status: titleCandidates.length || descriptionCandidates.length ? 'ready' : (project.status || 'draft'),
    content: {
      ...(project.content || {}),
      titleCandidates,
      descriptionCandidates,
      selectedTitle,
      selectedDescription
    },
    metadata: {
      ...(project.metadata || {}),
      resultLanding: {
        ...(project.metadata?.resultLanding || {}),
        titleRunId: titleCandidates.length ? String(resultPayload.projectRunId || '').trim() : (project.metadata?.resultLanding?.titleRunId || ''),
        descriptionRunId: descriptionCandidates.length ? String(resultPayload.projectRunId || '').trim() : (project.metadata?.resultLanding?.descriptionRunId || '')
      }
    },
    updatedAt
  })
}

function normalizeGeneratedMediaOutput(item = {}) {
  return {
    ...item,
    path: normalizeLocalRuntimePath(item.savedPath || item.path || ''),
    savedPath: normalizeLocalRuntimePath(item.savedPath || item.path || ''),
    sourceUrl: item.sourceUrl || item.downloadUrl || '',
    publishReadyUrl: item.publishReadyUrl || item.downloadUrl || ''
  }
}

function normalizeResultPayloadForStorage(resultPayload = {}) {
  const workspaceResult = resultPayload.workspaceResult && typeof resultPayload.workspaceResult === 'object'
    ? resultPayload.workspaceResult
    : {}

  return {
    ...resultPayload,
    comparisonResults: Array.isArray(resultPayload.comparisonResults)
      ? resultPayload.comparisonResults.map((item) => normalizeGeneratedMediaOutput(item))
      : [],
    groupedResults: Array.isArray(resultPayload.groupedResults)
      ? resultPayload.groupedResults.map((group) => ({
          ...group,
          outputs: Array.isArray(group.outputs)
            ? group.outputs.map((item) => normalizeGeneratedMediaOutput(item))
            : []
        }))
      : [],
    workspaceResult: {
      ...workspaceResult,
      images: Array.isArray(workspaceResult.images)
        ? workspaceResult.images.map((item) => normalizeGeneratedMediaOutput(item))
        : [],
      video: workspaceResult.video && typeof workspaceResult.video === 'object'
        ? normalizeGeneratedMediaOutput(workspaceResult.video)
        : null
    }
  }
}

function normalizeExportItem(item = {}) {
  const source = item && typeof item === 'object' ? item : {}
  const normalizedDirectoryPath = normalizeLocalRuntimePath(source.directoryPath || source.outputDirectory || '')
  const normalizedSavedPath = normalizeLocalRuntimePath(source.savedPath || source.path || '')

  return {
    ...source,
    directoryPath: normalizedDirectoryPath,
    outputDirectory: normalizedDirectoryPath || normalizeLocalRuntimePath(source.outputDirectory || ''),
    savedPath: normalizedSavedPath,
    path: normalizedSavedPath || normalizeLocalRuntimePath(source.path || '')
  }
}

function normalizeTaskRecord(task = {}) {
  const source = task && typeof task === 'object' ? task : {}

  return {
    ...source,
    inputDirectory: normalizeLocalRuntimePath(source.inputDirectory || ''),
    outputDirectory: normalizeLocalRuntimePath(source.outputDirectory || '')
  }
}

function isGeneratedVideoOutput(item = {}) {
  const savedPath = String(item.savedPath || item.path || '').trim()
  return Boolean(savedPath) && /\.mp4$/i.test(savedPath)
}

function isGeneratedImageOutput(item = {}) {
  const savedPath = String(item.savedPath || item.path || '').trim()
  return Boolean(savedPath) && !isGeneratedVideoOutput(item)
}

function collectGeneratedImagesFromResultPayload(resultPayload = {}) {
  return (resultPayload.groupedResults || []).flatMap((group) => {
    return (group.outputs || [])
      .filter((item) => isGeneratedImageOutput(item))
      .map((item) => normalizeGeneratedMediaOutput(item))
  })
}

function collectGeneratedVideoFromResultPayload(resultPayload = {}) {
  const matchedVideo = (resultPayload.groupedResults || [])
    .flatMap((group) => group.outputs || [])
    .find((item) => isGeneratedVideoOutput(item))

  return matchedVideo ? normalizeGeneratedMediaOutput(matchedVideo) : null
}

function applyImageResultsToProject(project = {}, resultPayload = {}, updatedAt = '') {
  const workspaceResult = resultPayload.workspaceResult && typeof resultPayload.workspaceResult === 'object'
    ? resultPayload.workspaceResult
    : {}
  const workspaceImages = Array.isArray(workspaceResult.images)
    ? workspaceResult.images
      .map((item) => normalizeGeneratedMediaOutput(item))
      .filter((item) => {
        const savedPath = String(item.savedPath || '').trim()
        return Boolean(savedPath) && !/\.mp4$/i.test(savedPath)
      })
    : []
  const generatedImages = workspaceImages.length
    ? workspaceImages
    : collectGeneratedImagesFromResultPayload(resultPayload)

  return normalizeProductProject({
    ...project,
    status: generatedImages.length ? 'ready' : (project.status || 'draft'),
    assets: {
      ...(project.assets || {}),
      generatedImages
    },
    metadata: {
      ...(project.metadata || {}),
      resultLanding: {
        ...(project.metadata?.resultLanding || {}),
        imageRunId: generatedImages.length ? String(resultPayload.projectRunId || '').trim() : (project.metadata?.resultLanding?.imageRunId || '')
      }
    },
    updatedAt
  })
}

function applyVideoResultsToProject(project = {}, resultPayload = {}, updatedAt = '') {
  const workspaceResult = resultPayload.workspaceResult && typeof resultPayload.workspaceResult === 'object'
    ? resultPayload.workspaceResult
    : {}
  const workspaceVideo = workspaceResult.video && typeof workspaceResult.video === 'object'
    ? normalizeGeneratedMediaOutput(workspaceResult.video)
    : null
  const generatedVideo = workspaceVideo && /\.mp4$/i.test(String(workspaceVideo.savedPath || '').trim())
    ? workspaceVideo
    : collectGeneratedVideoFromResultPayload(resultPayload)

  return normalizeProductProject({
    ...project,
    status: generatedVideo ? 'ready' : (project.status || 'draft'),
    assets: {
      ...(project.assets || {}),
      generatedVideo: generatedVideo
        ? normalizeGeneratedMediaOutput(generatedVideo)
        : project.assets?.generatedVideo || null
    },
    metadata: {
      ...(project.metadata || {}),
      resultLanding: {
        ...(project.metadata?.resultLanding || {}),
        videoRunId: generatedVideo ? String(resultPayload.projectRunId || '').trim() : (project.metadata?.resultLanding?.videoRunId || '')
      }
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

async function importRemoteProjectSourceImage({
  sourceImageImportUrl = '',
  projectId = '',
  remoteLicensePlatformClient = null,
  settingsService = null,
  ensureDirectory: ensureDirectoryDependency = ensureDirectory,
  writeFile = fs.writeFile,
  requestBinary = async () => Buffer.alloc(0)
} = {}) {
  const normalizedUrl = trimString(sourceImageImportUrl)
  const normalizedProjectId = trimString(projectId)

  if (!normalizedUrl || !normalizedProjectId) {
    return null
  }

  const inputDirectory = path.resolve(INPUT_ROOT_DIRECTORY, 'workspace', normalizedProjectId, 'source-images')
  await ensureDirectoryDependency(inputDirectory)

  let buffer = null
  let contentType = ''

  if (
    remoteLicensePlatformClient &&
    typeof remoteLicensePlatformClient.downloadGenerationArtifact === 'function'
  ) {
    const sessionToken = trimString(settingsService?.getSettings?.()?.authPlatform?.sessionToken || '')
    buffer = await remoteLicensePlatformClient.downloadGenerationArtifact({
      id: '',
      sessionToken,
      downloadUrl: normalizedUrl
    })
  } else {
    const response = await requestBinary(normalizedUrl)
    buffer = Buffer.isBuffer(response?.buffer) ? response.buffer : Buffer.from(response?.buffer || response || '')
    contentType = trimString(response?.contentType || '')
  }

  if (!Buffer.isBuffer(buffer) || !buffer.length) {
    throw new Error('Failed to download selection source image.')
  }

  const resolvedContentType = contentType || inferMimeTypeFromUrl(normalizedUrl)
  const extension = inferImageExtension({
    contentType: resolvedContentType,
    url: normalizedUrl
  })
  const fileName = `${sanitizePathSegment(normalizedProjectId, 'project')}-selection${extension}`
  const targetPath = path.resolve(inputDirectory, fileName)

  await writeFile(targetPath, buffer)

  return normalizeImageAsset({
    id: `source-image-${normalizedProjectId}`,
    name: fileName,
    path: targetPath,
    storedPath: targetPath,
    preview: buildDataUrlFromBuffer(buffer, resolvedContentType || 'image/png'),
    sizeLabel: formatAssetSizeLabel(buffer.length)
  })
}

function updateProductProjectFields(project = {}, patch = {}, updatedAt = '') {
  const normalizedProject = normalizeProductProject(project)
  const nextPatch = patch && typeof patch === 'object' ? patch : {}
  const baseInfoPatch = nextPatch.baseInfo && typeof nextPatch.baseInfo === 'object' ? nextPatch.baseInfo : {}
  const generationConfigPatch = nextPatch.generationConfig && typeof nextPatch.generationConfig === 'object'
    ? nextPatch.generationConfig
    : {}
  const assetsPatch = nextPatch.assets && typeof nextPatch.assets === 'object' ? nextPatch.assets : {}
  const contentPatch = nextPatch.content && typeof nextPatch.content === 'object' ? nextPatch.content : {}
  const metadataPatch = nextPatch.metadata && typeof nextPatch.metadata === 'object' ? nextPatch.metadata : {}

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
    generationConfig: {
      ...normalizedProject.generationConfig,
      ...generationConfigPatch
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
    metadata: {
      ...normalizedProject.metadata,
      ...metadataPatch
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
    const supportedMenuKeys = ['workspace', 'title-generate', 'description-generate', 'series-generate', 'video-generate']

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
    const menuRootDirectory = path.resolve(OUTPUT_ROOT_DIRECTORY, getFeatureDirectoryKey(menuKey))

    const belongsToMenuRoot = (item) => {
      const candidatePath = String(item?.directoryPath || item?.outputDirectory || item?.savedPath || '').trim()
      if (!candidatePath) {
        return false
      }

      const resolvedCandidatePath = path.resolve(candidatePath)
      return resolvedCandidatePath === menuRootDirectory || resolvedCandidatePath.startsWith(`${menuRootDirectory}${path.sep}`)
    }

    const exportItemExists = (item) => {
      const candidatePath = String(item?.directoryPath || item?.outputDirectory || item?.savedPath || '').trim()
      if (!candidatePath) {
        return false
      }

      try {
        return fsSync.existsSync(path.resolve(candidatePath))
      } catch {
        return false
      }
    }

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
      if (!identity || seenIdentities.has(identity) || !belongsToMenuRoot(item) || !exportItemExists(item)) {
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
  const normalizedFormDrafts = Object.fromEntries(runtimeStateMenuItems.map((item) => {
    return [
      item.key,
      normalizeDraftForMenu(item.key, mergedFormDrafts[item.key] || {})
    ]
  }))

  return {
    formDrafts: normalizedFormDrafts,
    resultsByMenu: Object.fromEntries(runtimeStateMenuItems.map((item) => {
      return [
        item.key,
        normalizeResultPayloadForStorage({
          ...(defaultState.resultsByMenu[item.key] || {}),
          ...((savedState.resultsByMenu || {})[item.key] || {})
        })
      ]
    })),
    exportItemsByMenu: Object.fromEntries(runtimeStateMenuItems.map((item) => {
      return [
        item.key,
        Array.isArray((savedState.exportItemsByMenu || {})[item.key])
          ? (savedState.exportItemsByMenu || {})[item.key].map((entry) => normalizeExportItem(entry))
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
    tasks: Array.isArray(savedState.tasks) ? savedState.tasks.map((task) => normalizeTaskRecord(task)) : defaultState.tasks,
    requestMetrics: normalizeRequestMetrics(savedState.requestMetrics)
  }
}

function sortTasks(tasks = []) {
  return [...tasks].sort((left, right) => {
    return new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime()
  })
}

function countCurrentResults(resultPayload = {}) {
  const groupedResultCount = (resultPayload.groupedResults || []).reduce((total, group) => {
    return total + (group.outputs || []).length
  }, 0)

  return (resultPayload.textResults || []).length + (resultPayload.comparisonResults || []).length + groupedResultCount
}

function createWorkspaceStepStates(enabledSteps = {}, nowIso = () => new Date().toISOString()) {
  return {
    title: enabledSteps.title
      ? { status: 'pending', error: '', startedAt: '', completedAt: '' }
      : { status: 'success', error: '', startedAt: '', completedAt: nowIso() },
    description: enabledSteps.description
      ? { status: 'pending', error: '', startedAt: '', completedAt: '' }
      : { status: 'success', error: '', startedAt: '', completedAt: nowIso() },
    image: enabledSteps.image
      ? { status: 'pending', error: '', startedAt: '', completedAt: '' }
      : { status: 'success', error: '', startedAt: '', completedAt: nowIso() },
    video: enabledSteps.video
      ? { status: 'pending', error: '', startedAt: '', completedAt: '' }
      : { status: 'success', error: '', startedAt: '', completedAt: nowIso() }
  }
}

function markWorkspaceStepRunning(workspaceStepStates = {}, stepKey = '', nowIso = () => new Date().toISOString()) {
  workspaceStepStates[stepKey] = {
    ...workspaceStepStates[stepKey],
    status: 'running',
    error: '',
    startedAt: workspaceStepStates[stepKey]?.startedAt || nowIso()
  }
}

function markWorkspaceStepSuccess(workspaceStepStates = {}, stepKey = '', nowIso = () => new Date().toISOString()) {
  workspaceStepStates[stepKey] = {
    ...workspaceStepStates[stepKey],
    status: 'success',
    error: '',
    completedAt: nowIso()
  }
}

function markWorkspaceStepFailure(workspaceStepStates = {}, workspaceErrors = [], stepKey = '', errorMessage = '', nowIso = () => new Date().toISOString()) {
  const normalizedError = String(errorMessage || '生成失败').trim() || '生成失败'
  workspaceStepStates[stepKey] = {
    ...workspaceStepStates[stepKey],
    status: 'failed',
    error: normalizedError,
    completedAt: nowIso()
  }
  workspaceErrors.push(`${workspaceStepOptionsLabelMap[stepKey] || stepKey}：${normalizedError}`)
}

async function emitWorkspaceProgress(onProgress, workspaceStepStates, { progress, status, error = '' } = {}) {
  await onProgress?.({
    progress,
    status,
    error,
    workspaceStepStates
  })
}

function buildWorkspaceExecutionContext(draft = {}) {
  const workspaceProjectName = resolveWorkspaceProjectDisplayName(draft)
  return {
    workspaceProjectName,
    highlightText: splitWorkspaceTextValues(draft.highlightsText).join('、') || '暂无',
    keywordText: splitWorkspaceTextValues(draft.keywordsText).join('、') || '暂无',
    platformText: splitWorkspaceTextValues(draft.platformTargetsText).join('、') || '通用电商平台',
    selectionContextLines: buildWorkspaceSelectionContextLines(draft.selectionSource),
    selectedTitleSeed: String(draft.selectedTitle || '').trim(),
    selectedDescriptionSeed: String(draft.selectedDescription || '').trim()
  }
}

function buildWorkspaceTitleTaskDraft(draft = {}, context = {}) {
  return {
    taskKind: 'title',
    model: draft.model,
    quantity: Math.max(1, Number(draft.titleQuantity) || 1),
    prompt: [
      `商品名称：${draft.productName || context.workspaceProjectName || ''}`,
      `品牌：${draft.brand || '未提供'}`,
      `类目：${draft.category || '未提供'}`,
      `卖点：${context.highlightText || '暂无'}`,
      `关键词：${context.keywordText || '暂无'}`,
      `目标平台：${context.platformText || '通用电商平台'}`,
      `语言：${draft.language || 'zh-CN'}`,
      ...(context.selectionContextLines || []),
      `任务要求：${draft.titlePrompt || ''}`,
      `最大字数：${draft.titleMaxChars || 60}`,
      '请基于当前商品信息和选品上下文，输出适合电商上架的商品标题。',
      '要求优先保留商品主体、类目和真实卖点，不要编造参数，不要输出解释，只返回标题结果。'
    ].filter(Boolean).join('\n')
  }
}

function buildWorkspaceDescriptionTaskDraft(draft = {}, context = {}, titleResults = []) {
  return {
    taskKind: 'description',
    model: draft.model,
    quantity: Math.max(1, Number(draft.descriptionQuantity) || 1),
    prompt: [
      `商品名称：${draft.productName || context.workspaceProjectName || ''}`,
      `品牌：${draft.brand || '未提供'}`,
      `类目：${draft.category || '未提供'}`,
      `卖点：${context.highlightText || '暂无'}`,
      `关键词：${context.keywordText || '暂无'}`,
      `目标平台：${context.platformText || '通用电商平台'}`,
      `语言：${draft.language || 'zh-CN'}`,
      `参考标题：${titleResults[0]?.content || context.selectedTitleSeed || draft.productName || context.workspaceProjectName || ''}`,
      ...(context.selectionContextLines || []),
      `任务要求：${draft.descriptionPrompt || ''}`,
      `最大字数：${draft.descriptionMaxChars || 300}`,
      '请输出适合商品详情页或上架页的商品描述。',
      '要求信息清晰、卖点明确、语气自然，不要分点编号，不要编造不存在的规格。'
    ].filter(Boolean).join('\n')
  }
}

function buildStandaloneTitleTaskDraft(draft = {}) {
  return {
    workspaceRunGroupId: String(draft.workspaceRunGroupId || '').trim(),
    taskKind: 'title',
    model: draft.model,
    quantity: Math.max(1, Number(draft.titleQuantity) || 1),
    maxChars: Math.max(1, Number(draft.titleMaxChars) || 60),
    prompt: [
      `商品名称：${draft.productName || '未提供'}`,
      `目标平台：${splitWorkspaceTextValues(draft.platformTargetsText).join('、') || '通用电商平台'}`,
      `语言：${draft.language || 'zh-CN'}`,
      `任务要求：${draft.titlePrompt || ''}`,
      `最大字数：${draft.titleMaxChars || 60}`,
      '请输出适合电商商品上架使用的标题。',
      '不要解释，不要编号，只返回标题结果。'
    ].filter(Boolean).join('\n')
  }
}

function buildStandaloneDescriptionTaskDraft(draft = {}) {
  return {
    workspaceRunGroupId: String(draft.workspaceRunGroupId || '').trim(),
    taskKind: 'description',
    model: draft.model,
    quantity: Math.max(1, Number(draft.descriptionQuantity) || 1),
    maxChars: Math.max(1, Number(draft.descriptionMaxChars) || 300),
    prompt: [
      `商品名称：${draft.productName || '未提供'}`,
      `目标平台：${splitWorkspaceTextValues(draft.platformTargetsText).join('、') || '通用电商平台'}`,
      `语言：${draft.language || 'zh-CN'}`,
      `任务要求：${draft.descriptionPrompt || ''}`,
      `最大字数：${draft.descriptionMaxChars || 300}`,
      '请输出适合电商商品详情页或上架页使用的描述。',
      '不要解释，不要编号，只返回描述结果。'
    ].filter(Boolean).join('\n')
  }
}

function buildWorkspaceImageTaskDraft(draft = {}, context = {}, titleResults = [], descriptionResults = []) {
  const workspaceImagePromptBase = String(
    draft.imagePrompt ||
    '围绕商品生成一套适合电商展示的图片，突出主体、卖点和清晰质感'
  ).trim()
  const workspaceGenerateCount = Math.max(1, Number(draft.generateCount) || 4)
  const workspacePromptAssignments = normalizePromptAssignments(draft.promptAssignments, workspaceGenerateCount)
  const imageLanguage = String(draft.imageLanguage || draft.language || 'zh-CN').trim() || 'zh-CN'

  return {
    ...draft,
    workspaceRunGroupId: String(draft.workspaceRunGroupId || '').trim(),
    imageLanguage,
    sourceImage: draft.sourceImage || null,
    model: draft.imageModel || 'gpt-image-2',
    generateCount: workspaceGenerateCount,
    batchCount: 1,
    size: draft.size || '1:1',
    promptAssignments: workspacePromptAssignments.map((assignment, index) => {
      const imageTypeLabel = String(
        assignment.imageType ||
        SERIES_GENERATE_TYPE_BY_TEMPLATE_ID[String(assignment.templateId || '').trim()] ||
        SERIES_GENERATE_DEFAULT_TYPE_ORDER[index] ||
        '详情图'
      ).trim() || '详情图'

      return {
        ...assignment,
        id: assignment.id || `workspace-series-${index + 1}`,
        templateId: String(
          assignment.templateId ||
          SERIES_GENERATE_TEMPLATE_ID_BY_TYPE[imageTypeLabel] ||
          draft.imageTemplateId ||
          DEFAULT_EMPTY_PROMPT_TEMPLATE_ID
        ).trim() || DEFAULT_EMPTY_PROMPT_TEMPLATE_ID,
        imageType: imageTypeLabel,
        differenceLevel: ['off', 'low', 'medium', 'high'].includes(assignment.differenceLevel)
          ? assignment.differenceLevel
          : 'off',
        prompt: [`语言：${imageLanguage}`, String(assignment.prompt || '').trim() || workspaceImagePromptBase]
          .filter(Boolean)
          .join('\n')
      }
    })
  }
}

function buildWorkspaceVideoTaskDraft(draft = {}, context = {}, titleResults = [], descriptionResults = []) {
  return {
    ...draft,
    workspaceRunGroupId: String(draft.workspaceRunGroupId || '').trim(),
    sourceImage: draft.sourceImage || null,
    model: draft.videoModel || 'MiniMax-Hailuo-2.3-Fast',
    prompt: [
      `商品名称：${draft.productName || context.workspaceProjectName || ''}`,
      `参考标题：${titleResults[0]?.content || context.selectedTitleSeed || draft.productName || context.workspaceProjectName || ''}`,
      `参考描述：${descriptionResults[0]?.content || context.selectedDescriptionSeed || ''}`,
      ...(context.selectionContextLines || []),
      String(draft.videoPrompt || draft.prompt || '生成适合电商展示的商品视频，镜头稳定，突出主体与卖点').trim()
    ].filter(Boolean).join('\n'),
    duration: draft.duration || '6s',
    resolution: draft.resolution || '768P',
    motionStrength: draft.motionStrength || 'auto',
    videoTemplateId: draft.videoTemplateId || 'video-main'
  }
}

async function runWorkspaceTextStep({
  stepKey = '',
  taskId = '',
  draft = {},
  workspaceStepStates,
  workspaceErrors,
  nowIso,
  emitProgress,
  generateTextResults
} = {}) {
  const progressConfig = stepKey === 'title'
    ? { baseProgress: 12, maxProgress: 42, idleProgress: 42 }
    : { baseProgress: 44, maxProgress: 62, idleProgress: 62 }

  markWorkspaceStepRunning(workspaceStepStates, stepKey, nowIso)
  await emitProgress({
    progress: progressConfig.baseProgress,
    status: 'running'
  })

  try {
    const response = await generateTextResults({
      onProgress: async ({ progress, status, error } = {}) => {
        const mappedProgress = progressConfig.baseProgress + Math.round((Math.max(0, Number(progress) || 0) * ((progressConfig.maxProgress - progressConfig.baseProgress) / 100)))
        await emitProgress({
          progress: Math.min(progressConfig.maxProgress, mappedProgress),
          status,
          error
        })
      },
      taskId,
      draft
    })
    const results = Array.isArray(response)
      ? response
      : (Array.isArray(response?.textResults) ? response.textResults : [])

    markWorkspaceStepSuccess(workspaceStepStates, stepKey, nowIso)
    await emitProgress({
      progress: progressConfig.idleProgress,
      status: 'running'
    })
    return {
      textResults: results,
      usageSummary: response && typeof response === 'object' ? response.usageSummary || null : null
    }
  } catch (error) {
    markWorkspaceStepFailure(workspaceStepStates, workspaceErrors, stepKey, error?.message, nowIso)
    await emitProgress({
      progress: progressConfig.idleProgress,
      status: 'running',
      error: workspaceErrors.join('；')
    })
    return {
      textResults: [],
      usageSummary: null
    }
  }
}

async function runWorkspaceImageStep({
  taskId = '',
  draft = {},
  outputDirectory = '',
  workspaceStepStates,
  workspaceErrors,
  nowIso,
  emitProgress,
  generateImageResults,
  onPartialImageResults
} = {}) {
  const emptyImageResults = {
    textResults: [],
    comparisonResults: [],
    groupedResults: [],
    summary: {
      title: '套图结果',
      description: '未提供样图，跳过套图生成'
    }
  }

  markWorkspaceStepRunning(workspaceStepStates, 'image', nowIso)
  if (!draft.sourceImage) {
    markWorkspaceStepFailure(workspaceStepStates, workspaceErrors, 'image', '未提供原图，无法执行套图生成', nowIso)
    return emptyImageResults
  }

  try {
    const imageResults = await generateImageResults({
      menuKey: 'series-generate',
      draft,
      taskId,
      outputDirectory,
      onPartialResult: async (partialResult) => {
        if (typeof onPartialImageResults === 'function') {
          await onPartialImageResults(partialResult)
        }
      },
      onProgress: async ({ progress, status } = {}) => {
        const mappedProgress = 18 + Math.round((Math.max(0, Number(progress) || 0) * 0.6))
        await emitProgress({
          progress: Math.min(78, mappedProgress),
          status
        })
      }
    })

    markWorkspaceStepSuccess(workspaceStepStates, 'image', nowIso)
    return imageResults
  } catch (error) {
    markWorkspaceStepFailure(workspaceStepStates, workspaceErrors, 'image', error?.message, nowIso)
    return {
      ...emptyImageResults,
      summary: {
        title: '套图结果',
        description: String(error?.message || '套图生成失败').trim() || '套图生成失败'
      }
    }
  }
}

async function runWorkspaceVideoStep({
  taskId = '',
  draft = {},
  outputDirectory = '',
  workspaceStepStates,
  workspaceErrors,
  nowIso,
  emitProgress,
  generateVideoResults
} = {}) {
  const emptyVideoResults = {
    textResults: [],
    comparisonResults: [],
    groupedResults: [],
    summary: {
      title: '视频结果',
      description: '未提供样图，跳过视频生成'
    }
  }

  markWorkspaceStepRunning(workspaceStepStates, 'video', nowIso)
  if (!draft.sourceImage) {
    markWorkspaceStepFailure(workspaceStepStates, workspaceErrors, 'video', '未提供原图，无法执行视频生成', nowIso)
    return emptyVideoResults
  }

  try {
    const videoResults = await generateVideoResults({
      draft,
      taskId,
      outputDirectory,
      onProgress: async ({ progress, status } = {}) => {
        const mappedProgress = 80 + Math.round((Math.max(0, Number(progress) || 0) * 0.18))
        await emitProgress({
          progress: Math.min(98, mappedProgress),
          status
        })
      }
    })

    markWorkspaceStepSuccess(workspaceStepStates, 'video', nowIso)
    return videoResults
  } catch (error) {
    markWorkspaceStepFailure(workspaceStepStates, workspaceErrors, 'video', error?.message, nowIso)
    return {
      ...emptyVideoResults,
      summary: {
        title: '视频结果',
        description: String(error?.message || '视频生成失败').trim() || '视频生成失败'
      }
    }
  }
}

function buildWorkspaceResultPayload({
  taskId = '',
  workspaceProjectName = '',
  titleResults = [],
  descriptionResults = [],
  imageResults = {},
  videoResults = {},
  workspaceStepStates = {},
  workspaceErrors = []
} = {}) {
  const workspaceTextResults = [
    ...(Array.isArray(titleResults?.textResults) ? titleResults.textResults : []).map((item, index) => ({
      ...item,
      id: `${taskId}-title-${index + 1}`,
      title: `标题 ${index + 1}`,
      kind: 'title'
    })),
    ...(Array.isArray(descriptionResults?.textResults) ? descriptionResults.textResults : []).map((item, index) => ({
      ...item,
      id: `${taskId}-description-${index + 1}`,
      title: `描述 ${index + 1}`,
      kind: 'description'
    }))
  ]
  const workspaceGroupedResults = [
    ...(imageResults.groupedResults || []),
    ...(videoResults.groupedResults || [])
  ]
  const workspaceImages = (imageResults.groupedResults || [])
    .flatMap((group) => group.outputs || [])
    .filter((item) => {
      const savedPath = String(item.savedPath || item.path || '').trim()
      return Boolean(savedPath) && !/\.mp4$/i.test(savedPath)
    })
  const workspaceVideo = (videoResults.groupedResults || [])
    .flatMap((group) => group.outputs || [])
    .find((item) => {
      const savedPath = String(item.savedPath || item.path || '').trim()
      return Boolean(savedPath) && /\.mp4$/i.test(savedPath)
    }) || null
  const workspaceUsageSummary = mergeWorkspaceUsageSummaries([
    titleResults?.usageSummary || null,
    descriptionResults?.usageSummary || null,
    imageResults?.usageSummary || null,
    videoResults?.usageSummary || null
  ])

  return {
    textResults: workspaceTextResults,
    comparisonResults: [],
    groupedResults: workspaceGroupedResults,
    usageSummary: workspaceUsageSummary,
    workspaceResult: {
      titleCandidates: workspaceTextResults
        .filter((item) => item.kind === 'title')
        .map((item) => String(item.content || '').trim())
        .filter(Boolean),
      descriptionCandidates: workspaceTextResults
        .filter((item) => item.kind === 'description')
        .map((item) => String(item.content || '').trim())
        .filter(Boolean),
      selectedTitle: workspaceTextResults.find((item) => item.kind === 'title')?.content || '',
      selectedDescription: workspaceTextResults.find((item) => item.kind === 'description')?.content || '',
      images: workspaceImages,
      video: workspaceVideo
    },
    workspaceStepStates,
    workspaceErrors,
    hasWorkspaceFailures: workspaceErrors.length > 0,
    summary: {
      title: `${workspaceProjectName} / 全链路生成结果`,
      description: workspaceErrors.length
        ? `已生成 ${(titleResults?.textResults || []).length} 条标题、${(descriptionResults?.textResults || []).length} 条描述；存在失败：${workspaceErrors.join('；')}`
        : `已生成 ${(titleResults?.textResults || []).length} 条标题、${(descriptionResults?.textResults || []).length} 条描述，并完成套图与视频流程`
    }
  }
}

function mergeWorkspaceUsageSummaries(usageSummaries = []) {
  const source = Array.isArray(usageSummaries)
    ? usageSummaries.filter((item) => item && typeof item === 'object')
    : []

  if (!source.length) {
    return null
  }

  const lines = source.flatMap((item) => Array.isArray(item.lines) ? item.lines : [])
  const totalAmountCny = source.reduce((sum, item) => {
    return sum + Math.max(0, Number(item.totalAmountCny) || 0)
  }, 0)

  return {
    billed: source.some((item) => item.billed === true),
    billedAt: source
      .map((item) => String(item.billedAt || '').trim())
      .filter(Boolean)
      .sort()
      .at(-1) || '',
    currency: 'CNY',
    totalAmountCny: Number(totalAmountCny.toFixed(2)),
    lines
  }
}


async function buildResultPayload(menuKey, draft, taskId, outputDirectory, {
  generateImageResults,
  generateTextResults,
  generateVideoResults,
  onProgress,
  onIntermediateResult
}) {
  if (menuKey === 'workspace') {
    const workspaceRunGroupId = String(taskId || '').trim()
    const enabledSteps = normalizeProjectEnabledSteps(draft.enabledSteps)
    const nowIso = () => new Date().toISOString()
    const workspaceStepStates = createWorkspaceStepStates(enabledSteps, nowIso)
    const workspaceErrors = []
    let lastProgress = 0
    const emitProgress = async ({ progress, status, error = '' } = {}) => emitWorkspaceProgress(onProgress, workspaceStepStates, {
      progress: (lastProgress = Math.max(lastProgress, Math.max(0, Number(progress) || 0))),
      status,
      error
    })
    await emitProgress({
      progress: 8,
      status: 'running'
    })

    const context = buildWorkspaceExecutionContext(draft)
    const workspaceDraft = {
      ...draft,
      workspaceRunGroupId
    }
    const emptyTextResults = {
      textResults: [],
      usageSummary: null
    }
    const emptyImageResults = {
      textResults: [],
      comparisonResults: [],
      groupedResults: [],
      summary: {
        title: '\u5957\u56fe\u7ed3\u679c',
        description: '\u672a\u63d0\u4f9b\u6837\u56fe\uff0c\u8df3\u8fc7\u5957\u56fe\u751f\u6210'
      }
    }
    const emptyVideoResults = {
      textResults: [],
      comparisonResults: [],
      groupedResults: [],
      summary: {
        title: '\u89c6\u9891\u7ed3\u679c',
        description: '\u672a\u63d0\u4f9b\u6837\u56fe\uff0c\u8df3\u8fc7\u89c6\u9891\u751f\u6210'
      }
    }
    const workspaceStageResults = {
      titleResults: emptyTextResults,
      descriptionResults: emptyTextResults,
      imageResults: emptyImageResults,
      videoResults: emptyVideoResults
    }
    const emitIntermediateResult = async () => {
      if (typeof onIntermediateResult !== 'function') {
        return
      }

      await onIntermediateResult(buildWorkspaceResultPayload({
        taskId,
        workspaceProjectName: context.workspaceProjectName,
        titleResults: workspaceStageResults.titleResults,
        descriptionResults: workspaceStageResults.descriptionResults,
        imageResults: workspaceStageResults.imageResults,
        videoResults: workspaceStageResults.videoResults,
        workspaceStepStates,
        workspaceErrors
      }))
    }
    const titlePromise = enabledSteps.title
      ? runWorkspaceTextStep({
          stepKey: 'title',
          taskId: `${taskId}-title`,
          draft: buildWorkspaceTitleTaskDraft(workspaceDraft, context),
          workspaceStepStates,
          workspaceErrors,
          nowIso,
          emitProgress,
          generateTextResults
        }).then(async (results) => {
          workspaceStageResults.titleResults = results
          await emitIntermediateResult()
          return results
        })
      : Promise.resolve(emptyTextResults)
    const titleResults = await titlePromise
    workspaceStageResults.titleResults = titleResults
    const descriptionResults = enabledSteps.description
      ? await runWorkspaceTextStep({
          stepKey: 'description',
          taskId: `${taskId}-description`,
          draft: buildWorkspaceDescriptionTaskDraft(workspaceDraft, context, titleResults.textResults),
          workspaceStepStates,
          workspaceErrors,
          nowIso,
          emitProgress,
          generateTextResults
        })
      : emptyTextResults
    workspaceStageResults.descriptionResults = descriptionResults
    await emitIntermediateResult()
    const imagePromise = enabledSteps.image
      ? runWorkspaceImageStep({
          taskId: `${taskId}-series`,
          draft: buildWorkspaceImageTaskDraft(workspaceDraft, context),
          outputDirectory,
          workspaceStepStates,
          workspaceErrors,
          nowIso,
          emitProgress,
          generateImageResults,
          onPartialImageResults: async (partialResult) => {
            workspaceStageResults.imageResults = partialResult
            await emitIntermediateResult()
          }
        }).then(async (results) => {
          workspaceStageResults.imageResults = results
          await emitIntermediateResult()
          return results
        })
      : Promise.resolve(emptyImageResults)
    const videoPromise = enabledSteps.video
      ? runWorkspaceVideoStep({
          taskId: `${taskId}-video`,
          draft: buildWorkspaceVideoTaskDraft(workspaceDraft, context, titleResults.textResults, descriptionResults.textResults),
          outputDirectory,
          workspaceStepStates,
          workspaceErrors,
          nowIso,
          emitProgress,
          generateVideoResults
        })
      : Promise.resolve(emptyVideoResults)
    const imageResults = await imagePromise
    workspaceStageResults.imageResults = imageResults
    const videoResults = await videoPromise
    workspaceStageResults.videoResults = videoResults
    await emitIntermediateResult()

    await emitProgress({
      progress: 100,
      status: workspaceErrors.length ? 'failed' : 'succeeded',
      error: workspaceErrors.join(' | ')
    })

    return buildWorkspaceResultPayload({
      taskId,
      workspaceProjectName: context.workspaceProjectName,
      titleResults,
      descriptionResults,
      imageResults,
      videoResults,
      workspaceStepStates,
      workspaceErrors
    })
  }

  if (menuKey === 'series-generate') {
    const normalizedAssignments = normalizePromptAssignments(
      draft.promptAssignments,
      Math.max(1, Array.isArray(draft.seriesSourceItems) && draft.seriesSourceItems.length ? draft.seriesSourceItems.length : (Number(draft.generateCount) || 1))
    )
    const normalizedSourceItems = normalizeSeriesSourceItems(draft.seriesSourceItems, normalizedAssignments, draft.size)
    const normalizedDraft = {
      ...draft,
      sourceImage: normalizeImageAsset(draft.sourceImage) || normalizedSourceItems[0]?.sourceImage || null,
      seriesSourceItems: normalizedSourceItems,
      promptAssignments: normalizedAssignments.map((assignment) => ({
        ...assignment,
        prompt: String(assignment.prompt || draft.prompt || '').trim()
      }))
    }

    return generateImageResults({
      menuKey,
      draft: normalizedDraft,
      taskId,
      outputDirectory,
      onProgress,
      onPartialResult: typeof onIntermediateResult === 'function'
        ? async (partialResult) => onIntermediateResult(partialResult)
        : undefined
    })
  }

  if (menuKey === 'video-generate') {
    const contextLines = buildProjectScopedGenerationContextLines(draft)
    const normalizedDraft = {
      ...draft,
      prompt: [
        `商品名称：${draft.productName || '未提供'}`,
        ...contextLines,
        String(draft.prompt || '').trim()
      ].filter(Boolean).join('\n')
    }

    return generateVideoResults({
      draft: normalizedDraft,
      taskId,
      outputDirectory,
      onProgress
    })
  }

  if (menuKey === 'title-generate') {
    const response = await generateTextResults({
      draft: buildStandaloneTitleTaskDraft(draft),
      onProgress
    })
    const results = Array.isArray(response)
      ? response
      : (Array.isArray(response?.textResults) ? response.textResults : [])

    return {
      textResults: results.map((item, index) => ({
        ...(item && typeof item === 'object' ? item : {}),
        id: item?.id || `${taskId}-title-${index + 1}`,
        kind: 'title',
        title: item?.title || `标题 ${index + 1}`
      })),
      comparisonResults: [],
      groupedResults: [],
      usageSummary: response && typeof response === 'object' ? response.usageSummary || null : null,
      summary: null
    }
  }

  if (menuKey === 'description-generate') {
    const response = await generateTextResults({
      draft: buildStandaloneDescriptionTaskDraft(draft),
      onProgress
    })
    const results = Array.isArray(response)
      ? response
      : (Array.isArray(response?.textResults) ? response.textResults : [])

    return {
      textResults: results.map((item, index) => ({
        ...(item && typeof item === 'object' ? item : {}),
        id: item?.id || `${taskId}-description-${index + 1}`,
        kind: 'description',
        title: item?.title || `描述 ${index + 1}`
      })),
      comparisonResults: [],
      groupedResults: [],
      usageSummary: response && typeof response === 'object' ? response.usageSummary || null : null,
      summary: null
    }
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
      id: `${String(group.id || `${taskId}-group-${groupIndex + 1}`)}-export-folder`,
      name: folderName,
      directoryPath: groupDirectory,
      itemCount: (group.outputs || []).length,
      groupTitle: folderName
    }))
  }

  if (resultPayload.workspaceResult && typeof resultPayload.workspaceResult === 'object') {
    const persistedGroupedOutputs = persistedResultPayload.groupedResults.flatMap((group) => {
      return Array.isArray(group.outputs) ? group.outputs : []
    })

    persistedResultPayload.workspaceResult = {
      ...resultPayload.workspaceResult,
      images: persistedGroupedOutputs
        .filter((item) => isGeneratedImageOutput(item))
        .map((item) => normalizeGeneratedMediaOutput(item)),
      video: (() => {
        const matchedVideo = persistedGroupedOutputs.find((item) => isGeneratedVideoOutput(item))
        return matchedVideo ? normalizeGeneratedMediaOutput(matchedVideo) : null
      })()
    }
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
    return (draft.projectId && draft.sourceImage) ? 1 : 0
  }

  if (menuKey === 'series-generate') {
    return Array.isArray(draft.seriesSourceItems) && draft.seriesSourceItems.length
      ? draft.seriesSourceItems.length
      : (draft.sourceImage ? 1 : 0)
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
  const usageSummary = resultPayload.usageSummary && typeof resultPayload.usageSummary === 'object'
    ? resultPayload.usageSummary
    : null

  return {
    ...resultPayload,
    summary: {
      ...summary,
      statusLabel: '已完成',
      modelLabel: models.length ? `使用模型 ${models.join(' / ')}` : '',
      resultCountLabel: `结果数量 ${resultCount}`,
      elapsedLabel: formatElapsedLabel(elapsedMilliseconds),
      usageLabel: usageSummary ? `消耗 ${Number(usageSummary.totalAmountCny || 0).toFixed(2)} CNY` : ''
    }
  }
}

function resolveEstimatedInputCount(menuKey, draft = {}) {
  if (menuKey === 'workspace') {
    return (draft.projectId && draft.sourceImage) ? 1 : 0
  }

  if (menuKey === 'series-generate') {
    return Array.isArray(draft.seriesSourceItems) && draft.seriesSourceItems.length
      ? draft.seriesSourceItems.length
      : (draft.sourceImage ? 1 : 0)
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
      (draft.sourceImage ? (Math.max(1, Number(draft.generateCount) || 4) + 1) : 0)
  }

  if (menuKey === 'title-generate') {
    return Math.max(1, Number(draft.titleQuantity) || 1)
  }

  if (menuKey === 'description-generate') {
    return Math.max(1, Number(draft.descriptionQuantity) || 1)
  }

  if (menuKey === 'series-generate') {
    return Math.max(1, Number(draft.batchCount) || 1) * resolveGroupImageCount(menuKey, draft)
  }

  return 0
}

function resolveTaskTitle(menuKey, draft = {}) {
  if (menuKey === 'workspace') {
    return `${resolveWorkspaceProjectDisplayName(draft)} / 全链路生成`
  }

  if (menuKey === 'title-generate') {
    return `标题生成 ${Math.max(1, Number(draft.titleQuantity) || 1)} 条`
  }

  if (menuKey === 'description-generate') {
    return `描述生成 ${Math.max(1, Number(draft.descriptionQuantity) || 1)} 条`
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
    return Math.max(
      1,
      Math.min(
        MAX_SERIES_GENERATE_GROUP_SIZE,
        Array.isArray(draft.seriesSourceItems) && draft.seriesSourceItems.length
          ? draft.seriesSourceItems.length
          : (Number(draft.generateCount) || 1)
      )
    )
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
  error = '',
  groupImageCount = 0,
  totalSubtaskCount = 0,
  completedSubtaskCount = 0,
  failedSubtaskCount = 0,
  currentGroupIndex = 0,
  currentGroupCompletedCount = 0,
  currentGroupTotalCount = 0,
  usage = null
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

  if (usage && typeof usage === 'object') {
    nextTask.usage = {
      totalAmountCny: Math.max(0, Number(usage.totalAmountCny) || 0),
      currency: String(usage.currency || 'CNY').trim() || 'CNY',
      billedAt: String(usage.billedAt || '').trim(),
      lines: Array.isArray(usage.lines)
        ? usage.lines.map((line) => ({
            kind: String(line?.kind || '').trim(),
            label: String(line?.label || '').trim(),
            model: String(line?.model || '').trim(),
            units: Math.max(0, Number(line?.units) || 0),
            unitPriceCny: Math.max(0, Number(line?.unitPriceCny) || 0),
            amountCny: Math.max(0, Number(line?.amountCny) || 0)
          }))
        : []
    }
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
  const failedOutputs = Array.isArray(groupedProgress?.groupedResults)
    ? groupedProgress.groupedResults.flatMap((group) => Array.isArray(group.outputs) ? group.outputs : [])
        .filter((output) => output?.status === 'failed')
    : []
  const successfulGroupedOutputs = Array.isArray(groupedProgress?.groupedResults)
    ? groupedProgress.groupedResults.flatMap((group) => Array.isArray(group.outputs) ? group.outputs : [])
        .filter((output) => output?.status !== 'failed')
    : []
  const failedMessages = failedOutputs
    .map((output) => String(output?.error || '').trim())
    .filter(Boolean)
  const workspaceErrors = Array.isArray(resultPayload?.workspaceErrors)
    ? resultPayload.workspaceErrors.map((item) => String(item || '').trim()).filter(Boolean)
    : []
  const hasPartialFailure = failedOutputs.length > 0 || workspaceErrors.length > 0
  const hasSuccessfulWorkspaceText = Array.isArray(resultPayload?.textResults) && resultPayload.textResults.length > 0
  const hasSuccessfulOutputs = hasSuccessfulWorkspaceText || successfulGroupedOutputs.length > 0
  const normalizedErrorMessage = Array.from(new Set([...failedMessages, ...workspaceErrors])).join('；')
  const usageSummary = resultPayload?.usageSummary && typeof resultPayload.usageSummary === 'object'
    ? resultPayload.usageSummary
    : null
  const finalStatus = hasPartialFailure
    ? (hasSuccessfulOutputs ? '部分完成' : '失败')
    : '已完成'

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
    status: finalStatus,
    progress: 100,
    error: normalizedErrorMessage,
    usage: usageSummary,
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

function createStudioWorkspaceService({
  store,
  settingsService,
  authorizationService,
  remoteLicensePlatformClient,
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
  draftPersistDebounceMs = 250,
  exportTaskDirectory: exportTaskDirectoryDependency = defaultExportTaskDirectory,
  generateImageResults,
  generateTextResults,
  generateVideoResults,
  taskManagerService
}) {
  const generateImageResultsDependency = generateImageResults || createMissingGenerationDependency('image')
  const generateTextResultsDependency = generateTextResults || createMissingGenerationDependency('text')
  const generateVideoResultsDependency = generateVideoResults || createMissingGenerationDependency('video')
  const requestBinary = async (targetUrl) => {
    const normalizedUrl = trimString(targetUrl)
    if (!normalizedUrl) {
      throw new Error('Remote source image url is required.')
    }

    const resolvedBaseUrl = normalizeBaseUrl(settingsService?.getSettings?.()?.authPlatform?.baseUrl || '')
    const response = await axios.request({
      method: 'get',
      url: isAbsoluteHttpUrl(normalizedUrl) || !resolvedBaseUrl
        ? normalizedUrl
        : `${resolvedBaseUrl}${normalizedUrl}`,
      responseType: 'arraybuffer',
      timeout: 20000
    })

    return {
      buffer: Buffer.isBuffer(response.data) ? response.data : Buffer.from(response.data),
      contentType: trimString(response.headers?.['content-type'] || '')
    }
  }
  const queuedTaskExecutions = []
  const activeTaskControllers = new Map()
  let isTaskQueueRunning = false
  let isLaunchingQueuedTasks = false
  let taskQueuePromise = Promise.resolve()
  let resolveTaskQueuePromise = null
  let cachedStudioState = null
  let pendingStateFlushTimer = null
  let hasPendingStateFlush = false

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

  const workspaceExportService = createWorkspaceExportService({
    getStoredState,
    getResolvedExportItemsByMenu: (...args) => workspaceStateMaintenanceService.getResolvedExportItemsByMenu(...args),
    menuLabelMap,
    ensureDirectory: ensureDirectoryDependency,
    writeFile,
    mkdtemp,
    copyFile,
    copyDirectory,
    removeDirectory,
    getAvailableDiskSpaceBytes: getAvailableDiskSpaceBytesDependency,
    exportTaskDirectory: exportTaskDirectoryDependency,
    runtimeLogger
  })
  const workspaceCreditService = createWorkspaceCreditService({
    settingsService,
    remoteLicensePlatformClient,
    getNow
  })
  const workspaceProjectRunService = createWorkspaceProjectRunService({
    createDefaultProjectRunStepStates,
    resolveWorkspaceEnabledRunSteps,
    resolveProjectRunStepKey,
    normalizeProjectRun,
    normalizeProductProject,
    normalizeStringList,
    sanitizePathSegment
  })
  const workspaceProductProjectService = createWorkspaceProductProjectService({
    getStoredState,
    saveState,
    createId,
    getNow,
    normalizeProductProjects,
    resolveActiveProductProjectId,
    buildEmptyProductProject,
    buildProjectCardFromAsset,
    updateProductProjectFields,
    upsertProductProject,
    attachTaskRefToProductProject,
    buildWorkspaceProjectDraft,
    applyWorkspaceTextResultsToProject,
    applyImageResultsToProject,
    applyVideoResultsToProject,
    attachProjectRunToProject: workspaceProjectRunService.attachProjectRunToProject,
    normalizeImageAsset,
    inputRootDirectory: INPUT_ROOT_DIRECTORY,
    outputRootDirectory: OUTPUT_ROOT_DIRECTORY
  })
  const workspaceTaskExecutionService = createWorkspaceTaskExecutionService({
    createTaskExecutionController,
    activeTaskControllers,
    getNow,
    getStoredState,
    persistTaskAndState,
    ensureDirectory: ensureDirectoryDependency,
    persistSourceFiles: persistSourceFilesDependency,
    buildRunningTaskSummary,
    buildFailedTaskSummary,
    buildTaskSummary,
    normalizeTaskProgress,
    buildResultPayload,
    generateImageResults: generateImageResultsDependency,
    generateTextResults: generateTextResultsDependency,
    generateVideoResults: generateVideoResultsDependency,
    saveStudioResults,
    writeFile,
    enrichResultPayloadSummary,
    buildWorkspaceProjectDraft,
    attachTaskRefToProductProject,
    applyWorkspaceTextResultsToProject,
    applyImageResultsToProject,
    applyVideoResultsToProject,
    upsertProductProject,
    applyTaskResultToProjects: (...args) => workspaceProductProjectService.applyTaskResultToProjects(...args),
    normalizeProjectRuns,
    upsertProjectRun,
    workspaceProjectRunService,
    settingsService,
    workspaceCreditService,
    safeRuntimeLog,
    runtimeLogger
  })
  const workspaceTaskLifecycleService = createWorkspaceTaskLifecycleService({
    getStoredState,
    getStoredTasks,
    settingsService,
    authorizationService,
    createId,
    createTaskNumber,
    getNow,
    formatDisplayDateTime,
    getTaskDataDirectories,
    normalizeDraftForMenu,
    createDefaultDrafts,
    createDefaultResultsByMenu,
    buildAgentReadinessSnapshot,
    ensureDraftWithinCapability,
    validateTaskScale,
    buildQueuedTaskSummary,
    persistTaskAndState,
    workspaceProductProjectService,
    workspaceProjectRunService,
    upsertProjectRun,
    syncCreditStateWithRealtimeBalance,
    workspaceCreditService,
    enqueueTaskExecution,
    outputDirectoryResolver: (taskId, menuKey, taskDataDirectories) => {
      return taskDataDirectories({
        featureKey: menuKey,
        taskId
      })
    }
  })
  const workspaceStateMaintenanceService = createWorkspaceStateMaintenanceService({
    getStoredState,
    getStoredTasks,
    saveState,
    persistTaskAndState,
    safeRuntimeLog,
    runtimeLogger,
    buildPendingConfirmationTaskSummary,
    createDefaultDrafts,
    createDefaultResultsByMenu,
    createDefaultExportItemsByMenu,
    createDefaultRequestMetrics,
    scanStoredExportItemsByMenu,
    mergeExportItemsByMenu,
    outputRootDirectory,
    readdirSync,
    statSync,
    getNowMs,
    exportScanCacheTtlMs,
    queuedTaskExecutions,
    activeTaskControllers,
    normalizeProjectRuns,
    upsertProjectRun
  })
  const workspaceSnapshotService = createWorkspaceSnapshotService({
    settingsService,
    getStoredState,
    getStoredTasks,
    getResolvedExportItemsByMenu: (...args) => workspaceStateMaintenanceService.getResolvedExportItemsByMenu(...args),
    buildAgentReadinessSnapshot,
    refreshDashboardCredits: (...args) => workspaceCreditService.refreshDashboardCredits(...args),
    hydrateResultsByMenuForDisplay,
    hydrateProjectRunsForDisplay,
    hydrateProductProjectsForDisplay,
    normalizeRequestMetrics,
    sortTasks,
    countCurrentResults,
    menuItems: publicSnapshotMenuItems,
    stateMenuItems: runtimeStateMenuItems,
    workspaceDashboardSections: publicWorkspaceDashboardSections,
    menuLabelMap: runtimeStateMenuLabelMap,
    taskMenuMapByCategory: publicSnapshotTaskMenuMapByCategory
  })

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
      workspaceStateMaintenanceService.invalidateExportItemsCache()
    }

    if (taskManagerService && typeof taskManagerService.saveTask === 'function') {
      await taskManagerService.saveTask(task)
    }

    return task
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
    return workspaceTaskExecutionService.runQueuedTaskExecution({
      menuKey,
      draft,
      taskId,
      taskNumber,
      createdAt,
      inputDirectory,
      outputDirectory,
      projectRunId
    })
  }

  async function resolveAllowedProjectConcurrency() {
    try {
      const activationStatus = authorizationService && typeof authorizationService.getActivationStatus === 'function'
        ? await authorizationService.getActivationStatus()
        : {}
      const capability = getActiveCapabilityConfig(activationStatus)
      return Math.max(1, Number(capability.taskConcurrencyLimit) || 1)
    } catch {
      return 1
    }
  }

  function finalizeTaskQueueIfIdle() {
    if (queuedTaskExecutions.length > 0 || activeTaskControllers.size > 0 || !isTaskQueueRunning || isLaunchingQueuedTasks) {
      return
    }

    isTaskQueueRunning = false
    const resolve = resolveTaskQueuePromise
    resolveTaskQueuePromise = null
    resolve?.()
  }

  async function launchQueuedTasksUpToLimit() {
    if (isLaunchingQueuedTasks || !isTaskQueueRunning) {
      return
    }

    isLaunchingQueuedTasks = true
    try {
      const projectConcurrencyLimit = await resolveAllowedProjectConcurrency()

      while (queuedTaskExecutions.length && activeTaskControllers.size < projectConcurrencyLimit) {
        const nextExecution = queuedTaskExecutions.shift()
        Promise.resolve(runQueuedTaskExecution(nextExecution))
          .catch(async (error) => {
            await safeRuntimeLog(runtimeLogger, {
              level: 'error',
              event: 'studio-task-queue-launch-failed',
              taskId: nextExecution?.taskId || '',
              menuKey: nextExecution?.menuKey || '',
              error: String(error?.message || error || 'Unknown queue execution error')
            })
          })
          .finally(() => {
            launchQueuedTasksUpToLimit().catch(() => undefined)
            finalizeTaskQueueIfIdle()
          })
      }
    } finally {
      isLaunchingQueuedTasks = false
      finalizeTaskQueueIfIdle()
    }
  }

  function enqueueTaskExecution(executionPayload) {
    queuedTaskExecutions.push(executionPayload)

    if (!isTaskQueueRunning) {
      isTaskQueueRunning = true
      taskQueuePromise = new Promise((resolve) => {
        resolveTaskQueuePromise = resolve
      })
    }

    launchQueuedTasksUpToLimit().catch(() => undefined)
  }

  cachedStudioState = mergeStudioState(store.get(STUDIO_WORKSPACE_KEY, {}))

  function getStoredState() {
    return cachedStudioState
  }

  function getStoredTasks(state = getStoredState()) {
    if (taskManagerService && typeof taskManagerService.listTasks === 'function') {
      return sortTasks((taskManagerService.listTasks() || []).map((task) => normalizeTaskRecord(task)))
    }

    return sortTasks(state.tasks)
  }

  function flushPendingStateWrites(force = false) {
    if (pendingStateFlushTimer) {
      clearTimeout(pendingStateFlushTimer)
      pendingStateFlushTimer = null
    }

    if (!cachedStudioState) {
      return cachedStudioState
    }

    if (!force && !hasPendingStateFlush) {
      return cachedStudioState
    }

    store.set(STUDIO_WORKSPACE_KEY, cachedStudioState)
    hasPendingStateFlush = false
    return cachedStudioState
  }

  function saveState(nextState, { deferred = false } = {}) {
    cachedStudioState = mergeStudioState(nextState)

    if (!deferred) {
      return flushPendingStateWrites(true)
    }

    hasPendingStateFlush = true
    if (pendingStateFlushTimer) {
      clearTimeout(pendingStateFlushTimer)
    }
    pendingStateFlushTimer = setTimeout(() => {
      flushPendingStateWrites()
    }, Math.max(0, Number(draftPersistDebounceMs) || 0))

    return cachedStudioState
  }

  async function syncCreditStateWithRealtimeBalance() {
    return workspaceCreditService.syncCreditStateWithRealtimeBalance()
  }

  function getSnapshot() {
    return workspaceSnapshotService.getSnapshot()
  }

  async function reconcileRuntimeStateBeforeSnapshot() {
    const reconciledTasks = await workspaceStateMaintenanceService.reconcileOrphanedActiveTasks()
    await workspaceStateMaintenanceService.reconcileOrphanedProjectRuns(reconciledTasks)
  }

  async function getDisplaySnapshot() {
    await reconcileRuntimeStateBeforeSnapshot()
    return workspaceSnapshotService.getDisplaySnapshot()
  }

  async function getRuntimeSnapshot() {
    await reconcileRuntimeStateBeforeSnapshot()
    return workspaceSnapshotService.getRuntimeSnapshot()
  }

  async function saveDraft({ menuKey = 'workspace', patch = {} } = {}) {
    if (!runtimeStateMenuKeySet.has(menuKey)) {
      return {}
    }

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
    }, { deferred: true })

    return nextDraft
  }

  async function resolveProjectPatchWithImportedSourceImage(patch = {}, projectId = '') {
    const nextPatch = patch && typeof patch === 'object' ? { ...patch } : {}
    const normalizedProjectId = trimString(projectId)
    const sourceImageImportUrl = trimString(nextPatch.sourceImageImportUrl || nextPatch.metadata?.selectionSource?.primaryImageUrl || '')

    delete nextPatch.sourceImageImportUrl

    if (!sourceImageImportUrl || !normalizedProjectId) {
      return nextPatch
    }

    const importedSourceImage = await importRemoteProjectSourceImage({
      sourceImageImportUrl,
      projectId: normalizedProjectId,
      remoteLicensePlatformClient,
      settingsService,
      ensureDirectory: ensureDirectoryDependency,
      writeFile,
      requestBinary
    })

    if (!importedSourceImage) {
      return nextPatch
    }

    return {
      ...nextPatch,
      assets: {
        ...(nextPatch.assets && typeof nextPatch.assets === 'object' ? nextPatch.assets : {}),
        sourceImages: [importedSourceImage]
      }
    }
  }

  async function createProject({
    productName = '',
    platform = 'temu',
    language = 'zh-CN',
    patch = null
  } = {}) {
    const nextProjectId = `project-${createId()}`
    const nextPatch = await resolveProjectPatchWithImportedSourceImage(patch, nextProjectId)

    return workspaceProductProjectService.createProject({
      projectId: nextProjectId,
      productName,
      platform,
      language,
      patch: nextPatch
    })
  }

  async function updateProject({
    projectId = '',
    patch = {}
  } = {}) {
    const nextPatch = await resolveProjectPatchWithImportedSourceImage(patch, projectId)

    return workspaceProductProjectService.updateProject({
      projectId,
      patch: nextPatch
    })
  }

  async function deleteProject({
    projectId = ''
  } = {}) {
    return workspaceProductProjectService.deleteProject({
      projectId
    })
  }

  async function createTask({ menuKey = 'workspace', draft: incomingDraft } = {}) {
    return workspaceTaskLifecycleService.createTask({
      menuKey,
      draft: incomingDraft
    })
  }

  async function cancelTask({
    taskId = '',
    projectId = ''
  } = {}) {
    const normalizedTaskId = String(taskId || '').trim()
    const normalizedProjectId = String(projectId || '').trim()
    const latestState = getStoredState()
    const storedTasks = getStoredTasks(latestState)
    const storedProjectRuns = normalizeProjectRuns(latestState.projectRuns)

    let targetTask = normalizedTaskId
      ? storedTasks.find((item) => item.id === normalizedTaskId) || null
      : null
    let targetProjectRun = null

    if (!targetTask && normalizedProjectId) {
      targetProjectRun = storedProjectRuns.find((item) => item.projectId === normalizedProjectId) || null
      if (targetProjectRun?.taskId) {
        targetTask = storedTasks.find((item) => item.id === targetProjectRun.taskId) || null
      }
    }

    if (!targetProjectRun && targetTask) {
      targetProjectRun = storedProjectRuns.find((item) => item.taskId === targetTask.id) || null
    }

    if (!targetTask) {
      throw new Error('未找到可中断的任务')
    }

    const isQueuedTask = queuedTaskExecutions.some((item) => item?.taskId === targetTask.id)
    const activeController = activeTaskControllers.get(targetTask.id) || null
    const cancelReason = '用户手动结束任务'

    if (isQueuedTask) {
      const queueIndex = queuedTaskExecutions.findIndex((item) => item?.taskId === targetTask.id)
      if (queueIndex >= 0) {
        queuedTaskExecutions.splice(queueIndex, 1)
      }
    }

    if (activeController) {
      activeController.stop(cancelReason)
    }

    const canceledTask = buildFailedTaskSummary({
      menuKey: targetTask.menuKey,
      draft: {
        projectName: targetTask.title,
        batchCount: targetTask.batchCount,
        generateCount: targetTask.groupImageCount
      },
      taskId: targetTask.id,
      taskNumber: targetTask.taskNumber,
      createdAt: targetTask.createdAt,
      inputDirectory: targetTask.inputDirectory,
      outputDirectory: targetTask.outputDirectory,
      errorMessage: cancelReason
    })

    let projectRunsPatch = null
    if (targetProjectRun) {
      projectRunsPatch = upsertProjectRun(latestState.projectRuns, workspaceProjectRunService.buildFailedProjectRun({
        projectRun: targetProjectRun,
        menuKey: targetProjectRun.triggerMenuKey || targetTask.menuKey,
        errorMessage: cancelReason,
        failedAt: getNow()
      }))
    }

    await persistTaskAndState({
      task: canceledTask,
      projectRunsPatch,
      activeProjectRunId: targetProjectRun ? targetProjectRun.id : null
    })

    return {
      ok: true,
      taskId: targetTask.id,
      projectRunId: targetProjectRun?.id || '',
      canceled: true
    }
  }

  async function exportProjectBundle({
    projectId = '',
    targetZipPath = ''
  } = {}) {
    return workspaceExportService.exportProjectBundle({
      projectId,
      targetZipPath
    })
  }

  async function clearRuntimeState() {
    return workspaceStateMaintenanceService.clearRuntimeState()
  }

  async function exportSelectedResults({
    menuKey = 'workspace',
    selectedExportIds = [],
    targetZipPath = ''
  } = {}) {
    return workspaceExportService.exportSelectedResults({
      menuKey,
      selectedExportIds,
      targetZipPath
    })
  }

  async function deleteExportItem({
    menuKey = 'workspace',
    exportItemId = '',
    exportItemPath = ''
  } = {}) {
    const normalizedMenuKey = String(menuKey || '').trim()
    const normalizedExportItemId = String(exportItemId || '').trim()
    const normalizedExportItemPath = String(exportItemPath || '').trim()

    if (!normalizedMenuKey || (!normalizedExportItemId && !normalizedExportItemPath)) {
      throw new Error('Export item identity is required')
    }

    const latestState = getStoredState()
    const exportItems = workspaceStateMaintenanceService.getResolvedExportItemsByMenu(latestState)[normalizedMenuKey] || []
    const targetItem = exportItems.find((item) => {
      const itemPath = String(item?.directoryPath || item?.outputDirectory || item?.savedPath || '').trim()
      if (normalizedExportItemPath && itemPath && path.resolve(itemPath) === path.resolve(normalizedExportItemPath)) {
        return true
      }

      return normalizedExportItemId && String(item.id || '').trim() === normalizedExportItemId
    })

    if (!targetItem) {
      const nextStoredExportItems = {
        ...(latestState.exportItemsByMenu || {}),
        [normalizedMenuKey]: Array.isArray(latestState.exportItemsByMenu?.[normalizedMenuKey])
          ? latestState.exportItemsByMenu[normalizedMenuKey].filter((item) => {
              const itemPath = String(item?.directoryPath || item?.outputDirectory || item?.savedPath || '').trim()
              if (normalizedExportItemPath && itemPath && path.resolve(itemPath) === path.resolve(normalizedExportItemPath)) {
                return false
              }

              return normalizedExportItemId
                ? String(item?.id || '').trim() !== normalizedExportItemId
                : true
            })
          : []
      }

      saveState({
        ...latestState,
        exportItemsByMenu: nextStoredExportItems
      })
      workspaceStateMaintenanceService.invalidateExportItemsCache()

      return {
        ok: true,
        menuKey: normalizedMenuKey,
        exportItemId: normalizedExportItemId,
        removedStaleRecord: true
      }
    }

    const targetDirectory = String(targetItem.directoryPath || targetItem.outputDirectory || '').trim()
    const targetFilePath = String(targetItem.savedPath || '').trim()

    if (targetDirectory) {
      await fs.rm(targetDirectory, { recursive: true, force: true })
    } else if (targetFilePath) {
      await fs.rm(targetFilePath, { force: true })
    } else {
      throw new Error('Export item path is missing')
    }

    workspaceStateMaintenanceService.invalidateExportItemsCache()

    const refreshedState = getStoredState()
    const nextResolvedExportItems = workspaceStateMaintenanceService.getResolvedExportItemsByMenu(refreshedState)
    saveState({
      ...refreshedState,
      exportItemsByMenu: nextResolvedExportItems
    })

    return {
      ok: true,
      menuKey: normalizedMenuKey,
      exportItemId: normalizedExportItemId
    }
  }

  return {
    getSnapshot,
    getDisplaySnapshot,
    getRuntimeSnapshot,
    createProject,
    updateProject,
    deleteProject,
    saveDraft,
    createTask,
    cancelTask,
    clearRuntimeState,
    exportSelectedResults,
    exportProjectBundle,
    deleteExportItem,
    flushPendingStateWrites,
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
  createStudioWorkspaceService
}
