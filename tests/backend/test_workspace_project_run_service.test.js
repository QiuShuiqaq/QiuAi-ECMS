import path from 'node:path'
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
        stepStates: value.stepStates || {},
        outputs: value.outputs || { title: '', description: '', images: [], video: null },
        storage: value.storage || { runDirectory: '', titleFile: '', descriptionFile: '', imageDirectory: '', videoDirectory: '' },
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
