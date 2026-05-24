<script setup>
import { computed, reactive, ref } from 'vue'

const props = defineProps({
  pageKey: {
    type: String,
    required: true
  },
  title: {
    type: String,
    required: true
  },
  description: {
    type: String,
    required: true
  },
  sidebarItems: {
    type: Array,
    required: true
  },
  metrics: {
    type: Array,
    required: true
  },
  fieldGroups: {
    type: Array,
    required: true
  },
  resultGroups: {
    type: Array,
    required: true
  },
  queueItems: {
    type: Array,
    required: true
  }
})

const emit = defineEmits(['send-to-draft'])

const activeSection = ref(props.sidebarItems[0]?.key || '')
const formState = reactive(
  props.fieldGroups.reduce((state, group) => {
    group.fields.forEach((field) => {
      state[field.key] = field.value ?? ''
    })
    return state
  }, {})
)

const activeSidebarItem = computed(() => {
  return props.sidebarItems.find((item) => item.key === activeSection.value) || props.sidebarItems[0] || null
})

const activeFieldGroup = computed(() => {
  return props.fieldGroups.find((item) => item.key === activeSection.value) || props.fieldGroups[0] || null
})

const activeResultGroup = computed(() => {
  return props.resultGroups.find((item) => item.key === activeSection.value) || props.resultGroups[0] || null
})

function emitToDraft(item) {
  if (!item) {
    return
  }

  emit('send-to-draft', {
    source: props.pageKey,
    module: props.title,
    section: activeSidebarItem.value?.label || props.title,
    title: item.title,
    summary: item.summary,
    preview: item.preview || '',
    tags: item.tags || [],
    metadata: item.metrics || [],
    raw: {
      ...item,
      formState: { ...formState }
    }
  })
}
</script>

<template>
  <section class="ecms-page">
    <div class="ecms-page__hero">
      <div>
        <span class="ecms-page__eyebrow">{{ pageKey === 'text' ? '文本工作台' : '视频工作台' }}</span>
        <h1>{{ title }}</h1>
        <p>{{ description }}</p>
      </div>
      <div class="ecms-stat-grid">
        <article v-for="metric in metrics" :key="metric.label" class="ecms-stat-card">
          <span>{{ metric.label }}</span>
          <strong>{{ metric.value }}</strong>
          <small>{{ metric.hint }}</small>
        </article>
      </div>
    </div>

    <div class="ecms-board ecms-board--studio">
      <aside class="ecms-panel ecms-panel--sidebar">
        <header class="ecms-panel__header">
          <div>
            <h2>工作流</h2>
            <p>与生图页保持一致，先选任务模块，再配置参数，再看效果。</p>
          </div>
        </header>

        <div class="ecms-sidebar-list">
          <button
            v-for="item in sidebarItems"
            :key="item.key"
            :class="['ecms-sidebar-button', { 'ecms-sidebar-button--active': item.key === activeSection }]"
            type="button"
            @click="activeSection = item.key"
          >
            <strong>{{ item.label }}</strong>
            <span>{{ item.description }}</span>
          </button>
        </div>
      </aside>

      <section class="ecms-panel ecms-panel--main">
        <header class="ecms-panel__header">
          <div>
            <h2>{{ activeFieldGroup?.title }}</h2>
            <p>{{ activeFieldGroup?.description }}</p>
          </div>
          <button class="primary-action" type="button">
            提交任务
          </button>
        </header>

        <div class="ecms-form-grid">
          <article v-for="field in activeFieldGroup?.fields || []" :key="field.key" class="ecms-form-card">
            <label class="form-field">
              <span>{{ field.label }}</span>

              <textarea
                v-if="field.type === 'textarea'"
                v-model="formState[field.key]"
                :rows="field.rows || 4"
                :placeholder="field.placeholder || ''"
              ></textarea>

              <select
                v-else-if="field.type === 'select'"
                v-model="formState[field.key]"
              >
                <option v-for="option in field.options || []" :key="option" :value="option">
                  {{ option }}
                </option>
              </select>

              <input
                v-else
                v-model="formState[field.key]"
                :type="field.type || 'text'"
                :placeholder="field.placeholder || ''"
              />

              <small v-if="field.hint">{{ field.hint }}</small>
            </label>
          </article>
        </div>
      </section>

      <aside class="ecms-panel ecms-panel--sidebar">
        <header class="ecms-panel__header">
          <div>
            <h2>队列与草稿</h2>
            <p>这一区域专门给任务节奏和后续上架做预连接。</p>
          </div>
        </header>

        <div class="ecms-note-stack">
          <article v-for="item in queueItems" :key="item.title" class="ecms-note-card">
            <strong>{{ item.title }}</strong>
            <p>{{ item.description }}</p>
          </article>
        </div>
      </aside>
    </div>

    <section class="ecms-panel ecms-panel--results">
      <header class="ecms-panel__header">
        <div>
          <h2>{{ activeResultGroup?.title }}</h2>
          <p>{{ activeResultGroup?.description }}</p>
        </div>
      </header>

      <div class="ecms-result-grid">
        <article v-for="item in activeResultGroup?.items || []" :key="item.id" class="ecms-result-card">
          <div class="ecms-result-card__head">
            <div>
              <strong>{{ item.title }}</strong>
              <span>{{ item.subtitle }}</span>
            </div>
            <span class="platform-badge">{{ activeSidebarItem?.label }}</span>
          </div>

          <div v-if="item.preview" class="ecms-result-card__preview">
            <img :src="item.preview" :alt="item.title" />
          </div>

          <p>{{ item.summary }}</p>

          <ul class="ecms-result-card__list">
            <li v-for="point in item.highlights || []" :key="point">{{ point }}</li>
          </ul>

          <div class="ecms-result-card__metrics">
            <span v-for="metric in item.metrics || []" :key="`${item.id}-${metric.label}`">
              {{ metric.label }} · {{ metric.value }}
            </span>
          </div>

          <div class="ecms-result-card__tags">
            <span v-for="tag in item.tags || []" :key="tag">{{ tag }}</span>
          </div>

          <button class="secondary-action" type="button" @click="emitToDraft(item)">
            发送到草稿
          </button>
        </article>
      </div>
    </section>
  </section>
</template>
