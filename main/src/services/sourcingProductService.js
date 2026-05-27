const axios = require('axios')

function formatUtcString(date = new Date()) {
  return date.toUTCString().replace('GMT', 'GMT')
}

function createPastDateUtcString({ years = 0, months = 0, days = 0 } = {}) {
  const date = new Date()
  if (years) {
    date.setFullYear(date.getFullYear() - years)
  }
  if (months) {
    date.setMonth(date.getMonth() - months)
  }
  if (days) {
    date.setDate(date.getDate() - days)
  }
  return formatUtcString(date)
}

function normalizeText(value = '') {
  return typeof value === 'string' ? value.trim() : ''
}

function normalizeNumber(value = 0) {
  const numericValue = Number(value)
  return Number.isFinite(numericValue) ? numericValue : 0
}

function toWanString(value = 0) {
  const numericValue = normalizeNumber(value)
  if (numericValue <= 0) {
    return '0'
  }

  if (numericValue >= 10000) {
    const wanValue = numericValue / 10000
    return `${Number.isInteger(wanValue) ? wanValue : wanValue.toFixed(1)}万`
  }

  return String(Math.round(numericValue))
}

function toPercentString(rateValue = 0) {
  const numericValue = normalizeNumber(rateValue)
  if (numericValue === 0) {
    return '--'
  }

  const normalizedValue = Math.abs(numericValue) <= 1 ? numericValue * 100 : numericValue
  const prefix = normalizedValue > 0 ? '+' : ''
  return `${prefix}${normalizedValue.toFixed(normalizedValue % 1 === 0 ? 0 : 1)}%`
}

function toPriceRangeString(minPrice, maxPrice) {
  const min = Number(minPrice)
  const max = Number(maxPrice)

  if (Number.isFinite(min) && Number.isFinite(max)) {
    return min === max ? `$${min}` : `$${min} - $${max}`
  }

  if (Number.isFinite(min)) {
    return `$${min}`
  }

  if (Number.isFinite(max)) {
    return `$${max}`
  }

  return ''
}

function normalizePreviewUrl(thumbnail = '', platformKey = '') {
  const normalizedThumbnail = normalizeText(thumbnail)
  if (!normalizedThumbnail) {
    return ''
  }

  if (normalizedThumbnail.startsWith('http://') || normalizedThumbnail.startsWith('https://')) {
    return normalizedThumbnail
  }

  if (normalizedThumbnail.startsWith('//')) {
    return `https:${normalizedThumbnail}`
  }

  if (platformKey === 'shopee') {
    return `https://down-my.img.susercontent.com/${normalizedThumbnail}`
  }

  return normalizedThumbnail
}

async function createPreviewDataUrl(previewUrl = '') {
  const normalizedPreviewUrl = normalizeText(previewUrl)
  if (!normalizedPreviewUrl) {
    return ''
  }

  try {
    const response = await axios.get(normalizedPreviewUrl, {
      responseType: 'arraybuffer',
      timeout: 20000,
      headers: {
        Accept: 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8',
        'User-Agent': 'Mozilla/5.0'
      }
    })
    const contentType = normalizeText(response?.headers?.['content-type']) || 'image/webp'
    const buffer = Buffer.from(response.data || [])
    if (!buffer.length) {
      return ''
    }

    return `data:${contentType};base64,${buffer.toString('base64')}`
  } catch {
    return ''
  }
}

function buildTagList(item = {}) {
  const tags = []
  const catItems = Array.isArray(item.catItems) ? item.catItems : []

  for (const catItem of catItems.slice(-3)) {
    const tagLabel = normalizeText(catItem?.catName || '')
    if (tagLabel) {
      tags.push(tagLabel)
    }
  }

  return tags
}

function getTotalSoldValue(item = {}) {
  return normalizeNumber(
    item.sales ??
    item.totalSold ??
    item.sold ??
    item.monthSold ??
    item.reviewNum ??
    0
  )
}

