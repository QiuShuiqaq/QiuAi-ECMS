function resolveProviderApiKey(settings = {}, provider = 'general') {
  const normalizedProvider = String(provider || 'general').trim().toLowerCase()
  const providerApiKeys = settings.providerApiKeys && typeof settings.providerApiKeys === 'object'
    ? settings.providerApiKeys
    : {}

  const providerKey = typeof providerApiKeys[normalizedProvider] === 'string'
    ? providerApiKeys[normalizedProvider].trim()
    : ''

  if (providerKey) {
    return providerKey
  }

  if (normalizedProvider === 'general') {
    if (typeof settings.apiKey === 'string' && settings.apiKey.trim()) {
      return settings.apiKey.trim()
    }

    const activeIndex = Number.isInteger(settings.activeApiKeyIndex) ? settings.activeApiKeyIndex : 0
    const apiKey = Array.isArray(settings.apiKeys) ? settings.apiKeys[activeIndex] : ''
    return typeof apiKey === 'string' ? apiKey.trim() : ''
  }

  return resolveProviderApiKey(settings, 'general')
}

module.exports = {
  resolveProviderApiKey
}
