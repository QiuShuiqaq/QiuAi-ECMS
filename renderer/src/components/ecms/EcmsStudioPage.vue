<script setup>
import { computed, reactive, ref, watch } from 'vue'
import WorkspaceSidebar from '../WorkspaceSidebar.vue'
import WorkspaceDashboard from '../WorkspaceDashboard.vue'
import PromptLibraryPanel from '../PromptLibraryPanel.vue'
import TaskManagerSidebar from '../TaskManagerSidebar.vue'

const props = defineProps({
  title: {
    type: String,
    required: true
  },
  description: {
    type: String,
    required: true
  },
  menuItems: {
    type: Array,
    required: true
  },
  overviewCards: {
    type: Array,
    required: true
  },
  parameterSections: {
    type: Object,
    required: true
  },
  resultSections: {
    type: Object,
    required: true
  },
  queueCards: {
    type: Array,
    required: true
  },
  tasks: {
    type: Array,
    default: () => []
  },
  menuLabel: {
    type: String,
    default: ''
  },
  exportItems: {
    type: Array,
    default: () => []
  },
  selectedExportIds: {
    type: Array,
    default: () => []
  },
  downloadCleanupEnabled: {
    type: Boolean,
    default: true
  },
  exportMenuKeys: {
    type: Array,
    default: () => []
  },
  workspaceDashboard: {
    type: Object,
    required: true
  },
  hostInfo: {
    type: Object,
    required: true
  },
  modelPricingCatalog: {
    type: Array,
    required: true
  },
  statusStates: {
    type: Object,
    default: () => ({})
  },
  submitStates: {
    type: Object,
    default: () => ({})
  },
  promptTemplates: {
    type: Array,
    default: () => []
  },
  negativePromptTemplates: {
    type: Array,
    default: () => []
  },
  serviceConfig: {
    type: Object,
    default: () => ({})
  },
  moduleKey: {
    type: String,
    default: ''
  },
  externalFormAction: {
    type: Object,
    default: null
  },
  defaultMenu: {
    type: String,
    default: ''
  },
  rememberedMenu: {
    type: String,
    default: ''
  },
  moduleLocked: {
    type: Boolean,
    default: false
  },
  moduleLockMessage: {
    type: String,
    default: ''
  },
  isRefreshingTotalCredits: {
    type: Boolean,
    default: false
  },
  isRefreshingRemainingCredits: {
    type: Boolean,
    default: false
  }
})

const emit = defineEmits([
  'send-to-draft',
  'submit-task',
  'save-template',
  'remove-template',
  'save-negative-template',
  'remove-negative-template',
  'refresh-total-credits',
  'refresh-remaining-credits',
  'service-config-update',
  'save-service-config',
  'pick-asset',
  'copy-result',
  'open-result-link',
  'toggle-export-item',
  'batch-download',
  'open-output-directory',
  'delete-export-item',
  'toggle-download-cleanup',
  'stop-task',
  'menu-change'
])

function resolveValidMenu(menuKey = '') {
  const normalizedMenuKey = String(menuKey || '').trim()
  if (props.menuItems.some((item) => item?.key === normalizedMenuKey)) {
    return normalizedMenuKey
  }

  const fallbackMenuKey = String(props.rememberedMenu || props.defaultMenu || props.menuItems[0]?.key || '').trim()
  if (props.menuItems.some((item) => item?.key === fallbackMenuKey)) {
    return fallbackMenuKey
  }

  return props.menuItems[0]?.key || ''
}

const activeMenu = ref(resolveValidMenu(props.rememberedMenu || props.defaultMenu))

function buildInitialFormState() {
  const state = {}

  Object.values(props.parameterSections || {}).forEach((section) => {
    (section?.groups || []).forEach((group) => {
      (group?.fields || []).forEach((field) => {
        if (!field?.key || Object.prototype.hasOwnProperty.call(state, field.key)) {
          return
        }

        if (field.type === 'select') {
          state[field.key] = field.value ?? field.options?.[0] ?? ''
          return
        }

        state[field.key] = field.value ?? ''
      })
    })
  })

  return state
}

