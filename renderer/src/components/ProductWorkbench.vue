<script setup>
import { computed, ref, watch } from 'vue'
import { generatorShortcutOptions } from '../utils/generatorViews'

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
  'publish-refresh-task',
  'publish-retry-task',
  'selection-query-change',
  'selection-import'
])

const platformOptions = [
  { label: 'TEMU', value: 'temu' },
  { label: 'OZON', value: 'ozon' },
  { label: 'Amazon', value: 'amazon' },
  { label: 'TK', value: 'tiktok' },
  { label: 'AliExpress', value: 'aliexpress' }
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

function resolvePublishPreviewIssueKey(issue = {}, index = 0) {
  return [
    issue.field || 'field',
    issue.code || 'code',
    index
  ].join('__')
}

function resolvePublishPreviewIssueLabel(issue = {}) {
  const field = String(issue.field || '').trim()
  const code = String(issue.code || '').trim()
  const message = String(issue.message || '').trim()
  const prefix = [field, code].filter(Boolean).join(' / ')
  return prefix ? `${prefix}: ${message || 'Unknown issue'}` : (message || 'Unknown issue')
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
                  :value="getPublishState(item.project.id).selectedPlatform || item.project.platformTarget?.[0] || 'temu'"
                  @change="emit('publish-platform-change', { project: item.project, platform: $event.target.value })"
                >
                  <option v-for="option in platformOptions" :key="`${item.project.id}-publish-platform-${option.value}`" :value="option.value">{{ option.label }}</option>
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
                    {{ `${account.platformLabel} / ${account.sellerName} / ${account.sellerExternalIdMasked}` }}
                  </option>
                </select>
              </label>
            </div>

            <div class="project-draft-card__flow-actions">
              <button
                class="secondary-action"
                type="button"
                :disabled="getPublishState(item.project.id).isPreviewLoading"
                @click="emit('publish-preview', item.project)"
              >
                发布预览
              </button>
              <button
                class="secondary-action"
                type="button"
                :disabled="getPublishState(item.project.id).isTaskLoading"
                @click="emit('publish-create-task', item.project)"
              >
                创建任务
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
                :disabled="!getPublishState(item.project.id).latestTask?.id || getPublishState(item.project.id).isTaskLoading"
                @click="emit('publish-retry-task', item.project)"
              >
                重试任务
              </button>
            </div>

            <div class="project-draft-card__meta">
              <span v-if="getPublishState(item.project.id).draftSummary?.id">草稿ID: {{ getPublishState(item.project.id).draftSummary.id }}</span>
              <span v-if="getPublishState(item.project.id).latestTask?.status">任务状态: {{ resolvePublishStatusLabel(getPublishState(item.project.id).latestTask.status) }}</span>
              <span v-if="getPublishState(item.project.id).latestTask?.platformLabel">{{ getPublishState(item.project.id).latestTask.platformLabel }}</span>
            </div>

            <div v-if="getPublishState(item.project.id).preview || getPublishState(item.project.id).error" class="project-draft-card__meta">
              <span v-if="getPublishState(item.project.id).preview">
                {{ getPublishState(item.project.id).preview.isValid ? '预览校验通过' : `预览未通过：${(getPublishState(item.project.id).preview.validationIssues || []).length} 项` }}
              </span>
              <span v-if="getPublishState(item.project.id).error">{{ getPublishState(item.project.id).error }}</span>
            </div>

            <div v-if="getPublishState(item.project.id).preview" class="project-draft-card__publish-preview">
              <div class="project-draft-card__publish-preview-summary">
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
