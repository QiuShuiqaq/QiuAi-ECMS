import { describe, expect, it } from 'vitest'

describe('workspaceProjectRunService', () => {
  async function createService() {
    const { createWorkspaceProjectRunService } = await import('../../main/src/services/workspaceProjectRunService.js')

    return createWorkspaceProjectRunService({
      createDefaultProjectRunStepStates: () => ({
        title: { status: 'pending', startedAt: '', completedAt: '', error: '' },
        description: { status: 'pending', startedAt: '', completedAt: '', error: '' },
        image: { status: 'pending', startedAt: '', completedAt: '', error: '' },
        video: { status: 'pending', startedAt: '', completedAt: '', error: '' }
      }),
      resolveWorkspaceEnabledRunSteps: (draft) => ({
        title: draft.enableTitle !== false,
        description: draft.enableDescription !== false,
        image: draft.enableImage !== false,
        video: draft.enableVideo !== false
      }),
      resolveProjectRunStepKey: (menuKey) => ({
        'series-generate': 'image',
        'video-generate': 'video'
      }[menuKey] || ''),
      normalizeProjectRun: (value = {}) => ({
        id: value.id || '',
        projectId: value.projectId || '',
        taskId: value.taskId || '',
        taskNumber: value.taskNumber || '',
        triggerMenuKey: value.triggerMenuKey || '',
        status: value.status || 'pending',
        progress: Number(value.progress || 0),
        error: value.error || '',
        stepStates: value.stepStates || {},
        outputs: value.outputs || {
          title: '',
          description: '',
          titleCandidates: [],
          descriptionCandidates: [],
          selectedTitle: '',
          selectedDescription: '',
          images: [],
          video: null
        },
        storage: value.storage || { runDirectory: '', titleFile: '', descriptionFile: '', imageDirectory: '', videoDirectory: '' },
        usage: value.usage || { totalAmountCny: 0, currency: 'CNY', billedAt: '', lines: [] },
        createdAt: value.createdAt || '',
        completedAt: value.completedAt || ''
      }),
      normalizeProductProject: (value = {}) => ({
        ...value,
        latestRunId: value.latestRunId || '',
        runIds: Array.isArray(value.runIds) ? value.runIds : []
      }),
      normalizeStringList: (values = []) => Array.isArray(values) ? values.map((item) => String(item || '').trim()).filter(Boolean) : [],
      sanitizePathSegment: (value, fallbackValue = 'result') => {
        const sanitizedValue = String(value || fallbackValue)
          .replace(/[<>:"/\\|?*\s]+/g, '-')
          .replace(/-+/g, '-')
          .replace(/^-|-$/g, '')

        return sanitizedValue || fallbackValue
      }
    })
  }

  it('creates a workspace run record with pending enabled steps and successful disabled steps', async () => {
    const service = await createService()
    const run = service.buildProjectRunRecord({
      runId: 'run-1',
      projectId: 'project-1',
      menuKey: 'workspace',
      draft: {
        enableTitle: true,
        enableDescription: true,
        enableImage: false,
        enableVideo: false
      },
      taskId: 'task-1',
      taskNumber: 'QAI-001',
      createdAt: '2026-06-21T10:00:00.000Z',
      runDirectory: 'F:/output/workspace/task-1'
    })

    expect(run).toMatchObject({
      id: 'run-1',
      projectId: 'project-1',
      triggerMenuKey: 'workspace',
      status: 'pending'
    })
    expect(run.stepStates.title.status).toBe('pending')
    expect(run.stepStates.description.status).toBe('pending')
    expect(run.stepStates.image.status).toBe('success')
    expect(run.stepStates.video.status).toBe('success')
  })

  it('marks a targeted step running and then success with outputs and storage paths', async () => {
    const service = await createService()
    const started = service.buildStartedProjectRun({
      projectRun: service.buildProjectRunRecord({
        runId: 'run-2',
        projectId: 'project-2',
        menuKey: 'video-generate',
        draft: {},
        createdAt: '2026-06-21T10:00:00.000Z'
      }),
      menuKey: 'video-generate',
      startedAt: '2026-06-21T10:05:00.000Z'
    })

    expect(started.status).toBe('running')
    expect(started.stepStates.video.status).toBe('running')

    const completed = service.buildProjectRunUpdateFromResult({
      projectRun: started,
      menuKey: 'video-generate',
      resultPayload: {
        groupedResults: [
          {
            outputs: [
              {
                title: 'video-1',
                savedPath: 'F:/output/video/task-1/group-1/result.mp4'
              }
            ]
          }
        ]
      },
      exportItems: [
        {
          directoryPath: 'F:/output/video/task-1/group-1'
        }
      ],
      outputDirectory: 'F:/output/video/task-1',
      completedAt: '2026-06-21T10:06:00.000Z'
    })

    expect(completed.status).toBe('success')
    expect(completed.outputs.video.savedPath).toContain('.mp4')
    expect(normalizePath(completed.storage.runDirectory)).toBe(normalizePath('F:/output/video/task-1'))
    expect(normalizePath(completed.storage.videoDirectory)).toBe(normalizePath('F:/output/video/task-1/group-1'))
  })

  it('stores workspace candidate outputs and selected outputs in the project run record', async () => {
    const service = await createService()
    const completed = service.buildProjectRunUpdateFromResult({
      projectRun: service.buildStartedProjectRun({
        projectRun: service.buildProjectRunRecord({
          runId: 'run-workspace-1',
          projectId: 'project-1',
          menuKey: 'workspace',
          draft: {},
          createdAt: '2026-06-21T10:00:00.000Z'
        }),
        menuKey: 'workspace',
        startedAt: '2026-06-21T10:05:00.000Z'
      }),
      menuKey: 'workspace',
      resultPayload: {
        textResults: [
          { kind: 'title', title: '鏍囬 1', content: '鏍囬鍊欓€?A' },
          { kind: 'title', title: '鏍囬 2', content: '鏍囬鍊欓€?B' },
          { kind: 'description', title: '鎻忚堪 1', content: '鎻忚堪鍊欓€?A' }
        ],
        groupedResults: []
      },
      exportItems: [
        {
          directoryPath: 'F:/output/workspace/task-1/group-1'
        }
      ],
      outputDirectory: 'F:/output/workspace/task-1',
      completedAt: '2026-06-21T10:06:00.000Z'
    })

    expect(completed.outputs.title).toBe('鏍囬鍊欓€?A')
    expect(completed.outputs.description).toBe('鎻忚堪鍊欓€?A')
    expect(completed.outputs.titleCandidates).toEqual(['鏍囬鍊欓€?A', '鏍囬鍊欓€?B'])
    expect(completed.outputs.descriptionCandidates).toEqual(['鎻忚堪鍊欓€?A'])
    expect(completed.outputs.selectedTitle).toBe('鏍囬鍊欓€?A')
    expect(completed.outputs.selectedDescription).toBe('鎻忚堪鍊欓€?A')
  })

  it('marks workspace runs partial when some steps succeed and others fail', async () => {
    const service = await createService()
    const completed = service.buildProjectRunUpdateFromResult({
      projectRun: service.buildStartedProjectRun({
        projectRun: service.buildProjectRunRecord({
          runId: 'run-workspace-partial',
          projectId: 'project-partial',
          menuKey: 'workspace',
          draft: {},
          createdAt: '2026-06-21T10:00:00.000Z'
        }),
        menuKey: 'workspace',
        startedAt: '2026-06-21T10:05:00.000Z'
      }),
      menuKey: 'workspace',
      resultPayload: {
        textResults: [
          { kind: 'title', title: 'title 1', content: 'title result A' }
        ],
        groupedResults: [],
        workspaceStepStates: {
          title: { status: 'success', error: '', startedAt: '2026-06-21T10:05:00.000Z', completedAt: '2026-06-21T10:05:10.000Z' },
          description: { status: 'failed', error: 'description failed', startedAt: '2026-06-21T10:05:11.000Z', completedAt: '2026-06-21T10:05:20.000Z' },
          image: { status: 'success', error: '', startedAt: '', completedAt: '2026-06-21T10:00:00.000Z' },
          video: { status: 'success', error: '', startedAt: '', completedAt: '2026-06-21T10:00:00.000Z' }
        }
      },
      exportItems: [
        {
          directoryPath: 'F:/output/workspace/task-partial/group-1'
        }
      ],
      outputDirectory: 'F:/output/workspace/task-partial',
      completedAt: '2026-06-21T10:06:00.000Z'
    })

    expect(completed.status).toBe('partial')
    expect(completed.stepStates.title.status).toBe('success')
    expect(completed.stepStates.description.status).toBe('failed')
    expect(completed.outputs.title).toBe('title result A')
  })

  it('stores usage summary from workspace result payload into the project run record', async () => {
    const service = await createService()
    const completed = service.buildProjectRunUpdateFromResult({
      projectRun: service.buildStartedProjectRun({
        projectRun: service.buildProjectRunRecord({
          runId: 'run-workspace-usage',
          projectId: 'project-usage',
          menuKey: 'workspace',
          draft: {},
          createdAt: '2026-06-21T10:00:00.000Z'
        }),
        menuKey: 'workspace',
        startedAt: '2026-06-21T10:05:00.000Z'
      }),
      menuKey: 'workspace',
      resultPayload: {
        textResults: [
          { kind: 'title', title: 'title 1', content: 'title result A' }
        ],
        groupedResults: [],
        usageSummary: {
          totalAmountCny: 0.23,
          currency: 'CNY',
          billedAt: '2026-06-21T10:06:00.000Z',
          lines: [
            {
              kind: 'text',
              label: '标题',
              model: 'title-generator',
              units: 1,
              unitPriceCny: 0.01,
              amountCny: 0.01
            },
            {
              kind: 'image',
              label: '套图',
              model: 'gpt-image-2',
              units: 1,
              unitPriceCny: 0.12,
              amountCny: 0.12
            },
            {
              kind: 'video',
              label: '视频',
              model: 'MiniMax-Hailuo-2.3-Fast',
              units: 1,
              unitPriceCny: 0.1,
              amountCny: 0.1
            }
          ]
        }
      },
      exportItems: [],
      outputDirectory: 'F:/output/workspace/task-usage',
      completedAt: '2026-06-21T10:06:00.000Z'
    })

    expect(completed.usage).toMatchObject({
      totalAmountCny: 0.23,
      currency: 'CNY',
      billedAt: '2026-06-21T10:06:00.000Z'
    })
    expect(completed.usage.lines).toHaveLength(3)
    expect(completed.usage.lines[1]).toMatchObject({
      kind: 'image',
      model: 'gpt-image-2',
      amountCny: 0.12
    })
  })

  it('marks unresolved steps failed for workspace runs', async () => {
    const service = await createService()
    const failed = service.buildFailedProjectRun({
      projectRun: service.buildStartedProjectRun({
        projectRun: service.buildProjectRunRecord({
          runId: 'run-3',
          projectId: 'project-3',
          menuKey: 'workspace',
          draft: {}
        }),
        menuKey: 'workspace',
        startedAt: '2026-06-21T10:05:00.000Z'
      }),
      menuKey: 'workspace',
      errorMessage: 'upstream failed',
      failedAt: '2026-06-21T10:06:00.000Z'
    })

    expect(failed.status).toBe('failed')
    expect(failed.stepStates.title.status).toBe('failed')
    expect(failed.stepStates.description.status).toBe('failed')
    expect(failed.stepStates.image.status).toBe('failed')
    expect(failed.stepStates.video.status).toBe('failed')
  })

  it('attaches latest run id to project without duplicating run ids', async () => {
    const service = await createService()
    const updatedProject = service.attachProjectRunToProject({
      id: 'project-1',
      latestRunId: 'run-1',
      runIds: ['run-1', 'run-0']
    }, 'run-2', '2026-06-21T10:00:00.000Z')

    expect(updatedProject.latestRunId).toBe('run-2')
    expect(updatedProject.runIds).toEqual(['run-2', 'run-1', 'run-0'])
  })
})

function normalizePath(value) {
  return String(value || '').replace(/\\/g, '/')
}
