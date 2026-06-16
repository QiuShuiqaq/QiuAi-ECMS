const { createHttpClientService } = require('./httpClientService')
const { createDrawTask } = require('./drawTaskService')
const { getCompletedDrawResult } = require('./completedDrawResultService')
const { toDataUrl, getMimeTypeFromPath } = require('./localInputAssetService')

const FIXED_SINGLE_IMAGE_MODELS = ['nano-banana-fast', 'gpt-image-2']
const DEFAULT_OPTIONAL_SINGLE_IMAGE_MODELS = ['nano-banana-2', 'nano-banana-2-cl']
const MAX_SERIES_DESIGN_IMAGES = 30
const SERIES_DESIGN_SOFT_WEIGHT = 12
const SERIES_GENERATE_SOFT_TOTAL = 8
const SERIES_GROUP_CONCURRENCY = 5
const MAX_SERIES_GENERATE_GROUP_SIZE = 500
const REMOTE_RESULT_POLL_INTERVAL_MS = 2500
const REMOTE_RESULT_TOTAL_TIMEOUT_MS = 30 * 60 * 1000
const REMOTE_RESULT_STALL_TIMEOUT_MS = 10 * 60 * 1000
const EMPTY_IMAGE_TYPE_TEMPLATE_ID = 'system-empty-image-type'
const SERIES_GENERATE_IMAGE_TYPE_OPTIONS = [
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
const SERIES_GENERATE_IMAGE_TYPE_CONFIG = {
  商品主图: {
    outputLabel: '主图',
    templateId: 'image-main',
    instruction: '按商品主图生成：输出产品电商效果图，突出主体展示、卖点呈现与主视觉氛围；禁止偏离商品主体。'
  },
  白底图: {
    outputLabel: '白底图',
    templateId: 'image-white-bg',
    instruction: '按白底图生成：输出纯白背景电商图，主体完整清晰、边缘干净；禁止加入场景背景和复杂装饰。'
  },
  详情图: {
    outputLabel: '详情图',
    templateId: 'image-detail',
    instruction: '按详情图生成：输出产品详细说明图，强调卖点信息、使用说明、功能结构或场景说明；禁止仅做主视觉海报。'
  },
  细节图: {
    outputLabel: '细节图',
    templateId: 'image-closeup',
    instruction: '按细节图生成：输出产品局部放大图，重点展示材质、做工、纹理或关键细节；禁止生成整套场景主视觉。'
  },
  尺寸图: {
    outputLabel: '尺寸图',
    templateId: 'image-size',
    instruction: '按尺寸图生成：输出带尺寸标注的说明图，清晰表达长宽高或关键规格；禁止省略尺寸信息。'
  },
  颜色图: {
    outputLabel: '颜色图',
    templateId: 'image-color',
    instruction: '按颜色图生成：输出产品颜色变化效果图，保持产品结构一致，仅突出颜色差异；禁止改变主体款式。'
  },
  场景图: {
    outputLabel: '场景图',
    templateId: 'image-scene',
    instruction: '按场景图生成：保持产品主体不变，替换或优化背景场景与使用环境，增强代入感和生活化氛围。'
  },
  模特图: {
    outputLabel: '模特图',
    templateId: 'image-model',
    instruction: '按模特图生成：适用于原图没有模特的商品，在保持商品主体不变的前提下补入自然真实的模特展示。'
  },
  换角度: {
    outputLabel: '换角度',
    templateId: 'image-angle',
    instruction: '按换角度图生成：保持商品主体不变，只调整拍摄机位和展示角度，不改变商品结构和核心特征。'
  },
  换场景: {
    outputLabel: '换场景',
    templateId: 'image-change-scene',
    instruction: '按换场景图生成：保持商品主体不变，只替换背景环境、布景或空间氛围。'
  },
  换模特: {
    outputLabel: '换模特',
    templateId: 'image-change-model',
    instruction: '按换模特图生成：适用于原图已有模特的商品，在保持商品主体不变的前提下替换成新的模特。'
  },
  全替换: {
    outputLabel: '全替换',
    templateId: 'image-replace-all',
    instruction: '按全替换图生成：在保持商品主体不变的前提下，同时替换拍摄角度、背景场景和模特展示。'
  }
}
const SERIES_GENERATE_TYPE_BY_TEMPLATE_ID = Object.fromEntries(
  Object.entries(SERIES_GENERATE_IMAGE_TYPE_CONFIG).map(([imageType, config]) => [config.templateId, imageType])
)
const DEFAULT_CONCURRENCY = 2
const MAX_RETRY_COUNT = 2
const ASPECT_RATIO_PRESET_MAP = {
  'a4-portrait': '3:4',
  'a4-landscape': '4:3',
  'a5-portrait': '3:4',
  'a5-landscape': '4:3',
  '8k-landscape': '16:9',
  '8k-portrait': '9:16'
}

function sleep(durationMs) {
  return new Promise((resolve) => {
    setTimeout(resolve, durationMs)
  })
}

async function safeRuntimeLog(runtimeLogger, payload) {
  if (!runtimeLogger || typeof runtimeLogger.log !== 'function') {
    return
  }

  try {
    await runtimeLogger.log(payload)
  } catch {
    // 杩愯鏃ュ織澶辫触涓嶅奖鍝嶄富娴佺▼銆?
  }
}

function resolveApiKey(settings = {}) {
  if (typeof settings.apiKey === 'string' && settings.apiKey.trim()) {
    return settings.apiKey.trim()
  }

  const activeIndex = Number.isInteger(settings.activeApiKeyIndex) ? settings.activeApiKeyIndex : 0
  const apiKey = Array.isArray(settings.apiKeys) ? settings.apiKeys[activeIndex] : ''
  return typeof apiKey === 'string' ? apiKey.trim() : ''
}

function composePrompt(parts = []) {
  return parts
    .map((item) => String(item || '').trim())
    .filter(Boolean)
    .join('\n')
}

function normalizePromptLinesStable(value = '') {
  return String(value || '')
    .split(/\r?\n+/)
    .map((item) => item.trim())
    .filter(Boolean)
}

function composePromptStable(parts = []) {
  const seen = new Set()

  return (Array.isArray(parts) ? parts : [])
    .flatMap((item) => normalizePromptLinesStable(item))
    .filter((line) => {
      if (seen.has(line)) {
        return false
      }

      seen.add(line)
      return true
    })
    .join('\n')
}

function normalizeNegativePromptTextStable(negativePrompt = '') {
  return normalizePromptLinesStable(negativePrompt).join('，')
}

function composeStructuredPrompt({
  dedicatedPrompt = '',
  globalPrompt = '',
  negativePrompt = ''
} = {}) {
  const positivePrompt = composePromptStable([dedicatedPrompt, globalPrompt])
  const normalizedNegativePrompt = normalizeNegativePromptTextStable(negativePrompt)

  if (!normalizedNegativePrompt) {
    return positivePrompt
  }

  return [positivePrompt, `严格避免以下问题：${normalizedNegativePrompt}`]
    .filter(Boolean)
    .join('\n')
}

function normalizeDifferentialBatchPrompts(batchPrompts = [], batchCount = 1) {
  const normalizedCount = Math.max(1, Number(batchCount) || 1)
  const sourcePrompts = Array.isArray(batchPrompts) ? batchPrompts : []

  return Array.from({ length: normalizedCount }, (_unused, index) => {
    return String(sourcePrompts[index] || '').trim()
  })
}

function resolveBatchPromptValue({
  differentialEnabled = false,
  batchPrompts = [],
  fallbackPrompt = '',
  batchIndex = 0,
  batchCount = 1
} = {}) {
  if (differentialEnabled !== true) {
    return String(fallbackPrompt || '').trim()
  }

  const normalizedBatchPrompts = normalizeDifferentialBatchPrompts(batchPrompts, batchCount)
  return normalizedBatchPrompts[batchIndex] || ''
}

function normalizeDifferenceLevel(differenceLevel = 'off') {
  return ['off', 'low', 'medium', 'high'].includes(differenceLevel) ? differenceLevel : 'off'
}

function buildAutoDifferentialBatchPrompts({
  differenceLevel = 'off',
  batchCount = 1,
  imageType = ''
} = {}) {
  const normalizedLevel = normalizeDifferenceLevel(differenceLevel)
  const normalizedBatchCount = Math.max(1, Number(batchCount) || 1)
  if (normalizedLevel === 'off') {
    return Array.from({ length: normalizedBatchCount }, () => '')
  }

  const lowVariants = [
    '保持产品主体和图片定位不变，做轻微构图差异，调整留白、摆位、镜头裁切和光线细节，避免重复画面。',
    '保持主体不变，细调构图、前后景层次、道具摆放和光感，做出轻微差异，避免重复。',
    '保持主体不变，微调角度、阴影、景深和局部细节层次，生成相似但不重复的版本。'
  ]
  const mediumVariants = [
    '保持产品主体和图片定位不变，做明显差异化处理，调整构图、镜头角度、光线氛围和场景细节，但不要改变商品本身。',
    '保持商品不变，在同一图片定位下更换更明显的构图节奏、背景细节和展示重点，避免与其他结果重复。',
    '保持主体稳定，做中等强度差异化，调整拍摄距离、光影方向、道具关系和视觉重心。'
  ]
  const highVariants = [
    '保持产品主体和当前图片定位不变，做高强度差异化，明显调整构图、镜头语言、场景细节和氛围表达，但不得改变商品款式与核心特征。',
    '在不改变商品主体的前提下，为当前图片定位生成差异明显的新版本，重点改变布局、视角、背景细节和视觉节奏，避免重复。',
    '保持主体不变，生成变化更大的同定位版本，允许更明显的角度、景别、环境和氛围差异，但不能偏离商品展示目标。'
  ]
  const variantMap = {
    low: lowVariants,
    medium: mediumVariants,
    high: highVariants
  }
  const variantPool = variantMap[normalizedLevel] || lowVariants

  return Array.from({ length: normalizedBatchCount }, (_unused, index) => {
    const variant = variantPool[index % variantPool.length]
    return `第 ${index + 1} 套${imageType ? ` ${imageType}` : ''}请与其他结果保持差异化。${variant}`
  })
}

function normalizeSingleImageModels(compareModels = []) {
  const allowedModels = new Set([
    'gpt-image-2',
    'nano-banana-pro',
    'nano-banana-fast',
    'nano-banana-2',
    'nano-banana-pro-vt',
    'nano-banana-pro-cl',
    'nano-banana-2-cl',
    'nano-banana-pro-vip',
    'nano-banana-2-4k-cl',
    'nano-banana-pro-4k-vip',
    'nano-banana'
  ])
  const usedModels = new Set(FIXED_SINGLE_IMAGE_MODELS)
  const optionalModels = DEFAULT_OPTIONAL_SINGLE_IMAGE_MODELS.map((defaultModel, index) => {
    const candidateModel = Array.isArray(compareModels) ? compareModels[index + 2] : ''
    if (allowedModels.has(candidateModel) && !usedModels.has(candidateModel)) {
      usedModels.add(candidateModel)
      return candidateModel
    }

    usedModels.add(defaultModel)
    return defaultModel
  })

  return [...FIXED_SINGLE_IMAGE_MODELS, ...optionalModels]
}

function resolveImageSize(model = '') {
  if (model === 'nano-banana-2-4k-cl' || model === 'nano-banana-pro-4k-vip') {
    return '4K'
  }

  return '1K'
}

function resolveAspectRatio(size = '1:1') {
  const normalizedSize = String(size || '').trim()
  return ASPECT_RATIO_PRESET_MAP[normalizedSize] || normalizedSize || '1:1'
}

function normalizeProgressValue(progressValue, fallbackValue = 0) {
  const numericProgress = Number(progressValue)
  if (!Number.isFinite(numericProgress)) {
    return fallbackValue
  }

  return Math.max(0, Math.min(100, Math.round(numericProgress)))
}

function isRemoteResultPollingTimedOut({
  pollStartedAt = 0,
  lastProgressAt = 0,
  getNowMs = () => Date.now(),
  remoteResultTimeoutMs = REMOTE_RESULT_TOTAL_TIMEOUT_MS,
  remoteResultStallTimeoutMs = REMOTE_RESULT_STALL_TIMEOUT_MS
} = {}) {
  const now = getNowMs()

  if (now - pollStartedAt >= remoteResultTimeoutMs) {
    return 'total'
  }

  if (now - lastProgressAt >= remoteResultStallTimeoutMs) {
    return 'stall'
  }

  return ''
}

function buildImageErrorMessage(result = {}, fallbackMessage = '图片任务执行失败') {
  if (result.failure_reason === 'input_moderation') {
    return '图片任务失败：输入内容触发审核限制'
  }

  if (result.failure_reason === 'output_moderation') {
    return '图片任务失败：输出内容触发审核限制'
  }

  if (typeof result.error === 'string' && result.error.trim()) {
    return result.error.trim()
  }

  return fallbackMessage
}

function isModerationFailureMessage(message = '') {
  const normalizedMessage = String(message || '').trim()
  return normalizedMessage === '图片任务失败：输入内容触发审核限制' ||
    normalizedMessage === '图片任务失败：输出内容触发审核限制'
}

function createResultCardFromSavedImage(savedImage = {}, { id, model, title, promptSummary, sourceImageName, promptFinal = '' }) {
  return {
    id,
    model,
    title,
    preview: savedImage.previewUrl || '',
    promptSummary,
    promptFinal,
    sourceImageName,
    status: '已完成',
    savedPath: savedImage.savedPath || ''
  }
}

function createSeriesOutputFromSavedImage(savedImage = {}, { id, title, model, sourceTag, promptFinal = '' }) {
  return {
    id,
    title,
    model,
    preview: savedImage.previewUrl || '',
    savedPath: savedImage.savedPath || '',
    sourceTag,
    promptFinal
  }
}

function createSeriesFallbackOutput(originalOutput = {}, {
  id,
  title,
  error
} = {}) {
  return {
    ...originalOutput,
    id,
    title,
    model: '原图保留',
    sourceTag: 'fallback',
    status: '失败',
    error: String(error || '').trim() || '图片任务执行失败'
  }
}

function normalizeSeriesGeneratePromptAssignments(promptAssignments = [], generateCount = 1, batchCount = 1) {
  const normalizedGenerateCount = Math.max(1, Math.min(MAX_SERIES_GENERATE_GROUP_SIZE, Number(generateCount) || 1))
  const sourceAssignments = Array.isArray(promptAssignments) ? promptAssignments : []

  return Array.from({ length: normalizedGenerateCount }, (_unused, index) => {
    const currentAssignment = sourceAssignments[index] || {}
    const templateId = String(currentAssignment.templateId || '').trim()
    const inferredImageType = SERIES_GENERATE_TYPE_BY_TEMPLATE_ID[templateId] || ''
    const normalizedImageType = SERIES_GENERATE_IMAGE_TYPE_OPTIONS.includes(currentAssignment.imageType)
      ? currentAssignment.imageType
      : inferredImageType

    return {
      id: currentAssignment.id || `series-generate-${index + 1}`,
      index: index + 1,
      prompt: String(currentAssignment.prompt || '').trim(),
      templateId: String(currentAssignment.templateId || SERIES_GENERATE_IMAGE_TYPE_CONFIG[normalizedImageType]?.templateId || ''),
      imageType: normalizedImageType,
      differenceLevel: normalizeDifferenceLevel(currentAssignment.differenceLevel),
      differentialEnabled: normalizeDifferenceLevel(currentAssignment.differenceLevel) !== 'off',
      batchPrompts: buildAutoDifferentialBatchPrompts({
        differenceLevel: currentAssignment.differenceLevel,
        batchCount,
        imageType: normalizedImageType
      })
    }
  })
}

function buildSeriesGenerateOutputDescriptors(promptAssignments = []) {
  const typeCounters = new Map()

  return promptAssignments.map((assignment, index) => {
    const config = SERIES_GENERATE_IMAGE_TYPE_CONFIG[assignment.imageType] || {
      outputLabel: `第${index + 1}张`,
      instruction: ''
    }
    const currentCount = typeCounters.get(config.outputLabel) || 0
    typeCounters.set(config.outputLabel, currentCount + 1)

    return {
      ...assignment,
      outputTitle: `${config.outputLabel}${currentCount}`,
      composedPrompt: composePrompt([assignment.prompt])
    }
  })
}

function buildSeriesDesignOutputDescriptors(assignments = []) {
  const typeCounters = new Map()

  return assignments.map((assignment, index) => {
    const config = SERIES_GENERATE_IMAGE_TYPE_CONFIG[assignment.imageType] || {
      outputLabel: assignment.name || `第${index + 1}张`,
      instruction: ''
    }
    const currentCount = typeCounters.get(config.outputLabel) || 0
    typeCounters.set(config.outputLabel, currentCount + 1)

    return {
      ...assignment,
      model: assignment.model || '',
      size: assignment.size || '1:1',
      tagNames: Array.isArray(assignment.tagNames) ? assignment.tagNames : [],
      differentialEnabled: assignment.differentialEnabled === true,
      batchPrompts: Array.isArray(assignment.batchPrompts) ? assignment.batchPrompts : [],
      outputTitle: SERIES_GENERATE_IMAGE_TYPE_CONFIG[assignment.imageType]
        ? `${config.outputLabel}${currentCount}`
        : config.outputLabel,
      composedPrompt: composePrompt([
        ...(Array.isArray(assignment.tagNames) ? assignment.tagNames : []),
        assignment.prompt
      ])
    }
  })
}

async function mapWithConcurrency(items = [], mapper, concurrency = DEFAULT_CONCURRENCY) {
  const normalizedConcurrency = Math.max(1, Math.min(DEFAULT_CONCURRENCY + 1, Number(concurrency) || DEFAULT_CONCURRENCY))
  const results = new Array(items.length)
  let nextIndex = 0

  async function runWorker() {
    while (nextIndex < items.length) {
      const currentIndex = nextIndex
      nextIndex += 1
      results[currentIndex] = await mapper(items[currentIndex], currentIndex)
    }
  }

  await Promise.all(Array.from({
    length: Math.min(normalizedConcurrency, Math.max(items.length, 1))
  }, () => runWorker()))

  return results
}

async function runTasksWithConcurrency(taskFactories = [], concurrency = SERIES_GROUP_CONCURRENCY) {
  const normalizedFactories = Array.isArray(taskFactories) ? taskFactories : []
  const normalizedConcurrency = Math.max(1, Number(concurrency) || 1)
  const results = new Array(normalizedFactories.length)
  let nextIndex = 0

  async function worker() {
    while (nextIndex < normalizedFactories.length) {
      const currentIndex = nextIndex
      nextIndex += 1
      results[currentIndex] = await normalizedFactories[currentIndex]()
    }
  }

  await Promise.all(Array.from({
    length: Math.min(normalizedConcurrency, normalizedFactories.length)
  }, () => worker()))

  return results
}

async function createReferenceUrls(filePaths = [], {
  toDataUrlDependency = toDataUrl,
  getMimeTypeFromPathDependency = getMimeTypeFromPath
} = {}) {
  const urls = []

  for (const filePath of filePaths) {
    urls.push(await toDataUrlDependency({
      filePath,
      mimeType: getMimeTypeFromPathDependency(filePath)
    }))
  }

  return urls
}

function createAggregateProgressReporter({ totalSubtasks = 1, onProgress } = {}) {
  const normalizedSubtaskCount = Math.max(1, Number(totalSubtasks) || 1)
  const subtaskProgress = Array.from({ length: normalizedSubtaskCount }, () => 0)
  let lastReportedProgress = 0

  return {
    async reportSubtaskProgress(subtaskIndex, progressValue, status = 'running') {
      if (typeof onProgress !== 'function') {
        return
      }

      const normalizedIndex = Math.max(0, Math.min(normalizedSubtaskCount - 1, Number(subtaskIndex) || 0))
      const normalizedProgress = normalizeProgressValue(progressValue, subtaskProgress[normalizedIndex])
      subtaskProgress[normalizedIndex] = Math.max(subtaskProgress[normalizedIndex], normalizedProgress)

      const aggregateProgress = Math.max(
        lastReportedProgress,
        Math.round(subtaskProgress.reduce((sum, currentValue) => sum + currentValue, 0) / normalizedSubtaskCount)
      )

      if (aggregateProgress === lastReportedProgress && status === 'running') {
        return
      }

      lastReportedProgress = aggregateProgress
      await onProgress({
        progress: aggregateProgress,
        status: aggregateProgress >= 100 ? 'succeeded' : status
      })
    }
  }
}

function validateStudioImageTask({ menuKey, draft }) {
  if (menuKey === 'single-image') {
    if (!draft.sourceImage?.storedPath && !draft.sourceImage?.path) {
      throw new Error('单图测试需要先上传一张测试图片')
    }

    return
  }

  if (menuKey === 'single-design') {
    if (!String(draft.prompt || '').trim()) {
      throw new Error('单图设计需要先输入提示词')
    }

    return
  }

  if (menuKey === 'series-design') {
    const assignments = Array.isArray(draft.imageAssignments) ? draft.imageAssignments : []
    const selectedAssignments = assignments.filter((item) => item.selected !== false)

    if (!assignments.length) {
      throw new Error('套图设计需要先上传一套图片')
    }

    if (assignments.length > MAX_SERIES_DESIGN_IMAGES) {
      throw new Error(`套图设计最多支持 ${MAX_SERIES_DESIGN_IMAGES} 张图片`)
    }

    if (!selectedAssignments.length) {
      throw new Error('套图设计至少需要选择 1 张待替换图片')
    }

    if (!String(draft.globalPrompt || '').trim()) {
      throw new Error('套图设计需要填写全局风格提示词')
    }

    if (selectedAssignments.some((item) => {
      if (item.differentialEnabled === true) {
        const batchPrompts = normalizeDifferentialBatchPrompts(item.batchPrompts, draft.batchCount)
        return batchPrompts.some((prompt) => !prompt)
      }

      return !String(item.prompt || '').trim()
    })) {
      throw new Error('套图设计需要为每一张选中图片填写单独提示词')
    }

    if (selectedAssignments.some((item) => {
      if (item.templateId === EMPTY_IMAGE_TYPE_TEMPLATE_ID && !String(item.imageType || '').trim()) {
        return false
      }

      return !SERIES_GENERATE_IMAGE_TYPE_OPTIONS.includes(item.imageType)
    })) {
      throw new Error('套图设计需要为每一张选中图片选择图片类型')
    }

    return
  }

  if (menuKey === 'series-generate') {
    if (!draft.sourceImage?.storedPath && !draft.sourceImage?.path) {
      throw new Error('套图生成需要先上传一张参考图')
    }

    if (Array.isArray(draft.promptAssignments) && draft.promptAssignments.length) {
      const promptAssignments = normalizeSeriesGeneratePromptAssignments(draft.promptAssignments, draft.generateCount, draft.batchCount)
      if (promptAssignments.some((item) => !item.prompt)) {
        throw new Error('套图生成需要为每一张图片填写提示词')
      }

      return
    }

    if (!String(draft.prompt || '').trim()) {
      throw new Error('套图生成需要填写提示词')
    }
  }
}

function createStudioImageGenerationService({
  settingsService,
  messageRecorder,
  runtimeLogger,
  requestMetricRecorder,
  createHttpClientServiceDependency = createHttpClientService,
  createDrawTaskDependency = createDrawTask,
  getCompletedDrawResultDependency = getCompletedDrawResult,
  toDataUrlDependency = toDataUrl,
  getMimeTypeFromPathDependency = getMimeTypeFromPath,
  wait = sleep,
  getNowMs = () => Date.now(),
  remoteResultTimeoutMs = REMOTE_RESULT_TOTAL_TIMEOUT_MS,
  remoteResultStallTimeoutMs = REMOTE_RESULT_STALL_TIMEOUT_MS,
  remoteResultPollIntervalMs = REMOTE_RESULT_POLL_INTERVAL_MS
}) {
  async function executeRemoteImageTask({
    jobLabel,
    model,
    prompt,
    aspectRatio,
    imageSize,
    filePaths,
    outputDirectory,
    onProgress
  }) {
    const settings = settingsService.getSettings()
    const apiKey = resolveApiKey(settings)

    if (!apiKey) {
      throw new Error('请先保存可用的 API-Key。')
    }

    const httpClient = createHttpClientServiceDependency({
      apiBaseUrl: settings.apiBaseUrl,
      apiKey,
      messageRecorder,
      requestMetricRecorder
    })
    const urls = await createReferenceUrls(filePaths, {
      toDataUrlDependency,
      getMimeTypeFromPathDependency
    })

    for (let attempt = 0; attempt <= MAX_RETRY_COUNT; attempt += 1) {
      const remoteTask = await createDrawTaskDependency({
        model,
        prompt,
        aspectRatio,
        imageSize,
        urls
      }, {
        httpClient
      })

      await safeRuntimeLog(runtimeLogger, {
        level: 'info',
        event: 'studio-image-remote-task-created',
        remoteTaskId: remoteTask.id,
        model,
        jobLabel,
        attempt: attempt + 1
      })

      let completedResult
      const pollStartedAt = getNowMs()
      let lastObservedProgress = 0
      let lastProgressAt = pollStartedAt

      do {
        completedResult = await getCompletedDrawResultDependency({
          id: remoteTask.id,
          outputDirectory
        }, {
          httpClient
        })

        if (typeof onProgress === 'function' && ['running', 'succeeded'].includes(completedResult.status)) {
          await onProgress({
            progress: completedResult.status === 'succeeded'
              ? 100
              : normalizeProgressValue(completedResult.progress),
            status: completedResult.status
          })
        }

        if (completedResult.status === 'running') {
          const normalizedProgress = normalizeProgressValue(completedResult.progress, lastObservedProgress)
          if (normalizedProgress > lastObservedProgress) {
            lastObservedProgress = normalizedProgress
            lastProgressAt = getNowMs()
          }

          const timeoutKind = isRemoteResultPollingTimedOut({
            pollStartedAt,
            lastProgressAt,
            getNowMs,
            remoteResultTimeoutMs,
            remoteResultStallTimeoutMs
          })

          if (timeoutKind === 'total') {
            throw new Error('图片任务执行超时，请拆分任务或稍后重试')
          }

          if (timeoutKind === 'stall') {
            throw new Error('图片任务长时间无进展，请稍后重试')
          }

          await wait(remoteResultPollIntervalMs)
        }
      } while (completedResult.status === 'running')

      if (completedResult.status === 'succeeded') {
        return completedResult
      }

      const shouldRetry = completedResult.failure_reason === 'error' && attempt < MAX_RETRY_COUNT
      await safeRuntimeLog(runtimeLogger, {
        level: shouldRetry ? 'warn' : 'error',
        event: shouldRetry ? 'studio-image-task-retry' : 'studio-image-task-failed',
        remoteTaskId: remoteTask.id,
        model,
        jobLabel,
        attempt: attempt + 1,
        failureReason: completedResult.failure_reason || '',
        error: completedResult.error || ''
      })

      if (!shouldRetry) {
        throw new Error(buildImageErrorMessage(completedResult))
      }
    }

    throw new Error('图片任务执行失败')
  }

  async function generateSingleImageResults({ draft, taskId, outputDirectory, onProgress }) {
    const sourceFilePath = draft.sourceImage?.storedPath || draft.sourceImage?.path || ''
    const compareModels = normalizeSingleImageModels(draft.compareModels)
    const progressReporter = createAggregateProgressReporter({
      totalSubtasks: compareModels.length,
      onProgress
    })
    const comparisonResults = await mapWithConcurrency(compareModels, async (model, index) => {
      const promptFinal = composePrompt([draft.prompt, draft.notes])
      const completedResult = await executeRemoteImageTask({
        jobLabel: `single-image-${index + 1}`,
        model,
        prompt: promptFinal,
        aspectRatio: resolveAspectRatio(draft.size || '1:1'),
        imageSize: resolveImageSize(model),
        filePaths: [sourceFilePath],
        outputDirectory,
        onProgress: async ({ progress, status }) => {
          await progressReporter.reportSubtaskProgress(index, progress, status)
        }
      })
      const savedImage = completedResult.results?.[0]
      if (!savedImage) {
        throw new Error(`${model} 未返回可用图片`)
      }

      return createResultCardFromSavedImage(savedImage, {
        id: `${taskId}-single-image-${index + 1}`,
        model,
        title: `${model} 对比结果`,
        promptSummary: draft.prompt || '',
        promptFinal,
        sourceImageName: draft.sourceImage?.name || ''
      })
    })

    return {
      textResults: [],
      comparisonResults,
      groupedResults: [],
      summary: {
        title: '单图四模型对比',
        description: `${draft.sourceImage?.name || '测试图片'} / ${comparisonResults.length} 个模型`
      }
    }
  }

  async function generateSingleDesignResults({ draft, taskId, outputDirectory, onProgress }) {
    const sourceFilePath = draft.sourceImage?.storedPath || draft.sourceImage?.path || ''
    const promptFinal = composePrompt([draft.prompt, draft.notes])
    const completedResult = await executeRemoteImageTask({
      jobLabel: 'single-design-1',
      model: draft.model,
      prompt: promptFinal,
      aspectRatio: resolveAspectRatio(draft.size || '1:1'),
      imageSize: resolveImageSize(draft.model),
      filePaths: sourceFilePath ? [sourceFilePath] : [],
      outputDirectory,
      onProgress
    })
    const savedImage = completedResult.results?.[0]
    if (!savedImage) {
      throw new Error(`${draft.model} 未返回可用图片`)
    }

    const comparisonResults = [
      createResultCardFromSavedImage(savedImage, {
        id: `${taskId}-single-design-1`,
        model: draft.model,
        title: `${draft.model} 设计结果`,
        promptSummary: draft.prompt || '',
        promptFinal,
        sourceImageName: draft.sourceImage?.name || ''
      })
    ]

    return {
      textResults: [],
      comparisonResults,
      groupedResults: [],
      summary: {
        title: '单图设计效果',
        description: `${draft.sourceImage?.name || '文生图'} / ${draft.model}`
      }
    }
  }

  async function generateSeriesDesignResults({ draft, taskId, outputDirectory, onProgress }) {
    const assignments = Array.isArray(draft.imageAssignments) ? draft.imageAssignments : []
    const selectedAssignments = buildSeriesDesignOutputDescriptors(assignments.filter((item) => item.selected !== false))
    const batchCount = Math.max(1, Number(draft.batchCount) || 1)
    const progressReporter = createAggregateProgressReporter({
      totalSubtasks: Math.max(1, selectedAssignments.length * batchCount),
      onProgress
    })
    const taskWeight = selectedAssignments.length * batchCount
    if (taskWeight > SERIES_DESIGN_SOFT_WEIGHT) {
      await safeRuntimeLog(runtimeLogger, {
        level: 'warn',
        event: 'studio-series-design-soft-threshold',
        taskId,
        weight: taskWeight,
        batchCount,
        selectedCount: selectedAssignments.length
      })
    }

    const originalOutputs = await Promise.all(assignments.map(async (assignment, index) => {
      const sourceFilePath = assignment.storedPath || assignment.path || ''
      const preview = sourceFilePath
        ? await toDataUrlDependency({
            filePath: sourceFilePath,
            mimeType: getMimeTypeFromPathDependency(sourceFilePath)
          })
        : ''

      return {
        id: `${taskId}-series-design-original-${index + 1}`,
        title: assignment.name,
        model: 'original',
        preview,
        savedPath: sourceFilePath,
        sourceTag: 'original'
      }
    }))

    const groupedResults = []

    for (let batchIndex = 0; batchIndex < batchCount; batchIndex += 1) {
      const generatedReplacementMap = new Map()
      let completedCount = 0
      let failedCount = 0

      const generatedItems = await runTasksWithConcurrency(
        selectedAssignments.map((assignment, selectedIndex) => {
          return async () => {
            const sourceFilePath = assignment.storedPath || assignment.path || ''
            const subtaskIndex = (batchIndex * selectedAssignments.length) + selectedIndex
            try {
              const batchPrompt = resolveBatchPromptValue({
                differentialEnabled: assignment.differentialEnabled,
                batchPrompts: assignment.batchPrompts,
                fallbackPrompt: assignment.composedPrompt,
                batchIndex,
                batchCount
              })
              const promptFinal = composeStructuredPrompt({
                dedicatedPrompt: batchPrompt,
                globalPrompt: draft.globalPrompt,
                negativePrompt: draft.negativePrompt
              })
              const completedResult = await executeRemoteImageTask({
                jobLabel: `series-design-${batchIndex + 1}-${selectedIndex + 1}`,
                model: assignment.model || draft.model,
                prompt: promptFinal,
                aspectRatio: resolveAspectRatio(assignment.size || draft.size || '1:1'),
                imageSize: resolveImageSize(assignment.model || draft.model),
                filePaths: [sourceFilePath],
                outputDirectory,
                onProgress: async ({ progress, status }) => {
                  await progressReporter.reportSubtaskProgress(subtaskIndex, progress, status)
                }
              })
              const savedImage = completedResult.results?.[0]
              if (!savedImage) {
                throw new Error(`${assignment.name} 未返回可用图片`)
              }

              completedCount += 1
              return {
                assignmentId: assignment.id,
                output: createSeriesOutputFromSavedImage(savedImage, {
                  id: `${taskId}-series-design-${batchIndex + 1}-${selectedIndex + 1}`,
                  title: assignment.outputTitle,
                  model: assignment.model || draft.model,
                  sourceTag: 'generated',
                  promptFinal
                })
              }
            } catch (error) {
              if (!isModerationFailureMessage(error?.message)) {
                throw error
              }

              failedCount += 1
              await progressReporter.reportSubtaskProgress(subtaskIndex, 100, 'failed')
              return {
                assignmentId: assignment.id,
                output: createSeriesFallbackOutput(originalOutputs[assignments.findIndex((item) => item.id === assignment.id)] || {}, {
                  id: `${taskId}-series-design-${batchIndex + 1}-${selectedIndex + 1}-fallback`,
                  title: assignment.outputTitle,
                  error: error.message
                })
              }
            }
          }
        }),
        SERIES_GROUP_CONCURRENCY
      )

      generatedItems.forEach((item) => {
        generatedReplacementMap.set(item.assignmentId, item.output)
      })

      groupedResults.push({
        id: `${taskId}-series-design-group-${batchIndex + 1}`,
        groupType: 'batch',
        groupTitle: `第 ${batchIndex + 1} 组`,
        promptSummary: draft.globalPrompt || '',
        notes: `已替换 ${selectedAssignments.length} 张图片`,
        status: failedCount > 0 ? (completedCount > 0 ? 'partial' : 'failed') : 'succeeded',
        completedCount,
        failedCount,
        outputs: assignments.map((assignment, index) => {
          return generatedReplacementMap.get(assignment.id) || {
            ...originalOutputs[index],
            id: `${taskId}-series-design-batch-${batchIndex + 1}-original-${index + 1}`
          }
        })
      })
    }

    return {
      textResults: [],
      comparisonResults: [],
      groupedResults,
      summary: {
        title: `套图设计 ${batchCount} 组`,
        description: `${draft.model} / 每组 ${assignments.length} 张`
      }
    }
  }

  async function generateSeriesGenerateResults({ draft, taskId, outputDirectory, onProgress }) {
    const batchCount = Math.max(1, Number(draft.batchCount) || 1)
    const normalizedAssignments = Array.isArray(draft.promptAssignments) && draft.promptAssignments.length
      ? normalizeSeriesGeneratePromptAssignments(draft.promptAssignments, draft.generateCount, batchCount)
      : Array.from({ length: Math.max(1, Number(draft.generateCount) || 1) }, (_unused, index) => ({
          id: `${taskId}-series-generate-${index + 1}`,
          index: index + 1,
          prompt: String(draft.prompt || '').trim(),
          templateId: String(draft.imageTemplateId || ''),
          imageType: String(draft.imageType || '').trim()
        }))
    const outputDescriptors = buildSeriesGenerateOutputDescriptors(normalizedAssignments)
    const generateCount = outputDescriptors.length
    const totalImageCount = batchCount * generateCount
    const progressReporter = createAggregateProgressReporter({
      totalSubtasks: Math.max(1, totalImageCount),
      onProgress
    })
    if (totalImageCount > SERIES_GENERATE_SOFT_TOTAL) {
      await safeRuntimeLog(runtimeLogger, {
        level: 'warn',
        event: 'studio-series-generate-soft-threshold',
        taskId,
        totalImageCount,
        batchCount,
        generateCount
      })
    }

    const sourceFilePath = draft.sourceImage?.storedPath || draft.sourceImage?.path || ''
    const sourcePreview = sourceFilePath
      ? await toDataUrlDependency({
          filePath: sourceFilePath,
          mimeType: getMimeTypeFromPathDependency(sourceFilePath)
        })
      : ''
    const sourceFallbackOutput = {
      id: `${taskId}-series-generate-source-original`,
      title: draft.sourceImage?.name || 'source-image',
      model: 'original',
      preview: sourcePreview,
      savedPath: sourceFilePath,
      sourceTag: 'original'
    }
    const groupedResults = []

    for (let batchIndex = 0; batchIndex < batchCount; batchIndex += 1) {
      let completedCount = 0
      let failedCount = 0
      const outputs = await runTasksWithConcurrency(
        outputDescriptors.map((promptAssignment, outputIndex) => {
          return async () => {
            const subtaskIndex = (batchIndex * generateCount) + outputIndex
            try {
              const promptFinal = promptAssignment.composedPrompt
              const completedResult = await executeRemoteImageTask({
                jobLabel: `series-generate-${batchIndex + 1}-${outputIndex + 1}`,
                model: draft.model,
                prompt: promptFinal,
                aspectRatio: resolveAspectRatio(draft.size || '1:1'),
                imageSize: resolveImageSize(draft.model),
                filePaths: [sourceFilePath],
                outputDirectory,
                onProgress: async ({ progress, status }) => {
                  await progressReporter.reportSubtaskProgress(subtaskIndex, progress, status)
                }
              })
              const savedImage = completedResult.results?.[0]
              if (!savedImage) {
                throw new Error(`第 ${batchIndex + 1} 组结果 ${outputIndex + 1} 未返回可用图片`)
              }

              completedCount += 1
              return createSeriesOutputFromSavedImage(savedImage, {
                id: `${taskId}-series-generate-${batchIndex + 1}-${outputIndex + 1}`,
                title: promptAssignment.outputTitle,
                model: draft.model,
                sourceTag: 'generated',
                promptFinal
              })
            } catch (error) {
              if (!isModerationFailureMessage(error?.message)) {
                throw error
              }

              failedCount += 1
              await progressReporter.reportSubtaskProgress(subtaskIndex, 100, 'failed')
              return createSeriesFallbackOutput(sourceFallbackOutput, {
                id: `${taskId}-series-generate-${batchIndex + 1}-${outputIndex + 1}-fallback`,
                title: promptAssignment.outputTitle,
                error: error.message
              })
            }
          }
        }),
        SERIES_GROUP_CONCURRENCY
      )

      groupedResults.push({
        id: `${taskId}-series-generate-group-${batchIndex + 1}`,
        groupType: 'batch',
        groupTitle: `第 ${batchIndex + 1} 组`,
        promptSummary: draft.prompt || outputDescriptors[0]?.composedPrompt || '',
        notes: '',
        status: failedCount > 0 ? (completedCount > 0 ? 'partial' : 'failed') : 'succeeded',
        completedCount,
        failedCount,
        outputs
      })
    }

    return {
      textResults: [],
      comparisonResults: [],
      groupedResults,
      summary: {
        title: `套图生成 ${batchCount} 组 x ${generateCount} 张`,
        description: `${draft.model} / ${draft.sourceImage?.name || '参考图'}`
      }
    }
  }

  async function generateImageResults({ menuKey, draft, taskId, outputDirectory, onProgress }) {
    validateStudioImageTask({
      menuKey,
      draft
    })

    if (menuKey === 'single-image') {
      return generateSingleImageResults({
        draft,
        taskId,
        outputDirectory,
        onProgress
      })
    }

    if (menuKey === 'single-design') {
      return generateSingleDesignResults({
        draft,
        taskId,
        outputDirectory,
        onProgress
      })
    }

    if (menuKey === 'series-design') {
      return generateSeriesDesignResults({
        draft,
        taskId,
        outputDirectory,
        onProgress
      })
    }

    if (menuKey === 'series-generate') {
      return generateSeriesGenerateResults({
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

  return {
    generateImageResults,
    normalizeSingleImageModels
  }
}

module.exports = {
  FIXED_SINGLE_IMAGE_MODELS,
  DEFAULT_OPTIONAL_SINGLE_IMAGE_MODELS,
  MAX_SERIES_DESIGN_IMAGES,
  SERIES_DESIGN_SOFT_WEIGHT,
  SERIES_GENERATE_SOFT_TOTAL,
  SERIES_GROUP_CONCURRENCY,
  MAX_SERIES_GENERATE_GROUP_SIZE,
  normalizeSingleImageModels,
  createStudioImageGenerationService
}

