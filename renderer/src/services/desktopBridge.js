const API_KEY_SLOT_COUNT = 2
const BROWSER_SETTINGS_KEY = 'qiuai-browser-settings'
const BROWSER_STUDIO_KEY = 'qiuai-browser-studio'
const BROWSER_PROMPTS_KEY = 'qiuai-browser-prompts'
const BROWSER_CREDIT_HISTORY_LIMIT = 20

const defaultBrowserCreditState = {
  totalPurchasedCredits: 0,
  remainingCredits: 0,
  frozenCredits: 0,
  usedCredits: 0,
  lastAdjustmentAt: '',
  lastAdjustmentOperation: '',
  lastAdjustmentAmount: 0,
  adjustmentHistory: [],
  activityHistory: [],
  taskLedger: {}
}

const defaultBrowserDashboardCreditState = {
  text: {
    balanceCny: 0,
    lastSyncedAt: '',
    syncStatus: 'idle'
  },
  image: {
    totalCredits: 0,
    remainingCredits: 0,
    lastSyncedAt: '',
    syncStatus: 'idle'
  },
  video: {
    balanceCny: 0,
    lastSyncedAt: '',
    syncStatus: 'idle'
  }
}

const defaultBrowserSettings = {
  apiBaseUrl: 'https://grsai.dakka.com.cn',
  apiKeys: ['', ''],
  activeApiKeyIndex: 0,
  apiKey: '',
  providerApiKeys: {
    general: '',
    deepseek: '',
    minimax: ''
  },
  defaultSize: '1:1',
  downloadDirectory: '',
  globalUploadDirectory: '',
  uploadDirectories: {
    workspace: '',
    'series-generate': ''
  },
  themeMode: 'dark',
  downloadCleanupEnabled: true,
  dashboardCreditState: defaultBrowserDashboardCreditState,
  creditState: defaultBrowserCreditState
}

const defaultBrowserStudioSnapshot = {
  themeMode: 'dark',
  formDrafts: {},
  resultsByMenu: {},
  exportItemsByMenu: {},
  tasks: [],
  workspaceDashboard: {},
  hostInfo: {},
  settingsSummary: {
    apiKeys: ['', ''],
    activeApiKeyIndex: 0,
    dashboardCreditState: defaultBrowserDashboardCreditState,
    creditState: defaultBrowserCreditState
  }
}

const defaultBrowserActivationState = {
  status: 'activated',
  mode: 'browser-demo',
  authType: 'browser-demo',
  canUseApp: true,
  customerName: '浏览器模式',
  userId: '',
  licenseId: '',
  inviteCode: '',
  deviceCode: 'QAI-BROWSER-MODE',
  activatedAt: '',
  expiresAt: '',
  message: '',
  nextAction: 'enter-app',
  legacyImportSupported: false,
  legacyStatus: 'activated'
}

