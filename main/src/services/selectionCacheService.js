const fs = require('node:fs/promises')
const path = require('node:path')
const axios = require('axios')
const { DATA_ROOT_DIRECTORY, ensureDirectory } = require('./dataPathsService')

const SELECTION_CACHE_DIRECTORY = path.resolve(DATA_ROOT_DIRECTORY, 'selection-cache-v2')
const SELECTION_MANIFEST_PATH = path.resolve(SELECTION_CACHE_DIRECTORY, 'manifest.json')
const SELECTION_SCHEMA_VERSION = 2
const SELECTION_PAGE_SIZE = 50
const SELECTION_FETCH_SIZE = 80
const UPDATE_INTERVAL_DAYS = 7
const UPDATE_SOFT_MAX_MS = 30 * 60 * 1000
const UPDATE_HARD_MAX_MS = 60 * 60 * 1000
const FAST_MODE = process.env.NODE_ENV !== 'production' || process.env.QIUAI_SELECTION_FAST_MODE === '1'
const REQUEST_TIMEOUT_MS = FAST_MODE ? 20 * 1000 : 45 * 1000
const REQUEST_DELAY_RANGE_MS = FAST_MODE ? [150, 350] : [45 * 1000, 70 * 1000]
const RETRY_DELAY_RANGE_MS = FAST_MODE ? [300, 800] : [15 * 1000, 45 * 1000]

const BOARD_OPTIONS = [
  { key: 'hot-sale', label: '热销商品' },
  { key: 'hot-sale-new', label: '热销新品' },
  { key: 'new-mall-hot-sale', label: '新店热销' },
  { key: 'big-sale-new', label: '大卖新品' }
]

const PLATFORM_CONFIGS = [
  {
    key: 'temu',
    label: 'TEMU',
    apiBaseUrl: 'https://www.temaishuju.com',
    detailUrl: ({ goodsId }) => {
      return `https://www.temu.com/search_result.html?search_key=${encodeURIComponent(String(goodsId || ''))}&search_method=user&region=37&regionCnName=%E5%8A%A0%E6%8B%BF%E5%A4%A7%E7%AB%99`
    },
    defaultQuery: {
      'hot-sale': { sort: 'reviewNum', order: 'descend' },
      'hot-sale-new': { sort: 'sold', order: 'descend', onSaleTimeMonthsAgo: 1 },
      'new-mall-hot-sale': { sort: 'sold', order: 'descend', mallOpenTimeMonthsAgo: 1 },
      'big-sale-new': { sort: 'mallSold', order: 'descend', onSaleTimeMonthsAgo: 1 }
    }
  },
  {
    key: 'shein',
    label: 'SHEIN',
    apiBaseUrl: 'https://api.sheinshuju.com',
    detailUrl: ({ goodsId }) => `https://us.shein.com/goods-detail-p-${encodeURIComponent(String(goodsId || ''))}.html`,
    defaultQuery: {
      'hot-sale': { sort: 'sold', order: 'descend' },
      'hot-sale-new': { sort: 'sold', order: 'descend', onSaleTimeMonthsAgo: 1 },
      'new-mall-hot-sale': { sort: 'sold', order: 'descend', mallOpenTimeMonthsAgo: 1 },
      'big-sale-new': { sort: 'mallSold', order: 'descend', onSaleTimeMonthsAgo: 1 }
    }
  },
  {
    key: 'amazon',
    label: 'Amazon',
    apiBaseUrl: 'https://api.amazonshuju.com',
    detailUrl: ({ goodsId }) => `https://www.amazon.com/dp/${encodeURIComponent(String(goodsId || ''))}`,
    defaultQuery: {
      'hot-sale': { sort: 'monthSold', order: 'descend' },
      'hot-sale-new': { sort: 'monthSold', order: 'descend', onSaleTimeYearsAgo: 1 },
      'new-mall-hot-sale': { sort: 'monthSold', order: 'descend', mallOpenTimeYearsAgo: 1 },
      'big-sale-new': { sort: 'mallReviewNum', order: 'descend', onSaleTimeYearsAgo: 1 }
    }
  },
  {
    key: 'tiktok',
    label: 'TikTok',
    apiBaseUrl: 'https://api.tiktokshuju.com',
    fixedSiteId: 1,
    detailUrl: ({ goodsId, regionId = 'us' }) => {
      const normalizedRegionId = String(regionId || 'us').trim().toLowerCase() || 'us'
      const baseUrl = normalizedRegionId === 'id' ? 'https://shop-id.tokopedia.com' : 'https://www.tiktok.com'
      const hostname = new URL(baseUrl).hostname
      const regionPath = /^shop-[a-z]{2}\.tokopedia\.com$/i.test(hostname)
        ? ''
        : /^shop\.tiktok\.com$/i.test(hostname)
          ? `/${normalizedRegionId}`
          : (normalizedRegionId === 'us' ? '/shop' : `/shop/${normalizedRegionId}`)
      return `${baseUrl}${regionPath}/pdp/${encodeURIComponent(String(goodsId || ''))}?source=product_detail`
    },
    defaultQuery: {
      'hot-sale': { sort: 'reviewNum', order: 'descend' },
      'hot-sale-new': { sort: 'sold', order: 'descend', onSaleTimeMonthsAgo: 3 },
      'new-mall-hot-sale': { sort: 'sold', order: 'descend', mallOpenTimeMonthsAgo: 3 },
      'big-sale-new': { sort: 'mallSold', order: 'descend', onSaleTimeMonthsAgo: 3 }
    }
  }
]

