<script setup>
import { computed } from 'vue'

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

  const latestRun = projectRunMap.value.get(project.latestRunId) || null
  return { project, latestRun }
})

const currentProjectImagePreview = computed(() => {
  return activeProjectEntry.value?.project?.assets?.sourceImages?.[0]?.preview || ''
})

const currentProjectPackage = computed(() => {
  const project = activeProjectEntry.value?.project || {}
  const latestRun = activeProjectEntry.value?.latestRun || {}
  const generatedImages = Array.isArray(project?.assets?.generatedImages) ? project.assets.generatedImages : []
  const generatedVideo = project?.assets?.generatedVideo || null
  const titleText = String(project?.content?.selectedTitle || latestRun?.outputs?.selectedTitle || latestRun?.outputs?.title || '').trim()
  const descriptionText = String(project?.content?.selectedDescription || latestRun?.outputs?.selectedDescription || latestRun?.outputs?.description || '').trim()

  const completedCount = [titleText, descriptionText, generatedImages.length ? 'image' : '', generatedVideo ? 'video' : '']
    .filter(Boolean)
    .length

  let status = '未完成'
  if (completedCount === 4) status = '已完成'
  else if (completedCount > 0) status = '部分完成'

  return {
    titleText,
    descriptionText,
    generatedImages,
    generatedVideo,
    status,
    updatedAt: project?.updatedAt || project?.createdAt || ''
  }
})

const currentProjectSteps = computed(() => {
  const latestRun = activeProjectEntry.value?.latestRun || {}
  const generatedImages = currentProjectPackage.value.generatedImages
  const generatedVideo = currentProjectPackage.value.generatedVideo
  const baseStatus = String(latestRun?.status || '').trim().toLowerCase()

  return [
    {
      key: 'title',
      label: '标题',
      count: currentProjectPackage.value.titleText ? 1 : 0,
      status: currentProjectPackage.value.titleText ? '已生成' : resolveStepStatus(baseStatus),
      menuKey: 'title-generate'
    },
    {
      key: 'description',
      label: '描述',
      count: currentProjectPackage.value.descriptionText ? 1 : 0,
      status: currentProjectPackage.value.descriptionText ? '已生成' : resolveStepStatus(baseStatus),
      menuKey: 'description-generate'
    },
    {
      key: 'image',
      label: '套图',
      count: generatedImages.length,
      status: generatedImages.length ? '已生成' : resolveStepStatus(baseStatus),
      menuKey: 'series-generate'
    },
    {
      key: 'video',
      label: '视频',
      count: generatedVideo ? 1 : 0,
      status: generatedVideo ? '已生成' : resolveStepStatus(baseStatus),
      menuKey: 'video-generate'
    }
  ]
})

const currentProjectCompletion = computed(() => {
  const steps = currentProjectSteps.value
  if (!steps.length) return 0
  const completed = steps.filter((item) => item.count > 0).length
  return Math.round((completed / steps.length) * 100)
})

const projectStorageRows = computed(() => {
  return sortedProjects.value.map((project) => {
    const latestRun = projectRunMap.value.get(project.latestRunId) || null
    const generatedImages = Array.isArray(project?.assets?.generatedImages) ? project.assets.generatedImages : []
    const generatedVideo = project?.assets?.generatedVideo || null
    const titleText = String(project?.content?.selectedTitle || latestRun?.outputs?.selectedTitle || latestRun?.outputs?.title || '').trim()
    const descriptionText = String(project?.content?.selectedDescription || latestRun?.outputs?.selectedDescription || latestRun?.outputs?.description || '').trim()

    const completedCount = [titleText, descriptionText, generatedImages.length ? 'image' : '', generatedVideo ? 'video' : '']
      .filter(Boolean)
      .length

    let status = '未完成'
    if (completedCount === 4) status = '已完成'
    else if (completedCount > 0) status = '部分完成'

    return {
      id: project.id,
      project,
      latestRun,
      name: resolveProjectName(project),
      updatedAt: project?.updatedAt || project?.createdAt || '',
      status,
      titleCount: titleText ? 1 : 0,
      descriptionCount: descriptionText ? 1 : 0,
      imageCount: generatedImages.length,
      videoCount: generatedVideo ? 1 : 0
    }
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
      isActive: project.id === activeProjectEntry.value?.project?.id
    }
  })
})

