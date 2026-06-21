const fs = require('node:fs/promises')
const fsSync = require('node:fs')
const path = require('node:path')
const os = require('node:os')
const { exportTaskDirectory: defaultExportTaskDirectory } = require('./taskExportService')

const EXPORT_FREE_SPACE_MULTIPLIER = 3
const EXPORT_MIN_REQUIRED_BYTES = 1024

function sanitizePathSegment(value, fallbackValue = 'result') {
  const sanitizedValue = String(value || fallbackValue)
    .replace(/[<>:"/\\|?*\s]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')

  return sanitizedValue || fallbackValue
}

async function getAvailableDiskSpaceBytes(targetPath = process.cwd(), {
  statfs = fs.statfs
} = {}) {
  let resolvedPath = path.resolve(targetPath || process.cwd())

  if (!fsSync.existsSync(resolvedPath)) {
    resolvedPath = path.dirname(resolvedPath)
  }

  while (!fsSync.existsSync(resolvedPath)) {
    const parentPath = path.dirname(resolvedPath)
    if (parentPath === resolvedPath) {
      resolvedPath = process.cwd()
      break
    }
    resolvedPath = parentPath
  }

  const stats = await statfs(resolvedPath)
  const blockSize = Number(stats?.bsize || stats?.frsize || 0)
  const freeBlocks = Number(stats?.bavail || stats?.bfree || 0)

  if (!Number.isFinite(blockSize) || !Number.isFinite(freeBlocks) || blockSize <= 0 || freeBlocks < 0) {
    throw new Error('Unable to read available disk space')
  }

  return blockSize * freeBlocks
}

function estimateExportRequiredBytes(selectedItems = []) {
  const itemCount = Math.max(1, Array.isArray(selectedItems) ? selectedItems.length : 0)
  return Math.max(EXPORT_MIN_REQUIRED_BYTES, itemCount * EXPORT_MIN_REQUIRED_BYTES * EXPORT_FREE_SPACE_MULTIPLIER)
}

async function safeRuntimeLog(runtimeLogger, payload) {
  if (!runtimeLogger || typeof runtimeLogger.log !== 'function') {
    return
  }

  try {
    await runtimeLogger.log(payload)
  } catch {
    // Ignore export log failures.
  }
}

function createWorkspaceExportService({
  getStoredState,
  getResolvedExportItemsByMenu,
  menuLabelMap = {},
  ensureDirectory = async () => undefined,
  writeFile = fs.writeFile,
  mkdtemp = fs.mkdtemp,
  copyFile = fs.copyFile,
  copyDirectory = (sourceDirectory, targetDirectory) => fs.cp(sourceDirectory, targetDirectory, { recursive: true }),
  removeDirectory = (targetPath) => fs.rm(targetPath, { recursive: true, force: true }),
  getAvailableDiskSpaceBytes: getAvailableDiskSpaceBytesDependency = (targetPath) => getAvailableDiskSpaceBytes(targetPath),
  exportTaskDirectory = defaultExportTaskDirectory,
  runtimeLogger
} = {}) {
  if (typeof getStoredState !== 'function') {
    throw new Error('getStoredState is required')
  }

  if (typeof getResolvedExportItemsByMenu !== 'function') {
    throw new Error('getResolvedExportItemsByMenu is required')
  }

  async function exportProjectBundle({
    projectId = '',
    targetZipPath = ''
  } = {}) {
    const normalizedProjectId = String(projectId || '').trim()
    if (!normalizedProjectId) {
      throw new Error('Project ID is required')
    }

    if (!targetZipPath) {
      throw new Error('Target zip path is required')
    }

    const state = getStoredState()
    const project = (state.productProjects || []).find((item) => item.id === normalizedProjectId)

    if (!project) {
      throw new Error('Project not found for export')
    }

    const stagingDirectory = await mkdtemp(path.join(os.tmpdir(), 'qiuai-project-export-'))
    const projectDirectory = path.resolve(stagingDirectory, sanitizePathSegment(project.name || 'product-project', 'product-project'))

    try {
      await ensureDirectory(projectDirectory)

      const titleText = project.content?.selectedTitle || (project.content?.titleCandidates || []).join('\n')
      const descriptionText = project.content?.selectedDescription || (project.content?.descriptionCandidates || []).join('\n')

      await writeFile(path.resolve(projectDirectory, 'title.txt'), `${String(titleText || '')}\n`, 'utf8')
      await writeFile(path.resolve(projectDirectory, 'description.txt'), `${String(descriptionText || '')}\n`, 'utf8')

      if (Array.isArray(project.assets?.generatedImages) && project.assets.generatedImages.length) {
        const imagesDirectory = path.resolve(projectDirectory, 'images')
        await ensureDirectory(imagesDirectory)

        for (const [index, image] of project.assets.generatedImages.entries()) {
          const sourcePath = image.savedPath || image.path || image.storedPath || ''
          if (!sourcePath) {
            continue
          }

          await copyFile(
            sourcePath,
            path.resolve(imagesDirectory, `${String(index + 1).padStart(2, '0')}-${path.basename(sourcePath)}`)
          )
        }
      }

      if (project.assets?.generatedVideo?.savedPath) {
        const videoPath = project.assets.generatedVideo.savedPath
        await copyFile(videoPath, path.resolve(projectDirectory, path.basename(videoPath)))
      }

      const exportedArchive = await exportTaskDirectory({
        sourceDirectory: projectDirectory,
        targetZipPath
      })

      return {
        canceled: false,
        projectId: normalizedProjectId,
        targetZipPath: exportedArchive.targetZipPath
      }
    } finally {
      await removeDirectory(stagingDirectory).catch(() => {})
    }
  }

  async function exportSelectedResults({
    menuKey = 'workspace',
    selectedExportIds = [],
    targetZipPath = ''
  } = {}) {
    if (!targetZipPath) {
      throw new Error('Target zip path is required')
    }

    const normalizedSelectedIds = Array.isArray(selectedExportIds)
      ? selectedExportIds.filter(Boolean)
      : []

    if (!normalizedSelectedIds.length) {
      throw new Error('At least one export item must be selected')
    }

    const state = getStoredState()
    const exportItems = getResolvedExportItemsByMenu(state)[menuKey] || []
    const selectedIdSet = new Set(normalizedSelectedIds)
    const selectedItems = exportItems.filter((item) => selectedIdSet.has(item.id))

    if (!selectedItems.length) {
      throw new Error('Selected export items were not found')
    }

    const estimatedRequiredBytes = estimateExportRequiredBytes(selectedItems)
    const targetDiskFreeBytes = await getAvailableDiskSpaceBytesDependency(path.dirname(targetZipPath))
    const tempDiskFreeBytes = await getAvailableDiskSpaceBytesDependency(os.tmpdir())
    const minimumFreeBytes = estimatedRequiredBytes * EXPORT_FREE_SPACE_MULTIPLIER

    if (targetDiskFreeBytes < minimumFreeBytes || tempDiskFreeBytes < minimumFreeBytes) {
      throw new Error('Insufficient disk space for export')
    }

    const stagingDirectory = await mkdtemp(path.join(os.tmpdir(), 'qiuai-studio-export-'))

    try {
      for (const [index, item] of selectedItems.entries()) {
        const sourceDirectory = item.directoryPath || item.outputDirectory || ''
        if (sourceDirectory) {
          const targetDirectory = path.resolve(
            stagingDirectory,
            `${String(index).padStart(2, '0')}-${sanitizePathSegment(item.name || item.groupTitle || 'result-group', 'result-group')}`
          )
          await copyDirectory(sourceDirectory, targetDirectory)
          continue
        }

        const sourcePath = item.savedPath || ''
        if (!sourcePath) {
          throw new Error(`Missing exported file: ${item.name || item.id}`)
        }

        const groupDirectory = path.resolve(
          stagingDirectory,
          sanitizePathSegment(item.groupTitle || menuLabelMap[menuKey] || 'result-group', 'result-group')
        )
        const targetFilePath = path.resolve(groupDirectory, `${String(index + 1).padStart(2, '0')}-${path.basename(sourcePath)}`)
        await ensureDirectory(groupDirectory)
        await copyFile(sourcePath, targetFilePath)
      }

      const exportedArchive = await exportTaskDirectory({
        sourceDirectory: stagingDirectory,
        targetZipPath
      })

      await safeRuntimeLog(runtimeLogger, {
        level: 'info',
        scope: 'studio-workspace-export',
        message: 'Exported selected studio results',
        details: {
          menuKey,
          exportedCount: selectedItems.length,
          targetZipPath: exportedArchive.targetZipPath
        }
      })

      return {
        menuKey,
        exportedCount: selectedItems.length,
        targetZipPath: exportedArchive.targetZipPath
      }
    } finally {
      await removeDirectory(stagingDirectory).catch(() => {})
    }
  }

  return {
    exportSelectedResults,
    exportProjectBundle
  }
}

module.exports = {
  createWorkspaceExportService
}
