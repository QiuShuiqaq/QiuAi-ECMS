import { normalizePublishPlatform, normalizeProjectPublishDraft } from './publishContract'

function trimString (value = '') {
  return String(value || '').trim()
}

function hasNonEmptyMedia (project = {}) {
  const assets = project?.assets && typeof project.assets === 'object' ? project.assets : {}
  const generatedImages = Array.isArray(assets.generatedImages) ? assets.generatedImages : []
  const sourceImages = Array.isArray(assets.sourceImages) ? assets.sourceImages : []
  return generatedImages.length > 0 || sourceImages.length > 0
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
    return {
      title: '发布标题未准备好',
      message: '请先为当前项目补充标题，再进行发布预览或创建任务。'
    }
  }

  if (!trimString(project?.content?.selectedDescription || project?.content?.descriptionCandidates?.[0] || '')) {
    return {
      title: '发布描述未准备好',
      message: '请先生成或填写描述内容，再进行发布预览或创建任务。'
    }
  }

  if (!hasNonEmptyMedia(project)) {
    return {
      title: '发布素材未准备好',
      message: '请先为当前项目补充至少一张图片素材。'
    }
  }

  if (requiresCreateFields && !trimString(platformDraft?.categoryId || '')) {
    return {
      title: '类目未填写',
      message: '请先填写 Category ID，再进行发布预览或创建任务。'
    }
  }

  if (requiresCreateFields && missingAttribute) {
    return {
      title: '平台属性未填写',
      message: `请先填写 ${trimString(missingAttribute.label || missingAttribute.key || 'required attribute')}，再进行发布预览或创建任务。`
    }
  }

  if (requiresCreateFields && !trimString(primaryVariant?.sellerSkuCode || '')) {
    return {
      title: 'SKU 未填写',
      message: '请先填写 Seller SKU，再进行发布预览或创建任务。'
    }
  }

  if (requiresCreateFields && !Number.isFinite(Number(primaryVariant?.priceAmount))) {
    return {
      title: '价格未填写',
      message: '请先为首个 SKU 填写有效价格，再进行发布预览或创建任务。'
    }
  }

  if (requiresCreateFields && Number(primaryVariant?.stockQuantity || 0) <= 0) {
    return {
      title: '库存未填写',
      message: '请先为首个 SKU 填写大于 0 的库存，再进行发布预览或创建任务。'
    }
  }

  return null
}
