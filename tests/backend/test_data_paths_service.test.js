import { describe, expect, it, vi } from 'vitest'

describe('dataPathsService', () => {
  it('builds DATA input/output directories for the current product workflow', async () => {
    const mkdir = vi.fn().mockResolvedValue(undefined)

    const {
      DATA_ROOT_DIRECTORY,
      getFeatureDirectoryKey,
      getTaskDataDirectories,
      getDataFilePaths,
      ensureDataLayout
    } = await import('../../main/src/services/dataPathsService.js')

    expect(DATA_ROOT_DIRECTORY.replace(/\\/g, '/')).toContain('/DATA')
    expect(getFeatureDirectoryKey('workspace')).toBe('workspace')
    expect(getFeatureDirectoryKey('purchase-center')).toBe('workspace')
    expect(getFeatureDirectoryKey('account-usage')).toBe('workspace')
    expect(getFeatureDirectoryKey('video-generate')).toBe('video-generate')
    expect(getFeatureDirectoryKey('unknown-feature')).toBe('workspace')

    const workspaceDirectories = getTaskDataDirectories({
      featureKey: 'workspace',
      taskId: 'task-1'
    })
    expect(workspaceDirectories.inputDirectory.replace(/\\/g, '/')).toContain('/DATA/input/workspace/task-1')
    expect(workspaceDirectories.outputDirectory.replace(/\\/g, '/')).toContain('/DATA/output/workspace/task-1')

    const seriesDirectories = getTaskDataDirectories({
      featureKey: 'series-generate',
      taskId: 'task-2'
    })
    expect(seriesDirectories.inputDirectory.replace(/\\/g, '/')).toContain('/DATA/input/series-generate/task-2')
    expect(seriesDirectories.outputDirectory.replace(/\\/g, '/')).toContain('/DATA/output/series-generate/task-2')

    expect(getDataFilePaths().messageFilePath.replace(/\\/g, '/')).toContain('/DATA/message.txt')
    expect(getDataFilePaths().logFilePath.replace(/\\/g, '/')).toContain('/DATA/log.txt')

    await ensureDataLayout({ mkdir })
    expect(mkdir).toHaveBeenCalled()
  })

  it('prefers an explicit writable data root override when provided', async () => {
    vi.resetModules()
    const previousValue = process.env.QIUAI_DATA_ROOT
    process.env.QIUAI_DATA_ROOT = 'C:/Users/TestUser/AppData/Roaming/QiuAi/DATA'

    try {
      const {
        DATA_ROOT_DIRECTORY,
        getDataFilePaths,
        getTaskDataDirectories
      } = await import('../../main/src/services/dataPathsService.js')

      expect(DATA_ROOT_DIRECTORY.replace(/\\/g, '/')).toBe('C:/Users/TestUser/AppData/Roaming/QiuAi/DATA')
      expect(getDataFilePaths().outputRootDirectory.replace(/\\/g, '/')).toBe('C:/Users/TestUser/AppData/Roaming/QiuAi/DATA/output')
      expect(getTaskDataDirectories({
        featureKey: 'workspace',
        taskId: 'task-2'
      }).inputDirectory.replace(/\\/g, '/')).toBe('C:/Users/TestUser/AppData/Roaming/QiuAi/DATA/input/workspace/task-2')
    } finally {
      if (previousValue === undefined) {
        delete process.env.QIUAI_DATA_ROOT
      } else {
        process.env.QIUAI_DATA_ROOT = previousValue
      }
      vi.resetModules()
    }
  })
})
