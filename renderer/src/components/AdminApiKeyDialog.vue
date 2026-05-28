<script setup>
import { computed } from 'vue'
import FormTextControl from './FormTextControl.vue'

const props = defineProps({
  visible: {
    type: Boolean,
    default: false
  },
  apiKey: {
    type: String,
    default: ''
  },
  videoApiKey: {
    type: String,
    default: ''
  },
  isSaving: {
    type: Boolean,
    default: false
  },
  feedbackMessage: {
    type: String,
    default: ''
  }
})

const emit = defineEmits(['update-api-key', 'update-video-api-key', 'save', 'close'])

const apiKeyModel = computed({
  get() {
    return props.apiKey || ''
  },
  set(value) {
    emit('update-api-key', value)
  }
})

const videoApiKeyModel = computed({
  get() {
    return props.videoApiKey || ''
  },
  set(value) {
    emit('update-video-api-key', value)
  }
})
</script>

<template>
  <div v-if="visible" class="admin-api-key-modal">
    <div class="admin-api-key-modal__card">
      <header class="admin-api-key-modal__header">
        <strong>管理员 API-Key 配置</strong>
      </header>

      <label class="form-field">
        <span>生图 API-Key</span>
        <FormTextControl
          v-model="apiKeyModel"
          class="admin-api-key-modal__input"
          type="text"
          placeholder="请输入生图 API-Key"
        />
      </label>

      <label class="form-field">
        <span>视频 API-Key</span>
        <FormTextControl
          v-model="videoApiKeyModel"
          class="admin-api-key-modal__input"
          type="text"
          placeholder="请输入视频 API-Key"
        />
      </label>

      <p v-if="feedbackMessage" class="admin-api-key-modal__feedback">
        {{ feedbackMessage }}
      </p>

      <footer class="admin-api-key-modal__actions">
        <button class="secondary-action" type="button" @click="emit('close')">
          关闭
        </button>
        <button class="primary-action" type="button" :disabled="isSaving" @click="emit('save')">
          保存
        </button>
      </footer>
    </div>
  </div>
</template>
