function createActivationGuardService({ authorizationService, licenseService }) {
  const statusService = authorizationService || licenseService

  if (!statusService || typeof statusService.getActivationStatus !== 'function') {
    throw new Error('authorizationService or licenseService is required.')
  }

  async function getActivationStatus() {
    return statusService.getActivationStatus()
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
