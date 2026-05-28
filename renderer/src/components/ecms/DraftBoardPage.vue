<script setup>
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

function updateField(draftId, path, event) {
  emit('update-draft-field', {
    draftId,
    path,
    value: event?.target?.value ?? ''
  })
}

function updateCheckbox(draftId, path, event) {
  emit('update-draft-field', {
    draftId,
    path,
    value: Boolean(event?.target?.checked)
  })
}

function getSourceMeta(item = {}) {
  const meta = item?.draftPayload?.sourceMetadata
  return meta && typeof meta === 'object' ? meta : {}
}

function resolveSourceMetaRows(item = {}) {
  const meta = getSourceMeta(item)
  return [
    { key: 'platform', label: '来源平台', value: meta.platform || '' },
    { key: 'scene', label: '来源类目', value: meta.scene || '' },
    { key: 'totalSold', label: '来源总销量', value: meta.totalSold || '' },
    { key: 'sourceProductId', label: '来源商品 ID', value: meta.sourceProductId || '' }
  ].filter((row) => row.value)
}

function resolveChecklistCount(item = {}) {
  const checklist = item?.draftPayload?.checklist || {}
  const keys = Object.keys(checklist)
  const completed = keys.filter((key) => Boolean(checklist[key])).length
  return {
    completed,
    total: keys.length
  }
}

function resolveAssetSummary(item = {}) {
  const editor = item?.draftPayload?.editor || {}
  return [
    {
      key: 'text',
      label: '文案',
      ready: Boolean(item?.draftPayload?.listingTitle || item?.draftPayload?.listingDescription),
      value: item?.draftPayload?.listingTitle || '待补全文案'
    },
    {
      key: 'image',
      label: '套图',
      ready: Boolean(editor.coverImage || editor.mainImagePlan || editor.detailImagePlan),
      value: editor.mainImagePlan || editor.coverImage || '待补充图片素材'
    },
    {
      key: 'video',
      label: '视频',
      ready: Boolean(editor.videoAssetPlan || editor.videoScriptNote),
      value: editor.videoAssetPlan || editor.videoScriptNote || '待补充视频素材'
    }
  ]
}

