<script setup>
import { computed } from 'vue'
import openFolderIcon from '../../../icon/wenjianjia.png'
import deleteIcon from '../../../icon/shanchu.png'
import {
  imageModelOptions,
  imageSizeOptions,
  imageTemplateDefaultOrder,
  imageTemplateTypeMap,
  videoAspectRatioOptions,
  videoDurationOptions,
  videoModelOptions,
  videoMotionOptions
} from '../utils/generatorFormOptions'

const props = defineProps({
  title: { type: String, required: true },
  draft: { type: Object, required: true },
  resultPayload: { type: Object, required: true },
  exportItems: { type: Array, default: () => [] },
  tasks: { type: Array, default: () => [] },
  agentReadiness: { type: Object, default: () => ({ queue: {}, executionLog: [] }) },
  mode: { type: String, required: true },
  promptTemplates: { type: Array, default: () => [] }
})

const emit = defineEmits([
  'update-draft',
  'submit-task',
  'pick-image',
  'copy-text',
  'open-export-item',
  'delete-export-item',
  'export-results'
])

const promptCategoryAliases = {
  image: '图片',
  video: '视频',
  '图片': '图片',
  '视频': '视频'
}

function normalizePromptCategory(category = '') {
  const normalized = String(category || '').trim()
  return promptCategoryAliases[normalized] || normalized
}

const filteredTemplates = computed(() => {
  const category = props.mode === 'image' ? '图片' : '视频'
  return (props.promptTemplates || []).filter((item) => normalizePromptCategory(item?.category) === category)
})

const sourceImagePreview = computed(() => props.draft.sourceImage?.preview || '')
const seriesGenerationMode = computed(() => (props.draft.seriesGenerationMode === 'single' ? 'single' : 'group'))

const videoResolutionOptions = computed(() => {
  if ((props.draft.duration || '6s') === '10s') {
    return [{ label: '768P', value: '768P' }]
  }

  return [
    { label: '768P', value: '768P' },
    { label: '1080P', value: '1080P' }
  ]
})

function resolveSeriesImageTypeByTemplate(templateId = '', fallbackIndex = 0) {
  if (imageTemplateTypeMap[templateId]) return imageTemplateTypeMap[templateId]
  return imageTemplateTypeMap[imageTemplateDefaultOrder[fallbackIndex]] || '详情图'
}

function updateField(field, value) {
  emit('update-draft', { field, value })
}

function emitSeriesDraftPatch(patch = {}) {
  Object.entries(patch).forEach(([field, value]) => {
    updateField(field, value)
  })
}

function buildPromptAssignments(items = []) {
  return items.map((item, index) => ({
    id: item.id || `series-generate-${index + 1}`,
    index: index + 1,
    prompt: item.prompt || '',
    templateId: item.templateId || imageTemplateDefaultOrder[index] || 'image-detail',
    imageType: item.imageType || resolveSeriesImageTypeByTemplate(item.templateId, index)
  }))
}

function buildSingleModeSeriesItems(sourceImage, count, fallbackItems = []) {
  if (!sourceImage) return []

  const normalizedCount = Math.max(1, Number(count) || 1)
  return Array.from({ length: normalizedCount }, (_unused, index) => {
    const fallback = fallbackItems[index] || {}
    return {
      id: fallback.id || `series-source-${index + 1}`,
      sourceImage,
      templateId: fallback.templateId || imageTemplateDefaultOrder[index] || '',
      prompt: fallback.prompt || '',
      size: fallback.size || props.draft.size || '1:1',
      imageType: fallback.imageType || resolveSeriesImageTypeByTemplate(fallback.templateId, index)
    }
  })
}

const seriesSourceItems = computed(() => {
  if (props.mode !== 'image') return []

  const assignments = Array.isArray(props.draft.promptAssignments) ? props.draft.promptAssignments : []
  const items = Array.isArray(props.draft.seriesSourceItems) ? props.draft.seriesSourceItems : []

  if (seriesGenerationMode.value === 'single') {
    if (!props.draft.sourceImage) return []
    const count = Math.max(1, Number(props.draft.generateCount) || assignments.length || items.length || 1)
    return buildSingleModeSeriesItems(props.draft.sourceImage, count, items.length ? items : assignments)
  }

  if (items.length) return items
  if (!props.draft.sourceImage) return []

  const assignment = assignments[0] || {}
  return [{
    id: 'series-source-1',
    sourceImage: props.draft.sourceImage,
    templateId: assignment.templateId || props.draft.imageTemplateId || '',
    prompt: assignment.prompt || props.draft.prompt || '',
    size: props.draft.size || '1:1',
    imageType: assignment.imageType || props.draft.imageType || ''
  }]
})

