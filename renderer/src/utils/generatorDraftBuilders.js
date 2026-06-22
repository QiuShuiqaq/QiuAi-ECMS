import { seriesImageTemplateOptions } from './generatorFormOptions'

export function buildSeriesPromptAssignments({
  count = 4,
  sharedPrompt = ''
} = {}) {
  const normalizedCount = Math.max(1, Number(count) || 4)

  return Array.from({ length: normalizedCount }, (_unused, index) => {
    const fallback = seriesImageTemplateOptions[index] || seriesImageTemplateOptions[2]
    return {
      id: `series-generate-${index + 1}`,
      index: index + 1,
      prompt: sharedPrompt || '',
      templateId: fallback.templateId,
      imageType: fallback.imageType,
      differenceLevel: 'off'
    }
  })
}

export function buildProjectGeneratorDraft(project, menuKey) {
  const generationConfig = project?.generationConfig || {}
  const selectionSource = project?.metadata?.selectionSource && typeof project.metadata.selectionSource === 'object'
    ? project.metadata.selectionSource
    : null
  const basePatch = {
    projectId: project?.id || '',
    projectName: project?.name || project?.baseInfo?.productName || '',
    taskName: project?.name || project?.baseInfo?.productName || '',
    productName: project?.baseInfo?.productName || project?.name || '',
    platformTargetsText: (project?.platformTarget || []).join(', '),
    language: project?.baseInfo?.language || 'zh-CN',
    keywordsText: (project?.baseInfo?.keywords || []).join(', '),
    sourceImage: project?.assets?.sourceImages?.[0] || null,
    selectionSource,
    selectedTitle: project?.content?.selectedTitle || '',
    selectedDescription: project?.content?.selectedDescription || ''
  }

  const modePatchMap = {
    'series-generate': {
      model: generationConfig.imageModel || 'gpt-image-2',
      size: generationConfig.imageSize || '1:1',
      generateCount: 4,
      batchCount: 1,
      prompt: generationConfig.imagePrompt || '',
      imageTemplateId: generationConfig.imageTemplateId || 'image-default',
      imageType: '商品主图',
      promptAssignments: buildSeriesPromptAssignments({
        count: 4,
        sharedPrompt: generationConfig.imagePrompt || ''
      })
    },
    'video-generate': {
      duration: generationConfig.videoDuration || '6s',
      resolution: generationConfig.videoResolution || '768P',
      aspectRatio: generationConfig.aspectRatio || '16:9',
      motionStrength: generationConfig.videoMotionStrength || 'auto',
      prompt: generationConfig.videoPrompt || '',
      videoTemplateId: generationConfig.videoTemplateId || 'video-main',
      model: generationConfig.videoModel || 'MiniMax-Hailuo-2.3-Fast',
      videoQuantity: Math.max(1, Number(generationConfig.videoQuantity) || 1)
    }
  }

  return {
    ...basePatch,
    ...(modePatchMap[menuKey] || {})
  }
}

export function buildWorkspaceRunDraft(project, workspaceDraft = {}) {
  const generationConfig = project?.generationConfig || {}
  const selectionSource = project?.metadata?.selectionSource && typeof project.metadata.selectionSource === 'object'
    ? project.metadata.selectionSource
    : null

  return {
    ...workspaceDraft,
    projectId: project?.id || '',
    projectName: project?.name || project?.baseInfo?.productName || '',
    productName: project?.baseInfo?.productName || project?.name || '',
    taskName: project?.name || project?.baseInfo?.productName || '',
    brand: project?.baseInfo?.brand || '',
    category: project?.baseInfo?.category || '',
    highlightsText: (project?.baseInfo?.highlights || []).join(', '),
    platformTargetsText: (project?.platformTarget || []).join(', '),
    language: project?.baseInfo?.language || 'zh-CN',
    keywordsText: [workspaceDraft?.keywordsText || '', ...(project?.baseInfo?.keywords || [])]
      .filter(Boolean)
      .join(', '),
    sourceImage: project?.assets?.sourceImages?.[0] || null,
    selectionSource,
    enabledSteps: generationConfig.enabledSteps || undefined,
    titleMaxChars: generationConfig.titleMaxChars || workspaceDraft?.titleMaxChars || 60,
    descriptionMaxChars: generationConfig.descriptionMaxChars || workspaceDraft?.descriptionMaxChars || 300,
    titlePrompt: generationConfig.titlePrompt || workspaceDraft?.titlePrompt || '',
    descriptionPrompt: generationConfig.descriptionPrompt || workspaceDraft?.descriptionPrompt || '',
    imagePrompt: generationConfig.imagePrompt || '',
    videoPrompt: generationConfig.videoPrompt || '',
    imageModel: generationConfig.imageModel || workspaceDraft?.imageModel || 'gpt-image-2',
    videoModel: generationConfig.videoModel || workspaceDraft?.videoModel || 'MiniMax-Hailuo-2.3-Fast',
    size: generationConfig.imageSize || '1:1',
    duration: generationConfig.videoDuration || '6s',
    resolution: generationConfig.videoResolution || '768P',
    aspectRatio: generationConfig.aspectRatio || '16:9',
    motionStrength: generationConfig.videoMotionStrength || 'auto',
    imageTemplateId: generationConfig.imageTemplateId || 'image-default',
    videoTemplateId: generationConfig.videoTemplateId || 'video-main',
    model: workspaceDraft?.model || 'deepseek-v4-flash'
  }
}
