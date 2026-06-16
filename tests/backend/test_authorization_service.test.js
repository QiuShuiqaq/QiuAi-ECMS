import { describe, expect, it, vi } from 'vitest'
import { createAuthorizationService } from '../../main/src/services/authorizationService'

describe('authorization service', () => {
  it('maps a valid legacy license into the new activation shape', async () => {
    const service = createAuthorizationService({
      legacyLicenseService: {
        getActivationStatus: vi.fn().mockResolvedValue({
          status: 'activated',
          customerName: 'Alice',
          deviceCode: 'QAI-DEVICE',
          activatedAt: '2026-06-15T10:00:00.000Z',
          message: ''
        }),
        getDeviceCodePayload: vi.fn(),
        importLicenseFromFile: vi.fn()
      }
    })

    const result = await service.getActivationStatus()

    expect(result.status).toBe('activated')
    expect(result.canUseApp).toBe(true)
    expect(result.mode).toBe('legacy-license')
    expect(result.authType).toBe('offline-license')
    expect(result.customerName).toBe('Alice')
    expect(result.legacyStatus).toBe('activated')
    expect(result.nextAction).toBe('enter-app')
  })

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

    const service = createAuthorizationService({
      legacyLicenseService: {
        getActivationStatus: vi.fn().mockResolvedValue({
          status: 'not_found'
        }),
        getDeviceCodePayload: vi.fn(),
        importLicenseFromFile: vi.fn()
      },
      remoteLicensePlatformClient: remoteClient,
      getRemoteConfig: () => ({
        enabled: true,
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
  })

  it('maps a device mismatch into a support-oriented activation state', async () => {
    const service = createAuthorizationService({
      legacyLicenseService: {
        getActivationStatus: vi.fn().mockResolvedValue({
          status: 'mismatch',
          customerName: 'Alice',
          deviceCode: 'QAI-OTHER',
          activatedAt: '2026-06-15T10:00:00.000Z',
          message: '当前设备与授权不匹配'
        }),
        getDeviceCodePayload: vi.fn(),
        importLicenseFromFile: vi.fn()
      }
    })

    const result = await service.getActivationStatus()

    expect(result.status).toBe('device_mismatch')
    expect(result.canUseApp).toBe(false)
    expect(result.nextAction).toBe('contact-support')
    expect(result.legacyStatus).toBe('mismatch')
  })
})
