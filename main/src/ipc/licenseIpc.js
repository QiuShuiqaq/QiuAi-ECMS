const { ipcMain } = require('electron')
const ipcChannels = require('../../../shared/ipcChannels')

function trimString(value = '') {
  return typeof value === 'string' ? value.trim() : ''
}

async function saveRemoteAuthPlatformState({ settingsService, activationPayload }) {
  const nowIso = new Date().toISOString()
  return settingsService.saveSettings({
    authPlatform: {
      enabled: true,
      sessionToken: trimString(activationPayload?.sessionToken),
      lastUserId: trimString(activationPayload?.userId),
      lastLicenseId: trimString(activationPayload?.licenseId),
      lastSyncedAt: nowIso
    }
  })
}

async function getSessionToken(settingsService) {
  const settings = await settingsService.getSettings()
  return trimString(settings?.authPlatform?.sessionToken)
}

async function requireSessionToken(settingsService) {
  const sessionToken = await getSessionToken(settingsService)
  if (sessionToken) {
    return sessionToken
  }

  const error = new Error('Remote authorization is required before using commerce features.')
  error.code = 'REMOTE_AUTH_REQUIRED'
  throw error
}

async function buildSoftwareOrderPayload({ settingsService, authorizationService, payload = {} }) {
  const sessionToken = await getSessionToken(settingsService)
  const deviceCodePayload = await authorizationService.getDeviceCodePayload()

  return {
    ...payload,
    sessionToken,
    deviceFingerprint: trimString(payload.deviceFingerprint || deviceCodePayload?.deviceCode),
    deviceName: trimString(payload.deviceName || 'QiuAi Desktop')
  }
}

function registerLicenseIpc({
  authorizationService,
  remoteLicensePlatformClient,
  settingsService
}) {
  ipcMain.handle(ipcChannels.LICENSE_GET_STATUS, () => {
    return authorizationService.getActivationStatus()
  })

  ipcMain.handle(ipcChannels.LICENSE_GET_DEVICE_CODE, () => {
    return authorizationService.getDeviceCodePayload()
  })

  ipcMain.handle(ipcChannels.LICENSE_REMOTE_ACTIVATE, async (_event, payload = {}) => {
    const deviceCodePayload = await authorizationService.getDeviceCodePayload()
    const activationPayload = await remoteLicensePlatformClient.activateLicense({
      customerName: trimString(payload.customerName),
      contact: trimString(payload.contact),
      inviteCode: trimString(payload.inviteCode),
      durationDays: payload.durationDays,
      deviceName: trimString(payload.deviceName),
      deviceFingerprint: trimString(deviceCodePayload?.deviceCode)
    })

    await saveRemoteAuthPlatformState({
      settingsService,
      activationPayload
    })

    return authorizationService.getActivationStatus()
  })

  ipcMain.handle(ipcChannels.LICENSE_LIST_PACKAGES, async () => {
    return remoteLicensePlatformClient.listSoftwarePackages({
      sessionToken: await getSessionToken(settingsService)
    })
  })

  ipcMain.handle(ipcChannels.LICENSE_CREATE_ORDER, async (_event, payload = {}) => {
    return remoteLicensePlatformClient.createSoftwareOrder(
      await buildSoftwareOrderPayload({
        settingsService,
        authorizationService,
        payload
      })
    )
  })

  ipcMain.handle(ipcChannels.LICENSE_GET_ORDER, async (_event, payload = {}) => {
    return remoteLicensePlatformClient.getSoftwareOrder({
      ...payload,
      sessionToken: await getSessionToken(settingsService)
    })
  })

  ipcMain.handle(ipcChannels.COMPUTE_PACKAGE_LIST, async () => {
    const sessionToken = await requireSessionToken(settingsService)
    return remoteLicensePlatformClient.listComputePackages({
      sessionToken
    })
  })

  ipcMain.handle(ipcChannels.COMPUTE_PACKAGE_CREATE_ORDER, async (_event, payload = {}) => {
    const sessionToken = await requireSessionToken(settingsService)
    return remoteLicensePlatformClient.createComputePackageOrder({
      ...payload,
      sessionToken
    })
  })

  ipcMain.handle(ipcChannels.COMPUTE_PACKAGE_GET_ORDER, async (_event, payload = {}) => {
    const sessionToken = await requireSessionToken(settingsService)
    return remoteLicensePlatformClient.getComputePackageOrder({
      ...payload,
      sessionToken
    })
  })

  ipcMain.handle(ipcChannels.RECHARGE_CREATE_ORDER, async (_event, payload = {}) => {
    const sessionToken = await requireSessionToken(settingsService)
    return remoteLicensePlatformClient.createRechargeOrder({
      ...payload,
      sessionToken
    })
  })

  ipcMain.handle(ipcChannels.RECHARGE_GET_ORDER, async (_event, payload = {}) => {
    const sessionToken = await requireSessionToken(settingsService)
    return remoteLicensePlatformClient.getRechargeOrder({
      ...payload,
      sessionToken
    })
  })
}

module.exports = registerLicenseIpc
