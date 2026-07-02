function createWorkspaceTaskExecutionService({
  createTaskExecutionController,
  activeTaskControllers,
  getNow,
  getStoredState,
  persistTaskAndState,
  ensureDirectory,
  persistSourceFiles,
  buildRunningTaskSummary,
  buildFailedTaskSummary,
  buildTaskSummary,
  normalizeTaskProgress,
  buildResultPayload,
  generateImageResults,
  generateTextResults,
  generateVideoResults,
  saveStudioResults,
  writeFile,
  enrichResultPayloadSummary,
  buildWorkspaceProjectDraft,
  applyTaskResultToProjects,
  normalizeProjectRuns,
  upsertProjectRun,
  workspaceProjectRunService,
  settingsService,
  workspaceCreditService,
  safeRuntimeLog,
  runtimeLogger
} = {}) {
  function hasLocalSourcePath(sourceImage = null) {
    if (!sourceImage || typeof sourceImage !== 'object') {
      return false
    }

    return Boolean(
      String(sourceImage.path || '').trim() ||
      String(sourceImage.storedPath || '').trim()
    )
  }

  async function prepareDraftForExecution({ menuKey, draft, inputDirectory, outputDirectory }) {
    await ensureDirectory(inputDirectory)
    await ensureDirectory(outputDirectory)

    const sourcePaths = []
    const sourcePathAssignments = []

    if (menuKey === 'workspace' && hasLocalSourcePath(draft.sourceImage)) {
      const sourcePath = draft.sourceImage?.path || draft.sourceImage?.storedPath || ''
      sourcePathAssignments.push({ type: 'workspace-source' })
      sourcePaths.push(sourcePath)
    }

    if (menuKey === 'series-generate') {
      const seriesSourceItems = Array.isArray(draft.seriesSourceItems) ? draft.seriesSourceItems : []
      if (seriesSourceItems.length) {
        seriesSourceItems.forEach((item, index) => {
          const sourcePath = item?.sourceImage?.path || item?.sourceImage?.storedPath || ''
          if (sourcePath) {
            sourcePathAssignments.push({ type: 'series-generate-source-item', index })
            sourcePaths.push(sourcePath)
          }
        })
      } else {
        const sourcePath = draft.sourceImage?.path || draft.sourceImage?.storedPath || ''
        if (sourcePath) {
          sourcePathAssignments.push({ type: 'series-generate-source' })
          sourcePaths.push(sourcePath)
        }
      }
    }

    if (menuKey === 'video-generate') {
      const sourcePath = draft.sourceImage?.path || draft.sourceImage?.storedPath || ''
      if (sourcePath) {
        sourcePathAssignments.push({ type: 'video-generate-source' })
        sourcePaths.push(sourcePath)
      }
    }

    const persistedSourcePaths = sourcePaths.length
      ? await persistSourceFiles({
          sourcePaths,
          targetDirectory: inputDirectory
        })
      : []

    const preparedDraft = JSON.parse(JSON.stringify(draft))
    sourcePathAssignments.forEach((assignment, index) => {
      const storedPath = persistedSourcePaths[index] || ''
      if (!storedPath) {
        return
      }

      if (assignment.type === 'series-generate-source' && preparedDraft.sourceImage) {
        preparedDraft.sourceImage.storedPath = storedPath
      }

      if (assignment.type === 'series-generate-source-item' && Array.isArray(preparedDraft.seriesSourceItems)) {
        const currentItem = preparedDraft.seriesSourceItems[assignment.index]
        if (currentItem?.sourceImage) {
          currentItem.sourceImage.storedPath = storedPath
          if (assignment.index === 0 && preparedDraft.sourceImage) {
            preparedDraft.sourceImage.storedPath = storedPath
          }
        }
      }

      if (assignment.type === 'workspace-source' && preparedDraft.sourceImage) {
        preparedDraft.sourceImage.storedPath = storedPath
      }

      if (assignment.type === 'video-generate-source' && preparedDraft.sourceImage) {
        preparedDraft.sourceImage.storedPath = storedPath
      }
    })

    return preparedDraft
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
    const executionController = createTaskExecutionController(taskId)
    activeTaskControllers.set(taskId, executionController)
    const executionUpdatedAt = getNow()
    const latestStateBeforeRun = getStoredState()
    const currentProjectRun = projectRunId
      ? normalizeProjectRuns(latestStateBeforeRun.projectRuns).find((projectRun) => projectRun.id === projectRunId) || null
      : null
    const runningTask = buildRunningTaskSummary({
      menuKey,
      draft,
      taskId,
      taskNumber,
      createdAt,
      inputDirectory,
      outputDirectory
    })

    await persistTaskAndState({
      task: runningTask,
      projectRunsPatch: currentProjectRun
        ? upsertProjectRun(
            latestStateBeforeRun.projectRuns,
            workspaceProjectRunService.buildStartedProjectRun({
              projectRun: currentProjectRun,
              menuKey,
              startedAt: executionUpdatedAt
            })
          )
        : null,
      activeProjectRunId: currentProjectRun ? currentProjectRun.id : null
    })

    try {
      let latestRunningTask = runningTask
      const executionStartedAt = new Date(getNow()).getTime()
      const preparedDraft = await prepareDraftForExecution({
        menuKey,
        draft,
        inputDirectory,
        outputDirectory
      })
      if (executionController.isStopped()) {
        return
      }

      const handleTaskProgress = async ({ progress, status, error = '', workspaceStepStates = null } = {}) => {
        if (executionController.isStopped()) {
          return
        }

        const normalizedProgress = normalizeTaskProgress(progress, latestRunningTask.progress)
        const normalizedStatus = String(status || '').trim().toLowerCase()
        const cappedProgress = status === 'succeeded'
          ? Math.min(99, normalizedProgress)
          : normalizedProgress
        const latestState = getStoredState()
        const latestProjectRun = projectRunId
          ? normalizeProjectRuns(latestState.projectRuns).find((projectRun) => projectRun.id === projectRunId) || null
          : null
        const hasWorkspaceStepStates = workspaceStepStates && typeof workspaceStepStates === 'object'
        let projectRunsPatch = null

        if (latestProjectRun && hasWorkspaceStepStates) {
          const nextStepStates = {
            ...latestProjectRun.stepStates,
            ...workspaceStepStates
          }
          const stepStatuses = Object.values(nextStepStates).map((stepState) => String(stepState?.status || 'pending').trim())
          const hasRunningStep = stepStatuses.includes('running')
          const hasFailedStep = stepStatuses.includes('failed')
          const hasSuccessStep = stepStatuses.includes('success')
          const hasPendingStep = stepStatuses.includes('pending')
          const nextStatus = ['running', 'processing', 'submitting'].includes(normalizedStatus)
            ? 'running'
            : hasRunningStep
              ? 'running'
              : hasFailedStep && hasSuccessStep
                ? 'partial'
                : hasFailedStep && hasPendingStep
                  ? 'running'
                  : hasFailedStep
                    ? 'failed'
                    : stepStatuses.every((stepStatus) => stepStatus === 'success')
                      ? 'success'
                      : latestProjectRun.status
          const nextError = String(error || '').trim() || Object.values(nextStepStates)
            .map((stepState) => String(stepState?.error || '').trim())
            .filter(Boolean)
            .join('；')

          projectRunsPatch = upsertProjectRun(latestState.projectRuns, {
            ...latestProjectRun,
            status: nextStatus,
            error: nextError,
            stepStates: nextStepStates
          })
        }

        const shouldPersistTaskProgress = cappedProgress > latestRunningTask.progress
        const shouldPersistProjectRun = Boolean(projectRunsPatch)

        if (!shouldPersistTaskProgress && !shouldPersistProjectRun) {
          return
        }

        latestRunningTask = {
          ...latestRunningTask,
          progress: shouldPersistTaskProgress ? cappedProgress : latestRunningTask.progress,
          ...(String(error || '').trim() ? { error: String(error || '').trim() } : {})
        }

        await persistTaskAndState({
          task: latestRunningTask,
          projectRunsPatch
        })
      }

      const resultPayloadOutcome = await Promise.race([
        Promise.resolve(buildResultPayload(menuKey, preparedDraft, taskId, outputDirectory, {
          generateImageResults,
          generateTextResults,
          generateVideoResults,
          onProgress: handleTaskProgress
        })).then((resultPayload) => ({
          type: 'result',
          resultPayload
        })).catch((error) => ({
          type: 'error',
          error
        })),
        executionController.waitForStop()
      ])

      if (resultPayloadOutcome?.stopped) {
        return
      }

      if (resultPayloadOutcome?.type === 'error') {
        throw resultPayloadOutcome.error
      }

      const resultPayload = resultPayloadOutcome.resultPayload
      if (executionController.isStopped()) {
        return
      }

      const {
        exportItems,
        persistedResultPayload
      } = await saveStudioResults({
        menuKey,
        taskId,
        draft: preparedDraft,
        resultPayload,
        outputDirectory,
        writeFile
      })
      if (executionController.isStopped()) {
        return
      }

      const executionCompletedAt = new Date(getNow()).getTime()
      const enrichedResultPayload = enrichResultPayloadSummary({
        menuKey,
        draft: preparedDraft,
        resultPayload: persistedResultPayload,
        elapsedMilliseconds: executionCompletedAt - executionStartedAt
      })
      const latestState = getStoredState()
      const currentProject = preparedDraft.projectId
        ? (
            latestState.productProjects.find((project) => project.id === preparedDraft.projectId) || buildWorkspaceProjectDraft({
              draft: preparedDraft,
              projectId: preparedDraft.projectId,
              createdAt,
              updatedAt: getNow()
            })
          )
        : null
      const currentProjectRunAfterExecution = projectRunId
        ? normalizeProjectRuns(latestState.projectRuns).find((projectRun) => projectRun.id === projectRunId) || null
        : null
      const enrichedResultPayloadWithRun = {
        ...enrichedResultPayload,
        projectRunId: currentProjectRunAfterExecution?.id || projectRunId || ''
      }
      const completedTask = buildTaskSummary({
        menuKey,
        draft: preparedDraft,
        taskId,
        taskNumber,
        createdAt,
        inputDirectory,
        outputDirectory,
        resultPayload: enrichedResultPayloadWithRun
      })
      let nextProductProjects = latestState.productProjects
      let nextProjectRuns = latestState.projectRuns

      if (currentProject && typeof applyTaskResultToProjects === 'function') {
        nextProductProjects = applyTaskResultToProjects({
          latestState,
          preparedDraft,
          taskId,
          menuKey,
          enrichedResultPayload: enrichedResultPayloadWithRun,
          createdAt
        })
      }

      if (currentProjectRunAfterExecution) {
        nextProjectRuns = upsertProjectRun(
          latestState.projectRuns,
          workspaceProjectRunService.buildProjectRunUpdateFromResult({
            projectRun: currentProjectRunAfterExecution,
            menuKey,
            resultPayload: enrichedResultPayloadWithRun,
            exportItems,
            outputDirectory,
            completedAt: getNow()
          })
        )
      }

      await persistTaskAndState({
        task: completedTask,
        formDraftPatch: {
          [menuKey]: preparedDraft
        },
        resultsByMenuPatch: {
          [menuKey]: enrichedResultPayloadWithRun
        },
        exportItemsByMenuPatch: {
          [menuKey]: exportItems
        },
        productProjectsPatch: nextProductProjects,
        activeProductProjectId: preparedDraft.projectId || null,
        projectRunsPatch: nextProjectRuns,
        activeProjectRunId: currentProjectRunAfterExecution?.id || null
      })

      if (workspaceCreditService && typeof workspaceCreditService.refreshDashboardCredits === 'function') {
        await workspaceCreditService.refreshDashboardCredits({
          target: 'all'
        }).catch(() => undefined)
      }

      await safeRuntimeLog(runtimeLogger, {
        level: 'info',
        event: 'studio-task-succeeded',
        taskId,
        menuKey,
        outputDirectory
      })
    } catch (error) {
      const failedTask = buildFailedTaskSummary({
        menuKey,
        draft,
        taskId,
        taskNumber,
        createdAt,
        inputDirectory,
        outputDirectory,
        errorMessage: error.message
      })
      const latestState = getStoredState()
      const currentProjectRun = projectRunId
        ? normalizeProjectRuns(latestState.projectRuns).find((projectRun) => projectRun.id === projectRunId) || null
        : null

      await persistTaskAndState({
        task: failedTask,
        projectRunsPatch: currentProjectRun
          ? upsertProjectRun(
              latestState.projectRuns,
              workspaceProjectRunService.buildFailedProjectRun({
                projectRun: currentProjectRun,
                menuKey,
                errorMessage: error.message,
                failedAt: getNow()
              })
            )
          : null,
        activeProjectRunId: currentProjectRun?.id || null
      })

      await safeRuntimeLog(runtimeLogger, {
        level: 'error',
        event: 'studio-task-failed',
        taskId,
        menuKey,
        outputDirectory,
        error: error.message
      })
    } finally {
      activeTaskControllers.delete(taskId)
    }
  }

  return {
    prepareDraftForExecution,
    runQueuedTaskExecution
  }
}

module.exports = {
  createWorkspaceTaskExecutionService
}
