const fs = require('node:fs/promises')
const path = require('node:path')
const { fileURLToPath } = require('node:url')

function normalizeString(value = '') {
  return typeof value === 'string' ? value.trim() : ''
}

function normalizeLocalPath(value = '') {
  const source = normalizeString(value)
  if (!source || /^(https?|data):/i.test(source)) {
    return ''
  }

  if (/^file:/i.test(source)) {
    try {
      return fileURLToPath(source)
    } catch {
      return ''
    }
  }

  return source
}

function isPathInsideAllowedRoots(targetPath = '', allowedRoots = []) {
  const resolvedTarget = path.resolve(targetPath)
  return allowedRoots.some((rootPath) => {
    const resolvedRoot = path.resolve(rootPath)
    return resolvedTarget !== resolvedRoot && resolvedTarget.startsWith(`${resolvedRoot}${path.sep}`)
  })
}

function addLocalPath(targetSet, value = '', allowedRoots = []) {
  const localPath = normalizeLocalPath(value)
  if (!localPath) return

  const resolvedPath = path.resolve(localPath)
  if (isPathInsideAllowedRoots(resolvedPath, allowedRoots)) {
    targetSet.add(resolvedPath)
  }
}

function collectProjectCleanupPaths({
  project = null,
  projectRuns = [],
  inputRootDirectory = '',
  allowedRoots = []
} = {}) {
  const cleanupPaths = new Set()
  const normalizedProjectId = normalizeString(project?.id)
  if (!normalizedProjectId) {
    return []
  }

  addLocalPath(cleanupPaths, path.resolve(inputRootDirectory, 'workspace', normalizedProjectId), allowedRoots)

  const sourceImages = Array.isArray(project?.assets?.sourceImages) ? project.assets.sourceImages : []
  const generatedImages = Array.isArray(project?.assets?.generatedImages) ? project.assets.generatedImages : []
  const generatedVideo = project?.assets?.generatedVideo && typeof project.assets.generatedVideo === 'object'
    ? project.assets.generatedVideo
    : null

  sourceImages.forEach((item) => {
    addLocalPath(cleanupPaths, item?.storedPath, allowedRoots)
    addLocalPath(cleanupPaths, item?.path, allowedRoots)
  })

  generatedImages.forEach((item) => {
    addLocalPath(cleanupPaths, item?.savedPath, allowedRoots)
    addLocalPath(cleanupPaths, item?.path, allowedRoots)
  })

  if (generatedVideo) {
    addLocalPath(cleanupPaths, generatedVideo.savedPath, allowedRoots)
    addLocalPath(cleanupPaths, generatedVideo.path, allowedRoots)
  }

  projectRuns.forEach((run) => {
    const storage = run?.storage && typeof run.storage === 'object' ? run.storage : {}
    addLocalPath(cleanupPaths, storage.runDirectory, allowedRoots)
    addLocalPath(cleanupPaths, storage.titleFile, allowedRoots)
    addLocalPath(cleanupPaths, storage.descriptionFile, allowedRoots)
    addLocalPath(cleanupPaths, storage.imageDirectory, allowedRoots)
    addLocalPath(cleanupPaths, storage.videoDirectory, allowedRoots)

    const outputs = run?.outputs && typeof run.outputs === 'object' ? run.outputs : {}
    const outputImages = Array.isArray(outputs.images) ? outputs.images : []
    outputImages.forEach((item) => {
      addLocalPath(cleanupPaths, item?.savedPath, allowedRoots)
      addLocalPath(cleanupPaths, item?.path, allowedRoots)
    })

    if (outputs.video) {
      addLocalPath(cleanupPaths, outputs.video.savedPath, allowedRoots)
      addLocalPath(cleanupPaths, outputs.video.path, allowedRoots)
    }
  })

  return [...cleanupPaths].sort((left, right) => right.length - left.length)
}

async function removeCleanupPaths(paths = [], { removePath = fs.rm } = {}) {
  for (const targetPath of paths) {
    await removePath(targetPath, { recursive: true, force: true })
  }
}

