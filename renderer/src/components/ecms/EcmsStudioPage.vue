<script setup>
import { computed, reactive, ref } from 'vue'
import WorkspaceSidebar from '../WorkspaceSidebar.vue'
import WorkspaceDashboard from '../WorkspaceDashboard.vue'
import PromptLibraryPanel from '../PromptLibraryPanel.vue'

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
  defaultMenu: {
    type: String,
    default: ''
  }
})

const emit = defineEmits([
  'send-to-draft',
  'submit-task',
  'save-template',
  'remove-template',
  'save-negative-template',
  'remove-negative-template'
])

const activeMenu = ref(props.defaultMenu || props.menuItems[0]?.key || '')

function buildInitialFormState() {
  const state = {}

  Object.values(props.parameterSections || {}).forEach((section) => {
    ;(section?.groups || []).forEach((group) => {
      ;(group?.fields || []).forEach((field) => {
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

const isSubmittingCurrentMenu = computed(() => {
  return Boolean(props.submitStates?.[activeMenu.value])
})

const submitButtonLabel = computed(() => {
  return isSubmittingCurrentMenu.value ? '生成中...' : '提交任务'
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

function handleMenuSelect(menuKey) {
  activeMenu.value = menuKey
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
    raw: group
  })
}

function handleSubmitTask() {
  emit('submit-task', {
    menuKey: activeMenu.value,
    formState: { ...formState }
  })
}
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
              :is-refreshing-total-credits="false"
              :is-refreshing-remaining-credits="false"
            />
          </section>
        </template>

        <template v-else-if="activeMenu === 'model-pricing'">
          <section class="workspace-panel">
            <div class="panel-shell">
              <header class="section-header">
                <div>
                  <h2>模型价格</h2>
                  <p class="section-copy">沿用生图页的模型价格视图，方便文本与视频后续接入统一计费。</p>
                </div>
              </header>

              <div class="panel-content panel-content--display-scroll module-scroll scrollbar-hidden">
                <div class="model-price-grid">
                  <article v-for="model in modelPricingCatalog" :key="model.name" class="model-price-card">
                    <strong>{{ model.name }}</strong>
                    <span>{{ model.credits }}</span>
                  </article>
                </div>
              </div>
            </div>
          </section>
        </template>

        <template v-else-if="activeMenu === 'prompt-library'">
          <section class="workspace-panel">
            <PromptLibraryPanel
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
                  <p class="section-copy">{{ currentParameterSection?.description }}</p>
                </div>
              </header>

              <div class="panel-content panel-content--scrollable panel-content--with-footer module-scroll scrollbar-hidden">
                <div class="ecms-parameter-stack">
                  <article
                    v-if="currentStatusState"
                    class="ecms-status-card"
                    :class="currentStatusClassName"
                  >
                    <div class="ecms-status-card__header">
                      <strong>{{ currentStatusState.title }}</strong>
                      <span v-if="currentStatusState.badge">{{ currentStatusState.badge }}</span>
                    </div>
                    <p>{{ currentStatusState.message }}</p>
                    <small v-if="currentStatusState.detail">{{ currentStatusState.detail }}</small>
                  </article>

                  <section v-for="section in currentParameterSection?.groups || []" :key="section.title" class="ecms-parameter-card">
                    <h3>{{ section.title }}</h3>
                    <p class="section-copy">{{ section.copy }}</p>

                    <label v-for="field in section.fields" :key="field.label" class="form-field">
                      <span>{{ field.label }}</span>

                      <textarea
                        v-if="field.type === 'textarea'"
                        v-model="formState[field.key]"
                        :rows="field.rows || 4"
                        :placeholder="field.placeholder"
                      ></textarea>

                      <select v-else-if="field.type === 'select'" v-model="formState[field.key]">
                        <option v-for="option in field.options" :key="option" :value="option">
                          {{ option }}
                        </option>
                      </select>

                      <input
                        v-else
                        v-model="formState[field.key]"
                        :type="field.type || 'text'"
                        :placeholder="field.placeholder"
                      />

                      <small v-if="field.hint">{{ field.hint }}</small>
                    </label>
                  </section>
                </div>
              </div>

              <footer class="panel-footer">
                <button class="primary-action" type="button" :disabled="isSubmittingCurrentMenu" @click="handleSubmitTask">
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
                  <p class="section-copy">{{ currentResultSection?.description }}</p>
                </div>
              </header>

              <div class="panel-content panel-content--display-scroll module-scroll scrollbar-hidden">
                <section class="result-group-block">
                  <article v-for="group in currentResultSection?.groups || []" :key="group.id" class="result-group-card">
                    <div class="result-group-card__header">
                      <strong>{{ group.title }}</strong>
                      <span class="result-group-card__elapsed">{{ group.subtitle }}</span>
                    </div>

                    <div class="group-output-grid group-output-grid--scroll group-output-grid--visible-scroll">
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
                            {{ item.label }} · {{ item.value }}
                          </span>
                        </div>

                        <label v-if="group.detail" class="form-field comparison-card__prompt">
                          <span>内容详情</span>
                          <textarea :value="group.detail" rows="4" readonly></textarea>
                        </label>

                        <button class="secondary-action comparison-card__draft-button" type="button" @click="sendToDraft(group)">
                          发送到草稿
                        </button>
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
      <section class="task-sidebar-shell task-sidebar-shell--card">
        <header class="section-header">
          <div>
            <h2>任务侧栏</h2>
            <p class="section-copy">保持和生图同样的三栏节奏，这里先承接任务与草稿说明。</p>
          </div>
        </header>

        <div class="panel-content panel-content--display-scroll module-scroll scrollbar-hidden">
          <div class="ecms-queue-stack">
            <article v-for="card in queueCards" :key="card.title" class="ecms-queue-card">
              <strong>{{ card.title }}</strong>
              <p>{{ card.description }}</p>
            </article>
          </div>
        </div>
      </section>
    </aside>
  </section>
</template>
