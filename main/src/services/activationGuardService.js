const { isAgreementAcceptedForActivation } = require('./userAgreementService')

function createActivationGuardService({ authorizationService, settingsService }) {
  if (!authorizationService || typeof authorizationService.getActivationStatus !== 'function') {
    throw new Error('authorizationService is required.')
  }

  if (!settingsService || typeof settingsService.getSettings !== 'function') {
    throw new Error('settingsService is required.')
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

    const agreementRecord = settingsService.getSettings()?.compliance?.userAgreement || {}
    if (!isAgreementAcceptedForActivation(agreementRecord, activationStatus)) {
      const error = new Error('Please accept the user agreement before using the app.')
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
