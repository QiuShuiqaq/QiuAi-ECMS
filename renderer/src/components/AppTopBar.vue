<script setup>
import { computed, ref } from 'vue'

defineProps({
  brandLabel: {
    type: String,
    required: true
  },
  themeOptions: {
    type: Array,
    required: true
  },
  activeTheme: {
    type: String,
    required: true
  },
  activationSummary: {
    type: Object,
    default: null
  },
  rechargeEnabled: {
    type: Boolean,
    default: false
  }
})

const emit = defineEmits(['theme-change', 'cleanup-click', 'recharge-click'])

const wechatIconUrl = new URL('../../../icon/weixin.png', import.meta.url).href
const enterpriseWechatIconUrl = new URL('../../../icon/qiyeweixin.png', import.meta.url).href

const contactGroups = [
  {
    key: 'wechat',
    label: '微信',
    iconUrl: wechatIconUrl,
    description: '点击图片查看微信联系方式',
    images: [
      {
        name: 'Dockerfans',
        url: new URL('../../../icon/Dockerfans.jpg', import.meta.url).href
      }
    ]
  },
  {
    key: 'enterprise-wechat',
    label: '企业微信',
    iconUrl: enterpriseWechatIconUrl,
    description: '点击图片查看企业微信联系方式',
    images: [
      {
        name: 'Qiyeweixin',
        url: new URL('../../../icon/Qiyeweixin.jpg', import.meta.url).href
      }
    ]
  }
]

const activeContactKey = ref('')

const activeContactGroup = computed(() => {
  return contactGroups.find((item) => item.key === activeContactKey.value) || null
})

function onThemeChange(event) {
  emit('theme-change', event.target.value)
}

function onCleanupClick() {
  emit('cleanup-click')
}

function openContactPreview(contactKey) {
  activeContactKey.value = contactKey
}

function closeContactPreview() {
  activeContactKey.value = ''
}
</script>

<template>
  <header class="topbar-shell" :class="{ 'topbar-shell--compact': themeOptions.length <= 1 }">
    <div class="brand-button" role="img" aria-label="QiuAi">
      <span class="brand-mark">Q</span>
      <span class="brand-copy-wrap">
        <span class="brand-copy">{{ brandLabel }}</span>
        <span class="brand-meta">ECMS Studio</span>
      </span>
    </div>

    <label v-if="themeOptions.length > 1" class="topbar-theme">
      <span>主题</span>
      <select :value="activeTheme" @change="onThemeChange">
        <option v-for="option in themeOptions" :key="option.value" :value="option.value">
          {{ option.label }}
        </option>
      </select>
    </label>

    <div class="topbar-right-actions">
      <button
        v-if="rechargeEnabled"
        class="topbar-recharge-button"
        type="button"
        @click="emit('recharge-click')"
      >
        充值
      </button>

      <div v-if="activationSummary" class="topbar-activation-pill">
        <span>已激活</span>
        <strong>{{ activationSummary.customerName || '已授权设备' }}</strong>
      </div>

      <button class="topbar-clean-button" type="button" aria-label="清理缓存" @click="onCleanupClick">
        清理缓存
      </button>

      <div class="topbar-contact-actions">
        <button
          v-for="contact in contactGroups"
          :key="contact.key"
          class="topbar-contact-button"
          type="button"
          :aria-label="contact.label"
          :title="contact.label"
          @click="openContactPreview(contact.key)"
        >
          <img :src="contact.iconUrl" alt="" />
          <span>{{ contact.label }}</span>
        </button>
      </div>
    </div>
  </header>

  <div
    v-if="activeContactGroup"
    class="contact-preview-modal"
    role="dialog"
    aria-modal="true"
    :aria-label="`${activeContactGroup.label}预览`"
    @click.self="closeContactPreview"
  >
    <div class="contact-preview-modal__card">
      <header class="contact-preview-modal__header">
        <div>
          <strong>{{ activeContactGroup.label }}</strong>
          <span>{{ activeContactGroup.description }}</span>
        </div>

        <button class="secondary-action" type="button" @click="closeContactPreview">
          关闭
        </button>
      </header>

      <div class="contact-preview-modal__image-grid">
        <a
          v-for="image in activeContactGroup.images"
          :key="image.name"
          class="contact-preview-modal__image-card"
          :href="image.url"
          target="_blank"
          rel="noreferrer"
        >
          <img :src="image.url" :alt="image.name" />
          <span>{{ image.name }}</span>
        </a>
      </div>
    </div>
  </div>
</template>
