const fs = require('node:fs')
const path = require('node:path')

const repoRoot = path.resolve(__dirname, '..')

const includeDirs = [
  'renderer',
  'main',
  'shared',
  'tests',
  'scripts'
]

const includeExts = new Set([
  '.js',
  '.mjs',
  '.cjs',
  '.vue',
  '.json',
  '.css',
  '.md'
])

const skipDirNames = new Set([
  'node_modules',
  'dist',
  'coverage',
  '.git'
])

const suspiciousPatterns = [
  /ï¿½/g,
  /�/g,
  /[\u00C0-\u00FF]{2,}/g,
  /(?:Ã.|Å.|æ.|ç.|é.|è.|ä.|ö.|ü.|ñ.)/g,
  /(?:鍙|鏍|鐢|璇|瑙|妯|绗|鎻|杩|浠|缁|鍥|澶|鑽|闆|鏈€|椤)/g
]

function walk(dirPath, results) {
  const entries = fs.readdirSync(dirPath, { withFileTypes: true })
  for (const entry of entries) {
    if (skipDirNames.has(entry.name)) continue
    const fullPath = path.join(dirPath, entry.name)
    if (entry.isDirectory()) {
      walk(fullPath, results)
      continue
    }
    if (!includeExts.has(path.extname(entry.name))) continue
    results.push(fullPath)
  }
}

function collectFiles() {
  const files = []
  for (const dir of includeDirs) {
    const fullDir = path.join(repoRoot, dir)
    if (fs.existsSync(fullDir)) {
      walk(fullDir, files)
    }
  }
  return files
}

function inspectFile(filePath) {
  if (path.basename(filePath) === 'check-mojibake.js') {
    return null
  }

  const content = fs.readFileSync(filePath, 'utf8')
  const findings = []
  for (const pattern of suspiciousPatterns) {
    const matches = content.match(pattern)
    if (matches && matches.length) {
      findings.push(...matches.slice(0, 5))
    }
  }

  if (!findings.length) {
    return null
  }

  return {
    filePath,
    findings: [...new Set(findings)].slice(0, 8)
  }
}

function main() {
  const files = collectFiles()
  const findings = files
    .map(inspectFile)
    .filter(Boolean)
    .sort((left, right) => left.filePath.localeCompare(right.filePath))

  if (!findings.length) {
    console.log('No suspicious mojibake patterns found.')
    return
  }

  console.log(`Suspicious files: ${findings.length}`)
  for (const item of findings) {
    const relativePath = path.relative(repoRoot, item.filePath).replaceAll('\\', '/')
    console.log(`- ${relativePath}`)
    console.log(`  ${item.findings.join(' | ')}`)
  }

  process.exitCode = 1
}

main()
