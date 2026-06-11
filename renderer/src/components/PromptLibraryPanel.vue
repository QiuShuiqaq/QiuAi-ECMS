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

const bannedRiskHints = [
  '和原图一致',
  '保持原样',
  '复刻原图',
  '不改动布局',
  '完全一致',
  '不要变化'
]

const warningRiskHints = [
  '尽量不变',
  '保留原图风格',
  '轻微修改',
  '只改一点',
  '背景不动'
]

const promptFormatGuide = [
  {
    scene: '商品主图 / 首页首图',
    length: '20～60',
    tip: '先把XXX改成商品名，再写主体 + 卖点 + 画面感觉，短句直接，不要堆太多形容词'
  },
  {
    scene: '商品详情图 / 卖点说明图',
    length: '40～90',
    tip: '先把XXX改成商品名，再写功能卖点 + 使用场景 + 版面感觉，优先写清楚要展示什么'
  },
  {
    scene: '商品细节图 / 材质特写',
    length: '20～50',
    tip: '先把XXX改成商品名，再写局部部位 + 材质纹理 + 灯光质感，少写大场景'
  },
  {
    scene: '商品尺寸图 / 规格说明图',
    length: '20～40',
    tip: '先把XXX改成商品名，再写尺寸结构 + 信息清晰 + 画面整洁，避免加入无关氛围词'
  },
  {
    scene: '商品白底图 / 颜色图',
    length: '15～40',
    tip: '先把XXX改成商品名，再写白底或颜色变化 + 主体完整 + 边缘干净，越简单越稳定'
  }
]

function normalizeTemplate(template = {}, fallbackCategory = '自定义提示词', fallbackSource = 'custom') {
  return {
    id: String(template.id || ''),
    name: String(template.name || ''),
    category: String(template.category || fallbackCategory),
    prompt: String(template.prompt || ''),
    source: template.source === 'system-fixed' ? 'system-fixed' : fallbackSource,
    isNew: template.isNew === true
  }
}

const allTemplateDrafts = computed(() => {
  return [
    ...(props.fixedPromptTemplates || []).map((template) => normalizeTemplate(template, '系统提示词', 'system-fixed')),
    ...(props.customPromptTemplates || []).map((template) => normalizeTemplate(template, '自定义提示词', 'custom'))
  ]
})

const sortedNegativePromptTemplates = computed(() => {
  return [
    ...(props.fixedNegativePromptTemplates || []).map((template) => normalizeTemplate(template, '反向提示词', 'system-fixed')),
    ...(props.customNegativePromptTemplates || []).map((template) => normalizeTemplate(template, '反向提示词', 'custom'))
  ]
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
      ...(previousDraft ? {
        name: previousDraft.name,
        prompt: previousDraft.prompt
      } : {})
    }
  })

  Object.values(previousDrafts).forEach((draft) => {
    if (draft?.isNew === true && draft.id) {
      nextDrafts[draft.id] = draft
    }
  })

  return nextDrafts
}

watch(allTemplateDrafts, (templates) => {
  positiveDraftMap.value = syncDraftMap(templates, positiveDraftMap.value, '自定义提示词', 'custom')
}, {
  immediate: true,
  deep: true
})

watch(sortedNegativePromptTemplates, (templates) => {
  negativeDraftMap.value = syncDraftMap(templates, negativeDraftMap.value, '反向提示词', 'custom')
}, {
  immediate: true,
  deep: true
})

function buildDraftId(prefix) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

function ensurePositiveDraft(template = {}) {
  const normalizedTemplate = normalizeTemplate(template, '自定义提示词', template.source === 'system-fixed' ? 'system-fixed' : 'custom')
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
  const normalizedTemplate = normalizeTemplate(template, '反向提示词', template.source === 'system-fixed' ? 'system-fixed' : 'custom')
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
    source: template.source === 'system-fixed' ? 'system-fixed' : 'custom'
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
    source: template.source === 'system-fixed' ? 'system-fixed' : 'custom'
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
  const newTemplates = Object.values(positiveDraftMap.value).filter((draft) => draft.isNew === true && !templateIds.has(draft.id))
  return [...persistedTemplates, ...newTemplates]
})

const renderedNegativeTemplates = computed(() => {
  const templateIds = new Set(sortedNegativePromptTemplates.value.map((template) => template.id))
  const persistedTemplates = sortedNegativePromptTemplates.value.map((template) => {
    return negativeDraftMap.value[template.id] || template
  })
  const newTemplates = Object.values(negativeDraftMap.value).filter((draft) => draft.isNew === true && !templateIds.has(draft.id))
  return [...persistedTemplates, ...newTemplates]
})
</script>

