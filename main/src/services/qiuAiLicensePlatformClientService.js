const axios = require('axios')

function trimString(value = '') {
  return typeof value === 'string' ? value.trim() : ''
}

function normalizeBaseUrl(baseUrl = '') {
  return trimString(baseUrl).replace(/\/+$/, '')
}

function buildSessionHeaders(sessionToken = '') {
  const normalizedSessionToken = trimString(sessionToken)
  return normalizedSessionToken
    ? {
        Authorization: `Bearer ${normalizedSessionToken}`
      }
    : {}
}

function isAbsoluteHttpUrl(value = '') {
  return /^https?:\/\//i.test(trimString(value))
}

function normalizePositiveNumber(value, { allowZero = false } = {}) {
  const numericValue = Number(value)
  if (!Number.isFinite(numericValue)) {
    return allowZero ? 0 : undefined
  }

  if (allowZero) {
    return numericValue >= 0 ? numericValue : 0
  }

  return numericValue > 0 ? numericValue : undefined
}

function normalizeActivationPayload(payload = {}) {
  return {
    customerName: trimString(payload.customerName),
    contact: trimString(payload.contact),
    inviteCode: trimString(payload.inviteCode),
    durationDays: normalizePositiveNumber(payload.durationDays),
    deviceName: trimString(payload.deviceName),
    deviceFingerprint: trimString(payload.deviceFingerprint)
  }
}

function normalizeSoftwareOrderPayload(payload = {}) {
  return {
    productPackageId: trimString(payload.productPackageId),
    channel: trimString(payload.channel || 'alipay') || 'alipay',
    sessionToken: trimString(payload.sessionToken),
    customerName: trimString(payload.customerName),
    contact: trimString(payload.contact),
    inviteCode: trimString(payload.inviteCode),
    agentInviteCode: trimString(payload.agentInviteCode),
    deviceFingerprint: trimString(payload.deviceFingerprint),
    deviceName: trimString(payload.deviceName)
  }
}

function normalizeAgentQuotePayload(payload = {}) {
  return {
    agentInviteCode: trimString(payload.agentInviteCode || payload.inviteCode)
  }
}

function normalizeComputePackageOrderPayload(payload = {}) {
  return {
    computePackageId: trimString(payload.computePackageId),
    channel: trimString(payload.channel || 'alipay') || 'alipay',
    sessionToken: trimString(payload.sessionToken)
  }
}

function normalizeRechargeOrderPayload(payload = {}) {
  return {
    walletType: trimString(payload.walletType),
    channel: trimString(payload.channel || 'alipay') || 'alipay',
    amountCny: normalizePositiveNumber(payload.amountCny, { allowZero: false }),
    sessionToken: trimString(payload.sessionToken)
  }
}

function normalizeUserAgreementAcceptPayload(payload = {}) {
  return {
    sessionToken: trimString(payload.sessionToken),
    agreementTitle: trimString(payload.agreementTitle),
    agreementVersion: trimString(payload.agreementVersion),
    deviceId: trimString(payload.deviceId),
    source: trimString(payload.source || 'DESKTOP_QIUAI') || 'DESKTOP_QIUAI'
  }
}

function normalizeSelectionSitesPayload (payload = {}) {
  return {
    platform: trimString(payload.platform),
    sessionToken: trimString(payload.sessionToken)
  }
}

function normalizeSelectionItemsPayload (payload = {}) {
  const page = normalizePositiveNumber(payload.page)
  const pageSize = normalizePositiveNumber(payload.pageSize)

  return {
    platform: trimString(payload.platform),
    boardType: trimString(payload.boardType),
    siteCode: trimString(payload.siteCode),
    keyword: trimString(payload.keyword),
    sessionToken: trimString(payload.sessionToken),
    ...(page ? { page } : {}),
    ...(pageSize ? { pageSize } : {})
  }
}

