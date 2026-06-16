const fs = require('node:fs/promises')
const path = require('node:path')
const axios = require('axios')
const { createHttpClientService } = require('./httpClientService')
const { toDataUrl, getMimeTypeFromPath } = require('./localInputAssetService')
const { resolveProviderApiKey } = require('./providerApiKeyService')

const VIDEO_GENERATION_TIMEOUT_MS = 30 * 60 * 1000
const VIDEO_POLL_INTERVAL_MS = 5000
const VIDEO_STALL_TIMEOUT_MS = 10 * 60 * 1000

function sleep(durationMs) {
  return new Promise((resolve) => {
    setTimeout(resolve, durationMs)
  })
}

function normalizeVideoDuration(duration = '6s') {
  const numericValue = Number.parseInt(String(duration).replace(/[^\d]/g, ''), 10)
  return numericValue === 10 ? 10 : 6
}

function normalizeVideoResolution(resolution = '768P', duration = '6s') {
  const normalizedDuration = normalizeVideoDuration(duration)
  const candidate = String(resolution || '').trim().toUpperCase()

  if (candidate === '1080P' && normalizedDuration === 6) {
    return '1080P'
  }

  return '768P'
}

function normalizeVideoAspectRatio(aspectRatio = '16:9') {
  const candidate = String(aspectRatio || '').trim()
  return ['16:9', '9:16', '1:1', '4:5', '3:4'].includes(candidate) ? candidate : '16:9'
}

function normalizeVideoStatus(status = '') {
  const normalizedStatus = String(status || '').trim()

  if (normalizedStatus === 'Success') {
    return 'succeeded'
  }

  if (normalizedStatus === 'Fail') {
    return 'failed'
  }

  return 'running'
}

function buildVideoErrorMessage(responseData = {}, fallbackMessage = '视频生成失败') {
  const baseResp = responseData?.base_resp || {}
  const statusMessage = String(baseResp.status_msg || '').trim()

  if (statusMessage) {
    return statusMessage
  }

  return fallbackMessage
}

async function safeRuntimeLog(runtimeLogger, payload) {
  if (!runtimeLogger || typeof runtimeLogger.log !== 'function') {
    return
  }

  try {
    await runtimeLogger.log(payload)
  } catch {
    // Ignore runtime logging failures.
  }
}

async function downloadVideoToDirectory({
  downloadUrl,
  outputDirectory,
  fileName = 'generated-video.mp4'
}, {
  requestClient = axios
} = {}) {
  const response = await requestClient.get(downloadUrl, {
    responseType: 'arraybuffer'
  })

  const resolvedOutputDirectory = path.resolve(outputDirectory)
  const resolvedFileName = String(fileName || 'generated-video.mp4').trim() || 'generated-video.mp4'
  const savedPath = path.resolve(resolvedOutputDirectory, resolvedFileName)

  await fs.mkdir(resolvedOutputDirectory, { recursive: true })
  await fs.writeFile(savedPath, response.data)

  return savedPath
}

function applyMotionPrompt(prompt = '', motionStrength = 'auto') {
  if (motionStrength === 'stable') {
    return `${prompt}\n镜头要求：镜头稳定，少位移，少晃动。`
  }

  if (motionStrength === 'soft') {
    return `${prompt}\n镜头要求：保留轻微动感，节奏自然，不要过度晃动。`
  }

  return prompt
}

