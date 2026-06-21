import { describe, expect, it } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'

describe('registerIpc source', () => {
  it('registers license, prompt, and studio ipc handlers', () => {
    const source = fs.readFileSync(path.resolve(process.cwd(), 'main/src/bootstrap/registerIpc.js'), 'utf8')
    expect(source).toContain("require('../ipc/licenseIpc')")
    expect(source).toContain("require('../ipc/promptIpc')")
    expect(source).toContain("require('../ipc/studioIpc')")
    expect(source).toContain('registerLicenseIpc(')
    expect(source).toContain('registerPromptIpc(')
    expect(source).toContain('registerStudioIpc(')
    expect(source).not.toContain("require('../ipc/drawIpc')")
    expect(source).not.toContain("require('../ipc/taskIpc')")
    expect(source).not.toContain("require('../services/licenseService')")
    expect(source).not.toContain('registerDrawIpc(')
    expect(source).not.toContain('registerTaskIpc(')
    expect(source).toContain('return {')
    expect(source).toContain('studioTaskManagerService')
  })

  it('keeps remote platform access inside the main-process services rather than the renderer shell', () => {
    const source = fs.readFileSync(path.resolve(process.cwd(), 'main/src/bootstrap/registerIpc.js'), 'utf8')

    expect(source).toContain("require('../services/qiuAiLicensePlatformClientService')")
    expect(source).toContain("require('../services/selectionCacheService')")
    expect(source).toContain("require('../services/cloudGenerationService')")
    expect(source).toContain('const remoteLicensePlatformClient = createQiuAiLicensePlatformClientService({')
    expect(source).toContain('const selectionCacheService = createSelectionCacheService({')
    expect(source).toContain('const cloudGenerationService = createCloudGenerationService({')
    expect(source).toContain('generateImageResults: cloudGenerationService.generateImageResults')
    expect(source).toContain('generateTextResults: cloudGenerationService.generateTextResults')
    expect(source).toContain('generateVideoResults: cloudGenerationService.generateVideoResults')
    expect(source).toContain('registerSelectionIpc({')
    expect(source).toContain('selectionCacheService')
  })
})
