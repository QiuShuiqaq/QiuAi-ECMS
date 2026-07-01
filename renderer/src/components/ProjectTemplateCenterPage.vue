<script setup>
import { computed, ref } from 'vue'

const props = defineProps({
  templates: {
    type: Array,
    default: () => []
  }
})

const emit = defineEmits([
  'apply-template',
  'remove-template',
  'rename-template'
])

const expandedIds = ref({})
const renameState = ref({
  id: '',
  name: ''
})

const sortedTemplates = computed(() => {
  return [...(props.templates || [])].sort((left, right) => {
    const rightTime = new Date(right?.updatedAt || right?.createdAt || 0).getTime()
    const leftTime = new Date(left?.updatedAt || left?.createdAt || 0).getTime()
    return rightTime - leftTime
  })
})

function isExpanded(templateId) {
  return Boolean(expandedIds.value[templateId])
}

function toggleExpanded(templateId) {
  expandedIds.value = {
    ...expandedIds.value,
    [templateId]: !expandedIds.value[templateId]
  }
}

function startRename(template) {
  renameState.value = {
    id: template.id,
    name: template.name || ''
  }
}

function cancelRename() {
  renameState.value = {
    id: '',
    name: ''
  }
}

function submitRename() {
  if (!renameState.value.id) {
    return
  }

  emit('rename-template', {
    id: renameState.value.id,
    name: renameState.value.name
  })
  cancelRename()
}

function formatDateTime(value = '') {
  const text = String(value || '').trim()
  if (!text) {
    return '--'
  }

  return text.replace('T', ' ').slice(0, 19)
}

function resolveImagePreview(asset = null) {
  return String(asset?.preview || asset?.savedPath || asset?.path || '')
}

function resolveCountLabel(items = []) {
  return String(Array.isArray(items) ? items.length : 0)
}

function resolveImagePromptAssignments(template = {}) {
  const promptAssignments = template?.parameters?.image?.promptAssignments
  return Array.isArray(promptAssignments) ? promptAssignments : []
}

function sliceText(value = '', max = 120) {
  const text = String(value || '').trim()
  if (!text) {
    return '--'
  }

  if (text.length <= max) {
    return text
  }

  return `${text.slice(0, max)}...`
}
</script>

<template>
  <section class="template-center-list-page">
    <header class="template-center-list-page__header">
      <div class="template-center-list-page__title-group">
        <h1>模板中心</h1>
        <span>{{ sortedTemplates.length }} 个模板</span>
      </div>
    </header>

    <section class="template-center-list-page__workspace">
      <div v-if="sortedTemplates.length" class="template-center-list-page__list">
        <article
          v-for="template in sortedTemplates"
          :key="template.id"
          class="template-row"
        >
          <div class="template-row__cover">
            <img
              v-if="resolveImagePreview(template.sourceImage)"
              :src="resolveImagePreview(template.sourceImage)"
              :alt="template.name || '模板原图'"
            >
            <div v-else class="template-row__cover-empty">无原图</div>
          </div>

          <div class="template-row__main">
            <div class="template-row__top">
              <div class="template-row__headline">
                <template v-if="renameState.id === template.id">
                  <div class="template-row__rename">
                    <input
                      v-model="renameState.name"
                      class="template-row__rename-input"
                      type="text"
                    >
                    <button class="primary-action" type="button" @click="submitRename">保存</button>
                    <button class="secondary-action" type="button" @click="cancelRename">取消</button>
                  </div>
                </template>
                <template v-else>
                  <strong>{{ template.name || '未命名模板' }}</strong>
                  <p>{{ sliceText(template.summary?.productName || '', 90) }}</p>
                </template>
              </div>

              <div class="template-row__actions">
                <button class="primary-action" type="button" @click="emit('apply-template', template)">应用模板</button>
                <button class="secondary-action" type="button" @click="startRename(template)">重命名</button>
                <button class="secondary-action" type="button" @click="toggleExpanded(template.id)">
                  {{ isExpanded(template.id) ? '收起参数' : '展开参数' }}
                </button>
                <button class="danger-action" type="button" @click="emit('remove-template', template.id)">删除</button>
              </div>
            </div>

            <div v-if="isExpanded(template.id)" class="template-row__details">
              <div class="template-detail-block">
                <span>标题参数</span>
                <pre>{{ JSON.stringify(template.parameters?.title || {}, null, 2) }}</pre>
              </div>
              <div class="template-detail-block">
                <span>描述参数</span>
                <pre>{{ JSON.stringify(template.parameters?.description || {}, null, 2) }}</pre>
              </div>
              <div class="template-detail-block">
                <span>套图参数</span>
                <pre>{{ JSON.stringify({
                  model: template.parameters?.image?.model || '',
                  size: template.parameters?.image?.size || '',
                  generateCount: template.parameters?.image?.generateCount || 0,
                  promptAssignments: resolveImagePromptAssignments(template)
                }, null, 2) }}</pre>
              </div>
              <div class="template-detail-block">
                <span>视频参数</span>
                <pre>{{ JSON.stringify(template.parameters?.video || {}, null, 2) }}</pre>
              </div>
            </div>
          </div>
        </article>
      </div>

      <div v-else class="template-center-list-page__empty">
        <strong>暂无模板</strong>
      </div>
    </section>
  </section>
