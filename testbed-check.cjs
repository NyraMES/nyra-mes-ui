const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push('PAGEERROR: ' + e.message));
  page.on('console', (msg) => {
    if (msg.type() === 'error') errors.push('CONSOLE: ' + msg.text());
  });
  await page.goto('https://nyraservices-testbed.net/mes/', { waitUntil: 'networkidle', timeout: 60000 });
  await page.waitForTimeout(3000);
  const rootText = await page.locator('#root').innerText().catch(() => '');
  const rootHtml = await page.locator('#root').innerHTML().catch(() => '');
  console.log('ROOT_TEXT_LEN:', rootText.length);
  console.log('ROOT_HTML_LEN:', rootHtml.length);
  console.log('ROOT_PREVIEW:', rootText.slice(0, 200));
  console.log('TITLE:', await page.title());
  console.log('ERRORS:', errors.length ? errors.join('\n') : '(none)');
  await browser.close();
})();
