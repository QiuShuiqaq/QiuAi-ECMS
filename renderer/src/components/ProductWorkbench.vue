<script setup>
import { computed, nextTick, ref, watch } from 'vue'
import { generatorShortcutOptions } from '../utils/generatorViews'
import {
  canRetryPublishTask,
  fallbackPublishPlatformProfiles,
  normalizePublishPlatform,
  normalizeProjectPublishDraft,
  publishPlatformOptions,
  supportedPublishPlatforms
} from '../utils/publishContract'

const props = defineProps({
  productProjects: { type: Array, default: () => [] },
  projectRuns: { type: Array, default: () => [] },
  activeProjectId: { type: String, default: '' },
  focusProjectId: { type: String, default: '' },
  submitButtonState: { type: String, default: 'idle' },
  publishState: { type: Object, default: () => ({}) },
  selectionManifest: { type: Object, default: () => ({ generatedAt: '', boards: [] }) },
  selectionPlatforms: { type: Array, default: () => [] },
  selectionSites: { type: Array, default: () => [] },
  selectionState: { type: Object, default: () => ({ items: [], totalItems: 0, platform: 'temu', boardType: 'hot-sale', siteCode: '', keyword: '', isLoading: false, error: '' }) }
})

const emit = defineEmits([
  'create-project',
  'run-project',
  'replace-project-image',
  'update-project',
  'delete-project',
  'copy-text',
  'open-images',
  'open-video',
  'open-resource',
  'export-project',
  'open-generator',
  'sync-publish-draft',
  'publish-platform-change',
  'publish-channel-account-change',
  'publish-preview',
  'publish-create-task',
  'publish-sync-task',
  'publish-refresh-task',
  'publish-retry-task',
  'selection-query-change',
  'selection-import'
])

const generalPlatformOptions = [
  { label: 'TEMU', value: 'temu' },
  { label: 'OZON', value: 'ozon' },
  { label: 'Amazon', value: 'amazon' },
  { label: 'TK', value: 'tiktok' },
  { label: 'AliExpress', value: 'aliexpress' }
]

const platformOptions = [
  ...generalPlatformOptions
]

const languageOptions = [
  { label: '中文', value: 'zh-CN' },
  { label: 'English', value: 'en-US' },
  { label: 'Русский', value: 'ru-RU' }
]

const imageSizeOptions = [
  { label: '1:1', value: '1:1' },
  { label: '4:5', value: '4:5' },
  { label: '3:4', value: '3:4' },
  { label: '4:3', value: '4:3' },
  { label: '16:9', value: '16:9' },
  { label: '9:16', value: '9:16' }
]

const videoDurationOptions = [
  { label: '6 秒', value: '6s' },
  { label: '10 秒', value: '10s' }
]

const videoResolutionOptions = [
  { label: '768P', value: '768P' },
  { label: '1080P', value: '1080P' }
]

const videoMotionOptions = [
  { label: '自动', value: 'auto' },
  { label: '稳定', value: 'stable' },
  { label: '柔和', value: 'soft' }
]

const stepOptions = [
  { key: 'title', label: '标题' },
  { key: 'description', label: '描述' },
  { key: 'image', label: '套图' },
  { key: 'video', label: '视频' }
]

const selectionBoardOptions = [
  { label: '热销商品', value: 'hot-sale' },
  { label: '热销新品', value: 'hot-sale-new' },
  { label: '新店热销', value: 'new-mall-hot-sale' },
  { label: '大卖新品', value: 'big-sale-new' }
]

const expandedProjectIds = ref(new Set())
const expandedResultIds = ref(new Set())
const hasInitializedProjectExpansion = ref(false)
const hasInitializedResultExpansion = ref(false)
const publishFieldRefs = ref({})

const projectRunMap = computed(() => new Map((props.projectRuns || []).map((item) => [item.id, item])))

const projectCards = computed(() => {
  return [...(props.productProjects || [])]
    .sort((left, right) => {
      const rightTime = right.createdAt ? new Date(right.createdAt).getTime() : 0
      const leftTime = left.createdAt ? new Date(left.createdAt).getTime() : 0
      return rightTime - leftTime
    })
    .map((project) => {
      const latestRun = projectRunMap.value.get(project.latestRunId) || null
      return {
        project,
        latestRun,
        latestStatus: latestRun?.status || 'draft',
        isExpanded: expandedProjectIds.value.has(project.id)
      }
    })
})

const resultCards = computed(() => {
  return [...projectCards.value].sort((left, right) => {
    const rightTime = right.latestRun?.createdAt || right.project.createdAt ? new Date(right.latestRun?.createdAt || right.project.createdAt).getTime() : 0
    const leftTime = left.latestRun?.createdAt || left.project.createdAt ? new Date(left.latestRun?.createdAt || left.project.createdAt).getTime() : 0
    return rightTime - leftTime
  })
})

const selectionItems = computed(() => Array.isArray(props.selectionState?.items) ? props.selectionState.items : [])
const selectionBoardSummaryMap = computed(() => {
  const map = new Map()
  ;(Array.isArray(props.selectionManifest?.boards) ? props.selectionManifest.boards : []).forEach((board) => {
    map.set([board.platform, board.boardType, board.siteCode || ''].join('__'), board)
  })
  return map
})

watch(() => props.focusProjectId, (projectId) => {
  if (!projectId) return
  const next = new Set(expandedProjectIds.value)
  next.add(projectId)
  expandedProjectIds.value = next
}, { immediate: true })

watch(() => projectCards.value.map((item) => item.project.id).join('|'), () => {
  if (hasInitializedProjectExpansion.value) return
  const firstProjectId = projectCards.value[0]?.project?.id
  if (!firstProjectId) return
  const next = new Set(expandedProjectIds.value)
  next.add(firstProjectId)
  expandedProjectIds.value = next
  hasInitializedProjectExpansion.value = true
}, { immediate: true })

watch(() => resultCards.value.map((item) => item.project.id).join('|'), () => {
  if (hasInitializedResultExpansion.value) return
  const firstResultId = resultCards.value[0]?.project?.id
  if (!firstResultId) return
  const next = new Set(expandedResultIds.value)
  next.add(firstResultId)
  expandedResultIds.value = next
  hasInitializedResultExpansion.value = true
}, { immediate: true })

function updateProjectField(project, field, value) {
  const patch = field === 'platform'
    ? { platformTarget: [value] }
    : field === 'language'
      ? { baseInfo: { ...project.baseInfo, language: value } }
      : field === 'taskName'
        ? { name: value }
        : { baseInfo: { ...project.baseInfo, productName: value } }

  emit('update-project', { projectId: project.id, patch })
}

function updateProjectGenerationConfig(project, patch) {
  emit('update-project', {
    projectId: project.id,
    patch: {
      generationConfig: {
        ...(project.generationConfig || {}),
        ...(patch || {}),
        enabledSteps: {
          ...(project.generationConfig?.enabledSteps || {}),
          ...(patch?.enabledSteps || {})
        }
      }
    }
  })
}

function resolveProjectPublishPlatform(project = {}) {
  return normalizePublishPlatform(getPublishState(project.id).selectedPlatform || project.platformTarget?.[0] || '')
}

function resolveSelectedChannelAccount(project = {}) {
  const state = getPublishState(project.id)
  const selectedChannelAccountId = String(state.selectedChannelAccountId || '').trim()
  const channelAccounts = Array.isArray(state.channelAccounts) ? state.channelAccounts : []
  return channelAccounts.find((item) => String(item?.id || '').trim() === selectedChannelAccountId) || null
}

function resolveSelectedChannelAccountStatus(project = {}) {
  return String(resolveSelectedChannelAccount(project)?.status || '').trim().toLowerCase()
}

