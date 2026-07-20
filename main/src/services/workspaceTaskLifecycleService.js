const studioMenuConfig = require('../../../shared/studio-menu-config.json')

function resolveTaskBalanceRequirements(menuKey, draft = {}) {
  if (menuKey === 'workspace') {
    const hasSourceImage = Boolean(draft.sourceImage)

    return {
      textRequired: Boolean(draft.enabledSteps?.title || draft.enabledSteps?.description),
      imageRequired: Boolean(draft.enabledSteps?.image && hasSourceImage),
      videoRequired: Boolean(draft.enabledSteps?.video && hasSourceImage)
    }
  }

  if (menuKey === 'series-generate') {
    return {
      textRequired: false,
      imageRequired: true,
      videoRequired: false
    }
  }

  if (menuKey === 'video-generate') {
    return {
      textRequired: false,
      imageRequired: false,
      videoRequired: true
    }
  }

  return {
    textRequired: false,
    imageRequired: false,
    videoRequired: false
  }
}

function assertSufficientWalletBalance({ menuKey, draft, dashboardCreditState }) {
  const balanceState = dashboardCreditState && typeof dashboardCreditState === 'object'
    ? dashboardCreditState
    : {}
  const requirements = resolveTaskBalanceRequirements(menuKey, draft)
  const textBalance = Math.max(0, Number(balanceState.text?.balanceCny) || 0)
  const imageBalance = Math.max(0, Number(balanceState.image?.balanceCny) || 0)
  const videoBalance = Math.max(0, Number(balanceState.video?.balanceCny) || 0)

  if (requirements.textRequired && textBalance <= 0) {
    const error = new Error('文本余额不足，请先充值后再提交。')
    error.code = 'INSUFFICIENT_TEXT_BALANCE'
    throw error
  }

  if (requirements.imageRequired && imageBalance <= 0) {
    const error = new Error('图片余额不足，请先充值后再提交。')
    error.code = 'INSUFFICIENT_IMAGE_BALANCE'
    throw error
  }

  if (requirements.videoRequired && videoBalance <= 0) {
    const error = new Error('视频余额不足，请先充值后再提交。')
    error.code = 'INSUFFICIENT_VIDEO_BALANCE'
    throw error
  }
}

function createWorkspaceTaskLifecycleService({
  getStoredState,
  getStoredTasks,
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
  enqueueTaskExecution,
  outputDirectoryResolver
} = {}) {
  const supportedTaskMenuKeys = new Set(studioMenuConfig.runtimeTaskMenuKeys || ['workspace', 'series-generate', 'video-generate'])

  async function createTask({ menuKey = 'workspace', draft: incomingDraft } = {}) {
    if (!supportedTaskMenuKeys.has(menuKey)) {
      const error = new Error('Unsupported task menu key. Use the current workspace, image, or video flow instead.')
      error.code = 'UNSUPPORTED_MENU_KEY'
      throw error
    }

    const state = getStoredState()
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
    } = outputDirectoryResolver(taskId, menuKey, getTaskDataDirectories)

    const preparedProjectState = workspaceProductProjectService.prepareProjectStateForTaskCreation({
      state,
      menuKey,
      draft,
      taskId,
      projectRunId
    })
    draft = preparedProjectState.draft
    currentProjectForRun = preparedProjectState.currentProjectForRun
    nextProductProjects = preparedProjectState.nextProductProjects
    nextActiveProductProjectId = preparedProjectState.nextActiveProductProjectId

    if (draft.projectId && currentProjectForRun) {
      const createdProjectRun = workspaceProjectRunService.buildProjectRunRecord({
        runId: projectRunId,
        projectId: draft.projectId,
        menuKey,
        draft,
        currentProject: currentProjectForRun,
        taskId,
        taskNumber,
        createdAt,
        runDirectory: outputDirectory
      })

      nextProjectRuns = upsertProjectRun(state.projectRuns, createdProjectRun)
      nextActiveProjectRunId = createdProjectRun.id
    }

    const activationStatus = authorizationService && typeof authorizationService.getActivationStatus === 'function'
      ? await authorizationService.getActivationStatus().catch(() => null)
      : null

    ensureDraftWithinCapability({
      menuKey,
      draft,
      activationStatus,
      runtimeSnapshot: {
        agentReadiness: buildAgentReadinessSnapshot(getStoredTasks(state))
      }
    })

    validateTaskScale(menuKey, draft)
    const creditSyncResult = await syncCreditStateWithRealtimeBalance()
    assertSufficientWalletBalance({
      menuKey,
      draft,
      dashboardCreditState: creditSyncResult.dashboardCreditState
    })
    const queuedTask = buildQueuedTaskSummary({
      menuKey,
      draft,
      taskId,
      taskNumber,
      createdAt,
      inputDirectory,
      outputDirectory
    })

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
  }

  return {
    createTask
  }
}

module.exports = {
  createWorkspaceTaskLifecycleService
}
