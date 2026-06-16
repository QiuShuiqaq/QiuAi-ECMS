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
  }
})

const emit = defineEmits([
  'save-template',
  'remove-template'
])

const CATEGORY_ORDER = ['标题', '描述', '图片', '视频']
const expandedTemplateId = ref('')
const draftMap = ref({})

function normalizeCategory(category = '') {
  if (category === '文本') {
    return '标题'
  }
  return String(category || '标题')
}

function normalizeTemplate(template = {}, fallbackSource = 'custom') {
  return {
    id: String(template.id || ''),
    name: String(template.name || ''),
    category: normalizeCategory(template.category),
    prompt: String(template.prompt || ''),
    source: template.source === 'system-fixed' ? 'system-fixed' : fallbackSource,
    isNew: template.isNew === true
  }
}

const allTemplates = computed(() => {
  return [
    ...(props.fixedPromptTemplates || []).map((item) => normalizeTemplate(item, 'system-fixed')),
    ...(props.customPromptTemplates || []).map((item) => normalizeTemplate(item, 'custom'))
  ]
})

function syncDraftMap(templates, previousDrafts = {}) {
  const nextDrafts = {}

  templates.forEach((template) => {
    const normalizedTemplate = normalizeTemplate(
      template,
      template.source === 'system-fixed' ? 'system-fixed' : 'custom'
    )
    const previousDraft = previousDrafts[normalizedTemplate.id]

    nextDrafts[normalizedTemplate.id] = {
      ...normalizedTemplate,
      ...(previousDraft
        ? {
            name: previousDraft.name,
            prompt: previousDraft.prompt,
            category: previousDraft.category
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

watch(allTemplates, (templates) => {
  draftMap.value = syncDraftMap(templates, draftMap.value)
}, {
  immediate: true,
  deep: true
})

function buildDraftId() {
  return `prompt-template-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

function ensureDraft(template = {}) {
  const normalizedTemplate = normalizeTemplate(
    template,
    template.source === 'system-fixed' ? 'system-fixed' : 'custom'
  )

  if (!normalizedTemplate.id) {
    return null
  }

  if (!draftMap.value[normalizedTemplate.id]) {
    draftMap.value = {
      ...draftMap.value,
      [normalizedTemplate.id]: normalizedTemplate
    }
  }

  return draftMap.value[normalizedTemplate.id]
}

function toggleTemplate(template) {
  const draft = ensureDraft(template)
  if (!draft) {
    return
  }

  expandedTemplateId.value = expandedTemplateId.value === draft.id ? '' : draft.id
}

function updateDraftField(templateId, field, value) {
  const currentDraft = draftMap.value[templateId]
  if (!currentDraft) {
    return
  }

  draftMap.value = {
    ...draftMap.value,
    [templateId]: {
      ...currentDraft,
      [field]: value
    }
  }
}

function addTemplate(category) {
  const templateId = buildDraftId()
  draftMap.value = {
    ...draftMap.value,
    [templateId]: {
      id: templateId,
      name: '',
      category,
      prompt: '',
      source: 'custom',
      isNew: true
    }
  }
  expandedTemplateId.value = templateId
}

function saveTemplate(templateId) {
  const template = draftMap.value[templateId]
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
    const nextDraftMap = { ...draftMap.value }
    delete nextDraftMap[templateId]
    draftMap.value = nextDraftMap
    expandedTemplateId.value = ''
  }
}

function removeTemplate(templateId) {
  const template = draftMap.value[templateId]
  if (!template) {
    return
  }

  if (template.isNew) {
    const nextDraftMap = { ...draftMap.value }
    delete nextDraftMap[templateId]
    draftMap.value = nextDraftMap
    if (expandedTemplateId.value === templateId) {
      expandedTemplateId.value = ''
    }
    return
  }

  emit('remove-template', templateId)
}

const templatesByCategory = computed(() => {
  const persistedIds = new Set(allTemplates.value.map((template) => template.id))
  const persistedTemplates = allTemplates.value.map((template) => {
    return draftMap.value[template.id] || template
  })
  const newTemplates = Object.values(draftMap.value).filter((draft) => {
    return draft.isNew === true && !persistedIds.has(draft.id)
  })
  const mergedTemplates = [...persistedTemplates, ...newTemplates]

  return CATEGORY_ORDER.map((category) => {
    return {
      category,
      templates: mergedTemplates.filter((template) => template.category === category)
    }
  })
})
</script>

<template>
  <div class="panel-shell">
    <header class="section-header">
      <div>
        <h2>提示词库</h2>
      </div>
    </header>

    <div class="panel-content panel-content--prompt-library">
      <section class="prompt-library-grid prompt-library-grid--quad prompt-library-grid--fixed-height">
        <article
          v-for="group in templatesByCategory"
          :key="group.category"
          class="prompt-library-column"
        >
          <div class="prompt-library-column__header prompt-library-column__header--stacked">
            <div>
              <h3>{{ group.category }}</h3>
              <p class="prompt-library-column__eyebrow">提示词</p>
            </div>
            <button
              class="secondary-action secondary-action--compact"
              type="button"
              @click="addTemplate(group.category)"
            >
              新增模板
            </button>
          </div>

          <div class="prompt-library-column__body prompt-library-column__body--stacked prompt-library-column__body--full scrollbar-hidden">
            <div class="prompt-library-list">
              <article
                v-for="template in group.templates"
                :key="template.id"
                class="prompt-template-card"
              >
                <button
                  class="prompt-template-card__header prompt-template-card__toggle"
                  type="button"
                  @click="toggleTemplate(template)"
                >
                  <div class="prompt-template-card__meta">
                    <strong>{{ template.name || '未命名模板' }}</strong>
                    <span>{{ template.source === 'system-fixed' ? '系统模板' : '自定义模板' }}</span>
                  </div>
                  <span class="prompt-template-card__indicator">{{ expandedTemplateId === template.id ? '收起' : '展开' }}</span>
                </button>

                <div v-if="expandedTemplateId === template.id" class="prompt-template-card__content">
                  <label class="form-field">
                    <span>模板名称</span>
                    <FormTextControl
                      :model-value="template.name"
                      type="text"
                      placeholder="输入模板名称"
                      @update:model-value="updateDraftField(template.id, 'name', $event)"
                    />
                  </label>

                  <label class="form-field">
                    <span>提示词</span>
                    <FormTextControl
                      :model-value="template.prompt"
                      as="textarea"
                      rows="8"
                      placeholder="输入提示词内容"
                      @update:model-value="updateDraftField(template.id, 'prompt', $event)"
                    />
                  </label>

                  <div class="prompt-template-card__actions">
                    <button class="primary-action" type="button" @click="saveTemplate(template.id)">保存</button>
                    <button
                      class="secondary-action"
                      type="button"
                      :disabled="template.source === 'system-fixed' && template.isNew !== true"
                      @click="removeTemplate(template.id)"
                    >
                      删除
                    </button>
                  </div>
                </div>
              </article>
            </div>
          </div>
        </article>
      </section>
    </div>
  </div>
</template>