async function normalizeProductItem(item = {}, platformKey, config) {
  const title = normalizeText(item.goodsNameCn || item.goodsName || item.goodsNameEn || '')
  const summary = normalizeText(item.goodsNameEn || item.goodsName || item.goodsNameCn || '')
  const totalSoldValue = getTotalSoldValue(item)
  const conversionBase = normalizeNumber(item.reviewNum || item.mallReviewNum || item.sold || 0)
  const conversionValue = conversionBase
    ? ((normalizeNumber(item.sold || item.monthSold || item.totalSold || 0) / conversionBase) * 100)
    : 0
  const rateValue = item.totalSoldRate ?? item.monthSoldRate ?? item.daySoldRate ?? item.weekSoldRate ?? 0
  const categoryTags = buildTagList(item)
  const previewUrl = normalizePreviewUrl(item.thumbnail, platformKey)
  const preview = platformKey === 'smt'
    ? (await createPreviewDataUrl(previewUrl)) || previewUrl
    : previewUrl

  return {
    id: `${platformKey}-${item.goodsId || item.id || Math.random().toString(36).slice(2, 8)}`,
    platform: config.platformLabel,
    growth: toPercentString(rateValue),
    title: title || '未命名商品',
    summary: summary || '暂无商品说明',
    searchHeat: toWanString(totalSoldValue),
    conversion: conversionValue > 0 ? `${conversionValue.toFixed(conversionValue >= 10 ? 0 : 1)}%` : '--',
    assetDirection: toPriceRangeString(item.minPrice, item.maxPrice) || '价格待确认',
    tags: categoryTags.length ? categoryTags : [config.platformLabel],
    sourceUrl: config.openUrlBuilder(item),
    preview,
    raw: item,
    totalSoldValue
  }
}

function createSceneParamsBuilder({ hotMonths = 12, newMonths = 1, newStoreSoldMin = 100 } = {}) {
  return (sceneKey) => {
    if (sceneKey === 'hot_new') {
      return {
        onSaleTimeMin: createPastDateUtcString({ months: hotMonths }),
        onSaleTimeMax: formatUtcString(new Date())
      }
    }

    if (sceneKey === 'new_shop_hot') {
      return {
        mallOpenTimeMin: createPastDateUtcString({ years: 1 }),
        mallOpenTimeMax: formatUtcString(new Date()),
        soldMin: newStoreSoldMin
      }
    }

    if (sceneKey === 'big_sale_new') {
      return {
        onSaleTimeMin: createPastDateUtcString({ months: newMonths }),
        onSaleTimeMax: formatUtcString(new Date())
      }
    }

    return {}
  }
}