const PLATFORM_MAP = new Map(PLATFORM_CONFIGS.map((item) => [item.key, item]))

function safeParseJson(rawValue, fallbackValue) {
  try {
    return JSON.parse(rawValue)
  } catch {
    return fallbackValue
  }
}

function normalizeBoardKey({ platform = '', boardType = '' } = {}) {
  return [
    String(platform || '').trim().toLowerCase(),
    String(boardType || '').trim().toLowerCase()
  ].join('__')
}

function buildBoardCachePath(boardKey) {
  return path.resolve(SELECTION_CACHE_DIRECTORY, `${boardKey}.json`)
}

function createDefaultUpdateState() {
  return {
    status: 'idle',
    isUpdating: false,
    startedAt: '',
    completedAt: '',
    currentPlatform: '',
    currentBoardType: '',
    completedJobs: 0,
    totalJobs: PLATFORM_CONFIGS.length * BOARD_OPTIONS.length,
    progressPercent: 0,
    message: '',
    lockReason: '',
    slowMode: false,
    lastErrorMessage: ''
  }
}

function createEmptyManifest() {
  return {
    schemaVersion: SELECTION_SCHEMA_VERSION,
    generatedAt: '',
    firstFetchedAt: '',
    lastCompletedAt: '',
    nextRefreshAt: '',
    updateState: createDefaultUpdateState(),
    boards: []
  }
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

function normalizeManifest(rawManifest = {}) {
  const source = rawManifest && typeof rawManifest === 'object' ? rawManifest : {}
  const updateState = source.updateState && typeof source.updateState === 'object' ? source.updateState : {}

  return {
    schemaVersion: SELECTION_SCHEMA_VERSION,
    generatedAt: typeof source.generatedAt === 'string' ? source.generatedAt : '',
    firstFetchedAt: typeof source.firstFetchedAt === 'string' ? source.firstFetchedAt : '',
    lastCompletedAt: typeof source.lastCompletedAt === 'string' ? source.lastCompletedAt : '',
    nextRefreshAt: typeof source.nextRefreshAt === 'string' ? source.nextRefreshAt : '',
    updateState: {
      ...createDefaultUpdateState(),
      ...updateState
    },
    boards: Array.isArray(source.boards) ? source.boards : []
  }
}

function normalizeRemoteImageUrl(rawUrl = '', platformConfig = null) {
  const normalizedUrl = String(rawUrl || '').trim()
  if (!normalizedUrl) {
    return ''
  }

  if (/^https?:\/\//i.test(normalizedUrl)) {
    return normalizedUrl
  }

  if (normalizedUrl.startsWith('//')) {
    return `https:${normalizedUrl}`
  }

  if (/^[a-z0-9.-]+\.[a-z]{2,}(\/|$)/i.test(normalizedUrl)) {
    return `https://${normalizedUrl}`
  }

  if (normalizedUrl.startsWith('/')) {
    const baseUrl = String(platformConfig?.apiBaseUrl || '').trim().replace(/\/+$/, '')
    return baseUrl ? `${baseUrl}${normalizedUrl}` : normalizedUrl
  }

  return normalizedUrl
}

function normalizeCachedSelectionItem(item = {}, platformConfig = null) {
  const source = item && typeof item === 'object' ? item : {}
  return {
    ...source,
    primaryImageUrl: normalizeRemoteImageUrl(source.primaryImageUrl, platformConfig)
  }
}

function normalizeCachedBoardItems(items = [], platformConfig = null) {
  return (Array.isArray(items) ? items : []).map((item) => {
    return normalizeCachedSelectionItem(item, platformConfig)
  })
}

function normalizeSelectionItem(rawItem = {}, { platform = '', boardType = '' } = {}) {
  const source = rawItem && typeof rawItem === 'object' ? rawItem : {}
  const goodsId = String(source.goodsId || source.id || '').trim()
  const categoryItems = Array.isArray(source.catItems) ? source.catItems : []
  const leafCategory = categoryItems.length ? categoryItems[categoryItems.length - 1] : null
  const title = String(source.goodsNameCn || source.goodsNameEn || source.goodsName || '').trim()
  const imageUrl = normalizeRemoteImageUrl(
    String(source.thumbnailCn || source.thumbnail || '').trim(),
    PLATFORM_MAP.get(platform) || null
  )
  const regionId = String(source.regionId || source.siteUID || 'us').trim().toLowerCase()

  return {
    id: `${platform}__${boardType}__${goodsId || String(source.id || '').trim()}`,
    platform,
    boardType,
    siteCode: '',
    boardLabel: BOARD_OPTIONS.find((item) => item.key === boardType)?.label || boardType,
    goodsId,
    title,
    subtitle: '',
    categoryText: String(leafCategory?.catNameCn || leafCategory?.catName || '').trim(),
    priceText: '',
    salesVolumeText: '',
    ratingText: source.goodsScore == null ? '' : String(source.goodsScore),
    primaryImageUrl: imageUrl,
    sourceDetailUrl: '',
    extractedKeywords: [],
    capturedAt: '',
    regionId,
    metrics: {
      sold: Number(source.sold) || 0,
      totalSold: Number(source.totalSold) || 0,
      monthSold: Number(source.monthSold) || 0,
      mallSold: Number(source.mallSold) || 0,
      reviewNum: Number(source.reviewNum) || 0
    },
    raw: {
      minPrice: source.minPrice,
      maxPrice: source.maxPrice,
      goodsScore: source.goodsScore,
      onSaleTime: source.onSaleTime || source.createTime || '',
      mallOpenTime: source.mallOpenTime || source.createTime || ''
    }
  }
}

function getPrimarySortValue(item = {}, platformKey = '', boardType = '') {
  const metrics = item.metrics || {}

  if (platformKey === 'amazon') {
    if (boardType === 'big-sale-new') {
      return Number(metrics.reviewNum) || Number(metrics.monthSold) || 0
    }
    return Number(metrics.monthSold) || Number(metrics.reviewNum) || 0
  }

  if (platformKey === 'tiktok') {
    if (boardType === 'big-sale-new') {
      return Number(metrics.mallSold) || Number(metrics.totalSold) || 0
    }
    return Number(metrics.totalSold) || Number(metrics.sold) || Number(metrics.reviewNum) || 0
  }

  if (boardType === 'big-sale-new') {
    return Number(metrics.mallSold) || Number(metrics.sold) || Number(metrics.reviewNum) || 0
  }

  return Number(metrics.sold) || Number(metrics.totalSold) || Number(metrics.reviewNum) || 0
}

function formatCompactNumber(value = 0) {
  const numericValue = Number(value) || 0
  if (numericValue >= 100000000) {
    return `${(numericValue / 100000000).toFixed(1).replace(/\.0$/, '')}亿`
  }
  if (numericValue >= 10000) {
    return `${(numericValue / 10000).toFixed(1).replace(/\.0$/, '')}万`
  }
  return String(Math.round(numericValue))
}

function formatPriceText(minPrice, maxPrice, symbol = '$') {
  const normalizedMinPrice = Number(minPrice)
  const normalizedMaxPrice = Number(maxPrice)

  if (!Number.isFinite(normalizedMinPrice) || normalizedMinPrice <= 0) {
    return ''
  }

  const formattedMin = normalizedMinPrice.toFixed(2).replace(/\.00$/, '')
  if (!Number.isFinite(normalizedMaxPrice) || normalizedMaxPrice <= 0 || normalizedMaxPrice === normalizedMinPrice) {
    return `${symbol}${formattedMin}`
  }

  const formattedMax = normalizedMaxPrice.toFixed(2).replace(/\.00$/, '')
  return `${symbol}${formattedMin}-${formattedMax}`
}

function extractKeywords(item = {}) {
  const title = String(item.title || '').trim()
  if (!title) {
    return []
  }

  const parts = title
    .replace(/[^A-Za-z0-9\u4e00-\u9fa5]+/g, ' ')
    .split(/\s+/)
    .map((part) => String(part || '').trim())
    .filter(Boolean)

  return [...new Set(parts)].slice(0, 8)
}

function applyPresentationFields(item = {}, platformKey = '', boardType = '', platformConfig = null) {
  const sortValue = getPrimarySortValue(item, platformKey, boardType)
  const nextItem = {
    ...item,
    sortValue,
    salesVolumeText: formatCompactNumber(sortValue)
  }

  nextItem.priceText = formatPriceText(item.raw?.minPrice, item.raw?.maxPrice, '$')
  nextItem.sourceDetailUrl = platformConfig?.detailUrl
    ? platformConfig.detailUrl({
        goodsId: item.goodsId,
        regionId: item.regionId
      })
    : ''
  nextItem.capturedAt = new Date().toISOString()
  nextItem.extractedKeywords = extractKeywords(nextItem)

  return nextItem
}

function normalizeBoardPayload(payload = {}) {
  const source = payload && typeof payload === 'object' ? payload : {}
  const platform = String(source.platform || '').trim().toLowerCase()
  const platformConfig = PLATFORM_MAP.get(platform) || null
  return {
    platform,
    boardType: String(source.boardType || '').trim().toLowerCase(),
    boardLabel: String(source.boardLabel || '').trim(),
    siteCode: String(source.siteCode || '').trim().toLowerCase(),
    page: Math.max(1, Number(source.page) || 1),
    pageSize: Math.max(1, Number(source.pageSize) || SELECTION_PAGE_SIZE),
    totalItems: Math.max(0, Number(source.totalItems) || 0),
    items: normalizeCachedBoardItems(source.items, platformConfig),
    capturedAt: typeof source.capturedAt === 'string' ? source.capturedAt : '',
    requestMeta: source.requestMeta && typeof source.requestMeta === 'object' ? source.requestMeta : {}
  }
}

function createEmptyBoardPayload({ platform = '', boardType = '', page = 1, pageSize = SELECTION_PAGE_SIZE } = {}) {
  return {
    platform: String(platform || '').trim().toLowerCase(),
    boardType: String(boardType || '').trim().toLowerCase(),
    boardLabel: BOARD_OPTIONS.find((item) => item.key === boardType)?.label || boardType,
    siteCode: '',
    page: Math.max(1, Number(page) || 1),
    pageSize: Math.max(1, Number(pageSize) || SELECTION_PAGE_SIZE),
    totalItems: 0,
    items: [],
    capturedAt: '',
    requestMeta: {}
  }
}

function computeNextRefreshAt(firstFetchedAt = '', now = new Date()) {
  const firstTimestamp = new Date(firstFetchedAt)
  if (Number.isNaN(firstTimestamp.getTime())) {
    return ''
  }

  const nextTimestamp = new Date(firstTimestamp)
  while (nextTimestamp.getTime() <= now.getTime()) {
    nextTimestamp.setDate(nextTimestamp.getDate() + UPDATE_INTERVAL_DAYS)
  }

  return nextTimestamp.toISOString()
}

function buildJobList() {
  const jobs = []
  for (const platform of PLATFORM_CONFIGS) {
    for (const board of BOARD_OPTIONS) {
      jobs.push({
        platformKey: platform.key,
        boardType: board.key,
        boardLabel: board.label
      })
    }
  }
  return jobs
}

function randomInt(min, max) {
  const lower = Math.min(min, max)
  const upper = Math.max(min, max)
  return Math.round(lower + Math.random() * (upper - lower))
}

function sleep(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, Math.max(0, ms))
  })
}

