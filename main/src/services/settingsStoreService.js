const fs = require('node:fs')
const crypto = require('node:crypto')

const SETTINGS_KEY = 'userSettings'
const API_KEY_SLOT_COUNT = 2
const CREDIT_HISTORY_LIMIT = 20
const ADMIN_PASSWORD_SALT = 'qiuai-ecms-admin'

const defaultCreditState = {
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

const defaultDashboardCreditState = {
  totalCredits: 0,
  remainingCredits: 0
}

const defaultVideoCreditState = {
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

const defaultVideoDashboardCreditState = {
  totalCredits: 0,
  remainingCredits: 0
}

const defaultSourcingCacheState = {
  entries: {}
}

const defaultSettings = {
  apiBaseUrl: 'https://grsai.dakka.com.cn',
  apiKeys: ['', ''],
  activeApiKeyIndex: 0,
  apiKey: '',
  glmApiKey: '',
  videoApiKey: '',
  videoApiBaseUrl: 'https://anyaigc.com',
  defaultSize: '1:1',
  downloadDirectory: '',
  globalUploadDirectory: '',
  uploadDirectories: {
    'single-image': '',
    'single-design': '',
    'series-design': '',
    'series-generate': ''
  },
  themeMode: 'dark',
  downloadCleanupEnabled: true,
  dashboardCreditState: defaultDashboardCreditState,
  creditState: defaultCreditState,
  videoDashboardCreditState: defaultVideoDashboardCreditState,
  videoCreditState: defaultVideoCreditState,
  sourcingCache: defaultSourcingCacheState,
  adminPasswordHash: ''
}

function hashAdminPassword(password = '') {
  return crypto
    .createHash('sha256')
    .update(`${ADMIN_PASSWORD_SALT}:${String(password || '')}`)
    .digest('hex')
}

function normalizeThemeMode() {
  return 'dark'
}

function normalizeApiKeys(apiKeys = []) {
  return Array.from({ length: API_KEY_SLOT_COUNT }, (_unused, index) => {
    const value = Array.isArray(apiKeys) ? apiKeys[index] : ''
    return typeof value === 'string' ? value : ''
  })
}

function normalizeActiveApiKeyIndex(activeApiKeyIndex = 0) {
  const numericIndex = Number(activeApiKeyIndex)

  if (!Number.isInteger(numericIndex) || numericIndex < 0 || numericIndex >= API_KEY_SLOT_COUNT) {
    return 0
  }

  return numericIndex
}

function normalizeUploadDirectories(uploadDirectories = {}) {
  const source = uploadDirectories && typeof uploadDirectories === 'object' ? uploadDirectories : {}

  return {
    'single-image': typeof source['single-image'] === 'string' ? source['single-image'] : '',
    'single-design': typeof source['single-design'] === 'string' ? source['single-design'] : '',
    'series-design': typeof source['series-design'] === 'string' ? source['series-design'] : '',
    'series-generate': typeof source['series-generate'] === 'string' ? source['series-generate'] : ''
  }
}

function normalizeUploadDirectoryPatch(uploadDirectories = {}) {
  if (!uploadDirectories || typeof uploadDirectories !== 'object') {
    return {}
  }

  const patch = {}

  for (const key of ['single-image', 'single-design', 'series-design', 'series-generate']) {
    if (Object.prototype.hasOwnProperty.call(uploadDirectories, key)) {
      patch[key] = typeof uploadDirectories[key] === 'string' ? uploadDirectories[key] : ''
    }
  }

  return patch
}

function normalizeGlobalUploadDirectory(globalUploadDirectory = '') {
  return typeof globalUploadDirectory === 'string' ? globalUploadDirectory : ''
}

function normalizeGlmApiKey(glmApiKey = '') {
  return typeof glmApiKey === 'string' ? glmApiKey.trim() : ''
}

function normalizeVideoApiKey(videoApiKey = '') {
  return typeof videoApiKey === 'string' ? videoApiKey.trim() : ''
}

function normalizeVideoApiBaseUrl(videoApiBaseUrl = '') {
  return typeof videoApiBaseUrl === 'string' && videoApiBaseUrl.trim()
    ? videoApiBaseUrl.trim()
    : 'https://anyaigc.com'
}

function normalizeDownloadCleanupEnabled(downloadCleanupEnabled = true) {
  return downloadCleanupEnabled !== false
}

function normalizeAdminPasswordHash(adminPasswordHash = '') {
  return typeof adminPasswordHash === 'string' ? adminPasswordHash.trim() : ''
}

function normalizeNonNegativeInteger(value = 0) {
  const numericValue = Number(value)

  if (!Number.isFinite(numericValue) || numericValue < 0) {
    return 0
  }

  return Math.round(numericValue)
}

function normalizeCreditHistoryEntry(entry = {}) {
  return {
    id: typeof entry.id === 'string' ? entry.id : '',
    operation: entry.operation === 'decrease' ? 'decrease' : 'increase',
    amount: normalizeNonNegativeInteger(entry.amount),
    createdAt: typeof entry.createdAt === 'string' ? entry.createdAt : '',
    note: typeof entry.note === 'string' ? entry.note : ''
  }
}

function normalizeCreditActivityEntry(entry = {}) {
  return {
    id: typeof entry.id === 'string' ? entry.id : '',
    type: typeof entry.type === 'string' ? entry.type : '',
    operation: entry.operation === 'decrease' ? 'decrease' : 'increase',
    amount: normalizeNonNegativeInteger(entry.amount),
    createdAt: typeof entry.createdAt === 'string' ? entry.createdAt : '',
    note: typeof entry.note === 'string' ? entry.note : '',
    taskId: typeof entry.taskId === 'string' ? entry.taskId : '',
    taskNumber: typeof entry.taskNumber === 'string' ? entry.taskNumber : '',
    taskName: typeof entry.taskName === 'string' ? entry.taskName : '',
    menuKey: typeof entry.menuKey === 'string' ? entry.menuKey : '',
    modelSummary: typeof entry.modelSummary === 'string' ? entry.modelSummary : ''
  }
}

function normalizeTaskLedgerEntry(entry = {}) {
  return {
    taskId: typeof entry.taskId === 'string' ? entry.taskId : '',
    taskNumber: typeof entry.taskNumber === 'string' ? entry.taskNumber : '',
    menuKey: typeof entry.menuKey === 'string' ? entry.menuKey : '',
    taskName: typeof entry.taskName === 'string' ? entry.taskName : '',
    modelSummary: typeof entry.modelSummary === 'string' ? entry.modelSummary : '',
    estimatedCredits: normalizeNonNegativeInteger(entry.estimatedCredits),
    status: typeof entry.status === 'string' ? entry.status : '',
    createdAt: typeof entry.createdAt === 'string' ? entry.createdAt : '',
    updatedAt: typeof entry.updatedAt === 'string' ? entry.updatedAt : ''
  }
}

function normalizeTaskLedger(taskLedger = {}) {
  if (!taskLedger || typeof taskLedger !== 'object' || Array.isArray(taskLedger)) {
    return {}
  }

  return Object.fromEntries(Object.entries(taskLedger).map(([taskId, entry]) => {
    return [taskId, normalizeTaskLedgerEntry({
      ...entry,
      taskId: entry?.taskId || taskId
    })]
  }))
}

function normalizeCreditState(rawCreditState = {}) {
  const sourceCreditState = rawCreditState && typeof rawCreditState === 'object' ? rawCreditState : {}

  return {
    totalPurchasedCredits: normalizeNonNegativeInteger(sourceCreditState.totalPurchasedCredits),
    remainingCredits: normalizeNonNegativeInteger(sourceCreditState.remainingCredits),
    frozenCredits: normalizeNonNegativeInteger(sourceCreditState.frozenCredits),
    usedCredits: normalizeNonNegativeInteger(sourceCreditState.usedCredits),
    lastAdjustmentAt: typeof sourceCreditState.lastAdjustmentAt === 'string' ? sourceCreditState.lastAdjustmentAt : '',
    lastAdjustmentOperation: typeof sourceCreditState.lastAdjustmentOperation === 'string' ? sourceCreditState.lastAdjustmentOperation : '',
    lastAdjustmentAmount: normalizeNonNegativeInteger(sourceCreditState.lastAdjustmentAmount),
    adjustmentHistory: Array.isArray(sourceCreditState.adjustmentHistory)
      ? sourceCreditState.adjustmentHistory.slice(0, CREDIT_HISTORY_LIMIT).map((entry) => normalizeCreditHistoryEntry(entry))
      : [],
    activityHistory: Array.isArray(sourceCreditState.activityHistory)
      ? sourceCreditState.activityHistory.slice(0, CREDIT_HISTORY_LIMIT).map((entry) => normalizeCreditActivityEntry(entry))
      : [],
    taskLedger: normalizeTaskLedger(sourceCreditState.taskLedger)
  }
}

function normalizeDashboardCreditState(rawDashboardCreditState = {}) {
  const source = rawDashboardCreditState && typeof rawDashboardCreditState === 'object'
    ? rawDashboardCreditState
    : {}

  return {
    totalCredits: normalizeNonNegativeInteger(source.totalCredits),
    remainingCredits: normalizeNonNegativeInteger(source.remainingCredits)
  }
}

function normalizeSourcingCacheState(rawSourcingCache = {}) {
  const source = rawSourcingCache && typeof rawSourcingCache === 'object' && !Array.isArray(rawSourcingCache)
    ? rawSourcingCache
    : {}
  const sourceEntries = source.entries && typeof source.entries === 'object' && !Array.isArray(source.entries)
    ? source.entries
    : {}

  return {
    entries: Object.fromEntries(Object.entries(sourceEntries).map(([cacheKey, entry]) => {
      const normalizedEntry = entry && typeof entry === 'object' && !Array.isArray(entry) ? entry : {}

      return [
        String(cacheKey),
        {
          platformKey: typeof normalizedEntry.platformKey === 'string' ? normalizedEntry.platformKey : '',
          sceneKey: typeof normalizedEntry.sceneKey === 'string' ? normalizedEntry.sceneKey : '',
          version: typeof normalizedEntry.version === 'string' ? normalizedEntry.version : '',
          cacheDate: typeof normalizedEntry.cacheDate === 'string' ? normalizedEntry.cacheDate : '',
          updatedAt: typeof normalizedEntry.updatedAt === 'string' ? normalizedEntry.updatedAt : '',
          items: Array.isArray(normalizedEntry.items) ? normalizedEntry.items : []
        }
      ]
    }))
  }
}

function applyCreditAdjustment(creditState, adjustment = {}, { getNow = () => new Date().toISOString() } = {}) {
  const normalizedCreditState = normalizeCreditState(creditState)
  const amount = normalizeNonNegativeInteger(adjustment.amount)

  if (!amount) {
    return normalizedCreditState
  }

  const operation = adjustment.operation === 'decrease' ? 'decrease' : 'increase'
  if (operation === 'decrease' && normalizedCreditState.remainingCredits < amount) {
    throw new Error('可用积分不足，无法扣减')
  }

  const createdAt = getNow()
  const nextRemainingCredits = operation === 'increase'
    ? normalizedCreditState.remainingCredits + amount
    : normalizedCreditState.remainingCredits - amount

  return normalizeCreditState({
    ...normalizedCreditState,
    totalPurchasedCredits: operation === 'increase'
      ? normalizedCreditState.totalPurchasedCredits + amount
      : normalizedCreditState.totalPurchasedCredits,
    remainingCredits: nextRemainingCredits,
    lastAdjustmentAt: createdAt,
    lastAdjustmentOperation: operation,
    lastAdjustmentAmount: amount,
    adjustmentHistory: [
      normalizeCreditHistoryEntry({
        id: `credit-adjustment-${createdAt}-${operation}`,
        operation,
        amount,
        createdAt,
        note: typeof adjustment.note === 'string' ? adjustment.note : ''
      }),
      ...normalizedCreditState.adjustmentHistory
    ].slice(0, CREDIT_HISTORY_LIMIT),
    activityHistory: [
      normalizeCreditActivityEntry({
        id: `credit-activity-${createdAt}-${operation}`,
        type: operation === 'decrease' ? 'manual_decrease' : 'manual_increase',
        operation,
        amount,
        createdAt,
        note: typeof adjustment.note === 'string' ? adjustment.note : ''
      }),
      ...normalizedCreditState.activityHistory
    ].slice(0, CREDIT_HISTORY_LIMIT)
  })
}

function defaultIsDirectory(targetPath = '') {
  try {
    return fs.statSync(targetPath).isDirectory()
  } catch {
    return false
  }
}

function validateUploadDirectories(uploadDirectories = {}, { isDirectory = defaultIsDirectory } = {}) {
  for (const directoryPath of Object.values(normalizeUploadDirectories(uploadDirectories))) {
    if (!directoryPath) {
      continue
    }

    if (!isDirectory(directoryPath)) {
      throw new Error('默认上传目录不存在或不是文件夹')
    }
  }
}

function validateGlobalUploadDirectory(globalUploadDirectory = '', { isDirectory = defaultIsDirectory } = {}) {
  const normalizedPath = normalizeGlobalUploadDirectory(globalUploadDirectory)
  if (!normalizedPath) {
    return
  }

  if (!isDirectory(normalizedPath)) {
    throw new Error('默认上传目录不存在或不是文件夹')
  }
}

function normalizeSettings(rawSettings = {}) {
  const mergedSettings = {
    ...defaultSettings,
    ...rawSettings
  }
  const activeApiKeyIndex = normalizeActiveApiKeyIndex(mergedSettings.activeApiKeyIndex)
  const apiKeys = normalizeApiKeys(mergedSettings.apiKeys)

  if ((!rawSettings.apiKeys || !rawSettings.apiKeys.length) && typeof rawSettings.apiKey === 'string') {
    apiKeys[activeApiKeyIndex] = rawSettings.apiKey
  }

  return {
    ...mergedSettings,
    themeMode: normalizeThemeMode(mergedSettings.themeMode),
    glmApiKey: normalizeGlmApiKey(mergedSettings.glmApiKey),
    videoApiKey: normalizeVideoApiKey(mergedSettings.videoApiKey),
    videoApiBaseUrl: normalizeVideoApiBaseUrl(mergedSettings.videoApiBaseUrl),
    downloadCleanupEnabled: normalizeDownloadCleanupEnabled(mergedSettings.downloadCleanupEnabled),
    globalUploadDirectory: normalizeGlobalUploadDirectory(mergedSettings.globalUploadDirectory),
    uploadDirectories: normalizeUploadDirectories(mergedSettings.uploadDirectories),
    dashboardCreditState: normalizeDashboardCreditState(mergedSettings.dashboardCreditState),
    creditState: normalizeCreditState(mergedSettings.creditState),
    videoDashboardCreditState: normalizeDashboardCreditState(mergedSettings.videoDashboardCreditState),
    videoCreditState: normalizeCreditState(mergedSettings.videoCreditState),
    sourcingCache: normalizeSourcingCacheState(mergedSettings.sourcingCache),
    adminPasswordHash: normalizeAdminPasswordHash(mergedSettings.adminPasswordHash),
    apiKeys,
    activeApiKeyIndex,
    apiKey: apiKeys[activeApiKeyIndex] || ''
  }
}

function maskSecret(value = '') {
  const normalized = typeof value === 'string' ? value.trim() : ''
  if (!normalized) {
    return ''
  }

  if (normalized.length <= 8) {
    return `${normalized.slice(0, 1)}***${normalized.slice(-1)}`
  }

  return `${normalized.slice(0, 4)}***${normalized.slice(-4)}`
}

function createSettingsStoreService({ store }) {
  function getSettings() {
    return normalizeSettings(store.get(SETTINGS_KEY, {}))
  }

  function getAdminStatus() {
    const settings = getSettings()

    return {
      passwordConfigured: Boolean(settings.adminPasswordHash),
      imageApiConfigured: Boolean(settings.apiKey),
      videoApiConfigured: Boolean(settings.videoApiKey)
    }
  }

  function getPublicSettings() {
    const settings = getSettings()

    return {
      activeApiKeyIndex: settings.activeApiKeyIndex,
      defaultSize: settings.defaultSize,
      downloadDirectory: settings.downloadDirectory,
      globalUploadDirectory: settings.globalUploadDirectory,
      uploadDirectories: settings.uploadDirectories,
      themeMode: settings.themeMode,
      downloadCleanupEnabled: settings.downloadCleanupEnabled,
      dashboardCreditState: settings.dashboardCreditState,
      creditState: settings.creditState,
      videoDashboardCreditState: settings.videoDashboardCreditState,
      videoCreditState: settings.videoCreditState,
      sourcingCache: settings.sourcingCache,
      glmConfigured: Boolean(settings.glmApiKey),
      glmApiKeyMasked: maskSecret(settings.glmApiKey),
      adminStatus: getAdminStatus()
    }
  }

  async function saveSettings(payload = {}, options = {}) {
    const hasSensitiveApiKeyFields = ['apiBaseUrl', 'apiKeys', 'apiKey', 'activeApiKeyIndex', 'glmApiKey', 'copywritingApiBaseUrl', 'copywritingRequestPath', 'videoApiKey', 'videoApiBaseUrl', 'adminPasswordHash'].some((field) => {
      return Object.prototype.hasOwnProperty.call(payload || {}, field)
    })

    if (hasSensitiveApiKeyFields) {
      throw new Error('当前版本不允许用户修改 API-Key')
    }

    const currentSettings = getSettings()
    const {
      creditAdjustment,
      ...restPayload
    } = payload || {}
    const hasUploadDirectoriesPatch = Object.prototype.hasOwnProperty.call(payload, 'uploadDirectories')
    const uploadDirectories = hasUploadDirectoriesPatch
      ? {
          ...normalizeUploadDirectories(currentSettings.uploadDirectories),
          ...normalizeUploadDirectoryPatch(payload.uploadDirectories)
        }
      : normalizeUploadDirectories(currentSettings.uploadDirectories)
    const globalUploadDirectory = Object.prototype.hasOwnProperty.call(payload, 'globalUploadDirectory')
      ? normalizeGlobalUploadDirectory(payload.globalUploadDirectory)
      : normalizeGlobalUploadDirectory(currentSettings.globalUploadDirectory)

    if (hasUploadDirectoriesPatch) {
      validateUploadDirectories(normalizeUploadDirectoryPatch(payload.uploadDirectories), options)
    }

    if (Object.prototype.hasOwnProperty.call(payload, 'globalUploadDirectory')) {
      validateGlobalUploadDirectory(globalUploadDirectory, options)
    }

    let creditState = Object.prototype.hasOwnProperty.call(restPayload, 'creditState')
      ? normalizeCreditState({
          ...currentSettings.creditState,
          ...restPayload.creditState
        })
      : normalizeCreditState(currentSettings.creditState)

    let videoCreditState = Object.prototype.hasOwnProperty.call(restPayload, 'videoCreditState')
      ? normalizeCreditState({
          ...currentSettings.videoCreditState,
          ...restPayload.videoCreditState
        })
      : normalizeCreditState(currentSettings.videoCreditState)

    if (creditAdjustment && typeof creditAdjustment === 'object') {
      creditState = applyCreditAdjustment(creditState, creditAdjustment, options)
    }

    const nextSettings = normalizeSettings({
      ...currentSettings,
      ...restPayload,
      globalUploadDirectory,
      uploadDirectories,
      creditState,
      videoCreditState
    })

    store.set(SETTINGS_KEY, nextSettings)
    return getPublicSettings()
  }

  async function verifyAdminPassword({ password = '' } = {}) {
    const currentSettings = getSettings()
    const normalizedPassword = typeof password === 'string' ? password : ''

    if (!currentSettings.adminPasswordHash) {
      if (!normalizedPassword.trim()) {
        throw new Error('请先输入管理员口令')
      }

      return {
        verified: true,
        requiresSetup: true,
        adminStatus: getAdminStatus()
      }
    }

    if (hashAdminPassword(normalizedPassword) !== currentSettings.adminPasswordHash) {
      throw new Error('管理员验证失败：密码错误')
    }

    return {
      verified: true,
      requiresSetup: false,
      adminStatus: getAdminStatus()
    }
  }

  async function saveAdminApiKey({ apiKey = '', videoApiKey = '', password = '' } = {}) {
    const currentSettings = getSettings()
    const normalizedPassword = typeof password === 'string' ? password : ''

    if (!currentSettings.adminPasswordHash) {
      if (!normalizedPassword.trim()) {
        throw new Error('请先设置管理员口令')
      }
    } else if (hashAdminPassword(normalizedPassword) !== currentSettings.adminPasswordHash) {
      throw new Error('管理员验证失败：密码错误')
    }

    const normalizedApiKey = typeof apiKey === 'string' ? apiKey.trim() : ''
    const normalizedVideoApiKey = typeof videoApiKey === 'string' ? videoApiKey.trim() : ''
    if (!normalizedApiKey && !normalizedVideoApiKey) {
      throw new Error('至少需要填写一个 API-Key')
    }

    const nextApiKeys = normalizedApiKey
      ? normalizeApiKeys([normalizedApiKey, ''])
      : normalizeApiKeys(currentSettings.apiKeys)
    const nextSettings = normalizeSettings({
      ...currentSettings,
      apiKeys: nextApiKeys,
      activeApiKeyIndex: normalizedApiKey ? 0 : currentSettings.activeApiKeyIndex,
      apiKey: normalizedApiKey || currentSettings.apiKey,
      videoApiKey: normalizedVideoApiKey || currentSettings.videoApiKey,
      adminPasswordHash: currentSettings.adminPasswordHash || hashAdminPassword(normalizedPassword)
    })

    store.set(SETTINGS_KEY, nextSettings)
    return {
      saved: true,
      imageApiConfigured: Boolean(nextSettings.apiKey),
      videoApiConfigured: Boolean(nextSettings.videoApiKey),
      adminStatus: {
        passwordConfigured: Boolean(nextSettings.adminPasswordHash),
        imageApiConfigured: Boolean(nextSettings.apiKey),
        videoApiConfigured: Boolean(nextSettings.videoApiKey)
      }
    }
  }

  async function saveGlmApiKey({ apiKey = '' } = {}) {
    const normalizedApiKey = typeof apiKey === 'string' ? apiKey.trim() : ''
    if (!normalizedApiKey) {
      throw new Error('GLM API-Key 不能为空')
    }

    const currentSettings = getSettings()
    const nextSettings = normalizeSettings({
      ...currentSettings,
      glmApiKey: normalizedApiKey
    })

    store.set(SETTINGS_KEY, nextSettings)
    return {
      glmConfigured: true,
      glmApiKeyMasked: maskSecret(normalizedApiKey)
    }
  }

  return {
    getSettings,
    getPublicSettings,
    getAdminStatus,
    saveSettings,
    verifyAdminPassword,
    saveAdminApiKey,
    saveGlmApiKey
  }
}

module.exports = {
  createSettingsStoreService,
  defaultSettings,
  defaultCreditState,
  defaultDashboardCreditState,
  defaultVideoCreditState,
  defaultVideoDashboardCreditState
}
