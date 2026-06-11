const crypto = require('node:crypto')

const TEMPLATE_KEY = 'negativePromptTemplates'

const defaultNegativePromptTemplates = [
  {
    id: 'system-empty-negative-prompt',
    name: '无负向提示词',
    category: '反向提示词',
    prompt: '',
    source: 'system-fixed'
  },
  {
    id: 'negative-common',
    name: '电商通用',
    category: '反向提示词',
    prompt: '水印，logo，文字，广告标，多余贴纸，杂乱背景，多余人物，画面变形，产品扭曲，边缘模糊，低清晰度，噪点，拼接痕迹，阴影错乱，明显反光，裁切不全',
    source: 'system-fixed'
  },
  {
    id: 'negative-model',
    name: '电商模特',
    category: '反向提示词',
    prompt: '比例失衡，五官异常，手指错误，肢体变形，姿态僵硬，服装褶皱异常，妆容怪异，背景路人，滤镜过重，肤色异常',
    source: 'system-fixed'
  },
  {
    id: 'negative-still-life',
    name: '电商静物',
    category: '反向提示词',
    prompt: '产品变形，材质失真，脏污灰尘，划痕破损，颜色偏差，反光刺眼，倒影错乱，摆件杂乱，背景花哨，焦点不准，廉价塑料感',
    source: 'system-fixed'
  }
]

function normalizeTemplateItem(template = {}) {
  return {
    id: String(template.id || ''),
    name: String(template.name || ''),
    category: String(template.category || '反向提示词'),
    prompt: String(template.prompt || ''),
    source: template.source === 'system-fixed' ? 'system-fixed' : 'custom'
  }
}

function mergeTemplates(templates = []) {
  const normalizedIncoming = Array.isArray(templates) ? templates.map(normalizeTemplateItem) : []
  const customTemplates = normalizedIncoming.filter((item) => item.source === 'custom' && item.id)
  const fixedTemplateMap = new Map(
    normalizedIncoming
      .filter((item) => item.source === 'system-fixed' && item.id)
      .map((item) => [item.id, item])
  )

  return [
    ...defaultNegativePromptTemplates.map((template) => ({
      ...template,
      ...(fixedTemplateMap.get(template.id) || {}),
      source: 'system-fixed'
    })),
    ...customTemplates
  ]
}

function normalizeTemplates(templates) {
  return mergeTemplates(Array.isArray(templates) ? templates : defaultNegativePromptTemplates)
}

function createNegativePromptTemplateStoreService({ store, createId = () => crypto.randomUUID() }) {
  function listTemplates() {
    return normalizeTemplates(store.get(TEMPLATE_KEY, defaultNegativePromptTemplates)).slice()
  }

  async function saveTemplate(payload = {}) {
    const existingTemplate = listTemplates().find((item) => item.id === payload.id)
    const isFixedTemplate = existingTemplate?.source === 'system-fixed'
    const template = {
      id: isFixedTemplate ? existingTemplate.id : (payload.id || createId()),
      name: String(payload.name || existingTemplate?.name || ''),
      category: String(payload.category || existingTemplate?.category || '反向提示词'),
      prompt: String(payload.prompt || ''),
      source: isFixedTemplate ? 'system-fixed' : 'custom'
    }
    const nextTemplates = [
      ...listTemplates().filter((item) => item.id !== template.id),
      template
    ]
    store.set(TEMPLATE_KEY, normalizeTemplates(nextTemplates))
    return template
  }

  async function removeTemplate(id) {
    const currentTemplates = listTemplates()
    const targetTemplate = currentTemplates.find((item) => item.id === id)
    if (targetTemplate?.source === 'system-fixed') {
      return
    }

    const nextTemplates = currentTemplates.filter((item) => item.id !== id)
    store.set(TEMPLATE_KEY, normalizeTemplates(nextTemplates))
  }

  return {
    listTemplates,
    saveTemplate,
    removeTemplate
  }
}

module.exports = {
  createNegativePromptTemplateStoreService,
  defaultNegativePromptTemplates
}

