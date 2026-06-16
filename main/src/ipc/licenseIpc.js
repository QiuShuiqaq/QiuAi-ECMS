const { dialog, ipcMain } = require('electron')
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

  ipcMain.handle(ipcChannels.LICENSE_IMPORT_FILE, async (_event, payload = {}) => {
    const requestedFilePath = typeof payload.filePath === 'string' ? payload.filePath.trim() : ''
    let filePath = requestedFilePath

    if (!filePath) {
      const result = await dialog.showOpenDialog({
        properties: ['openFile'],
        filters: [
          {
            name: 'QiuAi License',
            extensions: ['qai']
          }
        ]
      })

      if (result.canceled || !result.filePaths?.[0]) {
        return {
          ...(await authorizationService.getActivationStatus()),
          canceled: true
        }
      }

      ;[filePath] = result.filePaths
    }

    return {
      ...(await authorizationService.importLicenseFromFile({ filePath })),
      canceled: false
    }
  })

  ipcMain.handle(ipcChannels.LICENSE_REFRESH, () => {
    return authorizationService.getActivationStatus()
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

  ipcMain.handle(ipcChannels.RECHARGE_CREATE_ORDER, async (_event, payload = {}) => {
    const sessionToken = await getSessionToken(settingsService)
    return remoteLicensePlatformClient.createRechargeOrder({
      ...payload,
      sessionToken
    })
  })

  ipcMain.handle(ipcChannels.RECHARGE_GET_ORDER, async (_event, payload = {}) => {
    const sessionToken = await getSessionToken(settingsService)
    return remoteLicensePlatformClient.getRechargeOrder({
      ...payload,
      sessionToken
    })
  })
}

module.exports = registerLicenseIpc
