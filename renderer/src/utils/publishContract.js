export const publishPlatformOptions = [
  { label: 'TikTok Shop', value: 'tiktok' },
  { label: 'Shopee', value: 'shopee' },
  { label: 'AliExpress', value: 'aliexpress' }
]

export const supportedPublishPlatforms = publishPlatformOptions.map((item) => item.value)

export const fallbackPublishPlatformProfiles = {
  tiktok: {
    label: 'TikTok Shop',
    requiredAttributes: [
      { key: 'material', label: 'Material' },
      { key: 'product_type', label: 'Product Type' }
    ],
    manualReviewAttributeKey: 'tiktokManualReviewRequired'
  },
  shopee: {
    label: 'Shopee',
    requiredAttributes: [
      { key: 'brand', label: 'Brand' },
      { key: 'condition', label: 'Condition' }
    ],
    manualReviewAttributeKey: 'shopeeManualReviewRequired'
  },
  aliexpress: {
    label: 'AliExpress',
    requiredAttributes: [
      { key: 'brand', label: 'Brand' },
      { key: 'shipping_origin', label: 'Shipping Origin' }
    ],
    manualReviewAttributeKey: 'aliexpressManualReviewRequired'
  }
}

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

export function normalizePublishPlatformProfiles (platforms = []) {
  if (!Array.isArray(platforms) || !platforms.length) {
    return fallbackPublishPlatformProfiles
  }

  return Object.fromEntries(
    platforms.map((item) => {
      const key = normalizePublishPlatform(item?.key || '')
      return [
        key,
        {
          label: String(item?.label || fallbackPublishPlatformProfiles[key]?.label || key).trim(),
          requiredAttributes: Array.isArray(item?.requiredAttributes)
            ? item.requiredAttributes
              .map((attribute) => ({
                key: String(attribute?.key || '').trim(),
                label: String(attribute?.label || attribute?.key || '').trim()
              }))
              .filter((attribute) => attribute.key)
            : (fallbackPublishPlatformProfiles[key]?.requiredAttributes || []),
          manualReviewAttributeKey: String(
            item?.manualReviewAttributeKey || fallbackPublishPlatformProfiles[key]?.manualReviewAttributeKey || ''
          ).trim()
        }
      ]
    })
  )
}
