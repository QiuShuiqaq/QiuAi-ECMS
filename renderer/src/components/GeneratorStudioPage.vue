<script setup>
import { computed } from 'vue'

const props = defineProps({
  title: { type: String, required: true },
  draft: { type: Object, required: true },
  resultPayload: { type: Object, required: true },
  exportItems: { type: Array, default: () => [] },
  tasks: { type: Array, default: () => [] },
  agentReadiness: { type: Object, default: () => ({ queue: {}, executionLog: [] }) },
  mode: { type: String, required: true },
  promptTemplates: { type: Array, default: () => [] },
  remoteServiceCapacity: { type: Object, default: null }
})

const emit = defineEmits([
  'update-draft',
  'submit-task',
  'pick-image',
  'copy-text',
  'open-export-item',
  'export-results'
])

const imageSizeOptions = [
  { label: '1:1', value: '1:1' },
  { label: '4:5', value: '4:5' },
  { label: '3:4', value: '3:4' },
  { label: '4:3', value: '4:3' },
  { label: '16:9', value: '16:9' },
  { label: '9:16', value: '9:16' }
]

const imageModelOptions = [
  { label: 'gpt-image-2', value: 'gpt-image-2' },
  { label: 'nano-banana-fast', value: 'nano-banana-fast' },
  { label: 'nano-banana-2', value: 'nano-banana-2' }
]

const videoModelOptions = [
  { label: 'MiniMax-Hailuo-2.3-Fast', value: 'MiniMax-Hailuo-2.3-Fast' }
]

const templateTypeMap = {
  'image-main': '商品主图',
  'image-white-bg': '白底图',
  'image-detail': '详情图',
  'image-closeup': '细节图',
  'image-size': '尺寸图',
  'image-color': '颜色图',
  'image-scene': '场景图',
  'image-model': '模特图',
  'image-angle': '换角度',
  'image-change-scene': '换场景',
  'image-change-model': '换模特',
  'image-replace-all': '全替换'
}

const imageTemplateDefaultOrder = [
  'image-main',
  'image-white-bg',
  'image-detail',
  'image-closeup',
  'image-size',
  'image-color',
  'image-scene',
  'image-model',
  'image-angle',
  'image-change-scene',
  'image-change-model',
  'image-replace-all'
]

const videoAspectRatioOptions = [
  { label: '16:9', value: '16:9' },
  { label: '9:16', value: '9:16' },
  { label: '1:1', value: '1:1' },
  { label: '4:5', value: '4:5' },
  { label: '3:4', value: '3:4' }
]

const videoDurationOptions = [
  { label: '6s', value: '6s' },
  { label: '10s', value: '10s' }
]

const videoMotionOptions = [
  { label: '自动', value: 'auto' },
  { label: '稳定', value: 'stable' },
  { label: '柔和', value: 'soft' }
]

const filteredTemplates = computed(() => {
  const category = props.mode === 'image' ? '图片' : '视频'
  return (props.promptTemplates || []).filter((item) => item.category === category)
})

const modelOptions = computed(() => {
  return props.mode === 'video' ? videoModelOptions : imageModelOptions
})

const currentModelValue = computed(() => props.draft.model || modelOptions.value[0]?.value || '')
const currentVideoTemplateValue = computed(() => props.draft.videoTemplateId || '')
const currentVideoPromptValue = computed(() => props.draft.prompt || '')
const sourceImagePreview = computed(() => props.draft.sourceImage?.preview || '')

const videoResolutionOptions = computed(() => {
  if ((props.draft.duration || '6s') === '10s') {
    return [{ label: '768P', value: '768P' }]
  }

  return [
    { label: '768P', value: '768P' },
    { label: '1080P', value: '1080P' }
  ]
})

const seriesPromptAssignments = computed(() => {
  if (props.mode !== 'image') {
    return []
  }

  return Array.isArray(props.draft.promptAssignments) ? props.draft.promptAssignments : []
})

const seriesResultGroups = computed(() => {
  if (props.mode !== 'image') {
    return []
  }

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
  if (props.mode !== 'video') {
    return []
  }

  return (props.resultPayload.groupedResults || [])
    .flatMap((group) => group.outputs || [])
    .filter((item) => {
      const savedPath = String(item.savedPath || item.path || item.preview || '').trim()
      return Boolean(savedPath) && /\.mp4$/i.test(savedPath)
    })
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
    status: item.status || '已保存',
    itemCount: Number(item.itemCount || 0),
    directoryPath: item.directoryPath || '',
    outputDirectory: item.outputDirectory || '',
    savedPath: item.savedPath || ''
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

const remoteServiceHint = computed(() => {
  const profile = props.remoteServiceCapacity && typeof props.remoteServiceCapacity === 'object'
    ? props.remoteServiceCapacity
    : null

  if (!profile) {
    return null
  }

  return {
    serviceTier: profile.serviceTier || 'SHARED',
    imageConcurrency: Math.max(1, Number(profile.effectiveImageConcurrency) || 1),
    videoConcurrency: Math.max(0, Number(profile.effectiveVideoConcurrency) || 0),
    textConcurrency: Math.max(1, Number(profile.effectiveTextConcurrency) || 1),
    textPriorityClass: profile.textPriorityClass || 'STANDARD'
  }
})

const summaryDescription = computed(() => props.resultPayload.summary?.description || '')

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
  return normalizedTasks.value.find((task) => ['等待中', '进行中', '处理中', 'pending', 'running', 'submitting'].includes(task.status)) ||
    normalizedTasks.value[0] ||
    null
})

