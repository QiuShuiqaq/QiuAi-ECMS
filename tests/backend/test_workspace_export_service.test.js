import { afterEach, describe, expect, it } from 'vitest'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'

const tempDirectories = []

async function createTempDirectory(prefix = 'qiuai-export-test-') {
  const tempDirectory = await fs.mkdtemp(path.join(os.tmpdir(), prefix))
  tempDirectories.push(tempDirectory)
  return tempDirectory
}

async function cleanupTempDirectories() {
  await Promise.all(tempDirectories.splice(0).map((targetPath) => {
    return fs.rm(targetPath, { recursive: true, force: true })
  }))
}

function createState(initialState = {}) {
  let currentState = {
    productProjects: [],
    exportItemsByMenu: {
      workspace: [],
      'series-generate': [],
      'video-generate': []
    },
    ...initialState
  }

  return {
    getStoredState() {
      return currentState
    }
  }
}

describe('workspaceExportService', () => {
  it('exports a product project bundle with title, description, image, and video assets', async () => {
    const outputRootDirectory = await createTempDirectory()
    const imageDirectory = await createTempDirectory('qiuai-export-image-')
    const videoDirectory = await createTempDirectory('qiuai-export-video-')
    const imagePath = path.resolve(imageDirectory, 'result-1.png')
    const videoPath = path.resolve(videoDirectory, 'result-1.mp4')
    await fs.writeFile(imagePath, 'image-content')
    await fs.writeFile(videoPath, 'video-content')

    const state = createState({
      productProjects: [
        {
          id: 'project-1',
          name: 'Portable Lamp',
          status: 'ready',
          content: {
            selectedTitle: 'Portable Lamp Title',
            selectedDescription: 'Portable Lamp Description'
          },
          baseInfo: {
            productName: 'Portable Lamp',
            brand: 'QiuAi',
            category: 'Lighting',
            language: 'en-US',
            highlights: ['Foldable', 'USB rechargeable'],
            keywords: ['lamp', 'portable']
          },
          assets: {
            generatedImages: [{ savedPath: imagePath }],
            generatedVideo: { savedPath: videoPath }
          },
          metadata: {
            resultLanding: {
              titleRunId: 'run-title-1',
              descriptionRunId: 'run-description-1',
              imageRunId: 'run-image-1',
              videoRunId: 'run-video-1'
            },
            selectionSource: {
              platform: 'temu',
              boardType: 'hot-sale',
              boardLabel: '热销商品',
              title: 'Portable lamp trend item'
            }
          }
        }
      ]
    })

    const { createWorkspaceExportService } = await import('../../main/src/services/workspaceExportService.js')

    let exportedFiles = []
    let exportedTitle = ''
    let exportedDescription = ''
    let exportedManifest = null
    const service = createWorkspaceExportService({
      ...state,
      getResolvedExportItemsByMenu: () => state.getStoredState().exportItemsByMenu,
      ensureDirectory: async (targetPath) => {
        await fs.mkdir(targetPath, { recursive: true })
      },
      exportTaskDirectory: async ({ sourceDirectory, targetZipPath }) => {
        exportedFiles = await fs.readdir(sourceDirectory)
        exportedTitle = await fs.readFile(path.resolve(sourceDirectory, 'title.txt'), 'utf8')
        exportedDescription = await fs.readFile(path.resolve(sourceDirectory, 'description.txt'), 'utf8')
        exportedManifest = JSON.parse(await fs.readFile(path.resolve(sourceDirectory, 'manifest.json'), 'utf8'))
        return { targetZipPath }
      }
    })

    const result = await service.exportProjectBundle({
      projectId: 'project-1',
      targetZipPath: path.resolve(outputRootDirectory, 'bundle.zip')
    })

    expect(result).toMatchObject({
      canceled: false,
      projectId: 'project-1',
      targetZipPath: path.resolve(outputRootDirectory, 'bundle.zip')
    })
    expect(exportedFiles).toEqual(expect.arrayContaining(['title.txt', 'description.txt', 'images', 'manifest.json']))
    expect(exportedFiles.some((item) => item.endsWith('.mp4'))).toBe(true)
    expect(exportedTitle).toContain('Portable Lamp Title')
    expect(exportedDescription).toContain('Portable Lamp Description')
    expect(exportedManifest).toMatchObject({
      schemaVersion: 1,
      project: {
        id: 'project-1',
        name: 'Portable Lamp',
        status: 'ready'
      },
      adoptedContent: {
        title: 'Portable Lamp Title',
        description: 'Portable Lamp Description',
        titleRunId: 'run-title-1',
        descriptionRunId: 'run-description-1'
      },
      adoptedMedia: {
        imageRunId: 'run-image-1',
        videoRunId: 'run-video-1',
        imageCount: 1,
        videoFile: 'result-1.mp4'
      },
      selectionSource: {
        platform: 'temu',
        boardType: 'hot-sale',
        boardLabel: '热销商品',
        title: 'Portable lamp trend item'
      }
    })
    expect(exportedManifest.adoptedMedia.imageFiles).toEqual(['result-1.png'])
  })

  it('exports selected result folders into a staging archive', async () => {
    const outputRootDirectory = await createTempDirectory()
    const resultDirectory = path.resolve(outputRootDirectory, 'workspace', 'task-1', 'group-a')
    await fs.mkdir(resultDirectory, { recursive: true })
    await fs.writeFile(path.resolve(resultDirectory, 'image-1.png'), 'image-content')

    const state = createState({
      exportItemsByMenu: {
        workspace: [
          {
            id: 'export-1',
            name: 'group-a',
            directoryPath: resultDirectory,
            groupTitle: 'group-a'
          }
        ],
        'series-generate': [],
        'video-generate': []
      }
    })

    const { createWorkspaceExportService } = await import('../../main/src/services/workspaceExportService.js')

    let stagedEntries = []
    const service = createWorkspaceExportService({
      ...state,
      getResolvedExportItemsByMenu: (currentState) => currentState.exportItemsByMenu,
      getAvailableDiskSpaceBytes: async () => 1024 * 1024 * 1024,
      exportTaskDirectory: async ({ sourceDirectory, targetZipPath }) => {
        stagedEntries = await fs.readdir(sourceDirectory)
        return { targetZipPath }
      }
    })

    const result = await service.exportSelectedResults({
      menuKey: 'workspace',
      selectedExportIds: ['export-1'],
      targetZipPath: path.resolve(outputRootDirectory, 'selected.zip')
    })

    expect(result).toMatchObject({
      menuKey: 'workspace',
      exportedCount: 1,
      targetZipPath: path.resolve(outputRootDirectory, 'selected.zip')
    })
    expect(stagedEntries).toHaveLength(1)
    expect(stagedEntries[0]).toContain('group-a')
  })

})

afterEach(async () => {
  await cleanupTempDirectories()
})
