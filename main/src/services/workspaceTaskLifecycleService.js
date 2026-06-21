const studioMenuConfig = require('../../../shared/studio-menu-config.json')

function createWorkspaceTaskLifecycleService({
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
  estimateTaskCredits,
  buildQueuedTaskSummary,
  persistTaskAndState,
  workspaceProductProjectService,
  workspaceProjectRunService,
  upsertProjectRun,
  syncCreditStateWithRealtimeBalance,
  workspaceCreditService,
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

      const frozenCreditState = workspaceCreditService.freezeCreditsForTask({
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
        const refundedCreditState = workspaceCreditService.refundCreditsForTask({
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

  return {
    createTask
  }
}

module.exports = {
  createWorkspaceTaskLifecycleService
}
