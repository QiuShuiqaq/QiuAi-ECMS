const Store = require('electron-store')
const registerSettingsIpc = require('../ipc/settingsIpc')
const registerDrawIpc = require('../ipc/drawIpc')
const registerLicenseIpc = require('../ipc/licenseIpc')
const registerPromptIpc = require('../ipc/promptIpc')
const registerTaskIpc = require('../ipc/taskIpc')
const registerStudioIpc = require('../ipc/studioIpc')
const { createDeviceFingerprintService } = require('../services/deviceFingerprintService')
const { createAuthorizationService } = require('../services/authorizationService')
const { createLicenseService } = require('../services/licenseService')
const { createQiuAiLicensePlatformClientService } = require('../services/qiuAiLicensePlatformClientService')
const { LICENSE_PUBLIC_KEY } = require('../services/licensePublicKey')
const { createActivationGuardService } = require('../services/activationGuardService')
const { createSettingsStoreService } = require('../services/settingsStoreService')
const { createApiKeyCreditService } = require('../services/apiKeyCreditService')
const { createDeepseekBalanceService } = require('../services/deepseekBalanceService')
const { createPromptTemplateStoreService } = require('../services/promptTemplateStoreService')
const { createLocalTaskStoreService } = require('../services/localTaskStoreService')
const { createStudioWorkspaceService } = require('../services/studioWorkspaceService')
const { createStudioImageGenerationService } = require('../services/studioImageGenerationService')
const { createStudioVideoGenerationService } = require('../services/studioVideoGenerationService')
const { createCopywritingGenerationService } = require('../services/copywritingGenerationService')
const { createCloudGenerationService } = require('../services/cloudGenerationService')
const { createStudioTaskManagerService } = require('../services/studioTaskManagerService')
const { createTaskModeService } = require('../services/taskModeService')
const { createTaskRunnerService } = require('../services/taskRunnerService')
const { exportTaskDirectory } = require('../services/taskExportService')
const { createDataTraceService } = require('../services/dataTraceService')
const { attachConsoleCapture } = require('../services/consoleCaptureService')
const { ensureDataLayout } = require('../services/dataPathsService')
const { getMimeTypeFromPath } = require('../services/localInputAssetService')

function registerIpc() {
  ensureDataLayout().catch(() => {})
  const settingsStore = new Store({ name: 'qiuai-settings' })
  const promptStore = new Store({ name: 'qiuai-prompts' })
  const taskStore = new Store({ name: 'qiuai-tasks' })
  const studioStore = new Store({ name: 'qiuai-studio' })
  const dataTraceService = createDataTraceService()
  attachConsoleCapture({
    runtimeLogger: dataTraceService
  })
  const deviceFingerprintService = createDeviceFingerprintService()
  const settingsService = createSettingsStoreService({ store: settingsStore })
  const apiKeyCreditService = createApiKeyCreditService({
    settingsService,
    messageRecorder: dataTraceService,
    requestMetricRecorder: async () => {}
  })
  const deepseekBalanceService = createDeepseekBalanceService({
    settingsService,
    messageRecorder: dataTraceService,
    requestMetricRecorder: async () => {}
  })
  const licenseService = createLicenseService({
    publicKey: LICENSE_PUBLIC_KEY,
    getDeviceCode: () => deviceFingerprintService.getDeviceCode()
  })
  const remoteLicensePlatformClient = createQiuAiLicensePlatformClientService({
    baseUrl: settingsService.getSettings().authPlatform.baseUrl
  })
  const authorizationService = createAuthorizationService({
    legacyLicenseService: licenseService,
    remoteLicensePlatformClient,
    settingsService,
    getRemoteConfig: () => settingsService.getSettings().authPlatform,
    getDeviceCode: () => deviceFingerprintService.getDeviceCode()
  })
  const activationGuard = createActivationGuardService({
    authorizationService
  })
  const promptTemplateService = createPromptTemplateStoreService({ store: promptStore })
  const localTaskStoreService = createLocalTaskStoreService({ store: taskStore })
  const studioTaskManagerService = createStudioTaskManagerService()
  const localStudioImageGenerationService = createStudioImageGenerationService({
    settingsService,
    promptTemplateService,
    messageRecorder: dataTraceService,
    runtimeLogger: dataTraceService,
    requestMetricRecorder: async () => {}
  })
  const localStudioVideoGenerationService = createStudioVideoGenerationService({
    settingsService,
    messageRecorder: dataTraceService,
    runtimeLogger: dataTraceService,
    requestMetricRecorder: async () => {}
  })
  const localCopywritingGenerationService = createCopywritingGenerationService({
    settingsService,
    messageRecorder: dataTraceService
  })
  const cloudGenerationService = createCloudGenerationService({
    settingsService,
    remoteLicensePlatformClient,
    getMimeTypeFromPath,
    localGenerateImageResults: localStudioImageGenerationService.generateImageResults,
    localGenerateVideoResults: localStudioVideoGenerationService.generateVideoResults,
    localGenerateCopywritingResults: localCopywritingGenerationService.generateCopywritingResults
  })
  const studioWorkspaceService = createStudioWorkspaceService({
    store: studioStore,
    settingsService,
    authorizationService,
    apiKeyCreditService,
    deepseekBalanceService,
    promptTemplateService,
    remoteLicensePlatformClient,
    messageRecorder: dataTraceService,
    runtimeLogger: dataTraceService,
    generateImageResults: cloudGenerationService.generateImageResults,
    generateCopywritingResults: cloudGenerationService.generateCopywritingResults,
    generateVideoResults: cloudGenerationService.generateVideoResults,
    taskManagerService: studioTaskManagerService
  })
  const taskModeService = createTaskModeService()
  const taskRunnerService = createTaskRunnerService({
    localTaskStoreService,
    runtimeLogger: dataTraceService
  })

  registerSettingsIpc({ settingsService })
  registerLicenseIpc({
    authorizationService,
    remoteLicensePlatformClient,
    settingsService
  })
  registerDrawIpc({
    settingsService,
    messageRecorder: dataTraceService,
    runtimeLogger: dataTraceService,
    activationGuard
  })
  registerPromptIpc({ promptTemplateService })
  registerTaskIpc({
    settingsService,
    promptTemplateService,
    localTaskStoreService,
    taskModeService,
    taskRunnerService,
    exportTaskDirectory,
    messageRecorder: dataTraceService,
    runtimeLogger: dataTraceService,
    activationGuard
  })
  registerStudioIpc({
    studioWorkspaceService,
    settingsService,
    dataTraceService,
    activationGuard
  })

  return {
    authorizationService,
    licenseService,
    remoteLicensePlatformClient,
    studioTaskManagerService,
    studioWorkspaceService,
    taskRunnerService
  }
}

module.exports = registerIpc
