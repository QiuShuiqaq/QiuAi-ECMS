import { describe, expect, it, vi } from 'vitest'

describe('copywritingGenerationService', () => {
  it('normalizes grouped title and description results from the model output', async () => {
    const settingsService = {
      getSettings: vi.fn(() => ({
        glmApiKey: 'glm-demo-key'
      }))
    }

    const createHttpClientServiceDependency = vi.fn(() => ({
      post: vi.fn()
    }))

    const createChatCompletionDependency = vi.fn().mockResolvedValue({
      content: [
        '标题：厨房免打孔旋转纸巾架，抽纸顺手不占台面',
        '描述：免打孔安装，防潮防油烟，厨房宿舍浴室都能用。',
        '---',
        '标题：台面立刻清爽的旋转纸巾架，转角也能稳稳收纳',
        '描述：结果感强，适合详情承接，也适合后续联动套图和视频。'
      ].join('\n')
    })

    const { createCopywritingGenerationService } = await import('../../main/src/services/copywritingGenerationService.js')
    const service = createCopywritingGenerationService({
      settingsService,
      messageRecorder: null,
      createHttpClientServiceDependency,
      createChatCompletionDependency
    })

    const result = await service.generateCopywritingResults({
      taskId: 'task-1',
      draft: {
        quantity: 2,
        prompt: '请生成电商标题和描述'
      }
    })

    expect(result).toHaveLength(2)
    expect(result[0]).toMatchObject({
      titleText: '厨房免打孔旋转纸巾架，抽纸顺手不占台面',
      descriptionText: '免打孔安装，防潮防油烟，厨房宿舍浴室都能用。'
    })
    expect(result[1]).toMatchObject({
      titleText: '台面立刻清爽的旋转纸巾架，转角也能稳稳收纳',
      descriptionText: '结果感强，适合详情承接，也适合后续联动套图和视频。'
    })
  })
})
