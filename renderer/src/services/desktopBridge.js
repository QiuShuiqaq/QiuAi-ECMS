import studioMenuConfig from '../../../shared/studio-menu-config.json'

const BROWSER_STUDIO_KEY = 'qiuai-browser-studio'
const BROWSER_PROMPTS_KEY = 'qiuai-browser-prompts'
const BROWSER_PROJECT_TEMPLATES_KEY = 'qiuai-browser-project-templates'
const BROWSER_USER_AGREEMENT_KEY = 'qiuai-browser-user-agreement'
const BROWSER_CREDIT_HISTORY_LIMIT = 20
const BROWSER_RUNTIME_MENU_KEYS = new Set(studioMenuConfig.runtimeTaskMenuKeys || ['workspace', 'series-generate', 'video-generate'])

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

const defaultBrowserStudioSnapshot = {
  formDrafts: {},
  resultsByMenu: {},
  exportItemsByMenu: {},
  tasks: [],
  workspaceDashboard: {},
  hostInfo: {},
  settingsSummary: {
    dashboardCreditState: defaultBrowserDashboardCreditState,
    creditState: defaultBrowserCreditState
  }
}

const defaultBrowserActivationState = {
  status: 'not_logged_in',
  mode: 'server-license',
  authType: 'session-token',
  canUseApp: false,
  customerName: '',
  userId: '',
  licenseId: '',
  inviteCode: '',
  deviceCode: 'QAI-BROWSER-MODE',
  activatedAt: '',
  expiresAt: '',
  message: 'QiuAi desktop bridge is unavailable.',
  nextAction: 'activate-license',
  remoteStatus: 'bridge_unavailable'
}

const defaultBrowserUserAgreementState = {
  title: '用户须知与使用协议暨责任认定书',
  version: 'QIUAI-ECMS-USER-NOTICE-v4.0',
  accepted: false,
  acceptedAt: '',
  shouldShow: false,
  userId: '',
  licenseId: '',
  deviceCode: 'QAI-BROWSER-MODE',
  customerName: ''
}

function createBridgeUnavailableError () {
  return new Error('QiuAi desktop bridge is unavailable.')
}

