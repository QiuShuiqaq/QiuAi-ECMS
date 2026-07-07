const fs = require('node:fs/promises')
const path = require('node:path')

const TERMINAL_JOB_STATUSES = new Set(['SUCCEEDED', 'FAILED', 'PARTIAL_FAILED', 'CANCELLED'])
const TERMINAL_ITEM_STATUSES = new Set(['SUCCEEDED', 'FAILED', 'CANCELLED'])

function sleep(durationMs) {
  return new Promise((resolve) => {
    setTimeout(resolve, durationMs)
  })
}

function buildWorkspaceDraftSnapshot(draft = {}, extra = {}) {
  const workspaceRunGroupId = trimString(draft.workspaceRunGroupId || '')
  return {
    ...(workspaceRunGroupId ? { workspaceRunGroupId } : {}),
    ...extra
  }
}

function trimString(value = '') {
  return typeof value === 'string' ? value.trim() : ''
}

function clampNumber(value, minimum, maximum, fallback) {
  const numericValue = Number(value)
  if (!Number.isFinite(numericValue)) {
    return fallback
  }

  return Math.max(minimum, Math.min(maximum, numericValue))
}

function isTerminalJobStatus(status = '') {
  return TERMINAL_JOB_STATUSES.has(String(status || ''))
}

function resolveImageRequestedConcurrencyTarget(plannedImageCount = 1) {
  const normalizedCount = Math.max(1, Number(plannedImageCount) || 1)

  return Math.max(1, Math.min(6, Math.floor((normalizedCount + 1) / 2)))
}

function resolveImagePlannedItemCount(draft = {}, fallbackCount = 1) {
  const batchCount = Math.max(1, Number(draft.batchCount) || 1)
  const seriesSourceItems = Array.isArray(draft.seriesSourceItems)
    ? draft.seriesSourceItems.filter((item) => Boolean(trimString(item?.sourceImage?.storedPath || item?.sourceImage?.path || '')))
    : []
  const promptAssignments = Array.isArray(draft.promptAssignments)
    ? draft.promptAssignments
    : []
  const generateCount = Math.max(1, Number(draft.generateCount) || 1)

  const slotCount = Math.max(
    seriesSourceItems.length,
    promptAssignments.length,
    generateCount,
    Math.max(1, Number(fallbackCount) || 1)
  )

  return Math.max(1, slotCount * batchCount)
}

function resolveRequestedConcurrency({
  assetType = '',
  draft = {},
  serviceCapacityProfile = null,
  plannedImageCount = null
}) {
  const normalizedAssetType = trimString(assetType).toUpperCase()
  const profile = serviceCapacityProfile && typeof serviceCapacityProfile === 'object'
    ? serviceCapacityProfile
    : {}
  const maxAllowedConcurrency = 64

  if (normalizedAssetType === 'VIDEO') {
    const serverLimit = Math.max(0, Number(profile.effectiveVideoConcurrency) || 0)
    return Math.max(1, Math.min(1, serverLimit || 1, maxAllowedConcurrency))
  }

  if (normalizedAssetType === 'TEXT') {
    const serverLimit = Math.max(1, Number(profile.effectiveTextConcurrency) || 1)
    return Math.max(1, Math.min(serverLimit, maxAllowedConcurrency))
  }

  const imageCount = resolveImagePlannedItemCount(draft, plannedImageCount)
  const preferredConcurrency = resolveImageRequestedConcurrencyTarget(imageCount)
  const serverLimit = Math.max(
    1,
    Number(profile.currentImageConcurrencyPerProject) ||
      Number(profile.effectiveImageConcurrency) ||
      1
  )

  return Math.max(1, Math.min(preferredConcurrency, serverLimit, maxAllowedConcurrency))
}

async function fetchServiceCapacityProfile(remoteLicensePlatformClient, sessionToken = '') {
  if (!remoteLicensePlatformClient || typeof remoteLicensePlatformClient.getServiceCapacityProfile !== 'function') {
    return null
  }

  try {
    return await remoteLicensePlatformClient.getServiceCapacityProfile({
      sessionToken
    })
  } catch {
    return null
  }
}