const normalizedTasks = computed(() => {
  return (props.tasks || [])
    .filter((task) => task && typeof task === 'object')
    .map((task) => ({
      id: task.id || '',
      taskNumber: task.taskNumber || task.id || '',
      title: task.title || task.taskName || '未命名任务',
      menuKey: task.menuKey || props.mode,
      status: task.status || '等待中',
      progress: Number(task.progress || 0),
      outputDirectory: task.outputDirectory || '',
      error: task.error || '',
      inputCount: Number(task.inputCount || 0),
      plannedOutputCount: Number(task.plannedOutputCount || 0),
      modelSummary: task.modelSummary || '',
      batchCount: Number(task.batchCount || 1)
    }))
})

const activeTask = computed(() => {
  return normalizedTasks.value.find((task) => ['等待中', '进行中', '处理中', 'pending', 'running', 'submitting'].includes(task.status)) || normalizedTasks.value[0] || null
})

const queueTasks = computed(() => normalizedTasks.value.filter((task) => task.id !== activeTask.value?.id).slice(0, 12))

const queueSummary = computed(() => {
  const queue = props.agentReadiness?.queue || {}
  return {
    queuedCount: Number(queue.queuedCount || 0),
    runningCount: Number(queue.runningCount || 0),
    isProcessing: Boolean(queue.isProcessing)
  }
})

const seriesResultGroups = computed(() => {
  if (props.mode !== 'image') return []
  return (props.resultPayload.groupedResults || []).map((group, groupIndex) => ({
    id: group.id || `series-group-${groupIndex + 1}`,
    title: group.groupTitle || `第 ${groupIndex + 1} 组`,
    status: group.status || 'waiting',
    completedCount: Number(group.completedCount || 0),
    failedCount: Number(group.failedCount || 0),
    outputs: Array.isArray(group.outputs) ? group.outputs : []
  }))
})

const videoResultItems = computed(() => {
  if (props.mode !== 'video') return []

  return (props.resultPayload.groupedResults || [])
    .flatMap((group) => group.outputs || [])
    .filter((item) => Boolean(String(item.savedPath || item.path || item.preview || '').trim()))
    .map((item, index) => ({
      id: item.id || `video-result-${index + 1}`,
      title: item.title || `视频结果 ${index + 1}`,
      path: item.savedPath || item.path || item.preview || ''
    }))
})

const resultOutputCards = computed(() => {
  return (props.exportItems || []).map((item, index) => ({
    id: item.id || `export-item-${index + 1}`,
    name: item.name || item.groupTitle || `结果 ${index + 1}`,
    status: item.status || '已存储',
    itemCount: Number(item.itemCount || 0),
    raw: item
  }))
})

const hasAnyResults = computed(() => {
  return Boolean(
    seriesResultGroups.value.length ||
    videoResultItems.value.length ||
    resultOutputCards.value.length ||
    props.resultPayload.summary?.description
  )
})

const summaryDescription = computed(() => props.resultPayload.summary?.description || '')

function handleVideoDurationChange(value) {
  updateField('duration', value)
  if (value === '10s' && (props.draft.resolution || '768P') === '1080P') {
    updateField('resolution', '768P')
  }
}

function handleVideoTemplateChange(templateId) {
  const template = filteredTemplates.value.find((item) => item.id === templateId)
  updateField('videoTemplateId', templateId)
  updateField('prompt', template?.prompt || '')
}

function updateSeriesItem(index, patch = {}) {
  const nextItems = seriesSourceItems.value.map((item, itemIndex) => {
    if (itemIndex !== index) return item
    return { ...item, ...patch }
  })

  emitSeriesDraftPatch({
    seriesSourceItems: nextItems,
    sourceImage: nextItems[0]?.sourceImage || null,
    generateCount: Math.max(1, nextItems.length),
    promptAssignments: buildPromptAssignments(nextItems)
  })
}

function handleSeriesTemplateChange(index, templateId) {
  const template = filteredTemplates.value.find((item) => item.id === templateId)
  updateSeriesItem(index, {
    templateId,
    prompt: template?.prompt || '',
    imageType: resolveSeriesImageTypeByTemplate(templateId, index)
  })
}