const queueTasks = computed(() => {
  return normalizedTasks.value.filter((task) => task.id !== activeTask.value?.id).slice(0, 12)
})

const queueSummary = computed(() => {
  const queue = props.agentReadiness?.queue || {}
  return {
    queuedCount: Number(queue.queuedCount || 0),
    runningCount: Number(queue.runningCount || 0),
    isProcessing: Boolean(queue.isProcessing)
  }
})

function updateField(field, value) {
  emit('update-draft', { field, value })
}

function handleModelChange(event) {
  updateField('model', event.target.value)
}

function handleVideoTemplateChange(event) {
  const templateId = event.target.value
  const template = filteredTemplates.value.find((item) => item.id === templateId)
  updateField('videoTemplateId', templateId)
  updateField('prompt', template?.prompt || '')
}

function handleVideoDurationChange(value) {
  updateField('duration', value)
  if (value === '10s' && (props.draft.resolution || '768P') === '1080P') {
    updateField('resolution', '768P')
  }
}

function resolveSeriesImageTypeByTemplate(templateId = '', fallbackIndex = 0) {
  if (imageTemplateTypeMap[templateId]) {
    return imageTemplateTypeMap[templateId]
  }

  return templateTypeMap[imageTemplateDefaultOrder[fallbackIndex]] || '详情图'
}

function resolveSeriesTemplateId(templateId = '', index = 0) {
  if (templateId) {
    return templateId
  }

  return imageTemplateDefaultOrder[index] || 'image-detail'
}

function handleSeriesGenerateCountInput(value) {
  const nextCount = Math.max(1, Number(value) || 1)
  const currentAssignments = Array.isArray(props.draft.promptAssignments) ? props.draft.promptAssignments : []
  const nextAssignments = Array.from({ length: nextCount }, (_unused, index) => {
    const currentAssignment = currentAssignments[index] || {}
    const nextTemplateId = resolveSeriesTemplateId(currentAssignment.templateId, index)
    return {
      id: currentAssignment.id || `series-generate-${index + 1}`,
      index: index + 1,
      prompt: currentAssignment.prompt || '',
      templateId: nextTemplateId,
      imageType: currentAssignment.imageType || resolveSeriesImageTypeByTemplate(nextTemplateId, index),
      differenceLevel: currentAssignment.differenceLevel || 'off'
    }
  })

  updateField('generateCount', nextCount)
  updateField('promptAssignments', nextAssignments)
}

function updateSeriesAssignment(index, patch = {}) {
  const nextAssignments = seriesPromptAssignments.value.map((item, itemIndex) => {
    if (itemIndex !== index) {
      return item
    }

    return {
      ...item,
      ...patch
    }
  })

  updateField('promptAssignments', nextAssignments)
}

function handleSeriesAssignmentTemplateChange(index, templateId) {
  const template = filteredTemplates.value.find((item) => item.id === templateId)
  updateSeriesAssignment(index, {
    templateId,
    imageType: resolveSeriesImageTypeByTemplate(templateId, index),
    prompt: template?.prompt || ''
  })
}

