import fs from 'node:fs'
import path from 'node:path'
import { createGzip } from 'node:zlib'
import { pipeline } from 'node:stream/promises'
import { Readable } from 'node:stream'

const projectRoot = process.cwd()
const distDir = path.join(projectRoot, 'dist')

const BUDGET = {
  totalJsGzipBytes: 3 * 1024 * 1024,
  singleChunkGzipBytes: 300 * 1024,
  entryChunkGzipBytes: 500 * 1024,
  chunkWarningBytes: 500 * 1024,
  largeJsWarningBytes: 1024 * 1024
}

function formatMB(bytes) {
  return `${(bytes / (1024 * 1024)).toFixed(2)}MB`
}

function formatKB(bytes) {
  return `${(bytes / 1024).toFixed(2)}KB`
}

async function gzipSize(filePath) {
  const buffer = fs.readFileSync(filePath)
  return new Promise((resolve, reject) => {
    let size = 0
    const gzip = createGzip()
    gzip.on('data', (chunk) => { size += chunk.length })
    gzip.on('end', () => resolve(size))
    gzip.on('error', reject)
    Readable.from(buffer).pipe(gzip)
  })
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

async function main() {
  if (!fs.existsSync(distDir)) {
    console.error('[bundle-metrics] dist 目录不存在，请先执行 `pnpm build`')
    process.exit(1)
  }

  const allFiles = walkFiles(distDir)
  const assetEntries = []

  for (const file of allFiles) {
    const sizeBytes = fs.statSync(file).size
    const relativePath = path.relative(projectRoot, file)
    const extension = path.extname(file).toLowerCase()
    const type = extension === '.js' ? 'js' : extension === '.css' ? 'css' : 'other'

    let gzipBytes = null
    if (type === 'js' || type === 'css') {
      gzipBytes = await gzipSize(file)
    }

    assetEntries.push({
      file: relativePath,
      type,
      sizeBytes,
      sizeKB: formatKB(sizeBytes),
      sizeMB: formatMB(sizeBytes),
      gzipBytes,
      gzipKB: gzipBytes !== null ? formatKB(gzipBytes) : null
    })
  }

  const jsFiles = assetEntries.filter((entry) => entry.type === 'js')
  const cssFiles = assetEntries.filter((entry) => entry.type === 'css')
  const totalSize = assetEntries.reduce((sum, entry) => sum + entry.sizeBytes, 0)
  const totalJsGzip = jsFiles.reduce((sum, entry) => sum + (entry.gzipBytes || 0), 0)
  const totalCssGzip = cssFiles.reduce((sum, entry) => sum + (entry.gzipBytes || 0), 0)

  const topAssets = [...assetEntries]
    .sort((a, b) => b.sizeBytes - a.sizeBytes)
    .slice(0, 20)

  const largeJavaScriptAssets = jsFiles
    .filter((entry) => entry.sizeBytes >= BUDGET.chunkWarningBytes)
    .sort((a, b) => b.sizeBytes - a.sizeBytes)

  const budgetViolations = []

  if (totalJsGzip > BUDGET.totalJsGzipBytes) {
    budgetViolations.push({
      rule: 'total-js-gzip',
      actual: formatKB(totalJsGzip),
      limit: formatKB(BUDGET.totalJsGzipBytes),
      message: `全量 JS gzip ${formatKB(totalJsGzip)} 超过预算 ${formatKB(BUDGET.totalJsGzipBytes)}`
    })
  }

  for (const f of jsFiles) {
    if (f.gzipBytes && f.gzipBytes > BUDGET.singleChunkGzipBytes) {
      budgetViolations.push({
        rule: 'single-chunk-gzip',
        file: f.file,
        actual: f.gzipKB,
        limit: formatKB(BUDGET.singleChunkGzipBytes),
        message: `单 chunk gzip ${f.gzipKB} 超过预算 ${formatKB(BUDGET.singleChunkGzipBytes)}: ${f.file}`
      })
    }
  }

  const summary = {
    generatedAt: new Date().toISOString(),
    distDir: path.relative(projectRoot, distDir),
    budget: {
      totalJsGzip: formatKB(BUDGET.totalJsGzipBytes),
      singleChunkGzip: formatKB(BUDGET.singleChunkGzipBytes),
      entryChunkGzip: formatKB(BUDGET.entryChunkGzipBytes),
      chunkWarningRaw: formatKB(BUDGET.chunkWarningBytes),
      largeJsWarningRaw: formatKB(BUDGET.largeJsWarningBytes)
    },
    summary: {
      assetCount: assetEntries.length,
      jsCount: jsFiles.length,
      cssCount: cssFiles.length,
      otherCount: assetEntries.length - jsFiles.length - cssFiles.length,
      totalSizeBytes: totalSize,
      totalSizeMB: formatMB(totalSize),
      totalJsGzipBytes: totalJsGzip,
      totalJsGzipKB: formatKB(totalJsGzip),
      totalCssGzipBytes: totalCssGzip,
      totalCssGzipKB: formatKB(totalCssGzip)
    },
    topAssets,
    largeJavaScriptAssets,
    budgetViolations,
    warnings: {
      chunkSizeWarningLimitExceeded: largeJavaScriptAssets.length > 0,
      megabyteSizedJavaScriptAssets: jsFiles
        .filter((entry) => entry.sizeBytes >= BUDGET.largeJsWarningBytes)
        .map((entry) => entry.file),
      budgetViolations: budgetViolations.length > 0
    }
  }

  const outFile = path.join(distDir, 'bundle-metrics.json')
  fs.writeFileSync(outFile, JSON.stringify(summary, null, 2), 'utf8')

  console.log(`[bundle-metrics] 产物文件数: ${summary.summary.assetCount}`)
  console.log(`[bundle-metrics] JS 文件数: ${summary.summary.jsCount}`)
  console.log(`[bundle-metrics] CSS 文件数: ${summary.summary.cssCount}`)
  console.log(`[bundle-metrics] 总包体积: ${summary.summary.totalSizeMB}`)
  console.log(`[bundle-metrics] JS gzip 总量: ${summary.summary.totalJsGzipKB}`)
  console.log(`[bundle-metrics] CSS gzip 总量: ${summary.summary.totalCssGzipKB}`)
  console.log(
    `[bundle-metrics] 超过 ${formatKB(BUDGET.chunkWarningBytes)} 的 JS 文件数: ${largeJavaScriptAssets.length}`
  )

  if (budgetViolations.length > 0) {
    console.error(`\n[bundle-metrics] 预算违规 (${budgetViolations.length} 项):`)
    for (const v of budgetViolations) {
      console.error(`  - ${v.message}`)
    }
    const strictMode = process.env.BUNDLE_BUDGET_STRICT === '1'
    if (strictMode) {
      console.error('[bundle-metrics] BUNDLE_BUDGET_STRICT=1, 预算违规将导致 CI 失败')
      process.exit(1)
    } else {
      console.warn('[bundle-metrics] 当前为告警模式，设置 BUNDLE_BUDGET_STRICT=1 可启用阻塞门禁')
    }
  } else {
    console.log('[bundle-metrics] 所有预算检查通过')
  }

  console.log(`[bundle-metrics] 结果文件: ${outFile}`)
}

main().catch((err) => {
  console.error('[bundle-metrics] 执行失败:', err)
  process.exit(1)
})
