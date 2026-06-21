import { describe, expect, it, vi } from 'vitest'

describe('workspaceStateMaintenanceService', () => {
  async function createService(overrides = {}) {
    const { createWorkspaceStateMaintenanceService } = await import('../../main/src/services/workspaceStateMaintenanceService.js')

    let state = {
      formDrafts: { workspace: { productName: 'Lamp' } },
      resultsByMenu: { workspace: { textResults: [{ id: 'result-1' }] } },
      exportItemsByMenu: { workspace: [{ id: 'export-1' }] },
      requestMetrics: [{ id: 'metric-1' }],
      tasks: []
    }
    const savedStates = []
    const persistedTasks = []
    const scanStoredExportItemsByMenu = vi.fn(() => ({
      workspace: [{ id: 'scanned-export-1' }]
    }))

    const service = createWorkspaceStateMaintenanceService({
      getStoredState: () => state,
      getStoredTasks: () => state.tasks,
      saveState: (nextState) => {
        state = nextState
        savedStates.push(nextState)
        return state
      },
      persistTaskAndState: async ({ task }) => {
        persistedTasks.push(task)
        state = {
          ...state,
          tasks: [task, ...state.tasks.filter((item) => item.id !== task.id)]
        }
      },
      safeRuntimeLog: async () => undefined,
      runtimeLogger: null,
      buildPendingConfirmationTaskSummary: (task) => ({
        ...task,
        status: '待确认',
        error: 'reconciled'
      }),
      createDefaultDrafts: () => ({ workspace: { productName: '' } }),
      createDefaultResultsByMenu: () => ({ workspace: { textResults: [] } }),
      createDefaultExportItemsByMenu: () => ({ workspace: [] }),
      createDefaultRequestMetrics: () => [],
      scanStoredExportItemsByMenu,
      mergeExportItemsByMenu: ({ scannedExportItemsByMenu, storedExportItemsByMenu }) => ({
        ...scannedExportItemsByMenu,
        ...storedExportItemsByMenu
      }),
      outputRootDirectory: 'F:/output',
      readdirSync: () => [],
      statSync: () => ({}),
      getNowMs: () => 1000,
      exportScanCacheTtlMs: 3000,
      queuedTaskExecutions: [],
      activeTaskControllers: new Map(),
      ...overrides
    })

    return {
      service,
      getState: () => state,
      savedStates,
      persistedTasks,
      scanStoredExportItemsByMenu
    }
  }

  it('caches resolved export items until invalidated', async () => {
    const { service, scanStoredExportItemsByMenu } = await createService()

    const first = service.getResolvedExportItemsByMenu()
    const second = service.getResolvedExportItemsByMenu()

    expect(first.workspace[0].id).toBe('export-1')
    expect(second.workspace[0].id).toBe('export-1')
    expect(scanStoredExportItemsByMenu).toHaveBeenCalledTimes(1)

    service.invalidateExportItemsCache()
    service.getResolvedExportItemsByMenu()

    expect(scanStoredExportItemsByMenu).toHaveBeenCalledTimes(2)
  })

  it('reconciles orphaned active tasks before cleanup', async () => {
    const { service, persistedTasks } = await createService({
      getStoredTasks: () => [
        { id: 'task-1', status: '等待中' },
        { id: 'task-2', status: '已完成' }
      ]
    })

    const reconciled = await service.reconcileOrphanedActiveTasks()

    expect(reconciled).toHaveLength(1)
    expect(reconciled[0]).toMatchObject({
      id: 'task-1',
      status: '待确认'
    })
    expect(persistedTasks[0]).toMatchObject({
      id: 'task-1',
      status: '待确认'
    })
  })

  it('clears runtime state when no active tasks remain', async () => {
    const { service, getState, savedStates } = await createService({
      getStoredTasks: () => [
        { id: 'task-1', status: '已完成' }
      ]
    })

    const result = await service.clearRuntimeState()

    expect(result).toEqual({
      cleared: true
    })
    expect(savedStates).toHaveLength(1)
    expect(getState().formDrafts.workspace.productName).toBe('')
    expect(getState().resultsByMenu.workspace.textResults).toEqual([])
    expect(getState().exportItemsByMenu.workspace).toEqual([])
    expect(getState().requestMetrics).toEqual([])
  })
})
