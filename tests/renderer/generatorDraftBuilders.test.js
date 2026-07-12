import { describe, expect, it } from 'vitest'

import { buildProjectTextGeneratorDraft, buildWorkspaceRunDraft } from '../../renderer/src/utils/generatorDraftBuilders.js'

describe('generatorDraftBuilders', () => {
  it('falls back invalid persisted text model ids to deepseek-chat', () => {
    const project = {
      id: 'project-1',
      name: 'Desk Lamp',
      baseInfo: {
        productName: 'Desk Lamp',
        language: 'zh-CN'
      },
      assets: {
        sourceImages: []
      },
      generationConfig: {
        model: 'deepseek-v4-pro'
      }
    }

    expect(buildWorkspaceRunDraft(project).model).toBe('deepseek-chat')
    expect(buildProjectTextGeneratorDraft(project, {}, 'title').model).toBe('deepseek-chat')
    expect(buildProjectTextGeneratorDraft(project, {}, 'description').model).toBe('deepseek-chat')
  })

  it('keeps the supported text model when the workspace draft is already valid', () => {
    const project = {
      id: 'project-2',
      name: 'Coffee Grinder',
      baseInfo: {
        productName: 'Coffee Grinder',
        language: 'zh-CN'
      },
      assets: {
        sourceImages: []
      },
      generationConfig: {
        model: 'deepseek-v4-pro'
      }
    }

    expect(buildWorkspaceRunDraft(project, { model: 'deepseek-chat' }).model).toBe('deepseek-chat')
  })
})
