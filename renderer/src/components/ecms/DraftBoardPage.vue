<script setup>
import { computed, ref, watch } from 'vue'

const props = defineProps({
  draftItems: {
    type: Array,
    required: true
  },
  moduleLocked: {
    type: Boolean,
    default: false
  },
  moduleLockMessage: {
    type: String,
    default: ''
  }
})

const emit = defineEmits([
  'update-draft-field',
  'copy-asset',
  'preview-asset',
  'jump-to-source'
])

const draftKeyword = ref('')
const draftPlatformFilter = ref('全部平台')
const activeDraftId = ref('')

function updateField(draftId, path, event) {
  emit('update-draft-field', {
    draftId,
    path,
    value: event?.target?.value ?? ''
  })
}

function copyAsset(value = '', label = '内容') {
  emit('copy-asset', value, label)
}

function previewAsset(previewUrl = '') {
  emit('preview-asset', previewUrl)
}

function jumpToSource(moduleKey = '') {
  emit('jump-to-source', moduleKey)
}

function previewDraftCover(item = null) {
  const draftItem = item || activeDraft.value
  previewAsset(resolveDraftPreview(draftItem))
}

function selectDraft(draftId = '') {
  activeDraftId.value = draftId
}

function resolveDraftPreview(item = {}) {
  return item?.preview || item?.draftPayload?.editor?.coverImage || item?.draftPayload?.sourceMetadata?.imageUrl || ''
}

function getDraftAssets(item = {}) {
  const assets = item?.draftPayload?.assets
  return assets && typeof assets === 'object'
    ? {
        textGroups: Array.isArray(assets.textGroups) ? assets.textGroups : [],
        imageGroups: Array.isArray(assets.imageGroups) ? assets.imageGroups : [],
        videoGroups: Array.isArray(assets.videoGroups) ? assets.videoGroups : []
      }
    : {
        textGroups: [],
        imageGroups: [],
        videoGroups: []
      }
}

function resolveDraftImageAssets(item = {}) {
  const imageGroups = getDraftAssets(item).imageGroups
  if (imageGroups.length) {
    return imageGroups
  }

  const coverImage = item?.draftPayload?.editor?.coverImage || item?.preview || ''
  if (!coverImage) {
    return []
  }

  return [{
    id: `${item?.id || 'draft'}-cover`,
    title: item?.draftPayload?.productName || item?.title || '套图素材',
    preview: coverImage,
    coverImage,
    mainImagePlan: item?.draftPayload?.editor?.mainImagePlan || '',
    detailImagePlan: item?.draftPayload?.editor?.detailImagePlan || ''
  }]
}

function resolveDraftVideoAssets(item = {}) {
  const videoGroups = getDraftAssets(item).videoGroups
  if (videoGroups.length) {
    return videoGroups
  }

  const editor = item?.draftPayload?.editor || {}
  const hasVideoContent = editor.videoAssetPlan || editor.videoScriptNote || item?.draftPayload?.videoTheme
  if (!hasVideoContent) {
    return []
  }

  return [{
    id: `${item?.id || 'draft'}-video`,
    title: item?.draftPayload?.productName || item?.title || '视频素材',
    preview: resolveDraftPreview(item),
    videoAssetPlan: editor.videoAssetPlan || '',
    videoScriptNote: editor.videoScriptNote || '',
    videoTheme: item?.draftPayload?.videoTheme || ''
  }]
}

function resolveDraftDetail(item = {}) {
  const listingDescription = String(item?.draftPayload?.listingDescription || '').trim()
  if (listingDescription) {
    return listingDescription
  }

  const textAsset = getDraftAssets(item).textGroups[0] || {}
  return String(textAsset.description || textAsset.sellingPoint || '').trim()
}

const draftPlatformOptions = computed(() => {
  const platformSet = new Set(['全部平台'])
  props.draftItems.forEach((item) => {
    const platform = String(item?.draftPayload?.targetPlatform || item?.source || '').trim()
    if (platform) {
      platformSet.add(platform)
    }
  })
  return Array.from(platformSet)
})

const filteredDraftItems = computed(() => {
  const keyword = String(draftKeyword.value || '').trim().toLowerCase()

  return [...(props.draftItems || [])]
    .filter((item) => {
      const title = String(item?.draftPayload?.productName || item?.draftPayload?.listingTitle || item?.title || '').toLowerCase()
      const platform = String(item?.draftPayload?.targetPlatform || item?.source || '').trim()

      const keywordMatched = !keyword || title.includes(keyword)
      const platformMatched = draftPlatformFilter.value === '全部平台' || draftPlatformFilter.value === platform

      return keywordMatched && platformMatched
    })
    .sort((leftItem, rightItem) => String(rightItem?.createdAt || '').localeCompare(String(leftItem?.createdAt || '')))
})

