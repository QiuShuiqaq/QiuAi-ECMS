<script setup>
import { computed, ref, watch } from 'vue'

const props = defineProps({
  productProjects: { type: Array, default: () => [] },
  projectRuns: { type: Array, default: () => [] },
  activeProjectId: { type: String, default: '' },
  focusProjectId: { type: String, default: '' },
  promptTemplates: { type: Array, default: () => [] },
  submitButtonState: { type: String, default: 'idle' }
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
  'open-generator'
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

const generatorShortcutOptions = [
  { key: 'title-generator', label: '标题' },
  { key: 'description-generator', label: '描述' },
  { key: 'series-generate', label: '套图' },
  { key: 'video-generate', label: '视频' }
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

function getRunImages(project, latestRun) {
  if (Array.isArray(latestRun?.outputs?.images) && latestRun.outputs.images.length) {
    return latestRun.outputs.images
  }
  return Array.isArray(project?.assets?.generatedImages) ? project.assets.generatedImages : []
}

function getRunVideo(project, latestRun) {
  return latestRun?.outputs?.video || project?.assets?.generatedVideo || null
}

function resolveRunTimestamp(run) {
  if (!run?.createdAt) return ''
  return String(run.createdAt).replace('T', ' ').slice(0, 16)
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
                <select :value="item.project.generationConfig?.imageSize || '1:1'" @change="updateProjectGenerationConfig(item.project, { imageSize: $event.target.value, size: $event.target.value })">
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
                <span>视频动态</span>
                <select :value="item.project.generationConfig?.videoMotionStrength || 'auto'" @change="updateProjectGenerationConfig(item.project, { videoMotionStrength: $event.target.value, motionStrength: $event.target.value })">
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
          <span>电商运营 Agent 助手</span>
          <strong>Agent</strong>
        </div>
      </header>

      <div class="workbench-agent-shell">
        <div class="workbench-agent-card"><strong>任务编排</strong><span>预留</span></div>
        <div class="workbench-agent-card"><strong>自动上架</strong><span>预留</span></div>
        <div class="workbench-agent-card"><strong>批量执行</strong><span>预留</span></div>
      </div>
    </section>
  </section>
</template>
