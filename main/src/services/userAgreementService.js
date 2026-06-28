const USER_AGREEMENT_VERSION = 'QIUAI-ECMS-USER-NOTICE-v4.0'

function normalizeAgreementRecord(record = {}) {
  const source = record && typeof record === 'object' ? record : {}

  return {
    version: typeof source.version === 'string' ? source.version.trim() : '',
    title: typeof source.title === 'string' ? source.title.trim() : '',
    accepted: source.accepted === true,
    acceptedAt: typeof source.acceptedAt === 'string' ? source.acceptedAt : '',
    userId: typeof source.userId === 'string' ? source.userId.trim() : '',
    licenseId: typeof source.licenseId === 'string' ? source.licenseId.trim() : '',
    deviceCode: typeof source.deviceCode === 'string' ? source.deviceCode.trim() : '',
    source: typeof source.source === 'string' ? source.source.trim() : ''
  }
}

function normalizeCompliance(rawCompliance = {}) {
  const source = rawCompliance && typeof rawCompliance === 'object' ? rawCompliance : {}

  return {
    userAgreement: normalizeAgreementRecord(source.userAgreement)
  }
}

function isAgreementAcceptedForActivation(agreementRecord = {}, activationStatus = {}) {
  const normalizedRecord = normalizeAgreementRecord(agreementRecord)
  const userId = String(activationStatus?.userId || '').trim()
  const licenseId = String(activationStatus?.licenseId || '').trim()
  const deviceCode = String(activationStatus?.deviceCode || '').trim()

  return Boolean(
    normalizedRecord.accepted &&
    normalizedRecord.version === USER_AGREEMENT_VERSION &&
    userId &&
    licenseId &&
    normalizedRecord.userId === userId &&
    normalizedRecord.licenseId === licenseId &&
    normalizedRecord.deviceCode === deviceCode
  )
}

function buildUserAgreementState(agreementRecord = {}, activationStatus = {}) {
  const normalizedRecord = normalizeAgreementRecord(agreementRecord)
  const activated = activationStatus?.status === 'activated'
  const accepted = activated
    ? isAgreementAcceptedForActivation(normalizedRecord, activationStatus)
    : false

  return {
    version: USER_AGREEMENT_VERSION,
    title: normalizedRecord.title || '用户须知与使用协议暨责任认定书',
    accepted,
    acceptedAt: accepted ? normalizedRecord.acceptedAt : '',
    shouldShow: Boolean(activated && !accepted),
    userId: String(activationStatus?.userId || '').trim(),
    licenseId: String(activationStatus?.licenseId || '').trim(),
    deviceCode: String(activationStatus?.deviceCode || '').trim(),
    customerName: String(activationStatus?.customerName || '').trim(),
    source: normalizedRecord.source || 'DESKTOP_QIUAI'
  }
}

function createAcceptedAgreementRecord(activationStatus = {}, acceptedAt = new Date().toISOString()) {
  return {
    version: USER_AGREEMENT_VERSION,
    title: '用户须知与使用协议暨责任认定书',
    accepted: true,
    acceptedAt,
    userId: String(activationStatus?.userId || '').trim(),
    licenseId: String(activationStatus?.licenseId || '').trim(),
    deviceCode: String(activationStatus?.deviceCode || '').trim(),
    source: 'DESKTOP_QIUAI'
  }
}

module.exports = {
  USER_AGREEMENT_VERSION,
  normalizeAgreementRecord,
  normalizeCompliance,
  isAgreementAcceptedForActivation,
  buildUserAgreementState,
  createAcceptedAgreementRecord
}
