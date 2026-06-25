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
const quantityField = computed(() => isTitleMode.value ? 'titleQuantity' : 'descriptionQuantity')
const maxCharsField = computed(() => isTitleMode.value ? 'titleMaxChars' : 'descriptionMaxChars')
const promptField = computed(() => isTitleMode.value ? 'titlePrompt' : 'descriptionPrompt')
const selectedText = computed(() => {
  return isTitleMode.value
    ? String(props.draft.selectedTitle || '').trim()
    : String(props.draft.selectedDescription || '').trim()
})

const filteredTemplates = computed(() => {
  const category = isTitleMode.value ? '标题' : '描述'
  return (props.promptTemplates || []).filter((item) => item.category === category)
})

const currentPromptValue = computed(() => props.draft[promptField.value] || '')
const currentQuantity = computed(() => Math.max(1, Number(props.draft[quantityField.value]) || 1))
const currentMaxChars = computed(() => Math.max(1, Number(props.draft[maxCharsField.value]) || 1))

function updateField(field, value) {
  emit('update-draft', { field, value })
}

function handleTemplateChange(templateId) {
  const template = filteredTemplates.value.find((item) => item.id === templateId)
  updateField(promptField.value, template?.prompt || '')
}
</script>

<template>
  <section class="text-generator-page">
    <article class="text-generator-page__panel">
      <header class="text-generator-page__header">
        <strong>参数设置</strong>
        <h2>{{ title }}</h2>
      </header>

      <div class="text-generator-page__form">
        <label class="text-generator-page__field">
          <span>任务名称</span>
          <input :value="draft.taskName || ''" type="text" @input="updateField('taskName', $event.target.value)">
        </label>

        <label class="text-generator-page__field">
          <span>商品名称</span>
          <input :value="draft.productName || ''" type="text" @input="updateField('productName', $event.target.value)">
        </label>

        <label class="text-generator-page__field">
          <span>目标平台</span>
          <input :value="draft.platformTargetsText || ''" type="text" @input="updateField('platformTargetsText', $event.target.value)">
        </label>

        <label class="text-generator-page__field">
          <span>语言</span>
          <input :value="draft.language || 'zh-CN'" type="text" @input="updateField('language', $event.target.value)">
        </label>

        <label class="text-generator-page__field text-generator-page__field--full">
          <span>关键词</span>
          <input :value="draft.keywordsText || ''" type="text" @input="updateField('keywordsText', $event.target.value)">
        </label>

        <div class="text-generator-page__grid">
          <label class="text-generator-page__field">
            <span>生成数量</span>
            <input :value="currentQuantity" type="number" min="1" max="50" @input="updateField(quantityField, $event.target.value)">
          </label>

          <label class="text-generator-page__field">
            <span>最大字数</span>
            <input :value="currentMaxChars" type="number" min="1" max="500" @input="updateField(maxCharsField, $event.target.value)">
          </label>

          <label class="text-generator-page__field text-generator-page__field--full">
            <span>提示词模板</span>
            <select @change="handleTemplateChange($event.target.value)">
              <option value="">选择模板</option>
              <option v-for="template in filteredTemplates" :key="template.id" :value="template.id">{{ template.name }}</option>
            </select>
          </label>
        </div>

        <label class="text-generator-page__field text-generator-page__field--full">
          <span>任务要求</span>
          <textarea :value="currentPromptValue" rows="8" @input="updateField(promptField, $event.target.value)"></textarea>
        </label>

        <button class="primary-action" type="button" @click="emit('submit-task')">生成</button>
      </div>
    </article>

    <article class="text-generator-page__panel">
      <header class="text-generator-page__header">
        <strong>结果</strong>
        <h2>{{ resultItems.length }} 条</h2>
      </header>

      <div v-if="selectedText" class="text-generator-page__selected">
        <span>当前采用</span>
        <button class="secondary-action" type="button" @click="emit('copy-text', selectedText)">复制当前采用内容</button>
      </div>

      <div class="text-generator-page__result-list">
        <article v-for="item in resultItems" :key="item.id" class="text-generator-page__result-card">
          <div class="text-generator-page__result-copy">
            <strong>{{ item.title || '结果' }}</strong>
            <p>{{ item.content || '' }}</p>
          </div>
          <button class="secondary-action" type="button" @click="emit('copy-text', item.content || '')">复制</button>
        </article>

        <div v-if="!resultItems.length" class="text-generator-page__empty">暂无结果</div>
      </div>
    </article>

    <article class="text-generator-page__panel">
      <header class="text-generator-page__header">
        <strong>导出</strong>
        <h2>{{ exportItems.length }} 组</h2>
      </header>

      <div class="text-generator-page__export-list">
        <article v-for="item in exportItems" :key="item.id" class="text-generator-page__export-card">
          <div>
            <strong>{{ item.name || item.groupTitle || '结果包' }}</strong>
            <span>{{ item.status || '已保存' }}</span>
          </div>
          <button class="secondary-action" type="button" @click="emit('open-export-item', item)">打开</button>
        </article>

        <div v-if="!exportItems.length" class="text-generator-page__empty">暂无导出包</div>
      </div>

      <button class="primary-action" type="button" @click="emit('export-results')">打包导出</button>
    </article>
  </section>
</template>

<style scoped>
.text-generator-page {
  display: grid;
  grid-template-columns: minmax(0, 1.1fr) minmax(0, 1fr) 320px;
  gap: 18px;
}

.text-generator-page__panel {
  display: flex;
  flex-direction: column;
  gap: 18px;
  padding: 22px;
  border-radius: 22px;
  border: 1px solid rgba(255, 255, 255, 0.08);
  background: rgba(14, 18, 30, 0.88);
}

.text-generator-page__header h2,
.text-generator-page__header strong {
  margin: 0;
}

.text-generator-page__header {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.text-generator-page__form,
.text-generator-page__result-list,
.text-generator-page__export-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.text-generator-page__field {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.text-generator-page__field span,
.text-generator-page__selected span,
.text-generator-page__export-card span {
  color: rgba(205, 214, 238, 0.76);
}

.text-generator-page__field input,
.text-generator-page__field select,
.text-generator-page__field textarea {
  width: 100%;
}

.text-generator-page__grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
}

.text-generator-page__field--full {
  grid-column: 1 / -1;
}

.text-generator-page__selected,
.text-generator-page__result-card,
.text-generator-page__export-card {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  padding: 14px 16px;
  border-radius: 16px;
  background: rgba(9, 13, 23, 0.72);
}

.text-generator-page__result-copy {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.text-generator-page__result-copy p {
  margin: 0;
  color: rgba(226, 232, 244, 0.88);
  white-space: pre-wrap;
}

.text-generator-page__export-card div {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.text-generator-page__empty {
  padding: 20px 0;
  color: rgba(205, 214, 238, 0.72);
}

@media (max-width: 1320px) {
  .text-generator-page {
    grid-template-columns: 1fr;
  }
}
</style>
