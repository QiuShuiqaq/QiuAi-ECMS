<script setup>
import { computed, ref, watch } from 'vue'

const props = defineProps({
  visible: {
    type: Boolean,
    default: false
  },
  agreementState: {
    type: Object,
    default: () => ({})
  },
  isSubmitting: {
    type: Boolean,
    default: false
  }
})

const emit = defineEmits(['accept'])

const agreed = ref(false)

watch(
  () => props.visible,
  (visible) => {
    if (visible) {
      agreed.value = false
    }
  }
)

const agreementTitle = computed(() => {
  return props.agreementState?.version
    ? `用户须知与使用协议 ${props.agreementState.version}`
    : '用户须知与使用协议'
})
</script>

<template>
  <div v-if="visible" class="user-agreement-modal" role="dialog" aria-modal="true" :aria-label="agreementTitle">
    <div class="user-agreement-modal__card">
      <header class="user-agreement-modal__header">
        <div>
          <span class="user-agreement-modal__eyebrow">Compliance Notice</span>
          <strong>{{ agreementTitle }}</strong>
          <p>激活成功后，阅读并同意以下内容，才可继续使用 QiuAi。</p>
        </div>
      </header>

      <div class="user-agreement-modal__content">
        <section>
          <h3>1. 授权范围</h3>
          <p>本软件授权当前账户名下的当前设备使用。未经授权，不得复制、出租、转售、共享授权或绕过设备限制。</p>
        </section>
        <section>
          <h3>2. 合法使用</h3>
          <p>你承诺仅将本软件用于合法、合规的业务场景，不得用于违法、侵权、欺诈、传播违规信息或规避平台规则。</p>
        </section>
        <section>
          <h3>3. 数据与隐私</h3>
          <p>软件会处理你主动提交的商品资料、文本、图片、视频和发布草稿。你应确保自己对这些数据拥有合法使用权，并自行承担来源合规责任。</p>
        </section>
        <section>
          <h3>4. AI 生成内容责任</h3>
          <p>AI 结果仅作为效率工具，不构成事实保证、法律意见或平台审核保证。你应在发布前自行复核文案、素材、规格、宣传表述和合规风险。</p>
        </section>
        <section>
          <h3>5. 支付与授权</h3>
          <p>授权、算力包和直充等服务以平台实际订单、到账与授权状态为准。因支付通道、第三方平台、网络波动或风控导致的延迟，系统可能出现短暂不同步。</p>
        </section>
        <section>
          <h3>6. 服务边界</h3>
          <p>我们会持续优化稳定性，但不承诺绝对不中断、绝对无错误或适配所有外部平台规则变化。涉及第三方平台接口、模型提供商或支付渠道的能力，以当时可用状态为准。</p>
        </section>
        <section>
          <h3>7. 违约与限制</h3>
          <p>若发现异常共享、批量滥用、攻击系统、违规发布或其他高风险行为，平台有权暂停服务、冻结授权、拒绝继续提供技术支持，并保留追责权利。</p>
        </section>
        <section>
          <h3>8. 协议更新</h3>
          <p>当协议版本升级或授权主体变化时，系统可能要求你重新确认。继续使用即表示你同意届时生效的最新版本。</p>
        </section>
      </div>

      <label class="user-agreement-modal__check">
        <input v-model="agreed" type="checkbox">
        <span>我已阅读并同意上述《用户须知与使用协议》</span>
      </label>

      <footer class="user-agreement-modal__footer">
        <button type="button" class="primary-action" :disabled="!agreed || isSubmitting" @click="emit('accept')">
          {{ isSubmitting ? '提交中...' : '同意并继续使用' }}
        </button>
      </footer>
    </div>
  </div>
</template>

<style scoped>
.user-agreement-modal {
  position: fixed;
  inset: 0;
  z-index: 90;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
  background: rgba(5, 10, 18, 0.78);
  backdrop-filter: blur(16px);
}

.user-agreement-modal__card {
  display: grid;
  gap: 18px;
  width: min(860px, 100%);
  max-height: calc(100vh - 48px);
  padding: 24px;
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 24px;
  background: rgba(11, 16, 27, 0.98);
  box-shadow: 0 24px 60px rgba(0, 0, 0, 0.35);
}

.user-agreement-modal__header {
  display: grid;
  gap: 8px;
}

.user-agreement-modal__header strong {
  font-size: 26px;
}

.user-agreement-modal__eyebrow {
  color: rgba(118, 173, 255, 0.88);
  font-size: 12px;
  font-weight: 700;
  letter-spacing: 0.14em;
  text-transform: uppercase;
}

.user-agreement-modal__header p,
.user-agreement-modal__content p,
.user-agreement-modal__check span {
  color: rgba(205, 214, 238, 0.78);
}

.user-agreement-modal__content {
  display: grid;
  gap: 14px;
  overflow: auto;
  padding-right: 6px;
}

.user-agreement-modal__content section {
  display: grid;
  gap: 6px;
}

.user-agreement-modal__content h3 {
  font-size: 15px;
}

.user-agreement-modal__check {
  display: flex;
  align-items: flex-start;
  gap: 10px;
}

.user-agreement-modal__check input {
  margin-top: 3px;
}

.user-agreement-modal__footer {
  display: flex;
  justify-content: flex-end;
}

@media (max-width: 760px) {
  .user-agreement-modal {
    padding: 16px;
  }

  .user-agreement-modal__card {
    padding: 18px;
    max-height: calc(100vh - 32px);
  }
}
</style>