function createHttpClient(baseURL = '') {
  return axios.create({
    baseURL,
    timeout: REQUEST_TIMEOUT_MS,
    headers: {
      Accept: 'application/json, text/plain, */*',
      'User-Agent': 'QiuAi Selection Sync/2.0'
    }
  })
}

function buildRequestParams(platformConfig, boardType) {
  const boardDefaults = platformConfig.defaultQuery?.[boardType] || {}
  const params = {
    page: 1,
    size: SELECTION_FETCH_SIZE,
    sort: boardDefaults.sort || 'sold',
    order: boardDefaults.order || 'descend'
  }

  if (platformConfig.fixedSiteId) {
    params.siteId = platformConfig.fixedSiteId
  }

  if (boardDefaults.onSaleTimeMonthsAgo) {
    const now = new Date()
    const start = new Date(now)
    start.setMonth(start.getMonth() - boardDefaults.onSaleTimeMonthsAgo)
    params.onSaleTimeMin = start.toISOString()
    params.onSaleTimeMax = now.toISOString()
  }

  if (boardDefaults.onSaleTimeYearsAgo) {
    const now = new Date()
    const start = new Date(now)
    start.setFullYear(start.getFullYear() - boardDefaults.onSaleTimeYearsAgo)
    params.onSaleTimeMin = start.toISOString()
    params.onSaleTimeMax = now.toISOString()
  }

  if (boardDefaults.mallOpenTimeMonthsAgo) {
    const now = new Date()
    const start = new Date(now)
    start.setMonth(start.getMonth() - boardDefaults.mallOpenTimeMonthsAgo)
    params.mallOpenTimeMin = start.toISOString()
    params.mallOpenTimeMax = now.toISOString()
  }

  if (boardDefaults.mallOpenTimeYearsAgo) {
    const now = new Date()
    const start = new Date(now)
    start.setFullYear(start.getFullYear() - boardDefaults.mallOpenTimeYearsAgo)
    params.mallOpenTimeMin = start.toISOString()
    params.mallOpenTimeMax = now.toISOString()
  }

  return params
}

