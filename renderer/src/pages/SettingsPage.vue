<script setup>
import { appStore } from '../stores/appStore'

defineProps({
  saveHandler: {
    type: Function,
    required: true
  }
})
</script>

<template>
  <section class="panel-card settings-panel panel-scroll">
    <div class="panel-head">
      <div>
        <p class="panel-kicker">Settings</p>
        <h2>工作区设置</h2>
      </div>
      <div class="inline-actions">
        <button class="action-button" type="button" @click="saveHandler">保存设置</button>
      </div>
    </div>
    <label class="field-card">
      <span>界面主题</span>
      <select v-model="appStore.settings.themeMode">
        <option value="dark">深色工作台</option>
      </select>
    </label>
    <label class="field-card">
      <span>默认比例</span>
      <select v-model="appStore.settings.defaultSize">
        <option value="1:1">1:1</option>
        <option value="16:9">16:9</option>
        <option value="9:16">9:16</option>
        <option value="4:3">4:3</option>
        <option value="3:4">3:4</option>
      </select>
    </label>
    <p class="settings-note">模型服务地址与密钥已改为后台托管，这里只保留本地显示和工作区相关设置。</p>
  </section>
</template>
