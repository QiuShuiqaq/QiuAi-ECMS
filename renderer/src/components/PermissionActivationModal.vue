<script setup>
const props = defineProps({
  visible: {
    type: Boolean,
    default: false
  },
  formState: {
    type: Object,
    required: true
  },
  isSubmitting: {
    type: Boolean,
    default: false
  }
})

const emit = defineEmits(['close', 'submit'])

function handleSubmit() {
  emit('submit')
}
</script>

<template>
  <div
    v-if="visible"
    class="permission-activation-modal"
    role="dialog"
    aria-modal="true"
    aria-label="权限激活"
    @click.self="emit('close')"
  >
    <div class="permission-activation-modal__card">
      <header class="permission-activation-modal__header">
        <div>
          <span class="permission-activation-modal__eyebrow">权限激活</span>
          <strong>激活当前设备</strong>
          <p>输入用户名和手机号，系统会去服务端查询可用授权并绑定当前设备。</p>
        </div>

        <button type="button" class="secondary-action" @click="emit('close')">
          关闭
        </button>
      </header>

      <div class="permission-activation-modal__form">
        <label class="permission-activation-modal__field">
          <span>用户名</span>
          <input v-model="props.formState.customerName" type="text" placeholder="请输入用户名">
        </label>

        <label class="permission-activation-modal__field">
          <span>手机号</span>
          <input v-model="props.formState.contact" type="text" placeholder="请输入手机号">
        </label>
      </div>

      <footer class="permission-activation-modal__footer">
        <button
          type="button"
          class="primary-action"
          :disabled="isSubmitting"
          @click="handleSubmit"
        >
          {{ isSubmitting ? '激活中...' : '立即激活' }}
        </button>
      </footer>
    </div>
  </div>
</template>

<style scoped>
.permission-activation-modal {
  position: fixed;
  inset: 0;
  z-index: 85;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
  background: rgba(6, 10, 18, 0.72);
  backdrop-filter: blur(14px);
}

.permission-activation-modal__card {
  display: grid;
  gap: 20px;
  width: min(560px, 100%);
  padding: 24px;
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 24px;
  background: rgba(11, 16, 27, 0.96);
  box-shadow: 0 24px 60px rgba(0, 0, 0, 0.35);
}

.permission-activation-modal__header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
}

.permission-activation-modal__header strong {
  display: block;
  margin-top: 6px;
  font-size: 28px;
}

.permission-activation-modal__header p {
  margin: 8px 0 0;
  color: rgba(205, 214, 238, 0.76);
}

.permission-activation-modal__eyebrow {
  color: rgba(118, 173, 255, 0.88);
  font-size: 12px;
  font-weight: 700;
  letter-spacing: 0.14em;
  text-transform: uppercase;
}

.permission-activation-modal__form {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 14px;
}

.permission-activation-modal__field {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.permission-activation-modal__field span {
  color: rgba(205, 214, 238, 0.78);
  font-size: 13px;
}

.permission-activation-modal__footer {
  display: flex;
  justify-content: flex-end;
}

@media (max-width: 760px) {
  .permission-activation-modal {
    padding: 16px;
  }

  .permission-activation-modal__card {
    padding: 18px;
  }

  .permission-activation-modal__form {
    grid-template-columns: 1fr;
  }
}
</style>