function resolveSelectedChannelAccountReadiness(project = {}) {
  const account = resolveSelectedChannelAccount(project)
  if (!account || typeof account !== 'object') {
    return {
      isReadyForSubmission: true,
      readinessReason: '',
      readinessMessage: ''
    }
  }

  const explicitReady = typeof account.isReadyForSubmission === 'boolean'
    ? account.isReadyForSubmission
    : resolveSelectedChannelAccountStatus(project) === 'active'

  return {
    isReadyForSubmission: explicitReady,
    readinessReason: String(account.readinessReason || '').trim(),
    readinessMessage: String(account.readinessMessage || '').trim()
  }
}

function resolveSelectedChannelAccountStatusLabel(project = {}) {
  const status = resolveSelectedChannelAccountStatus(project)
  if (status === 'active') return 'Active'
  if (status === 'expired') return 'Expired'
  if (status === 'revoked') return 'Revoked'
  if (status === 'disabled') return 'Disabled'
  return ''
}

function isSelectedChannelAccountUsable(project = {}) {
  return resolveSelectedChannelAccountReadiness(project).isReadyForSubmission
}

function hasServerPublishConfig(project = {}) {
  return String(props.publishState?.[project.id]?.publishConfig?.source || '').trim().toLowerCase() === 'server'
}

function resolveProjectPublishPlatformProfile(project = {}) {
  const platformProfiles = props.publishState?.[project.id]?.publishConfig?.platformProfiles || fallbackPublishPlatformProfiles
  return platformProfiles[resolveProjectPublishPlatform(project)] || {
    label: 'Platform',
    ruleVersion: '',
    supportedOperations: [],
    requiredAttributes: [],
    manualReviewAttributeKey: ''
  }
}

function isPublishOperationEnabled(project = {}, operationType = '') {
  if (!hasServerPublishConfig(project)) {
    return false
  }

  const supportedOperations = Array.isArray(resolveProjectPublishPlatformProfile(project).supportedOperations)
    ? resolveProjectPublishPlatformProfile(project).supportedOperations.map((item) => String(item || '').trim()).filter(Boolean)
    : []

  return supportedOperations.includes(String(operationType || '').trim())
}

function resolveProjectPublishEditorAttributes(project = {}) {
  const previewAttributes = resolvePublishPreviewRuleAttributes(project.id)
  if (previewAttributes.length) {
    return previewAttributes
  }

  return resolveProjectPublishPlatformProfile(project).requiredAttributes
}

function resolvePublishPlatformOptions(project = {}) {
  const rows = props.publishState?.[project.id]?.publishConfig?.platformOptions
  return Array.isArray(rows) && rows.length ? rows : publishPlatformOptions
}

function resolveProjectPlatformDraft(project = {}) {
  const platform = resolveProjectPublishPlatform(project)
  const publishDraft = normalizeProjectPublishDraft(project)
  const platformDraft = publishDraft.platformDrafts[platform]
  return platformDraft && typeof platformDraft === 'object' ? platformDraft : {}
}

function resolveProjectPlatformDraftCategoryId(project = {}) {
  return String(resolveProjectPlatformDraft(project).categoryId || '').trim()
}

function resolveProjectPlatformDraftAttribute(project = {}, key = '') {
  return String(resolveProjectPlatformDraft(project).attributes?.[key] || '').trim()
}

function resolveProjectPublishVariant(project = {}, index = 0) {
  const publishDraft = normalizeProjectPublishDraft(project)
  return publishDraft.variants[index] && typeof publishDraft.variants[index] === 'object'
    ? publishDraft.variants[index]
    : {}
}

function updateProjectPublishDraft(project, patch = {}) {
  const current = normalizeProjectPublishDraft(project)
  const patchPlatformDrafts = patch.platformDrafts && typeof patch.platformDrafts === 'object'
    ? patch.platformDrafts
    : {}
  const nextPlatformDrafts = {
    ...current.platformDrafts
  }

  Object.entries(patchPlatformDrafts).forEach(([platformKey, value]) => {
    const currentPlatformDraft = current.platformDrafts[platformKey] && typeof current.platformDrafts[platformKey] === 'object'
      ? current.platformDrafts[platformKey]
      : {}
    const patchPlatformDraft = value && typeof value === 'object' ? value : {}

    nextPlatformDrafts[platformKey] = {
      ...currentPlatformDraft,
      ...patchPlatformDraft,
      attributes: {
        ...(currentPlatformDraft.attributes && typeof currentPlatformDraft.attributes === 'object' ? currentPlatformDraft.attributes : {}),
        ...(patchPlatformDraft.attributes && typeof patchPlatformDraft.attributes === 'object' ? patchPlatformDraft.attributes : {})
      }
    }
  })

  emit('update-project', {
    projectId: project.id,
    patch: {
      publishDraft: {
        ...current,
        ...patch,
        attributes: {
          ...current.attributes,
          ...(patch.attributes && typeof patch.attributes === 'object' ? patch.attributes : {})
        },
        variants: Array.isArray(patch.variants) ? patch.variants : current.variants,
        platformDrafts: nextPlatformDrafts
      }
    }
  })
}

function updateProjectPlatformDraftField(project, field, value) {
  const platform = resolveProjectPublishPlatform(project)
  updateProjectPublishDraft(project, {
    platformDrafts: {
      [platform]: {
        [field]: value
      }
    }
  })
}

function updateProjectPlatformDraftAttribute(project, key, value) {
  const platform = resolveProjectPublishPlatform(project)
  updateProjectPublishDraft(project, {
    platformDrafts: {
      [platform]: {
        attributes: {
          [key]: value
        }
      }
    }
  })
}

function updateProjectPublishVariantField(project, index, field, value) {
  const current = normalizeProjectPublishDraft(project)
  const nextVariants = current.variants.slice()
  while (nextVariants.length <= index) {
    nextVariants.push({
      sellerSkuCode: '',
      variant: {},
      stockQuantity: 0
    })
  }

  nextVariants[index] = {
    ...(nextVariants[index] || {}),
    [field]: value
  }

  updateProjectPublishDraft(project, {
    variants: nextVariants
  })
}

function toggleProjectStep(project, stepKey, checked) {
  updateProjectGenerationConfig(project, { enabledSteps: { [stepKey]: checked } })
}

function resolveStatusLabel(status = '') {
  if (status === 'running') return '进行中'
  if (status === 'success') return '已完成'
  if (status === 'failed') return '失败'
  return '草稿'
}

function resolveStatusClass(status = '') {
  if (status === 'running') return 'workbench-status--running'
  if (status === 'success') return 'workbench-status--success'
  if (status === 'failed') return 'workbench-status--failed'
  return 'workbench-status--draft'
}

function resolvePublishStatusLabel(status = '') {
  const normalized = String(status || '').trim()
  if (normalized === 'queued') return '已排队'
  if (normalized === 'blocked') return '已阻塞'
  if (normalized === 'running') return '执行中'
  if (normalized === 'awaiting-platform-review') return '审核中'
  if (normalized === 'succeeded') return '已成功'
  if (normalized === 'failed-retryable') return '失败可重试'
  if (normalized === 'failed-final') return '失败终止'
  if (normalized === 'cancelled') return '已取消'
  return '未创建'
}

function getRunImages(project, latestRun) {
  if (Array.isArray(latestRun?.outputs?.images) && latestRun.outputs.images.length) {
    return latestRun.outputs.images
  }
  return Array.isArray(project?.assets?.generatedImages) ? project.assets.generatedImages : []
}

function getRunVideo(project, latestRun) {
  return latestRun?.outputs?.video || project?.assets?.generatedVideo || null
}

function resolveTextPreview(value, fallback) {
  const text = String(value || '').trim()
  return text || fallback
}

function resolvePrimaryPreview(item) {
  return getRunImages(item.project, item.latestRun)?.[0]?.preview ||
    getRunImages(item.project, item.latestRun)?.[0]?.savedPath ||
    item.project?.assets?.sourceImages?.[0]?.preview ||
    ''
}

