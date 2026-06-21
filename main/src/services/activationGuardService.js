function createActivationGuardService({ authorizationService }) {
  if (!authorizationService || typeof authorizationService.getActivationStatus !== 'function') {
    throw new Error('authorizationService is required.')
  }

  async function getActivationStatus() {
    return authorizationService.getActivationStatus()
  }

  async function assertActivated() {
    const activationStatus = await getActivationStatus()
    if (!activationStatus.canUseApp && activationStatus.status !== 'activated') {
      throw new Error(activationStatus.message || '未检测到有效授权')
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
