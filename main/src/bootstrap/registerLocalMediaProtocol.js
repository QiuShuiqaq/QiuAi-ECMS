const fs = require('node:fs/promises')
const { protocol } = require('electron')
const { LOCAL_MEDIA_SCHEME, resolveLocalMediaFile } = require('../services/localMediaPreviewService')

function registerLocalMediaProtocol() {
  if (protocol.isProtocolHandled(LOCAL_MEDIA_SCHEME)) {
    return
  }

  protocol.handle(LOCAL_MEDIA_SCHEME, async (request) => {
    const mediaFile = resolveLocalMediaFile(request.url)
    if (!mediaFile) {
      return new Response('Not Found', { status: 404 })
    }

    const buffer = await fs.readFile(mediaFile.filePath)
    return new Response(buffer, {
      status: 200,
      headers: {
        'content-type': mediaFile.mimeType,
        'cache-control': 'no-store'
      }
    })
  })
}

module.exports = registerLocalMediaProtocol
