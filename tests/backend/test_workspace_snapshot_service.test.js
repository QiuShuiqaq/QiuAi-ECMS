import { describe, expect, it, vi } from 'vitest'

describe('workspaceSnapshotService', () => {
  async function createService({
    state = {},
    settings = {},
    tasks = [],
    exportItemsByMenu = null
  } = {}) {
    const { createWorkspaceSnapshotService } = await import('../../main/src/services/workspaceSnapshotService.js')

    const currentState = {
      productProjects: [],
      activeProductProjectId: '',
      projectRuns: [],
      activeProjectRunId: '',
      formDrafts: {},
      resultsByMenu: {},
      requestMetrics: [],
      ...state
    }
    const currentSettings = {
      themeMode: 'dark',
      authPlatform: {},
      ...settings
    }

    const refreshDashboardCredits = vi.fn(async () => undefined)
    const service = createWorkspaceSnapshotService({
      settingsService: {
        getSettings: () => currentSettings
      },
      getStoredState: () => currentState,
      getStoredTasks: () => tasks,
      getResolvedExportItemsByMenu: () => exportItemsByMenu || currentState.exportItemsByMenu || {},
      buildAgentReadinessSnapshot: (taskList = []) => ({
        queue: {
          queuedCount: 0,
          runningCount: 0,
          isProcessing: false,
          queuedTaskIds: [],
          activeTaskIds: []
        },
        executionLog: taskList.map((task) => ({ taskId: task.id }))
      }),
      refreshDashboardCredits,
      hydrateResultsByMenuForDisplay: (resultsByMenu = {}) => resultsByMenu,
      hydrateProjectRunsForDisplay: (projectRuns = []) => projectRuns.map((item) => ({ ...item, hydrated: true })),
      normalizeRequestMetrics: (requestMetrics = []) => requestMetrics,
      normalizeCreditStateForDisplay: (creditState = {}) => ({
        totalPurchasedCredits: 0,
        remainingCredits: 0,
        frozenCredits: 0,
        usedCredits: 0,
        lastAdjustmentAt: '',
        lastAdjustmentOperation: '',
        lastAdjustmentAmount: 0,
        adjustmentHistory: [],
        activityHistory: [],
        taskLedger: {},
        ...creditState
      }),
      sortTasks: (taskList = []) => [...taskList].sort((left, right) => {
        return new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime()
      }),
      countCurrentResults: (resultPayload = {}) => {
        const groupedCount = (resultPayload.groupedResults || []).reduce((total, group) => total + (group.outputs || []).length, 0)
        return (resultPayload.textResults || []).length + (resultPayload.comparisonResults || []).length + groupedCount
      },
      menuItems: [{ key: 'workspace', label: '工作台' }],
      workspaceDashboardSections: [
        { cardKey: 'workspaceCard', menuKey: 'workspace', title: '工作台' }
      ],
      menuLabelMap: {
        workspace: '工作台'
      },
      taskMenuMapByCategory: {
        工作台: 'workspace'
      },
      modelCreditCostMap: {
        'gpt-image-2': 600
      },
      creditActivityHistoryLimit: 20
    })

    return {
      service,
      refreshDashboardCredits
    }
  }

  it('builds snapshot dashboard cards and host/settings summary for display', async () => {
    const { service } = await createService({
      state: {
        productProjects: [{ id: 'project-1' }],
        activeProductProjectId: 'project-1',
        projectRuns: [{ id: 'run-1' }],
        activeProjectRunId: 'run-1',
        formDrafts: {
          workspace: {
            productName: 'Lamp'
          }
        },
        resultsByMenu: {
          workspace: {
            textResults: [{ id: 'text-1' }],
            comparisonResults: [],
            groupedResults: [
              {
                outputs: [{ id: 'image-1' }, { id: 'image-2' }]
              }
            ]
          }
        },
        exportItemsByMenu: {
          workspace: [
            { id: 'export-1', status: '已存储' }
          ]
        },
        requestMetrics: [
          {
            id: 'request-1',
            createdAt: '2026-06-21T10:00:00.000Z',
            requestStatus: 'success',
            elapsedMs: 320,
            requestPath: '/api/generate',
            method: 'POST'
          }
        ]
      },
      settings: {
        creditState: {
          frozenCredits: 10,
          usedCredits: 20,
          lastAdjustmentAt: '2026-06-21T09:00:00.000Z',
          lastAdjustmentOperation: 'increase',
          lastAdjustmentAmount: 600,
          activityHistory: [
            {
              id: 'activity-1',
              type: 'task_settle',
              operation: 'decrease',
              amount: 600,
              taskNumber: 'QAI-001',
              taskName: '任务 1',
              modelSummary: 'gpt-image-2'
            }
          ]
        },
        dashboardCreditState: {
          text: { balanceCny: 8.5, lastSyncedAt: '2026-06-21T08:00:00.000Z' },
          image: { totalCredits: 3000, remainingCredits: 1200, balanceCny: 28.5 },
          video: { balanceCny: 18.75, lastSyncedAt: '2026-06-21T08:00:00.000Z' }
        },
        authPlatform: {
          remoteServiceCapacity: {
            imageConcurrentLimit: 8
          }
        }
      },
      tasks: [
        { id: 'task-1', category: '工作台', status: '已完成', createdAt: '2026-06-21T10:01:00.000Z' },
        { id: 'task-2', menuKey: 'workspace', status: '失败', createdAt: '2026-06-21T10:02:00.000Z' }
      ]
    })

    const snapshot = service.getSnapshot()

    expect(snapshot.projectRuns[0]).toMatchObject({ id: 'run-1', hydrated: true })
    expect(snapshot.workspaceDashboard.workspaceCard).toMatchObject({
      title: '工作台'
    })
    expect(snapshot.workspaceDashboard.workspaceCard.items).toEqual(expect.arrayContaining([
      { label: '任务总数', value: '2' },
      { label: '已完成任务', value: '1' },
      { label: '失败任务', value: '1' },
      { label: '当前结果数', value: '3' },
      { label: '已存储结果', value: '1' }
    ]))
    expect(snapshot.workspaceDashboard.creditOverview.ledgers.map((item) => item.key)).toEqual(['text', 'image', 'video'])
    expect(snapshot.workspaceDashboard.creditMessages.ledgers[1].items[0]).toMatchObject({
      label: '任务消耗积分',
      amountDisplay: '-600'
    })
    expect(snapshot.workspaceDashboard.networkMonitor.summary).toMatchObject({
      latestLatencyMs: 320,
      averageLatencyMs: 320,
      successRate: '100%'
    })
    expect(snapshot.settingsSummary).toMatchObject({
      dashboardCreditState: {
        text: { balanceCny: 8.5 },
        image: { totalCredits: 3000, remainingCredits: 1200, balanceCny: 28.5 },
        video: { balanceCny: 18.75 }
      }
    })
    expect(snapshot.remoteServiceCapacity).toEqual({
      imageConcurrentLimit: 8
    })
    expect(snapshot.hostInfo.runtimeName).toContain('Node ')
  })

  it('refreshes dashboard credits before building the display snapshot', async () => {
    const { service, refreshDashboardCredits } = await createService({
      state: {
        projectRuns: [{ id: 'run-1' }]
      }
    })

    const snapshot = await service.getDisplaySnapshot()

    expect(refreshDashboardCredits).toHaveBeenCalledWith({
      target: 'all'
    })
    expect(snapshot.projectRuns).toEqual([{ id: 'run-1' }])
    expect(snapshot.hostInfo.runtimeName).toContain('Node ')
  })

  it('returns a reduced runtime snapshot without theme or host metadata', async () => {
    const { service } = await createService({
      state: {
        productProjects: [{ id: 'project-1' }],
        activeProductProjectId: 'project-1',
        projectRuns: [{ id: 'run-1' }],
        activeProjectRunId: 'run-1',
        formDrafts: { workspace: { productName: 'Lamp' } },
        resultsByMenu: { workspace: { textResults: [] } },
        exportItemsByMenu: { workspace: [] }
      },
      tasks: [{ id: 'task-1', createdAt: '2026-06-21T10:00:00.000Z' }]
    })

    const snapshot = service.getRuntimeSnapshot()

    expect(snapshot).toMatchObject({
      productProjects: [{ id: 'project-1' }],
      activeProductProjectId: 'project-1',
      activeProjectRunId: 'run-1'
    })
    expect(snapshot.projectRuns[0]).toMatchObject({ id: 'run-1', hydrated: true })
    expect(snapshot.agentReadiness.executionLog).toEqual([{ taskId: 'task-1' }])
    expect('themeMode' in snapshot).toBe(false)
    expect('hostInfo' in snapshot).toBe(false)
  })
})
