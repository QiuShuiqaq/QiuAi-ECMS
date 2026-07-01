const { ipcMain } = require('electron')
const ipcChannels = require('../../../shared/ipcChannels')

function registerSelectionIpc ({
  selectionCacheService,
  activationGuard
}) {
  async function requireActivated () {
    await activationGuard?.assertActivated?.()
  }

  ipcMain.handle(ipcChannels.SELECTION_GET_MANIFEST, async () => {
    await requireActivated()
    return selectionCacheService.getManifest()
  })

  ipcMain.handle(ipcChannels.SELECTION_LIST_PLATFORMS, async () => {
    await requireActivated()
    return selectionCacheService.listPlatforms()
  })

  ipcMain.handle(ipcChannels.SELECTION_LIST_SITES, async (_event, payload = {}) => {
    await requireActivated()
    return selectionCacheService.listSites(payload)
  })

  ipcMain.handle(ipcChannels.SELECTION_LIST_ITEMS, async (_event, payload = {}) => {
    await requireActivated()
    return selectionCacheService.listItems(payload)
  })

  ipcMain.handle(ipcChannels.SELECTION_GET_ITEM_DETAIL, async (_event, payload = {}) => {
    await requireActivated()
    return selectionCacheService.getItemDetail(payload)
  })
}

module.exports = registerSelectionIpc
