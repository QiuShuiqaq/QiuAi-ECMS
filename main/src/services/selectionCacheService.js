const fs = require('node:fs/promises')
const path = require('node:path')
const { DATA_ROOT_DIRECTORY, ensureDirectory } = require('./dataPathsService')

const SELECTION_CACHE_DIRECTORY = path.resolve(DATA_ROOT_DIRECTORY, 'selection-cache')
const SELECTION_MANIFEST_PATH = path.resolve(SELECTION_CACHE_DIRECTORY, 'manifest.json')

function safeParseJson(rawValue, fallbackValue) {
  try {
    return JSON.parse(rawValue)
  } catch {
    return fallbackValue
  }
}

function normalizeBoardKey({ platform = '', boardType = '', siteCode = '' } = {}) {
  return [
    String(platform || '').trim().toLowerCase(),
    String(boardType || '').trim().toLowerCase(),
    String(siteCode || '').trim().toLowerCase()
  ].join('__')
}

function buildBoardCachePath(boardKey) {
  return path.resolve(SELECTION_CACHE_DIRECTORY, `${boardKey}.json`)
}

async function readJsonFile(filePath, fallbackValue) {
  try {
    const rawValue = await fs.readFile(filePath, 'utf8')
    return safeParseJson(rawValue, fallbackValue)
  } catch {
    return fallbackValue
  }
}

async function writeJsonFile(filePath, value) {
  await ensureDirectory(path.dirname(filePath))
  await fs.writeFile(filePath, JSON.stringify(value, null, 2), 'utf8')
  return value
}

function buildBoardMap(boards = []) {
  return new Map(
    (Array.isArray(boards) ? boards : []).map((board) => [
      normalizeBoardKey(board),
      board
    ])
  )
}

function normalizeItemListPayload(payload = {}) {
  const source = payload && typeof payload === 'object' ? payload : {}
  return {
    platform: String(source.platform || '').trim().toLowerCase(),
    boardType: String(source.boardType || '').trim().toLowerCase(),
    boardLabel: String(source.boardLabel || '').trim(),
    siteCode: String(source.siteCode || '').trim().toLowerCase(),
    page: Math.max(1, Number(source.page) || 1),
    pageSize: Math.max(1, Number(source.pageSize) || 20),
    totalItems: Math.max(0, Number(source.totalItems) || 0),
    items: Array.isArray(source.items) ? source.items : [],
    cachedAt: typeof source.cachedAt === 'string' ? source.cachedAt : ''
  }
}

function createSelectionCacheService({
  remoteLicensePlatformClient,
  getSessionToken
} = {}) {
  if (!remoteLicensePlatformClient || typeof remoteLicensePlatformClient.getSelectionManifest !== 'function') {
    throw new Error('remoteLicensePlatformClient is required.')
  }

  if (typeof getSessionToken !== 'function') {
    throw new Error('getSessionToken is required.')
  }

  async function requireSessionToken() {
    const sessionToken = String(await getSessionToken() || '').trim()
    if (!sessionToken) {
      const error = new Error('Remote authorization is required before using selection assistant features.')
      error.code = 'REMOTE_AUTH_REQUIRED'
      throw error
    }
    return sessionToken
  }

  async function readManifest() {
    return readJsonFile(SELECTION_MANIFEST_PATH, {
      generatedAt: '',
      boards: []
    })
  }

  async function writeManifest(manifest) {
    return writeJsonFile(SELECTION_MANIFEST_PATH, {
      generatedAt: typeof manifest?.generatedAt === 'string' ? manifest.generatedAt : '',
      boards: Array.isArray(manifest?.boards) ? manifest.boards : []
    })
  }

  async function getManifest() {
    const sessionToken = await requireSessionToken()
    const remoteManifest = await remoteLicensePlatformClient.getSelectionManifest({ sessionToken })
    const cachedManifest = await readManifest()
    const remoteBoardMap = buildBoardMap(remoteManifest?.boards)
    const cachedBoardMap = buildBoardMap(cachedManifest?.boards)

    for (const [boardKey] of cachedBoardMap.entries()) {
      if (!remoteBoardMap.has(boardKey)) {
        const cachePath = buildBoardCachePath(boardKey)
        await fs.rm(cachePath, { force: true }).catch(() => {})
      }
    }

    await writeManifest(remoteManifest)
    return remoteManifest
  }

  async function listPlatforms() {
    const sessionToken = await requireSessionToken()
    return remoteLicensePlatformClient.listSelectionPlatforms({ sessionToken })
  }

  async function listSites({ platform = '' } = {}) {
    const sessionToken = await requireSessionToken()
    return remoteLicensePlatformClient.listSelectionSites({
      sessionToken,
      platform
    })
  }

  async function listItems({ platform = '', boardType = '', siteCode = '', keyword = '', page = 1, pageSize = 20 } = {}) {
    const sessionToken = await requireSessionToken()
    const manifest = await getManifest()
    const manifestBoard = (Array.isArray(manifest?.boards) ? manifest.boards : []).find((item) => {
      return normalizeBoardKey(item) === normalizeBoardKey({ platform, boardType, siteCode })
    }) || null
    const normalizedKeyword = String(keyword || '').trim()
    const normalizedPage = Math.max(1, Number(page) || 1)
    const normalizedPageSize = Math.max(1, Number(pageSize) || 20)
    const boardKey = normalizeBoardKey({ platform, boardType, siteCode })
    const cachePath = buildBoardCachePath(boardKey)
    const cachedPayload = normalizeItemListPayload(await readJsonFile(cachePath, {}))

    const cachedVersion = cachedPayload.version || ''
    const nextVersion = String(manifestBoard?.version || '').trim()
    const canUseCache = Boolean(
      nextVersion &&
      cachedVersion === nextVersion &&
      cachedPayload.platform === String(platform || '').trim().toLowerCase() &&
      cachedPayload.boardType === String(boardType || '').trim().toLowerCase() &&
      cachedPayload.siteCode === String(siteCode || '').trim().toLowerCase()
    )

    if (!normalizedKeyword && normalizedPage === 1 && canUseCache) {
      return cachedPayload
    }

    const remotePayload = await remoteLicensePlatformClient.listSelectionItems({
      sessionToken,
      platform,
      boardType,
      siteCode,
      keyword: normalizedKeyword,
      page: normalizedPage,
      pageSize: normalizedPageSize
    })

    if (!normalizedKeyword && normalizedPage === 1) {
      await writeJsonFile(cachePath, {
        ...remotePayload,
        version: nextVersion,
        cachedAt: new Date().toISOString()
      })
    }

    return remotePayload
  }

  async function getItemDetail({ id = '' } = {}) {
    const sessionToken = await requireSessionToken()
    return remoteLicensePlatformClient.getSelectionItemDetail({
      sessionToken,
      id
    })
  }

  return {
    getManifest,
    listPlatforms,
    listSites,
    listItems,
    getItemDetail
  }
}

module.exports = {
  createSelectionCacheService,
  normalizeBoardKey
}
