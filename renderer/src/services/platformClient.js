import {
  acceptUserAgreement,
  activateRemoteLicense,
  createComputePackageOrder,
  createPublishTask,
  createRechargeOrder,
  createSoftwareOrder,
  createStudioProject,
  createStudioTask,
  deleteStudioProject,
  exportStudioProjectBundle,
  exportStudioResults,
  getActivationStatus,
  getUserAgreementStatus,
  getComputePackageOrder,
  getPublishClientConfig,
  getPublishDraft,
  getPublishDraftPreview,
  getPublishTask,
  getRechargeOrder,
  getSelectionItemDetail,
  getSelectionManifest,
  getSoftwareOrder,
  getStudioRuntimeSnapshot,
  getStudioSnapshot,
  listComputePackages,
  listPromptTemplates,
  listPublishChannelAccounts,
  listSelectionItems,
  listSelectionPlatforms,
  listSelectionSites,
  listSoftwarePackages,
  openExternalResource,
  openOutputDirectory,
  pickStudioInputAssets,
  removePromptTemplate,
  retryPublishTask,
  savePromptTemplate,
  saveStudioDraft,
  upsertPublishDraft,
  updateStudioProject
} from './desktopBridge'

export const activationClient = {
  getStatus: getActivationStatus,
  activate: activateRemoteLicense
}

export const complianceClient = {
  getUserAgreementStatus,
  acceptUserAgreement
}

export const catalogClient = {
  listSoftwarePackages,
  listComputePackages
}

export const commerceClient = {
  createSoftwareOrder,
  getSoftwareOrder,
  createComputePackageOrder,
  getComputePackageOrder,
  createRechargeOrder,
  getRechargeOrder
}

export const selectionClient = {
  getManifest: getSelectionManifest,
  listPlatforms: listSelectionPlatforms,
  listSites: listSelectionSites,
  listItems: listSelectionItems,
  getItemDetail: getSelectionItemDetail
}

export const publishClient = {
  getConfig: getPublishClientConfig,
  listChannelAccounts: listPublishChannelAccounts,
  upsertDraft: upsertPublishDraft,
  getDraft: getPublishDraft,
  getDraftPreview: getPublishDraftPreview,
  createTask: createPublishTask,
  getTask: getPublishTask,
  retryTask: retryPublishTask
}

export const promptLibraryClient = {
  listTemplates: listPromptTemplates,
  saveTemplate: savePromptTemplate,
  removeTemplate: removePromptTemplate
}

export const workspaceClient = {
  getSnapshot: getStudioSnapshot,
  getRuntimeSnapshot: getStudioRuntimeSnapshot,
  saveDraft: saveStudioDraft,
  createProject: createStudioProject,
  updateProject: updateStudioProject,
  deleteProject: deleteStudioProject,
  createTask: createStudioTask,
  pickInputAssets: pickStudioInputAssets,
  exportResults: exportStudioResults,
  exportProjectBundle: exportStudioProjectBundle
}

export const shellClient = {
  openOutputDirectory,
  openExternalResource
}
