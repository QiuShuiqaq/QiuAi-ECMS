<script setup>
import { computed, ref, watch } from 'vue'
import FormTextControl from './FormTextControl.vue'

const props = defineProps({
  promptTemplates: {
    type: Array,
    required: true
  }
})

const emit = defineEmits([
  'save-template',
  'remove-template'
])

const CATEGORY_ORDER = ['标题', '描述', '图片', '视频']
const CATEGORY_ALIAS_MAP = {
  标题: '标题',
  描述: '描述',
  图片: '图片',
  视频: '视频',
  文本: '标题',
  '鏍囬': '标题',
  '鎻忚堪': '描述',
  '鍥剧墖': '图片',
  '瑙嗛': '视频',
  '閺嶅洭顣�': '标题',
  '閹诲繗鍫�': '描述',
  '閸ュ墽澧�': '图片',
  '鐟欏棝顣�': '视频',
  '闁哄秴娲。锟�': '标题',
  '闁硅绻楅崼锟�': '描述',
  '闁搞儱澧芥晶锟�': '图片',
  '閻熸瑥妫濋。锟�': '视频',
  '闁哄倸娲﹀﹢锟�': '标题'
}

const expandedTemplateId = ref('')
const draftMap = ref({})

function normalizeCategory(category = '') {
  const normalized = String(category || '标题').trim()
  return CATEGORY_ALIAS_MAP[normalized] || normalized || '标题'
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
  return (props.promptTemplates || []).map((item) => {
    return normalizeTemplate(
      item,
      item?.source === 'system-fixed' ? 'system-fixed' : 'custom'
    )
  })
})

function syncDraftMap(templates, previousDrafts = {}) {
  const nextDrafts = {}

  templates.forEach((template) => {
    const previousDraft = previousDrafts[template.id]
    nextDrafts[template.id] = {
      ...template,
      ...(previousDraft
        ? {
            name: previousDraft.name,
            prompt: previousDraft.prompt,
            category: normalizeCategory(previousDraft.category)
          }
        : {})
    }
  })

  Object.values(previousDrafts).forEach((draft) => {
    if (draft?.isNew === true && draft.id) {
      nextDrafts[draft.id] = {
        ...draft,
        category: normalizeCategory(draft.category)
      }
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
    category: normalizeCategory(template.category),
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
      templates: mergedTemplates.filter((template) => normalizeCategory(template.category) === category)
    }
  })
})
</script>

<template>
  <div class="prompt-library">
    <header class="prompt-library__header">
      <h2>提示词库</h2>
    </header>

    <section class="prompt-library__grid">
      <article
        v-for="group in templatesByCategory"
        :key="group.category"
        class="prompt-library__column"
      >
        <div class="prompt-library__column-header">
          <h3>{{ group.category }}</h3>
          <button
            class="secondary-action secondary-action--compact"
            type="button"
            @click="addTemplate(group.category)"
          >
            新增模板
          </button>
        </div>

        <div class="prompt-library__column-body">
          <article
            v-for="template in group.templates"
            :key="template.id"
            class="prompt-card"
          >
            <button
              class="prompt-card__toggle"
              type="button"
              @click="toggleTemplate(template)"
            >
              <div class="prompt-card__meta">
                <strong>{{ template.name || '未命名模板' }}</strong>
                <span>{{ template.source === 'system-fixed' ? '系统模板' : '自定义模板' }}</span>
              </div>
              <span class="prompt-card__state">{{ expandedTemplateId === template.id ? '收起' : '展开' }}</span>
            </button>

            <div v-if="expandedTemplateId === template.id" class="prompt-card__content">
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

              <div class="prompt-card__actions">
                <button class="primary-action" type="button" @click="saveTemplate(template.id)">
                  保存
                </button>
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
      </article>
    </section>
  </div>
</template>

<style scoped>
.prompt-library {
  display: flex;
  flex-direction: column;
  gap: 16px;
  min-width: 0;
}

.prompt-library__header h2 {
  margin: 0;
  font-size: 20px;
  font-weight: 700;
}

.prompt-library__grid {
  width: 100%;
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 12px;
  min-width: 0;
  overflow: hidden;
}

.prompt-library__column {
  min-width: 0;
  min-height: 360px;
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 18px;
  background: rgba(11, 16, 29, 0.82);
  overflow: hidden;
}

.prompt-library__column-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding: 14px 14px 12px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
}

.prompt-library__column-header h3 {
  margin: 0;
  font-size: 15px;
  font-weight: 700;
}

.prompt-library__column-body {
  display: flex;
  flex-direction: column;
  gap: 10px;
  height: 520px;
  padding: 12px;
  overflow: auto;
  min-width: 0;
}

.prompt-card {
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 14px;
  background: rgba(255, 255, 255, 0.03);
  min-width: 0;
}

.prompt-card__toggle {
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding: 12px 14px;
  border: 0;
  background: transparent;
  color: inherit;
  text-align: left;
  cursor: pointer;
  min-width: 0;
}

.prompt-card__meta {
  display: flex;
  flex-direction: column;
  gap: 4px;
  min-width: 0;
  flex: 1;
}

.prompt-card__meta strong,
.prompt-card__meta span,
.prompt-card__state {
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.prompt-card__meta span,
.prompt-card__state {
  color: rgba(255, 255, 255, 0.62);
  font-size: 12px;
}

.prompt-card__content {
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 0 14px 14px;
}

.form-field {
  display: flex;
  flex-direction: column;
  gap: 8px;
  min-width: 0;
}

.form-field span {
  font-size: 13px;
  color: rgba(255, 255, 255, 0.72);
}

.form-field :deep(input),
.form-field :deep(textarea) {
  width: 100%;
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 12px;
  background: rgba(5, 9, 18, 0.78);
  color: #fff;
  padding: 10px 12px;
  resize: vertical;
  box-sizing: border-box;
}

.prompt-card__actions {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
}
</style>
