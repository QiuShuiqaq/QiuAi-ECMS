import { describe, expect, it } from 'vitest'

describe('publishDraftValidation', () => {
  it('requires category id before remote publish calls and returns aligned missing field metadata', async () => {
    const { validatePublishDraftBeforeRemote } = await import('../../renderer/src/utils/publishDraftValidation.js')

    const result = validatePublishDraftBeforeRemote({
      platform: 'tiktok',
      profile: {
        requiredAttributes: [
          { key: 'material', label: 'Material' }
        ]
      },
      project: {
        name: 'Desk Lamp',
        baseInfo: {
          productName: 'Desk Lamp'
        },
        content: {
          selectedTitle: 'Modern Desk Lamp',
          selectedDescription: 'Compact metal desk lamp'
        },
        assets: {
          sourceImages: [{ id: 'image-1', path: 'F:/output/image-1.png' }]
        },
        publishDraft: {
          variants: [
            {
              sellerSkuCode: 'SKU-1',
              priceAmount: 19.99,
              stockQuantity: 10
            }
          ],
          platformDrafts: {
            tiktok: {
              attributes: {
                material: 'metal'
              }
            }
          }
        }
      }
    })

    expect(result).toEqual({
      title: '绫荤洰鏈～鍐?',
      message: '璇峰厛濉啓 Category ID锛屽啀杩涜鍙戝竷棰勮鎴栧垱寤轰换鍔°€?',
      missingFields: ['platformDraft.categoryId'],
      missingFieldLabels: ['Category ID']
    })
  })

  it('requires a variant before create-listing style remote calls', async () => {
    const { validatePublishDraftBeforeRemote } = await import('../../renderer/src/utils/publishDraftValidation.js')

    const result = validatePublishDraftBeforeRemote({
      platform: 'tiktok',
      profile: {
        requiredAttributes: []
      },
      project: {
        name: 'Desk Lamp',
        content: {
          selectedTitle: 'Modern Desk Lamp',
          selectedDescription: 'Compact metal desk lamp'
        },
        assets: {
          sourceImages: [{ id: 'image-1', path: 'F:/output/image-1.png' }]
        },
        publishDraft: {
          variants: [],
          platformDrafts: {
            tiktok: {
              categoryId: 'category-1',
              attributes: {}
            }
          }
        }
      }
    })

    expect(result).toEqual({
      title: 'SKU 鏈～鍐?',
      message: '璇峰厛涓哄綋鍓嶅彂甯冭崏绋垮姞鍏ヨ嚦灏戜竴涓?SKU锛屽啀杩涜鍙戝竷棰勮鎴栧垱寤轰换鍔°€?',
      missingFields: ['variants'],
      missingFieldLabels: ['Variants']
    })
  })

  it('skips create-field checks for sync-status operations', async () => {
    const { validatePublishDraftBeforeRemote } = await import('../../renderer/src/utils/publishDraftValidation.js')

    const result = validatePublishDraftBeforeRemote({
      platform: 'tiktok',
      operationType: 'sync-status',
      profile: {
        requiredAttributes: [
          { key: 'material', label: 'Material' }
        ]
      },
      project: {
        name: 'Desk Lamp',
        content: {
          selectedTitle: 'Modern Desk Lamp',
          selectedDescription: 'Compact metal desk lamp'
        },
        assets: {
          sourceImages: [{ id: 'image-1', path: 'F:/output/image-1.png' }]
        },
        publishDraft: {
          variants: [],
          platformDrafts: {
            tiktok: {
              attributes: {}
            }
          }
        }
      }
    })

    expect(result).toBeNull()
  })
})
