import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'

const tempDirectories = []

afterEach(async () => {
  await Promise.all(tempDirectories.splice(0).map((targetPath) => {
    return fs.rm(targetPath, { recursive: true, force: true })
  }))
  delete process.env.QIUAI_DATA_ROOT
  vi.resetModules()
})

describe('inputAssetStorageService', () => {
  it('copies source files referenced by a legacy workspace path after the app directory is renamed', async () => {
    const tempDataRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'qiuai-data-root-'))
    tempDirectories.push(tempDataRoot)
    process.env.QIUAI_DATA_ROOT = tempDataRoot
    vi.resetModules()

    const sourceFilePath = path.resolve(
      tempDataRoot,
      'output',
      'workspace',
      'project-1',
      'group-1',
      '00-source.png'
    )
    const targetDirectory = path.resolve(tempDataRoot, 'input', 'series-generate', 'task-1')

    await fs.mkdir(path.dirname(sourceFilePath), { recursive: true })
    await fs.writeFile(sourceFilePath, 'legacy-image-content')

    const legacySourcePath = path.win32.join(
      'F:\\Workspace_VS\\QiuAi-ECMS\\QiuAi',
      'DATA',
      'output',
      'workspace',
      'project-1',
      'group-1',
      '00-source.png'
    )

    const { persistSourceFiles } = await import('../../main/src/services/inputAssetStorageService.js')
    const persistedPaths = await persistSourceFiles({
      sourcePaths: [legacySourcePath],
      targetDirectory
    })

    expect(persistedPaths).toHaveLength(1)
    expect(path.dirname(persistedPaths[0])).toBe(targetDirectory)
    await expect(fs.readFile(persistedPaths[0], 'utf8')).resolves.toBe('legacy-image-content')
  })
})
