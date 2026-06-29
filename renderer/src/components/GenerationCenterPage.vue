<script setup>
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import {
  imageModelOptions,
  imageSizeOptions,
  imageTemplateTypeMap,
  languageOptions,
  videoDurationOptions,
  videoModelOptions,
  videoMotionOptions,
  videoResolutionOptions
} from '../utils/generatorFormOptions'

const props = defineProps({
  productProjects: { type: Array, default: () => [] },
  projectRuns: { type: Array, default: () => [] },
  activeProjectId: { type: String, default: '' },
  focusProjectId: { type: String, default: '' },
  draft: { type: Object, default: () => ({}) },
  submitButtonState: { type: String, default: 'idle' },
  promptTemplates: { type: Array, default: () => [] },
  publishState: { type: Object, default: () => ({}) },
  selectionManifest: { type: Object, default: () => ({ generatedAt: '', boards: [] }) },
  selectionPlatforms: { type: Array, default: () => [] },
  selectionSites: { type: Array, default: () => [] },
  selectionState: {
    type: Object,
    default: () => ({
      items: [],
      totalItems: 0,
      platform: 'temu',
      boardType: 'hot-sale',
      siteCode: '',
      keyword: '',
      isLoading: false,
      error: ''
    })
  }
})

const emit = defineEmits([
  'create-project',
  'run-project',
  'update-draft',
  'save-project-template',
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

const inspectedProjectId = ref('')
const storageSortMode = ref('updated-desc')
const storageRefreshToken = ref(0)
const storageContextMenu = ref({
  visible: false,
  x: 0,
  y: 0,
  item: null
})

const projectRunMap = computed(() => new Map((props.projectRuns || []).map((item) => [item.id, item])))

const sortedProjects = computed(() => {
  return [...(props.productProjects || [])].sort((left, right) => {
    const rightTime = new Date(right?.updatedAt || right?.createdAt || 0).getTime()
    const leftTime = new Date(left?.updatedAt || left?.createdAt || 0).getTime()
    return rightTime - leftTime
  })
})

const activeProjectEntry = computed(() => {
  const projectId = String(props.activeProjectId || props.focusProjectId || sortedProjects.value[0]?.id || '').trim()
  const project = sortedProjects.value.find((item) => item.id === projectId) || sortedProjects.value[0] || null
  if (!project) return null

  return {
    project,
    latestRun: projectRunMap.value.get(project.latestRunId) || null
  }
})

const inspectedProjectEntry = computed(() => {
  const candidateId = String(inspectedProjectId.value || '').trim()
  if (!candidateId) return null

  const project = sortedProjects.value.find((item) => item.id === candidateId) || null
  if (!project) return null

  return {
    project,
    latestRun: projectRunMap.value.get(project.latestRunId) || null
  }
})

const currentProjectImagePreview = computed(() => {
  return props.draft?.sourceImage?.preview || activeProjectEntry.value?.project?.assets?.sourceImages?.[0]?.preview || ''
})

const promptCategoryAliases = {
  title: '标题',
  description: '描述',
  image: '图片',
  video: '视频',
  '标题': '标题',
  '描述': '描述',
  '图片': '图片',
  '视频': '视频',
  '鏍囬': '标题',
  '鎻忚堪': '描述',
  '鍥剧墖': '图片',
  '瑙嗛': '视频',
  '閺嶅洭顣�': '标题',
  '閹诲繗鍫�': '描述',
  '閸ュ墽澧�': '图片',
  '鐟欏棝顣�': '视频'
}

function normalizePromptCategory(category = '') {
  const normalized = String(category || '').trim()
  return promptCategoryAliases[normalized] || normalized
}

const titlePromptTemplates = computed(() => {
  return (props.promptTemplates || []).filter((item) => normalizePromptCategory(item?.category) === '标题')
})

const descriptionPromptTemplates = computed(() => {
  return (props.promptTemplates || []).filter((item) => normalizePromptCategory(item?.category) === '描述')
})

const imagePromptTemplates = computed(() => {
  return (props.promptTemplates || []).filter((item) => normalizePromptCategory(item?.category) === '图片')
})

const videoPromptTemplates = computed(() => {
  return (props.promptTemplates || []).filter((item) => normalizePromptCategory(item?.category) === '视频')
})

const workspaceStepOptions = [
  { key: 'title', label: '标题' },
  { key: 'description', label: '描述' },
  { key: 'image', label: '套图' },
  { key: 'video', label: '视频' }
]

function resolveProjectName(project = {}) {
  return String(project?.name || project?.baseInfo?.productName || '未命名项目').trim() || '未命名项目'
}

function resolveProjectPlatform(project = {}) {
  const platform = Array.isArray(project?.platformTarget) ? project.platformTarget.join(' / ') : ''
  return platform || '未设置平台'
}

function resolveProjectLanguage(project = {}) {
  return String(project?.baseInfo?.language || 'zh-CN').trim() || 'zh-CN'
}

const normalizedDraft = computed(() => props.draft || {})

function resolveDraftValue(field, fallback = '') {
  const value = normalizedDraft.value?.[field]
  if (value === undefined || value === null || value === '') {
    return fallback
  }
  return value
}

function resolveDraftLanguage() {
  return String(resolveDraftValue('language', activeProjectEntry.value?.project?.baseInfo?.language || 'zh-CN')).trim() || 'zh-CN'
}

function resolveDraftProductName() {
  return String(resolveDraftValue('productName', activeProjectEntry.value?.project?.baseInfo?.productName || '')).trim()
}

function resolveDraftProjectName() {
  return String(resolveDraftValue('projectName', activeProjectEntry.value?.project?.name || resolveDraftProductName())).trim()
}

function resolveDraftKeywords() {
  const direct = String(resolveDraftValue('keywordsText', '')).trim()
  if (direct) return direct

  const keywords = Array.isArray(activeProjectEntry.value?.project?.baseInfo?.keywords)
    ? activeProjectEntry.value.project.baseInfo.keywords
    : []
  return keywords.join('、').trim()
}

function resolveDraftNotes() {
  return String(resolveDraftValue('notes', activeProjectEntry.value?.project?.generationConfig?.notes || '')).trim()
}

function resolveProjectTemplateSelection() {
  return {
    titleTemplateId: String(resolveDraftValue('titleTemplateId', '') || '').trim(),
    descriptionTemplateId: String(resolveDraftValue('descriptionTemplateId', '') || '').trim(),
    imageTemplateId: String(resolveDraftValue('imageTemplateId', '') || '').trim(),
    videoTemplateId: String(resolveDraftValue('videoTemplateId', '') || '').trim()
  }
}

function resolveDraftSelectValue(field, fallback = '') {
  return String(resolveDraftValue(field, fallback) || fallback).trim()
}

function resolveEnabledSteps() {
  const source = normalizedDraft.value?.enabledSteps && typeof normalizedDraft.value.enabledSteps === 'object'
    ? normalizedDraft.value.enabledSteps
    : {}

  return {
    title: source.title !== false,
    description: source.description !== false,
    image: source.image !== false,
    video: source.video !== false
  }
}

function resolveLatestRunStatus(latestRun = null) {
  const status = String(latestRun?.status || '').trim().toLowerCase()
  if (['running', 'processing', 'submitting'].includes(status)) return '生成中'
  if (['pending', 'queued'].includes(status)) return '排队中'
  if (status === 'success') return '已完成'
  if (status === 'failed') return '失败'
  return '未开始'
}

function resolveStepStatus(status = '') {
  if (['running', 'processing', 'submitting'].includes(status)) return '生成中'
  if (['pending', 'queued'].includes(status)) return '排队中'
  if (status === 'failed') return '失败'
  return '未开始'
}

function resolveQueueStage(project = {}, latestRun = null) {
  if (latestRun?.menuKey === 'title-generate') return '标题'
  if (latestRun?.menuKey === 'description-generate') return '描述'
  if (latestRun?.menuKey === 'series-generate') return '套图'
  if (latestRun?.menuKey === 'video-generate') return '视频'

  const titleDone = String(project?.content?.selectedTitle || '').trim()
  const descriptionDone = String(project?.content?.selectedDescription || '').trim()
  const imageDone = Array.isArray(project?.assets?.generatedImages) && project.assets.generatedImages.length
  const videoDone = Boolean(project?.assets?.generatedVideo)

  if (!titleDone) return '标题'
  if (!descriptionDone) return '描述'
  if (!imageDone) return '套图'
  if (!videoDone) return '视频'
  return '完成'
}

function resolveQueueProgress(project = {}, latestRun = null) {
  const normalizedStatus = String(latestRun?.status || '').trim().toLowerCase()
  if (normalizedStatus === 'failed' || normalizedStatus === 'success') {
    return 100
  }

  if (typeof latestRun?.progress === 'number') {
    return Math.max(0, Math.min(100, latestRun.progress))
  }

  const titleDone = String(project?.content?.selectedTitle || '').trim()
  const descriptionDone = String(project?.content?.selectedDescription || '').trim()
  const imageDone = Array.isArray(project?.assets?.generatedImages) && project.assets.generatedImages.length
  const videoDone = Boolean(project?.assets?.generatedVideo)
  const count = [titleDone, descriptionDone, imageDone, videoDone].filter(Boolean).length
  return Math.round((count / 4) * 100)
}

function resolveTimeLabel(value = '') {
  const text = String(value || '').trim()
  if (!text) return '暂无'
  const date = new Date(text)
  if (Number.isNaN(date.getTime())) return text
  return `${date.getMonth() + 1}-${date.getDate()} ${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`
}

function resolveProjectContent(project = {}, latestRun = null) {
  const titleText = String(
    project?.content?.selectedTitle ||
    latestRun?.outputs?.selectedTitle ||
    latestRun?.outputs?.title ||
    ''
  ).trim()
  const descriptionText = String(
    project?.content?.selectedDescription ||
    latestRun?.outputs?.selectedDescription ||
    latestRun?.outputs?.description ||
    ''
  ).trim()
  const generatedImages = Array.isArray(project?.assets?.generatedImages) ? project.assets.generatedImages : []
  const generatedVideo = project?.assets?.generatedVideo || null
  const resultLanding = project?.metadata?.resultLanding && typeof project.metadata.resultLanding === 'object'
    ? project.metadata.resultLanding
    : {
        titleRunId: '',
        descriptionRunId: '',
        imageRunId: '',
        videoRunId: ''
      }

  return {
    titleText,
    descriptionText,
    generatedImages,
    generatedVideo,
    resultLanding
  }
}

function resolvePackageStatus(content) {
  const completedCount = [
    content.titleText,
    content.descriptionText,
    content.generatedImages.length ? 'image' : '',
    content.generatedVideo ? 'video' : ''
  ].filter(Boolean).length

  if (completedCount === 4) return '已完成'
  if (completedCount > 0) return '部分完成'
  return '未完成'
}

const currentProjectSteps = computed(() => {
  const latestRun = activeProjectEntry.value?.latestRun || {}
  const currentContent = resolveProjectContent(activeProjectEntry.value?.project || {}, latestRun)
  const generatedImages = currentContent.generatedImages
  const generatedVideo = currentContent.generatedVideo
  const baseStatus = String(latestRun?.status || '').trim().toLowerCase()

  return [
    {
      key: 'title',
      label: '标题',
      count: currentContent.titleText ? 1 : 0,
      status: currentContent.titleText ? '已完成' : resolveStepStatus(baseStatus)
    },
    {
      key: 'description',
      label: '描述',
      count: currentContent.descriptionText ? 1 : 0,
      status: currentContent.descriptionText ? '已完成' : resolveStepStatus(baseStatus)
    },
    {
      key: 'image',
      label: '套图',
      count: generatedImages.length,
      status: generatedImages.length ? '已完成' : resolveStepStatus(baseStatus)
    },
    {
      key: 'video',
      label: '视频',
      count: generatedVideo ? 1 : 0,
      status: generatedVideo ? '已完成' : resolveStepStatus(baseStatus)
    }
  ]
})

const currentProjectStageLabel = computed(() => {
  return resolveQueueStage(activeProjectEntry.value?.project || {}, activeProjectEntry.value?.latestRun || null)
})

const isCurrentProjectRunning = computed(() => {
  const status = String(activeProjectEntry.value?.latestRun?.status || '').trim().toLowerCase()
  return ['running', 'processing', 'submitting', 'pending', 'queued'].includes(status)
})

const currentProjectFlowSteps = computed(() => {
  const runningStage = currentProjectStageLabel.value
  const running = isCurrentProjectRunning.value

  return currentProjectSteps.value.map((step, index) => {
    const isDone = step.count > 0
    const isRunning = running && step.label === runningStage

    return {
      ...step,
      index: index + 1,
      tone: isDone ? 'done' : isRunning ? 'running' : (step.status === '失败' ? 'failed' : 'pending'),
      isDone,
      isRunning
    }
  })
})

const currentProjectCompletion = computed(() => {
  const steps = currentProjectSteps.value
  if (!steps.length) return 0
  const completed = steps.filter((item) => item.count > 0).length
  return Math.round((completed / steps.length) * 100)
})

const projectStorageRows = computed(() => {
  storageRefreshToken.value

  const rows = sortedProjects.value.map((project) => {
    const latestRun = projectRunMap.value.get(project.latestRunId) || null
    const content = resolveProjectContent(project, latestRun)

    return {
      id: project.id,
      project,
      latestRun,
      name: resolveProjectName(project),
      updatedAt: project?.updatedAt || project?.createdAt || '',
      status: resolvePackageStatus(content),
      titleCount: content.titleText ? 1 : 0,
      descriptionCount: content.descriptionText ? 1 : 0,
      imageCount: content.generatedImages.length,
      videoCount: content.generatedVideo ? 1 : 0
    }
  })

  if (storageSortMode.value === 'name-asc') {
    return rows.sort((left, right) => left.name.localeCompare(right.name, 'zh-CN'))
  }

  return rows.sort((left, right) => {
    const rightTime = new Date(right.updatedAt || 0).getTime()
    const leftTime = new Date(left.updatedAt || 0).getTime()
    return rightTime - leftTime
  })
})

const queueRows = computed(() => {
  return sortedProjects.value.slice(0, 12).map((project) => {
    const latestRun = projectRunMap.value.get(project.latestRunId) || null
    const status = resolveLatestRunStatus(latestRun)
    const queuePercent = resolveQueueProgress(project, latestRun)
    const currentStage = resolveQueueStage(project, latestRun)

    return {
      id: project.id,
      project,
      name: resolveProjectName(project),
      platform: resolveProjectPlatform(project),
      status,
      currentStage,
      progress: queuePercent,
      error: String(latestRun?.error || '').trim(),
      isActive: project.id === activeProjectEntry.value?.project?.id
    }
  })
})

const queueSummary = computed(() => {
  let queuedCount = 0
  let runningCount = 0

  queueRows.value.forEach((item) => {
    if (item.status === '排队中') queuedCount += 1
    if (item.status === '生成中') runningCount += 1
  })

  return { queuedCount, runningCount, totalCount: queueRows.value.length }
})

function updateDraftPatch(patch = {}) {
  Object.entries(patch || {}).forEach(([field, value]) => {
    emit('update-draft', { field, value })
  })
}

function handleProjectFieldUpdate(field, value) {
  if (field === 'name') {
    updateDraftPatch({
      projectName: value,
      taskName: value
    })
    return
  }

  if (field === 'platform') {
    updateDraftPatch({ platformTargetsText: value })
    return
  }

  if (field === 'productName') {
    updateDraftPatch({
      productName: value,
      projectName: value,
      taskName: value
    })
    return
  }

  updateDraftPatch({ [field]: value })
}

function updateProjectGenerationConfig(patch = {}) {
  updateDraftPatch(patch)
}

function handleStepToggle(stepKey, checked) {
  updateDraftPatch({
    enabledSteps: {
      ...resolveEnabledSteps(),
      [stepKey]: Boolean(checked)
    }
  })
}

function handlePromptTemplateApply(field, templateId) {
  const project = activeProjectEntry.value?.project
  if (!project?.id) return

  const template = (props.promptTemplates || []).find((item) => String(item?.id || '').trim() === String(templateId || '').trim())
  if (!template) {
    updateProjectGenerationConfig({ [field]: '', [`${field.replace('Prompt', 'TemplateId')}`]: '' })
    return
  }

  updateProjectGenerationConfig({
    [field]: String(template.prompt || ''),
    [`${field.replace('Prompt', 'TemplateId')}`]: String(template.id || '').trim()
  })
}

function handleOpenStep(menuKey) {
  const project = activeProjectEntry.value?.project
  if (!project || !menuKey) return
  emit('open-generator', { project, menuKey })
}

function handleRunProject(project) {
  if (!project?.id) return
  emit('run-project', project)
}

function handleOpenProjectStorage(project) {
  inspectedProjectId.value = String(project?.id || '').trim()
}

function handleSelectProjectStorage(project) {
  inspectedProjectId.value = String(project?.id || '').trim()
}

function closeProjectDetailModal() {
  inspectedProjectId.value = ''
  closeStorageContextMenu()
}

function handleSaveTemplate(project) {
  if (!project?.id) return
  emit('save-project-template', project)
}

function handleCreateProjectFromStorage() {
  emit('create-project')
}

function handleRefreshStorageWorkspace() {
  storageRefreshToken.value += 1
  closeStorageContextMenu()
}

function handleToggleStorageSort() {
  storageSortMode.value = storageSortMode.value === 'updated-desc' ? 'name-asc' : 'updated-desc'
  closeStorageContextMenu()
}

function closeStorageContextMenu() {
  storageContextMenu.value = {
    visible: false,
    x: 0,
    y: 0,
    item: null
  }
}

function handleOpenStorageFolder(project) {
  handleOpenProjectStorage(project)
  closeStorageContextMenu()
}

function handleOpenStorageContextMenu(event, item) {
  if (!item?.id) return
  const viewportWidth = window.innerWidth || 0
  const viewportHeight = window.innerHeight || 0
  const menuWidth = 152
  const menuHeight = 124
  const x = Math.min(event.clientX, Math.max(12, viewportWidth - menuWidth - 12))
  const y = Math.min(event.clientY, Math.max(12, viewportHeight - menuHeight - 12))
  storageContextMenu.value = {
    visible: true,
    x,
    y,
    item
  }
}

function handleStorageContextAction(action) {
  const item = storageContextMenu.value.item
  if (!item?.id) return

  if (action === 'save-template') {
    handleSaveTemplate(item.project)
  } else if (action === 'export-project') {
    emit('export-project', item.id)
  } else if (action === 'delete-project') {
    emit('delete-project', item.id)
  }

  closeStorageContextMenu()
}

function handleOpenInspectedImages() {
  if (!inspectedProjectEntry.value) return
  emit('open-images', {
    project: inspectedProjectEntry.value.project,
    run: inspectedProjectEntry.value.latestRun
  })
}

function handleOpenInspectedVideo() {
  if (!inspectedProjectEntry.value) return
  emit('open-video', {
    project: inspectedProjectEntry.value.project,
    run: inspectedProjectEntry.value.latestRun
  })
}

function handleExportInspectedProject() {
  if (!inspectedProjectEntry.value?.project?.id) return
  emit('export-project', inspectedProjectEntry.value.project.id)
}

function handleFocusQueueProject(project) {
  if (!project?.id) return
  handleOpenProjectStorage(project)
}

onMounted(() => {
  window.addEventListener('pointerdown', closeStorageContextMenu)
  window.addEventListener('blur', closeStorageContextMenu)
})

onBeforeUnmount(() => {
  window.removeEventListener('pointerdown', closeStorageContextMenu)
  window.removeEventListener('blur', closeStorageContextMenu)
})

function resolveStageMenuKey(stage = '') {
  if (stage === '标题') return 'title-generate'
  if (stage === '描述') return 'description-generate'
  if (stage === '套图') return 'series-generate'
  return 'video-generate'
}
</script>

<template>
  <section class="generator-studio-page work-center-studio">
    <article class="generator-column generator-column--settings">
      <header class="generator-column__header work-center-studio__column-header">
        <div class="work-center-studio__header-copy">
          <strong>项目参数设置</strong>
        </div>
      </header>

      <div class="generator-form">
        <div class="generator-form__group">
          <div class="generator-form__row">
            <span class="generator-form__label">商品名称</span>
            <input
              :value="resolveDraftProductName()"
              type="text"
              placeholder="输入商品名称"
              @input="handleProjectFieldUpdate('productName', $event.target.value)"
            >
          </div>
          <div class="generator-form__row">
            <span class="generator-form__label">语言</span>
            <select
              :value="resolveDraftLanguage()"
              @change="handleProjectFieldUpdate('language', $event.target.value)"
            >
              <option v-for="option in languageOptions" :key="option.value" :value="option.value">
                {{ option.label }}
              </option>
            </select>
          </div>
        </div>

        <div class="generator-form__group work-center-studio__step-grid">
          <div
            v-for="item in workspaceStepOptions"
            :key="item.key"
            class="generator-form__row generator-form__row--checkbox"
            :class="{ 'work-center-studio__step-chip--active': resolveEnabledSteps()[item.key] }"
          >
            <span class="generator-form__label work-center-studio__step-chip-label">{{ item.label }}</span>
            <label class="work-center-studio__step-chip-control">
              <input
                :checked="resolveEnabledSteps()[item.key]"
                type="checkbox"
                @change="handleStepToggle(item.key, $event.target.checked)"
              >
            </label>
            <div class="work-center-studio__toggle">
              <span class="work-center-studio__step-chip-state">{{ resolveEnabledSteps()[item.key] ? '开启' : '关闭' }}</span>
            </div>
          </div>
        </div>

        <div class="generator-form__row">
          <span class="generator-form__label">原图上传</span>
          <div class="generator-form__asset">
            <button
              class="secondary-action generator-form__asset-button"
              type="button"
              @click="emit('replace-project-image', activeProjectEntry?.project)"
            >
              上传原图
            </button>
            <div class="generator-form__asset-preview">
              <img
                v-if="currentProjectImagePreview"
                class="generator-preview__image generator-preview__image--inline"
                :src="currentProjectImagePreview"
                alt=""
              >
              <div v-else class="generator-form__asset-empty">暂无原图</div>
            </div>
          </div>
        </div>

        <div class="generator-form__group">
          <div class="generator-form__row">
            <span class="generator-form__label">标题模板</span>
            <select
              :value="resolveProjectTemplateSelection().titleTemplateId"
              @change="handlePromptTemplateApply('titlePrompt', $event.target.value)"
            >
              <option value="">默认</option>
              <option v-for="item in titlePromptTemplates" :key="item.id" :value="item.id">
                {{ item.name || '未命名模板' }}
              </option>
            </select>
          </div>
          <div class="generator-form__row">
            <span class="generator-form__label">描述模板</span>
            <select
              :value="resolveProjectTemplateSelection().descriptionTemplateId"
              @change="handlePromptTemplateApply('descriptionPrompt', $event.target.value)"
            >
              <option value="">默认</option>
              <option v-for="item in descriptionPromptTemplates" :key="item.id" :value="item.id">
                {{ item.name || '未命名模板' }}
              </option>
            </select>
          </div>
        </div>

        <div class="generator-form__group">
          <div class="generator-form__row">
            <span class="generator-form__label">图片模板</span>
            <select
              :value="resolveProjectTemplateSelection().imageTemplateId"
              @change="handlePromptTemplateApply('imagePrompt', $event.target.value)"
            >
              <option value="">默认</option>
              <option v-for="item in imagePromptTemplates" :key="item.id" :value="item.id">
                {{ item.name || imageTemplateTypeMap[item.id] || '未命名模板' }}
              </option>
            </select>
          </div>
          <div class="generator-form__row">
            <span class="generator-form__label">视频模板</span>
            <select
              :value="resolveProjectTemplateSelection().videoTemplateId"
              @change="handlePromptTemplateApply('videoPrompt', $event.target.value)"
            >
              <option value="">默认</option>
              <option v-for="item in videoPromptTemplates" :key="item.id" :value="item.id">
                {{ item.name || '未命名模板' }}
              </option>
            </select>
          </div>
        </div>

        <div class="generator-form__group">
          <div class="generator-form__row">
            <span class="generator-form__label">图片模型</span>
            <select
              :value="resolveDraftSelectValue('imageModel', imageModelOptions[0]?.value)"
              @change="updateProjectGenerationConfig({ imageModel: $event.target.value })"
            >
              <option v-for="option in imageModelOptions" :key="option.value" :value="option.value">
                {{ option.label }}
              </option>
            </select>
          </div>
          <div class="generator-form__row">
            <span class="generator-form__label">图片尺寸</span>
            <select
              :value="resolveDraftSelectValue('size', imageSizeOptions[0]?.value)"
              @change="updateProjectGenerationConfig({ size: $event.target.value })"
            >
              <option v-for="option in imageSizeOptions" :key="option.value" :value="option.value">
                {{ option.label }}
              </option>
            </select>
          </div>
        </div>

        <div class="generator-form__group">
          <div class="generator-form__row">
            <span class="generator-form__label">视频模型</span>
            <select
              :value="resolveDraftSelectValue('videoModel', videoModelOptions[0]?.value)"
              @change="updateProjectGenerationConfig({ videoModel: $event.target.value })"
            >
              <option v-for="option in videoModelOptions" :key="option.value" :value="option.value">
                {{ option.label }}
              </option>
            </select>
          </div>
          <div class="generator-form__row">
            <span class="generator-form__label">视频时长</span>
            <select
              :value="resolveDraftSelectValue('duration', videoDurationOptions[0]?.value)"
              @change="updateProjectGenerationConfig({ duration: $event.target.value })"
            >
              <option v-for="option in videoDurationOptions" :key="option.value" :value="option.value">
                {{ option.label }}
              </option>
            </select>
          </div>
        </div>

        <div class="generator-form__group">
          <div class="generator-form__row">
            <span class="generator-form__label">视频清晰度</span>
            <select
              :value="resolveDraftSelectValue('resolution', videoResolutionOptions[0]?.value)"
              @change="updateProjectGenerationConfig({ resolution: $event.target.value })"
            >
              <option v-for="option in videoResolutionOptions" :key="option.value" :value="option.value">
                {{ option.label }}
              </option>
            </select>
          </div>
          <div class="generator-form__row">
            <span class="generator-form__label">运动强度</span>
            <select
              :value="resolveDraftSelectValue('motionStrength', videoMotionOptions[0]?.value)"
              @change="updateProjectGenerationConfig({ motionStrength: $event.target.value })"
            >
              <option v-for="option in videoMotionOptions" :key="option.value" :value="option.value">
                {{ option.label }}
              </option>
            </select>
          </div>
        </div>

        <div class="generator-form__row">
          <span class="generator-form__label">关键词</span>
          <textarea
            :value="resolveDraftKeywords()"
            rows="4"
            placeholder="输入关键词、卖点、风格"
            @input="handleProjectFieldUpdate('keywordsText', $event.target.value)"
          ></textarea>
        </div>

        <div class="generator-form__card">
          <textarea
            :value="resolveDraftNotes()"
            rows="7"
            placeholder="补充项目要求、风格和限制条件"
            @input="handleProjectFieldUpdate('notes', $event.target.value)"
          ></textarea>
        </div>

        <div class="work-center-studio__shortcut-block">
          <div class="work-center-studio__shortcut-head">
            <span>快捷入口</span>
          </div>

          <div class="generator-form__group work-center-studio__entry-grid">
            <button class="secondary-action work-center-studio__shortcut-button" type="button" @click="handleOpenStep('title-generate')">标题生成</button>
            <button class="secondary-action work-center-studio__shortcut-button" type="button" @click="handleOpenStep('description-generate')">描述生成</button>
            <button class="secondary-action work-center-studio__shortcut-button" type="button" @click="handleOpenStep('series-generate')">套图生成</button>
            <button class="secondary-action work-center-studio__shortcut-button" type="button" @click="handleOpenStep('video-generate')">视频生成</button>
          </div>
        </div>

        <div class="work-center-studio__submit-bar">
          <div class="work-center-studio__submit-copy">
            <strong>一键执行当前项目</strong>
          </div>
          <button
            class="primary-action work-center-studio__submit-button"
            type="button"
            :disabled="!activeProjectEntry?.project || submitButtonState === 'pending'"
            @click="handleRunProject(activeProjectEntry?.project)"
          >
            {{ submitButtonState === 'pending' ? '生成中...' : '开始生成' }}
          </button>
        </div>
      </div>
    </article>

    <article class="generator-column generator-column--preview">
      <header class="generator-column__header work-center-studio__column-header">
        <div class="work-center-studio__header-copy">
          <strong>当前项目进度</strong>
        </div>
      </header>

      <div class="generator-progress-layout work-center-studio__middle-layout work-center-studio__middle-layout--stack">
        <section class="latest-task-progress work-center-studio__progress-strip">
          <header class="latest-task-progress__header">
            <div class="work-center-studio__panel-copy">
              <div class="latest-task-progress__meta work-center-studio__status-pills">
                <span class="task-status">{{ activeProjectEntry?.latestRun ? resolveLatestRunStatus(activeProjectEntry.latestRun) : '未开始' }}</span>
                <span class="task-status">{{ currentProjectCompletion }}%</span>
              </div>
            </div>
            <div class="work-center-studio__panel-badge">
              <strong>{{ queueSummary.runningCount > 0 ? '处理中' : '空闲' }}</strong>
              <span>{{ currentProjectStageLabel }}</span>
            </div>
          </header>

          <div class="work-center-studio__flow-line">
            <div
              v-for="step in currentProjectFlowSteps"
              :key="step.key"
              class="work-center-studio__flow-step"
              :class="`work-center-studio__flow-step--${step.tone}`"
            >
              <div class="work-center-studio__flow-track">
                <div class="work-center-studio__flow-node">
                  <span v-if="!step.isRunning">{{ step.index }}</span>
                  <span v-else class="work-center-studio__flow-spinner" aria-hidden="true"></span>
                </div>
                <span v-if="step.index < currentProjectFlowSteps.length" class="work-center-studio__flow-connector"></span>
              </div>
              <div class="work-center-studio__flow-copy">
                <strong>{{ step.index }}.{{ step.label }}</strong>
                <span>{{ step.isDone ? '已完成' : step.isRunning ? '生成中' : step.status }}</span>
              </div>
            </div>
          </div>
        </section>

        <div class="work-center-studio__section-divider" aria-hidden="true"></div>

        <section class="latest-task-progress generator-preview-panel work-center-studio__storage-panel-main">
          <header class="latest-task-progress__header">
            <div class="work-center-studio__panel-copy">
              <h3>项目结果存储</h3>
              <div class="latest-task-progress__meta work-center-studio__status-pills">
                <span>{{ projectStorageRows.length }} 个项目</span>
              </div>
            </div>
            <div class="work-center-studio__storage-toolbar">
              <button class="secondary-action work-center-studio__toolbar-button" type="button" @click="handleCreateProjectFromStorage()">
                新建项目
              </button>
              <button class="secondary-action work-center-studio__toolbar-button" type="button" @click="handleRefreshStorageWorkspace()">
                刷新
              </button>
              <button class="secondary-action work-center-studio__toolbar-button" type="button" @click="handleToggleStorageSort()">
                {{ storageSortMode === 'updated-desc' ? '按时间' : '按名称' }}
              </button>
            </div>
          </header>

          <div class="generator-preview-stage work-center-studio__folder-workspace">
            <button
              v-for="item in projectStorageRows"
              :key="item.id"
              type="button"
              class="work-center-studio__folder-item"
              @click="handleSelectProjectStorage(item.project)"
              @dblclick="handleOpenStorageFolder(item.project)"
              @contextmenu.prevent.stop="handleOpenStorageContextMenu($event, item)"
            >
              <span class="work-center-studio__folder-icon" aria-hidden="true"></span>
              <span class="work-center-studio__folder-copy">
                <strong class="work-center-studio__folder-name">{{ item.name }}</strong>
                <span class="work-center-studio__folder-meta">{{ resolveTimeLabel(item.updatedAt) }}</span>
              </span>
              <span class="work-center-studio__folder-stats">
                <span>{{ item.status }}</span>
                <span>T{{ item.titleCount }}</span>
                <span>D{{ item.descriptionCount }}</span>
                <span>I{{ item.imageCount }}</span>
                <span>V{{ item.videoCount }}</span>
              </span>
            </button>

            <div v-if="!projectStorageRows.length" class="product-result-empty product-result-empty--compact work-center-studio__storage-empty">
              <span>暂无项目结果</span>
            </div>
          </div>

          <div
            v-if="storageContextMenu.visible"
            class="work-center-studio__context-menu"
            :style="{ left: `${storageContextMenu.x}px`, top: `${storageContextMenu.y}px` }"
            @pointerdown.stop
          >
            <button type="button" class="work-center-studio__context-action" @click="handleStorageContextAction('save-template')">
              保存模板
            </button>
            <button type="button" class="work-center-studio__context-action" @click="handleStorageContextAction('export-project')">
              打包下载
            </button>
            <button type="button" class="work-center-studio__context-action work-center-studio__context-action--danger" @click="handleStorageContextAction('delete-project')">
              删除项目
            </button>
          </div>

          <div v-if="inspectedProjectEntry" class="work-center-studio__modal-mask" @click="closeProjectDetailModal">
            <div class="work-center-studio__modal-card" @click.stop>
              <div class="work-center-studio__modal-head">
                <div class="work-center-studio__inspect-head">
                  <strong>结果包详情</strong>
                  <span>{{ resolveProjectName(inspectedProjectEntry.project) }}</span>
                </div>
                <button class="secondary-action work-center-studio__mini-button" type="button" @click="closeProjectDetailModal">
                  关闭
                </button>
              </div>
              <div class="work-center-studio__inspect-summary">
                <span>{{ resolveProjectPlatform(inspectedProjectEntry.project) }}</span>
                <span>{{ resolveProjectLanguage(inspectedProjectEntry.project) }}</span>
                <span>{{ resolveTimeLabel(inspectedProjectEntry.project?.updatedAt || inspectedProjectEntry.project?.createdAt) }}</span>
              </div>
              <div class="work-center-studio__inspect-grid">
                <div class="work-center-studio__inspect-cell">
                  <span>标题</span>
                  <button class="work-center-studio__inspect-copy" type="button" @click="emit('copy-text', resolveProjectContent(inspectedProjectEntry.project, inspectedProjectEntry.latestRun).titleText)">
                    {{ resolveProjectContent(inspectedProjectEntry.project, inspectedProjectEntry.latestRun).titleText || '暂无标题结果' }}
                  </button>
                </div>
                <div class="work-center-studio__inspect-cell">
                  <span>描述</span>
                  <button class="work-center-studio__inspect-copy" type="button" @click="emit('copy-text', resolveProjectContent(inspectedProjectEntry.project, inspectedProjectEntry.latestRun).descriptionText)">
                    {{ resolveProjectContent(inspectedProjectEntry.project, inspectedProjectEntry.latestRun).descriptionText || '暂无描述结果' }}
                  </button>
                </div>
                <div class="work-center-studio__inspect-cell">
                  <span>套图</span>
                  <div class="work-center-studio__inspect-action-stack">
                    <strong>{{ resolveProjectContent(inspectedProjectEntry.project, inspectedProjectEntry.latestRun).generatedImages.length }} 张</strong>
                    <button
                      class="secondary-action work-center-studio__mini-button"
                      type="button"
                      :disabled="!resolveProjectContent(inspectedProjectEntry.project, inspectedProjectEntry.latestRun).generatedImages.length"
                      @click="handleOpenInspectedImages"
                    >
                      查看
                    </button>
                  </div>
                </div>
                <div class="work-center-studio__inspect-cell">
                  <span>视频</span>
                  <div class="work-center-studio__inspect-action-stack">
                    <strong>{{ resolveProjectContent(inspectedProjectEntry.project, inspectedProjectEntry.latestRun).generatedVideo ? '已生成' : '未生成' }}</strong>
                    <button
                      class="secondary-action work-center-studio__mini-button"
                      type="button"
                      :disabled="!resolveProjectContent(inspectedProjectEntry.project, inspectedProjectEntry.latestRun).generatedVideo"
                      @click="handleOpenInspectedVideo"
                    >
                      查看
                    </button>
                  </div>
                </div>
              </div>
              <div class="work-center-studio__inspect-actions">
                <button class="secondary-action work-center-studio__mini-button" type="button" @click="handleSaveTemplate(inspectedProjectEntry.project)">
                  保存模板
                </button>
                <button class="primary-action work-center-studio__mini-button" type="button" @click="handleExportInspectedProject">
                  打包下载
                </button>
              </div>
            </div>
          </div>
        </section>
      </div>
    </article>

    <article class="generator-column generator-column--export">
      <header class="generator-column__header work-center-studio__column-header">
        <div class="work-center-studio__header-copy">
          <strong>任务队列</strong>
          <h2>{{ queueSummary.totalCount }} 项</h2>
        </div>
      </header>

      <div class="generator-export">
        <div class="generator-export__list work-center-studio__export-stack">
          <section class="work-center-studio__queue-panel">
            <div class="work-center-studio__queue-list">
              <article
                v-for="item in queueRows"
                :key="item.id"
                class="work-center-studio__queue-card"
                :class="{ 'work-center-studio__queue-card--active': item.isActive }"
              >
                <div class="work-center-studio__queue-card-head">
                <div class="work-center-studio__queue-card-copy">
                    <strong class="work-center-studio__title-ellipsis work-center-studio__title-ellipsis--double">{{ item.name }}</strong>
                    <span>{{ item.currentStage }}</span>
                  </div>
                  <span class="task-status">{{ item.status }}</span>
                </div>

                <div class="work-center-studio__queue-card-meta">
                  <span>{{ item.platform }}</span>
                  <span>{{ item.progress }}%</span>
                </div>

                <div class="task-progress task-progress--small">
                  <span class="task-progress__bar" :style="{ width: `${item.progress}%` }"></span>
                </div>

                <div v-if="item.status === '失败' && item.error" class="work-center-studio__queue-card-error">
                  {{ item.error }}
                </div>

                <div class="work-center-studio__queue-card-actions">
                  <button class="secondary-action work-center-studio__mini-button" type="button" @click="handleOpenProjectStorage(item.project)">查看结果</button>
                  <button class="secondary-action work-center-studio__mini-button" type="button" @click="handleFocusQueueProject(item.project)">定位项目</button>
                </div>
              </article>

              <div v-if="!queueRows.length" class="product-result-empty product-result-empty--compact">
                <span>当前没有项目任务</span>
              </div>
            </div>
          </section>

        </div>
      </div>
    </article>
  </section>
</template>

<style scoped>
.work-center-studio {
  min-height: calc(100vh - 180px);
}

.work-center-studio .generator-column {
  display: flex;
  flex-direction: column;
  min-height: 0;
}

.work-center-studio .generator-column--preview {
  min-width: 0;
}

.work-center-studio .generator-form,
.work-center-studio .generator-progress-layout,
.work-center-studio .generator-preview-stage,
.work-center-studio .generator-export {
  min-height: 0;
}

.work-center-studio__column-header {
  padding-bottom: 4px;
}

.work-center-studio__header-copy {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 12px;
  min-width: 0;
}

.work-center-studio__header-copy h2 {
  margin-left: auto;
  font-size: 15px;
  line-height: 1.2;
  max-width: min(100%, 360px);
  min-width: 0;
  text-align: right;
}

.work-center-studio__title-ellipsis {
  display: -webkit-box;
  overflow: hidden;
  text-overflow: ellipsis;
  -webkit-box-orient: vertical;
  word-break: break-word;
  overflow-wrap: anywhere;
}

.work-center-studio__title-ellipsis--single {
  -webkit-line-clamp: 1;
  line-clamp: 1;
}

.work-center-studio__title-ellipsis--double {
  -webkit-line-clamp: 2;
  line-clamp: 2;
}

.work-center-studio__title-ellipsis--triple {
  -webkit-line-clamp: 3;
  line-clamp: 3;
}

.work-center-studio__entry-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;
}

.work-center-studio__shortcut-block {
  display: none;
}

.work-center-studio__shortcut-head {
  display: flex;
  align-items: center;
}

.work-center-studio__shortcut-head span {
  font-size: 12px;
  font-weight: 700;
}

.work-center-studio__shortcut-button {
  min-height: 38px;
}

.work-center-studio__submit-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 12px 14px;
  border-radius: 16px;
  border: 1px solid rgba(130, 110, 255, 0.18);
  background: linear-gradient(135deg, rgba(91, 74, 166, 0.18), rgba(83, 183, 255, 0.05));
}

