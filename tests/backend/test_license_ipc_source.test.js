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
    expect(channelsSource).toContain('LICENSE_REMOTE_ACTIVATE')
    expect(channelsSource).toContain('LICENSE_GET_USER_AGREEMENT_STATUS')
    expect(channelsSource).toContain('LICENSE_ACCEPT_USER_AGREEMENT')
    expect(channelsSource).toContain('SELECTION_GET_MANIFEST')
    expect(channelsSource).toContain('SELECTION_LIST_ITEMS')
    expect(channelsSource).toContain('RECHARGE_CREATE_ORDER')
    expect(channelsSource).toContain('RECHARGE_GET_ORDER')
    expect(preloadSource).toContain('LICENSE_GET_STATUS')
    expect(preloadSource).toContain('LICENSE_GET_DEVICE_CODE')
    expect(preloadSource).toContain('LICENSE_REMOTE_ACTIVATE')
    expect(preloadSource).toContain('LICENSE_GET_USER_AGREEMENT_STATUS')
    expect(preloadSource).toContain('LICENSE_ACCEPT_USER_AGREEMENT')
    expect(preloadSource).toContain('SELECTION_GET_MANIFEST')
    expect(preloadSource).toContain('SELECTION_LIST_ITEMS')
    expect(preloadSource).toContain('RECHARGE_CREATE_ORDER')
    expect(preloadSource).toContain('RECHARGE_GET_ORDER')
    expect(registerSource).toContain("require('../ipc/licenseIpc')")
    expect(registerSource).toContain("require('../ipc/selectionIpc')")
    expect(registerSource).toContain('registerLicenseIpc(')
    expect(registerSource).toContain('registerSelectionIpc(')
    expect(registerSource).toContain('remoteLicensePlatformClient')
    expect(registerSource).toContain('settingsService')
    expect(registerSource).not.toContain('createLicenseService')
  })

  it('keeps session checks for compute and recharge commerce while software orders can bootstrap before activation', () => {
    const licenseIpcSource = fs.readFileSync(path.resolve(process.cwd(), 'main/src/ipc/licenseIpc.js'), 'utf8')

    expect(licenseIpcSource).toContain('async function requireSessionToken(settingsService)')
    expect(licenseIpcSource).toContain('async function getUserAgreementStatus({ authorizationService, settingsService })')
    expect(licenseIpcSource).toContain("error.code = 'REMOTE_AUTH_REQUIRED'")
    expect(licenseIpcSource).toContain('Remote authorization is required before using commerce features.')
    expect(licenseIpcSource).toContain('const sessionToken = await requireSessionToken(settingsService)')
    expect(licenseIpcSource).toContain('async function buildSoftwareOrderPayload')
    expect(licenseIpcSource).toContain('LICENSE_GET_USER_AGREEMENT_STATUS')
    expect(licenseIpcSource).toContain('LICENSE_ACCEPT_USER_AGREEMENT')
    expect(licenseIpcSource).toContain('createAcceptedAgreementRecord')
    expect(licenseIpcSource).not.toContain('const sessionToken = await requireSessionToken(settingsService)\n    return remoteLicensePlatformClient.createSoftwareOrder')
    expect(licenseIpcSource).not.toContain('const { dialog, ipcMain } = require(\'electron\')')
  })
})