const queueSummary = computed(() => {
  let queuedCount = 0
  let runningCount = 0

  queueRows.value.forEach((item) => {
    const status = String(item.status || '').trim()
    if (status === '排队中') queuedCount += 1
    if (status === '生成中') runningCount += 1
  })

  return { queuedCount, runningCount, totalCount: queueRows.value.length }
})

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

function resolveProjectProductName(project = {}) {
  return String(project?.baseInfo?.productName || '').trim()
}

function resolveProjectKeywords(project = {}) {
  return String(project?.baseInfo?.keywordsText || project?.generationConfig?.keywordsText || '').trim()
}

function resolveProjectPrompt(project = {}) {
  return String(
    project?.generationConfig?.titlePrompt ||
    project?.generationConfig?.descriptionPrompt ||
    project?.generationConfig?.imagePrompt ||
    project?.generationConfig?.videoPrompt ||
    ''
  ).trim()
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

function updateProjectPatch(patch = {}) {
  const project = activeProjectEntry.value?.project
  if (!project?.id) return
  emit('update-project', { projectId: project.id, patch })
}

function handleProjectFieldUpdate(field, value) {
  const project = activeProjectEntry.value?.project
  if (!project?.id) return

  if (field === 'name') {
    updateProjectPatch({ name: value })
    return
  }

  if (field === 'platform') {
    updateProjectPatch({ platformTarget: [value] })
    return
  }

  updateProjectPatch({
    baseInfo: {
      ...(project.baseInfo || {}),
      [field]: value
    }
  })
}

function handleOpenStep(menuKey) {
  const project = activeProjectEntry.value?.project
  if (!project || !menuKey) return
  emit('open-generator', { project, menuKey })
}

function handleOpenProjectStorage(project) {
  emit('run-project', project)
}
</script>

<template>
  <section class="generator-studio-page work-center-studio">
    <article class="generator-column generator-column--settings">
      <header class="generator-column__header">
        <strong>项目参数设置</strong>
        <h2>{{ activeProjectEntry?.project ? resolveProjectName(activeProjectEntry.project) : '工作中心' }}</h2>
      </header>

      <div class="generator-form">
        <div class="generator-form__group">
          <div class="generator-form__row">
            <span class="generator-form__label">项目名称</span>
            <input
              :value="activeProjectEntry?.project?.name || ''"
              type="text"
              placeholder="项目名称"
              @input="handleProjectFieldUpdate('name', $event.target.value)"
            >
          </div>
          <div class="generator-form__row">
            <span class="generator-form__label">商品名称</span>
            <input
              :value="resolveProjectProductName(activeProjectEntry?.project)"
              type="text"
              placeholder="商品名称"
              @input="handleProjectFieldUpdate('productName', $event.target.value)"
            >
          </div>
        </div>

        <div class="generator-form__group">
          <div class="generator-form__row">
            <span class="generator-form__label">目标平台</span>
            <input
              :value="resolveProjectPlatform(activeProjectEntry?.project)"
              type="text"
              placeholder="例如 Amazon / Temu"
              @input="handleProjectFieldUpdate('platform', $event.target.value)"
            >
          </div>
          <div class="generator-form__row">
            <span class="generator-form__label">语言</span>
            <input
              :value="resolveProjectLanguage(activeProjectEntry?.project)"
              type="text"
              placeholder="zh-CN"
              @input="handleProjectFieldUpdate('language', $event.target.value)"
            >
          </div>
        </div>

        <div class="generator-form__row">
          <span class="generator-form__label">原图上传</span>
          <div class="generator-form__asset">
            <button class="secondary-action generator-form__asset-button" type="button" @click="emit('replace-project-image', activeProjectEntry?.project)">上传</button>
            <div class="generator-form__asset-preview">
              <img v-if="currentProjectImagePreview" class="generator-preview__image generator-preview__image--inline" :src="currentProjectImagePreview" alt="">
              <div v-else class="generator-form__asset-empty">原图</div>
            </div>
          </div>
        </div>

        <div class="generator-form__row">
          <span class="generator-form__label">关键词</span>
          <textarea
            :value="resolveProjectKeywords(activeProjectEntry?.project)"
            rows="4"
            placeholder="关键词、卖点、风格"
            @input="handleProjectFieldUpdate('keywordsText', $event.target.value)"
          ></textarea>
        </div>

        <div class="generator-form__card">
          <textarea
            :value="resolveProjectPrompt(activeProjectEntry?.project)"
            rows="8"
            placeholder="补充项目要求"
            @input="handleProjectFieldUpdate('notes', $event.target.value)"
          ></textarea>
        </div>

        <div class="generator-form__group work-center-studio__entry-grid">
          <button class="secondary-action" type="button" @click="handleOpenStep('title-generate')">进入标题</button>
          <button class="secondary-action" type="button" @click="handleOpenStep('description-generate')">进入描述</button>
          <button class="secondary-action" type="button" @click="handleOpenStep('series-generate')">进入套图</button>
          <button class="secondary-action" type="button" @click="handleOpenStep('video-generate')">进入视频</button>
        </div>

        <button class="primary-action" type="button" :disabled="!activeProjectEntry?.project" @click="emit('run-project', activeProjectEntry?.project)">开始生成</button>
      </div>
    </article>

    <article class="generator-column generator-column--preview">
      <header class="generator-column__header">
        <strong>项目任务进度</strong>
      </header>

      <div class="generator-progress-layout work-center-studio__middle-layout work-center-studio__middle-layout--stack">
        <section class="latest-task-progress">
          <header class="latest-task-progress__header">
            <div>
              <h3>{{ activeProjectEntry?.project ? resolveProjectName(activeProjectEntry.project) : '暂无项目' }}</h3>
              <div class="latest-task-progress__meta">
                <span class="task-status">{{ activeProjectEntry?.latestRun ? resolveLatestRunStatus(activeProjectEntry.latestRun) : '未开始' }}</span>
                <span class="task-status">{{ currentProjectCompletion }}%</span>
              </div>
            </div>
            <strong>{{ queueSummary.runningCount > 0 ? '处理中' : '空闲' }}</strong>
          </header>

          <div class="task-progress">
            <span class="task-progress__bar" :style="{ width: `${currentProjectCompletion}%` }"></span>
          </div>

          <div class="work-center-studio__step-grid">
            <article v-for="step in currentProjectSteps" :key="step.key" class="task-queue-item">
              <div class="task-queue-item__head">
                <strong>{{ step.label }}</strong>
                <span class="task-status">{{ step.status }}</span>
              </div>
              <div class="task-queue-item__meta">
                <span>{{ step.count }} 条</span>
                <button class="secondary-action" type="button" @click="handleOpenStep(step.menuKey)">查看</button>
              </div>
            </article>
          </div>
        </section>

        <section class="latest-task-progress generator-preview-panel work-center-studio__package-panel">
          <header class="latest-task-progress__header">
            <div>
              <h3>项目结果存储</h3>
              <div class="latest-task-progress__meta">
                <span>{{ projectStorageRows.length }} 个项目</span>
              </div>
            </div>
          </header>

          <div class="generator-preview-stage work-center-studio__package-stage">
            <article
              v-for="item in projectStorageRows"
              :key="item.id"
              class="work-center-studio__storage-item"
              :class="{ 'work-center-studio__storage-item--active': item.id === activeProjectEntry?.project?.id }"
            >
              <div class="work-center-studio__storage-copy">
                <strong>{{ item.name }}</strong>
                <span>{{ resolveTimeLabel(item.updatedAt) }} / {{ item.status }}</span>
              </div>

              <div class="work-center-studio__storage-meta">
                <span>标题 {{ item.titleCount }}</span>
                <span>描述 {{ item.descriptionCount }}</span>
                <span>套图 {{ item.imageCount }}</span>
                <span>视频 {{ item.videoCount }}</span>
              </div>

              <div class="work-center-studio__storage-actions">
                <button class="secondary-action" type="button" @click="handleOpenProjectStorage(item.project)">查看</button>
                <button class="secondary-action" type="button" @click="emit('delete-project', item.id)">删除</button>
                <button class="primary-action" type="button" @click="emit('export-project', item.id)">打包下载</button>
              </div>
            </article>

            <div v-if="!projectStorageRows.length" class="product-result-empty product-result-empty--compact">
              <span>暂无项目结果</span>
            </div>
          </div>
        </section>
      </div>
    </article>

    <article class="generator-column generator-column--export">
      <header class="generator-column__header">
        <strong>项目任务队列</strong>
        <h2>{{ queueSummary.totalCount }} 项</h2>
      </header>

      <div class="generator-export">
        <div class="generator-export__list work-center-studio__queue-list">
          <article
            v-for="item in queueRows"
            :key="item.id"
            class="work-center-studio__queue-card"
            :class="{ 'work-center-studio__queue-card--active': item.isActive }"
          >
            <div class="work-center-studio__queue-card-head">
              <div class="work-center-studio__queue-card-copy">
                <strong>{{ item.name }}</strong>
                <span>{{ item.platform }}</span>
              </div>
              <span class="task-status">{{ item.status }}</span>
            </div>

            <div class="work-center-studio__queue-card-meta">
              <span>当前阶段：{{ item.currentStage }}</span>
              <span>{{ item.progress }}%</span>
            </div>

            <div class="task-progress task-progress--small">
              <span class="task-progress__bar" :style="{ width: `${item.progress}%` }"></span>
            </div>

            <div class="work-center-studio__queue-card-actions">
              <button class="secondary-action" type="button" @click="emit('run-project', item.project)">查看</button>
              <button class="secondary-action" type="button" @click="emit('delete-project', item.id)">取消</button>
            </div>
          </article>

          <div v-if="!queueRows.length" class="product-result-empty product-result-empty--compact">
            <span>当前没有项目任务</span>
          </div>
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

.work-center-studio__entry-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;
}