function isRiskResponseError(error) {
  const status = Number(error?.response?.status) || 0
  if ([401, 403, 429, 451, 503].includes(status)) {
    return true
  }

  const message = String(error?.message || error?.response?.data?.msg || '').toLowerCase()
  return message.includes('forbidden') ||
    message.includes('too many') ||
    message.includes('captcha') ||
    message.includes('verify') ||
    message.includes('blocked')
}

function buildRiskStopError(message = 'selection-source-risk-stop') {
  const error = new Error(message)
  error.code = 'SELECTION_SOURCE_RISK_STOP'
  return error
}

function stripTemporalParams(params = {}) {
  const nextParams = { ...params }
  delete nextParams.onSaleTimeMin
  delete nextParams.onSaleTimeMax
  delete nextParams.mallOpenTimeMin
  delete nextParams.mallOpenTimeMax
  return nextParams
}

async function fetchBoardItems(platformConfig, boardType) {
  const httpClient = createHttpClient(platformConfig.apiBaseUrl)
  const params = buildRequestParams(platformConfig, boardType)
  const fallbackParams = stripTemporalParams(params)
  const canFallbackWithoutTimeFilter = JSON.stringify(fallbackParams) !== JSON.stringify(params)
  let lastError = null

  for (let attemptIndex = 0; attemptIndex < 2; attemptIndex += 1) {
    const currentParams = attemptIndex === 1 && canFallbackWithoutTimeFilter
      ? fallbackParams
      : params
    try {
      const response = await httpClient.get('/api/v1/goods/search', { params: currentParams })
      const payload = response?.data
      if (Number(payload?.code) !== 0 || !payload?.data?.list) {
        throw new Error(String(payload?.msg || 'selection-source-invalid-response'))
      }

      return {
        params: currentParams,
        list: Array.isArray(payload.data.list) ? payload.data.list : []
      }
    } catch (error) {
      lastError = error
      if (isRiskResponseError(error)) {
        throw buildRiskStopError(String(error?.message || 'selection-source-risk-stop'))
      }

      if (attemptIndex === 0) {
        await sleep(randomInt(RETRY_DELAY_RANGE_MS[0], RETRY_DELAY_RANGE_MS[1]))
      }
    }
  }

  throw lastError || new Error('selection-source-fetch-failed')
}