function handleSeriesModePick(nextMode) {
  const normalizedMode = nextMode === 'single' ? 'single' : 'group'
  const currentItems = seriesSourceItems.value
  const baseSourceImage = props.draft.sourceImage || currentItems[0]?.sourceImage || null

  if (normalizedMode === 'single') {
    const nextCount = Math.max(1, Number(props.draft.generateCount) || currentItems.length || 4)
    const nextItems = buildSingleModeSeriesItems(baseSourceImage, nextCount, currentItems)
    emitSeriesDraftPatch({
      seriesGenerationMode: 'single',
      sourceImage: baseSourceImage,
      generateCount: nextCount,
      seriesSourceItems: nextItems,
      promptAssignments: buildPromptAssignments(nextItems)
    })
    return
  }

  emitSeriesDraftPatch({
    seriesGenerationMode: 'group',
    sourceImage: baseSourceImage,
    generateCount: Math.max(1, currentItems.length || Number(props.draft.generateCount) || 1),
    seriesSourceItems: currentItems,
    promptAssignments: buildPromptAssignments(currentItems)
  })
}

function handleSingleGenerateCountChange(value) {
  const nextCount = Math.max(1, Number(value) || 1)
  const nextItems = buildSingleModeSeriesItems(props.draft.sourceImage, nextCount, seriesSourceItems.value)
  emitSeriesDraftPatch({
    generateCount: nextCount,
    seriesSourceItems: nextItems,
    promptAssignments: buildPromptAssignments(nextItems)
  })
}

function handleExportAll() {
  emit('export-results', {
    selectedExportIds: resultOutputCards.value.map((item) => item.id)
  })
}

function getStatusClass(status = '') {
  if (['进行中', '处理中', 'running', 'submitting'].includes(status)) return 'task-status--running'
  if (['已完成', 'succeeded', 'success'].includes(status)) return 'task-status--completed'
  if (['失败', 'failed'].includes(status)) return 'task-status--failed'
  return 'task-status--waiting'
}

function formatTaskLabel(task) {
  const parts = []
  if (task?.taskNumber) parts.push(task.taskNumber)
  if (task?.title) parts.push(task.title)
  return parts.join(' / ') || '当前任务'
}
</script>

