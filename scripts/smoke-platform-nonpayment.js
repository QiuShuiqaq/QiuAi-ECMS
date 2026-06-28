const { createQiuAiLicensePlatformClientService } = require('../main/src/services/qiuAiLicensePlatformClientService')

function readEnv(name, fallback = '') {
  const value = process.env[name]
  if (typeof value !== 'string') {
    return fallback
  }

  const trimmed = value.trim()
  return trimmed || fallback
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function logStep(title, payload) {
  console.log(`\n[nonpayment-smoke] ${title}`)
  if (typeof payload !== 'undefined') {
    console.log(JSON.stringify(payload, null, 2))
  }
}

async function pollGenerationJob(client, { id, sessionToken, maxPolls = 12, intervalMs = 5000 }) {
  for (let index = 1; index <= maxPolls; index += 1) {
    const job = await client.getGenerationJob({
      id,
      sessionToken,
      mode: 'full'
    })

    logStep(`generation poll ${index}`, {
      id: job.id,
      status: job.status,
      items: Array.isArray(job.items)
        ? job.items.map((item) => ({
            id: item.id,
            status: item.status,
            assetType: item.assetType,
            providerType: item.providerType,
            providerModel: item.providerModel,
            lastErrorCode: item.lastErrorCode,
            lastErrorMessage: item.lastErrorMessage
          }))
        : []
    })

    if (job.status === 'COMPLETED' || job.status === 'FAILED' || job.status === 'CANCELLED') {
      return job
    }

    await sleep(intervalMs)
  }

  throw new Error(`Generation job ${id} did not finish within the polling window.`)
}

async function main() {
  const timestamp = Date.now()
  const baseUrl = readEnv('QIUAI_PLATFORM_BASE_URL', 'https://api.qiuaihub.com')
  const presetSessionToken = readEnv('QIUAI_PLATFORM_SESSION_TOKEN', '')
  const deviceFingerprint = readEnv('QIUAI_SMOKE_DEVICE_FINGERPRINT', `dev-smoke-device-${timestamp}`)
  const deviceName = readEnv('QIUAI_SMOKE_DEVICE_NAME', 'QiuAi Local Smoke Device')
  const customerName = readEnv('QIUAI_SMOKE_CUSTOMER_NAME', 'QiuAi Smoke User')
  const contact = readEnv('QIUAI_SMOKE_CONTACT', `smoke-${timestamp}@qiuai.local`)
  const inviteCode = readEnv('QIUAI_SMOKE_INVITE_CODE', '')
  const generationModel = readEnv('QIUAI_SMOKE_TEXT_MODEL', 'deepseek-chat')
  const generationProvider = readEnv('QIUAI_SMOKE_TEXT_PROVIDER', 'DEEPSEEK')

  const client = createQiuAiLicensePlatformClientService({
    baseUrl,
    timeoutMs: 20000
  })

  logStep('target', {
    baseUrl,
    usingPresetSessionToken: Boolean(presetSessionToken),
    deviceFingerprint,
    deviceName,
    customerName,
    contact
  })

  let activation = {
    status: 'activated',
    userId: '',
    licenseId: '',
    sessionToken: presetSessionToken
  }

  let sessionToken = String(presetSessionToken || '').trim()

  if (!sessionToken) {
    activation = await client.activateLicense({
      customerName,
      contact,
      inviteCode,
      deviceName,
      deviceFingerprint
    })
    sessionToken = String(activation.sessionToken || '').trim()

    if (!sessionToken) {
      throw new Error('Activation did not return a session token.')
    }
  }

  logStep('activation ok', {
    status: activation.status,
    userId: activation.userId,
    licenseId: activation.licenseId,
    sessionTokenMasked: `${sessionToken.slice(0, 6)}***${sessionToken.slice(-4)}`
  })

  const activationStatus = await client.getAuthorizationStatus({
    sessionToken,
    deviceFingerprint
  })
  logStep('activation status ok', {
    status: activationStatus.status,
    canUseApp: activationStatus.canUseApp,
    expiresAt: activationStatus.expiresAt
  })

  const walletSummary = await client.getWalletSummary({ sessionToken })
  logStep('wallet summary ok', walletSummary)

  const serviceCapacity = await client.getServiceCapacityProfile({ sessionToken })
  logStep('service capacity ok', serviceCapacity)

  const softwarePackages = await client.listSoftwarePackages({ sessionToken })
  logStep('software packages ok', {
    count: Array.isArray(softwarePackages) ? softwarePackages.length : 0,
    first: Array.isArray(softwarePackages) && softwarePackages.length > 0
      ? softwarePackages[0]
      : null
  })

  const computePackages = await client.listComputePackages({ sessionToken })
  logStep('compute packages ok', {
    count: Array.isArray(computePackages) ? computePackages.length : 0,
    first: Array.isArray(computePackages) && computePackages.length > 0
      ? computePackages[0]
      : null
  })

  const selectionManifest = await client.getSelectionManifest({ sessionToken })
  const selectionPlatforms = await client.listSelectionPlatforms({ sessionToken })
  const firstPlatform = Array.isArray(selectionPlatforms) && selectionPlatforms.length > 0
    ? selectionPlatforms[0]
    : null
  logStep('selection manifest ok', {
    manifestKeys: selectionManifest && typeof selectionManifest === 'object'
      ? Object.keys(selectionManifest).slice(0, 10)
      : [],
    platformCount: Array.isArray(selectionPlatforms) ? selectionPlatforms.length : 0,
    firstPlatform
  })

  let selectionSites = []
  let selectionItems = null
  let selectionItemDetail = null

  if (firstPlatform?.key) {
    selectionSites = await client.listSelectionSites({
      sessionToken,
      platform: firstPlatform.key
    })

    const firstSite = Array.isArray(selectionSites) && selectionSites.length > 0
      ? selectionSites[0]
      : null

    const boardType = Array.isArray(firstPlatform.boardTypes) && firstPlatform.boardTypes.length > 0
      ? String(firstPlatform.boardTypes[0].key || '')
      : ''

    selectionItems = await client.listSelectionItems({
      sessionToken,
      platform: firstPlatform.key,
      boardType,
      siteCode: firstSite?.code || '',
      page: 1,
      pageSize: 5
    })

    const firstItem = Array.isArray(selectionItems?.items) && selectionItems.items.length > 0
      ? selectionItems.items[0]
      : null

    if (firstItem?.id) {
      selectionItemDetail = await client.getSelectionItemDetail({
        sessionToken,
        id: firstItem.id
      })
    }

    logStep('selection detail ok', {
      platform: firstPlatform.key,
      siteCount: Array.isArray(selectionSites) ? selectionSites.length : 0,
      itemCount: Array.isArray(selectionItems?.items) ? selectionItems.items.length : 0,
      firstItemId: firstItem?.id || '',
      detailTitle: selectionItemDetail?.title || ''
    })
  }

  const publishConfig = await client.getPublishClientConfig({ sessionToken })
  const publishPlatforms = Array.isArray(publishConfig?.platforms) ? publishConfig.platforms : []
  let publishSummary = {
    platformCount: publishPlatforms.length,
    selectedPlatform: '',
    channelAccountCount: 0,
    draftId: '',
    taskId: '',
    taskStatus: '',
    skipped: true,
    reason: 'No publish platform available.'
  }

  const publishPlatform = publishPlatforms[0] || null
  if (publishPlatform?.key) {
    const channelAccounts = await client.listPublishChannelAccounts({
      sessionToken,
      platform: publishPlatform.key
    })
    const firstChannelAccount = Array.isArray(channelAccounts) && channelAccounts.length > 0
      ? channelAccounts[0]
      : null

    publishSummary = {
      platformCount: publishPlatforms.length,
      selectedPlatform: publishPlatform.key,
      channelAccountCount: Array.isArray(channelAccounts) ? channelAccounts.length : 0,
      draftId: '',
      taskId: '',
      taskStatus: '',
      skipped: !firstChannelAccount,
      reason: firstChannelAccount ? '' : 'No publish channel account configured.'
    }

    if (firstChannelAccount) {
      const requiredAttributes = Array.isArray(publishPlatform.requiredAttributes)
        ? Object.fromEntries(
            publishPlatform.requiredAttributes
              .map((item) => String(item?.key || '').trim())
              .filter(Boolean)
              .map((key) => [key, 'default'])
          )
        : {}

      const draft = await client.upsertPublishDraft({
        sessionToken,
        workspaceProjectId: `smoke-workspace-${timestamp}`,
        title: `Smoke Draft ${timestamp}`,
        shortTitle: 'Smoke Draft',
        descriptionHtml: '<p>Smoke publish draft.</p>',
        bulletPoints: ['Smoke verification', 'Non-payment smoke'],
        brandText: 'QiuAi',
        categoryHint: 'general',
        tags: ['smoke'],
        attributes: requiredAttributes,
        variants: [
          {
            sellerSkuCode: `SMOKE-${timestamp}`,
            variant: {
              flavor: 'default'
            },
            priceAmount: 19.9,
            stockQuantity: 10
          }
        ],
        media: [],
        platformDrafts: {
          [publishPlatform.key]: {
            channelAccountId: firstChannelAccount.id,
            attributes: requiredAttributes
          }
        }
      })

      const draftDetail = await client.getPublishDraft({
        id: draft.id,
        sessionToken
      })

      const preview = await client.getPublishDraftPreview({
        id: draft.id,
        sessionToken,
        platform: publishPlatform.key,
        channelAccountId: firstChannelAccount.id
      })

      const task = await client.createPublishTask({
        sessionToken,
        draftId: draft.id,
        platform: publishPlatform.key,
        channelAccountId: firstChannelAccount.id,
        operationType: 'create-listing'
      })

      const taskDetail = await client.getPublishTask({
        id: task.id,
        sessionToken
      })

      publishSummary = {
        platformCount: publishPlatforms.length,
        selectedPlatform: publishPlatform.key,
        channelAccountCount: Array.isArray(channelAccounts) ? channelAccounts.length : 0,
        draftId: draft.id,
        taskId: task.id,
        taskStatus: taskDetail.status || task.status || '',
        skipped: false,
        reason: '',
        previewValid: preview?.isValid === true,
        draftStatus: draftDetail?.status || draft?.status || ''
      }
    }
  }

  logStep('publish smoke result', publishSummary)

  const generationJob = await client.createGenerationJob({
    sessionToken,
    jobType: 'TEXT',
    menuKey: 'workspace',
    requestedConcurrency: 1,
    draftSnapshot: {
      productName: 'Desk Lamp',
      language: 'zh-CN'
    },
    items: [
      {
        groupIndex: 1,
        slotIndex: 1,
        assetType: 'TEXT',
        providerType: generationProvider,
        providerModel: generationModel,
        inputSnapshot: {
          kind: 'title',
          productName: 'Desk Lamp'
        },
        promptSnapshot: {
          system: '你是跨境电商文案助手',
          user: '为 Desk Lamp 生成一个简洁商品标题'
        }
      }
    ]
  })

  logStep('generation create ok', {
    id: generationJob.id,
    status: generationJob.status
  })

  const generationResult = await pollGenerationJob(client, {
    id: generationJob.id,
    sessionToken
  })

  const summary = {
    baseUrl,
    activation: {
      userId: activation.userId,
      licenseId: activation.licenseId,
      status: activation.status
    },
    walletSummary,
    serviceCapacity,
    softwarePackageCount: Array.isArray(softwarePackages) ? softwarePackages.length : 0,
    computePackageCount: Array.isArray(computePackages) ? computePackages.length : 0,
    selection: {
      platformCount: Array.isArray(selectionPlatforms) ? selectionPlatforms.length : 0,
      siteCount: Array.isArray(selectionSites) ? selectionSites.length : 0,
      itemCount: Array.isArray(selectionItems?.items) ? selectionItems.items.length : 0,
      detailTitle: selectionItemDetail?.title || ''
    },
    publish: publishSummary,
    generation: {
      id: generationResult.id,
      status: generationResult.status,
      items: Array.isArray(generationResult.items)
        ? generationResult.items.map((item) => ({
            id: item.id,
            status: item.status,
            lastErrorCode: item.lastErrorCode,
            lastErrorMessage: item.lastErrorMessage
          }))
        : []
    }
  }

  console.log('\n[nonpayment-smoke] success')
  console.log(JSON.stringify(summary, null, 2))
}

main().catch((error) => {
  console.error('\n[nonpayment-smoke] failed')
  console.error(error instanceof Error ? error.stack || error.message : error)
  process.exit(1)
})