const defaultBrowserPromptTemplates = [
  { id: 'text-default', name: '默认', category: '文本', prompt: '', source: 'system-fixed' },
  { id: 'text-temu', name: 'TEMU', category: '文本', prompt: '用于生成 TEMU 商品标题或商品描述。请围绕商品主体，结合商品名称、关键词、平台、语言、样图信息和核心卖点输出专业电商文案。若当前任务是标题，优先组织品类词、核心属性词、规格词、材质词、功能词和主要卖点，表达简洁直给、利于搜索；若当前任务是描述，重点展开功能价值、材质细节、规格参数、适用场景、使用体验和购买理由，层次清晰，利于转化。整体风格要符合 TEMU 平台搜索和转化逻辑，不要使用极限词、绝对化表述、虚假承诺、医疗功效词、敏感违禁词或平台不允许的营销表达。', source: 'system-fixed' },
  { id: 'text-tk', name: 'TK', category: '文本', prompt: '用于生成 TK 电商场景下的商品标题或商品描述。请围绕商品主体，结合商品名称、关键词、平台、语言、样图信息和使用场景输出文案。若当前任务是标题，突出高点击关键词、视觉吸引点、核心属性、卖点和短视频商品卡搜索习惯；若当前任务是描述，重点写清使用效果、场景代入、核心利益点、差异化卖点和下单理由，语言要短、快、准。整体表达适合短视频带货场景，避免违规功效词、过度夸张、低俗刺激、绝对化承诺和平台违禁词。', source: 'system-fixed' },
  { id: 'text-taobao', name: '淘宝', category: '文本', prompt: '用于生成淘宝商品标题或商品描述。请围绕商品主体，结合商品名称、关键词、平台、语言、样图信息和卖点输出专业淘宝电商文案。若当前任务是标题，优先覆盖高频搜索词、品类词、属性词、规格词和购买意图强的卖点词，符合中文用户搜索习惯；若当前任务是描述，重点说明卖点、材质、规格、使用方式、适用场景和用户收益，表达清楚、自然、能促进下单。避免极限词、假承诺、引战用语、医疗相关违规词和平台违禁词。', source: 'system-fixed' },
  { id: 'text-tmall', name: '天猫', category: '文本', prompt: '用于生成天猫商品标题或商品描述。请围绕商品主体，结合商品名称、关键词、平台、语言、样图信息和核心卖点输出文案。若当前任务是标题，突出品牌感、品质感、核心参数、规格信息和搜索核心词；若当前任务是描述，重点强化品质、材质、功能亮点、适用场景和真实购买理由，表达更规范、更有品牌感。整体符合天猫平台搜索与详情表达习惯，避免空泛形容、夸张承诺、违禁宣传和合规风险词。', source: 'system-fixed' },
  { id: 'text-jd', name: '京东', category: '文本', prompt: '用于生成京东商品标题或商品描述。请围绕商品主体，结合商品名称、关键词、平台、语言、样图信息和卖点输出文案。若当前任务是标题，优先突出品牌、型号、用途、核心功能、规格参数和高意图搜索词；若当前任务是描述，重点说明功能价值、材质品质、参数细节、适用人群和购买理由，表达清晰利落。整体适配京东搜索排序与商品转化，避免不实宣传、夸张承诺和平台限制词。', source: 'system-fixed' },
  { id: 'text-pdd', name: '拼多多', category: '文本', prompt: '用于生成拼多多商品标题或商品描述。请围绕商品主体，结合商品名称、关键词、平台、语言、样图信息和核心卖点输出文案。若当前任务是标题，强化高频搜索词、刚需卖点、规格属性和用户最在意的信息，表达直给、好懂、利于点击；若当前任务是描述，重点突出实用价值、适用场景、核心功能、规格信息和购买收益。整体要兼顾转化效率与平台合规，避免低质夸张、绝对化表述、虚假承诺和平台违禁词。', source: 'system-fixed' },
  { id: 'text-douyin', name: '抖音', category: '文本', prompt: '用于生成抖音电商商品标题或商品描述。请围绕商品主体，结合商品名称、关键词、平台、语言、样图信息和使用场景输出文案。若当前任务是标题，突出首屏吸引力、核心利益点、关键属性和短平快的点击词；若当前任务是描述，重点写清使用场景、真实效果、卖点亮点和冲动下单理由。语言要短、快、准，避免拖沓、违规功效词、虚假承诺、夸张对比和过度营销。', source: 'system-fixed' },
  { id: 'text-xiaohongshu', name: '小红书', category: '文本', prompt: '用于生成小红书电商场景下的商品标题或商品描述。请围绕商品主体，结合商品名称、关键词、平台、语言、样图信息和生活方式场景输出文案。若当前任务是标题，兼顾搜索关键词、场景化表达和自然种草感；若当前任务是描述，重点突出真实体验、使用场景、质感细节、功能亮点和适配人群。整体风格要自然、有生活感、有分享感，避免硬广感、夸大承诺、违规功效词和平台违禁词。', source: 'system-fixed' },
  { id: 'text-ozon', name: 'OZON', category: '文本', prompt: '用于生成 OZON 平台商品标题或商品描述。请围绕商品主体，结合商品名称、关键词、平台、语言、样图信息和关键卖点输出文案，输出语言与当前任务语言保持一致。若当前任务是标题，优先覆盖可搜索的品类词、材质词、功能词、尺寸词、颜色词和核心卖点；若当前任务是描述，重点写清产品用途、功能亮点、规格参数、材质细节、使用场景和购买价值。整体表达要符合 OZON 平台搜索习惯与合规要求，避免夸张承诺、敏感表达和违规词。', source: 'system-fixed' },
  { id: 'text-amazon', name: 'Amazon', category: '文本', prompt: '用于生成 Amazon 平台商品标题或商品描述。请围绕商品主体，结合商品名称、关键词、平台、语言、样图信息和核心卖点输出文案，输出语言与当前任务语言保持一致。若当前任务是标题，优先覆盖买家搜索意图强的关键词、品类词、材质、规格、功能和核心属性；若当前任务是描述，重点说明主要功能、使用场景、材质细节、规格参数、适用人群和真实购买价值。整体要符合 Amazon 平台规范，避免极限词、违规功效词、竞品比较、虚假承诺和风险表达。', source: 'system-fixed' },
  { id: 'text-aliexpress', name: 'AliExpress', category: '文本', prompt: '用于生成 AliExpress 平台商品标题或商品描述。请围绕商品主体，结合商品名称、关键词、平台、语言、样图信息和核心卖点输出文案，输出语言与当前任务语言保持一致。若当前任务是标题，优先组织搜索关键词、产品身份词、材质词、尺寸词、功能词和主要卖点；若当前任务是描述，重点写清实用价值、使用场景、规格信息、材质细节和目标买点。整体表达要清晰、利于转化，并避免禁用词、极限词、夸张承诺和违规表述。', source: 'system-fixed' },
  { id: 'text-ebay', name: 'eBay', category: '文本', prompt: '用于生成 eBay 平台商品标题或商品描述。请围绕商品主体，结合商品名称、关键词、平台、语言、样图信息和核心卖点输出文案，输出语言与当前任务语言保持一致。若当前任务是标题，强调高意图搜索词、产品类型、关键特征、尺寸、材质和买家价值点；若当前任务是描述，重点说明功能亮点、规格、使用方式、材质、适用场景和购买理由。整体表达要清晰、可信、合规，避免误导性说法、风险承诺和违规表达。', source: 'system-fixed' },
  { id: 'text-shopee', name: 'Shopee', category: '文本', prompt: '用于生成 Shopee 平台商品标题或商品描述。请围绕商品主体，结合商品名称、关键词、平台、语言、样图信息和核心卖点输出文案，输出语言与当前任务语言保持一致。若当前任务是标题，优先覆盖移动端友好的搜索词、核心属性、关键规格和强卖点；若当前任务是描述，重点说明日常使用价值、场景、规格参数、材质和购买收益。整体语言要直接、易读、符合平台规则，避免禁用词、夸张承诺和风险表达。', source: 'system-fixed' },
  { id: 'text-lazada', name: 'Lazada', category: '文本', prompt: '用于生成 Lazada 平台商品标题或商品描述。请围绕商品主体，结合商品名称、关键词、平台、语言、样图信息和关键卖点输出文案，输出语言与当前任务语言保持一致。若当前任务是标题，优先突出清晰关键词、产品属性、核心功能和关键规格；若当前任务是描述，重点展开功能亮点、材质、场景、细节和转化价值点。整体表达要清楚、可信、利于转化，避免合规敏感说法和过度夸张。', source: 'system-fixed' },
  { id: 'text-walmart', name: 'Walmart', category: '文本', prompt: '用于生成 Walmart Marketplace 商品标题或商品描述。请围绕商品主体，结合商品名称、关键词、平台、语言、样图信息和核心卖点输出文案，输出语言与当前任务语言保持一致。若当前任务是标题，突出产品清晰度、核心属性、实用规格和高相关搜索词；若当前任务是描述，重点说明功能亮点、实用价值、规格参数、使用场景和买家收益。整体要保持事实化、合规、可读，避免夸张承诺、违规功效词和禁用表达。', source: 'system-fixed' },
  { id: 'image-default', name: '默认', category: '图片', prompt: '', source: 'system-fixed' },
  { id: 'image-main', name: '主图', category: '图片', prompt: '用于生成电商主图。请保持商品主体不变，完整、清晰、居中，突出第一眼吸引力、核心卖点和封面效果。整体构图干净，光线高级，质感真实，适合作为商品首图或首页封面。不要加入杂乱文字、水印、无关道具、额外商品或会干扰主体的信息。', source: 'system-fixed' },
  { id: 'image-white-bg', name: '白底图', category: '图片', prompt: '用于生成白底图。请保持商品主体不变，使用纯白背景，边缘干净，颜色准确，质感真实，适合平台主图、抠图和标准白底展示。不要加入场景道具、复杂投影、夸张反光、多余元素，也不要改变商品结构和款式。', source: 'system-fixed' },
  { id: 'image-detail', name: '详情图', category: '图片', prompt: '用于生成详情图。请保持商品主体不变，围绕功能、结构、卖点信息、使用方式或产品亮点组织画面，适合详情页连续展示。每张图都要清楚表达一个重点，不要只做空泛海报感，也不要弱化商品主体。', source: 'system-fixed' },
  { id: 'image-closeup', name: '细节图', category: '图片', prompt: '用于生成细节图。请保持商品主体不变，重点聚焦材质、纹理、做工、接口、边角、缝线或关键局部，镜头更近，细节更真实，让买家能看清品质感和工艺感。', source: 'system-fixed' },
  { id: 'image-size', name: '尺寸图', category: '图片', prompt: '用于生成尺寸图。请保持商品主体不变，清晰展示长宽高、结构比例或关键规格信息，适合详情页参数说明。必须使用真实尺寸数据；如果用户没有提供真实数据，请预留清晰标注位置，不要编造尺寸。整体画面要整洁、易读、规范。', source: 'system-fixed' },
  { id: 'image-color', name: '颜色图', category: '图片', prompt: '用于生成颜色图。请保持商品结构、材质、款式和展示角度尽量一致，只替换或扩展不同颜色版本，方便做颜色对比展示。不要改变商品造型，不要改变主体设计，也不要引入无关元素。', source: 'system-fixed' },
  { id: 'image-scene', name: '场景图', category: '图片', prompt: '用于生成场景图。请保持商品主体不变，只替换或优化背景场景与使用环境，让画面更贴近真实使用状态，增强代入感和生活化氛围。场景必须服务商品，不要喧宾夺主，不要让背景抢走主体注意力。', source: 'system-fixed' },
  { id: 'image-model', name: '模特图', category: '图片', prompt: '用于生成模特图。适用于原图没有模特的商品。请在保持商品主体不变的前提下补入自然真实的模特展示，突出上身效果、比例关系和实际穿戴或使用状态。模特气质、姿态、光线和商品风格要协调，重点仍然是服务商品展示。', source: 'system-fixed' },
  { id: 'image-angle', name: '换角度', category: '图片', prompt: '用于生成换角度图片。请保持商品主体不变，只调整拍摄机位和展示角度，可以是小幅度微调，也可以是更明显的视角变化，但不能改变商品本身结构、款式、比例和核心特征。', source: 'system-fixed' },
  { id: 'image-change-scene', name: '换场景', category: '图片', prompt: '用于生成换场景图片。请保持商品主体不变，只替换背景环境、布景或空间氛围，使商品更适配电商展示或目标人群使用环境。新场景要自然、协调、真实，不要削弱主体，不要影响商品识别度。', source: 'system-fixed' },
  { id: 'image-change-model', name: '换模特', category: '图片', prompt: '用于生成换模特图片。适用于原图已有模特的商品。请在保持商品主体不变的前提下替换成新的模特，注意姿态、比例、肤色、光线、穿搭和商品风格协调性，重点仍然服务商品展示，不要让模特压过商品本身。', source: 'system-fixed' },
  { id: 'image-replace-all', name: '全替换', category: '图片', prompt: '用于生成全替换效果图。请在保持商品主体不变的前提下，同时替换拍摄角度、背景场景和模特展示；如果原图没有模特，则不要强行添加模特。整体目标是生成一张全新的电商展示图，但商品本身的结构、款式、核心特征和识别度必须保持稳定。', source: 'system-fixed' },
  { id: 'video-main', name: '主图视频', category: '视频', prompt: '用于生成主图视频。请围绕商品主体输出适合电商首屏的视频内容，首屏快速展示外观、核心卖点和使用效果，让买家在几秒内看懂产品亮点。镜头稳定，节奏直接，画面干净，突出商品主体，不要加入无关剧情或喧宾夺主的元素。', source: 'system-fixed' },
  { id: 'video-detail', name: '细节视频', category: '视频', prompt: '用于生成细节视频。请重点展示材质、做工、配件、尺寸、接口或关键结构，用更近的镜头、更稳定的节奏和更清晰的细节表达强化质感判断，帮助用户消除对品质和细节的顾虑。', source: 'system-fixed' },
  { id: 'video-compare', name: '对比视频', category: '视频', prompt: '用于生成对比视频。请突出自家产品与低质竞品的差异，或展示使用前后变化，重点强调结果差异、核心卖点和购买价值。画面表达要直观、有说服力，但不要涉及违规攻击、虚假对比或不实承诺。', source: 'system-fixed' },
  { id: 'video-scene', name: '场景视频', category: '视频', prompt: '用于生成场景视频。请展示家居摆放、穿搭上身、户外实测或真实使用场景，让买家快速理解产品在真实环境中的表现、用途和适配人群。场景要真实自然，商品主体始终清楚可见，镜头节奏便于电商展示和转化。', source: 'system-fixed' }
]

