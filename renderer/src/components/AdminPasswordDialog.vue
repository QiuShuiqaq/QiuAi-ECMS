<script setup>
import { computed } from 'vue'
import FormTextControl from './FormTextControl.vue'

const props = defineProps({
  visible: {
    type: Boolean,
    default: false
  },
  password: {
    type: String,
    default: ''
  },
  isSubmitting: {
    type: Boolean,
    default: false
  },
  feedbackMessage: {
    type: String,
    default: ''
  },
  title: {
    type: String,
    default: '管理员验证'
  },
  description: {
    type: String,
    default: '请输入管理员口令'
  },
  confirmLabel: {
    type: String,
    default: '确认'
  }
})

const emit = defineEmits(['update-password', 'confirm', 'close'])

const passwordModel = computed({
  get() {
    return props.password || ''
  },
  set(value) {
    emit('update-password', value)
  }
})
</script>

<template>
  <div v-if="visible" class="admin-password-modal">
    <div class="admin-password-modal__card">
      <header class="admin-password-modal__header">
        <strong>{{ title }}</strong>
        <span>{{ description }}</span>
      </header>

      <FormTextControl
        v-model="passwordModel"
        class="admin-password-modal__input"
        type="password"
        placeholder="请输入管理员口令"
      />

      <p v-if="feedbackMessage" class="admin-password-modal__feedback">
        {{ feedbackMessage }}
      </p>

      <footer class="admin-password-modal__actions">
        <button class="secondary-action" type="button" @click="emit('close')">
          取消
        </button>
        <button class="primary-action" type="button" :disabled="isSubmitting" @click="emit('confirm')">
          {{ confirmLabel }}
        </button>
      </footer>
    </div>
  </div>
</template>