.work-center-studio__submit-copy {
  display: flex;
  align-items: center;
}

.work-center-studio__submit-button {
  min-width: 148px;
}

.work-center-studio__step-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 8px;
}

.work-center-studio__step-grid .generator-form__row--checkbox {
  display: grid;
  justify-items: center;
  align-content: center;
  gap: 6px;
  padding: 10px 12px;
  border-radius: 14px;
  border: 1px solid rgba(255, 255, 255, 0.08);
  background: rgba(255, 255, 255, 0.03);
  transition: border-color 0.18s ease, background 0.18s ease, box-shadow 0.18s ease;
  min-width: 0;
}

.work-center-studio__step-chip--active {
  border-color: rgba(100, 186, 255, 0.34);
  background: linear-gradient(180deg, rgba(100, 186, 255, 0.12), rgba(100, 186, 255, 0.05));
  box-shadow: inset 0 0 0 1px rgba(100, 186, 255, 0.12);
}

.work-center-studio__step-chip-control {
  display: inline-flex;
  align-items: center;
  justify-content: center;
}

.work-center-studio__step-chip-control input {
  margin: 0;
  width: 14px;
  height: 14px;
}

.work-center-studio__step-chip-label {
  font-weight: 700;
  min-width: 0;
  white-space: nowrap;
  text-align: center;
}

