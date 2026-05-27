const { dialog, ipcMain, shell } = require('electron')
const fs = require('node:fs')
const fsp = require('node:fs/promises')
const path = require('node:path')
const axios = require('axios')
const ipcChannels = require('../../../shared/ipcChannels')
const { describeSupportedImageFiles } = require('../services/localInputAssetService')

async function openOutputDirectory ({ outputDirectory = '' } = {}) {
  if (!outputDirectory) {
    throw new Error('Output directory is required.')
  }

  return shell.openPath(outputDirectory)
}

const SAFE_EXTERNAL_HOST_ALLOWLIST = new Set([
  'www.temu.com',
  'temu.com',
  'us.shein.com',
  'shein.com',
  'www.shein.com',
  'www.amazon.com',
  'amazon.com',
  'shopee.com',
  'www.shopee.com',
  'shopee.com.my',
  'www.shopee.com.my',
  'www.aliexpress.com',
  'aliexpress.com',
  'www.aliexpress.us',
  'aliexpress.us',
  'www.tiktok.com',
  'tiktok.com'
])

const WORKFLOW_ASSET_HOST_ALLOWLIST = new Set([
  'down-my.img.susercontent.com',
  'img.ltwebstatic.com',
  'image.useinsider.com',
  'images-na.ssl-images-amazon.com',
  'm.media-amazon.com',
  'ae01.alicdn.com',
  'img.alicdn.com',
  'img-va.myshopline.com',
  'lf16-tiktok-web.tiktokcdn.com',
  'p16-tiktokcdn-com.akamaized.net',
  'img.kwcdn.com',
  'image-cdn.pinduoduo.com'
])

const WORKFLOW_ASSET_MAX_BYTES = 8 * 1024 * 1024

async function openSafeExternalUrl ({ targetUrl = '' } = {}) {
  const normalizedTargetUrl = typeof targetUrl === 'string' ? targetUrl.trim() : ''
  let parsedUrl

  try {
    parsedUrl = new URL(normalizedTargetUrl)
  } catch {
    throw new Error('无效的商品链接')
  }

  if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
    throw new Error('仅支持打开 http/https 链接')
  }

  if (!SAFE_EXTERNAL_HOST_ALLOWLIST.has(parsedUrl.hostname)) {
    throw new Error('未授权的商品来源域名')
  }

  await shell.openExternal(parsedUrl.toString())

  return {
    targetUrl: parsedUrl.toString()
  }
}

function resolveWorkflowAssetExtension(mimeType = '') {
  const extensionMap = {
    'image/svg+xml': '.svg',
    'image/png': '.png',
    'image/jpeg': '.jpg',
    'image/webp': '.webp'
  }

  return extensionMap[mimeType] || '.bin'
}

function sanitizeWorkflowAssetFileName(fileName = '') {
  return String(fileName || 'workflow-reference')
    .split('')
    .map((character) => {
      const code = character.charCodeAt(0)
      if ('<>:"/\\|?*'.includes(character) || code <= 31) {
        return '-'
      }
      return character
    })
    .join('')
    .slice(0, 80) || 'workflow-reference'
}

async function downloadWorkflowAssetBuffer(remoteUrl = '') {
  const normalizedRemoteUrl = typeof remoteUrl === 'string' ? remoteUrl.trim() : ''
  if (!normalizedRemoteUrl) {
    throw new Error('缺少工作流商品图地址')
  }

  let parsedUrl
  try {
    parsedUrl = new URL(normalizedRemoteUrl)
  } catch {
    throw new Error('无效的工作流商品图地址')
  }

  if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
    throw new Error('工作流商品图仅支持 http/https 地址')
  }

  if (!WORKFLOW_ASSET_HOST_ALLOWLIST.has(parsedUrl.hostname)) {
    throw new Error('工作流参考图来源未授权')
  }

  const response = await axios.get(parsedUrl.toString(), {
    responseType: 'arraybuffer',
    timeout: 30000,
    headers: {
      Accept: 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8',
      'User-Agent': 'Mozilla/5.0'
    }
  })
  const contentType = String(response?.headers?.['content-type'] || 'image/png').split(';')[0].trim() || 'image/png'
  const buffer = Buffer.from(response.data || [])

  if (!contentType.startsWith('image/')) {
    throw new Error('工作流参考图仅支持图片内容')
  }

  if (!buffer.length) {
    throw new Error('工作流商品图下载为空')
  }

  if (buffer.byteLength > WORKFLOW_ASSET_MAX_BYTES) {
    throw new Error('工作流参考图过大，请更换图片')
  }

  return {
    buffer,
    mimeType: contentType
  }
}

