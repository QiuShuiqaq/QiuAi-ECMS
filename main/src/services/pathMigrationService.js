const fs = require('node:fs')
const path = require('node:path')

function trimString(value = '') {
  return typeof value === 'string' ? value.trim() : ''
}

function resolveCurrentDataRootDirectory({
  env = process.env,
  appRootDirectory = path.resolve(__dirname, '../../..')
} = {}) {
  const configuredDataRoot = trimString(env.QIUAI_DATA_ROOT)

  if (configuredDataRoot) {
    return path.resolve(configuredDataRoot)
  }

  return path.resolve(appRootDirectory, 'DATA')
}

function extractRelativeDataPath(targetPath = '') {
  const normalizedPath = trimString(targetPath).replace(/\\/g, '/')
  const marker = '/DATA/'
  const markerIndex = normalizedPath.toUpperCase().indexOf(marker)

  if (markerIndex >= 0) {
    return normalizedPath.slice(markerIndex + marker.length).replace(/\//g, path.sep)
  }

  if (normalizedPath.toUpperCase().endsWith('/DATA')) {
    return ''
  }

  return null
}

function buildCompatibleLocalPathCandidates(targetPath = '', options = {}) {
  const normalizedTargetPath = trimString(targetPath)
  if (!normalizedTargetPath) {
    return []
  }

  const currentDataRootDirectory = resolveCurrentDataRootDirectory(options)
  const resolvedOriginalPath = path.resolve(normalizedTargetPath)
  const relativeDataPath = extractRelativeDataPath(resolvedOriginalPath)
  const candidatePaths = [resolvedOriginalPath]

  if (relativeDataPath !== null) {
    candidatePaths.push(path.resolve(currentDataRootDirectory, relativeDataPath))
  }

  const seenPaths = new Set()
  return candidatePaths.filter((candidatePath) => {
    const identity = process.platform === 'win32'
      ? candidatePath.toLowerCase()
      : candidatePath

    if (seenPaths.has(identity)) {
      return false
    }

    seenPaths.add(identity)
    return true
  })
}

function resolveCompatibleLocalPath(targetPath = '', {
  existsSync = fs.existsSync,
  ...options
} = {}) {
  const normalizedTargetPath = trimString(targetPath)
  const candidatePaths = buildCompatibleLocalPathCandidates(targetPath, options)

  for (const candidatePath of candidatePaths) {
    try {
      if (existsSync(candidatePath)) {
        return candidatePath
      }
    } catch {
      // Ignore stat failures and continue trying compatible candidates.
    }
  }

  return normalizedTargetPath
}

module.exports = {
  buildCompatibleLocalPathCandidates,
  resolveCompatibleLocalPath,
  resolveCurrentDataRootDirectory
}
