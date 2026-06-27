const Store = require('electron-store')
const registerLicenseIpc = require('../ipc/licenseIpc')
const registerPromptIpc = require('../ipc/promptIpc')
const registerPublishIpc = require('../ipc/publishIpc')
const registerSelectionIpc = require('../ipc/selectionIpc')
const registerStudioIpc = require('../ipc/studioIpc')
const { createDeviceFingerprintService } = require('../services/deviceFingerprintService')
const { createAuthorizationService } = require('../services/authorizationService')
const { createQiuAiLicensePlatformClientService } = require('../services/qiuAiLicensePlatformClientService')
const { createSelectionCacheService } = require('../services/selectionCacheService')
const { createActivationGuardService } = require('../services/activationGuardService')
const { createSettingsStoreService } = require('../services/settingsStoreService')
const { createPromptTemplateStoreService } = require('../services/promptTemplateStoreService')
const { createPublishDraftService } = require('../services/publishDraftService')
const { createStudioWorkspaceService } = require('../services/studioWorkspaceService')
const { createCloudGenerationService } = require('../services/cloudGenerationService')
const { createStudioTaskManagerService } = require('../services/studioTaskManagerService')
const { createDataTraceService } = require('../services/dataTraceService')
const { attachConsoleCapture } = require('../services/consoleCaptureService')
const { ensureDataLayout } = require('../services/dataPathsService')
const { getMimeTypeFromPath } = require('../services/localInputAssetService')

function registerIpc() {
  ensureDataLayout().catch(() => {})
  const settingsStore = new Store({ name: 'qiuai-settings' })
  const promptStore = new Store({ name: 'qiuai-prompts' })
  const studioStore = new Store({ name: 'qiuai-studio' })
  const dataTraceService = createDataTraceService()
  attachConsoleCapture({
    runtimeLogger: dataTraceService
  })
  const deviceFingerprintService = createDeviceFingerprintService()
  const settingsService = createSettingsStoreService({ store: settingsStore })
  const remoteLicensePlatformClient = createQiuAiLicensePlatformClientService({
    getBaseUrl: () => settingsService.getSettings().authPlatform.baseUrl
  })
  const authorizationService = createAuthorizationService({
    remoteLicensePlatformClient,
    settingsService,
    getRemoteConfig: () => settingsService.getSettings().authPlatform,
    getDeviceCode: () => deviceFingerprintService.getDeviceCode()
  })
  const selectionCacheService = createSelectionCacheService({
    remoteLicensePlatformClient,
    getSessionToken: async () => settingsService.getSettings().authPlatform.sessionToken
  })
  const publishDraftService = createPublishDraftService({
    remoteLicensePlatformClient,
    getSessionToken: async () => settingsService.getSettings().authPlatform.sessionToken,
    getStoredState: () => studioWorkspaceService.getRuntimeSnapshot()
  })
  const activationGuard = createActivationGuardService({
    authorizationService,
    settingsService
  })
  const promptTemplateService = createPromptTemplateStoreService({ store: promptStore })
  const studioTaskManagerService = createStudioTaskManagerService()
  const cloudGenerationService = createCloudGenerationService({
    settingsService,
    remoteLicensePlatformClient,
    getMimeTypeFromPath
  })
  const studioWorkspaceService = createStudioWorkspaceService({
    store: studioStore,
    settingsService,
    authorizationService,
    promptTemplateService,
    remoteLicensePlatformClient,
    messageRecorder: dataTraceService,
    runtimeLogger: dataTraceService,
    generateImageResults: cloudGenerationService.generateImageResults,
    generateTextResults: cloudGenerationService.generateTextResults,
    generateVideoResults: cloudGenerationService.generateVideoResults,
    taskManagerService: studioTaskManagerService
  })

  registerLicenseIpc({
    authorizationService,
    remoteLicensePlatformClient,
    settingsService
  })
  registerPromptIpc({ promptTemplateService })
  registerPublishIpc({
    publishDraftService
  })
  registerSelectionIpc({
    selectionCacheService
  })
  registerStudioIpc({
    studioWorkspaceService,
    settingsService,
    dataTraceService,
    activationGuard
  })

  return {
    authorizationService,
    remoteLicensePlatformClient,
    studioTaskManagerService,
    studioWorkspaceService
  }
}

module.exports = registerIpc