function createWorkspaceProductProjectService({
  getStoredState,
  saveState,
  createId,
  getNow,
  normalizeProductProjects,
  resolveActiveProductProjectId,
  buildEmptyProductProject,
  updateProductProjectFields,
  upsertProductProject,
  attachTaskRefToProductProject,
  buildWorkspaceProjectDraft,
  applyWorkspaceTextResultsToProject,
  applyImageResultsToProject,
  applyVideoResultsToProject,
  attachProjectRunToProject,
  inputRootDirectory = '',
  outputRootDirectory = '',
  removePath = fs.rm
} = {}) {
  async function createProject({
    projectId = '',
    productName = '',
    platform = 'temu',
    language = 'zh-CN',
    patch = null
  } = {}) {
    const state = getStoredState()
    const createdAt = getNow()
    const createdProject = buildEmptyProductProject({
      projectId: projectId || `project-${createId()}`,
      productName,
      platform,
      language,
      createdAt
    })
    const nextCreatedProject = patch && typeof patch === 'object'
      ? updateProductProjectFields(createdProject, patch, createdAt)
      : createdProject

    const nextProjects = [
      nextCreatedProject,
      ...normalizeProductProjects(state.productProjects)
    ]

    saveState({
      ...state,
      productProjects: nextProjects,
      activeProductProjectId: nextCreatedProject.id
    })

    return nextCreatedProject
  }

  async function updateProject({
    projectId = '',
    patch = {}
  } = {}) {
    const normalizedProjectId = String(projectId || '').trim()
    if (!normalizedProjectId) {
      throw new Error('商品项目 ID 不能为空')
    }

    const state = getStoredState()
    const existingProject = normalizeProductProjects(state.productProjects).find((item) => item.id === normalizedProjectId)
    if (!existingProject) {
      throw new Error('未找到需要更新的商品项目')
    }

    const nextProject = updateProductProjectFields(existingProject, patch, getNow())
    const nextProjects = upsertProductProject(state.productProjects, nextProject)

    saveState({
      ...state,
      productProjects: nextProjects,
      activeProductProjectId: normalizedProjectId
    })

    return nextProject
  }

  async function deleteProject({
    projectId = ''
  } = {}) {
    const normalizedProjectId = String(projectId || '').trim()
    if (!normalizedProjectId) {
      throw new Error('商品项目 ID 不能为空')
    }

    const state = getStoredState()
    const normalizedProjects = normalizeProductProjects(state.productProjects)
    const existingProject = normalizedProjects.find((item) => item.id === normalizedProjectId) || null
    const relatedProjectRuns = Array.isArray(state.projectRuns)
      ? state.projectRuns.filter((item) => item?.projectId === normalizedProjectId)
      : []
    const relatedTaskIds = new Set([
      ...(Array.isArray(existingProject?.taskRefs) ? existingProject.taskRefs : []),
      ...relatedProjectRuns.map((item) => item?.taskId)
    ].map((item) => normalizeString(item)).filter(Boolean))
    const allowedCleanupRoots = [inputRootDirectory, outputRootDirectory].map((item) => normalizeString(item)).filter(Boolean)
    const cleanupPaths = collectProjectCleanupPaths({
      project: existingProject,
      projectRuns: relatedProjectRuns,
      inputRootDirectory,
      allowedRoots: allowedCleanupRoots
    })

    await removeCleanupPaths(cleanupPaths, { removePath })

    const nextProjects = normalizedProjects.filter((item) => item.id !== normalizedProjectId)
    const nextProjectRuns = Array.isArray(state.projectRuns)
      ? state.projectRuns.filter((item) => item?.projectId !== normalizedProjectId)
      : state.projectRuns
    const nextTasks = Array.isArray(state.tasks) && relatedTaskIds.size
      ? state.tasks.filter((item) => !relatedTaskIds.has(normalizeString(item?.id)))
      : state.tasks
    const nextActiveProductProjectId = resolveActiveProductProjectId(nextProjects, state.activeProductProjectId === normalizedProjectId ? '' : state.activeProductProjectId)

    saveState({
      ...state,
      productProjects: nextProjects,
      projectRuns: nextProjectRuns,
      tasks: nextTasks,
      activeProductProjectId: nextActiveProductProjectId
    })

    return {
      deleted: true,
      projectId: normalizedProjectId,
      cleanedPathCount: cleanupPaths.length
    }
  }

  function prepareProjectStateForTaskCreation({
    state,
    menuKey = 'workspace',
    draft = {},
    taskId = '',
    projectRunId = ''
  } = {}) {
    const now = getNow()
    let nextDraft = { ...draft }
    let nextProductProjects = state.productProjects
    let nextActiveProductProjectId = state.activeProductProjectId
    let currentProjectForRun = null

    if (menuKey === 'workspace') {
      const existingProject = state.productProjects.find((project) => {
        return project.id === draft.projectId || project.id === state.activeProductProjectId
      }) || null
      const projectId = draft.projectId || existingProject?.id || `project-${createId()}`
      const updatedProject = attachTaskRefToProductProject(
        buildWorkspaceProjectDraft({
          currentProject: existingProject,
          draft,
          projectId,
          createdAt: existingProject?.createdAt || now,
          updatedAt: now
        }),
        taskId,
        now
      )

      currentProjectForRun = updatedProject
      nextProductProjects = upsertProductProject(
        state.productProjects,
        attachProjectRunToProject(updatedProject, projectRunId, now)
      )
      nextActiveProductProjectId = projectId
      nextDraft = {
        ...draft,
        projectId,
        projectName: updatedProject.name
      }
    } else if (draft.projectId) {
      const existingProject = normalizeProductProjects(state.productProjects).find((project) => project.id === draft.projectId) || null
      if (existingProject) {
        currentProjectForRun = attachTaskRefToProductProject(existingProject, taskId, now)
        nextProductProjects = upsertProductProject(
          state.productProjects,
          attachProjectRunToProject(currentProjectForRun, projectRunId, now)
        )
        nextActiveProductProjectId = existingProject.id
      }
    }

    return {
      draft: nextDraft,
      currentProjectForRun,
      nextProductProjects,
      nextActiveProductProjectId
    }
  }

  function applyTaskResultToProjects({
    latestState,
    preparedDraft,
    taskId = '',
    menuKey = '',
    enrichedResultPayload = {},
    createdAt = ''
  } = {}) {
    const now = getNow()
    const currentProject = preparedDraft.projectId
      ? (
          latestState.productProjects.find((project) => project.id === preparedDraft.projectId) || buildWorkspaceProjectDraft({
            draft: preparedDraft,
            projectId: preparedDraft.projectId,
            createdAt,
            updatedAt: now
          })
        )
      : null

    if (!currentProject) {
      return latestState.productProjects
    }

    if (menuKey === 'workspace') {
      const projectWithTaskRef = attachTaskRefToProductProject(currentProject, taskId, now)
      const projectWithText = applyWorkspaceTextResultsToProject(
        projectWithTaskRef,
        enrichedResultPayload,
        now
      )
      const projectWithImages = applyImageResultsToProject(
        projectWithText,
        enrichedResultPayload,
        now
      )

      return upsertProductProject(
        latestState.productProjects,
        applyVideoResultsToProject(
          projectWithImages,
          enrichedResultPayload,
          now
        )
      )
    }

    if (menuKey === 'series-generate') {
      return upsertProductProject(
        latestState.productProjects,
        applyImageResultsToProject(
          attachTaskRefToProductProject(currentProject, taskId, now),
          enrichedResultPayload,
          now
        )
      )
    }

    if (menuKey === 'video-generate') {
      return upsertProductProject(
        latestState.productProjects,
        applyVideoResultsToProject(
          attachTaskRefToProductProject(currentProject, taskId, now),
          enrichedResultPayload,
          now
        )
      )
    }

    return latestState.productProjects
  }

  return {
    createProject,
    updateProject,
    deleteProject,
    prepareProjectStateForTaskCreation,
    applyTaskResultToProjects
  }
}

module.exports = {
  createWorkspaceProductProjectService
}
