import fs from 'node:fs'
import path from 'node:path'

const projectRoot = process.cwd()
const distDir = path.join(projectRoot, 'dist')

function formatMB(bytes) {
  return `${(bytes / (1024 * 1024)).toFixed(2)}MB`
}

function walkFiles(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true })
  const files = []
  for (const entry of entries) {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      files.push(...walkFiles(full))
    } else {
      files.push(full)
    }
  }
  return files
}

if (!fs.existsSync(distDir)) {
  console.error('[bundle-metrics] dist 目录不存在，请先执行 `pnpm build`')
  process.exit(1)
}

const allFiles = walkFiles(distDir)
const jsFiles = allFiles.filter((f) => f.endsWith('.js'))
const cssFiles = allFiles.filter((f) => f.endsWith('.css'))
const totalSize = allFiles.reduce((sum, file) => sum + fs.statSync(file).size, 0)

const summary = {
  jsCount: jsFiles.length,
  cssCount: cssFiles.length,
  totalSizeBytes: totalSize,
  totalSizeMB: formatMB(totalSize)
}

const outFile = path.join(distDir, 'bundle-metrics.json')
fs.writeFileSync(outFile, JSON.stringify(summary, null, 2), 'utf8')

console.log(`[bundle-metrics] JS 文件数: ${summary.jsCount}`)
console.log(`[bundle-metrics] CSS 文件数: ${summary.cssCount}`)
console.log(`[bundle-metrics] 总包体积: ${summary.totalSizeMB}`)
console.log(`[bundle-metrics] 结果文件: ${outFile}`)
