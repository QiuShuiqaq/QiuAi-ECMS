const path = require('node:path')

function createWorkspaceProjectRunService({
  createDefaultProjectRunStepStates,
  resolveWorkspaceEnabledRunSteps,
  resolveProjectRunStepKey,
  normalizeProjectRun,
  normalizeProductProject,
  normalizeStringList,
  sanitizePathSegment
} = {}) {
  if (typeof createDefaultProjectRunStepStates !== 'function') {
    throw new Error('createDefaultProjectRunStepStates is required')
  }
  if (typeof resolveWorkspaceEnabledRunSteps !== 'function') {
    throw new Error('resolveWorkspaceEnabledRunSteps is required')
  }
  if (typeof resolveProjectRunStepKey !== 'function') {
    throw new Error('resolveProjectRunStepKey is required')
  }
  if (typeof normalizeProjectRun !== 'function') {
    throw new Error('normalizeProjectRun is required')
  }
  if (typeof normalizeProductProject !== 'function') {
    throw new Error('normalizeProductProject is required')
  }
  if (typeof normalizeStringList !== 'function') {
    throw new Error('normalizeStringList is required')
  }
  if (typeof sanitizePathSegment !== 'function') {
    throw new Error('sanitizePathSegment is required')
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
      progress: 0,
      error: '',
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
    const hasSuccess = statuses.some((status) => status === 'success')
    const hasFailed = statuses.some((status) => status === 'failed')

    if (statuses.some((status) => status === 'running')) {
      return 'running'
    }

    if (hasFailed && hasSuccess) {
      return 'partial'
    }

    if (hasFailed) {
      return 'failed'
    }

    if (statuses.every((status) => status === 'success')) {
      return 'success'
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
      const firstPendingStepKey = Object.keys(nextStepStates).find((stepKey) => nextStepStates[stepKey]?.status === 'pending')
      if (firstPendingStepKey) {
        nextStepStates[firstPendingStepKey] = {
          ...nextStepStates[firstPendingStepKey],
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
      progress: Math.max(1, Number(normalizedProjectRun.progress) || 0),
      error: '',
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
        savedPath: item.savedPath || item.path || '',
        sourceUrl: item.sourceUrl || item.downloadUrl || '',
        publishReadyUrl: item.publishReadyUrl || item.downloadUrl || ''
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
    const usageSummary = resultPayload?.usageSummary && typeof resultPayload.usageSummary === 'object'
      ? resultPayload.usageSummary
      : null
    const workspaceStepStates = resultPayload?.workspaceStepStates && typeof resultPayload.workspaceStepStates === 'object'
      ? resultPayload.workspaceStepStates
      : null

    if (menuKey === 'workspace') {
      const titleCandidates = (resultPayload.textResults || [])
        .filter((item) => item.kind === 'title')
        .map((item) => String(item.content || '').trim())
        .filter(Boolean)
      const titleValue = titleCandidates[0] || ''
      const titleStorage = resolveTextStorageFromResultPayload(resultPayload, exportItems)
      if (titleCandidates.length) {
        nextOutputs.title = String(titleValue || '').trim()
        nextOutputs.titleCandidates = titleCandidates
        nextOutputs.selectedTitle = String(titleValue || '').trim()
        nextStorage.titleFile = titleStorage.titleFile || nextStorage.titleFile
      }
      stepStates.title = {
        ...stepStates.title,
        ...(workspaceStepStates?.title || {}),
        status: workspaceStepStates?.title?.status || 'success',
        completedAt: workspaceStepStates?.title?.completedAt || completedAt
      }
    }

    if (menuKey === 'workspace') {
      const descriptionCandidates = (resultPayload.textResults || [])
        .filter((item) => item.kind === 'description')
        .map((item) => String(item.content || '').trim())
        .filter(Boolean)
      const descriptionValue = descriptionCandidates[0] || ''
      const textStorage = resolveTextStorageFromResultPayload(resultPayload, exportItems)
      if (descriptionCandidates.length) {
        nextOutputs.description = String(descriptionValue || '').trim()
        nextOutputs.descriptionCandidates = descriptionCandidates
        nextOutputs.selectedDescription = String(descriptionValue || '').trim()
        nextStorage.descriptionFile = textStorage.descriptionFile || nextStorage.descriptionFile
      }
      stepStates.description = {
        ...stepStates.description,
        ...(workspaceStepStates?.description || {}),
        status: workspaceStepStates?.description?.status || 'success',
        completedAt: workspaceStepStates?.description?.completedAt || completedAt
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
        ...(workspaceStepStates?.image || {}),
        status: workspaceStepStates?.image?.status || 'success',
        completedAt: workspaceStepStates?.image?.completedAt || completedAt
      }
    }

    if (menuKey === 'workspace' || menuKey === 'video-generate') {
      const videoOutput = resolveVideoRunOutput(resultPayload)
      if (videoOutput) {
        nextOutputs.video = {
          ...videoOutput,
          path: videoOutput.savedPath || videoOutput.path || '',
          savedPath: videoOutput.savedPath || videoOutput.path || '',
          sourceUrl: videoOutput.sourceUrl || videoOutput.downloadUrl || '',
          publishReadyUrl: videoOutput.publishReadyUrl || videoOutput.downloadUrl || ''
        }
        nextStorage.videoDirectory = nextOutputs.video.savedPath
          ? path.dirname(nextOutputs.video.savedPath)
          : nextStorage.videoDirectory
      }
      stepStates.video = {
        ...stepStates.video,
        ...(workspaceStepStates?.video || {}),
        status: workspaceStepStates?.video?.status || 'success',
        completedAt: workspaceStepStates?.video?.completedAt || completedAt
      }
    }

    nextProjectRun = normalizeProjectRun({
      ...nextProjectRun,
      progress: 100,
      error: Array.from(
        new Set(
          Object.values(stepStates)
            .map((stepState) => String(stepState?.error || '').trim())
            .filter(Boolean)
        )
      ).join('；'),
      stepStates,
      outputs: nextOutputs,
      storage: nextStorage,
      usage: usageSummary
        ? {
            totalAmountCny: Math.max(0, Number(usageSummary.totalAmountCny) || 0),
            currency: String(usageSummary.currency || 'CNY').trim() || 'CNY',
            billedAt: String(usageSummary.billedAt || '').trim(),
            lines: Array.isArray(usageSummary.lines) ? usageSummary.lines : []
          }
        : nextProjectRun.usage,
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
      progress: 100,
      error: String(errorMessage || '').trim(),
      stepStates: nextStepStates,
      completedAt: failedAt
    })
  }

  return {
    attachProjectRunToProject,
    buildProjectRunRecord,
    buildStartedProjectRun,
    buildProjectRunUpdateFromResult,
    buildFailedProjectRun
  }
}

module.exports = {
  createWorkspaceProjectRunService
}