async function createWorkflowAsset ({ fileName = '', dataUrl = '', remoteUrl = '' } = {}) {
  const normalizedDataUrl = typeof dataUrl === 'string' ? dataUrl.trim() : ''
  const normalizedRemoteUrl = typeof remoteUrl === 'string' ? remoteUrl.trim() : ''
  let mimeType = 'application/octet-stream'
  let fileBuffer = null

  if (normalizedDataUrl.startsWith('data:')) {
    const match = normalizedDataUrl.match(/^data:([^;,]+)?(?:;charset=[^;,]+)?(;base64)?,(.*)$/)
    if (!match) {
      throw new Error('无法解析工作流参考图数据')
    }

    mimeType = match[1] || 'application/octet-stream'
    const isBase64 = Boolean(match[2])
    const payload = match[3] || ''
    fileBuffer = isBase64
      ? Buffer.from(payload, 'base64')
      : Buffer.from(decodeURIComponent(payload), 'utf8')
  } else if (normalizedRemoteUrl) {
    const downloaded = await downloadWorkflowAssetBuffer(normalizedRemoteUrl)
    mimeType = downloaded.mimeType
    fileBuffer = downloaded.buffer
  } else {
    throw new Error('无效的工作流参考图数据')
  }

  if (!fileBuffer?.length) {
    throw new Error('工作流参考图内容为空')
  }

  const extension = resolveWorkflowAssetExtension(mimeType)
  const normalizedFileName = sanitizeWorkflowAssetFileName(fileName)
  const assetDirectory = path.resolve(process.cwd(), 'DATA', 'input', 'workflow-assets')
  const assetPath = path.resolve(assetDirectory, `${Date.now()}-${normalizedFileName}${extension}`)

  await fsp.mkdir(assetDirectory, { recursive: true })
  await fsp.writeFile(assetPath, fileBuffer)

  return {
    path: assetPath,
    name: path.basename(assetPath),
    size: fileBuffer.byteLength,
    mimeType
  }
}

function resolveUploadDefaultPath (settingsService, menuKey = '') {
  const configuredPath = settingsService?.getSettings?.().uploadDirectories?.[menuKey] || ''
  if (configuredPath && fs.existsSync(configuredPath)) {
    return configuredPath
  }

  return process.cwd()
}

