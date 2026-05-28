const fs = require('node:fs/promises')
const path = require('node:path')
const { createHttpClientService } = require('./httpClientService')

const VIDEO_TIMEOUT_MS = 120000
const DEFAULT_VIDEO_API_BASE_URL = 'https://anyaigc.com'
const DEFAULT_VIDEO_REQUEST_PATH = '/v1/video/create'
const DEFAULT_VIDEO_TASK_REQUEST_PATH = '/v1/video/query'
const DEFAULT_VIDEO_MODEL = 'sora-2'
const DEFAULT_VIDEO_DURATION_SECONDS = 8
const VIDEO_DEFAULT_SUPPORTED_DURATIONS = [4, 8, 12]
const VIDEO_POLL_INTERVAL_MS = 5000
const VIDEO_POLL_MAX_ATTEMPTS = 48
const VIDEO_CREATE_RETRY_MAX_ATTEMPTS = 3
const VIDEO_CREATE_RETRY_DELAY_MS = 2500
const VIDEO_DISTRIBUTOR_COOLDOWN_MS = 20 * 60 * 1000
const VIDEO_PROVIDER_UNSTABLE_MODELS = new Set(['sora-2-all'])
const VIDEO_FALLBACK_MODEL_MAP = {
  'sora-2': ['sora-2', 'sora-2-pro'],
  'sora-2-pro': ['sora-2-pro', 'sora-2'],
  'sora-2-all': ['sora-2', 'sora-2-pro']
}
const videoDistributorUnavailableCache = new Map()

function resolveVideoApiKey(settings = {}) {
  if (typeof settings.videoApiKey === 'string' && settings.videoApiKey.trim()) {
    return settings.videoApiKey.trim()
  }

  return ''
}

function resolveVideoApiBaseUrl(settings = {}) {
  return typeof settings.videoApiBaseUrl === 'string' && settings.videoApiBaseUrl.trim()
    ? settings.videoApiBaseUrl.trim()
    : DEFAULT_VIDEO_API_BASE_URL
}

function createDistributorCacheKey(apiBaseUrl = '', model = '') {
  return `${String(apiBaseUrl || '').trim()}::${String(model || '').trim()}`
}

function getDistributorCooldownState(apiBaseUrl = '', model = '') {
  const cacheKey = createDistributorCacheKey(apiBaseUrl, model)
  if (!cacheKey || cacheKey === '::') {
    return null
  }

  const cachedItem = videoDistributorUnavailableCache.get(cacheKey)
  if (!cachedItem) {
    return null
  }

  if ((cachedItem.expiresAt || 0) <= Date.now()) {
    videoDistributorUnavailableCache.delete(cacheKey)
    return null
  }

  return cachedItem
}

function markDistributorUnavailable(apiBaseUrl = '', model = '', reason = '') {
  const cacheKey = createDistributorCacheKey(apiBaseUrl, model)
  if (!cacheKey || cacheKey === '::') {
    return
  }

  videoDistributorUnavailableCache.set(cacheKey, {
    reason: String(reason || '').trim(),
    expiresAt: Date.now() + VIDEO_DISTRIBUTOR_COOLDOWN_MS
  })
}

function resolveDurationSeconds(durationLabel = '') {
  if (typeof durationLabel === 'number' && Number.isFinite(durationLabel) && durationLabel > 0) {
    return Math.round(durationLabel)
  }

  const matched = String(durationLabel || '').match(/\d+/)
  if (!matched) {
    return DEFAULT_VIDEO_DURATION_SECONDS
  }

  return Math.max(1, Math.round(Number(matched[0]) || DEFAULT_VIDEO_DURATION_SECONDS))
}

function parseSupportedDurationSeconds(error) {
  const message = String(toProviderErrorMessage(error) || '')
  if (!message) {
    return []
  }

  const matched = (
    message.match(/支持的时长[:：]\s*([0-9,\s]+)/i) ||
    message.match(/supported durations?[:：]?\s*([0-9,\s]+)/i) ||
    message.match(/([0-9]+(?:\s*,\s*[0-9]+)+)\s*$/)
  )
  if (!matched || !matched[1]) {
    return []
  }

  return [...new Set(
    matched[1]
      .split(/[^0-9]+/)
      .map((item) => Number(item))
      .filter((item) => Number.isFinite(item) && item > 0)
      .map((item) => Math.round(item))
  )]
}