function toggleProjectExpanded(projectId) {
  const next = new Set(expandedProjectIds.value)
  if (next.has(projectId)) next.delete(projectId)
  else next.add(projectId)
  expandedProjectIds.value = next
}

function toggleResultExpanded(projectId) {
  const next = new Set(expandedResultIds.value)
  if (next.has(projectId)) next.delete(projectId)
  else next.add(projectId)
  expandedResultIds.value = next
}

function openResource(target) {
  if (!target) return
  emit('open-resource', target)
}

function emitSelectionQueryPatch(patch) {
  emit('selection-query-change', patch)
}

function resolveSelectionBoardSummary(item = {}) {
  return selectionBoardSummaryMap.value.get([
    item.platform,
    item.boardType,
    item.siteCode || ''
  ].join('__')) || null
}

function resolvePublishPreviewIssues(projectId = '') {
  const preview = getPublishState(projectId).preview
  return Array.isArray(preview?.validationIssues) ? preview.validationIssues : []
}

function resolvePublishPreviewMappedTitle(projectId = '') {
  return String(getPublishState(projectId).preview?.mappedDraft?.title || '').trim()
}

function resolvePublishPreviewMappedCategory(projectId = '') {
  return String(getPublishState(projectId).preview?.mappedDraft?.categoryId || '').trim()
}

function resolvePublishPreviewMappedCategoryPath(projectId = '') {
  const value = getPublishState(projectId).preview?.mappedDraft?.categoryPath
  return Array.isArray(value)
    ? value.map((item) => String(item || '').trim()).filter(Boolean)
    : []
}

function resolvePublishPreviewRuleVersion(projectId = '') {
  return String(getPublishState(projectId).preview?.platformRule?.ruleVersion || '').trim()
}

function resolvePublishPreviewRuleAttributes(projectId = '') {
  const attributes = getPublishState(projectId).preview?.platformRule?.requiredAttributes
  return Array.isArray(attributes)
    ? attributes
      .map((item) => ({
        key: String(item?.key || '').trim(),
        label: String(item?.label || item?.key || '').trim()
      }))
      .filter((item) => item.key)
    : []
}

function resolvePublishPreviewRuleCategoryPath(projectId = '') {
  const value = getPublishState(projectId).preview?.platformRule?.resolvedCategoryPath
  return Array.isArray(value)
    ? value.map((item) => String(item || '').trim()).filter(Boolean)
    : []
}

function resolvePublishPreviewIssueKey(issue = {}, index = 0) {
  return [
    issue.field || 'field',
    issue.code || 'code',
    index
  ].join('__')
}

function buildPublishFieldRefKey(projectId = '', fieldKey = '') {
  return [String(projectId || '').trim(), String(fieldKey || '').trim()].filter(Boolean).join('::')
}

function setPublishFieldRef(projectId = '', fieldKey = '', element = null) {
  const refKey = buildPublishFieldRefKey(projectId, fieldKey)
  if (!refKey) return

  if (element) {
    publishFieldRefs.value = {
      ...publishFieldRefs.value,
      [refKey]: element
    }
    return
  }

  if (!Object.prototype.hasOwnProperty.call(publishFieldRefs.value, refKey)) {
    return
  }

  const nextRefs = { ...publishFieldRefs.value }
  delete nextRefs[refKey]
  publishFieldRefs.value = nextRefs
}

function registerPublishFieldRef(projectId = '', fieldKey = '') {
  return (element) => {
    setPublishFieldRef(projectId, fieldKey, element)
  }
}

function resolvePublishIssueTargetFieldKey(issue = {}) {
  const field = String(issue.field || '').trim()
  if (!field) return ''
  if (field === 'platformDraft.categoryId') return 'categoryId'
  if (field.startsWith('platformDraft.attributes.')) {
    return `attribute:${field.slice('platformDraft.attributes.'.length).trim()}`
  }
  if (field.includes('.sellerSkuCode')) return 'variant:sellerSkuCode'
  if (field.includes('.priceAmount')) return 'variant:priceAmount'
  if (field.includes('.stockQuantity')) return 'variant:stockQuantity'
  if (field.includes('.barcode')) return 'variant:barcode'
  return ''
}

function canLocatePublishIssue(project = {}, issue = {}) {
  const projectId = String(project?.id || '').trim()
  const fieldKey = resolvePublishIssueTargetFieldKey(issue)
  if (!projectId || !fieldKey) return false
  return Boolean(publishFieldRefs.value[buildPublishFieldRefKey(projectId, fieldKey)])
}

async function focusPublishIssueField(project = {}, issue = {}) {
  const projectId = String(project?.id || '').trim()
  const fieldKey = resolvePublishIssueTargetFieldKey(issue)
  if (!projectId || !fieldKey) return

  await nextTick()
  const element = publishFieldRefs.value[buildPublishFieldRefKey(projectId, fieldKey)]
  if (!element || typeof element.focus !== 'function') {
    return
  }

  if (typeof element.scrollIntoView === 'function') {
    element.scrollIntoView({ behavior: 'smooth', block: 'center' })
  }
  element.focus()
}

function resolvePublishIssueFieldLabel(issue = {}) {
  const field = String(issue.field || '').trim()
  if (!field) return 'Unknown Field'
  if (field === 'title') return 'Title'
  if (field === 'descriptionHtml') return 'Description'
  if (field === 'brandText') return 'Brand'
  if (field === 'bulletPoints') return 'Bullet Points'
  if (field === 'media') return 'Media'
  if (field === 'media[0]') return 'Primary Media'
  if (field === 'variants') return 'SKU Variants'
  if (field === 'platformDraft.categoryId') return 'Category ID'
  if (field.startsWith('platformDraft.attributes.')) {
    const attributeKey = field.slice('platformDraft.attributes.'.length).trim()
    return `Platform Attribute: ${attributeKey || 'unknown'}`
  }
  if (field.includes('.priceAmount')) return 'Variant Price'
  if (field.includes('.stockQuantity')) return 'Variant Stock'
  if (field.includes('.barcode')) return 'Variant Barcode'
  return field
}

function resolvePublishIssueSuggestedFix(issue = {}) {
  const field = String(issue.field || '').trim()
  if (!field) return ''
  if (field === 'title') return 'Update the project title or mapped publish title before retrying.'
  if (field === 'descriptionHtml') return 'Generate or edit the description so the publish draft has body content.'
  if (field === 'brandText') return 'Fill the brand field in the project base info.'
  if (field === 'bulletPoints') return 'Add at least one bullet point in the product copy section.'
  if (field === 'media') return 'Add at least one image or video asset to the project.'
  if (field === 'media[0]') return 'Place an image asset first so the primary media is an image.'
  if (field === 'variants') return 'Add at least one SKU variant before publishing.'
  if (field === 'platformDraft.categoryId') return 'Fill the Category ID field in the publish draft section.'
  if (field.startsWith('platformDraft.attributes.')) {
    const attributeKey = field.slice('platformDraft.attributes.'.length).trim()
    return `Fill the ${attributeKey || 'required'} platform attribute in the publish draft section.`
  }
  if (field.includes('.priceAmount')) return 'Set a valid price for the first SKU variant.'
  if (field.includes('.stockQuantity')) return 'Set stock greater than zero for the first SKU variant.'
  if (field.includes('.barcode')) return 'Fill or correct the variant barcode if the platform requires it.'
  return ''
}

function resolvePublishPreviewIssueLabel(issue = {}) {
  const fieldLabel = resolvePublishIssueFieldLabel(issue)
  const field = String(issue.field || '').trim()
  const code = String(issue.code || '').trim()
  const message = String(issue.message || '').trim()
  const prefix = [fieldLabel, code].filter(Boolean).join(' / ')
  return prefix ? `${prefix}: ${message || 'Unknown issue'}` : (message || 'Unknown issue')
}

