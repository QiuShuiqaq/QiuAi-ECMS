<script setup>
import { computed, ref } from 'vue'

const props = defineProps({
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
  navItems: {
    type: Array,
    default: () => []
  },
  activeNav: {
    type: String,
    default: ''
  },
  activeLanguage: {
    type: String,
    default: 'zh'
  },
  localeText: {
    type: Object,
    default: () => ({
      navAriaLabel: '页面切换',
      themeLabel: '主题',
      languageLabel: '语言',
      cleanupLabel: '一键清理',
      activationLabel: '激活状态',
      authorizedDeviceLabel: '已授权设备',
      closeLabel: '关闭',
      copyLabel: '复制',
      githubLabel: 'GitHub',
      githubDescription: '展示 GitHub 主页信息，可直接复制。',
      githubHomeLabel: '主页地址',
      emailLabel: '邮箱',
      emailDescription: '点击邮箱地址可调用本地邮件客户端，也可以直接复制。',
      qqMailLabel: 'QQ 邮箱',
      gmailLabel: 'Gmail',
      wechatLabel: '微信',
      wechatDescription: '点击图片可查看微信联系入口。',
      previewSuffix: '预览'
    })
  }
})

const emit = defineEmits([
  'brand-click',
  'theme-change',
  'language-change',
  'cleanup-click',
  'nav-select',
  'activation-click',
  'copy-github',
  'copy-email'
])

const githubIconUrl = new URL('../../../icon/github-fill.png', import.meta.url).href
const emailIconUrl = new URL('../../../icon/youxiang.png', import.meta.url).href
const wechatIconUrl = new URL('../../../icon/weixin.png', import.meta.url).href

const contactGroups = computed(() => [
  {
    key: 'wechat',
    label: props.localeText.wechatLabel,
    iconUrl: wechatIconUrl,
    description: props.localeText.wechatDescription,
    images: [
      {
        name: 'Dockerfans',
        url: new URL('../../../icon/Dockerfans.jpg', import.meta.url).href
      }
    ]
  }
])

const emailEntries = computed(() => [
  {
    key: 'qq',
    label: props.localeText.qqMailLabel,
    address: '3431752914@qq.com',
    href: 'mailto:3431752914@qq.com'
  },
  {
    key: 'gmail',
    label: props.localeText.gmailLabel,
    address: 'qiushui1210@gmail.com',
    href: 'mailto:qiushui1210@gmail.com'
  }
])

const githubEntries = computed(() => [
  {
    key: 'github-home',
    label: props.localeText.githubHomeLabel,
    value: 'https://github.com/QiuShuiqaq/'
  }
])

const activeContactKey = ref('')
const isEmailModalVisible = ref(false)
const isGithubModalVisible = ref(false)

const activeContactGroup = computed(() => {
  return contactGroups.value.find((item) => item.key === activeContactKey.value) || null
})

const isChinese = computed(() => props.activeLanguage === 'zh')

function onBrandClick() {
  emit('brand-click')
}

function onThemeChange(event) {
  emit('theme-change', event.target.value)
}

function onLanguageToggle() {
  emit('language-change', isChinese.value ? 'en' : 'zh')
}

function onCleanupClick() {
  emit('cleanup-click')
}

function openContactPreview(contactKey) {
  isEmailModalVisible.value = false
  isGithubModalVisible.value = false
  activeContactKey.value = contactKey
}

function closeContactPreview() {
  activeContactKey.value = ''
}

function openGithubModal() {
  activeContactKey.value = ''
  isEmailModalVisible.value = false
  isGithubModalVisible.value = true
}

function openEmailModal() {
  activeContactKey.value = ''
  isGithubModalVisible.value = false
  isEmailModalVisible.value = true
}

function closeEmailModal() {
  isEmailModalVisible.value = false
}

function closeGithubModal() {
  isGithubModalVisible.value = false
}

function copyGithub(entry) {
  emit('copy-github', entry)
}

function copyEmail(entry) {
  emit('copy-email', entry)
}
</script>