function resolvePollingIntervalMs(job = {}, fallbackIntervalMs = 10000) {
  const advice = job && typeof job.pollingAdvice === 'object'
    ? job.pollingAdvice
    : null
  const recommendedIntervalMs = Number(advice?.recommendedIntervalMs)
  const minIntervalMs = Number(advice?.minIntervalMs)

  if (Number.isFinite(recommendedIntervalMs) && recommendedIntervalMs > 0) {
    const safeMinimum = Number.isFinite(minIntervalMs) && minIntervalMs > 0 ? minIntervalMs : 1000
    return Math.max(safeMinimum, recommendedIntervalMs)
  }

  if (isTerminalJobStatus(job?.status)) {
    return 0
  }

  const assetType = trimString(job?.items?.[0]?.assetType || '').toUpperCase()
  if (job?.status === 'PENDING') {
    return assetType === 'VIDEO' ? 15000 : 10000
  }

  if (assetType === 'VIDEO') return 15000
  if (assetType === 'TEXT') return 10000
  if (assetType === 'IMAGE') return 10000
  return fallbackIntervalMs
}

function normalizePromptAssignments(promptAssignments = [], generateCount = 1) {
  const normalizedCount = Math.max(1, Number(generateCount) || 1)
  const sourceAssignments = Array.isArray(promptAssignments) ? promptAssignments : []

  return Array.from({ length: normalizedCount }, (_unused, index) => {
    const currentAssignment = sourceAssignments[index] || {}
    return {
      index: index + 1,
      imageType: trimString(currentAssignment.imageType || ''),
      prompt: trimString(currentAssignment.prompt || ''),
      outputTitle: trimString(currentAssignment.outputTitle || '')
    }
  })
}

function buildSeriesOutputDescriptors(promptAssignments = [], fallbackPrompt = '') {
  return promptAssignments.map((assignment, index) => {
    const imageType = trimString(assignment.imageType || '')
    const outputTitle = trimString(assignment.outputTitle || '')

    return {
      slotIndex: index + 1,
      prompt: trimString(assignment.prompt || '') || trimString(fallbackPrompt || ''),
      outputTitle: outputTitle || imageType || `Image ${index + 1}`
    }
  })
}

function hasRunnableSourceImage(sourceImage = null) {
  if (!sourceImage || typeof sourceImage !== 'object') {
    return false
  }

  return Boolean(trimString(sourceImage.storedPath || sourceImage.path || ''))
}

function buildSeriesSourceDescriptors(draft = {}) {
  const sourceItems = Array.isArray(draft.seriesSourceItems) ? draft.seriesSourceItems : []
  if (sourceItems.length) {
    const normalizedSourceItems = sourceItems
      .map((item, index) => {
        const sourceImagePath = item?.sourceImage?.storedPath || item?.sourceImage?.path || ''
        if (!trimString(sourceImagePath)) {
          return null
        }

        return {
          slotIndex: index + 1,
          sourceImagePath,
          prompt: trimString(item.prompt || draft.prompt || ''),
          aspectRatio: trimString(item.size || draft.size || '1:1'),
          outputTitle: trimString(item.imageType || item.sourceImage?.name || `Image ${index + 1}`)
        }
      })
      .filter(Boolean)

    if (normalizedSourceItems.length > 0) {
      return normalizedSourceItems
    }
  }

  const normalizedAssignments = normalizePromptAssignments(draft.promptAssignments, draft.generateCount)
  const outputDescriptors = buildSeriesOutputDescriptors(normalizedAssignments, draft.prompt)
  const sourceImagePath = draft.sourceImage?.storedPath || draft.sourceImage?.path || ''

  return outputDescriptors.map((descriptor) => ({
    ...descriptor,
    sourceImagePath,
    aspectRatio: trimString(draft.size || '1:1')
  }))
}

function ensureRemoteReady(settingsService) {
  const settings = settingsService.getSettings()
  const authPlatform = settings.authPlatform && typeof settings.authPlatform === 'object'
    ? settings.authPlatform
    : { enabled: false, sessionToken: '' }
  const sessionToken = trimString(authPlatform.sessionToken || '')

  if (authPlatform.enabled === false || !sessionToken) {
    const error = new Error('Remote generation is not enabled for the current client.')
    error.code = 'REMOTE_GENERATION_NOT_READY'
    throw error
  }

  return {
    sessionToken
  }
}

