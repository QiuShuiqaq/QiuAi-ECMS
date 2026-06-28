const crypto = require('node:crypto')

const TEMPLATE_KEY = 'projectTemplates'

function trimString(value = '') {
  return typeof value === 'string' ? value.trim() : ''
}

function cloneObject(value) {
  return JSON.parse(JSON.stringify(value))
}

function normalizeImageAsset(asset = {}) {
  if (!asset || typeof asset !== 'object') {
    return null
  }

  const name = trimString(asset.name || '')
  const path = trimString(asset.path || asset.savedPath || asset.storedPath || '')
  const preview = trimString(asset.preview || '')

  if (!name && !path && !preview) {
    return null
  }

  return {
    id: trimString(asset.id || ''),
    name,
    path,
    savedPath: trimString(asset.savedPath || path),
    storedPath: trimString(asset.storedPath || path),
    preview,
    sizeLabel: trimString(asset.sizeLabel || ''),
    sourceUrl: trimString(asset.sourceUrl || ''),
    publishReadyUrl: trimString(asset.publishReadyUrl || '')
  }
}

function normalizeMediaList(list = []) {
  return Array.isArray(list)
    ? list.map((item) => normalizeImageAsset(item)).filter(Boolean)
    : []
}

function normalizeTemplateItem(template = {}) {
  const parameters = template.parameters && typeof template.parameters === 'object'
    ? cloneObject(template.parameters)
    : {}

  return {
    id: trimString(template.id || ''),
    name: trimString(template.name || ''),
    projectId: trimString(template.projectId || ''),
    createdAt: trimString(template.createdAt || ''),
    updatedAt: trimString(template.updatedAt || ''),
    sourceImage: normalizeImageAsset(template.sourceImage),
    generatedTitle: trimString(template.generatedTitle || ''),
    generatedDescription: trimString(template.generatedDescription || ''),
    generatedImages: normalizeMediaList(template.generatedImages),
    generatedVideo: normalizeImageAsset(template.generatedVideo),
    parameters,
    summary: {
      productName: trimString(template.summary?.productName || ''),
      language: trimString(template.summary?.language || ''),
      platformTargetsText: trimString(template.summary?.platformTargetsText || '')
    }
  }
}

function normalizeTemplates(templates = []) {
  return Array.isArray(templates)
    ? templates.map((item) => normalizeTemplateItem(item)).filter((item) => item.id)
    : []
}

function buildTemplateFromProject(project = {}, getNow = () => new Date().toISOString()) {
  const assets = project.assets && typeof project.assets === 'object' ? project.assets : {}
  const content = project.content && typeof project.content === 'object' ? project.content : {}
  const baseInfo = project.baseInfo && typeof project.baseInfo === 'object' ? project.baseInfo : {}
  const generationConfig = project.generationConfig && typeof project.generationConfig === 'object'
    ? cloneObject(project.generationConfig)
    : {}

  const sourceImage = normalizeImageAsset(Array.isArray(assets.sourceImages) ? assets.sourceImages[0] : null)
  const generatedImages = normalizeMediaList(assets.generatedImages)
  const generatedVideo = normalizeImageAsset(assets.generatedVideo)

  return normalizeTemplateItem({
    id: `project-template-${crypto.randomUUID()}`,
    name: trimString(project.name || baseInfo.productName || '未命名模板'),
    projectId: trimString(project.id || ''),
    createdAt: getNow(),
    updatedAt: getNow(),
    sourceImage,
    generatedTitle: trimString(content.selectedTitle || ''),
    generatedDescription: trimString(content.selectedDescription || ''),
    generatedImages,
    generatedVideo,
    parameters: {
      title: {
        prompt: trimString(generationConfig.titlePrompt || ''),
        maxChars: Number(generationConfig.titleMaxChars || 0) || 0,
        quantity: Number(generationConfig.titleQuantity || 0) || 0
      },
      description: {
        prompt: trimString(generationConfig.descriptionPrompt || ''),
        maxChars: Number(generationConfig.descriptionMaxChars || 0) || 0,
        quantity: Number(generationConfig.descriptionQuantity || 0) || 0
      },
      image: {
        prompt: trimString(generationConfig.imagePrompt || ''),
        templateId: trimString(generationConfig.imageTemplateId || ''),
        model: trimString(generationConfig.imageModel || ''),
        size: trimString(generationConfig.imageSize || generationConfig.size || ''),
        generateCount: Number(generationConfig.generateCount || 0) || 0
      },
      video: {
        prompt: trimString(generationConfig.videoPrompt || ''),
        templateId: trimString(generationConfig.videoTemplateId || ''),
        model: trimString(generationConfig.videoModel || ''),
        duration: trimString(generationConfig.videoDuration || ''),
        resolution: trimString(generationConfig.videoResolution || ''),
        motionStrength: trimString(generationConfig.videoMotionStrength || ''),
        aspectRatio: trimString(generationConfig.videoAspectRatio || '')
      }
    },
    summary: {
      productName: trimString(baseInfo.productName || project.name || ''),
      language: trimString(baseInfo.language || ''),
      platformTargetsText: Array.isArray(project.platformTarget)
        ? project.platformTarget.join(', ')
        : trimString(project.platformTargetsText || '')
    }
  })
}