function sortAndTrimItems(items = [], platformKey = '', boardType = '') {
  return [...items]
    .sort((leftItem, rightItem) => {
      return getPrimarySortValue(rightItem, platformKey, boardType) - getPrimarySortValue(leftItem, platformKey, boardType)
    })
    .slice(0, SELECTION_PAGE_SIZE)
}

async function listBoardCacheFiles() {
  await ensureDirectory(SELECTION_CACHE_DIRECTORY)
  const entries = await fs.readdir(SELECTION_CACHE_DIRECTORY, { withFileTypes: true }).catch(() => [])
  return entries
    .filter((entry) => entry.isFile() && entry.name.endsWith('.json') && entry.name !== 'manifest.json')
    .map((entry) => entry.name)
}

function filterItemsByKeyword(items = [], keyword = '') {
  const normalizedKeyword = String(keyword || '').trim().toLowerCase()
  if (!normalizedKeyword) {
    return Array.isArray(items) ? items : []
  }

  return (Array.isArray(items) ? items : []).filter((item) => {
    const haystack = [
      item?.title,
      item?.subtitle,
      item?.categoryText,
      item?.priceText,
      item?.salesVolumeText,
      ...(Array.isArray(item?.extractedKeywords) ? item.extractedKeywords : [])
    ]
      .filter(Boolean)
      .join(' ')
      .toLowerCase()

    return haystack.includes(normalizedKeyword)
  })
}

