import { afterEach, describe, expect, it } from 'vitest'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'

function createMemoryStore() {
  const memory = new Map()

  return {
    get(key, fallbackValue) {
      return memory.has(key) ? memory.get(key) : fallbackValue
    },
    set(key, value) {
      memory.set(key, value)
    }
  }
}

function createPreviewDataUrl(label) {
  return `data:image/png;base64,${Buffer.from(label, 'utf8').toString('base64')}`
}

async function seedCredits(settingsService, amount = 5000) {
  await settingsService.saveSettings({
    creditAdjustment: {
      operation: 'increase',
      amount
    }
  }, {
    getNow: () => '2026-06-12T10:00:00.000Z'
  })
}

const tempDirectories = []

async function createTempOutputRoot() {
  const tempDirectory = await fs.mkdtemp(path.join(os.tmpdir(), 'qiuai-studio-test-'))
  tempDirectories.push(tempDirectory)
  return tempDirectory
}

afterEach(async () => {
  await Promise.all(tempDirectories.splice(0).map((targetPath) => {
    return fs.rm(targetPath, { recursive: true, force: true })
  }))
})

describe('studioWorkspaceService', () => {
  it('returns the new e-commerce workspace snapshot baseline', async () => {
    const store = createMemoryStore()
    const outputRootDirectory = await createTempOutputRoot()

    const { createSettingsStoreService } = await import('../../main/src/services/settingsStoreService.js')
    const { createStudioWorkspaceService } = await import('../../main/src/services/studioWorkspaceService.js')

    const settingsService = createSettingsStoreService({ store })
    const service = createStudioWorkspaceService({
      store,
      settingsService,
      outputRootDirectory,
      ensureDirectory: async () => undefined,
      persistSourceFiles: async () => [],
      writeFile: async () => undefined
    })

    const snapshot = service.getSnapshot()

    expect(snapshot.themeMode).toBe('dark')
    expect(snapshot.themeOptions.map((item) => item.value)).toEqual(['dark'])
    expect(snapshot.menuItems.map((item) => item.key)).toEqual([
      'workspace',
      'data-center',
      'product-template',
      'title-generator',
      'description-generator',
      'series-generate',
      'video-generate',
      'model-pricing',
      'prompt-library',
      'model-config'
    ])
    expect(snapshot.imageModelOptions.map((item) => item.value)).toEqual([
      'gpt-image-2',
      'nano-banana-fast',
      'nano-banana-2'
    ])
    expect(snapshot.modelPricingCatalog.map((item) => item.name)).toEqual([
      'nano-banana-fast',
      'gpt-image-2',
      'nano-banana-2'
    ])
    expect(snapshot.formDrafts.workspace).toMatchObject({
      platformTargetsText: 'temu, ozon',
      language: 'zh-CN',
      titleQuantity: 3,
      descriptionQuantity: 2,
      model: 'deepseek-v4-flash'
    })
    expect(snapshot.formDrafts['title-generator'].model).toBe('deepseek-v4-flash')
    expect(snapshot.formDrafts['description-generator'].model).toBe('deepseek-v4-pro')
    expect(snapshot.formDrafts['series-generate']).toMatchObject({
      model: 'gpt-image-2',
      generateCount: 4,
      batchCount: 1,
      prompt: '',
      imageType: '商品主图'
    })
    expect(snapshot.formDrafts['series-generate'].promptAssignments).toHaveLength(4)
    expect(snapshot.formDrafts['series-generate'].promptAssignments[0]).toMatchObject({
      index: 1,
      imageType: '商品主图',
      templateId: 'image-main',
      differenceLevel: 'off'
    })
    expect(snapshot.formDrafts['video-generate']).toMatchObject({
      duration: '6s',
      resolution: '768P',
      model: 'MiniMax-Hailuo-2.3-Fast'
    })
    expect(snapshot.formDrafts['model-config']).toMatchObject({
      titleModel: 'deepseek-v4-flash',
      descriptionModel: 'deepseek-v4-pro',
      imageModel: 'nano-banana-fast',
      videoModel: 'MiniMax-Hailuo-2.3-Fast'
    })
    expect(snapshot.productProjects).toEqual([])
    expect(snapshot.activeProductProjectId).toBe('')
    expect(snapshot.projectRuns).toEqual([])
    expect(snapshot.activeProjectRunId).toBe('')
    expect(snapshot.exportItemsByMenu.workspace).toEqual([])
    expect(snapshot.agentReadiness).toMatchObject({
      queue: {
        queuedCount: 0,
        runningCount: 0,
        isProcessing: false,
        queuedTaskIds: [],
        activeTaskIds: []
      },
      executionLog: []
    })
    expect(snapshot.workspaceDashboard.creditOverview.ledgers.map((item) => item.key)).toEqual(['text', 'image', 'video'])
    expect(snapshot.workspaceDashboard.creditMessages.ledgers.map((item) => item.key)).toEqual(['text', 'image', 'video'])
  })

  it('syncs image and video balances from the remote license platform wallet summary', async () => {
    const store = createMemoryStore()
    const outputRootDirectory = await createTempOutputRoot()

    const { createSettingsStoreService } = await import('../../main/src/services/settingsStoreService.js')
    const { createStudioWorkspaceService } = await import('../../main/src/services/studioWorkspaceService.js')

    const settingsService = createSettingsStoreService({ store })
    await settingsService.saveSettings({
      authPlatform: {
        enabled: true,
        baseUrl: 'http://127.0.0.1:3721',
        sessionToken: 'session-1'
      }
    })

    const service = createStudioWorkspaceService({
      store,
      settingsService,
      remoteLicensePlatformClient: {
        getWalletSummary: async () => ({
          imageBalanceCny: 123.45,
          videoBalanceCny: 67.89,
          updatedAt: '2026-06-15T12:00:00.000Z'
        })
      },
      outputRootDirectory,
      ensureDirectory: async () => undefined,
      persistSourceFiles: async () => [],
      writeFile: async () => undefined
    })

    const refreshed = await service.refreshDashboardCredits({
      target: 'all'
    })

    expect(refreshed.image.balanceCny).toBe(123.45)
    expect(refreshed.video.balanceCny).toBe(67.89)
    expect(refreshed.image.syncStatus).toBe('success')
    expect(refreshed.video.syncStatus).toBe('success')
  })

  it('creates product cards from batch assets for the new workbench flow', async () => {
    const store = createMemoryStore()
    const outputRootDirectory = await createTempOutputRoot()

    const { createSettingsStoreService } = await import('../../main/src/services/settingsStoreService.js')
    const { createStudioWorkspaceService } = await import('../../main/src/services/studioWorkspaceService.js')

    const settingsService = createSettingsStoreService({ store })
    const service = createStudioWorkspaceService({
      store,
      settingsService,
      outputRootDirectory,
      ensureDirectory: async () => undefined,
      persistSourceFiles: async () => [],
      writeFile: async () => undefined,
      createId: (() => {
        let sequence = 0
        return () => `asset-${++sequence}`
      })(),
      getNow: () => '2026-06-12T11:00:00.000Z'
    })

    const result = await service.createProjectsFromAssets({
      files: [
        {
          name: 'bag-main.jpg',
          path: 'C:/images/bag-main.jpg',
          preview: 'preview-a'
        },
        {
          name: 'cup-side.png',
          path: 'C:/images/cup-side.png',
          preview: 'preview-b'
        }
      ],
      platform: 'temu',
      language: 'en-US'
    })

    expect(result.createdProjects).toHaveLength(2)
    expect(result.activeProductProjectId).toBe(result.createdProjects[0].id)

    const snapshot = service.getSnapshot()
    expect(snapshot.productProjects).toHaveLength(2)
    expect(snapshot.productProjects[0]).toMatchObject({
      name: 'bag-main',
      platformTarget: ['temu'],
      baseInfo: {
        productName: 'bag-main',
        language: 'en-US'
      },
      generationConfig: {
        enabledSteps: {
          title: true,
          description: true,
          image: true,
          video: true
        },
        imageTemplateId: 'image-default',
        videoTemplateId: 'video-main'
      }
    })
    expect(snapshot.productProjects[0].assets.sourceImages[0]).toMatchObject({
      name: 'bag-main.jpg',
      path: 'C:/images/bag-main.jpg',
      preview: 'preview-a'
    })
    expect(snapshot.productProjects[0].latestRunId).toBe('')
    expect(snapshot.productProjects[0].runIds).toEqual([])
    expect(snapshot.productProjects[1].name).toBe('cup-side')
  })

  it('normalizes legacy stored projects with the new generation config and run record fields', async () => {
    const store = createMemoryStore()
    const outputRootDirectory = await createTempOutputRoot()

    const { createSettingsStoreService } = await import('../../main/src/services/settingsStoreService.js')
    const { createStudioWorkspaceService, STUDIO_WORKSPACE_KEY } = await import('../../main/src/services/studioWorkspaceService.js')

    store.set(STUDIO_WORKSPACE_KEY, {
      productProjects: [
        {
          id: 'legacy-project-1',
          name: '旧商品项目',
          status: 'ready',
          platformTarget: ['temu'],
          baseInfo: {
            productName: '旧商品',
            language: 'zh-CN'
          },
          assets: {
            sourceImages: [],
            generatedImages: []
          },
          content: {
            selectedTitle: '旧标题',
            selectedDescription: '旧描述'
          }
        }
      ],
      activeProductProjectId: 'legacy-project-1'
    })

    const settingsService = createSettingsStoreService({ store })
    const service = createStudioWorkspaceService({
      store,
      settingsService,
      outputRootDirectory,
      ensureDirectory: async () => undefined,
      persistSourceFiles: async () => [],
      writeFile: async () => undefined
    })

    const snapshot = service.getSnapshot()

    expect(snapshot.productProjects).toHaveLength(1)
    expect(snapshot.productProjects[0]).toMatchObject({
      id: 'legacy-project-1',
      latestRunId: '',
      runIds: [],
      generationConfig: {
        enabledSteps: {
          title: true,
          description: true,
          image: true,
          video: true
        },
        titleMaxChars: 60,
        descriptionMaxChars: 300,
        imageSize: '1:1',
        videoDuration: '6s',
        videoResolution: '768P',
        videoMotionStrength: 'auto',
        imageTemplateId: 'image-default',
        videoTemplateId: 'video-main'
      }
    })
    expect(snapshot.projectRuns).toEqual([])
    expect(snapshot.activeProjectRunId).toBe('')
  })

  it('creates a workspace project and writes generated title and description back into the card', async () => {
    const store = createMemoryStore()
    const outputRootDirectory = await createTempOutputRoot()

    const { createSettingsStoreService } = await import('../../main/src/services/settingsStoreService.js')
    const { createStudioWorkspaceService } = await import('../../main/src/services/studioWorkspaceService.js')

    const settingsService = createSettingsStoreService({ store })
    const service = createStudioWorkspaceService({
      store,
      settingsService,
      outputRootDirectory,
      ensureDirectory: async () => undefined,
      persistSourceFiles: async () => [],
      writeFile: async () => undefined,
      generateCopywritingResults: async ({ taskId, draft }) => {
        if (String(taskId).includes('-title')) {
          return Array.from({ length: draft.quantity }, (_unused, index) => ({
            id: `${taskId}-${index + 1}`,
            content: `标题候选 ${index + 1}`
          }))
        }

        return Array.from({ length: draft.quantity }, (_unused, index) => ({
          id: `${taskId}-${index + 1}`,
          content: `描述候选 ${index + 1}`
        }))
      },
      createId: (() => {
        let sequence = 0
        return () => `workspace-${++sequence}`
      })(),
      createTaskNumber: () => 'QAI-20260612-0001',
      getNow: () => '2026-06-12T12:00:00.000Z'
    })

    const createdProject = await service.createProject({
      productName: '便携水杯',
      platform: 'ozon',
      language: 'ru-RU'
    })

    await service.saveDraft({
      menuKey: 'workspace',
      patch: {
        projectId: createdProject.id,
        productName: '便携水杯',
        projectName: '便携水杯项目',
        brand: 'QiuAi',
        category: '家居',
        highlightsText: '大容量, 防漏',
        keywordsText: '水杯, 随行杯',
        platformTargetsText: 'ozon, temu',
        language: 'ru-RU',
        titleQuantity: 2,
        descriptionQuantity: 2
      }
    })

    const createdTask = await service.createTask({
      menuKey: 'workspace'
    })

    expect(createdTask.menuKey).toBe('workspace')

    await service.waitForIdle()

    const snapshot = service.getSnapshot()
    const updatedProject = snapshot.productProjects.find((item) => item.id === createdProject.id)
    const latestRun = snapshot.projectRuns.find((item) => item.id === updatedProject?.latestRunId)

    expect(updatedProject).toBeTruthy()
    expect(updatedProject).toMatchObject({
      status: 'ready',
      content: {
        titleCandidates: ['标题候选 1', '标题候选 2'],
        descriptionCandidates: ['描述候选 1', '描述候选 2'],
        selectedTitle: '标题候选 1',
        selectedDescription: '描述候选 1'
      }
    })
    expect(updatedProject.latestRunId).toBeTruthy()
    expect(updatedProject.runIds).toContain(updatedProject.latestRunId)
    expect(latestRun).toMatchObject({
      projectId: createdProject.id,
      taskId: createdTask.id,
      triggerMenuKey: 'workspace',
      status: 'success'
    })
    expect(latestRun.outputs.title).toBeTruthy()
    expect(latestRun.outputs.description).toBeTruthy()
    expect(latestRun.storage.runDirectory).toContain(path.join('output', 'workspace'))
    expect(snapshot.resultsByMenu.workspace.textResults).toHaveLength(4)
    expect(snapshot.exportItemsByMenu.workspace).toHaveLength(1)
  })

  it('writes title, description and image generator results back to the linked product project', async () => {
    const store = createMemoryStore()
    const outputRootDirectory = await createTempOutputRoot()

    const { createSettingsStoreService } = await import('../../main/src/services/settingsStoreService.js')
    const { createStudioWorkspaceService } = await import('../../main/src/services/studioWorkspaceService.js')

    const settingsService = createSettingsStoreService({ store })
    await seedCredits(settingsService, 5000)

    const service = createStudioWorkspaceService({
      store,
      settingsService,
      outputRootDirectory,
      ensureDirectory: async () => undefined,
      persistSourceFiles: async ({ sourcePaths, targetDirectory }) => {
        return sourcePaths.map((sourcePath) => path.resolve(targetDirectory, path.basename(sourcePath)))
      },
      writeFile: async () => undefined,
      generateCopywritingResults: async ({ draft }) => {
        const prefix = draft.prompt.includes('商品标题') ? '标题' : '描述'
        return [{ id: `${prefix}-1`, content: `${prefix}结果 1` }]
      },
      generateImageResults: async ({ taskId }) => ({
        textResults: [],
        comparisonResults: [],
        groupedResults: [
          {
            id: `${taskId}-group-1`,
            outputs: [
              {
                id: `${taskId}-image-1`,
                model: 'gpt-image-2',
                title: '主图 1',
                preview: createPreviewDataUrl('series-image-1')
              }
            ]
          }
        ],
        summary: {
          title: '套图结果'
        }
      }),
      createId: (() => {
        let sequence = 0
        return () => `generator-${++sequence}`
      })(),
      createTaskNumber: (() => {
        let sequence = 0
        return () => `QAI-20260612-${String(++sequence).padStart(4, '0')}`
      })(),
      getNow: () => '2026-06-12T13:00:00.000Z'
    })

    const project = await service.createProject({
      productName: '露营灯',
      platform: 'temu',
      language: 'zh-CN'
    })

    await service.saveDraft({
      menuKey: 'title-generator',
      patch: {
        projectId: project.id,
        productName: '露营灯',
        titleQuantity: 1
      }
    })
    await service.createTask({ menuKey: 'title-generator' })
    await service.waitForIdle()

    await service.saveDraft({
      menuKey: 'description-generator',
      patch: {
        projectId: project.id,
        productName: '露营灯',
        descriptionQuantity: 1
      }
    })
    await service.createTask({ menuKey: 'description-generator' })
    await service.waitForIdle()

    await service.saveDraft({
      menuKey: 'series-generate',
      patch: {
        projectId: project.id,
        taskName: '露营灯套图',
        sourceImage: {
          name: 'camp-lamp.jpg',
          path: 'C:/images/camp-lamp.jpg',
          preview: 'preview-camp-lamp'
        },
        model: 'gpt-image-2',
        generateCount: 1,
        batchCount: 1
      }
    })

    const imageTask = await service.createTask({ menuKey: 'series-generate' })
    expect(imageTask.estimatedCredits).toBe(600)
    expect(settingsService.getSettings().creditState).toMatchObject({
      remainingCredits: 4400,
      frozenCredits: 600
    })

    await service.waitForIdle()

    const snapshot = service.getSnapshot()
    const updatedProject = snapshot.productProjects.find((item) => item.id === project.id)
    const projectRuns = snapshot.projectRuns.filter((item) => item.projectId === project.id)
    const latestRun = projectRuns.find((item) => item.id === updatedProject?.latestRunId)

    expect(updatedProject).toBeTruthy()
    expect(updatedProject.content.selectedTitle).toBe('标题结果 1')
    expect(updatedProject.content.selectedDescription).toBe('描述结果 1')
    expect(updatedProject.assets.generatedImages).toHaveLength(1)
    expect(updatedProject.assets.generatedImages[0].savedPath).toContain(path.join('series-generate', 'generator-'))
    expect(projectRuns).toHaveLength(3)
    expect(latestRun).toMatchObject({
      triggerMenuKey: 'series-generate',
      status: 'success'
    })
    expect(latestRun.outputs.images).toHaveLength(1)
    expect(latestRun.storage.imageDirectory).toContain(path.join('series-generate', 'generator-'))
    expect(settingsService.getSettings().creditState).toMatchObject({
      remainingCredits: 4400,
      frozenCredits: 0,
      usedCredits: 600
    })
  })

  it('passes non-empty image prompts from workspace flow into series generation', async () => {
    const store = createMemoryStore()
    const outputRootDirectory = await createTempOutputRoot()

    const { createSettingsStoreService } = await import('../../main/src/services/settingsStoreService.js')
    const { createStudioWorkspaceService } = await import('../../main/src/services/studioWorkspaceService.js')

    const settingsService = createSettingsStoreService({ store })
    await seedCredits(settingsService, 5000)

    const observedPrompts = []
    const service = createStudioWorkspaceService({
      store,
      settingsService,
      outputRootDirectory,
      ensureDirectory: async () => undefined,
      persistSourceFiles: async ({ sourcePaths, targetDirectory }) => {
        return sourcePaths.map((sourcePath) => path.resolve(targetDirectory, path.basename(sourcePath)))
      },
      writeFile: async () => undefined,
      generateCopywritingResults: async ({ draft }) => {
        const prefix = draft.prompt.includes('商品标题') ? '标题' : '描述'
        return [{ id: `${prefix}-1`, content: `${prefix}结果 1` }]
      },
      generateImageResults: async ({ draft }) => {
        observedPrompts.push(...(draft.promptAssignments || []).map((item) => item.prompt))
        return {
          textResults: [],
          comparisonResults: [],
          groupedResults: [
            {
              id: 'workspace-series-group-1',
              outputs: [
                {
                  id: 'workspace-series-image-1',
                  title: '主图 1',
                  model: 'gpt-image-2',
                  savedPath: path.resolve(outputRootDirectory, 'workspace-series-image-1.png')
                }
              ]
            }
          ],
          summary: { title: '套图结果' }
        }
      },
      generateVideoResults: async () => ({
        textResults: [],
        comparisonResults: [],
        groupedResults: [
          {
            id: 'workspace-video-group-1',
            outputs: [
              {
                id: 'workspace-video-1',
                title: '商品视频',
                model: 'MiniMax-Hailuo-2.3-Fast',
                savedPath: path.resolve(outputRootDirectory, 'workspace-video-1.mp4')
              }
            ]
          }
        ],
        summary: { title: '视频结果' }
      }),
      createId: (() => {
        let sequence = 0
        return () => `workspace-series-${++sequence}`
      })(),
      createTaskNumber: () => 'QAI-20260612-0002',
      getNow: () => '2026-06-12T14:00:00.000Z'
    })

    const project = await service.createProject({
      productName: '手工玫瑰',
      platform: 'temu',
      language: 'zh-CN'
    })

    await service.saveDraft({
      menuKey: 'workspace',
      patch: {
        projectId: project.id,
        projectName: '手工玫瑰项目',
        productName: '手工玫瑰',
        titleQuantity: 1,
        descriptionQuantity: 1,
        generateCount: 1,
        sourceImage: {
          name: '1.png',
          path: path.resolve(process.cwd(), 'tests', '1.png'),
          storedPath: path.resolve(process.cwd(), 'tests', '1.png')
        },
        imagePrompt: '生成手工玫瑰商品图',
        videoPrompt: '生成手工玫瑰视频'
      }
    })

    await service.createTask({ menuKey: 'workspace' })
    await service.waitForIdle()

    expect(observedPrompts.length).toBeGreaterThan(0)
    expect(observedPrompts.every((prompt) => String(prompt || '').trim().length > 0)).toBe(true)
  })

  it('clears runtime drafts and results while preserving external task history', async () => {
    const store = createMemoryStore()
    const outputRootDirectory = await createTempOutputRoot()

    const { createSettingsStoreService } = await import('../../main/src/services/settingsStoreService.js')
    const { createStudioWorkspaceService, STUDIO_WORKSPACE_KEY } = await import('../../main/src/services/studioWorkspaceService.js')

    store.set(STUDIO_WORKSPACE_KEY, {
      formDrafts: {
        workspace: {
          productName: '旧项目',
          titleQuantity: 9
        },
        'series-generate': {
          taskName: '旧套图',
          sourceImage: {
            name: 'legacy.png',
            path: 'C:/legacy.png'
          },
          batchCount: 3,
          generateCount: 2
        }
      },
      resultsByMenu: {
        workspace: {
          textResults: [{ id: 'legacy-text-1', content: '旧标题' }],
          comparisonResults: [],
          groupedResults: [],
          summary: { title: '旧结果' }
        }
      },
      exportItemsByMenu: {
        workspace: [
          {
            id: 'legacy-export-1',
            name: 'LegacyExport'
          }
        ]
      }
    })

    const settingsService = createSettingsStoreService({ store })
    const service = createStudioWorkspaceService({
      store,
      settingsService,
      taskManagerService: {
        listTasks: () => [
          {
            id: 'history-task-1',
            menuKey: 'workspace',
            status: '已完成',
            progress: 100,
            createdAt: '2026-06-12 13:00:00'
          }
        ]
      },
      outputRootDirectory,
      ensureDirectory: async () => undefined,
      persistSourceFiles: async () => [],
      writeFile: async () => undefined
    })

    const cleared = await service.clearRuntimeState()
    const snapshot = service.getSnapshot()

    expect(cleared.cleared).toBe(true)
    expect(snapshot.formDrafts.workspace.productName).toBe('')
    expect(snapshot.formDrafts.workspace.titleQuantity).toBe(3)
    expect(snapshot.formDrafts['series-generate'].taskName).toBe('')
    expect(snapshot.formDrafts['series-generate'].sourceImage).toBe(null)
    expect(snapshot.resultsByMenu.workspace.textResults).toEqual([])
    expect(snapshot.exportItemsByMenu.workspace).toEqual([])
    expect(snapshot.tasks).toHaveLength(1)
    expect(snapshot.tasks[0].id).toBe('history-task-1')
  })

  it('exposes agent-readiness queue and execution-log snapshots without affecting current workspace flow', async () => {
    const store = createMemoryStore()
    const outputRootDirectory = await createTempOutputRoot()

    const { createSettingsStoreService } = await import('../../main/src/services/settingsStoreService.js')
    const { createStudioWorkspaceService, STUDIO_WORKSPACE_KEY } = await import('../../main/src/services/studioWorkspaceService.js')

    store.set(STUDIO_WORKSPACE_KEY, {
      tasks: [
        {
          id: 'task-log-1',
          taskNumber: 'TASK-001',
          menuKey: 'workspace',
          title: '工作台项目任务',
          status: '已完成',
          progress: 100,
          createdAt: '2026-06-15 10:00:00',
          outputDirectory: 'F:/output/workspace/task-log-1'
        },
        {
          id: 'task-log-2',
          taskNumber: 'TASK-002',
          menuKey: 'series-generate',
          title: '套图任务',
          status: '等待中',
          progress: 0,
          createdAt: '2026-06-15 10:05:00',
          outputDirectory: 'F:/output/series/task-log-2'
        }
      ]
    })

    const settingsService = createSettingsStoreService({ store })
    const service = createStudioWorkspaceService({
      store,
      settingsService,
      outputRootDirectory,
      ensureDirectory: async () => undefined,
      persistSourceFiles: async () => [],
      writeFile: async () => undefined
    })

    const snapshot = service.getSnapshot()

    expect(snapshot.agentReadiness.queue).toMatchObject({
      queuedCount: 0,
      runningCount: 0,
      isProcessing: false,
      queuedTaskIds: [],
      activeTaskIds: []
    })
    expect(snapshot.agentReadiness.executionLog).toHaveLength(2)
    expect(snapshot.agentReadiness.executionLog[0]).toMatchObject({
      taskId: 'task-log-2',
      taskNumber: 'TASK-002',
      menuKey: 'series-generate',
      title: '套图任务',
      status: '等待中'
    })
    expect(snapshot.tasks).toHaveLength(2)
  })

  it('exports a project bundle with text files and generated assets', async () => {
    const store = createMemoryStore()
    const outputRootDirectory = await createTempOutputRoot()

    const { createSettingsStoreService } = await import('../../main/src/services/settingsStoreService.js')
    const { createStudioWorkspaceService, STUDIO_WORKSPACE_KEY } = await import('../../main/src/services/studioWorkspaceService.js')

    const imageDirectory = await fs.mkdtemp(path.join(outputRootDirectory, 'images-'))
    const videoDirectory = await fs.mkdtemp(path.join(outputRootDirectory, 'video-'))
    const imagePath = path.resolve(imageDirectory, 'result-1.png')
    const videoPath = path.resolve(videoDirectory, 'result-1.mp4')
    await fs.writeFile(imagePath, 'image-content')
    await fs.writeFile(videoPath, 'video-content')

    store.set(STUDIO_WORKSPACE_KEY, {
      productProjects: [
        {
          id: 'project-export-1',
          name: '露营灯项目',
          status: 'ready',
          platformTarget: ['temu'],
          baseInfo: {
            productName: '露营灯',
            language: 'zh-CN'
          },
          assets: {
            sourceImages: [],
            generatedImages: [
              {
                savedPath: imagePath
              }
            ],
            generatedVideo: {
              savedPath: videoPath
            }
          },
          content: {
            selectedTitle: '露营灯标题',
            selectedDescription: '露营灯描述'
          }
        }
      ],
      activeProductProjectId: 'project-export-1'
    })

    const settingsService = createSettingsStoreService({ store })
    let exportedTitleText = ''
    let exportedDescriptionText = ''
    let exportedImages = []
    let exportedProjectFiles = []
    const service = createStudioWorkspaceService({
      store,
      settingsService,
      outputRootDirectory,
      exportTaskDirectory: async ({ sourceDirectory, targetZipPath }) => {
        exportedTitleText = await fs.readFile(path.resolve(sourceDirectory, 'title.txt'), 'utf8')
        exportedDescriptionText = await fs.readFile(path.resolve(sourceDirectory, 'description.txt'), 'utf8')
        exportedImages = await fs.readdir(path.resolve(sourceDirectory, 'images'))
        exportedProjectFiles = await fs.readdir(sourceDirectory)
        return {
          targetZipPath
        }
      }
    })

    const result = await service.exportProjectBundle({
      projectId: 'project-export-1',
      targetZipPath: path.resolve(outputRootDirectory, 'bundle.zip')
    })

    expect(result).toMatchObject({
      canceled: false,
      projectId: 'project-export-1',
      targetZipPath: path.resolve(outputRootDirectory, 'bundle.zip')
    })

    expect(exportedTitleText).toContain('露营灯标题')
    expect(exportedDescriptionText).toContain('露营灯描述')
    expect(exportedImages).toHaveLength(1)
    expect(exportedProjectFiles.some((item) => item.endsWith('.mp4'))).toBe(true)
  })
})