function handleSeriesDifferenceToggle(index, checked) {
  updateSeriesAssignment(index, {
    differenceLevel: checked ? 'medium' : 'off'
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
  if (task.taskNumber) parts.push(task.taskNumber)
  if (task.title) parts.push(task.title)
  return parts.join(' / ') || '当前任务'
}
</script>

<template>
  <section class="generator-studio-page">
    <article class="generator-column generator-column--settings">
      <header class="generator-column__header">
        <strong>参数设置</strong>
        <h2>{{ title }}</h2>
      </header>

      <div class="generator-form">
        <div v-if="remoteServiceHint" class="generator-form__card generator-form__card--service">
          <strong>远程服务档位 {{ remoteServiceHint.serviceTier }}</strong>
          <span>图片并发 {{ remoteServiceHint.imageConcurrency }} / 文本并发 {{ remoteServiceHint.textConcurrency }} / 视频并发 {{ remoteServiceHint.videoConcurrency }}</span>
          <span>文本优先级 {{ remoteServiceHint.textPriorityClass }}</span>
        </div>

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

        <div class="generator-form__row">
          <span class="generator-form__label">上传样图</span>
          <div class="generator-form__asset">
            <button class="secondary-action generator-form__asset-button" type="button" @click="emit('pick-image')">上传</button>
            <div class="generator-form__asset-preview">
              <img v-if="sourceImagePreview" class="generator-preview__image generator-preview__image--inline" :src="sourceImagePreview" alt="">
              <div v-else class="generator-form__asset-empty">样图</div>
            </div>
          </div>
        </div>

        <div class="generator-form__row">
          <span class="generator-form__label">模型</span>
          <select :value="currentModelValue" @change="handleModelChange">
            <option v-for="option in modelOptions" :key="option.value" :value="option.value">{{ option.label }}</option>
          </select>
        </div>

        <div v-if="mode === 'image'" class="generator-form__group">
          <div class="generator-form__row">
            <span class="generator-form__label">数量</span>
            <input :value="draft.generateCount || 4" type="number" min="1" max="500" placeholder="数量" @input="handleSeriesGenerateCountInput($event.target.value)">
          </div>
          <div class="generator-form__row">
            <span class="generator-form__label">批次</span>
            <input :value="draft.batchCount || 1" type="number" min="1" placeholder="批次" @input="updateField('batchCount', $event.target.value)">
          </div>
          <div class="generator-form__row">
            <span class="generator-form__label">尺寸</span>
            <select :value="draft.size || '1:1'" @change="updateField('size', $event.target.value)">
              <option v-for="option in imageSizeOptions" :key="option.value" :value="option.value">{{ option.label }}</option>
            </select>
          </div>
        </div>

        <div v-if="mode === 'video'" class="generator-form__group">
          <div class="generator-form__row">
            <span class="generator-form__label">批次</span>
            <input :value="draft.videoQuantity || 1" type="number" min="1" placeholder="批次" @input="updateField('videoQuantity', $event.target.value)">
          </div>
          <div class="generator-form__row">
            <span class="generator-form__label">时长</span>
            <select :value="draft.duration || '6s'" @change="handleVideoDurationChange($event.target.value)">
              <option v-for="option in videoDurationOptions" :key="option.value" :value="option.value">{{ option.label }}</option>
            </select>
          </div>
          <div class="generator-form__row">
            <span class="generator-form__label">比例</span>
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
            <select :value="currentVideoTemplateValue" @change="handleVideoTemplateChange">
              <option value="">选择模板</option>
              <option v-for="template in filteredTemplates" :key="template.id" :value="template.id">{{ template.name }}</option>
            </select>
          </div>
          <div class="generator-form__card">
            <textarea :value="currentVideoPromptValue" rows="10" placeholder="视频提示词" @input="updateField('prompt', $event.target.value)"></textarea>
          </div>
        </div>

        <div v-if="mode === 'image'" class="generator-form__series">
          <article v-for="(assignment, index) in seriesPromptAssignments" :key="assignment.id || index" class="generator-form__series-card">
            <div class="generator-form__series-head">
              <strong>第 {{ index + 1 }} 张</strong>
              <label class="generator-form__series-toggle">
                <input
                  :checked="(assignment.differenceLevel || 'off') !== 'off'"
                  type="checkbox"
                  @change="handleSeriesDifferenceToggle(index, $event.target.checked)"
                >
                <span>差异化</span>
              </label>
            </div>

            <div class="generator-form__row">
              <span class="generator-form__label">模板</span>
              <select :value="assignment.templateId || ''" @change="handleSeriesAssignmentTemplateChange(index, $event.target.value)">
                <option value="">选择模板</option>
                <option v-for="template in filteredTemplates" :key="template.id" :value="template.id">{{ template.name }}</option>
              </select>
            </div>

            <div class="generator-form__card">
              <textarea :value="assignment.prompt || ''" rows="5" placeholder="提示词" @input="updateSeriesAssignment(index, { prompt: $event.target.value })"></textarea>
            </div>
          </article>
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
              <article
                v-for="group in seriesResultGroups"
                :key="group.id"
                class="generator-preview__series-group"
              >
                <div class="generator-preview__series-head">
                  <div class="generator-preview__series-copy">
                    <strong>{{ group.title }}</strong>
                    <span>{{ group.completedCount }} / {{ group.outputs.length }}{{ group.failedCount ? `，失败 ${group.failedCount}` : '' }}</span>
                  </div>
                  <span class="task-status" :class="getStatusClass(group.status)">{{ group.status }}</span>
                </div>

                <div class="generator-preview__series-grid">
                  <article
                    v-for="item in group.outputs"
                    :key="item.id"
                    class="generator-preview__series-card"
                  >
                    <img
                      class="generator-preview__image generator-preview__image--series"
                      :src="item.preview || item.savedPath || item.path"
                      alt=""
                    >
                  </article>
                </div>
              </article>
            </template>

            <template v-else>
              <article
                v-for="item in videoResultItems"
                :key="item.id"
                class="generator-preview__video-card"
              >
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

            <button class="secondary-action" type="button" @click="emit('open-export-item', item)">打开</button>
          </article>
        </div>

        <div class="generator-export__actions">
          <button class="primary-action" type="button" @click="handleExportAll">打包导出</button>
        </div>
      </div>
    </article>
  </section>
</template>