const defaultBrowserPromptTemplates = [
  { id: 'title-default', name: '默认', category: '标题', prompt: '', source: 'system-fixed' },
  { id: 'description-default', name: '默认', category: '描述', prompt: '', source: 'system-fixed' },
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

function resolveLegacyBrowserTextTemplateIds(templateId = '') {
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

function normalizeBrowserSettingsSummary (rawSummary = {}) {
  const source = rawSummary && typeof rawSummary === 'object' ? rawSummary : {}

  return {
    dashboardCreditState: normalizeBrowserDashboardCreditState(source.dashboardCreditState),
    creditState: normalizeBrowserCreditState(source.creditState)
  }
}

function getBrowserStudioSnapshot () {
  const savedSnapshot = readBrowserState(BROWSER_STUDIO_KEY, defaultBrowserStudioSnapshot)
  const snapshotWithoutLegacyTheme = { ...(savedSnapshot || {}) }
  delete snapshotWithoutLegacyTheme.themeMode

  return {
    ...defaultBrowserStudioSnapshot,
    ...snapshotWithoutLegacyTheme,
    settingsSummary: normalizeBrowserSettingsSummary(savedSnapshot.settingsSummary)
  }
}

function saveBrowserStudioDraft (payload = {}) {
  const snapshot = getBrowserStudioSnapshot()
  const menuKey = payload.menuKey || 'workspace'
  if (!BROWSER_RUNTIME_MENU_KEYS.has(menuKey)) {
    return {}
  }
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

function getBrowserUserAgreementState() {
  const state = readBrowserState(BROWSER_USER_AGREEMENT_KEY, defaultBrowserUserAgreementState)
  return {
    ...defaultBrowserUserAgreementState,
    ...(state && typeof state === 'object' ? state : {})
  }
}

function acceptBrowserUserAgreement() {
  const nextState = {
    ...defaultBrowserUserAgreementState,
    accepted: true,
    acceptedAt: new Date().toISOString(),
    shouldShow: false
  }

  writeBrowserState(BROWSER_USER_AGREEMENT_KEY, nextState)
  return nextState
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

function getBrowserProjectTemplates() {
  return readBrowserState(BROWSER_PROJECT_TEMPLATES_KEY, [])
}

function saveBrowserProjectTemplates(templates = []) {
  writeBrowserState(BROWSER_PROJECT_TEMPLATES_KEY, Array.isArray(templates) ? templates : [])
  return getBrowserProjectTemplates()
}

function saveBrowserProjectTemplateFromProject(payload = {}) {
  const snapshot = getBrowserStudioSnapshot()
  const project = (snapshot.productProjects || []).find((item) => item.id === payload.projectId)
  if (!project) {
    throw new Error('Project was not found.')
  }

  const template = {
    id: `browser-project-template-${Date.now()}`,
    projectId: String(project.id || ''),
    name: String(payload.name || project.name || project.baseInfo?.productName || '未命名模板').trim(),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    sourceImage: project.assets?.sourceImages?.[0] || null,
    generatedTitle: String(project.content?.selectedTitle || '').trim(),
    generatedDescription: String(project.content?.selectedDescription || '').trim(),
    generatedImages: Array.isArray(project.assets?.generatedImages) ? project.assets.generatedImages : [],
    generatedVideo: project.assets?.generatedVideo || null,
    parameters: {
      title: {
        prompt: String(project.generationConfig?.titlePrompt || '').trim(),
        maxChars: Number(project.generationConfig?.titleMaxChars || 0) || 0,
        quantity: Number(project.generationConfig?.titleQuantity || 0) || 0
      },
      description: {
        prompt: String(project.generationConfig?.descriptionPrompt || '').trim(),
        maxChars: Number(project.generationConfig?.descriptionMaxChars || 0) || 0,
        quantity: Number(project.generationConfig?.descriptionQuantity || 0) || 0
      },
      image: {
        prompt: String(project.generationConfig?.imagePrompt || '').trim(),
        templateId: String(project.generationConfig?.imageTemplateId || '').trim(),
        model: String(project.generationConfig?.imageModel || '').trim(),
        size: String(project.generationConfig?.imageSize || '').trim(),
        generateCount: Number(project.generationConfig?.generateCount || 0) || 0
      },
      video: {
        prompt: String(project.generationConfig?.videoPrompt || '').trim(),
        templateId: String(project.generationConfig?.videoTemplateId || '').trim(),
        model: String(project.generationConfig?.videoModel || '').trim(),
        duration: String(project.generationConfig?.videoDuration || '').trim(),
        resolution: String(project.generationConfig?.videoResolution || '').trim(),
        motionStrength: String(project.generationConfig?.videoMotionStrength || '').trim(),
        aspectRatio: String(project.generationConfig?.videoAspectRatio || '').trim()
      }
    },
    summary: {
      productName: String(project.baseInfo?.productName || project.name || '').trim(),
      language: String(project.baseInfo?.language || '').trim(),
      platformTargetsText: Array.isArray(project.platformTarget) ? project.platformTarget.join(', ') : ''
    }
  }

  const nextTemplates = [template, ...getBrowserProjectTemplates()]
  saveBrowserProjectTemplates(nextTemplates)
  return template
}

function updateBrowserProjectTemplate(payload = {}) {
  const currentTemplates = getBrowserProjectTemplates()
  const targetId = String(payload.id || '').trim()
  const currentTemplate = currentTemplates.find((item) => item.id === targetId)
  if (!currentTemplate) {
    throw new Error('Template was not found.')
  }

  const nextTemplate = {
    ...currentTemplate,
    ...JSON.parse(JSON.stringify(payload)),
    id: currentTemplate.id,
    updatedAt: new Date().toISOString()
  }
  const nextTemplates = [nextTemplate, ...currentTemplates.filter((item) => item.id !== targetId)]
  saveBrowserProjectTemplates(nextTemplates)
  return nextTemplate
}

function removeBrowserProjectTemplate(payload = {}) {
  const targetId = String(payload.id || '').trim()
  saveBrowserProjectTemplates(getBrowserProjectTemplates().filter((item) => item.id !== targetId))
  return { ok: true }
}

function applyBrowserProjectTemplate(payload = {}) {
  const targetId = String(payload.id || '').trim()
  const template = getBrowserProjectTemplates().find((item) => item.id === targetId)
  if (!template) {
    throw new Error('Template was not found.')
  }
  return template
}

function migrateLegacyBrowserPromptTemplate(template = {}) {
  const normalized = normalizeBrowserPromptTemplate(template)

  if (normalized.category !== '文本') {
    return [normalized]
  }

  const legacyIds = resolveLegacyBrowserTextTemplateIds(normalized.id)
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

function mergeDefaultBrowserPromptTemplates(templates = []) {
  const incomingTemplates = Array.isArray(templates)
    ? templates.flatMap((template) => migrateLegacyBrowserPromptTemplate(template))
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
    throw createBridgeUnavailableError()
  }

  return bridge.channels[channelName]
}

function invoke (channel, payload) {
  const bridge = getBridge()

  if (!bridge || typeof bridge.invoke !== 'function') {
    throw createBridgeUnavailableError()
  }

  return bridge.invoke(channel, normalizeForIpc(payload))
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

export function listProjectTemplates () {
  if (!hasBridge()) {
    return Promise.resolve(getBrowserProjectTemplates())
  }

  return invoke(getChannel('PROJECT_TEMPLATES_LIST'))
}

export function saveProjectTemplateFromProject (payload) {
  if (!hasBridge()) {
    return Promise.resolve(saveBrowserProjectTemplateFromProject(payload))
  }

  return invoke(getChannel('PROJECT_TEMPLATES_SAVE_FROM_PROJECT'), payload)
}

export function updateProjectTemplate (payload) {
  if (!hasBridge()) {
    return Promise.resolve(updateBrowserProjectTemplate(payload))
  }

  return invoke(getChannel('PROJECT_TEMPLATES_UPDATE'), payload)
}

export function removeProjectTemplate (payload) {
  if (!hasBridge()) {
    return Promise.resolve(removeBrowserProjectTemplate(payload))
  }

  return invoke(getChannel('PROJECT_TEMPLATES_REMOVE'), payload)
}

export function applyProjectTemplate (payload) {
  if (!hasBridge()) {
    return Promise.resolve(applyBrowserProjectTemplate(payload))
  }

  return invoke(getChannel('PROJECT_TEMPLATES_APPLY'), payload)
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

export function updateStudioProject (payload) {
  return invoke(getChannel('STUDIO_UPDATE_PROJECT'), payload)
}

export function deleteStudioProject (payload) {
  return invoke(getChannel('STUDIO_DELETE_PROJECT'), payload)
}

export function exportStudioProjectBundle (payload) {
  return invoke(getChannel('STUDIO_EXPORT_PROJECT_BUNDLE'), payload)
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

export function getActivationStatus () {
  if (!hasBridge()) {
    return Promise.resolve(getBrowserActivationState())
  }

  return invoke(getChannel('LICENSE_GET_STATUS'))
}

export function getUserAgreementStatus () {
  if (!hasBridge()) {
    return Promise.resolve(getBrowserUserAgreementState())
  }

  return invoke(getChannel('LICENSE_GET_USER_AGREEMENT_STATUS'))
}

export function acceptUserAgreement () {
  if (!hasBridge()) {
    return Promise.resolve(acceptBrowserUserAgreement())
  }

  return invoke(getChannel('LICENSE_ACCEPT_USER_AGREEMENT'))
}

export function activateRemoteLicense (payload) {
  if (!hasBridge()) {
    return Promise.reject(createBridgeUnavailableError())
  }

  return invoke(getChannel('LICENSE_REMOTE_ACTIVATE'), payload)
}

export function clearLocalAuthorization () {
  if (!hasBridge()) {
    return Promise.reject(createBridgeUnavailableError())
  }

  return invoke(getChannel('LICENSE_CLEAR_LOCAL_AUTH'))
}

export function listSoftwarePackages () {
  if (!hasBridge()) {
    return Promise.reject(createBridgeUnavailableError())
  }

  return invoke(getChannel('LICENSE_LIST_PACKAGES'))
}

export function createSoftwareOrder (payload) {
  if (!hasBridge()) {
    return Promise.reject(createBridgeUnavailableError())
  }

  return invoke(getChannel('LICENSE_CREATE_ORDER'), payload)
}

export function getSoftwareOrder (payload) {
  if (!hasBridge()) {
    return Promise.reject(createBridgeUnavailableError())
  }

  return invoke(getChannel('LICENSE_GET_ORDER'), payload)
}

export function listComputePackages () {
  if (!hasBridge()) {
    return Promise.reject(createBridgeUnavailableError())
  }

  return invoke(getChannel('COMPUTE_PACKAGE_LIST'))
}

export function createComputePackageOrder (payload) {
  if (!hasBridge()) {
    return Promise.reject(createBridgeUnavailableError())
  }

  return invoke(getChannel('COMPUTE_PACKAGE_CREATE_ORDER'), payload)
}

export function getComputePackageOrder (payload) {
  if (!hasBridge()) {
    return Promise.reject(createBridgeUnavailableError())
  }

  return invoke(getChannel('COMPUTE_PACKAGE_GET_ORDER'), payload)
}

export function createRechargeOrder (payload) {
  if (!hasBridge()) {
    return Promise.reject(createBridgeUnavailableError())
  }

  return invoke(getChannel('RECHARGE_CREATE_ORDER'), payload)
}

export function getRechargeOrder (payload) {
  if (!hasBridge()) {
    return Promise.reject(createBridgeUnavailableError())
  }

  return invoke(getChannel('RECHARGE_GET_ORDER'), payload)
}

export function getSelectionManifest () {
  if (!hasBridge()) {
    return Promise.reject(createBridgeUnavailableError())
  }

  return invoke(getChannel('SELECTION_GET_MANIFEST'))
}

export function listSelectionPlatforms () {
  if (!hasBridge()) {
    return Promise.reject(createBridgeUnavailableError())
  }

  return invoke(getChannel('SELECTION_LIST_PLATFORMS'))
}

export function listSelectionSites (payload) {
  if (!hasBridge()) {
    return Promise.reject(createBridgeUnavailableError())
  }

  return invoke(getChannel('SELECTION_LIST_SITES'), payload)
}

export function listSelectionItems (payload) {
  if (!hasBridge()) {
    return Promise.reject(createBridgeUnavailableError())
  }

  return invoke(getChannel('SELECTION_LIST_ITEMS'), payload)
}

export function getSelectionItemDetail (payload) {
  if (!hasBridge()) {
    return Promise.reject(createBridgeUnavailableError())
  }

  return invoke(getChannel('SELECTION_GET_ITEM_DETAIL'), payload)
}

export function listPublishChannelAccounts (payload) {
  if (!hasBridge()) {
    return Promise.reject(createBridgeUnavailableError())
  }

  return invoke(getChannel('PUBLISH_LIST_CHANNEL_ACCOUNTS'), payload)
}

export function getPublishClientConfig (payload) {
  if (!hasBridge()) {
    return Promise.reject(createBridgeUnavailableError())
  }

  return invoke(getChannel('PUBLISH_GET_CONFIG'), payload)
}

export function upsertPublishDraft (payload) {
  if (!hasBridge()) {
    return Promise.reject(createBridgeUnavailableError())
  }

  return invoke(getChannel('PUBLISH_UPSERT_DRAFT'), payload)
}

export function getPublishDraft (payload) {
  if (!hasBridge()) {
    return Promise.reject(createBridgeUnavailableError())
  }

  return invoke(getChannel('PUBLISH_GET_DRAFT'), payload)
}

export function getPublishDraftPreview (payload) {
  if (!hasBridge()) {
    return Promise.reject(createBridgeUnavailableError())
  }

  return invoke(getChannel('PUBLISH_GET_DRAFT_PREVIEW'), payload)
}

export function createPublishTask (payload) {
  if (!hasBridge()) {
    return Promise.reject(createBridgeUnavailableError())
  }

  return invoke(getChannel('PUBLISH_CREATE_TASK'), payload)
}

export function getPublishTask (payload) {
  if (!hasBridge()) {
    return Promise.reject(createBridgeUnavailableError())
  }

  return invoke(getChannel('PUBLISH_GET_TASK'), payload)
}

export function retryPublishTask (payload) {
  if (!hasBridge()) {
    return Promise.reject(createBridgeUnavailableError())
  }

  return invoke(getChannel('PUBLISH_RETRY_TASK'), payload)
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

export function clearStudioRuntimeState () {
  if (!hasBridge()) {
    return Promise.resolve(clearBrowserStudioRuntimeState())
  }

  return invoke(getChannel('STUDIO_CLEAR_RUNTIME_STATE'))
}
