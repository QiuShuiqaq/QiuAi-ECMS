<script setup>
defineProps({
  tasks: {
    type: Array,
    default: () => []
  }
})

const emit = defineEmits(['open-output'])

function resolveTaskTitle(task = {}) {
  return String(task.title || task.taskName || task.taskNumber || '未命名任务').trim() || '未命名任务'
}

function resolveTaskStatus(task = {}) {
  return String(task.status || '').trim() || '等待中'
}

function resolveProgress(task = {}) {
  return `${Number(task.progress || 0)}%`
}

function resolveOutputDirectory(task = {}) {
  return String(task.outputDirectory || '').trim()
}
</script>

<template>
  <section class="results-center-page">
    <header class="results-center-page__hero">
      <div>
        <span class="results-center-page__eyebrow">Results</span>
        <h1>结果中心</h1>
      </div>
    </header>

    <section class="results-center-page__panel">
      <article v-for="task in tasks" :key="task.id || task.taskNumber" class="results-center-page__item">
        <div class="results-center-page__copy">
          <strong>{{ resolveTaskTitle(task) }}</strong>
          <span>{{ resolveTaskStatus(task) }} / {{ resolveProgress(task) }}</span>
          <small>{{ resolveOutputDirectory(task) || '无输出目录' }}</small>
        </div>
        <button
          class="secondary-action"
          type="button"
          :disabled="!resolveOutputDirectory(task)"
          @click="emit('open-output', task)"
        >
          打开目录
        </button>
      </article>

      <article v-if="!tasks.length" class="results-center-page__item results-center-page__item--empty">
        <strong>暂无结果</strong>
      </article>
    </section>
  </section>
</template>

<style scoped>
.results-center-page {
  display: flex;
  flex-direction: column;
  gap: 18px;
}

.results-center-page__hero,
.results-center-page__panel {
  border-radius: 22px;
  border: 1px solid rgba(255, 255, 255, 0.08);
  background: rgba(14, 18, 30, 0.88);
}

.results-center-page__hero {
  padding: 22px;
}

.results-center-page__hero h1 {
  margin: 0;
}

.results-center-page__copy span,
.results-center-page__copy small {
  color: rgba(205, 214, 238, 0.76);
}

.results-center-page__eyebrow {
  display: inline-flex;
  margin-bottom: 10px;
  font-size: 12px;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: rgba(118, 173, 255, 0.88);
}

.results-center-page__panel {
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 20px;
}

.results-center-page__item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 16px;
  border-radius: 16px;
  background: rgba(9, 13, 23, 0.72);
}

.results-center-page__copy {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.results-center-page__item--empty {
  flex-direction: column;
  align-items: flex-start;
}

@media (max-width: 1080px) {
  .results-center-page__item {
    flex-direction: column;
    align-items: flex-start;
  }
}
</style>
