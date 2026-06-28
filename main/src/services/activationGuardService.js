function createActivationGuardService({ authorizationService, settingsService, remoteLicensePlatformClient }) {
  if (!authorizationService || typeof authorizationService.getActivationStatus !== 'function') {
    throw new Error('authorizationService is required.')
  }

  if (!settingsService || typeof settingsService.getSettings !== 'function') {
    throw new Error('settingsService is required.')
  }

  if (!remoteLicensePlatformClient || typeof remoteLicensePlatformClient.getUserAgreementStatus !== 'function') {
    throw new Error('remoteLicensePlatformClient is required.')
  }

  async function getActivationStatus() {
    return authorizationService.getActivationStatus()
  }

  async function assertActivated() {
    const activationStatus = await getActivationStatus()
    if (!activationStatus.canUseApp && activationStatus.status !== 'activated') {
      throw new Error(activationStatus.message || 'No valid authorization was detected.')
    }

    if (activationStatus?.devBypassLicense === true) {
      return activationStatus
    }

    const sessionToken = String(settingsService.getSettings()?.authPlatform?.sessionToken || '').trim()
    const agreementState = sessionToken
      ? await remoteLicensePlatformClient.getUserAgreementStatus({ sessionToken }).catch(() => null)
      : null

    if (agreementState?.accepted !== true) {
      const error = new Error('User agreement must be accepted before using the app.')
      error.code = 'USER_AGREEMENT_REQUIRED'
      throw error
    }

    return activationStatus
  }

  return {
    getActivationStatus,
    assertActivated
  }
}

module.exports = {
  createActivationGuardService
}
