const { createHttpClientService } = require('./httpClientService')
const { createChatCompletion } = require('./chatCompletionService')
const { toDataUrl, getMimeTypeFromPath } = require('./localInputAssetService')

const COPYWRITING_TIMEOUT_MS = 120000
const DEFAULT_COPYWRITING_API_BASE_URL = 'https://open.bigmodel.cn/api/paas/v4'
const DEFAULT_COPYWRITING_REQUEST_PATH = '/chat/completions'
const DEFAULT_COPYWRITING_MODEL = 'GLM-4.7-Flash'

function getReferenceImagePaths(draft = {}) {
  return Array.isArray(draft.referenceImages)
    ? draft.referenceImages
      .map((item) => item.storedPath || item.path || '')
      .filter(Boolean)
    : []
}

function buildSystemPrompt() {
  return [
    '你是资深中文电商文案助手。',
    '你只返回最终可直接使用的内容，不要解释，不要加引号，不要输出多余前缀。',
    '你必须严格按每组“标题 + 详情”的结构输出。'
  ].join('')
}

function resolveQuantity(draft = {}) {
  return Math.max(1, Number(draft.quantity) || 1)
}

function buildUserPrompt(draft = {}) {
  const quantity = resolveQuantity(draft)

  return [
    `总体要求：${draft.prompt || '请结合输入生成内容'}`,
    `请一次性输出 ${quantity} 条可直接使用的中文文案结果。`,
    '输出要求：',
    '1. 每组结果必须严格包含两行，第一行以“标题：”开头，第二行以“详情：”或“描述：”开头。',
    '2. 每组结果之间必须用单独一行“---”分隔。',
    '3. 不要编号，不要解释，不要 Markdown，不要输出除标题、详情、描述、分隔线以外的任何内容。'
  ].join('\n')
}

function normalizeLabelLine(line = '', labels = []) {
  const source = String(line || '').trim()

  for (const label of labels) {
    const matcher = new RegExp(`^${label}[：:]?\\s*`, 'i')
    if (matcher.test(source)) {
      return source.replace(matcher, '').trim()
    }
  }

  return source
}

function normalizeResultGroups(rawContent = '') {
  const normalized = String(rawContent || '').trim()
  if (!normalized) {
    return []
  }

  const chunks = normalized
    .split(/\n\s*---\s*\n/g)
    .map((item) => item.trim())
    .filter(Boolean)

  return chunks.map((chunk, index) => {
    const lines = chunk
      .split(/\r?\n/)
      .map((item) => item.trim())
      .filter(Boolean)

    const titleLine = lines.find((item) => /^(标题|title)[：:]/i.test(item)) || lines[0] || ''
    const descriptionLines = lines.filter((item, lineIndex) => {
      if (/^(描述|详情|description)[：:]/i.test(item)) {
        return true
      }

      return lineIndex > 0 && item !== titleLine
    })

    const title = normalizeLabelLine(titleLine, ['标题', 'title'])
    const description = normalizeLabelLine(descriptionLines.join('\n'), ['详情', '描述', 'description']) || title

    return {
      id: `group-${index + 1}`,
      title,
      description,
      content: [title ? `标题：${title}` : '', description ? `详情：${description}` : ''].filter(Boolean).join('\n')
    }
  }).filter((item) => item.title || item.description)
}

async function createReferenceImageContentParts(draft = {}, {
  toDataUrlDependency = toDataUrl,
  getMimeTypeFromPathDependency = getMimeTypeFromPath
} = {}) {
  const imagePaths = getReferenceImagePaths(draft)
  const contentParts = []

  for (const imagePath of imagePaths) {
    const dataUrl = await toDataUrlDependency({
      filePath: imagePath,
      mimeType: getMimeTypeFromPathDependency(imagePath)
    })
    contentParts.push({
      type: 'image_url',
      image_url: {
        url: dataUrl
      }
    })
  }

  return contentParts
}

function resolveDefaultAdminApiKey(settings = {}) {
  if (typeof settings.apiKey === 'string' && settings.apiKey.trim()) {
    return settings.apiKey.trim()
  }

  const activeIndex = Number.isInteger(settings.activeApiKeyIndex) ? settings.activeApiKeyIndex : 0
  const apiKey = Array.isArray(settings.apiKeys) ? settings.apiKeys[activeIndex] : ''
  return typeof apiKey === 'string' ? apiKey.trim() : ''
}

