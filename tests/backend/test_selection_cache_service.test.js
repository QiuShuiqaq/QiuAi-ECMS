import { describe, expect, it } from 'vitest'

describe('selectionCacheService', () => {
  it('normalizes protocol-relative image urls for selection sources', async () => {
    const { normalizeRemoteImageUrl } = await import('../../main/src/services/selectionCacheService.js')

    expect(normalizeRemoteImageUrl('//img.ltwebstatic.com/example.jpg')).toBe('https://img.ltwebstatic.com/example.jpg')
    expect(normalizeRemoteImageUrl('//ae-pic-a1.aliexpress-media.com/example.png')).toBe('https://ae-pic-a1.aliexpress-media.com/example.png')
  })

  it('keeps absolute image urls unchanged', async () => {
    const { normalizeRemoteImageUrl } = await import('../../main/src/services/selectionCacheService.js')

    expect(normalizeRemoteImageUrl('https://cdn.example.com/image.webp')).toBe('https://cdn.example.com/image.webp')
  })
})
