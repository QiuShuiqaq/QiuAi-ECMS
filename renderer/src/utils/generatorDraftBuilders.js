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
    projectId: project?.id || '',
    projectName: workspaceDraft?.projectName || project?.name || project?.baseInfo?.productName || '',
    productName: workspaceDraft?.productName || project?.baseInfo?.productName || project?.name || '',
    taskName: workspaceDraft?.taskName || workspaceDraft?.projectName || project?.name || project?.baseInfo?.productName || '',
    brand: workspaceDraft?.brand || project?.baseInfo?.brand || '',
    category: workspaceDraft?.category || project?.baseInfo?.category || '',
    highlightsText: workspaceDraft?.highlightsText || (project?.baseInfo?.highlights || []).join(', '),
    platformTargetsText: workspaceDraft?.platformTargetsText || (project?.platformTarget || []).join(', '),
    language: workspaceDraft?.language || project?.baseInfo?.language || 'zh-CN',
    keywordsText: workspaceDraft?.keywordsText || (project?.baseInfo?.keywords || []).join(', '),
    sourceImage: workspaceDraft?.sourceImage || project?.assets?.sourceImages?.[0] || null,
    selectionSource: workspaceDraft?.selectionSource || selectionSource,
    selectedTitle: workspaceDraft?.selectedTitle || project?.content?.selectedTitle || '',
    selectedDescription: workspaceDraft?.selectedDescription || project?.content?.selectedDescription || '',
    enabledSteps: workspaceDraft?.enabledSteps || generationConfig.enabledSteps || undefined,
    titleMaxChars: workspaceDraft?.titleMaxChars || generationConfig.titleMaxChars || 60,
    descriptionMaxChars: workspaceDraft?.descriptionMaxChars || generationConfig.descriptionMaxChars || 300,
    titlePrompt: workspaceDraft?.titlePrompt || generationConfig.titlePrompt || '',
    descriptionPrompt: workspaceDraft?.descriptionPrompt || generationConfig.descriptionPrompt || '',
    imagePrompt: workspaceDraft?.imagePrompt || generationConfig.imagePrompt || '',
    videoPrompt: workspaceDraft?.videoPrompt || generationConfig.videoPrompt || '',
    imageModel: workspaceDraft?.imageModel || generationConfig.imageModel || 'gpt-image-2',
    videoModel: workspaceDraft?.videoModel || generationConfig.videoModel || 'MiniMax-Hailuo-2.3-Fast',
    size: workspaceDraft?.size || generationConfig.imageSize || '1:1',
    duration: workspaceDraft?.duration || generationConfig.videoDuration || '6s',
    resolution: workspaceDraft?.resolution || generationConfig.videoResolution || '768P',
    aspectRatio: workspaceDraft?.aspectRatio || generationConfig.aspectRatio || '16:9',
    motionStrength: workspaceDraft?.motionStrength || generationConfig.videoMotionStrength || 'auto',
    imageTemplateId: workspaceDraft?.imageTemplateId || generationConfig.imageTemplateId || 'image-default',
    videoTemplateId: workspaceDraft?.videoTemplateId || generationConfig.videoTemplateId || 'video-main',
    titleTemplateId: workspaceDraft?.titleTemplateId || generationConfig.titleTemplateId || '',
    descriptionTemplateId: workspaceDraft?.descriptionTemplateId || generationConfig.descriptionTemplateId || '',
    notes: workspaceDraft?.notes || generationConfig.notes || '',
    model: workspaceDraft?.model || 'deepseek-v4-flash'
  }
}

export function buildProjectTextGeneratorDraft(project, workspaceDraft = {}, kind = 'title') {
  const baseDraft = buildWorkspaceRunDraft(project, workspaceDraft)
  const normalizedKind = kind === 'description' ? 'description' : 'title'

  return {
    ...baseDraft,
    enabledSteps: {
      title: normalizedKind === 'title',
      description: normalizedKind === 'description',
      image: false,
      video: false
    }
  }
}
