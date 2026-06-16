import { describe, expect, it } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import { parse } from '@vue/compiler-sfc'

describe('component sources', () => {
  it('parses the new page components without template syntax errors', () => {
    const componentPaths = [
      'renderer/src/components/ProductWorkbench.vue',
      'renderer/src/components/DataCenterPage.vue',
      'renderer/src/components/ProductTemplateDemoPage.vue',
      'renderer/src/components/GeneratorStudioPage.vue',
      'renderer/src/components/ModelConfigPage.vue',
      'renderer/src/components/PromptLibraryPanel.vue'
    ]

    componentPaths.forEach((componentPath) => {
      const source = fs.readFileSync(path.resolve(process.cwd(), componentPath), 'utf8')
      expect(() => parse(source)).not.toThrow()
    })
  })

  it('keeps the top bar and activation gate aligned with the current desktop shell', () => {
    const topbarSource = fs.readFileSync(path.resolve(process.cwd(), 'renderer/src/components/AppTopBar.vue'), 'utf8')
    const activationSource = fs.readFileSync(path.resolve(process.cwd(), 'renderer/src/components/ActivationGate.vue'), 'utf8')

    expect(topbarSource).not.toContain('brand-click')
    expect(topbarSource).toContain('cleanup-click')
    expect(topbarSource).toContain('theme-change')
    expect(topbarSource).toContain('contact-preview-modal')
    expect(topbarSource).toContain('topbar-clean-button')
    expect(topbarSource).toContain('brandLabel')

    expect(activationSource).toContain('copy-device-code')
    expect(activationSource).toContain('import-license')
    expect(activationSource).toContain('refresh-license')
    expect(activationSource).toContain('activationState.deviceCode')
  })

  it('uses product-card workbench layout and simplified data-center/template pages', () => {
    const workbenchSource = fs.readFileSync(path.resolve(process.cwd(), 'renderer/src/components/ProductWorkbench.vue'), 'utf8')
    const dataCenterSource = fs.readFileSync(path.resolve(process.cwd(), 'renderer/src/components/DataCenterPage.vue'), 'utf8')
    const templateSource = fs.readFileSync(path.resolve(process.cwd(), 'renderer/src/components/ProductTemplateDemoPage.vue'), 'utf8')

    expect(workbenchSource).toContain('workbench-plus-button')
    expect(workbenchSource).toContain('project-draft-grid')
    expect(workbenchSource).toContain('project-draft-card__title')
    expect(workbenchSource).toContain('project-draft-card__meta')
    expect(workbenchSource).toContain('project-draft-card__media')
    expect(workbenchSource).toContain('product-result-grid')
    expect(workbenchSource).toContain('product-result-card__copy')
    expect(workbenchSource).toContain('project-draft-card__delete')
    expect(workbenchSource).toContain('product-result-card__detail')
    expect(workbenchSource).toContain("@click=\"emit('export-project', item.project.id)\"")
    expect(workbenchSource).not.toContain('effect-display')

    expect(dataCenterSource).toContain('data-center-gauge-row')
    expect(dataCenterSource).toContain('credit-gauge-card')
    expect(dataCenterSource).toContain('credit-record-panel')
    expect(dataCenterSource).toContain("key: 'text'")
    expect(dataCenterSource).toContain("key: 'image'")
    expect(dataCenterSource).toContain("key: 'video'")

    expect(templateSource).toContain('product-template-demo')
  })

  it('uses the unified generator studio and simplified model config structure required by the new workflow', () => {
    const generatorSource = fs.readFileSync(path.resolve(process.cwd(), 'renderer/src/components/GeneratorStudioPage.vue'), 'utf8')
    const modelConfigSource = fs.readFileSync(path.resolve(process.cwd(), 'renderer/src/components/ModelConfigPage.vue'), 'utf8')
    const promptLibrarySource = fs.readFileSync(path.resolve(process.cwd(), 'renderer/src/components/PromptLibraryPanel.vue'), 'utf8')

    expect(generatorSource).toContain('generator-column__header')
    expect(generatorSource).toContain('generator-form')
    expect(generatorSource).toContain('generator-preview')
    expect(generatorSource).toContain('generator-export')
    expect(generatorSource).toContain("emit('pick-image')")
    expect(generatorSource).toContain('generator-form__series')
    expect(generatorSource).toContain('seriesPromptAssignments')
    expect(generatorSource).toContain('differenceLevelOptions')
    expect(generatorSource).not.toContain('generator-project-context')
    expect(generatorSource).toContain('titleTemplateId')
    expect(generatorSource).toContain('descriptionTemplateId')
    expect(generatorSource).toContain('imageTemplateId')
    expect(generatorSource).toContain('videoTemplateId')

    expect(modelConfigSource).toContain('model-config-stack')
    expect(modelConfigSource).toContain('model-config-field')
    expect(modelConfigSource).toContain('model-config-input')
    expect(modelConfigSource).toContain('textApiKey')
    expect(modelConfigSource).toContain('imageApiKey')
    expect(modelConfigSource).toContain('videoApiKey')
    expect(modelConfigSource).toContain("emit('save')")

    expect(promptLibrarySource).toContain('CATEGORY_ORDER')
    expect(promptLibrarySource).toContain('templatesByCategory')
    expect(promptLibrarySource).toContain('expandedTemplateId')
    expect(promptLibrarySource).toContain('save-template')
    expect(promptLibrarySource).toContain('remove-template')
    expect(promptLibrarySource).toContain('提示词库')
    expect(promptLibrarySource).toContain('标题')
    expect(promptLibrarySource).toContain('描述')
    expect(promptLibrarySource).toContain('图片')
    expect(promptLibrarySource).toContain('视频')
  })
})
