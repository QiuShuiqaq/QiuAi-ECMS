import { describe, expect, it } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'

describe('activation guard source', () => {
  it('checks activation before studio task creation and project creation', () => {
    const studioSource = fs.readFileSync(path.resolve(process.cwd(), 'main/src/ipc/studioIpc.js'), 'utf8')

    expect(studioSource).toContain('activationGuard')
    expect(studioSource).toContain('assertActivated')
    expect(studioSource).toContain('STUDIO_CREATE_PROJECT')
    expect(studioSource).toContain('STUDIO_CREATE_TASK')
  })
})
