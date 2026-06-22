export const publishPlatformOptions = [
  { label: 'TikTok Shop', value: 'tiktok' },
  { label: 'Shopee', value: 'shopee' },
  { label: 'AliExpress', value: 'aliexpress' }
]

export const supportedPublishPlatforms = publishPlatformOptions.map((item) => item.value)

export const fallbackPublishPlatformProfiles = {
  tiktok: {
    label: 'TikTok Shop',
    ruleVersion: 'phase1-2026-06-22',
    automationStatus: 'pending-development',
    supportedOperations: ['create-listing', 'sync-status'],
    requiredAttributes: [
      { key: 'material', label: 'Material' },
      { key: 'product_type', label: 'Product Type' }
    ],
    manualReviewAttributeKey: 'tiktokManualReviewRequired'
  },
  shopee: {
    label: 'Shopee',
    ruleVersion: 'phase1-2026-06-22',
    automationStatus: 'pending-development',
    supportedOperations: ['create-listing', 'sync-status'],
    requiredAttributes: [
      { key: 'brand', label: 'Brand' },
      { key: 'condition', label: 'Condition' }
    ],
    manualReviewAttributeKey: 'shopeeManualReviewRequired'
  },
  aliexpress: {
    label: 'AliExpress',
    ruleVersion: 'phase1-2026-06-22',
    automationStatus: 'pending-development',
    supportedOperations: ['create-listing', 'sync-status'],
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
          ruleVersion: String(item?.ruleVersion || fallbackPublishPlatformProfiles[key]?.ruleVersion || '').trim(),
          automationStatus: String(
            item?.automationStatus || fallbackPublishPlatformProfiles[key]?.automationStatus || 'pending-development'
          ).trim(),
          supportedOperations: Array.isArray(item?.supportedOperations) && item.supportedOperations.length
            ? item.supportedOperations.map((operation) => String(operation || '').trim()).filter(Boolean)
            : (fallbackPublishPlatformProfiles[key]?.supportedOperations || []),
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

export function resolvePublishTaskOperation (profile = null) {
  const supportedOperations = Array.isArray(profile?.supportedOperations)
    ? profile.supportedOperations.map((item) => String(item || '').trim()).filter(Boolean)
    : []

  if (supportedOperations.includes('create-listing')) {
    return 'create-listing'
  }

  return supportedOperations[0] || 'create-listing'
}

export function normalizeProjectPublishDraft (project = {}) {
  const publishDraft = project.publishDraft && typeof project.publishDraft === 'object'
    ? project.publishDraft
    : {}

  return {
    attributes: publishDraft.attributes && typeof publishDraft.attributes === 'object'
      ? { ...publishDraft.attributes }
      : {},
    variants: Array.isArray(publishDraft.variants)
      ? publishDraft.variants.map((item) => ({ ...(item || {}) }))
      : [],
    platformDrafts: publishDraft.platformDrafts && typeof publishDraft.platformDrafts === 'object'
      ? Object.fromEntries(Object.entries(publishDraft.platformDrafts).map(([platformKey, value]) => [
          platformKey,
          value && typeof value === 'object'
            ? {
                ...value,
                attributes: value.attributes && typeof value.attributes === 'object'
                  ? { ...value.attributes }
                  : {}
              }
            : {}
        ]))
      : {}
  }
}
