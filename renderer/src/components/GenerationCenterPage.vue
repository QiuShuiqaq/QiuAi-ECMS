<script setup>
import { computed, ref } from 'vue'

import ProductWorkbench from './ProductWorkbench.vue'
import { generatorShortcutOptions, resolveGeneratorView } from '../utils/generatorViews'

const props = defineProps({
  productProjects: { type: Array, default: () => [] },
  projectRuns: { type: Array, default: () => [] },
  activeProjectId: { type: String, default: '' },
  focusProjectId: { type: String, default: '' },
  submitButtonState: { type: String, default: 'idle' },
  publishState: { type: Object, default: () => ({}) },
  selectionManifest: { type: Object, default: () => ({ generatedAt: '', boards: [] }) },
  selectionPlatforms: { type: Array, default: () => [] },
  selectionSites: { type: Array, default: () => [] },
  selectionState: {
    type: Object,
    default: () => ({
      items: [],
      totalItems: 0,
      platform: 'temu',
      boardType: 'hot-sale',
      siteCode: '',
      keyword: '',
      isLoading: false,
      error: ''
    })
  }
})

const emit = defineEmits([
  'create-project',
  'run-project',
  'replace-project-image',
  'update-project',
  'delete-project',
  'copy-text',
  'open-images',
  'open-video',
  'open-resource',
  'export-project',
  'open-generator',
  'sync-publish-draft',
  'publish-platform-change',
  'publish-channel-account-change',
  'publish-preview',
  'publish-create-task',
  'publish-sync-task',
  'publish-refresh-task',
  'publish-retry-task',
  'selection-query-change',
  'selection-import'
])

const isAdvancedWorkspaceVisible = ref(false)

const projectRunMap = computed(() => new Map((props.projectRuns || []).map((item) => [item.id, item])))

const recentProjects = computed(() => {
  return [...(props.productProjects || [])]
    .sort((left, right) => {
      const rightTime = new Date(right?.updatedAt || right?.createdAt || 0).getTime()
      const leftTime = new Date(left?.updatedAt || left?.createdAt || 0).getTime()
      return rightTime - leftTime
    })
    .slice(0, 6)
    .map((project) => ({
      project,
      latestRun: projectRunMap.value.get(project.latestRunId) || null
    }))
})

function resolveShortcutTitle(menuKey = '') {
  return resolveGeneratorView(menuKey)?.title || menuKey
}

function resolveProjectName(project = {}) {
  return String(project?.name || project?.baseInfo?.productName || '未命名项目').trim() || '未命名项目'
}

function resolveProjectMeta(project = {}, latestRun = null) {
  const platform = Array.isArray(project?.platformTarget) ? project.platformTarget.join(' / ') : ''
  const status = String(latestRun?.status || 'draft').trim() || 'draft'
  return [platform, status].filter(Boolean).join(' / ') || '待执行'
}

function handleQuickStart(menuKey) {
  emit('open-generator', { project: null, menuKey })
}

function handleProjectShortcut(project, menuKey) {
  emit('open-generator', { project, menuKey })
}

function toggleAdvancedWorkspace() {
  isAdvancedWorkspaceVisible.value = !isAdvancedWorkspaceVisible.value
}
</script>

