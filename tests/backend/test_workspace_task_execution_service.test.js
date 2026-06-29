import { describe, expect, it } from 'vitest'

function createController() {
  let stopped = false
  let resolveStop
  const stopPromise = new Promise((resolve) => {
    resolveStop = resolve
  })

  return {
    isStopped() {
      return stopped
    },
    waitForStop() {
      return stopPromise
    },
    stop() {
      stopped = true
      resolveStop({ stopped: true })
    }
  }
}

describe('workspaceTaskExecutionService', () => {
  async function createService(overrides = {}) {
    const { createWorkspaceTaskExecutionService } = await import('../../main/src/services/workspaceTaskExecutionService.js')

    const activeTaskControllers = new Map()
    const savedStates = []
    let currentState = {
      productProjects: [],
      projectRuns: []
    }

    const service = createWorkspaceTaskExecutionService({
      createTaskExecutionController: () => createController(),
      activeTaskControllers,
      getNow: () => '2026-06-21T12:00:00.000Z',
      getStoredState: () => currentState,
      persistTaskAndState: async (payload) => {
        savedStates.push(payload)
      },
      ensureDirectory: async () => undefined,
      persistSourceFiles: async () => [],
      buildRunningTaskSummary: ({ taskId }) => ({ id: taskId, progress: 0, status: '进行中' }),
      buildFailedTaskSummary: ({ taskId, errorMessage }) => ({ id: taskId, status: '失败', error: errorMessage }),
      buildTaskSummary: ({ taskId, resultPayload }) => ({ id: taskId, status: '已完成', progress: 100, resultPayload }),
      normalizeTaskProgress: (progress, fallback) => Number(progress ?? fallback ?? 0),
      buildResultPayload: async () => ({
        textResults: [],
        comparisonResults: [],
        groupedResults: [],
        summary: { title: 'ok' }
      }),
      generateImageResults: async () => ({}),
      generateTextResults: async () => ([]),
      generateVideoResults: async () => ({}),
      saveStudioResults: async () => ({
        exportItems: [{ id: 'export-1' }],
        persistedResultPayload: {
          textResults: [],
          comparisonResults: [],
          groupedResults: [],
          summary: { title: 'ok' }
        }
      }),
      writeFile: async () => undefined,
      enrichResultPayloadSummary: ({ resultPayload }) => resultPayload,
      buildWorkspaceProjectDraft: ({ projectId }) => ({ id: projectId }),
      attachTaskRefToProductProject: (project) => project,
      applyWorkspaceTextResultsToProject: (project) => project,
      applyImageResultsToProject: (project) => project,
      applyVideoResultsToProject: (project) => project,
      applyTitleResultsToProject: (project) => project,
      applyDescriptionResultsToProject: (project) => project,
      upsertProductProject: (projects, project) => [project, ...projects.filter((item) => item.id !== project.id)],
      normalizeProjectRuns: (runs = []) => runs,
      upsertProjectRun: (runs, run) => [run, ...runs.filter((item) => item.id !== run.id)],
      workspaceProjectRunService: {
        buildStartedProjectRun: ({ projectRun }) => ({ ...projectRun, status: 'running' }),
        buildProjectRunUpdateFromResult: ({ projectRun }) => ({ ...projectRun, status: 'success' }),
        buildFailedProjectRun: ({ projectRun, errorMessage }) => ({ ...projectRun, status: 'failed', error: errorMessage })
      },
      settingsService: {
        getSettings: () => ({ creditState: { remainingCredits: 300 } }),
        saveSettings: async () => undefined
      },
      safeRuntimeLog: async () => undefined,
      runtimeLogger: null,
      ...overrides
    })

    return {
      service,
      activeTaskControllers,
      savedStates,
      setState(nextState) {
        currentState = nextState
      }
    }
  }

  it('runs a queued task through success path without local credit settlement', async () => {
    const { service, activeTaskControllers, savedStates, setState } = await createService()
    setState({
      productProjects: [],
      projectRuns: [{ id: 'run-1' }]
    })

    await service.runQueuedTaskExecution({
      menuKey: 'workspace',
      draft: {},
      taskId: 'task-1',
      taskNumber: 'QAI-001',
      createdAt: '2026-06-21 12:00:00',
      inputDirectory: 'F:/input/task-1',
      outputDirectory: 'F:/output/task-1',
      projectRunId: 'run-1'
    })

    expect(savedStates.length).toBeGreaterThanOrEqual(2)
    expect(activeTaskControllers.size).toBe(0)
  })

  it('runs a queued task through failure path without local credit refund', async () => {
    const { service, activeTaskControllers, savedStates, setState } = await createService({
      buildResultPayload: async () => {
        throw new Error('generation failed')
      }
    })
    setState({
      productProjects: [],
      projectRuns: [{ id: 'run-2' }]
    })

    await service.runQueuedTaskExecution({
      menuKey: 'workspace',
      draft: {},
      taskId: 'task-2',
      taskNumber: 'QAI-002',
      createdAt: '2026-06-21 12:00:00',
      inputDirectory: 'F:/input/task-2',
      outputDirectory: 'F:/output/task-2',
      projectRunId: 'run-2'
    })

    expect(savedStates.at(-1)?.task).toMatchObject({
      id: 'task-2',
      status: '失败',
      error: 'generation failed'
    })
    expect(activeTaskControllers.size).toBe(0)
  })
})