function createStudioVideoGenerationService({
  settingsService,
  messageRecorder,
  runtimeLogger,
  requestMetricRecorder,
  createHttpClientServiceDependency = createHttpClientService,
  toDataUrlDependency = toDataUrl,
  getMimeTypeFromPathDependency = getMimeTypeFromPath,
  requestClient = axios,
  wait = sleep,
  getNowMs = () => Date.now(),
  pollIntervalMs = VIDEO_POLL_INTERVAL_MS,
  totalTimeoutMs = VIDEO_GENERATION_TIMEOUT_MS,
  stallTimeoutMs = VIDEO_STALL_TIMEOUT_MS
}) {
  async function generateVideoResults({
    draft,
    taskId,
    outputDirectory,
    onProgress
  }) {
    const settings = settingsService.getSettings()
    const apiKey = resolveProviderApiKey(settings, 'minimax')

    if (!apiKey) {
      throw new Error('请先保存可用的 API-Key。')
    }

    const sourceImagePath = draft?.sourceImage?.storedPath || draft?.sourceImage?.path || ''
    if (!sourceImagePath) {
      throw new Error('视频生成需要先上传一张参考图')
    }

    const httpClient = createHttpClientServiceDependency({
      apiBaseUrl: 'https://api.minimaxi.com',
      apiKey,
      messageRecorder,
      requestMetricRecorder,
      timeoutMs: 120000
    })

    const firstFrameImage = await toDataUrlDependency({
      filePath: sourceImagePath,
      mimeType: getMimeTypeFromPathDependency(sourceImagePath)
    })

    const requestPayload = {
      model: draft.model || 'MiniMax-Hailuo-2.3-Fast',
      first_frame_image: firstFrameImage,
      prompt: applyMotionPrompt(
        String(draft.prompt || '').trim() || '生成适合电商展示的商品视频，镜头稳定，突出主体与卖点',
        draft.motionStrength || 'auto'
      ),
      prompt_optimizer: true,
      fast_pretreatment: true,
      duration: normalizeVideoDuration(draft.duration),
      resolution: normalizeVideoResolution(draft.resolution, draft.duration),
      aspect_ratio: normalizeVideoAspectRatio(draft.aspectRatio),
      aigc_watermark: false
    }

    await onProgress?.({
      progress: 8,
      status: 'running'
    })

    const createResponse = await httpClient.post('/v1/video_generation', requestPayload)
    const createBaseResp = createResponse?.data?.base_resp || {}
    if (Number(createBaseResp.status_code) !== 0) {
      throw new Error(buildVideoErrorMessage(createResponse?.data, '视频任务创建失败'))
    }

    const remoteTaskId = String(createResponse?.data?.task_id || '').trim()
    if (!remoteTaskId) {
      throw new Error('视频任务创建成功但未返回任务编号')
    }

    await safeRuntimeLog(runtimeLogger, {
      level: 'info',
      event: 'studio-video-task-created',
      taskId,
      remoteTaskId,
      model: requestPayload.model
    })

    const pollStartedAt = getNowMs()
    let lastProgressAt = pollStartedAt
    let lastReportedProgress = 8
    let videoResult = null

    while (!videoResult) {
      const queryResponse = await httpClient.get('/v1/query/video_generation', {
        task_id: remoteTaskId
      })
      const queryBaseResp = queryResponse?.data?.base_resp || {}
      if (Number(queryBaseResp.status_code) !== 0) {
        throw new Error(buildVideoErrorMessage(queryResponse?.data, '视频任务查询失败'))
      }

      const normalizedStatus = normalizeVideoStatus(queryResponse?.data?.status)
      if (normalizedStatus === 'failed') {
        throw new Error(buildVideoErrorMessage(queryResponse?.data, '视频生成失败'))
      }

      if (normalizedStatus === 'succeeded') {
        videoResult = queryResponse.data
        break
      }

      const now = getNowMs()
      if (now - pollStartedAt >= totalTimeoutMs) {
        throw new Error('视频生成超时，请稍后重试')
      }

      if (now - lastProgressAt >= stallTimeoutMs) {
        throw new Error('视频生成长时间无进展，请稍后重试')
      }

      const nextProgress = Math.min(92, lastReportedProgress + 12)
      if (nextProgress > lastReportedProgress) {
        lastReportedProgress = nextProgress
        lastProgressAt = now
        await onProgress?.({
          progress: nextProgress,
          status: 'running'
        })
      }

      await wait(pollIntervalMs)
    }

    const fileId = String(videoResult?.file_id || '').trim()
    if (!fileId) {
      throw new Error('视频任务成功但未返回文件编号')
    }

    const fileResponse = await httpClient.get('/v1/files/retrieve', {
      file_id: fileId
    })
    const fileBaseResp = fileResponse?.data?.base_resp || {}
    if (Number(fileBaseResp.status_code) !== 0) {
      throw new Error(buildVideoErrorMessage(fileResponse?.data, '视频文件获取失败'))
    }

    const fileInfo = fileResponse?.data?.file || {}
    const downloadUrl = String(fileInfo.download_url || '').trim()
    if (!downloadUrl) {
      throw new Error('视频文件获取成功但未返回下载地址')
    }

    const savedPath = await downloadVideoToDirectory({
      downloadUrl,
      outputDirectory,
      fileName: String(fileInfo.filename || `${taskId}.mp4`).trim() || `${taskId}.mp4`
    }, {
      requestClient
    })

    await onProgress?.({
      progress: 100,
      status: 'succeeded'
    })

    await safeRuntimeLog(runtimeLogger, {
      level: 'info',
      event: 'studio-video-task-succeeded',
      taskId,
      remoteTaskId,
      fileId,
      savedPath
    })

    return {
      textResults: [],
      comparisonResults: [],
      groupedResults: [
        {
          id: `${taskId}-video-group-1`,
          groupType: 'video',
          groupTitle: '视频结果',
          status: 'succeeded',
          completedCount: 1,
          failedCount: 0,
          outputs: [
            {
              id: `${taskId}-video-1`,
              title: '商品视频',
              model: requestPayload.model,
              savedPath,
              path: savedPath,
              sourceTag: 'generated',
              duration: `${requestPayload.duration}s`,
              resolution: requestPayload.resolution,
              format: 'mp4'
            }
          ]
        }
      ],
      summary: {
        title: '视频生成结果',
        description: `${requestPayload.model} / ${requestPayload.resolution} / ${requestPayload.duration}s`
      }
    }
  }

  return {
    generateVideoResults
  }
}

module.exports = {
  createStudioVideoGenerationService
}