async function fileToDataUrl(filePath = '', { readFile, getMimeTypeFromPath }) {
  const normalizedPath = trimString(filePath)
  if (!normalizedPath) {
    throw new Error('Source image path is required.')
  }

  const buffer = await readFile(normalizedPath)
  const mimeType = getMimeTypeFromPath(normalizedPath)
  return `data:${mimeType};base64,${buffer.toString('base64')}`
}

async function fileToRemoteSourceDataUrl(filePath = '', {
  readFile,
  getMimeTypeFromPath,
  prepareSourceImageDataUrl
}) {
  if (typeof prepareSourceImageDataUrl === 'function') {
    return prepareSourceImageDataUrl({
      filePath,
      minimumShortSidePx: 300
    })
  }

  return fileToDataUrl(filePath, {
    readFile,
    getMimeTypeFromPath
  })
}

function extensionFromMimeType(mimeType = '', assetType = '') {
  const normalizedMimeType = trimString(mimeType).toLowerCase()

  if (normalizedMimeType === 'image/jpeg') return '.jpg'
  if (normalizedMimeType === 'image/png') return '.png'
  if (normalizedMimeType === 'image/webp') return '.webp'
  if (normalizedMimeType === 'video/mp4') return '.mp4'
  if (normalizedMimeType === 'text/plain') return '.txt'
  return assetType === 'VIDEO' ? '.mp4' : '.png'
}

function buildArtifactFileName(artifact = {}, extension = '') {
  const groupIndex = Math.max(1, Number(artifact.groupIndex) || 1)
  const slotIndex = Math.max(1, Number(artifact.slotIndex) || 1)
  const assetType = trimString(artifact.assetType || '').toLowerCase() || 'asset'

  return `batch-${String(groupIndex).padStart(2, '0')}-slot-${String(slotIndex).padStart(2, '0')}-${assetType}${extension}`
}

async function saveArtifactToDirectory({
  artifact,
  artifactBuffer,
  outputDirectory
}) {
  const metadata = artifact.metadata && typeof artifact.metadata === 'object'
    ? artifact.metadata
    : {}
  const extension = extensionFromMimeType(metadata.mimeType, artifact.assetType)
  const fileName = buildArtifactFileName(artifact, extension)
  const savedPath = path.resolve(outputDirectory, fileName)

  await fs.mkdir(path.dirname(savedPath), { recursive: true })
  await fs.writeFile(savedPath, artifactBuffer)

  return savedPath
}

function calculateProgress(job = {}) {
  const jobStatus = trimString(job?.status || '').toUpperCase()
  if (TERMINAL_JOB_STATUSES.has(jobStatus)) {
    return 100
  }

  if (jobStatus === 'PENDING') {
    return 8
  }

  const items = Array.isArray(job.items) ? job.items : []
  if (!items.length) {
    return jobStatus === 'RUNNING' ? 35 : 5
  }

  const completedCount = items.filter((item) => TERMINAL_ITEM_STATUSES.has(String(item.status || '').trim().toUpperCase())).length
  const runningCount = items.filter((item) => String(item.status || '').trim().toUpperCase() === 'RUNNING').length
  const pendingCount = items.filter((item) => String(item.status || '').trim().toUpperCase() === 'PENDING').length
  const totalCount = items.length

  if (completedCount <= 0) {
    if (runningCount > 0) {
      return Math.max(20, Math.min(78, Math.round((runningCount / totalCount) * 60)))
    }

    if (pendingCount > 0) {
      return 10
    }

    return jobStatus === 'RUNNING' ? 35 : 5
  }

  const weightedProgress = (
    completedCount +
    (runningCount * 0.65) +
    (pendingCount * 0.15)
  ) / totalCount

  return Math.max(10, Math.min(95, Math.round(weightedProgress * 100)))
}