function getBridge () {
  return window.qiuai
}

function hasBridge () {
  const bridge = getBridge()
  return !!(bridge && bridge.channels && typeof bridge.invoke === 'function')
}

function getLocalStorage () {
  if (typeof window === 'undefined' || !window.localStorage) {
    return null
  }

  return window.localStorage
}

function readBrowserState (storageKey, fallbackValue) {
  const storage = getLocalStorage()
  if (!storage) {
    return fallbackValue
  }

  try {
    const rawValue = storage.getItem(storageKey)
    return rawValue ? JSON.parse(rawValue) : fallbackValue
  } catch {
    return fallbackValue
  }
}

function writeBrowserState (storageKey, value) {
  const storage = getLocalStorage()
  if (!storage) {
    return value
  }

  storage.setItem(storageKey, JSON.stringify(value))
  return value
}

function normalizeForIpc (value) {
  if (value === undefined) {
    return undefined
  }

  return JSON.parse(JSON.stringify(value))
}

function normalizeApiKeys (apiKeys = []) {
  return Array.from({ length: API_KEY_SLOT_COUNT }, (_unused, index) => {
    return typeof apiKeys[index] === 'string' ? apiKeys[index] : ''
  })
}

function normalizeActiveApiKeyIndex (activeApiKeyIndex = 0) {
  const numericIndex = Number(activeApiKeyIndex)

  if (!Number.isInteger(numericIndex) || numericIndex < 0 || numericIndex >= API_KEY_SLOT_COUNT) {
    return 0
  }

  return numericIndex
}

