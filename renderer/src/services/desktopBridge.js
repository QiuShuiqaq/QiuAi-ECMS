import studioMenuConfig from '../../../shared/studio-menu-config.json'
import defaultBrowserPromptTemplates from '../../../shared/default-prompt-templates.json'

const BROWSER_STUDIO_KEY = 'qiuai-browser-studio'
const BROWSER_PROMPTS_KEY = 'qiuai-browser-prompts'
const BROWSER_PROJECT_TEMPLATES_KEY = 'qiuai-browser-project-templates'
const BROWSER_USER_AGREEMENT_KEY = 'qiuai-browser-user-agreement'
const BROWSER_RUNTIME_MENU_KEYS = new Set(studioMenuConfig.runtimeTaskMenuKeys || ['workspace', 'series-generate', 'video-generate'])

const defaultBrowserDashboardCreditState = {
  text: {
    balanceCny: 0,
    subscriptionBalanceCny: 0,
    permanentBalanceCny: 0,
    lastSyncedAt: '',
    syncStatus: 'idle'
  },
  image: {
    balanceCny: 0,
    subscriptionBalanceCny: 0,
    permanentBalanceCny: 0,
    lastSyncedAt: '',
    syncStatus: 'idle'
  },
  video: {
    balanceCny: 0,
    subscriptionBalanceCny: 0,
    permanentBalanceCny: 0,
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
    dashboardCreditState: defaultBrowserDashboardCreditState
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

function normalizeBrowserDashboardCreditState (rawDashboardCreditState = {}) {
  const source = rawDashboardCreditState && typeof rawDashboardCreditState === 'object' ? rawDashboardCreditState : {}

  return {
    text: {
      balanceCny: Math.max(0, Number(source.text?.balanceCny) || 0),
      subscriptionBalanceCny: Math.max(0, Number(source.text?.subscriptionBalanceCny) || 0),
      permanentBalanceCny: Math.max(0, Number(source.text?.permanentBalanceCny) || 0),
      lastSyncedAt: typeof source.text?.lastSyncedAt === 'string' ? source.text.lastSyncedAt : '',
      syncStatus: typeof source.text?.syncStatus === 'string' ? source.text.syncStatus : 'idle'
    },
    image: {
      balanceCny: Math.max(0, Number(source.image?.balanceCny) || 0),
      subscriptionBalanceCny: Math.max(0, Number(source.image?.subscriptionBalanceCny) || 0),
      permanentBalanceCny: Math.max(0, Number(source.image?.permanentBalanceCny) || 0),
      lastSyncedAt: typeof source.image?.lastSyncedAt === 'string' ? source.image.lastSyncedAt : '',
      syncStatus: typeof source.image?.syncStatus === 'string' ? source.image.syncStatus : 'idle'
    },
    video: {
      balanceCny: Math.max(0, Number(source.video?.balanceCny) || 0),
      subscriptionBalanceCny: Math.max(0, Number(source.video?.subscriptionBalanceCny) || 0),
      permanentBalanceCny: Math.max(0, Number(source.video?.permanentBalanceCny) || 0),
      lastSyncedAt: typeof source.video?.lastSyncedAt === 'string' ? source.video.lastSyncedAt : '',
      syncStatus: typeof source.video?.syncStatus === 'string' ? source.video.syncStatus : 'idle'
    }
  }
}

function normalizeBrowserSettingsSummary (rawSummary = {}) {
  const source = rawSummary && typeof rawSummary === 'object' ? rawSummary : {}

  return {
    dashboardCreditState: normalizeBrowserDashboardCreditState(source.dashboardCreditState)
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
        size: String(project.generationConfig?.size || project.generationConfig?.imageSize || '').trim(),
        generateCount: Number(project.generationConfig?.generateCount || 0) || 0,
        promptAssignments: Array.isArray(project.generationConfig?.promptAssignments)
          ? project.generationConfig.promptAssignments.map((item, index) => ({
              id: String(item?.id || `template-image-${index + 1}`),
              index: Number(item?.index || index + 1) || index + 1,
              templateId: String(item?.templateId || '').trim(),
              imageType: String(item?.imageType || '').trim(),
              differenceLevel: String(item?.differenceLevel || 'off').trim() || 'off',
              prompt: String(item?.prompt || '').trim()
            }))
          : []
      },
      video: {
        prompt: String(project.generationConfig?.videoPrompt || '').trim(),
        templateId: String(project.generationConfig?.videoTemplateId || '').trim(),
        model: String(project.generationConfig?.videoModel || '').trim(),
        duration: String(project.generationConfig?.duration || project.generationConfig?.videoDuration || '').trim(),
        resolution: String(project.generationConfig?.resolution || project.generationConfig?.videoResolution || '').trim(),
        motionStrength: String(project.generationConfig?.motionStrength || project.generationConfig?.videoMotionStrength || '').trim(),
        aspectRatio: String(project.generationConfig?.aspectRatio || project.generationConfig?.videoAspectRatio || '').trim()
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

export function cancelStudioTask (payload) {
  return invoke(getChannel('STUDIO_CANCEL_TASK'), payload)
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

export function deleteStudioExportItem (payload) {
  return invoke(getChannel('STUDIO_DELETE_EXPORT_ITEM'), payload)
}

export function clearStudioRuntimeState () {
  if (!hasBridge()) {
    return Promise.resolve(clearBrowserStudioRuntimeState())
  }

  return invoke(getChannel('STUDIO_CLEAR_RUNTIME_STATE'))
}