function buildDurationFallbackCandidates(currentDuration, supportedDurations = []) {
  const normalizedCurrentDuration = Math.max(1, Math.round(Number(currentDuration) || DEFAULT_VIDEO_DURATION_SECONDS))
  const normalizedSupportedDurations = (Array.isArray(supportedDurations) ? supportedDurations : [])
    .map((item) => Number(item))
    .filter((item) => Number.isFinite(item) && item > 0)
    .map((item) => Math.round(item))

  const uniqueSupportedDurations = [...new Set(
    (normalizedSupportedDurations.length ? normalizedSupportedDurations : VIDEO_DEFAULT_SUPPORTED_DURATIONS)
  )]

  return uniqueSupportedDurations.sort((left, right) => {
    const leftDistance = Math.abs(left - normalizedCurrentDuration)
    const rightDistance = Math.abs(right - normalizedCurrentDuration)
    if (leftDistance !== rightDistance) {
      return leftDistance - rightDistance
    }

    return left - right
  })
}

function resolveQuantity(draft = {}) {
  return Math.max(1, Math.min(12, Math.round(Number(draft.quantity) || 1)))
}

function resolveOrientation(aspectRatio = '') {
  switch (String(aspectRatio || '').trim()) {
    case '16:9':
      return 'landscape'
    case '1:1':
      return 'portrait'
    case '9:16':
    default:
      return 'portrait'
  }
}

function resolveProviderModel(model = '', operation = 'text-to-video') {
  const normalizedModel = typeof model === 'string' && model.trim() ? model.trim() : DEFAULT_VIDEO_MODEL
  if (VIDEO_PROVIDER_UNSTABLE_MODELS.has(normalizedModel)) {
    return operation === 'image-to-video' ? 'sora-2' : DEFAULT_VIDEO_MODEL
  }

  return normalizedModel
}

function resolveProviderModelCandidates(model = '', operation = 'text-to-video') {
  const normalizedModel = resolveProviderModel(model, operation)
  const fallbackModels = VIDEO_FALLBACK_MODEL_MAP[normalizedModel] || [normalizedModel]

  return [...new Set(fallbackModels.filter((item) => item && !VIDEO_PROVIDER_UNSTABLE_MODELS.has(item)))]
}

function isRemoteImageUrl(value = '') {
  return /^https?:\/\//i.test(String(value || '').trim())
}

function resolveMimeTypeFromPath(filePath = '') {
  switch (path.extname(String(filePath || '')).toLowerCase()) {
    case '.jpg':
    case '.jpeg':
      return 'image/jpeg'
    case '.webp':
      return 'image/webp'
    case '.svg':
      return 'image/svg+xml'
    default:
      return 'image/png'
  }
}

async function resolveVideoImageInput(imageUrl = '') {
  const normalizedValue = String(imageUrl || '').trim()
  if (!normalizedValue) {
    return ''
  }

  if (normalizedValue.startsWith('data:') || isRemoteImageUrl(normalizedValue)) {
    return normalizedValue
  }

  const fileBuffer = await fs.readFile(normalizedValue)
  if (!fileBuffer.length) {
    throw new Error('图生视频参考图内容为空')
  }

  return `data:${resolveMimeTypeFromPath(normalizedValue)};base64,${fileBuffer.toString('base64')}`
}

function sleep(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms)
  })
}

function normalizeVideoStatus(status = '') {
  const normalized = String(status || '').toLowerCase()
  if (['succeeded', 'completed', 'success'].includes(normalized)) {
    return 'succeeded'
  }
  if (['failed', 'error', 'canceled', 'cancelled'].includes(normalized)) {
    return 'failed'
  }
  return 'pending'
}

async function buildVideoGenerationPayload(draft = {}) {
  const operation = draft.operation === 'image-to-video' ? 'image-to-video' : 'text-to-video'
  const selectedModel = typeof draft.model === 'string' && draft.model.trim() ? draft.model.trim() : DEFAULT_VIDEO_MODEL
  const prompt = String(draft.prompt || '').trim()

  if (!prompt) {
    throw new Error('视频提示词不能为空')
  }

  const payload = {
    images: [],
    model: resolveProviderModel(selectedModel, operation),
    orientation: resolveOrientation(draft.aspectRatio),
    prompt,
    size: typeof draft.size === 'string' && draft.size.trim() ? draft.size.trim() : 'large',
    duration: resolveDurationSeconds(draft.duration),
    watermark: typeof draft.watermark === 'boolean' ? draft.watermark : false
  }

  if (typeof draft.private === 'boolean') {
    payload.private = draft.private
  }

  const resolvedImageInput = await resolveVideoImageInput(draft.imageUrl)
  if (resolvedImageInput) {
    payload.images = [resolvedImageInput]
  }

  if (operation === 'image-to-video' && !payload.images.length) {
    throw new Error('图生视频需要提供可访问的参考图片')
  }

  return {
    payload,
    operation,
    selectedModel,
    providerModelCandidates: resolveProviderModelCandidates(selectedModel, operation)
  }
}

