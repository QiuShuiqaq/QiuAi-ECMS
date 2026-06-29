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
        baseUrl: 'https://api.qiuaihub.com',
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

  it('migrates the legacy commerce host to the dedicated api subdomain', async () => {
    const store = createMemoryStore()

    const { createSettingsStoreService } = await import('../../main/src/services/settingsStoreService.js')
    const service = createSettingsStoreService({ store })

    store.set('userSettings', {
      authPlatform: {
        enabled: true,
        baseUrl: 'https://qiuaihub.com/',
        sessionToken: 'session-1'
      }
    })

    expect(service.getSettings().authPlatform).toMatchObject({
      enabled: true,
      baseUrl: 'https://api.qiuaihub.com',
      sessionToken: 'session-1'
    })
  })

  it('injects dev bypass auth defaults when the local bypass flag is enabled', async () => {
    const previousEnv = {
      DEV_BYPASS_LICENSE: process.env.DEV_BYPASS_LICENSE,
      DEV_PLATFORM_SESSION_TOKEN: process.env.DEV_PLATFORM_SESSION_TOKEN,
      DEV_TEST_USER_ID: process.env.DEV_TEST_USER_ID,
      DEV_TEST_LICENSE_ID: process.env.DEV_TEST_LICENSE_ID
    }

    process.env.DEV_BYPASS_LICENSE = 'true'
    process.env.DEV_PLATFORM_SESSION_TOKEN = 'dev-session-1'
    process.env.DEV_TEST_USER_ID = 'dev-user-1'
    process.env.DEV_TEST_LICENSE_ID = 'dev-license-1'

    try {
      const store = createMemoryStore()

      const { createSettingsStoreService } = await import('../../main/src/services/settingsStoreService.js')
      const service = createSettingsStoreService({ store })

      expect(service.getSettings().authPlatform).toMatchObject({
        enabled: true,
        sessionToken: 'dev-session-1',
        lastUserId: 'dev-user-1',
        lastLicenseId: 'dev-license-1'
      })
    } finally {
      for (const [key, value] of Object.entries(previousEnv)) {
        if (typeof value === 'undefined') {
          delete process.env[key]
        } else {
          process.env[key] = value
        }
      }
    }
  })

  it('does not inject dev bypass auth defaults when the dev session token is missing', async () => {
    const previousEnv = {
      DEV_BYPASS_LICENSE: process.env.DEV_BYPASS_LICENSE,
      DEV_PLATFORM_SESSION_TOKEN: process.env.DEV_PLATFORM_SESSION_TOKEN,
      DEV_TEST_USER_ID: process.env.DEV_TEST_USER_ID,
      DEV_TEST_LICENSE_ID: process.env.DEV_TEST_LICENSE_ID
    }

    process.env.DEV_BYPASS_LICENSE = 'true'
    delete process.env.DEV_PLATFORM_SESSION_TOKEN
    process.env.DEV_TEST_USER_ID = 'dev-user-1'
    process.env.DEV_TEST_LICENSE_ID = 'dev-license-1'

    try {
      const store = createMemoryStore()

      const { createSettingsStoreService } = await import('../../main/src/services/settingsStoreService.js')
      const service = createSettingsStoreService({ store })

      expect(service.getSettings().authPlatform).toMatchObject({
        enabled: true,
        sessionToken: '',
        lastUserId: '',
        lastLicenseId: ''
      })
    } finally {
      for (const [key, value] of Object.entries(previousEnv)) {
        if (typeof value === 'undefined') {
          delete process.env[key]
        } else {
          process.env[key] = value
        }
      }
    }
  })

  it('persists remote activation identity fields for later auto-reactivation', async () => {
    const store = createMemoryStore()

    const { createSettingsStoreService } = await import('../../main/src/services/settingsStoreService.js')
    const service = createSettingsStoreService({ store })

    await service.saveSettings({
      authPlatform: {
        customerName: 'Remote Alice',
        contact: '13800138000',
        inviteCode: 'QAI123456',
        sessionToken: 'session-1'
      }
    })

    expect(service.getSettings().authPlatform).toMatchObject({
      customerName: 'Remote Alice',
      contact: '13800138000',
      inviteCode: 'QAI123456',
      sessionToken: 'session-1'
    })
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