function normalizeThemeMode () {
  return 'dark'
}

function normalizeDownloadCleanupEnabled (downloadCleanupEnabled = true) {
  return downloadCleanupEnabled !== false
}

function normalizeUploadDirectories (uploadDirectories = {}) {
  const source = uploadDirectories && typeof uploadDirectories === 'object' ? uploadDirectories : {}

  return {
    workspace: typeof source.workspace === 'string' ? source.workspace : '',
    'series-generate': typeof source['series-generate'] === 'string' ? source['series-generate'] : ''
  }
}

function normalizeGlobalUploadDirectory (globalUploadDirectory = '') {
  return typeof globalUploadDirectory === 'string' ? globalUploadDirectory : ''
}

function normalizeProviderApiKeys (providerApiKeys = {}, fallbackApiKey = '') {
  const source = providerApiKeys && typeof providerApiKeys === 'object' ? providerApiKeys : {}
  const normalizedFallbackApiKey = typeof fallbackApiKey === 'string' ? fallbackApiKey.trim() : ''

  return {
    general: typeof source.general === 'string' ? source.general.trim() : normalizedFallbackApiKey,
    deepseek: typeof source.deepseek === 'string' ? source.deepseek.trim() : '',
    minimax: typeof source.minimax === 'string' ? source.minimax.trim() : ''
  }
}

function normalizeNonNegativeInteger (value = 0) {
  const numericValue = Number(value)

  if (!Number.isFinite(numericValue) || numericValue < 0) {
    return 0
  }

  return Math.round(numericValue)
}

function normalizeBrowserCreditState (rawCreditState = {}) {
  const source = rawCreditState && typeof rawCreditState === 'object' ? rawCreditState : {}

  return {
    totalPurchasedCredits: normalizeNonNegativeInteger(source.totalPurchasedCredits),
    remainingCredits: normalizeNonNegativeInteger(source.remainingCredits),
    frozenCredits: normalizeNonNegativeInteger(source.frozenCredits),
    usedCredits: normalizeNonNegativeInteger(source.usedCredits),
    lastAdjustmentAt: typeof source.lastAdjustmentAt === 'string' ? source.lastAdjustmentAt : '',
    lastAdjustmentOperation: typeof source.lastAdjustmentOperation === 'string' ? source.lastAdjustmentOperation : '',
    lastAdjustmentAmount: normalizeNonNegativeInteger(source.lastAdjustmentAmount),
    adjustmentHistory: Array.isArray(source.adjustmentHistory)
      ? source.adjustmentHistory.slice(0, BROWSER_CREDIT_HISTORY_LIMIT)
      : [],
    activityHistory: Array.isArray(source.activityHistory)
      ? source.activityHistory.slice(0, BROWSER_CREDIT_HISTORY_LIMIT)
      : [],
    taskLedger: source.taskLedger && typeof source.taskLedger === 'object' ? { ...source.taskLedger } : {}
  }
}