function createProjectTemplateStoreService({
  store,
  getProjectById,
  createId = () => crypto.randomUUID(),
  getNow = () => new Date().toISOString()
}) {
  function listTemplates() {
    return normalizeTemplates(store.get(TEMPLATE_KEY, [])).slice()
  }

  async function saveTemplateFromProject({ projectId = '', name = '' } = {}) {
    const normalizedProjectId = trimString(projectId)
    if (!normalizedProjectId) {
      throw new Error('Project id is required.')
    }

    const project = await getProjectById(normalizedProjectId)
    if (!project) {
      throw new Error('Project was not found.')
    }

    const createdTemplate = buildTemplateFromProject(project, getNow)
    const nextTemplate = normalizeTemplateItem({
      ...createdTemplate,
      id: `project-template-${createId()}`,
      name: trimString(name || createdTemplate.name || '未命名模板'),
      createdAt: getNow(),
      updatedAt: getNow()
    })
    const nextTemplates = [nextTemplate, ...listTemplates()]
    store.set(TEMPLATE_KEY, nextTemplates)
    return nextTemplate
  }

  async function updateTemplate(payload = {}) {
    const targetId = trimString(payload.id || '')
    if (!targetId) {
      throw new Error('Template id is required.')
    }

    const currentTemplates = listTemplates()
    const currentTemplate = currentTemplates.find((item) => item.id === targetId)
    if (!currentTemplate) {
      throw new Error('Template was not found.')
    }

    const nextTemplate = normalizeTemplateItem({
      ...currentTemplate,
      ...cloneObject(payload),
      id: currentTemplate.id,
      projectId: currentTemplate.projectId,
      name: trimString(payload.name || currentTemplate.name),
      updatedAt: getNow()
    })

    const nextTemplates = [
      nextTemplate,
      ...currentTemplates.filter((item) => item.id !== targetId)
    ]
    store.set(TEMPLATE_KEY, nextTemplates)
    return nextTemplate
  }

  async function removeTemplate(id = '') {
    const normalizedId = trimString(id)
    const nextTemplates = listTemplates().filter((item) => item.id !== normalizedId)
    store.set(TEMPLATE_KEY, nextTemplates)
    return { ok: true }
  }

  async function applyTemplate({ id = '' } = {}) {
    const normalizedId = trimString(id)
    const targetTemplate = listTemplates().find((item) => item.id === normalizedId)
    if (!targetTemplate) {
      throw new Error('Template was not found.')
    }

    return cloneObject(targetTemplate)
  }

  return {
    listTemplates,
    saveTemplateFromProject,
    updateTemplate,
    removeTemplate,
    applyTemplate
  }
}

module.exports = {
  createProjectTemplateStoreService
}
