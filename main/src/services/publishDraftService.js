function trimString (value = '') {
  return typeof value === 'string' ? value.trim() : ''
}

function normalizeStringArray (value = []) {
  return Array.isArray(value)
    ? value.map((item) => String(item || '').trim()).filter(Boolean)
    : []
}

function isRemotePublishMediaUrl (value = '') {
  return /^https?:\/\//i.test(trimString(value))
}

function normalizePublishMediaItem (item = {}, index = 0) {
  const publishReadyUrl = trimString(item.publishReadyUrl || item.downloadUrl || '')
  const sourceUrl = trimString(item.sourceUrl || '')
  const fallbackPath = trimString(item.savedPath || item.path || item.preview || '')
  const resolvedPublishUrl = isRemotePublishMediaUrl(publishReadyUrl)
    ? publishReadyUrl
    : isRemotePublishMediaUrl(sourceUrl)
      ? sourceUrl
      : ''
  const resolvedSourceUrl = isRemotePublishMediaUrl(sourceUrl)
    ? sourceUrl
    : resolvedPublishUrl

  if (!resolvedPublishUrl && !fallbackPath) {
    return null
  }

  return {
    mediaType: 'IMAGE',
    sourceAssetId: trimString(item.id || ''),
    sourceUrl: resolvedSourceUrl || fallbackPath,
    publishReadyUrl: resolvedPublishUrl || null,
    sortOrder: Number.isFinite(Number(item.sortOrder)) ? Number(item.sortOrder) : index,
    width: Number.isFinite(Number(item.width)) ? Number(item.width) : null,
    height: Number.isFinite(Number(item.height)) ? Number(item.height) : null,
    altText: trimString(item.name || '')
  }
}

function buildDraftPayloadFromProject (project = {}) {
  const baseInfo = project.baseInfo && typeof project.baseInfo === 'object' ? project.baseInfo : {}
  const content = project.content && typeof project.content === 'object' ? project.content : {}
  const assets = project.assets && typeof project.assets === 'object' ? project.assets : {}
  const publishDraft = project.publishDraft && typeof project.publishDraft === 'object' ? project.publishDraft : {}
  const metadata = project.metadata && typeof project.metadata === 'object' ? project.metadata : {}

  const title = trimString(content.selectedTitle || content.titleCandidates?.[0] || baseInfo.productName || project.name || '')
  const descriptionSource = trimString(content.selectedDescription || content.descriptionCandidates?.[0] || '')
  const descriptionHtml = descriptionSource
    ? `<p>${descriptionSource.replace(/\n+/g, '</p><p>')}</p>`
    : ''
  const bulletPoints = normalizeStringArray(baseInfo.highlights)
  const tags = normalizeStringArray(baseInfo.keywords)
  const generatedImages = Array.isArray(assets.generatedImages) ? assets.generatedImages : []
  const sourceImages = Array.isArray(assets.sourceImages) ? assets.sourceImages : []
  const mediaSource = generatedImages.length ? generatedImages : sourceImages
  const media = mediaSource
    .map((item, index) => normalizePublishMediaItem(item, index))
    .filter(Boolean)

  return {
    workspaceProjectId: trimString(project.id || ''),
    title,
    shortTitle: trimString(title).slice(0, 120) || null,
    descriptionHtml,
    bulletPoints,
    brandText: trimString(baseInfo.brand || '') || null,
    categoryHint: trimString(baseInfo.category || '') || null,
    tags,
    sourceSelectionMetadata: metadata.selectionSource && typeof metadata.selectionSource === 'object'
      ? { ...metadata.selectionSource }
      : null,
    attributes: publishDraft.attributes && typeof publishDraft.attributes === 'object'
      ? { ...publishDraft.attributes }
      : {},
    variants: Array.isArray(publishDraft.variants) ? publishDraft.variants.slice() : [],
    media,
    platformDrafts: publishDraft.platformDrafts && typeof publishDraft.platformDrafts === 'object'
      ? { ...publishDraft.platformDrafts }
      : {}
  }
}

function createPublishDraftService ({
  remoteLicensePlatformClient,
  getSessionToken,
  getStoredState
} = {}) {
  if (!remoteLicensePlatformClient) {
    throw new Error('remoteLicensePlatformClient is required.')
  }

  async function requireSessionToken () {
    const sessionToken = trimString(await getSessionToken())
    if (sessionToken) {
      return sessionToken
    }

    const error = new Error('Remote authorization is required before using publish features.')
    error.code = 'REMOTE_AUTH_REQUIRED'
    throw error
  }

  function getProjectById (projectId = '') {
    const state = typeof getStoredState === 'function' ? getStoredState() : {}
    const productProjects = Array.isArray(state.productProjects) ? state.productProjects : []
    return productProjects.find((project) => project.id === trimString(projectId)) || null
  }

  async function upsertDraft (payload = {}) {
    const sessionToken = await requireSessionToken()
    let draftPayload = payload && typeof payload === 'object' ? { ...payload } : {}

    if (draftPayload.projectId && !draftPayload.workspaceProjectId) {
      const project = getProjectById(draftPayload.projectId)
      if (!project) {
        throw new Error('Workspace project was not found for publish sync.')
      }
      draftPayload = buildDraftPayloadFromProject(project)
    }

    return remoteLicensePlatformClient.upsertPublishDraft({
      ...draftPayload,
      sessionToken
    })
  }

  async function listChannelAccounts (payload = {}) {
    const sessionToken = await requireSessionToken()
    return remoteLicensePlatformClient.listPublishChannelAccounts({
      platform: trimString(payload.platform || ''),
      sessionToken
    })
  }

  async function getConfig () {
    const sessionToken = await requireSessionToken()
    return remoteLicensePlatformClient.getPublishClientConfig({
      sessionToken
    })
  }

  async function getDraft (payload = {}) {
    const sessionToken = await requireSessionToken()
    return remoteLicensePlatformClient.getPublishDraft({
      id: trimString(payload.id || ''),
      sessionToken
    })
  }

  async function getDraftPreview (payload = {}) {
    const sessionToken = await requireSessionToken()
    return remoteLicensePlatformClient.getPublishDraftPreview({
      id: trimString(payload.id || ''),
      platform: trimString(payload.platform || ''),
      channelAccountId: trimString(payload.channelAccountId || ''),
      sessionToken
    })
  }

  async function createTask (payload = {}) {
    const sessionToken = await requireSessionToken()
    return remoteLicensePlatformClient.createPublishTask({
      draftId: trimString(payload.draftId || ''),
      platform: trimString(payload.platform || ''),
      channelAccountId: trimString(payload.channelAccountId || ''),
      operationType: trimString(payload.operationType || 'create-listing') || 'create-listing',
      sessionToken
    })
  }

  async function getTask (payload = {}) {
    const sessionToken = await requireSessionToken()
    return remoteLicensePlatformClient.getPublishTask({
      id: trimString(payload.id || ''),
      sessionToken
    })
  }

  async function retryTask (payload = {}) {
    const sessionToken = await requireSessionToken()
    return remoteLicensePlatformClient.retryPublishTask({
      id: trimString(payload.id || ''),
      sessionToken
    })
  }

  return {
    buildDraftPayloadFromProject,
    createTask,
    getDraft,
    getConfig,
    getDraftPreview,
    getTask,
    listChannelAccounts,
    retryTask,
    upsertDraft
  }
}

module.exports = {
  buildDraftPayloadFromProject,
  createPublishDraftService
}
