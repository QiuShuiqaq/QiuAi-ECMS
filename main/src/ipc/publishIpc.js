const { ipcMain } = require('electron')
const ipcChannels = require('../../../shared/ipcChannels')

function registerPublishIpc({
  publishDraftService,
  activationGuard
}) {
  async function requireActivated () {
    await activationGuard?.assertActivated?.()
  }

  ipcMain.handle(ipcChannels.PUBLISH_GET_CONFIG, async (_event, payload = {}) => {
    await requireActivated()
    return publishDraftService.getConfig(payload)
  })

  ipcMain.handle(ipcChannels.PUBLISH_LIST_CHANNEL_ACCOUNTS, async (_event, payload = {}) => {
    await requireActivated()
    return publishDraftService.listChannelAccounts(payload)
  })

  ipcMain.handle(ipcChannels.PUBLISH_UPSERT_DRAFT, async (_event, payload = {}) => {
    await requireActivated()
    return publishDraftService.upsertDraft(payload)
  })

  ipcMain.handle(ipcChannels.PUBLISH_GET_DRAFT, async (_event, payload = {}) => {
    await requireActivated()
    return publishDraftService.getDraft(payload)
  })

  ipcMain.handle(ipcChannels.PUBLISH_GET_DRAFT_PREVIEW, async (_event, payload = {}) => {
    await requireActivated()
    return publishDraftService.getDraftPreview(payload)
  })

  ipcMain.handle(ipcChannels.PUBLISH_CREATE_TASK, async (_event, payload = {}) => {
    await requireActivated()
    return publishDraftService.createTask(payload)
  })

  ipcMain.handle(ipcChannels.PUBLISH_GET_TASK, async (_event, payload = {}) => {
    await requireActivated()
    return publishDraftService.getTask(payload)
  })

  ipcMain.handle(ipcChannels.PUBLISH_RETRY_TASK, async (_event, payload = {}) => {
    await requireActivated()
    return publishDraftService.retryTask(payload)
  })
}

module.exports = registerPublishIpc