const formState = reactive(buildInitialFormState())

const currentParameterSection = computed(() => {
  return props.parameterSections[activeMenu.value] || null
})

const currentResultSection = computed(() => {
  return props.resultSections[activeMenu.value] || null
})

const currentStatusState = computed(() => {
  return props.statusStates?.[activeMenu.value] || null
})

const currentStatusClassName = computed(() => {
  const tone = currentStatusState.value?.tone || 'info'
  return `ecms-status-card--${tone}`
})

const taskStatusClassMap = {
  等待中: 'task-status--waiting',
  进行中: 'task-status--running',
  待确认: 'task-status--running',
  已完成: 'task-status--completed',
  失败: 'task-status--failed'
}

const isSubmittingCurrentMenu = computed(() => {
  return Boolean(props.submitStates?.[activeMenu.value])
})

const submitButtonLabel = computed(() => {
  return isSubmittingCurrentMenu.value ? '生成中...' : '提交任务'
})

const latestTaskForActiveMenu = computed(() => {
  const currentTasks = Array.isArray(props.tasks) ? props.tasks : []
  return currentTasks.find((item) => item?.menuKey === activeMenu.value) || currentTasks[0] || null
})

const latestTaskProgressWidth = computed(() => {
  const rawProgress = Number(latestTaskForActiveMenu.value?.progress ?? 0)
  return `${Math.min(100, Math.max(0, rawProgress))}%`
})

const latestTaskStatusClass = computed(() => {
  return taskStatusClassMap[latestTaskForActiveMenu.value?.status] || 'task-status--waiting'
})

const latestTaskMeta = computed(() => {
  if (!latestTaskForActiveMenu.value) {
    return []
  }

  return [
    {
      label: '任务编号',
      value: latestTaskForActiveMenu.value.taskNumber || '--'
    },
    {
      label: '当前状态',
      value: latestTaskForActiveMenu.value.status || '--'
    },
    {
      label: '进度',
      value: `${Math.min(100, Math.max(0, Number(latestTaskForActiveMenu.value.progress ?? 0)))}%`
    },
    {
      label: '提交时间',
      value: latestTaskForActiveMenu.value.createdAt || '--'
    }
  ]
})

const fixedPromptTemplates = computed(() => {
  return props.promptTemplates.filter((item) => item?.source === 'system-fixed')
})

const customPromptTemplates = computed(() => {
  return props.promptTemplates.filter((item) => item?.source !== 'system-fixed')
})

const fixedNegativePromptTemplates = computed(() => {
  return props.negativePromptTemplates.filter((item) => item?.source === 'system-fixed')
})

const customNegativePromptTemplates = computed(() => {
  return props.negativePromptTemplates.filter((item) => item?.source !== 'system-fixed')
})

const modulePromptTemplates = computed(() => {
  const activeModule = props.moduleKey === 'text' || props.moduleKey === 'video'
    ? props.moduleKey
    : 'image'

  return (props.promptTemplates || []).filter((template) => {
    const templateModule = String(template?.module || '')
    return templateModule ? templateModule === activeModule : activeModule === 'image'
  })
})

const templateSelections = reactive({})

function buildTemplateOptionsForField(field = {}) {
  const fieldLabel = String(field?.label || '')
  const shouldUseVideoTemplates = props.moduleKey === 'video' && fieldLabel.includes('提示词')
  const shouldUseTextTemplates = props.moduleKey === 'text' && fieldLabel.includes('提示词')

  if (!shouldUseVideoTemplates && !shouldUseTextTemplates) {
    return []
  }

  return modulePromptTemplates.value
}

function getTemplateSelection(fieldKey = '') {
  return templateSelections[fieldKey] || ''
}

function updateTemplateSelection(fieldKey = '', templateId = '') {
  if (!fieldKey) {
    return
  }
  templateSelections[fieldKey] = String(templateId || '')
}

