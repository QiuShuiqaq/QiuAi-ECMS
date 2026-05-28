<script setup>
import { computed, ref, watch } from 'vue'
import FormTextControl from './FormTextControl.vue'

const props = defineProps({
  fixedPromptTemplates: {
    type: Array,
    required: true
  },
  customPromptTemplates: {
    type: Array,
    required: true
  },
  fixedNegativePromptTemplates: {
    type: Array,
    required: true
  },
  customNegativePromptTemplates: {
    type: Array,
    required: true
  },
  mode: {
    type: String,
    default: 'image'
  }
})

const emit = defineEmits([
  'save-template',
  'remove-template',
  'save-negative-template',
  'remove-negative-template'
])

const expandedPositiveTemplateId = ref('')
const expandedNegativeTemplateId = ref('')
const positiveDraftMap = ref({})
const negativeDraftMap = ref({})

const activeModule = computed(() => {
  return ['text', 'video', 'image'].includes(props.mode) ? props.mode : 'image'
})

function groupTemplatesByCategory(templates = [], fallbackCategory = '未分类') {
  const categoryMap = new Map()

  templates.forEach((template) => {
    const category = String(template?.category || fallbackCategory)
    if (!categoryMap.has(category)) {
      categoryMap.set(category, [])
    }
    categoryMap.get(category).push(template)
  })

  return Array.from(categoryMap.entries()).map(([category, items]) => ({
    category,
    items
  }))
}

