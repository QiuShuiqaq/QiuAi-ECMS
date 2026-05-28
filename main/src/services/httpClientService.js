const axios = require('axios')

function summarizePayloadShape(value, depth = 0) {
  if (depth >= 2) {
    if (Array.isArray(value)) {
      return `[${value.length}]`
    }
    if (value && typeof value === 'object') {
      return '{...}'
    }
    return typeof value
  }

  if (Array.isArray(value)) {
    return {
      type: 'array',
      length: value.length,
      sample: value.length ? summarizePayloadShape(value[0], depth + 1) : null
    }
  }

  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).slice(0, 12).map(([key, entryValue]) => {
      return [key, summarizePayloadShape(entryValue, depth + 1)]
    }))
  }

  if (typeof value === 'string') {
    return `string(${value.length})`
  }

  return value
}

function buildSanitizedRecord({
  method,
  apiBaseUrl,
  requestPath,
  payload,
  responseData,
  errorMessage,
  elapsedMs,
  requestStatus
}) {
  return {
    kind: 'api',
    method,
    apiBaseUrl,
    requestPath,
    requestPayloadSummary: summarizePayloadShape(payload),
    responseSummary: summarizePayloadShape(responseData),
    errorMessage: typeof errorMessage === 'string' ? errorMessage : undefined,
    elapsedMs,
    requestStatus
  }
}

async function safeRecordMessage(messageRecorder, payload) {
  if (!messageRecorder || typeof messageRecorder.record !== 'function') {
    return
  }

  try {
    await messageRecorder.record(payload)
  } catch {
    // Keep tracing failures from interrupting the main request flow.
  }
}

async function safeRecordRequestMetric(requestMetricRecorder, payload) {
  if (typeof requestMetricRecorder !== 'function') {
    return
  }

  try {
    await requestMetricRecorder(payload)
  } catch {
    // Keep metric write failures from interrupting the main request flow.
  }
}

function createHttpClientService({
  apiBaseUrl,
  apiKey,
  requestClient = axios.create,
  messageRecorder,
  timeoutMs = 30000,
  getNowMs = () => Date.now(),
  requestMetricRecorder
}) {
  const client = requestClient({
    baseURL: apiBaseUrl,
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`
    },
    timeout: timeoutMs
  })

  return {
    async post(requestPath, payload) {
      const startedAt = getNowMs()

      try {
        const response = await client.post(requestPath, payload)
        const elapsedMs = Math.max(0, getNowMs() - startedAt)

        await safeRecordMessage(messageRecorder, buildSanitizedRecord({
          method: 'POST',
          apiBaseUrl,
          requestPath,
          payload,
          responseData: response.data,
          elapsedMs,
          requestStatus: 'success'
        }))
        await safeRecordRequestMetric(requestMetricRecorder, {
          method: 'POST',
          requestPath,
          elapsedMs,
          requestStatus: 'success'
        })

        return response
      } catch (error) {
        const elapsedMs = Math.max(0, getNowMs() - startedAt)

        await safeRecordMessage(messageRecorder, buildSanitizedRecord({
          method: 'POST',
          apiBaseUrl,
          requestPath,
          payload,
          responseData: error.response ? error.response.data : null,
          errorMessage: error.message,
          elapsedMs,
          requestStatus: 'failed'
        }))
        await safeRecordRequestMetric(requestMetricRecorder, {
          method: 'POST',
          requestPath,
          elapsedMs,
          requestStatus: 'failed'
        })

        throw error
      }
    },
    async get(requestPath) {
      const startedAt = getNowMs()

      try {
        const response = await client.get(requestPath)
        const elapsedMs = Math.max(0, getNowMs() - startedAt)

        await safeRecordMessage(messageRecorder, buildSanitizedRecord({
          method: 'GET',
          apiBaseUrl,
          requestPath,
          payload: null,
          responseData: response.data,
          elapsedMs,
          requestStatus: 'success'
        }))
        await safeRecordRequestMetric(requestMetricRecorder, {
          method: 'GET',
          requestPath,
          elapsedMs,
          requestStatus: 'success'
        })

        return response
      } catch (error) {
        const elapsedMs = Math.max(0, getNowMs() - startedAt)

        await safeRecordMessage(messageRecorder, buildSanitizedRecord({
          method: 'GET',
          apiBaseUrl,
          requestPath,
          payload: null,
          responseData: error.response ? error.response.data : null,
          errorMessage: error.message,
          elapsedMs,
          requestStatus: 'failed'
        }))
        await safeRecordRequestMetric(requestMetricRecorder, {
          method: 'GET',
          requestPath,
          elapsedMs,
          requestStatus: 'failed'
        })

        throw error
      }
    }
  }
}

module.exports = {
  createHttpClientService
}
