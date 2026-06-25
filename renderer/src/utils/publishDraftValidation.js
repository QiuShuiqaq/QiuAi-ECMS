import { normalizePublishPlatform, normalizeProjectPublishDraft } from './publishContract'

function trimString(value = '') {
  return String(value || '').trim()
}

function isRemotePublishMediaUrl(value = '') {
  return /^https?:\/\//i.test(trimString(value))
}

function hasNonEmptyMedia(project = {}) {
  const assets = project?.assets && typeof project.assets === 'object' ? project.assets : {}
  const generatedImages = Array.isArray(assets.generatedImages) ? assets.generatedImages : []
  const sourceImages = Array.isArray(assets.sourceImages) ? assets.sourceImages : []
  return generatedImages.length > 0 || sourceImages.length > 0
}

function hasRemotePublishReadyMedia(project = {}) {
  const assets = project?.assets && typeof project.assets === 'object' ? project.assets : {}
  const generatedImages = Array.isArray(assets.generatedImages) ? assets.generatedImages : []
  return generatedImages.some((item) => {
    return isRemotePublishMediaUrl(item?.publishReadyUrl || item?.downloadUrl || item?.sourceUrl || '')
  })
}

function buildLocalValidationError({
  title = '',
  message = '',
  missingFields = [],
  missingFieldLabels = [],
} = {}) {
  return {
    title,
    message,
    missingFields: Array.isArray(missingFields)
      ? missingFields.map((item) => trimString(item)).filter(Boolean)
      : [],
    missingFieldLabels: Array.isArray(missingFieldLabels)
      ? missingFieldLabels.map((item) => trimString(item)).filter(Boolean)
      : [],
  }
}

export function validatePublishDraftBeforeRemote({
  project = {},
  platform = '',
  profile = null,
  operationType = 'create-listing',
} = {}) {
  const normalizedPlatform = normalizePublishPlatform(platform || project?.platformTarget?.[0] || '')
  const normalizedProfile = profile && typeof profile === 'object' ? profile : null
  const publishDraft = normalizeProjectPublishDraft(project)
  const platformDraft =
    publishDraft.platformDrafts?.[normalizedPlatform] &&
    typeof publishDraft.platformDrafts[normalizedPlatform] === 'object'
      ? publishDraft.platformDrafts[normalizedPlatform]
      : {}
  const requiredAttributes = Array.isArray(normalizedProfile?.requiredAttributes)
    ? normalizedProfile.requiredAttributes
    : []
  const variants = Array.isArray(publishDraft.variants) ? publishDraft.variants : []
  const primaryVariant = variants[0] && typeof variants[0] === 'object' ? variants[0] : {}
  const requiresCreateFields = operationType !== 'sync-status'
  const missingAttribute =
    requiredAttributes.find((attribute) => {
      const key = trimString(attribute?.key || '')
      return key && !trimString(platformDraft?.attributes?.[key] || '')
    }) || null

  if (
    !trimString(
      project?.content?.selectedTitle ||
        project?.content?.titleCandidates?.[0] ||
        project?.baseInfo?.productName ||
        project?.name ||
        '',
    )
  ) {
    return buildLocalValidationError({
      title: '标题不能为空',
      message: '请先补全标题，再发起远程发布校验或发布任务。',
      missingFields: ['title'],
      missingFieldLabels: ['Title'],
    })
  }

  if (!trimString(project?.content?.selectedDescription || project?.content?.descriptionCandidates?.[0] || '')) {
    return buildLocalValidationError({
      title: '描述不能为空',
      message: '请先补全描述，再发起远程发布校验或发布任务。',
      missingFields: ['descriptionHtml'],
      missingFieldLabels: ['Description'],
    })
  }

  if (!hasNonEmptyMedia(project)) {
    return buildLocalValidationError({
      title: '素材不能为空',
      message: '请先补全素材，再发起远程发布校验或发布任务。',
      missingFields: ['media'],
      missingFieldLabels: ['Media'],
    })
  }

  if (requiresCreateFields && !hasRemotePublishReadyMedia(project)) {
    return buildLocalValidationError({
      title: '发布素材未就绪',
      message: '至少需要一个带远程发布地址的生成素材，才能执行 create-listing。',
      missingFields: ['media[0].publishReadyUrl'],
      missingFieldLabels: ['Primary Media Publish URL'],
    })
  }

  if (requiresCreateFields && !trimString(platformDraft?.categoryId || '')) {
    return buildLocalValidationError({
      title: '类目 ID 不能为空',
      message: '请先补全发布草稿里的类目 ID，再发起远程发布校验或发布任务。',
      missingFields: ['platformDraft.categoryId'],
      missingFieldLabels: ['Category ID'],
    })
  }

  if (requiresCreateFields && missingAttribute) {
    const attributeKey = trimString(missingAttribute.key || 'required')
    const attributeLabel = trimString(missingAttribute.label || missingAttribute.key || 'Required Attribute')
    return buildLocalValidationError({
      title: '平台属性不能为空',
      message: `请先补全平台属性 ${trimString(
        missingAttribute.label || missingAttribute.key || 'required attribute',
      )}，再发起远程发布校验或发布任务。`,
      missingFields: [`platformDraft.attributes.${attributeKey}`],
      missingFieldLabels: [attributeLabel],
    })
  }

  if (requiresCreateFields && variants.length === 0) {
    return buildLocalValidationError({
      title: 'SKU 不能为空',
      message: '请至少补一条 SKU，再发起远程发布校验或发布任务。',
      missingFields: ['variants'],
      missingFieldLabels: ['Variants'],
    })
  }

  if (requiresCreateFields && !trimString(primaryVariant?.sellerSkuCode || '')) {
    return buildLocalValidationError({
      title: 'SKU 编码不能为空',
      message: '请先补全一条 SKU 编码，再发起远程发布校验或发布任务。',
      missingFields: ['variants[0].sellerSkuCode'],
      missingFieldLabels: ['Primary Variant SKU'],
    })
  }

  if (requiresCreateFields && !Number.isFinite(Number(primaryVariant?.priceAmount))) {
    return buildLocalValidationError({
      title: 'SKU 价格不能为空',
      message: '请先补全一条 SKU 价格，再发起远程发布校验或发布任务。',
      missingFields: ['variants[0].priceAmount'],
      missingFieldLabels: ['Primary Variant Price'],
    })
  }

  if (requiresCreateFields && Number(primaryVariant?.stockQuantity || 0) <= 0) {
    return buildLocalValidationError({
      title: 'SKU 库存不能为空',
      message: '请先补全一条 SKU 库存，再发起远程发布校验或发布任务。',
      missingFields: ['variants[0].stockQuantity'],
      missingFieldLabels: ['Primary Variant Stock'],
    })
  }

  return null
}