.work-center-studio__toggle {
  display: inline-flex;
  align-items: center;
  justify-content: center;
}

.work-center-studio__step-chip-state {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 36px;
  padding: 3px 8px;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.06);
  font-size: 11px;
  color: rgba(205, 214, 238, 0.82);
  white-space: nowrap;
}

.work-center-studio__step-chip--active .work-center-studio__step-chip-state {
  background: rgba(100, 186, 255, 0.16);
  color: #d8efff;
}

.work-center-studio__inspect-action-stack {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

.work-center-studio__inspect-actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  margin-top: 12px;
}

.work-center-studio__middle-layout {
  flex: 1;
}

.work-center-studio__middle-layout--stack {
  display: grid;
  grid-template-rows: minmax(180px, 1fr) 1px minmax(0, 2fr);
  gap: 14px;
}

.work-center-studio__progress-strip {
  padding: 14px 16px;
}

.work-center-studio__section-divider {
  width: 100%;
  height: 1px;
  border-radius: 999px;
  background: linear-gradient(90deg, rgba(255, 255, 255, 0.06), rgba(100, 186, 255, 0.28), rgba(255, 255, 255, 0.06));
}

.work-center-studio__panel-copy {
  display: grid;
  gap: 6px;
  min-width: 0;
}

.work-center-studio__panel-copy h3 {
  min-width: 0;
}