const libraryPreset = computed(() => {
  if (activeModule.value === 'text') {
    return {
      headerCopy: '管理电商文本生成任务模板、平台规则模板和文案风险提示。',
      positiveTitle: '生成任务模板',
      positiveEyebrow: '适合单独生成标题、详情、卖点、挂车文案和草稿录入文案的系统模板',
      positiveFieldLabel: '文案提示词',
      positiveFieldPlaceholder: '输入文本生成提示词',
      positiveAddLabel: '新增文案模板',
      positiveSaveLabel: '保存文案模板',
      positiveDeleteLabel: '删除文案模板',
      negativeTitle: '平台格式模板',
      negativeEyebrow: '用于约束不同平台的写法风格、合规边界和草稿结构',
      negativeCategoryFallback: '平台格式',
      negativeNamePlaceholder: '例如：TEMU 标题 / TikTok 描述 / 亚马逊要点',
      negativeFieldLabel: '平台格式约束',
      negativeSaveLabel: '保存平台格式模板',
      negativeDeleteLabel: '删除平台格式模板',
      negativeAddLabel: '新增平台格式模板',
      formatTitle: '文案参考',
      formatEyebrow: '按常见文本生成场景快速判断输出长度、结构和使用位置',
      riskDangerTitle: '禁止表达',
      riskDangerEyebrow: '避免违规、夸张和无法验证的表述',
      riskDangerCopy: '以下表达建议直接避免：',
      riskWarningTitle: '弱化表达',
      riskWarningEyebrow: '这些说法建议改写得更具体、更可信',
      riskWarningCopy: '以下表达建议优化后再使用：',
      bannedRiskHints: ['全网第一', '百分百爆单', '绝对有效', '永久不坏', '官方唯一', '零风险'],
      warningRiskHints: ['闭眼入', '随便卖', '轻松起量', '顶级品质', '万能适用', '行业天花板'],
      promptFormatGuide: [
        { scene: '单品标题生成', length: '18-32 字', tip: '优先结果感、场景和核心卖点，适合批量出多个版本' },
        { scene: '商品详情生成', length: '120-240 字', tip: '按人群、场景、卖点、理由去组织，适合直接进草稿' },
        { scene: '卖点拆解', length: '5 组要点', tip: '每组用短标题加一句解释，方便给图片和视频联动使用' },
        { scene: '挂车短文案', length: '30-60 字', tip: '更短、更直接，优先写痛点解决和行动引导' },
        { scene: '草稿录入版', length: '1 组完整结构', tip: '标题、卖点、详情、备注要分开，不要全部混成一段' }
      ]
    }
  }

  if (activeModule.value === 'video') {
    return {
      headerCopy: '管理电商视频脚本模板、镜头约束和短视频风险提示。',
      positiveTitle: '脚本模板',
      positiveEyebrow: '适合转化视频、种草视频、封面钩子和镜头拆解的系统模板',
      positiveFieldLabel: '脚本提示词',
      positiveFieldPlaceholder: '输入视频脚本提示词',
      positiveAddLabel: '新增脚本模板',
      positiveSaveLabel: '保存脚本模板',
      positiveDeleteLabel: '删除脚本模板',
      negativeTitle: '镜头约束模板',
      negativeEyebrow: '用于限制镜头风格、节奏、口播结构和平台适配方向',
      negativeCategoryFallback: '镜头约束',
      negativeNamePlaceholder: '例如：转化视频 / 种草视频 / 详情视频位',
      negativeFieldLabel: '镜头约束',
      negativeSaveLabel: '保存镜头约束模板',
      negativeDeleteLabel: '删除镜头约束模板',
      negativeAddLabel: '新增镜头约束模板',
      formatTitle: '脚本参考',
      formatEyebrow: '按视频场景快速判断镜头数量、节奏和结构重点',
      riskDangerTitle: '禁止表达',
      riskDangerEyebrow: '避免无法交付、夸张承诺和平台违规内容',
      riskDangerCopy: '以下表达建议直接避免：',
      riskWarningTitle: '弱化表达',
      riskWarningEyebrow: '这些镜头或表达建议改成更可执行的版本',
      riskWarningCopy: '以下表达建议优化后再使用：',
      bannedRiskHints: ['电影级还原', '百分百转化', '无限场景切换', '官方认证', '绝对爆单', '零成本复制'],
      warningRiskHints: ['镜头越多越好', '节奏越快越好', '背景随便', '口播可有可无', '先不管平台', '先做得花一点'],
      promptFormatGuide: [
        { scene: '转化短视频', length: '3-5 个镜头', tip: '先钩子，再过程，再卖点收口' },
        { scene: '场景种草视频', length: '4-6 个镜头', tip: '突出生活场景变化和体验结果' },
        { scene: '详情视频位', length: '15-20 秒', tip: '结构清晰，不要把镜头切太碎' },
        { scene: '封面钩子', length: '8-16 字', tip: '一句话讲结果，不写成长说明' },
        { scene: '口播开头', length: '12-20 字', tip: '先抓痛点，再给解决方案' }
      ]
    }
  }

  return {
    headerCopy: '管理生图模板、反向提示词和图像生成风险提示。',
    positiveTitle: '生图模板',
    positiveEyebrow: '适合主图、详情图、细节图、白底图和尺寸图的系统模板',
    positiveFieldLabel: '生图提示词',
    positiveFieldPlaceholder: '输入生图提示词',
    positiveAddLabel: '新增生图模板',
    positiveSaveLabel: '保存生图模板',
    positiveDeleteLabel: '删除生图模板',
    negativeTitle: '反向提示词',
    negativeEyebrow: '用于限制图像质量、商品变形和无关元素',
    negativeCategoryFallback: '反向提示词',
    negativeNamePlaceholder: '例如：电商通用 / 人物模特 / 静物商品',
    negativeFieldLabel: '反向提示词',
    negativeSaveLabel: '保存反向模板',
    negativeDeleteLabel: '删除反向模板',
    negativeAddLabel: '新增反向模板',
    formatTitle: '提示词参考',
    formatEyebrow: '按常见图像场景快速判断信息量和表达重点',
    riskDangerTitle: '高风险提示',
    riskDangerEyebrow: '不要要求与原图完全一致或机械复刻',
    riskDangerCopy: '以下提示建议直接避免：',
    riskWarningTitle: '弱化提示',
    riskWarningEyebrow: '这些说法建议改写得更具体、更可控',
    riskWarningCopy: '以下提示建议优化后再使用：',
    bannedRiskHints: ['和原图一致', '保持原样', '复刻原图', '不改布局', '完全一样', '不要变化'],
    warningRiskHints: ['尽量不变', '保留原图风格', '轻微修改', '只改一点', '背景不动'],
    promptFormatGuide: [
      { scene: '商品主图', length: '80-160 字', tip: '主体 + 场景 + 卖点感，不要写成大片分镜' },
      { scene: '详情图', length: '120-220 字', tip: '信息结构清晰，适合承接卖点说明' },
      { scene: '细节放大图', length: '80-140 字', tip: '聚焦材质、纹理、做工和局部结构' },
      { scene: '白底图', length: '40-100 字', tip: '要求干净、准确、完整，减少背景描述' },
      { scene: '尺寸参数图', length: '100-180 字', tip: '强调标注、比例和参数可读性' }
    ]
  }
})