function normalizeGenerationJobItem(item = {}) {
  const normalizedItem = {
    inputSnapshot: item.inputSnapshot && typeof item.inputSnapshot === 'object' ? item.inputSnapshot : {}
  }

  const groupIndex = normalizePositiveNumber(item.groupIndex)
  if (groupIndex) {
    normalizedItem.groupIndex = groupIndex
  }

  const slotIndex = normalizePositiveNumber(item.slotIndex)
  if (slotIndex) {
    normalizedItem.slotIndex = slotIndex
  }

  const assetType = trimString(item.assetType)
  if (assetType) {
    normalizedItem.assetType = assetType
  }

  const providerType = trimString(item.providerType)
  if (providerType) {
    normalizedItem.providerType = providerType
  }

  const providerModel = trimString(item.providerModel)
  if (providerModel) {
    normalizedItem.providerModel = providerModel
  }

  const maxAttempts = normalizePositiveNumber(item.maxAttempts)
  if (maxAttempts) {
    normalizedItem.maxAttempts = maxAttempts
  }

  if (item.promptSnapshot && typeof item.promptSnapshot === 'object') {
    normalizedItem.promptSnapshot = item.promptSnapshot
  }

  if (item.sourceAssetRefs && typeof item.sourceAssetRefs === 'object') {
    normalizedItem.sourceAssetRefs = item.sourceAssetRefs
  }

  return normalizedItem
}

function normalizeGenerationUsageLine(line = {}) {
  return {
    kind: trimString(line.kind),
    label: trimString(line.label),
    model: trimString(line.model),
    units: Math.max(0, Number(line.units) || 0),
    unitPriceCny: Math.max(0, Number(line.unitPriceCny) || 0),
    amountCny: Math.max(0, Number(line.amountCny) || 0),
    metadata: line.metadata && typeof line.metadata === 'object' ? line.metadata : {}
  }
}

function normalizeGenerationJobResponse(job = {}) {
  const usageSummary = job.usageSummary && typeof job.usageSummary === 'object'
    ? {
        billed: job.usageSummary.billed === true,
        billedAt: trimString(job.usageSummary.billedAt),
        currency: trimString(job.usageSummary.currency || 'CNY') || 'CNY',
        totalAmountCny: Math.max(0, Number(job.usageSummary.totalAmountCny) || 0),
        lines: Array.isArray(job.usageSummary.lines) ? job.usageSummary.lines.map((line) => normalizeGenerationUsageLine(line)) : []
      }
    : null

  return {
    ...job,
    usageSummary
  }
}

function normalizeGenerationJobPayload(payload = {}) {
  const requestedConcurrency = normalizePositiveNumber(payload.requestedConcurrency)
  return {
    sessionToken: trimString(payload.sessionToken),
    jobType: trimString(payload.jobType),
    menuKey: trimString(payload.menuKey),
    draftSnapshot: payload.draftSnapshot && typeof payload.draftSnapshot === 'object' ? payload.draftSnapshot : {},
    ...(requestedConcurrency ? { requestedConcurrency } : {}),
    items: Array.isArray(payload.items) ? payload.items.map((item) => normalizeGenerationJobItem(item)) : []
  }
}

function normalizePublishDraftPayload (payload = {}) {
  return {
    sessionToken: trimString(payload.sessionToken),
    workspaceProjectId: trimString(payload.workspaceProjectId),
    title: trimString(payload.title),
    shortTitle: trimString(payload.shortTitle),
    descriptionHtml: trimString(payload.descriptionHtml),
    bulletPoints: Array.isArray(payload.bulletPoints)
      ? payload.bulletPoints.map((item) => trimString(item)).filter(Boolean)
      : [],
    brandText: trimString(payload.brandText),
    categoryHint: trimString(payload.categoryHint),
    tags: Array.isArray(payload.tags)
      ? payload.tags.map((item) => trimString(item)).filter(Boolean)
      : [],
    sourceSelectionMetadata: payload.sourceSelectionMetadata && typeof payload.sourceSelectionMetadata === 'object'
      ? payload.sourceSelectionMetadata
      : null,
    attributes: payload.attributes && typeof payload.attributes === 'object'
      ? payload.attributes
      : {},
    variants: Array.isArray(payload.variants) ? payload.variants : [],
    media: Array.isArray(payload.media) ? payload.media : [],
    platformDrafts: payload.platformDrafts && typeof payload.platformDrafts === 'object'
      ? payload.platformDrafts
      : {}
  }
}

function normalizePublishTaskPayload (payload = {}) {
  return {
    sessionToken: trimString(payload.sessionToken),
    draftId: trimString(payload.draftId),
    platform: trimString(payload.platform),
    channelAccountId: trimString(payload.channelAccountId),
    operationType: trimString(payload.operationType || 'create-listing') || 'create-listing'
  }
}

function normalizePublishChannelAccountsPayload (payload = {}) {
  return {
    sessionToken: trimString(payload.sessionToken),
    platform: trimString(payload.platform)
  }
}

