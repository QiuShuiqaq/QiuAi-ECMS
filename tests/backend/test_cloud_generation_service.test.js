import { describe, expect, it, vi } from 'vitest'
import {
  createCloudGenerationService,
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

  it('caps remote requested concurrency to the platform maximum contract', async () => {
    const remoteClient = createRemoteClient()
    remoteClient.getServiceCapacityProfile.mockResolvedValue({
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
      requestedConcurrency: 64
    })
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
