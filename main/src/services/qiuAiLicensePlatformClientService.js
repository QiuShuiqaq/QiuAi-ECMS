const axios = require('axios')

function trimString(value = '') {
  return typeof value === 'string' ? value.trim() : ''
}

function normalizeBaseUrl(baseUrl = '') {
  return trimString(baseUrl).replace(/\/+$/, '')
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
    deviceFingerprint: trimString(payload.deviceFingerprint),
    deviceName: trimString(payload.deviceName)
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
    couponCode: trimString(payload.couponCode),
    sessionToken: trimString(payload.sessionToken)
  }
}

function normalizeUserAgreementAcceptPayload(payload = {}) {
  return {
    sessionToken: trimString(payload.sessionToken),
    agreementVersion: trimString(payload.agreementVersion)
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

  async function request(method, path, { params, data } = {}) {
    try {
      const currentBaseUrl = resolveBaseUrl()
      const response = await requestClient.request({
        method,
        url: `${currentBaseUrl}${path}`,
        params,
        data,
        timeout: timeoutMs,
        headers: {
          'Content-Type': 'application/json'
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

  async function requestBinary(pathOrUrl, { params } = {}) {
    try {
      const normalizedPathOrUrl = trimString(pathOrUrl)
      const currentBaseUrl = resolveBaseUrl()
      const response = await requestClient.request({
        method: 'get',
        url: isAbsoluteHttpUrl(normalizedPathOrUrl)
          ? normalizedPathOrUrl
          : `${currentBaseUrl}${normalizedPathOrUrl}`,
        params,
        timeout: timeoutMs,
        responseType: 'arraybuffer'
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
      params: {
        sessionToken: trimString(sessionToken),
        deviceFingerprint: trimString(deviceFingerprint)
      }
    })
  }

  async function getWalletSummary({ sessionToken = '' } = {}) {
    return request('get', '/api/wallet/summary', {
      params: {
        sessionToken: trimString(sessionToken)
      }
    })
  }

  async function getServiceCapacityProfile({ sessionToken = '' } = {}) {
    return request('get', '/api/service-capacity/profile', {
      params: {
        sessionToken: trimString(sessionToken)
      }
    })
  }

  async function activateLicense(payload = {}) {
    return request('post', '/api/activation/activate', {
      data: normalizeActivationPayload(payload)
    })
  }

  async function getUserAgreementStatus({ sessionToken = '' } = {}) {
    return request('get', '/api/activation/agreement-status', {
      params: {
        sessionToken: trimString(sessionToken)
      }
    })
  }

  async function acceptUserAgreement(payload = {}) {
    return request('post', '/api/activation/agreement-accept', {
      data: normalizeUserAgreementAcceptPayload(payload)
    })
  }

  async function listSoftwarePackages({ sessionToken = '' } = {}) {
    return request('get', '/api/packages', {
      params: {
        sessionToken: trimString(sessionToken)
      }
    })
  }

  async function createSoftwareOrder(payload = {}) {
    return request('post', '/api/orders', {
      data: normalizeSoftwareOrderPayload(payload)
    })
  }

  async function getSoftwareOrder({ id = '', sessionToken = '', orderAccessToken = '' } = {}) {
    return request('get', `/api/orders/${trimString(id)}`, {
      params: {
        sessionToken: trimString(sessionToken),
        orderAccessToken: trimString(orderAccessToken)
      }
    })
  }

  async function listComputePackages({ sessionToken = '' } = {}) {
    return request('get', '/api/compute-packages', {
      params: {
        sessionToken: trimString(sessionToken)
      }
    })
  }

  async function createComputePackageOrder(payload = {}) {
    return request('post', '/api/compute-package-orders', {
      data: normalizeComputePackageOrderPayload(payload)
    })
  }

  async function getComputePackageOrder({ id = '', sessionToken = '' } = {}) {
    return request('get', `/api/compute-package-orders/${trimString(id)}`, {
      params: {
        sessionToken: trimString(sessionToken)
      }
    })
  }

  async function createRechargeOrder(payload = {}) {
    return request('post', '/api/recharge/orders', {
      data: normalizeRechargeOrderPayload(payload)
    })
  }

  async function getSelectionManifest ({ sessionToken = '' } = {}) {
    return request('get', '/api/client/selection/manifest', {
      params: {
        sessionToken: trimString(sessionToken)
      }
    })
  }

  async function listSelectionPlatforms ({ sessionToken = '' } = {}) {
    return request('get', '/api/client/selection/platforms', {
      params: {
        sessionToken: trimString(sessionToken)
      }
    })
  }

  async function listSelectionSites (payload = {}) {
    return request('get', '/api/client/selection/sites', {
      params: normalizeSelectionSitesPayload(payload)
    })
  }

  async function listSelectionItems (payload = {}) {
    return request('get', '/api/client/selection/items', {
      params: normalizeSelectionItemsPayload(payload)
    })
  }

  async function getSelectionItemDetail ({ id = '', sessionToken = '' } = {}) {
    return request('get', `/api/client/selection/items/${trimString(id)}`, {
      params: {
        sessionToken: trimString(sessionToken)
      }
    })
  }

  async function createGenerationJob(payload = {}) {
    return request('post', '/api/generation/jobs', {
      data: normalizeGenerationJobPayload(payload)
    })
  }

  async function upsertPublishDraft (payload = {}) {
    return request('post', '/api/client/publish/drafts', {
      data: normalizePublishDraftPayload(payload)
    })
  }

  async function listPublishChannelAccounts (payload = {}) {
    return request('get', '/api/client/publish/channel-accounts', {
      params: normalizePublishChannelAccountsPayload(payload)
    })
  }

  async function getPublishClientConfig (payload = {}) {
    return request('get', '/api/client/publish/config', {
      params: normalizePublishClientConfigPayload(payload)
    })
  }

  async function getPublishDraft ({ id = '', sessionToken = '' } = {}) {
    return request('get', `/api/client/publish/drafts/${trimString(id)}`, {
      params: {
        sessionToken: trimString(sessionToken)
      }
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
      params: {
        sessionToken: trimString(sessionToken)
      }
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
    return request('get', `/api/generation/jobs/${trimString(id)}`, {
      params: {
        sessionToken: trimString(sessionToken),
        mode: trimString(mode || 'full') || 'full'
      }
    })
  }

  async function downloadGenerationArtifact({ id = '', sessionToken = '', downloadUrl = '' } = {}) {
    const normalizedDownloadUrl = trimString(downloadUrl)
    const artifactUrl = normalizedDownloadUrl || `/api/generation/artifacts/${trimString(id)}/download`
    const params = normalizedDownloadUrl && isAbsoluteHttpUrl(normalizedDownloadUrl)
      ? undefined
      : {
          sessionToken: trimString(sessionToken)
        }

    return requestBinary(artifactUrl, { params })
  }

  async function getRechargeOrder({ id = '', sessionToken = '' } = {}) {
    return request('get', `/api/recharge/orders/${trimString(id)}`, {
      params: {
        sessionToken: trimString(sessionToken)
      }
    })
  }

  const activation = {
    getStatus: getAuthorizationStatus,
    activate: activateLicense,
    getUserAgreementStatus,
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
    getUserAgreementStatus,
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
    listSoftwarePackages
    ,
    retryPublishTask,
    upsertPublishDraft,
    createPublishTask
  }
}

module.exports = {
  createQiuAiLicensePlatformClientService
}