function resolveLatestTaskAttemptIssues(projectId = '') {
  const blockingIssues = getPublishState(projectId).latestTask?.blockingIssues
  if (Array.isArray(blockingIssues) && blockingIssues.length) {
    return blockingIssues
  }

  const attempts = getPublishState(projectId).latestTask?.attempts
  if (!Array.isArray(attempts) || !attempts.length) {
    return []
  }

  const lastAttempt = attempts[attempts.length - 1]
  return Array.isArray(lastAttempt?.normalizedErrors) ? lastAttempt.normalizedErrors : []
}

function resolveLatestTaskRuleVersion(projectId = '') {
  const attempts = getPublishState(projectId).latestTask?.attempts
  if (!Array.isArray(attempts) || !attempts.length) {
    return ''
  }

  const lastAttempt = attempts[attempts.length - 1]
  return String(
    lastAttempt?.requestSummary?.ruleVersion ||
    lastAttempt?.requestPayload?.platformRule?.ruleVersion ||
    ''
  ).trim()
}

function resolveLatestTaskExecutionMode(projectId = '') {
  const attempts = getPublishState(projectId).latestTask?.attempts
  if (!Array.isArray(attempts) || !attempts.length) {
    return ''
  }

  const lastAttempt = attempts[attempts.length - 1]
  return String(
    lastAttempt?.requestSummary?.executionMode ||
    lastAttempt?.responseSummary?.executionMode ||
    lastAttempt?.requestPayload?.executionMode ||
    lastAttempt?.responsePayload?.executionMode ||
    ''
  ).trim()
}

function resolveLatestTaskRemoteListingId(projectId = '') {
  return String(getPublishState(projectId).latestTask?.remoteListingId || '').trim()
}

function resolveLatestTaskRemoteReviewStatus(projectId = '') {
  const latestTask = getPublishState(projectId).latestTask
  const attempts = latestTask?.attempts
  const lastAttempt = Array.isArray(attempts) && attempts.length
    ? attempts[attempts.length - 1]
    : null

  return String(
    latestTask?.remoteReviewStatus ||
    lastAttempt?.responseSummary?.remoteReviewStatus ||
    lastAttempt?.responsePayload?.remoteReviewStatus ||
    ''
  ).trim()
}

function resolveLatestTaskOutcome(projectId = '') {
  const attempts = getPublishState(projectId).latestTask?.attempts
  if (!Array.isArray(attempts) || !attempts.length) {
    return ''
  }

  return String(attempts[attempts.length - 1]?.outcome || '').trim()
}

function resolveLatestTaskPollingAdvice(projectId = '') {
  const advice = getPublishState(projectId).latestTask?.pollingAdvice
  return advice && typeof advice === 'object' ? advice : null
}

function resolveLatestTaskPollingIntervalLabel(projectId = '') {
  const advice = resolveLatestTaskPollingAdvice(projectId)
  const recommendedIntervalMs = Number(advice?.recommendedIntervalMs)
  if (!Number.isFinite(recommendedIntervalMs) || recommendedIntervalMs <= 0) {
    return ''
  }

  if (recommendedIntervalMs >= 60000) {
    const minutes = Math.round(recommendedIntervalMs / 60000)
    return `${minutes} min`
  }

  const seconds = Math.round(recommendedIntervalMs / 1000)
  return `${seconds} s`
}

function resolveLatestTaskPollingAdviceText(projectId = '') {
  const advice = resolveLatestTaskPollingAdvice(projectId)
  const reason = String(advice?.reason || '').trim().toUpperCase()
  const intervalLabel = resolveLatestTaskPollingIntervalLabel(projectId)

  if (reason === 'PLATFORM_REVIEW') {
    return intervalLabel
      ? `平台审核中，建议 ${intervalLabel} 后自动同步，必要时可手动刷新。`
      : '平台审核中，建议稍后再同步。'
  }

  if (reason === 'QUEUED') {
    return intervalLabel
      ? `任务已入队，客户端将按约 ${intervalLabel} 节奏自动刷新。`
      : '任务已入队，客户端将自动刷新状态。'
  }

  if (reason === 'RUNNING') {
    return intervalLabel
      ? `任务执行中，客户端将按约 ${intervalLabel} 节奏自动刷新。`
      : '任务执行中，客户端将自动刷新状态。'
  }

  if (reason === 'TERMINAL') {
    return '任务已结束自动轮询，可按需手动刷新查看最终状态。'
  }

  return ''
}

function resolveProjectManualReviewFlag(project = {}) {
  const profile = resolveProjectPublishPlatformProfile(project)
  const key = String(profile.manualReviewAttributeKey || '').trim()
  if (!key) {
    return false
  }

  return resolveProjectPlatformDraft(project).attributes?.[key] === true
}

function getPublishState(projectId = '') {
  const state = props.publishState && typeof props.publishState === 'object'
    ? props.publishState[projectId]
    : null

  return state && typeof state === 'object'
    ? state
    : {
        selectedPlatform: '',
        selectedChannelAccountId: '',
        channelAccounts: [],
        isSyncing: false,
        isLoadingAccounts: false,
        isPreviewLoading: false,
        isTaskLoading: false,
        error: '',
        preview: null,
        latestTask: null,
        draftSummary: null
      }
}

function canRetryLatestPublishTask(projectId = '') {
  return canRetryPublishTask(getPublishState(projectId).latestTask?.status)
}

function resolveDraftReadiness(projectId = '') {
  const draftSummary = getPublishState(projectId).draftSummary
  const draftReadiness = getPublishState(projectId).draftSummary?.draftReadiness
  if (!draftReadiness || typeof draftReadiness !== 'object') {
    return null
  }

  return {
    isReady: draftReadiness.isReady === true,
    isStale: draftSummary?.isStale === true,
    staleMessage: String(draftSummary?.staleMessage || '').trim(),
    message: String(draftReadiness.message || '').trim(),
    missingFieldLabels: Array.isArray(draftReadiness.missingFieldLabels)
      ? draftReadiness.missingFieldLabels.map((item) => String(item || '').trim()).filter(Boolean)
      : []
  }
}

function resolveDraftReadinessLabel(projectId = '') {
  const readiness = resolveDraftReadiness(projectId)
  if (!readiness) {
    return ''
  }

  if (readiness.isStale) {
    return 'Draft Readiness: STALE'
  }

  return readiness.isReady ? 'Draft Readiness: READY' : 'Draft Readiness: INCOMPLETE'
}

function resolveDraftReadinessMissingLabel(projectId = '') {
  const readiness = resolveDraftReadiness(projectId)
  if (!readiness || !readiness.missingFieldLabels.length) {
    return ''
  }

  return `Missing Fields: ${readiness.missingFieldLabels.join(', ')}`
}

function resolveDraftReadinessStaleMessage(projectId = '') {
  const readiness = resolveDraftReadiness(projectId)
  if (!readiness?.isStale) {
    return ''
  }

  return readiness.staleMessage || 'Publish draft summary is outdated.'
}

function resolvePlatformDraftReadiness(project = {}) {
  const projectId = String(project?.id || '').trim()
  const platformKey = resolveProjectPublishPlatform(project)
  const platformReadiness = getPublishState(projectId).draftSummary?.platformReadiness
  const readiness = platformReadiness && typeof platformReadiness === 'object'
    ? platformReadiness[platformKey]
    : null

  if (!readiness || typeof readiness !== 'object') {
    return null
  }

  return {
    platformLabel: String(readiness.platformLabel || platformKey || 'Platform').trim(),
    isReadyForCreateListing: readiness.isReadyForCreateListing === true,
    message: String(readiness.message || '').trim(),
    missingFieldLabels: Array.isArray(readiness.missingFieldLabels)
      ? readiness.missingFieldLabels.map((item) => String(item || '').trim()).filter(Boolean)
      : []
  }
}