const PLATFORM_CONFIG = {
  temu: {
    apiBaseUrl: 'https://www.temaishuju.com',
    platformLabel: 'TEMU',
    apiPath: '/api/v1/goods/search',
    baseParams: {
      keyword: '',
      sort: 'sold',
      order: 'descend',
      page: 1,
      size: 30
    },
    buildQueryParams: createSceneParamsBuilder({
      hotMonths: 12,
      newMonths: 1,
      newStoreSoldMin: 100
    }),
    openUrlBuilder: (item = {}) => `https://www.temu.com/search_result.html?search_key=${encodeURIComponent(item.goodsId || '')}&search_method=user&region=37`,
    refererUrl: 'https://www.temaishuju.com/goods/hot-sale'
  },
  shein: {
    apiBaseUrl: 'https://api.sheinshuju.com',
    platformLabel: 'SHEIN',
    apiPath: '/api/v1/goods/search',
    baseParams: {
      keyword: '',
      sort: 'totalSold',
      order: 'descend',
      page: 1,
      size: 30
    },
    buildQueryParams: createSceneParamsBuilder({
      hotMonths: 12,
      newMonths: 1,
      newStoreSoldMin: 100
    }),
    openUrlBuilder: (item = {}) => `https://${encodeURIComponent(item.siteUID || 'us')}.shein.com/goods-detail-p-${encodeURIComponent(item.goodsId || '')}.html`,
    refererUrl: 'https://www.sheinshuju.com/goods/hot-sale'
  },
  shopee: {
    apiBaseUrl: 'https://api.xiapishuju.com',
    platformLabel: '虾皮',
    apiPath: '/api/v2/goods/search',
    baseParams: {
      siteId: 1,
      sort: 'totalSold',
      order: 'descend',
      page: 1,
      size: 30
    },
    buildQueryParams: createSceneParamsBuilder({
      hotMonths: 12,
      newMonths: 1,
      newStoreSoldMin: 100
    }),
    openUrlBuilder: (item = {}) => {
      const itemId = encodeURIComponent(item.goodsId || '')
      const shopId = encodeURIComponent(item.mallId || '')
      return `https://shopee.com.my/-i.${shopId}.${itemId}`
    },
    refererUrl: 'https://www.xiapishuju.com/goods/hot-sale'
  },
  amazon: {
    apiBaseUrl: 'https://api.amazonshuju.com',
    platformLabel: '亚马逊',
    apiPath: '/api/v1/goods/search',
    baseParams: {
      keyword: '',
      sort: 'totalSold',
      order: 'descend',
      page: 1,
      size: 30
    },
    buildQueryParams: createSceneParamsBuilder({
      hotMonths: 12,
      newMonths: 1,
      newStoreSoldMin: 100
    }),
    openUrlBuilder: (item = {}) => `https://www.amazon.com/dp/${encodeURIComponent(item.goodsId || '')}`,
    refererUrl: 'https://www.amazonshuju.com/goods/hot-sale'
  },
  smt: {
    apiBaseUrl: 'https://api.sumaitongshuju.com',
    platformLabel: '速卖通',
    apiPath: '/api/v1/goods/search',
    baseParams: {
      keyword: '',
      siteId: 1,
      sort: 'totalSold',
      order: 'descend',
      page: 1,
      size: 30
    },
    buildQueryParams: createSceneParamsBuilder({
      hotMonths: 12,
      newMonths: 1,
      newStoreSoldMin: 100
    }),
    openUrlBuilder: (item = {}) => `https://www.aliexpress.us/item/${encodeURIComponent(item.goodsId || '')}.html`,
    refererUrl: 'https://www.sumaitongshuju.com/goods/hot-sale'
  },
  tiktok: {
    apiBaseUrl: 'https://api.tiktokshuju.com',
    platformLabel: 'TikTok',
    apiPath: '/api/v1/goods/search',
    baseParams: {
      keyword: '',
      siteId: 1,
      sort: 'totalSold',
      order: 'descend',
      page: 1,
      size: 30
    },
    buildQueryParams: createSceneParamsBuilder({
      hotMonths: 12,
      newMonths: 1,
      newStoreSoldMin: 100
    }),
    openUrlBuilder: (item = {}) => `https://www.tiktok.com/shop/pdp/${encodeURIComponent(item.goodsId || '')}?source=product_detail`,
    refererUrl: 'https://www.tiktokshuju.com/goods/hot-sale'
  }
}

async function requestPlatformProducts(config, sceneKey) {
  const params = {
    ...(config.baseParams || {}),
    ...((typeof config.buildQueryParams === 'function' ? config.buildQueryParams(sceneKey) : {}) || {})
  }

  const response = await axios.get(`${config.apiBaseUrl}${config.apiPath}`, {
    params,
    timeout: 20000,
    headers: {
      Accept: 'application/json, text/plain, */*',
      Referer: config.refererUrl || `${config.apiBaseUrl}/goods/hot-sale`,
      'User-Agent': 'Mozilla/5.0'
    }
  })

  return Array.isArray(response?.data?.data?.list) ? response.data.data.list : []
}

function createSourcingProductService() {
  return {
    async listProducts({ platformKey = '', sceneKey = 'hot' } = {}) {
      const normalizedPlatformKey = typeof platformKey === 'string' ? platformKey.trim() : ''
      const normalizedSceneKey = typeof sceneKey === 'string' ? sceneKey.trim() : 'hot'
      const config = PLATFORM_CONFIG[normalizedPlatformKey]

      if (!config) {
        throw new Error('未授权的选品平台')
      }

      if (!['hot', 'hot_new', 'new_shop_hot', 'big_sale_new'].includes(normalizedSceneKey)) {
        throw new Error('未授权的选品分类')
      }

      const rawList = await requestPlatformProducts(config, normalizedSceneKey)
      const normalizedItems = (await Promise.all(
        rawList.map((item) => normalizeProductItem(item, normalizedPlatformKey, config))
      ))
        .sort((leftItem, rightItem) => rightItem.totalSoldValue - leftItem.totalSoldValue)
        .slice(0, 10)
        .map((item) => {
          const normalizedItem = { ...item }
          delete normalizedItem.totalSoldValue
          return normalizedItem
        })

      return normalizedItems
    }
  }
}

module.exports = {
  createSourcingProductService
}
