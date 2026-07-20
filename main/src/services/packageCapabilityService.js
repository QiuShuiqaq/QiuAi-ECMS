function normalizeAllowedTiers(input) {
  if (!Array.isArray(input)) {
    return ['STANDARD']
  }

  const tiers = input
    .map((item) => String(item || '').trim().toUpperCase())
    .filter((item) => item === 'STANDARD' || item === 'MEMBER')

  return tiers.length ? tiers : ['STANDARD']
}

function getDefaultCapability() {
  return {
    editionKey: 'STANDARD',
    editionLabel: '标准版',
    taskConcurrencyLimit: 1,
    batchTaskEnabled: false,
    seriesImageLimitPerTask: 5,
    allowedComputePackageTiers: ['STANDARD']
  }
}

function getActiveCapabilityConfig(activationStatus = {}) {
  const capability = activationStatus?.activePackage?.capabilityConfig
  if (!capability || typeof capability !== 'object' || Array.isArray(capability)) {
    return getDefaultCapability()
  }

  return {
    editionKey: String(capability.editionKey || 'STANDARD').trim().toUpperCase() === 'PROFESSIONAL'
      ? 'PROFESSIONAL'
      : 'STANDARD',
    editionLabel: String(capability.editionLabel || '标准版').trim() || '标准版',
    taskConcurrencyLimit: Math.max(1, Number(capability.taskConcurrencyLimit) || 1),
    batchTaskEnabled: capability.batchTaskEnabled === true,
    seriesImageLimitPerTask: Math.max(1, Number(capability.seriesImageLimitPerTask) || 5),
    allowedComputePackageTiers: normalizeAllowedTiers(capability.allowedComputePackageTiers)
  }
}

function ensureDraftWithinCapability({ menuKey = '', draft = {}, activationStatus = {} } = {}) {
  const capability = getActiveCapabilityConfig(activationStatus)

  if (menuKey === 'series-generate') {
    const batchCount = Math.max(1, Number(draft.batchCount) || 1)
    const generateCount = Math.max(1, Number(draft.generateCount) || 1)

    if (!capability.batchTaskEnabled && batchCount > 1) {
      const error = new Error('当前授权不支持批量套图任务')
      error.code = 'LICENSE_BATCH_TASK_DISABLED'
      throw error
    }

    if (generateCount > capability.seriesImageLimitPerTask) {
      const error = new Error(`当前授权单次套图最多 ${capability.seriesImageLimitPerTask} 张`)
      error.code = 'LICENSE_SERIES_IMAGE_LIMIT'
      throw error
    }
  }

  if (menuKey === 'workspace') {
    const generateCount = Math.max(1, Number(draft.generateCount) || 4)
    if (generateCount > capability.seriesImageLimitPerTask) {
      const error = new Error(`当前授权全链路中的套图步骤最多 ${capability.seriesImageLimitPerTask} 张`)
      error.code = 'LICENSE_WORKSPACE_SERIES_IMAGE_LIMIT'
      throw error
    }
  }

  return capability
}

function annotateComputePackagesByCapability(computePackages = [], activationStatus = {}) {
  const capability = getActiveCapabilityConfig(activationStatus)
  return (Array.isArray(computePackages) ? computePackages : []).map((item) => {
    const tier = String(item?.tier || 'STANDARD').trim().toUpperCase()
    const canPurchase = capability.allowedComputePackageTiers.includes(tier)

    return {
      ...item,
      canPurchase,
      purchaseBlockedReason: canPurchase ? '' : '当前授权版本不可购买会员算力包'
    }
  })
}

module.exports = {
  ensureDraftWithinCapability,
  annotateComputePackagesByCapability,
  getActiveCapabilityConfig
}
