import { describe, expect, it, vi } from 'vitest'

describe('deepseekBalanceService', () => {
  it('queries the official DeepSeek balance endpoint and returns CNY balance', async () => {
    const get = vi.fn().mockResolvedValue({
      data: {
        is_available: true,
        balance_infos: [
          {
            currency: 'CNY',
            total_balance: '110.00',
            granted_balance: '10.00',
            topped_up_balance: '100.00'
          }
        ]
      }
    })
    const createHttpClientServiceDependency = vi.fn(() => ({
      get
    }))
    const settingsService = {
      getSettings: () => ({
        providerApiKeys: {
          deepseek: 'sk-deepseek'
        }
      })
    }

    const { createDeepseekBalanceService, DEEPSEEK_BALANCE_PATH } = await import('../../main/src/services/deepseekBalanceService.js')
    const service = createDeepseekBalanceService({
      settingsService,
      createHttpClientServiceDependency,
      getNow: () => '2026-06-13T15:00:00.000Z'
    })

    const result = await service.getRealtimeBalance()

    expect(createHttpClientServiceDependency).toHaveBeenCalledWith(expect.objectContaining({
      apiBaseUrl: 'https://api.deepseek.com',
      apiKey: 'sk-deepseek'
    }))
    expect(get).toHaveBeenCalledWith(DEEPSEEK_BALANCE_PATH)
    expect(result).toEqual({
      balanceCny: 110,
      lastSyncedAt: '2026-06-13T15:00:00.000Z',
      syncStatus: 'success'
    })
  })
})
