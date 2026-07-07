const fs = require('node:fs/promises')
const os = require('node:os')
const path = require('node:path')
const crypto = require('node:crypto')
const { execFile } = require('node:child_process')

function trimString(value = '') {
  return typeof value === 'string' ? value.trim() : ''
}

function fileToDataUrl(buffer, mimeType = 'image/png') {
  return `data:${mimeType};base64,${buffer.toString('base64')}`
}

async function runPowershellImageNormalization({ filePath, minimumShortSidePx }) {
  const script = [
    'param([string]$FilePath,[int]$MinimumShortSidePx)',
    'Add-Type -AssemblyName System.Drawing',
    '$image = [System.Drawing.Image]::FromFile($FilePath)',
    'try {',
    '  $width = $image.Width',
    '  $height = $image.Height',
    '  $shortSide = [Math]::Min($width, $height)',
    '  if ($shortSide -lt $MinimumShortSidePx) {',
    '    $scale = [double]$MinimumShortSidePx / [double]$shortSide',
    '    $targetWidth = [Math]::Max(1, [int][Math]::Round($width * $scale))',
    '    $targetHeight = [Math]::Max(1, [int][Math]::Round($height * $scale))',
    '    $bitmap = New-Object System.Drawing.Bitmap($targetWidth, $targetHeight)',
    '    try {',
    '      $graphics = [System.Drawing.Graphics]::FromImage($bitmap)',
    '      try {',
    '        $graphics.CompositingQuality = [System.Drawing.Drawing2D.CompositingQuality]::HighQuality',
    '        $graphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic',
    '        $graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality',
    '        $graphics.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality',
    '        $graphics.DrawImage($image, 0, 0, $targetWidth, $targetHeight)',
    '      } finally {',
    '        $graphics.Dispose()',
    '      }',
    '      $memory = New-Object System.IO.MemoryStream',
    '      try {',
    '        $bitmap.Save($memory, [System.Drawing.Imaging.ImageFormat]::Png)',
    '        $payload = @{',
    '          dataUrl = "data:image/png;base64,$([Convert]::ToBase64String($memory.ToArray()))"',
    '          width = $width',
    '          height = $height',
    '          normalizedWidth = $targetWidth',
    '          normalizedHeight = $targetHeight',
    '          didResize = $true',
    '        }',
    '        [Console]::Out.Write(($payload | ConvertTo-Json -Compress))',
    '      } finally {',
    '        $memory.Dispose()',
    '      }',
    '    } finally {',
    '      $bitmap.Dispose()',
    '    }',
    '  } else {',
    '    $payload = @{',
    '      width = $width',
    '      height = $height',
    '      didResize = $false',
    '    }',
    '    [Console]::Out.Write(($payload | ConvertTo-Json -Compress))',
    '  }',
    '} finally {',
    '  $image.Dispose()',
    '}'
  ].join('\n')

  const scriptPath = path.resolve(os.tmpdir(), `qiuai-image-normalize-${crypto.randomUUID()}.ps1`)
  await fs.writeFile(scriptPath, script, 'utf8')

  try {
    return await new Promise((resolve, reject) => {
      execFile(
        'powershell.exe',
        [
          '-NoProfile',
          '-NonInteractive',
          '-ExecutionPolicy',
          'Bypass',
          '-File',
          scriptPath,
          '-FilePath',
          filePath,
          '-MinimumShortSidePx',
          String(minimumShortSidePx)
        ],
        {
          windowsHide: true,
          maxBuffer: 16 * 1024 * 1024
        },
        (error, stdout = '', stderr = '') => {
          if (error) {
            reject(new Error(String(stderr || error.message || 'PowerShell image normalization failed.').trim()))
            return
          }

          try {
            resolve(JSON.parse(String(stdout || '').trim() || '{}'))
          } catch (parseError) {
            reject(new Error(`Unable to parse image normalization result: ${parseError.message}`))
          }
        }
      )
    })
  } finally {
    await fs.rm(scriptPath, { force: true }).catch(() => {})
  }
}

function createRemoteImagePreparationService({
  readFile,
  getMimeTypeFromPath
} = {}) {
  if (typeof readFile !== 'function') {
    throw new Error('readFile is required.')
  }

  if (typeof getMimeTypeFromPath !== 'function') {
    throw new Error('getMimeTypeFromPath is required.')
  }

  async function prepareSourceImageDataUrl({
    filePath = '',
    minimumShortSidePx = 300
  } = {}) {
    const normalizedPath = trimString(filePath)
    if (!normalizedPath) {
      throw new Error('Source image path is required.')
    }

    const mimeType = getMimeTypeFromPath(normalizedPath)
    const extension = path.extname(normalizedPath).toLowerCase()
    const originalBuffer = await readFile(normalizedPath)

    if (
      process.platform !== 'win32' ||
      !['.png', '.jpg', '.jpeg'].includes(extension)
    ) {
      return fileToDataUrl(originalBuffer, mimeType)
    }

    try {
      const normalizedPayload = await runPowershellImageNormalization({
        filePath: normalizedPath,
        minimumShortSidePx
      })
      const normalizedDataUrl = trimString(normalizedPayload?.dataUrl || '')

      return normalizedDataUrl || fileToDataUrl(originalBuffer, mimeType)
    } catch {
      return fileToDataUrl(originalBuffer, mimeType)
    }
  }

  return {
    prepareSourceImageDataUrl
  }
}

module.exports = {
  createRemoteImagePreparationService
}