.work-center-studio__status-pills {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.work-center-studio__panel-badge {
  display: grid;
  justify-items: end;
  gap: 4px;
}

.work-center-studio__panel-badge span {
  color: rgba(205, 214, 238, 0.68);
  font-size: 12px;
}

.work-center-studio__flow-line {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 12px;
  align-items: stretch;
  overflow: hidden;
  padding: 2px 0 4px;
}

.work-center-studio__flow-step {
  display: grid;
  grid-template-rows: auto auto;
  gap: 10px;
  min-width: 0;
  padding: 12px 12px 10px;
  border-radius: 16px;
  border: 1px solid rgba(255, 255, 255, 0.08);
  background: linear-gradient(180deg, rgba(255, 255, 255, 0.035), rgba(255, 255, 255, 0.015));
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.03);
  backdrop-filter: blur(8px);
}

.work-center-studio__flow-track {
  display: grid;
  grid-template-columns: auto minmax(18px, 1fr);
  align-items: center;
  gap: 10px;
  min-width: 0;
}

.work-center-studio__flow-node {
  width: 34px;
  height: 34px;
  border-radius: 999px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: 13px;
  font-weight: 700;
  border: 1px solid rgba(255, 255, 255, 0.12);
  background: radial-gradient(circle at 30% 30%, rgba(255, 255, 255, 0.14), rgba(255, 255, 255, 0.04));
  color: rgba(226, 232, 244, 0.76);
  flex: 0 0 auto;
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.06);
}