function extractResolvedVideoUrl(responseData = {}) {
  if (typeof responseData.video_url === 'string' && responseData.video_url.trim()) {
    return responseData.video_url.trim()
  }

  if (typeof responseData.downloadable_url === 'string' && responseData.downloadable_url.trim()) {
    return responseData.downloadable_url.trim()
  }

  if (typeof responseData.video?.url === 'string' && responseData.video.url.trim()) {
    return responseData.video.url.trim()
  }

  if (typeof responseData.data?.video_url === 'string' && responseData.data.video_url.trim()) {
    return responseData.data.video_url.trim()
  }

  if (typeof responseData.data?.downloadable_url === 'string' && responseData.data.downloadable_url.trim()) {
    return responseData.data.downloadable_url.trim()
  }

  if (typeof responseData.data?.video?.url === 'string' && responseData.data.video.url.trim()) {
    return responseData.data.video.url.trim()
  }

  if (Array.isArray(responseData.videos)) {
    const firstVideo = responseData.videos.find((item) => typeof item?.url === 'string' && item.url.trim())
    if (firstVideo?.url) {
      return firstVideo.url.trim()
    }
  }

  if (Array.isArray(responseData.data?.videos)) {
    const firstVideo = responseData.data.videos.find((item) => typeof item?.url === 'string' && item.url.trim())
    if (firstVideo?.url) {
      return firstVideo.url.trim()
    }
  }

  return ''
}

function extractResolvedThumbnailUrl(responseData = {}) {
  if (typeof responseData.thumbnail_url === 'string' && responseData.thumbnail_url.trim()) {
    return responseData.thumbnail_url.trim()
  }

  if (typeof responseData.data?.thumbnail_url === 'string' && responseData.data.thumbnail_url.trim()) {
    return responseData.data.thumbnail_url.trim()
  }

  if (typeof responseData.video?.encodings?.thumbnail?.path === 'string' && responseData.video.encodings.thumbnail.path.trim()) {
    return responseData.video.encodings.thumbnail.path.trim()
  }

  if (typeof responseData.data?.video?.encodings?.thumbnail?.path === 'string' && responseData.data.video.encodings.thumbnail.path.trim()) {
    return responseData.data.video.encodings.thumbnail.path.trim()
  }

  return ''
}

function toProviderErrorMessage(error) {
  const providerMessage = error?.response?.data?.error?.message ||
    error?.response?.data?.error ||
    error?.response?.data?.message

  if (typeof providerMessage === 'string' && providerMessage.trim()) {
    return providerMessage.trim()
  }

  return error?.message || '视频生成请求失败'
}

function shouldRetryVideoCreate(error) {
  const message = String(toProviderErrorMessage(error) || '').toLowerCase()
  return [
    '稍后再试',
    'rate limit',
    'too many requests',
    'temporarily unavailable',
    'timeout'
  ].some((keyword) => message.includes(keyword))
}

function shouldFallbackVideoModel(error) {
  const message = String(toProviderErrorMessage(error) || '')
  return [
    '无可用渠道',
    '不可用渠道',
    'no available distributor',
    'no available channel',
    'distributor'
  ].some((keyword) => message.toLowerCase().includes(String(keyword).toLowerCase()))
}

function shouldFallbackVideoDuration(error) {
  const message = String(toProviderErrorMessage(error) || '')
  const supportedDurations = parseSupportedDurationSeconds(error)
  return (
    supportedDurations.length > 0 &&
    (
      message.includes('时长') ||
      message.includes('秒') ||
      message.includes('不支持') ||
      message.toLowerCase().includes('duration') ||
      message.toLowerCase().includes('second') ||
      message.toLowerCase().includes('support')
    )
  )
}

