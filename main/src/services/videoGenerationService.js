const fs = require('node:fs/promises')
const path = require('node:path')
const { createHttpClientService } = require('./httpClientService')

const VIDEO_TIMEOUT_MS = 120000
const DEFAULT_VIDEO_API_BASE_URL = 'https://anyaigc.com'
const DEFAULT_VIDEO_REQUEST_PATH = '/v1/video/create'
const DEFAULT_VIDEO_TASK_REQUEST_PATH = '/v1/video/query'
const DEFAULT_VIDEO_MODEL = 'sora-2'
const VIDEO_POLL_INTERVAL_MS = 5000
const VIDEO_POLL_MAX_ATTEMPTS = 48
const VIDEO_CREATE_RETRY_MAX_ATTEMPTS = 3
const VIDEO_CREATE_RETRY_DELAY_MS = 2500

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

function resolveDurationSeconds(durationLabel = '') {
  if (typeof durationLabel === 'number' && Number.isFinite(durationLabel) && durationLabel > 0) {
    return Math.round(durationLabel)
  }

  const matched = String(durationLabel || '').match(/\d+/)
  if (!matched) {
    return 10
  }

  return Math.max(1, Math.round(Number(matched[0]) || 10))
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

  if (operation === 'image-to-video' && normalizedModel === 'sora-2') {
    return 'sora-2-all'
  }

  return normalizedModel
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
    selectedModel
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

    const quantity = resolveQuantity(draft)
    const results = []

    for (let index = 0; index < quantity; index += 1) {
      const { payload, operation, selectedModel } = await buildVideoGenerationPayload(draft)

      let createdTask
      try {
        createdTask = await createVideoTaskWithRetry(httpClient, payload)
      } catch (error) {
        throw new Error(`Sora 视频请求失败：${toProviderErrorMessage(error)}`)
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
        providerModel: payload.model,
        operation,
        duration: payload.duration,
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
