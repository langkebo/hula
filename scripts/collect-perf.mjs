import { chromium } from '@playwright/test';

async function collectMetrics() {
  const samples = [];
  for (let i = 0; i < 3; i++) {
    const browser = await chromium.launch({ headless: true });
    const page = await browser.newPage();
    
    await page.addInitScript(() => {
      window.__baselineMetrics = { lcp: 0, cls: 0 };
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
    });

    try {
      await page.goto('http://127.0.0.1:4175/', { waitUntil: 'load', timeout: 30000 });
      await page.waitForTimeout(2000); // Wait for potential late shifts/renders
      
      const metrics = await page.evaluate(() => {
        const nav = performance.getEntriesByType('navigation')[0];
        const paints = performance.getEntriesByType('paint');
        const fcp = paints.find((entry) => entry.name === 'first-contentful-paint')?.startTime ?? null;
        return {
          ttfb: nav ? Number(nav.responseStart.toFixed(2)) : null,
          dcl: nav ? Number(nav.domContentLoadedEventEnd.toFixed(2)) : null,
          load: nav ? Number(nav.loadEventEnd.toFixed(2)) : null,
          fcp: fcp ? Number(fcp.toFixed(2)) : null,
          lcp: window.__baselineMetrics?.lcp ? Number(window.__baselineMetrics.lcp.toFixed(2)) : null,
          cls: window.__baselineMetrics?.cls ? Number(window.__baselineMetrics.cls.toFixed(4)) : 0,
        };
      });
      samples.push(metrics);
    } catch (e) {
      console.error(`Sample ${i+1} failed:`, e.message);
    } finally {
      await browser.close();
    }
  }
  
  if (samples.length > 0) {
    const avg = {
      ttfb: (samples.reduce((s, m) => s + (m.ttfb || 0), 0) / samples.length).toFixed(2),
      fcp: (samples.reduce((s, m) => s + (m.fcp || 0), 0) / samples.length).toFixed(2),
      lcp: (samples.reduce((s, m) => s + (m.lcp || 0), 0) / samples.length).toFixed(2),
      cls: (samples.reduce((s, m) => s + (m.cls || 0), 0) / samples.length).toFixed(4),
    };
    console.log('---RESULT_START---');
    console.log(JSON.stringify({ samples, avg }, null, 2));
    console.log('---RESULT_END---');
  }
}

collectMetrics().catch(console.error);