function resolvePlatformDraftReadinessLabel(project = {}) {
  const readiness = resolvePlatformDraftReadiness(project)
  if (!readiness) {
    return ''
  }

  return readiness.isReadyForCreateListing
    ? `${readiness.platformLabel} Create Listing: READY`
    : `${readiness.platformLabel} Create Listing: INCOMPLETE`
}

function resolvePlatformDraftReadinessMissingLabel(project = {}) {
  const readiness = resolvePlatformDraftReadiness(project)
  if (!readiness || !readiness.missingFieldLabels.length) {
    return ''
  }

  return `Platform Missing Fields: ${readiness.missingFieldLabels.join(', ')}`
}

function resolvePlatformDraftReadinessIssues(project = {}) {
  const readiness = resolvePlatformDraftReadiness(project)
  const missingFields = Array.isArray(readiness?.missingFieldLabels) ? readiness.missingFieldLabels : []
  const platformKey = resolveProjectPublishPlatform(project)
  const rawReadiness = getPublishState(String(project?.id || '').trim()).draftSummary?.platformReadiness
  const currentPlatformReadiness = rawReadiness && typeof rawReadiness === 'object'
    ? rawReadiness[platformKey]
    : null
  const fields = Array.isArray(currentPlatformReadiness?.missingFields) ? currentPlatformReadiness.missingFields : []

  return fields.map((field, index) => ({
    field: String(field || '').trim(),
    code: 'REQUIRED',
    message: `${missingFields[index] || resolvePublishIssueFieldLabel({ field })} is required before create listing.`
  })).filter((issue) => issue.field)
}
</script>

