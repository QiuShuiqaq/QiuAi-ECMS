const fs = require('node:fs')
const { normalizeCompliance } = require('./userAgreementService')

const SETTINGS_KEY = 'userSettings'

const defaultDashboardCreditState = {
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

const defaultAuthPlatform = {
  enabled: true,
  baseUrl: 'https://api.qiuaihub.com',
  sessionToken: '',
  lastUserId: '',
  lastLicenseId: '',
  customerName: '',
  contact: '',
  inviteCode: '',
  lastSyncedAt: '',
  remoteServiceCapacity: null
}

const defaultCompliance = {
  userAgreement: {
    version: '',
    accepted: false,
    acceptedAt: '',
    userId: '',
    licenseId: '',
    deviceCode: ''
  }
}

function trimString(value = '') {
  return typeof value === 'string' ? value.trim() : ''
}

function isTruthyEnvValue(value = '') {
  const normalizedValue = trimString(value).toLowerCase()
  return normalizedValue === '1' || normalizedValue === 'true' || normalizedValue === 'yes' || normalizedValue === 'on'
}

function buildDevBypassAuthPlatformDefaults() {
  const enabled = isTruthyEnvValue(process.env.DEV_BYPASS_LICENSE || '') &&
    Boolean(trimString(process.env.DEV_PLATFORM_SESSION_TOKEN))
  return {
    enabled,
    sessionToken: trimString(process.env.DEV_PLATFORM_SESSION_TOKEN),
    lastUserId: trimString(process.env.DEV_TEST_USER_ID),
    lastLicenseId: trimString(process.env.DEV_TEST_LICENSE_ID)
  }
}

function normalizeAuthPlatformBaseUrl(baseUrl = '') {
  const normalizedBaseUrl = typeof baseUrl === 'string' && baseUrl.trim()
    ? baseUrl.trim().replace(/\/+$/, '')
    : defaultAuthPlatform.baseUrl

  if (normalizedBaseUrl === 'https://qiuaihub.com') {
    return defaultAuthPlatform.baseUrl
  }

  return normalizedBaseUrl
}

const defaultSettings = {
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
  authPlatform: defaultAuthPlatform,
  compliance: defaultCompliance
}

function normalizeThemeMode() {
  return 'dark'
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

function normalizeDownloadCleanupEnabled(downloadCleanupEnabled = true) {
  return downloadCleanupEnabled !== false
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

function normalizeDashboardCreditState(rawDashboardCreditState = {}) {
  const source = rawDashboardCreditState && typeof rawDashboardCreditState === 'object'
    ? rawDashboardCreditState
    : {}

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

function normalizeAuthPlatform(rawAuthPlatform = {}) {
  const source = rawAuthPlatform && typeof rawAuthPlatform === 'object' ? rawAuthPlatform : {}
  const devBypassDefaults = buildDevBypassAuthPlatformDefaults()
  const sourceSessionToken = typeof source.sessionToken === 'string' ? source.sessionToken.trim() : ''
  const sourceLastUserId = typeof source.lastUserId === 'string' ? source.lastUserId.trim() : ''
  const sourceLastLicenseId = typeof source.lastLicenseId === 'string' ? source.lastLicenseId.trim() : ''

  return {
    enabled: devBypassDefaults.enabled ? true : source.enabled !== false,
    baseUrl: normalizeAuthPlatformBaseUrl(source.baseUrl),
    sessionToken: sourceSessionToken || (devBypassDefaults.enabled ? devBypassDefaults.sessionToken : ''),
    lastUserId: sourceLastUserId || (devBypassDefaults.enabled ? devBypassDefaults.lastUserId : ''),
    lastLicenseId: sourceLastLicenseId || (devBypassDefaults.enabled ? devBypassDefaults.lastLicenseId : ''),
    customerName: typeof source.customerName === 'string' ? source.customerName.trim() : '',
    contact: typeof source.contact === 'string' ? source.contact.trim() : '',
    inviteCode: typeof source.inviteCode === 'string' ? source.inviteCode.trim() : '',
    lastSyncedAt: typeof source.lastSyncedAt === 'string' ? source.lastSyncedAt : '',
    remoteServiceCapacity: source.remoteServiceCapacity && typeof source.remoteServiceCapacity === 'object'
      ? source.remoteServiceCapacity
      : null
  }
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
      throw new Error('???????????????')
    }
  }
}

function validateGlobalUploadDirectory(globalUploadDirectory = '', { isDirectory = defaultIsDirectory } = {}) {
  const normalizedPath = normalizeGlobalUploadDirectory(globalUploadDirectory)
  if (!normalizedPath) {
    return
  }

  if (!isDirectory(normalizedPath)) {
    throw new Error('???????????????')
  }
}

function normalizeSettings(rawSettings = {}) {
  const mergedSettings = {
    ...defaultSettings,
    ...rawSettings
  }
  const {
    defaultSize,
    downloadDirectory,
    globalUploadDirectory,
    uploadDirectories,
    downloadCleanupEnabled,
    dashboardCreditState,
    authPlatform,
    compliance
  } = mergedSettings

  return {
    defaultSize: typeof defaultSize === 'string' ? defaultSize : defaultSettings.defaultSize,
    downloadDirectory: typeof downloadDirectory === 'string' ? downloadDirectory : '',
    globalUploadDirectory: normalizeGlobalUploadDirectory(globalUploadDirectory),
    uploadDirectories: normalizeUploadDirectories(uploadDirectories),
    themeMode: normalizeThemeMode(mergedSettings.themeMode),
    downloadCleanupEnabled: normalizeDownloadCleanupEnabled(downloadCleanupEnabled),
    dashboardCreditState: normalizeDashboardCreditState(dashboardCreditState),
    authPlatform: normalizeAuthPlatform(authPlatform),
    compliance: normalizeCompliance(compliance)
  }
}

function createSettingsStoreService({ store }) {
  function getSettings() {
    return normalizeSettings(store.get(SETTINGS_KEY, {}))
  }

  async function saveSettings(payload = {}, options = {}) {
    const currentSettings = getSettings()
    const restPayload = payload || {}
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

    const nextSettings = normalizeSettings({
      ...currentSettings,
      ...restPayload,
      globalUploadDirectory,
      uploadDirectories
    })

    store.set(SETTINGS_KEY, nextSettings)
    return nextSettings
  }

  return {
    getSettings,
    saveSettings
  }
}

module.exports = {
  createSettingsStoreService,
  defaultSettings,
  defaultDashboardCreditState,
  defaultAuthPlatform,
  defaultCompliance
}
