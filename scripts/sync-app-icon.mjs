import fs from 'node:fs'
import path from 'node:path'

const projectRoot = path.resolve(import.meta.dirname, '..')
const sourcePngPath = path.resolve(projectRoot, 'icon/Q3.png')
const runtimePngPath = path.resolve(projectRoot, 'main/assets/app-icon.png')
const windowsIcoPath = path.resolve(projectRoot, 'build/icons/app-icon.ico')

function ensureDir(filePath) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true })
}

function createIcoFromPngBuffer(pngBuffer) {
  const header = Buffer.alloc(6)
  header.writeUInt16LE(0, 0)
  header.writeUInt16LE(1, 2)
  header.writeUInt16LE(1, 4)

  const directoryEntry = Buffer.alloc(16)
  directoryEntry.writeUInt8(0, 0)
  directoryEntry.writeUInt8(0, 1)
  directoryEntry.writeUInt8(0, 2)
  directoryEntry.writeUInt8(0, 3)
  directoryEntry.writeUInt16LE(1, 4)
  directoryEntry.writeUInt16LE(32, 6)
  directoryEntry.writeUInt32LE(pngBuffer.length, 8)
  directoryEntry.writeUInt32LE(header.length + directoryEntry.length, 12)

  return Buffer.concat([header, directoryEntry, pngBuffer])
}

if (!fs.existsSync(sourcePngPath)) {
  throw new Error(`Icon source was not found: ${sourcePngPath}`)
}

const sourceBuffer = fs.readFileSync(sourcePngPath)

ensureDir(runtimePngPath)
fs.copyFileSync(sourcePngPath, runtimePngPath)

ensureDir(windowsIcoPath)
fs.writeFileSync(windowsIcoPath, createIcoFromPngBuffer(sourceBuffer))

console.log(JSON.stringify({
  ok: true,
  source: sourcePngPath,
  runtimePng: runtimePngPath,
  windowsIco: windowsIcoPath
}, null, 2))
