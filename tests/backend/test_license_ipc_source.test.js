import { describe, expect, it } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'

describe('license ipc source', () => {
  it('defines license channels and registers a license IPC module', () => {
    const channelsSource = fs.readFileSync(path.resolve(process.cwd(), 'shared/ipcChannels.js'), 'utf8')
    const preloadSource = fs.readFileSync(path.resolve(process.cwd(), 'main/preload.js'), 'utf8')
    const registerSource = fs.readFileSync(path.resolve(process.cwd(), 'main/src/bootstrap/registerIpc.js'), 'utf8')

    expect(channelsSource).toContain('LICENSE_GET_STATUS')
    expect(channelsSource).toContain('LICENSE_GET_DEVICE_CODE')
    expect(channelsSource).toContain('LICENSE_IMPORT_FILE')
    expect(channelsSource).toContain('LICENSE_REFRESH')
    expect(channelsSource).toContain('LICENSE_REMOTE_ACTIVATE')
    expect(channelsSource).toContain('RECHARGE_CREATE_ORDER')
    expect(channelsSource).toContain('RECHARGE_GET_ORDER')
    expect(preloadSource).toContain('LICENSE_GET_STATUS')
    expect(preloadSource).toContain('LICENSE_IMPORT_FILE')
    expect(preloadSource).toContain('LICENSE_REMOTE_ACTIVATE')
    expect(preloadSource).toContain('RECHARGE_CREATE_ORDER')
    expect(preloadSource).toContain('RECHARGE_GET_ORDER')
    expect(registerSource).toContain("require('../ipc/licenseIpc')")
    expect(registerSource).toContain('registerLicenseIpc(')
    expect(registerSource).toContain('remoteLicensePlatformClient')
    expect(registerSource).toContain('settingsService')
  })
})
