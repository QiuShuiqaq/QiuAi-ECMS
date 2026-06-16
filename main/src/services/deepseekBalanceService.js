const { createHttpClientService } = require('./httpClientService')
const { resolveProviderApiKey } = require('./providerApiKeyService')

const DEEPSEEK_BALANCE_PATH = '/user/balance'

function normalizeBalanceCny(responseData = {}) {
  const balanceInfos = Array.isArray(responseData.balance_infos) ? responseData.balance_infos : []
  const cnyBalance = balanceInfos.find((item) => String(item?.currency || '').toUpperCase() === 'CNY')
  const totalBalance = Number(cnyBalance?.total_balance)

  if (!Number.isFinite(totalBalance) || totalBalance < 0) {
    return 0
  }

  return Number(totalBalance.toFixed(2))
}

function createDeepseekBalanceService({
  settingsService,
  messageRecorder,
  requestMetricRecorder,
  createHttpClientServiceDependency = createHttpClientService,
  getNow = () => new Date().toISOString()
}) {
  let lastSuccessfulSnapshot = null

  async function getRealtimeBalance() {
    const settings = settingsService.getSettings()
    const apiKey = resolveProviderApiKey(settings, 'deepseek')

    if (!apiKey) {
      return lastSuccessfulSnapshot
        ? {
            ...lastSuccessfulSnapshot,
            syncStatus: 'stale'
          }
        : null
    }

    try {
      const httpClient = createHttpClientServiceDependency({
        apiBaseUrl: 'https://api.deepseek.com',
        apiKey,
        messageRecorder,
        requestMetricRecorder
      })
      const response = await httpClient.get(DEEPSEEK_BALANCE_PATH)
      const responseData = response?.data || {}

      lastSuccessfulSnapshot = {
        balanceCny: normalizeBalanceCny(responseData),
        lastSyncedAt: getNow(),
        syncStatus: 'success'
      }

      return lastSuccessfulSnapshot
    } catch (_error) {
      return lastSuccessfulSnapshot
        ? {
            ...lastSuccessfulSnapshot,
            syncStatus: 'stale'
          }
        : null
    }
  }

  return {
    getRealtimeBalance
  }
}

module.exports = {
  createDeepseekBalanceService,
  DEEPSEEK_BALANCE_PATH
}
