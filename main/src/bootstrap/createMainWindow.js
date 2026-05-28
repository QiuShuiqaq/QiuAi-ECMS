const path = require('node:path')
const { BrowserWindow } = require('electron')

let mainWindow = null

function createMainWindow () {
  if (mainWindow && !mainWindow.isDestroyed()) {
    if (mainWindow.isMinimized()) {
      mainWindow.restore()
    }

    mainWindow.focus()
    return mainWindow
  }

  mainWindow = new BrowserWindow({
    title: 'QiuAi-ECMS',
    width: 1320,
    height: 880,
    minWidth: 1100,
    minHeight: 760,
    backgroundColor: '#f4ecdf',
    icon: path.resolve(__dirname, '../../assets/app-icon.png'),
    webPreferences: {
      preload: path.resolve(__dirname, '../../preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  })

  const devServerUrl = process.env.VITE_DEV_SERVER_URL

  mainWindow.once('ready-to-show', () => {
    mainWindow?.show()
    mainWindow?.focus()
  })

  mainWindow.on('closed', () => {
    mainWindow = null
  })

  mainWindow.webContents.on('did-fail-load', (_event, errorCode, errorDescription, validatedURL) => {
    console.error('QiuAi-ECMS main window failed to load:', {
      errorCode,
      errorDescription,
      validatedURL
    })
  })

  mainWindow.webContents.on('render-process-gone', (_event, details) => {
    console.error('QiuAi-ECMS renderer process exited unexpectedly:', details)
  })

  mainWindow.webContents.on('unresponsive', () => {
    console.error('QiuAi-ECMS main window became unresponsive.')
  })

  if (devServerUrl) {
    mainWindow.loadURL(devServerUrl)
    return mainWindow
  }

  mainWindow.loadFile(path.resolve(__dirname, '../../../renderer/dist/index.html'))
  return mainWindow
}

module.exports = createMainWindow