function normalizeBrowserDashboardCreditState (rawDashboardCreditState = {}) {
  const source = rawDashboardCreditState && typeof rawDashboardCreditState === 'object' ? rawDashboardCreditState : {}

  if (
    Object.prototype.hasOwnProperty.call(source, 'totalCredits') ||
    Object.prototype.hasOwnProperty.call(source, 'remainingCredits')
  ) {
    return {
      text: {
        balanceCny: 0,
        lastSyncedAt: '',
        syncStatus: 'idle'
      },
      image: {
        totalCredits: normalizeNonNegativeInteger(source.totalCredits),
        remainingCredits: normalizeNonNegativeInteger(source.remainingCredits),
        lastSyncedAt: '',
        syncStatus: 'success'
      },
      video: {
        balanceCny: 0,
        lastSyncedAt: '',
        syncStatus: 'idle'
      }
    }
  }

  return {
    text: {
      balanceCny: Math.max(0, Number(source.text?.balanceCny) || 0),
      lastSyncedAt: typeof source.text?.lastSyncedAt === 'string' ? source.text.lastSyncedAt : '',
      syncStatus: typeof source.text?.syncStatus === 'string' ? source.text.syncStatus : 'idle'
    },
    image: {
      totalCredits: normalizeNonNegativeInteger(source.image?.totalCredits),
      remainingCredits: normalizeNonNegativeInteger(source.image?.remainingCredits),
      lastSyncedAt: typeof source.image?.lastSyncedAt === 'string' ? source.image.lastSyncedAt : '',
      syncStatus: typeof source.image?.syncStatus === 'string' ? source.image.syncStatus : 'idle'
    },
    video: {
      balanceCny: Math.max(0, Number(source.video?.balanceCny) || 0),
      lastSyncedAt: typeof source.video?.lastSyncedAt === 'string' ? source.video.lastSyncedAt : '',
      syncStatus: typeof source.video?.syncStatus === 'string' ? source.video.syncStatus : 'idle'
    }
  }
}

function applyBrowserCreditAdjustment (creditState, adjustment = {}) {
  const normalizedCreditState = normalizeBrowserCreditState(creditState)
  const amount = normalizeNonNegativeInteger(adjustment.amount)

  if (!amount) {
    return normalizedCreditState
  }

  const operation = adjustment.operation === 'decrease' ? 'decrease' : 'increase'
  if (operation === 'decrease' && normalizedCreditState.remainingCredits < amount) {
    throw new Error('可用积分不足，无法扣减')
  }

  const createdAt = new Date().toISOString()

  return normalizeBrowserCreditState({
    ...normalizedCreditState,
    totalPurchasedCredits: operation === 'increase'
      ? normalizedCreditState.totalPurchasedCredits + amount
      : normalizedCreditState.totalPurchasedCredits,
    remainingCredits: operation === 'increase'
      ? normalizedCreditState.remainingCredits + amount
      : normalizedCreditState.remainingCredits - amount,
    lastAdjustmentAt: createdAt,
    lastAdjustmentOperation: operation,
    lastAdjustmentAmount: amount,
    adjustmentHistory: [
      {
        id: `browser-credit-adjustment-${createdAt}-${operation}`,
        operation,
        amount,
        createdAt
      },
      ...normalizedCreditState.adjustmentHistory
    ].slice(0, BROWSER_CREDIT_HISTORY_LIMIT)
  })
}

function normalizeBrowserSettings (rawSettings = {}) {
  const mergedSettings = {
    ...defaultBrowserSettings,
    ...rawSettings
  }
  const activeApiKeyIndex = normalizeActiveApiKeyIndex(mergedSettings.activeApiKeyIndex)
  const apiKeys = normalizeApiKeys(mergedSettings.apiKeys)

  if (typeof rawSettings.apiKey === 'string' && !rawSettings.apiKeys) {
    apiKeys[activeApiKeyIndex] = rawSettings.apiKey
  }

  return {
    ...mergedSettings,
    themeMode: normalizeThemeMode(mergedSettings.themeMode),
    downloadCleanupEnabled: normalizeDownloadCleanupEnabled(mergedSettings.downloadCleanupEnabled),
    globalUploadDirectory: normalizeGlobalUploadDirectory(mergedSettings.globalUploadDirectory),
    uploadDirectories: normalizeUploadDirectories(mergedSettings.uploadDirectories),
    dashboardCreditState: normalizeBrowserDashboardCreditState(mergedSettings.dashboardCreditState),
    creditState: normalizeBrowserCreditState(mergedSettings.creditState),
    providerApiKeys: normalizeProviderApiKeys(
      mergedSettings.providerApiKeys,
      apiKeys[activeApiKeyIndex] || mergedSettings.apiKey || ''
    ),
    apiKeys,
    activeApiKeyIndex,
    apiKey: apiKeys[activeApiKeyIndex] || ''
  }
}

function getBrowserSettings () {
  return normalizeBrowserSettings(readBrowserState(BROWSER_SETTINGS_KEY, defaultBrowserSettings))
}