</template>

<style scoped>
.template-center-list-page {
  display: flex;
  height: 100%;
  min-height: 0;
  flex-direction: column;
  gap: 16px;
}

.template-center-list-page__header,
.template-center-list-page__workspace,
.template-row {
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 22px;
  background: rgba(14, 18, 30, 0.9);
}

.template-center-list-page__header,
.template-center-list-page__workspace {
  padding: 18px 20px;
}

.template-center-list-page__title-group {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 16px;
}

.template-center-list-page__title-group h1 {
  margin: 0;
  font-size: 28px;
  line-height: 1;
}

.template-center-list-page__title-group span {
  font-size: 16px;
  color: rgba(223, 231, 246, 0.82);
}

.template-center-list-page__workspace {
  flex: 1;
  min-height: 0;
  overflow: hidden;
}

.template-center-list-page__list {
  display: flex;
  height: 100%;
  min-height: 0;
  flex-direction: column;
  gap: 14px;
  overflow-y: auto;
  padding-right: 4px;
  scrollbar-width: none;
}

.template-center-list-page__list::-webkit-scrollbar {
  width: 0;
  height: 0;
}

.template-row {
  display: grid;
  grid-template-columns: 190px minmax(0, 1fr);
  gap: 18px;
  padding: 16px;
}

.template-row__cover,
.template-row__cover img,
.template-row__cover-empty {
  width: 100%;
  height: 140px;
  border-radius: 16px;
}

.template-row__cover img {
  object-fit: cover;
}

.template-row__cover-empty {
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(8, 12, 20, 0.78);
  font-size: 16px;
  color: rgba(223, 231, 246, 0.7);
}

.template-row__main {
  display: flex;
  min-width: 0;
  flex-direction: column;
  gap: 14px;
}

.template-row__top {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
}

.template-row__headline {
  display: flex;
  min-width: 0;
  flex: 1;
  flex-direction: column;
  gap: 8px;
}

.template-row__headline strong {
  display: block;
  font-size: 18px;
  line-height: 1.35;
  word-break: break-word;
}

.template-row__headline p {
  margin: 0;
  font-size: 16px;
  line-height: 1.45;
  color: rgba(223, 231, 246, 0.78);
}

.template-row__actions,
.template-row__rename {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: flex-start;
  gap: 10px;
}

.template-row__rename {
  justify-content: flex-start;
}

.template-row__rename-input {
  width: min(420px, 100%);
}

.template-detail-block {
  display: flex;
  min-width: 0;
  flex-direction: column;
  gap: 10px;
  border-radius: 16px;
  background: rgba(8, 12, 20, 0.78);
  padding: 14px 16px;
}

.template-cell,
.template-detail-block {
  display: flex;
  min-width: 0;
  flex-direction: column;
  gap: 10px;
  border-radius: 16px;
  background: rgba(8, 12, 20, 0.78);
  padding: 14px 16px;
}

.template-cell span,
.template-detail-block span {
  font-size: 15px;
  color: rgba(223, 231, 246, 0.72);
}

.template-row__details {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
}

.template-detail-block pre {
  margin: 0;
  overflow: auto;
  white-space: pre-wrap;
  word-break: break-word;
  font-size: 14px;
  line-height: 1.55;
  color: rgba(239, 244, 255, 0.92);
  scrollbar-width: none;
}

.template-detail-block pre::-webkit-scrollbar {
  width: 0;
  height: 0;
}

.template-center-list-page__empty {
  display: flex;
  height: 100%;
  align-items: center;
  justify-content: center;
  font-size: 20px;
  color: rgba(223, 231, 246, 0.78);
}

@media (max-width: 1380px) {
  .template-row {
    grid-template-columns: 160px minmax(0, 1fr);
  }

}

@media (max-width: 1080px) {
  .template-row {
    grid-template-columns: 1fr;
  }

  .template-row__top {
    flex-direction: column;
  }

  .template-row__actions {
    justify-content: flex-start;
  }

  .template-row__details {
    grid-template-columns: 1fr;
  }
}
</style>