function normalizeTemplate(template = {}, fallbackCategory = '自定义提示词', fallbackSource = 'custom') {
  return {
    id: String(template.id || ''),
    name: String(template.name || ''),
    category: String(template.category || fallbackCategory),
    prompt: String(template.prompt || ''),
    source: template.source === 'system-fixed' ? 'system-fixed' : fallbackSource,
    module: String(template.module || activeModule.value),
    isNew: template.isNew === true
  }
}

const allTemplateDrafts = computed(() => {
  const fixedTemplates = (props.fixedPromptTemplates || [])
    .filter((template) => String(template?.module || 'image') === activeModule.value)
    .map((template) => normalizeTemplate(template, '系统提示词', 'system-fixed'))

  const customTemplates = (props.customPromptTemplates || [])
    .filter((template) => {
      const templateModule = String(template?.module || '')
      return templateModule ? templateModule === activeModule.value : activeModule.value === 'image'
    })
    .map((template) => normalizeTemplate(template, '自定义提示词', 'custom'))

  return [...fixedTemplates, ...customTemplates]
})

const sortedNegativePromptTemplates = computed(() => {
  const fixedTemplates = (props.fixedNegativePromptTemplates || [])
    .filter((template) => String(template?.module || 'image') === activeModule.value)
    .map((template) => normalizeTemplate(template, '反向提示词', 'system-fixed'))

  const customTemplates = (props.customNegativePromptTemplates || [])
    .filter((template) => {
      const templateModule = String(template?.module || '')
      return templateModule ? templateModule === activeModule.value : activeModule.value === 'image'
    })
    .map((template) => normalizeTemplate(template, '反向提示词', 'custom'))

  return [...fixedTemplates, ...customTemplates]
})

function syncDraftMap(templates, previousDrafts = {}, fallbackCategory = '自定义提示词', fallbackSource = 'custom') {
  const nextDrafts = {}

  templates.forEach((template) => {
    const normalizedTemplate = normalizeTemplate(template, fallbackCategory, fallbackSource)
    const templateId = normalizedTemplate.id
    const previousDraft = previousDrafts[templateId]

    if (previousDraft?.isNew === true) {
      nextDrafts[templateId] = previousDraft
      return
    }

    nextDrafts[templateId] = {
      ...normalizedTemplate,
      ...(previousDraft
        ? {
            name: previousDraft.name,
            prompt: previousDraft.prompt
          }
        : {})
    }
  })

  Object.values(previousDrafts).forEach((draft) => {
    if (draft?.isNew === true && draft.id) {
      nextDrafts[draft.id] = draft
    }
  })

  return nextDrafts
}

watch(
  allTemplateDrafts,
  (templates) => {
    positiveDraftMap.value = syncDraftMap(templates, positiveDraftMap.value, '自定义提示词', 'custom')
  },
  {
    immediate: true,
    deep: true
  }
)

watch(
  sortedNegativePromptTemplates,
  (templates) => {
    negativeDraftMap.value = syncDraftMap(templates, negativeDraftMap.value, '反向提示词', 'custom')
  },
  {
    immediate: true,
    deep: true
  }
)

