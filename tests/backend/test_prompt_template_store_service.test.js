import { describe, expect, it } from 'vitest'

describe('promptTemplateStoreService', () => {
  it('lists fixed button templates and supports custom template save/delete only', async () => {
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
    expect(defaults[0]?.id).toBe('system-empty-image-type')
    expect(defaults[0]?.name).toBe('无类型图片')
    expect(defaults[0]?.source).toBe('system-fixed')
    expect(defaults.some((item) => item.id === 'product-main')).toBe(true)
    expect(defaults.some((item) => item.source === 'system-fixed')).toBe(true)
    expect(defaults.find((item) => item.id === 'product-main')?.prompt).toBe('电商商品主图，主体为XXX，主体完整清晰，突出XXX本身与核心卖点，构图简洁，光线干净，质感自然，适合首页展示')
    expect(defaults.find((item) => item.id === 'product-detail')?.prompt).toBe('电商商品详情图，主体为XXX，清晰展示XXX的功能卖点、使用方式或核心信息，画面层次明确，信息表达直观，适合详情页展示')
    expect(defaults.some((item) => item.name === '商品主图')).toBe(true)
    expect(defaults.some((item) => item.name === '详情图')).toBe(true)
    expect(defaults.some((item) => item.name === '细节图')).toBe(true)
    expect(defaults.some((item) => item.name === '尺寸图')).toBe(true)
    expect(defaults.some((item) => item.name === '白底图')).toBe(true)
    expect(defaults.some((item) => item.name === '颜色图')).toBe(true)

    const saved = await service.saveTemplate({
      name: '暖光场景补充',
      category: '自定义提示词',
      prompt: '统一暖光氛围，适合高端商品展示'
    })

    expect(saved).toEqual({
      id: 'template-new',
      name: '暖光场景补充',
      category: '自定义提示词',
      prompt: '统一暖光氛围，适合高端商品展示',
      source: 'custom'
    })
    expect(service.listTemplates().some((item) => item.id === 'template-new')).toBe(true)

    const updatedFixed = await service.saveTemplate({
      id: 'product-main',
      name: '商品主图',
      category: '按钮提示词',
      prompt: '新的商品主图固定提示词'
    })

    expect(updatedFixed).toEqual({
      id: 'product-main',
      name: '商品主图',
      category: '按钮提示词',
      prompt: '新的商品主图固定提示词',
      source: 'system-fixed'
    })
    expect(service.listTemplates().find((item) => item.id === 'product-main')?.prompt).toBe('新的商品主图固定提示词')

    await service.removeTemplate('template-new')
    expect(service.listTemplates().some((item) => item.id === 'template-new')).toBe(false)

    await service.removeTemplate('product-main')
    expect(service.listTemplates().some((item) => item.id === 'product-main')).toBe(true)
  })

  it('lists the empty negative template as the first fixed system template', async () => {
    const memory = new Map()
    const store = {
      get (key, fallbackValue) {
        return memory.has(key) ? memory.get(key) : fallbackValue
      },
      set (key, value) {
        memory.set(key, value)
      }
    }

    const { createNegativePromptTemplateStoreService } = await import('../../main/src/services/negativePromptTemplateStoreService.js')
    const service = createNegativePromptTemplateStoreService({
      store,
      createId: () => 'negative-template-new'
    })

    const defaults = service.listTemplates()
    expect(defaults[0]?.id).toBe('system-empty-negative-prompt')
    expect(defaults[0]?.name).toBe('无负向提示词')
    expect(defaults[0]?.prompt).toBe('')
    expect(defaults[0]?.source).toBe('system-fixed')
    expect(defaults.find((item) => item.id === 'negative-common')?.prompt).toBe('水印，logo，文字，广告标，多余贴纸，杂乱背景，多余人物，画面变形，产品扭曲，边缘模糊，低清晰度，噪点，拼接痕迹，阴影错乱，明显反光，裁切不全')
    expect(defaults.find((item) => item.id === 'negative-model')?.prompt).toBe('比例失衡，五官异常，手指错误，肢体变形，姿态僵硬，服装褶皱异常，妆容怪异，背景路人，滤镜过重，肤色异常')
  })
})
