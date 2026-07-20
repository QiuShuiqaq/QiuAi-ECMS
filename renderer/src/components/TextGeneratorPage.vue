<script setup>
import { computed, ref, watch } from 'vue'
import openFolderIcon from '../../../icon/wenjianjia.png'
import deleteIcon from '../../../icon/shanchu.png'

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
  'open-export-item',
  'delete-export-item'
])

const isTitleMode = computed(() => props.textKind === 'title')
const isDescriptionMode = computed(() => props.textKind === 'description')
const quantityField = computed(() => (isTitleMode.value ? 'titleQuantity' : 'descriptionQuantity'))
const maxCharsField = computed(() => (isTitleMode.value ? 'titleMaxChars' : 'descriptionMaxChars'))
const promptField = computed(() => (isTitleMode.value ? 'titlePrompt' : 'descriptionPrompt'))

const filteredTemplates = computed(() => {
  const category = isTitleMode.value ? '标题' : '描述'
  return (props.promptTemplates || []).filter((item) => item.category === category)
})

const currentPromptValue = computed(() => String(props.draft[promptField.value] || ''))
const currentMaxChars = computed(() => {
  const value = props.draft[maxCharsField.value]
  if (value === undefined || value === null) {
    return ''
  }
  return String(value)
})
const currentQuantityInput = computed(() => {
  const value = props.draft[quantityField.value]
  if (value === undefined || value === null) {
    return ''
  }
  return String(value)
})

