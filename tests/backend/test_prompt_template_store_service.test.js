import { describe, expect, it } from 'vitest'

describe('promptTemplateStoreService', () => {
  it('lists fixed title/description/image/video templates and supports custom template save/delete only', async () => {
    const memory = new Map()
    const store = {
      get (key, fallbackValue) {
        return memory.has(key) ? memory.get(key) : fallbackValue
      },
      set (key, value) {
        memory.set(key, value)
      }
    }

    const { createPromptTemplateStoreService } = await import('../../main/src/services/promptTemplateStoreService.js')
    const service = createPromptTemplateStoreService({
      store,
      createId: () => 'template-new'
    })

    const defaults = service.listTemplates()
    expect(defaults.length).toBeGreaterThan(0)
    expect(defaults[0]?.id).toBe('title-default')
    expect(defaults[0]?.name).toBe('默认')
    expect(defaults[0]?.source).toBe('system-fixed')
    expect(defaults.some((item) => item.id === 'title-temu')).toBe(true)
    expect(defaults.some((item) => item.id === 'description-temu')).toBe(true)
    expect(defaults.some((item) => item.id === 'image-main')).toBe(true)
    expect(defaults.some((item) => item.id === 'video-main')).toBe(true)
    expect(defaults.some((item) => item.source === 'system-fixed')).toBe(true)
    expect(defaults.find((item) => item.id === 'title-temu')?.category).toBe('标题')
    expect(defaults.find((item) => item.id === 'description-temu')?.category).toBe('描述')
    expect(defaults.find((item) => item.id === 'image-main')?.category).toBe('图片')
    expect(defaults.find((item) => item.id === 'video-main')?.category).toBe('视频')
    expect(defaults.some((item) => item.name === '淘宝')).toBe(true)
    expect(defaults.some((item) => item.name === 'Amazon')).toBe(true)
    expect(defaults.some((item) => item.name === '白底图')).toBe(true)
    expect(defaults.some((item) => item.name === '全替换')).toBe(true)
    expect(defaults.some((item) => item.name === '对比视频')).toBe(true)

    const saved = await service.saveTemplate({
      name: '夏季家居',
      category: '标题',
      prompt: '生成适合夏季家居类商品的电商标题和描述，突出清爽、实用和真实卖点。'
    })

    expect(saved).toEqual({
      id: 'template-new',
      name: '夏季家居',
      category: '标题',
      prompt: '生成适合夏季家居类商品的电商标题和描述，突出清爽、实用和真实卖点。',
      source: 'custom'
    })
    expect(service.listTemplates().some((item) => item.id === 'template-new')).toBe(true)

    const updatedFixed = await service.saveTemplate({
      id: 'image-main',
      name: '主图',
      category: '图片',
      prompt: '新的主图固定提示词'
    })

    expect(updatedFixed).toEqual({
      id: 'image-main',
      name: '主图',
      category: '图片',
      prompt: '新的主图固定提示词',
      source: 'system-fixed'
    })
    expect(service.listTemplates().find((item) => item.id === 'image-main')?.prompt).toBe('新的主图固定提示词')

    await service.removeTemplate('template-new')
    expect(service.listTemplates().some((item) => item.id === 'template-new')).toBe(false)

    await service.removeTemplate('image-main')
    expect(service.listTemplates().some((item) => item.id === 'image-main')).toBe(true)
  })

  it('migrates legacy 文本 templates into current 标题 and 描述 records on read', async () => {
    const memory = new Map()
    const store = {
      get (key, fallbackValue) {
        return memory.has(key) ? memory.get(key) : fallbackValue
      },
      set (key, value) {
        memory.set(key, value)
      }
    }

    memory.set('promptTemplates', [
      {
        id: 'text-temu',
        name: 'TEMU',
        category: '文本',
        prompt: '旧固定模板',
        source: 'system-fixed'
      },
      {
        id: 'legacy-custom',
        name: '旧自定义模板',
        category: '文本',
        prompt: '旧自定义内容',
        source: 'custom'
      }
    ])

    const { createPromptTemplateStoreService } = await import('../../main/src/services/promptTemplateStoreService.js')
    const service = createPromptTemplateStoreService({ store })
    const templates = service.listTemplates()

    expect(templates.find((item) => item.id === 'title-temu')).toMatchObject({
      category: '标题',
      prompt: '旧固定模板',
      source: 'system-fixed'
    })
    expect(templates.find((item) => item.id === 'description-temu')).toMatchObject({
      category: '描述',
      prompt: '旧固定模板',
      source: 'system-fixed'
    })
    expect(templates.find((item) => item.id === 'legacy-custom-title')).toMatchObject({
      category: '标题',
      prompt: '旧自定义内容',
      source: 'custom'
    })
    expect(templates.find((item) => item.id === 'legacy-custom-description')).toMatchObject({
      category: '描述',
      prompt: '旧自定义内容',
      source: 'custom'
    })
    expect(templates.some((item) => item.category === '文本')).toBe(false)
  })
})