function resolveJobFailureMessage(job = {}, fallbackMessage = 'Remote generation failed.') {
  const failureReason = trimString(job?.failureReason || '')
  if (failureReason) {
    return failureReason
  }

  const items = Array.isArray(job.items) ? job.items : []
  const errorMessages = items
    .map((item) => trimString(item?.lastErrorMessage || ''))
    .filter(Boolean)

  if (errorMessages.length) {
    return Array.from(new Set(errorMessages)).join('；')
  }

  return fallbackMessage
}

function normalizeUsageSummary(usageSummary = null) {
  if (!usageSummary || typeof usageSummary !== 'object') {
    return null
  }

  return {
    billed: usageSummary.billed === true,
    billedAt: trimString(usageSummary.billedAt || ''),
    currency: trimString(usageSummary.currency || 'CNY') || 'CNY',
    totalAmountCny: Math.max(0, Number(usageSummary.totalAmountCny) || 0),
    lines: Array.isArray(usageSummary.lines)
      ? usageSummary.lines.map((line) => ({
          kind: trimString(line?.kind || ''),
          label: trimString(line?.label || ''),
          model: trimString(line?.model || ''),
          units: Math.max(0, Number(line?.units) || 0),
          unitPriceCny: Math.max(0, Number(line?.unitPriceCny) || 0),
          amountCny: Math.max(0, Number(line?.amountCny) || 0),
          metadata: line?.metadata && typeof line.metadata === 'object' ? line.metadata : {}
        }))
      : []
  }
}

function mapGroupStatus(status = '') {
  if (status === 'SUCCEEDED') return 'succeeded'
  if (status === 'PARTIAL_FAILED') return 'partial'
  if (status === 'FAILED') return 'failed'
  if (status === 'CANCELLED') return 'failed'
  return 'running'
}

function buildSeriesGeneratePayload({ draft, sessionToken }) {
  const batchCount = Math.max(1, Number(draft.batchCount) || 1)
  const outputDescriptors = buildSeriesSourceDescriptors(draft)
  const sourceImagePath = outputDescriptors[0]?.sourceImagePath || draft.sourceImage?.storedPath || draft.sourceImage?.path || ''

  return {
    sessionToken,
    sourceImagePath,
    buildJobPayload: async ({ readFile, getMimeTypeFromPath, prepareSourceImageDataUrl, serviceCapacityProfile }) => {
      if (!outputDescriptors.length || (!hasRunnableSourceImage(draft.sourceImage) && !trimString(sourceImagePath))) {
        throw new Error('Source image path is required.')
      }

      const descriptorsWithDataUrl = await Promise.all(outputDescriptors.map(async (descriptor) => ({
        ...descriptor,
        sourceImageDataUrl: await fileToRemoteSourceDataUrl(descriptor.sourceImagePath, {
          readFile,
          getMimeTypeFromPath,
          prepareSourceImageDataUrl
        })
      })))

      return {
        sessionToken,
        jobType: 'IMAGE_SET',
        menuKey: 'series-generate',
        draftSnapshot: {
          ...buildWorkspaceDraftSnapshot(draft, {}),
          model: trimString(draft.model || 'gpt-image-2'),
          size: trimString(draft.size || '1:1'),
          batchCount,
          generateCount: descriptorsWithDataUrl.length
        },
        requestedConcurrency: resolveRequestedConcurrency({
          assetType: 'IMAGE',
          draft,
          serviceCapacityProfile,
          plannedImageCount: descriptorsWithDataUrl.length * batchCount
        }),
        items: Array.from({ length: batchCount }).flatMap((_unused, batchIndex) => {
          return descriptorsWithDataUrl.map((descriptor) => ({
            groupIndex: batchIndex + 1,
            slotIndex: descriptor.slotIndex,
            assetType: 'IMAGE',
            providerType: 'GRSAI',
            providerModel: trimString(draft.model || 'gpt-image-2'),
            inputSnapshot: {
              prompt: descriptor.prompt,
              aspectRatio: descriptor.aspectRatio,
              imageSize: '',
              urls: [descriptor.sourceImageDataUrl],
              title: descriptor.outputTitle
            }
          }))
        })
      }
    },
    mapResult: ({ job, downloadedArtifacts }) => {
      const items = Array.isArray(job.items) ? job.items : []
      const groups = Array.isArray(job.groups) ? job.groups : []
      const artifactMap = new Map(
        downloadedArtifacts.map((artifact) => [`${artifact.groupIndex}:${artifact.slotIndex}`, artifact])
      )

      const groupedResults = groups.map((group) => {
        const groupItems = items
          .filter((item) => Number(item.groupIndex) === Number(group.groupIndex))
          .sort((left, right) => Number(left.slotIndex) - Number(right.slotIndex))

        const outputs = groupItems.map((item) => {
          const artifact = artifactMap.get(`${item.groupIndex}:${item.slotIndex}`)
          if (artifact) {
            return {
              id: `${job.id}-series-${item.groupIndex}-${item.slotIndex}`,
              title: trimString(artifact.metadata?.title || item.title || '') || `Result ${item.slotIndex}`,
              model: trimString(artifact.metadata?.providerModel || item.providerModel || ''),
              savedPath: artifact.savedPath,
              path: artifact.savedPath,
              downloadUrl: trimString(artifact.downloadUrl || ''),
              sourceUrl: trimString(artifact.downloadUrl || ''),
              publishReadyUrl: trimString(artifact.downloadUrl || ''),
              sourceTag: 'generated'
            }
          }

          return {
            id: `${job.id}-series-${item.groupIndex}-${item.slotIndex}-failed`,
            title: trimString(item.title || '') || `Result ${item.slotIndex}`,
            model: trimString(item.providerModel || ''),
            savedPath: '',
            path: '',
            sourceTag: 'failed',
            status: 'failed',
            error: trimString(item.lastErrorMessage || '') || 'Remote generation failed for this slot.'
          }
        })

        return {
          id: `${job.id}-series-group-${group.groupIndex}`,
          groupType: 'batch',
          groupTitle: `Batch ${group.groupIndex}`,
          promptSummary: trimString(draft.prompt || ''),
          notes: '',
          status: mapGroupStatus(group.status),
          completedCount: Number(group.completedItemCount || 0),
          failedCount: Number(group.failedItemCount || 0),
          outputs
        }
      })

      return {
        textResults: [],
        comparisonResults: [],
        groupedResults,
        usageSummary: normalizeUsageSummary(job.usageSummary),
        summary: {
          title: `Image Sets ${groupedResults.length}`,
          description: `${trimString(draft.model || 'gpt-image-2')} / ${trimString(draft.sourceImage?.name || 'reference')}`
        }
      }
    }
  }
}

