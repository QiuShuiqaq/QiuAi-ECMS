const { ipcMain } = require('electron')
const ipcChannels = require('../../../shared/ipcChannels')

function trimString (value = '') {
  return typeof value === 'string' ? value.trim() : ''
}

async function getSessionToken (settingsService) {
  const settings = await settingsService.getSettings()
  return trimString(settings?.authPlatform?.sessionToken)
}

async function requireSessionToken (settingsService) {
  const sessionToken = await getSessionToken(settingsService)
  if (sessionToken) {
    return sessionToken
  }

  const error = new Error('Remote authorization is required before using selection assistant features.')
  error.code = 'REMOTE_AUTH_REQUIRED'
  throw error
}

function registerSelectionIpc ({
  selectionCacheService
}) {
  ipcMain.handle(ipcChannels.SELECTION_GET_MANIFEST, async () => {
    return selectionCacheService.getManifest()
  })

  ipcMain.handle(ipcChannels.SELECTION_LIST_PLATFORMS, async () => {
    return selectionCacheService.listPlatforms()
  })

  ipcMain.handle(ipcChannels.SELECTION_LIST_SITES, async (_event, payload = {}) => {
    return selectionCacheService.listSites(payload)
  })

  ipcMain.handle(ipcChannels.SELECTION_LIST_ITEMS, async (_event, payload = {}) => {
    return selectionCacheService.listItems(payload)
  })

  ipcMain.handle(ipcChannels.SELECTION_GET_ITEM_DETAIL, async (_event, payload = {}) => {
    return selectionCacheService.getItemDetail(payload)
  })
}

module.exports = registerSelectionIpc
