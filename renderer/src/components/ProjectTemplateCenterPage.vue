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
</script>

<template>
  <section class="project-template-center-page">
    <header class="project-template-center-page__hero">
      <div>
        <span class="project-template-center-page__eyebrow">Templates</span>
        <h1>模板中心</h1>
        <p>只保存本地项目模板，用于快速复用满意任务的整套参数和结果。</p>
      </div>
    </header>

    <section class="project-template-center-page__panel">
      <header class="project-template-center-page__panel-header">
        <strong>项目模板库</strong>
        <span>{{ sortedTemplates.length }} 个模板</span>
      </header>

      <div v-if="sortedTemplates.length" class="project-template-center-page__list">
        <article
          v-for="template in sortedTemplates"
          :key="template.id"
          class="project-template-card"
        >
          <div class="project-template-card__media">
            <img
              v-if="resolveImagePreview(template.sourceImage)"
              :src="resolveImagePreview(template.sourceImage)"
              :alt="template.name || '模板原图'"
            >
            <div v-else class="project-template-card__media-empty">无原图</div>
          </div>

          <div class="project-template-card__body">
            <div class="project-template-card__header">
              <div class="project-template-card__title-block">
                <template v-if="renameState.id === template.id">
                  <input
                    v-model="renameState.name"
                    class="project-template-card__rename-input"
                    type="text"
                  >
                  <div class="project-template-card__inline-actions">
                    <button class="primary-action" type="button" @click="submitRename">保存</button>
                    <button class="secondary-action" type="button" @click="cancelRename">取消</button>
                  </div>
                </template>
                <template v-else>
                  <strong>{{ template.name || '未命名模板' }}</strong>
                  <span>{{ template.summary?.productName || '--' }} / {{ template.summary?.language || '--' }}</span>
                </template>
              </div>

              <div class="project-template-card__actions">
                <button class="primary-action" type="button" @click="emit('apply-template', template)">应用模板</button>
                <button class="secondary-action" type="button" @click="startRename(template)">重命名</button>
                <button class="secondary-action" type="button" @click="toggleExpanded(template.id)">
                  {{ isExpanded(template.id) ? '收起参数' : '展开参数' }}
                </button>
                <button class="danger-action" type="button" @click="emit('remove-template', template.id)">删除</button>
              </div>
            </div>

            <div class="project-template-card__summary-grid">
              <article class="project-template-card__summary-item">
                <span>标题结果</span>
                <strong>{{ template.generatedTitle || '--' }}</strong>
              </article>
              <article class="project-template-card__summary-item">
                <span>描述结果</span>
                <strong>{{ template.generatedDescription || '--' }}</strong>
              </article>
              <article class="project-template-card__summary-item">
                <span>套图数量</span>
                <strong>{{ resolveCountLabel(template.generatedImages) }}</strong>
              </article>
              <article class="project-template-card__summary-item">
                <span>视频</span>
                <strong>{{ template.generatedVideo ? '已保存' : '无' }}</strong>
              </article>
            </div>

            <div class="project-template-card__gallery">
              <img
                v-for="image in (template.generatedImages || []).slice(0, 4)"
                :key="image.id || image.savedPath || image.path"
                :src="resolveImagePreview(image)"
                alt="模板套图"
              >
              <div v-if="template.generatedVideo" class="project-template-card__video-pill">已含视频结果</div>
            </div>

            <div v-if="isExpanded(template.id)" class="project-template-card__details">
              <div class="project-template-card__detail-group">
                <span>标题参数</span>
                <pre>{{ JSON.stringify(template.parameters?.title || {}, null, 2) }}</pre>
              </div>
              <div class="project-template-card__detail-group">
                <span>描述参数</span>
                <pre>{{ JSON.stringify(template.parameters?.description || {}, null, 2) }}</pre>
              </div>
              <div class="project-template-card__detail-group">
                <span>套图参数</span>
                <pre>{{ JSON.stringify(template.parameters?.image || {}, null, 2) }}</pre>
              </div>
              <div class="project-template-card__detail-group">
                <span>视频参数</span>
                <pre>{{ JSON.stringify(template.parameters?.video || {}, null, 2) }}</pre>
              </div>
            </div>

            <div class="project-template-card__footer">
              <span>创建于 {{ formatDateTime(template.createdAt) }}</span>
              <span>更新于 {{ formatDateTime(template.updatedAt) }}</span>
            </div>
          </div>
        </article>
      </div>

      <div v-else class="project-template-center-page__empty">
        <strong>暂无模板</strong>
        <span>在工作中心完成满意任务后，点击“保存模板”即可写入本地模板库。</span>
      </div>
    </section>
  </section>