.work-center-studio__flow-copy {
  display: grid;
  gap: 4px;
  min-width: 0;
}

.work-center-studio__flow-copy strong {
  font-size: 13px;
  line-height: 1.35;
  color: rgba(243, 247, 255, 0.94);
}

.work-center-studio__flow-copy span {
  font-size: 12px;
  color: rgba(205, 214, 238, 0.72);
}

.work-center-studio__flow-connector {
  height: 2px;
  width: 100%;
  border-radius: 999px;
  background: linear-gradient(90deg, rgba(255, 255, 255, 0.2), rgba(255, 255, 255, 0.04));
}

.work-center-studio__flow-step--done .work-center-studio__flow-node {
  border-color: rgba(82, 196, 26, 0.45);
  background: rgba(82, 196, 26, 0.18);
  color: #9be15d;
  box-shadow: 0 0 18px rgba(82, 196, 26, 0.18);
}

.work-center-studio__flow-step--done {
  border-color: rgba(82, 196, 26, 0.22);
  background: linear-gradient(180deg, rgba(82, 196, 26, 0.12), rgba(82, 196, 26, 0.04));
}

.work-center-studio__flow-step--done .work-center-studio__flow-copy strong {
  color: #c9f7a8;
}

.work-center-studio__flow-step--done .work-center-studio__flow-connector {
  background: linear-gradient(90deg, rgba(82, 196, 26, 0.55), rgba(82, 196, 26, 0.2));
}

