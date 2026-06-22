import { normalizePublishPlatform, normalizeProjectPublishDraft } from './publishContract'

function trimString (value = '') {
  return String(value || '').trim()
}

function isRemotePublishMediaUrl (value = '') {
  return /^https?:\/\//i.test(trimString(value))
}

function hasNonEmptyMedia (project = {}) {
  const assets = project?.assets && typeof project.assets === 'object' ? project.assets : {}
  const generatedImages = Array.isArray(assets.generatedImages) ? assets.generatedImages : []
  const sourceImages = Array.isArray(assets.sourceImages) ? assets.sourceImages : []
  return generatedImages.length > 0 || sourceImages.length > 0
}

function hasRemotePublishReadyMedia (project = {}) {
  const assets = project?.assets && typeof project.assets === 'object' ? project.assets : {}
  const generatedImages = Array.isArray(assets.generatedImages) ? assets.generatedImages : []
  return generatedImages.some((item) => {
    return isRemotePublishMediaUrl(item?.publishReadyUrl || item?.downloadUrl || item?.sourceUrl || '')
  })
}

function buildLocalValidationError ({
  title = '',
  message = '',
  missingFields = [],
  missingFieldLabels = []
} = {}) {
  return {
    title,
    message,
    missingFields: Array.isArray(missingFields)
      ? missingFields.map((item) => trimString(item)).filter(Boolean)
      : [],
    missingFieldLabels: Array.isArray(missingFieldLabels)
      ? missingFieldLabels.map((item) => trimString(item)).filter(Boolean)
      : []
  }
}