</template>

<style scoped>
.project-template-center-page {
  display: flex;
  flex-direction: column;
  gap: 18px;
}

.project-template-center-page__hero,
.project-template-center-page__panel,
.project-template-card {
  border-radius: 22px;
  border: 1px solid rgba(255, 255, 255, 0.08);
  background: rgba(14, 18, 30, 0.88);
}

.project-template-center-page__hero,
.project-template-center-page__panel {
  padding: 22px;
}

.project-template-center-page__eyebrow {
  display: inline-flex;
  margin-bottom: 10px;
  font-size: 12px;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: rgba(118, 173, 255, 0.88);
}

.project-template-center-page__hero h1,
.project-template-center-page__panel-header strong {
  margin: 0;
}

.project-template-center-page__hero p,
.project-template-center-page__panel-header span,
.project-template-card__title-block span,
.project-template-card__summary-item span,
.project-template-card__footer span,
.project-template-center-page__empty span {
  color: rgba(205, 214, 238, 0.76);
}

.project-template-center-page__panel {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.project-template-center-page__panel-header {
  display: flex;
  justify-content: space-between;
  gap: 12px;
}

.project-template-center-page__list {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.project-template-card {
  display: grid;
  grid-template-columns: 220px minmax(0, 1fr);
  gap: 18px;
  padding: 18px;
}

.project-template-card__media,
.project-template-card__media img,
.project-template-card__media-empty {
  width: 100%;
  height: 180px;
  border-radius: 16px;
}

.project-template-card__media img {
  object-fit: cover;
}

.project-template-card__media-empty {
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(9, 13, 23, 0.72);
  color: rgba(205, 214, 238, 0.72);
}

.project-template-card__body,
.project-template-card__title-block,
.project-template-card__detail-group {
  display: flex;
  flex-direction: column;
}

.project-template-card__body {
  gap: 16px;
}

.project-template-card__header,
.project-template-card__actions,
.project-template-card__inline-actions,
.project-template-card__footer {
  display: flex;
  gap: 10px;
}

.project-template-card__header,
.project-template-card__footer {
  justify-content: space-between;
}

.project-template-card__actions,
.project-template-card__inline-actions {
  flex-wrap: wrap;
}

.project-template-card__title-block {
  gap: 6px;
}

.project-template-card__rename-input {
  width: min(360px, 100%);
}

.project-template-card__summary-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 12px;
}

.project-template-card__summary-item,
.project-template-card__video-pill,
.project-template-card__detail-group {
  padding: 14px 16px;
  border-radius: 16px;
  background: rgba(9, 13, 23, 0.72);
}

.project-template-card__summary-item {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.project-template-card__summary-item strong {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.project-template-card__gallery {
  display: grid;
  grid-template-columns: repeat(5, minmax(0, 1fr));
  gap: 10px;
}

.project-template-card__gallery img {
  width: 100%;
  height: 90px;
  object-fit: cover;
  border-radius: 12px;
}

.project-template-card__video-pill {
  display: flex;
  align-items: center;
  justify-content: center;
  color: rgba(226, 232, 244, 0.9);
}

.project-template-card__details {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
}

.project-template-card__detail-group {
  gap: 10px;
}

.project-template-card__detail-group span {
  color: rgba(205, 214, 238, 0.76);
}

.project-template-card__detail-group pre {
  margin: 0;
  white-space: pre-wrap;
  word-break: break-word;
  color: rgba(226, 232, 244, 0.9);
  font-size: 12px;
}

.project-template-center-page__empty {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 18px;
  border-radius: 16px;
  background: rgba(9, 13, 23, 0.72);
}

@media (max-width: 1200px) {
  .project-template-card,
  .project-template-card__details {
    grid-template-columns: 1fr;
  }

  .project-template-card__summary-grid,
  .project-template-card__gallery {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (max-width: 720px) {
  .project-template-card__summary-grid,
  .project-template-card__gallery {
    grid-template-columns: 1fr;
  }

  .project-template-card__header,
  .project-template-card__footer {
    flex-direction: column;
  }
}
</style>
