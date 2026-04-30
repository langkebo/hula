import fs from 'node:fs'
import path from 'node:path'

const projectRoot = process.cwd()
const distDir = path.join(projectRoot, 'dist')
const CHUNK_WARNING_LIMIT_BYTES = 500 * 1024
const LARGE_JS_WARNING_LIMIT_BYTES = 1024 * 1024

function formatMB(bytes) {
  return `${(bytes / (1024 * 1024)).toFixed(2)}MB`
}

function formatKB(bytes) {
  return `${(bytes / 1024).toFixed(2)}KB`
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
const assetEntries = allFiles.map((file) => {
  const sizeBytes = fs.statSync(file).size
  const relativePath = path.relative(projectRoot, file)
  const extension = path.extname(file).toLowerCase()
  const type = extension === '.js' ? 'js' : extension === '.css' ? 'css' : 'other'

  return {
    file: relativePath,
    type,
    sizeBytes,
    sizeKB: formatKB(sizeBytes),
    sizeMB: formatMB(sizeBytes)
  }
})

const jsFiles = assetEntries.filter((entry) => entry.type === 'js')
const cssFiles = assetEntries.filter((entry) => entry.type === 'css')
const totalSize = assetEntries.reduce((sum, entry) => sum + entry.sizeBytes, 0)

const topAssets = [...assetEntries]
  .sort((a, b) => b.sizeBytes - a.sizeBytes)
  .slice(0, 10)

const largeJavaScriptAssets = jsFiles
  .filter((entry) => entry.sizeBytes >= CHUNK_WARNING_LIMIT_BYTES)
  .sort((a, b) => b.sizeBytes - a.sizeBytes)

const summary = {
  generatedAt: new Date().toISOString(),
  distDir: path.relative(projectRoot, distDir),
  thresholds: {
    chunkSizeWarningLimitBytes: CHUNK_WARNING_LIMIT_BYTES,
    chunkSizeWarningLimitKB: CHUNK_WARNING_LIMIT_BYTES / 1024,
    largeJavaScriptWarningBytes: LARGE_JS_WARNING_LIMIT_BYTES,
    largeJavaScriptWarningKB: LARGE_JS_WARNING_LIMIT_BYTES / 1024
  },
  summary: {
    assetCount: assetEntries.length,
    jsCount: jsFiles.length,
    cssCount: cssFiles.length,
    otherCount: assetEntries.length - jsFiles.length - cssFiles.length,
    totalSizeBytes: totalSize,
    totalSizeMB: formatMB(totalSize)
  },
  totalsByType: {
    js: {
      count: jsFiles.length,
      sizeBytes: jsFiles.reduce((sum, entry) => sum + entry.sizeBytes, 0),
      sizeMB: formatMB(jsFiles.reduce((sum, entry) => sum + entry.sizeBytes, 0))
    },
    css: {
      count: cssFiles.length,
      sizeBytes: cssFiles.reduce((sum, entry) => sum + entry.sizeBytes, 0),
      sizeMB: formatMB(cssFiles.reduce((sum, entry) => sum + entry.sizeBytes, 0))
    },
    other: {
      count: assetEntries.length - jsFiles.length - cssFiles.length,
      sizeBytes: assetEntries
        .filter((entry) => entry.type === 'other')
        .reduce((sum, entry) => sum + entry.sizeBytes, 0),
      sizeMB: formatMB(
        assetEntries.filter((entry) => entry.type === 'other').reduce((sum, entry) => sum + entry.sizeBytes, 0)
      )
    }
  },
  topAssets,
  largeJavaScriptAssets,
  warnings: {
    chunkSizeWarningLimitExceeded: largeJavaScriptAssets.length > 0,
    megabyteSizedJavaScriptAssets: jsFiles
      .filter((entry) => entry.sizeBytes >= LARGE_JS_WARNING_LIMIT_BYTES)
      .map((entry) => entry.file)
  }
}

const outFile = path.join(distDir, 'bundle-metrics.json')
fs.writeFileSync(outFile, JSON.stringify(summary, null, 2), 'utf8')

console.log(`[bundle-metrics] 产物文件数: ${summary.summary.assetCount}`)
console.log(`[bundle-metrics] JS 文件数: ${summary.summary.jsCount}`)
console.log(`[bundle-metrics] CSS 文件数: ${summary.summary.cssCount}`)
console.log(`[bundle-metrics] 总包体积: ${summary.summary.totalSizeMB}`)
console.log(
  `[bundle-metrics] 超过 ${summary.thresholds.chunkSizeWarningLimitKB}KB 的 JS 文件数: ${summary.largeJavaScriptAssets.length}`
)
console.log(`[bundle-metrics] 结果文件: ${outFile}`)