function saveBrowserSettings (payload = {}) {
  const currentSettings = getBrowserSettings()
  const {
    creditAdjustment,
    ...restPayload
  } = payload || {}
  const activeApiKeyIndex = Object.prototype.hasOwnProperty.call(payload, 'activeApiKeyIndex')
    ? normalizeActiveApiKeyIndex(payload.activeApiKeyIndex)
    : currentSettings.activeApiKeyIndex
  const apiKeys = Object.prototype.hasOwnProperty.call(payload, 'apiKeys')
    ? normalizeApiKeys(payload.apiKeys)
    : normalizeApiKeys(currentSettings.apiKeys)

  if (typeof payload.apiKey === 'string') {
    apiKeys[activeApiKeyIndex] = payload.apiKey
  }

  let creditState = Object.prototype.hasOwnProperty.call(restPayload, 'creditState')
    ? normalizeBrowserCreditState({
        ...currentSettings.creditState,
        ...restPayload.creditState
      })
    : normalizeBrowserCreditState(currentSettings.creditState)

  if (creditAdjustment && typeof creditAdjustment === 'object') {
    creditState = applyBrowserCreditAdjustment(creditState, creditAdjustment)
  }

  const nextSettings = normalizeBrowserSettings({
    ...currentSettings,
    ...restPayload,
    globalUploadDirectory: Object.prototype.hasOwnProperty.call(payload, 'globalUploadDirectory')
      ? normalizeGlobalUploadDirectory(payload.globalUploadDirectory)
      : normalizeGlobalUploadDirectory(currentSettings.globalUploadDirectory),
    uploadDirectories: {
      ...normalizeUploadDirectories(currentSettings.uploadDirectories),
      ...normalizeUploadDirectories(payload.uploadDirectories)
    },
    activeApiKeyIndex,
    apiKeys,
    creditState
  })

  return writeBrowserState(BROWSER_SETTINGS_KEY, nextSettings)
}

function getBrowserStudioSnapshot () {
  const savedSnapshot = readBrowserState(BROWSER_STUDIO_KEY, defaultBrowserStudioSnapshot)
  const settings = getBrowserSettings()

  return {
    ...defaultBrowserStudioSnapshot,
    ...savedSnapshot,
    themeMode: normalizeThemeMode(settings.themeMode || savedSnapshot.themeMode || 'dark'),
    settingsSummary: {
      apiKeys: settings.apiKeys,
      activeApiKeyIndex: settings.activeApiKeyIndex,
      dashboardCreditState: settings.dashboardCreditState,
      creditState: settings.creditState
    }
  }
}

function saveBrowserStudioDraft (payload = {}) {
  const snapshot = getBrowserStudioSnapshot()
  const menuKey = payload.menuKey || 'workspace'
  const patch = payload.patch || {}
  const nextSnapshot = {
    ...snapshot,
    formDrafts: {
      ...(snapshot.formDrafts || {}),
      [menuKey]: {
        ...((snapshot.formDrafts || {})[menuKey] || {}),
        ...patch
      }
    }
  }

  writeBrowserState(BROWSER_STUDIO_KEY, nextSnapshot)
  return nextSnapshot.formDrafts[menuKey]
}

function clearBrowserStudioRuntimeState () {
  const snapshot = getBrowserStudioSnapshot()
  const nextSnapshot = {
    ...defaultBrowserStudioSnapshot,
    tasks: Array.isArray(snapshot.tasks) ? snapshot.tasks : [],
    settingsSummary: snapshot.settingsSummary || defaultBrowserStudioSnapshot.settingsSummary,
    hostInfo: snapshot.hostInfo || defaultBrowserStudioSnapshot.hostInfo
  }

  writeBrowserState(BROWSER_STUDIO_KEY, nextSnapshot)
  return {
    cleared: true
  }
}

function getBrowserActivationState() {
  return {
    ...defaultBrowserActivationState
  }
}

function getBrowserPromptTemplates() {
  const storedTemplates = readBrowserState(BROWSER_PROMPTS_KEY, defaultBrowserPromptTemplates)
  const normalizedTemplates = mergeDefaultBrowserPromptTemplates(storedTemplates)
  writeBrowserState(BROWSER_PROMPTS_KEY, normalizedTemplates)
  return normalizedTemplates
}

function normalizeBrowserPromptTemplate(template = {}) {
  return {
    id: String(template.id || ''),
    name: String(template.name || '').trim(),
    category: String(template.category || '').trim(),
    prompt: String(template.prompt || '').trim(),
    source: template.source === 'system-fixed' ? 'system-fixed' : 'custom'
  }
}

function mergeDefaultBrowserPromptTemplates(templates = []) {
  const incomingTemplates = Array.isArray(templates)
    ? templates.map((template) => normalizeBrowserPromptTemplate(template))
    : []
  const incomingTemplateMap = new Map(incomingTemplates.filter((template) => template.id).map((template) => [template.id, template]))
  const customTemplates = incomingTemplates.filter((template) => {
    return template.id && !defaultBrowserPromptTemplates.find((item) => item.id === template.id)
  })

  return [
    ...defaultBrowserPromptTemplates.map((defaultTemplate) => {
      const matchedTemplate = incomingTemplateMap.get(defaultTemplate.id)
      return normalizeBrowserPromptTemplate({
        ...defaultTemplate,
        ...(matchedTemplate || {})
      })
    }),
    ...customTemplates
  ]
}