function buildDraftId(prefix) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

function ensurePositiveDraft(template = {}) {
  const normalizedTemplate = normalizeTemplate(
    template,
    '自定义提示词',
    template.source === 'system-fixed' ? 'system-fixed' : 'custom'
  )
  const templateId = normalizedTemplate.id
  if (!templateId) {
    return null
  }

  if (!positiveDraftMap.value[templateId]) {
    positiveDraftMap.value = {
      ...positiveDraftMap.value,
      [templateId]: normalizedTemplate
    }
  }

  return positiveDraftMap.value[templateId]
}

function ensureNegativeDraft(template = {}) {
  const normalizedTemplate = normalizeTemplate(
    template,
    '反向提示词',
    template.source === 'system-fixed' ? 'system-fixed' : 'custom'
  )
  const templateId = normalizedTemplate.id
  if (!templateId) {
    return null
  }

  if (!negativeDraftMap.value[templateId]) {
    negativeDraftMap.value = {
      ...negativeDraftMap.value,
      [templateId]: normalizedTemplate
    }
  }

  return negativeDraftMap.value[templateId]
}

function togglePositiveTemplate(template) {
  const draft = ensurePositiveDraft(template)
  if (!draft) {
    return
  }

  expandedPositiveTemplateId.value = expandedPositiveTemplateId.value === draft.id ? '' : draft.id
}

function toggleNegativeTemplate(template) {
  const draft = ensureNegativeDraft(template)
  if (!draft) {
    return
  }

  expandedNegativeTemplateId.value = expandedNegativeTemplateId.value === draft.id ? '' : draft.id
}

function updatePositiveDraftField(templateId, field, value) {
  const currentDraft = positiveDraftMap.value[templateId]
  if (!currentDraft) {
    return
  }

  positiveDraftMap.value = {
    ...positiveDraftMap.value,
    [templateId]: {
      ...currentDraft,
      [field]: value
    }
  }
}

function updateNegativeDraftField(templateId, field, value) {
  const currentDraft = negativeDraftMap.value[templateId]
  if (!currentDraft) {
    return
  }

  negativeDraftMap.value = {
    ...negativeDraftMap.value,
    [templateId]: {
      ...currentDraft,
      [field]: value
    }
  }
}

function addPositiveTemplate() {
  const templateId = buildDraftId('positive-template')
  positiveDraftMap.value = {
    ...positiveDraftMap.value,
    [templateId]: {
      id: templateId,
      name: '',
      category: '自定义提示词',
      prompt: '',
      source: 'custom',
      module: activeModule.value,
      isNew: true
    }
  }
  expandedPositiveTemplateId.value = templateId
}

function addNegativeTemplate() {
  const templateId = buildDraftId('negative-template')
  negativeDraftMap.value = {
    ...negativeDraftMap.value,
    [templateId]: {
      id: templateId,
      name: '',
      category: '反向提示词',
      prompt: '',
      source: 'custom',
      module: activeModule.value,
      isNew: true
    }
  }
  expandedNegativeTemplateId.value = templateId
}

function savePositiveTemplate(templateId) {
  const template = positiveDraftMap.value[templateId]
  if (!template) {
    return
  }

  emit('save-template', {
    id: template.isNew ? undefined : template.id,
    name: template.name,
    category: template.category,
    prompt: template.prompt,
    source: template.source === 'system-fixed' ? 'system-fixed' : 'custom',
    module: template.module || activeModule.value
  })

  if (template.isNew) {
    const nextDraftMap = { ...positiveDraftMap.value }
    delete nextDraftMap[templateId]
    positiveDraftMap.value = nextDraftMap
    expandedPositiveTemplateId.value = ''
  }
}