function buildVideoPayload({ draft, sessionToken }) {
  const sourceImagePath = draft.sourceImage?.storedPath || draft.sourceImage?.path || ''

  return {
    sessionToken,
    sourceImagePath,
    buildJobPayload: async ({ readFile, getMimeTypeFromPath, prepareSourceImageDataUrl, serviceCapacityProfile }) => {
      const sourceImageDataUrl = await fileToRemoteSourceDataUrl(sourceImagePath, {
        readFile,
        getMimeTypeFromPath,
        prepareSourceImageDataUrl
      })

      return {
        sessionToken,
        jobType: 'VIDEO',
        menuKey: 'video-generate',
        draftSnapshot: {
          ...buildWorkspaceDraftSnapshot(draft, {}),
          model: trimString(draft.model || 'MiniMax-Hailuo-2.3-Fast'),
          duration: trimString(draft.duration || '6s'),
          resolution: trimString(draft.resolution || '768P')
        },
        requestedConcurrency: resolveRequestedConcurrency({
          assetType: 'VIDEO',
          draft,
          serviceCapacityProfile
        }),
        items: [
          {
            groupIndex: 1,
            slotIndex: 1,
            assetType: 'VIDEO',
            providerType: 'MINIMAX',
            providerModel: trimString(draft.model || 'MiniMax-Hailuo-2.3-Fast'),
            inputSnapshot: {
              prompt: trimString(draft.prompt || ''),
              duration: trimString(draft.duration || '6s'),
              resolution: trimString(draft.resolution || '768P'),
              aspectRatio: trimString(draft.aspectRatio || '16:9'),
              firstFrameImageDataUrl: sourceImageDataUrl,
              title: 'Video'
            }
          }
        ]
      }
    },
    mapResult: ({ job, downloadedArtifacts }) => {
      const videoArtifact = downloadedArtifacts[0] || null

      return {
        textResults: [],
        comparisonResults: [],
        groupedResults: [
          {
            id: `${job.id}-video-group-1`,
            groupType: 'video',
            groupTitle: 'Video Result',
            status: job.status === 'SUCCEEDED' ? 'succeeded' : 'failed',
            completedCount: job.status === 'SUCCEEDED' ? 1 : 0,
            failedCount: job.status === 'SUCCEEDED' ? 0 : 1,
            outputs: videoArtifact
              ? [
                  {
                    id: `${job.id}-video-1`,
                    title: trimString(videoArtifact.metadata?.title || '') || 'Video',
                    model: trimString(videoArtifact.metadata?.providerModel || '') || trimString(draft.model || ''),
                    savedPath: videoArtifact.savedPath,
                    path: videoArtifact.savedPath,
                    downloadUrl: trimString(videoArtifact.downloadUrl || ''),
                    sourceUrl: trimString(videoArtifact.downloadUrl || ''),
                    publishReadyUrl: trimString(videoArtifact.downloadUrl || ''),
                    sourceTag: 'generated',
                    duration: trimString(draft.duration || '6s'),
                    resolution: trimString(draft.resolution || '768P'),
                    format: 'mp4'
                  }
            ]
              : []
          }
        ],
        usageSummary: normalizeUsageSummary(job.usageSummary),
        summary: {
          title: 'Video Result',
          description: `${trimString(draft.model || 'MiniMax-Hailuo-2.3-Fast')} / ${trimString(draft.resolution || '768P')} / ${trimString(draft.duration || '6s')}`
        }
      }
    }
  }
}

