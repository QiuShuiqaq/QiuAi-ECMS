const crypto = require('node:crypto')
const fs = require('node:fs/promises')
const path = require('node:path')

function getDefaultUserDataPath() {
  try {
    const { app } = require('electron')
    if (app && typeof app.getPath === 'function') {
      return app.getPath('userData')
    }
  } catch {
    // Electron not available in tests.
  }

  return process.cwd()
}

function getLicenseStoragePaths(userDataPath = getDefaultUserDataPath()) {
  const licenseDirectoryPath = path.resolve(userDataPath, 'license')
  return {
    licenseDirectoryPath,
    licenseFilePath: path.resolve(licenseDirectoryPath, 'license.qai')
  }
}

function getLicensePayload(record = {}) {
  const version = Number(record.version) || 1

  if (version <= 1) {
    return {
      version,
      customerName: record.customerName,
      deviceCode: record.deviceCode,
      activatedAt: record.activatedAt
    }
  }

  return {
    version,
    product: record.product,
    licenseId: record.licenseId,
    customerId: record.customerId,
    customerName: record.customerName,
    edition: record.edition,
    deviceCode: record.deviceCode,
    activatedAt: record.activatedAt,
    expireAt: record.expireAt,
    maxVersion: record.maxVersion,
    modules: Array.isArray(record.modules) ? record.modules : [],
    features: Array.isArray(record.features) ? record.features : [],
    remark: record.remark
  }
}

function createSignedLicenseRecord(payload, privateKey) {
  const version = Number(payload.version) || 1
  const normalizedPayload = version <= 1
    ? {
        version,
        customerName: String(payload.customerName || '').trim(),
        deviceCode: String(payload.deviceCode || '').trim(),
        activatedAt: String(payload.activatedAt || new Date().toISOString())
      }
    : {
        version,
        product: String(payload.product || 'QiuAi-ECMS').trim(),
        licenseId: String(payload.licenseId || '').trim(),
        customerId: String(payload.customerId || '').trim(),
        customerName: String(payload.customerName || '').trim(),
        edition: String(payload.edition || 'standard').trim(),
        deviceCode: String(payload.deviceCode || '').trim(),
        activatedAt: String(payload.activatedAt || new Date().toISOString()),
        expireAt: String(payload.expireAt || '').trim(),
        maxVersion: String(payload.maxVersion || '').trim(),
        modules: Array.isArray(payload.modules) ? payload.modules.map((item) => String(item || '').trim()).filter(Boolean) : [],
        features: Array.isArray(payload.features) ? payload.features.map((item) => String(item || '').trim()).filter(Boolean) : [],
        remark: String(payload.remark || '').trim()
      }
  const signature = crypto.sign(
    'sha256',
    Buffer.from(JSON.stringify(normalizedPayload)),
    privateKey
  ).toString('base64')

  return {
    ...normalizedPayload,
    signature
  }
}

function verifySignedLicenseRecord(record, publicKey) {
  const signature = typeof record.signature === 'string' ? record.signature.trim() : ''
  if (!signature) {
    return false
  }

  return crypto.verify(
    'sha256',
    Buffer.from(JSON.stringify(getLicensePayload(record))),
    publicKey,
    Buffer.from(signature, 'base64')
  )
}

function normalizeLicenseRecord(record = {}) {
  const version = Number(record.version) || 1

  return {
    version,
    product: String(record.product || 'QiuAi-ECMS').trim(),
    licenseId: String(record.licenseId || '').trim(),
    customerId: String(record.customerId || '').trim(),
    customerName: String(record.customerName || '').trim(),
    edition: String(record.edition || '').trim(),
    deviceCode: String(record.deviceCode || '').trim(),
    activatedAt: String(record.activatedAt || '').trim(),
    expireAt: String(record.expireAt || '').trim(),
    maxVersion: String(record.maxVersion || '').trim(),
    modules: Array.isArray(record.modules) ? record.modules.map((item) => String(item || '').trim()).filter(Boolean) : [],
    features: Array.isArray(record.features) ? record.features.map((item) => String(item || '').trim()).filter(Boolean) : [],
    remark: String(record.remark || '').trim(),
    signature: String(record.signature || '').trim()
  }
}

function createActivationStatus(status, overrides = {}) {
  return {
    status,
    product: 'QiuAi-ECMS',
    licenseId: '',
    customerId: '',
    customerName: '',
    edition: '',
    deviceCode: '',
    activatedAt: '',
    expireAt: '',
    maxVersion: '',
    modules: [],
    features: [],
    remark: '',
    licenseFilePath: '',
    message: '',
    ...overrides
  }
}

