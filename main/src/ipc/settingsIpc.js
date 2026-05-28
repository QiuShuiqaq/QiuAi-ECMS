const { ipcMain } = require('electron')
const ipcChannels = require('../../../shared/ipcChannels')

function registerSettingsIpc ({ settingsService }) {
  ipcMain.handle(ipcChannels.SETTINGS_GET, () => {
    return settingsService.getPublicSettings()
  })

  ipcMain.handle(ipcChannels.SETTINGS_GET_ADMIN_STATUS, () => {
    return settingsService.getAdminStatus()
  })

  ipcMain.handle(ipcChannels.SETTINGS_VERIFY_ADMIN_PASSWORD, async (_event, payload = {}) => {
    return settingsService.verifyAdminPassword(payload)
  })

  ipcMain.handle(ipcChannels.SETTINGS_SAVE, async (_event, payload = {}) => {
    return settingsService.saveSettings(payload)
  })

  ipcMain.handle(ipcChannels.SETTINGS_SAVE_ADMIN_API_KEY, async (_event, payload = {}) => {
    return settingsService.saveAdminApiKey(payload)
  })

  ipcMain.handle(ipcChannels.SETTINGS_SAVE_GLM_API_KEY, async (_event, payload = {}) => {
    return settingsService.saveGlmApiKey(payload)
  })
}

module.exports = registerSettingsIpc
