<script setup>
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import {
  imageModelOptions,
  imageSizeOptions,
  imageTemplateDefaultOrder,
  imageTemplateTypeMap,
  languageOptions,
  seriesImageTemplateOptions,
  videoAspectRatioOptions,
  videoDurationOptions,
  videoModelOptions,
  videoMotionOptions,
  videoResolutionOptions
} from '../utils/generatorFormOptions'

const props = defineProps({
  productProjects: { type: Array, default: () => [] },
  projectRuns: { type: Array, default: () => [] },
  activeProjectId: { type: String, default: '' },
  focusProjectId: { type: String, default: '' },
  draft: { type: Object, default: () => ({}) },
  submitButtonState: { type: String, default: 'idle' },
  promptTemplates: { type: Array, default: () => [] },
  publishState: { type: Object, default: () => ({}) },
  selectionManifest: { type: Object, default: () => ({ generatedAt: '', boards: [] }) },
  selectionPlatforms: { type: Array, default: () => [] },
  selectionSites: { type: Array, default: () => [] },
  selectionState: {
    type: Object,
    default: () => ({
      items: [],
      totalItems: 0,
      platform: 'temu',
      boardType: 'hot-sale',
      siteCode: '',
      keyword: '',
      isLoading: false,
      error: ''
    })
  }
})

const emit = defineEmits([
  'create-project',
  'run-project',
  'cancel-task',
  'update-draft',
  'save-project-template',
  'replace-project-image',
  'update-project',
  'delete-project',
  'copy-text',
  'open-images',
  'open-video',
  'open-resource',
  'export-project',
  'open-generator',
  'open-project-settings',
  'sync-publish-draft',
  'publish-platform-change',
  'publish-channel-account-change',
  'publish-preview',
  'publish-create-task',
  'publish-sync-task',
  'publish-refresh-task',
  'publish-retry-task',
  'selection-query-change',
  'selection-import'
])

const inspectedProjectId = ref('')
const storageSortMode = ref('updated-desc')
const storageRefreshToken = ref(0)
const queuePage = ref(1)
const queuePageSize = 5
const flowDurationTick = ref(Date.now())
let flowDurationTimer = null
const storageContextMenu = ref({
  visible: false,
  x: 0,
  y: 0,
  item: null
})

const projectRunMap = computed(() => new Map((props.projectRuns || []).map((item) => [item.id, item])))

const sortedProjects = computed(() => {
  return [...(props.productProjects || [])].sort((left, right) => {
    const rightTime = new Date(right?.updatedAt || right?.createdAt || 0).getTime()
    const leftTime = new Date(left?.updatedAt || left?.createdAt || 0).getTime()
    return rightTime - leftTime
  })
})

const activeProjectEntry = computed(() => {
  const projectId = String(props.activeProjectId || props.focusProjectId || sortedProjects.value[0]?.id || '').trim()
  const project = sortedProjects.value.find((item) => item.id === projectId) || sortedProjects.value[0] || null
  if (!project) return null

  return {
    project,
    latestRun: projectRunMap.value.get(project.latestRunId) || null
  }
})

const inspectedProjectEntry = computed(() => {
  const candidateId = String(inspectedProjectId.value || '').trim()
  if (!candidateId) return null

  const project = sortedProjects.value.find((item) => item.id === candidateId) || null
  if (!project) return null

  return {
    project,
    latestRun: projectRunMap.value.get(project.latestRunId) || null
  }
})

const currentProjectImagePreview = computed(() => {
  return props.draft?.sourceImage?.preview || activeProjectEntry.value?.project?.assets?.sourceImages?.[0]?.preview || ''
})

const promptCategoryAliases = {
  title: '标题',
  description: '描述',
  image: '图片',
  video: '视频',
  '标题': '标题',
  '描述': '描述',
  '图片': '图片',
  '视频': '视频'
}

function normalizePromptCategory(category = '') {
  const normalized = String(category || '').trim()
  return promptCategoryAliases[normalized] || normalized
}

function hasUsableTemplateId(template = null) {
  return Boolean(String(template?.id || '').trim())
}

const titlePromptTemplates = computed(() => {
  return (props.promptTemplates || []).filter((item) => {
    return hasUsableTemplateId(item) && normalizePromptCategory(item?.category) === '标题'
  })
})

const descriptionPromptTemplates = computed(() => {
  return (props.promptTemplates || []).filter((item) => {
    return hasUsableTemplateId(item) && normalizePromptCategory(item?.category) === '描述'
  })
})

const imagePromptTemplates = computed(() => {
  return (props.promptTemplates || []).filter((item) => {
    return hasUsableTemplateId(item) && normalizePromptCategory(item?.category) === '图片'
  })
})

const videoPromptTemplates = computed(() => {
  return (props.promptTemplates || []).filter((item) => {
    return hasUsableTemplateId(item) && normalizePromptCategory(item?.category) === '视频'
  })
})

const workspaceStepOptions = [
  { key: 'title', label: '标题' },
  { key: 'description', label: '描述' },
  { key: 'image', label: '套图' },
  { key: 'video', label: '视频' }
]

const workspaceStageOrder = ['title', 'description', 'image', 'video']

function resolveProjectName(project = {}) {
  return String(project?.name || project?.baseInfo?.productName || '未命名项目').trim() || '未命名项目'
}

function resolveProjectPlatform(project = {}) {
  const platform = Array.isArray(project?.platformTarget) ? project.platformTarget.join(' / ') : ''
  return platform || '未设置平台'
}

function resolveProjectLanguage(project = {}) {
  return String(project?.baseInfo?.language || 'zh-CN').trim() || 'zh-CN'
}

const normalizedDraft = computed(() => props.draft || {})
const activeProjectGenerationConfig = computed(() => {
  const generationConfig = activeProjectEntry.value?.project?.generationConfig
  return generationConfig && typeof generationConfig === 'object' ? generationConfig : {}
})

function resolveDraftValue(field, fallback = '') {
  const value = normalizedDraft.value?.[field]
  if (value === undefined || value === null || value === '') {
    const projectValue = activeProjectGenerationConfig.value?.[field]
    if (projectValue === undefined || projectValue === null || projectValue === '') {
      return fallback
    }
    return projectValue
  }
  return value
}

function resolveDraftInputValue(field, fallback = '') {
  const value = normalizedDraft.value?.[field]
  if (value !== undefined && value !== null) {
    return String(value)
  }

  const projectValue = activeProjectGenerationConfig.value?.[field]
  if (projectValue !== undefined && projectValue !== null && projectValue !== '') {
    return String(projectValue)
  }

  return String(fallback)
}

function resolveDraftLanguage() {
  return String(resolveDraftValue('language', activeProjectEntry.value?.project?.baseInfo?.language || 'zh-CN')).trim() || 'zh-CN'
}

function resolveDraftImageLanguage() {
  return String(resolveDraftValue('imageLanguage', resolveDraftLanguage())).trim() || resolveDraftLanguage()
}

function resolveDraftProductName() {
  const draftValue = normalizedDraft.value?.productName
  if (draftValue !== undefined && draftValue !== null) {
    return String(draftValue)
  }

  return String(activeProjectEntry.value?.project?.baseInfo?.productName || '').trim()
}

function resolveDraftProjectName() {
  return String(resolveDraftValue('projectName', activeProjectEntry.value?.project?.name || resolveDraftProductName())).trim()
}

function resolveDraftKeywords() {
  const direct = String(resolveDraftValue('keywordsText', '')).trim()
  if (direct) return direct

  const keywords = Array.isArray(activeProjectEntry.value?.project?.baseInfo?.keywords)
    ? activeProjectEntry.value.project.baseInfo.keywords
    : []
  return keywords.join('、').trim()
}

function resolveDraftNotes() {
  return String(resolveDraftValue('notes', activeProjectEntry.value?.project?.generationConfig?.notes || '')).trim()
}

function resolveProjectTemplateSelection() {
  return {
    titleTemplateId: String(resolveDraftValue('titleTemplateId', '') || '').trim(),
    descriptionTemplateId: String(resolveDraftValue('descriptionTemplateId', '') || '').trim(),
    imageTemplateId: String(resolveDraftValue('imageTemplateId', '') || '').trim(),
    videoTemplateId: String(resolveDraftValue('videoTemplateId', '') || '').trim()
  }
}

function resolveProjectGenerateCount() {
  const value = Number(resolveDraftValue('generateCount', 4))
  if (!Number.isFinite(value)) return 4
  return Math.max(1, Math.min(12, Math.round(value)))
}

function resolveProjectImageAssignments() {
  const count = resolveProjectGenerateCount()
  const sourceAssignments = Array.isArray(normalizedDraft.value?.promptAssignments)
    ? normalizedDraft.value.promptAssignments
    : []

  return Array.from({ length: count }, (_unused, index) => {
    const currentAssignment = sourceAssignments[index] && typeof sourceAssignments[index] === 'object'
      ? sourceAssignments[index]
      : {}
    const fallbackTemplateId = imageTemplateDefaultOrder[index] || imageTemplateDefaultOrder[0] || ''
    const templateId = String(currentAssignment.templateId || fallbackTemplateId).trim() || fallbackTemplateId

    return {
      id: String(currentAssignment.id || `workspace-image-template-${index + 1}`),
      index: index + 1,
      templateId,
      imageType: String(currentAssignment.imageType || imageTemplateTypeMap[templateId] || '').trim() || `套图 ${index + 1}`,
      prompt: String(currentAssignment.prompt || '').trim()
    }
  })
}

function resolveDraftSelectValue(field, fallback = '') {
  return String(resolveDraftValue(field, fallback) || fallback).trim()
}

function resolveEnabledSteps() {
  const source = normalizedDraft.value?.enabledSteps && typeof normalizedDraft.value.enabledSteps === 'object'
    ? normalizedDraft.value.enabledSteps
    : {}

  return {
    title: source.title !== false,
    description: source.description !== false,
    image: source.image !== false,
    video: source.video !== false
  }
}

const enabledWorkspaceSteps = computed(() => resolveEnabledSteps())

const requiresSourceImage = computed(() => {
  return enabledWorkspaceSteps.value.image || enabledWorkspaceSteps.value.video
})

function shouldShowStageDivider(stageKey = '') {
  const currentIndex = workspaceStageOrder.indexOf(String(stageKey || '').trim())
  if (currentIndex < 0) {
    return false
  }

  return workspaceStageOrder
    .slice(currentIndex + 1)
    .some((key) => enabledWorkspaceSteps.value[key])
}

function resolveLatestRunStatus(latestRun = null) {
  const status = String(latestRun?.status || '').trim().toLowerCase()
  if (['running', 'processing', 'submitting'].includes(status)) return '生成中'
  if (['pending', 'queued'].includes(status)) return '排队中'
  if (status === 'partial') return '部分完成'
  if (status === 'success') return '已完成'
  if (status === 'failed') return '失败'
  return '未开始'
}

