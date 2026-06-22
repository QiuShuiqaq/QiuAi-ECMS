import { describe, expect, it, vi } from 'vitest'

describe('publishDraftService', () => {
  it('maps a workspace project into a remote publish draft payload', async () => {
    const { buildDraftPayloadFromProject } = await import('../../main/src/services/publishDraftService.js')

    const payload = buildDraftPayloadFromProject({
      id: 'project-1',
      name: 'Desk Lamp Project',
      baseInfo: {
        productName: 'Desk Lamp',
        brand: 'QiuAi',
        category: 'Lighting',
        highlights: ['Metal arm', 'Warm light'],
        keywords: ['lamp', 'desk', 'lighting']
      },
      content: {
        selectedTitle: 'Modern Desk Lamp',
        selectedDescription: 'Compact metal desk lamp'
      },
      assets: {
        generatedImages: [
          {
            id: 'image-1',
            savedPath: 'F:/output/image-1.png',
            width: 1200,
            height: 1200
          }
        ]
      },
      publishDraft: {
        attributes: {
          material: 'metal'
        },
        variants: [
          {
            sellerSkuCode: 'SKU-1',
            variant: { color: 'black' },
            stockQuantity: 20
          }
        ],
        platformDrafts: {
          tiktok: {
            categoryId: '1001'
          }
        }
      },
      metadata: {
        selectionSource: {
          itemId: 'selection-1'
        }
      }
    })

    expect(payload).toMatchObject({
      workspaceProjectId: 'project-1',
      title: 'Modern Desk Lamp',
      brandText: 'QiuAi',
      categoryHint: 'Lighting',
      bulletPoints: ['Metal arm', 'Warm light'],
      tags: ['lamp', 'desk', 'lighting']
    })
    expect(payload.media).toHaveLength(1)
    expect(payload.variants).toHaveLength(1)
    expect(payload.platformDrafts.tiktok.categoryId).toBe('1001')
  })

  it('syncs a workspace project by id through the remote publish draft endpoint', async () => {
    const remoteLicensePlatformClient = {
      upsertPublishDraft: vi.fn().mockResolvedValue({ id: 'draft-1', title: 'Modern Desk Lamp' })
    }

    const { createPublishDraftService } = await import('../../main/src/services/publishDraftService.js')
    const service = createPublishDraftService({
      remoteLicensePlatformClient,
      getSessionToken: async () => 'session-1',
      getStoredState: () => ({
        productProjects: [
          {
            id: 'project-1',
            name: 'Desk Lamp Project',
            baseInfo: {
              productName: 'Desk Lamp',
              brand: 'QiuAi',
              category: 'Lighting',
              highlights: ['Metal arm'],
              keywords: ['lamp']
            },
            content: {
              selectedTitle: 'Modern Desk Lamp',
              selectedDescription: 'Compact metal desk lamp'
            },
            assets: {
              sourceImages: [
                {
                  id: 'image-1',
                  path: 'F:/output/image-1.png'
                }
              ]
            },
            publishDraft: {
              attributes: {}
            },
            metadata: {}
          }
        ]
      })
    })

    const result = await service.upsertDraft({
      projectId: 'project-1'
    })

    expect(remoteLicensePlatformClient.upsertPublishDraft).toHaveBeenCalledWith(expect.objectContaining({
      sessionToken: 'session-1',
      workspaceProjectId: 'project-1',
      title: 'Modern Desk Lamp'
    }))
    expect(result.id).toBe('draft-1')
  })

  it('lists publish channel accounts with the current session token', async () => {
    const remoteLicensePlatformClient = {
      listPublishChannelAccounts: vi.fn().mockResolvedValue([
        {
          id: 'channel-1',
          platform: 'tiktok'
        }
      ])
    }

    const { createPublishDraftService } = await import('../../main/src/services/publishDraftService.js')
    const service = createPublishDraftService({
      remoteLicensePlatformClient,
      getSessionToken: async () => 'session-1'
    })

    const result = await service.listChannelAccounts({
      platform: 'tiktok'
    })

    expect(remoteLicensePlatformClient.listPublishChannelAccounts).toHaveBeenCalledWith({
      platform: 'tiktok',
      sessionToken: 'session-1'
    })
    expect(result).toEqual([
      {
        id: 'channel-1',
        platform: 'tiktok'
      }
    ])
  })
})
