import fs from 'node:fs'
import path from 'node:path'
import pngToIco from 'png-to-ico'

const projectRoot = path.resolve(import.meta.dirname, '..')
const sourcePngPath = path.resolve(projectRoot, 'icon/Q3.png')
const runtimePngPath = path.resolve(projectRoot, 'main/assets/app-icon.png')
const windowsIcoPath = path.resolve(projectRoot, 'build/icons/app-icon.ico')

function ensureDir(filePath) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true })
}

if (!fs.existsSync(sourcePngPath)) {
  throw new Error(`Icon source was not found: ${sourcePngPath}`)
}

const sourceBuffer = fs.readFileSync(sourcePngPath)

ensureDir(runtimePngPath)
fs.copyFileSync(sourcePngPath, runtimePngPath)

ensureDir(windowsIcoPath)
const icoBuffer = await pngToIco(sourceBuffer)
fs.writeFileSync(windowsIcoPath, icoBuffer)

console.log(JSON.stringify({
  ok: true,
  source: sourcePngPath,
  runtimePng: runtimePngPath,
  windowsIco: windowsIcoPath
}, null, 2))