<template>
  <section class="generator-studio-page media-studio-page">
    <article class="generator-column generator-column--settings">
      <header class="generator-column__header">
        <strong>参数设置</strong>
        <h2>{{ title }}</h2>
      </header>

      <div class="generator-form">
        <div class="generator-form__group">
          <div class="generator-form__row">
            <span class="generator-form__label">任务名称</span>
            <input :value="draft.taskName || ''" type="text" placeholder="任务名称" @input="updateField('taskName', $event.target.value)">
          </div>
          <div class="generator-form__row">
            <span class="generator-form__label">商品名称</span>
            <input :value="draft.productName || ''" type="text" placeholder="商品名称" @input="updateField('productName', $event.target.value)">
          </div>
        </div>

        <div v-if="mode === 'video'" class="generator-form__row">
          <span class="generator-form__label">上传样图</span>
          <div class="generator-form__asset">
            <button class="secondary-action generator-form__asset-button" type="button" @click="emit('pick-image')">上传</button>
            <div class="generator-form__asset-preview">
              <img v-if="sourceImagePreview" class="generator-preview__image generator-preview__image--inline" :src="sourceImagePreview" alt="">
              <div v-else class="generator-form__asset-empty">暂无样图</div>
            </div>
          </div>
        </div>

        <div v-else class="generator-form__row generator-form__row--series-mode">
          <span class="generator-form__label">上传样图</span>
          <div class="generator-form__series-mode-actions">
            <button
              class="secondary-action generator-form__asset-button"
              :class="{ 'generator-form__mode-button--active': seriesGenerationMode === 'single' }"
              type="button"
              @click="handleSeriesModePick('single'); emit('pick-image', { generationMode: 'single' })"
            >
              单图生成
            </button>
            <button
              class="secondary-action generator-form__asset-button"
              :class="{ 'generator-form__mode-button--active': seriesGenerationMode === 'group' }"
              type="button"
              @click="handleSeriesModePick('group'); emit('pick-image', { generationMode: 'group' })"
            >
              组图生成
            </button>
          </div>
        </div>

        <div class="generator-form__group">
          <div class="generator-form__row">
            <span class="generator-form__label">模型</span>
            <select :value="draft.model || (mode === 'video' ? 'MiniMax-Hailuo-2.3-Fast' : 'gpt-image-2')" @change="updateField('model', $event.target.value)">
              <option v-for="option in mode === 'video' ? videoModelOptions : imageModelOptions" :key="option.value" :value="option.value">{{ option.label }}</option>
            </select>
          </div>

          <div v-if="mode === 'image'" class="generator-form__row">
            <span class="generator-form__label">批次</span>
            <input :value="draft.batchCount || 1" type="number" min="1" @input="updateField('batchCount', $event.target.value)">
          </div>

          <div v-if="mode === 'image'" class="generator-form__row">
            <span class="generator-form__label">数量</span>
            <input
              :value="seriesGenerationMode === 'single' ? (draft.generateCount || seriesSourceItems.length || 1) : seriesSourceItems.length"
              type="number"
              min="1"
              :disabled="seriesGenerationMode === 'group'"
              @input="seriesGenerationMode === 'single' && handleSingleGenerateCountChange($event.target.value)"
            >
          </div>

          <div v-if="mode === 'video'" class="generator-form__row">
            <span class="generator-form__label">批次</span>
            <input :value="draft.videoQuantity || 1" type="number" min="1" @input="updateField('videoQuantity', $event.target.value)">
          </div>
        </div>

        <div v-if="mode === 'image'" class="generator-form__series">
          <article v-for="(item, index) in seriesSourceItems" :key="item.id || index" class="generator-form__series-card media-source-card">
            <div class="generator-form__series-head">
              <strong>第 {{ index + 1 }} 张</strong>
            </div>

            <div class="media-source-card__preview">
              <div class="media-source-card__thumb">
                <img v-if="item.sourceImage?.preview" :src="item.sourceImage.preview" alt="">
                <span v-else>样图</span>
              </div>
              <strong>{{ item.sourceImage?.name || '未命名图片' }}</strong>
            </div>

            <div class="generator-form__group">
              <div class="generator-form__row">
                <span class="generator-form__label">提示词模板</span>
                <select :value="item.templateId || ''" @change="handleSeriesTemplateChange(index, $event.target.value)">
                  <option value="">选择模板</option>
                  <option v-for="template in filteredTemplates" :key="template.id" :value="template.id">{{ template.name }}</option>
                </select>
              </div>

              <div class="generator-form__row">
                <span class="generator-form__label">尺寸</span>
                <select :value="item.size || '1:1'" @change="updateSeriesItem(index, { size: $event.target.value })">
                  <option v-for="option in imageSizeOptions" :key="option.value" :value="option.value">{{ option.label }}</option>
                </select>
              </div>
            </div>

            <div class="generator-form__card generator-form__card--full">
              <textarea :value="item.prompt || ''" rows="5" placeholder="提示词" @input="updateSeriesItem(index, { prompt: $event.target.value })"></textarea>
            </div>
          </article>

          <div v-if="!seriesSourceItems.length" class="product-result-empty media-empty">
            <span>{{ seriesGenerationMode === 'single' ? '请先上传一张参考图' : '请先上传一组参考图' }}</span>
          </div>
        </div>

        <div v-if="mode === 'video'" class="generator-form__group">
          <div class="generator-form__row">
            <span class="generator-form__label">时长</span>
            <select :value="draft.duration || '6s'" @change="handleVideoDurationChange($event.target.value)">
              <option v-for="option in videoDurationOptions" :key="option.value" :value="option.value">{{ option.label }}</option>
            </select>
          </div>
          <div class="generator-form__row">
            <span class="generator-form__label">画面比例</span>
            <select :value="draft.aspectRatio || '16:9'" @change="updateField('aspectRatio', $event.target.value)">
              <option v-for="option in videoAspectRatioOptions" :key="option.value" :value="option.value">{{ option.label }}</option>
            </select>
          </div>
          <div class="generator-form__row">
            <span class="generator-form__label">清晰度</span>
            <select :value="draft.resolution || '768P'" @change="updateField('resolution', $event.target.value)">
              <option v-for="option in videoResolutionOptions" :key="option.value" :value="option.value">{{ option.label }}</option>
            </select>
          </div>
          <div class="generator-form__row">
            <span class="generator-form__label">运镜强度</span>
            <select :value="draft.motionStrength || 'auto'" @change="updateField('motionStrength', $event.target.value)">
              <option v-for="option in videoMotionOptions" :key="option.value" :value="option.value">{{ option.label }}</option>
            </select>
          </div>
          <div class="generator-form__row">
            <span class="generator-form__label">模板</span>
            <select :value="draft.videoTemplateId || ''" @change="handleVideoTemplateChange($event.target.value)">
              <option value="">选择模板</option>
              <option v-for="template in filteredTemplates" :key="template.id" :value="template.id">{{ template.name }}</option>
            </select>
          </div>
          <div class="generator-form__card generator-form__card--full">
            <textarea :value="draft.prompt || ''" rows="10" placeholder="视频提示词" @input="updateField('prompt', $event.target.value)"></textarea>
          </div>
        </div>

        <button class="primary-action" type="button" @click="emit('submit-task')">生成</button>
      </div>
    </article>

    <article class="generator-column generator-column--preview">
      <header class="generator-column__header">
        <strong>任务进度</strong>
      </header>

      <div class="generator-progress-layout">
        <div class="generator-progress-pane">
          <section class="latest-task-progress">
            <header class="latest-task-progress__header">
              <div>
                <h3>{{ activeTask ? formatTaskLabel(activeTask) : '暂无任务' }}</h3>
                <div class="latest-task-progress__meta">
                  <span class="task-status" :class="getStatusClass(activeTask?.status)">{{ activeTask?.status || '等待中' }}</span>
                  <span class="task-status">{{ activeTask?.progress || 0 }}%</span>
                </div>
              </div>
              <strong>{{ queueSummary.isProcessing ? '处理中' : '空闲' }}</strong>
            </header>

            <div class="latest-task-progress__meta">
              <div class="latest-task-progress__item">
                <span>任务名称</span>
                <strong>{{ activeTask?.title || '未命名任务' }}</strong>
              </div>
              <div class="latest-task-progress__item">
                <span>模型</span>
                <strong>{{ activeTask?.modelSummary || '待生成' }}</strong>
              </div>
              <div class="latest-task-progress__item">
                <span>输入</span>
                <strong>{{ activeTask?.inputCount || 0 }}</strong>
              </div>
              <div class="latest-task-progress__item">
                <span>输出</span>
                <strong>{{ activeTask?.plannedOutputCount || 0 }}</strong>
              </div>
              <div class="latest-task-progress__item">
                <span>错误</span>
                <strong>{{ activeTask?.error || '无' }}</strong>
              </div>
              <div class="latest-task-progress__item">
                <span>批次</span>
                <strong>{{ activeTask?.batchCount || 1 }}</strong>
              </div>
            </div>

            <div class="task-progress">
              <span class="task-progress__bar" :style="{ width: `${activeTask?.progress || 0}%` }"></span>
            </div>
          </section>

          <section class="latest-task-progress">
            <header class="latest-task-progress__header">
              <div>
                <h3>任务队列</h3>
                <div class="latest-task-progress__meta">
                  <span class="task-status task-status--waiting">排队 {{ queueSummary.queuedCount }}</span>
                  <span class="task-status task-status--running">运行 {{ queueSummary.runningCount }}</span>
                </div>
              </div>
            </header>

            <div class="task-queue-list">
              <article v-for="task in queueTasks" :key="task.id" class="task-queue-item">
                <div class="task-queue-item__head">
                  <strong>{{ formatTaskLabel(task) }}</strong>
                  <span class="task-status" :class="getStatusClass(task.status)">{{ task.status || '等待中' }}</span>
                </div>
                <div class="task-queue-item__meta">
                  <span>{{ task.menuKey }}</span>
                  <span>{{ task.progress || 0 }}%</span>
                </div>
                <div class="task-progress task-progress--small">
                  <span class="task-progress__bar" :style="{ width: `${task.progress || 0}%` }"></span>
                </div>
              </article>

              <div v-if="!queueTasks.length" class="task-queue-empty">暂无队列</div>
            </div>
          </section>
        </div>

        <section class="latest-task-progress generator-preview-panel">
          <header class="latest-task-progress__header">
            <div>
              <h3>效果展示</h3>
            </div>
          </header>

          <div class="generator-preview-stage">
            <div v-if="summaryDescription" class="generator-preview__text">{{ summaryDescription }}</div>

            <template v-if="mode === 'image'">
              <article v-for="group in seriesResultGroups" :key="group.id" class="generator-preview__series-group">
                <div class="generator-preview__series-head">
                  <div class="generator-preview__series-copy">
                    <strong>{{ group.title }}</strong>
                    <span>{{ group.completedCount }} / {{ group.outputs.length }}{{ group.failedCount ? `，失败 ${group.failedCount}` : '' }}</span>
                  </div>
                  <span class="task-status" :class="getStatusClass(group.status)">{{ group.status }}</span>
                </div>

                <div class="generator-preview__series-grid">
                  <article v-for="item in group.outputs" :key="item.id" class="generator-preview__series-card">
                    <img class="generator-preview__image generator-preview__image--series" :src="item.preview || item.savedPath || item.path" alt="">
                  </article>
                </div>
              </article>
            </template>

            <template v-else>
              <article v-for="item in videoResultItems" :key="item.id" class="generator-preview__video-card">
                <strong>{{ item.title }}</strong>
                <video class="generator-preview__video" :src="item.path" controls preload="metadata"></video>
              </article>
            </template>

            <div v-if="!hasAnyResults" class="product-result-empty">
              <span>暂无结果</span>
            </div>
          </div>
        </section>
      </div>
    </article>

    <article class="generator-column generator-column--export">
      <header class="generator-column__header">
        <strong>结果导出</strong>
        <h2>{{ resultOutputCards.length }} 组</h2>
      </header>

      <div class="generator-export">
        <div v-if="resultOutputCards.length" class="generator-export__list">
          <article v-for="item in resultOutputCards" :key="item.id" class="generator-export__item">
            <div class="generator-export__copy">
              <strong>{{ item.name }}</strong>
              <span>{{ item.status }}{{ item.itemCount ? ` / ${item.itemCount}` : '' }}</span>
            </div>
            <div class="generator-export__item-actions">
              <button class="icon-action-button" type="button" title="打开" aria-label="打开" @click="emit('open-export-item', item.raw)">
                <img :src="openFolderIcon" alt="" aria-hidden="true">
              </button>
              <button class="icon-action-button icon-action-button--danger" type="button" title="删除" aria-label="删除" @click="emit('delete-export-item', item.raw)">
                <img :src="deleteIcon" alt="" aria-hidden="true">
              </button>
            </div>
          </article>
        </div>

        <div v-else class="product-result-empty product-result-empty--compact">
          <span>暂无导出结果</span>
        </div>

        <div class="generator-export__actions">
          <button class="primary-action" type="button" @click="handleExportAll">打包导出</button>
        </div>
      </div>
    </article>
  </section>
