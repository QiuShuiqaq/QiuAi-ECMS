import { describe, expect, it } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'

describe('publishIpc source', () => {
  it('registers publish-center IPC handlers through the desktop publish draft service', () => {
    const source = fs.readFileSync(path.resolve(process.cwd(), 'main/src/ipc/publishIpc.js'), 'utf8')
    const channelSource = fs.readFileSync(path.resolve(process.cwd(), 'shared/ipcChannels.js'), 'utf8')

    expect(channelSource).toContain("PUBLISH_GET_CONFIG: 'publish:get-config'")
    expect(channelSource).toContain("PUBLISH_LIST_CHANNEL_ACCOUNTS: 'publish:list-channel-accounts'")
    expect(channelSource).toContain("PUBLISH_UPSERT_DRAFT: 'publish:upsert-draft'")
    expect(channelSource).toContain("PUBLISH_GET_DRAFT: 'publish:get-draft'")
    expect(channelSource).toContain("PUBLISH_GET_DRAFT_PREVIEW: 'publish:get-draft-preview'")
    expect(channelSource).toContain("PUBLISH_CREATE_TASK: 'publish:create-task'")
    expect(channelSource).toContain("PUBLISH_GET_TASK: 'publish:get-task'")
    expect(channelSource).toContain("PUBLISH_RETRY_TASK: 'publish:retry-task'")

    expect(source).toContain('ipcMain.handle(ipcChannels.PUBLISH_GET_CONFIG')
    expect(source).toContain('return publishDraftService.getConfig(payload)')
    expect(source).toContain('ipcMain.handle(ipcChannels.PUBLISH_LIST_CHANNEL_ACCOUNTS')
    expect(source).toContain('return publishDraftService.listChannelAccounts(payload)')
    expect(source).toContain('ipcMain.handle(ipcChannels.PUBLISH_UPSERT_DRAFT')
    expect(source).toContain('return publishDraftService.upsertDraft(payload)')
    expect(source).toContain('ipcMain.handle(ipcChannels.PUBLISH_GET_DRAFT')
    expect(source).toContain('return publishDraftService.getDraft(payload)')
    expect(source).toContain('ipcMain.handle(ipcChannels.PUBLISH_GET_DRAFT_PREVIEW')
    expect(source).toContain('return publishDraftService.getDraftPreview(payload)')
    expect(source).toContain('ipcMain.handle(ipcChannels.PUBLISH_CREATE_TASK')
    expect(source).toContain('return publishDraftService.createTask(payload)')
    expect(source).toContain('ipcMain.handle(ipcChannels.PUBLISH_GET_TASK')
    expect(source).toContain('return publishDraftService.getTask(payload)')
    expect(source).toContain('ipcMain.handle(ipcChannels.PUBLISH_RETRY_TASK')
    expect(source).toContain('return publishDraftService.retryTask(payload)')
  })
})
