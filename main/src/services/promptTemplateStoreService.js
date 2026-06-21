const crypto = require('node:crypto')

const TEMPLATE_KEY = 'promptTemplates'

const defaultTemplates = [
  {
    id: 'title-default',
    name: '默认',
    category: '标题',
    prompt: '',
    source: 'system-fixed'
  },
  {
    id: 'title-temu',
    name: 'TEMU',
    category: '标题',
    prompt: '用于生成 TEMU 商品标题。请围绕商品主体，结合商品名称、关键词、平台、语言、样图信息和核心卖点输出专业电商标题。优先组织品类词、核心属性词、规格词、材质词、功能词和主要卖点，表达简洁直给、利于搜索与点击。不要使用极限词、绝对化表述、虚假承诺、医疗功效词、敏感违禁词或平台不允许的营销表达。',
    source: 'system-fixed'
  },
  {
    id: 'title-tk',
    name: 'TK',
    category: '标题',
    prompt: '用于生成 TK 电商场景下的商品标题。请围绕商品主体，结合商品名称、关键词、平台、语言、样图信息和使用场景输出高点击标题，突出视觉吸引点、核心属性、卖点和短视频商品卡搜索习惯。语言要短、快、准，避免违规功效词、过度夸张、低俗刺激、绝对化承诺和平台违禁词。',
    source: 'system-fixed'
  },
  {
    id: 'title-taobao',
    name: '淘宝',
    category: '标题',
    prompt: '用于生成淘宝商品标题。请围绕商品主体，结合商品名称、关键词、平台、语言、样图信息和卖点输出专业淘宝标题。优先覆盖高频搜索词、品类词、属性词、规格词和购买意图强的卖点词，符合中文用户搜索习惯。避免极限词、假承诺、引战用语、医疗相关违规词和平台违禁词。',
    source: 'system-fixed'
  },
  {
    id: 'title-tmall',
    name: '天猫',
    category: '标题',
    prompt: '用于生成天猫商品标题。请围绕商品主体，结合商品名称、关键词、平台、语言、样图信息和核心卖点输出标题，突出品牌感、品质感、核心参数、规格信息和搜索核心词。整体符合天猫平台搜索习惯，避免空泛形容、夸张承诺、违禁宣传和合规风险词。',
    source: 'system-fixed'
  },
  {
    id: 'title-jd',
    name: '京东',
    category: '标题',
    prompt: '用于生成京东商品标题。请围绕商品主体，结合商品名称、关键词、平台、语言、样图信息和卖点输出标题，优先突出品牌、型号、用途、核心功能、规格参数和高意图搜索词。整体适配京东搜索排序与商品转化，避免不实宣传、夸张承诺和平台限制词。',
    source: 'system-fixed'
  },
  {
    id: 'title-pdd',
    name: '拼多多',
    category: '标题',
    prompt: '用于生成拼多多商品标题。请围绕商品主体，结合商品名称、关键词、平台、语言、样图信息和核心卖点输出标题，强化高频搜索词、刚需卖点、规格属性和用户最在意的信息，表达直给、好懂、利于点击。避免低质夸张、绝对化表述、虚假承诺和平台违禁词。',
    source: 'system-fixed'
  },
  {
    id: 'title-douyin',
    name: '抖音',
    category: '标题',
    prompt: '用于生成抖音电商商品标题。请围绕商品主体，结合商品名称、关键词、平台、语言、样图信息和使用场景输出标题，突出首屏吸引力、核心利益点、关键属性和短平快的点击词。避免拖沓、违规功效词、虚假承诺、夸张对比和过度营销。',
    source: 'system-fixed'
  },
  {
    id: 'title-xiaohongshu',
    name: '小红书',
    category: '标题',
    prompt: '用于生成小红书电商场景下的商品标题。请围绕商品主体，结合商品名称、关键词、平台、语言、样图信息和生活方式场景输出标题，兼顾搜索关键词、场景化表达和自然种草感。避免硬广感、夸大承诺、违规功效词和平台违禁词。',
    source: 'system-fixed'
  },
  {
    id: 'title-ozon',
    name: 'OZON',
    category: '标题',
    prompt: '用于生成 OZON 平台商品标题。请围绕商品主体，结合商品名称、关键词、平台、语言、样图信息和关键卖点输出标题，输出语言与当前任务语言保持一致。优先覆盖可搜索的品类词、材质词、功能词、尺寸词、颜色词和核心卖点，避免夸张承诺、敏感表达和违规词。',
    source: 'system-fixed'
  },
  {
    id: 'title-amazon',
    name: 'Amazon',
    category: '标题',
    prompt: '用于生成 Amazon 平台商品标题。请围绕商品主体，结合商品名称、关键词、平台、语言、样图信息和核心卖点输出标题，输出语言与当前任务语言保持一致。优先覆盖买家搜索意图强的关键词、品类词、材质、规格、功能和核心属性，避免极限词、违规功效词、竞品比较、虚假承诺和风险表达。',
    source: 'system-fixed'
  },
  {
    id: 'title-aliexpress',
    name: 'AliExpress',
    category: '标题',
    prompt: '用于生成 AliExpress 平台商品标题。请围绕商品主体，结合商品名称、关键词、平台、语言、样图信息和核心卖点输出标题，输出语言与当前任务语言保持一致。优先组织搜索关键词、产品身份词、材质词、尺寸词、功能词和主要卖点，避免禁用词、极限词、夸张承诺和违规表述。',
    source: 'system-fixed'
  },
  {
    id: 'title-ebay',
    name: 'eBay',
    category: '标题',
    prompt: '用于生成 eBay 平台商品标题。请围绕商品主体，结合商品名称、关键词、平台、语言、样图信息和核心卖点输出标题，输出语言与当前任务语言保持一致。强调高意图搜索词、产品类型、关键特征、尺寸、材质和买家价值点，避免误导性说法、风险承诺和违规表达。',
    source: 'system-fixed'
  },
  {
    id: 'title-shopee',
    name: 'Shopee',
    category: '标题',
    prompt: '用于生成 Shopee 平台商品标题。请围绕商品主体，结合商品名称、关键词、平台、语言、样图信息和核心卖点输出标题，输出语言与当前任务语言保持一致。优先覆盖移动端友好的搜索词、核心属性、关键规格和强卖点，避免禁用词、夸张承诺和风险表达。',
    source: 'system-fixed'
  },
  {
    id: 'title-lazada',
    name: 'Lazada',
    category: '标题',
    prompt: '用于生成 Lazada 平台商品标题。请围绕商品主体，结合商品名称、关键词、平台、语言、样图信息和关键卖点输出标题，输出语言与当前任务语言保持一致。优先突出清晰关键词、产品属性、核心功能和关键规格，避免合规敏感说法和过度夸张。',
    source: 'system-fixed'
  },
  {
    id: 'title-walmart',
    name: 'Walmart',
    category: '标题',
    prompt: '用于生成 Walmart Marketplace 商品标题。请围绕商品主体，结合商品名称、关键词、平台、语言、样图信息和核心卖点输出标题，输出语言与当前任务语言保持一致。突出产品清晰度、核心属性、实用规格和高相关搜索词，避免夸张承诺、违规功效词和禁用表达。',
    source: 'system-fixed'
  },
  {
    id: 'description-default',
    name: '默认',
    category: '描述',
    prompt: '',
    source: 'system-fixed'
  },
  {
    id: 'description-temu',
    name: 'TEMU',
    category: '描述',
    prompt: '用于生成 TEMU 商品描述。请围绕商品主体，结合商品名称、关键词、平台、语言、样图信息和核心卖点输出专业电商描述。重点展开功能价值、材质细节、规格参数、适用场景、使用体验和购买理由，层次清晰，利于转化。整体风格要符合 TEMU 平台搜索和转化逻辑，不要使用极限词、绝对化表述、虚假承诺、医疗功效词、敏感违禁词或平台不允许的营销表达。',
    source: 'system-fixed'
  },
  {
    id: 'description-tk',
    name: 'TK',
    category: '描述',
    prompt: '用于生成 TK 电商场景下的商品描述。请围绕商品主体，结合商品名称、关键词、平台、语言、样图信息和使用场景输出描述，重点写清使用效果、场景代入、核心利益点、差异化卖点和下单理由，语言要短、快、准。整体表达适合短视频带货场景，避免违规功效词、过度夸张、低俗刺激、绝对化承诺和平台违禁词。',
    source: 'system-fixed'
  },
  {
    id: 'description-taobao',
    name: '淘宝',
    category: '描述',
    prompt: '用于生成淘宝商品描述。请围绕商品主体，结合商品名称、关键词、平台、语言、样图信息和卖点输出专业淘宝电商描述。重点说明卖点、材质、规格、使用方式、适用场景和用户收益，表达清楚、自然、能促进下单。避免极限词、假承诺、引战用语、医疗相关违规词和平台违禁词。',
    source: 'system-fixed'
  },
  {
    id: 'description-tmall',
    name: '天猫',
    category: '描述',
    prompt: '用于生成天猫商品描述。请围绕商品主体，结合商品名称、关键词、平台、语言、样图信息和核心卖点输出描述，重点强化品质、材质、功能亮点、适用场景和真实购买理由，表达更规范、更有品牌感。整体符合天猫平台搜索与详情表达习惯，避免空泛形容、夸张承诺、违禁宣传和合规风险词。',
    source: 'system-fixed'
  },
  {
    id: 'description-jd',
    name: '京东',
    category: '描述',
    prompt: '用于生成京东商品描述。请围绕商品主体，结合商品名称、关键词、平台、语言、样图信息和卖点输出描述，重点说明功能价值、材质品质、参数细节、适用人群和购买理由，表达清晰利落。整体适配京东搜索排序与商品转化，避免不实宣传、夸张承诺和平台限制词。',
    source: 'system-fixed'
  },
  {
    id: 'description-pdd',
    name: '拼多多',
    category: '描述',
    prompt: '用于生成拼多多商品描述。请围绕商品主体，结合商品名称、关键词、平台、语言、样图信息和核心卖点输出描述，重点突出实用价值、适用场景、核心功能、规格信息和购买收益。整体要兼顾转化效率与平台合规，避免低质夸张、绝对化表述、虚假承诺和平台违禁词。',
    source: 'system-fixed'
  },
  {
    id: 'description-douyin',
    name: '抖音',
    category: '描述',
    prompt: '用于生成抖音电商商品描述。请围绕商品主体，结合商品名称、关键词、平台、语言、样图信息和使用场景输出描述，重点写清使用场景、真实效果、卖点亮点和冲动下单理由。语言要短、快、准，避免拖沓、违规功效词、虚假承诺、夸张对比和过度营销。',
    source: 'system-fixed'
  },
  {
    id: 'description-xiaohongshu',
    name: '小红书',
    category: '描述',
    prompt: '用于生成小红书电商场景下的商品描述。请围绕商品主体，结合商品名称、关键词、平台、语言、样图信息和生活方式场景输出描述，重点突出真实体验、使用场景、质感细节、功能亮点和适配人群。整体风格要自然、有生活感、有分享感，避免硬广感、夸大承诺、违规功效词和平台违禁词。',
    source: 'system-fixed'
  },
  {
    id: 'description-ozon',
    name: 'OZON',
    category: '描述',
    prompt: '用于生成 OZON 平台商品描述。请围绕商品主体，结合商品名称、关键词、平台、语言、样图信息和关键卖点输出描述，输出语言与当前任务语言保持一致。重点写清产品用途、功能亮点、规格参数、材质细节、使用场景和购买价值。整体表达要符合 OZON 平台搜索习惯与合规要求，避免夸张承诺、敏感表达和违规词。',
    source: 'system-fixed'
  },
  {
    id: 'description-amazon',
    name: 'Amazon',
    category: '描述',
    prompt: '用于生成 Amazon 平台商品描述。请围绕商品主体，结合商品名称、关键词、平台、语言、样图信息和核心卖点输出描述，输出语言与当前任务语言保持一致。重点说明主要功能、使用场景、材质细节、规格参数、适用人群和真实购买价值。整体要符合 Amazon 平台规范，避免极限词、违规功效词、竞品比较、虚假承诺和风险表达。',
    source: 'system-fixed'
  },
  {
    id: 'description-aliexpress',
    name: 'AliExpress',
    category: '描述',
    prompt: '用于生成 AliExpress 平台商品描述。请围绕商品主体，结合商品名称、关键词、平台、语言、样图信息和核心卖点输出描述，输出语言与当前任务语言保持一致。重点写清实用价值、使用场景、规格信息、材质细节和目标买点。整体表达要清晰、利于转化，并避免禁用词、极限词、夸张承诺和违规表述。',
    source: 'system-fixed'
  },
  {
    id: 'description-ebay',
    name: 'eBay',
    category: '描述',
    prompt: '用于生成 eBay 平台商品描述。请围绕商品主体，结合商品名称、关键词、平台、语言、样图信息和核心卖点输出描述，输出语言与当前任务语言保持一致。重点说明功能亮点、规格、使用方式、材质、适用场景和购买理由。整体表达要清晰、可信、合规，避免误导性说法、风险承诺和违规表达。',
    source: 'system-fixed'
  },
  {
    id: 'description-shopee',
    name: 'Shopee',
    category: '描述',
    prompt: '用于生成 Shopee 平台商品描述。请围绕商品主体，结合商品名称、关键词、平台、语言、样图信息和核心卖点输出描述，输出语言与当前任务语言保持一致。重点说明日常使用价值、场景、规格参数、材质和购买收益。整体语言要直接、易读、符合平台规则，避免禁用词、夸张承诺和风险表达。',
    source: 'system-fixed'
  },
  {
    id: 'description-lazada',
    name: 'Lazada',
    category: '描述',
    prompt: '用于生成 Lazada 平台商品描述。请围绕商品主体，结合商品名称、关键词、平台、语言、样图信息和关键卖点输出描述，输出语言与当前任务语言保持一致。重点展开功能亮点、材质、场景、细节和转化价值点。整体表达要清楚、可信、利于转化，避免合规敏感说法和过度夸张。',
    source: 'system-fixed'
  },
  {
    id: 'description-walmart',
    name: 'Walmart',
    category: '描述',
    prompt: '用于生成 Walmart Marketplace 商品描述。请围绕商品主体，结合商品名称、关键词、平台、语言、样图信息和核心卖点输出描述，输出语言与当前任务语言保持一致。重点说明功能亮点、实用价值、规格参数、使用场景和买家收益。整体要保持事实化、合规、可读，避免夸张承诺、违规功效词和禁用表达。',
    source: 'system-fixed'
  },
  {
    id: 'image-default',
    name: '默认',
    category: '图片',
    prompt: '',
    source: 'system-fixed'
  },
  {
    id: 'image-main',
    name: '主图',
    category: '图片',
    prompt: '用于生成电商主图。请保持商品主体不变，完整、清晰、居中，突出第一眼吸引力、核心卖点和封面效果。整体构图干净，光线高级，质感真实，适合作为商品首图或首页封面。不要加入杂乱文字、水印、无关道具、额外商品或会干扰主体的信息。',
    source: 'system-fixed'
  },
  {
    id: 'image-white-bg',
    name: '白底图',
    category: '图片',
    prompt: '用于生成白底图。请保持商品主体不变，使用纯白背景，边缘干净，颜色准确，质感真实，适合平台主图、抠图和标准白底展示。不要加入场景道具、复杂投影、夸张反光、多余元素，也不要改变商品结构和款式。',
    source: 'system-fixed'
  },
  {
    id: 'image-detail',
    name: '详情图',
    category: '图片',
    prompt: '用于生成详情图。请保持商品主体不变，围绕功能、结构、卖点信息、使用方式或产品亮点组织画面，适合详情页连续展示。每张图都要清楚表达一个重点，不要只做空泛海报感，也不要弱化商品主体。',
    source: 'system-fixed'
  },
  {
    id: 'image-closeup',
    name: '细节图',
    category: '图片',
    prompt: '用于生成细节图。请保持商品主体不变，重点聚焦材质、纹理、做工、接口、边角、缝线或关键局部，镜头更近，细节更真实，让买家能看清品质感和工艺感。',
    source: 'system-fixed'
  },
  {
    id: 'image-size',
    name: '尺寸图',
    category: '图片',
    prompt: '用于生成尺寸图。请保持商品主体不变，清晰展示长宽高、结构比例或关键规格信息，适合详情页参数说明。必须使用真实尺寸数据；如果用户没有提供真实数据，请预留清晰标注位置，不要编造尺寸。整体画面要整洁、易读、规范。',
    source: 'system-fixed'
  },
  {
    id: 'image-color',
    name: '颜色图',
    category: '图片',
    prompt: '用于生成颜色图。请保持商品结构、材质、款式和展示角度尽量一致，只替换或扩展不同颜色版本，方便做颜色对比展示。不要改变商品造型，不要改变主体设计，也不要引入无关元素。',
    source: 'system-fixed'
  },
  {
    id: 'image-scene',
    name: '场景图',
    category: '图片',
    prompt: '用于生成场景图。请保持商品主体不变，只替换或优化背景场景与使用环境，让画面更贴近真实使用状态，增强代入感和生活化氛围。场景必须服务商品，不要喧宾夺主，不要让背景抢走主体注意力。',
    source: 'system-fixed'
  },
  {
    id: 'image-model',
    name: '模特图',
    category: '图片',
    prompt: '用于生成模特图。适用于原图没有模特的商品。请在保持商品主体不变的前提下补入自然真实的模特展示，突出上身效果、比例关系和实际穿戴或使用状态。模特气质、姿态、光线和商品风格要协调，重点仍然是服务商品展示。',
    source: 'system-fixed'
  },
  {
    id: 'image-angle',
    name: '换角度',
    category: '图片',
    prompt: '用于生成换角度图片。请保持商品主体不变，只调整拍摄机位和展示角度，可以是小幅度微调，也可以是更明显的视角变化，但不能改变商品本身结构、款式、比例和核心特征。',
    source: 'system-fixed'
  },
  {
    id: 'image-change-scene',
    name: '换场景',
    category: '图片',
    prompt: '用于生成换场景图片。请保持商品主体不变，只替换背景环境、布景或空间氛围，使商品更适配电商展示或目标人群使用环境。新场景要自然、协调、真实，不要削弱主体，不要影响商品识别度。',
    source: 'system-fixed'
  },
  {
    id: 'image-change-model',
    name: '换模特',
    category: '图片',
    prompt: '用于生成换模特图片。适用于原图已有模特的商品。请在保持商品主体不变的前提下替换成新的模特，注意姿态、比例、肤色、光线、穿搭和商品风格协调性，重点仍然服务商品展示，不要让模特压过商品本身。',
    source: 'system-fixed'
  },
  {
    id: 'image-replace-all',
    name: '全替换',
    category: '图片',
    prompt: '用于生成全替换效果图。请在保持商品主体不变的前提下，同时替换拍摄角度、背景场景和模特展示；如果原图没有模特，则不要强行添加模特。整体目标是生成一张全新的电商展示图，但商品本身的结构、款式、核心特征和识别度必须保持稳定。',
    source: 'system-fixed'
  },
  {
    id: 'video-main',
    name: '主图视频',
    category: '视频',
    prompt: '用于生成主图视频。请围绕商品主体输出适合电商首屏的视频内容，首屏快速展示外观、核心卖点和使用效果，让买家在几秒内看懂产品亮点。镜头稳定，节奏直接，画面干净，突出商品主体，不要加入无关剧情或喧宾夺主的元素。',
    source: 'system-fixed'
  },
  {
    id: 'video-detail',
    name: '细节视频',
    category: '视频',
    prompt: '用于生成细节视频。请重点展示材质、做工、配件、尺寸、接口或关键结构，用更近的镜头、更稳定的节奏和更清晰的细节表达强化质感判断，帮助用户消除对品质和细节的顾虑。',
    source: 'system-fixed'
  },
  {
    id: 'video-compare',
    name: '对比视频',
    category: '视频',
    prompt: '用于生成对比视频。请突出自家产品与低质竞品的差异，或展示使用前后变化，重点强调结果差异、核心卖点和购买价值。画面表达要直观、有说服力，但不要涉及违规攻击、虚假对比或不实承诺。',
    source: 'system-fixed'
  },
  {
    id: 'video-scene',
    name: '场景视频',
    category: '视频',
    prompt: '用于生成场景视频。请展示家居摆放、穿搭上身、户外实测或真实使用场景，让买家快速理解产品在真实环境中的表现、用途和适配人群。场景要真实自然，商品主体始终清楚可见，镜头节奏便于电商展示和转化。',
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

function resolveLegacyTextCategoryIds(templateId = '') {
  const normalizedId = String(templateId || '').trim()
  if (!normalizedId.startsWith('text-')) {
    return null
  }

  const suffix = normalizedId.slice('text-'.length).trim()
  if (!suffix) {
    return null
  }

  return {
    titleId: `title-${suffix}`,
    descriptionId: `description-${suffix}`
  }
}

function migrateLegacyTextTemplateItem(template = {}) {
  const normalized = normalizeTemplateItem(template)

  if (normalized.category !== '文本') {
    return [normalized]
  }

  const legacyIds = resolveLegacyTextCategoryIds(normalized.id)
  const titleId = legacyIds?.titleId || ''
  const descriptionId = legacyIds?.descriptionId || ''

  if (normalized.source === 'system-fixed' && titleId && descriptionId) {
    return [
      {
        ...normalized,
        id: titleId,
        category: '标题'
      },
      {
        ...normalized,
        id: descriptionId,
        category: '描述'
      }
    ]
  }

  if (normalized.source === 'custom') {
    return [
      {
        ...normalized,
        id: normalized.id ? `${normalized.id}-title` : '',
        category: '标题'
      },
      {
        ...normalized,
        id: normalized.id ? `${normalized.id}-description` : '',
        category: '描述'
      }
    ]
  }

  return [normalized]
}

function mergeTemplates(templates = []) {
  const normalizedIncoming = Array.isArray(templates)
    ? templates.flatMap(migrateLegacyTextTemplateItem)
    : []
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
