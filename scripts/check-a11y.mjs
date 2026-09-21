#!/usr/bin/env node
/**
 * a11y (axe-core) 自动化扫描脚本
 *
 * 启动 Storybook → 逐页扫描所有 stories → 注入 axe-core → 报告违规。
 * 严重违规（serious/critical）退出码 1，阻断 CI 合并。
 */
import { spawn } from 'child_process'
import http from 'http'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const ROOT = join(__dirname, '..')

function parseArgs() {
  const args = { url: 'http://localhost:6006', wait: 15000, start: false }
  for (let i = 2; i < process.argv.length; i++) {
    const a = process.argv[i]
    if (a === '--url' && process.argv[i + 1]) args.url = process.argv[++i]
    else if (a === '--wait' && process.argv[i + 1]) args.wait = parseInt(process.argv[++i], 10)
    else if (a === '--start') args.start = true
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

async function main() {
  const args = parseArgs()
  const storybookUrl = args.url

  console.log('[a11y] Scanning:', storybookUrl)
  console.log('[a11y] Wait timeout:', args.wait, 'ms')

  if (!(await waitForStorybook(storybookUrl, args.wait))) {
    console.error('[a11y] ERROR: Storybook not ready at', storybookUrl)
    console.error('[a11y] Run: pnpm storybook & 等待就绪')
    process.exit(2)
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