function resolveStepStatus(status = '') {
  if (['running', 'processing', 'submitting'].includes(status)) return '生成中'
  if (['pending', 'queued'].includes(status)) return '排队中'
  if (status === 'partial') return '部分完成'
  if (status === 'failed') return '失败'
  return '未开始'
}

function resolveTaskStatusClass(status = '') {
  const normalized = String(status || '').trim()
  if (['生成中', 'running', 'processing', 'submitting'].includes(normalized)) return 'task-status--running'
  if (['已完成', 'success'].includes(normalized)) return 'task-status--completed'
  if (['部分完成', 'partial'].includes(normalized)) return 'task-status--running'
  if (['失败', 'failed'].includes(normalized)) return 'task-status--failed'
  return 'task-status--waiting'
}

function resolveWorkspaceStepError(latestRun = null, stepKey = '') {
  const stepStates = latestRun?.stepStates && typeof latestRun.stepStates === 'object'
    ? latestRun.stepStates
    : {}
  return String(stepStates?.[stepKey]?.error || '').trim()
}

function resolveWorkspaceFailureSummary(latestRun = null) {
  const stepStates = latestRun?.stepStates && typeof latestRun.stepStates === 'object'
    ? latestRun.stepStates
    : {}
  const stepLabels = {
    title: '标题',
    description: '描述',
    image: '套图',
    video: '视频'
  }

  return Object.entries(stepLabels)
    .map(([stepKey, label]) => {
      const error = String(stepStates?.[stepKey]?.error || '').trim()
      if (!error) return ''
      return `${label}：${error}`
    })
    .filter(Boolean)
}

function resolveQueueStage(project = {}, latestRun = null) {
  if (latestRun?.menuKey === 'title-generate') return '标题'
  if (latestRun?.menuKey === 'description-generate') return '描述'
  if (latestRun?.menuKey === 'series-generate') return '套图'
  if (latestRun?.menuKey === 'video-generate') return '视频'

  const stepStates = latestRun?.stepStates && typeof latestRun.stepStates === 'object'
    ? latestRun.stepStates
    : {}
  const runningStep = [
    ['title', '标题'],
    ['description', '描述'],
    ['image', '套图'],
    ['video', '视频']
  ].find(([stepKey]) => String(stepStates?.[stepKey]?.status || '').trim().toLowerCase() === 'running')

  if (runningStep) {
    return runningStep[1]
  }

  const titleDone = String(project?.content?.selectedTitle || '').trim()
  const descriptionDone = String(project?.content?.selectedDescription || '').trim()
  const imageDone = Array.isArray(project?.assets?.generatedImages) && project.assets.generatedImages.length
  const videoDone = Boolean(project?.assets?.generatedVideo)

  if (!titleDone) return '标题'
  if (!descriptionDone) return '描述'
  if (!imageDone) return '套图'
  if (!videoDone) return '视频'
  return '完成'
}

function resolveQueueProgress(project = {}, latestRun = null) {
  const normalizedStatus = String(latestRun?.status || '').trim().toLowerCase()
  if (normalizedStatus === 'failed' || normalizedStatus === 'success') {
    return 100
  }

  if (typeof latestRun?.progress === 'number') {
    return Math.max(0, Math.min(100, latestRun.progress))
  }

  const titleDone = String(project?.content?.selectedTitle || '').trim()
  const descriptionDone = String(project?.content?.selectedDescription || '').trim()
  const imageDone = Array.isArray(project?.assets?.generatedImages) && project.assets.generatedImages.length
  const videoDone = Boolean(project?.assets?.generatedVideo)
  const count = [titleDone, descriptionDone, imageDone, videoDone].filter(Boolean).length
  return Math.round((count / 4) * 100)
}

function resolveTimeLabel(value = '') {
  const text = String(value || '').trim()
  if (!text) return '暂无'
  const date = new Date(text)
  if (Number.isNaN(date.getTime())) return text
  return `${date.getMonth() + 1}-${date.getDate()} ${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`
}

function resolveProjectContent(project = {}, latestRun = null) {
  const titleText = String(
    project?.content?.selectedTitle ||
    latestRun?.outputs?.selectedTitle ||
    latestRun?.outputs?.title ||
    ''
  ).trim()
  const descriptionText = String(
    project?.content?.selectedDescription ||
    latestRun?.outputs?.selectedDescription ||
    latestRun?.outputs?.description ||
    ''
  ).trim()
  const generatedImages = Array.isArray(project?.assets?.generatedImages) ? project.assets.generatedImages : []
  const generatedVideo = project?.assets?.generatedVideo || null
  const resultLanding = project?.metadata?.resultLanding && typeof project.metadata.resultLanding === 'object'
    ? project.metadata.resultLanding
    : {
        titleRunId: '',
        descriptionRunId: '',
        imageRunId: '',
        videoRunId: ''
      }

  return {
    titleText,
    descriptionText,
    generatedImages,
    generatedVideo,
    resultLanding
  }
}

function resolveLocalMediaUrl(value = '') {
  const source = String(value || '').trim()
  if (!source) return ''
  if (/^(data|https?|file):/i.test(source)) return source

  const normalizedPath = source.replace(/\\/g, '/')
  if (/^[A-Za-z]:\//.test(normalizedPath)) {
    return `file:///${encodeURI(normalizedPath)}`
  }
  if (normalizedPath.startsWith('/')) {
    return `file://${encodeURI(normalizedPath)}`
  }

  return source
}

function resolveMediaPreview(item = {}) {
  return resolveLocalMediaUrl(item.preview || item.thumbnail || item.savedPath || item.path || item.sourceUrl || item.downloadUrl || '')
}

function resolveFileName(value = '') {
  const source = String(value || '').trim()
  if (!source) return '未命名文件'
  return source.replace(/\\/g, '/').split('/').filter(Boolean).pop() || source
}

function resolveVideoInfoRows(video = null) {
  if (!video) return []
  const savedPath = String(video.savedPath || video.path || '').trim()
  const rows = [
    { key: 'name', label: '文件', value: video.title || video.name || resolveFileName(savedPath) },
    { key: 'format', label: '格式', value: resolveFileName(savedPath).split('.').pop()?.toUpperCase() || 'MP4' },
    { key: 'model', label: '模型', value: video.model || video.modelName || '' },
    { key: 'size', label: '大小', value: video.sizeLabel || '' },
    { key: 'path', label: '位置', value: savedPath }
  ]
  return rows.filter((item) => String(item.value || '').trim())
}

function resolvePackageStatus(content) {
  const completedCount = [
    content.titleText,
    content.descriptionText,
    content.generatedImages.length ? 'image' : '',
    content.generatedVideo ? 'video' : ''
  ].filter(Boolean).length

  if (completedCount === 4) return '已完成'
  if (completedCount > 0) return '部分完成'
  return '未完成'
}

const currentProjectSteps = computed(() => {
  const latestRun = activeProjectEntry.value?.latestRun || {}
  const currentContent = resolveProjectContent(activeProjectEntry.value?.project || {}, latestRun)
  const generatedImages = currentContent.generatedImages
  const generatedVideo = currentContent.generatedVideo
  const baseStatus = String(latestRun?.status || '').trim().toLowerCase()
  const stepStates = latestRun?.stepStates && typeof latestRun.stepStates === 'object'
    ? latestRun.stepStates
    : {}
  const resolveWorkspaceStepStatus = (stepKey, hasOutput) => {
    const stepStatus = String(stepStates?.[stepKey]?.status || '').trim().toLowerCase()
    if (hasOutput && stepStatus === 'running') return '生成中'
    if (hasOutput) return '已完成'
    if (stepStatus === 'failed') return '失败'
    if (stepStatus === 'running') return '生成中'
    if (stepStatus === 'success') return '已完成'
    return resolveStepStatus(baseStatus)
  }

  return [
    {
      key: 'title',
      label: '标题',
      count: currentContent.titleText ? 1 : 0,
      status: resolveWorkspaceStepStatus('title', Boolean(currentContent.titleText))
    },
    {
      key: 'description',
      label: '描述',
      count: currentContent.descriptionText ? 1 : 0,
      status: resolveWorkspaceStepStatus('description', Boolean(currentContent.descriptionText))
    },
    {
      key: 'image',
      label: '套图',
      count: generatedImages.length,
      status: resolveWorkspaceStepStatus('image', generatedImages.length > 0)
    },
    {
      key: 'video',
      label: '视频',
      count: generatedVideo ? 1 : 0,
      status: resolveWorkspaceStepStatus('video', Boolean(generatedVideo))
    }
  ]
})

const currentProjectStageLabel = computed(() => {
  return resolveQueueStage(activeProjectEntry.value?.project || {}, activeProjectEntry.value?.latestRun || null)
})

const isCurrentProjectRunning = computed(() => {
  const status = String(activeProjectEntry.value?.latestRun?.status || '').trim().toLowerCase()
  return ['running', 'processing', 'submitting', 'pending', 'queued'].includes(status)
})

