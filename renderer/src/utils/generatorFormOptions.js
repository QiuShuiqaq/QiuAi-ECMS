export const platformOptions = [
  { label: 'TEMU', value: 'temu' },
  { label: 'OZON', value: 'ozon' },
  { label: 'Amazon', value: 'amazon' },
  { label: 'TK', value: 'tiktok' },
  { label: 'AliExpress', value: 'aliexpress' }
]

export const languageOptions = [
  { label: '中文', value: 'zh-CN' },
  { label: '英语', value: 'en-US' },
  { label: '俄语', value: 'ru-RU' },
  { label: '西班牙语', value: 'es-ES' },
  { label: '葡萄牙语', value: 'pt-PT' },
  { label: '葡萄牙语（巴西）', value: 'pt-BR' },
  { label: '法语', value: 'fr-FR' },
  { label: '德语', value: 'de-DE' },
  { label: '意大利语', value: 'it-IT' },
  { label: '荷兰语', value: 'nl-NL' },
  { label: '波兰语', value: 'pl-PL' },
  { label: '土耳其语', value: 'tr-TR' },
  { label: '阿拉伯语', value: 'ar-SA' },
  { label: '日语', value: 'ja-JP' },
  { label: '韩语', value: 'ko-KR' },
  { label: '泰语', value: 'th-TH' },
  { label: '越南语', value: 'vi-VN' },
  { label: '印尼语', value: 'id-ID' },
  { label: '马来语', value: 'ms-MY' },
  { label: '印地语', value: 'hi-IN' }
]

export const imageSizeOptions = [
  { label: '1:1', value: '1:1' },
  { label: '4:5', value: '4:5' },
  { label: '3:4', value: '3:4' },
  { label: '4:3', value: '4:3' },
  { label: '16:9', value: '16:9' },
  { label: '9:16', value: '9:16' }
]

export const imageModelOptions = [
  { label: 'gpt-image-2', value: 'gpt-image-2' },
  { label: 'nano-banana-fast', value: 'nano-banana-fast' },
  { label: 'nano-banana-2', value: 'nano-banana-2' }
]

export const videoModelOptions = [
  { label: 'MiniMax-Hailuo-2.3-Fast', value: 'MiniMax-Hailuo-2.3-Fast' }
]

export const videoDurationOptions = [
  { label: '6s', value: '6s' },
  { label: '10s', value: '10s' }
]

export const videoAspectRatioOptions = [
  { label: '16:9', value: '16:9' },
  { label: '9:16', value: '9:16' },
  { label: '1:1', value: '1:1' },
  { label: '4:5', value: '4:5' },
  { label: '3:4', value: '3:4' }
]

export const videoResolutionOptions = [
  { label: '768P', value: '768P' },
  { label: '1080P', value: '1080P' }
]

export const videoMotionOptions = [
  { label: '自动', value: 'auto' },
  { label: '稳定', value: 'stable' },
  { label: '柔和', value: 'soft' }
]

export const projectStepOptions = [
  { key: 'title', label: '标题' },
  { key: 'description', label: '描述' },
  { key: 'image', label: '套图' },
  { key: 'video', label: '视频' }
]

export const seriesImageTemplateOptions = [
  { imageType: '商品主图', templateId: 'image-main' },
  { imageType: '白底图', templateId: 'image-white-bg' },
  { imageType: '详情图', templateId: 'image-detail' },
  { imageType: '细节图', templateId: 'image-closeup' },
  { imageType: '尺寸图', templateId: 'image-size' },
  { imageType: '颜色图', templateId: 'image-color' },
  { imageType: '场景图', templateId: 'image-scene' },
  { imageType: '模特图', templateId: 'image-model' },
  { imageType: '换角度', templateId: 'image-angle' },
  { imageType: '换场景', templateId: 'image-change-scene' },
  { imageType: '换模特', templateId: 'image-change-model' },
  { imageType: '全替换', templateId: 'image-replace-all' }
]

export const imageTemplateTypeMap = Object.fromEntries(
  seriesImageTemplateOptions.map((item) => [item.templateId, item.imageType])
)

export const imageTemplateDefaultOrder = seriesImageTemplateOptions.map((item) => item.templateId)
