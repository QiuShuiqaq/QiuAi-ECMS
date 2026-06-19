const axios = require('axios')

function trimString(value = '') {
  return typeof value === 'string' ? value.trim() : ''
}

function normalizeBaseUrl(baseUrl = '') {
  return trimString(baseUrl).replace(/\/+$/, '')
}

function createServiceError(code, message, details = {}) {
  const error = new Error(message)
  error.code = code
  error.details = details
  return error
}

function createQiuAiLicensePlatformClientService({
  baseUrl,
  timeoutMs = 10000,
  requestClient = axios
} = {}) {
  const normalizedBaseUrl = normalizeBaseUrl(baseUrl)

  if (!normalizedBaseUrl) {
    throw new Error('baseUrl is required.')
  }

  async function request(method, path, { params, data } = {}) {
    try {
      const response = await requestClient.request({
        method,
        url: `${normalizedBaseUrl}${path}`,
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

  async function requestBinary(path, { params } = {}) {
    try {
      const response = await requestClient.request({
        method: 'get',
        url: `${normalizedBaseUrl}${path}`,
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

  async function activateLicense(payload = {}) {
    return request('post', '/api/activation/activate', {
      data: payload
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
      data: payload
    })
  }

  async function getSoftwareOrder({ id = '', sessionToken = '' } = {}) {
    return request('get', `/api/orders/${trimString(id)}`, {
      params: {
        sessionToken: trimString(sessionToken)
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
      data: payload
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
      data: payload
    })
  }

  async function createGenerationJob(payload = {}) {
    return request('post', '/api/generation/jobs', {
      data: payload
    })
  }

  async function getGenerationJob({ id = '', sessionToken = '' } = {}) {
    return request('get', `/api/generation/jobs/${trimString(id)}`, {
      params: {
        sessionToken: trimString(sessionToken)
      }
    })
  }

  async function downloadGenerationArtifact({ id = '', sessionToken = '' } = {}) {
    return requestBinary(`/api/generation/artifacts/${trimString(id)}/download`, {
      params: {
        sessionToken: trimString(sessionToken)
      }
    })
  }

  async function getRechargeOrder({ id = '', sessionToken = '' } = {}) {
    return request('get', `/api/recharge/orders/${trimString(id)}`, {
      params: {
        sessionToken: trimString(sessionToken)
      }
    })
  }

  return {
    activateLicense,
    createComputePackageOrder,
    createGenerationJob,
    createRechargeOrder,
    createSoftwareOrder,
    downloadGenerationArtifact,
    getAuthorizationStatus,
    getComputePackageOrder,
    getGenerationJob,
    getRechargeOrder,
    getSoftwareOrder,
    getWalletSummary,
    listComputePackages,
    listSoftwarePackages
  }
}

module.exports = {
  createQiuAiLicensePlatformClientService
}
