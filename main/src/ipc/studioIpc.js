const { dialog, ipcMain, shell } = require('electron')
const fs = require('node:fs')
const path = require('node:path')
const ipcChannels = require('../../../shared/ipcChannels')
const { describeSupportedImageFiles } = require('../services/localInputAssetService')

async function openOutputDirectory ({ outputDirectory = '' } = {}) {
  if (!outputDirectory) {
    throw new Error('Output directory is required.')
  }

  return shell.openPath(outputDirectory)
}

async function openExternalResource ({ target = '' } = {}) {
  const normalizedTarget = String(target || '').trim()
  if (!normalizedTarget) {
    throw new Error('Resource target is required.')
  }

  console.log('[studioIpc] openExternalResource target =', normalizedTarget)
  if (/^https?:\/\//i.test(normalizedTarget)) {
    return shell.openExternal(normalizedTarget)
  }

  return shell.openPath(normalizedTarget)
}

function resolveUploadDefaultPath (settingsService, menuKey = '') {
  const configuredPath = settingsService?.getSettings?.().uploadDirectories?.[menuKey] || ''
  if (configuredPath && fs.existsSync(configuredPath)) {
    return configuredPath
  }

  return process.cwd()
}

function registerStudioIpc({ studioWorkspaceService, settingsService, dataTraceService, activationGuard }) {
  async function requireActivated () {
    await activationGuard?.assertActivated?.()
  }

  ipcMain.handle(ipcChannels.STUDIO_GET_SNAPSHOT, async () => {
    return studioWorkspaceService.getDisplaySnapshot()
  })

  ipcMain.handle(ipcChannels.STUDIO_GET_RUNTIME_SNAPSHOT, async () => {
    return studioWorkspaceService.getRuntimeSnapshot()
  })

  ipcMain.handle(ipcChannels.STUDIO_CREATE_PROJECT, async (_event, payload = {}) => {
    await requireActivated()
    return studioWorkspaceService.createProject(payload)
  })

  ipcMain.handle(ipcChannels.STUDIO_UPDATE_PROJECT, async (_event, payload = {}) => {
    await requireActivated()
    return studioWorkspaceService.updateProject(payload)
  })

  ipcMain.handle(ipcChannels.STUDIO_DELETE_PROJECT, async (_event, payload = {}) => {
    await requireActivated()
    return studioWorkspaceService.deleteProject(payload)
  })

  ipcMain.handle(ipcChannels.STUDIO_EXPORT_PROJECT_BUNDLE, async (_event, payload = {}) => {
    await requireActivated()
    const snapshot = studioWorkspaceService.getSnapshot()
    const project = (snapshot.productProjects || []).find((item) => item.id === payload.projectId)

    if (!project) {
      throw new Error('未找到可导出的商品项目')
    }

    const archiveName = `${project.name || 'product-project'}.zip`
    const result = await dialog.showSaveDialog({
      defaultPath: path.resolve(process.cwd(), archiveName),
      filters: [
        {
          name: 'Zip Archive',
          extensions: ['zip']
        }
      ]
    })

    if (result.canceled || !result.filePath) {
      return {
        canceled: true,
        targetZipPath: ''
      }
    }

    return studioWorkspaceService.exportProjectBundle({
      ...payload,
      targetZipPath: result.filePath
    })
  })

  ipcMain.handle(ipcChannels.STUDIO_SAVE_DRAFT, async (_event, payload = {}) => {
    await requireActivated()
    return studioWorkspaceService.saveDraft(payload)
  })

  ipcMain.handle(ipcChannels.STUDIO_CREATE_TASK, async (_event, payload = {}) => {
    await requireActivated()
    return studioWorkspaceService.createTask(payload)
  })

  ipcMain.handle(ipcChannels.STUDIO_CANCEL_TASK, async (_event, payload = {}) => {
    await requireActivated()
    return studioWorkspaceService.cancelTask(payload)
  })

  ipcMain.handle(ipcChannels.STUDIO_PICK_INPUT_ASSETS, async (_event, payload = {}) => {
    await requireActivated()
    const result = await dialog.showOpenDialog({
      defaultPath: resolveUploadDefaultPath(settingsService, payload.menuKey),
      properties: payload.allowMultiple ? ['openFile', 'multiSelections'] : ['openFile'],
      filters: [
        {
          name: 'Images',
          extensions: ['png', 'jpg', 'jpeg', 'webp']
        }
      ]
    })

    return {
      canceled: result.canceled,
      files: result.canceled ? [] : await describeSupportedImageFiles(result.filePaths || [])
    }
  })

  ipcMain.handle(ipcChannels.STUDIO_OPEN_OUTPUT_DIRECTORY, async (_event, payload = {}) => {
    await requireActivated()
    return openOutputDirectory(payload)
  })

  ipcMain.handle(ipcChannels.STUDIO_OPEN_EXTERNAL_RESOURCE, async (_event, payload = {}) => {
    const normalizedTarget = String(payload?.target || '').trim()
    const isHttpTarget = /^https?:\/\//i.test(normalizedTarget)
    if (!isHttpTarget) {
      await requireActivated()
    }
    return openExternalResource(payload)
  })

  ipcMain.handle(ipcChannels.STUDIO_CLEAR_RUNTIME_STATE, async () => {
    await requireActivated()
    const clearedState = await studioWorkspaceService.clearRuntimeState()
    await dataTraceService?.clearRuntimeFiles?.()

    return clearedState
  })

  ipcMain.handle(ipcChannels.STUDIO_EXPORT_RESULTS, async (_event, payload = {}) => {
    await requireActivated()
    const snapshot = studioWorkspaceService.getSnapshot()
    const exportItems = snapshot.exportItemsByMenu?.[payload.menuKey] || []
    const selectedIdSet = new Set(Array.isArray(payload.selectedExportIds) ? payload.selectedExportIds : [])
    const firstSelectedItem = exportItems.find((item) => selectedIdSet.has(item.id)) || exportItems[0]
    const baseDirectory = firstSelectedItem?.savedPath
      ? path.dirname(firstSelectedItem.savedPath)
      : (firstSelectedItem?.outputDirectory || process.cwd())
    const archiveName = `${payload.menuKey || 'studio-results'}-results.zip`
    const result = await dialog.showSaveDialog({
      defaultPath: path.resolve(baseDirectory, archiveName),
      filters: [
        {
          name: 'Zip Archive',
          extensions: ['zip']
        }
      ]
    })

    if (result.canceled || !result.filePath) {
      return {
        menuKey: payload.menuKey || '',
        canceled: true,
        targetZipPath: ''
      }
    }

    const exportedArchive = await studioWorkspaceService.exportSelectedResults({
      ...payload,
      targetZipPath: result.filePath
    })

    return {
      ...exportedArchive,
      canceled: false
    }
  })
}

module.exports = registerStudioIpc