function createLicenseService({
  publicKey = '',
  getDeviceCode,
  readFile = fs.readFile,
  writeFile = fs.writeFile,
  ensureDirectory = (targetPath) => fs.mkdir(targetPath, { recursive: true }),
  licenseDirectoryPath = getLicenseStoragePaths().licenseDirectoryPath,
  licenseFilePath = getLicenseStoragePaths().licenseFilePath
} = {}) {
  if (typeof getDeviceCode !== 'function') {
    throw new Error('getDeviceCode is required.')
  }

  async function readStoredLicense(filePath = licenseFilePath) {
    const rawContent = await readFile(filePath, 'utf8')
    return JSON.parse(rawContent)
  }

  async function validateLicenseRecord(record) {
    const normalizedRecord = normalizeLicenseRecord(record)
    const currentDeviceCode = await getDeviceCode()
    const nowMs = Date.now()

    if (!normalizedRecord.customerName || !normalizedRecord.deviceCode || !normalizedRecord.activatedAt || !normalizedRecord.signature) {
      return createActivationStatus('invalid', {
        message: '授权文件已损坏或格式无效',
        deviceCode: currentDeviceCode,
        licenseFilePath
      })
    }

    try {
      const isValid = verifySignedLicenseRecord(normalizedRecord, publicKey)
      if (!isValid) {
        return createActivationStatus('invalid', {
          message: '授权校验失败，请重新导入授权文件',
          deviceCode: currentDeviceCode,
          licenseFilePath
        })
      }
    } catch {
      return createActivationStatus('invalid', {
        message: '授权校验失败，请重新导入授权文件',
        deviceCode: currentDeviceCode,
        licenseFilePath
      })
    }

    if (normalizedRecord.expireAt) {
      const expireMs = Date.parse(normalizedRecord.expireAt)
      if (Number.isFinite(expireMs) && expireMs < nowMs) {
        return createActivationStatus('expired', {
          product: normalizedRecord.product,
          licenseId: normalizedRecord.licenseId,
          customerId: normalizedRecord.customerId,
          customerName: normalizedRecord.customerName,
          edition: normalizedRecord.edition,
          deviceCode: currentDeviceCode,
          activatedAt: normalizedRecord.activatedAt,
          expireAt: normalizedRecord.expireAt,
          maxVersion: normalizedRecord.maxVersion,
          modules: normalizedRecord.modules,
          features: normalizedRecord.features,
          remark: normalizedRecord.remark,
          licenseFilePath,
          message: '当前授权已过期'
        })
      }
    }

    if (normalizedRecord.deviceCode !== currentDeviceCode) {
      return createActivationStatus('mismatch', {
        product: normalizedRecord.product,
        licenseId: normalizedRecord.licenseId,
        customerId: normalizedRecord.customerId,
        customerName: normalizedRecord.customerName,
        edition: normalizedRecord.edition,
        deviceCode: currentDeviceCode,
        activatedAt: normalizedRecord.activatedAt,
        expireAt: normalizedRecord.expireAt,
        maxVersion: normalizedRecord.maxVersion,
        modules: normalizedRecord.modules,
        features: normalizedRecord.features,
        remark: normalizedRecord.remark,
        licenseFilePath,
        message: '当前设备与授权不匹配'
      })
    }

    return createActivationStatus('activated', {
      product: normalizedRecord.product,
      licenseId: normalizedRecord.licenseId,
      customerId: normalizedRecord.customerId,
      customerName: normalizedRecord.customerName,
      edition: normalizedRecord.edition,
      deviceCode: currentDeviceCode,
      activatedAt: normalizedRecord.activatedAt,
      expireAt: normalizedRecord.expireAt,
      maxVersion: normalizedRecord.maxVersion,
      modules: normalizedRecord.modules,
      features: normalizedRecord.features,
      remark: normalizedRecord.remark,
      licenseFilePath,
      message: ''
    })
  }

  async function getActivationStatus() {
    try {
      const licenseRecord = await readStoredLicense()
      return validateLicenseRecord(licenseRecord)
    } catch (error) {
      if (error && (error.code === 'ENOENT' || /no such file/i.test(String(error.message || '')))) {
        return createActivationStatus('not_found', {
          deviceCode: await getDeviceCode(),
          licenseFilePath,
          message: '未检测到授权文件'
        })
      }

      if (error instanceof SyntaxError) {
        return createActivationStatus('invalid', {
          deviceCode: await getDeviceCode(),
          licenseFilePath,
          message: '授权文件已损坏或格式无效'
        })
      }

      return createActivationStatus('invalid', {
        deviceCode: await getDeviceCode(),
        licenseFilePath,
        message: '授权校验失败，请重新导入授权文件'
      })
    }
  }

  async function importLicenseFromFile({ filePath }) {
    if (!filePath) {
      throw new Error('License file path is required.')
    }

    const licenseRecord = await readStoredLicense(filePath)
    const activationStatus = await validateLicenseRecord(licenseRecord)

    if (activationStatus.status !== 'activated') {
      return activationStatus
    }

    await ensureDirectory(licenseDirectoryPath)
    await writeFile(licenseFilePath, JSON.stringify(licenseRecord, null, 2), 'utf8')

    return {
      ...activationStatus,
      message: '导入授权成功'
    }
  }

  async function getDeviceCodePayload() {
    return {
      product: 'QiuAi-ECMS',
      deviceCode: await getDeviceCode(),
      licenseFilePath
    }
  }

  return {
    getActivationStatus,
    getDeviceCodePayload,
    importLicenseFromFile,
    licenseDirectoryPath,
    licenseFilePath
  }
}

module.exports = {
  createLicenseService,
  createSignedLicenseRecord,
  getLicensePayload,
  getLicenseStoragePaths,
  normalizeLicenseRecord,
  verifySignedLicenseRecord
}
