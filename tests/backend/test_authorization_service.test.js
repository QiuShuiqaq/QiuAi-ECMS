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
})
