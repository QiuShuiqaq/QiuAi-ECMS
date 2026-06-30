function createWorkspaceCreditService({
  settingsService,
  remoteLicensePlatformClient,
  getNow
} = {}) {
  function getRemoteWalletResourceBalance(walletSummary = {}, resourceKey = 'image') {
    const splitBalance = walletSummary?.splitBalances?.[resourceKey]
    if (splitBalance && typeof splitBalance === 'object') {
      return {
        total: Math.max(0, Number(splitBalance.totalBalanceCny) || 0),
        subscription: Math.max(0, Number(splitBalance.subscriptionBalanceCny) || 0),
        permanent: Math.max(0, Number(splitBalance.permanentBalanceCny) || 0)
      }
    }

    const subscription = Math.max(0, Number(walletSummary?.subscriptionBalances?.[resourceKey]) || 0)
    const permanent = Math.max(0, Number(walletSummary?.permanentBalances?.[resourceKey]) || 0)

    return {
      total: subscription + permanent,
      subscription,
      permanent
    }
  }

  function getCurrentDashboardCreditState() {
    const settings = settingsService.getSettings()
    return settings.dashboardCreditState && typeof settings.dashboardCreditState === 'object'
      ? settings.dashboardCreditState
      : {
          text: { balanceCny: 0, subscriptionBalanceCny: 0, permanentBalanceCny: 0, lastSyncedAt: '', syncStatus: 'idle' },
          image: { balanceCny: 0, subscriptionBalanceCny: 0, permanentBalanceCny: 0, lastSyncedAt: '', syncStatus: 'idle' },
          video: { balanceCny: 0, subscriptionBalanceCny: 0, permanentBalanceCny: 0, lastSyncedAt: '', syncStatus: 'idle' }
        }
  }

  async function refreshDashboardCredits({
    target = 'image'
  } = {}) {
    const settings = settingsService.getSettings()
    const currentDashboardCreditState = getCurrentDashboardCreditState()
    let nextDashboardCreditState = currentDashboardCreditState

    if (target === 'image' || target === 'all') {
      const authPlatform = settings.authPlatform && typeof settings.authPlatform === 'object'
        ? settings.authPlatform
        : { enabled: false, sessionToken: '' }
      const shouldUseRemoteWallet = authPlatform.enabled !== false && typeof authPlatform.sessionToken === 'string' && authPlatform.sessionToken.trim()

      if (shouldUseRemoteWallet && remoteLicensePlatformClient && typeof remoteLicensePlatformClient.getWalletSummary === 'function') {
        try {
          const walletSummary = await remoteLicensePlatformClient.getWalletSummary({
            sessionToken: authPlatform.sessionToken
          })
          const textWallet = getRemoteWalletResourceBalance(walletSummary, 'text')
          const imageWallet = getRemoteWalletResourceBalance(walletSummary, 'image')
          const videoWallet = getRemoteWalletResourceBalance(walletSummary, 'video')
          nextDashboardCreditState = {
            ...nextDashboardCreditState,
            text: {
              balanceCny: textWallet.total,
              subscriptionBalanceCny: textWallet.subscription,
              permanentBalanceCny: textWallet.permanent,
              lastSyncedAt: walletSummary?.updatedAt || getNow(),
              syncStatus: 'success'
            },
            image: {
              balanceCny: imageWallet.total,
              subscriptionBalanceCny: imageWallet.subscription,
              permanentBalanceCny: imageWallet.permanent,
              lastSyncedAt: walletSummary?.updatedAt || getNow(),
              syncStatus: 'success'
            },
            video: {
              balanceCny: videoWallet.total,
              subscriptionBalanceCny: videoWallet.subscription,
              permanentBalanceCny: videoWallet.permanent,
              lastSyncedAt: walletSummary?.updatedAt || getNow(),
              syncStatus: 'success'
            }
          }
        } catch {
          nextDashboardCreditState = {
            ...nextDashboardCreditState,
            text: {
              ...nextDashboardCreditState.text,
              syncStatus: 'remote-failed'
            },
            image: {
              ...nextDashboardCreditState.image,
              syncStatus: 'remote-failed'
            },
            video: {
              ...nextDashboardCreditState.video,
              syncStatus: 'remote-failed'
            }
          }
        }
      }
    }

    if (nextDashboardCreditState === currentDashboardCreditState) {
      return currentDashboardCreditState
    }

    await settingsService.saveSettings({
      dashboardCreditState: nextDashboardCreditState
    })

    return nextDashboardCreditState
  }

  async function syncCreditStateWithRealtimeBalance() {
    const settings = settingsService.getSettings()
    const authPlatform = settings.authPlatform && typeof settings.authPlatform === 'object'
      ? settings.authPlatform
      : { enabled: false, sessionToken: '' }
    const shouldUseRemoteWallet = authPlatform.enabled !== false &&
      typeof authPlatform.sessionToken === 'string' &&
      authPlatform.sessionToken.trim() &&
      remoteLicensePlatformClient &&
      typeof remoteLicensePlatformClient.getWalletSummary === 'function'

    if (shouldUseRemoteWallet) {
      const dashboardCreditState = await refreshDashboardCredits({
        target: 'all'
      })

      return {
        synced: true,
        dashboardCreditState
      }
    }

    return {
      synced: false,
      dashboardCreditState: getCurrentDashboardCreditState()
    }
  }

  return {
    refreshDashboardCredits,
    syncCreditStateWithRealtimeBalance
  }
}

module.exports = {
  createWorkspaceCreditService
}
