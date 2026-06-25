const { ipcMain } = require('electron')
const ipcChannels = require('../../../shared/ipcChannels')

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