function buildTextSystemPrompt() {
  return 'You are an expert ecommerce text-generation assistant. Return only final user-facing text. No explanations, headings, quotes, numbering, or markdown.'
}

function buildTextUserPrompt(draft = {}) {
  const quantity = clampNumber(draft.quantity, 1, 20, 1)
  const prompt = trimString(draft.prompt || '')

  return [
    prompt,
    `Return ${quantity} standalone results.`,
    'Each result must be on its own line.',
    'Do not number the lines.'
  ].filter(Boolean).join('\n')
}

function resolveTextMaxTokens(draft = {}) {
  const maxChars = Number(draft.maxChars) || 0
  if (maxChars > 0) {
    return clampNumber(maxChars * 3, 64, 4000, 1200)
  }

  return 1200
}

function splitRemoteTextContent(content = '') {
  return String(content || '')
    .split(/\r?\n+/)
    .map((line) => trimString(line))
    .filter(Boolean)
}

function buildTextPayload({ draft, sessionToken }) {
  const quantity = clampNumber(draft.quantity, 1, 20, 1)
  const model = trimString(draft.model || 'deepseek-chat')
  const taskKind = trimString(draft.taskKind || '').toLowerCase()
  const titlePrefix = taskKind === 'description'
    ? 'Description'
    : taskKind === 'title'
      ? 'Title'
      : 'Text'

  return {
    sessionToken,
    buildJobPayload: async ({ serviceCapacityProfile }) => {
      return {
        sessionToken,
        jobType: 'TEXT',
        menuKey: 'workspace',
        draftSnapshot: {
          ...buildWorkspaceDraftSnapshot(draft, {}),
          model,
          quantity
        },
        requestedConcurrency: resolveRequestedConcurrency({
          assetType: 'TEXT',
          draft,
          serviceCapacityProfile
        }),
        items: [
          {
            groupIndex: 1,
            slotIndex: 1,
            assetType: 'TEXT',
            providerType: 'DEEPSEEK',
            providerModel: model,
            inputSnapshot: {
              taskKind,
              quantity,
              titlePrefix,
              systemPrompt: buildTextSystemPrompt(),
              userPrompt: buildTextUserPrompt(draft),
              maxTokens: resolveTextMaxTokens(draft),
              temperature: clampNumber(draft.temperature, 0, 1.5, 0.7)
            }
          }
        ]
      }
    },
    mapResult: ({ job }) => {
      const artifacts = Array.isArray(job.artifacts) ? job.artifacts : []
      const textResults = artifacts
        .slice()
        .sort((left, right) => Number(left.slotIndex) - Number(right.slotIndex))
        .flatMap((artifact, index) => {
          const baseTitle = trimString(artifact.metadata?.title || '') || `Text ${index + 1}`
          const lines = splitRemoteTextContent(artifact.metadata?.content || '')
          return lines.map((content, lineIndex) => ({
            id: `${job.id}-text-${index + 1}-${lineIndex + 1}`,
            title: lines.length > 1 ? `${baseTitle} ${lineIndex + 1}` : baseTitle,
            format: 'txt',
            content
          }))
        })
        .filter(Boolean)

      if (!textResults.length) {
        throw new Error('Remote text generation returned no usable results.')
      }

      return {
        textResults,
        usageSummary: normalizeUsageSummary(job.usageSummary)
      }
    }
  }
}

