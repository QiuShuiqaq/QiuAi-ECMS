import { seriesImageTemplateOptions } from './generatorFormOptions'

function hasRunnableLocalSourceImage(sourceImage) {
  if (!sourceImage || typeof sourceImage !== 'object') {
    return false
  }

  return Boolean(
    String(sourceImage.storedPath || '').trim() ||
    String(sourceImage.path || '').trim()
  )
}

function resolveWorkspaceSourceImage(project, workspaceDraft = {}) {
  const draftSourceImage = workspaceDraft?.sourceImage || null
  if (hasRunnableLocalSourceImage(draftSourceImage)) {
    return draftSourceImage
  }

  return project?.assets?.sourceImages?.[0] || draftSourceImage || null
}

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
      imageType: fallback.imageType
    }
  })
}

function buildSeriesSourceItems(sourceImages = [], assignments = []) {
  const images = Array.isArray(sourceImages) ? sourceImages : []
  return images.map((sourceImage, index) => {
    const assignment = assignments[index] || {}
    return {
      id: sourceImage?.id || `series-source-${index + 1}`,
      sourceImage,
      templateId: assignment.templateId || '',
      prompt: assignment.prompt || '',
      size: '1:1',
      imageType: assignment.imageType || ''
    }
  })
}

export function buildProjectGeneratorDraft(project, menuKey) {
  const generationConfig = project?.generationConfig || {}
  const sourceImages = project?.assets?.sourceImages || []
  const isGroupMode = sourceImages.length > 1
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
    selectedDescription: project?.content?.selectedDescription || '',
    seriesSourceItems: []
  }

  const modePatchMap = {
    'series-generate': {
      model: generationConfig.imageModel || 'gpt-image-2',
      size: generationConfig.size || generationConfig.imageSize || '1:1',
      generateCount: 4,
      batchCount: 1,
      seriesGenerationMode: isGroupMode ? 'group' : 'single',
      prompt: generationConfig.imagePrompt || '',
      imageTemplateId: generationConfig.imageTemplateId || 'image-default',
      imageType: '商品主图',
      promptAssignments: buildSeriesPromptAssignments({
        count: 4,
        sharedPrompt: generationConfig.imagePrompt || ''
      }),
      seriesSourceItems: buildSeriesSourceItems(
        project?.assets?.sourceImages || [],
        buildSeriesPromptAssignments({
          count: Math.max(1, (project?.assets?.sourceImages || []).length || 1),
          sharedPrompt: generationConfig.imagePrompt || ''
        })
      )
    },
    'video-generate': {
      duration: generationConfig.duration || generationConfig.videoDuration || '6s',
      resolution: generationConfig.resolution || generationConfig.videoResolution || '768P',
      aspectRatio: generationConfig.aspectRatio || generationConfig.videoAspectRatio || '16:9',
      motionStrength: generationConfig.motionStrength || generationConfig.videoMotionStrength || 'auto',
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
  const sourceImages = project?.assets?.sourceImages || []
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
    imageLanguage: workspaceDraft?.imageLanguage || generationConfig.imageLanguage || workspaceDraft?.language || project?.baseInfo?.language || 'zh-CN',
    keywordsText: workspaceDraft?.keywordsText || (project?.baseInfo?.keywords || []).join(', '),
    sourceImage: resolveWorkspaceSourceImage(project, workspaceDraft),
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
    size: workspaceDraft?.size || generationConfig.size || generationConfig.imageSize || '1:1',
    duration: workspaceDraft?.duration || generationConfig.duration || generationConfig.videoDuration || '6s',
    resolution: workspaceDraft?.resolution || generationConfig.resolution || generationConfig.videoResolution || '768P',
    aspectRatio: workspaceDraft?.aspectRatio || generationConfig.aspectRatio || generationConfig.videoAspectRatio || '16:9',
    motionStrength: workspaceDraft?.motionStrength || generationConfig.motionStrength || generationConfig.videoMotionStrength || 'auto',
    imageTemplateId: workspaceDraft?.imageTemplateId || generationConfig.imageTemplateId || 'image-default',
    videoTemplateId: workspaceDraft?.videoTemplateId || generationConfig.videoTemplateId || 'video-main',
    titleTemplateId: workspaceDraft?.titleTemplateId || generationConfig.titleTemplateId || '',
    descriptionTemplateId: workspaceDraft?.descriptionTemplateId || generationConfig.descriptionTemplateId || '',
    titleQuantity: workspaceDraft?.titleQuantity || generationConfig.titleQuantity || 1,
    descriptionQuantity: workspaceDraft?.descriptionQuantity || generationConfig.descriptionQuantity || 1,
    generateCount: workspaceDraft?.generateCount || generationConfig.generateCount || 4,
    seriesGenerationMode: workspaceDraft?.seriesGenerationMode || (sourceImages.length > 1 ? 'group' : 'single'),
    promptAssignments: workspaceDraft?.promptAssignments || generationConfig.promptAssignments || buildSeriesPromptAssignments({
      count: workspaceDraft?.generateCount || generationConfig.generateCount || 4,
      sharedPrompt: workspaceDraft?.imagePrompt || generationConfig.imagePrompt || ''
    }),
    seriesSourceItems: workspaceDraft?.seriesSourceItems || [],
    notes: workspaceDraft?.notes || generationConfig.notes || '',
    model: workspaceDraft?.model || generationConfig.model || 'deepseek-chat'
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
