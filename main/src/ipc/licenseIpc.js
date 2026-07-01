const { ipcMain } = require('electron')
const ipcChannels = require('../../../shared/ipcChannels')
const {
  buildUserAgreementState,
  createAcceptedAgreementRecord
} = require('../services/userAgreementService')
const { isDevBypassLicenseEnabled } = require('../services/authorizationService')

function trimString(value = '') {
  return typeof value === 'string' ? value.trim() : ''
}

async function saveRemoteAuthPlatformState({ settingsService, activationPayload, requestPayload = {} }) {
  const nowIso = new Date().toISOString()
  return settingsService.saveSettings({
    authPlatform: {
      enabled: true,
      sessionToken: trimString(activationPayload?.sessionToken),
      lastUserId: trimString(activationPayload?.userId),
      lastLicenseId: trimString(activationPayload?.licenseId),
      customerName: trimString(activationPayload?.customerName || requestPayload?.customerName),
      contact: trimString(activationPayload?.contact || requestPayload?.contact),
      inviteCode: trimString(activationPayload?.inviteCode || requestPayload?.inviteCode),
      lastSyncedAt: nowIso
    }
  })
}

async function clearRemoteAuthPlatformState({ settingsService }) {
  return settingsService.saveSettings({
    authPlatform: {
      enabled: true,
      sessionToken: '',
      lastUserId: '',
      lastLicenseId: '',
      customerName: '',
      contact: '',
      inviteCode: '',
      lastSyncedAt: '',
      remoteServiceCapacity: null
    },
    compliance: {
      userAgreement: {
        version: '',
        accepted: false,
        acceptedAt: '',
        userId: '',
        licenseId: '',
        deviceCode: '',
        customerName: ''
      }
    }
  })
}

async function getSessionToken(settingsService) {
  const settings = settingsService.getSettings()
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

async function getUserAgreementStatus({ authorizationService, settingsService }) {
  const activationStatus = await authorizationService.getActivationStatus()
  if (activationStatus?.devBypassLicense === true || isDevBypassLicenseEnabled()) {
    return {
      title: '用户须知与使用协议暨责任认定书',
      version: 'DEV-BYPASS',
      accepted: true,
      acceptedAt: new Date().toISOString(),
      shouldShow: false,
      userId: trimString(activationStatus?.userId),
      licenseId: trimString(activationStatus?.licenseId),
      deviceCode: trimString(activationStatus?.deviceCode),
      customerName: trimString(activationStatus?.customerName),
      source: 'DEV_BYPASS'
    }
  }

  const settings = settingsService.getSettings()
  return buildUserAgreementState(
    settings?.compliance?.userAgreement,
    activationStatus
  )
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

  ipcMain.handle(ipcChannels.LICENSE_GET_USER_AGREEMENT_STATUS, async () => {
    return getUserAgreementStatus({
      authorizationService,
      settingsService
    })
  })

  ipcMain.handle(ipcChannels.LICENSE_ACCEPT_USER_AGREEMENT, async () => {
    const activationStatus = await authorizationService.getActivationStatus()
    if (activationStatus?.devBypassLicense === true || isDevBypassLicenseEnabled()) {
      return getUserAgreementStatus({
        authorizationService,
        settingsService
      })
    }

    if (activationStatus.status !== 'activated') {
      const error = new Error('Device must be activated before accepting the user agreement.')
      error.code = 'USER_AGREEMENT_ACTIVATION_REQUIRED'
      throw error
    }

    const agreementRecord = createAcceptedAgreementRecord(activationStatus)

    await settingsService.saveSettings({
      compliance: {
        userAgreement: agreementRecord
      }
    })

    // Remote syncing is best-effort only and must not block desktop usage.
    try {
      const sessionToken = await getSessionToken(settingsService)
      const remoteAcceptUserAgreement = remoteLicensePlatformClient?.['acceptUserAgreement']
      if (sessionToken && typeof remoteAcceptUserAgreement === 'function') {
        await remoteAcceptUserAgreement({
          sessionToken,
          agreementTitle: agreementRecord.title,
          agreementVersion: agreementRecord.version,
          deviceId: agreementRecord.deviceCode,
          source: agreementRecord.source
        })
      }
    } catch (error) {
      console.warn('[license] user agreement sync skipped:', error?.message || error)
    }

    return getUserAgreementStatus({
      authorizationService,
      settingsService
    })
  })

  ipcMain.handle(ipcChannels.LICENSE_REMOTE_ACTIVATE, async (_event, payload = {}) => {
    const deviceCodePayload = await authorizationService.getDeviceCodePayload()
    const requestPayload = {
      customerName: trimString(payload.customerName),
      contact: trimString(payload.contact),
      inviteCode: trimString(payload.inviteCode),
      durationDays: payload.durationDays,
      deviceName: trimString(payload.deviceName || 'QiuAi Desktop'),
      deviceFingerprint: trimString(deviceCodePayload?.deviceCode)
    }
    const activationPayload = await remoteLicensePlatformClient.activateLicense(requestPayload)

    await saveRemoteAuthPlatformState({
      settingsService,
      activationPayload,
      requestPayload
    })

    return authorizationService.getActivationStatus()
  })

  ipcMain.handle(ipcChannels.LICENSE_CLEAR_LOCAL_AUTH, async () => {
    await clearRemoteAuthPlatformState({
      settingsService
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
    try {
      const sessionToken = await requireSessionToken(settingsService)
      return await remoteLicensePlatformClient.listComputePackages({
        sessionToken
      })
    } catch (error) {
      if (
        error?.code === 'REMOTE_AUTH_REQUIRED' ||
        error?.code === 'PLATFORM_SESSION_INVALID'
      ) {
        return []
      }

      throw error
    }
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
