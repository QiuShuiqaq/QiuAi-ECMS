const path = require('node:path')
const electron = require('electron')
const app = electron?.app

if (!app || typeof app.whenReady !== 'function') {
  throw new Error('QiuAi-ECMS main process must be started by Electron.')
}

if (app.isPackaged && !process.env.QIUAI_DATA_ROOT) {
  process.env.QIUAI_DATA_ROOT = path.join(app.getPath('userData'), 'DATA')
}

const createMainWindow = require('./src/bootstrap/createMainWindow')
const registerAppEvents = require('./src/bootstrap/registerAppEvents')
const registerIpc = require('./src/bootstrap/registerIpc')

async function bootstrap () {
  await app.whenReady()
  app.setAppUserModelId('com.qiuai.ecms.desktop')
  const { studioTaskManagerService } = registerIpc()
  registerAppEvents(createMainWindow, {
    onBeforeQuit: () => studioTaskManagerService?.flushPendingWrites?.()
  })
  createMainWindow()
}

bootstrap().catch((error) => {
  console.error('Failed to bootstrap QiuAi-ECMS:', error)
  app.quit()
})
