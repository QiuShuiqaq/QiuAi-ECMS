const path = require('node:path')
const { app, protocol } = require('electron')

if (app.isPackaged && !process.env.QIUAI_DATA_ROOT) {
  process.env.QIUAI_DATA_ROOT = path.join(app.getPath('userData'), 'DATA')
}

protocol.registerSchemesAsPrivileged([{
  scheme: 'qiuai-media',
  privileges: {
    standard: true,
    secure: true,
    supportFetchAPI: true,
    stream: true
  }
}])

const createMainWindow = require('./src/bootstrap/createMainWindow')
const registerAppEvents = require('./src/bootstrap/registerAppEvents')
const registerIpc = require('./src/bootstrap/registerIpc')
const registerLocalMediaProtocol = require('./src/bootstrap/registerLocalMediaProtocol')

async function bootstrap () {
  await app.whenReady()
  app.setAppUserModelId('com.qiuai.desktop')
  registerLocalMediaProtocol()
  const { studioTaskManagerService, studioWorkspaceService } = registerIpc()
  registerAppEvents(createMainWindow, {
    onBeforeQuit: () => {
      studioWorkspaceService?.flushPendingStateWrites?.()
      studioTaskManagerService?.flushPendingWrites?.()
    }
  })
  createMainWindow()
}

bootstrap().catch((error) => {
  console.error('Failed to bootstrap QiuAi:', error)
  app.quit()
})