function saveBrowserPromptTemplate(payload = {}) {
  const currentTemplates = getBrowserPromptTemplates()
  const existingTemplate = currentTemplates.find((item) => item.id === payload.id)
  const nextTemplate = normalizeBrowserPromptTemplate({
    id: existingTemplate?.source === 'system-fixed'
      ? existingTemplate.id
      : (payload.id || `browser-template-${Date.now()}`),
    name: payload.name || existingTemplate?.name || '',
    category: payload.category || existingTemplate?.category || '',
    prompt: payload.prompt || '',
    source: existingTemplate?.source === 'system-fixed' ? 'system-fixed' : 'custom'
  })
  const nextTemplates = [
    ...currentTemplates.filter((item) => item.id !== nextTemplate.id),
    nextTemplate
  ]
  writeBrowserState(BROWSER_PROMPTS_KEY, mergeDefaultBrowserPromptTemplates(nextTemplates))
  return nextTemplate
}

function removeBrowserPromptTemplate(payload = {}) {
  const currentTemplates = getBrowserPromptTemplates()
  const targetTemplate = currentTemplates.find((item) => item.id === payload.id)
  if (targetTemplate?.source === 'system-fixed') {
    return { ok: true }
  }
  writeBrowserState(BROWSER_PROMPTS_KEY, mergeDefaultBrowserPromptTemplates(currentTemplates.filter((item) => item.id !== payload.id)))
  return { ok: true }
}

function getChannel (channelName) {
  const bridge = getBridge()

  if (!bridge || !bridge.channels) {
    throw new Error('QiuAi desktop bridge is unavailable.')
  }

  return bridge.channels[channelName]
}

function invoke (channel, payload) {
  const bridge = getBridge()

  if (!bridge || typeof bridge.invoke !== 'function') {
    throw new Error('QiuAi desktop bridge is unavailable.')
  }

  return bridge.invoke(channel, normalizeForIpc(payload))
}

export function getSettings () {
  if (!hasBridge()) {
    return Promise.resolve(getBrowserSettings())
  }

  return invoke(getChannel('SETTINGS_GET'))
}

export function saveSettings (payload) {
  if (!hasBridge()) {
    return Promise.resolve(saveBrowserSettings(payload))
  }

  return invoke(getChannel('SETTINGS_SAVE'), payload)
}

export function saveProviderApiKeys (payload) {
  if (!hasBridge()) {
    const currentSettings = getBrowserSettings()
    const nextSettings = saveBrowserSettings({
      apiKey: payload?.imageApiKey || currentSettings.apiKey || '',
      providerApiKeys: {
        general: payload?.imageApiKey || currentSettings.providerApiKeys?.general || currentSettings.apiKey || '',
        deepseek: payload?.textApiKey || currentSettings.providerApiKeys?.deepseek || '',
        minimax: payload?.videoApiKey || currentSettings.providerApiKeys?.minimax || ''
      }
    })

    return Promise.resolve(nextSettings)
  }

  return invoke(getChannel('SETTINGS_SAVE_PROVIDER_API_KEYS'), payload)
}

export function createTask (payload) {
  return invoke(getChannel('DRAW_CREATE_TASK'), payload)
}

export function getTaskResult (payload) {
  return invoke(getChannel('DRAW_GET_RESULT'), payload)
}

export function downloadImage (payload) {
  return invoke(getChannel('DRAW_DOWNLOAD_IMAGE'), payload)
}

export function pickInputFolder () {
  return invoke(getChannel('INPUT_PICK_FOLDER'))
}

export function pickInputFile () {
  return invoke(getChannel('INPUT_PICK_FILE'))
}

export function listPromptTemplates () {
  if (!hasBridge()) {
    return Promise.resolve(getBrowserPromptTemplates())
  }
  return invoke(getChannel('PROMPTS_LIST'))
}

export function savePromptTemplate (payload) {
  if (!hasBridge()) {
    return Promise.resolve(saveBrowserPromptTemplate(payload))
  }
  return invoke(getChannel('PROMPTS_SAVE'), payload)
}

export function removePromptTemplate (payload) {
  if (!hasBridge()) {
    return Promise.resolve(removeBrowserPromptTemplate(payload))
  }
  return invoke(getChannel('PROMPTS_REMOVE'), payload)
}

export function createLocalTask (payload) {
  return invoke(getChannel('TASKS_CREATE_LOCAL'), payload)
}

export function listLocalTasks () {
  return invoke(getChannel('TASKS_LIST'))
}

export function getLocalTask (payload) {
  return invoke(getChannel('TASKS_GET'), payload)
}

export function runLocalTask (payload) {
  return invoke(getChannel('TASKS_RUN'), payload)
}

export function exportLocalTask (payload) {
  return invoke(getChannel('TASKS_EXPORT'), payload)
}

export function getStudioSnapshot () {
  if (!hasBridge()) {
    return Promise.resolve(getBrowserStudioSnapshot())
  }

  return invoke(getChannel('STUDIO_GET_SNAPSHOT'))
}

export function getStudioRuntimeSnapshot () {
  if (!hasBridge()) {
    return Promise.resolve(getBrowserStudioSnapshot())
  }

  return invoke(getChannel('STUDIO_GET_RUNTIME_SNAPSHOT'))
}

export function createStudioProject (payload) {
  return invoke(getChannel('STUDIO_CREATE_PROJECT'), payload)
}

export function createProjectsFromAssets (payload) {
  return invoke(getChannel('STUDIO_CREATE_PROJECTS_FROM_ASSETS'), payload)
}

