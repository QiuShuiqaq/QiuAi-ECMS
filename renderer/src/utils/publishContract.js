export const publishPlatformOptions = [
  { label: 'TikTok Shop', value: 'tiktok' },
  { label: 'Shopee', value: 'shopee' },
  { label: 'AliExpress', value: 'aliexpress' }
]

export const supportedPublishPlatforms = publishPlatformOptions.map((item) => item.value)

const retryablePublishTaskStatuses = new Set([
  'blocked',
  'failed-retryable'
])

export function normalizePublishPlatform (value = '') {
  const normalized = String(value || '').trim().toLowerCase()
  return supportedPublishPlatforms.includes(normalized)
    ? normalized
    : publishPlatformOptions[0].value
}

export function canRetryPublishTask (status = '') {
  return retryablePublishTaskStatuses.has(String(status || '').trim().toLowerCase())
}

export function isRetryNotAllowedError (error) {
  return String(error?.code || '').trim() === 'PUBLISH_TASK_RETRY_NOT_ALLOWED'
}
