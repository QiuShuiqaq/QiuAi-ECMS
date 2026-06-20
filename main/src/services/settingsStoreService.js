const fs = require('node:fs')

const SETTINGS_KEY = 'userSettings'
const API_KEY_SLOT_COUNT = 2
const CREDIT_HISTORY_LIMIT = 20

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
  text: {
    balanceCny: 0,
    lastSyncedAt: '',
    syncStatus: 'idle'
  },
  image: {
    totalCredits: 0,
    remainingCredits: 0,
    balanceCny: 0,
    lastSyncedAt: '',
    syncStatus: 'idle'
  },
  video: {
    balanceCny: 0,
    lastSyncedAt: '',
    syncStatus: 'idle'
  }
}

const defaultAuthPlatform = {
  enabled: true,
  baseUrl: 'https://qiuaihub.com',
  sessionToken: '',
  lastUserId: '',
  lastLicenseId: '',
  lastSyncedAt: '',
  remoteServiceCapacity: null
}

const defaultSettings = {
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
  dashboardCreditState: defaultDashboardCreditState,
  creditState: defaultCreditState,
  authPlatform: defaultAuthPlatform
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
    workspace: typeof source.workspace === 'string' ? source.workspace : '',
    'series-generate': typeof source['series-generate'] === 'string' ? source['series-generate'] : ''
  }
}

function normalizeGlobalUploadDirectory(globalUploadDirectory = '') {
  return typeof globalUploadDirectory === 'string' ? globalUploadDirectory : ''
}

function normalizeProviderApiKeys(providerApiKeys = {}, fallbackApiKey = '') {
  const source = providerApiKeys && typeof providerApiKeys === 'object' ? providerApiKeys : {}
  const normalizedFallbackApiKey = typeof fallbackApiKey === 'string' ? fallbackApiKey.trim() : ''

  return {
    general: typeof source.general === 'string' ? source.general.trim() : normalizedFallbackApiKey,
    deepseek: typeof source.deepseek === 'string' ? source.deepseek.trim() : '',
    minimax: typeof source.minimax === 'string' ? source.minimax.trim() : ''
  }
}

function normalizeDownloadCleanupEnabled(downloadCleanupEnabled = true) {
  return downloadCleanupEnabled !== false
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

function normalizeUploadDirectoryPatch(uploadDirectories = {}) {
  if (!uploadDirectories || typeof uploadDirectories !== 'object') {
    return {}
  }

  const patch = {}

  for (const key of ['workspace', 'series-generate']) {
    if (Object.prototype.hasOwnProperty.call(uploadDirectories, key)) {
      patch[key] = typeof uploadDirectories[key] === 'string' ? uploadDirectories[key] : ''
    }
  }

  return patch
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
        balanceCny: Math.max(0, Number(source.balanceCny) || 0),
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
      balanceCny: Math.max(0, Number(source.image?.balanceCny) || 0),
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

function normalizeAuthPlatform(rawAuthPlatform = {}) {
  const source = rawAuthPlatform && typeof rawAuthPlatform === 'object' ? rawAuthPlatform : {}
  return {
    enabled: source.enabled !== false,
    baseUrl: typeof source.baseUrl === 'string' && source.baseUrl.trim()
      ? source.baseUrl.trim().replace(/\/+$/, '')
      : defaultAuthPlatform.baseUrl,
    sessionToken: typeof source.sessionToken === 'string' ? source.sessionToken.trim() : '',
    lastUserId: typeof source.lastUserId === 'string' ? source.lastUserId.trim() : '',
    lastLicenseId: typeof source.lastLicenseId === 'string' ? source.lastLicenseId.trim() : '',
    lastSyncedAt: typeof source.lastSyncedAt === 'string' ? source.lastSyncedAt : '',
    remoteServiceCapacity: source.remoteServiceCapacity && typeof source.remoteServiceCapacity === 'object'
      ? source.remoteServiceCapacity
      : null
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
    downloadCleanupEnabled: normalizeDownloadCleanupEnabled(mergedSettings.downloadCleanupEnabled),
    globalUploadDirectory: normalizeGlobalUploadDirectory(mergedSettings.globalUploadDirectory),
    uploadDirectories: normalizeUploadDirectories(mergedSettings.uploadDirectories),
    dashboardCreditState: normalizeDashboardCreditState(mergedSettings.dashboardCreditState),
    creditState: normalizeCreditState(mergedSettings.creditState),
    authPlatform: normalizeAuthPlatform(mergedSettings.authPlatform),
    providerApiKeys: normalizeProviderApiKeys(
      mergedSettings.providerApiKeys,
      apiKeys[activeApiKeyIndex] || mergedSettings.apiKey || ''
    ),
    apiKeys,
    activeApiKeyIndex,
    apiKey: apiKeys[activeApiKeyIndex] || ''
  }
}

function createSettingsStoreService({ store }) {
  function getSettings() {
    return normalizeSettings(store.get(SETTINGS_KEY, {}))
  }

  async function saveSettings(payload = {}, options = {}) {
    const hasSensitiveApiKeyFields = ['apiKeys', 'apiKey', 'activeApiKeyIndex'].some((field) => {
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

    if (creditAdjustment && typeof creditAdjustment === 'object') {
      creditState = applyCreditAdjustment(creditState, creditAdjustment, options)
    }

    const nextSettings = normalizeSettings({
      ...currentSettings,
      ...restPayload,
      globalUploadDirectory,
      uploadDirectories,
      creditState
    })

    store.set(SETTINGS_KEY, nextSettings)
    return nextSettings
  }

  async function saveProviderApiKeys({ imageApiKey = '', textApiKey = '', videoApiKey = '' } = {}) {
    const normalizedImageApiKey = typeof imageApiKey === 'string' ? imageApiKey.trim() : ''
    const normalizedTextApiKey = typeof textApiKey === 'string' ? textApiKey.trim() : ''
    const normalizedVideoApiKey = typeof videoApiKey === 'string' ? videoApiKey.trim() : ''

    if (!normalizedImageApiKey && !normalizedTextApiKey && !normalizedVideoApiKey) {
      throw new Error('API-Key 不能为空')
    }

    const currentSettings = getSettings()
    const nextGeneralApiKey = normalizedImageApiKey || currentSettings.providerApiKeys?.general || currentSettings.apiKey || ''
    const nextApiKeys = normalizeApiKeys([nextGeneralApiKey, ''])
    const nextSettings = normalizeSettings({
      ...currentSettings,
      apiKeys: nextApiKeys,
      activeApiKeyIndex: 0,
      apiKey: nextGeneralApiKey,
      providerApiKeys: {
        general: nextGeneralApiKey,
        deepseek: normalizedTextApiKey || currentSettings.providerApiKeys?.deepseek || '',
        minimax: normalizedVideoApiKey || currentSettings.providerApiKeys?.minimax || ''
      }
    })

    store.set(SETTINGS_KEY, nextSettings)
    return nextSettings
  }

  return {
    getSettings,
    saveSettings,
    saveProviderApiKeys
  }
}

module.exports = {
  createSettingsStoreService,
  defaultSettings,
  defaultCreditState,
  defaultDashboardCreditState,
  defaultAuthPlatform
}