export function validatePublishDraftBeforeRemote ({
  project = {},
  platform = '',
  profile = null,
  operationType = 'create-listing'
} = {}) {
  const normalizedPlatform = normalizePublishPlatform(platform || project?.platformTarget?.[0] || '')
  const normalizedProfile = profile && typeof profile === 'object' ? profile : null
  const publishDraft = normalizeProjectPublishDraft(project)
  const platformDraft = publishDraft.platformDrafts?.[normalizedPlatform] && typeof publishDraft.platformDrafts[normalizedPlatform] === 'object'
    ? publishDraft.platformDrafts[normalizedPlatform]
    : {}
  const requiredAttributes = Array.isArray(normalizedProfile?.requiredAttributes)
    ? normalizedProfile.requiredAttributes
    : []
  const variants = Array.isArray(publishDraft.variants) ? publishDraft.variants : []
  const primaryVariant = variants[0] && typeof variants[0] === 'object' ? variants[0] : {}
  const requiresCreateFields = operationType !== 'sync-status'
  const missingAttribute = requiredAttributes.find((attribute) => {
    const key = trimString(attribute?.key || '')
    return key && !trimString(platformDraft?.attributes?.[key] || '')
  }) || null

  if (!trimString(project?.content?.selectedTitle || project?.content?.titleCandidates?.[0] || project?.baseInfo?.productName || project?.name || '')) {
    return buildLocalValidationError({
      title: '鍙戝竷鏍囬鏈噯澶囧ソ',
      message: '璇峰厛涓哄綋鍓嶉」鐩ˉ鍏呮爣棰橈紝鍐嶈繘琛屽彂甯冮瑙堟垨鍒涘缓浠诲姟銆?',
      missingFields: ['title'],
      missingFieldLabels: ['Title']
    })
  }

  if (!trimString(project?.content?.selectedDescription || project?.content?.descriptionCandidates?.[0] || '')) {
    return buildLocalValidationError({
      title: '鍙戝竷鎻忚堪鏈噯澶囧ソ',
      message: '璇峰厛鐢熸垚鎴栧～鍐欐弿杩板唴瀹癸紝鍐嶈繘琛屽彂甯冮瑙堟垨鍒涘缓浠诲姟銆?',
      missingFields: ['descriptionHtml'],
      missingFieldLabels: ['Description']
    })
  }

  if (!hasNonEmptyMedia(project)) {
    return buildLocalValidationError({
      title: '鍙戝竷绱犳潗鏈噯澶囧ソ',
      message: '璇峰厛涓哄綋鍓嶉」鐩ˉ鍏呰嚦灏戜竴寮犲浘鐗囩礌鏉愩€?',
      missingFields: ['media'],
      missingFieldLabels: ['Media']
    })
  }

  if (requiresCreateFields && !hasRemotePublishReadyMedia(project)) {
    return buildLocalValidationError({
      title: 'Publish media is not ready',
      message: 'At least one generated media asset needs a server-accessible publish URL before create-listing.',
      missingFields: ['media[0].publishReadyUrl'],
      missingFieldLabels: ['Primary Media Publish URL']
    })
  }

  if (requiresCreateFields && !trimString(platformDraft?.categoryId || '')) {
    return buildLocalValidationError({
      title: '绫荤洰鏈～鍐?',
      message: '璇峰厛濉啓 Category ID锛屽啀杩涜鍙戝竷棰勮鎴栧垱寤轰换鍔°€?',
      missingFields: ['platformDraft.categoryId'],
      missingFieldLabels: ['Category ID']
    })
  }

  if (requiresCreateFields && missingAttribute) {
    const attributeKey = trimString(missingAttribute.key || 'required')
    const attributeLabel = trimString(missingAttribute.label || missingAttribute.key || 'Required Attribute')
    return buildLocalValidationError({
      title: '骞冲彴灞炴€ф湭濉啓',
      message: `璇峰厛濉啓 ${trimString(missingAttribute.label || missingAttribute.key || 'required attribute')}锛屽啀杩涜鍙戝竷棰勮鎴栧垱寤轰换鍔°€俙`,
      missingFields: [`platformDraft.attributes.${attributeKey}`],
      missingFieldLabels: [attributeLabel]
    })
  }

  if (requiresCreateFields && variants.length === 0) {
    return buildLocalValidationError({
      title: 'SKU 鏈～鍐?',
      message: '璇峰厛涓哄綋鍓嶅彂甯冭崏绋垮姞鍏ヨ嚦灏戜竴涓?SKU锛屽啀杩涜鍙戝竷棰勮鎴栧垱寤轰换鍔°€?',
      missingFields: ['variants'],
      missingFieldLabels: ['Variants']
    })
  }

  if (requiresCreateFields && !trimString(primaryVariant?.sellerSkuCode || '')) {
    return buildLocalValidationError({
      title: 'SKU 鏈～鍐?',
      message: '璇峰厛濉啓 Seller SKU锛屽啀杩涜鍙戝竷棰勮鎴栧垱寤轰换鍔°€?',
      missingFields: ['variants[0].sellerSkuCode'],
      missingFieldLabels: ['Primary Variant SKU']
    })
  }

  if (requiresCreateFields && !Number.isFinite(Number(primaryVariant?.priceAmount))) {
    return buildLocalValidationError({
      title: '浠锋牸鏈～鍐?',
      message: '璇峰厛涓洪涓?SKU 濉啓鏈夋晥浠锋牸锛屽啀杩涜鍙戝竷棰勮鎴栧垱寤轰换鍔°€?',
      missingFields: ['variants[0].priceAmount'],
      missingFieldLabels: ['Primary Variant Price']
    })
  }

  if (requiresCreateFields && Number(primaryVariant?.stockQuantity || 0) <= 0) {
    return buildLocalValidationError({
      title: '搴撳瓨鏈～鍐?',
      message: '璇峰厛涓洪涓?SKU 濉啓澶т簬 0 鐨勫簱瀛橈紝鍐嶈繘琛屽彂甯冮瑙堟垨鍒涘缓浠诲姟銆?',
      missingFields: ['variants[0].stockQuantity'],
      missingFieldLabels: ['Primary Variant Stock']
    })
  }

  return null
}
