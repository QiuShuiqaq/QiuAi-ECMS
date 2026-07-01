import { describe, expect, it } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import { parse } from '@vue/compiler-sfc'

function readSource(relativePath) {
  return fs.readFileSync(path.resolve(process.cwd(), relativePath), 'utf8')
}

describe('component sources', () => {
  it('parses the current desktop shell components without template syntax errors', () => {
    const componentPaths = [
      'renderer/src/components/ProductWorkbench.vue',
      'renderer/src/components/GenerationCenterPage.vue',
      'renderer/src/components/DataCenterPage.vue',
      'renderer/src/components/GeneratorStudioPage.vue',
      'renderer/src/components/PurchaseCenterPage.vue',
      'renderer/src/components/PromptLibraryPanel.vue',
      'renderer/src/components/ActivationGate.vue',
      'renderer/src/components/AuthorizationPurchaseModal.vue',
      'renderer/src/components/UserAgreementModal.vue',
      'renderer/src/components/AppTopBar.vue'
    ]

    componentPaths.forEach((componentPath) => {
      const source = readSource(componentPath)
      expect(() => parse(source)).not.toThrow()
    })
  })

  it('keeps the top bar and activation gate aligned with the simplified activation flow', () => {
    const topbarSource = readSource('renderer/src/components/AppTopBar.vue')
    const activationSource = readSource('renderer/src/components/ActivationGate.vue')
    const purchaseModalSource = readSource('renderer/src/components/AuthorizationPurchaseModal.vue')
    const agreementModalSource = readSource('renderer/src/components/UserAgreementModal.vue')

    expect(topbarSource).toContain('cleanup-click')
    expect(topbarSource).toContain('purchase-license-click')
    expect(topbarSource).toContain('purchase-compute-click')
    expect(topbarSource).toContain('contact-preview-modal')
    expect(topbarSource).toContain('topbar-clean-button')
    expect(topbarSource).toContain('授权购买')
    expect(topbarSource).toContain('算力购买')
    expect(topbarSource).not.toContain('theme-change')

    expect(activationSource).toContain('statusText')
    expect(activationSource).toContain('titleText')
    expect(activationSource).toContain('deviceCodeText')
    expect(activationSource).toContain('activationState.deviceCode')
    expect(activationSource).not.toContain('copy-device-code')
    expect(activationSource).not.toContain('customerName')
    expect(activationSource).not.toContain('contact')
    expect(activationSource).not.toContain('inviteCode')
    expect(activationSource).not.toContain('import-license')
    expect(activationSource).not.toContain('refresh-license')

    expect(purchaseModalSource).toContain("defineEmits(['close', 'submit-order'])")
    expect(purchaseModalSource).toContain('selectedPackageId')
    expect(purchaseModalSource).toContain('softwarePackages')
    expect(purchaseModalSource).toContain('submitOrder')
    expect(agreementModalSource).toContain("defineEmits(['accept'])")
    expect(agreementModalSource).toContain('agreementState')
    expect(agreementModalSource).toContain('isSubmitting')
    expect(agreementModalSource).toContain('user-agreement-modal')
  })

  it('keeps workbench shortcuts and unified generator studio wired together', () => {
    const generationCenterSource = readSource('renderer/src/components/GenerationCenterPage.vue')
    const workbenchSource = readSource('renderer/src/components/ProductWorkbench.vue')
    const generatorSource = readSource('renderer/src/components/GeneratorStudioPage.vue')
    const generatorViewSource = readSource('renderer/src/utils/generatorViews.js')

    expect(generationCenterSource).toContain('work-center-studio')
    expect(generationCenterSource).toContain('generator-column--settings')
    expect(generationCenterSource).toContain('generator-column--preview')
    expect(generationCenterSource).toContain('generator-column--export')
    expect(generationCenterSource).toContain('if (!candidateId) return null')
    expect(generationCenterSource).toContain('function resolveProjectLanguage(project = {})')
    expect(generationCenterSource).toContain("emit('open-generator', { project, menuKey })")
    expect(generationCenterSource).toContain("emit('run-project', project)")

    expect(workbenchSource).toContain('workbench-plus-button')
    expect(workbenchSource).toContain('project-draft-grid')
    expect(workbenchSource).toContain('selection-panel__filters')
    expect(workbenchSource).toContain("'publish-sync-task'")
    expect(workbenchSource).toContain('resolveLatestTaskOperatorGuidance')

    expect(generatorSource).toContain('generator-column__header')
    expect(generatorSource).toContain('generator-form')
    expect(generatorSource).toContain('generator-preview')
    expect(generatorSource).toContain('generator-export')
    expect(generatorSource).toContain("emit('pick-image')")
    expect(generatorSource).toContain('videoTemplateId')

    expect(generatorViewSource).toContain('export const generatorViewMap = studioMenuConfig.generatorViews || {}')
    expect(generatorViewSource).toContain('export const generatorShortcutOptions = Object.entries(generatorViewMap).map')
  })

  it('keeps purchase center and prompt library available in the simplified shell', () => {
    const purchaseCenterSource = readSource('renderer/src/components/PurchaseCenterPage.vue')
    const promptLibrarySource = readSource('renderer/src/components/PromptLibraryPanel.vue')

    expect(purchaseCenterSource).toContain('purchase-center__hero')
    expect(purchaseCenterSource).toContain('purchase-center__wallet-grid')
    expect(purchaseCenterSource).toContain("emit('refresh-catalog')")
    expect(purchaseCenterSource).toContain("emit('update-recharge-form'")
    expect(purchaseCenterSource).toContain("emit('create-recharge')")
    expect(purchaseCenterSource).toContain('purchase-center__recharge-form')
    expect(purchaseCenterSource).toContain('Purchase Center')
    expect(purchaseCenterSource).toContain('购买中心')
    expect(purchaseCenterSource).toContain('授权套餐')
    expect(purchaseCenterSource).toContain('算力套餐')
    expect(purchaseCenterSource).not.toContain('Manage software licenses, monthly compute packages, and direct balance recharge in one place')

    expect(promptLibrarySource).toContain('CATEGORY_ORDER')
    expect(promptLibrarySource).toContain('templatesByCategory')
    expect(promptLibrarySource).toContain('expandedTemplateId')
    expect(promptLibrarySource).toContain('save-template')
    expect(promptLibrarySource).toContain('remove-template')
  })
})
