const { chromium } = require('@playwright/test');
const path = require('path');

(async () => {
  // Try system Chrome/Edge first (no download needed)
  const launchOptions = { channel: 'chrome' };
  const browser = await chromium.launch(launchOptions);
  const page = await browser.newPage();

  const htmlPath = path.resolve(__dirname, 'resume.html');
  await page.goto('file:///' + htmlPath.replace(/\\/g, '/'), { waitUntil: 'networkidle' });

  const outPath = 'C:\\Users\\26239\\Desktop\\项目优化流程\\朱想意-实施工程师-优化版.pdf';

  await page.pdf({
    path: outPath,
    format: 'A4',
    margin: {
      top: '36px',
      right: '28px',
      bottom: '36px',
      left: '28px'
    },
    printBackground: true,
    scale: 0.92
  });

  await browser.close();
  console.log('PDF已生成: ' + outPath);
})();
