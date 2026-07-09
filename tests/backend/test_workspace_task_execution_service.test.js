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
        getSettings: () => ({ dashboardCreditState: {} }),
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

  it('hydrates workspace source image from the linked project when the draft source is missing', async () => {
    let observedSourceImage = null
    const { service, setState } = await createService({
      buildResultPayload: async (_menuKey, draft) => {
        observedSourceImage = draft.sourceImage
        return {
          textResults: [],
          comparisonResults: [],
          groupedResults: [],
          summary: { title: 'ok' }
        }
      }
    })
    setState({
      productProjects: [
        {
          id: 'project-workspace-1',
          assets: {
            sourceImages: [
              {
                id: 'source-1',
                name: 'source.png',
                path: 'F:/input/project-source.png',
                storedPath: 'F:/input/project-source.png'
              }
            ]
          }
        }
      ],
      projectRuns: [{ id: 'run-workspace-1' }]
    })

    await service.runQueuedTaskExecution({
      menuKey: 'workspace',
      draft: {
        projectId: 'project-workspace-1',
        sourceImage: null
      },
      taskId: 'task-workspace-source-1',
      taskNumber: 'QAI-WS-001',
      createdAt: '2026-06-21 12:00:00',
      inputDirectory: 'F:/input/task-workspace-source-1',
      outputDirectory: 'F:/output/task-workspace-source-1',
      projectRunId: 'run-workspace-1'
    })

    expect(observedSourceImage).toMatchObject({
      id: 'source-1',
      path: 'F:/input/project-source.png',
      storedPath: 'F:/input/project-source.png'
    })
  })

  it('hydrates project-linked series generation from project source images when draft assets are missing', async () => {
    let observedDraft = null
    const { service, setState } = await createService({
      buildResultPayload: async (_menuKey, draft) => {
        observedDraft = draft
        return {
          textResults: [],
          comparisonResults: [],
          groupedResults: [],
          summary: { title: 'ok' }
        }
      }
    })
    setState({
      productProjects: [
        {
          id: 'project-series-1',
          assets: {
            sourceImages: [
              {
                id: 'series-source-1',
                name: 'series-source-1.png',
                path: 'F:/input/series-source-1.png',
                storedPath: 'F:/input/series-source-1.png'
              },
              {
                id: 'series-source-2',
                name: 'series-source-2.png',
                path: 'F:/input/series-source-2.png',
                storedPath: 'F:/input/series-source-2.png'
              }
            ]
          }
        }
      ],
      projectRuns: []
    })

    await service.runQueuedTaskExecution({
      menuKey: 'series-generate',
      draft: {
        projectId: 'project-series-1',
        sourceImage: null,
        seriesSourceItems: [],
        promptAssignments: [
          { templateId: 'image-main', imageType: 'main', prompt: 'prompt-1' },
          { templateId: 'image-detail', imageType: 'detail', prompt: 'prompt-2' }
        ],
        size: '1:1'
      },
      taskId: 'task-series-source-1',
      taskNumber: 'QAI-SG-001',
      createdAt: '2026-06-21 12:00:00',
      inputDirectory: 'F:/input/task-series-source-1',
      outputDirectory: 'F:/output/task-series-source-1'
    })

    expect(observedDraft.sourceImage).toMatchObject({
      id: 'series-source-1',
      path: 'F:/input/series-source-1.png'
    })
    expect(observedDraft.seriesSourceItems).toHaveLength(2)
    expect(observedDraft.seriesSourceItems[0]).toMatchObject({
      sourceImage: {
        id: 'series-source-1',
        path: 'F:/input/series-source-1.png'
      },
      prompt: 'prompt-1'
    })
    expect(observedDraft.seriesSourceItems[1]).toMatchObject({
      sourceImage: {
        id: 'series-source-2',
        path: 'F:/input/series-source-2.png'
      },
      prompt: 'prompt-2'
    })
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

  it('persists intermediate workspace results without completing the run early', async () => {
    const saveCalls = []
    const { service, savedStates, setState } = await createService({
      buildTaskSummary: ({ taskId, resultPayload }) => ({
        id: taskId,
        status: 'completed',
        progress: 100,
        resultPayload
      }),
      buildResultPayload: async (_menuKey, _draft, taskId, _outputDirectory, { onIntermediateResult }) => {
        await onIntermediateResult({
          textResults: [
            {
              id: `${taskId}-title-1`,
              title: 'title-1',
              content: 'partial title',
              kind: 'title'
            }
          ],
          comparisonResults: [],
          groupedResults: [],
          workspaceResult: {
            titleCandidates: ['partial title'],
            descriptionCandidates: [],
            selectedTitle: 'partial title',
            selectedDescription: '',
            images: [],
            video: null
          },
          workspaceStepStates: {
            title: { status: 'success' }
          },
          workspaceErrors: []
        })

        return {
          textResults: [
            {
              id: `${taskId}-title-1`,
              title: 'title-1',
              content: 'partial title',
              kind: 'title'
            },
            {
              id: `${taskId}-description-1`,
              title: 'description-1',
              content: 'final description',
              kind: 'description'
            }
          ],
          comparisonResults: [],
          groupedResults: [],
          workspaceResult: {
            titleCandidates: ['partial title'],
            descriptionCandidates: ['final description'],
            selectedTitle: 'partial title',
            selectedDescription: 'final description',
            images: [],
            video: null
          },
          workspaceStepStates: {
            title: { status: 'success' },
            description: { status: 'success' }
          },
          workspaceErrors: []
        }
      },
      saveStudioResults: async ({ resultPayload }) => {
        const marker = saveCalls.length + 1
        saveCalls.push(resultPayload)
        return {
          exportItems: [{ id: `export-${marker}` }],
          persistedResultPayload: {
            ...resultPayload,
            persistedMarker: marker
          }
        }
      },
      applyTaskResultToProjects: ({ enrichedResultPayload }) => ([
        {
          id: 'project-3',
          selectedTitle: enrichedResultPayload.workspaceResult?.selectedTitle || '',
          selectedDescription: enrichedResultPayload.workspaceResult?.selectedDescription || '',
          persistedMarker: enrichedResultPayload.persistedMarker || 0
        }
      ])
    })
    setState({
      productProjects: [{ id: 'project-3' }],
      projectRuns: [{ id: 'run-3' }]
    })

    await service.runQueuedTaskExecution({
      menuKey: 'workspace',
      draft: { projectId: 'project-3' },
      taskId: 'task-3',
      taskNumber: 'QAI-003',
      createdAt: '2026-06-21 12:00:00',
      inputDirectory: 'F:/input/task-3',
      outputDirectory: 'F:/output/task-3',
      projectRunId: 'run-3'
    })

    const resultStateWrites = savedStates.filter((payload) => payload.resultsByMenuPatch?.workspace)
    expect(resultStateWrites).toHaveLength(2)
    expect(resultStateWrites[0]).toMatchObject({
      resultsByMenuPatch: {
        workspace: {
          persistedMarker: 1
        }
      },
      productProjectsPatch: [
        {
          id: 'project-3',
          selectedTitle: 'partial title',
          selectedDescription: '',
          persistedMarker: 1
        }
      ]
    })
    expect(resultStateWrites[0].projectRunsPatch ?? null).toBeNull()
    expect(resultStateWrites[1]).toMatchObject({
      resultsByMenuPatch: {
        workspace: {
          persistedMarker: 2
        }
      },
      productProjectsPatch: [
        {
          id: 'project-3',
          selectedTitle: 'partial title',
          selectedDescription: 'final description',
          persistedMarker: 2
        }
      ]
    })
  })

  it('persists intermediate series generation results before the final task summary', async () => {
    const saveCalls = []
    const { service, savedStates, setState } = await createService({
      buildTaskSummary: ({ taskId, resultPayload }) => ({
        id: taskId,
        status: 'completed',
        progress: 100,
        resultPayload
      }),
      buildResultPayload: async (_menuKey, _draft, taskId, _outputDirectory, { onIntermediateResult }) => {
        await onIntermediateResult({
          textResults: [],
          comparisonResults: [],
          groupedResults: [
            {
              id: `${taskId}-group-1`,
              groupType: 'batch',
              groupTitle: 'Batch 1',
              status: 'partial',
              completedCount: 1,
              failedCount: 0,
              outputs: [
                {
                  id: `${taskId}-image-1`,
                  savedPath: 'F:/output/task-series-1/batch-01-slot-01-image.png',
                  path: 'F:/output/task-series-1/batch-01-slot-01-image.png'
                }
              ]
            }
          ],
          completionStatus: 'running',
          summary: { title: 'partial image result' }
        })

        return {
          textResults: [],
          comparisonResults: [],
          groupedResults: [
            {
              id: `${taskId}-group-1`,
              groupType: 'batch',
              groupTitle: 'Batch 1',
              status: 'partial',
              completedCount: 1,
              failedCount: 1,
              outputs: [
                {
                  id: `${taskId}-image-1`,
                  savedPath: 'F:/output/task-series-1/batch-01-slot-01-image.png',
                  path: 'F:/output/task-series-1/batch-01-slot-01-image.png'
                }
              ]
            }
          ],
          completionStatus: 'partial',
          summary: { title: 'final partial image result' }
        }
      },
      saveStudioResults: async ({ resultPayload }) => {
        const marker = saveCalls.length + 1
        saveCalls.push(resultPayload)
        return {
          exportItems: [{ id: `series-export-${marker}` }],
          persistedResultPayload: {
            ...resultPayload,
            persistedMarker: marker
          }
        }
      }
    })
    setState({
      productProjects: [],
      projectRuns: []
    })

    await service.runQueuedTaskExecution({
      menuKey: 'series-generate',
      draft: {},
      taskId: 'task-series-1',
      taskNumber: 'QAI-SERIES-001',
      createdAt: '2026-06-21 12:00:00',
      inputDirectory: 'F:/input/task-series-1',
      outputDirectory: 'F:/output/task-series-1'
    })

    const resultStateWrites = savedStates.filter((payload) => payload.resultsByMenuPatch?.['series-generate'])
    expect(resultStateWrites).toHaveLength(2)
    expect(resultStateWrites[0]).toMatchObject({
      resultsByMenuPatch: {
        'series-generate': {
          persistedMarker: 1,
          completionStatus: 'running'
        }
      }
    })
    expect(resultStateWrites[1]).toMatchObject({
      resultsByMenuPatch: {
        'series-generate': {
          persistedMarker: 2,
          completionStatus: 'partial'
        }
      }
    })
  })
})