const activeDraft = computed(() => {
  const items = filteredDraftItems.value
  return items.find((item) => item.id === activeDraftId.value) || items[0] || null
})

const activeDraftImageAssets = computed(() => resolveDraftImageAssets(activeDraft.value || {}))
const activeDraftVideoAssets = computed(() => resolveDraftVideoAssets(activeDraft.value || {}))

watch(
  () => filteredDraftItems.value.map((item) => item.id).join('|'),
  () => {
    if (!filteredDraftItems.value.length) {
      activeDraftId.value = ''
      return
    }

    if (!filteredDraftItems.value.some((item) => item.id === activeDraftId.value)) {
      activeDraftId.value = filteredDraftItems.value[0].id
    }
  },
  { immediate: true }
)
</script>

<template>
  <section class="ecms-page ecms-page--draft">
    <section class="ecms-panel ecms-panel--results">
      <div v-if="moduleLocked" class="empty-state">
        <strong>当前授权未开通草稿模块</strong>
        <p>{{ moduleLockMessage || '请在独立授权工具中补充 draft 模块授权。' }}</p>
      </div>

      <div v-else class="draft-studio-layout">
        <aside class="draft-library">
          <header class="draft-library__header">
            <h2>草稿库</h2>
            <span>{{ props.draftItems.length }}</span>
          </header>

          <div class="draft-library__filters draft-library__filters--simple">
            <label class="form-field draft-library__search">
              <input v-model="draftKeyword" type="text" placeholder="搜索标题" />
            </label>

            <label class="form-field">
              <select v-model="draftPlatformFilter">
                <option v-for="platform in draftPlatformOptions" :key="platform" :value="platform">
                  {{ platform }}
                </option>
              </select>
            </label>
          </div>

          <div class="draft-library__list module-scroll scrollbar-hidden">
            <button
              v-for="item in filteredDraftItems"
              :key="item.id"
              type="button"
              class="draft-library-item"
              :class="{ 'draft-library-item--active': activeDraft?.id === item.id }"
              @click="selectDraft(item.id)"
            >
              <div class="draft-library-item__preview">
                <img v-if="resolveDraftPreview(item)" :src="resolveDraftPreview(item)" :alt="item.title" />
                <div v-else class="draft-library-item__placeholder">无图</div>
              </div>

              <div class="draft-library-item__body">
                <strong>{{ item.draftPayload?.productName || item.draftPayload?.listingTitle || item.title }}</strong>
                <div class="draft-library-item__meta">
                  <span>{{ item.draftPayload?.targetPlatform || item.source || '未分平台' }}</span>
                  <span>{{ resolveDraftImageAssets(item).length }} 图 / {{ resolveDraftVideoAssets(item).length }} 视频</span>
                </div>
              </div>
            </button>

            <div v-if="!filteredDraftItems.length" class="draft-library__empty">
              {{ props.draftItems.length ? '没有匹配的草稿' : '还没有草稿' }}
            </div>
          </div>
        </aside>

        <section class="draft-workspace">
          <div v-if="activeDraft" class="draft-workspace__scroll module-scroll scrollbar-hidden">
            <article class="draft-focus-hero draft-focus-hero--simple">
              <div class="draft-focus-hero__preview">
                <img v-if="resolveDraftPreview(activeDraft)" :src="resolveDraftPreview(activeDraft)" :alt="activeDraft.title" />
                <div v-else class="draft-focus-hero__placeholder">暂无封面</div>
              </div>

              <div class="draft-focus-hero__main">
                <div class="draft-link-card__header">
                  <div>
                    <strong>{{ activeDraft.draftPayload?.productName || activeDraft.title }}</strong>
                  </div>
                  <span class="platform-badge">{{ activeDraft.draftPayload?.targetPlatform || activeDraft.source }}</span>
                </div>

                <div class="draft-focus-hero__actions">
                  <button class="secondary-action secondary-action--compact" type="button" @click="copyAsset(activeDraft.draftPayload?.listingTitle || '', '标题')">
                    复制标题
                  </button>
                  <button class="secondary-action secondary-action--compact" type="button" @click="copyAsset(resolveDraftDetail(activeDraft), '详情')">
                    复制详情
                  </button>
                  <button class="secondary-action secondary-action--compact" type="button" @click="previewDraftCover(activeDraft)">
                    预览封面
                  </button>
                  <button class="secondary-action secondary-action--compact" type="button" @click="jumpToSource('text')">
                    回到文本
                  </button>
                  <button class="secondary-action secondary-action--compact" type="button" @click="jumpToSource('image')">
                    回到生图
                  </button>
                  <button class="secondary-action secondary-action--compact" type="button" @click="jumpToSource('video')">
                    回到视频
                  </button>
                </div>
              </div>
            </article>

            <div class="draft-editor-card__sections draft-editor-card__sections--single draft-editor-card__sections--simple">
              <section class="draft-editor-section">
                <h3>标题</h3>
                <label class="form-field">
                  <textarea
                    :value="activeDraft.draftPayload?.listingTitle || ''"
                    rows="3"
                    @input="updateField(activeDraft.id, 'draftPayload.listingTitle', $event)"
                  ></textarea>
                </label>
              </section>

              <section class="draft-editor-section">
                <h3>详情</h3>
                <label class="form-field">
                  <textarea
                    :value="activeDraft.draftPayload?.listingDescription || ''"
                    rows="6"
                    @input="updateField(activeDraft.id, 'draftPayload.listingDescription', $event)"
                  ></textarea>
                </label>
              </section>

              <section class="draft-editor-section draft-editor-section--assets">
                <div class="draft-editor-section__headerline">
                  <h3>套图</h3>
                  <span>{{ activeDraftImageAssets.length }}</span>
                </div>

                <div v-if="activeDraftImageAssets.length" class="draft-asset-board draft-asset-board--images">
                  <article v-for="asset in activeDraftImageAssets" :key="asset.id" class="draft-asset-column">
                    <div class="draft-asset-item">
                      <div v-if="asset.preview || asset.coverImage" class="draft-asset-item__preview">
                        <img :src="asset.preview || asset.coverImage" :alt="asset.title || '套图素材'" />
                      </div>
                      <strong>{{ asset.title || '未命名套图' }}</strong>
                      <p>{{ asset.mainImagePlan || asset.detailImagePlan || '已挂载图片素材' }}</p>
                      <div class="draft-asset-item__actions">
                        <button class="secondary-action secondary-action--compact" type="button" @click="previewAsset(asset.preview || asset.coverImage || '')">
                          预览图片
                        </button>
                        <button class="secondary-action secondary-action--compact" type="button" @click="copyAsset(asset.coverImage || asset.preview || '', '图片链接')">
                          复制链接
                        </button>
                        <button class="secondary-action secondary-action--compact" type="button" @click="jumpToSource('image')">
                          回到生图
                        </button>
                      </div>
                    </div>
                  </article>
                </div>

                <div v-else class="draft-asset-empty">还没有套图</div>
              </section>

              <section class="draft-editor-section draft-editor-section--assets">
                <div class="draft-editor-section__headerline">
                  <h3>视频</h3>
                  <span>{{ activeDraftVideoAssets.length }}</span>
                </div>

                <div v-if="activeDraftVideoAssets.length" class="draft-asset-board draft-asset-board--videos">
                  <article v-for="asset in activeDraftVideoAssets" :key="asset.id" class="draft-asset-column">
                    <div class="draft-asset-item">
                      <strong>{{ asset.title || '未命名视频' }}</strong>
                      <p>{{ asset.videoAssetPlan || asset.videoScriptNote || asset.videoTheme || '已挂载视频素材' }}</p>
                      <div class="draft-asset-item__actions">
                        <button class="secondary-action secondary-action--compact" type="button" @click="copyAsset(asset.videoAssetPlan || '', '视频链接')">
                          复制链接
                        </button>
                        <button class="secondary-action secondary-action--compact" type="button" @click="copyAsset(asset.videoScriptNote || asset.videoTheme || '', '视频说明')">
                          复制说明
                        </button>
                        <button class="secondary-action secondary-action--compact" type="button" @click="jumpToSource('video')">
                          回到视频
                        </button>
                      </div>
                    </div>
                  </article>
                </div>

                <div v-else class="draft-asset-empty">还没有视频</div>
              </section>
            </div>
          </div>

          <div v-else class="empty-state empty-state--draft">
            <strong>没有可编辑的草稿</strong>
            <p>{{ props.draftItems.length ? '调整左侧筛选条件，或点选左侧草稿继续编辑。' : '先从文本 / 生图 / 视频里发送内容到草稿。' }}</p>
          </div>
        </section>
      </div>
    </section>
  </section>
</template>
