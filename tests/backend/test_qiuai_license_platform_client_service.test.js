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
      baseUrl: 'https://qiuaihub.com/',
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
      url: 'https://qiuaihub.com/api/activation/status'
    }))
    expect(result.status).toBe('activated')
  })
})