function resolveStatusTone(item = {}) {
  const status = String(item?.draftPayload?.editor?.publishStatus || '').trim()
  if (status === '已可发布') {
    return 'is-ready'
  }
  if (status === '待上架' || status === '待定价') {
    return 'is-warn'
  }
  return 'is-pending'
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

function copyAsset(value = '', label = '内容') {
  emit('copy-asset', value, label)
}

function previewAsset(previewUrl = '') {
  emit('preview-asset', previewUrl)
}

function jumpToSource(moduleKey = '') {
  emit('jump-to-source', moduleKey)
}
</script>

<template>
  <section class="ecms-page">
    <div class="ecms-page__hero">
      <div>
        <span class="ecms-page__eyebrow">草稿中台</span>
        <h1>商品工作流草稿</h1>
        <p>这里会按“一个商品一组”的方式收纳文本、套图、视频结果，后续可以继续补定价、SKU、素材和发布信息。</p>
      </div>
      <div class="ecms-stat-grid">
        <article class="ecms-stat-card">
          <span>草稿数量</span>
          <strong>{{ props.draftItems.length }}</strong>
          <small>每一条草稿代表一个商品工作流</small>
        </article>
      </div>
    </div>

    <section class="ecms-panel ecms-panel--results">
      <header class="ecms-panel__header">
        <div>
          <h2>工作流草稿编辑器</h2>
          <p>先看整体进度，再补商品基础、文案、素材和上架信息，避免一个品的信息散在多个地方。</p>
        </div>
      </header>

      <div v-if="moduleLocked" class="empty-state">
        <strong>当前授权未开通草稿模块</strong>
        <p>{{ moduleLockMessage || '请在独立授权工具中补充 draft 模块授权。' }}</p>
      </div>

      <div v-else-if="props.draftItems.length" class="draft-editor-grid">
        <article v-for="item in props.draftItems" :key="item.id" class="draft-editor-card">
          <div class="draft-link-card__header">
            <div>
              <strong>{{ item.draftPayload?.productName || item.title }}</strong>
              <span>{{ item.module }} / {{ item.section }}</span>
            </div>
            <span class="platform-badge">{{ item.draftPayload?.targetPlatform || item.source }}</span>
          </div>

          <div class="draft-editor-card__hero">
            <div v-if="item.preview" class="draft-link-card__preview">
              <img :src="item.preview" :alt="item.title" />
            </div>

            <div class="draft-editor-card__summary">
              <p>{{ item.summary }}</p>

              <div class="draft-workflow-grid">
                <article class="draft-workflow-card">
                  <span>当前状态</span>
                  <strong :class="['draft-status-chip', resolveStatusTone(item)]">
                    {{ item.draftPayload?.editor?.publishStatus || '待整理' }}
                  </strong>
                </article>

                <article class="draft-workflow-card">
                  <span>检查进度</span>
                  <strong>
                    {{ resolveChecklistCount(item).completed }} / {{ resolveChecklistCount(item).total }}
                  </strong>
                </article>

                <article
                  v-for="asset in resolveAssetSummary(item)"
                  :key="`${item.id}-${asset.key}`"
                  class="draft-workflow-card"
                >
                  <span>{{ asset.label }}</span>
                  <strong :class="asset.ready ? 'draft-asset-ready' : 'draft-asset-pending'">
                    {{ asset.ready ? '已就绪' : '待补充' }}
                  </strong>
                  <small>{{ asset.value }}</small>
                </article>
              </div>

              <div class="draft-link-card__meta">
                <span v-for="meta in item.metadata || []" :key="`${item.id}-${meta.label}`">
                  {{ meta.label }}: {{ meta.value }}
                </span>
              </div>
              <div v-if="resolveSourceMetaRows(item).length" class="draft-link-card__meta">
                <span v-for="meta in resolveSourceMetaRows(item)" :key="`${item.id}-${meta.key}`">
                  {{ meta.label }}: {{ meta.value }}
                </span>
              </div>
              <div class="draft-link-card__tags">
                <span v-for="tag in item.tags || []" :key="tag">{{ tag }}</span>
              </div>
              <small>最近归档 {{ item.createdAt }}</small>
            </div>
          </div>

          <section class="draft-editor-section draft-editor-section--assets">
            <h3>已沉淀资产</h3>
            <div class="draft-asset-board">
              <article class="draft-asset-column">
                <div class="draft-asset-column__header">
                  <strong>文本</strong>
                  <span>{{ getDraftAssets(item).textGroups.length }}</span>
                </div>
                <div v-if="getDraftAssets(item).textGroups.length" class="draft-asset-list">
                  <article v-for="asset in getDraftAssets(item).textGroups" :key="asset.id" class="draft-asset-item">
                    <strong>{{ asset.title || '未命名文本' }}</strong>
                    <p>{{ asset.description || asset.sellingPoint || '待补充文本内容' }}</p>
                    <div class="draft-asset-item__actions">
                      <button class="secondary-action secondary-action--compact" type="button" @click="copyAsset(asset.title || '', '标题')">复制标题</button>
                      <button class="secondary-action secondary-action--compact" type="button" @click="copyAsset(asset.description || asset.sellingPoint || '', '文本')">复制文本</button>
                      <button class="secondary-action secondary-action--compact" type="button" @click="jumpToSource('text')">回到文本</button>
                    </div>
                    <small>{{ asset.sourceModule || '文本模块' }} {{ asset.createdAt ? `· ${asset.createdAt}` : '' }}</small>
                  </article>
                </div>
                <div v-else class="draft-asset-empty">还没有文本资产</div>
              </article>

              <article class="draft-asset-column">
                <div class="draft-asset-column__header">
                  <strong>图片</strong>
                  <span>{{ getDraftAssets(item).imageGroups.length }}</span>
                </div>
                <div v-if="getDraftAssets(item).imageGroups.length" class="draft-asset-list">
                  <article v-for="asset in getDraftAssets(item).imageGroups" :key="asset.id" class="draft-asset-item">
                    <div v-if="asset.preview || asset.coverImage" class="draft-asset-item__preview">
                      <img :src="asset.preview || asset.coverImage" :alt="asset.title || '图片资产'" />
                    </div>
                    <strong>{{ asset.title || '未命名图片' }}</strong>
                    <p>{{ asset.mainImagePlan || asset.detailImagePlan || '待补充图片规划' }}</p>
                    <div class="draft-asset-item__actions">
                      <button class="secondary-action secondary-action--compact" type="button" @click="previewAsset(asset.preview || asset.coverImage || '')">预览图片</button>
                      <button class="secondary-action secondary-action--compact" type="button" @click="copyAsset(asset.coverImage || asset.preview || '', '图片链接')">复制链接</button>
                      <button class="secondary-action secondary-action--compact" type="button" @click="jumpToSource('image')">回到生图</button>
                    </div>
                    <small>{{ asset.sourceModule || '生图模块' }} {{ asset.createdAt ? `· ${asset.createdAt}` : '' }}</small>
                  </article>
                </div>
                <div v-else class="draft-asset-empty">还没有图片资产</div>
              </article>

              <article class="draft-asset-column">
                <div class="draft-asset-column__header">
                  <strong>视频</strong>
                  <span>{{ getDraftAssets(item).videoGroups.length }}</span>
                </div>
                <div v-if="getDraftAssets(item).videoGroups.length" class="draft-asset-list">
                  <article v-for="asset in getDraftAssets(item).videoGroups" :key="asset.id" class="draft-asset-item">
                    <strong>{{ asset.title || '未命名视频' }}</strong>
                    <p>{{ asset.videoAssetPlan || asset.videoScriptNote || asset.videoTheme || '待补充视频规划' }}</p>
                    <div class="draft-asset-item__actions">
                      <button class="secondary-action secondary-action--compact" type="button" @click="copyAsset(asset.videoAssetPlan || '', '视频链接')">复制链接</button>
                      <button class="secondary-action secondary-action--compact" type="button" @click="copyAsset(asset.videoScriptNote || asset.videoTheme || '', '视频脚本')">复制脚本</button>
                      <button class="secondary-action secondary-action--compact" type="button" @click="jumpToSource('video')">回到视频</button>
                    </div>
                    <small>{{ asset.sourceModule || '视频模块' }} {{ asset.createdAt ? `· ${asset.createdAt}` : '' }}</small>
                  </article>
                </div>
                <div v-else class="draft-asset-empty">还没有视频资产</div>
              </article>
            </div>
          </section>

          <div class="draft-editor-card__sections">
            <section class="draft-editor-section">
              <h3>商品基础</h3>
              <label class="form-field">
                <span>商品名称</span>
                <input :value="item.draftPayload?.productName || ''" type="text" @input="updateField(item.id, 'draftPayload.productName', $event)" />
              </label>
              <label class="form-field">
                <span>目标平台</span>
                <input :value="item.draftPayload?.targetPlatform || ''" type="text" @input="updateField(item.id, 'draftPayload.targetPlatform', $event)" />
              </label>
              <label class="form-field">
                <span>来源商品链接</span>
                <input :value="item.draftPayload?.sourceMetadata?.sourceUrl || ''" type="text" placeholder="来源商品链接会自动写入" @input="updateField(item.id, 'draftPayload.sourceMetadata.sourceUrl', $event)" />
              </label>
              <label class="form-field">
                <span>内容类型</span>
                <input :value="item.draftPayload?.contentType || ''" type="text" @input="updateField(item.id, 'draftPayload.contentType', $event)" />
              </label>
              <label class="form-field">
                <span>类目路径</span>
                <input :value="item.draftPayload?.editor?.categoryPath || ''" type="text" placeholder="例如：家居 > 厨房收纳 > 纸巾架" @input="updateField(item.id, 'draftPayload.editor.categoryPath', $event)" />
              </label>
              <label class="form-field">
                <span>品牌名</span>
                <input :value="item.draftPayload?.editor?.brandName || ''" type="text" placeholder="可留空，后续补" @input="updateField(item.id, 'draftPayload.editor.brandName', $event)" />
              </label>
              <label class="form-field">
                <span>店铺 / 账号</span>
                <input :value="item.draftPayload?.editor?.storeName || ''" type="text" placeholder="例如：QiuAi 家居店" @input="updateField(item.id, 'draftPayload.editor.storeName', $event)" />
              </label>
            </section>

            <section class="draft-editor-section">
              <h3>标题与描述</h3>
              <label class="form-field">
                <span>拟上架标题</span>
                <textarea :value="item.draftPayload?.listingTitle || ''" rows="3" @input="updateField(item.id, 'draftPayload.listingTitle', $event)"></textarea>
              </label>
              <label class="form-field">
                <span>拟上架描述</span>
                <textarea :value="item.draftPayload?.listingDescription || ''" rows="5" @input="updateField(item.id, 'draftPayload.listingDescription', $event)"></textarea>
              </label>
              <label class="form-field">
                <span>核心卖点</span>
                <textarea :value="item.draftPayload?.sellingPoint || ''" rows="3" @input="updateField(item.id, 'draftPayload.sellingPoint', $event)"></textarea>
              </label>
              <label class="form-field">
                <span>下一步</span>
                <textarea :value="item.draftPayload?.nextAction || ''" rows="3" @input="updateField(item.id, 'draftPayload.nextAction', $event)"></textarea>
              </label>
            </section>

            <section class="draft-editor-section">
              <h3>价格与 SKU</h3>
              <div class="draft-editor-section__row">
                <label class="form-field">
                  <span>最低价</span>
                  <input :value="item.draftPayload?.editor?.priceMin || ''" type="text" placeholder="例如：29.9" @input="updateField(item.id, 'draftPayload.editor.priceMin', $event)" />
                </label>
                <label class="form-field">
                  <span>最高价</span>
                  <input :value="item.draftPayload?.editor?.priceMax || ''" type="text" placeholder="例如：39.9" @input="updateField(item.id, 'draftPayload.editor.priceMax', $event)" />
                </label>
              </div>
              <div class="draft-editor-section__row">
                <label class="form-field">
                  <span>划线价</span>
                  <input :value="item.draftPayload?.editor?.marketPrice || ''" type="text" placeholder="例如：59.9" @input="updateField(item.id, 'draftPayload.editor.marketPrice', $event)" />
                </label>
                <label class="form-field">
                  <span>库存</span>
                  <input :value="item.draftPayload?.editor?.inventory || ''" type="text" placeholder="例如：100" @input="updateField(item.id, 'draftPayload.editor.inventory', $event)" />
                </label>
              </div>
              <div class="draft-editor-section__row">
                <label class="form-field">
                  <span>SKU 名称</span>
                  <input :value="item.draftPayload?.editor?.skuName || ''" type="text" placeholder="例如：规格" @input="updateField(item.id, 'draftPayload.editor.skuName', $event)" />
                </label>
                <label class="form-field">
                  <span>SKU 值</span>
                  <input :value="item.draftPayload?.editor?.skuValue || ''" type="text" placeholder="例如：标准版 / 2 件装" @input="updateField(item.id, 'draftPayload.editor.skuValue', $event)" />
                </label>
              </div>
              <label class="form-field">
                <span>运费模板</span>
                <input :value="item.draftPayload?.editor?.shippingTemplate || ''" type="text" placeholder="例如：全国包邮 / 默认模板" @input="updateField(item.id, 'draftPayload.editor.shippingTemplate', $event)" />
              </label>
            </section>

            <section class="draft-editor-section">
              <h3>素材挂载</h3>
              <label class="form-field">
                <span>主图链接 / 预览来源</span>
                <input :value="item.draftPayload?.editor?.coverImage || ''" type="text" placeholder="可直接贴图链接或保留来源预览" @input="updateField(item.id, 'draftPayload.editor.coverImage', $event)" />
              </label>
              <label class="form-field">
                <span>主图规划</span>
                <textarea :value="item.draftPayload?.editor?.mainImagePlan || ''" rows="3" @input="updateField(item.id, 'draftPayload.editor.mainImagePlan', $event)"></textarea>
              </label>
              <label class="form-field">
                <span>详情图规划</span>
                <textarea :value="item.draftPayload?.editor?.detailImagePlan || ''" rows="3" @input="updateField(item.id, 'draftPayload.editor.detailImagePlan', $event)"></textarea>
              </label>
              <label class="form-field">
                <span>视频素材规划</span>
                <textarea :value="item.draftPayload?.editor?.videoAssetPlan || ''" rows="3" @input="updateField(item.id, 'draftPayload.editor.videoAssetPlan', $event)"></textarea>
              </label>
              <label class="form-field">
                <span>脚本备注</span>
                <textarea :value="item.draftPayload?.editor?.videoScriptNote || ''" rows="3" @input="updateField(item.id, 'draftPayload.editor.videoScriptNote', $event)"></textarea>
              </label>
            </section>

            <section class="draft-editor-section">
              <h3>上架安排</h3>
              <div class="draft-editor-section__row">
                <label class="form-field">
                  <span>状态</span>
                  <select :value="item.draftPayload?.editor?.publishStatus || '待整理'" @change="updateField(item.id, 'draftPayload.editor.publishStatus', $event)">
                    <option value="待整理">待整理</option>
                    <option value="待补素材">待补素材</option>
                    <option value="待定价">待定价</option>
                    <option value="待上架">待上架</option>
                    <option value="已可发布">已可发布</option>
                  </select>
                </label>
                <label class="form-field">
                  <span>计划时间</span>
                  <input :value="item.draftPayload?.editor?.publishWindow || ''" type="text" placeholder="例如：本周三晚间" @input="updateField(item.id, 'draftPayload.editor.publishWindow', $event)" />
                </label>
              </div>
              <div class="draft-editor-section__row">
                <label class="form-field">
                  <span>负责人</span>
                  <input :value="item.draftPayload?.editor?.operator || ''" type="text" placeholder="例如：运营 A" @input="updateField(item.id, 'draftPayload.editor.operator', $event)" />
                </label>
                <label class="form-field">
                  <span>最近同步</span>
                  <input :value="item.draftPayload?.editor?.lastSyncedAt || ''" type="text" readonly />
                </label>
              </div>
              <label class="form-field">
                <span>备注</span>
                <textarea :value="item.draftPayload?.editor?.remarks || ''" rows="3" @input="updateField(item.id, 'draftPayload.editor.remarks', $event)"></textarea>
              </label>
            </section>

            <section class="draft-editor-section draft-editor-section--checklist">
              <h3>上架检查</h3>
              <label class="draft-check-item">
                <input :checked="Boolean(item.draftPayload?.checklist?.titleReady)" type="checkbox" @change="updateCheckbox(item.id, 'draftPayload.checklist.titleReady', $event)" />
                <span>标题已确认</span>
              </label>
              <label class="draft-check-item">
                <input :checked="Boolean(item.draftPayload?.checklist?.descriptionReady)" type="checkbox" @change="updateCheckbox(item.id, 'draftPayload.checklist.descriptionReady', $event)" />
                <span>描述已确认</span>
              </label>
              <label class="draft-check-item">
                <input :checked="Boolean(item.draftPayload?.checklist?.imageReady)" type="checkbox" @change="updateCheckbox(item.id, 'draftPayload.checklist.imageReady', $event)" />
                <span>图片素材已就绪</span>
              </label>
              <label class="draft-check-item">
                <input :checked="Boolean(item.draftPayload?.checklist?.videoReady)" type="checkbox" @change="updateCheckbox(item.id, 'draftPayload.checklist.videoReady', $event)" />
                <span>视频素材已就绪</span>
              </label>
              <label class="draft-check-item">
                <input :checked="Boolean(item.draftPayload?.checklist?.categoryReady)" type="checkbox" @change="updateCheckbox(item.id, 'draftPayload.checklist.categoryReady', $event)" />
                <span>类目已确认</span>
              </label>
              <label class="draft-check-item">
                <input :checked="Boolean(item.draftPayload?.checklist?.priceReady)" type="checkbox" @change="updateCheckbox(item.id, 'draftPayload.checklist.priceReady', $event)" />
                <span>价格已确认</span>
              </label>
              <label class="draft-check-item">
                <input :checked="Boolean(item.draftPayload?.checklist?.skuReady)" type="checkbox" @change="updateCheckbox(item.id, 'draftPayload.checklist.skuReady', $event)" />
                <span>SKU 已确认</span>
              </label>
              <label class="draft-check-item">
                <input :checked="Boolean(item.draftPayload?.checklist?.complianceReady)" type="checkbox" @change="updateCheckbox(item.id, 'draftPayload.checklist.complianceReady', $event)" />
                <span>合规检查已通过</span>
              </label>
            </section>
          </div>
        </article>
      </div>

      <div v-else class="empty-state">
        <strong>草稿池还没有内容</strong>
        <p>先去“文本 / 生图 / 视频”的效果展示卡片里点击“发送到草稿”，或从“选品”里直接走一键生成。</p>
      </div>
    </section>
  </section>
</template>
