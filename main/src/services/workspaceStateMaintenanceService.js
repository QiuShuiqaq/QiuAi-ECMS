function createWorkspaceStateMaintenanceService({
  getStoredState,
  getStoredTasks,
  saveState,
  persistTaskAndState,
  safeRuntimeLog,
  runtimeLogger,
  buildPendingConfirmationTaskSummary,
  createDefaultDrafts,
  createDefaultResultsByMenu,
  createDefaultExportItemsByMenu,
  createDefaultRequestMetrics,
  scanStoredExportItemsByMenu,
  mergeExportItemsByMenu,
  outputRootDirectory,
  readdirSync,
  statSync,
  getNowMs,
  exportScanCacheTtlMs = 3000,
  queuedTaskExecutions,
  activeTaskControllers
} = {}) {
  let cachedExportItemsByMenu = null
  let cachedExportItemsAt = 0
  let isExportItemsCacheDirty = true

  function invalidateExportItemsCache() {
    cachedExportItemsByMenu = null
    cachedExportItemsAt = 0
    isExportItemsCacheDirty = true
  }

  async function reconcileOrphanedActiveTasks(tasks = getStoredTasks()) {
    const activeTasks = tasks.filter((task) => ['等待中', '进行中'].includes(task.status))

    if (!activeTasks.length) {
      return []
    }

    const reconciledTasks = []
    for (const task of activeTasks) {
      const isQueuedLocally = queuedTaskExecutions.some((item) => item?.taskId === task.id)
      const hasActiveController = activeTaskControllers.has(task.id)

      if (isQueuedLocally || hasActiveController) {
        continue
      }

      const pendingTask = buildPendingConfirmationTaskSummary(task)
      await persistTaskAndState({
        task: pendingTask
      })
      reconciledTasks.push(pendingTask)
    }

    if (reconciledTasks.length) {
      await safeRuntimeLog(runtimeLogger, {
        level: 'warn',
        scope: 'studio-workspace',
        message: 'Marked orphaned active studio tasks as pending confirmation before runtime cleanup',
        taskIds: reconciledTasks.map((task) => task.id)
      })
    }

    return reconciledTasks
  }

  function getResolvedExportItemsByMenu(state = getStoredState()) {
    const now = getNowMs()
    const shouldReuseCache = !isExportItemsCacheDirty &&
      cachedExportItemsByMenu &&
      now - cachedExportItemsAt <= exportScanCacheTtlMs

    const scannedExportItemsByMenu = shouldReuseCache
      ? cachedExportItemsByMenu
      : scanStoredExportItemsByMenu({
          outputRootDirectory,
          readdirSync,
          statSync
        })

    if (!shouldReuseCache) {
      cachedExportItemsByMenu = scannedExportItemsByMenu
      cachedExportItemsAt = now
      isExportItemsCacheDirty = false
    }

    return mergeExportItemsByMenu({
      scannedExportItemsByMenu,
      storedExportItemsByMenu: state.exportItemsByMenu || {}
    })
  }

  async function clearRuntimeState() {
    await reconcileOrphanedActiveTasks()

    const state = getStoredState()
    const tasks = getStoredTasks(state)
    const hasActiveTasks = tasks.some((task) => ['等待中', '进行中'].includes(task.status))

    if (hasActiveTasks) {
      throw new Error('当前存在进行中的任务，暂不能一键清理')
    }

    saveState({
      ...state,
      formDrafts: createDefaultDrafts(),
      resultsByMenu: createDefaultResultsByMenu(),
      exportItemsByMenu: createDefaultExportItemsByMenu(),
      requestMetrics: createDefaultRequestMetrics()
    })
    invalidateExportItemsCache()

    await safeRuntimeLog(runtimeLogger, {
      level: 'info',
      scope: 'studio-workspace',
      message: 'Cleared runtime studio state while preserving exports and settings'
    })

    return {
      cleared: true
    }
  }

  return {
    invalidateExportItemsCache,
    reconcileOrphanedActiveTasks,
    getResolvedExportItemsByMenu,
    clearRuntimeState
  }
}

module.exports = {
  createWorkspaceStateMaintenanceService
}
