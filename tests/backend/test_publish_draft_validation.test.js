import { describe, expect, it } from 'vitest'

describe('publishDraftValidation', () => {
  it('requires category id before remote publish calls', async () => {
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
      title: '类目未填写',
      message: '请先填写 Category ID，再进行发布预览或创建任务。'
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