function paginateItems(items = [], page = 1, pageSize = SELECTION_PAGE_SIZE) {
  const normalizedPage = Math.max(1, Number(page) || 1)
  const normalizedPageSize = Math.max(1, Number(pageSize) || SELECTION_PAGE_SIZE)
  return {
    totalItems: items.length,
    items: items.slice((normalizedPage - 1) * normalizedPageSize, normalizedPage * normalizedPageSize)
  }
}

function createSelectionCacheService() {
  let currentUpdatePromise = null

  async function readManifest() {
    return normalizeManifest(await readJsonFile(SELECTION_MANIFEST_PATH, createEmptyManifest()))
  }

  async function writeManifest(manifest) {
    return writeJsonFile(SELECTION_MANIFEST_PATH, normalizeManifest(manifest))
  }

  async function updateManifestState(patch = {}) {
    const currentManifest = await readManifest()
    const nextManifest = normalizeManifest({
      ...currentManifest,
      ...patch,
      updateState: {
        ...currentManifest.updateState,
        ...(patch.updateState || {})
      }
    })
    await writeManifest(nextManifest)
    return nextManifest
  }

  async function ensureManifest() {
    const currentManifest = await readManifest()
    if (currentManifest.schemaVersion !== SELECTION_SCHEMA_VERSION) {
      const nextManifest = createEmptyManifest()
      await writeManifest(nextManifest)
      return nextManifest
    }
    return currentManifest
  }

  async function maybeStartScheduledUpdate() {
    const manifest = await ensureManifest()
    if (manifest.updateState?.isUpdating || currentUpdatePromise) {
      return manifest
    }

    const hasAnyBoardData = Array.isArray(manifest.boards) && manifest.boards.length > 0
    const shouldRunInitialUpdate = !manifest.firstFetchedAt || !hasAnyBoardData
    const shouldRunScheduledUpdate = Boolean(
      manifest.firstFetchedAt &&
      manifest.nextRefreshAt &&
      new Date(manifest.nextRefreshAt).getTime() <= Date.now()
    )

    if (!shouldRunInitialUpdate && !shouldRunScheduledUpdate) {
      return manifest
    }

    const reason = shouldRunInitialUpdate ? 'initial-fetch' : 'weekly-refresh'
    const jobs = buildJobList()
    const startedManifest = await updateManifestState({
      updateState: {
        status: 'updating',
        isUpdating: true,
        startedAt: new Date().toISOString(),
        completedAt: '',
        currentPlatform: '',
        currentBoardType: '',
        completedJobs: 0,
        totalJobs: jobs.length,
        progressPercent: 0,
        message: reason === 'initial-fetch' ? '正在初始化选品数据' : '正在更新选品数据',
        lockReason: 'selection-refresh-running',
        slowMode: false,
        lastErrorMessage: ''
      }
    })

    currentUpdatePromise = performScheduledUpdate({
      reason,
      skipStartStateWrite: true
    }).finally(() => {
      currentUpdatePromise = null
    })

    return startedManifest
  }

  async function performScheduledUpdate({ reason = 'weekly-refresh', skipStartStateWrite = false } = {}) {
    const startTime = Date.now()
    const previousManifest = await ensureManifest()
    const jobs = buildJobList()
    const stagedPayloads = []

    if (!skipStartStateWrite) {
      await updateManifestState({
        updateState: {
          status: 'updating',
          isUpdating: true,
          startedAt: new Date().toISOString(),
          completedAt: '',
          currentPlatform: '',
          currentBoardType: '',
          completedJobs: 0,
          totalJobs: jobs.length,
          progressPercent: 0,
          message: reason === 'initial-fetch' ? '正在初始化选品数据' : '正在更新选品数据',
          lockReason: 'selection-refresh-running',
          slowMode: false,
          lastErrorMessage: ''
        }
      })
    }

    try {
      for (let jobIndex = 0; jobIndex < jobs.length; jobIndex += 1) {
        const job = jobs[jobIndex]
        const platformConfig = PLATFORM_MAP.get(job.platformKey)
        if (!platformConfig) {
          continue
        }

        const elapsedMs = Date.now() - startTime
        if (elapsedMs > UPDATE_HARD_MAX_MS) {
          throw buildRiskStopError('selection-refresh-hard-timeout')
        }

        await updateManifestState({
          updateState: {
            currentPlatform: platformConfig.key,
            currentBoardType: job.boardType,
            completedJobs: jobIndex,
            totalJobs: jobs.length,
            progressPercent: Math.min(99, Math.round((jobIndex / jobs.length) * 100)),
            message: '正在更新选品数据',
            slowMode: elapsedMs > UPDATE_SOFT_MAX_MS
          }
        })

        const fetchResult = await fetchBoardItems(platformConfig, job.boardType)
        const normalizedItems = fetchResult.list
          .map((row) => normalizeSelectionItem(row, { platform: platformConfig.key, boardType: job.boardType }))
          .map((row) => applyPresentationFields(row, platformConfig.key, job.boardType, platformConfig))
        const trimmedItems = sortAndTrimItems(normalizedItems, platformConfig.key, job.boardType)
        const capturedAt = new Date().toISOString()
        const boardPayload = {
          platform: platformConfig.key,
          boardType: job.boardType,
          boardLabel: job.boardLabel,
          siteCode: '',
          page: 1,
          pageSize: SELECTION_PAGE_SIZE,
          totalItems: trimmedItems.length,
          items: trimmedItems.map((item) => ({
            ...item,
            capturedAt
          })),
          capturedAt,
          requestMeta: fetchResult.params
        }

        stagedPayloads.push(boardPayload)

        if (jobIndex < jobs.length - 1) {
          await sleep(randomInt(REQUEST_DELAY_RANGE_MS[0], REQUEST_DELAY_RANGE_MS[1]))
        }
      }

      const stagedFileNames = []
      for (const payload of stagedPayloads) {
        const boardKey = normalizeBoardKey(payload)
        stagedFileNames.push(`${boardKey}.json`)
        await writeJsonFile(buildBoardCachePath(boardKey), payload)
      }

      const existingFileNames = await listBoardCacheFiles()
      for (const fileName of existingFileNames) {
        if (!stagedFileNames.includes(fileName)) {
          await fs.rm(path.resolve(SELECTION_CACHE_DIRECTORY, fileName), { force: true }).catch(() => {})
        }
      }

      const nowIsoString = new Date().toISOString()
      const firstFetchedAt = previousManifest.firstFetchedAt || nowIsoString
      const nextManifest = normalizeManifest({
        ...previousManifest,
        generatedAt: nowIsoString,
        firstFetchedAt,
        lastCompletedAt: nowIsoString,
        nextRefreshAt: computeNextRefreshAt(firstFetchedAt, new Date(nowIsoString)),
        boards: stagedPayloads.map((payload) => ({
          platform: payload.platform,
          boardType: payload.boardType,
          siteCode: '',
          version: `${payload.platform}-${payload.boardType}-${nowIsoString}`,
          itemCount: payload.items.length,
          capturedAt: payload.capturedAt
        })),
        updateState: {
          status: 'success',
          isUpdating: false,
          startedAt: previousManifest.updateState?.startedAt || '',
          completedAt: nowIsoString,
          currentPlatform: '',
          currentBoardType: '',
          completedJobs: jobs.length,
          totalJobs: jobs.length,
          progressPercent: 100,
          message: '选品数据已更新完成',
          lockReason: '',
          slowMode: Date.now() - startTime > UPDATE_SOFT_MAX_MS,
          lastErrorMessage: ''
        }
      })

      await writeManifest(nextManifest)
    } catch (error) {
      const isRiskStop = error?.code === 'SELECTION_SOURCE_RISK_STOP'
      const failureMessage = isRiskStop ? '请联系管理员' : '选品数据更新失败'
      await updateManifestState({
        updateState: {
          status: isRiskStop ? 'risk-stop' : 'failed',
          isUpdating: false,
          completedAt: new Date().toISOString(),
          currentPlatform: '',
          currentBoardType: '',
          progressPercent: 100,
          message: failureMessage,
          lockReason: '',
          slowMode: Date.now() - startTime > UPDATE_SOFT_MAX_MS,
          lastErrorMessage: String(error?.message || failureMessage)
        }
      })
    }
  }

  async function getManifest() {
    const startedManifest = await maybeStartScheduledUpdate()
    return startedManifest || readManifest()
  }

  async function listPlatforms() {
    await maybeStartScheduledUpdate()
    return PLATFORM_CONFIGS.map((platform) => ({
      key: platform.key,
      label: platform.label
    }))
  }

  async function listSites() {
    return []
  }

  async function listItems({ platform = '', boardType = '', keyword = '', page = 1, pageSize = SELECTION_PAGE_SIZE } = {}) {
    await maybeStartScheduledUpdate()
    const boardKey = normalizeBoardKey({ platform, boardType })
    const cachePath = buildBoardCachePath(boardKey)
    let payload = normalizeBoardPayload(await readJsonFile(cachePath, createEmptyBoardPayload({ platform, boardType, page, pageSize })))
    if ((!Array.isArray(payload.items) || payload.items.length === 0) && currentUpdatePromise) {
      await currentUpdatePromise.catch(() => {})
      payload = normalizeBoardPayload(await readJsonFile(cachePath, createEmptyBoardPayload({ platform, boardType, page, pageSize })))
    }
    const filteredItems = filterItemsByKeyword(payload.items, keyword)
    const paginatedItems = paginateItems(filteredItems, page, pageSize)

    return {
      ...payload,
      page: Math.max(1, Number(page) || 1),
      pageSize: Math.max(1, Number(pageSize) || SELECTION_PAGE_SIZE),
      totalItems: paginatedItems.totalItems,
      items: paginatedItems.items
    }
  }

  async function getItemDetail({ id = '' } = {}) {
    await maybeStartScheduledUpdate()
    const normalizedId = String(id || '').trim()
    if (!normalizedId) {
      throw new Error('Selection item id is required.')
    }

    const boardFiles = await listBoardCacheFiles()
    for (const fileName of boardFiles) {
      const payload = normalizeBoardPayload(await readJsonFile(path.resolve(SELECTION_CACHE_DIRECTORY, fileName), {}))
      const matchedItem = (Array.isArray(payload.items) ? payload.items : []).find((item) => {
        return String(item?.id || '').trim() === normalizedId
      })
      if (matchedItem) {
        const platformConfig = PLATFORM_MAP.get(String(payload.platform || '').trim().toLowerCase()) || null
        return normalizeCachedSelectionItem(matchedItem, platformConfig)
      }
    }

    throw new Error('Selection item was not found.')
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
  normalizeBoardKey,
  normalizeRemoteImageUrl
}
