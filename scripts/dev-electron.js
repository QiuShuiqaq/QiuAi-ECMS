const path = require('node:path')
const { spawn } = require('node:child_process')

const projectRoot = path.resolve(__dirname, '..')
const electronBinary = path.join(projectRoot, 'node_modules', 'electron', 'dist', 'electron.exe')
const launchEnv = { ...process.env }

delete launchEnv.ELECTRON_RUN_AS_NODE

const child = spawn(electronBinary, ['.'], {
  cwd: projectRoot,
  env: launchEnv,
  stdio: 'inherit',
  windowsHide: false
})

child.on('exit', (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal)
    return
  }

  process.exit(code ?? 0)
})

child.on('error', (error) => {
  console.error('Failed to launch Electron dev process:', error)
  process.exit(1)
})
