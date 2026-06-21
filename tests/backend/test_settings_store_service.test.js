import { describe, expect, it } from 'vitest'

function createMemoryStore() {
  const memory = new Map()

  return {
    get(key, fallbackValue) {
      return memory.has(key) ? memory.get(key) : fallbackValue
    },
    set(key, value) {
      memory.set(key, value)
    }
  }
}

describe('settingsStoreService', () => {
  it('loads the current upload directory structure and auth platform settings', async () => {
    const store = createMemoryStore()

    const { createSettingsStoreService } = await import('../../main/src/services/settingsStoreService.js')
    const service = createSettingsStoreService({ store })

    store.set('userSettings', {
      defaultSize: '1:1',
      downloadDirectory: 'C:/QiuAi',
      uploadDirectories: {
        workspace: 'C:/QiuAi/Input/Workspace',
        'series-generate': 'C:/QiuAi/Input/SeriesGenerate'
      },
      themeMode: 'eye-care'
    })

    expect(service.getSettings()).toMatchObject({
      defaultSize: '1:1',
      downloadDirectory: 'C:/QiuAi',
      uploadDirectories: {
        workspace: 'C:/QiuAi/Input/Workspace',
        'series-generate': 'C:/QiuAi/Input/SeriesGenerate'
      },
      themeMode: 'dark',
      authPlatform: {
        enabled: true,
        baseUrl: 'https://qiuaihub.com',
        sessionToken: ''
      }
    })
  })

  it('drops legacy local provider configuration fields from the normalized settings shape', async () => {
    const store = createMemoryStore()

    const { createSettingsStoreService } = await import('../../main/src/services/settingsStoreService.js')
    const service = createSettingsStoreService({ store })

    store.set('userSettings', {
      apiBaseUrl: 'https://legacy.local',
      apiKeys: ['sk-demo-1', 'sk-demo-2'],
      activeApiKeyIndex: 1,
      apiKey: 'sk-demo-2',
      providerApiKeys: {
        general: 'sk-general',
        deepseek: 'sk-deepseek',
        minimax: 'sk-minimax'
      }
    })

    const settings = service.getSettings()

    expect(settings.apiBaseUrl).toBeUndefined()
    expect(settings.apiKeys).toBeUndefined()
    expect(settings.activeApiKeyIndex).toBeUndefined()
    expect(settings.apiKey).toBeUndefined()
    expect(settings.providerApiKeys).toBeUndefined()
  })

  it('rejects invalid workspace upload directories and accepts clearing them', async () => {
    const store = createMemoryStore()

    const { createSettingsStoreService } = await import('../../main/src/services/settingsStoreService.js')
    const service = createSettingsStoreService({ store })

    await expect(service.saveSettings({
      uploadDirectories: {
        workspace: 'Z:/missing-folder'
      }
    }, {
      isDirectory: () => false
    })).rejects.toThrow()

    await service.saveSettings({
      uploadDirectories: {
        workspace: ''
      }
    }, {
      isDirectory: () => false
    })

    expect(service.getSettings().uploadDirectories.workspace).toBe('')
  })

  it('keeps upload directories isolated per menu across instances', async () => {
    const store = createMemoryStore()

    const { createSettingsStoreService } = await import('../../main/src/services/settingsStoreService.js')
    const firstService = createSettingsStoreService({ store })

    await firstService.saveSettings({
      uploadDirectories: {
        workspace: 'D:/QiuAi/Input/Workspace'
      }
    }, {
      isDirectory: (targetPath) => targetPath === 'D:/QiuAi/Input/Workspace'
    })

    const secondService = createSettingsStoreService({ store })

    expect(secondService.getSettings()).toMatchObject({
      uploadDirectories: {
        workspace: 'D:/QiuAi/Input/Workspace',
        'series-generate': ''
      }
    })
  })

  it('allows credit saves without rewriting stale upload directory data', async () => {
    const store = createMemoryStore()

    const { createSettingsStoreService } = await import('../../main/src/services/settingsStoreService.js')
    const service = createSettingsStoreService({ store })

    store.set('userSettings', {
      globalUploadDirectory: 'Z:/stale-global-folder',
      uploadDirectories: {
        workspace: 'Z:/missing-folder',
        'series-generate': ''
      },
      creditState: {
        totalPurchasedCredits: 500,
        remainingCredits: 300
      }
    })

    await expect(service.saveSettings({
      creditAdjustment: {
        operation: 'increase',
        amount: 100
      }
    }, {
      isDirectory: () => false,
      getNow: () => '2026-05-01T10:00:00.000Z'
    })).resolves.toBeTruthy()

    expect(service.getSettings()).toMatchObject({
      globalUploadDirectory: 'Z:/stale-global-folder',
      uploadDirectories: {
        workspace: 'Z:/missing-folder',
        'series-generate': ''
      },
      creditState: {
        totalPurchasedCredits: 600,
        remainingCredits: 400
      }
    })
  })

  it('updates only the provided upload directory keys', async () => {
    const store = createMemoryStore()

    const { createSettingsStoreService } = await import('../../main/src/services/settingsStoreService.js')
    const service = createSettingsStoreService({ store })

    await service.saveSettings({
      uploadDirectories: {
        workspace: 'D:/Input/Workspace',
        'series-generate': 'D:/Input/SeriesGenerate'
      }
    }, {
      isDirectory: (targetPath) => targetPath.startsWith('D:/Input/')
    })

    await service.saveSettings({
      uploadDirectories: {
        workspace: 'E:/Input/Workspace'
      }
    }, {
      isDirectory: (targetPath) => targetPath.startsWith('E:/Input/') || targetPath === 'D:/Input/SeriesGenerate'
    })

    expect(service.getSettings().uploadDirectories).toMatchObject({
      workspace: 'E:/Input/Workspace',
      'series-generate': 'D:/Input/SeriesGenerate'
    })
  })

  it('migrates legacy dashboard credits into the image ledger', async () => {
    const store = createMemoryStore()

    const { createSettingsStoreService } = await import('../../main/src/services/settingsStoreService.js')
    const service = createSettingsStoreService({ store })

    store.set('userSettings', {
      dashboardCreditState: {
        totalCredits: 9000,
        remainingCredits: 4200
      }
    })

    expect(service.getSettings().dashboardCreditState).toMatchObject({
      text: {
        balanceCny: 0,
        syncStatus: 'idle'
      },
      image: {
        totalCredits: 9000,
        remainingCredits: 4200,
        syncStatus: 'success'
      },
      video: {
        balanceCny: 0,
        syncStatus: 'idle'
      }
    })
  })

})