function formatFlowStepDuration(durationMs) {
  if (!Number.isFinite(durationMs) || durationMs <= 0) return ''

  const totalSeconds = Math.max(1, Math.round(durationMs / 1000))
  if (totalSeconds < 60) return `${totalSeconds}秒`

  const hours = Math.floor(totalSeconds / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const seconds = totalSeconds % 60

  if (hours > 0) {
    return minutes > 0 ? `${hours}小时${minutes}分` : `${hours}小时`
  }

  return seconds > 0 ? `${minutes}分${seconds}秒` : `${minutes}分`
}

function resolveWorkspaceStepDuration(run, stepKey) {
  flowDurationTick.value

  const stepState = run?.stepStates?.[stepKey]
  const startedAt = stepState?.startedAt ? new Date(stepState.startedAt).getTime() : 0
  if (!startedAt) return ''

  const completedAt = stepState?.completedAt ? new Date(stepState.completedAt).getTime() : 0
  const endedAt = completedAt || Date.now()
  if (!Number.isFinite(endedAt) || endedAt <= startedAt) return ''

  return formatFlowStepDuration(endedAt - startedAt)
}

const currentProjectFlowSteps = computed(() => {
  const runningStage = currentProjectStageLabel.value
  const running = isCurrentProjectRunning.value
  const latestRun = activeProjectEntry.value?.latestRun || null

  return currentProjectSteps.value.map((step, index) => {
    const isDone = step.status === '已完成'
    const isRunning = running && step.status === '生成中' && step.label === runningStage
    const durationLabel = resolveWorkspaceStepDuration(latestRun, step.key)
    const statusLabel = isDone ? '已完成' : isRunning ? '生成中' : step.status

    return {
      ...step,
      error: resolveWorkspaceStepError(latestRun, step.key),
      index: index + 1,
      tone: isDone ? 'done' : isRunning ? 'running' : (step.status === '失败' ? 'failed' : 'pending'),
      isDone,
      isRunning,
      durationLabel,
      statusLine: durationLabel ? `${statusLabel} · ${durationLabel}` : statusLabel
    }
  })
})

const currentProjectCompletion = computed(() => {
  const steps = currentProjectSteps.value
  if (!steps.length) return 0
  const completed = steps.filter((item) => item.status === '已完成').length
  return Math.round((completed / steps.length) * 100)
})

const projectStorageRows = computed(() => {
  storageRefreshToken.value

  const rows = sortedProjects.value.map((project) => {
    const latestRun = projectRunMap.value.get(project.latestRunId) || null
    const content = resolveProjectContent(project, latestRun)

    return {
      id: project.id,
      project,
      latestRun,
      name: resolveProjectName(project),
      updatedAt: project?.updatedAt || project?.createdAt || '',
      status: resolvePackageStatus(content),
      titleCount: content.titleText ? 1 : 0,
      descriptionCount: content.descriptionText ? 1 : 0,
      imageCount: content.generatedImages.length,
      videoCount: content.generatedVideo ? 1 : 0
    }
  })

  if (storageSortMode.value === 'name-asc') {
    return rows.sort((left, right) => left.name.localeCompare(right.name, 'zh-CN'))
  }

  return rows.sort((left, right) => {
    const rightTime = new Date(right.updatedAt || 0).getTime()
    const leftTime = new Date(left.updatedAt || 0).getTime()
    return rightTime - leftTime
  })
})

const allQueueRows = computed(() => {
  return sortedProjects.value.map((project) => {
    const latestRun = projectRunMap.value.get(project.latestRunId) || null
    const status = resolveLatestRunStatus(latestRun)
    const queuePercent = resolveQueueProgress(project, latestRun)
    const currentStage = resolveQueueStage(project, latestRun)

    return {
      id: project.id,
      project,
      latestRun,
      name: resolveProjectName(project),
      platform: resolveProjectPlatform(project),
      status,
      currentStage,
      progress: queuePercent,
      error: String(latestRun?.error || '').trim(),
      isActive: project.id === activeProjectEntry.value?.project?.id
    }
  })
})

const queueTotalPages = computed(() => {
  return Math.max(1, Math.ceil(allQueueRows.value.length / queuePageSize))
})

const activeQueuePage = computed(() => {
  return Math.min(queueTotalPages.value, Math.max(1, queuePage.value))
})

const queueRows = computed(() => {
  const startIndex = (activeQueuePage.value - 1) * queuePageSize
  return allQueueRows.value.slice(startIndex, startIndex + queuePageSize)
})

const queueSummary = computed(() => {
  let queuedCount = 0
  let runningCount = 0

  allQueueRows.value.forEach((item) => {
    if (item.status === '排队中') queuedCount += 1
    if (item.status === '生成中') runningCount += 1
  })

  return { queuedCount, runningCount, totalCount: allQueueRows.value.length }
})

function goToQueuePage(nextPage = 1) {
  queuePage.value = Math.min(queueTotalPages.value, Math.max(1, Number(nextPage) || 1))
}

function updateDraftPatch(patch = {}) {
  emit('update-draft', {
    patch: patch && typeof patch === 'object' ? patch : {}
  })
}

function handleProjectFieldUpdate(field, value) {
  if (field === 'name') {
    updateDraftPatch({
      projectName: value,
      taskName: value
    })
    return
  }

  if (field === 'platform') {
    updateDraftPatch({ platformTargetsText: value })
    return
  }

  if (field === 'productName') {
    updateDraftPatch({
      productName: value,
      projectName: value,
      taskName: value
    })
    return
  }

  updateDraftPatch({ [field]: value })
}

function updateProjectGenerationConfig(patch = {}) {
  updateDraftPatch(patch)
}

function sanitizeNumericInput(value) {
  return String(value ?? '').replace(/[^\d]/g, '')
}

function normalizeNumericInput(value, { fallback, min, max }) {
  const digits = sanitizeNumericInput(value)
  const baseValue = digits ? Number(digits) : fallback
  return String(Math.max(min, Math.min(max, baseValue)))
}

function handleProjectMaxCharsInput(field, value) {
  updateProjectGenerationConfig({
    [field]: sanitizeNumericInput(value)
  })
}

function handleProjectMaxCharsBlur(field, value, options) {
  updateProjectGenerationConfig({
    [field]: normalizeNumericInput(value, options)
  })
}

function handleProjectQuantityInput(field, value) {
  updateProjectGenerationConfig({
    [field]: sanitizeNumericInput(value)
  })
}

function handleProjectQuantityBlur(field, value, { fallback, min = 1, max = 20 } = {}) {
  updateProjectGenerationConfig({
    [field]: normalizeNumericInput(value, { fallback, min, max })
  })
}

function resolveProjectGenerateCountInputValue() {
  const currentValue = normalizedDraft.value?.generateCount
  if (currentValue !== undefined && currentValue !== null) {
    return String(currentValue)
  }

  return String(resolveProjectGenerateCount())
}

function handleProjectGenerateCountInput(value) {
  updateProjectGenerationConfig({
    generateCount: sanitizeNumericInput(value)
  })
}

function handleProjectGenerateCountChange(value) {
  const nextCount = Math.max(1, Math.min(12, Number(value) || 1))
  const nextAssignments = Array.from({ length: nextCount }, (_unused, index) => {
    const currentAssignment = resolveProjectImageAssignments()[index] || {}
    const fallbackTemplateId = imageTemplateDefaultOrder[index] || imageTemplateDefaultOrder[0] || ''
    const templateId = String(currentAssignment.templateId || fallbackTemplateId).trim() || fallbackTemplateId

    return {
      id: String(currentAssignment.id || `workspace-image-template-${index + 1}`),
      index: index + 1,
      templateId,
      imageType: String(imageTemplateTypeMap[templateId] || currentAssignment.imageType || '').trim() || `套图 ${index + 1}`,
      prompt: String(currentAssignment.prompt || '').trim()
    }
  })

  updateProjectGenerationConfig({
    generateCount: nextCount,
    imageTemplateId: nextAssignments[0]?.templateId || '',
    promptAssignments: nextAssignments
  })
}

function handleProjectGenerateCountBlur(value) {
  handleProjectGenerateCountChange(value)
}

function handleProjectImageTemplateChange(index, templateId) {
  const currentAssignments = resolveProjectImageAssignments()
  const matchedPromptTemplate = imagePromptTemplates.value.find((item) => String(item?.id || '').trim() === String(templateId || '').trim())
  const nextAssignments = currentAssignments.map((assignment, assignmentIndex) => {
    if (assignmentIndex !== index) {
      return {
        ...assignment,
        prompt: String(
          normalizedDraft.value?.promptAssignments?.[assignmentIndex]?.prompt || assignment.prompt || ''
        ).trim()
      }
    }

    const normalizedTemplateId = String(templateId || '').trim()
    return {
      ...assignment,
      templateId: normalizedTemplateId,
      imageType: String(imageTemplateTypeMap[normalizedTemplateId] || assignment.imageType || '').trim() || `套图 ${index + 1}`,
      prompt: String(
        matchedPromptTemplate?.prompt ||
        normalizedDraft.value?.promptAssignments?.[assignmentIndex]?.prompt ||
        assignment.prompt ||
        ''
      ).trim()
    }
  })

  updateProjectGenerationConfig({
    imageTemplateId: nextAssignments[0]?.templateId || '',
    promptAssignments: nextAssignments
  })
}

function handleProjectImagePromptChange(index, prompt) {
  const currentAssignments = resolveProjectImageAssignments()
  const nextAssignments = currentAssignments.map((assignment, assignmentIndex) => {
    if (assignmentIndex !== index) {
      return {
        ...assignment,
        prompt: String(
          normalizedDraft.value?.promptAssignments?.[assignmentIndex]?.prompt || assignment.prompt || ''
        ).trim()
      }
    }

    return {
      ...assignment,
      prompt: String(prompt || '')
    }
  })

  updateProjectGenerationConfig({
    imageTemplateId: nextAssignments[0]?.templateId || '',
    promptAssignments: nextAssignments
  })
}

function handleStepToggle(stepKey, checked) {
  updateDraftPatch({
    enabledSteps: {
      ...resolveEnabledSteps(),
      [stepKey]: Boolean(checked)
    }
  })
}

function handlePromptTemplateApply(field, templateId) {
  const project = activeProjectEntry.value?.project
  if (!project?.id) return

  const template = (props.promptTemplates || []).find((item) => String(item?.id || '').trim() === String(templateId || '').trim())
  if (!template) {
    updateProjectGenerationConfig({ [field]: '', [`${field.replace('Prompt', 'TemplateId')}`]: '' })
    return
  }

  updateProjectGenerationConfig({
    [field]: String(template.prompt || ''),
    [`${field.replace('Prompt', 'TemplateId')}`]: String(template.id || '').trim()
  })
}

function handleOpenStep(menuKey) {
  const project = activeProjectEntry.value?.project
  if (!project || !menuKey) return
  emit('open-generator', { project, menuKey })
}

function handleRunProject(project) {
  if (!project?.id) return
  emit('run-project', project)
}

function handleCancelTask(item) {
  if (!item?.project?.id && !item?.id) return
  emit('cancel-task', {
    projectId: String(item?.project?.id || item?.id || '').trim(),
    taskId: String(item?.latestRun?.taskId || '').trim(),
    status: String(item?.status || '').trim()
  })
}

function handleOpenProjectStorage(project) {
  inspectedProjectId.value = String(project?.id || '').trim()
}

function handleSelectProjectStorage(project) {
  inspectedProjectId.value = String(project?.id || '').trim()
}

function closeProjectDetailModal() {
  inspectedProjectId.value = ''
  closeStorageContextMenu()
}

function handleSaveTemplate(project) {
  if (!project?.id) return
  emit('save-project-template', project)
}

function handleCreateProjectFromStorage() {
  emit('create-project')
}

function handleRefreshStorageWorkspace() {
  storageRefreshToken.value += 1
  closeStorageContextMenu()
}

function handleToggleStorageSort() {
  storageSortMode.value = storageSortMode.value === 'updated-desc' ? 'name-asc' : 'updated-desc'
  closeStorageContextMenu()
}

function closeStorageContextMenu() {
  storageContextMenu.value = {
    visible: false,
    x: 0,
    y: 0,
    item: null
  }
}

function handleOpenStorageFolder(project) {
  handleOpenProjectStorage(project)
  closeStorageContextMenu()
}

function handleOpenProjectSettings(project) {
  if (!project?.id) return
  emit('open-project-settings', project)
  closeStorageContextMenu()
}

function handleOpenStorageContextMenu(event, item) {
  if (!item?.id) return
  const viewportWidth = window.innerWidth || 0
  const viewportHeight = window.innerHeight || 0
  const menuWidth = 152
  const menuHeight = 124
  const x = Math.min(event.clientX, Math.max(12, viewportWidth - menuWidth - 12))
  const y = Math.min(event.clientY, Math.max(12, viewportHeight - menuHeight - 12))
  storageContextMenu.value = {
    visible: true,
    x,
    y,
    item
  }
}

function handleStorageContextAction(action) {
  const item = storageContextMenu.value.item
  if (!item?.id) return

  if (action === 'save-template') {
    handleSaveTemplate(item.project)
  } else if (action === 'open-project-settings') {
    handleOpenProjectSettings(item.project)
  } else if (action === 'export-project') {
    emit('export-project', item.id)
  } else if (action === 'delete-project') {
    emit('delete-project', item.id)
  }

  closeStorageContextMenu()
}

function handleOpenInspectedImages() {
  if (!inspectedProjectEntry.value) return
  emit('open-images', {
    project: inspectedProjectEntry.value.project,
    run: inspectedProjectEntry.value.latestRun
  })
}

function handleOpenInspectedVideo() {
  if (!inspectedProjectEntry.value) return
  emit('open-video', {
    project: inspectedProjectEntry.value.project,
    run: inspectedProjectEntry.value.latestRun
  })
}

function handleExportInspectedProject() {
  if (!inspectedProjectEntry.value?.project?.id) return
  emit('export-project', inspectedProjectEntry.value.project.id)
}

function handleFocusQueueProject(project) {
  if (!project?.id) return
  handleOpenProjectStorage(project)
}

onMounted(() => {
  window.addEventListener('pointerdown', closeStorageContextMenu)
  window.addEventListener('blur', closeStorageContextMenu)
  flowDurationTimer = window.setInterval(() => {
    flowDurationTick.value = Date.now()
  }, 1000)
})

onBeforeUnmount(() => {
  window.removeEventListener('pointerdown', closeStorageContextMenu)
  window.removeEventListener('blur', closeStorageContextMenu)
  if (flowDurationTimer) {
    window.clearInterval(flowDurationTimer)
    flowDurationTimer = null
  }
})

function resolveStageMenuKey(stage = '') {
  if (stage === '标题') return 'title-generate'
  if (stage === '描述') return 'description-generate'
  if (stage === '套图') return 'series-generate'
  return 'video-generate'
}
</script>

<template>
  <section class="generator-studio-page work-center-studio">
    <article class="generator-column generator-column--settings">
      <header class="generator-column__header work-center-studio__column-header">
        <div class="work-center-studio__header-copy">
          <strong>项目参数设置</strong>
        </div>
      </header>

      <div class="generator-form">
        <div class="generator-form__group">
          <div class="generator-form__row">
            <span class="generator-form__label">商品名称</span>
            <input
              :value="resolveDraftProductName()"
              type="text"
              placeholder="输入商品名称"
              @input="handleProjectFieldUpdate('productName', $event.target.value)"
            >
          </div>
          <div class="generator-form__row">
            <span class="generator-form__label">语言</span>
            <select
              :value="resolveDraftLanguage()"
              @change="handleProjectFieldUpdate('language', $event.target.value)"
            >
              <option v-for="option in languageOptions" :key="option.value" :value="option.value">
                {{ option.label }}
              </option>
            </select>
          </div>
        </div>

        <div class="generator-form__group work-center-studio__step-grid">
          <div
            v-for="item in workspaceStepOptions"
            :key="item.key"
            class="generator-form__row generator-form__row--checkbox"
            :class="{ 'work-center-studio__step-chip--active': enabledWorkspaceSteps[item.key] }"
          >
            <span class="generator-form__label work-center-studio__step-chip-label">{{ item.label }}</span>
            <label class="work-center-studio__step-chip-control">
              <input
                :checked="enabledWorkspaceSteps[item.key]"
                type="checkbox"
                @change="handleStepToggle(item.key, $event.target.checked)"
              >
            </label>
            <div class="work-center-studio__toggle">
              <span class="work-center-studio__step-chip-state">{{ enabledWorkspaceSteps[item.key] ? '开启' : '关闭' }}</span>
            </div>
          </div>
        </div>

        <div v-if="requiresSourceImage" class="generator-form__row">
          <span class="generator-form__label">原图上传</span>
          <div class="generator-form__asset">
            <button
              class="secondary-action generator-form__asset-button"
              type="button"
              @click="emit('replace-project-image', activeProjectEntry?.project)"
            >
              上传原图
            </button>
            <div class="generator-form__asset-preview">
              <img
                v-if="currentProjectImagePreview"
                class="generator-preview__image generator-preview__image--inline"
                :src="currentProjectImagePreview"
                alt=""
              >
              <div v-else class="generator-form__asset-empty">暂无原图</div>
            </div>
          </div>
        </div>

        <div v-if="enabledWorkspaceSteps.title" class="work-center-studio__stage-section">
          <div class="work-center-studio__stage-heading">
            <strong>标题</strong>
          </div>
          <div class="generator-form__group">
            <div class="generator-form__row">
              <span class="generator-form__label">语言</span>
              <select
                :value="resolveDraftLanguage()"
                @change="handleProjectFieldUpdate('language', $event.target.value)"
              >
                <option v-for="option in languageOptions" :key="option.value" :value="option.value">
                  {{ option.label }}
                </option>
              </select>
            </div>
            <div class="generator-form__row">
              <span class="generator-form__label">字数</span>
              <input
                :value="resolveDraftInputValue('titleMaxChars', 60)"
                type="text"
                inputmode="numeric"
                placeholder="60"
                @input="handleProjectMaxCharsInput('titleMaxChars', $event.target.value)"
                @blur="handleProjectMaxCharsBlur('titleMaxChars', $event.target.value, { fallback: 60, min: 1, max: 300 })"
              >
            </div>
            <div class="generator-form__row">
              <span class="generator-form__label">数量</span>
              <input
                :value="resolveDraftInputValue('titleQuantity', 3)"
                type="text"
                inputmode="numeric"
                placeholder="3"
                @input="handleProjectQuantityInput('titleQuantity', $event.target.value)"
                @blur="handleProjectQuantityBlur('titleQuantity', $event.target.value, { fallback: 3, min: 1, max: 20 })"
              >
            </div>
            <div class="generator-form__row">
              <span class="generator-form__label">标题模板</span>
              <select
                :value="resolveProjectTemplateSelection().titleTemplateId"
                @change="handlePromptTemplateApply('titlePrompt', $event.target.value)"
              >
                <option value="">默认</option>
                <option v-for="item in titlePromptTemplates" :key="item.id" :value="item.id">
                  {{ item.name || '未命名模板' }}
                </option>
              </select>
            </div>
            <div class="generator-form__card work-center-studio__prompt-card">
              <textarea
                :value="resolveDraftValue('titlePrompt', '')"
                rows="6"
                placeholder="标题提示词"
                @input="updateProjectGenerationConfig({ titlePrompt: $event.target.value })"
              ></textarea>
            </div>
          </div>
        </div>

        <div v-if="shouldShowStageDivider('title')" class="work-center-studio__param-divider" aria-hidden="true"></div>

        <div v-if="enabledWorkspaceSteps.description" class="work-center-studio__stage-section">
          <div class="work-center-studio__stage-heading">
            <strong>描述</strong>
          </div>
          <div class="generator-form__group">
            <div class="generator-form__row">
              <span class="generator-form__label">语言</span>
              <select
                :value="resolveDraftLanguage()"
                @change="handleProjectFieldUpdate('language', $event.target.value)"
              >
                <option v-for="option in languageOptions" :key="option.value" :value="option.value">
                  {{ option.label }}
                </option>
              </select>
            </div>
            <div class="generator-form__row">
              <span class="generator-form__label">字数</span>
              <input
                :value="resolveDraftInputValue('descriptionMaxChars', 300)"
                type="text"
                inputmode="numeric"
                placeholder="300"
                @input="handleProjectMaxCharsInput('descriptionMaxChars', $event.target.value)"
                @blur="handleProjectMaxCharsBlur('descriptionMaxChars', $event.target.value, { fallback: 300, min: 1, max: 2000 })"
              >
            </div>
            <div class="generator-form__row">
              <span class="generator-form__label">数量</span>
              <input
                :value="resolveDraftInputValue('descriptionQuantity', 2)"
                type="text"
                inputmode="numeric"
                placeholder="2"
                @input="handleProjectQuantityInput('descriptionQuantity', $event.target.value)"
                @blur="handleProjectQuantityBlur('descriptionQuantity', $event.target.value, { fallback: 2, min: 1, max: 20 })"
              >
            </div>
            <div class="generator-form__row">
              <span class="generator-form__label">描述模板</span>
              <select
                :value="resolveProjectTemplateSelection().descriptionTemplateId"
                @change="handlePromptTemplateApply('descriptionPrompt', $event.target.value)"
              >
                <option value="">默认</option>
                <option v-for="item in descriptionPromptTemplates" :key="item.id" :value="item.id">
                  {{ item.name || '未命名模板' }}
                </option>
              </select>
            </div>
            <div class="generator-form__card work-center-studio__prompt-card">
              <textarea
                :value="resolveDraftValue('descriptionPrompt', '')"
                rows="6"
                placeholder="描述提示词"
                @input="updateProjectGenerationConfig({ descriptionPrompt: $event.target.value })"
              ></textarea>
            </div>
          </div>
        </div>

        <div v-if="shouldShowStageDivider('description')" class="work-center-studio__param-divider" aria-hidden="true"></div>

        <div v-if="enabledWorkspaceSteps.image" class="work-center-studio__stage-section">
          <div class="work-center-studio__stage-heading">
            <strong>套图</strong>
          </div>
          <div class="generator-form__group">
            <div class="generator-form__row">
              <span class="generator-form__label">语言</span>
              <select
                :value="resolveDraftImageLanguage()"
                @change="updateProjectGenerationConfig({ imageLanguage: $event.target.value })"
              >
                <option v-for="option in languageOptions" :key="option.value" :value="option.value">
                  {{ option.label }}
                </option>
              </select>
            </div>
            <div class="generator-form__row">
              <span class="generator-form__label">数量</span>
              <input
                type="text"
                inputmode="numeric"
                placeholder="4"
                :value="resolveProjectGenerateCountInputValue()"
                @input="handleProjectGenerateCountInput($event.target.value)"
                @blur="handleProjectGenerateCountBlur($event.target.value)"
              />
            </div>
            <div class="generator-form__row">
              <span class="generator-form__label">图片模型</span>
              <select
                :value="resolveDraftSelectValue('imageModel', imageModelOptions[0]?.value)"
                @change="updateProjectGenerationConfig({ imageModel: $event.target.value })"
              >
                <option v-for="option in imageModelOptions" :key="option.value" :value="option.value">
                  {{ option.label }}
                </option>
              </select>
            </div>
            <div class="generator-form__row">
              <span class="generator-form__label">图片尺寸</span>
              <select
                :value="resolveDraftSelectValue('size', imageSizeOptions[0]?.value)"
                @change="updateProjectGenerationConfig({ size: $event.target.value })"
              >
                <option v-for="option in imageSizeOptions" :key="option.value" :value="option.value">
                  {{ option.label }}
                </option>
              </select>
            </div>
            <div
              v-for="assignment in resolveProjectImageAssignments()"
              :key="assignment.id"
              class="generator-form__card work-center-studio__image-assignment-card"
            >
              <div class="generator-form__row work-center-studio__image-assignment-select">
                <span class="generator-form__label">图片模板 {{ assignment.index }}</span>
                <select
                  :value="assignment.templateId"
                  @change="handleProjectImageTemplateChange(assignment.index - 1, $event.target.value)"
                >
                  <option
                    v-for="option in seriesImageTemplateOptions"
                    :key="option.templateId"
                    :value="option.templateId"
                  >
                    {{ option.imageType }}
                  </option>
                </select>
              </div>
              <div class="work-center-studio__prompt-card">
                <textarea
                  :value="assignment.prompt || ''"
                  rows="5"
                  :placeholder="`图片模板 ${assignment.index} 提示词`"
                  @input="handleProjectImagePromptChange(assignment.index - 1, $event.target.value)"
                ></textarea>
              </div>
            </div>
          </div>
        </div>

        <div v-if="shouldShowStageDivider('image')" class="work-center-studio__param-divider" aria-hidden="true"></div>

        <div v-if="enabledWorkspaceSteps.video" class="work-center-studio__stage-section">
          <div class="work-center-studio__stage-heading">
            <strong>视频</strong>
          </div>
          <div class="generator-form__group">
            <div class="generator-form__row">
              <span class="generator-form__label">视频模板</span>
              <select
                :value="resolveProjectTemplateSelection().videoTemplateId"
                @change="handlePromptTemplateApply('videoPrompt', $event.target.value)"
              >
                <option value="">默认</option>
                <option v-for="item in videoPromptTemplates" :key="item.id" :value="item.id">
                  {{ item.name || '未命名模板' }}
                </option>
              </select>
            </div>
            <div class="generator-form__row">
              <span class="generator-form__label">视频模型</span>
              <select
                :value="resolveDraftSelectValue('videoModel', videoModelOptions[0]?.value)"
                @change="updateProjectGenerationConfig({ videoModel: $event.target.value })"
              >
                <option v-for="option in videoModelOptions" :key="option.value" :value="option.value">
                  {{ option.label }}
                </option>
              </select>
            </div>
            <div class="generator-form__row">
              <span class="generator-form__label">视频时长</span>
              <select
                :value="resolveDraftSelectValue('duration', videoDurationOptions[0]?.value)"
                @change="updateProjectGenerationConfig({ duration: $event.target.value })"
              >
                <option v-for="option in videoDurationOptions" :key="option.value" :value="option.value">
                  {{ option.label }}
                </option>
              </select>
            </div>
            <div class="generator-form__row">
              <span class="generator-form__label">视频清晰度</span>
              <select
                :value="resolveDraftSelectValue('resolution', videoResolutionOptions[0]?.value)"
                @change="updateProjectGenerationConfig({ resolution: $event.target.value })"
              >
                <option v-for="option in videoResolutionOptions" :key="option.value" :value="option.value">
                  {{ option.label }}
                </option>
              </select>
            </div>
            <div class="generator-form__row">
              <span class="generator-form__label">画面比例</span>
              <select
                :value="resolveDraftSelectValue('aspectRatio', videoAspectRatioOptions[0]?.value)"
                @change="updateProjectGenerationConfig({ aspectRatio: $event.target.value })"
              >
                <option v-for="option in videoAspectRatioOptions" :key="option.value" :value="option.value">
                  {{ option.label }}
                </option>
              </select>
            </div>
            <div class="generator-form__row">
              <span class="generator-form__label">运动强度</span>
              <select
                :value="resolveDraftSelectValue('motionStrength', videoMotionOptions[0]?.value)"
                @change="updateProjectGenerationConfig({ motionStrength: $event.target.value })"
              >
                <option v-for="option in videoMotionOptions" :key="option.value" :value="option.value">
                  {{ option.label }}
                </option>
              </select>
            </div>
            <div class="generator-form__card work-center-studio__prompt-card">
              <textarea
                :value="resolveDraftValue('videoPrompt', '')"
                rows="6"
                placeholder="视频提示词"
                @input="updateProjectGenerationConfig({ videoPrompt: $event.target.value })"
              ></textarea>
            </div>
          </div>
        </div>

        <div class="work-center-studio__submit-bar">
          <div class="work-center-studio__submit-copy"></div>
          <button
            class="primary-action work-center-studio__submit-button"
            type="button"
            :disabled="!activeProjectEntry?.project || submitButtonState === 'pending'"
            @click="handleRunProject(activeProjectEntry?.project)"
          >
            {{ submitButtonState === 'pending' ? '生成中...' : '开始生成' }}
          </button>
        </div>
      </div>
    </article>

    <article class="generator-column generator-column--preview">
      <header class="generator-column__header work-center-studio__column-header">
        <div class="work-center-studio__header-copy">
          <strong>当前项目进度</strong>
        </div>
      </header>

      <div class="generator-progress-layout work-center-studio__middle-layout work-center-studio__middle-layout--stack">
        <section class="latest-task-progress work-center-studio__progress-strip">
          <header class="latest-task-progress__header">
            <div class="work-center-studio__panel-copy">
              <div class="latest-task-progress__meta work-center-studio__status-pills">
                <span class="task-status" :class="resolveTaskStatusClass(activeProjectEntry?.latestRun ? resolveLatestRunStatus(activeProjectEntry.latestRun) : '未开始')">{{ activeProjectEntry?.latestRun ? resolveLatestRunStatus(activeProjectEntry.latestRun) : '未开始' }}</span>
                <span class="task-status">{{ currentProjectCompletion }}%</span>
              </div>
            </div>
            <div class="work-center-studio__panel-badge">
              <strong>{{ queueSummary.runningCount > 0 ? '处理中' : '空闲' }}</strong>
              <span>{{ currentProjectStageLabel }}</span>
            </div>
          </header>

          <div class="work-center-studio__flow-line">
            <div
              v-for="step in currentProjectFlowSteps"
              :key="step.key"
              class="work-center-studio__flow-step"
              :class="`work-center-studio__flow-step--${step.tone}`"
            >
              <div class="work-center-studio__flow-track">
                <div class="work-center-studio__flow-node">
                  <span v-if="!step.isRunning">{{ step.index }}</span>
                  <span v-else class="work-center-studio__flow-spinner" aria-hidden="true"></span>
                </div>
                <span v-if="step.index < currentProjectFlowSteps.length" class="work-center-studio__flow-connector"></span>
              </div>
              <div class="work-center-studio__flow-copy">
                <strong>{{ step.index }}.{{ step.label }}</strong>
                <span>{{ step.statusLine }}</span>
              </div>
              <div v-if="step.error" class="work-center-studio__flow-error">
                {{ step.error }}
              </div>
            </div>
          </div>
        </section>

        <div class="work-center-studio__section-divider" aria-hidden="true"></div>

        <section class="latest-task-progress generator-preview-panel work-center-studio__storage-panel-main">
          <header class="latest-task-progress__header">
            <div class="work-center-studio__panel-copy">
              <h3>项目结果存储</h3>
              <div class="latest-task-progress__meta work-center-studio__status-pills">
                <span>{{ projectStorageRows.length }} 个项目</span>
              </div>
            </div>
            <div class="work-center-studio__storage-toolbar">
              <button class="secondary-action work-center-studio__toolbar-button" type="button" @click="handleCreateProjectFromStorage()">
                新建项目
              </button>
              <button class="secondary-action work-center-studio__toolbar-button" type="button" @click="handleRefreshStorageWorkspace()">
                刷新
              </button>
              <button class="secondary-action work-center-studio__toolbar-button" type="button" @click="handleToggleStorageSort()">
                {{ storageSortMode === 'updated-desc' ? '按时间' : '按名称' }}
              </button>
            </div>
          </header>

          <div class="generator-preview-stage work-center-studio__folder-workspace">
            <button
              v-for="item in projectStorageRows"
              :key="item.id"
              type="button"
              class="work-center-studio__folder-item"
              @click="handleSelectProjectStorage(item.project)"
              @dblclick="handleOpenStorageFolder(item.project)"
              @contextmenu.prevent.stop="handleOpenStorageContextMenu($event, item)"
            >
              <span class="work-center-studio__folder-top">
                <span class="work-center-studio__folder-icon" aria-hidden="true"></span>
                <span class="work-center-studio__folder-stats">
                  <span>{{ item.status }}</span>
                  <span>T{{ item.titleCount }}</span>
                  <span>D{{ item.descriptionCount }}</span>
                  <span>I{{ item.imageCount }}</span>
                  <span>V{{ item.videoCount }}</span>
                </span>
              </span>
              <span class="work-center-studio__folder-copy">
                <strong class="work-center-studio__folder-name">{{ item.name }}</strong>
                <span class="work-center-studio__folder-meta">{{ resolveTimeLabel(item.updatedAt) }}</span>
              </span>
            </button>

            <div v-if="!projectStorageRows.length" class="product-result-empty product-result-empty--compact work-center-studio__storage-empty">
              <span>暂无项目结果</span>
            </div>
          </div>

          <div
            v-if="storageContextMenu.visible"
            class="work-center-studio__context-menu"
            :style="{ left: `${storageContextMenu.x}px`, top: `${storageContextMenu.y}px` }"
            @pointerdown.stop
          >
            <button type="button" class="work-center-studio__context-action" @click="handleStorageContextAction('open-project-settings')">
              参数设置
            </button>
            <button type="button" class="work-center-studio__context-action" @click="handleStorageContextAction('save-template')">
              保存模板
            </button>
            <button type="button" class="work-center-studio__context-action" @click="handleStorageContextAction('export-project')">
              打包下载
            </button>
            <button type="button" class="work-center-studio__context-action work-center-studio__context-action--danger" @click="handleStorageContextAction('delete-project')">
              删除项目
            </button>
          </div>

          <div v-if="inspectedProjectEntry" class="work-center-studio__modal-mask" @click="closeProjectDetailModal">
            <div class="work-center-studio__modal-card" @click.stop>
              <div class="work-center-studio__modal-head">
                <div class="work-center-studio__inspect-head">
                  <strong>结果包详情</strong>
                  <span>{{ resolveProjectName(inspectedProjectEntry.project) }}</span>
                </div>
                <button class="secondary-action work-center-studio__mini-button" type="button" @click="closeProjectDetailModal">
                  关闭
                </button>
              </div>
              <div class="work-center-studio__inspect-summary">
                <span>{{ resolveProjectPlatform(inspectedProjectEntry.project) }}</span>
                <span>{{ resolveProjectLanguage(inspectedProjectEntry.project) }}</span>
                <span>{{ resolveTimeLabel(inspectedProjectEntry.project?.updatedAt || inspectedProjectEntry.project?.createdAt) }}</span>
              </div>
              <div
                v-if="resolveWorkspaceFailureSummary(inspectedProjectEntry.latestRun).length"
                class="work-center-studio__inspect-warning"
              >
                <strong>失败步骤</strong>
                <span>{{ resolveWorkspaceFailureSummary(inspectedProjectEntry.latestRun).join('；') }}</span>
              </div>
              <div class="work-center-studio__inspect-grid">
                <div class="work-center-studio__inspect-cell work-center-studio__inspect-cell--wide">
                  <div class="work-center-studio__inspect-cell-head">
                    <span>标题</span>
                    <button
                      class="secondary-action work-center-studio__mini-button"
                      type="button"
                      :disabled="!resolveProjectContent(inspectedProjectEntry.project, inspectedProjectEntry.latestRun).titleText"
                      @click="emit('copy-text', resolveProjectContent(inspectedProjectEntry.project, inspectedProjectEntry.latestRun).titleText)"
                    >
                      复制
                    </button>
                  </div>
                  <p class="work-center-studio__inspect-text">
                    {{ resolveProjectContent(inspectedProjectEntry.project, inspectedProjectEntry.latestRun).titleText || '暂无标题结果' }}
                  </p>
                </div>
                <div class="work-center-studio__inspect-cell work-center-studio__inspect-cell--wide">
                  <div class="work-center-studio__inspect-cell-head">
                    <span>描述</span>
                    <button
                      class="secondary-action work-center-studio__mini-button"
                      type="button"
                      :disabled="!resolveProjectContent(inspectedProjectEntry.project, inspectedProjectEntry.latestRun).descriptionText"
                      @click="emit('copy-text', resolveProjectContent(inspectedProjectEntry.project, inspectedProjectEntry.latestRun).descriptionText)"
                    >
                      复制
                    </button>
                  </div>
                  <p class="work-center-studio__inspect-text work-center-studio__inspect-text--description">
                    {{ resolveProjectContent(inspectedProjectEntry.project, inspectedProjectEntry.latestRun).descriptionText || '暂无描述结果' }}
                  </p>
                </div>
                <div class="work-center-studio__inspect-cell work-center-studio__inspect-cell--wide">
                  <div class="work-center-studio__inspect-cell-head">
                    <span>套图</span>
                    <strong>{{ resolveProjectContent(inspectedProjectEntry.project, inspectedProjectEntry.latestRun).generatedImages.length }} 张</strong>
                    <button
                      class="secondary-action work-center-studio__mini-button"
                      type="button"
                      :disabled="!resolveProjectContent(inspectedProjectEntry.project, inspectedProjectEntry.latestRun).generatedImages.length"
                      @click="handleOpenInspectedImages"
                    >
                      查看
                    </button>
                  </div>
                  <div
                    v-if="resolveProjectContent(inspectedProjectEntry.project, inspectedProjectEntry.latestRun).generatedImages.length"
                    class="work-center-studio__inspect-image-grid"
                  >
                    <article
                      v-for="(image, imageIndex) in resolveProjectContent(inspectedProjectEntry.project, inspectedProjectEntry.latestRun).generatedImages"
                      :key="image.id || image.savedPath || image.path || imageIndex"
                      class="work-center-studio__inspect-image-card"
                    >
                      <img
                        v-if="resolveMediaPreview(image)"
                        :src="resolveMediaPreview(image)"
                        :alt="image.title || image.name || `套图 ${imageIndex + 1}`"
                      >
                      <div v-else class="work-center-studio__inspect-image-empty">
                        无预览
                      </div>
                      <span>{{ image.title || image.name || resolveFileName(image.savedPath || image.path) || `套图 ${imageIndex + 1}` }}</span>
                    </article>
                  </div>
                  <div v-else class="work-center-studio__inspect-empty-line">暂无套图结果</div>
                </div>
                <div class="work-center-studio__inspect-cell work-center-studio__inspect-cell--wide">
                  <div class="work-center-studio__inspect-cell-head">
                    <span>视频</span>
                    <strong>{{ resolveProjectContent(inspectedProjectEntry.project, inspectedProjectEntry.latestRun).generatedVideo ? '已生成' : '未生成' }}</strong>
                    <button
                      class="secondary-action work-center-studio__mini-button"
                      type="button"
                      :disabled="!resolveProjectContent(inspectedProjectEntry.project, inspectedProjectEntry.latestRun).generatedVideo"
                      @click="handleOpenInspectedVideo"
                    >
                      查看
                    </button>
                  </div>
                  <div
                    v-if="resolveProjectContent(inspectedProjectEntry.project, inspectedProjectEntry.latestRun).generatedVideo"
                    class="work-center-studio__inspect-video-info"
                  >
                    <div
                      v-for="row in resolveVideoInfoRows(resolveProjectContent(inspectedProjectEntry.project, inspectedProjectEntry.latestRun).generatedVideo)"
                      :key="row.key"
                    >
                      <span>{{ row.label }}</span>
                      <strong>{{ row.value }}</strong>
                    </div>
                  </div>
                  <div v-else class="work-center-studio__inspect-empty-line">暂无视频结果</div>
                </div>
              </div>
              <div class="work-center-studio__inspect-actions">
                <button class="secondary-action work-center-studio__mini-button" type="button" @click="handleSaveTemplate(inspectedProjectEntry.project)">
                  保存模板
                </button>
                <button class="primary-action work-center-studio__mini-button" type="button" @click="handleExportInspectedProject">
                  打包下载
                </button>
              </div>
            </div>
          </div>
        </section>
      </div>
    </article>

    <article class="generator-column generator-column--export">
      <header class="generator-column__header work-center-studio__column-header">
        <div class="work-center-studio__header-copy">
          <strong>任务队列</strong>
          <h2>{{ queueSummary.totalCount }} 项</h2>
        </div>
      </header>

      <div class="generator-export">
        <div class="generator-export__list work-center-studio__export-stack">
          <section class="work-center-studio__queue-panel">
            <div class="work-center-studio__queue-list">
              <article
                v-for="item in queueRows"
                :key="item.id"
                class="work-center-studio__queue-card"
                :class="{ 'work-center-studio__queue-card--active': item.isActive }"
              >
                <div class="work-center-studio__queue-card-head">
                  <div class="work-center-studio__queue-card-copy">
                    <strong class="work-center-studio__title-ellipsis work-center-studio__title-ellipsis--double">{{ item.name }}</strong>
                    <span>{{ item.currentStage }}</span>
                  </div>
                  <div class="work-center-studio__queue-status-stack">
                    <span class="task-status" :class="resolveTaskStatusClass(item.status)">{{ item.status }}</span>
                    <span
                      v-if="['失败', '部分完成'].includes(item.status) && item.error"
                      class="work-center-studio__queue-error-badge"
                      :title="item.error"
                      aria-label="报错信息"
                    >
                      !
                    </span>
                  </div>
                </div>

                <div class="work-center-studio__queue-card-meta">
                  <span>{{ item.platform }}</span>
                  <span>{{ item.progress }}%</span>
                </div>

                <div class="task-progress task-progress--small">
                  <span class="task-progress__bar" :style="{ width: `${item.progress}%` }"></span>
                </div>

                <div class="work-center-studio__queue-card-actions">
                  <button
                    v-if="['排队中', '生成中'].includes(item.status)"
                    class="secondary-action work-center-studio__mini-button work-center-studio__mini-button--wide"
                    type="button"
                    @click="handleCancelTask(item)"
                  >
                    {{ item.status === '排队中' ? '取消排队' : '停止任务' }}
                  </button>
                </div>
              </article>

              <div v-if="!queueRows.length" class="product-result-empty product-result-empty--compact">
                <span>当前没有项目任务</span>
              </div>
            </div>

            <div class="work-center-studio__queue-pagination">
              <button
                class="secondary-action work-center-studio__queue-page-button"
                type="button"
                :disabled="activeQueuePage <= 1"
                @click="goToQueuePage(activeQueuePage - 1)"
              >
                上一页
              </button>
              <span>{{ activeQueuePage }} / {{ queueTotalPages }}</span>
              <button
                class="secondary-action work-center-studio__queue-page-button"
                type="button"
                :disabled="activeQueuePage >= queueTotalPages"
                @click="goToQueuePage(activeQueuePage + 1)"
              >
                下一页
              </button>
            </div>
          </section>

        </div>
      </div>
    </article>
  </section>
</template>

<style scoped>
.work-center-studio {
  min-height: calc(100vh - 180px);
}

.work-center-studio .generator-column {
  display: flex;
  flex-direction: column;
  min-height: 0;
}

.work-center-studio .generator-column--preview {
  min-width: 0;
}

.work-center-studio .generator-form,
.work-center-studio .generator-progress-layout,
.work-center-studio .generator-preview-stage,
.work-center-studio .generator-export {
  min-height: 0;
}

.work-center-studio__column-header {
  padding-bottom: 4px;
}

.work-center-studio__header-copy {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 12px;
  min-width: 0;
}

.work-center-studio__header-copy h2 {
  margin-left: auto;
  font-size: 15px;
  line-height: 1.2;
  max-width: min(100%, 360px);
  min-width: 0;
  text-align: right;
}

.work-center-studio__title-ellipsis {
  display: -webkit-box;
  overflow: hidden;
  text-overflow: ellipsis;
  -webkit-box-orient: vertical;
  word-break: break-word;
  overflow-wrap: anywhere;
}

.work-center-studio__title-ellipsis--single {
  -webkit-line-clamp: 1;
  line-clamp: 1;
}

.work-center-studio__title-ellipsis--double {
  -webkit-line-clamp: 2;
  line-clamp: 2;
}

.work-center-studio__title-ellipsis--triple {
  -webkit-line-clamp: 3;
  line-clamp: 3;
}

.work-center-studio__entry-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;
}

