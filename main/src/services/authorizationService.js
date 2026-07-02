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

function trimString(value = '') {
  return typeof value === 'string' ? value.trim() : ''
}

function isTruthyEnvValue(value = '') {
  const normalizedValue = trimString(value).toLowerCase()
  return normalizedValue === '1' || normalizedValue === 'true' || normalizedValue === 'yes' || normalizedValue === 'on'
}

function isDevBypassLicenseEnabled() {
  return isTruthyEnvValue(process.env.DEV_BYPASS_LICENSE || '') &&
    Boolean(trimString(process.env.DEV_PLATFORM_SESSION_TOKEN))
}

function buildDevBypassConfig() {
  return {
    enabled: isDevBypassLicenseEnabled(),
    sessionToken: trimString(process.env.DEV_PLATFORM_SESSION_TOKEN),
    userId: trimString(process.env.DEV_TEST_USER_ID) || 'dev-user',
    licenseId: trimString(process.env.DEV_TEST_LICENSE_ID) || 'dev-license',
    customerName: trimString(process.env.DEV_TEST_USER_NAME) || 'Dev Test User',
    inviteCode: trimString(process.env.DEV_TEST_INVITE_CODE),
    activatedAt: trimString(process.env.DEV_TEST_ACTIVATED_AT) || '2026-01-01T00:00:00.000Z',
    expiresAt: trimString(process.env.DEV_TEST_EXPIRES_AT) || '2099-12-31T23:59:59.999Z'
  }
}

function buildPersistedAuthPlatformPatch(remoteConfig = {}, remoteStatus = {}, remoteServiceCapacity = null) {
  return {
    ...remoteConfig,
    enabled: true,
    sessionToken: trimString(remoteStatus?.sessionToken || remoteConfig?.sessionToken || ''),
    lastUserId: trimString(remoteStatus?.userId || ''),
    lastLicenseId: trimString(remoteStatus?.licenseId || ''),
    lastSyncedAt: new Date().toISOString(),
    remoteServiceCapacity: remoteServiceCapacity || null
  }
}

function buildLoggedOutAuthPlatformPatch(remoteConfig = {}) {
  return {
    ...remoteConfig,
    enabled: true,
    sessionToken: '',
    lastUserId: '',
    lastLicenseId: '',
    lastSyncedAt: new Date().toISOString(),
    remoteServiceCapacity: null
  }
}

function buildActivationPayloadFromPersistedConfig(remoteConfig = {}, deviceCode = '') {
  const customerName = trimString(remoteConfig?.customerName || '')
  const contact = trimString(remoteConfig?.contact || '')

  if (!customerName || !contact) {
    return null
  }

  return {
    customerName,
    contact,
    inviteCode: trimString(remoteConfig?.inviteCode || ''),
    deviceName: 'QiuAi Desktop',
    deviceFingerprint: trimString(deviceCode)
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
    devBypassLicense: false,
    ...overrides
  }
}

function mapRemoteActivationState(remoteStatus = {}) {
  const normalizedStatus = trimString(remoteStatus?.status || '') || 'not_logged_in'
  return createAuthorizationState({
    status: normalizedStatus,
    mode: trimString(remoteStatus?.mode || 'server-license') || 'server-license',
    authType: trimString(remoteStatus?.authType || 'session-token') || 'session-token',
    canUseApp: remoteStatus?.canUseApp === true || normalizedStatus === 'activated',
    customerName: trimString(remoteStatus?.customerName || ''),
    userId: trimString(remoteStatus?.userId || ''),
    licenseId: trimString(remoteStatus?.licenseId || ''),
    inviteCode: trimString(remoteStatus?.inviteCode || ''),
    deviceCode: trimString(remoteStatus?.deviceCode || ''),
    activatedAt: trimString(remoteStatus?.activatedAt || ''),
    expiresAt: trimString(remoteStatus?.expiresAt || ''),
    sessionToken: trimString(remoteStatus?.sessionToken || ''),
    walletSummary: remoteStatus?.walletSummary || null,
    activePackage: remoteStatus?.activePackage || null,
    message: trimString(remoteStatus?.message || ''),
    nextAction: trimString(remoteStatus?.nextAction || buildNextAction(normalizedStatus)),
    remoteStatus: normalizedStatus
  })
}

