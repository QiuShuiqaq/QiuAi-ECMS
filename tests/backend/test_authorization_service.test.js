import { describe, expect, it, vi } from 'vitest'
import { createAuthorizationService } from '../../main/src/services/authorizationService'

describe('authorization service', () => {
  it('prefers remote server authorization when a session token is available', async () => {
    const remoteClient = {
      getAuthorizationStatus: vi.fn().mockResolvedValue({
        status: 'activated',
        mode: 'server-license',
        authType: 'session-token',
        canUseApp: true,
        customerName: 'Remote Alice',
        userId: 'user-1',
        licenseId: 'license-1',
        inviteCode: 'QAI123456',
        deviceCode: 'QAI-REMOTE-DEVICE',
        activatedAt: '2026-06-15T10:00:00.000Z',
        expiresAt: '2026-07-15T10:00:00.000Z',
        sessionToken: 'session-1',
        nextAction: 'enter-app',
        walletSummary: {
          imageBalanceCny: 88,
          videoBalanceCny: 66
        }
      })
    }

    const saveSettings = vi.fn().mockResolvedValue(undefined)
    const service = createAuthorizationService({
      remoteLicensePlatformClient: remoteClient,
      settingsService: {
        saveSettings
      },
      getRemoteConfig: () => ({
        enabled: true,
        baseUrl: 'https://api.qiuaihub.com',
        sessionToken: 'session-1'
      }),
      getDeviceCode: vi.fn().mockResolvedValue('QAI-REMOTE-DEVICE')
    })

    const result = await service.getActivationStatus()

    expect(remoteClient.getAuthorizationStatus).toHaveBeenCalled()
    expect(result.mode).toBe('server-license')
    expect(result.customerName).toBe('Remote Alice')
    expect(result.walletSummary).toMatchObject({
      imageBalanceCny: 88,
      videoBalanceCny: 66
    })
    expect(saveSettings).toHaveBeenCalledWith(expect.objectContaining({
      authPlatform: expect.objectContaining({
        enabled: true,
        baseUrl: 'https://api.qiuaihub.com',
        sessionToken: 'session-1',
        lastUserId: 'user-1',
        lastLicenseId: 'license-1',
        remoteServiceCapacity: null
      })
    }))
  })

  it('returns not_logged_in with device code when no remote session is available', async () => {
    const service = createAuthorizationService({
      remoteLicensePlatformClient: {
        getAuthorizationStatus: vi.fn()
      },
      getRemoteConfig: () => ({
        enabled: true,
        sessionToken: ''
      }),
      getDeviceCode: vi.fn().mockResolvedValue('QAI-DEVICE')
    })

    const result = await service.getActivationStatus()

    expect(result.status).toBe('not_logged_in')
    expect(result.canUseApp).toBe(false)
    expect(result.mode).toBe('server-license')
    expect(result.authType).toBe('session-token')
    expect(result.deviceCode).toBe('QAI-DEVICE')
    expect(result.nextAction).toBe('activate-license')
  })

  it('maps remote request failures into a retryable activation state', async () => {
    const remoteClient = {
      getAuthorizationStatus: vi.fn().mockRejectedValue(new Error('network down'))
    }

    const service = createAuthorizationService({
      remoteLicensePlatformClient: remoteClient,
      getRemoteConfig: () => ({
        enabled: true,
        sessionToken: 'session-1',
        remoteServiceCapacity: {
          effectiveImageConcurrency: 4
        }
      }),
      getDeviceCode: vi.fn().mockResolvedValue('QAI-DEVICE')
    })

    const result = await service.getActivationStatus()

    expect(result.status).toBe('not_logged_in')
    expect(result.remoteStatus).toBe('request_failed')
    expect(result.deviceCode).toBe('QAI-DEVICE')
    expect(result.message).toContain('network down')
    expect(result.remoteServiceCapacity).toMatchObject({
      effectiveImageConcurrency: 4
    })
  })

  it('reactivates automatically from persisted identity when the stored session has expired', async () => {
    const remoteClient = {
      getAuthorizationStatus: vi.fn().mockRejectedValue({
        message: 'Session is invalid or expired.',
        details: {
          statusCode: 401
        }
      }),
      activateLicense: vi.fn().mockResolvedValue({
        status: 'activated',
        mode: 'server-license',
        authType: 'session-token',
        canUseApp: true,
        customerName: 'Remote Alice',
        userId: 'user-1',
        licenseId: 'license-1',
        inviteCode: 'QAI123456',
        deviceCode: 'QAI-REMOTE-DEVICE',
        activatedAt: '2026-06-15T10:00:00.000Z',
        expiresAt: '2026-07-15T10:00:00.000Z',
        sessionToken: 'session-2',
        nextAction: 'enter-app'
      }),
      getServiceCapacityProfile: vi.fn().mockResolvedValue({
        effectiveImageConcurrency: 2
      })
    }

    const saveSettings = vi.fn().mockResolvedValue(undefined)
    const service = createAuthorizationService({
      remoteLicensePlatformClient: remoteClient,
      settingsService: {
        saveSettings
      },
      getRemoteConfig: () => ({
        enabled: true,
        baseUrl: 'https://api.qiuaihub.com',
        sessionToken: 'session-1',
        customerName: 'Remote Alice',
        contact: '13800138000',
        inviteCode: 'QAI123456'
      }),
      getDeviceCode: vi.fn().mockResolvedValue('QAI-REMOTE-DEVICE')
    })

    const result = await service.getActivationStatus()

    expect(remoteClient.activateLicense).toHaveBeenCalledWith({
      customerName: 'Remote Alice',
      contact: '13800138000',
      inviteCode: 'QAI123456',
      deviceName: 'QiuAi Desktop',
      deviceFingerprint: 'QAI-REMOTE-DEVICE'
    })
    expect(result).toMatchObject({
      status: 'activated',
      sessionToken: 'session-2',
      customerName: 'Remote Alice'
    })
    expect(saveSettings).toHaveBeenCalledWith(expect.objectContaining({
      authPlatform: expect.objectContaining({
        sessionToken: 'session-2',
        lastUserId: 'user-1',
        lastLicenseId: 'license-1'
      })
    }))
  })

  it('reactivates automatically when the status endpoint returns not_logged_in for the same device', async () => {
    const remoteClient = {
      getAuthorizationStatus: vi.fn().mockResolvedValue({
        status: 'not_logged_in',
        mode: 'server-license',
        authType: 'session-token',
        canUseApp: false,
        customerName: '',
        userId: '',
        licenseId: '',
        inviteCode: '',
        deviceCode: 'QAI-REMOTE-DEVICE',
        activatedAt: '',
        expiresAt: '',
        sessionToken: '',
        nextAction: 'activate-license'
      }),
      activateLicense: vi.fn().mockResolvedValue({
        status: 'activated',
        mode: 'server-license',
        authType: 'session-token',
        canUseApp: true,
        customerName: 'Remote Alice',
        userId: 'user-1',
        licenseId: 'license-1',
        inviteCode: 'QAI123456',
        deviceCode: 'QAI-REMOTE-DEVICE',
        activatedAt: '2026-06-15T10:00:00.000Z',
        expiresAt: '2026-07-15T10:00:00.000Z',
        sessionToken: 'session-2',
        nextAction: 'enter-app'
      }),
      getServiceCapacityProfile: vi.fn().mockResolvedValue({
        effectiveImageConcurrency: 2
      })
    }

    const saveSettings = vi.fn().mockResolvedValue(undefined)
    const service = createAuthorizationService({
      remoteLicensePlatformClient: remoteClient,
      settingsService: {
        saveSettings
      },
      getRemoteConfig: () => ({
        enabled: true,
        baseUrl: 'https://api.qiuaihub.com',
        sessionToken: 'session-stale',
        customerName: 'Remote Alice',
        contact: '13800138000',
        inviteCode: 'QAI123456'
      }),
      getDeviceCode: vi.fn().mockResolvedValue('QAI-REMOTE-DEVICE')
    })

    const result = await service.getActivationStatus()

    expect(remoteClient.activateLicense).toHaveBeenCalledWith({
      customerName: 'Remote Alice',
      contact: '13800138000',
      inviteCode: 'QAI123456',
      deviceName: 'QiuAi Desktop',
      deviceFingerprint: 'QAI-REMOTE-DEVICE'
    })
    expect(result).toMatchObject({
      status: 'activated',
      sessionToken: 'session-2',
      customerName: 'Remote Alice'
    })
  })

  it('returns a local activated state when dev bypass is enabled', async () => {
    const previousEnv = {
      DEV_BYPASS_LICENSE: process.env.DEV_BYPASS_LICENSE,
      DEV_PLATFORM_SESSION_TOKEN: process.env.DEV_PLATFORM_SESSION_TOKEN,
      DEV_TEST_USER_ID: process.env.DEV_TEST_USER_ID,
      DEV_TEST_LICENSE_ID: process.env.DEV_TEST_LICENSE_ID,
      DEV_TEST_USER_NAME: process.env.DEV_TEST_USER_NAME
    }

    process.env.DEV_BYPASS_LICENSE = 'true'
    process.env.DEV_PLATFORM_SESSION_TOKEN = 'dev-session-1'
    process.env.DEV_TEST_USER_ID = 'dev-user-1'
    process.env.DEV_TEST_LICENSE_ID = 'dev-license-1'
    process.env.DEV_TEST_USER_NAME = 'Local Dev User'

    try {
      const remoteClient = {
        getAuthorizationStatus: vi.fn()
      }

      const service = createAuthorizationService({
        remoteLicensePlatformClient: remoteClient,
        getRemoteConfig: () => ({
          enabled: false,
          sessionToken: ''
        }),
        getDeviceCode: vi.fn().mockResolvedValue('QAI-DEV-DEVICE')
      })

      const result = await service.getActivationStatus()

      expect(remoteClient.getAuthorizationStatus).not.toHaveBeenCalled()
      expect(result).toMatchObject({
        status: 'activated',
        mode: 'dev-bypass',
        authType: 'dev-session-token',
        canUseApp: true,
        customerName: 'Local Dev User',
        userId: 'dev-user-1',
        licenseId: 'dev-license-1',
        sessionToken: 'dev-session-1',
        deviceCode: 'QAI-DEV-DEVICE',
        devBypassLicense: true
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

  it('does not enable dev bypass without a dev session token', async () => {
    const previousEnv = {
      DEV_BYPASS_LICENSE: process.env.DEV_BYPASS_LICENSE,
      DEV_PLATFORM_SESSION_TOKEN: process.env.DEV_PLATFORM_SESSION_TOKEN
    }

    process.env.DEV_BYPASS_LICENSE = 'true'
    delete process.env.DEV_PLATFORM_SESSION_TOKEN

    try {
      const remoteClient = {
        getAuthorizationStatus: vi.fn()
      }

      const service = createAuthorizationService({
        remoteLicensePlatformClient: remoteClient,
        getRemoteConfig: () => ({
          enabled: false,
          sessionToken: ''
        }),
        getDeviceCode: vi.fn().mockResolvedValue('QAI-DEV-DEVICE')
      })

      const result = await service.getActivationStatus()

      expect(result.status).toBe('not_logged_in')
      expect(result.devBypassLicense).toBe(false)
      expect(remoteClient.getAuthorizationStatus).not.toHaveBeenCalled()
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

  it('clears the persisted local session when the remote status is no longer valid and auto-reactivation is unavailable', async () => {
    const remoteClient = {
      getAuthorizationStatus: vi.fn().mockResolvedValue({
        status: 'not_logged_in',
        mode: 'server-license',
        authType: 'session-token',
        canUseApp: false,
        customerName: '',
        userId: '',
        licenseId: '',
        sessionToken: '',
        nextAction: 'activate-license'
      })
    }

    const saveSettings = vi.fn().mockResolvedValue(undefined)
    const service = createAuthorizationService({
      remoteLicensePlatformClient: remoteClient,
      settingsService: {
        saveSettings
      },
      getRemoteConfig: () => ({
        enabled: true,
        baseUrl: 'https://api.qiuaihub.com',
        sessionToken: 'session-stale'
      }),
      getDeviceCode: vi.fn().mockResolvedValue('QAI-REMOTE-DEVICE')
    })

    const result = await service.getActivationStatus()

    expect(result.status).toBe('not_logged_in')
    expect(saveSettings).toHaveBeenLastCalledWith(expect.objectContaining({
      authPlatform: expect.objectContaining({
        sessionToken: '',
        lastUserId: '',
        lastLicenseId: '',
        remoteServiceCapacity: null
      })
    }))
  })

  it('clears the persisted local session when the remote authorization returns 404', async () => {
    const remoteClient = {
      getAuthorizationStatus: vi.fn().mockRejectedValue({
        message: 'User not found',
        details: {
          statusCode: 404
        }
      })
    }

    const saveSettings = vi.fn().mockResolvedValue(undefined)
    const service = createAuthorizationService({
      remoteLicensePlatformClient: remoteClient,
      settingsService: {
        saveSettings
      },
      getRemoteConfig: () => ({
        enabled: true,
        baseUrl: 'https://api.qiuaihub.com',
        sessionToken: 'session-stale',
        customerName: 'Remote Alice',
        contact: '13800138000'
      }),
      getDeviceCode: vi.fn().mockResolvedValue('QAI-REMOTE-DEVICE')
    })

    const result = await service.getActivationStatus()

    expect(result.status).toBe('not_logged_in')
    expect(result.remoteStatus).toBe('request_failed')
    expect(saveSettings).toHaveBeenCalledWith(expect.objectContaining({
      authPlatform: expect.objectContaining({
        sessionToken: '',
        lastUserId: '',
        lastLicenseId: ''
      })
    }))
  })

  it('reuses a short-lived activation status cache to avoid repeated remote checks', async () => {
    const remoteClient = {
      getAuthorizationStatus: vi.fn().mockResolvedValue({
        status: 'activated',
        mode: 'server-license',
        authType: 'session-token',
        canUseApp: true,
        customerName: 'Remote Alice',
        userId: 'user-1',
        licenseId: 'license-1',
        inviteCode: 'QAI123456',
        deviceCode: 'QAI-REMOTE-DEVICE',
        activatedAt: '2026-06-15T10:00:00.000Z',
        expiresAt: '2026-07-15T10:00:00.000Z',
        sessionToken: 'session-1',
        nextAction: 'enter-app'
      })
    }

    const service = createAuthorizationService({
      remoteLicensePlatformClient: remoteClient,
      getRemoteConfig: () => ({
        enabled: true,
        baseUrl: 'https://api.qiuaihub.com',
        sessionToken: 'session-1'
      }),
      getDeviceCode: vi.fn().mockResolvedValue('QAI-REMOTE-DEVICE')
    })

    const first = await service.getActivationStatus()
    const second = await service.getActivationStatus()

    expect(remoteClient.getAuthorizationStatus).toHaveBeenCalledTimes(1)
    expect(first).toMatchObject({ status: 'activated', sessionToken: 'session-1' })
    expect(second).toMatchObject({ status: 'activated', sessionToken: 'session-1' })
  })
})