.work-center-studio__shortcut-block {
  display: none;
}

.work-center-studio__shortcut-head {
  display: flex;
  align-items: center;
}

.work-center-studio__shortcut-head span {
  font-size: 12px;
  font-weight: 700;
}

.work-center-studio__shortcut-button {
  min-height: 38px;
}

.work-center-studio__submit-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 12px 14px;
  border-radius: 16px;
  border: 1px solid rgba(130, 110, 255, 0.18);
  background: linear-gradient(135deg, rgba(91, 74, 166, 0.18), rgba(83, 183, 255, 0.05));
}

.work-center-studio__submit-copy {
  display: flex;
  align-items: center;
}

.work-center-studio__stage-section {
  display: grid;
  gap: 10px;
}

.work-center-studio__prompt-card {
  grid-column: 1 / -1;
}

.work-center-studio__image-assignment-card {
  grid-column: 1 / -1;
  gap: 10px;
  padding: 12px;
  border-color: rgba(100, 186, 255, 0.12);
  background: rgba(9, 13, 23, 0.42);
}

.work-center-studio__image-assignment-select {
  grid-template-columns: minmax(86px, 0.34fr) minmax(0, 1fr);
  align-items: center;
  gap: 10px;
}

.work-center-studio__stage-heading {
  display: flex;
  align-items: center;
  min-height: 24px;
}

