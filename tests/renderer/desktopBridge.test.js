import { beforeEach, describe, expect, it, vi } from 'vitest'
import { isProxy, reactive } from 'vue'

describe('desktopBridge', () => {
  beforeEach(() => {
    vi.resetModules()
    global.window = {}
  })

  it('falls back to browser studio snapshot storage with a reduced settings summary', async () => {
    const storage = new Map()
    window.localStorage = {
      getItem(key) {
        return storage.has(key) ? storage.get(key) : null
      },
      setItem(key, value) {
        storage.set(key, value)
      }
    }

    const { getStudioSnapshot, saveStudioDraft } = await import('../../renderer/src/services/desktopBridge.js')

    await saveStudioDraft({
      menuKey: 'workspace',
      patch: {
        productName: 'Desk Lamp'
      }
    })

    const loaded = await getStudioSnapshot()

    expect(loaded.formDrafts.workspace).toMatchObject({
      productName: 'Desk Lamp'
    })
    expect('themeMode' in loaded).toBe(false)
    expect(loaded.settingsSummary).toMatchObject({
      dashboardCreditState: {
        text: { balanceCny: 0 },
        image: { totalCredits: 0, remainingCredits: 0 },
        video: { balanceCny: 0 }
      },
      creditState: {
        remainingCredits: 0,
        frozenCredits: 0,
        usedCredits: 0
      }
    })
    const activationState = await getStudioSnapshot().then(() => null).catch(() => null)
    expect(activationState).toBeNull()
  })

  it('ignores browser draft writes for non-runtime menu pages', async () => {
    const storage = new Map()
    window.localStorage = {
      getItem(key) {
        return storage.has(key) ? storage.get(key) : null
      },
      setItem(key, value) {
        storage.set(key, value)
      }
    }

    const { getStudioSnapshot, saveStudioDraft } = await import('../../renderer/src/services/desktopBridge.js')

    const result = await saveStudioDraft({
      menuKey: 'purchase-center',
      patch: {
        unexpected: 'value'
      }
    })

    const loaded = await getStudioSnapshot()

    expect(result).toEqual({})
    expect(loaded.formDrafts['purchase-center']).toBeUndefined()
  })

  it('normalizes browser prompt template fallback and migrates legacy 文本 storage', async () => {
    const storage = new Map()
    storage.set('qiuai-browser-prompts', JSON.stringify([
      {
        id: 'text-temu',
        name: 'TEMU',
        category: '文本',
        prompt: '旧固定模板',
        source: 'system-fixed'
      },
      {
        id: 'legacy-custom',
        name: '旧自定义模板',
        category: '文本',
        prompt: '旧自定义内容',
        source: 'custom'
      }
    ]))
    window.localStorage = {
      getItem(key) {
        return storage.has(key) ? storage.get(key) : null
      },
      setItem(key, value) {
        storage.set(key, value)
      }
    }

    const { listPromptTemplates } = await import('../../renderer/src/services/desktopBridge.js')
    const templates = await listPromptTemplates()

    expect(templates.find((item) => item.id === 'title-default')?.category).toBe('标题')
    expect(templates.find((item) => item.id === 'description-default')?.category).toBe('描述')
    expect(templates.find((item) => item.id === 'title-temu')).toMatchObject({
      category: '标题',
      prompt: '旧固定模板',
      source: 'system-fixed'
    })
    expect(templates.find((item) => item.id === 'description-temu')).toMatchObject({
      category: '描述',
      prompt: '旧固定模板',
      source: 'system-fixed'
    })
    expect(templates.find((item) => item.id === 'legacy-custom-title')).toMatchObject({
      category: '标题',
      prompt: '旧自定义内容',
      source: 'custom'
    })
    expect(templates.find((item) => item.id === 'legacy-custom-description')).toMatchObject({
      category: '描述',
      prompt: '旧自定义内容',
      source: 'custom'
    })
    expect(templates.some((item) => item.category === '文本')).toBe(false)
  })

  it('serializes reactive studio draft payloads before invoking the bridge', async () => {
    const invoke = vi.fn().mockResolvedValue({ ok: true })

    window.qiuai = {
      channels: {
        STUDIO_SAVE_DRAFT: 'studio:save-draft'
      },
      invoke
    }

    const { saveStudioDraft } = await import('../../renderer/src/services/desktopBridge.js')
    const patch = reactive({
      promptAssignments: [
        {
          id: 'series-1',
          prompt: '统一风格',
          imageType: '商品主图',
          batchPrompts: ['统一风格']
        }
      ]
    })

    await saveStudioDraft({
      menuKey: 'series-generate',
      patch
    })

    const payload = invoke.mock.calls[0][1]
    expect(invoke.mock.calls[0][0]).toBe('studio:save-draft')
    expect(payload.menuKey).toBe('series-generate')
    expect(payload.patch).toEqual({
      promptAssignments: [
        {
          id: 'series-1',
          prompt: '统一风格',
          imageType: '商品主图',
          batchPrompts: ['统一风格']
        }
      ]
    })
    expect(isProxy(payload.patch)).toBe(false)
  })

  it('invokes current studio bridge channels for project and runtime actions', async () => {
    const invoke = vi.fn()
      .mockResolvedValueOnce({ id: 'project-1' })
      .mockResolvedValueOnce({ ok: true })
      .mockResolvedValueOnce({ ok: true })

    window.qiuai = {
      channels: {
        STUDIO_CREATE_PROJECT: 'studio:create-project',
        STUDIO_PICK_INPUT_ASSETS: 'studio:pick-input-assets',
        STUDIO_CLEAR_RUNTIME_STATE: 'studio:clear-runtime-state'
      },
      invoke
    }

    const {
      createStudioProject,
      pickStudioInputAssets,
      clearStudioRuntimeState
    } = await import('../../renderer/src/services/desktopBridge.js')

    await createStudioProject({
      productName: '露营灯'
    })
    await pickStudioInputAssets({
      menuKey: 'workspace',
      allowMultiple: true
    })
    await clearStudioRuntimeState()

    expect(invoke).toHaveBeenNthCalledWith(1, 'studio:create-project', {
      productName: '露营灯'
    })
    expect(invoke).toHaveBeenNthCalledWith(2, 'studio:pick-input-assets', {
      menuKey: 'workspace',
      allowMultiple: true
    })
    expect(invoke).toHaveBeenNthCalledWith(3, 'studio:clear-runtime-state', undefined)
  })

  it('invokes remote activation and recharge channels through the desktop bridge', async () => {
    const invoke = vi.fn()
      .mockResolvedValueOnce({ status: 'activated', sessionToken: 'session-1' })
      .mockResolvedValueOnce({ id: 'order-1', status: 'pending' })
      .mockResolvedValueOnce({ id: 'order-1', status: 'paid' })

    window.qiuai = {
      channels: {
        LICENSE_REMOTE_ACTIVATE: 'license:remote-activate',
        RECHARGE_CREATE_ORDER: 'recharge:create-order',
        RECHARGE_GET_ORDER: 'recharge:get-order'
      },
      invoke
    }

    const {
      activateRemoteLicense,
      createRechargeOrder,
      getRechargeOrder
    } = await import('../../renderer/src/services/desktopBridge.js')

    await activateRemoteLicense({
      customerName: '张三',
      contact: '13800138000',
      inviteCode: 'QAI8888'
    })
    await createRechargeOrder({
      walletType: 'image',
      channel: 'alipay',
      amountCny: 100
    })
    await getRechargeOrder({
      id: 'order-1'
    })

    expect(invoke).toHaveBeenNthCalledWith(1, 'license:remote-activate', {
      customerName: '张三',
      contact: '13800138000',
      inviteCode: 'QAI8888'
    })
    expect(invoke).toHaveBeenNthCalledWith(2, 'recharge:create-order', {
      walletType: 'image',
      channel: 'alipay',
      amountCny: 100
    })
    expect(invoke).toHaveBeenNthCalledWith(3, 'recharge:get-order', {
      id: 'order-1'
    })
  })

  it('fails fast for activation and commerce actions when the desktop bridge is unavailable', async () => {
    const {
      getActivationStatus,
      activateRemoteLicense,
      listSoftwarePackages,
      createRechargeOrder
    } = await import('../../renderer/src/services/desktopBridge.js')

    await expect(getActivationStatus()).resolves.toMatchObject({
      status: 'not_logged_in',
      canUseApp: false,
      remoteStatus: 'bridge_unavailable'
    })
    await expect(activateRemoteLicense({
      customerName: 'Test'
    })).rejects.toThrow('QiuAi desktop bridge is unavailable.')
    await expect(listSoftwarePackages()).rejects.toThrow('QiuAi desktop bridge is unavailable.')
    await expect(createRechargeOrder({
      walletType: 'image',
      amountCny: 100
    })).rejects.toThrow('QiuAi desktop bridge is unavailable.')
  })

  it('does not expose dead desktop bridge helpers from the removed shell flows', async () => {
    const desktopBridge = await import('../../renderer/src/services/desktopBridge.js')

    expect('saveProviderApiKeys' in desktopBridge).toBe(false)
    expect('createProjectsFromAssets' in desktopBridge).toBe(false)
    expect('refreshDashboardCredits' in desktopBridge).toBe(false)
    expect('deleteStudioExportItem' in desktopBridge).toBe(false)
    expect('importLicenseFile' in desktopBridge).toBe(false)
    expect('reloadActivation' in desktopBridge).toBe(false)
  })

  it('exposes publish bridge helpers for the new publish-center flow', async () => {
    const desktopBridge = await import('../../renderer/src/services/desktopBridge.js')

    expect(typeof desktopBridge.listPublishChannelAccounts).toBe('function')
    expect(typeof desktopBridge.upsertPublishDraft).toBe('function')
    expect(typeof desktopBridge.getPublishDraft).toBe('function')
    expect(typeof desktopBridge.getPublishDraftPreview).toBe('function')
    expect(typeof desktopBridge.createPublishTask).toBe('function')
    expect(typeof desktopBridge.getPublishTask).toBe('function')
    expect(typeof desktopBridge.retryPublishTask).toBe('function')
  })
})
