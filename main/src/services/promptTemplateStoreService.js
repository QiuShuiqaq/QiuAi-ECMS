const crypto = require('node:crypto')

const TEMPLATE_KEY = 'promptTemplates'

const defaultTemplates = [
  {
    id: 'system-empty-image-type',
    name: '无类型图片',
    category: '按钮提示词',
    prompt: '',
    source: 'system-fixed'
  },
  {
    id: 'product-main',
    name: '商品主图',
    category: '按钮提示词',
    prompt: '电商商品主图，主体为XXX，主体完整清晰，突出XXX本身与核心卖点，构图简洁，光线干净，质感自然，适合首页展示',
    source: 'system-fixed'
  },
  {
    id: 'product-detail',
    name: '详情图',
    category: '按钮提示词',
    prompt: '电商商品详情图，主体为XXX，清晰展示XXX的功能卖点、使用方式或核心信息，画面层次明确，信息表达直观，适合详情页展示',
    source: 'system-fixed'
  },
  {
    id: 'product-closeup',
    name: '细节图',
    category: '按钮提示词',
    prompt: '电商商品细节图，主体为XXX，聚焦XXX的材质、纹理、做工或关键结构，局部清晰放大，质感真实，细节明确',
    source: 'system-fixed'
  },
  {
    id: 'product-size',
    name: '尺寸图',
    category: '按钮提示词',
    prompt: '电商商品尺寸图，主体为XXX，清晰展示XXX的尺寸、规格或结构比例，信息明确易读，画面整洁，适合详情页说明',
    source: 'system-fixed'
  },
  {
    id: 'product-whitebg',
    name: '白底图',
    category: '按钮提示词',
    prompt: '电商商品白底图，主体为XXX，纯白背景，主体完整清晰，边缘干净，颜色准确，适合平台主图或抠图展示',
    source: 'system-fixed'
  },
  {
    id: 'product-color',
    name: '颜色图',
    category: '按钮提示词',
    prompt: '电商商品颜色图，主体为XXX，保持XXX的结构与款式一致，只展示颜色或配色变化，画面统一，便于颜色对比',
    source: 'system-fixed'
  }
]

function normalizeTemplateItem(template = {}) {
  return {
    id: String(template.id || ''),
    name: String(template.name || ''),
    category: String(template.category || ''),
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
    ...defaultTemplates.map((template) => ({
      ...template,
      ...(fixedTemplateMap.get(template.id) || {}),
      source: 'system-fixed'
    })),
    ...customTemplates
  ]
}

function normalizeTemplates(templates) {
  return mergeTemplates(Array.isArray(templates) ? templates : defaultTemplates)
}

function createPromptTemplateStoreService({ store, createId = () => crypto.randomUUID() }) {
  function listTemplates() {
    return normalizeTemplates(store.get(TEMPLATE_KEY, defaultTemplates)).slice()
  }

  async function saveTemplate(payload = {}) {
    const existingTemplate = listTemplates().find((item) => item.id === payload.id)
    const isFixedTemplate = existingTemplate?.source === 'system-fixed'
    const template = {
      id: isFixedTemplate ? existingTemplate.id : (payload.id || createId()),
      name: String(payload.name || existingTemplate?.name || ''),
      category: String(payload.category || existingTemplate?.category || ''),
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
  createPromptTemplateStoreService,
  defaultTemplates
}

