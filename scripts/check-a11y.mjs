#!/usr/bin/env node
/**
 * a11y (axe-core) 自动化扫描脚本
 *
 * 前置条件：一个已就绪的 Storybook（默认 http://localhost:6006）。
 * 本脚本只负责扫描，不负责启动 Storybook。
 *
 * 策略（Task 1 选定，方案 b：由 CI 真正启动 Storybook 后再扫描）：
 *   - CI：`.github/workflows/quality-gate.yml` 的 "A11y Accessibility Scan" 步骤先启动
 *     Storybook 并轮询就绪（未就绪则显式失败），再调用本脚本。
 *   - 本地：先 `pnpm storybook`，就绪后另开终端跑 `pnpm check:a11y`。
 *   - 离线：Storybook 不可达时默认 **显式失败（exit 2）**，绝不静默通过。
 *     仅当显式传入 `--skip-if-unreachable` 时才打印 SKIP 并 exit 0（CI 不传该参数，
 *     因此这条路径不会让流水线变绿）。
 *
 * 退出码：0 = 扫描通过（或显式 SKIP）；1 = 存在 serious/critical 违规；2 = Storybook 不可达；
 *         3 = 扫描过程出错。
 */
import http from 'http'

const DEFAULT_URL = process.env.STORYBOOK_URL || 'http://localhost:6006'

function parseArgs() {
  const args = { url: DEFAULT_URL, wait: 15000, skipIfUnreachable: false }
  for (let i = 2; i < process.argv.length; i++) {
    const a = process.argv[i]
    if (a === '--url' && process.argv[i + 1]) args.url = process.argv[++i]
    else if (a === '--wait' && process.argv[i + 1]) args.wait = parseInt(process.argv[++i], 10)
    else if (a === '--skip-if-unreachable') args.skipIfUnreachable = true
  }
  return args
}

function wait(ms) { return new Promise(r => setTimeout(r, ms)) }

function checkPort(url) {
  return new Promise((resolve) => {
    const req = http.get(url, (res) => { res.resume(); resolve(res.statusCode < 400) })
    req.on('error', () => resolve(false))
    req.setTimeout(3000, () => { req.destroy(); resolve(false) })
  })
}

async function waitForStorybook(url, ms) {
  const deadline = Date.now() + ms
  while (Date.now() < deadline) {
    if (await checkPort(url)) return true
    await wait(1000)
  }
  return false
}

async function runAxe(url) {
  const { chromium } = await import('playwright')
  const { default: axe } = await import('@axe-core/playwright')

  const browser = await chromium.launch({ headless: true })
  const context = await browser.newContext()
  const page = await context.newPage()

  const results = { violations: [], passes: 0, incomplete: 0 }

  try {
    await page.goto(url, { waitUntil: 'networkidle', timeout: 30000 })
    await wait(3000)

    const scanResults = await axe(page, {
      runOnly: {
        type: 'tag',
        values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'best-practice']
      }
    })

    results.violations = scanResults.violations || []
    results.passes = scanResults.passes?.length || 0
    results.incomplete = scanResults.incomplete?.length || 0
  } finally {
    await browser.close()
  }

  return results
}

function reportUnreachable(url, waitMs, skipIfUnreachable) {
  if (skipIfUnreachable) {
    console.log('[a11y] SKIP: axe-core 扫描未执行')
    console.log('[a11y] SKIP REASON: Storybook 在 ' + waitMs + 'ms 内不可达 (' + url + ')')
    console.log('[a11y] SKIP SCOPE: 本次运行没有产生任何可访问性结论，不能视为通过')
    console.log('[a11y] 如需真实扫描: pnpm storybook & 等待就绪后执行 pnpm check:a11y')
    process.exit(0)
  }

  console.error('[a11y] FATAL: Storybook not reachable at ' + url + ' within ' + waitMs + 'ms')
  console.error('[a11y] 未执行扫描，不产出结论（exit 2，不静默通过）')
  console.error('[a11y] 本地运行: pnpm storybook  （另开终端）pnpm check:a11y')
  console.error('[a11y] CI 运行: .github/workflows/quality-gate.yml 先启动 Storybook 再调用本脚本')
  console.error('[a11y] 仅离线环境: 加 --skip-if-unreachable 打印显式 SKIP（CI 不使用该参数）')
  process.exit(2)
}

async function main() {
  const args = parseArgs()
  const storybookUrl = args.url

  console.log('[a11y] Scanning:', storybookUrl)
  console.log('[a11y] Wait timeout:', args.wait, 'ms')

  if (!(await waitForStorybook(storybookUrl, args.wait))) {
    reportUnreachable(storybookUrl, args.wait, args.skipIfUnreachable)
  }

  console.log('[a11y] Storybook ready, scanning...')

  try {
    const results = await runAxe(storybookUrl)
    const serious = results.violations.filter(v => v.impact === 'serious' || v.impact === 'critical')

    if (results.violations.length > 0) {
      console.log('[a11y] AXE RESULTS: violations=' + results.violations.length + ' serious+critical=' + serious.length)
      for (const v of serious) {
        console.log('[a11y] [' + v.impact.toUpperCase() + '] ' + v.id + ': ' + v.help)
        for (const h of v.nodes || []) {
          console.log('[a11y]   -> ' + ((h.html || '').substring(0, 120) || (h.target || ['unknown']).join('.')))
        }
      }
    } else {
      console.log('[a11y] OK: 0 violations')
    }

    if (serious.length > 0) {
      console.error('[a11y] FAIL: ' + serious.length + ' serious/critical violations, blocking merge')
      process.exit(1)
    }
    process.exit(0)
  } catch (err) {
    console.error('[a11y] ERROR:', err.message)
    process.exit(3)
  }
}

main()
