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
  attachProjectRunToProject
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
    const nextProjects = normalizeProductProjects(state.productProjects).filter((item) => item.id !== normalizedProjectId)
    const nextActiveProductProjectId = resolveActiveProductProjectId(nextProjects, state.activeProductProjectId === normalizedProjectId ? '' : state.activeProductProjectId)

    saveState({
      ...state,
      productProjects: nextProjects,
      activeProductProjectId: nextActiveProductProjectId
    })

    return {
      deleted: true,
      projectId: normalizedProjectId
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
