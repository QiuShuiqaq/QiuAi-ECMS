<script setup>
defineProps({
  navItems: {
    type: Array,
    required: true
  },
  activeKey: {
    type: String,
    required: true
  },
  draftCount: {
    type: Number,
    default: 0
  }
})

const emit = defineEmits(['nav-select'])
</script>

<template>
  <header class="ecms-header">
    <div class="ecms-header__brand">
      <span class="ecms-header__mark">Q</span>
      <div class="ecms-header__copy">
        <strong>QiuAi</strong>
        <span>ECMS commerce cockpit</span>
      </div>
    </div>

    <nav class="ecms-header__tabs" aria-label="系统分页">
      <button
        v-for="item in navItems"
        :key="item.key"
        :class="['ecms-tab', { 'ecms-tab--active': item.key === activeKey }]"
        type="button"
        @click="emit('nav-select', item.key)"
      >
        <span>{{ item.label }}</span>
        <small v-if="item.badge">{{ item.badge }}</small>
      </button>
    </nav>

    <div class="ecms-header__status">
      <article class="ecms-status-pill">
        <span>Drafts</span>
        <strong>{{ draftCount }}</strong>
      </article>
      <article class="ecms-status-pill ecms-status-pill--accent">
        <span>Mode</span>
        <strong>Desktop</strong>
      </article>
    </div>
  </header>
</template>
