function normalizeLegacyStatus(status = '') {
  if (status === 'activated') {
    return 'activated'
  }

  if (status === 'mismatch') {
    return 'device_mismatch'
  }

  if (status === 'invalid') {
    return 'invalid'
  }

  return 'not_activated'
}

function buildNextAction(status = '') {
  if (status === 'activated') {
    return 'enter-app'
  }

  if (status === 'device_mismatch') {
    return 'contact-support'
  }

  if (status === 'invalid') {
    return 'replace-license'
  }

  if (status === 'not_logged_in') {
    return 'activate-license'
  }

  if (status === 'expired') {
    return 'renew-license'
  }

  return 'activate-license'
}

function createAuthorizationState(overrides = {}) {
  return {
    status: 'not_activated',
    mode: 'legacy-license',
    authType: 'offline-license',
    canUseApp: false,
    customerName: '',
    userId: '',
    licenseId: '',
    inviteCode: '',
    deviceCode: '',
    activatedAt: '',
    expiresAt: '',
    sessionToken: '',
    walletSummary: null,
    activePackage: null,
    message: '',
    nextAction: 'activate-license',
    legacyImportSupported: true,
    legacyStatus: 'not_found',
    remoteStatus: '',
    ...overrides
  }
}

function mapLegacyActivationState(legacyStatus = {}) {
  const normalizedStatus = normalizeLegacyStatus(legacyStatus?.status)

  return createAuthorizationState({
    status: normalizedStatus,
    mode: 'legacy-license',
    authType: 'offline-license',
    canUseApp: normalizedStatus === 'activated',
    customerName: String(legacyStatus?.customerName || '').trim(),
    deviceCode: String(legacyStatus?.deviceCode || '').trim(),
    activatedAt: String(legacyStatus?.activatedAt || '').trim(),
    message: String(legacyStatus?.message || '').trim(),
    nextAction: buildNextAction(normalizedStatus),
    legacyStatus: String(legacyStatus?.status || 'not_found').trim() || 'not_found',
    remoteStatus: ''
  })
}

function mapRemoteActivationState(remoteStatus = {}) {
  const normalizedStatus = String(remoteStatus?.status || '').trim() || 'not_logged_in'
  return createAuthorizationState({
    status: normalizedStatus,
    mode: String(remoteStatus?.mode || 'server-license').trim() || 'server-license',
    authType: String(remoteStatus?.authType || 'session-token').trim() || 'session-token',
    canUseApp: remoteStatus?.canUseApp === true || normalizedStatus === 'activated',
    customerName: String(remoteStatus?.customerName || '').trim(),
    userId: String(remoteStatus?.userId || '').trim(),
    licenseId: String(remoteStatus?.licenseId || '').trim(),
    inviteCode: String(remoteStatus?.inviteCode || '').trim(),
    deviceCode: String(remoteStatus?.deviceCode || '').trim(),
    activatedAt: String(remoteStatus?.activatedAt || '').trim(),
    expiresAt: String(remoteStatus?.expiresAt || '').trim(),
    sessionToken: String(remoteStatus?.sessionToken || '').trim(),
    walletSummary: remoteStatus?.walletSummary || null,
    activePackage: remoteStatus?.activePackage || null,
    message: String(remoteStatus?.message || '').trim(),
    nextAction: String(remoteStatus?.nextAction || buildNextAction(normalizedStatus)).trim(),
    legacyImportSupported: false,
    legacyStatus: '',
    remoteStatus: normalizedStatus
  })
}

function createAuthorizationService({
  legacyLicenseService,
  remoteLicensePlatformClient,
  getRemoteConfig = () => ({ enabled: false, baseUrl: '', sessionToken: '' }),
  getDeviceCode = async () => ''
}) {
  if (!legacyLicenseService || typeof legacyLicenseService.getActivationStatus !== 'function') {
    throw new Error('legacyLicenseService is required.')
  }

  async function getRemoteActivationStatus() {
    if (!remoteLicensePlatformClient || typeof remoteLicensePlatformClient.getAuthorizationStatus !== 'function') {
      return null
    }

    const remoteConfig = getRemoteConfig() || {}
    const enabled = remoteConfig.enabled !== false
    const sessionToken = String(remoteConfig.sessionToken || '').trim()

    if (!enabled || !sessionToken) {
      return null
    }

    try {
      const remoteStatus = await remoteLicensePlatformClient.getAuthorizationStatus({
        sessionToken,
        deviceFingerprint: await getDeviceCode()
      })

      return mapRemoteActivationState(remoteStatus)
    } catch (error) {
      return createAuthorizationState({
        status: 'not_logged_in',
        mode: 'server-license',
        authType: 'session-token',
        canUseApp: false,
        deviceCode: await getDeviceCode(),
        message: String(error?.message || 'remote license platform unavailable').trim(),
        nextAction: 'activate-license',
        legacyImportSupported: true,
        legacyStatus: '',
        remoteStatus: 'request_failed'
      })
    }
  }

  async function getActivationStatus() {
    const remoteStatus = await getRemoteActivationStatus()
    if (remoteStatus && (remoteStatus.canUseApp || remoteStatus.remoteStatus || remoteStatus.status === 'not_logged_in' || remoteStatus.status === 'expired')) {
      return remoteStatus
    }

    const legacyStatus = await legacyLicenseService.getActivationStatus()
    return mapLegacyActivationState(legacyStatus)
  }

  async function getDeviceCodePayload() {
    const payload = await legacyLicenseService.getDeviceCodePayload()
    return {
      deviceCode: String(payload?.deviceCode || '').trim()
    }
  }

  async function importLicenseFromFile(payload = {}) {
    const importResult = await legacyLicenseService.importLicenseFromFile(payload)
    return {
      ...mapLegacyActivationState(importResult),
      canceled: Boolean(importResult?.canceled)
    }
  }

  return {
    getActivationStatus,
    getDeviceCodePayload,
    importLicenseFromFile
  }
}

module.exports = {
  createAuthorizationService,
  createAuthorizationState
}
