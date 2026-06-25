import { describe, expect, it } from 'vitest'

describe('publishDraftValidation', () => {
  it('requires category id before remote publish calls and returns aligned missing field metadata', async () => {
    const { validatePublishDraftBeforeRemote } = await import('../../renderer/src/utils/publishDraftValidation.js')

    const result = validatePublishDraftBeforeRemote({
      platform: 'tiktok',
      profile: {
        requiredAttributes: [{ key: 'material', label: 'Material' }],
      },
      project: {
        name: 'Desk Lamp',
        baseInfo: {
          productName: 'Desk Lamp',
        },
        content: {
          selectedTitle: 'Modern Desk Lamp',
          selectedDescription: 'Compact metal desk lamp',
        },
        assets: {
          generatedImages: [
            {
              id: 'image-1',
              savedPath: 'F:/output/image-1.png',
              publishReadyUrl: 'https://cdn.qiuaihub.com/generated/image-1.png',
            },
          ],
        },
        publishDraft: {
          variants: [
            {
              sellerSkuCode: 'SKU-1',
              priceAmount: 19.99,
              stockQuantity: 10,
            },
          ],
          platformDrafts: {
            tiktok: {
              attributes: {
                material: 'metal',
              },
            },
          },
        },
      },
    })

    expect(result).toEqual({
      title: '类目 ID 不能为空',
      message: '请先补全发布草稿里的类目 ID，再发起远程发布校验或发布任务。',
      missingFields: ['platformDraft.categoryId'],
      missingFieldLabels: ['Category ID'],
    })
  })

  it('requires a variant before create-listing style remote calls', async () => {
    const { validatePublishDraftBeforeRemote } = await import('../../renderer/src/utils/publishDraftValidation.js')

    const result = validatePublishDraftBeforeRemote({
      platform: 'tiktok',
      profile: {
        requiredAttributes: [],
      },
      project: {
        name: 'Desk Lamp',
        content: {
          selectedTitle: 'Modern Desk Lamp',
          selectedDescription: 'Compact metal desk lamp',
        },
        assets: {
          generatedImages: [
            {
              id: 'image-1',
              savedPath: 'F:/output/image-1.png',
              publishReadyUrl: 'https://cdn.qiuaihub.com/generated/image-1.png',
            },
          ],
        },
        publishDraft: {
          variants: [],
          platformDrafts: {
            tiktok: {
              categoryId: 'category-1',
              attributes: {},
            },
          },
        },
      },
    })

    expect(result).toEqual({
      title: 'SKU 不能为空',
      message: '请至少补一条 SKU，再发起远程发布校验或发布任务。',
      missingFields: ['variants'],
      missingFieldLabels: ['Variants'],
    })
  })

  it('skips create-field checks for sync-status operations', async () => {
    const { validatePublishDraftBeforeRemote } = await import('../../renderer/src/utils/publishDraftValidation.js')

    const result = validatePublishDraftBeforeRemote({
      platform: 'tiktok',
      operationType: 'sync-status',
      profile: {
        requiredAttributes: [{ key: 'material', label: 'Material' }],
      },
      project: {
        name: 'Desk Lamp',
        content: {
          selectedTitle: 'Modern Desk Lamp',
          selectedDescription: 'Compact metal desk lamp',
        },
        assets: {
          sourceImages: [{ id: 'image-1', path: 'F:/output/image-1.png' }],
        },
        publishDraft: {
          variants: [],
          platformDrafts: {
            tiktok: {
              attributes: {},
            },
          },
        },
      },
    })

    expect(result).toBeNull()
  })

  it('requires a remote publish-ready media URL before create-listing calls', async () => {
    const { validatePublishDraftBeforeRemote } = await import('../../renderer/src/utils/publishDraftValidation.js')

    const result = validatePublishDraftBeforeRemote({
      platform: 'tiktok',
      profile: {
        requiredAttributes: [],
      },
      project: {
        name: 'Desk Lamp',
        content: {
          selectedTitle: 'Modern Desk Lamp',
          selectedDescription: 'Compact metal desk lamp',
        },
        assets: {
          sourceImages: [{ id: 'image-1', path: 'F:/output/image-1.png' }],
        },
        publishDraft: {
          variants: [
            {
              sellerSkuCode: 'SKU-1',
              priceAmount: 19.99,
              stockQuantity: 10,
            },
          ],
          platformDrafts: {
            tiktok: {
              categoryId: 'category-1',
              attributes: {},
            },
          },
        },
      },
    })

    expect(result).toEqual({
      title: '发布素材未就绪',
      message: '至少需要一个带远程发布地址的生成素材，才能执行 create-listing。',
      missingFields: ['media[0].publishReadyUrl'],
      missingFieldLabels: ['Primary Media Publish URL'],
    })
  })
})