<template>
  <section class="generation-center-page">
    <header class="generation-center-page__hero">
      <div>
        <span class="generation-center-page__eyebrow">Generation Center</span>
        <h1>生成中心</h1>
      </div>

      <div class="generation-center-page__hero-actions">
        <button class="primary-action" type="button" @click="emit('create-project')">新建项目</button>
        <button class="secondary-action" type="button" @click="toggleAdvancedWorkspace">
          {{ isAdvancedWorkspaceVisible ? '收起高级区' : '展开高级区' }}
        </button>
      </div>
    </header>

    <section class="generation-center-page__panel">
      <header class="generation-center-page__panel-header">
        <strong>快捷入口</strong>
      </header>

      <div class="generation-center-page__shortcut-grid">
        <button
          v-for="option in generatorShortcutOptions"
          :key="option.key"
          class="generation-center-page__shortcut-card"
          type="button"
          @click="handleQuickStart(option.key)"
        >
          <strong>{{ option.label }}</strong>
          <span>{{ resolveShortcutTitle(option.key) }}</span>
        </button>
      </div>
    </section>

    <section class="generation-center-page__panel">
      <header class="generation-center-page__panel-header">
        <strong>最近项目</strong>
      </header>

      <div class="generation-center-page__project-list">
        <article
          v-for="item in recentProjects"
          :key="item.project.id"
          class="generation-center-page__project-card"
        >
          <div class="generation-center-page__project-copy">
            <strong>{{ resolveProjectName(item.project) }}</strong>
            <span>{{ resolveProjectMeta(item.project, item.latestRun) }}</span>
          </div>

          <div class="generation-center-page__project-actions">
            <button class="secondary-action" type="button" @click="emit('run-project', item.project)">整项目运行</button>
            <button class="secondary-action" type="button" @click="handleProjectShortcut(item.project, 'title-generate')">标题</button>
            <button class="secondary-action" type="button" @click="handleProjectShortcut(item.project, 'description-generate')">描述</button>
            <button class="secondary-action" type="button" @click="handleProjectShortcut(item.project, 'series-generate')">套图</button>
            <button class="secondary-action" type="button" @click="handleProjectShortcut(item.project, 'video-generate')">视频</button>
          </div>
        </article>

        <article v-if="!recentProjects.length" class="generation-center-page__empty">
          <strong>暂无项目</strong>
        </article>
      </div>
    </section>

    <section class="generation-center-page__panel">
      <header class="generation-center-page__panel-header">
        <strong>高级区</strong>
      </header>

      <div v-if="isAdvancedWorkspaceVisible" class="generation-center-page__advanced">
        <ProductWorkbench
          :product-projects="productProjects"
          :project-runs="projectRuns"
          :active-project-id="activeProjectId"
          :focus-project-id="focusProjectId"
          :submit-button-state="submitButtonState"
          :publish-state="publishState"
          :selection-manifest="selectionManifest"
          :selection-platforms="selectionPlatforms"
          :selection-sites="selectionSites"
          :selection-state="selectionState"
          @create-project="emit('create-project')"
          @run-project="emit('run-project', $event)"
          @replace-project-image="emit('replace-project-image', $event)"
          @update-project="emit('update-project', $event)"
          @delete-project="emit('delete-project', $event)"
          @copy-text="emit('copy-text', $event)"
          @open-images="emit('open-images', $event)"
          @open-video="emit('open-video', $event)"
          @open-resource="emit('open-resource', $event)"
          @export-project="emit('export-project', $event)"
          @open-generator="emit('open-generator', $event)"
          @sync-publish-draft="emit('sync-publish-draft', $event)"
          @publish-platform-change="emit('publish-platform-change', $event)"
          @publish-channel-account-change="emit('publish-channel-account-change', $event)"
          @publish-preview="emit('publish-preview', $event)"
          @publish-create-task="emit('publish-create-task', $event)"
          @publish-sync-task="emit('publish-sync-task', $event)"
          @publish-refresh-task="emit('publish-refresh-task', $event)"
          @publish-retry-task="emit('publish-retry-task', $event)"
          @selection-query-change="emit('selection-query-change', $event)"
          @selection-import="emit('selection-import', $event)"
        />
      </div>

      <div v-else class="generation-center-page__advanced-placeholder">
        <span>已收起</span>
      </div>
    </section>
  </section>
</template>

<style scoped>
.generation-center-page {
  display: flex;
  flex-direction: column;
  gap: 18px;
}

.generation-center-page__hero,
.generation-center-page__panel,
.generation-center-page__shortcut-card,
.generation-center-page__project-card,
.generation-center-page__empty,
.generation-center-page__advanced-placeholder {
  border-radius: 22px;
  border: 1px solid rgba(255, 255, 255, 0.08);
  background: rgba(14, 18, 30, 0.88);
}

.generation-center-page__hero,
.generation-center-page__panel {
  padding: 22px;
}

.generation-center-page__hero {
  display: flex;
  justify-content: space-between;
  gap: 20px;
}

.generation-center-page__hero h1,
.generation-center-page__panel-header {
  margin: 0;
}

.generation-center-page__panel-header span,
.generation-center-page__shortcut-card span,
.generation-center-page__project-copy span,
.generation-center-page__advanced-placeholder span,
.generation-center-page__empty span {
  color: rgba(205, 214, 238, 0.76);
}

.generation-center-page__eyebrow {
  display: inline-flex;
  margin-bottom: 10px;
  font-size: 12px;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: rgba(118, 173, 255, 0.88);
}

.generation-center-page__hero-actions,
.generation-center-page__project-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
}

.generation-center-page__hero-actions {
  align-items: flex-start;
  justify-content: flex-end;
  min-width: 220px;
}

.generation-center-page__panel {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.generation-center-page__panel-header {
  display: flex;
  justify-content: space-between;
  gap: 16px;
}

.generation-center-page__shortcut-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 12px;
}

.generation-center-page__shortcut-card {
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 18px;
  text-align: left;
}

.generation-center-page__shortcut-card strong,
.generation-center-page__project-copy strong {
  font-size: 16px;
}

.generation-center-page__project-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.generation-center-page__project-card,
.generation-center-page__empty,
.generation-center-page__advanced-placeholder {
  padding: 16px 18px;
}

.generation-center-page__project-card {
  display: flex;
  justify-content: space-between;
  gap: 16px;
}

.generation-center-page__project-copy {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.generation-center-page__empty,
.generation-center-page__advanced-placeholder {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.generation-center-page__advanced {
  display: flex;
}

@media (max-width: 1200px) {
  .generation-center-page__shortcut-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (max-width: 1080px) {
  .generation-center-page__hero,
  .generation-center-page__panel-header,
  .generation-center-page__project-card {
    flex-direction: column;
  }

  .generation-center-page__hero-actions {
    min-width: 0;
    justify-content: flex-start;
  }
}

@media (max-width: 720px) {
  .generation-center-page__shortcut-grid {
    grid-template-columns: 1fr;
  }
}
</style>