.work-center-studio__flow-step--running .work-center-studio__flow-node {
  border-color: rgba(100, 186, 255, 0.55);
  background: rgba(100, 186, 255, 0.14);
  color: #8fd0ff;
  box-shadow: 0 0 18px rgba(100, 186, 255, 0.2);
}

.work-center-studio__flow-step--running {
  border-color: rgba(100, 186, 255, 0.24);
  background: linear-gradient(180deg, rgba(100, 186, 255, 0.12), rgba(100, 186, 255, 0.04));
}

.work-center-studio__flow-step--running .work-center-studio__flow-copy strong {
  color: #cbe7ff;
}

.work-center-studio__flow-step--running .work-center-studio__flow-connector {
  background: linear-gradient(90deg, rgba(100, 186, 255, 0.62), rgba(100, 186, 255, 0.18));
}

.work-center-studio__flow-step--failed .work-center-studio__flow-node {
  border-color: rgba(255, 120, 117, 0.5);
  background: rgba(255, 120, 117, 0.16);
  color: #ffb3a8;
}

.work-center-studio__flow-step--failed {
  border-color: rgba(255, 120, 117, 0.22);
  background: linear-gradient(180deg, rgba(255, 120, 117, 0.12), rgba(255, 120, 117, 0.04));
}

.work-center-studio__flow-step--failed .work-center-studio__flow-copy strong {
  color: #ffd2ca;
}