function saveNegativePromptTemplate(templateId) {
  const template = negativeDraftMap.value[templateId]
  if (!template) {
    return
  }

  emit('save-negative-template', {
    id: template.isNew ? undefined : template.id,
    name: template.name,
    category: template.category,
    prompt: template.prompt,
    source: template.source === 'system-fixed' ? 'system-fixed' : 'custom',
    module: template.module || activeModule.value
  })

  if (template.isNew) {
    const nextDraftMap = { ...negativeDraftMap.value }
    delete nextDraftMap[templateId]
    negativeDraftMap.value = nextDraftMap
    expandedNegativeTemplateId.value = ''
  }
}

function removePositiveTemplate(templateId) {
  const template = positiveDraftMap.value[templateId]
  if (!template) {
    return
  }

  if (template.isNew) {
    const nextDraftMap = { ...positiveDraftMap.value }
    delete nextDraftMap[templateId]
    positiveDraftMap.value = nextDraftMap
    if (expandedPositiveTemplateId.value === templateId) {
      expandedPositiveTemplateId.value = ''
    }
    return
  }

  emit('remove-template', templateId)
}

function removeNegativePromptTemplate(templateId) {
  const template = negativeDraftMap.value[templateId]
  if (!template) {
    return
  }

  if (template.isNew) {
    const nextDraftMap = { ...negativeDraftMap.value }
    delete nextDraftMap[templateId]
    negativeDraftMap.value = nextDraftMap
    if (expandedNegativeTemplateId.value === templateId) {
      expandedNegativeTemplateId.value = ''
    }
    return
  }

  emit('remove-negative-template', templateId)
}

const renderedPositiveTemplates = computed(() => {
  const templateIds = new Set(allTemplateDrafts.value.map((template) => template.id))
  const persistedTemplates = allTemplateDrafts.value.map((template) => {
    return positiveDraftMap.value[template.id] || template
  })
  const newTemplates = Object.values(positiveDraftMap.value).filter((draft) => {
    return draft.isNew === true && !templateIds.has(draft.id)
  })

  return [...persistedTemplates, ...newTemplates]
})

const renderedNegativeTemplates = computed(() => {
  const templateIds = new Set(sortedNegativePromptTemplates.value.map((template) => template.id))
  const persistedTemplates = sortedNegativePromptTemplates.value.map((template) => {
    return negativeDraftMap.value[template.id] || template
  })
  const newTemplates = Object.values(negativeDraftMap.value).filter((draft) => {
    return draft.isNew === true && !templateIds.has(draft.id)
  })

  return [...persistedTemplates, ...newTemplates]
})

const groupedPositiveTemplates = computed(() => {
  return groupTemplatesByCategory(renderedPositiveTemplates.value, '自定义提示词')
})

const groupedNegativeTemplates = computed(() => {
  return groupTemplatesByCategory(renderedNegativeTemplates.value, libraryPreset.value.negativeCategoryFallback)
})
</script>

