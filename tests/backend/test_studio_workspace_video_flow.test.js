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

const tempDirectories = []

async function createTempOutputRoot() {
  const tempDirectory = await fs.mkdtemp(path.join(os.tmpdir(), 'qiuai-workspace-video-test-'))
  tempDirectories.push(tempDirectory)
  return tempDirectory
}

afterEach(async () => {
  await Promise.all(tempDirectories.splice(0).map((targetPath) => {
    return fs.rm(targetPath, { recursive: true, force: true })
  }))
})

describe('studioWorkspaceService video flow', () => {
  it('writes generated video back to the linked product project', async () => {
    const store = createMemoryStore()
    const outputRootDirectory = await createTempOutputRoot()
    const videoSavedPath = path.resolve(outputRootDirectory, 'generated-video.mp4')
    await fs.writeFile(videoSavedPath, 'video-content')

    const { createSettingsStoreService } = await import('../../main/src/services/settingsStoreService.js')
    const { createStudioWorkspaceService } = await import('../../main/src/services/studioWorkspaceService.js')

    const settingsService = createSettingsStoreService({ store })
    await settingsService.saveSettings({
      authPlatform: {
        enabled: true,
        sessionToken: 'video-test-session'
      }
    })
    const service = createStudioWorkspaceService({
      store,
      settingsService,
      remoteLicensePlatformClient: {
        getWalletSummary: async () => ({
          subscriptionBalances: {
            text: 10,
            image: 10,
            video: 10
          },
          permanentBalances: {
            text: 10,
            image: 10,
            video: 10
          },
          splitBalances: {
            text: {
              totalBalanceCny: 20,
              subscriptionBalanceCny: 10,
              permanentBalanceCny: 10
            },
            image: {
              totalBalanceCny: 20,
              subscriptionBalanceCny: 10,
              permanentBalanceCny: 10
            },
            video: {
              totalBalanceCny: 20,
              subscriptionBalanceCny: 10,
              permanentBalanceCny: 10
            }
          },
          updatedAt: '2026-06-13T10:00:00.000Z'
        })
      },
      outputRootDirectory,
      ensureDirectory: async () => undefined,
      persistSourceFiles: async ({ sourcePaths, targetDirectory }) => {
        return sourcePaths.map((sourcePath) => path.resolve(targetDirectory, path.basename(sourcePath)))
      },
      writeFile: async () => undefined,
      generateVideoResults: async ({ taskId }) => ({
        textResults: [],
        comparisonResults: [],
        groupedResults: [
          {
            id: `${taskId}-video-group-1`,
            groupType: 'video',
            outputs: [
              {
                id: `${taskId}-video-1`,
                title: '商品视频',
                model: 'MiniMax-Hailuo-2.3-Fast',
                savedPath: videoSavedPath
              }
            ]
          }
        ],
        summary: {
          title: '视频生成结果'
        }
      }),
      createId: (() => {
        let sequence = 0
        return () => `video-${++sequence}`
      })(),
      createTaskNumber: () => 'QAI-20260613-0001',
      getNow: () => '2026-06-13T10:00:00.000Z'
    })

    const project = await service.createProject({
      productName: '便携风扇',
      platform: 'temu',
      language: 'zh-CN'
    })

    await service.saveDraft({
      menuKey: 'video-generate',
      patch: {
        projectId: project.id,
        taskName: '便携风扇视频',
        sourceImage: {
          name: 'fan.jpg',
          path: 'C:/images/fan.jpg',
          preview: 'preview-fan'
        },
        prompt: '生成便携风扇商品视频'
      }
    })

    await service.createTask({ menuKey: 'video-generate' })
    await service.waitForIdle()

    const snapshot = service.getSnapshot()
    const updatedProject = snapshot.productProjects.find((item) => item.id === project.id)
    const latestRun = snapshot.projectRuns.find((item) => item.id === updatedProject?.latestRunId)

    expect(updatedProject).toBeTruthy()
    expect(updatedProject.assets.generatedVideo).toMatchObject({
      title: '商品视频',
      model: 'MiniMax-Hailuo-2.3-Fast'
    })
    expect(updatedProject.assets.generatedVideo.savedPath).toContain('.mp4')
    expect(latestRun).toMatchObject({
      projectId: project.id,
      triggerMenuKey: 'video-generate',
      status: 'success'
    })
    expect(latestRun.outputs.video.savedPath).toContain('.mp4')
    expect(latestRun.storage.videoDirectory).toContain(path.dirname(updatedProject.assets.generatedVideo.savedPath))
    expect(snapshot.resultsByMenu['video-generate'].groupedResults).toHaveLength(1)
    expect(snapshot.exportItemsByMenu['video-generate']).toHaveLength(1)
  })

  it('injects project title, description, and selection context into standalone video generation', async () => {
    const store = createMemoryStore()
    const outputRootDirectory = await createTempOutputRoot()

    const { createSettingsStoreService } = await import('../../main/src/services/settingsStoreService.js')
    const { createStudioWorkspaceService } = await import('../../main/src/services/studioWorkspaceService.js')

    const observedPrompts = []
    const settingsService = createSettingsStoreService({ store })
    await settingsService.saveSettings({
      authPlatform: {
        enabled: true,
        sessionToken: 'video-test-session'
      }
    })
    const service = createStudioWorkspaceService({
      store,
      settingsService,
      remoteLicensePlatformClient: {
        getWalletSummary: async () => ({
          subscriptionBalances: {
            text: 10,
            image: 10,
            video: 10
          },
          permanentBalances: {
            text: 10,
            image: 10,
            video: 10
          },
          splitBalances: {
            text: {
              totalBalanceCny: 20,
              subscriptionBalanceCny: 10,
              permanentBalanceCny: 10
            },
            image: {
              totalBalanceCny: 20,
              subscriptionBalanceCny: 10,
              permanentBalanceCny: 10
            },
            video: {
              totalBalanceCny: 20,
              subscriptionBalanceCny: 10,
              permanentBalanceCny: 10
            }
          },
          updatedAt: '2026-06-13T10:00:00.000Z'
        })
      },
      outputRootDirectory,
      ensureDirectory: async () => undefined,
      persistSourceFiles: async ({ sourcePaths, targetDirectory }) => {
        return sourcePaths.map((sourcePath) => path.resolve(targetDirectory, path.basename(sourcePath)))
      },
      writeFile: async () => undefined,
      generateVideoResults: async ({ draft }) => {
        observedPrompts.push(String(draft.prompt || ''))
        return {
          textResults: [],
          comparisonResults: [],
          groupedResults: [],
          summary: {
            title: '视频生成结果'
          }
        }
      }
    })

    const project = await service.createProject({
      productName: '便携风扇',
      platform: 'temu',
      language: 'zh-CN',
      patch: {
        content: {
          selectedTitle: '爆款便携风扇',
          selectedDescription: '适合夏季户外使用的静音便携风扇'
        },
        metadata: {
          selectionSource: {
            itemId: 'selection-1',
            platform: 'temu',
            boardType: 'hot-sale',
            boardLabel: '热销商品',
            title: '露营便携风扇',
            priceText: '¥59',
            extractedKeywords: ['风扇', '便携', '户外']
          }
        }
      }
    })

    await service.saveDraft({
      menuKey: 'video-generate',
      patch: {
        projectId: project.id,
        taskName: '便携风扇视频',
        productName: '便携风扇',
        selectedTitle: '爆款便携风扇',
        selectedDescription: '适合夏季户外使用的静音便携风扇',
        selectionSource: {
          itemId: 'selection-1',
          platform: 'temu',
          boardType: 'hot-sale',
          boardLabel: '热销商品',
          title: '露营便携风扇',
          priceText: '¥59',
          extractedKeywords: ['风扇', '便携', '户外']
        },
        sourceImage: {
          name: 'fan.jpg',
          path: 'C:/images/fan.jpg',
          preview: 'preview-fan'
        },
        prompt: '生成电商短视频'
      }
    })

    await service.createTask({ menuKey: 'video-generate' })
    await service.waitForIdle()

    expect(observedPrompts).toHaveLength(1)
    expect(observedPrompts[0]).toContain('参考标题：爆款便携风扇')
    expect(observedPrompts[0]).toContain('参考描述：适合夏季户外使用的静音便携风扇')
    expect(observedPrompts[0]).toContain('选品榜单：热销商品')
    expect(observedPrompts[0]).toContain('选品关键词：风扇、便携、户外')
  })
})
