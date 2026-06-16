import { afterEach, describe, expect, it, vi } from 'vitest'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'

const tempDirectories = []

async function createTempDirectory() {
  const tempDirectory = await fs.mkdtemp(path.join(os.tmpdir(), 'qiuai-video-test-'))
  tempDirectories.push(tempDirectory)
  return tempDirectory
}

afterEach(async () => {
  await Promise.all(tempDirectories.splice(0).map((targetPath) => {
    return fs.rm(targetPath, { recursive: true, force: true })
  }))
})

describe('studioVideoGenerationService', () => {
  it('creates, polls, retrieves and downloads a video from MiniMax', async () => {
    const httpClient = {
      post: vi.fn().mockResolvedValue({
        data: {
          task_id: 'remote-task-1',
          base_resp: {
            status_code: 0,
            status_msg: 'success'
          }
        }
      }),
      get: vi.fn()
        .mockResolvedValueOnce({
          data: {
            task_id: 'remote-task-1',
            status: 'Processing',
            base_resp: {
              status_code: 0,
              status_msg: 'success'
            }
          }
        })
        .mockResolvedValueOnce({
          data: {
            task_id: 'remote-task-1',
            status: 'Success',
            file_id: 'file-1',
            video_width: 1920,
            video_height: 1080,
            base_resp: {
              status_code: 0,
              status_msg: 'success'
            }
          }
        })
        .mockResolvedValueOnce({
          data: {
            file: {
              file_id: 'file-1',
              filename: 'product-video.mp4',
              download_url: 'https://download.example/product-video.mp4'
            },
            base_resp: {
              status_code: 0,
              status_msg: 'success'
            }
          }
        })
    }
    const requestClient = {
      get: vi.fn().mockResolvedValue({
        data: Buffer.from('video-binary')
      })
    }
    const progressEvents = []

    const { createStudioVideoGenerationService } = await import('../../main/src/services/studioVideoGenerationService.js')
    const service = createStudioVideoGenerationService({
      settingsService: {
        getSettings: () => ({
          apiKey: 'mini-max-key'
        })
      },
      messageRecorder: null,
      runtimeLogger: null,
      requestMetricRecorder: null,
      createHttpClientServiceDependency: () => httpClient,
      toDataUrlDependency: vi.fn(async () => 'data:image/png;base64,ZmFrZQ=='),
      getMimeTypeFromPathDependency: vi.fn(() => 'image/png'),
      requestClient,
      wait: vi.fn(async () => undefined),
      getNowMs: (() => {
        let now = 0
        return () => {
          now += 1000
          return now
        }
      })()
    })

    const outputDirectory = await createTempDirectory()
    const result = await service.generateVideoResults({
      taskId: 'task-video-1',
      outputDirectory,
      draft: {
        model: 'MiniMax-Hailuo-2.3-Fast',
        sourceImage: {
          path: 'C:/images/product.png'
        },
        prompt: '生成电商商品视频',
        duration: '10s',
        resolution: '1080P'
      },
      onProgress: async (payload) => {
        progressEvents.push(payload)
      }
    })

    expect(httpClient.post).toHaveBeenCalledWith('/v1/video_generation', expect.objectContaining({
      model: 'MiniMax-Hailuo-2.3-Fast',
      prompt: '生成电商商品视频',
      duration: 10,
      resolution: '768P'
    }))
    expect(httpClient.get).toHaveBeenNthCalledWith(1, '/v1/query/video_generation', {
      task_id: 'remote-task-1'
    })
    expect(httpClient.get).toHaveBeenNthCalledWith(3, '/v1/files/retrieve', {
      file_id: 'file-1'
    })
    expect(requestClient.get).toHaveBeenCalledWith('https://download.example/product-video.mp4', {
      responseType: 'arraybuffer'
    })
    expect(progressEvents.at(-1)).toEqual({
      progress: 100,
      status: 'succeeded'
    })
    expect(result.groupedResults).toHaveLength(1)
    expect(result.groupedResults[0].groupType).toBe('video')
    expect(result.groupedResults[0].outputs[0]).toMatchObject({
      model: 'MiniMax-Hailuo-2.3-Fast',
      title: '商品视频',
      duration: '10s',
      resolution: '768P',
      format: 'mp4'
    })
    await expect(fs.readFile(result.groupedResults[0].outputs[0].savedPath)).resolves.toEqual(Buffer.from('video-binary'))
  })

  it('fails early when api key or source image is missing', async () => {
    const { createStudioVideoGenerationService } = await import('../../main/src/services/studioVideoGenerationService.js')

    const missingKeyService = createStudioVideoGenerationService({
      settingsService: {
        getSettings: () => ({})
      }
    })

    await expect(missingKeyService.generateVideoResults({
      taskId: 'task-video-no-key',
      outputDirectory: 'C:/output',
      draft: {
        sourceImage: {
          path: 'C:/images/product.png'
        }
      }
    })).rejects.toThrow('请先保存可用的 API-Key。')

    const missingImageService = createStudioVideoGenerationService({
      settingsService: {
        getSettings: () => ({
          apiKey: 'mini-max-key'
        })
      }
    })

    await expect(missingImageService.generateVideoResults({
      taskId: 'task-video-no-image',
      outputDirectory: 'C:/output',
      draft: {}
    })).rejects.toThrow('视频生成需要先上传一张参考图')
  })
})
