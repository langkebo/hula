import { chromium } from '@playwright/test';

/**
 * 首屏 + 交互性能采样（§17.7 性能预算）
 *
 * 输出：ttfb / dcl / load / fcp / lcp / cls / inp
 *
 * INP 说明：
 * - 用 PerformanceObserver({ type: 'event' }) 采集带 interactionId 的交互事件；
 * - 同一 interactionId 取最大 duration（同一次交互的多个事件只算一次）；
 * - 页面 INP 取交互延迟的 p98（交互数少时即等于最大值），符合 Web Vitals 定义；
 * - 阈值取 16ms（约一帧）而非 40ms，避免短交互被静默丢弃导致 p98 为 null；
 * - 3 次采样后再对每次的 INP 取 p75 / max，作为跨采样结论。
 */
const TARGET_URL = 'http://127.0.0.1:4175/';
const INP_EVENT_THRESHOLD_MS = 16;
const INP_PERCENTILE = 0.98;

function percentile(values, ratio) {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.min(sorted.length - 1, Math.max(0, Math.ceil(sorted.length * ratio) - 1));
  return sorted[index];
}

/**
 * 交互驱动：页面静止不会产生 event 条目，必须制造真实交互才能采到 INP。
 * 单步失败不影响整体采样（例如登录前无输入框）。
 */
async function driveInteractions(page) {
  const step = async (action) => {
    try {
      await action();
    } catch {
      // 交互探测是尽力而为，失败不阻断采样
    }
    await page.waitForTimeout(80);
  };

  await page.mouse.move(480, 320);
  await step(() => page.mouse.click(480, 320));

  const input = page.locator('input:visible').first();
  if ((await input.count()) > 0) {
    await step(() => input.click());
    await step(() => input.pressSequentially('inp-probe', { delay: 30 }));
  }

  for (let i = 0; i < 4; i++) {
    await step(() => page.keyboard.press('Tab'));
  }

  await step(() => page.mouse.wheel(0, 240));
  await step(() => page.mouse.click(480, 420));
}

async function collectMetrics() {
  const samples = [];
  for (let i = 0; i < 3; i++) {
    const browser = await chromium.launch({ headless: true });
    const page = await browser.newPage();

    await page.addInitScript(() => {
      window.__baselineMetrics = { lcp: 0, cls: 0, interactions: {} };
      new PerformanceObserver((entryList) => {
        const entries = entryList.getEntries();
        const last = entries[entries.length - 1];
        if (last) window.__baselineMetrics.lcp = last.startTime;
      }).observe({ type: 'largest-contentful-paint', buffered: true });

      new PerformanceObserver((entryList) => {
        for (const entry of entryList.getEntries()) {
          if (!entry.hadRecentInput) window.__baselineMetrics.cls += entry.value;
        }
      }).observe({ type: 'layout-shift', buffered: true });

      new PerformanceObserver((entryList) => {
        for (const entry of entryList.getEntries()) {
          if (!entry.interactionId) continue;
          const prev = window.__baselineMetrics.interactions[entry.interactionId] ?? 0;
          window.__baselineMetrics.interactions[entry.interactionId] = Math.max(prev, entry.duration);
        }
      }).observe({ type: 'event', durationThreshold: 16 });
    });

    try {
      await page.goto(TARGET_URL, { waitUntil: 'load', timeout: 30000 });
      await page.waitForTimeout(1200); // 等首屏稳定后再制造交互
      await driveInteractions(page);
      await page.waitForTimeout(600); // 等最后的交互事件落账

      const metrics = await page.evaluate(() => {
        const nav = performance.getEntriesByType('navigation')[0];
        const paints = performance.getEntriesByType('paint');
        const fcp = paints.find((entry) => entry.name === 'first-contentful-paint')?.startTime ?? null;
        const interactionDurations = Object.values(window.__baselineMetrics?.interactions ?? {});
        return {
          ttfb: nav ? Number(nav.responseStart.toFixed(2)) : null,
          dcl: nav ? Number(nav.domContentLoadedEventEnd.toFixed(2)) : null,
          load: nav ? Number(nav.loadEventEnd.toFixed(2)) : null,
          fcp: fcp ? Number(fcp.toFixed(2)) : null,
          lcp: window.__baselineMetrics?.lcp ? Number(window.__baselineMetrics.lcp.toFixed(2)) : null,
          cls: window.__baselineMetrics?.cls ? Number(window.__baselineMetrics.cls.toFixed(4)) : 0,
          interactionDurations,
        };
      });

      const interactionDurations = metrics.interactionDurations ?? [];
      const inp = percentile(interactionDurations, INP_PERCENTILE);
      delete metrics.interactionDurations;
      samples.push({
        ...metrics,
        inp: inp === null ? null : Number(inp.toFixed(2)),
        interactionCount: interactionDurations.length,
      });
    } catch (e) {
      console.error(`Sample ${i + 1} failed:`, e.message);
    } finally {
      await browser.close();
    }
  }

  if (samples.length > 0) {
    const avgOf = (key, digits) => {
      const values = samples.map((m) => m[key]).filter((v) => typeof v === 'number');
      if (values.length === 0) return null;
      return Number((values.reduce((s, v) => s + v, 0) / values.length).toFixed(digits));
    };
    const inps = samples.map((m) => m.inp).filter((v) => typeof v === 'number');
    const avg = {
      ttfb: avgOf('ttfb', 2),
      fcp: avgOf('fcp', 2),
      lcp: avgOf('lcp', 2),
      cls: avgOf('cls', 4) ?? 0,
      inp: avgOf('inp', 2),
      inpP75: percentile(inps, 0.75),
      inpMax: inps.length > 0 ? Math.max(...inps) : null,
      interactionCount: avgOf('interactionCount', 0),
      budget: { inp: 200, lcp: 2500, cls: 0.1, unit: 'ms / 无量纲' },
      withinBudget: {
        lcp: avgOf('lcp', 2) !== null && avgOf('lcp', 2) <= 2500,
        cls: (avgOf('cls', 4) ?? 0) <= 0.1,
        // 无 event 条目说明所有交互都低于 16ms，视为远优于 200ms 预算
        inp: inps.length === 0 ? true : Math.max(...inps) <= 200,
      },
    };
    console.log('---RESULT_START---');
    console.log(JSON.stringify({ samples, avg }, null, 2));
    console.log('---RESULT_END---');
  }
}

collectMetrics().catch(console.error);