.work-center-studio__stage-heading strong {
  font-size: 13px;
  line-height: 1.2;
  color: rgba(243, 247, 255, 0.92);
}

.work-center-studio__param-divider {
  width: 100%;
  height: 1px;
  border-radius: 999px;
  background: linear-gradient(90deg, rgba(255, 255, 255, 0.04), rgba(100, 186, 255, 0.24), rgba(255, 255, 255, 0.04));
}

.work-center-studio__submit-button {
  min-width: 148px;
}

.work-center-studio__step-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 8px;
}

.work-center-studio__step-grid .generator-form__row--checkbox {
  display: grid;
  justify-items: center;
  align-content: center;
  gap: 6px;
  padding: 10px 12px;
  border-radius: 14px;
  border: 1px solid rgba(255, 255, 255, 0.08);
  background: rgba(255, 255, 255, 0.03);
  transition: border-color 0.18s ease, background 0.18s ease, box-shadow 0.18s ease;
  min-width: 0;
}

.work-center-studio__step-chip--active {
  border-color: rgba(100, 186, 255, 0.34);
  background: linear-gradient(180deg, rgba(100, 186, 255, 0.12), rgba(100, 186, 255, 0.05));
  box-shadow: inset 0 0 0 1px rgba(100, 186, 255, 0.12);
}

