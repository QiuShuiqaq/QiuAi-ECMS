<script setup>
import PromptLibraryPanel from './PromptLibraryPanel.vue'

defineProps({
  promptTemplates: {
    type: Array,
    default: () => []
  }
})

defineEmits(['save-template', 'remove-template'])
</script>

<template>
  <section class="settings-center-page">
    <header class="settings-center-page__hero">
      <div>
        <span class="settings-center-page__eyebrow">Settings</span>
        <h1>设置</h1>
      </div>
    </header>

    <section class="settings-center-page__panel">
      <PromptLibraryPanel
        :prompt-templates="promptTemplates"
        @save-template="$emit('save-template', $event)"
        @remove-template="$emit('remove-template', $event)"
      />
    </section>
  </section>
</template>

<style scoped>
.settings-center-page {
  display: flex;
  flex-direction: column;
  gap: 18px;
}

.settings-center-page__hero,
.settings-center-page__panel {
  border-radius: 22px;
  border: 1px solid rgba(255, 255, 255, 0.08);
  background: rgba(14, 18, 30, 0.88);
}

.settings-center-page__hero {
  padding: 22px;
}

.settings-center-page__hero h1 {
  margin: 0;
}

.settings-center-page__eyebrow {
  display: inline-flex;
  margin-bottom: 10px;
  font-size: 12px;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: rgba(118, 173, 255, 0.88);
}

.settings-center-page__panel {
  padding: 20px;
}
</style>