function registerStudioIpc({ studioWorkspaceService, settingsService, dataTraceService, activationGuard, copywritingGenerationService, videoGenerationService, sourcingProductService }) {
  ipcMain.handle(ipcChannels.STUDIO_GET_SNAPSHOT, async () => {
    return studioWorkspaceService.getDisplaySnapshot()
  })

  ipcMain.handle(ipcChannels.STUDIO_REFRESH_DASHBOARD_CREDITS, async (_event, payload = {}) => {
    return studioWorkspaceService.refreshDashboardCredits(payload)
  })

  ipcMain.handle(ipcChannels.STUDIO_SAVE_DRAFT, async (_event, payload = {}) => {
    return studioWorkspaceService.saveDraft(payload)
  })

  ipcMain.handle(ipcChannels.STUDIO_CREATE_TASK, async (_event, payload = {}) => {
    await activationGuard?.assertActivated?.()
    return studioWorkspaceService.createTask(payload)
  })

  ipcMain.handle(ipcChannels.STUDIO_STOP_TASK, async (_event, payload = {}) => {
    return studioWorkspaceService.stopTask(payload)
  })

  ipcMain.handle(ipcChannels.STUDIO_PICK_INPUT_ASSETS, async (_event, payload = {}) => {
    const result = await dialog.showOpenDialog({
      defaultPath: resolveUploadDefaultPath(settingsService, payload.menuKey),
      properties: payload.allowMultiple ? ['openFile', 'multiSelections'] : ['openFile'],
      filters: [
        {
          name: 'Images',
          extensions: ['png', 'jpg', 'jpeg', 'webp']
        }
      ]
    })

    return {
      canceled: result.canceled,
      files: result.canceled ? [] : await describeSupportedImageFiles(result.filePaths || [])
    }
  })

  ipcMain.handle(ipcChannels.STUDIO_OPEN_OUTPUT_DIRECTORY, async (_event, payload = {}) => {
    return openOutputDirectory(payload)
  })

  ipcMain.handle(ipcChannels.STUDIO_OPEN_SAFE_EXTERNAL_URL, async (_event, payload = {}) => {
    return openSafeExternalUrl(payload)
  })

  ipcMain.handle(ipcChannels.STUDIO_GET_SOURCING_PRODUCTS, async (_event, payload = {}) => {
    if (!sourcingProductService || typeof sourcingProductService.listProducts !== 'function') {
      throw new Error('选品服务未就绪')
    }

    return sourcingProductService.listProducts(payload)
  })

  ipcMain.handle(ipcChannels.STUDIO_CREATE_WORKFLOW_ASSET, async (_event, payload = {}) => {
    return createWorkflowAsset(payload)
  })

  ipcMain.handle(ipcChannels.STUDIO_DELETE_EXPORT_ITEM, async (_event, payload = {}) => {
    return studioWorkspaceService.deleteExportItem(payload)
  })

  ipcMain.handle(ipcChannels.STUDIO_CLEAR_RUNTIME_STATE, async () => {
    const clearedState = await studioWorkspaceService.clearRuntimeState()
    await dataTraceService?.clearRuntimeFiles?.()

    return clearedState
  })

  ipcMain.handle(ipcChannels.ECMS_TEXT_GENERATE, async (_event, payload = {}) => {
    await activationGuard?.assertActivated?.()

    if (!copywritingGenerationService || typeof copywritingGenerationService.generateCopywritingResults !== 'function') {
      throw new Error('文本生成服务未就绪')
    }

    const taskId = typeof payload.taskId === 'string' && payload.taskId.trim()
      ? payload.taskId.trim()
      : `ecms-text-${Date.now()}`

    return copywritingGenerationService.generateCopywritingResults({
      taskId,
      draft: payload.draft || {}
    })
  })

  ipcMain.handle(ipcChannels.ECMS_VIDEO_GENERATE, async (_event, payload = {}) => {
    await activationGuard?.assertActivated?.()

    if (!videoGenerationService || typeof videoGenerationService.generateVideoResults !== 'function') {
      throw new Error('视频生成服务未就绪')
    }

    const taskId = typeof payload.taskId === 'string' && payload.taskId.trim()
      ? payload.taskId.trim()
      : `ecms-video-${Date.now()}`

    return videoGenerationService.generateVideoResults({
      taskId,
      draft: payload.draft || {}
    })
  })

  ipcMain.handle(ipcChannels.ECMS_VIDEO_GET_BILLING_SUMMARY, async (_event, payload = {}) => {
    await activationGuard?.assertActivated?.()

    if (!videoGenerationService || typeof videoGenerationService.getBillingSummary !== 'function') {
      throw new Error('视频余额查询服务未就绪')
    }

    return videoGenerationService.getBillingSummary(payload || {})
  })

  ipcMain.handle(ipcChannels.STUDIO_EXPORT_RESULTS, async (_event, payload = {}) => {
    const snapshot = studioWorkspaceService.getSnapshot()
    const exportItems = snapshot.exportItemsByMenu?.[payload.menuKey] || []
    const selectedIdSet = new Set(Array.isArray(payload.selectedExportIds) ? payload.selectedExportIds : [])
    const firstSelectedItem = exportItems.find((item) => selectedIdSet.has(item.id)) || exportItems[0]
    const baseDirectory = firstSelectedItem?.savedPath
      ? path.dirname(firstSelectedItem.savedPath)
      : (firstSelectedItem?.outputDirectory || process.cwd())
    const archiveName = `${payload.menuKey || 'studio-results'}-results.zip`
    const result = await dialog.showSaveDialog({
      defaultPath: path.resolve(baseDirectory, archiveName),
      filters: [
        {
          name: 'Zip Archive',
          extensions: ['zip']
        }
      ]
    })

    if (result.canceled || !result.filePath) {
      return {
        menuKey: payload.menuKey || '',
        canceled: true,
        targetZipPath: ''
      }
    }

    const exportedArchive = await studioWorkspaceService.exportSelectedResults({
      ...payload,
      targetZipPath: result.filePath
    })

    return {
      ...exportedArchive,
      canceled: false
    }
  })
}

module.exports = registerStudioIpc