async function pollVideoTask({
  httpClient,
  fallbackTaskId
}) {
  const requestPath = `${DEFAULT_VIDEO_TASK_REQUEST_PATH}?id=${encodeURIComponent(fallbackTaskId)}`

  for (let attempt = 0; attempt < VIDEO_POLL_MAX_ATTEMPTS; attempt += 1) {
    const response = await httpClient.get(requestPath)
    const data = response?.data || {}
    const status = normalizeVideoStatus(data.status)

    if (status === 'succeeded') {
      return data
    }

    if (status === 'failed') {
      throw new Error(typeof data.error === 'string' ? data.error : '视频任务执行失败')
    }

    await sleep(VIDEO_POLL_INTERVAL_MS)
  }

  throw new Error('视频任务查询超时，请稍后重试')
}

async function createVideoTaskWithRetry(httpClient, payload) {
  let lastError = null

  for (let attempt = 0; attempt < VIDEO_CREATE_RETRY_MAX_ATTEMPTS; attempt += 1) {
    try {
      return await httpClient.post(DEFAULT_VIDEO_REQUEST_PATH, payload)
    } catch (error) {
      lastError = error

      if (attempt >= VIDEO_CREATE_RETRY_MAX_ATTEMPTS - 1 || !shouldRetryVideoCreate(error)) {
        throw error
      }

      await sleep(VIDEO_CREATE_RETRY_DELAY_MS)
    }
  }

  throw lastError || new Error('视频生成请求失败')
}

async function createVideoTaskWithDurationFallback(httpClient, payload) {
  const attemptedDurations = []
  const durationCandidates = [payload.duration]
  let lastError = null

  for (let index = 0; index < durationCandidates.length; index += 1) {
    const candidateDuration = Math.max(1, Math.round(Number(durationCandidates[index]) || DEFAULT_VIDEO_DURATION_SECONDS))
    if (attemptedDurations.includes(candidateDuration)) {
      continue
    }

    attemptedDurations.push(candidateDuration)

    try {
      const response = await createVideoTaskWithRetry(httpClient, {
        ...payload,
        duration: candidateDuration
      })
      return {
        response,
        providerDuration: candidateDuration,
        attemptedDurations
      }
    } catch (error) {
      lastError = error

      if (!shouldFallbackVideoDuration(error)) {
        error.attemptedDurations = attemptedDurations
        throw error
      }

      const supportedDurations = buildDurationFallbackCandidates(candidateDuration, parseSupportedDurationSeconds(error))
      supportedDurations.forEach((supportedDuration) => {
        if (!durationCandidates.includes(supportedDuration)) {
          durationCandidates.push(supportedDuration)
        }
      })

      if (index >= durationCandidates.length - 1) {
        error.attemptedDurations = attemptedDurations
        throw error
      }
    }
  }

  if (lastError && !lastError.attemptedDurations) {
    lastError.attemptedDurations = attemptedDurations
  }
  throw lastError || new Error('视频生成请求失败')
}

async function createVideoTaskWithModelFallback(httpClient, payload, providerModelCandidates = [], apiBaseUrl = '') {
  const uniqueCandidates = [...new Set([
    payload.model,
    ...(Array.isArray(providerModelCandidates) ? providerModelCandidates : [])
  ].filter(Boolean))]

  let lastError = null
  const attemptedModels = []
  const skippedModels = []

  for (let index = 0; index < uniqueCandidates.length; index += 1) {
    const candidateModel = uniqueCandidates[index]
    const cooldownState = getDistributorCooldownState(apiBaseUrl, candidateModel)
    if (cooldownState) {
      skippedModels.push(candidateModel)
      continue
    }

    attemptedModels.push(candidateModel)
    const nextPayload = {
      ...payload,
      model: candidateModel
    }

    try {
      const result = await createVideoTaskWithDurationFallback(httpClient, nextPayload)
      return {
        response: result.response,
        providerModel: candidateModel,
        attemptedModels,
        skippedModels,
        providerDuration: result.providerDuration,
        attemptedDurations: result.attemptedDurations
      }
    } catch (error) {
      lastError = error

      if (shouldFallbackVideoModel(error)) {
        markDistributorUnavailable(apiBaseUrl, candidateModel, toProviderErrorMessage(error))
      }

      if (index >= uniqueCandidates.length - 1 || !shouldFallbackVideoModel(error)) {
        error.attemptedModels = attemptedModels
        error.skippedModels = skippedModels
        throw error
      }
    }
  }

  if (!attemptedModels.length && skippedModels.length) {
    const error = new Error(`当前通道最近已确认以下模型无可用渠道：${skippedModels.join('、')}`)
    error.attemptedModels = []
    error.skippedModels = skippedModels
    throw error
  }

  if (lastError && !lastError.attemptedModels) {
    lastError.attemptedModels = attemptedModels
  }
  if (lastError && !lastError.skippedModels) {
    lastError.skippedModels = skippedModels
  }
  throw lastError || new Error('视频生成请求失败')
}

