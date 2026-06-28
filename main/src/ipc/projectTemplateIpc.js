const { ipcMain } = require('electron')
const ipcChannels = require('../../../shared/ipcChannels')

function registerProjectTemplateIpc({ projectTemplateService }) {
  ipcMain.handle(ipcChannels.PROJECT_TEMPLATES_LIST, () => {
    return projectTemplateService.listTemplates()
  })

  ipcMain.handle(ipcChannels.PROJECT_TEMPLATES_SAVE_FROM_PROJECT, async (_event, payload = {}) => {
    return projectTemplateService.saveTemplateFromProject(payload)
  })

  ipcMain.handle(ipcChannels.PROJECT_TEMPLATES_UPDATE, async (_event, payload = {}) => {
    return projectTemplateService.updateTemplate(payload)
  })

  ipcMain.handle(ipcChannels.PROJECT_TEMPLATES_REMOVE, async (_event, payload = {}) => {
    return projectTemplateService.removeTemplate(payload.id)
  })

  ipcMain.handle(ipcChannels.PROJECT_TEMPLATES_APPLY, async (_event, payload = {}) => {
    return projectTemplateService.applyTemplate(payload)
  })
}

module.exports = registerProjectTemplateIpc
