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

function buildPersistedAuthPlatformPatch(remoteConfig = {}, remoteStatus = {}, remoteServiceCapacity = null) {
  return {
    ...remoteConfig,
    enabled: true,
    sessionToken: String(remoteStatus?.sessionToken || remoteConfig?.sessionToken || '').trim(),
    lastUserId: String(remoteStatus?.userId || '').trim(),
    lastLicenseId: String(remoteStatus?.licenseId || '').trim(),
    lastSyncedAt: new Date().toISOString(),
    remoteServiceCapacity: remoteServiceCapacity || null
  }
}

function createAuthorizationState(overrides = {}) {
  return {
    status: 'not_logged_in',
    mode: 'server-license',
    authType: 'session-token',
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
    remoteServiceCapacity: null,
    message: '',
    nextAction: 'activate-license',
    remoteStatus: '',
    ...overrides
  }
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
    remoteStatus: normalizedStatus
  })
}

function createAuthorizationService({
  remoteLicensePlatformClient,
  settingsService,
  getRemoteConfig = () => ({ enabled: false, baseUrl: '', sessionToken: '' }),
  getDeviceCode = async () => ''
}) {
  if (!remoteLicensePlatformClient || typeof remoteLicensePlatformClient.getAuthorizationStatus !== 'function') {
    throw new Error('remoteLicensePlatformClient is required.')
  }

  async function getRemoteActivationStatus() {
    const remoteConfig = getRemoteConfig() || {}
    const enabled = remoteConfig.enabled !== false
    const sessionToken = String(remoteConfig.sessionToken || '').trim()

    if (!enabled || !sessionToken) {
      return createAuthorizationState({
        deviceCode: await getDeviceCode()
      })
    }

    try {
      const remoteStatus = await remoteLicensePlatformClient.getAuthorizationStatus({
        sessionToken,
        deviceFingerprint: await getDeviceCode()
      })

      let remoteServiceCapacity = null
      if (typeof remoteLicensePlatformClient.getServiceCapacityProfile === 'function') {
        try {
          remoteServiceCapacity = await remoteLicensePlatformClient.getServiceCapacityProfile({
            sessionToken
          })
        } catch {
          remoteServiceCapacity = null
        }
      }

      if (settingsService && typeof settingsService.saveSettings === 'function') {
        await settingsService.saveSettings({
          authPlatform: buildPersistedAuthPlatformPatch(
            remoteConfig,
            remoteStatus,
            remoteServiceCapacity
          )
        }).catch(() => {})
      }

      return {
        ...mapRemoteActivationState(remoteStatus),
        remoteServiceCapacity
      }
    } catch (error) {
      return createAuthorizationState({
        status: 'not_logged_in',
        mode: 'server-license',
        authType: 'session-token',
        canUseApp: false,
        deviceCode: await getDeviceCode(),
        message: String(error?.message || 'remote license platform unavailable').trim(),
        nextAction: 'activate-license',
        remoteStatus: 'request_failed',
        remoteServiceCapacity: getRemoteConfig()?.remoteServiceCapacity || null
      })
    }
  }

  async function getActivationStatus() {
    return getRemoteActivationStatus()
  }

  async function getDeviceCodePayload() {
    return {
      deviceCode: String(await getDeviceCode()).trim()
    }
  }

  return {
    getActivationStatus,
    getDeviceCodePayload
  }
}

module.exports = {
  createAuthorizationService,
  createAuthorizationState
}
