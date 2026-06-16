const { spawn } = require('node:child_process')
const net = require('node:net')
const path = require('node:path')

const projectRoot = path.resolve(__dirname, '..')
const viteEntry = path.resolve(projectRoot, 'node_modules/vite/bin/vite.js')
const electronBinary = require('electron')
const devServerUrl = 'http://127.0.0.1:5173'
const devServerPort = 5173
const devServerHost = '127.0.0.1'
const devServerTimeoutMs = 30000
const devServerPollIntervalMs = 250

let viteProcess = null
let electronProcess = null
let isShuttingDown = false

function wait(durationMs) {
  return new Promise((resolve) => {
    setTimeout(resolve, durationMs)
  })
}

function isPortOpen({ host, port }) {
  return new Promise((resolve) => {
    const socket = new net.Socket()

    socket.setTimeout(1000)
    socket.once('connect', () => {
      socket.destroy()
      resolve(true)
    })
    socket.once('timeout', () => {
      socket.destroy()
      resolve(false)
    })
    socket.once('error', () => {
      socket.destroy()
      resolve(false)
    })

    socket.connect(port, host)
  })
}

async function waitForDevServer() {
  const startedAt = Date.now()

  while (Date.now() - startedAt < devServerTimeoutMs) {
    if (await isPortOpen({
      host: devServerHost,
      port: devServerPort
    })) {
      return
    }

    await wait(devServerPollIntervalMs)
  }

  throw new Error(`Vite dev server did not become ready within ${devServerTimeoutMs}ms`)
}

function stopChild(child, signal = 'SIGTERM') {
  if (!child || child.killed) {
    return
  }

  try {
    child.kill(signal)
  } catch {
    // Ignore teardown failures.
  }
}

async function shutdown(exitCode = 0) {
  if (isShuttingDown) {
    return
  }

  isShuttingDown = true
  stopChild(electronProcess)
  stopChild(viteProcess)

  await wait(300)

  stopChild(electronProcess, 'SIGKILL')
  stopChild(viteProcess, 'SIGKILL')

  process.exit(exitCode)
}

async function main() {
  viteProcess = spawn(process.execPath, [viteEntry, '--config', 'renderer/vite.config.js'], {
    cwd: projectRoot,
    stdio: 'inherit',
    shell: false,
    windowsHide: false
  })

  viteProcess.once('exit', (code) => {
    if (!isShuttingDown) {
      void shutdown(code ?? 1)
    }
  })

  await waitForDevServer()

  const electronEnv = {
    ...process.env,
    NODE_ENV: 'development',
    VITE_DEV_SERVER_URL: devServerUrl
  }

  delete electronEnv.ELECTRON_RUN_AS_NODE

  electronProcess = spawn(electronBinary, ['.'], {
    cwd: projectRoot,
    env: electronEnv,
    stdio: 'inherit',
    shell: false,
    windowsHide: false
  })

  electronProcess.once('exit', (code) => {
    if (!isShuttingDown) {
      void shutdown(code ?? 0)
    }
  })
}

process.on('SIGINT', () => {
  void shutdown(0)
})

process.on('SIGTERM', () => {
  void shutdown(0)
})

main().catch((error) => {
  console.error(error)
  void shutdown(1)
})
