import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { describe, expect, it, vi } from 'vitest'
import {
  createCloudGenerationService,
  resolveImageRequestedConcurrencyTarget,
  resolveRequestedConcurrency,
  resolvePollingIntervalMs
} from '../../main/src/services/cloudGenerationService'

function createSettingsService({ enabled = true, sessionToken = 'session-1' } = {}) {
  return {
    getSettings() {
      return {
        authPlatform: {
          enabled,
          sessionToken,
          baseUrl: 'https://api.qiuaihub.com'
        }
      }
    }
  }
}

function createRemoteClient() {
  return {
    createGenerationJob: vi.fn(),
    getGenerationJob: vi.fn(),
    downloadGenerationArtifact: vi.fn(),
    getServiceCapacityProfile: vi.fn().mockResolvedValue(null)
  }
}

describe('cloudGenerationService', () => {
  it('uses pollingAdvice when provided by the server', () => {
    expect(resolvePollingIntervalMs({
      status: 'RUNNING',
      pollingAdvice: {
        recommendedIntervalMs: 8000,
        minIntervalMs: 12000
      },
      items: [
        { assetType: 'IMAGE' }
      ]
    })).toBe(12000)
  })

  it('applies polling floors of 10s for image/text and 15s for video when no advice exists', () => {
    expect(resolvePollingIntervalMs({
      status: 'RUNNING',
      items: [
        { assetType: 'IMAGE' }
      ]
    })).toBe(10000)

    expect(resolvePollingIntervalMs({
      status: 'RUNNING',
      items: [
        { assetType: 'TEXT' }
      ]
    })).toBe(10000)

    expect(resolvePollingIntervalMs({
      status: 'RUNNING',
      items: [
        { assetType: 'VIDEO' }
      ]
    })).toBe(15000)
  })

  it('maps planned image counts from 1 to 12 into the expected requested concurrency targets', () => {
    expect([
      resolveImageRequestedConcurrencyTarget(1),
      resolveImageRequestedConcurrencyTarget(2),
      resolveImageRequestedConcurrencyTarget(3),
      resolveImageRequestedConcurrencyTarget(4),
      resolveImageRequestedConcurrencyTarget(5),
      resolveImageRequestedConcurrencyTarget(6),
      resolveImageRequestedConcurrencyTarget(7),
      resolveImageRequestedConcurrencyTarget(8),
      resolveImageRequestedConcurrencyTarget(9),
      resolveImageRequestedConcurrencyTarget(10),
      resolveImageRequestedConcurrencyTarget(11),
      resolveImageRequestedConcurrencyTarget(12)
    ]).toEqual([1, 2, 2, 2, 3, 3, 4, 4, 4, 4, 4, 4])
  })

  it('clamps image requested concurrency to the runtime per-project image limit returned by the server', () => {
    expect(resolveRequestedConcurrency({
      assetType: 'IMAGE',
      draft: {
        batchCount: 1,
        generateCount: 12,
        promptAssignments: Array.from({ length: 12 }, (_, index) => ({
          index: index + 1,
          prompt: `image-${index + 1}`
        }))
      },
      serviceCapacityProfile: {
        currentImageConcurrencyPerProject: 3,
        effectiveImageConcurrency: 16
      }
    })).toBe(3)
  })

  it('falls back to the legacy image concurrency field when runtime profile fields are absent', () => {
    expect(resolveRequestedConcurrency({
      assetType: 'IMAGE',
      draft: {
        batchCount: 1,
        generateCount: 8
      },
      serviceCapacityProfile: {
        effectiveImageConcurrency: 2
      }
    })).toBe(2)
  })

  it('reports non-stalled progress for running image jobs before any artifact is completed', async () => {
    const remoteClient = createRemoteClient()
    remoteClient.createGenerationJob.mockResolvedValue({
      id: 'job-image-progress-1',
      status: 'RUNNING',
      pollingAdvice: {
        recommendedIntervalMs: 1,
        minIntervalMs: 1
      },
      items: [
        {
          groupIndex: 1,
          slotIndex: 1,
          status: 'RUNNING',
          assetType: 'IMAGE',
          providerModel: 'gpt-image-2',
          title: 'Result 1'
        }
      ]
    })
    remoteClient.getGenerationJob
      .mockResolvedValueOnce({
        id: 'job-image-progress-1',
        status: 'RUNNING',
        pollingAdvice: {
          recommendedIntervalMs: 1,
          minIntervalMs: 1
        },
        items: [
          {
            groupIndex: 1,
            slotIndex: 1,
            status: 'RUNNING',
            assetType: 'IMAGE',
            providerModel: 'gpt-image-2',
            title: 'Result 1'
          }
        ]
      })
      .mockResolvedValueOnce({
        id: 'job-image-progress-1',
        status: 'SUCCEEDED',
        pollingAdvice: {
          recommendedIntervalMs: 0,
          minIntervalMs: 0
        },
        groups: [
          {
            groupIndex: 1,
            status: 'SUCCEEDED',
            completedItemCount: 1,
            failedItemCount: 0
          }
        ],
        items: [
          {
            groupIndex: 1,
            slotIndex: 1,
            status: 'SUCCEEDED',
            assetType: 'IMAGE',
            providerModel: 'gpt-image-2',
            title: 'Result 1'
          }
        ],
        artifacts: [
          {
            id: 'artifact-progress-1',
            groupIndex: 1,
            slotIndex: 1,
            assetType: 'IMAGE',
            metadata: {
              mimeType: 'image/png',
              title: 'Result 1',
              providerModel: 'gpt-image-2'
            }
          }
        ]
      })
      .mockResolvedValueOnce({
        id: 'job-image-progress-1',
        status: 'SUCCEEDED',
        groups: [
          {
            groupIndex: 1,
            status: 'SUCCEEDED',
            completedItemCount: 1,
            failedItemCount: 0
          }
        ],
        items: [
          {
            groupIndex: 1,
            slotIndex: 1,
            status: 'SUCCEEDED',
            assetType: 'IMAGE',
            providerModel: 'gpt-image-2',
            title: 'Result 1'
          }
        ],
        artifacts: [
          {
            id: 'artifact-progress-1',
            groupIndex: 1,
            slotIndex: 1,
            assetType: 'IMAGE',
            metadata: {
              mimeType: 'image/png',
              title: 'Result 1',
              providerModel: 'gpt-image-2'
            }
          }
        ]
      })
    remoteClient.downloadGenerationArtifact.mockResolvedValue(Buffer.from('image-binary'))

    const service = createCloudGenerationService({
      settingsService: createSettingsService(),
      remoteLicensePlatformClient: remoteClient,
      readFile: vi.fn().mockResolvedValue(Buffer.from('source-image')),
      getMimeTypeFromPath: () => 'image/png',
      pollIntervalMs: 1
    })

    const progressEvents = []
    await service.generateImageResults({
      menuKey: 'series-generate',
      draft: {
        batchCount: 1,
        generateCount: 1,
        model: 'gpt-image-2',
        size: '1:1',
        prompt: 'test prompt',
        sourceImage: {
          storedPath: 'F:/tmp/source.png'
        },
        promptAssignments: [
          {
            imageType: '主图',
            prompt: 'test prompt'
          }
        ]
      },
      taskId: 'task-image-progress-1',
      outputDirectory: 'F:/tmp/qiuai-cloud-generation',
      onProgress: (payload) => {
        progressEvents.push(payload)
      }
    })

    expect(progressEvents[0]).toMatchObject({ progress: 5, status: 'running' })
    expect(progressEvents[1]).toMatchObject({ status: 'running' })
    expect(progressEvents[1].progress).toBeGreaterThan(20)
    expect(progressEvents.at(-1)).toMatchObject({ progress: 100, status: 'succeeded' })
  })

  it('requests image concurrency from total planned outputs instead of raw batch count inflation', async () => {
    const remoteClient = createRemoteClient()
    remoteClient.getServiceCapacityProfile.mockResolvedValue({
      currentImageConcurrencyPerProject: 4,
      effectiveImageConcurrency: 200
    })
    remoteClient.createGenerationJob.mockResolvedValue({
      id: 'job-image-1',
      status: 'SUCCEEDED'
    })
    remoteClient.getGenerationJob.mockResolvedValue({
      id: 'job-image-1',
      status: 'SUCCEEDED',
      groups: [
        {
          groupIndex: 1,
          status: 'SUCCEEDED',
          completedItemCount: 1,
          failedItemCount: 0
        }
      ],
      items: [
        {
          groupIndex: 1,
          slotIndex: 1,
          status: 'SUCCEEDED',
          providerModel: 'gpt-image-2',
          title: 'Result 1'
        }
      ],
      artifacts: [
        {
          id: 'artifact-1',
          groupIndex: 1,
          slotIndex: 1,
          assetType: 'IMAGE',
          metadata: {
            mimeType: 'image/png',
            title: 'Result 1',
            providerModel: 'gpt-image-2'
          }
        }
      ]
    })
    remoteClient.downloadGenerationArtifact.mockResolvedValue(Buffer.from('image-binary'))

    const service = createCloudGenerationService({
      settingsService: createSettingsService(),
      remoteLicensePlatformClient: remoteClient,
      readFile: vi.fn().mockResolvedValue(Buffer.from('source-image')),
      getMimeTypeFromPath: () => 'image/png'
    })

    await service.generateImageResults({
      menuKey: 'series-generate',
      draft: {
        batchCount: 999,
        generateCount: 1,
        model: 'gpt-image-2',
        size: '1:1',
        prompt: 'test prompt',
        sourceImage: {
          storedPath: 'F:/tmp/source.png'
        },
        promptAssignments: [
          {
            imageType: '主图',
            prompt: 'test prompt'
          }
        ]
      },
      taskId: 'task-remote-image-1',
      outputDirectory: 'F:/tmp/qiuai-cloud-generation'
    })

    expect(remoteClient.createGenerationJob).toHaveBeenCalledTimes(1)
    expect(remoteClient.createGenerationJob.mock.calls[0][0]).toMatchObject({
      requestedConcurrency: 4
    })
  })

  it('normalizes small remote source images before image job submission when a preparation hook is provided', async () => {
    const remoteClient = createRemoteClient()
    remoteClient.createGenerationJob.mockResolvedValue({
      id: 'job-image-normalized-1',
      status: 'SUCCEEDED'
    })
    remoteClient.getGenerationJob.mockResolvedValue({
      id: 'job-image-normalized-1',
      status: 'SUCCEEDED',
      groups: [
        {
          groupIndex: 1,
          status: 'SUCCEEDED',
          completedItemCount: 1,
          failedItemCount: 0
        }
      ],
      items: [
        {
          groupIndex: 1,
          slotIndex: 1,
          status: 'SUCCEEDED',
          assetType: 'IMAGE',
          providerModel: 'gpt-image-2',
          title: 'Result 1'
        }
      ],
      artifacts: [
        {
          id: 'artifact-image-normalized-1',
          groupIndex: 1,
          slotIndex: 1,
          assetType: 'IMAGE',
          metadata: {
            mimeType: 'image/png',
            title: 'Result 1',
            providerModel: 'gpt-image-2'
          }
        }
      ]
    })
    remoteClient.downloadGenerationArtifact.mockResolvedValue(Buffer.from('image-binary'))

    const prepareSourceImageDataUrl = vi.fn().mockResolvedValue('data:image/png;base64,normalized-image')
    const service = createCloudGenerationService({
      settingsService: createSettingsService(),
      remoteLicensePlatformClient: remoteClient,
      readFile: vi.fn().mockResolvedValue(Buffer.from('source-image')),
      getMimeTypeFromPath: () => 'image/jpeg',
      prepareSourceImageDataUrl
    })

    await service.generateImageResults({
      menuKey: 'series-generate',
      draft: {
        batchCount: 1,
        generateCount: 1,
        model: 'gpt-image-2',
        size: '1:1',
        prompt: 'test prompt',
        sourceImage: {
          storedPath: 'F:/tmp/source-small.jpg'
        },
        promptAssignments: [
          {
            imageType: 'main',
            prompt: 'test prompt'
          }
        ]
      },
      taskId: 'task-remote-image-normalized-1',
      outputDirectory: 'F:/tmp/qiuai-cloud-generation'
    })

    expect(prepareSourceImageDataUrl).toHaveBeenCalledWith({
      filePath: 'F:/tmp/source-small.jpg',
      minimumShortSidePx: 300
    })
    expect(remoteClient.createGenerationJob.mock.calls[0][0].items[0].inputSnapshot.urls[0]).toBe('data:image/png;base64,normalized-image')
  })

  it('normalizes small remote source images before video job submission when a preparation hook is provided', async () => {
    const remoteClient = createRemoteClient()
    remoteClient.createGenerationJob.mockResolvedValue({
      id: 'job-video-normalized-1',
      status: 'SUCCEEDED'
    })
    remoteClient.getGenerationJob.mockResolvedValue({
      id: 'job-video-normalized-1',
      status: 'SUCCEEDED',
      groups: [
        {
          groupIndex: 1,
          status: 'SUCCEEDED',
          completedItemCount: 1,
          failedItemCount: 0
        }
      ],
      items: [
        {
          groupIndex: 1,
          slotIndex: 1,
          status: 'SUCCEEDED',
          assetType: 'VIDEO',
          providerModel: 'MiniMax-Hailuo-2.3-Fast',
          title: 'Video'
        }
      ],
      artifacts: [
        {
          id: 'artifact-video-normalized-1',
          groupIndex: 1,
          slotIndex: 1,
          assetType: 'VIDEO',
          metadata: {
            mimeType: 'video/mp4',
            title: 'Video',
            providerModel: 'MiniMax-Hailuo-2.3-Fast'
          }
        }
      ]
    })
    remoteClient.downloadGenerationArtifact.mockResolvedValue(Buffer.from('video-binary'))

    const prepareSourceImageDataUrl = vi.fn().mockResolvedValue('data:image/png;base64,normalized-video-frame')
    const service = createCloudGenerationService({
      settingsService: createSettingsService(),
      remoteLicensePlatformClient: remoteClient,
      readFile: vi.fn().mockResolvedValue(Buffer.from('source-image')),
      getMimeTypeFromPath: () => 'image/jpeg',
      prepareSourceImageDataUrl
    })

    await service.generateVideoResults({
      draft: {
        model: 'MiniMax-Hailuo-2.3-Fast',
        prompt: 'video prompt',
        sourceImage: {
          storedPath: 'F:/tmp/video-source-small.jpg'
        }
      },
      taskId: 'task-remote-video-normalized-1',
      outputDirectory: 'F:/tmp/qiuai-cloud-generation'
    })

    expect(prepareSourceImageDataUrl).toHaveBeenCalledWith({
      filePath: 'F:/tmp/video-source-small.jpg',
      minimumShortSidePx: 300
    })
    expect(remoteClient.createGenerationJob.mock.calls[0][0].items[0].inputSnapshot.firstFrameImageDataUrl).toBe('data:image/png;base64,normalized-video-frame')
  })

  it('passes through artifact downloadUrl so completed assets can be fetched directly when the platform provides one', async () => {
    const remoteClient = createRemoteClient()
    remoteClient.createGenerationJob.mockResolvedValue({
      id: 'job-image-cdn-1',
      status: 'SUCCEEDED'
    })
    remoteClient.getGenerationJob.mockResolvedValue({
      id: 'job-image-cdn-1',
      status: 'SUCCEEDED',
      groups: [
        {
          groupIndex: 1,
          status: 'SUCCEEDED',
          completedItemCount: 1,
          failedItemCount: 0
        }
      ],
      items: [
        {
          groupIndex: 1,
          slotIndex: 1,
          status: 'SUCCEEDED',
          providerModel: 'gpt-image-2',
          title: 'Result 1'
        }
      ],
      artifacts: [
        {
          id: 'artifact-cdn-1',
          groupIndex: 1,
          slotIndex: 1,
          assetType: 'IMAGE',
          downloadUrl: 'https://cdn.qiuaihub.com/generated/artifact-cdn-1.png',
          metadata: {
            mimeType: 'image/png',
            title: 'Result 1',
            providerModel: 'gpt-image-2'
          }
        }
      ]
    })
    remoteClient.downloadGenerationArtifact.mockResolvedValue(Buffer.from('image-binary'))

    const service = createCloudGenerationService({
      settingsService: createSettingsService(),
      remoteLicensePlatformClient: remoteClient,
      readFile: vi.fn().mockResolvedValue(Buffer.from('source-image')),
      getMimeTypeFromPath: () => 'image/png'
    })

    await service.generateImageResults({
      menuKey: 'series-generate',
      draft: {
        batchCount: 1,
        generateCount: 1,
        model: 'gpt-image-2',
        size: '1:1',
        prompt: 'test prompt',
        sourceImage: {
          storedPath: 'F:/tmp/source.png'
        },
        promptAssignments: [
          {
            imageType: '主图',
            prompt: 'test prompt'
          }
        ]
      },
      taskId: 'task-remote-image-cdn-1',
      outputDirectory: 'F:/tmp/qiuai-cloud-generation'
    })

    expect(remoteClient.downloadGenerationArtifact).toHaveBeenCalledWith(expect.objectContaining({
      id: 'artifact-cdn-1',
      sessionToken: 'session-1',
      downloadUrl: 'https://cdn.qiuaihub.com/generated/artifact-cdn-1.png'
    }))
  })

  it('preserves all series batches by saving artifacts with batch-specific filenames', async () => {
    const remoteClient = createRemoteClient()
    remoteClient.createGenerationJob.mockResolvedValue({
      id: 'job-image-batch-1',
      status: 'SUCCEEDED'
    })
    remoteClient.getGenerationJob.mockResolvedValue({
      id: 'job-image-batch-1',
      status: 'SUCCEEDED',
      groups: [
        {
          groupIndex: 1,
          status: 'SUCCEEDED',
          completedItemCount: 1,
          failedItemCount: 0
        },
        {
          groupIndex: 2,
          status: 'SUCCEEDED',
          completedItemCount: 1,
          failedItemCount: 0
        }
      ],
      items: [
        {
          groupIndex: 1,
          slotIndex: 1,
          status: 'SUCCEEDED',
          assetType: 'IMAGE',
          providerModel: 'gpt-image-2',
          title: 'Batch 1'
        },
        {
          groupIndex: 2,
          slotIndex: 1,
          status: 'SUCCEEDED',
          assetType: 'IMAGE',
          providerModel: 'gpt-image-2',
          title: 'Batch 2'
        }
      ],
      artifacts: [
        {
          id: 'artifact-batch-1',
          groupIndex: 1,
          slotIndex: 1,
          assetType: 'IMAGE',
          metadata: {
            mimeType: 'image/png',
            title: 'Batch 1',
            providerModel: 'gpt-image-2'
          }
        },
        {
          id: 'artifact-batch-2',
          groupIndex: 2,
          slotIndex: 1,
          assetType: 'IMAGE',
          metadata: {
            mimeType: 'image/png',
            title: 'Batch 2',
            providerModel: 'gpt-image-2'
          }
        }
      ]
    })
    remoteClient.downloadGenerationArtifact
      .mockResolvedValueOnce(Buffer.from('image-batch-1'))
      .mockResolvedValueOnce(Buffer.from('image-batch-2'))

    const service = createCloudGenerationService({
      settingsService: createSettingsService(),
      remoteLicensePlatformClient: remoteClient,
      readFile: vi.fn().mockResolvedValue(Buffer.from('source-image')),
      getMimeTypeFromPath: () => 'image/png'
    })
    const outputDirectory = await fs.mkdtemp(path.join(os.tmpdir(), 'qiuai-cloud-batch-'))

    try {
      const result = await service.generateImageResults({
        menuKey: 'series-generate',
        draft: {
          batchCount: 2,
          generateCount: 1,
          model: 'gpt-image-2',
          size: '1:1',
          prompt: 'test prompt',
          sourceImage: {
            storedPath: 'F:/tmp/source.png'
          },
          promptAssignments: [
            {
              imageType: '主图',
              prompt: 'test prompt'
            }
          ]
        },
        taskId: 'task-remote-image-batch-1',
        outputDirectory
      })

      const savedPaths = result.groupedResults.flatMap((group) => group.outputs.map((item) => item.savedPath))

      expect(savedPaths).toHaveLength(2)
      expect(new Set(savedPaths).size).toBe(2)
      expect(savedPaths[0]).toContain('batch-01-slot-01-image.png')
      expect(savedPaths[1]).toContain('batch-02-slot-01-image.png')
      await expect(fs.readFile(savedPaths[0], 'utf8')).resolves.toBe('image-batch-1')
      await expect(fs.readFile(savedPaths[1], 'utf8')).resolves.toBe('image-batch-2')
    } finally {
      await fs.rm(outputDirectory, { recursive: true, force: true })
    }
  })

  it('fails closed for remote-managed image generation when the remote session is not ready', async () => {
    const service = createCloudGenerationService({
      settingsService: createSettingsService({ enabled: false, sessionToken: '' }),
      remoteLicensePlatformClient: createRemoteClient(),
      getMimeTypeFromPath: () => 'image/png'
    })

    await expect(service.generateImageResults({
      menuKey: 'series-generate',
      draft: {},
      taskId: 'task-series',
      outputDirectory: 'F:/tmp'
    })).rejects.toMatchObject({
      code: 'REMOTE_GENERATION_NOT_READY'
    })
  })

  it('falls back to the primary source image when series source items lose their local paths', async () => {
    const remoteClient = createRemoteClient()
    remoteClient.createGenerationJob.mockResolvedValue({
      id: 'job-image-fallback-1',
      status: 'SUCCEEDED'
    })
    remoteClient.getGenerationJob.mockResolvedValue({
      id: 'job-image-fallback-1',
      status: 'SUCCEEDED',
      groups: [
        {
          groupIndex: 1,
          status: 'SUCCEEDED',
          completedItemCount: 1,
          failedItemCount: 0
        }
      ],
      items: [
        {
          groupIndex: 1,
          slotIndex: 1,
          status: 'SUCCEEDED',
          assetType: 'IMAGE',
          providerModel: 'gpt-image-2',
          title: 'Result 1'
        }
      ],
      artifacts: [
        {
          id: 'artifact-fallback-1',
          groupIndex: 1,
          slotIndex: 1,
          assetType: 'IMAGE',
          metadata: {
            mimeType: 'image/png',
            title: 'Result 1',
            providerModel: 'gpt-image-2'
          }
        }
      ]
    })
    remoteClient.downloadGenerationArtifact.mockResolvedValue(Buffer.from('image-binary'))

    const service = createCloudGenerationService({
      settingsService: createSettingsService(),
      remoteLicensePlatformClient: remoteClient,
      readFile: vi.fn().mockResolvedValue(Buffer.from('source-image')),
      getMimeTypeFromPath: () => 'image/png'
    })

    await service.generateImageResults({
      menuKey: 'series-generate',
      draft: {
        batchCount: 1,
        generateCount: 1,
        model: 'gpt-image-2',
        size: '1:1',
        prompt: 'fallback prompt',
        sourceImage: {
          storedPath: 'F:/tmp/source.png'
        },
        seriesSourceItems: [
          {
            id: 'broken-series-source-1',
            sourceImage: {
              name: 'broken.png',
              storedPath: '',
              path: ''
            },
            prompt: 'broken prompt',
            size: '1:1',
            imageType: 'main'
          }
        ],
        promptAssignments: [
          {
            imageType: 'main',
            prompt: 'fallback prompt'
          }
        ]
      },
      taskId: 'task-remote-image-fallback-1',
      outputDirectory: 'F:/tmp/qiuai-cloud-generation'
    })

    expect(remoteClient.createGenerationJob).toHaveBeenCalledTimes(1)
    expect(remoteClient.createGenerationJob.mock.calls[0][0].items).toHaveLength(1)
  })

  it('fails before remote submission when no runnable image source exists', async () => {
    const remoteClient = createRemoteClient()
    const service = createCloudGenerationService({
      settingsService: createSettingsService(),
      remoteLicensePlatformClient: remoteClient,
      readFile: vi.fn(),
      getMimeTypeFromPath: () => 'image/png'
    })

    await expect(service.generateImageResults({
      menuKey: 'series-generate',
      draft: {
        batchCount: 1,
        generateCount: 1,
        seriesSourceItems: [
          {
            id: 'broken-series-source-1',
            sourceImage: {
              name: 'broken.png',
              storedPath: '',
              path: ''
            },
            prompt: 'broken prompt',
            size: '1:1'
          }
        ]
      },
      taskId: 'task-remote-image-missing-source-1',
      outputDirectory: 'F:/tmp/qiuai-cloud-generation'
    })).rejects.toThrow('Source image path is required.')

    expect(remoteClient.createGenerationJob).not.toHaveBeenCalled()
  })

  it('rejects unsupported non-live image task entry points instead of preserving a hidden local fallback', async () => {
    const service = createCloudGenerationService({
      settingsService: createSettingsService({ enabled: false, sessionToken: '' }),
      remoteLicensePlatformClient: createRemoteClient(),
      getMimeTypeFromPath: () => 'image/png'
    })

    await expect(service.generateImageResults({
      menuKey: 'legacy-image-flow',
      draft: {},
      taskId: 'task-legacy',
      outputDirectory: 'F:/tmp'
    })).rejects.toMatchObject({
      code: 'UNSUPPORTED_IMAGE_MENU_KEY'
    })
  })

  it('fails closed for remote-managed video generation when the remote session is not ready', async () => {
    const service = createCloudGenerationService({
      settingsService: createSettingsService({ enabled: false, sessionToken: '' }),
      remoteLicensePlatformClient: createRemoteClient(),
      getMimeTypeFromPath: () => 'image/png'
    })

    await expect(service.generateVideoResults({
      draft: {},
      taskId: 'task-video',
      outputDirectory: 'F:/tmp'
    })).rejects.toMatchObject({
      code: 'REMOTE_GENERATION_NOT_READY'
    })
  })

  it('fails closed for remote-managed text generation without preserving hidden local fallbacks', async () => {
    const service = createCloudGenerationService({
      settingsService: createSettingsService({ enabled: false, sessionToken: '' }),
      remoteLicensePlatformClient: createRemoteClient(),
      getMimeTypeFromPath: () => 'image/png'
    })

    await expect(service.generateTextResults({
      draft: {
        copyMode: 'plain'
      },
      taskId: 'task-text'
    })).rejects.toMatchObject({
      code: 'REMOTE_GENERATION_NOT_READY'
    })
  })
})