function applyTemplateToField(fieldKey = '', templateId = '') {
  if (!fieldKey || !templateId) {
    return
  }

  const targetTemplate = modulePromptTemplates.value.find((item) => item.id === templateId)
  if (!targetTemplate) {
    return
  }

  formState[fieldKey] = String(targetTemplate.prompt || '')
}

function handleMenuSelect(menuKey) {
  activeMenu.value = resolveValidMenu(menuKey)
}

function sendToDraft(group) {
  if (!group) {
    return
  }

  emit('send-to-draft', {
    source: props.title,
    module: props.title,
    section: group.title,
    title: group.title,
    summary: group.summary,
    preview: group.preview || '',
    tags: group.tags || [],
    metadata: group.metadata || [],
    draftPayload: {
      ...(group.draftPayload || {}),
      sourceModule: props.title,
      sourceMenu: activeMenu.value,
      formSnapshot: { ...formState }
    },
    sourceMetadata: group.draftPayload?.sourceMetadata || {},
    raw: group
  })
}

function handleSubmitTask() {
  if (props.moduleLocked) {
    return
  }

  emit('submit-task', {
    menuKey: activeMenu.value,
    formState: { ...formState }
  })
}

function applyExternalFormAction(action = {}) {
  if (!action || typeof action !== 'object') {
    return
  }

  if (typeof action.menuKey === 'string' && action.menuKey.trim()) {
    activeMenu.value = resolveValidMenu(action.menuKey)
  }

  const values = action.values && typeof action.values === 'object'
    ? action.values
    : {}

  Object.entries(values).forEach(([key, value]) => {
    formState[key] = value
  })
}

function handlePickAsset(fieldKey = '') {
  if (!fieldKey || props.moduleLocked) {
    return
  }

  emit('pick-asset', {
    moduleKey: props.moduleKey,
    menuKey: activeMenu.value,
    fieldKey
  })
}

function clearAssetField(fieldKey = '') {
  if (!fieldKey) {
    return
  }

  formState[fieldKey] = null
}

function getResultCopyPayload(group = {}) {
  const metadataLines = Array.isArray(group.metadata)
    ? group.metadata.map((item) => `${item.label || ''}: ${item.value || ''}`).filter(Boolean)
    : []

  return [
    group.outputTitle || '',
    group.summary || '',
    group.detail || '',
    ...metadataLines
  ].filter(Boolean).join('\n')
}

function handleCopyResult(group = {}) {
  emit('copy-result', {
    value: getResultCopyPayload(group),
    label: props.moduleKey === 'video' ? '视频结果' : '文本结果'
  })
}

function resolveResultLink(group = {}) {
  if (props.moduleKey !== 'video') {
    return ''
  }

  return String(
    group?.raw?.videoUrl ||
    group?.draftPayload?.editor?.videoAssetPlan ||
    ''
  ).trim()
}

function handleOpenResultLink(group = {}) {
  const targetUrl = resolveResultLink(group)
  if (!targetUrl) {
    return
  }

  emit('open-result-link', {
    targetUrl,
    label: '视频链接'
  })
}

const resultGridClassName = computed(() => {
  if (props.moduleKey === 'text' || props.moduleKey === 'video') {
    return 'group-output-grid group-output-grid--single'
  }

  return 'group-output-grid group-output-grid--scroll group-output-grid--visible-scroll'
})

watch(
  () => props.externalFormAction?.token,
  () => {
    applyExternalFormAction(props.externalFormAction)
  },
  { immediate: true }
)

watch(() => props.rememberedMenu, (nextMenu) => {
  const resolvedMenu = resolveValidMenu(nextMenu)
  if (resolvedMenu && resolvedMenu !== activeMenu.value) {
    activeMenu.value = resolvedMenu
  }
})

watch(activeMenu, (nextMenu) => {
  emit('menu-change', nextMenu)
}, { immediate: true })
</script>

