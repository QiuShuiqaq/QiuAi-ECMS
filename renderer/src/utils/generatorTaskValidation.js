function getSeriesSourceItems(draft = {}) {
  return Array.isArray(draft?.seriesSourceItems)
    ? draft.seriesSourceItems.filter((item) => item?.sourceImage)
    : []
}

export function validateGeneratorTaskDraft({
  menuKey,
  draft,
  capability,
  effectiveGenerationLimits
}) {
  const seriesSourceItems = getSeriesSourceItems(draft)

  if (menuKey === 'series-generate' && !seriesSourceItems.length && !draft?.sourceImage) {
    return {
      title: '请先上传样图',
      message: '套图生成需要先上传至少一张样图'
    }
  }

  if (menuKey === 'video-generate' && !draft?.sourceImage) {
    return {
      title: '请先上传样图',
      message: '视频生成需要先上传一张样图'
    }
  }

  if (menuKey === 'series-generate') {
    const generateCount = Math.max(1, seriesSourceItems.length || Number(draft?.generateCount) || 1)
    const batchCount = Math.max(1, Number(draft?.batchCount) || 1)
    const imageConcurrencyLimit = effectiveGenerationLimits?.imageConcurrency || 1
    const serviceTier = effectiveGenerationLimits?.serviceTier || 'SHARED'

    if (capability && capability.batchTaskEnabled === false && batchCount > 1) {
      return {
        title: '当前版本不支持',
        message: '当前版本不支持批量套图任务'
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
      message: '当前账号还没有视频生成并发权限'
    }
  }

  return null
}
