<script setup>
import { computed } from 'vue'

const props = defineProps({
  title: { type: String, required: true },
  textKind: { type: String, required: true },
  draft: { type: Object, required: true },
  resultItems: { type: Array, default: () => [] },
  exportItems: { type: Array, default: () => [] },
  promptTemplates: { type: Array, default: () => [] }
})

const emit = defineEmits([
  'update-draft',
  'submit-task',
  'copy-text',
  'export-results',
  'open-export-item'
])

const isTitleMode = computed(() => props.textKind === 'title')
const quantityField = computed(() => (isTitleMode.value ? 'titleQuantity' : 'descriptionQuantity'))
const maxCharsField = computed(() => (isTitleMode.value ? 'titleMaxChars' : 'descriptionMaxChars'))
const promptField = computed(() => (isTitleMode.value ? 'titlePrompt' : 'descriptionPrompt'))
const selectedField = computed(() => (isTitleMode.value ? 'selectedTitle' : 'selectedDescription'))

const filteredTemplates = computed(() => {
  const category = isTitleMode.value ? '标题' : '描述'
  return (props.promptTemplates || []).filter((item) => item.category === category)
})

const currentPromptValue = computed(() => String(props.draft[promptField.value] || ''))
const currentQuantity = computed(() => Math.max(1, Number(props.draft[quantityField.value]) || 1))
const currentMaxChars = computed(() => Math.max(1, Number(props.draft[maxCharsField.value]) || 1))
const selectedText = computed(() => String(props.draft[selectedField.value] || '').trim())

const resultCards = computed(() => {
  return (props.resultItems || []).map((item, index) => ({
    id: item.id || `text-result-${index + 1}`,
    title: item.title || `${props.title} ${index + 1}`,
    content: String(item.content || '').trim(),
    isSelected: String(item.content || '').trim() === selectedText.value
  }))
})

const exportCards = computed(() => {
  return (props.exportItems || []).map((item, index) => ({
    id: item.id || `text-export-${index + 1}`,
    name: item.name || item.groupTitle || `导出结果 ${index + 1}`,
    status: item.status || '已保存',
    itemCount: Number(item.itemCount || 0),
    raw: item
  }))
})

function updateField(field, value) {
  emit('update-draft', { field, value })
}

function handleTemplateChange(templateId) {
  const template = filteredTemplates.value.find((item) => item.id === templateId)
  updateField(promptField.value, template?.prompt || '')
}

function handleExportAll() {
  emit('export-results', {
    selectedExportIds: exportCards.value.map((item) => item.id)
  })
}
</script>