<template>
  <section class="shell-grid ecms-studio-shell">
    <aside class="shell-grid__sidebar">
      <WorkspaceSidebar
        :menu-items="menuItems"
        :active-menu="activeMenu"
        @menu-select="handleMenuSelect"
      />
    </aside>

    <section class="shell-grid__workspace">
      <section
        :class="[
          'workspace-panels',
          {
            'workspace-panels--single': activeMenu === 'workspace' || activeMenu === 'model-pricing' || activeMenu === 'prompt-library',
            'workspace-panels--focus-display': activeMenu !== 'workspace' && activeMenu !== 'model-pricing' && activeMenu !== 'prompt-library'
          }
        ]"
      >
        <template v-if="activeMenu === 'workspace'">
          <section class="workspace-panel">
            <WorkspaceDashboard
              :workspace-dashboard="workspaceDashboard"
              :host-info="hostInfo"
              :service-config="serviceConfig"
              :is-refreshing-total-credits="isRefreshingTotalCredits"
              :is-refreshing-remaining-credits="isRefreshingRemainingCredits"
              @refresh-total-credits="emit('refresh-total-credits')"
              @refresh-remaining-credits="emit('refresh-remaining-credits')"
              @service-config-update="emit('service-config-update', $event)"
              @save-service-config="emit('save-service-config')"
            />
          </section>
        </template>

        <template v-else-if="activeMenu === 'model-pricing'">
          <section class="workspace-panel">
            <div class="panel-shell">
              <header class="section-header">
                <div>
                  <h2>模型价格</h2>
                </div>
              </header>

              <div class="panel-content panel-content--display-scroll module-scroll scrollbar-hidden">
                <div class="model-price-grid">
                  <article v-for="model in modelPricingCatalog" :key="model.name" class="model-price-card">
                    <div class="model-price-card__header">
                      <strong>{{ model.name }}</strong>
                      <span v-if="model.status" class="model-price-card__badge">{{ model.status }}</span>
                    </div>

                    <p v-if="model.credits" class="model-price-card__lead">{{ model.credits }}</p>
                    <p v-if="model.priceSummary" class="model-price-card__copy">{{ model.priceSummary }}</p>
                    <p v-if="model.outputSummary" class="model-price-card__copy">{{ model.outputSummary }}</p>
                    <p v-if="model.billing" class="model-price-card__meta">{{ model.billing }}</p>
                    <p v-if="model.refundPolicy" class="model-price-card__meta">{{ model.refundPolicy }}</p>

                    <div v-if="model.features?.length" class="model-price-card__tags">
                      <span v-for="feature in model.features" :key="`${model.name}-${feature}`">
                        {{ feature }}
                      </span>
                    </div>
                  </article>
                </div>
              </div>
            </div>
          </section>
        </template>

        <template v-else-if="activeMenu === 'prompt-library'">
          <section class="workspace-panel">
            <PromptLibraryPanel
              :mode="moduleKey === 'text' ? 'text' : (moduleKey === 'video' ? 'video' : 'image')"
              :fixed-prompt-templates="fixedPromptTemplates"
              :custom-prompt-templates="customPromptTemplates"
              :fixed-negative-prompt-templates="fixedNegativePromptTemplates"
              :custom-negative-prompt-templates="customNegativePromptTemplates"
              @save-template="emit('save-template', $event)"
              @remove-template="emit('remove-template', $event)"
              @save-negative-template="emit('save-negative-template', $event)"
              @remove-negative-template="emit('remove-negative-template', $event)"
            />
          </section>
        </template>

        <template v-else>
          <section class="workspace-panel workspace-panel--bordered">
            <div class="panel-shell">
              <header class="section-header">
                <div>
                  <h2>参数设置</h2>
                </div>
              </header>

              <div class="panel-content panel-content--scrollable panel-content--with-footer module-scroll scrollbar-hidden">
                <div class="ecms-parameter-stack">
                  <article
                    v-if="currentStatusState && moduleKey !== 'text'"
                    class="ecms-status-card"
                    :class="currentStatusClassName"
                  >
                    <div class="ecms-status-card__header">
                      <strong>{{ currentStatusState.title }}</strong>
                      <span v-if="currentStatusState.badge">{{ currentStatusState.badge }}</span>
                    </div>
                    <p>{{ currentStatusState.message }}</p>
                  </article>

                  <section
                    v-for="section in currentParameterSection?.groups || []"
                    :key="section.title"
                    class="ecms-parameter-card ecms-parameter-card--dense"
                  >
                    <h3>{{ section.title }}</h3>

                    <div class="ecms-parameter-grid">
                      <label
                        v-for="field in section.fields"
                        :key="field.label"
                        class="form-field"
                        :class="{
                          'ecms-field--half': field.layout === 'half',
                          'ecms-field--full': field.layout !== 'half'
                        }"
                      >
                        <span>{{ field.label }}</span>

                        <div v-if="field.type === 'textarea'" class="ecms-template-field">
                          <div v-if="field.templateEnabled" class="ecms-template-toolbar">
                            <select
                              :value="getTemplateSelection(field.key)"
                              :disabled="moduleLocked"
                              @change="updateTemplateSelection(field.key, $event.target.value)"
                            >
                              <option value="">选择提示词库模板</option>
                              <option
                                v-for="template in buildTemplateOptionsForField(field)"
                                :key="template.id"
                                :value="template.id"
                              >
                                {{ template.name }}
                              </option>
                            </select>
                            <button
                              class="secondary-action secondary-action--compact"
                              type="button"
                              :disabled="moduleLocked || !getTemplateSelection(field.key)"
                              @click="applyTemplateToField(field.key, getTemplateSelection(field.key))"
                            >
                              套用模板
                            </button>
                          </div>

                          <textarea
                            v-model="formState[field.key]"
                            :rows="field.rows || 4"
                            :placeholder="field.placeholder"
                            :disabled="moduleLocked"
                          ></textarea>
                        </div>

                        <select v-else-if="field.type === 'select'" v-model="formState[field.key]" :disabled="moduleLocked">
                          <option v-for="option in field.options" :key="option" :value="option">
                            {{ option }}
                          </option>
                        </select>

                        <div v-else-if="field.type === 'asset'" class="ecms-asset-field">
                          <div v-if="formState[field.key]?.preview" class="ecms-asset-field__preview">
                            <img :src="formState[field.key].preview" :alt="formState[field.key]?.name || field.label">
                          </div>

                          <div class="ecms-asset-field__actions">
                            <button
                              class="secondary-action secondary-action--compact"
                              type="button"
                              :disabled="moduleLocked"
                              @click="handlePickAsset(field.key)"
                            >
                              {{ field.buttonLabel || '上传图片' }}
                            </button>

                            <button
                              v-if="formState[field.key]"
                              class="secondary-action secondary-action--compact"
                              type="button"
                              :disabled="moduleLocked"
                              @click="clearAssetField(field.key)"
                            >
                              清除图片
                            </button>
                          </div>
                        </div>

                        <input
                          v-else
                          v-model="formState[field.key]"
                          :type="field.type || 'text'"
                          :placeholder="field.placeholder"
                          :disabled="moduleLocked"
                        />
                      </label>
                    </div>
                  </section>
                </div>
              </div>

              <footer class="panel-footer">
                <button class="primary-action" type="button" :disabled="isSubmittingCurrentMenu || moduleLocked" @click="handleSubmitTask">
                  {{ submitButtonLabel }}
                </button>
              </footer>
            </div>
          </section>

          <section class="workspace-panel workspace-panel--display">
            <div class="panel-shell">
              <header class="section-header">
                <div>
                  <h2>效果展示</h2>
                </div>
              </header>

              <div class="panel-content panel-content--display-scroll module-scroll scrollbar-hidden">
                <section v-if="latestTaskForActiveMenu" class="latest-task-progress">
                  <div class="latest-task-progress__header">
                    <div>
                      <h3>任务进度</h3>
                    </div>
                    <strong :class="['task-status', latestTaskStatusClass]">{{ latestTaskForActiveMenu?.status || '--' }}</strong>
                  </div>

                  <div class="latest-task-progress__meta">
                    <article v-for="item in latestTaskMeta" :key="item.label" class="latest-task-progress__item">
                      <span>{{ item.label }}</span>
                      <strong>{{ item.value }}</strong>
                    </article>
                  </div>

                  <div class="task-progress">
                    <span class="latest-task-progress__bar" :style="{ width: latestTaskProgressWidth }"></span>
                  </div>

                  <article
                    v-if="latestTaskForActiveMenu?.status === '失败' && latestTaskForActiveMenu?.error"
                    class="latest-task-progress__item"
                  >
                    <span>失败原因</span>
                    <strong>{{ latestTaskForActiveMenu.error }}</strong>
                  </article>
                </section>

                <section class="result-group-block">
                  <article v-for="group in currentResultSection?.groups || []" :key="group.id" class="result-group-card">
                    <div class="result-group-card__header">
                      <strong>{{ group.title }}</strong>
                      <span class="result-group-card__elapsed">{{ group.subtitle }}</span>
                    </div>

                    <div :class="resultGridClassName">
                      <article class="comparison-card comparison-card--adaptive ecms-group-card">
                        <button
                          v-if="group.preview"
                          class="image-preview-button comparison-card__preview"
                          type="button"
                        >
                          <img :src="group.preview" :alt="group.title" />
                        </button>

                        <div class="ecms-group-card__copy">
                          <strong>{{ group.outputTitle }}</strong>
                          <p>{{ group.summary }}</p>
                        </div>

                        <div class="ecms-group-card__meta">
                          <span v-for="item in group.metadata || []" :key="`${group.id}-${item.label}`">
                            {{ item.label }} / {{ item.value }}
                          </span>
                        </div>

                        <label v-if="group.detail && moduleKey !== 'text'" class="form-field comparison-card__prompt">
                          <span>内容详情</span>
                          <textarea :value="group.detail" rows="4" readonly></textarea>
                        </label>

                        <div class="ecms-result-actions">
                          <button
                            class="secondary-action secondary-action--compact"
                            type="button"
                            @click="handleCopyResult(group)"
                          >
                            复制内容
                          </button>
                          <button
                            v-if="moduleKey === 'video' && resolveResultLink(group)"
                            class="secondary-action secondary-action--compact"
                            type="button"
                            @click="handleOpenResultLink(group)"
                          >
                            打开视频
                          </button>
                          <button class="secondary-action comparison-card__draft-button" type="button" :disabled="moduleLocked" @click="sendToDraft(group)">
                            发送到草稿
                          </button>
                        </div>
                        <p v-if="moduleLocked && moduleLockMessage" class="ecms-lock-hint">
                          {{ moduleLockMessage }}
                        </p>
                      </article>
                    </div>
                  </article>
                </section>
              </div>
            </div>
          </section>
        </template>
      </section>
    </section>

    <aside class="shell-grid__tasks">
      <TaskManagerSidebar
        :tasks="tasks"
        :active-menu="activeMenu"
        :menu-label="menuLabel || title"
        :export-items="exportItems"
        :selected-export-ids="selectedExportIds"
        :download-cleanup-enabled="downloadCleanupEnabled"
        :export-menu-keys="exportMenuKeys"
        @toggle-export-item="emit('toggle-export-item', $event)"
        @batch-download="emit('batch-download')"
        @open-output-directory="emit('open-output-directory', $event)"
        @delete-export-item="emit('delete-export-item', $event)"
        @toggle-download-cleanup="emit('toggle-download-cleanup', $event)"
        @stop-task="emit('stop-task', $event)"
      />
    </aside>
  </section>
</template>
