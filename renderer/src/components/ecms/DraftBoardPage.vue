<script setup>
defineProps({
  draftItems: {
    type: Array,
    required: true
  }
})

const emit = defineEmits(['update-draft-field'])

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
</script>

<template>
  <section class="ecms-page">
    <div class="ecms-page__hero">
      <div>
        <span class="ecms-page__eyebrow">草稿中台</span>
        <h1>待整理草稿池</h1>
        <p>文本、生图、视频都可以把结果送到这里，这里现在会按“拟上架链接”方式继续补齐字段。</p>
      </div>
      <div class="ecms-stat-grid">
        <article class="ecms-stat-card">
          <span>草稿数量</span>
          <strong>{{ draftItems.length }}</strong>
          <small>每条草稿都可继续编辑成上架链接</small>
        </article>
      </div>
    </div>

    <section class="ecms-panel ecms-panel--results">
      <header class="ecms-panel__header">
        <div>
          <h2>上架草稿编辑器</h2>
          <p>先补商品基础、价格区间、SKU、素材位和检查项，后续再继续接具体平台字段。</p>
        </div>
      </header>

      <div v-if="draftItems.length" class="draft-editor-grid">
        <article v-for="item in draftItems" :key="item.id" class="draft-editor-card">
          <div class="draft-link-card__header">
            <div>
              <strong>{{ item.title }}</strong>
              <span>{{ item.module }} / {{ item.section }}</span>
            </div>
            <span class="platform-badge">{{ item.source }}</span>
          </div>

          <div class="draft-editor-card__hero">
            <div v-if="item.preview" class="draft-link-card__preview">
              <img :src="item.preview" :alt="item.title" />
            </div>

            <div class="draft-editor-card__summary">
              <p>{{ item.summary }}</p>
              <div class="draft-link-card__meta">
                <span v-for="meta in item.metadata || []" :key="`${item.id}-${meta.label}`">
                  {{ meta.label }}: {{ meta.value }}
                </span>
              </div>
              <div class="draft-link-card__tags">
                <span v-for="tag in item.tags || []" :key="tag">{{ tag }}</span>
              </div>
              <small>收录时间 {{ item.createdAt }}</small>
            </div>
          </div>

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
                  <input :value="item.draftPayload?.editor?.inventory || ''" type="text" placeholder="例如：200" @input="updateField(item.id, 'draftPayload.editor.inventory', $event)" />
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
        <p>先去“文本 / 生图 / 视频”的效果展示卡片里点击“发送到草稿”。</p>
      </div>
    </section>
  </section>
</template>