.work-center-studio__step-chip-control {
  display: inline-flex;
  align-items: center;
  justify-content: center;
}

.work-center-studio__step-chip-control input {
  margin: 0;
  width: 14px;
  height: 14px;
}

.work-center-studio__step-chip-label {
  font-weight: 700;
  min-width: 0;
  white-space: nowrap;
  text-align: center;
}

.work-center-studio__toggle {
  display: inline-flex;
  align-items: center;
  justify-content: center;
}

.work-center-studio__step-chip-state {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 36px;
  padding: 3px 8px;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.06);
  font-size: 11px;
  color: rgba(205, 214, 238, 0.82);
  white-space: nowrap;
}

.work-center-studio__step-chip--active .work-center-studio__step-chip-state {
  background: rgba(100, 186, 255, 0.16);
  color: #d8efff;
}

.work-center-studio__inspect-action-stack {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

.work-center-studio__inspect-actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  margin-top: 12px;
}

.work-center-studio__middle-layout {
  flex: 1;
}

.work-center-studio__middle-layout--stack {
  display: grid;
  grid-template-rows: minmax(180px, 1fr) 1px minmax(0, 2fr);
  gap: 14px;
}

.work-center-studio__progress-strip {
  padding: 14px 16px;
}

.work-center-studio__section-divider {
  width: 100%;
  height: 1px;
  border-radius: 999px;
  background: linear-gradient(90deg, rgba(255, 255, 255, 0.06), rgba(100, 186, 255, 0.28), rgba(255, 255, 255, 0.06));
}