function createVideoGenerationService({
  settingsService,
  messageRecorder,
  createHttpClientServiceDependency = createHttpClientService
}) {
  async function generateVideoResults({ draft, taskId }) {
    const settings = settingsService.getSettings()
    const apiKey = resolveVideoApiKey(settings)

    if (!apiKey) {
      throw new Error('请先在管理员配置中保存视频 API-Key')
    }

    const httpClient = createHttpClientServiceDependency({
      apiBaseUrl: resolveVideoApiBaseUrl(settings),
      apiKey,
      messageRecorder,
      timeoutMs: VIDEO_TIMEOUT_MS
    })
    const resolvedApiBaseUrl = resolveVideoApiBaseUrl(settings)

    const quantity = resolveQuantity(draft)
    const results = []

    for (let index = 0; index < quantity; index += 1) {
      const { payload, operation, selectedModel, providerModelCandidates } = await buildVideoGenerationPayload(draft)

      let createdTask
      let providerModel = payload.model
      let providerDuration = payload.duration
      let attemptedModels = []
      let skippedModels = []
      let attemptedDurations = []
      try {
        const createdTaskResult = await createVideoTaskWithModelFallback(httpClient, payload, providerModelCandidates, resolvedApiBaseUrl)
        createdTask = createdTaskResult.response
        providerModel = createdTaskResult.providerModel
        providerDuration = createdTaskResult.providerDuration || payload.duration
        attemptedModels = Array.isArray(createdTaskResult.attemptedModels) ? createdTaskResult.attemptedModels : []
        skippedModels = Array.isArray(createdTaskResult.skippedModels) ? createdTaskResult.skippedModels : []
        attemptedDurations = Array.isArray(createdTaskResult.attemptedDurations) ? createdTaskResult.attemptedDurations : []
      } catch (error) {
        const attemptedModelsText = Array.isArray(error?.attemptedModels) && error.attemptedModels.length
          ? `（已尝试：${error.attemptedModels.join('、')}）`
          : ''
        const skippedModelsText = Array.isArray(error?.skippedModels) && error.skippedModels.length
          ? `（已跳过近期确认不可用：${error.skippedModels.join('、')}）`
          : ''
        const attemptedDurationsText = Array.isArray(error?.attemptedDurations) && error.attemptedDurations.length
          ? `（已尝试时长：${error.attemptedDurations.join('、')} 秒）`
          : ''
        throw new Error(`Sora 视频请求失败：${toProviderErrorMessage(error)}${attemptedModelsText}${attemptedDurationsText}${skippedModelsText}`)
      }

      const taskResponse = createdTask?.data || {}
      const remoteTaskId = taskResponse.id || taskResponse.task_id || `${taskId}-${index + 1}`
      const finalResult = await pollVideoTask({
        httpClient,
        fallbackTaskId: remoteTaskId
      })

      const videoUrl = extractResolvedVideoUrl(finalResult)
      if (!videoUrl) {
        throw new Error('视频任务已完成，但没有返回可用的视频地址')
      }

      results.push({
        id: `${taskId}-video-${index + 1}`,
        taskId: remoteTaskId,
        model: selectedModel,
        providerModel,
        attemptedModels,
        attemptedDurations,
        skippedModels,
        operation,
        duration: providerDuration,
        aspectRatio: draft.aspectRatio || '9:16',
        prompt: payload.prompt,
        videoUrl,
        thumbnailUrl: extractResolvedThumbnailUrl(finalResult),
        raw: finalResult
      })
    }

    return results
  }

  async function getBillingSummary() {
    return {
      tokenName: '',
      accessUntil: 0,
      totalBalanceUsd: null,
      usageUsd: null,
      remainingBalanceUsd: null,
      logs: [],
      unsupported: true,
      message: '当前视频通道暂未接入准确余额接口'
    }
  }

  return {
    generateVideoResults,
    getBillingSummary
  }
}

module.exports = {
  createVideoGenerationService
}
