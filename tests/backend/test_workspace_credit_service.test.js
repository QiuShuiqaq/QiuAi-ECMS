import { describe, expect, it, vi } from 'vitest'

describe('workspaceCreditService', () => {
  async function createService(overrides = {}) {
    const { createWorkspaceCreditService } = await import('../../main/src/services/workspaceCreditService.js')

    let settings = {
      dashboardCreditState: {
        text: { balanceCny: 0, subscriptionBalanceCny: 0, permanentBalanceCny: 0, lastSyncedAt: '', syncStatus: 'idle' },
        image: { balanceCny: 0, subscriptionBalanceCny: 0, permanentBalanceCny: 0, lastSyncedAt: '', syncStatus: 'idle' },
        video: { balanceCny: 0, subscriptionBalanceCny: 0, permanentBalanceCny: 0, lastSyncedAt: '', syncStatus: 'idle' }
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
          subscriptionBalances: {
            text: 2.34,
            image: 18.8,
            video: 9.9
          },
          permanentBalances: {
            text: 10,
            image: 70,
            video: 10
          },
          splitBalances: {
            text: {
              totalBalanceCny: 12.34,
              subscriptionBalanceCny: 2.34,
              permanentBalanceCny: 10
            },
            image: {
              totalBalanceCny: 88.8,
              subscriptionBalanceCny: 18.8,
              permanentBalanceCny: 70
            },
            video: {
              totalBalanceCny: 19.9,
              subscriptionBalanceCny: 9.9,
              permanentBalanceCny: 10
            }
          },
          updatedAt: '2026-06-21T11:30:00.000Z'
        })
      },
      getNow: () => '2026-06-21T12:34:56.000Z',
      ...overrides
    })

    return {
      service,
      getSettings: () => settings,
      savedSettings
    }
  }

  it('refreshes dashboard balances from the remote wallet', async () => {
    const { service, getSettings, savedSettings } = await createService()

    const refreshed = await service.refreshDashboardCredits({
      target: 'all'
    })

    expect(refreshed).toMatchObject({
      text: {
        balanceCny: 12.34,
        subscriptionBalanceCny: 2.34,
        permanentBalanceCny: 10,
        syncStatus: 'success'
      },
      image: {
        balanceCny: 88.8,
        subscriptionBalanceCny: 18.8,
        permanentBalanceCny: 70,
        syncStatus: 'success'
      },
      video: {
        balanceCny: 19.9,
        subscriptionBalanceCny: 9.9,
        permanentBalanceCny: 10,
        syncStatus: 'success'
      }
    })
    expect(getSettings().dashboardCreditState.image.balanceCny).toBe(88.8)
    expect(savedSettings.at(-1)).toHaveProperty('dashboardCreditState')
  })

  it('returns the current dashboard balances when realtime sync is unavailable', async () => {
    const state = {
      dashboardCreditState: {
        text: { balanceCny: 1, subscriptionBalanceCny: 0.5, permanentBalanceCny: 0.5, lastSyncedAt: '', syncStatus: 'idle' },
        image: { balanceCny: 3, subscriptionBalanceCny: 1, permanentBalanceCny: 2, lastSyncedAt: '', syncStatus: 'idle' },
        video: { balanceCny: 5, subscriptionBalanceCny: 2, permanentBalanceCny: 3, lastSyncedAt: '', syncStatus: 'idle' }
      },
      authPlatform: {
        enabled: false,
        sessionToken: ''
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
      getNow: () => '2026-06-21T12:34:56.000Z'
    })

    const result = await service.syncCreditStateWithRealtimeBalance()

    expect(result).toEqual({
      synced: false,
      dashboardCreditState: state.dashboardCreditState
    })
    expect(saveSettings).not.toHaveBeenCalled()
  })

  it('syncs remote wallet balances during realtime balance checks when a session token exists', async () => {
    const { service, getSettings, savedSettings } = await createService()

    const result = await service.syncCreditStateWithRealtimeBalance()

    expect(result.synced).toBe(true)
    expect(result.dashboardCreditState).toMatchObject({
      text: {
        balanceCny: 12.34,
        syncStatus: 'success'
      },
      image: {
        balanceCny: 88.8
      },
      video: {
        balanceCny: 19.9
      }
    })
    expect(getSettings().dashboardCreditState.text.balanceCny).toBe(12.34)
    expect(savedSettings.at(-1)).toHaveProperty('dashboardCreditState')
  })
})
