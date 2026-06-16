<script setup>
import FormTextControl from './FormTextControl.vue'

defineProps({
  textApiKey: {
    type: String,
    default: ''
  },
  imageApiKey: {
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

const emit = defineEmits([
  'update-text-api-key',
  'update-image-api-key',
  'update-video-api-key',
  'save'
])
</script>

<template>
  <section class="model-config-page">
    <div class="model-config-panel">
      <div class="model-config-stack">
        <label class="form-field model-config-field">
          <span>文本</span>
          <FormTextControl
            :model-value="textApiKey"
            class="model-config-input"
            type="password"
            placeholder="Text API Key"
            @update:model-value="emit('update-text-api-key', $event)"
          />
        </label>

        <label class="form-field model-config-field">
          <span>图片</span>
          <FormTextControl
            :model-value="imageApiKey"
            class="model-config-input"
            type="password"
            placeholder="Image API Key"
            @update:model-value="emit('update-image-api-key', $event)"
          />
        </label>

        <label class="form-field model-config-field">
          <span>视频</span>
          <FormTextControl
            :model-value="videoApiKey"
            class="model-config-input"
            type="password"
            placeholder="Video API Key"
            @update:model-value="emit('update-video-api-key', $event)"
          />
        </label>
      </div>

      <p v-if="feedbackMessage" class="model-config-feedback">
        {{ feedbackMessage }}
      </p>

      <div class="model-config-actions">
        <button class="primary-action" type="button" :disabled="isSaving" @click="emit('save')">
          保存
        </button>
      </div>
    </div>
  </section>
</template>
