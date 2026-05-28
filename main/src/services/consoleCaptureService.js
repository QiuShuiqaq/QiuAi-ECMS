const CONSOLE_CAPTURE_KEY = Symbol.for('qiuai.console.capture')

function safeSerializeConsoleArgs(args = []) {
  return args.map((item) => {
    if (typeof item === 'string') {
      return item
    }

    try {
      return JSON.stringify(item)
    } catch {
      return String(item)
    }
  }).join(' ')
}

function isBrokenPipeError(error) {
  const message = String(error?.message || '').toLowerCase()
  return Boolean(
    error &&
    (
      error.code === 'EPIPE' ||
      error.code === 'ERR_STREAM_DESTROYED' ||
      error.code === 'ERR_SOCKET_CLOSED' ||
      error.errno === -4047 ||
      message.includes('broken pipe') ||
      message.includes('stream destroyed') ||
      message.includes('socket closed')
    )
  )
}

function invokeOriginalConsoleMethod(originalMethod, consoleObject, args) {
  try {
    originalMethod.apply(consoleObject, args)
  } catch (error) {
    if (isBrokenPipeError(error)) {
      return
    }

    throw error
  }
}

function attachConsoleCapture({
  runtimeLogger,
  consoleObject = console
} = {}) {
  if (!runtimeLogger || typeof runtimeLogger.log !== 'function') {
    return
  }

  if (globalThis[CONSOLE_CAPTURE_KEY]) {
    return
  }

  const methods = ['log', 'info', 'warn', 'error']
  methods.forEach((methodName) => {
    const originalMethod = consoleObject[methodName]
    if (typeof originalMethod !== 'function') {
      return
    }

    consoleObject[methodName] = (...args) => {
      try {
        invokeOriginalConsoleMethod(originalMethod, consoleObject, args)
      } catch (error) {
        if (isBrokenPipeError(error)) {
          return
        }

        return
      }

      void runtimeLogger.log({
        level: methodName === 'log' ? 'info' : methodName,
        event: 'console-output',
        message: safeSerializeConsoleArgs(args)
      }).catch(() => {})
    }
  })

  globalThis[CONSOLE_CAPTURE_KEY] = true
}

module.exports = {
  attachConsoleCapture
}
