import { describe, expect, it, vi } from 'vitest'
import { createQiuAiLicensePlatformClientService } from '../../main/src/services/qiuAiLicensePlatformClientService'

describe('qiuAiLicensePlatformClientService', () => {
  it('requests authorization status from the remote license platform', async () => {
    const request = vi.fn().mockResolvedValue({
      data: {
        ok: true,
        data: {
          status: 'activated',
          sessionToken: 'session-1'
        }
      }
    })

    const service = createQiuAiLicensePlatformClientService({
      baseUrl: 'http://127.0.0.1:3721/',
      requestClient: {
        request
      }
    })

    const result = await service.getAuthorizationStatus({
      sessionToken: 'session-1',
      deviceFingerprint: 'QAI-DEVICE'
    })

    expect(request).toHaveBeenCalledWith(expect.objectContaining({
      method: 'get',
      url: 'http://127.0.0.1:3721/api/activation/status'
    }))
    expect(result.status).toBe('activated')
  })
})
