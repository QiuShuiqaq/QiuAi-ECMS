import { describe, expect, it } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'

describe('activation guard source', () => {
  it('uses local agreement acceptance records instead of a remote agreement check', () => {
    const source = fs.readFileSync(
      path.resolve(process.cwd(), 'main/src/services/activationGuardService.js'),
      'utf8'
    )

    expect(source).toContain("require('./userAgreementService')")
    expect(source).toContain('isAgreementAcceptedForActivation')
    expect(source).not.toContain('remoteLicensePlatformClient.getUserAgreementStatus')
  })
})