.work-center-studio__flow-step--failed .work-center-studio__flow-connector {
  background: linear-gradient(90deg, rgba(255, 120, 117, 0.56), rgba(255, 120, 117, 0.16));
}

.work-center-studio__queue-card-error {
  font-size: 12px;
  line-height: 1.5;
  color: #ffb3a8;
  padding: 8px 10px;
  border-radius: 10px;
  background: rgba(255, 120, 117, 0.08);
  border: 1px solid rgba(255, 120, 117, 0.12);
}

.work-center-studio__flow-step--pending .work-center-studio__flow-copy strong {
  color: rgba(232, 238, 247, 0.9);
}

.work-center-studio__flow-spinner {
  width: 14px;
  height: 14px;
  border-radius: 999px;
  border: 2px solid rgba(143, 208, 255, 0.2);
  border-top-color: #8fd0ff;
  animation: work-center-spin 0.9s linear infinite;
}

@keyframes work-center-spin {
  to {
    transform: rotate(360deg);
  }
}

.work-center-studio__storage-panel-main {
  display: grid;
  grid-template-rows: auto minmax(0, 1fr);
  min-height: 0;
  gap: 10px;
  padding: 14px 16px;
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 18px;
  background:
    linear-gradient(180deg, rgba(255, 255, 255, 0.025), rgba(255, 255, 255, 0.01)),
    rgba(9, 13, 23, 0.72);
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.04);
  position: relative;
}

.work-center-studio__storage-toolbar {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  align-items: center;
  justify-content: flex-end;
  padding: 0;
}

.work-center-studio__toolbar-button {
  min-height: 32px;
  padding: 0 12px;
  border-radius: 10px;
}

.work-center-studio__inspect-copy {
  margin: 0;
  color: rgba(226, 232, 244, 0.88);
  line-height: 1.6;
  word-break: break-word;
}

.work-center-studio__inline-actions,
.work-center-studio__queue-card-actions,
.work-center-studio__storage-actions,
.work-center-studio__storage-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  align-items: center;
}

.work-center-studio__mini-button {
  min-height: 30px;
  padding: 0 10px;
  font-size: 12px;
}

.work-center-studio__export-stack {
  display: grid;
  grid-template-rows: minmax(0, 1fr);
  gap: 10px;
  min-height: 0;
}

.work-center-studio__queue-panel {
  min-height: 0;
  display: grid;
  grid-template-rows: auto minmax(0, 1fr) auto;
}

.work-center-studio__queue-summary {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-bottom: 8px;
}

.work-center-studio__queue-summary span {
  padding: 6px 10px;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.05);
  color: rgba(205, 214, 238, 0.76);
  font-size: 12px;
}

.work-center-studio__queue-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
  min-height: 0;
  overflow: auto;
  padding-right: 4px;
}

.work-center-studio__folder-workspace {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(120px, 1fr));
  gap: 12px;
  align-content: start;
  min-height: 0;
  max-height: 220px;
  overflow: auto;
  padding-right: 4px;
}