function resolveModel(draft = {}) {
  return typeof draft.model === 'string' && draft.model.trim()
    ? draft.model.trim()
    : DEFAULT_COPYWRITING_MODEL
}

function isGlmModel(model = '') {
  return String(model || '').trim().toLowerCase() === 'glm-4.7-flash'
}

function resolveApiKey(draft = {}, settings = {}) {
  const selectedModel = resolveModel(draft)
  if (isGlmModel(selectedModel)) {
    return typeof settings.glmApiKey === 'string' && settings.glmApiKey.trim()
      ? settings.glmApiKey.trim()
      : ''
  }

  return resolveDefaultAdminApiKey(settings)
}

function resolveApiBaseUrl(draft = {}, settings = {}) {
  if (isGlmModel(resolveModel(draft))) {
    return draft.apiBaseUrl || settings.copywritingApiBaseUrl || DEFAULT_COPYWRITING_API_BASE_URL
  }

  return draft.apiBaseUrl || settings.apiBaseUrl || 'https://grsai.dakka.com.cn'
}

function resolveRequestPath(draft = {}, settings = {}) {
  if (isGlmModel(resolveModel(draft))) {
    return draft.requestPath || settings.copywritingRequestPath || DEFAULT_COPYWRITING_REQUEST_PATH
  }

  return draft.requestPath || '/v1/chat/completions'
}

function toProviderErrorMessage(error) {
  const providerMessage = error?.response?.data?.error?.message
  if (typeof providerMessage === 'string' && providerMessage.trim()) {
    return providerMessage.trim()
  }

  return error?.message || '文案模型请求失败'
}

function createCopywritingGenerationService({
  settingsService,
  messageRecorder,
  createHttpClientServiceDependency = createHttpClientService,
  createChatCompletionDependency = createChatCompletion,
  toDataUrlDependency = toDataUrl,
  getMimeTypeFromPathDependency = getMimeTypeFromPath
}) {
  async function generateCopywritingResults({ draft, taskId }) {
    const settings = settingsService.getSettings()
    const apiKey = resolveApiKey(draft, settings)
    const selectedModel = resolveModel(draft)

    if (!apiKey) {
      if (isGlmModel(selectedModel)) {
        throw new Error('请先在文本工作台保存可用的 GLM API-Key。')
      }
      throw new Error('请先完成管理员付费文本通道配置。')
    }

    const httpClient = createHttpClientServiceDependency({
      apiBaseUrl: resolveApiBaseUrl(draft, settings),
      apiKey,
      messageRecorder,
      timeoutMs: COPYWRITING_TIMEOUT_MS
    })
    const referenceImageParts = draft.copyMode === 'image-reference'
      ? await createReferenceImageContentParts(draft, {
          toDataUrlDependency,
          getMimeTypeFromPathDependency
        })
      : []

    const userPrompt = buildUserPrompt(draft)
    const messages = [
      {
        role: 'system',
        content: buildSystemPrompt()
      }
    ]

    if (referenceImageParts.length) {
      messages.push({
        role: 'user',
        content: [
          {
            type: 'text',
            text: userPrompt
          },
          ...referenceImageParts
        ]
      })
    } else {
      messages.push({
        role: 'user',
        content: userPrompt
      })
    }

    let completion

    try {
      completion = await createChatCompletionDependency({
        model: selectedModel,
        messages,
        requestPath: resolveRequestPath(draft, settings)
      }, {
        httpClient
      })
    } catch (error) {
      throw new Error(`GLM 请求失败：${toProviderErrorMessage(error)}`)
    }

    const resultGroups = normalizeResultGroups(completion.content).slice(0, resolveQuantity(draft))

    if (!resultGroups.length) {
      throw new Error('文案模型未返回可用结果。')
    }

    return resultGroups.map((group, index) => {
      const order = index + 1
      return {
        id: `${taskId}-copywriting-${order}`,
        title: `文案 ${order}`,
        format: 'txt',
        titleText: group.title,
        descriptionText: group.description,
        content: group.content
      }
    })
  }

  return {
    generateCopywritingResults
  }
}

module.exports = {
  createCopywritingGenerationService
}