<template>
  <section class="generator-studio-page text-studio-page">
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

        <div class="generator-form__group">
          <div class="generator-form__row">
            <span class="generator-form__label">目标平台</span>
            <input :value="draft.platformTargetsText || ''" type="text" placeholder="如 Amazon / Temu / Shopee" @input="updateField('platformTargetsText', $event.target.value)">
          </div>
          <div class="generator-form__row">
            <span class="generator-form__label">语言</span>
            <input :value="draft.language || 'zh-CN'" type="text" placeholder="zh-CN" @input="updateField('language', $event.target.value)">
          </div>
        </div>

        <div class="generator-form__row">
          <span class="generator-form__label">关键词</span>
          <input :value="draft.keywordsText || ''" type="text" placeholder="关键词，用逗号分隔" @input="updateField('keywordsText', $event.target.value)">
        </div>

        <div class="generator-form__group">
          <div class="generator-form__row">
            <span class="generator-form__label">生成数量</span>
            <input :value="currentQuantity" type="number" min="1" max="50" @input="updateField(quantityField, $event.target.value)">
          </div>
          <div class="generator-form__row">
            <span class="generator-form__label">最大字数</span>
            <input :value="currentMaxChars" type="number" min="1" max="500" @input="updateField(maxCharsField, $event.target.value)">
          </div>
        </div>

        <div class="generator-form__row">
          <span class="generator-form__label">提示词模板</span>
          <select @change="handleTemplateChange($event.target.value)">
            <option value="">选择模板</option>
            <option v-for="template in filteredTemplates" :key="template.id" :value="template.id">{{ template.name }}</option>
          </select>
        </div>

        <div class="generator-form__card">
          <textarea :value="currentPromptValue" rows="12" placeholder="输入标题或描述生成要求" @input="updateField(promptField, $event.target.value)"></textarea>
        </div>

        <button class="primary-action" type="button" @click="emit('submit-task')">生成</button>
      </div>
    </article>

    <article class="generator-column generator-column--preview">
      <header class="generator-column__header">
        <strong>结果预览</strong>
        <h2>{{ resultCards.length }} 条</h2>
      </header>

      <div class="text-preview-layout">
        <section v-if="selectedText" class="latest-task-progress text-preview__selected">
          <header class="latest-task-progress__header">
            <div>
              <h3>当前采用内容</h3>
            </div>
            <button class="secondary-action" type="button" @click="emit('copy-text', selectedText)">复制</button>
          </header>
          <div class="generator-preview__text">{{ selectedText }}</div>
        </section>

        <section class="latest-task-progress generator-preview-panel">
          <header class="latest-task-progress__header">
            <div>
              <h3>候选结果</h3>
            </div>
          </header>

          <div class="text-preview-list">
            <article v-for="item in resultCards" :key="item.id" class="text-preview-card" :class="{ 'text-preview-card--selected': item.isSelected }">
              <div class="text-preview-card__copy">
                <strong>{{ item.title }}</strong>
                <p>{{ item.content || '暂无内容' }}</p>
              </div>
              <button class="secondary-action" type="button" @click="emit('copy-text', item.content)">复制</button>
            </article>

            <div v-if="!resultCards.length" class="product-result-empty">
              <span>暂无结果</span>
            </div>
          </div>
        </section>
      </div>
    </article>

    <article class="generator-column generator-column--export">
      <header class="generator-column__header">
        <strong>结果导出</strong>
        <h2>{{ exportCards.length }} 组</h2>
      </header>

      <div class="generator-export">
        <div v-if="exportCards.length" class="generator-export__list">
          <article v-for="item in exportCards" :key="item.id" class="generator-export__item">
            <div class="generator-export__copy">
              <strong>{{ item.name }}</strong>
              <span>{{ item.status }}{{ item.itemCount ? ` / ${item.itemCount}` : '' }}</span>
            </div>

            <button class="secondary-action" type="button" @click="emit('open-export-item', item.raw)">打开</button>
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
.text-studio-page .generator-column--preview {
  min-width: 0;
}

.text-preview-layout {
  display: flex;
  flex-direction: column;
  gap: 18px;
}

.text-preview__selected {
  gap: 14px;
}

.text-preview-list {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.text-preview-card {
  display: flex;
  justify-content: space-between;
  gap: 14px;
  padding: 16px 18px;
  border-radius: 18px;
  border: 1px solid rgba(255, 255, 255, 0.08);
  background: rgba(9, 13, 23, 0.72);
}

.text-preview-card--selected {
  border-color: rgba(100, 186, 255, 0.35);
  box-shadow: 0 0 0 1px rgba(100, 186, 255, 0.18) inset;
}

.text-preview-card__copy {
  display: flex;
  flex: 1;
  flex-direction: column;
  gap: 8px;
  min-width: 0;
}

.text-preview-card__copy strong {
  color: rgba(246, 248, 252, 0.98);
}

.text-preview-card__copy p {
  margin: 0;
  color: rgba(226, 232, 244, 0.88);
  white-space: pre-wrap;
  word-break: break-word;
  line-height: 1.7;
}

.product-result-empty--compact {
  min-height: 120px;
}

@media (max-width: 1320px) {
  .text-preview-card {
    flex-direction: column;
    align-items: stretch;
  }
}
</style>