function normalizePublishClientConfigPayload (payload = {}) {
  return {
    sessionToken: trimString(payload.sessionToken)
  }
}

function createServiceError(code, message, details = {}) {
  const error = new Error(message)
  error.code = code
  error.details = details
  return error
}

const GENERATION_JOB_CREATE_TIMEOUT_MS = 30000
const GENERATION_JOB_READ_TIMEOUT_MS = 30000
const GENERATION_ARTIFACT_DOWNLOAD_TIMEOUT_MS = 120000
const SERVICE_CAPACITY_PROFILE_TIMEOUT_MS = 15000

function createQiuAiLicensePlatformClientService({
  baseUrl,
  getBaseUrl,
  timeoutMs = 10000,
  requestClient = axios
} = {}) {
  const hasDynamicBaseUrl = typeof getBaseUrl === 'function'
  const normalizedBaseUrl = normalizeBaseUrl(baseUrl)

  if (!hasDynamicBaseUrl && !normalizedBaseUrl) {
    throw new Error('baseUrl is required.')
  }

  function resolveBaseUrl() {
    const resolvedBaseUrl = hasDynamicBaseUrl
      ? normalizeBaseUrl(getBaseUrl())
      : normalizedBaseUrl

    if (!resolvedBaseUrl) {
      throw new Error('baseUrl is required.')
    }

    return resolvedBaseUrl
  }

  async function request(method, path, { params, data, sessionToken = '', timeoutOverrideMs } = {}) {
    try {
      const currentBaseUrl = resolveBaseUrl()
      const response = await requestClient.request({
        method,
        url: `${currentBaseUrl}${path}`,
        params,
        data,
        timeout: Number(timeoutOverrideMs) > 0 ? Number(timeoutOverrideMs) : timeoutMs,
        headers: {
          'Content-Type': 'application/json',
          ...buildSessionHeaders(sessionToken)
        }
      })

      return response.data?.data ?? response.data
    } catch (error) {
      const statusCode = error?.response?.status || 0
      const responseData = error?.response?.data || null
      throw createServiceError(
        responseData?.error?.code || 'REMOTE_REQUEST_FAILED',
        responseData?.error?.message || error.message || 'remote request failed',
        {
          statusCode,
          responseData
        }
      )
    }
  }

  async function requestBinary(pathOrUrl, { params, sessionToken = '', timeoutOverrideMs } = {}) {
    try {
      const normalizedPathOrUrl = trimString(pathOrUrl)
      const currentBaseUrl = resolveBaseUrl()
      const response = await requestClient.request({
        method: 'get',
        url: isAbsoluteHttpUrl(normalizedPathOrUrl)
          ? normalizedPathOrUrl
          : `${currentBaseUrl}${normalizedPathOrUrl}`,
        params,
        timeout: Number(timeoutOverrideMs) > 0 ? Number(timeoutOverrideMs) : timeoutMs,
        responseType: 'arraybuffer',
        headers: buildSessionHeaders(sessionToken)
      })

      return Buffer.isBuffer(response.data) ? response.data : Buffer.from(response.data)
    } catch (error) {
      const statusCode = error?.response?.status || 0
      const responseData = error?.response?.data || null
      throw createServiceError(
        responseData?.error?.code || 'REMOTE_REQUEST_FAILED',
        responseData?.error?.message || error.message || 'remote request failed',
        {
          statusCode,
          responseData
        }
      )
    }
  }

  async function getAuthorizationStatus({ sessionToken = '', deviceFingerprint = '' } = {}) {
    return request('get', '/api/activation/status', {
      sessionToken,
      params: {
        deviceFingerprint: trimString(deviceFingerprint)
      }
    })
  }

  async function getWalletSummary({ sessionToken = '' } = {}) {
    return request('get', '/api/wallet/summary', {
      sessionToken
    })
  }

  async function getServiceCapacityProfile({ sessionToken = '' } = {}) {
    return request('get', '/api/service-capacity/profile', {
      sessionToken,
      timeoutOverrideMs: SERVICE_CAPACITY_PROFILE_TIMEOUT_MS
    })
  }

  async function activateLicense(payload = {}) {
    return request('post', '/api/activation/activate', {
      data: normalizeActivationPayload(payload)
    })
  }

  async function acceptUserAgreement(payload = {}) {
    return request('post', '/api/activation/agreement', {
      data: normalizeUserAgreementAcceptPayload(payload)
    })
  }

  async function listSoftwarePackages({ sessionToken = '' } = {}) {
    return request('get', '/api/packages', {
      sessionToken
    })
  }

  async function createSoftwareOrder(payload = {}) {
    return request('post', '/api/orders', {
      data: normalizeSoftwareOrderPayload(payload)
    })
  }

  async function quoteAgentPrices(payload = {}) {
    return request('post', '/api/agent-quote', {
      data: normalizeAgentQuotePayload(payload)
    })
  }

  async function getSoftwareOrder({ id = '', sessionToken = '', orderAccessToken = '' } = {}) {
    return request('get', `/api/orders/${trimString(id)}`, {
      sessionToken,
      params: {
        orderAccessToken: trimString(orderAccessToken)
      }
    })
  }

  async function listComputePackages({ sessionToken = '' } = {}) {
    return request('get', '/api/compute-packages', {
      sessionToken
    })
  }

  async function createComputePackageOrder(payload = {}) {
    return request('post', '/api/compute-package-orders', {
      data: normalizeComputePackageOrderPayload(payload)
    })
  }

  async function getComputePackageOrder({ id = '', sessionToken = '' } = {}) {
    return request('get', `/api/compute-package-orders/${trimString(id)}`, {
      sessionToken
    })
  }

  async function createRechargeOrder(payload = {}) {
    return request('post', '/api/recharge/orders', {
      data: normalizeRechargeOrderPayload(payload)
    })
  }

  async function getSelectionManifest ({ sessionToken = '' } = {}) {
    return request('get', '/api/client/selection/manifest', {
      sessionToken
    })
  }

  async function listSelectionPlatforms ({ sessionToken = '' } = {}) {
    return request('get', '/api/client/selection/platforms', {
      sessionToken
    })
  }

  async function listSelectionSites (payload = {}) {
    const normalizedPayload = normalizeSelectionSitesPayload(payload)
    return request('get', '/api/client/selection/sites', {
      sessionToken: normalizedPayload.sessionToken,
      params: {
        platform: normalizedPayload.platform
      }
    })
  }

  async function listSelectionItems (payload = {}) {
    const normalizedPayload = normalizeSelectionItemsPayload(payload)
    return request('get', '/api/client/selection/items', {
      sessionToken: normalizedPayload.sessionToken,
      params: {
        platform: normalizedPayload.platform,
        boardType: normalizedPayload.boardType,
        siteCode: normalizedPayload.siteCode,
        keyword: normalizedPayload.keyword,
        ...(normalizedPayload.page ? { page: normalizedPayload.page } : {}),
        ...(normalizedPayload.pageSize ? { pageSize: normalizedPayload.pageSize } : {})
      }
    })
  }

  async function getSelectionItemDetail ({ id = '', sessionToken = '' } = {}) {
    return request('get', `/api/client/selection/items/${trimString(id)}`, {
      sessionToken
    })
  }

  async function createGenerationJob(payload = {}) {
    const response = await request('post', '/api/generation/jobs', {
      data: normalizeGenerationJobPayload(payload),
      timeoutOverrideMs: GENERATION_JOB_CREATE_TIMEOUT_MS
    })
    return normalizeGenerationJobResponse(response)
  }

  async function upsertPublishDraft (payload = {}) {
    return request('post', '/api/client/publish/drafts', {
      data: normalizePublishDraftPayload(payload)
    })
  }

  async function listPublishChannelAccounts (payload = {}) {
    const normalizedPayload = normalizePublishChannelAccountsPayload(payload)
    return request('get', '/api/client/publish/channel-accounts', {
      sessionToken: normalizedPayload.sessionToken,
      params: {
        platform: normalizedPayload.platform
      }
    })
  }

  async function getPublishClientConfig (payload = {}) {
    const normalizedPayload = normalizePublishClientConfigPayload(payload)
    return request('get', '/api/client/publish/config', {
      sessionToken: normalizedPayload.sessionToken
    })
  }

  async function getPublishDraft ({ id = '', sessionToken = '' } = {}) {
    return request('get', `/api/client/publish/drafts/${trimString(id)}`, {
      sessionToken
    })
  }

  async function getPublishDraftPreview ({ id = '', sessionToken = '', platform = '', channelAccountId = '' } = {}) {
    return request('post', `/api/client/publish/drafts/${trimString(id)}/preview`, {
      data: {
        sessionToken: trimString(sessionToken),
        platform: trimString(platform),
        channelAccountId: trimString(channelAccountId)
      }
    })
  }

  async function createPublishTask (payload = {}) {
    return request('post', '/api/client/publish/tasks', {
      data: normalizePublishTaskPayload(payload)
    })
  }

  async function getPublishTask ({ id = '', sessionToken = '' } = {}) {
    return request('get', `/api/client/publish/tasks/${trimString(id)}`, {
      sessionToken
    })
  }

  async function retryPublishTask ({ id = '', sessionToken = '' } = {}) {
    return request('post', `/api/client/publish/tasks/${trimString(id)}/retry`, {
      data: {
        id: trimString(id),
        sessionToken: trimString(sessionToken)
      }
    })
  }

  async function getGenerationJob({ id = '', sessionToken = '', mode = 'full' } = {}) {
    const response = await request('get', `/api/generation/jobs/${trimString(id)}`, {
      sessionToken,
      params: {
        mode: trimString(mode || 'full') || 'full'
      },
      timeoutOverrideMs: GENERATION_JOB_READ_TIMEOUT_MS
    })
    return normalizeGenerationJobResponse(response)
  }

  async function downloadGenerationArtifact({ id = '', sessionToken = '', downloadUrl = '' } = {}) {
    const normalizedDownloadUrl = trimString(downloadUrl)
    const artifactUrl = normalizedDownloadUrl || `/api/generation/artifacts/${trimString(id)}/download`
    return requestBinary(artifactUrl, {
      sessionToken,
      timeoutOverrideMs: GENERATION_ARTIFACT_DOWNLOAD_TIMEOUT_MS,
      params: normalizedDownloadUrl && isAbsoluteHttpUrl(normalizedDownloadUrl)
        ? undefined
        : undefined
    })
  }

  async function getRechargeOrder({ id = '', sessionToken = '' } = {}) {
    return request('get', `/api/recharge/orders/${trimString(id)}`, {
      sessionToken
    })
  }

  const activation = {
    getStatus: getAuthorizationStatus,
    activate: activateLicense,
    acceptUserAgreement
  }

  const wallet = {
    getSummary: getWalletSummary
  }

  const serviceCapacity = {
    getProfile: getServiceCapacityProfile
  }

  const softwareCommerce = {
    listPackages: listSoftwarePackages,
    quoteAgentPrices,
    createOrder: createSoftwareOrder,
    getOrder: getSoftwareOrder
  }

  const computeCommerce = {
    listPackages: listComputePackages,
    createOrder: createComputePackageOrder,
    getOrder: getComputePackageOrder
  }

  const recharge = {
    createOrder: createRechargeOrder,
    getOrder: getRechargeOrder
  }

  const selection = {
    getManifest: getSelectionManifest,
    listPlatforms: listSelectionPlatforms,
    listSites: listSelectionSites,
    listItems: listSelectionItems,
    getItemDetail: getSelectionItemDetail
  }

  const generation = {
    createJob: createGenerationJob,
    getJob: getGenerationJob,
    downloadArtifact: downloadGenerationArtifact
  }

  const publish = {
    getClientConfig: getPublishClientConfig,
    listChannelAccounts: listPublishChannelAccounts,
    upsertDraft: upsertPublishDraft,
    getDraft: getPublishDraft,
    getDraftPreview: getPublishDraftPreview,
    createTask: createPublishTask,
    getTask: getPublishTask,
    retryTask: retryPublishTask
  }

  return {
    activation,
    wallet,
    serviceCapacity,
    softwareCommerce,
    computeCommerce,
    recharge,
    selection,
    generation,
    publish,
    activateLicense,
    acceptUserAgreement,
    createComputePackageOrder,
    createGenerationJob,
    createRechargeOrder,
    createSoftwareOrder,
    downloadGenerationArtifact,
    getAuthorizationStatus,
    getComputePackageOrder,
    getGenerationJob,
    getPublishClientConfig,
    listPublishChannelAccounts,
    getPublishDraft,
    getPublishDraftPreview,
    getPublishTask,
    getRechargeOrder,
    getSelectionItemDetail,
    getSelectionManifest,
    getServiceCapacityProfile,
    getSoftwareOrder,
    getWalletSummary,
    listSelectionItems,
    listSelectionPlatforms,
    listSelectionSites,
    listComputePackages,
    listSoftwarePackages,
    quoteAgentPrices,
    retryPublishTask,
    upsertPublishDraft,
    createPublishTask
  }
}

module.exports = {
  createQiuAiLicensePlatformClientService
}
