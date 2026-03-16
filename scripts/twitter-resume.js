const { chromium } = require('playwright');
const fs = require('fs');

const cookies = JSON.parse(fs.readFileSync('/Users/openclaw/.openclaw/credentials/twitter-applyfaster-cookies.json'));

(async () => {
  const browser = await chromium.launch({ headless: false, channel: 'chrome', args: ['--disable-blink-features=AutomationControlled'] });
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  await ctx.addInitScript(() => { Object.defineProperty(navigator, 'webdriver', { get: () => false }); });
  await ctx.addCookies(cookies);
  const page = await ctx.newPage();

  console.log('Resuming Twitter signup...');
  await page.goto('https://x.com/i/flow/signup', { waitUntil: 'domcontentloaded', timeout: 20000 });
  await page.waitForTimeout(5000);

  await page.screenshot({ path: 'screenshots/twitter-resume1.png' });
  const headings = await page.evaluate(() => [...document.querySelectorAll('h1')].map(h => h.textContent.trim()));
  console.log('Current step:', headings);

  // Fill password if the field exists
  const pwInput = await page.$('input[type="password"]');
  if (pwInput) {
    console.log('Filling password...');
    await pwInput.fill('AF2026Launch!Secure');
    await page.waitForTimeout(1000);
  }

  // Find and click Sign up button
  const btns = await page.$$('button');
  for (const btn of btns) {
    const text = await btn.textContent();
    const box = await btn.boundingBox();
    if (text?.trim() === 'Sign up' && box) {
      console.log('Clicking Sign up at y=' + Math.round(box.y));
      await page.mouse.move(box.x + box.width/2, box.y + box.height/2, { steps: 12 });
      await page.waitForTimeout(300);
      await page.mouse.click(box.x + box.width/2, box.y + box.height/2);
      break;
    }
  }
  await page.waitForTimeout(10000);

  await page.screenshot({ path: 'screenshots/twitter-resume2.png' });
  console.log('URL:', page.url());
  const newHeadings = await page.evaluate(() => [...document.querySelectorAll('h1')].map(h => h.textContent.trim()));
  console.log('After click:', newHeadings);

  // Handle username step if we get there
  if (newHeadings.some(h => h.toLowerCase().includes('username') || h.toLowerCase().includes('pick'))) {
    console.log('Setting username to applyfaster...');
    const usernameInput = await page.$('input[name="username"]');
    if (usernameInput) {
      await usernameInput.fill('');
      await usernameInput.fill('applyfaster');
      await page.waitForTimeout(2000);
      
      const nextBtns = await page.$$('button');
      for (const btn of nextBtns) {
        const text = await btn.textContent();
        const box = await btn.boundingBox();
        if (text?.trim() === 'Next' && box) {
          await page.mouse.click(box.x + box.width/2, box.y + box.height/2);
          break;
        }
      }
      await page.waitForTimeout(5000);
    }
  }

  // Handle profile picture / interests / any other steps
  for (let i = 0; i < 5; i++) {
    const h = await page.evaluate(() => [...document.querySelectorAll('h1')].map(h => h.textContent.trim()));
    console.log('Step:', h);
    
    // Try to skip optional steps
    const skipBtn = await page.$('text=Skip for now');
    if (skipBtn) {
      const box = await skipBtn.boundingBox();
      if (box) {
        await page.mouse.click(box.x + box.width/2, box.y + box.height/2);
        await page.waitForTimeout(3000);
        continue;
      }
    }
    
    const nextBtn = await page.$('button:has-text("Next")');
    if (nextBtn) {
      const box = await nextBtn.boundingBox();
      if (box) {
        await page.mouse.click(box.x + box.width/2, box.y + box.height/2);
        await page.waitForTimeout(3000);
        continue;
      }
    }
    break;
  }

  await page.screenshot({ path: 'screenshots/twitter-final3.png' });
  console.log('Final URL:', page.url());

  const finalCookies = await ctx.cookies();
  fs.writeFileSync('/Users/openclaw/.openclaw/credentials/twitter-applyfaster-cookies.json', JSON.stringify(finalCookies, null, 2));
  console.log('Cookies saved');

  await browser.close();
})();