.work-center-studio__middle-layout {
  flex: 1;
}

.work-center-studio__middle-layout--stack {
  display: flex;
  flex-direction: column;
  gap: 18px;
}

.work-center-studio__step-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
}

.work-center-studio__package-panel {
  min-height: 0;
}

.work-center-studio__package-stage {
  display: flex;
  flex-direction: column;
  gap: 12px;
  min-height: 0;
  overflow: auto;
  padding-right: 4px;
}

.work-center-studio__storage-item,
.work-center-studio__queue-card {
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 16px;
  border-radius: 18px;
  border: 1px solid rgba(255, 255, 255, 0.08);
  background: rgba(9, 13, 23, 0.72);
}

.work-center-studio__storage-item--active,
.work-center-studio__queue-card--active {
  border-color: rgba(100, 186, 255, 0.35);
  box-shadow: 0 0 0 1px rgba(100, 186, 255, 0.16) inset;
}

.work-center-studio__storage-copy,
.work-center-studio__queue-card-copy {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.work-center-studio__storage-copy span,
.work-center-studio__queue-card-copy span,
.work-center-studio__queue-card-meta span {
  color: rgba(205, 214, 238, 0.76);
}

.work-center-studio__storage-meta,
.work-center-studio__queue-card-meta,
.work-center-studio__storage-actions,
.work-center-studio__queue-card-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  align-items: center;
}

.work-center-studio__storage-meta span {
  padding: 8px 12px;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.06);
  color: rgba(226, 232, 244, 0.88);
}

.work-center-studio__queue-list {
  overflow: auto;
  padding-right: 4px;
}

.work-center-studio__queue-card-head {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  align-items: flex-start;
}

.product-result-empty--compact {
  min-height: 120px;
}

@media (max-width: 1320px) {
  .work-center-studio__step-grid,
  .work-center-studio__entry-grid {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 900px) {
  .work-center-studio__queue-card-head,
  .work-center-studio__storage-actions,
  .work-center-studio__queue-card-actions {
    flex-direction: column;
    align-items: stretch;
  }
}
</style>
