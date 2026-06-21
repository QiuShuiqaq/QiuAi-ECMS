export function validateGeneratorTaskDraft({
  menuKey,
  draft,
  capability,
  effectiveGenerationLimits
}) {
  if ((menuKey === 'series-generate' || menuKey === 'video-generate') && !draft?.sourceImage) {
    return {
      title: '请先上传样图',
      message: '套图生成和视频生成都需要先上传样图'
    }
  }

  if (menuKey === 'series-generate') {
    const generateCount = Math.max(1, Number(draft?.generateCount) || 1)
    const batchCount = Math.max(1, Number(draft?.batchCount) || 1)
    const imageConcurrencyLimit = effectiveGenerationLimits?.imageConcurrency || 1
    const serviceTier = effectiveGenerationLimits?.serviceTier || 'SHARED'

    if (capability && capability.batchTaskEnabled === false && batchCount > 1) {
      return {
        title: '当前版本不支持',
        message: '标准版不支持批量套图任务'
      }
    }

    if (batchCount > imageConcurrencyLimit) {
      return {
        title: '超过服务并发上限',
        message: `当前服务档位 ${serviceTier} 最多允许 ${imageConcurrencyLimit} 个图像并发批次`
      }
    }

    if (capability && generateCount > Number(capability.seriesImageLimitPerTask || 5)) {
      return {
        title: '超过版本上限',
        message: `当前版本单次套图最多 ${capability.seriesImageLimitPerTask} 张`
      }
    }
  }

  if (menuKey === 'video-generate' && (effectiveGenerationLimits?.videoConcurrency || 0) < 1) {
    return {
      title: '当前服务暂不支持',
      message: '当前账户还没有视频生成并发权限'
    }
  }

  return null
}
