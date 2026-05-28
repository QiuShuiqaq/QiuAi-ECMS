const crypto = require('node:crypto')

const TEMPLATE_KEY = 'negativePromptTemplates'

const defaultNegativePromptTemplates = [
  {
    id: 'system-empty-negative-prompt',
    name: '无需反向模板',
    category: '通用约束',
    prompt: '',
    source: 'system-fixed',
    module: 'image'
  },
  {
    id: 'negative-common',
    name: '生图通用避坑',
    category: '生图约束',
    prompt: '水印，logo，文字乱码，广告贴纸，背景杂乱，主体变形，低清晰度，边缘模糊，构图倾斜，比例错误，阴影脏乱，反光刺眼，拼接痕迹，多余道具，主体不完整',
    source: 'system-fixed',
    module: 'image'
  },
  {
    id: 'negative-model',
    name: '人物模特避坑',
    category: '生图约束',
    prompt: '畸形身材，五官崩坏，大小眼，多手指，肢体扭曲，假肢感，妆容怪异，服装穿模，面部失真，网红假脸，背景路人乱入，过度滤镜',
    source: 'system-fixed',
    module: 'image'
  },
  {
    id: 'negative-still-life',
    name: '静物商品避坑',
    category: '生图约束',
    prompt: '产品破损，材质失真，颜色偏差，尺寸关系错误，画面脏污，说明文字错乱，多余摆件，包装残缺，低质塑料感，对焦不准，细节糊掉',
    source: 'system-fixed',
    module: 'image'
  },
  {
    id: 'text-temu-platform-format',
    name: 'TEMU 平台格式',
    category: '平台格式',
    prompt: '适合 TEMU 的文本应当关键词清楚、场景明确、表达直接、少空话。优先突出商品用途、核心卖点和购买结果感，不要写得太花，不要使用明显违规的极限词和夸张承诺。',
    source: 'system-fixed',
    module: 'text'
  },
  {
    id: 'text-shein-platform-format',
    name: 'SHEIN 平台格式',
    category: '平台格式',
    prompt: '适合 SHEIN 的文本更偏轻消费、生活方式和搭配感。语言要简洁自然，适合年轻化浏览体验，突出风格、用途和购买氛围，不要写成硬广堆砌式文案。',
    source: 'system-fixed',
    module: 'text'
  },
  {
    id: 'text-tiktok-platform-format',
    name: 'TikTok 平台格式',
    category: '平台格式',
    prompt: '适合 TikTok 电商的文本应更口语化、更有结果感，优先突出痛点解决、前后反差和场景使用。适合短视频挂车、视频简介或商品页简述，不要写成长篇说明书。',
    source: 'system-fixed',
    module: 'text'
  },
  {
    id: 'text-amazon-platform-format',
    name: 'Amazon 平台格式',
    category: '平台格式',
    prompt: '适合 Amazon 的文本要结构清楚、信息完整，重点突出功能、材质、规格、使用方式和适用场景。避免夸张口语、无意义热词和不必要的情绪化表达。',
    source: 'system-fixed',
    module: 'text'
  },
  {
    id: 'text-platform-compliance',
    name: '平台合规约束',
    category: '文本约束',
    prompt: '避免绝对化表达，避免虚假承诺，避免医疗功效暗示，避免夸张销量承诺，避免极限词，避免无法验证的第一名、唯一、永久、百分百等表述。',
    source: 'system-fixed',
    module: 'text'
  },
  {
    id: 'text-clickbait-control',
    name: '标题夸张控制',
    category: '文本约束',
    prompt: '不要标题党，不要故意制造虚假稀缺，不要堆砌无意义热词，不要口语过度夸张，不要脱离商品实际卖点，不要写成刷屏式低质电商文案。',
    source: 'system-fixed',
    module: 'text'
  },
  {
    id: 'text-image-consistency-control',
    name: '图文一致性约束',
    category: '文本约束',
    prompt: '如果上传了商品图片，文本内容必须与图片里的商品主体一致，不要虚构图片中没有的功能、结构、配件、颜色和材质；不要把别的商品卖点硬套过来。',
    source: 'system-fixed',
    module: 'text'
  },
  {
    id: 'text-draft-structure-control',
    name: '草稿结构约束',
    category: '文本约束',
    prompt: '输出给草稿箱的文本要结构清楚，标题、卖点、详情和备注分开表达，不要把所有内容混成一段；避免重复句式、重复卖点和无意义空话。',
    source: 'system-fixed',
    module: 'text'
  },
  {
    id: 'video-delivery-control',
    name: '视频可交付约束',
    category: '视频约束',
    prompt: '避免电影级、史诗级等空泛描述；避免无限场景切换、超复杂长镜头、无法执行的特效；避免与商品无关的华丽镜头；避免脚本空洞只有口号没有画面动作。',
    source: 'system-fixed',
    module: 'video'
  },
  {
    id: 'video-platform-compliance',
    name: '视频平台合规约束',
    category: '视频约束',
    prompt: '避免虚假承诺、绝对化效果、极限词、敏感功效暗示、夸张转化承诺；避免明显硬广口播堆砌；避免镜头内容与商品实际不一致。',
    source: 'system-fixed',
    module: 'video'
  },
  {
    id: 'video-text-to-video-generation-control',
    name: '文生视频生成约束',
    category: '文生视频',
    prompt: '避免一句话要求生成过多场景；避免主角、环境、光线频繁跳变；避免抽象空镜过多；优先写清主体、动作、镜头运动和卖点，不要只写情绪词和氛围词。',
    source: 'system-fixed',
    module: 'video'
  },
  {
    id: 'video-image-to-video-consistency-control',
    name: '图生视频主体一致性',
    category: '图生视频',
    prompt: '不要改变上传商品的外观、结构、材质和颜色；不要凭空增加零件、配件或人物手部互动；不要让商品比例失真、边缘融化、文字标识变形；优先保持主体稳定，再做轻动态延展。',
    source: 'system-fixed',
    module: 'video'
  },
  {
    id: 'video-image-to-video-motion-control',
    name: '图生视频轻动态约束',
    category: '图生视频',
    prompt: '避免过度旋转、爆炸式转场、强形变、镜头乱抖和夸张特效；优先使用推近、拉远、平移、局部特写、轻微景深变化和材质反光；保证视频更像商品展示，不要做成剧情大片。',
    source: 'system-fixed',
    module: 'video'
  }
]

function normalizeTemplateItem(template = {}) {
  return {
    id: String(template.id || ''),
    name: String(template.name || ''),
    category: String(template.category || '反向提示词'),
    prompt: String(template.prompt || ''),
    source: template.source === 'system-fixed' ? 'system-fixed' : 'custom',
    module: String(template.module || '')
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
      source: 'system-fixed',
      module: fixedTemplateMap.get(template.id)?.module || template.module
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
      source: isFixedTemplate ? 'system-fixed' : 'custom',
      module: String(payload.module || existingTemplate?.module || '')
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