<template>
  <div class="panel-shell">
    <header class="section-header">
      <div>
        <h2>提示词库</h2>
        <p class="section-copy">管理系统提示词、反向提示词与风险提示。</p>
      </div>
    </header>

    <div class="panel-content panel-content--prompt-library">
      <section class="prompt-library-grid prompt-library-grid--triple prompt-library-grid--fixed-height">
        <article class="prompt-library-column prompt-library-column--positive">
          <div class="prompt-library-column__header prompt-library-column__header--stacked">
            <div>
              <h3>正向提示词</h3>
              <p class="prompt-library-column__eyebrow">系统模板与自定义模板统一编辑</p>
            </div>
          </div>

          <div class="prompt-library-column__body prompt-library-column__body--stacked scrollbar-hidden prompt-library-column__body--full">
            <div class="prompt-library-list">
              <article
                v-for="template in renderedPositiveTemplates"
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
                    <span>正向提示词</span>
                    <FormTextControl
                      :model-value="template.prompt"
                      as="textarea"
                      rows="6"
                      placeholder="输入正向提示词"
                      @update:model-value="updatePositiveDraftField(template.id, 'prompt', $event)"
                    />
                  </label>
                  <div class="prompt-template-card__actions">
                    <button class="primary-action" type="button" @click="savePositiveTemplate(template.id)">保存正向模板</button>
                    <button
                      class="secondary-action"
                      type="button"
                      :disabled="template.source === 'system-fixed' && template.isNew !== true"
                      @click="removePositiveTemplate(template.id)"
                    >
                      删除正向模板
                    </button>
                  </div>
                </div>
              </article>
            </div>

            <button class="secondary-action prompt-template-add-button" type="button" @click="addPositiveTemplate">
              新增提示模板
            </button>
          </div>
        </article>

        <article class="prompt-library-column prompt-library-column--negative">
          <div class="prompt-library-column__header prompt-library-column__header--stacked">
            <div>
              <h3>负向提示词</h3>
              <p class="prompt-library-column__eyebrow">反向提示词库</p>
            </div>
          </div>

          <div class="prompt-library-column__body scrollbar-hidden prompt-library-column__body--stacked prompt-library-column__body--full">
            <div class="prompt-library-list">
              <article
                v-for="template in renderedNegativeTemplates"
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
                    <span>{{ template.category || '反向提示词' }}</span>
                  </div>
                  <span class="prompt-template-card__indicator">{{ expandedNegativeTemplateId === template.id ? '收起' : '展开' }}</span>
                </button>

                <div v-if="expandedNegativeTemplateId === template.id" class="prompt-template-card__content">
                  <label class="form-field">
                    <span>模板名称</span>
                    <FormTextControl
                      :model-value="template.name"
                      type="text"
                      placeholder="电商通用 / 电商模特 / 电商静物"
                      @update:model-value="updateNegativeDraftField(template.id, 'name', $event)"
                    />
                  </label>
                  <label class="form-field">
                    <span>反向提示词</span>
                    <FormTextControl
                      :model-value="template.prompt"
                      as="textarea"
                      rows="6"
                      @update:model-value="updateNegativeDraftField(template.id, 'prompt', $event)"
                    />
                  </label>
                  <div class="prompt-template-card__actions">
                    <button class="primary-action" type="button" @click="saveNegativePromptTemplate(template.id)">保存反向提示词模板</button>
                    <button
                      class="secondary-action"
                      type="button"
                      :disabled="template.source === 'system-fixed' && template.isNew !== true"
                      @click="removeNegativePromptTemplate(template.id)"
                    >
                      删除反向提示词模板
                    </button>
                  </div>
                </div>
              </article>
            </div>

            <button class="secondary-action prompt-template-add-button" type="button" @click="addNegativeTemplate">
              新增提示模板
            </button>
          </div>
        </article>

        <article class="prompt-library-column prompt-library-column--format">
          <div class="prompt-library-column__header prompt-library-column__header--stacked">
            <div>
              <h3>提示词格式</h3>
              <p class="prompt-library-column__eyebrow">先把模板里的 XXX 改成商品主体，再按电商场景快速判断字数与写法重点</p>
            </div>
          </div>

          <div class="prompt-library-column__body scrollbar-hidden prompt-library-column__body--full">
            <div class="prompt-format-list">
              <article v-for="item in promptFormatGuide" :key="item.scene" class="prompt-format-card">
                <strong>{{ item.scene }}</strong>
                <span>推荐字符数</span>
                <p>{{ item.length }}</p>
                <span>写法要点</span>
                <p>{{ item.tip }}</p>
              </article>
            </div>
          </div>
        </article>

        <aside class="prompt-library-risk-sidebar prompt-library-stack prompt-library-stack--risk prompt-library-column--risk">
          <article class="prompt-library-column prompt-library-stack__panel prompt-library-risk-panel">
            <div class="prompt-library-column__header prompt-library-column__header--stacked">
              <div>
                <h3>违禁提示词</h3>
                <p class="prompt-library-column__eyebrow">禁用词提示</p>
              </div>
            </div>

            <div class="prompt-library-column__body scrollbar-hidden prompt-library-column__body--full">
              <p class="prompt-risk-copy">以下词建议直接避免使用</p>
              <div class="prompt-risk-list">
                <article v-for="riskWord in bannedRiskHints" :key="riskWord" class="prompt-risk-card prompt-risk-card--danger">
                  <strong>{{ riskWord }}</strong>
                </article>
              </div>
            </div>
          </article>

          <article class="prompt-library-column prompt-library-stack__panel prompt-library-risk-panel">
            <div class="prompt-library-column__header prompt-library-column__header--stacked">
              <div>
                <h3>警告提示词</h3>
                <p class="prompt-library-column__eyebrow">警告词提示</p>
              </div>
            </div>

            <div class="prompt-library-column__body scrollbar-hidden prompt-library-column__body--full">
              <p class="prompt-risk-copy">以下词建议改写后再使用</p>
              <div class="prompt-risk-list">
                <article v-for="riskWord in warningRiskHints" :key="riskWord" class="prompt-risk-card prompt-risk-card--warning">
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