function shouldClearPersistedSessionForStatus(status = '') {
  return ['not_logged_in', 'invalid', 'expired', 'device_mismatch'].includes(trimString(status))
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

  let cachedActivationStatus = null
  let cachedActivationStatusAt = 0
  let inflightActivationStatusPromise = null
  const activationStatusCacheTtlMs = 5000

  function getCachedActivationStatus() {
    if (!cachedActivationStatus) {
      return null
    }

    if (Date.now() - cachedActivationStatusAt > activationStatusCacheTtlMs) {
      cachedActivationStatus = null
      cachedActivationStatusAt = 0
      return null
    }

    return cachedActivationStatus
  }

  function setCachedActivationStatus(status = null) {
    cachedActivationStatus = status
    cachedActivationStatusAt = status ? Date.now() : 0
  }

  function clearActivationStatusCache() {
    cachedActivationStatus = null
    cachedActivationStatusAt = 0
    inflightActivationStatusPromise = null
  }

  async function getDevBypassActivationStatus() {
    const devConfig = buildDevBypassConfig()
    if (!devConfig.enabled) {
      return null
    }

    return createAuthorizationState({
      status: 'activated',
      mode: 'dev-bypass',
      authType: 'dev-session-token',
      canUseApp: true,
      customerName: devConfig.customerName,
      userId: devConfig.userId,
      licenseId: devConfig.licenseId,
      inviteCode: devConfig.inviteCode,
      deviceCode: trimString(await getDeviceCode()),
      activatedAt: devConfig.activatedAt,
      expiresAt: devConfig.expiresAt,
      sessionToken: devConfig.sessionToken,
      message: 'development license bypass enabled',
      nextAction: 'enter-app',
      remoteStatus: 'activated',
      devBypassLicense: true
    })
  }

  async function loadRemoteServiceCapacity(sessionToken = '') {
    const normalizedSessionToken = trimString(sessionToken)
    if (!normalizedSessionToken || typeof remoteLicensePlatformClient.getServiceCapacityProfile !== 'function') {
      return null
    }

    try {
      return await remoteLicensePlatformClient.getServiceCapacityProfile({
        sessionToken: normalizedSessionToken
      })
    } catch {
      return null
    }
  }

  async function reactivateFromPersistedIdentity(remoteConfig = {}, deviceCode = '') {
    if (typeof remoteLicensePlatformClient.activateLicense !== 'function') {
      return null
    }

    const activationPayload = buildActivationPayloadFromPersistedConfig(remoteConfig, deviceCode)
    if (!activationPayload) {
      return null
    }

    try {
      const reactivatedStatus = await remoteLicensePlatformClient.activateLicense(activationPayload)
      const reactivatedSessionToken = trimString(reactivatedStatus?.sessionToken || '')
      const remoteServiceCapacity = await loadRemoteServiceCapacity(reactivatedSessionToken)

      if (settingsService && typeof settingsService.saveSettings === 'function') {
        await settingsService.saveSettings({
          authPlatform: buildPersistedAuthPlatformPatch(
            remoteConfig,
            reactivatedStatus,
            remoteServiceCapacity
          )
        }).catch(() => {})
      }

      return {
        ...mapRemoteActivationState(reactivatedStatus),
        remoteServiceCapacity
      }
    } catch {
      return null
    }
  }

  async function getRemoteActivationStatus() {
    const cachedStatus = getCachedActivationStatus()
    if (cachedStatus) {
      return cachedStatus
    }

    if (inflightActivationStatusPromise) {
      return inflightActivationStatusPromise
    }

    const remoteConfig = getRemoteConfig() || {}
    const enabled = remoteConfig.enabled !== false
    const sessionToken = trimString(remoteConfig.sessionToken || '')
    const deviceCode = await getDeviceCode()

    if (!enabled || !sessionToken) {
      const state = createAuthorizationState({
        deviceCode
      })
      setCachedActivationStatus(state)
      return state
    }

    inflightActivationStatusPromise = (async () => {
      try {
      const remoteStatus = await remoteLicensePlatformClient.getAuthorizationStatus({
        sessionToken,
        deviceFingerprint: deviceCode
      })

      if (trimString(remoteStatus?.status || '') === 'not_logged_in') {
        const reactivatedState = await reactivateFromPersistedIdentity(remoteConfig, deviceCode)
        if (reactivatedState) {
          return reactivatedState
        }
      }

      const remoteServiceCapacity = await loadRemoteServiceCapacity(sessionToken)

      if (settingsService && typeof settingsService.saveSettings === 'function') {
        await settingsService.saveSettings({
          authPlatform: buildPersistedAuthPlatformPatch(
            remoteConfig,
            remoteStatus,
            remoteServiceCapacity
          )
        }).catch(() => {})
      }

      if (shouldClearPersistedSessionForStatus(remoteStatus?.status)) {
        if (settingsService && typeof settingsService.saveSettings === 'function') {
          await settingsService.saveSettings({
            authPlatform: buildLoggedOutAuthPlatformPatch(remoteConfig)
          }).catch(() => {})
        }
      }

      const state = {
        ...mapRemoteActivationState(remoteStatus),
        remoteServiceCapacity
      }
      setCachedActivationStatus(state)
      return state
      } catch (error) {
      const statusCode = Number(error?.details?.statusCode || 0)
      const shouldRetryActivate = statusCode === 401
      const shouldClearPersistedSession = statusCode === 401 || statusCode === 404

      if (shouldRetryActivate) {
        const reactivatedState = await reactivateFromPersistedIdentity(remoteConfig, deviceCode)
        if (reactivatedState) {
          return reactivatedState
        }
      }

      if (shouldClearPersistedSession && settingsService && typeof settingsService.saveSettings === 'function') {
        await settingsService.saveSettings({
          authPlatform: buildLoggedOutAuthPlatformPatch(remoteConfig)
        }).catch(() => {})
      }

      const state = createAuthorizationState({
        status: 'not_logged_in',
        mode: 'server-license',
        authType: 'session-token',
        canUseApp: false,
        deviceCode,
        message: trimString(error?.message || 'remote license platform unavailable'),
        nextAction: 'activate-license',
        remoteStatus: 'request_failed',
        remoteServiceCapacity: getRemoteConfig()?.remoteServiceCapacity || null
      })
      setCachedActivationStatus(state)
      return state
      } finally {
        inflightActivationStatusPromise = null
      }
    })()

    return inflightActivationStatusPromise
  }

  async function getActivationStatus() {
    const devBypassActivationStatus = await getDevBypassActivationStatus()
    if (devBypassActivationStatus) {
      return devBypassActivationStatus
    }

    return getRemoteActivationStatus()
  }

  async function getDeviceCodePayload() {
    return {
      deviceCode: trimString(await getDeviceCode())
    }
  }

  return {
    getActivationStatus,
    clearActivationStatusCache,
    getDeviceCodePayload
  }
}

module.exports = {
  createAuthorizationService,
  createAuthorizationState,
  isDevBypassLicenseEnabled
}
