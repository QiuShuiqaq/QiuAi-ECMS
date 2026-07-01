const fs = require('node:fs')
const path = require('node:path')
const { DATA_ROOT_DIRECTORY, INPUT_ROOT_DIRECTORY, OUTPUT_ROOT_DIRECTORY } = require('./dataPathsService')

const LOCAL_MEDIA_SCHEME = 'qiuai-media'
const LOCAL_MEDIA_HOST = 'local'
const supportedImageExtensions = new Set(['.png', '.jpg', '.jpeg', '.webp', '.gif', '.bmp'])

function normalizePathForCompare(filePath = '') {
  const resolvedPath = path.resolve(filePath)
  return process.platform === 'win32' ? resolvedPath.toLowerCase() : resolvedPath
}

function isPathInsideRoot(filePath = '', rootPath = '') {
  const normalizedFilePath = normalizePathForCompare(filePath)
  const normalizedRootPath = normalizePathForCompare(rootPath)
  const relativePath = path.relative(normalizedRootPath, normalizedFilePath)

  return relativePath === '' || Boolean(relativePath && !relativePath.startsWith('..') && !path.isAbsolute(relativePath))
}

function isAllowedLocalMediaPath(filePath = '') {
  if (!filePath) return false

  const extension = path.extname(filePath).toLowerCase()
  if (!supportedImageExtensions.has(extension)) {
    return false
  }

  return [DATA_ROOT_DIRECTORY, INPUT_ROOT_DIRECTORY, OUTPUT_ROOT_DIRECTORY].some((rootPath) => {
    return isPathInsideRoot(filePath, rootPath)
  })
}

function encodePathToken(filePath = '') {
  return Buffer.from(path.resolve(filePath), 'utf8').toString('base64url')
}

function decodePathToken(token = '') {
  try {
    return Buffer.from(token, 'base64url').toString('utf8')
  } catch {
    return ''
  }
}

function createLocalMediaPreviewUrl(filePath = '') {
  const normalizedPath = String(filePath || '').trim()
  if (!normalizedPath) return ''

  return `${LOCAL_MEDIA_SCHEME}://${LOCAL_MEDIA_HOST}/${encodePathToken(normalizedPath)}`
}

function decodeLocalMediaPreviewUrl(url = '') {
  try {
    const urlObject = new URL(url)
    if (urlObject.protocol !== `${LOCAL_MEDIA_SCHEME}:` || urlObject.hostname !== LOCAL_MEDIA_HOST) {
      return ''
    }

    return decodePathToken(urlObject.pathname.replace(/^\/+/, ''))
  } catch {
    return ''
  }
}

function getMimeTypeFromLocalMediaPath(filePath = '') {
  const extension = path.extname(filePath).toLowerCase()
  if (extension === '.jpg' || extension === '.jpeg') return 'image/jpeg'
  if (extension === '.webp') return 'image/webp'
  if (extension === '.gif') return 'image/gif'
  if (extension === '.bmp') return 'image/bmp'
  return 'image/png'
}

function resolveLocalMediaFile(url = '') {
  const filePath = decodeLocalMediaPreviewUrl(url)
  if (!filePath || !isAllowedLocalMediaPath(filePath) || !fs.existsSync(filePath)) {
    return null
  }

  return {
    filePath,
    mimeType: getMimeTypeFromLocalMediaPath(filePath)
  }
}

module.exports = {
  LOCAL_MEDIA_SCHEME,
  createLocalMediaPreviewUrl,
  decodeLocalMediaPreviewUrl,
  getMimeTypeFromLocalMediaPath,
  isAllowedLocalMediaPath,
  resolveLocalMediaFile
}
