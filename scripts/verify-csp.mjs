import { chromium } from '@playwright/test';

async function verifyCSP() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  
  // Navigate to the app
  await page.goto('http://127.0.0.1:4173/');
  
  console.log('---CSP_VERIFICATION_START---');
  
  // 1. Try to execute an inline script (which should be blocked if 'unsafe-inline' is NOT present)
  // But we know 'unsafe-inline' IS present in the config.
  const inlineResult = await page.evaluate(() => {
    try {
      const script = document.createElement('script');
      script.textContent = 'window.__csp_test = "inline_executed";';
      document.body.appendChild(script);
      return window.__csp_test;
    } catch (e) {
      return 'blocked: ' + e.message;
    }
  });
  console.log('Inline script result:', inlineResult);

  // 2. Try to execute eval (which should be blocked if 'unsafe-eval' is NOT present)
  // But we know 'unsafe-eval' IS present in the config.
  const evalResult = await page.evaluate(() => {
    try {
      return eval('"eval_executed"');
    } catch (e) {
      return 'blocked: ' + e.message;
    }
  });
  console.log('Eval result:', evalResult);

  // 3. Try to fetch from an unauthorized domain
  const fetchResult = await page.evaluate(async () => {
    try {
      const res = await fetch('https://example.com');
      return 'fetched';
    } catch (e) {
      return 'blocked: ' + e.message;
    }
  });
  console.log('External fetch result:', fetchResult);

  await browser.close();
  console.log('---CSP_VERIFICATION_END---');
}

verifyCSP().catch(console.error);
