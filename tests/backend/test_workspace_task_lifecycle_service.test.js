import { describe, expect, it, vi } from 'vitest'

describe('workspaceTaskLifecycleService', () => {
  async function createService(overrides = {}) {
    const { createWorkspaceTaskLifecycleService } = await import('../../main/src/services/workspaceTaskLifecycleService.js')

    const persistTaskAndState = vi.fn(async () => undefined)
    const enqueueTaskExecution = vi.fn()
    const saveSettings = vi.fn(async () => undefined)

    const service = createWorkspaceTaskLifecycleService({
      getStoredState: () => ({
        formDrafts: {
          workspace: {
            productName: 'Lamp'
          }
        },
        productProjects: [],
        activeProductProjectId: '',
        projectRuns: [],
        activeProjectRunId: ''
      }),
      getStoredTasks: () => [],
      settingsService: {
        getSettings: () => ({
          creditState: {
            remainingCredits: 1000,
            frozenCredits: 0,
            usedCredits: 0,
            activityHistory: [],
            taskLedger: {}
          }
        }),
        saveSettings
      },
      authorizationService: {
        getActivationStatus: async () => ({
          activated: true
        })
      },
      createId: (() => {
        let index = 0
        return () => `id-${++index}`
      })(),
      createTaskNumber: () => 'QAI-20260621-0001',
      getNow: () => '2026-06-21T13:00:00.000Z',
      formatDisplayDateTime: (value) => value,
      getTaskDataDirectories: ({ featureKey, taskId }) => ({
        inputDirectory: `F:/input/${featureKey}/${taskId}`,
        outputDirectory: `F:/output/${featureKey}/${taskId}`
      }),
      normalizeDraftForMenu: (_menuKey, draft = {}) => draft,
      createDefaultDrafts: () => ({
        workspace: {
          productName: ''
        }
      }),
      createDefaultResultsByMenu: () => ({
        workspace: {
          textResults: [],
          comparisonResults: [],
          groupedResults: []
        }
      }),
      buildAgentReadinessSnapshot: () => ({
        queue: { queuedCount: 0, runningCount: 0, isProcessing: false, queuedTaskIds: [], activeTaskIds: [] }
      }),
      ensureDraftWithinCapability: () => undefined,
      validateTaskScale: () => undefined,
      estimateTaskCredits: () => 600,
      buildQueuedTaskSummary: ({ taskId, taskNumber, createdAt, inputDirectory, outputDirectory }) => ({
        id: taskId,
        taskNumber,
        createdAt,
        inputDirectory,
        outputDirectory,
        status: '等待中',
        estimatedCredits: 600
      }),
      persistTaskAndState,
      workspaceProductProjectService: {
        prepareProjectStateForTaskCreation: ({ state, draft }) => ({
          draft: {
            ...draft
          },
          currentProjectForRun: null,
          nextProductProjects: state.productProjects,
          nextActiveProductProjectId: state.activeProductProjectId
        })
      },
      workspaceProjectRunService: {
        buildProjectRunRecord: (payload) => ({
          id: payload.runId
        })
      },
      upsertProjectRun: (projectRuns = [], nextRun = {}) => [nextRun, ...projectRuns.filter((item) => item.id !== nextRun.id)],
      syncCreditStateWithRealtimeBalance: vi.fn(async () => ({
        synced: false
      })),
      workspaceCreditService: {
        freezeCreditsForTask: vi.fn(({ creditState }) => ({
          ...creditState,
          remainingCredits: 400,
          frozenCredits: 600
        })),
        refundCreditsForTask: vi.fn(({ creditState }) => ({
          ...creditState,
          remainingCredits: 1000,
          frozenCredits: 0
        }))
      },
      enqueueTaskExecution,
      outputDirectoryResolver: (taskId, menuKey, resolveTaskDirectories) => resolveTaskDirectories({
        featureKey: menuKey,
        taskId
      }),
      ...overrides
    })

    return {
      service,
      persistTaskAndState,
      enqueueTaskExecution,
      saveSettings
    }
  }

  it('creates a queued task and enqueues execution through the dedicated lifecycle service', async () => {
    const { service, persistTaskAndState, enqueueTaskExecution, saveSettings } = await createService()

    const task = await service.createTask({
      menuKey: 'workspace',
      draft: {
        productName: 'Lamp'
      }
    })

    expect(task).toMatchObject({
      id: 'id-1',
      taskNumber: 'QAI-20260621-0001',
      status: '等待中'
    })
    expect(saveSettings).toHaveBeenCalledTimes(1)
    expect(persistTaskAndState).toHaveBeenCalledTimes(1)
    expect(enqueueTaskExecution).toHaveBeenCalledWith(expect.objectContaining({
      taskId: 'id-1',
      menuKey: 'workspace'
    }))
  })

  it('refunds frozen credits when task persistence fails', async () => {
    const { service, saveSettings } = await createService({
      persistTaskAndState: vi.fn(async () => {
        throw new Error('persist failed')
      })
    })

    await expect(service.createTask({
      menuKey: 'workspace',
      draft: {
        productName: 'Lamp'
      }
    })).rejects.toThrow('persist failed')

    expect(saveSettings).toHaveBeenCalledTimes(2)
    expect(saveSettings.mock.calls.at(-1)?.[0]).toMatchObject({
      creditState: {
        remainingCredits: 1000,
        frozenCredits: 0
      }
    })
  })

  it('rejects unsupported non-live task entry points', async () => {
    const { service, persistTaskAndState, enqueueTaskExecution, saveSettings } = await createService()

    await expect(service.createTask({
      menuKey: 'title-generator',
      draft: {
        productName: 'Lamp'
      }
    })).rejects.toMatchObject({
      code: 'UNSUPPORTED_MENU_KEY'
    })

    await expect(service.createTask({
      menuKey: 'description-generator',
      draft: {
        productName: 'Lamp'
      }
    })).rejects.toMatchObject({
      code: 'UNSUPPORTED_MENU_KEY'
    })

    await expect(service.createTask({
      menuKey: 'unknown-feature',
      draft: {
        productName: 'Lamp'
      }
    })).rejects.toMatchObject({
      code: 'UNSUPPORTED_MENU_KEY'
    })

    expect(saveSettings).not.toHaveBeenCalled()
    expect(persistTaskAndState).not.toHaveBeenCalled()
    expect(enqueueTaskExecution).not.toHaveBeenCalled()
  })
})
