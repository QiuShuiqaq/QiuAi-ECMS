const { ipcMain } = require('electron')
const ipcChannels = require('../../../shared/ipcChannels')

function registerPublishIpc({
  publishDraftService
}) {
  ipcMain.handle(ipcChannels.PUBLISH_GET_CONFIG, async (_event, payload = {}) => {
    return publishDraftService.getConfig(payload)
  })

  ipcMain.handle(ipcChannels.PUBLISH_LIST_CHANNEL_ACCOUNTS, async (_event, payload = {}) => {
    return publishDraftService.listChannelAccounts(payload)
  })

  ipcMain.handle(ipcChannels.PUBLISH_UPSERT_DRAFT, async (_event, payload = {}) => {
    return publishDraftService.upsertDraft(payload)
  })

  ipcMain.handle(ipcChannels.PUBLISH_GET_DRAFT, async (_event, payload = {}) => {
    return publishDraftService.getDraft(payload)
  })

  ipcMain.handle(ipcChannels.PUBLISH_GET_DRAFT_PREVIEW, async (_event, payload = {}) => {
    return publishDraftService.getDraftPreview(payload)
  })

  ipcMain.handle(ipcChannels.PUBLISH_CREATE_TASK, async (_event, payload = {}) => {
    return publishDraftService.createTask(payload)
  })

  ipcMain.handle(ipcChannels.PUBLISH_GET_TASK, async (_event, payload = {}) => {
    return publishDraftService.getTask(payload)
  })

  ipcMain.handle(ipcChannels.PUBLISH_RETRY_TASK, async (_event, payload = {}) => {
    return publishDraftService.retryTask(payload)
  })
}

module.exports = registerPublishIpc
