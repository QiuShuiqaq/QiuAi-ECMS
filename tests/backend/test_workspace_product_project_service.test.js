import { describe, expect, it } from 'vitest'

describe('workspaceProductProjectService', () => {
  async function createService() {
    const { createWorkspaceProductProjectService } = await import('../../main/src/services/workspaceProductProjectService.js')

    let state = {
      productProjects: [],
      activeProductProjectId: ''
    }

    const service = createWorkspaceProductProjectService({
      getStoredState: () => state,
      saveState: (nextState) => {
        state = nextState
        return state
      },
      createId: (() => {
        let index = 0
        return () => `id-${++index}`
      })(),
      getNow: () => '2026-06-21T13:00:00.000Z',
      normalizeProductProjects: (projects = []) => Array.isArray(projects) ? projects.map((item) => ({ ...item })) : [],
      resolveActiveProductProjectId: (projects, activeId = '') => {
        if (activeId && projects.some((item) => item.id === activeId)) {
          return activeId
        }
        return projects[0]?.id || ''
      },
      buildEmptyProductProject: ({ projectId, productName, platform, language, createdAt }) => ({
        id: projectId,
        name: productName,
        platformTarget: [platform],
        baseInfo: { language },
        createdAt,
        updatedAt: createdAt
      }),
      buildProjectCardFromAsset: ({ asset, projectId, createdAt, platform, language }) => ({
        id: projectId,
        name: asset.name.replace(/\.[^.]+$/, ''),
        platformTarget: [platform],
        assets: { sourceImages: [asset] },
        baseInfo: { language },
        createdAt,
        updatedAt: createdAt
      }),
      updateProductProjectFields: (project, patch, updatedAt) => ({
        ...project,
        ...patch,
        updatedAt
      }),
      upsertProductProject: (projects = [], nextProject = {}) => [
        nextProject,
        ...projects.filter((item) => item.id !== nextProject.id)
      ],
      attachTaskRefToProductProject: (project, taskId, updatedAt) => ({
        ...project,
        taskRefs: [taskId, ...(project.taskRefs || [])],
        updatedAt
      }),
      buildWorkspaceProjectDraft: ({ currentProject, draft, projectId, createdAt, updatedAt }) => ({
        ...(currentProject || {}),
        id: projectId,
        name: draft.projectName || `${draft.productName}项目`,
        createdAt,
        updatedAt
      }),
      applyWorkspaceTextResultsToProject: (project, resultPayload, updatedAt) => ({
        ...project,
        content: {
          selectedTitle: resultPayload.textResults?.find((item) => item.kind === 'title')?.content || '',
          selectedDescription: resultPayload.textResults?.find((item) => item.kind === 'description')?.content || ''
        },
        updatedAt
      }),
      applyImageResultsToProject: (project, resultPayload, updatedAt) => ({
        ...project,
        assets: {
          ...(project.assets || {}),
          generatedImages: resultPayload.groupedResults?.flatMap((group) => group.outputs || []) || []
        },
        updatedAt
      }),
      applyVideoResultsToProject: (project, resultPayload, updatedAt) => ({
        ...project,
        assets: {
          ...(project.assets || {}),
          generatedVideo: resultPayload.groupedResults?.flatMap((group) => group.outputs || [])[0] || null
        },
        updatedAt
      }),
      applyTitleResultsToProject: (project, resultPayload, updatedAt) => ({
        ...project,
        content: {
          ...(project.content || {}),
          selectedTitle: resultPayload.textResults?.[0]?.content || ''
        },
        updatedAt
      }),
      applyDescriptionResultsToProject: (project, resultPayload, updatedAt) => ({
        ...project,
        content: {
          ...(project.content || {}),
          selectedDescription: resultPayload.textResults?.[0]?.content || ''
        },
        updatedAt
      }),
      attachProjectRunToProject: (project, runId, updatedAt) => ({
        ...project,
        latestRunId: runId,
        runIds: [runId, ...(project.runIds || [])],
        updatedAt
      }),
      normalizeImageAsset: (asset) => asset
    })

    return {
      service,
      getState: () => state,
      setState: (nextState) => {
        state = nextState
      }
    }
  }

  it('creates and updates product projects through the dedicated service', async () => {
    const { service, getState } = await createService()

    const created = await service.createProject({
      projectId: 'project-imported-1',
      productName: 'Lamp',
      platform: 'temu',
      language: 'zh-CN'
    })

    expect(created.id).toBe('project-imported-1')
    expect(getState().activeProductProjectId).toBe(created.id)

    const updated = await service.updateProject({
      projectId: created.id,
      patch: {
        name: 'Lamp Project'
      }
    })

    expect(updated.name).toBe('Lamp Project')
    expect(getState().productProjects[0].name).toBe('Lamp Project')
  })

  it('prepares project state for task creation and attaches run/task refs', async () => {
    const { service, setState } = await createService()
    setState({
      productProjects: [
        {
          id: 'project-1',
          name: 'Bottle',
          taskRefs: [],
          runIds: []
        }
      ],
      activeProductProjectId: 'project-1'
    })

    const prepared = service.prepareProjectStateForTaskCreation({
      state: {
        productProjects: [
          {
            id: 'project-1',
            name: 'Bottle',
            taskRefs: [],
            runIds: []
          }
        ],
        activeProductProjectId: 'project-1'
      },
      menuKey: 'workspace',
      draft: {
        productName: 'Bottle',
        projectName: 'Bottle Project'
      },
      taskId: 'task-1',
      projectRunId: 'run-1'
    })

    expect(prepared.draft.projectId).toBeTruthy()
    expect(prepared.currentProjectForRun.taskRefs).toContain('task-1')
    expect(prepared.nextProductProjects[0].latestRunId).toBe('run-1')
  })

  it('applies task results back to linked projects', async () => {
    const { service } = await createService()

    const nextProjects = service.applyTaskResultToProjects({
      latestState: {
        productProjects: [
          {
            id: 'project-1',
            name: 'Bottle'
          }
        ]
      },
      preparedDraft: {
        projectId: 'project-1'
      },
      taskId: 'task-1',
      menuKey: 'workspace',
      enrichedResultPayload: {
        textResults: [
          { kind: 'title', content: 'Title A' },
          { kind: 'description', content: 'Desc A' }
        ],
        groupedResults: [
          {
            outputs: [
              { savedPath: 'F:/output/image-1.png' }
            ]
          }
        ]
      },
      createdAt: '2026-06-21 13:00:00'
    })

    expect(nextProjects[0].content.selectedTitle).toBe('Title A')
    expect(nextProjects[0].content.selectedDescription).toBe('Desc A')
    expect(nextProjects[0].assets.generatedImages).toHaveLength(1)
  })
})