async function runRemoteJob({
  payloadBuilder,
  outputDirectory,
  onProgress,
  remoteLicensePlatformClient,
  readFile,
  getMimeTypeFromPath,
  prepareSourceImageDataUrl,
  pollIntervalMs,
  pollTimeoutMs
}) {
  const startedAt = Date.now()
  const serviceCapacityProfile = await fetchServiceCapacityProfile(
    remoteLicensePlatformClient,
    payloadBuilder?.sessionToken || ''
  )
  const jobPayload = await payloadBuilder.buildJobPayload({
    readFile,
    getMimeTypeFromPath,
    prepareSourceImageDataUrl,
    serviceCapacityProfile
  })
  const createdJob = await remoteLicensePlatformClient.createGenerationJob(jobPayload)
  let latestJob = createdJob

  await onProgress?.({
    progress: 5,
    status: 'running'
  })

  while (!TERMINAL_JOB_STATUSES.has(String(latestJob.status || ''))) {
    if (Date.now() - startedAt >= pollTimeoutMs) {
      throw new Error('Remote generation timed out. Please retry later.')
    }

    await sleep(resolvePollingIntervalMs(latestJob, pollIntervalMs))
    latestJob = await remoteLicensePlatformClient.getGenerationJob({
      id: createdJob.id,
      sessionToken: jobPayload.sessionToken,
      mode: 'compact'
    })

    await onProgress?.({
      progress: calculateProgress(latestJob),
      status: ['FAILED', 'CANCELLED', 'PARTIAL_FAILED'].includes(String(latestJob.status || '')) ? 'failed' : 'running',
      error: resolveJobFailureMessage(latestJob, 'Remote generation failed.')
    })
  }

  latestJob = await remoteLicensePlatformClient.getGenerationJob({
    id: createdJob.id,
    sessionToken: jobPayload.sessionToken,
    mode: 'full'
  })

  if (latestJob.status === 'FAILED' || latestJob.status === 'CANCELLED') {
    throw new Error(resolveJobFailureMessage(latestJob, 'Remote generation failed.'))
  }

  const downloadedArtifacts = []
  for (const artifact of Array.isArray(latestJob.artifacts) ? latestJob.artifacts : []) {
    const artifactBuffer = await remoteLicensePlatformClient.downloadGenerationArtifact({
      id: artifact.id,
      sessionToken: jobPayload.sessionToken,
      downloadUrl: trimString(artifact.downloadUrl || '')
    })
    const savedPath = await saveArtifactToDirectory({
      artifact,
      artifactBuffer,
      outputDirectory
    })

    downloadedArtifacts.push({
      ...artifact,
      savedPath
    })
  }

  await onProgress?.({
    progress: 100,
    status: latestJob.status === 'PARTIAL_FAILED' ? 'failed' : 'succeeded',
    error: latestJob.status === 'PARTIAL_FAILED'
      ? resolveJobFailureMessage(latestJob, 'Remote generation partially failed.')
      : ''
  })

  return payloadBuilder.mapResult({
    job: latestJob,
    downloadedArtifacts
  })
}