</template>

<style scoped>
.media-studio-page {
  height: 100%;
  min-height: 0;
}

.generator-form__series-mode-actions {
  display: flex;
  gap: 10px;
  width: 100%;
}

.generator-form__mode-button--active {
  background: rgba(107, 114, 255, 0.16);
  border-color: rgba(107, 114, 255, 0.32);
}

.media-source-card {
  display: grid;
  gap: 12px;
}

.media-source-card__preview {
  align-items: center;
  display: grid;
  gap: 10px;
  grid-template-columns: 72px minmax(0, 1fr);
}

.media-source-card__preview strong {
  color: #f7f2ff;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.media-source-card__thumb {
  align-items: center;
  background: rgba(255, 255, 255, 0.035);
  border: 1px dashed rgba(255, 255, 255, 0.12);
  border-radius: 14px;
  display: flex;
  height: 72px;
  justify-content: center;
  overflow: hidden;
  width: 72px;
}

.media-source-card__thumb img {
  height: 100%;
  object-fit: cover;
  width: 100%;
}

.media-source-card__thumb span {
  color: #8f8aa3;
  font-size: 12px;
}

.media-empty {
  min-height: 96px;
}

.product-result-empty--compact {
  min-height: 120px;
}

.generator-export__item-actions {
  align-items: center;
  display: inline-flex;
  gap: 10px;
}

.icon-action-button {
  align-items: center;
  background: rgba(255, 255, 255, 0.035);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 12px;
  cursor: pointer;
  display: inline-flex;
  height: 38px;
  justify-content: center;
  padding: 0;
  transition: border-color 0.2s ease, background 0.2s ease, transform 0.2s ease;
  width: 38px;
}

.icon-action-button:hover {
  background: rgba(107, 114, 255, 0.16);
  border-color: rgba(107, 114, 255, 0.32);
  transform: translateY(-1px);
}

.icon-action-button img {
  height: 18px;
  object-fit: contain;
  width: 18px;
}

.icon-action-button--danger:hover {
  background: rgba(255, 107, 107, 0.16);
  border-color: rgba(255, 107, 107, 0.32);
}
</style>
