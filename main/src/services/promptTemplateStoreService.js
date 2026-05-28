const crypto = require('node:crypto')

const TEMPLATE_KEY = 'promptTemplates'

const defaultTemplates = [
  {
    id: 'system-empty-image-type',
    name: '无需模板',
    category: '生图模板',
    prompt: '',
    source: 'system-fixed',
    module: 'image'
  },
  {
    id: 'product-main',
    name: '商品主图',
    category: '生图模板',
    prompt: '围绕商品主图生成电商展示图。主体必须完整清晰，突出商品本身、核心卖点和购买关注点；画面适合上架首图，不要偏离商品主体，不要加入无关元素。',
    source: 'system-fixed',
    module: 'image'
  },
  {
    id: 'product-detail',
    name: '详情说明图',
    category: '生图模板',
    prompt: '围绕商品详情页生成说明图。强调卖点信息、结构说明、使用方式、场景价值或功能差异；版式适合详情页内容承接，不要做成单纯海报感画面。',
    source: 'system-fixed',
    module: 'image'
  },
  {
    id: 'product-closeup',
    name: '细节放大图',
    category: '生图模板',
    prompt: '围绕商品局部细节生成放大展示图，重点体现材质、做工、纹理、结构节点或差异化细节；镜头聚焦明确，不要生成泛场景主视觉。',
    source: 'system-fixed',
    module: 'image'
  },
  {
    id: 'product-size',
    name: '尺寸参数图',
    category: '生图模板',
    prompt: '围绕商品尺寸信息生成参数说明图，清晰表达长宽高、容量、规格或关键参数；标注结构明确，适合用户快速理解尺寸，不要省略核心规格。',
    source: 'system-fixed',
    module: 'image'
  },
  {
    id: 'product-whitebg',
    name: '白底图',
    category: '生图模板',
    prompt: '生成纯白背景电商图。商品主体完整清晰，边缘干净，适合平台白底图场景；不要加入复杂场景、装饰物、环境背景或多余道具。',
    source: 'system-fixed',
    module: 'image'
  },
  {
    id: 'product-color',
    name: '颜色款式图',
    category: '生图模板',
    prompt: '围绕商品颜色或款式差异生成展示图。保持商品结构和主体一致，只突出颜色、图案或款式变化；不要改动商品基本造型和比例。',
    source: 'system-fixed',
    module: 'image'
  },
  {
    id: 'text-title-click',
    name: '单品标题生成',
    category: '文本模板',
    prompt: '请基于商品标题、卖点、适用场景和目标平台，生成适合电商发布的新标题。要求：1. 输出 5 组可直接使用的标题；2. 每组单独一行；3. 标题自然顺口，不堆砌关键词；4. 优先突出使用场景、核心卖点和购买结果感；5. 不要夸张承诺，不要违规。',
    source: 'system-fixed',
    module: 'text'
  },
  {
    id: 'text-detail-convert',
    name: '商品详情生成',
    category: '文本模板',
    prompt: '请把商品信息整理成适合电商详情页和草稿箱录入的详情文案。建议结构：适用人群、使用场景、核心卖点、购买理由、注意事项。语言要清楚、直接、能上架，避免空话和虚假宣传。',
    source: 'system-fixed',
    module: 'text'
  },
  {
    id: 'text-selling-points',
    name: '核心卖点拆解',
    category: '文本模板',
    prompt: '请提炼这个商品最值得转化的 5 个核心卖点。每个卖点按“卖点标题 + 一句解释”输出，方便后续直接用于详情图、短视频口播、主图文案或草稿整理。',
    source: 'system-fixed',
    module: 'text'
  },
  {
    id: 'text-platform-rewrite',
    name: '平台适配改写',
    category: '文本模板',
    prompt: '请根据目标平台的内容风格，把现有商品文案改写成更适合该平台发布的版本。要求保留核心卖点，但在表达上更贴合平台用户阅读习惯，减少硬广腔调，提高可发布性。',
    source: 'system-fixed',
    module: 'text'
  },
  {
    id: 'text-temu-format',
    name: '图文联动商品文案',
    category: '文本模板',
    prompt: '请结合商品标题、卖点和上传图片，生成一组适合电商使用的完整文本内容，包含：1. 标题 5 组；2. 简短卖点 3 组；3. 详情文案 1 组。要求图文一致，不要脱离图片里的商品主体，不要虚构图片中没有的关键结构。',
    source: 'system-fixed',
    module: 'text'
  },
  {
    id: 'text-shein-format',
    name: '草稿录入版文案',
    category: '文本模板',
    prompt: '请把商品信息整理成适合直接录入草稿箱的一组文本，包含：任务摘要、标题候选、核心卖点、详情说明、备注信息。要求层次清晰，字段之间不要重复，适合后续和图片、视频一起归档成一组草稿。',
    source: 'system-fixed',
    module: 'text'
  },
  {
    id: 'text-tiktok-format',
    name: '短视频挂车文案',
    category: '文本模板',
    prompt: '请输出适合短视频挂车或视频简介使用的商品文案。要求：短、直接、有结果感，优先写痛点解决、使用效果和行动引导；不要写成长篇详情页，也不要过度广告化。',
    source: 'system-fixed',
    module: 'text'
  },
  {
    id: 'text-amazon-format',
    name: '批量多版本生成',
    category: '文本模板',
    prompt: '请围绕同一个商品生成多组不同角度的文案版本，至少包含：结果导向版、场景导向版、卖点导向版、简洁上架版。每组都要包含标题和一段简短描述，方便批量测试和后续筛选。',
    source: 'system-fixed',
    module: 'text'
  },
  {
    id: 'video-convert-script',
    name: '转化短视频脚本',
    category: '视频模板',
    prompt: '请围绕商品卖点生成一版适合电商转化的短视频脚本。结构包含：开头钩子、痛点引出、产品展示、卖点强化、结尾收口。输出时按镜头顺序拆分，便于直接生成视频。',
    source: 'system-fixed',
    module: 'video'
  },
  {
    id: 'video-text-to-video-convert',
    name: '文生视频转化脚本',
    category: '文生视频',
    prompt: '请基于商品标题、卖点、使用场景和目标人群，生成一版适合文生视频的电商转化脚本。要求：镜头画面可以独立成立，不依赖上传图片；先给开头 3 秒钩子，再给商品展示、卖点强化和结尾收口；总时长控制在 10-20 秒。',
    source: 'system-fixed',
    module: 'video'
  },
  {
    id: 'video-image-to-video-convert',
    name: '图生视频转化脚本',
    category: '图生视频',
    prompt: '请基于商品主图或实拍图，生成适合图生视频的电商转化脚本。要求：围绕现有商品图片自然延展镜头动作，不要乱改商品主体；先做轻动作建立真实感，再突出卖点和使用场景，最后收口转化。',
    source: 'system-fixed',
    module: 'video'
  },
  {
    id: 'video-scene-seeding',
    name: '场景种草脚本',
    category: '视频模板',
    prompt: '请围绕商品真实使用场景生成种草类视频脚本。重点体现“谁在什么场景下，用了之后解决了什么问题”。镜头要有生活感，不要只写广告式卖点堆砌。',
    source: 'system-fixed',
    module: 'video'
  },
  {
    id: 'video-text-to-video-seeding',
    name: '文生视频种草脚本',
    category: '文生视频',
    prompt: '请生成一版适合文生视频的种草脚本。要求重点围绕生活场景、情绪氛围和使用变化来写，镜头之间要顺滑衔接，适合从零生成画面，不依赖已有图片素材。',
    source: 'system-fixed',
    module: 'video'
  },
  {
    id: 'video-image-to-video-seeding',
    name: '图生视频种草脚本',
    category: '图生视频',
    prompt: '请基于上传的商品图片，生成一版适合图生视频的种草脚本。要求从图片主体延展出轻镜头运动、场景补充和使用氛围，不要让商品样子和结构发生明显变化。',
    source: 'system-fixed',
    module: 'video'
  },
  {
    id: 'video-cover-hook',
    name: '封面钩子方向',
    category: '视频模板',
    prompt: '请输出 5 组适合电商视频封面和开头 3 秒的钩子文案方向。每组都要短、直接、容易理解，优先突出使用结果、场景冲突或痛点反差。',
    source: 'system-fixed',
    module: 'video'
  },
  {
    id: 'video-shot-outline',
    name: '镜头拆解大纲',
    category: '视频模板',
    prompt: '请把这个商品视频方案拆解成可执行镜头清单。每个镜头写清楚：镜头目的、画面内容、强调卖点、建议时长。总结构要适合 10-20 秒电商视频制作。',
    source: 'system-fixed',
    module: 'video'
  },
  {
    id: 'video-text-to-video-shot-outline',
    name: '文生视频镜头清单',
    category: '文生视频',
    prompt: '请把商品视频方案拆成适合文生视频生成的镜头清单。每个镜头说明：画面场景、主体动作、镜头运动、卖点重点、时长建议。镜头要能独立生成，不依赖上传图片。',
    source: 'system-fixed',
    module: 'video'
  },
  {
    id: 'video-image-to-video-shot-outline',
    name: '图生视频镜头清单',
    category: '图生视频',
    prompt: '请把商品视频方案拆成适合图生视频生成的镜头清单。每个镜头围绕上传图片里的商品主体展开，只做合理延展和轻动态设计，说明镜头动作、卖点重点和时长建议。',
    source: 'system-fixed',
    module: 'video'
  },
  {
    id: 'video-detail-slot',
    name: '详情视频位脚本',
    category: '视频模板',
    prompt: '请生成适合商品详情页视频位使用的短视频脚本。要求结构清楚，先展示商品核心用途，再展示卖点差异和使用细节，时长控制在 15-20 秒，表达稳定不过度花哨。',
    source: 'system-fixed',
    module: 'video'
  },
  {
    id: 'video-live-cut',
    name: '直播切片脚本',
    category: '视频模板',
    prompt: '请围绕商品生成一版适合直播切片二次分发的视频脚本。要求开头直接进入痛点或结果，镜头紧凑，内容更像实拍口播拆条，适合二次剪辑传播。',
    source: 'system-fixed',
    module: 'video'
  },
  {
    id: 'video-ugc-style',
    name: 'UGC 体验脚本',
    category: '视频模板',
    prompt: '请用真实用户分享视角生成商品体验型视频脚本。表达更像日常体验分享，不要太广告腔，重点写“之前的困扰、用了后的变化、最喜欢的点”。',
    source: 'system-fixed',
    module: 'video'
  },
  {
    id: 'video-image-to-video-product-motion',
    name: '图生视频商品动效',
    category: '图生视频',
    prompt: '请围绕上传商品图生成一版“商品轻动效展示”脚本。要求重点是镜头推拉、轻旋转、局部特写、材质反光或细节切换，不做过度戏剧化情节，适合商品展示型视频。',
    source: 'system-fixed',
    module: 'video'
  }
]

function normalizeTemplateItem(template = {}) {
  return {
    id: String(template.id || ''),
    name: String(template.name || ''),
    category: String(template.category || ''),
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
    ...defaultTemplates.map((template) => ({
      ...template,
      ...(fixedTemplateMap.get(template.id) || {}),
      source: 'system-fixed',
      module: fixedTemplateMap.get(template.id)?.module || template.module
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
  createPromptTemplateStoreService,
  defaultTemplates
}
