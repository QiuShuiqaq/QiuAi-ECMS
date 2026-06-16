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
    const service = createStudioWorkspaceService({
      store,
      settingsService,
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
})