export function updateStudioProject (payload) {
  return invoke(getChannel('STUDIO_UPDATE_PROJECT'), payload)
}

export function deleteStudioProject (payload) {
  return invoke(getChannel('STUDIO_DELETE_PROJECT'), payload)
}

export function exportStudioProjectBundle (payload) {
  return invoke(getChannel('STUDIO_EXPORT_PROJECT_BUNDLE'), payload)
}

export function refreshDashboardCredits (payload) {
  if (!hasBridge()) {
    const settings = getBrowserSettings()
    const current = settings.dashboardCreditState || defaultBrowserDashboardCreditState
    return Promise.resolve(current)
  }

  return invoke(getChannel('STUDIO_REFRESH_DASHBOARD_CREDITS'), payload)
}

export function saveStudioDraft (payload) {
  if (!hasBridge()) {
    return Promise.resolve(saveBrowserStudioDraft(payload))
  }

  return invoke(getChannel('STUDIO_SAVE_DRAFT'), payload)
}

export function createStudioTask (payload) {
  return invoke(getChannel('STUDIO_CREATE_TASK'), payload)
}

export function stopStudioTask (payload) {
  return invoke(getChannel('STUDIO_STOP_TASK'), payload)
}

export function getActivationStatus () {
  if (!hasBridge()) {
    return Promise.resolve(getBrowserActivationState())
  }

  return invoke(getChannel('LICENSE_GET_STATUS'))
}

export function getDeviceCode () {
  if (!hasBridge()) {
    return Promise.resolve({
      deviceCode: defaultBrowserActivationState.deviceCode
    })
  }

  return invoke(getChannel('LICENSE_GET_DEVICE_CODE'))
}

export function importLicenseFile (payload) {
  if (!hasBridge()) {
    return Promise.resolve({
      ...getBrowserActivationState(),
      canceled: false,
      message: '导入授权成功'
    })
  }

  return invoke(getChannel('LICENSE_IMPORT_FILE'), payload)
}

export function reloadActivation () {
  if (!hasBridge()) {
    return Promise.resolve(getBrowserActivationState())
  }

  return invoke(getChannel('LICENSE_REFRESH'))
}

export function activateRemoteLicense (payload) {
  if (!hasBridge()) {
    return Promise.resolve({
      ...getBrowserActivationState(),
      status: 'activated',
      customerName: String(payload?.customerName || '浏览器模式').trim() || '浏览器模式',
      message: '浏览器模式已模拟激活',
      sessionToken: 'browser-session-token'
    })
  }

  return invoke(getChannel('LICENSE_REMOTE_ACTIVATE'), payload)
}

export function createRechargeOrder (payload) {
  if (!hasBridge()) {
    return Promise.resolve({
      id: `browser-order-${Date.now()}`,
      merchantOrderNo: `QAO-BROWSER-${Date.now()}`,
      walletType: payload?.walletType || 'image',
      channel: payload?.channel || 'alipay',
      originalAmountCny: Number(payload?.amountCny || 0),
      payAmountCny: Number(payload?.amountCny || 0),
      bonusAmountCny: 0,
      couponCode: String(payload?.couponCode || '').trim(),
      status: 'pending',
      createdAt: new Date().toISOString(),
      paidAt: '',
      failedAt: '',
      closedAt: '',
      providerTradeNo: '',
      paymentPayload: {
        provider: payload?.channel || 'alipay',
        mode: payload?.channel === 'wechat' ? 'native_qr' : 'browser_redirect',
        mockPayUrl: 'https://pay.qiuai.local/browser',
        mockCodeUrl: ''
      },
      statusMessage: 'awaiting_payment'
    })
  }

  return invoke(getChannel('RECHARGE_CREATE_ORDER'), payload)
}

export function getRechargeOrder (payload) {
  if (!hasBridge()) {
    return Promise.resolve({
      id: payload?.id || '',
      merchantOrderNo: payload?.id || '',
      walletType: 'image',
      channel: 'alipay',
      originalAmountCny: 0,
      payAmountCny: 0,
      bonusAmountCny: 0,
      couponCode: '',
      status: 'pending',
      createdAt: '',
      paidAt: '',
      failedAt: '',
      closedAt: '',
      providerTradeNo: '',
      paymentPayload: null,
      statusMessage: 'awaiting_payment'
    })
  }

  return invoke(getChannel('RECHARGE_GET_ORDER'), payload)
}

export function pickStudioInputAssets (payload) {
  if (!hasBridge()) {
    return Promise.resolve({
      canceled: true,
      files: []
    })
  }

  return invoke(getChannel('STUDIO_PICK_INPUT_ASSETS'), payload)
}

export function openOutputDirectory (payload) {
  return invoke(getChannel('STUDIO_OPEN_OUTPUT_DIRECTORY'), payload)
}

export function openExternalResource (payload) {
  return invoke(getChannel('STUDIO_OPEN_EXTERNAL_RESOURCE'), payload)
}

export function exportStudioResults (payload) {
  return invoke(getChannel('STUDIO_EXPORT_RESULTS'), payload)
}

export function deleteStudioExportItem (payload) {
  return invoke(getChannel('STUDIO_DELETE_EXPORT_ITEM'), payload)
}

export function clearStudioRuntimeState () {
  if (!hasBridge()) {
    return Promise.resolve(clearBrowserStudioRuntimeState())
  }

  return invoke(getChannel('STUDIO_CLEAR_RUNTIME_STATE'))
}