<template>
  <div class="panel-shell">
    <header class="section-header">
      <div>
        <h2>提示词库</h2>
        <p class="section-copy">{{ libraryPreset.headerCopy }}</p>
      </div>
    </header>

    <div class="panel-content panel-content--prompt-library">
      <section class="prompt-library-grid prompt-library-grid--triple prompt-library-grid--fixed-height">
        <article class="prompt-library-column prompt-library-column--positive">
          <div class="prompt-library-column__header prompt-library-column__header--stacked">
            <div>
              <h3>{{ libraryPreset.positiveTitle }}</h3>
              <p class="prompt-library-column__eyebrow">{{ libraryPreset.positiveEyebrow }}</p>
            </div>
          </div>

          <div class="prompt-library-column__body prompt-library-column__body--stacked scrollbar-hidden prompt-library-column__body--full">
            <div class="prompt-library-list prompt-library-list--grouped">
              <section
                v-for="group in groupedPositiveTemplates"
                :key="group.category"
                class="prompt-template-group"
              >
                <header class="prompt-template-group__header">
                  <strong>{{ group.category }}</strong>
                  <span>{{ group.items.length }} 个模板</span>
                </header>

                <div class="prompt-template-group__list">
                  <article
                    v-for="template in group.items"
                    :key="template.id"
                    class="prompt-template-card"
                  >
                    <button
                      class="prompt-template-card__header prompt-template-card__toggle"
                      type="button"
                      @click="togglePositiveTemplate(template)"
                    >
                      <div class="prompt-template-card__meta">
                        <strong>{{ template.name || '未命名模板' }}</strong>
                        <span>{{ template.source === 'system-fixed' ? '系统模板' : '自定义模板' }}</span>
                      </div>
                      <span class="prompt-template-card__indicator">{{ expandedPositiveTemplateId === template.id ? '收起' : '展开' }}</span>
                    </button>

                    <div v-if="expandedPositiveTemplateId === template.id" class="prompt-template-card__content">
                      <label class="form-field">
                        <span>模板名称</span>
                        <FormTextControl
                          :model-value="template.name"
                          type="text"
                          placeholder="输入模板名称"
                          @update:model-value="updatePositiveDraftField(template.id, 'name', $event)"
                        />
                      </label>
                      <label class="form-field">
                        <span>{{ libraryPreset.positiveFieldLabel }}</span>
                        <FormTextControl
                          :model-value="template.prompt"
                          as="textarea"
                          rows="6"
                          :placeholder="libraryPreset.positiveFieldPlaceholder"
                          @update:model-value="updatePositiveDraftField(template.id, 'prompt', $event)"
                        />
                      </label>
                      <div class="prompt-template-card__actions">
                        <button class="primary-action" type="button" @click="savePositiveTemplate(template.id)">{{ libraryPreset.positiveSaveLabel }}</button>
                        <button
                          class="secondary-action"
                          type="button"
                          :disabled="template.source === 'system-fixed' && template.isNew !== true"
                          @click="removePositiveTemplate(template.id)"
                        >
                          {{ libraryPreset.positiveDeleteLabel }}
                        </button>
                      </div>
                    </div>
                  </article>
                </div>
              </section>
            </div>

            <button class="secondary-action prompt-template-add-button" type="button" @click="addPositiveTemplate">
              {{ libraryPreset.positiveAddLabel }}
            </button>
          </div>
        </article>

        <article class="prompt-library-column prompt-library-column--negative">
          <div class="prompt-library-column__header prompt-library-column__header--stacked">
            <div>
              <h3>{{ libraryPreset.negativeTitle }}</h3>
              <p class="prompt-library-column__eyebrow">{{ libraryPreset.negativeEyebrow }}</p>
            </div>
          </div>

          <div class="prompt-library-column__body scrollbar-hidden prompt-library-column__body--stacked prompt-library-column__body--full">
            <div class="prompt-library-list prompt-library-list--grouped">
              <section
                v-for="group in groupedNegativeTemplates"
                :key="group.category"
                class="prompt-template-group"
              >
                <header class="prompt-template-group__header">
                  <strong>{{ group.category }}</strong>
                  <span>{{ group.items.length }} 个模板</span>
                </header>

                <div class="prompt-template-group__list">
                  <article
                    v-for="template in group.items"
                    :key="template.id"
                    class="prompt-template-card"
                  >
                    <button
                      class="prompt-template-card__header prompt-template-card__toggle"
                      type="button"
                      @click="toggleNegativeTemplate(template)"
                    >
                      <div class="prompt-template-card__meta">
                        <strong>{{ template.name || '未命名模板' }}</strong>
                        <span>{{ template.source === 'system-fixed' ? '系统模板' : '自定义模板' }}</span>
                      </div>
                      <span class="prompt-template-card__indicator">{{ expandedNegativeTemplateId === template.id ? '收起' : '展开' }}</span>
                    </button>

                    <div v-if="expandedNegativeTemplateId === template.id" class="prompt-template-card__content">
                      <label class="form-field">
                        <span>模板名称</span>
                        <FormTextControl
                          :model-value="template.name"
                          type="text"
                          :placeholder="libraryPreset.negativeNamePlaceholder"
                          @update:model-value="updateNegativeDraftField(template.id, 'name', $event)"
                        />
                      </label>
                      <label class="form-field">
                        <span>{{ libraryPreset.negativeFieldLabel }}</span>
                        <FormTextControl
                          :model-value="template.prompt"
                          as="textarea"
                          rows="6"
                          @update:model-value="updateNegativeDraftField(template.id, 'prompt', $event)"
                        />
                      </label>
                      <div class="prompt-template-card__actions">
                        <button class="primary-action" type="button" @click="saveNegativePromptTemplate(template.id)">{{ libraryPreset.negativeSaveLabel }}</button>
                        <button
                          class="secondary-action"
                          type="button"
                          :disabled="template.source === 'system-fixed' && template.isNew !== true"
                          @click="removeNegativePromptTemplate(template.id)"
                        >
                          {{ libraryPreset.negativeDeleteLabel }}
                        </button>
                      </div>
                    </div>
                  </article>
                </div>
              </section>
            </div>

            <button class="secondary-action prompt-template-add-button" type="button" @click="addNegativeTemplate">
              {{ libraryPreset.negativeAddLabel }}
            </button>
          </div>
        </article>

        <article class="prompt-library-column prompt-library-column--format">
          <div class="prompt-library-column__header prompt-library-column__header--stacked">
            <div>
              <h3>{{ libraryPreset.formatTitle }}</h3>
              <p class="prompt-library-column__eyebrow">{{ libraryPreset.formatEyebrow }}</p>
            </div>
          </div>

          <div class="prompt-library-column__body scrollbar-hidden prompt-library-column__body--full">
            <div class="prompt-format-list">
              <article v-for="item in libraryPreset.promptFormatGuide" :key="item.scene" class="prompt-format-card">
                <strong>{{ item.scene }}</strong>
                <span>推荐字数</span>
                <p>{{ item.length }}</p>
                <span>写法重点</span>
                <p>{{ item.tip }}</p>
              </article>
            </div>
          </div>
        </article>

        <aside class="prompt-library-risk-sidebar prompt-library-stack prompt-library-stack--risk prompt-library-column--risk">
          <article class="prompt-library-column prompt-library-stack__panel prompt-library-risk-panel">
            <div class="prompt-library-column__header prompt-library-column__header--stacked">
              <div>
                <h3>{{ libraryPreset.riskDangerTitle }}</h3>
                <p class="prompt-library-column__eyebrow">{{ libraryPreset.riskDangerEyebrow }}</p>
              </div>
            </div>

            <div class="prompt-library-column__body scrollbar-hidden prompt-library-column__body--full">
              <p class="prompt-risk-copy">{{ libraryPreset.riskDangerCopy }}</p>
              <div class="prompt-risk-list">
                <article v-for="riskWord in libraryPreset.bannedRiskHints" :key="riskWord" class="prompt-risk-card prompt-risk-card--danger">
                  <strong>{{ riskWord }}</strong>
                </article>
              </div>
            </div>
          </article>

          <article class="prompt-library-column prompt-library-stack__panel prompt-library-risk-panel">
            <div class="prompt-library-column__header prompt-library-column__header--stacked">
              <div>
                <h3>{{ libraryPreset.riskWarningTitle }}</h3>
                <p class="prompt-library-column__eyebrow">{{ libraryPreset.riskWarningEyebrow }}</p>
              </div>
            </div>

            <div class="prompt-library-column__body scrollbar-hidden prompt-library-column__body--full">
              <p class="prompt-risk-copy">{{ libraryPreset.riskWarningCopy }}</p>
              <div class="prompt-risk-list">
                <article v-for="riskWord in libraryPreset.warningRiskHints" :key="riskWord" class="prompt-risk-card prompt-risk-card--warning">
                  <strong>{{ riskWord }}</strong>
                </article>
              </div>
            </div>
          </article>
        </aside>
      </section>
    </div>
  </div>
</template>