.work-center-studio__folder-item {
  display: grid;
  grid-template-columns: 1fr;
  justify-items: stretch;
  gap: 8px;
  min-height: 132px;
  padding: 12px;
  border: 1px solid transparent;
  border-radius: 16px;
  background: transparent;
  color: rgba(226, 232, 244, 0.9);
  text-align: left;
  cursor: pointer;
  transition: background 0.18s ease, border-color 0.18s ease, transform 0.18s ease;
}

.work-center-studio__folder-item:hover {
  background: rgba(255, 255, 255, 0.04);
  border-color: rgba(255, 255, 255, 0.08);
  transform: translateY(-1px);
}

.work-center-studio__folder-item:focus-visible {
  outline: none;
  border-color: rgba(100, 186, 255, 0.45);
  box-shadow: 0 0 0 2px rgba(100, 186, 255, 0.16);
}

.work-center-studio__folder-item--active {
  background: linear-gradient(180deg, rgba(100, 186, 255, 0.12), rgba(100, 186, 255, 0.06));
  border-color: rgba(100, 186, 255, 0.34);
  box-shadow:
    inset 0 0 0 1px rgba(100, 186, 255, 0.12),
    0 10px 20px rgba(0, 0, 0, 0.14);
}

.work-center-studio__folder-icon {
  width: 56px;
  height: 44px;
  border-radius: 10px 10px 12px 12px;
  background:
    linear-gradient(180deg, rgba(255, 214, 102, 1), rgba(238, 176, 56, 0.95));
  position: relative;
  box-shadow: 0 10px 18px rgba(0, 0, 0, 0.18);
}

.work-center-studio__folder-icon::before {
  content: '';
  position: absolute;
  top: -6px;
  left: 6px;
  width: 24px;
  height: 10px;
  border-radius: 8px 8px 0 0;
  background: rgba(255, 227, 145, 0.98);
}

.work-center-studio__folder-copy {
  display: grid;
  gap: 4px;
  min-width: 0;
}

.work-center-studio__folder-name {
  width: 100%;
  font-size: 12px;
  line-height: 1.4;
  word-break: break-word;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.work-center-studio__folder-meta {
  font-size: 11px;
  color: rgba(205, 214, 238, 0.62);
}

.work-center-studio__folder-stats {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-top: auto;
}

.work-center-studio__folder-stats span {
  padding: 4px 7px;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.05);
  font-size: 11px;
  color: rgba(205, 214, 238, 0.72);
}

.work-center-studio__context-menu {
  position: fixed;
  z-index: 40;
  display: grid;
  min-width: 136px;
  padding: 6px;
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 14px;
  background: rgba(14, 18, 28, 0.96);
  box-shadow: 0 18px 40px rgba(0, 0, 0, 0.34);
  backdrop-filter: blur(12px);
}

.work-center-studio__context-action {
  min-height: 34px;
  padding: 0 10px;
  border: 0;
  border-radius: 10px;
  background: transparent;
  color: rgba(226, 232, 244, 0.9);
  text-align: left;
  cursor: pointer;
}

.work-center-studio__context-action:hover {
  background: rgba(255, 255, 255, 0.06);
}

.work-center-studio__context-action--danger {
  color: #ffb3a8;
}

.work-center-studio__queue-card,
.work-center-studio__storage-item,
.work-center-studio__inspect-panel {
  display: grid;
  gap: 6px;
  min-height: 0;
  padding: 10px 12px;
  border-radius: 16px;
  border: 1px solid rgba(255, 255, 255, 0.08);
  background: rgba(9, 13, 23, 0.72);
}

.work-center-studio__queue-card--active,
.work-center-studio__storage-item--active {
  border-color: rgba(100, 186, 255, 0.35);
  box-shadow: 0 0 0 1px rgba(100, 186, 255, 0.16) inset;
}

.work-center-studio__queue-card-head,
.work-center-studio__storage-copy,
.work-center-studio__inspect-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
}

.work-center-studio__queue-card-copy,
.work-center-studio__storage-copy {
  display: grid;
  gap: 4px;
  min-width: 0;
}

.work-center-studio__queue-card-copy strong {
  min-width: 0;
  line-height: 1.35;
  max-height: calc(1.35em * 2);
}

.work-center-studio__queue-card-copy span,
.work-center-studio__storage-copy span,
.work-center-studio__inspect-head span,
.work-center-studio__queue-card-meta span {
  color: rgba(205, 214, 238, 0.7);
  font-size: 12px;
}

.work-center-studio__queue-card-meta {
  display: flex;
  justify-content: space-between;
  gap: 10px;
}

.work-center-studio__queue-card-actions {
  display: flex;
  gap: 8px;
}

.work-center-studio__storage-meta span {
  padding: 7px 11px;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.06);
  color: rgba(226, 232, 244, 0.88);
  font-size: 12px;
}

.work-center-studio__inspect-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 8px;
}

.work-center-studio__inspect-cell {
  display: grid;
  gap: 8px;
  min-width: 0;
}

.work-center-studio__inspect-cell span {
  color: rgba(205, 214, 238, 0.7);
  font-size: 12px;
}

.work-center-studio__inspect-panel--empty {
  display: grid;
  place-items: center;
  text-align: center;
  min-height: 120px;
  color: rgba(205, 214, 238, 0.66);
}

.work-center-studio__storage-empty {
  min-height: 84px;
  display: grid;
  place-items: center;
  text-align: center;
}

.work-center-studio__modal-mask {
  position: fixed;
  inset: 0;
  z-index: 35;
  display: grid;
  place-items: center;
  padding: 24px;
  background: rgba(5, 8, 14, 0.58);
  backdrop-filter: blur(8px);
}

.work-center-studio__modal-card {
  width: min(720px, 100%);
  max-height: min(80vh, 720px);
  overflow: auto;
  display: grid;
  gap: 12px;
  padding: 16px;
  border-radius: 18px;
  border: 1px solid rgba(255, 255, 255, 0.08);
  background:
    linear-gradient(180deg, rgba(255, 255, 255, 0.025), rgba(255, 255, 255, 0.01)),
    rgba(9, 13, 23, 0.96);
  box-shadow: 0 20px 50px rgba(0, 0, 0, 0.35);
}

.work-center-studio__modal-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
}

.work-center-studio__inspect-summary {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.work-center-studio__inspect-summary span {
  padding: 4px 8px;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.05);
  font-size: 11px;
  color: rgba(205, 214, 238, 0.75);
}

.work-center-studio__inspect-copy {
  padding: 0;
  border: 0;
  background: transparent;
  text-align: left;
  cursor: pointer;
}

.product-result-empty--compact {
  min-height: 88px;
}

@media (max-width: 1320px) {
  .work-center-studio__entry-grid,
  .work-center-studio__inspect-grid {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 900px) {
  .work-center-studio__submit-bar,
  .work-center-studio__queue-card-head,
  .work-center-studio__storage-copy,
  .work-center-studio__inspect-head,
  .work-center-studio__queue-card-meta,
  .work-center-studio__header-copy {
    flex-direction: column;
    align-items: stretch;
  }

  .work-center-studio__middle-layout--stack,
  .work-center-studio__export-stack {
    grid-template-rows: auto auto;
  }
}
</style>

