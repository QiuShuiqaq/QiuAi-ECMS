import { describe, expect, it } from 'vitest'

describe('assignment template update', () => {
  it('applies template fields in one atomic update for series-design assignments', async () => {
    const { applyTemplateSelectionToAssignment } = await import('../../renderer/src/utils/assignmentTemplateUpdate.js')

    const assignments = [
      {
        id: 'image-1',
        selected: true,
        prompt: '',
        imageType: '',
        templateId: ''
      }
    ]

    const nextAssignments = applyTemplateSelectionToAssignment({
      assignments,
      index: 0,
      template: {
        id: 'product-main',
        name: '商品主图',
        prompt: '突出主体卖点'
      }
    })

    expect(nextAssignments).toEqual([
      {
        id: 'image-1',
        selected: true,
        prompt: '突出主体卖点',
        imageType: '商品主图',
        templateId: 'product-main'
      }
    ])
  })

  it('clears template fields in one atomic update when template is missing', async () => {
    const { applyTemplateSelectionToAssignment } = await import('../../renderer/src/utils/assignmentTemplateUpdate.js')

    const assignments = [
      {
        id: 'image-1',
        selected: true,
        prompt: '旧提示词',
        imageType: '商品主图',
        templateId: 'product-main'
      }
    ]

    const nextAssignments = applyTemplateSelectionToAssignment({
      assignments,
      index: 0,
      template: null
    })

    expect(nextAssignments).toEqual([
      {
        id: 'image-1',
        selected: true,
        prompt: '旧提示词',
        imageType: '',
        templateId: ''
      }
    ])
  })

  it('fills every batch prompt with the selected template prompt when differential mode is enabled', async () => {
    const { applyTemplateSelectionToAssignment } = await import('../../renderer/src/utils/assignmentTemplateUpdate.js')

    const assignments = [
      {
        id: 'image-1',
        selected: true,
        prompt: '旧提示词',
        imageType: '',
        templateId: '',
        differentialEnabled: true,
        batchPrompts: ['', '', '']
      }
    ]

    const nextAssignments = applyTemplateSelectionToAssignment({
      assignments,
      index: 0,
      template: {
        id: 'product-main',
        name: '商品主图',
        prompt: '突出主体卖点'
      }
    })

    expect(nextAssignments).toEqual([
      {
        id: 'image-1',
        selected: true,
        prompt: '突出主体卖点',
        imageType: '商品主图',
        templateId: 'product-main',
        differentialEnabled: true,
        batchPrompts: ['突出主体卖点', '突出主体卖点', '突出主体卖点']
      }
    ])
  })
})
