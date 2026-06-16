import { describe, expect, it, vi } from 'vitest'

describe('copywritingGenerationService', () => {
  it('always sends text generation requests to the DeepSeek API base URL', async () => {
    const createHttpClientServiceDependency = vi.fn(() => ({
      post: vi.fn()
    }))
    const createChatCompletionDependency = vi.fn().mockResolvedValue({
      content: '标题结果 1\n标题结果 2'
    })
    const settingsService = {
      getSettings: () => ({
        apiBaseUrl: 'https://grsai.dakka.com.cn',
        providerApiKeys: {
          deepseek: 'sk-deepseek-text'
        }
      })
    }

    const { createCopywritingGenerationService } = await import('../../main/src/services/copywritingGenerationService.js')
    const service = createCopywritingGenerationService({
      settingsService,
      messageRecorder: null,
      createHttpClientServiceDependency,
      createChatCompletionDependency
    })

    const results = await service.generateCopywritingResults({
      taskId: 'task-1',
      draft: {
        model: 'deepseek-v4-flash',
        quantity: 1,
        prompt: '生成标题'
      }
    })

    expect(createHttpClientServiceDependency).toHaveBeenCalledWith(expect.objectContaining({
      apiBaseUrl: 'https://api.deepseek.com',
      apiKey: 'sk-deepseek-text'
    }))
    expect(createChatCompletionDependency).toHaveBeenCalledWith(expect.objectContaining({
      model: 'deepseek-v4-flash'
    }), expect.any(Object))
    expect(results).toEqual([
      {
        id: 'task-1-copywriting-1',
        title: '文案 1',
        format: 'txt',
        content: '标题结果 1'
      }
    ])
  })
})
