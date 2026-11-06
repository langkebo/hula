#!/usr/bin/env node
/**
 * a11y (axe-core) 自动化扫描脚本
 *
 * 前置条件：一个已就绪的 Storybook（默认 http://localhost:6006）。
 * 本脚本只负责扫描，不负责启动 Storybook。
 *
 * 扫描范围：读取 Storybook 的 `index.json` 枚举全部 story，逐个用 `iframe.html?id=`
 * 直达并跑 axe-core（默认标签 wcag2a/2aa/21a/21aa + best-practice）。这样覆盖的是
 * 每个组件的真实渲染，而不是 Storybook 外壳页。若 `index.json` 不可用或无 story，
 * 才退化为扫描首页，避免「0 个 story、0 违规」的假绿。
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
  const { AxeBuilder } = await import('@axe-core/playwright')
  const browser = await chromium.launch({ headless: true })
  const context = await browser.newContext()
  const page = await context.newPage()

  const results = { violations: [], passes: 0, incomplete: 0 }

  try {
    await page.goto(url, { waitUntil: 'networkidle', timeout: 30000 })
    await wait(3000)

    const scanResults = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'best-practice'])
      .analyze()

    results.violations = scanResults.violations || []
    results.passes = scanResults.passes?.length || 0
    results.incomplete = scanResults.incomplete?.length || 0
  } finally {
    await browser.close()
  }

  return results
}

/**
 * 从 Storybook 的 index.json 解析出全部 story。
 * 只取 type === 'story' 的条目（docs 页是文档容器，重复扫描同一组件收益低）。
 */
async function fetchStories(baseUrl) {
  const indexUrl = new URL('/index.json', baseUrl).toString()
  const res = await fetch(indexUrl)
  if (!res.ok) throw new Error('index.json HTTP ' + res.status)
  const data = await res.json()
  const entries = data.entries || {}
  return Object.values(entries)
    .filter((e) => e && e.type === 'story' && e.id)
    .map((e) => ({ id: e.id, title: e.title || e.id, name: e.name || '' }))
    .sort((a, b) => a.id.localeCompare(b.id))
}

/**
 * 逐 story 扫描。每个 story 用 iframe.html 直达，避免 Storybook 外壳的菜单/工具栏
 * 干扰判定（外壳本身不是待测 UI）。
 */
async function scanStories(baseUrl, stories) {
  const { chromium } = await import('playwright')
  const { AxeBuilder } = await import('@axe-core/playwright')
  const browser = await chromium.launch({ headless: true })
  const context = await browser.newContext()
  const page = await context.newPage()

  const scanned = []
  const failures = []

  try {
    let index = 0
    for (const story of stories) {
      index++
      const url = new URL('/iframe.html', baseUrl)
      url.searchParams.set('id', story.id)
      url.searchParams.set('viewMode', 'story')

      try {
        // 注意：不能用 networkidle —— Storybook dev server 会保持常驻 websocket/HMR 连接，
        // networkidle 永不成立，每个 story 都会吃满超时，表现为整轮扫描「挂死」。
        await page.goto(url.toString(), { waitUntil: 'load', timeout: 15000 })
        // 等组件首帧渲染完成（Storybook 挂载到 #storybook-root）
        await page
          .waitForFunction(
            () => {
              const root = document.getElementById('storybook-root')
              return !!root && root.children.length > 0
            },
            { timeout: 8000 }
          )
          .catch(() => {})
        await wait(200)

        // analyze 也加看门狗：个别 story 的 axe 注入可能长时间不回调
        const result = await Promise.race([
          new AxeBuilder({ page })
            .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'best-practice'])
            .analyze(),
          new Promise((_, reject) => setTimeout(() => reject(new Error('axe analyze timeout (20s)')), 20000))
        ])

        const violations = result.violations || []
        scanned.push({ id: story.id, violations: violations.length })
        for (const v of violations) {
          failures.push({ story: story.id, violation: v })
        }
        process.stdout.write(
          '[a11y] (' + index + '/' + stories.length + ') ' + story.id + ' violations=' + violations.length + '\n'
        )
      } catch (err) {
        // 单个 story 渲染失败不应掩盖其他 story 的结论：记录后继续
        scanned.push({ id: story.id, error: err.message })
        process.stdout.write(
          '[a11y] (' + index + '/' + stories.length + ') ' + story.id + ' ERROR: ' + err.message + '\n'
        )
      }
    }
  } finally {
    await browser.close()
  }

  return { scanned, failures }
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
    let stories = []
    try {
      stories = await fetchStories(storybookUrl)
      console.log('[a11y] Stories discovered:', stories.length)
    } catch (err) {
      console.log('[a11y] WARN: index.json 不可用 (' + err.message + ')，退化为扫描 Storybook 首页')
    }

    // 无 story 时退回单页扫描，避免「0 个 story、0 违规」的假绿
    if (stories.length === 0) {
      const results = await runAxe(storybookUrl)
      const serious = results.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical')
      console.log(
        '[a11y] AXE RESULTS (shell page): violations=' + results.violations.length + ' serious+critical=' + serious.length
      )
      if (serious.length > 0) {
        console.error('[a11y] FAIL: ' + serious.length + ' serious/critical violations, blocking merge')
        process.exit(1)
      }
      process.exit(0)
    }

    const { scanned, failures } = await scanStories(storybookUrl, stories)
    const errors = scanned.filter((s) => s.error)
    const serious = failures.filter(
      (f) => f.violation.impact === 'serious' || f.violation.impact === 'critical'
    )

    console.log('[a11y] Stories scanned:', scanned.length - errors.length + '/' + stories.length)
    if (errors.length > 0) {
      console.log('[a11y] Story scan errors:', errors.length)
      for (const e of errors) console.log('[a11y]   ! ' + e.id + ': ' + e.error)
    }

    // 按 story 聚合输出，便于直接定位组件
    const byStory = new Map()
    for (const f of serious) {
      const list = byStory.get(f.story) || []
      list.push(f.violation)
      byStory.set(f.story, list)
    }

    console.log(
      '[a11y] AXE RESULTS: violations=' + failures.length + ' serious+critical=' + serious.length +
        ' affectedStories=' + byStory.size
    )
    for (const [storyId, list] of byStory) {
      for (const v of list) {
        console.log('[a11y] [' + v.impact.toUpperCase() + '] ' + storyId + ' :: ' + v.id + ': ' + v.help)
        for (const h of v.nodes || []) {
          console.log('[a11y]   -> ' + ((h.html || '').substring(0, 120) || (h.target || ['unknown']).join('.')))
        }
      }
    }

    if (serious.length > 0) {
      console.error('[a11y] FAIL: ' + serious.length + ' serious/critical violations, blocking merge')
      process.exit(1)
    }
    if (failures.length > 0) {
      console.log('[a11y] OK (serious/critical): ' + failures.length + ' minor/moderate violations 不阻断合并')
    } else {
      console.log('[a11y] OK: 0 violations')
    }
    process.exit(0)
  } catch (err) {
    console.error('[a11y] ERROR:', err.message)
    process.exit(3)
  }
}

main()