async function runRemoteTextJob({
  payloadBuilder,
  remoteLicensePlatformClient,
  onProgress,
  pollIntervalMs,
  pollTimeoutMs
}) {
  const startedAt = Date.now()
  const serviceCapacityProfile = await fetchServiceCapacityProfile(
    remoteLicensePlatformClient,
    payloadBuilder?.sessionToken || ''
  )
  const jobPayload = await payloadBuilder.buildJobPayload({
    serviceCapacityProfile
  })
  const createdJob = await remoteLicensePlatformClient.createGenerationJob(jobPayload)
  let latestJob = createdJob

  await onProgress?.({
    progress: 5,
    status: 'running'
  })

  while (!TERMINAL_JOB_STATUSES.has(String(latestJob.status || ''))) {
    if (Date.now() - startedAt >= pollTimeoutMs) {
      throw new Error('Remote text generation timed out. Please retry later.')
    }

    await sleep(resolvePollingIntervalMs(latestJob, pollIntervalMs))
    latestJob = await remoteLicensePlatformClient.getGenerationJob({
      id: createdJob.id,
      sessionToken: jobPayload.sessionToken,
      mode: 'compact'
    })

    await onProgress?.({
      progress: calculateProgress(latestJob),
      status: ['FAILED', 'CANCELLED', 'PARTIAL_FAILED'].includes(String(latestJob.status || '')) ? 'failed' : 'running',
      error: resolveJobFailureMessage(latestJob, 'Remote text generation failed.')
    })
  }

  latestJob = await remoteLicensePlatformClient.getGenerationJob({
    id: createdJob.id,
    sessionToken: jobPayload.sessionToken,
    mode: 'full'
  })

  if (latestJob.status === 'FAILED' || latestJob.status === 'CANCELLED') {
    throw new Error(resolveJobFailureMessage(latestJob, 'Remote text generation failed.'))
  }

  await onProgress?.({
    progress: 100,
    status: latestJob.status === 'PARTIAL_FAILED' ? 'failed' : 'succeeded',
    error: latestJob.status === 'PARTIAL_FAILED'
      ? resolveJobFailureMessage(latestJob, 'Remote text generation partially failed.')
      : ''
  })

  return payloadBuilder.mapResult({
    job: latestJob
  })
}

function createCloudGenerationService({
  settingsService,
  remoteLicensePlatformClient,
  readFile = fs.readFile,
  getMimeTypeFromPath,
  prepareSourceImageDataUrl,
  pollIntervalMs = 10000,
  pollTimeoutMs = 30 * 60 * 1000
}) {
  async function generateImageResults({ menuKey, draft, outputDirectory, onProgress }) {
    if (menuKey !== 'series-generate') {
      const error = new Error('Unsupported image task menu key. Use the current series generation flow instead.')
      error.code = 'UNSUPPORTED_IMAGE_MENU_KEY'
      throw error
    }

    const { sessionToken } = ensureRemoteReady(settingsService)

    return runRemoteJob({
      payloadBuilder: buildSeriesGeneratePayload({ draft, sessionToken }),
      outputDirectory,
      onProgress,
      remoteLicensePlatformClient,
      readFile,
      getMimeTypeFromPath,
      prepareSourceImageDataUrl,
      pollIntervalMs,
      pollTimeoutMs
    })
  }

  async function generateVideoResults({ draft, outputDirectory, onProgress }) {
    const { sessionToken } = ensureRemoteReady(settingsService)

    return runRemoteJob({
      payloadBuilder: buildVideoPayload({ draft, sessionToken }),
      outputDirectory,
      onProgress,
      remoteLicensePlatformClient,
      readFile,
      getMimeTypeFromPath,
      prepareSourceImageDataUrl,
      pollIntervalMs,
      pollTimeoutMs
    })
  }

  async function generateTextResults({ draft, onProgress }) {
    const { sessionToken } = ensureRemoteReady(settingsService)

    return runRemoteTextJob({
      payloadBuilder: buildTextPayload({ draft, sessionToken }),
      remoteLicensePlatformClient,
      onProgress,
      pollIntervalMs,
      pollTimeoutMs
    })
  }

  return {
    generateImageResults,
    generateVideoResults,
    generateTextResults
  }
}

module.exports = {
  createCloudGenerationService,
  resolveImageRequestedConcurrencyTarget,
  resolveRequestedConcurrency,
  resolvePollingIntervalMs
}