.work-center-studio__panel-copy {
  display: grid;
  gap: 6px;
  min-width: 0;
}

.work-center-studio__panel-copy h3 {
  min-width: 0;
}

.work-center-studio__status-pills {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.work-center-studio__panel-badge {
  display: grid;
  justify-items: end;
  gap: 4px;
}

.work-center-studio__panel-badge span {
  color: rgba(205, 214, 238, 0.68);
  font-size: 12px;
}

.work-center-studio__flow-line {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 12px;
  align-items: stretch;
  overflow: hidden;
  padding: 2px 0 4px;
}

.work-center-studio__flow-step {
  display: grid;
  grid-template-rows: auto auto;
  gap: 10px;
  min-width: 0;
  padding: 12px 12px 10px;
  border-radius: 16px;
  border: 1px solid rgba(255, 255, 255, 0.08);
  background: linear-gradient(180deg, rgba(255, 255, 255, 0.035), rgba(255, 255, 255, 0.015));
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.03);
  backdrop-filter: blur(8px);
}

.work-center-studio__flow-track {
  display: grid;
  grid-template-columns: auto minmax(18px, 1fr);
  align-items: center;
  gap: 10px;
  min-width: 0;
}

.work-center-studio__flow-node {
  width: 34px;
  height: 34px;
  border-radius: 999px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: 13px;
  font-weight: 700;
  border: 1px solid rgba(255, 255, 255, 0.12);
  background: radial-gradient(circle at 30% 30%, rgba(255, 255, 255, 0.14), rgba(255, 255, 255, 0.04));
  color: rgba(226, 232, 244, 0.76);
  flex: 0 0 auto;
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.06);
}

.work-center-studio__flow-copy {
  display: grid;
  gap: 4px;
  min-width: 0;
}

.work-center-studio__flow-copy strong {
  font-size: 13px;
  line-height: 1.35;
  color: rgba(243, 247, 255, 0.94);
}

.work-center-studio__flow-copy span {
  font-size: 12px;
  color: rgba(205, 214, 238, 0.72);
}

.work-center-studio__flow-connector {
  height: 2px;
  width: 100%;
  border-radius: 999px;
  background: linear-gradient(90deg, rgba(255, 255, 255, 0.2), rgba(255, 255, 255, 0.04));
}

.work-center-studio__flow-step--done .work-center-studio__flow-node {
  border-color: rgba(82, 196, 26, 0.45);
  background: rgba(82, 196, 26, 0.18);
  color: #9be15d;
  box-shadow: 0 0 18px rgba(82, 196, 26, 0.18);
}

.work-center-studio__flow-step--done {
  border-color: rgba(82, 196, 26, 0.22);
  background: linear-gradient(180deg, rgba(82, 196, 26, 0.12), rgba(82, 196, 26, 0.04));
}

.work-center-studio__flow-step--done .work-center-studio__flow-copy strong {
  color: #c9f7a8;
}

.work-center-studio__flow-step--done .work-center-studio__flow-connector {
  background: linear-gradient(90deg, rgba(82, 196, 26, 0.55), rgba(82, 196, 26, 0.2));
}

.work-center-studio__flow-step--running .work-center-studio__flow-node {
  border-color: rgba(100, 186, 255, 0.55);
  background: rgba(100, 186, 255, 0.14);
  color: #8fd0ff;
  box-shadow: 0 0 18px rgba(100, 186, 255, 0.2);
}

.work-center-studio__flow-step--running {
  border-color: rgba(100, 186, 255, 0.24);
  background: linear-gradient(180deg, rgba(100, 186, 255, 0.12), rgba(100, 186, 255, 0.04));
}

.work-center-studio__flow-step--running .work-center-studio__flow-copy strong {
  color: #cbe7ff;
}

.work-center-studio__flow-step--running .work-center-studio__flow-connector {
  background: linear-gradient(90deg, rgba(100, 186, 255, 0.62), rgba(100, 186, 255, 0.18));
}

.work-center-studio__flow-step--failed .work-center-studio__flow-node {
  border-color: rgba(255, 120, 117, 0.5);
  background: rgba(255, 120, 117, 0.16);
  color: #ffb3a8;
}

.work-center-studio__flow-step--failed {
  border-color: rgba(255, 120, 117, 0.22);
  background: linear-gradient(180deg, rgba(255, 120, 117, 0.12), rgba(255, 120, 117, 0.04));
}

.work-center-studio__flow-step--failed .work-center-studio__flow-copy strong {
  color: #ffd2ca;
}

.work-center-studio__flow-step--failed .work-center-studio__flow-connector {
  background: linear-gradient(90deg, rgba(255, 120, 117, 0.56), rgba(255, 120, 117, 0.16));
}

.work-center-studio__queue-status-stack {
  display: inline-grid;
  justify-items: start;
  align-content: start;
  gap: 6px;
  width: fit-content;
  max-width: 100%;
}

.work-center-studio__queue-error-badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 18px;
  height: 18px;
  border-radius: 999px;
  border: 1px solid rgba(255, 120, 117, 0.38);
  background: rgba(255, 120, 117, 0.14);
  color: #ffb3a8;
  font-size: 12px;
  font-weight: 700;
  line-height: 1;
  cursor: help;
  user-select: none;
}

.work-center-studio__flow-step--pending .work-center-studio__flow-copy strong {
  color: rgba(232, 238, 247, 0.9);
}

.work-center-studio__flow-spinner {
  width: 14px;
  height: 14px;
  border-radius: 999px;
  border: 2px solid rgba(143, 208, 255, 0.2);
  border-top-color: #8fd0ff;
  animation: work-center-spin 0.9s linear infinite;
}

@keyframes work-center-spin {
  to {
    transform: rotate(360deg);
  }
}

.work-center-studio__storage-panel-main {
  display: grid;
  grid-template-rows: auto minmax(0, 1fr);
  min-height: 0;
  overflow: hidden;
  gap: 10px;
  padding: 14px 16px;
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 18px;
  background:
    linear-gradient(180deg, rgba(255, 255, 255, 0.025), rgba(255, 255, 255, 0.01)),
    rgba(9, 13, 23, 0.72);
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.04);
  position: relative;
}

.work-center-studio__storage-toolbar {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  align-items: center;
  justify-content: flex-end;
  padding: 0;
}

.work-center-studio__toolbar-button {
  min-height: 32px;
  padding: 0 12px;
  border-radius: 10px;
}

.work-center-studio__inspect-copy {
  margin: 0;
  color: rgba(226, 232, 244, 0.88);
  line-height: 1.6;
  word-break: break-word;
}

.work-center-studio__inspect-warning {
  display: grid;
  gap: 6px;
  padding: 10px 12px;
  border-radius: 12px;
  border: 1px solid rgba(255, 120, 117, 0.14);
  background: rgba(255, 120, 117, 0.08);
  color: #ffd2ca;
  font-size: 12px;
  line-height: 1.55;
}

.work-center-studio__inline-actions,
.work-center-studio__queue-card-actions,
.work-center-studio__storage-actions,
.work-center-studio__storage-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  align-items: center;
}

.work-center-studio__mini-button {
  min-height: 30px;
  padding: 0 10px;
  font-size: 12px;
}

.work-center-studio__export-stack {
  display: grid;
  grid-template-rows: minmax(0, 1fr);
  gap: 10px;
  min-height: 0;
}

.work-center-studio__queue-panel {
  min-height: 0;
  display: grid;
  grid-template-rows: minmax(0, 1fr) auto;
  gap: 10px;
}

.work-center-studio__queue-summary {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-bottom: 8px;
}

.work-center-studio__queue-summary span {
  padding: 6px 10px;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.05);
  color: rgba(205, 214, 238, 0.76);
  font-size: 12px;
}

.work-center-studio__queue-list {
  display: grid;
  grid-auto-rows: 108px;
  gap: 8px;
  min-height: 0;
  max-height: calc(108px * 5 + 8px * 4);
  overflow: hidden;
}

.work-center-studio__folder-workspace {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(136px, 1fr));
  gap: 14px;
  align-content: start;
  align-items: start;
  height: 100%;
  min-height: 0;
  max-height: none;
  overflow-y: auto;
  overflow-x: hidden;
  padding: 4px 4px 20px 0;
  scrollbar-width: none;
}

.work-center-studio__folder-workspace::-webkit-scrollbar {
  width: 0;
  height: 0;
}

