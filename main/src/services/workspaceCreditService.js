function createWorkspaceCreditService({
  settingsService,
  remoteLicensePlatformClient,
  getNow,
  normalizeCreditStateForDisplay,
  appendCreditActivity,
  resolveTaskModelSummary
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
    const legacyFieldMap = {
      text: 'textBalanceCny',
      image: 'imageBalanceCny',
      video: 'videoBalanceCny'
    }
    const legacyTotal = Math.max(0, Number(walletSummary?.[legacyFieldMap[resourceKey]]) || 0)

    return {
      total: subscription + permanent || legacyTotal,
      subscription,
      permanent: subscription + permanent ? permanent : legacyTotal,
    }
  }

  function getCurrentDashboardCreditState() {
    const settings = settingsService.getSettings()
    return settings.dashboardCreditState && typeof settings.dashboardCreditState === 'object'
      ? settings.dashboardCreditState
      : {
          text: { balanceCny: 0, subscriptionBalanceCny: 0, permanentBalanceCny: 0, lastSyncedAt: '', syncStatus: 'idle' },
          image: { totalCredits: 0, remainingCredits: 0, balanceCny: 0, subscriptionBalanceCny: 0, permanentBalanceCny: 0, lastSyncedAt: '', syncStatus: 'idle' },
          video: { balanceCny: 0, subscriptionBalanceCny: 0, permanentBalanceCny: 0, lastSyncedAt: '', syncStatus: 'idle' }
        }
  }

  function buildTaskLedgerEntry({ taskId, taskNumber, menuKey, draft = {}, estimatedCredits = 0, createdAt, status }) {
    return {
      taskId,
      taskNumber,
      menuKey,
      taskName: String(draft.taskName || ''),
      modelSummary: resolveTaskModelSummary(menuKey, draft),
      estimatedCredits: Math.max(0, Number(estimatedCredits) || 0),
      status,
      createdAt,
      updatedAt: createdAt
    }
  }

  function freezeCreditsForTask({ creditState, taskId, taskNumber, menuKey, draft, estimatedCredits, createdAt }) {
    const normalizedCreditState = normalizeCreditStateForDisplay(creditState)
    const normalizedEstimatedCredits = Math.max(0, Number(estimatedCredits) || 0)

    if (!normalizedEstimatedCredits) {
      return normalizedCreditState
    }

    if (normalizedCreditState.remainingCredits < normalizedEstimatedCredits) {
      throw new Error(`积分不足：当前可用 ${normalizedCreditState.remainingCredits}，需要 ${normalizedEstimatedCredits}`)
    }

    const modelSummary = resolveTaskModelSummary(menuKey, draft)

    return normalizeCreditStateForDisplay({
      ...normalizedCreditState,
      remainingCredits: normalizedCreditState.remainingCredits - normalizedEstimatedCredits,
      frozenCredits: normalizedCreditState.frozenCredits + normalizedEstimatedCredits,
      activityHistory: appendCreditActivity(normalizedCreditState, {
        id: `task-freeze-${taskId}-${createdAt}`,
        type: 'task_freeze',
        operation: 'decrease',
        amount: normalizedEstimatedCredits,
        createdAt,
        taskId,
        taskNumber,
        taskName: String(draft.taskName || ''),
        menuKey,
        modelSummary
      }),
      taskLedger: {
        ...normalizedCreditState.taskLedger,
        [taskId]: buildTaskLedgerEntry({
          taskId,
          taskNumber,
          menuKey,
          draft,
          estimatedCredits: normalizedEstimatedCredits,
          createdAt,
          status: 'frozen'
        })
      }
    })
  }

  function settleCreditsForTask({ creditState, taskId, updatedAt }) {
    const normalizedCreditState = normalizeCreditStateForDisplay(creditState)
    const currentLedger = normalizedCreditState.taskLedger[taskId]

    if (!currentLedger || currentLedger.status === 'settled') {
      return normalizedCreditState
    }

    const estimatedCredits = Math.max(0, Number(currentLedger.estimatedCredits) || 0)

    return normalizeCreditStateForDisplay({
      ...normalizedCreditState,
      frozenCredits: Math.max(0, normalizedCreditState.frozenCredits - estimatedCredits),
      usedCredits: normalizedCreditState.usedCredits + estimatedCredits,
      activityHistory: appendCreditActivity(normalizedCreditState, {
        id: `task-settle-${taskId}-${updatedAt}`,
        type: 'task_settle',
        operation: 'decrease',
        amount: estimatedCredits,
        createdAt: updatedAt,
        taskId,
        taskNumber: currentLedger.taskNumber,
        taskName: currentLedger.taskName,
        menuKey: currentLedger.menuKey,
        modelSummary: currentLedger.modelSummary
      }),
      taskLedger: {
        ...normalizedCreditState.taskLedger,
        [taskId]: {
          ...currentLedger,
          status: 'settled',
          updatedAt
        }
      }
    })
  }

  function refundCreditsForTask({ creditState, taskId, updatedAt }) {
    const normalizedCreditState = normalizeCreditStateForDisplay(creditState)
    const currentLedger = normalizedCreditState.taskLedger[taskId]

    if (!currentLedger || currentLedger.status === 'refunded') {
      return normalizedCreditState
    }

    const estimatedCredits = Math.max(0, Number(currentLedger.estimatedCredits) || 0)

    return normalizeCreditStateForDisplay({
      ...normalizedCreditState,
      remainingCredits: normalizedCreditState.remainingCredits + estimatedCredits,
      frozenCredits: Math.max(0, normalizedCreditState.frozenCredits - estimatedCredits),
      activityHistory: appendCreditActivity(normalizedCreditState, {
        id: `task-refund-${taskId}-${updatedAt}`,
        type: 'task_refund',
        operation: 'increase',
        amount: estimatedCredits,
        createdAt: updatedAt,
        taskId,
        taskNumber: currentLedger.taskNumber,
        taskName: currentLedger.taskName,
        menuKey: currentLedger.menuKey,
        modelSummary: currentLedger.modelSummary
      }),
      taskLedger: {
        ...normalizedCreditState.taskLedger,
        [taskId]: {
          ...currentLedger,
          status: 'refunded',
          updatedAt
        }
      }
    })
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
              totalCredits: 0,
              remainingCredits: 0,
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
        creditState: normalizeCreditStateForDisplay(settingsService.getSettings().creditState),
        dashboardCreditState
      }
    }

    return {
      synced: false,
      creditState: normalizeCreditStateForDisplay(settings.creditState),
      dashboardCreditState: getCurrentDashboardCreditState()
    }
  }

  return {
    freezeCreditsForTask,
    settleCreditsForTask,
    refundCreditsForTask,
    refreshDashboardCredits,
    syncCreditStateWithRealtimeBalance
  }
}

module.exports = {
  createWorkspaceCreditService
}
