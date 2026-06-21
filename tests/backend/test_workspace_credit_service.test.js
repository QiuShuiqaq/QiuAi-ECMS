import { describe, expect, it, vi } from 'vitest'

describe('workspaceCreditService', () => {
  async function createService(overrides = {}) {
    const { createWorkspaceCreditService } = await import('../../main/src/services/workspaceCreditService.js')

    let settings = {
      creditState: {
        remainingCredits: 1000,
        frozenCredits: 0,
        usedCredits: 0,
        activityHistory: [],
        taskLedger: {}
      },
      dashboardCreditState: {
        text: { balanceCny: 0, lastSyncedAt: '', syncStatus: 'idle' },
        image: { totalCredits: 0, remainingCredits: 0, lastSyncedAt: '', syncStatus: 'idle' },
        video: { balanceCny: 0, lastSyncedAt: '', syncStatus: 'idle' }
      },
      authPlatform: {
        enabled: true,
        sessionToken: 'session-1'
      }
    }
    const savedSettings = []

    const service = createWorkspaceCreditService({
      settingsService: {
        getSettings: () => settings,
        saveSettings: async (patch) => {
          settings = {
            ...settings,
            ...patch
          }
          savedSettings.push(patch)
        }
      },
      remoteLicensePlatformClient: {
        getWalletSummary: async () => ({
          textBalanceCny: 12.34,
          imageBalanceCny: 88.8,
          videoBalanceCny: 19.9,
          updatedAt: '2026-06-21T11:30:00.000Z'
        })
      },
      getNow: () => '2026-06-21T12:34:56.000Z',
      normalizeCreditStateForDisplay: (creditState = {}) => ({
        totalPurchasedCredits: 0,
        remainingCredits: 0,
        frozenCredits: 0,
        usedCredits: 0,
        lastAdjustmentAt: '',
        lastAdjustmentOperation: '',
        lastAdjustmentAmount: 0,
        adjustmentHistory: [],
        activityHistory: [],
        taskLedger: {},
        ...creditState
      }),
      appendCreditActivity: (creditState, activityEntry) => [
        activityEntry,
        ...(Array.isArray(creditState.activityHistory) ? creditState.activityHistory : [])
      ],
      resolveTaskModelSummary: (menuKey, draft = {}) => `${menuKey}:${draft.model || 'default'}`,
      ...overrides
    })

    return {
      service,
      getSettings: () => settings,
      savedSettings
    }
  }

  it('freezes, settles, and refunds task credits through the dedicated service', async () => {
    const { service } = await createService()

    const frozen = service.freezeCreditsForTask({
      creditState: {
        remainingCredits: 1000,
        frozenCredits: 0,
        usedCredits: 0,
        activityHistory: [],
        taskLedger: {}
      },
      taskId: 'task-1',
      taskNumber: 'QAI-001',
      menuKey: 'series-generate',
      draft: {
        taskName: '任务 1',
        model: 'gpt-image-2'
      },
      estimatedCredits: 600,
      createdAt: '2026-06-21T12:00:00.000Z'
    })

    expect(frozen).toMatchObject({
      remainingCredits: 400,
      frozenCredits: 600
    })
    expect(frozen.taskLedger['task-1']).toMatchObject({
      status: 'frozen',
      modelSummary: 'series-generate:gpt-image-2'
    })

    const settled = service.settleCreditsForTask({
      creditState: frozen,
      taskId: 'task-1',
      updatedAt: '2026-06-21T12:10:00.000Z'
    })

    expect(settled).toMatchObject({
      remainingCredits: 400,
      frozenCredits: 0,
      usedCredits: 600
    })
    expect(settled.taskLedger['task-1'].status).toBe('settled')

    const refunded = service.refundCreditsForTask({
      creditState: frozen,
      taskId: 'task-1',
      updatedAt: '2026-06-21T12:20:00.000Z'
    })

    expect(refunded).toMatchObject({
      remainingCredits: 1000,
      frozenCredits: 0,
      usedCredits: 0
    })
    expect(refunded.taskLedger['task-1'].status).toBe('refunded')
  })

  it('refreshes dashboard credits from the remote wallet and image credit provider', async () => {
    const { service, getSettings, savedSettings } = await createService()

    const refreshed = await service.refreshDashboardCredits({
      target: 'all'
    })

    expect(refreshed).toMatchObject({
      text: {
        balanceCny: 12.34,
        syncStatus: 'success'
      },
      image: {
        remainingCredits: 0,
        totalCredits: 0,
        balanceCny: 88.8
      },
      video: {
        balanceCny: 19.9
      }
    })
    expect(getSettings().dashboardCreditState.image.remainingCredits).toBe(0)
    expect(savedSettings.at(-1)).toHaveProperty('dashboardCreditState')
  })

  it('keeps the local image credit ledger untouched when no provider balance sync runs', async () => {
    const state = {
      creditState: {
        remainingCredits: 300,
        frozenCredits: 120,
        usedCredits: 50,
        activityHistory: [],
        taskLedger: {}
      },
      dashboardCreditState: {
        text: { balanceCny: 0, lastSyncedAt: '', syncStatus: 'idle' },
        image: { totalCredits: 0, remainingCredits: 0, lastSyncedAt: '', syncStatus: 'idle' },
        video: { balanceCny: 0, lastSyncedAt: '', syncStatus: 'idle' }
      }
    }
    const { createWorkspaceCreditService } = await import('../../main/src/services/workspaceCreditService.js')
    const saveSettings = vi.fn(async (patch) => {
      Object.assign(state, patch)
    })
    const service = createWorkspaceCreditService({
      settingsService: {
        getSettings: () => state,
        saveSettings
      },
      getNow: () => '2026-06-21T12:34:56.000Z',
      normalizeCreditStateForDisplay: (creditState = {}) => ({
        totalPurchasedCredits: 0,
        remainingCredits: 0,
        frozenCredits: 0,
        usedCredits: 0,
        lastAdjustmentAt: '',
        lastAdjustmentOperation: '',
        lastAdjustmentAmount: 0,
        adjustmentHistory: [],
        activityHistory: [],
        taskLedger: {},
        ...creditState
      }),
      appendCreditActivity: (creditState, activityEntry) => [
        activityEntry,
        ...(Array.isArray(creditState.activityHistory) ? creditState.activityHistory : [])
      ],
      resolveTaskModelSummary: () => ''
    })

    const result = await service.syncCreditStateWithRealtimeBalance()

    expect(result.synced).toBe(false)
    expect(result.creditState.remainingCredits).toBe(300)
    expect(state.creditState.remainingCredits).toBe(300)
    expect(saveSettings).not.toHaveBeenCalled()
  })
})