.work-center-studio__folder-item {
  display: grid;
  grid-template-columns: 1fr;
  justify-items: stretch;
  gap: 9px;
  min-height: 112px;
  padding: 11px;
  border: 1px solid transparent;
  border-radius: 16px;
  background: transparent;
  color: rgba(226, 232, 244, 0.9);
  text-align: left;
  cursor: pointer;
  transition: background 0.18s ease, border-color 0.18s ease, transform 0.18s ease;
}

.work-center-studio__folder-top {
  display: grid;
  grid-template-columns: 56px minmax(0, 1fr);
  align-items: center;
  gap: 10px;
  min-width: 0;
}

.work-center-studio__folder-item:hover {
  background: rgba(255, 255, 255, 0.04);
  border-color: rgba(255, 255, 255, 0.08);
  transform: translateY(-1px);
}

.work-center-studio__folder-item:focus-visible {
  outline: none;
  border-color: rgba(100, 186, 255, 0.45);
  box-shadow: 0 0 0 2px rgba(100, 186, 255, 0.16);
}

.work-center-studio__folder-item--active {
  background: linear-gradient(180deg, rgba(100, 186, 255, 0.12), rgba(100, 186, 255, 0.06));
  border-color: rgba(100, 186, 255, 0.34);
  box-shadow:
    inset 0 0 0 1px rgba(100, 186, 255, 0.12),
    0 10px 20px rgba(0, 0, 0, 0.14);
}

.work-center-studio__folder-icon {
  width: 56px;
  height: 44px;
  border-radius: 10px 10px 12px 12px;
  background:
    linear-gradient(180deg, rgba(255, 214, 102, 1), rgba(238, 176, 56, 0.95));
  position: relative;
  box-shadow: 0 10px 18px rgba(0, 0, 0, 0.18);
}

.work-center-studio__folder-icon::before {
  content: '';
  position: absolute;
  top: -6px;
  left: 6px;
  width: 24px;
  height: 10px;
  border-radius: 8px 8px 0 0;
  background: rgba(255, 227, 145, 0.98);
}

.work-center-studio__folder-copy {
  display: grid;
  gap: 4px;
  min-width: 0;
}

.work-center-studio__folder-name {
  width: 100%;
  font-size: 12px;
  line-height: 1.4;
  word-break: break-word;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.work-center-studio__folder-meta {
  font-size: 11px;
  color: rgba(205, 214, 238, 0.62);
}

.work-center-studio__folder-stats {
  display: flex;
  flex-wrap: wrap;
  align-content: center;
  column-gap: 6px;
  row-gap: 6px;
  min-width: 0;
}

.work-center-studio__folder-stats span {
  max-width: 100%;
  padding: 3px 6px;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.05);
  font-size: 10px;
  color: rgba(205, 214, 238, 0.72);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.work-center-studio__context-menu {
  position: fixed;
  z-index: 40;
  display: grid;
  min-width: 136px;
  padding: 6px;
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 14px;
  background: rgba(14, 18, 28, 0.96);
  box-shadow: 0 18px 40px rgba(0, 0, 0, 0.34);
  backdrop-filter: blur(12px);
}

.work-center-studio__context-action {
  min-height: 34px;
  padding: 0 10px;
  border: 0;
  border-radius: 10px;
  background: transparent;
  color: rgba(226, 232, 244, 0.9);
  text-align: left;
  cursor: pointer;
}

.work-center-studio__context-action:hover {
  background: rgba(255, 255, 255, 0.06);
}

.work-center-studio__context-action--danger {
  color: #ffb3a8;
}

.work-center-studio__queue-card,
.work-center-studio__storage-item,
.work-center-studio__inspect-panel {
  display: grid;
  gap: 6px;
  min-height: 0;
  min-width: 0;
  padding: 10px;
  border-radius: 16px;
  border: 1px solid rgba(255, 255, 255, 0.08);
  background: rgba(9, 13, 23, 0.72);
}

.work-center-studio__queue-card {
  height: 108px;
  align-content: start;
  overflow: hidden;
}

.work-center-studio__queue-card--active,
.work-center-studio__storage-item--active {
  border-color: rgba(100, 186, 255, 0.35);
  box-shadow: 0 0 0 1px rgba(100, 186, 255, 0.16) inset;
}

.work-center-studio__queue-card-head,
.work-center-studio__storage-copy,
.work-center-studio__inspect-head {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  align-items: start;
  gap: 5px;
  min-width: 0;
}

.work-center-studio__queue-card-copy,
.work-center-studio__storage-copy {
  display: grid;
  gap: 2px;
  min-width: 0;
}

.work-center-studio__queue-card-copy strong {
  min-width: 0;
  line-height: 1.25;
  max-height: calc(1.25em * 2);
}

.work-center-studio__queue-card-copy span,
.work-center-studio__storage-copy span,
.work-center-studio__inspect-head span,
.work-center-studio__queue-card-meta span {
  color: rgba(205, 214, 238, 0.7);
  font-size: 12px;
}

.work-center-studio__queue-card-meta {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  align-items: center;
  gap: 6px;
  min-width: 0;
}

.work-center-studio__queue-card-meta span {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.work-center-studio__queue-card-actions {
  display: grid;
  justify-items: stretch;
  gap: 4px;
  width: 100%;
  min-width: 0;
}

.work-center-studio__queue-card-actions .work-center-studio__mini-button {
  width: 100%;
  min-height: 26px;
  min-width: 0;
  padding: 0 8px;
  white-space: nowrap;
}

.work-center-studio__queue-card-actions .work-center-studio__mini-button--wide {
  grid-column: auto;
}

.work-center-studio__queue-pagination {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto minmax(0, 1fr);
  align-items: center;
  gap: 8px;
  min-height: 32px;
}

.work-center-studio__queue-pagination span {
  min-width: 44px;
  color: rgba(205, 214, 238, 0.78);
  font-size: 12px;
  text-align: center;
  white-space: nowrap;
}

.work-center-studio__queue-page-button {
  width: 100%;
  min-width: 0;
  min-height: 30px;
  padding: 0 8px;
  white-space: nowrap;
}

.work-center-studio__storage-meta span {
  padding: 7px 11px;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.06);
  color: rgba(226, 232, 244, 0.88);
  font-size: 12px;
}

.work-center-studio__inspect-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 8px;
}

.work-center-studio__inspect-cell {
  display: grid;
  gap: 8px;
  min-width: 0;
}

.work-center-studio__inspect-cell--wide {
  grid-column: 1 / -1;
}

.work-center-studio__inspect-cell-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  min-width: 0;
}

.work-center-studio__inspect-cell span {
  color: rgba(205, 214, 238, 0.7);
  font-size: 12px;
}

.work-center-studio__inspect-text {
  margin: 0;
  padding: 10px 12px;
  border-radius: 12px;
  background: rgba(255, 255, 255, 0.035);
  color: rgba(226, 232, 244, 0.9);
  line-height: 1.65;
  white-space: pre-wrap;
  word-break: break-word;
}

.work-center-studio__inspect-text--description {
  display: -webkit-box;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 3;
  overflow: hidden;
}

.work-center-studio__inspect-image-grid {
  display: flex;
  gap: 10px;
  min-width: 0;
  overflow-x: auto;
  overflow-y: hidden;
  padding-bottom: 6px;
  scroll-snap-type: x proximity;
}

.work-center-studio__inspect-image-card {
  display: grid;
  flex: 0 0 calc((100% - 40px) / 5);
  gap: 6px;
  min-width: 112px;
  padding: 8px;
  border-radius: 12px;
  background: rgba(255, 255, 255, 0.035);
  scroll-snap-align: start;
}

.work-center-studio__inspect-image-card img,
.work-center-studio__inspect-image-empty {
  width: 100%;
  aspect-ratio: 1 / 1;
  border-radius: 10px;
  object-fit: cover;
  background: rgba(255, 255, 255, 0.05);
}

.work-center-studio__inspect-image-empty {
  display: grid;
  place-items: center;
  color: rgba(205, 214, 238, 0.62);
  font-size: 12px;
}

.work-center-studio__inspect-image-card span {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.work-center-studio__inspect-video-info {
  display: grid;
  gap: 8px;
}

.work-center-studio__inspect-video-info div {
  display: grid;
  grid-template-columns: 58px minmax(0, 1fr);
  align-items: center;
  gap: 10px;
  padding: 8px 10px;
  border-radius: 12px;
  background: rgba(255, 255, 255, 0.035);
}

.work-center-studio__inspect-video-info strong {
  min-width: 0;
  overflow: hidden;
  color: rgba(226, 232, 244, 0.9);
  font-size: 12px;
  font-weight: 600;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.work-center-studio__inspect-empty-line {
  padding: 10px 12px;
  border-radius: 12px;
  background: rgba(255, 255, 255, 0.03);
  color: rgba(205, 214, 238, 0.62);
  font-size: 12px;
}

.work-center-studio__inspect-panel--empty {
  display: grid;
  place-items: center;
  text-align: center;
  min-height: 120px;
  color: rgba(205, 214, 238, 0.66);
}

.work-center-studio__storage-empty {
  min-height: 84px;
  display: grid;
  place-items: center;
  text-align: center;
}

.work-center-studio__modal-mask {
  position: fixed;
  inset: 0;
  z-index: 35;
  display: grid;
  place-items: center;
  padding: 24px;
  background: rgba(5, 8, 14, 0.58);
  backdrop-filter: blur(8px);
}

.work-center-studio__modal-card {
  width: min(720px, 100%);
  max-height: min(80vh, 720px);
  overflow: auto;
  display: grid;
  gap: 12px;
  padding: 16px;
  border-radius: 18px;
  border: 1px solid rgba(255, 255, 255, 0.08);
  background:
    linear-gradient(180deg, rgba(255, 255, 255, 0.025), rgba(255, 255, 255, 0.01)),
    rgba(9, 13, 23, 0.96);
  box-shadow: 0 20px 50px rgba(0, 0, 0, 0.35);
}

.work-center-studio__modal-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
}

.work-center-studio__inspect-summary {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.work-center-studio__inspect-summary span {
  padding: 4px 8px;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.05);
  font-size: 11px;
  color: rgba(205, 214, 238, 0.75);
}

.work-center-studio__inspect-copy {
  padding: 0;
  border: 0;
  background: transparent;
  text-align: left;
  cursor: pointer;
}

.product-result-empty--compact {
  min-height: 88px;
}

@media (max-width: 1320px) {
  .work-center-studio__entry-grid,
  .work-center-studio__inspect-grid {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 900px) {
  .work-center-studio__submit-bar,
  .work-center-studio__queue-card-head,
  .work-center-studio__storage-copy,
  .work-center-studio__inspect-head,
  .work-center-studio__queue-card-meta,
  .work-center-studio__header-copy {
    flex-direction: column;
    align-items: stretch;
  }

  .work-center-studio__middle-layout--stack,
  .work-center-studio__export-stack {
    grid-template-rows: auto auto;
  }

}
</style>

