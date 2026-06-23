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
      baseUrl: 'https://api.qiuaihub.com/',
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
      url: 'https://api.qiuaihub.com/api/activation/status'
    }))
    expect(result.status).toBe('activated')
  })

  it('uses the latest baseUrl when getBaseUrl is provided', async () => {
    const request = vi.fn().mockResolvedValue({
      data: {
        ok: true,
        data: {
          status: 'activated'
        }
      }
    })

    let currentBaseUrl = 'https://test-a.qiuaihub.com/'
    const service = createQiuAiLicensePlatformClientService({
      getBaseUrl: () => currentBaseUrl,
      requestClient: {
        request
      }
    })

    await service.getAuthorizationStatus({
      sessionToken: 'session-a',
      deviceFingerprint: 'DEVICE-A'
    })

    currentBaseUrl = 'https://test-b.qiuaihub.com/'

    await service.getAuthorizationStatus({
      sessionToken: 'session-b',
      deviceFingerprint: 'DEVICE-B'
    })

    expect(request).toHaveBeenNthCalledWith(1, expect.objectContaining({
      url: 'https://test-a.qiuaihub.com/api/activation/status'
    }))
    expect(request).toHaveBeenNthCalledWith(2, expect.objectContaining({
      url: 'https://test-b.qiuaihub.com/api/activation/status'
    }))
  })

  it('uses the expected desktop-to-platform routes for commerce and generation endpoints', async () => {
    const request = vi.fn()
      .mockResolvedValueOnce({ data: { ok: true, data: { textBalanceCny: 10 } } })
      .mockResolvedValueOnce({ data: { ok: true, data: { serviceTier: 'IMAGE_4' } } })
      .mockResolvedValueOnce({ data: { ok: true, data: [{ id: 'pkg-1' }] } })
      .mockResolvedValueOnce({ data: { ok: true, data: { id: 'software-order-1' } } })
      .mockResolvedValueOnce({ data: { ok: true, data: { id: 'software-order-1', status: 'pending' } } })
      .mockResolvedValueOnce({ data: { ok: true, data: [{ id: 'compute-1' }] } })
      .mockResolvedValueOnce({ data: { ok: true, data: { id: 'compute-order-1' } } })
      .mockResolvedValueOnce({ data: { ok: true, data: { id: 'compute-order-1', status: 'pending' } } })
      .mockResolvedValueOnce({ data: { ok: true, data: { id: 'recharge-order-1' } } })
      .mockResolvedValueOnce({ data: { ok: true, data: { id: 'recharge-order-1', status: 'pending' } } })
      .mockResolvedValueOnce({ data: { ok: true, data: { generatedAt: '2026-06-22T00:00:00.000Z', boards: [] } } })
      .mockResolvedValueOnce({ data: { ok: true, data: [{ key: 'temu', label: 'TEMU' }] } })
      .mockResolvedValueOnce({ data: { ok: true, data: [{ code: 'my', label: '马来西亚' }] } })
      .mockResolvedValueOnce({ data: { ok: true, data: { items: [{ id: 'selection-1' }], page: 1, pageSize: 20, totalItems: 1 } } })
      .mockResolvedValueOnce({ data: { ok: true, data: { id: 'selection-1', title: 'Desk Lamp' } } })
      .mockResolvedValueOnce({ data: { ok: true, data: { platforms: [{ key: 'tiktok', label: 'TikTok Shop', ruleVersion: 'phase1-2026-06-22', automationStatus: 'pending-development', supportedOperations: ['create-listing', 'sync-status'] }] } } })
      .mockResolvedValueOnce({ data: { ok: true, data: [{ id: 'channel-1', platform: 'tiktok' }] } })
      .mockResolvedValueOnce({ data: { ok: true, data: { id: 'publish-draft-1', title: 'Desk Lamp' } } })
      .mockResolvedValueOnce({ data: { ok: true, data: { id: 'publish-draft-1', title: 'Desk Lamp' } } })
      .mockResolvedValueOnce({ data: { ok: true, data: { draftId: 'publish-draft-1', platform: 'tiktok', isValid: false, validationIssues: [], platformRule: { platformKey: 'tiktok', ruleVersion: 'phase1-2026-06-22' } } } })
      .mockResolvedValueOnce({ data: { ok: true, data: { id: 'publish-task-1', status: 'queued' } } })
      .mockResolvedValueOnce({ data: { ok: true, data: { id: 'publish-task-1', status: 'queued' } } })
      .mockResolvedValueOnce({ data: { ok: true, data: { id: 'publish-task-1', status: 'queued' } } })
      .mockResolvedValueOnce({ data: { ok: true, data: { id: 'job-1', status: 'PENDING' } } })
      .mockResolvedValueOnce({ data: { ok: true, data: { id: 'job-1', status: 'RUNNING' } } })

    const service = createQiuAiLicensePlatformClientService({
      baseUrl: 'https://api.qiuaihub.com',
      requestClient: {
        request
      }
    })

    await service.getWalletSummary({ sessionToken: 'session-1' })
    await service.getServiceCapacityProfile({ sessionToken: 'session-1' })
    await service.listSoftwarePackages({ sessionToken: 'session-1' })
    await service.createSoftwareOrder({ sessionToken: 'session-1', productPackageId: 'pkg-1' })
    await service.getSoftwareOrder({ id: 'software-order-1', sessionToken: 'session-1' })
    await service.listComputePackages({ sessionToken: 'session-1' })
    await service.createComputePackageOrder({ sessionToken: 'session-1', computePackageId: 'compute-1' })
    await service.getComputePackageOrder({ id: 'compute-order-1', sessionToken: 'session-1' })
    await service.createRechargeOrder({ sessionToken: 'session-1', walletType: 'image', amountCny: 100 })
    await service.getRechargeOrder({ id: 'recharge-order-1', sessionToken: 'session-1' })
    await service.getSelectionManifest({ sessionToken: 'session-1' })
    await service.listSelectionPlatforms({ sessionToken: 'session-1' })
    await service.listSelectionSites({ sessionToken: 'session-1', platform: 'shopee' })
    await service.listSelectionItems({ sessionToken: 'session-1', platform: 'temu', boardType: 'hot-sale', page: 1, pageSize: 20 })
    await service.getSelectionItemDetail({ id: 'selection-1', sessionToken: 'session-1' })
    await service.getPublishClientConfig({ sessionToken: 'session-1' })
    await service.listPublishChannelAccounts({ sessionToken: 'session-1', platform: 'tiktok' })
    await service.upsertPublishDraft({ sessionToken: 'session-1', workspaceProjectId: 'project-1', title: 'Desk Lamp', descriptionHtml: '<p>desc</p>' })
    await service.getPublishDraft({ id: 'publish-draft-1', sessionToken: 'session-1' })
    await service.getPublishDraftPreview({ id: 'publish-draft-1', sessionToken: 'session-1', platform: 'tiktok', channelAccountId: 'channel-1' })
    await service.createPublishTask({ sessionToken: 'session-1', draftId: 'publish-draft-1', platform: 'tiktok', channelAccountId: 'channel-1', operationType: 'create-listing' })
    await service.getPublishTask({ id: 'publish-task-1', sessionToken: 'session-1' })
    await service.retryPublishTask({ id: 'publish-task-1', sessionToken: 'session-1' })
    await service.createGenerationJob({ sessionToken: 'session-1', jobType: 'TEXT', items: [{ slotIndex: 1 }] })
    await service.getGenerationJob({ id: 'job-1', sessionToken: 'session-1', mode: 'compact' })

    expect(request).toHaveBeenNthCalledWith(1, expect.objectContaining({
      method: 'get',
      url: 'https://api.qiuaihub.com/api/wallet/summary',
      params: { sessionToken: 'session-1' }
    }))
    expect(request).toHaveBeenNthCalledWith(2, expect.objectContaining({
      method: 'get',
      url: 'https://api.qiuaihub.com/api/service-capacity/profile',
      params: { sessionToken: 'session-1' }
    }))
    expect(request).toHaveBeenNthCalledWith(3, expect.objectContaining({
      method: 'get',
      url: 'https://api.qiuaihub.com/api/packages',
      params: { sessionToken: 'session-1' }
    }))
    expect(request).toHaveBeenNthCalledWith(4, expect.objectContaining({
      method: 'post',
      url: 'https://api.qiuaihub.com/api/orders',
      data: { sessionToken: 'session-1', productPackageId: 'pkg-1', channel: 'alipay' }
    }))
    expect(request).toHaveBeenNthCalledWith(5, expect.objectContaining({
      method: 'get',
      url: 'https://api.qiuaihub.com/api/orders/software-order-1',
      params: { sessionToken: 'session-1' }
    }))
    expect(request).toHaveBeenNthCalledWith(6, expect.objectContaining({
      method: 'get',
      url: 'https://api.qiuaihub.com/api/compute-packages',
      params: { sessionToken: 'session-1' }
    }))
    expect(request).toHaveBeenNthCalledWith(7, expect.objectContaining({
      method: 'post',
      url: 'https://api.qiuaihub.com/api/compute-package-orders',
      data: { sessionToken: 'session-1', computePackageId: 'compute-1', channel: 'alipay' }
    }))
    expect(request).toHaveBeenNthCalledWith(8, expect.objectContaining({
      method: 'get',
      url: 'https://api.qiuaihub.com/api/compute-package-orders/compute-order-1',
      params: { sessionToken: 'session-1' }
    }))
    expect(request).toHaveBeenNthCalledWith(9, expect.objectContaining({
      method: 'post',
      url: 'https://api.qiuaihub.com/api/recharge/orders',
      data: { sessionToken: 'session-1', walletType: 'image', amountCny: 100, channel: 'alipay', couponCode: '' }
    }))
    expect(request).toHaveBeenNthCalledWith(10, expect.objectContaining({
      method: 'get',
      url: 'https://api.qiuaihub.com/api/recharge/orders/recharge-order-1',
      params: { sessionToken: 'session-1' }
    }))
    expect(request).toHaveBeenNthCalledWith(11, expect.objectContaining({
      method: 'get',
      url: 'https://api.qiuaihub.com/api/client/selection/manifest',
      params: { sessionToken: 'session-1' }
    }))
    expect(request).toHaveBeenNthCalledWith(12, expect.objectContaining({
      method: 'get',
      url: 'https://api.qiuaihub.com/api/client/selection/platforms',
      params: { sessionToken: 'session-1' }
    }))
    expect(request).toHaveBeenNthCalledWith(13, expect.objectContaining({
      method: 'get',
      url: 'https://api.qiuaihub.com/api/client/selection/sites',
      params: { sessionToken: 'session-1', platform: 'shopee' }
    }))
    expect(request).toHaveBeenNthCalledWith(14, expect.objectContaining({
      method: 'get',
      url: 'https://api.qiuaihub.com/api/client/selection/items',
      params: {
        sessionToken: 'session-1',
        platform: 'temu',
        boardType: 'hot-sale',
        siteCode: '',
        keyword: '',
        page: 1,
        pageSize: 20
      }
    }))
    expect(request).toHaveBeenNthCalledWith(15, expect.objectContaining({
      method: 'get',
      url: 'https://api.qiuaihub.com/api/client/selection/items/selection-1',
      params: { sessionToken: 'session-1' }
    }))
    expect(request).toHaveBeenNthCalledWith(16, expect.objectContaining({
      method: 'get',
      url: 'https://api.qiuaihub.com/api/client/publish/config',
      params: { sessionToken: 'session-1' }
    }))
    expect(request).toHaveBeenNthCalledWith(17, expect.objectContaining({
      method: 'get',
      url: 'https://api.qiuaihub.com/api/client/publish/channel-accounts',
      params: {
        sessionToken: 'session-1',
        platform: 'tiktok'
      }
    }))
    expect(request).toHaveBeenNthCalledWith(18, expect.objectContaining({
      method: 'post',
      url: 'https://api.qiuaihub.com/api/client/publish/drafts',
      data: expect.objectContaining({
        sessionToken: 'session-1',
        workspaceProjectId: 'project-1',
        title: 'Desk Lamp'
      })
    }))
    expect(request).toHaveBeenNthCalledWith(19, expect.objectContaining({
      method: 'get',
      url: 'https://api.qiuaihub.com/api/client/publish/drafts/publish-draft-1',
      params: { sessionToken: 'session-1' }
    }))
    expect(request).toHaveBeenNthCalledWith(20, expect.objectContaining({
      method: 'post',
      url: 'https://api.qiuaihub.com/api/client/publish/drafts/publish-draft-1/preview',
      data: {
        sessionToken: 'session-1',
        platform: 'tiktok',
        channelAccountId: 'channel-1'
      }
    }))
    expect(request).toHaveBeenNthCalledWith(21, expect.objectContaining({
      method: 'post',
      url: 'https://api.qiuaihub.com/api/client/publish/tasks',
      data: {
        sessionToken: 'session-1',
        draftId: 'publish-draft-1',
        platform: 'tiktok',
        channelAccountId: 'channel-1',
        operationType: 'create-listing'
      }
    }))
    expect(request).toHaveBeenNthCalledWith(22, expect.objectContaining({
      method: 'get',
      url: 'https://api.qiuaihub.com/api/client/publish/tasks/publish-task-1',
      params: { sessionToken: 'session-1' }
    }))
    expect(request).toHaveBeenNthCalledWith(23, expect.objectContaining({
      method: 'post',
      url: 'https://api.qiuaihub.com/api/client/publish/tasks/publish-task-1/retry',
      data: {
        id: 'publish-task-1',
        sessionToken: 'session-1'
      }
    }))
    expect(request).toHaveBeenNthCalledWith(24, expect.objectContaining({
      method: 'post',
      url: 'https://api.qiuaihub.com/api/generation/jobs',
      data: {
        sessionToken: 'session-1',
        jobType: 'TEXT',
        menuKey: '',
        draftSnapshot: {},
        items: [{ slotIndex: 1, inputSnapshot: {} }]
      }
    }))
    expect(request).toHaveBeenNthCalledWith(25, expect.objectContaining({
      method: 'get',
      url: 'https://api.qiuaihub.com/api/generation/jobs/job-1',
      params: {
        sessionToken: 'session-1',
        mode: 'compact'
      }
    }))
  })

  it('downloads generation artifacts from the expected binary route', async () => {
    const request = vi.fn().mockResolvedValue({
      data: Uint8Array.from([1, 2, 3, 4])
    })

    const service = createQiuAiLicensePlatformClientService({
      baseUrl: 'https://api.qiuaihub.com',
      requestClient: {
        request
      }
    })

    const result = await service.downloadGenerationArtifact({
      id: 'artifact-1',
      sessionToken: 'session-1'
    })

    expect(request).toHaveBeenCalledWith(expect.objectContaining({
      method: 'get',
      url: 'https://api.qiuaihub.com/api/generation/artifacts/artifact-1/download',
      params: { sessionToken: 'session-1' },
      responseType: 'arraybuffer'
    }))
    expect(Buffer.isBuffer(result)).toBe(true)
    expect(Array.from(result)).toEqual([1, 2, 3, 4])
  })

  it('prefers an absolute artifact downloadUrl without forcing the desktop back through the platform download endpoint', async () => {
    const request = vi.fn().mockResolvedValue({
      data: Uint8Array.from([9, 8, 7])
    })

    const service = createQiuAiLicensePlatformClientService({
      baseUrl: 'https://api.qiuaihub.com',
      requestClient: {
        request
      }
    })

    const result = await service.downloadGenerationArtifact({
      id: 'artifact-2',
      sessionToken: 'session-2',
      downloadUrl: 'https://cdn.qiuaihub.com/generated/artifact-2.png'
    })

    expect(request).toHaveBeenCalledWith(expect.objectContaining({
      method: 'get',
      url: 'https://cdn.qiuaihub.com/generated/artifact-2.png',
      params: undefined,
      responseType: 'arraybuffer'
    }))
    expect(Buffer.isBuffer(result)).toBe(true)
    expect(Array.from(result)).toEqual([9, 8, 7])
  })

  it('normalizes desktop payloads before sending them to the platform', async () => {
    const request = vi.fn()
      .mockResolvedValueOnce({ data: { ok: true, data: { status: 'activated' } } })
      .mockResolvedValueOnce({ data: { ok: true, data: { id: 'software-order-1' } } })
      .mockResolvedValueOnce({ data: { ok: true, data: { id: 'compute-order-1' } } })
      .mockResolvedValueOnce({ data: { ok: true, data: { id: 'recharge-order-1' } } })
      .mockResolvedValueOnce({ data: { ok: true, data: { id: 'job-1' } } })

    const service = createQiuAiLicensePlatformClientService({
      baseUrl: 'https://api.qiuaihub.com/',
      requestClient: {
        request
      }
    })

    await service.activateLicense({
      customerName: '  Alice  ',
      contact: ' 13800138000 ',
      inviteCode: ' QAI8888 ',
      durationDays: ' 30 ',
      deviceName: ' QiuAi Desktop ',
      deviceFingerprint: ' QAI-DEVICE '
    })
    await service.createSoftwareOrder({
      sessionToken: ' session-1 ',
      productPackageId: ' pkg-1 ',
      channel: ' alipay '
    })
    await service.createComputePackageOrder({
      sessionToken: ' session-1 ',
      computePackageId: ' compute-1 ',
      channel: ' alipay '
    })
    await service.createRechargeOrder({
      sessionToken: ' session-1 ',
      walletType: ' image ',
      amountCny: '100.50',
      couponCode: ' TEST ',
      channel: ' alipay '
    })
    await service.createGenerationJob({
      sessionToken: ' session-1 ',
      jobType: ' TEXT ',
      menuKey: ' workspace ',
      requestedConcurrency: '4',
      draftSnapshot: null,
      items: [
        {
          groupIndex: '1',
          slotIndex: '2',
          assetType: ' TEXT ',
          providerType: ' DEEPSEEK ',
          providerModel: ' deepseek-v4-flash ',
          inputSnapshot: null,
          maxAttempts: '3'
        }
      ]
    })

    expect(request).toHaveBeenNthCalledWith(1, expect.objectContaining({
      data: {
        customerName: 'Alice',
        contact: '13800138000',
        inviteCode: 'QAI8888',
        durationDays: 30,
        deviceName: 'QiuAi Desktop',
        deviceFingerprint: 'QAI-DEVICE'
      }
    }))
    expect(request).toHaveBeenNthCalledWith(2, expect.objectContaining({
      data: {
        sessionToken: 'session-1',
        productPackageId: 'pkg-1',
        channel: 'alipay'
      }
    }))
    expect(request).toHaveBeenNthCalledWith(3, expect.objectContaining({
      data: {
        sessionToken: 'session-1',
        computePackageId: 'compute-1',
        channel: 'alipay'
      }
    }))
    expect(request).toHaveBeenNthCalledWith(4, expect.objectContaining({
      data: {
        sessionToken: 'session-1',
        walletType: 'image',
        amountCny: 100.5,
        couponCode: 'TEST',
        channel: 'alipay'
      }
    }))
    expect(request).toHaveBeenNthCalledWith(5, expect.objectContaining({
      data: {
        sessionToken: 'session-1',
        jobType: 'TEXT',
        menuKey: 'workspace',
        requestedConcurrency: 4,
        draftSnapshot: {},
        items: [
          {
            groupIndex: 1,
            slotIndex: 2,
            assetType: 'TEXT',
            providerType: 'DEEPSEEK',
            providerModel: 'deepseek-v4-flash',
            inputSnapshot: {},
            maxAttempts: 3
          }
        ]
      }
    }))
  })
})
