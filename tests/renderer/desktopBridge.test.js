import { beforeEach, describe, expect, it, vi } from 'vitest'
import { isProxy, reactive } from 'vue'

describe('desktopBridge', () => {
  beforeEach(() => {
    vi.resetModules()
    global.window = {}
  })

  it('falls back to browser storage for settings and keeps current upload directories isolated', async () => {
    const storage = new Map()
    window.localStorage = {
      getItem(key) {
        return storage.has(key) ? storage.get(key) : null
      },
      setItem(key, value) {
        storage.set(key, value)
      }
    }

    const { getSettings, saveSettings } = await import('../../renderer/src/services/desktopBridge.js')

    await saveSettings({
      uploadDirectories: {
        workspace: 'E:/QiuAi/Input/Workspace'
      }
    })

    const loaded = await getSettings()

    expect(loaded.uploadDirectories.workspace).toBe('E:/QiuAi/Input/Workspace')
    expect(loaded.uploadDirectories['series-generate']).toBe('')
    expect(loaded.dashboardCreditState).toMatchObject({
      text: { balanceCny: 0 },
      image: { totalCredits: 0, remainingCredits: 0 },
      video: { balanceCny: 0 }
    })
    expect(loaded.providerApiKeys).toMatchObject({
      general: '',
      deepseek: '',
      minimax: ''
    })
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

  it('invokes provider api key save through the dedicated settings channel', async () => {
    const invoke = vi.fn().mockResolvedValue({ ok: true })

    window.qiuai = {
      channels: {
        SETTINGS_SAVE_PROVIDER_API_KEYS: 'settings:save-provider-api-keys'
      },
      invoke
    }

    const { saveProviderApiKeys } = await import('../../renderer/src/services/desktopBridge.js')

    await saveProviderApiKeys({
      textApiKey: 'sk-text',
      imageApiKey: 'sk-image',
      videoApiKey: 'sk-video'
    })

    expect(invoke).toHaveBeenCalledWith('settings:save-provider-api-keys', {
      textApiKey: 'sk-text',
      imageApiKey: 'sk-image',
      videoApiKey: 'sk-video'
    })
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
})