<template>
  <header class="topbar-shell">
    <button class="brand-button" type="button" @click="onBrandClick">
      <span class="brand-mark">Q</span>
      <span class="brand-copy">{{ brandLabel }}</span>
    </button>

    <nav v-if="navItems.length" class="topbar-nav" :aria-label="localeText.navAriaLabel">
      <template v-for="(item, index) in navItems" :key="item.key">
        <span v-if="index > 0" class="topbar-nav-divider" aria-hidden="true">|</span>
        <button
          :class="['topbar-nav-button', { 'topbar-nav-button--active': item.key === activeNav }]"
          type="button"
          :disabled="Boolean(item.disabled)"
          @click="emit('nav-select', item.key)"
        >
          <span>{{ item.label }}</span>
          <small v-if="item.badge">{{ item.badge }}</small>
        </button>
      </template>
    </nav>

    <label v-else-if="themeOptions.length > 1" class="topbar-theme">
      <span>{{ localeText.themeLabel }}</span>
      <select :value="activeTheme" @change="onThemeChange">
        <option v-for="option in themeOptions" :key="option.value" :value="option.value">
          {{ option.label }}
        </option>
      </select>
    </label>

    <div class="topbar-right-actions">
      <button
        class="topbar-language-button"
        type="button"
        :aria-label="localeText.languageLabel"
        :title="localeText.languageLabel"
        @click="onLanguageToggle"
      >
        <span :class="{ 'is-active': isChinese }">中</span>
        <span class="topbar-language-divider" aria-hidden="true">/</span>
        <span :class="{ 'is-active': !isChinese }">EN</span>
      </button>

      <button class="topbar-clean-button" type="button" :aria-label="localeText.cleanupLabel" @click="onCleanupClick">
        {{ localeText.cleanupLabel }}
      </button>

      <button v-if="activationSummary" class="topbar-activation-pill" type="button" @click="emit('activation-click')">
        <span>{{ localeText.activationLabel }}</span>
        <strong>
          {{ activationSummary.customerName || localeText.authorizedDeviceLabel }}
          <small v-if="activationSummary.edition"> / {{ activationSummary.edition }}</small>
        </strong>
      </button>

      <div class="topbar-contact-actions">
        <button
          class="topbar-contact-button"
          type="button"
          :aria-label="localeText.githubLabel"
          :title="localeText.githubLabel"
          @click="openGithubModal"
        >
          <img :src="githubIconUrl" alt="" />
          <span>{{ localeText.githubLabel }}</span>
        </button>

        <button
          class="topbar-contact-button"
          type="button"
          :aria-label="localeText.emailLabel"
          :title="localeText.emailLabel"
          @click="openEmailModal"
        >
          <img :src="emailIconUrl" alt="" />
          <span>{{ localeText.emailLabel }}</span>
        </button>

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
    :aria-label="`${activeContactGroup.label}${localeText.previewSuffix}`"
    @click.self="closeContactPreview"
  >
    <div class="contact-preview-modal__card">
      <header class="contact-preview-modal__header">
        <div>
          <strong>{{ activeContactGroup.label }}</strong>
          <span>{{ activeContactGroup.description }}</span>
        </div>

        <button class="secondary-action" type="button" @click="closeContactPreview">
          {{ localeText.closeLabel }}
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

  <div
    v-if="isGithubModalVisible"
    class="contact-preview-modal"
    role="dialog"
    aria-modal="true"
    :aria-label="`${localeText.githubLabel}${localeText.previewSuffix}`"
    @click.self="closeGithubModal"
  >
    <div class="contact-preview-modal__card contact-preview-modal__card--compact">
      <header class="contact-preview-modal__header">
        <div>
          <strong>{{ localeText.githubLabel }}</strong>
          <span>{{ localeText.githubDescription }}</span>
        </div>

        <button class="secondary-action" type="button" @click="closeGithubModal">
          {{ localeText.closeLabel }}
        </button>
      </header>

      <div class="contact-email-list">
        <div v-for="entry in githubEntries" :key="entry.key" class="contact-email-card">
          <div class="contact-email-card__copy">
            <strong>{{ entry.label }}</strong>
            <span class="contact-email-card__text">{{ entry.value }}</span>
          </div>

          <button class="secondary-action secondary-action--compact" type="button" @click="copyGithub(entry)">
            {{ localeText.copyLabel }}
          </button>
        </div>
      </div>
    </div>
  </div>

  <div
    v-if="isEmailModalVisible"
    class="contact-preview-modal"
    role="dialog"
    aria-modal="true"
    :aria-label="`${localeText.emailLabel}${localeText.previewSuffix}`"
    @click.self="closeEmailModal"
  >
    <div class="contact-preview-modal__card contact-preview-modal__card--compact">
      <header class="contact-preview-modal__header">
        <div>
          <strong>{{ localeText.emailLabel }}</strong>
          <span>{{ localeText.emailDescription }}</span>
        </div>

        <button class="secondary-action" type="button" @click="closeEmailModal">
          {{ localeText.closeLabel }}
        </button>
      </header>

      <div class="contact-email-list">
        <div v-for="entry in emailEntries" :key="entry.key" class="contact-email-card">
          <div class="contact-email-card__copy">
            <strong>{{ entry.label }}</strong>
            <a :href="entry.href">{{ entry.address }}</a>
          </div>

          <button class="secondary-action secondary-action--compact" type="button" @click="copyEmail(entry)">
            {{ localeText.copyLabel }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>
