<script setup>
import { computed } from 'vue'

const props = defineProps({
  menuItems: {
    type: Array,
    required: true
  },
  activeMenu: {
    type: String,
    required: true
  }
})

const emit = defineEmits(['menu-select'])

const groupOrder = ['项目', '生成', '系统']

const groupedMenuItems = computed(() => {
  return groupOrder
    .map((section) => ({
      section,
      items: props.menuItems.filter((item) => item.section === section)
    }))
    .filter((group) => group.items.length)
})

function handleMenuClick(menuKey) {
  emit('menu-select', menuKey)
}
</script>

<template>
  <section class="sidebar-shell module-scroll">
    <div class="sidebar-shell__brand">
      <div class="sidebar-shell__brand-mark">
        <span class="sidebar-shell__brand-orb"></span>
        <div class="sidebar-shell__brand-copy">
          <span class="sidebar-shell__eyebrow">QiuAi ECMS</span>
          <strong>商品工作流</strong>
        </div>
      </div>
    </div>

    <div class="sidebar-shell__groups scrollbar-hidden">
      <section v-for="group in groupedMenuItems" :key="group.section" class="sidebar-group">
        <header class="sidebar-group__header">
          <span>{{ group.section }}</span>
        </header>

        <div class="sidebar-group__items">
          <button
            v-for="item in group.items"
            :key="item.key"
            class="sidebar-menu-button"
            :class="{ 'sidebar-menu-button--active': item.key === activeMenu }"
            type="button"
            @click="handleMenuClick(item.key)"
          >
            <span class="sidebar-menu-button__accent"></span>
            <div class="sidebar-menu-button__copy">
              <span class="sidebar-menu-button__label">{{ item.label }}</span>
            </div>
          </button>
        </div>
      </section>
    </div>
  </section>
</template>