<template>
  <section class="product-workbench product-workbench--agent">
    <section class="workbench-column workbench-column--tasks">
      <header class="workbench-column__header">
        <div class="workbench-column__title">
          <span>项目任务仓库</span>
          <strong>工作台</strong>
        </div>

        <button class="workbench-plus-button" type="button" @click="emit('create-project')">+</button>
      </header>

      <div class="project-draft-grid project-draft-grid--warehouse">
        <article
          v-for="item in projectCards"
          :key="item.project.id"
          class="project-draft-card"
          :class="{ 'project-draft-card--active': item.project.id === activeProjectId }"
        >
          <button class="project-draft-card__top project-draft-card__top--toggle" type="button" @click="toggleProjectExpanded(item.project.id)">
            <input
              class="project-draft-card__title"
              :value="item.project.name || ''"
              type="text"
              placeholder="任务名称"
              @click.stop
              @input="updateProjectField(item.project, 'taskName', $event.target.value)"
            >
            <span class="project-draft-card__toggle-hint">{{ item.isExpanded ? '收起' : '展开' }}</span>
          </button>

          <div v-if="item.isExpanded" class="project-draft-card__body">
            <input
              class="project-draft-card__title"
              :value="item.project.baseInfo?.productName || ''"
              type="text"
              placeholder="商品名称"
              @input="updateProjectField(item.project, 'productName', $event.target.value)"
            >

            <div class="project-draft-card__meta">
              <span v-if="item.project.id === activeProjectId" class="project-draft-card__active-flag">当前项目</span>
              <select :value="item.project.platformTarget?.[0] || 'temu'" @change="updateProjectField(item.project, 'platform', $event.target.value)">
                <option v-for="option in platformOptions" :key="`${item.project.id}-platform-${option.value}`" :value="option.value">{{ option.label }}</option>
              </select>
              <select :value="item.project.baseInfo?.language || 'zh-CN'" @change="updateProjectField(item.project, 'language', $event.target.value)">
                <option v-for="option in languageOptions" :key="`${item.project.id}-language-${option.value}`" :value="option.value">{{ option.label }}</option>
              </select>
            </div>

            <button class="project-draft-card__media" type="button" @click="emit('replace-project-image', item.project)">
              <img
                v-if="item.project.assets?.sourceImages?.[0]?.preview"
                :src="item.project.assets.sourceImages[0].preview"
                :alt="item.project.baseInfo?.productName || item.project.name || '商品样图'"
              >
              <span v-else>+</span>
            </button>

            <div class="project-task-card__switches">
              <label v-for="step in stepOptions" :key="`${item.project.id}-step-${step.key}`" class="project-task-card__switch">
                <input :checked="item.project.generationConfig?.enabledSteps?.[step.key] !== false" type="checkbox" @change="toggleProjectStep(item.project, step.key, $event.target.checked)">
                <span>{{ step.label }}</span>
              </label>
            </div>

            <div class="project-task-card__config-grid">
              <label class="project-task-card__field">
                <span>标题字数</span>
                <input :value="item.project.generationConfig?.titleMaxChars || 60" type="number" min="1" @input="updateProjectGenerationConfig(item.project, { titleMaxChars: $event.target.value })">
              </label>
              <label class="project-task-card__field">
                <span>描述字数</span>
                <input :value="item.project.generationConfig?.descriptionMaxChars || 300" type="number" min="1" @input="updateProjectGenerationConfig(item.project, { descriptionMaxChars: $event.target.value })">
              </label>
              <label class="project-task-card__field">
                <span>图片尺寸</span>
                <select :value="item.project.generationConfig?.imageSize || '1:1'" @change="updateProjectGenerationConfig(item.project, { imageSize: $event.target.value })">
                  <option v-for="option in imageSizeOptions" :key="`${item.project.id}-image-size-${option.value}`" :value="option.value">{{ option.label }}</option>
                </select>
              </label>
              <label class="project-task-card__field">
                <span>视频时长</span>
                <select :value="item.project.generationConfig?.videoDuration || '6s'" @change="updateProjectGenerationConfig(item.project, { videoDuration: $event.target.value })">
                  <option v-for="option in videoDurationOptions" :key="`${item.project.id}-video-duration-${option.value}`" :value="option.value">{{ option.label }}</option>
                </select>
              </label>
              <label class="project-task-card__field">
                <span>视频清晰度</span>
                <select :value="item.project.generationConfig?.videoResolution || '768P'" @change="updateProjectGenerationConfig(item.project, { videoResolution: $event.target.value })">
                  <option v-for="option in videoResolutionOptions" :key="`${item.project.id}-video-resolution-${option.value}`" :value="option.value">{{ option.label }}</option>
                </select>
              </label>
              <label class="project-task-card__field">
                <span>视频动效</span>
                <select :value="item.project.generationConfig?.videoMotionStrength || 'auto'" @change="updateProjectGenerationConfig(item.project, { videoMotionStrength: $event.target.value })">
                  <option v-for="option in videoMotionOptions" :key="`${item.project.id}-video-motion-${option.value}`" :value="option.value">{{ option.label }}</option>
                </select>
              </label>
            </div>

            <div class="project-draft-card__flow-actions">
              <button
                v-for="generator in generatorShortcutOptions"
                :key="`${item.project.id}-${generator.key}`"
                class="secondary-action"
                type="button"
                @click="emit('open-generator', { project: item.project, menuKey: generator.key })"
              >
                {{ generator.label }}
              </button>
              <button
                class="secondary-action"
                type="button"
                :disabled="getPublishState(item.project.id).isSyncing"
                @click="emit('sync-publish-draft', item.project)"
              >
                同步发布草稿
              </button>
            </div>

            <div class="project-task-card__config-grid">
              <label class="project-task-card__field">
                <span>发布平台</span>
                <select
                  :value="resolveProjectPublishPlatform(item.project)"
                  @change="emit('publish-platform-change', { project: item.project, platform: $event.target.value })"
                >
                  <option v-for="option in resolvePublishPlatformOptions(item.project)" :key="`${item.project.id}-publish-platform-${option.value}`" :value="option.value">{{ option.label }}</option>
                </select>
              </label>
              <label class="project-task-card__field project-task-card__field--full">
                <span>发布账号</span>
                <select
                  :value="getPublishState(item.project.id).selectedChannelAccountId || ''"
                  :disabled="getPublishState(item.project.id).isLoadingAccounts || !getPublishState(item.project.id).channelAccounts.length"
                  @change="emit('publish-channel-account-change', { project: item.project, channelAccountId: $event.target.value })"
                >
                  <option value="">{{ getPublishState(item.project.id).isLoadingAccounts ? '加载账号中' : '请选择发布账号' }}</option>
                  <option
                    v-for="account in getPublishState(item.project.id).channelAccounts"
                    :key="`${item.project.id}-publish-account-${account.id}`"
                    :value="account.id"
                  >
                    {{ `${account.platformLabel} / ${account.sellerName} / ${account.sellerExternalIdMasked} / ${String(account.status || '').toUpperCase()}` }}
                  </option>
                </select>
              </label>
            </div>

            <div v-if="resolveSelectedChannelAccountStatusLabel(item.project)" class="project-draft-card__meta">
              <span>Account Status: {{ resolveSelectedChannelAccountStatusLabel(item.project) }}</span>
              <span v-if="resolveSelectedChannelAccount(item.project)?.lastValidatedAt">
                Last Validated: {{ resolveSelectedChannelAccount(item.project).lastValidatedAt }}
              </span>
              <span v-if="!resolveSelectedChannelAccountReadiness(item.project).isReadyForSubmission">
                Submission Readiness: {{ resolveSelectedChannelAccountReadiness(item.project).readinessReason || 'NOT_READY' }}
              </span>
              <span v-if="resolveSelectedChannelAccountReadiness(item.project).readinessMessage">
                {{ resolveSelectedChannelAccountReadiness(item.project).readinessMessage }}
              </span>
            </div>

            <div
              v-if="supportedPublishPlatforms.includes(resolveProjectPublishPlatform(item.project))"
              class="project-draft-card__publish-editor"
            >
              <div class="project-draft-card__publish-editor-header">
                <strong>{{ resolveProjectPublishPlatformProfile(item.project).label }} Publish Draft</strong>
              </div>

              <div v-if="!hasServerPublishConfig(item.project)" class="project-draft-card__meta">
                <span>Server publish config is required before previewing or creating publish tasks.</span>
              </div>

              <div class="project-task-card__config-grid">
                <label class="project-task-card__field project-task-card__field--full">
                  <span>Category ID</span>
                  <input
                    :ref="registerPublishFieldRef(item.project.id, 'categoryId')"
                    :value="resolveProjectPlatformDraftCategoryId(item.project)"
                    type="text"
                    placeholder="platform category id"
                    @input="updateProjectPlatformDraftField(item.project, 'categoryId', $event.target.value)"
                  >
                </label>

                <label
                  v-for="attribute in resolveProjectPublishEditorAttributes(item.project)"
                  :key="`${item.project.id}-publish-attribute-${attribute.key}`"
                  class="project-task-card__field"
                >
                  <span>{{ attribute.label }}</span>
                  <input
                    :ref="registerPublishFieldRef(item.project.id, `attribute:${attribute.key}`)"
                    :value="resolveProjectPlatformDraftAttribute(item.project, attribute.key)"
                    type="text"
                    :placeholder="attribute.key"
                    @input="updateProjectPlatformDraftAttribute(item.project, attribute.key, $event.target.value)"
                  >
                </label>

                <label class="project-task-card__field project-task-card__field--full project-task-card__field--checkbox">
                  <input
                    :checked="resolveProjectManualReviewFlag(item.project)"
                    type="checkbox"
                    @change="updateProjectPlatformDraftAttribute(item.project, resolveProjectPublishPlatformProfile(item.project).manualReviewAttributeKey, $event.target.checked)"
                  >
                  <span>Manual Review Required</span>
                </label>
              </div>

              <div class="project-task-card__config-grid">
                <label class="project-task-card__field">
                  <span>Seller SKU</span>
                  <input
                    :ref="registerPublishFieldRef(item.project.id, 'variant:sellerSkuCode')"
                    :value="resolveProjectPublishVariant(item.project, 0).sellerSkuCode || ''"
                    type="text"
                    placeholder="SKU-001"
                    @input="updateProjectPublishVariantField(item.project, 0, 'sellerSkuCode', $event.target.value)"
                  >
                </label>
                <label class="project-task-card__field">
                  <span>Price</span>
                  <input
                    :ref="registerPublishFieldRef(item.project.id, 'variant:priceAmount')"
                    :value="resolveProjectPublishVariant(item.project, 0).priceAmount ?? ''"
                    type="number"
                    min="0"
                    step="0.01"
                    @input="updateProjectPublishVariantField(item.project, 0, 'priceAmount', $event.target.value === '' ? null : Number($event.target.value))"
                  >
                </label>
                <label class="project-task-card__field">
                  <span>Stock</span>
                  <input
                    :ref="registerPublishFieldRef(item.project.id, 'variant:stockQuantity')"
                    :value="resolveProjectPublishVariant(item.project, 0).stockQuantity ?? 0"
                    type="number"
                    min="0"
                    step="1"
                    @input="updateProjectPublishVariantField(item.project, 0, 'stockQuantity', Number($event.target.value) || 0)"
                  >
                </label>
                <label class="project-task-card__field">
                  <span>Barcode</span>
                  <input
                    :ref="registerPublishFieldRef(item.project.id, 'variant:barcode')"
                    :value="resolveProjectPublishVariant(item.project, 0).barcode || ''"
                    type="text"
                    placeholder="optional"
                    @input="updateProjectPublishVariantField(item.project, 0, 'barcode', $event.target.value)"
                  >
                </label>
              </div>
            </div>

            <div class="project-draft-card__flow-actions">
              <button
                class="secondary-action"
                type="button"
                :disabled="getPublishState(item.project.id).isPreviewLoading || !isSelectedChannelAccountUsable(item.project) || !hasServerPublishConfig(item.project)"
                @click="emit('publish-preview', item.project)"
              >
                发布预览
              </button>
              <button
                class="secondary-action"
                type="button"
                :disabled="getPublishState(item.project.id).isTaskLoading || !isSelectedChannelAccountUsable(item.project) || !isPublishOperationEnabled(item.project, 'create-listing')"
                @click="emit('publish-create-task', item.project)"
              >
                创建任务
              </button>
              <button
                class="secondary-action"
                type="button"
                :disabled="!resolveLatestTaskRemoteListingId(item.project.id) || getPublishState(item.project.id).isTaskLoading || !isPublishOperationEnabled(item.project, 'sync-status')"
                @click="emit('publish-sync-task', item.project)"
              >
                鍚屾瀹℃牳鐘舵€�
              </button>
              <button
                class="secondary-action"
                type="button"
                :disabled="!getPublishState(item.project.id).latestTask?.id || getPublishState(item.project.id).isTaskLoading"
                @click="emit('publish-refresh-task', item.project)"
              >
                刷新任务
              </button>
              <button
                class="secondary-action"
                type="button"
                :disabled="!getPublishState(item.project.id).latestTask?.id || getPublishState(item.project.id).isTaskLoading || !canRetryLatestPublishTask(item.project.id)"
                @click="emit('publish-retry-task', item.project)"
              >
                重试任务
              </button>
            </div>

            <div class="project-draft-card__meta">
              <span v-if="getPublishState(item.project.id).draftSummary?.id">草稿ID: {{ getPublishState(item.project.id).draftSummary.id }}</span>
              <span v-if="getPublishState(item.project.id).latestTask?.status">任务状态: {{ resolvePublishStatusLabel(getPublishState(item.project.id).latestTask.status) }}</span>
              <span v-if="getPublishState(item.project.id).latestTask?.platformLabel">{{ getPublishState(item.project.id).latestTask.platformLabel }}</span>
              <span v-if="resolveLatestTaskExecutionMode(item.project.id)">执行模式: {{ resolveLatestTaskExecutionMode(item.project.id) }}</span>
              <span v-if="resolveDraftReadinessLabel(item.project.id)">{{ resolveDraftReadinessLabel(item.project.id) }}</span>
              <span v-if="resolvePlatformDraftReadinessLabel(item.project)">{{ resolvePlatformDraftReadinessLabel(item.project) }}</span>
              <span v-if="resolveLatestTaskOutcome(item.project.id)">Attempt Outcome: {{ resolveLatestTaskOutcome(item.project.id) }}</span>
              <span v-if="resolveLatestTaskRemoteListingId(item.project.id)">Remote Listing ID: {{ resolveLatestTaskRemoteListingId(item.project.id) }}</span>
              <span v-if="resolveLatestTaskRemoteReviewStatus(item.project.id)">Review Status: {{ resolveLatestTaskRemoteReviewStatus(item.project.id) }}</span>
              <span v-if="resolveLatestTaskPollingIntervalLabel(item.project.id)">Polling Advice: {{ resolveLatestTaskPollingIntervalLabel(item.project.id) }}</span>
              <span v-if="getPublishState(item.project.id).latestTask?.lastErrorMessage">失败原因: {{ getPublishState(item.project.id).latestTask.lastErrorMessage }}</span>
            </div>

            <div
              v-if="resolveDraftReadiness(item.project.id)?.message || resolveDraftReadinessMissingLabel(item.project.id)"
              class="project-draft-card__meta"
            >
              <span v-if="resolveDraftReadiness(item.project.id)?.message">{{ resolveDraftReadiness(item.project.id).message }}</span>
              <span v-if="resolveDraftReadinessMissingLabel(item.project.id)">{{ resolveDraftReadinessMissingLabel(item.project.id) }}</span>
            </div>

            <div
              v-if="resolveDraftReadinessStaleMessage(item.project.id)"
              class="project-draft-card__meta"
            >
              <span>{{ resolveDraftReadinessStaleMessage(item.project.id) }}</span>
            </div>

            <div
              v-if="resolvePlatformDraftReadiness(item.project)?.message || resolvePlatformDraftReadinessMissingLabel(item.project)"
              class="project-draft-card__meta"
            >
              <span v-if="resolvePlatformDraftReadiness(item.project)?.message">{{ resolvePlatformDraftReadiness(item.project).message }}</span>
              <span v-if="resolvePlatformDraftReadinessMissingLabel(item.project)">{{ resolvePlatformDraftReadinessMissingLabel(item.project) }}</span>
            </div>

            <div
              v-if="resolvePlatformDraftReadinessIssues(item.project).length"
              class="project-draft-card__publish-preview"
            >
              <div class="project-draft-card__publish-preview-summary">
                <span>Platform Readiness Issues</span>
              </div>

              <ul class="project-draft-card__publish-issues">
                <li
                  v-for="(issue, index) in resolvePlatformDraftReadinessIssues(item.project)"
                  :key="resolvePublishPreviewIssueKey(issue, index)"
                >
                  {{ resolvePublishPreviewIssueLabel(issue) }}
                  <span v-if="resolvePublishIssueSuggestedFix(issue)">
                    {{ ` Suggestion: ${resolvePublishIssueSuggestedFix(issue)}` }}
                  </span>
                  <button
                    v-if="canLocatePublishIssue(item.project, issue)"
                    class="project-draft-card__issue-link"
                    type="button"
                    @click="focusPublishIssueField(item.project, issue)"
                  >
                    Locate Field
                  </button>
                </li>
              </ul>
            </div>

            <div
              v-if="resolveLatestTaskPollingAdviceText(item.project.id)"
              class="project-draft-card__meta"
            >
              <span>{{ resolveLatestTaskPollingAdviceText(item.project.id) }}</span>
            </div>

            <div v-if="getPublishState(item.project.id).preview || getPublishState(item.project.id).error" class="project-draft-card__meta">
              <span v-if="getPublishState(item.project.id).preview">
                {{ getPublishState(item.project.id).preview.isValid ? '预览校验通过' : `预览未通过：${(getPublishState(item.project.id).preview.validationIssues || []).length} 项` }}
              </span>
              <span v-if="getPublishState(item.project.id).error">{{ getPublishState(item.project.id).error }}</span>
            </div>

            <div v-if="getPublishState(item.project.id).preview" class="project-draft-card__publish-preview">
              <div class="project-draft-card__publish-preview-summary">
                <span v-if="resolvePublishPreviewRuleVersion(item.project.id)">
                  规则版本：{{ resolvePublishPreviewRuleVersion(item.project.id) }}
                </span>
                <span v-if="resolvePublishPreviewRuleAttributes(item.project.id).length">
                  必填属性：{{ resolvePublishPreviewRuleAttributes(item.project.id).map((item) => item.label).join(' / ') }}
                </span>
                <span v-if="resolvePublishPreviewRuleCategoryPath(item.project.id).length">
                  规则类目路径：{{ resolvePublishPreviewRuleCategoryPath(item.project.id).join(' / ') }}
                </span>
                <span v-if="resolvePublishPreviewMappedTitle(item.project.id)">
                  映射标题：{{ resolvePublishPreviewMappedTitle(item.project.id) }}
                </span>
                <span v-if="resolvePublishPreviewMappedCategory(item.project.id)">
                  映射类目：{{ resolvePublishPreviewMappedCategory(item.project.id) }}
                </span>
                <span v-if="resolvePublishPreviewMappedCategoryPath(item.project.id).length">
                  类目路径：{{ resolvePublishPreviewMappedCategoryPath(item.project.id).join(' / ') }}
                </span>
              </div>

              <ul
                v-if="resolvePublishPreviewIssues(item.project.id).length"
                class="project-draft-card__publish-issues"
              >
                <li
                  v-for="(issue, index) in resolvePublishPreviewIssues(item.project.id)"
                  :key="resolvePublishPreviewIssueKey(issue, index)"
                >
                  {{ resolvePublishPreviewIssueLabel(issue) }}
                  <span v-if="resolvePublishIssueSuggestedFix(issue)">
                    {{ ` Suggestion: ${resolvePublishIssueSuggestedFix(issue)}` }}
                  </span>
                  <button
                    v-if="canLocatePublishIssue(item.project, issue)"
                    class="project-draft-card__issue-link"
                    type="button"
                    @click="focusPublishIssueField(item.project, issue)"
                  >
                    Locate Field
                  </button>
                </li>
              </ul>
            </div>

            <div
              v-if="resolveLatestTaskAttemptIssues(item.project.id).length"
              class="project-draft-card__publish-preview"
            >
              <div class="project-draft-card__publish-preview-summary">
                <span>任务失败明细</span>
                <span v-if="resolveLatestTaskExecutionMode(item.project.id)">
                  执行模式：{{ resolveLatestTaskExecutionMode(item.project.id) }}
                </span>
                <span v-if="resolveLatestTaskRuleVersion(item.project.id)">
                  规则版本：{{ resolveLatestTaskRuleVersion(item.project.id) }}
                </span>
              </div>

              <ul class="project-draft-card__publish-issues">
                <li
                  v-for="(issue, index) in resolveLatestTaskAttemptIssues(item.project.id)"
                  :key="resolvePublishPreviewIssueKey(issue, index)"
                >
                  {{ resolvePublishPreviewIssueLabel(issue) }}
                  <span v-if="resolvePublishIssueSuggestedFix(issue)">
                    {{ ` Suggestion: ${resolvePublishIssueSuggestedFix(issue)}` }}
                  </span>
                  <button
                    v-if="canLocatePublishIssue(item.project, issue)"
                    class="project-draft-card__issue-link"
                    type="button"
                    @click="focusPublishIssueField(item.project, issue)"
                  >
                    Locate Field
                  </button>
                </li>
              </ul>
            </div>
          </div>

          <div class="project-draft-card__footer">
            <span class="workbench-status" :class="resolveStatusClass(item.latestStatus)">{{ resolveStatusLabel(item.latestStatus) }}</span>
            <button class="primary-action" type="button" @click="emit('run-project', item.project)">生成</button>
            <button class="project-draft-card__delete" type="button" @click="emit('delete-project', item.project.id)">删除</button>
          </div>
        </article>

        <div v-if="!projectCards.length" class="product-result-empty">
          <span>{{ submitButtonState === 'pending' ? '生成中' : '暂无项目' }}</span>
        </div>
      </div>
    </section>

    <section class="workbench-column workbench-column--results">
      <header class="workbench-column__header">
        <div class="workbench-column__title">
          <span>项目结果仓库</span>
          <strong>结果</strong>
        </div>
      </header>

      <div class="product-result-grid product-result-grid--warehouse">
        <article
          v-for="item in resultCards"
          :key="item.project.id"
          class="product-result-card product-result-card--run"
          :class="{
            'product-result-card--active': item.project.id === activeProjectId,
            'product-result-card--expanded': expandedResultIds.has(item.project.id)
          }"
        >
          <button class="product-result-card__header product-result-card__header--toggle" type="button" @click="toggleResultExpanded(item.project.id)">
            <div class="product-result-card__headline">
              <strong>{{ item.project.name || '演示结果' }}</strong>
            </div>

            <div class="product-result-card__status-group">
              <span class="workbench-status" :class="resolveStatusClass(item.latestStatus)">{{ resolveStatusLabel(item.latestStatus) }}</span>
              <span class="product-result-card__toggle-hint">{{ expandedResultIds.has(item.project.id) ? '收起' : '展开' }}</span>
            </div>
          </button>

          <div v-if="expandedResultIds.has(item.project.id)" class="product-result-card__detail">
            <div class="product-result-card__detail-row">
              <span class="product-result-card__detail-label">任务名称</span>
              <strong>{{ item.project.name || '未命名任务' }}</strong>
            </div>
            <div class="product-result-card__detail-row product-result-card__detail-row--copy">
              <span class="product-result-card__detail-label">标题</span>
              <button class="product-result-card__copy" type="button" @click="emit('copy-text', item.latestRun?.outputs?.title || '')">{{ resolveTextPreview(item.latestRun?.outputs?.title, '点击复制') }}</button>
            </div>
            <div class="product-result-card__detail-row product-result-card__detail-row--copy">
              <span class="product-result-card__detail-label">描述</span>
              <button class="product-result-card__copy" type="button" @click="emit('copy-text', item.latestRun?.outputs?.description || '')">{{ resolveTextPreview(item.latestRun?.outputs?.description, '点击复制') }}</button>
            </div>
            <div class="product-result-card__detail-row">
              <span class="product-result-card__detail-label">套图</span>
              <div class="product-result-card__inline-actions">
                <button class="secondary-action" type="button" @click="openResource(resolvePrimaryPreview(item))">预览</button>
                <button class="secondary-action" type="button" @click="emit('open-images', { project: item.project, run: item.latestRun })">打开位置</button>
              </div>
            </div>
            <div class="product-result-card__detail-row">
              <span class="product-result-card__detail-label">视频</span>
              <div class="product-result-card__inline-actions">
                <button class="secondary-action" type="button" @click="openResource(getRunVideo(item.project, item.latestRun)?.savedPath)">预览</button>
                <button class="secondary-action" type="button" @click="emit('open-video', { project: item.project, run: item.latestRun })">打开位置</button>
              </div>
            </div>
            <div class="product-result-card__detail-row">
              <span class="product-result-card__detail-label">项目</span>
              <button class="primary-action" type="button" @click="emit('export-project', item.project.id)">打包下载</button>
            </div>
          </div>
        </article>

        <div v-if="!resultCards.length" class="product-result-empty">
          <span>暂无结果</span>
        </div>
      </div>
    </section>

    <section class="workbench-column workbench-column--agent">
      <header class="workbench-column__header">
        <div class="workbench-column__title">
          <span>选品助手</span>
          <strong>素材入口</strong>
        </div>
      </header>

      <div class="selection-panel">
        <div class="selection-panel__filters">
          <label class="project-task-card__field">
            <span>平台</span>
            <select :value="selectionState.platform || 'temu'" @change="emitSelectionQueryPatch({ platform: $event.target.value })">
              <option v-for="option in selectionPlatforms" :key="`selection-platform-${option.key}`" :value="option.key">{{ option.label }}</option>
            </select>
          </label>
          <label class="project-task-card__field">
            <span>榜单</span>
            <select :value="selectionState.boardType || 'hot-sale'" @change="emitSelectionQueryPatch({ boardType: $event.target.value })">
              <option v-for="option in selectionBoardOptions" :key="`selection-board-${option.value}`" :value="option.value">{{ option.label }}</option>
            </select>
          </label>
          <label v-if="(selectionState.platform || '') === 'shopee'" class="project-task-card__field">
            <span>站点</span>
            <select :value="selectionState.siteCode || ''" @change="emitSelectionQueryPatch({ siteCode: $event.target.value })">
              <option value="">请选择</option>
              <option v-for="option in selectionSites" :key="`selection-site-${option.code}`" :value="option.code">{{ option.label }}</option>
            </select>
          </label>
          <label class="project-task-card__field project-task-card__field--full">
            <span>关键词</span>
            <input :value="selectionState.keyword || ''" type="text" placeholder="按标题筛选" @change="emitSelectionQueryPatch({ keyword: $event.target.value })">
          </label>
        </div>

        <div class="selection-panel__meta">
          <span v-if="selectionState.error" class="selection-panel__error">{{ selectionState.error }}</span>
          <span v-else>{{ selectionState.isLoading ? '正在加载选品数据...' : `共 ${selectionState.totalItems || 0} 条，可导入工作台` }}</span>
        </div>

        <div class="selection-card-list">
          <article v-for="item in selectionItems" :key="item.id" class="selection-card">
            <img class="selection-card__preview" :src="item.primaryImageUrl" :alt="item.title || '选品预览'">
            <div class="selection-card__copy">
              <strong>{{ item.title || '未命名条目' }}</strong>
              <span>{{ item.subtitle || item.categoryText || '暂无副标题' }}</span>
            </div>
            <div class="selection-card__chips">
              <span>{{ item.priceText || '价格待补' }}</span>
              <span>{{ item.salesVolumeText || '销量待补' }}</span>
              <span>{{ resolveSelectionBoardSummary(item)?.capturedAt ? `快照 ${resolveSelectionBoardSummary(item).capturedAt.slice(0, 10)}` : '快照待同步' }}</span>
            </div>
            <div class="selection-card__tags">
              <span v-for="tag in (item.extractedKeywords || []).slice(0, 4)" :key="`${item.id}-${tag}`">{{ tag }}</span>
            </div>
            <div class="selection-card__actions">
              <button class="secondary-action" type="button" @click="emit('selection-import', { item, mode: 'create' })">新建项目</button>
              <button class="primary-action" type="button" :disabled="!activeProjectId" @click="emit('selection-import', { item, mode: 'update' })">覆盖当前项目</button>
            </div>
          </article>

          <div v-if="!selectionItems.length && !selectionState.isLoading" class="product-result-empty">
            <span>当前筛选下暂无选品条目</span>
          </div>
        </div>
      </div>
    </section>
  </section>
</template>
