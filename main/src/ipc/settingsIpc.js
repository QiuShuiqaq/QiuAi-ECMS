const { ipcMain } = require('electron')
const ipcChannels = require('../../../shared/ipcChannels')

function registerSettingsIpc ({ settingsService }) {
  ipcMain.handle(ipcChannels.SETTINGS_GET, () => {
    return settingsService.getSettings()
  })

  ipcMain.handle(ipcChannels.SETTINGS_SAVE, async (_event, payload = {}) => {
    return settingsService.saveSettings(payload)
  })

  ipcMain.handle(ipcChannels.SETTINGS_SAVE_PROVIDER_API_KEYS, async (_event, payload = {}) => {
    return settingsService.saveProviderApiKeys(payload)
  })
}

module.exports = registerSettingsIpc