const resultCards = computed(() => {
  return (props.resultItems || []).map((item, index) => ({
    id: item.id || `text-result-${index + 1}`,
    title: item.title || `${props.title} ${index + 1}`,
    content: String(item.content || '').trim(),
    isSelected: Boolean(item.isSelected)
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

const selectedExportIds = ref([])
const autoDeleteAfterExport = ref(false)

watch(exportCards, (cards) => {
  const validIdSet = new Set(cards.map((item) => item.id))
  selectedExportIds.value = selectedExportIds.value.filter((item) => validIdSet.has(item))
}, { immediate: true })

const areAllExportCardsSelected = computed(() => {
  return exportCards.value.length > 0 && selectedExportIds.value.length === exportCards.value.length
})

const hasSelectedExportCards = computed(() => selectedExportIds.value.length > 0)

function updateField(field, value) {
  emit('update-draft', { field, value })
}

function sanitizeNumericInput(value) {
  return String(value ?? '').replace(/[^\d]/g, '')
}

function handleMaxCharsInput(value) {
  updateField(maxCharsField.value, sanitizeNumericInput(value))
}

function handleMaxCharsBlur(value) {
  const digits = sanitizeNumericInput(value)
  const normalized = digits ? Math.max(1, Math.min(500, Number(digits))) : 60
  updateField(maxCharsField.value, String(normalized))
}

function handleQuantityInput(value) {
  updateField(quantityField.value, sanitizeNumericInput(value))
}

function handleQuantityBlur(value) {
  const digits = sanitizeNumericInput(value)
  const normalized = digits ? Math.max(1, Math.min(50, Number(digits))) : 1
  updateField(quantityField.value, String(normalized))
}

function handleTemplateChange(templateId) {
  const template = filteredTemplates.value.find((item) => item.id === templateId)
  updateField(promptField.value, template?.prompt || '')
}

function handleToggleExportSelection(exportId) {
  if (!exportId) {
    return
  }

  if (selectedExportIds.value.includes(exportId)) {
    selectedExportIds.value = selectedExportIds.value.filter((item) => item !== exportId)
    return
  }

  selectedExportIds.value = [...selectedExportIds.value, exportId]
}

function handleToggleAllExports() {
  if (areAllExportCardsSelected.value) {
    selectedExportIds.value = []
    return
  }

  selectedExportIds.value = exportCards.value.map((item) => item.id)
}

function handleExportAll() {
  if (!selectedExportIds.value.length) {
    return
  }

  emit('export-results', {
    selectedExportIds: selectedExportIds.value.slice(),
    autoDeleteAfterExport: autoDeleteAfterExport.value
  })
}
</script>

<template>
  <section class="generator-studio-page text-studio-page">
    <article class="generator-column generator-column--settings">
      <header class="generator-column__header">
        <div class="generator-column__header-copy">
          <strong>参数设置</strong>
          <h2>{{ title }}</h2>
        </div>
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
            <input
              :value="currentQuantityInput"
              type="text"
              inputmode="numeric"
              placeholder="1"
              @input="handleQuantityInput($event.target.value)"
              @blur="handleQuantityBlur($event.target.value)"
            >
          </div>
          <div class="generator-form__row">
            <span class="generator-form__label">最大字数</span>
            <input
              :value="currentMaxChars"
              type="text"
              inputmode="numeric"
              placeholder="60"
              @input="handleMaxCharsInput($event.target.value)"
              @blur="handleMaxCharsBlur($event.target.value)"
            >
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
          <textarea :value="currentPromptValue" rows="12" :placeholder="isTitleMode ? '输入标题生成要求' : '输入描述生成要求'" @input="updateField(promptField, $event.target.value)"></textarea>
        </div>

        <button class="primary-action" type="button" @click="emit('submit-task')">生成</button>
      </div>
    </article>

    <article class="generator-column generator-column--preview">
      <header class="generator-column__header">
        <strong>结果预览</strong>
        <h2>{{ resultCards.length }} 条</h2>
      </header>

      <section class="latest-task-progress generator-preview-panel text-preview-panel">
        <header class="latest-task-progress__header">
          <div>
            <h3>结果</h3>
          </div>
        </header>

        <div class="text-preview-list text-preview-list--scrollable">
          <article v-for="item in resultCards" :key="item.id" class="text-preview-card" :class="{ 'text-preview-card--selected': item.isSelected }">
            <div class="text-preview-card__copy">
              <div class="text-preview-card__topline">
                <strong>{{ item.title }}</strong>
                <button class="secondary-action text-preview-card__copy-button" type="button" @click="emit('copy-text', item.content)">复制</button>
              </div>
              <p :class="{ 'text-preview-card__content--description': isDescriptionMode }">{{ item.content || '暂无内容' }}</p>
            </div>
          </article>

          <div v-if="!resultCards.length" class="product-result-empty">
            <span>暂无结果</span>
          </div>
        </div>
      </section>
    </article>

    <article class="generator-column generator-column--export">
      <header class="generator-column__header">
        <strong>结果导出</strong>
        <h2>{{ exportCards.length }} 组</h2>
        <div class="generator-export__toolbar">
          <button class="secondary-action" type="button" @click="handleToggleAllExports">
            {{ areAllExportCardsSelected ? '取消全选' : '全选' }}
          </button>
          <label class="generator-export__checkbox">
            <input v-model="autoDeleteAfterExport" type="checkbox">
            <span>自动删除</span>
          </label>
          <button class="primary-action" type="button" :disabled="!hasSelectedExportCards" @click="handleExportAll">打包导出</button>
        </div>
      </header>

      <div class="generator-export">
        <div v-if="exportCards.length" class="generator-export__list">
          <article
            v-for="item in exportCards"
            :key="item.id"
            class="generator-export__item"
            :class="{ 'generator-export__item--selected': selectedExportIds.includes(item.id) }"
          >
            <label class="generator-export__item-check">
              <input
                :checked="selectedExportIds.includes(item.id)"
                type="checkbox"
                @change="handleToggleExportSelection(item.id)"
              >
            </label>
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
.text-studio-page .generator-column--preview {
  min-width: 0;
}

.text-preview-panel {
  display: flex;
  flex-direction: column;
  height: 100%;
  min-height: 0;
}

.text-preview-list {
  display: flex;
  flex: 1;
  flex-direction: column;
  gap: 14px;
  min-height: 0;
}

.text-preview-list--scrollable {
  overflow-y: auto;
  padding-right: 4px;
  scrollbar-width: none;
  -ms-overflow-style: none;
}

.text-preview-list--scrollable::-webkit-scrollbar {
  width: 0;
  height: 0;
}

.text-preview-card {
  display: flex;
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

.text-preview-card__topline {
  display: flex;
  align-items: center;
  gap: 10px;
  min-width: 0;
}

.text-preview-card__copy strong {
  color: rgba(246, 248, 252, 0.98);
  min-width: 0;
}

.text-preview-card__copy-button {
  flex: 0 0 auto;
}

.text-preview-card__copy p {
  margin: 0;
  color: rgba(226, 232, 244, 0.88);
  white-space: pre-wrap;
  word-break: break-word;
  line-height: 1.7;
}

.text-preview-card__content--description {
  display: -webkit-box;
  -webkit-line-clamp: 3;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.product-result-empty--compact {
  min-height: 120px;
}

.generator-column--export > .generator-column__header {
  align-items: center;
  column-gap: 10px;
  display: grid;
  grid-template-columns: auto 1fr;
  row-gap: 10px;
}

.generator-export__toolbar {
  align-items: center;
  display: grid;
  gap: 8px 10px;
  grid-column: 1 / -1;
  grid-template-columns: auto minmax(0, 1fr);
  margin-bottom: 0;
  min-width: 0;
}

.generator-column--export > .generator-column__header > h2 {
  justify-self: end;
}

.generator-column--export > .generator-column__header > strong,
.generator-column--export > .generator-column__header > h2 {
  white-space: nowrap;
}

.generator-export__toolbar .secondary-action,
.generator-export__toolbar .primary-action {
  align-items: center;
  font-size: 12px;
  min-height: 30px;
  padding: 0 10px;
}

.generator-export__toolbar .secondary-action {
  min-width: 78px;
}

.generator-export__checkbox {
  align-items: center;
  color: #a8a2bb;
  display: inline-flex;
  font-size: 12px;
  gap: 6px;
  justify-self: end;
  white-space: nowrap;
}

.generator-export {
  margin-top: 12px;
}

.generator-export__toolbar .primary-action {
  grid-column: 1 / -1;
  width: 100%;
}

.generator-export__checkbox input {
  margin: 0;
}

@media (max-width: 1280px) {
  .generator-column--export > .generator-column__header {
    grid-template-columns: 1fr;
  }

  .generator-column--export > .generator-column__header > h2,
  .generator-column--export > .generator-column__header > strong {
    justify-self: start;
  }

  .generator-export__toolbar {
    grid-template-columns: 1fr;
  }

  .generator-export__toolbar .secondary-action,
  .generator-export__toolbar .primary-action {
    font-size: 11px;
    min-height: 28px;
    padding: 0 8px;
  }

  .generator-export__checkbox {
    font-size: 11px;
    justify-self: start;
  }
}

.generator-export__checkbox input,
.generator-export__item-check input {
  accent-color: #6b72ff;
}

.generator-export__list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.generator-export__item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  min-height: 72px;
  max-height: 72px;
  padding: 14px 16px;
  overflow: hidden;
}

.generator-export__item--selected {
  border-color: rgba(107, 114, 255, 0.38);
  box-shadow: 0 0 0 1px rgba(107, 114, 255, 0.14) inset;
}

.generator-export__item-check {
  align-items: center;
  display: inline-flex;
  flex: 0 0 auto;
}

.generator-export__item-actions {
  display: flex;
  flex: 0 0 auto;
  flex-direction: row;
  gap: 8px;
  align-items: center;
}

.generator-export__copy {
  display: flex;
  flex: 1;
  flex-direction: column;
  gap: 6px;
  min-width: 0;
  overflow: hidden;
}

.generator-export__copy strong,
.generator-export__copy span {
  display: block;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.icon-action-button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  padding: 0;
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 10px;
  background: rgba(14, 20, 36, 0.92);
  cursor: pointer;
  transition: background-color 0.18s ease, border-color 0.18s ease, transform 0.18s ease;
}

.icon-action-button:hover {
  background: rgba(28, 38, 67, 0.96);
  border-color: rgba(96, 145, 255, 0.4);
  transform: translateY(-1px);
}

.icon-action-button img {
  width: 16px;
  height: 16px;
  object-fit: contain;
}

.icon-action-button--danger:hover {
  background: rgba(74, 24, 24, 0.96);
  border-color: rgba(255, 120, 120, 0.4);
}

.generator-export__actions {
  display: none;
}
</style>
