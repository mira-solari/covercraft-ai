const { chromium } = require('playwright');
const fs = require('fs');

(async () => {
  const browser = await chromium.launch({ 
    headless: true, 
    args: ['--disable-blink-features=AutomationControlled'] 
  });
  const ctx = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/134.0.0.0 Safari/537.36',
    viewport: { width: 1280, height: 900 }
  });
  const page = await ctx.newPage();

  try {
    // Step 1: Email
    console.log('Step 1: Entering email...');
    await page.goto('https://www.reddit.com/register', { waitUntil: 'domcontentloaded', timeout: 15000 });
    await page.waitForTimeout(2000);
    
    // Focus email field and type
    await page.evaluate(() => {
      const inp = document.querySelector('faceplate-text-input[name=email]')?.shadowRoot?.querySelector('input');
      if (inp) inp.focus();
    });
    await page.keyboard.type('mira@elysianventures.vc', { delay: 30 });
    await page.waitForTimeout(500);
    
    // Click the FIRST Continue button specifically
    await page.evaluate(() => {
      const btns = [...document.querySelectorAll('button')];
      const cont = btns.find(b => b.textContent.trim() === 'Continue' && !b.disabled);
      if (cont) cont.click();
      else console.log('No enabled Continue found');
    });
    await page.waitForTimeout(3000);
    console.log('Email submitted');

    // Step 2: Skip verification
    console.log('Step 2: Skipping verification...');
    await page.evaluate(() => {
      const btns = [...document.querySelectorAll('button')];
      const skip = btns.find(b => b.textContent.trim().toLowerCase() === 'skip');
      if (skip) skip.click();
    });
    await page.waitForTimeout(3000);
    console.log('Skipped verification');

    // Step 3: Username and password
    console.log('Step 3: Setting username and password...');
    
    // Clear and type username
    await page.evaluate(() => {
      const inp = document.querySelector('faceplate-text-input[name=username]')?.shadowRoot?.querySelector('input');
      if (inp) { inp.focus(); inp.select(); }
    });
    await page.waitForTimeout(200);
    await page.keyboard.type('covercraft_team', { delay: 40 });
    await page.waitForTimeout(1500);
    
    // Type password
    await page.evaluate(() => {
      const inp = document.querySelector('faceplate-text-input[name=password]')?.shadowRoot?.querySelector('input');
      if (inp) inp.focus();
    });
    await page.waitForTimeout(200);
    await page.keyboard.type('CcL4unch2026!Ev', { delay: 40 });
    await page.waitForTimeout(2000);
    
    await page.screenshot({ path: 'screenshots/reddit-prefinal.png' });
    
    // Find the correct Continue button (the one for step 3, not steps 1 or 2)
    const clicked = await page.evaluate(() => {
      const btns = [...document.querySelectorAll('button')];
      // Get all Continue buttons that are not disabled
      const contBtns = btns.filter(b => b.textContent.trim() === 'Continue');
      const info = contBtns.map(b => ({ disabled: b.disabled, visible: b.offsetParent !== null, classes: b.className.substring(0, 50) }));
      console.log('All continue buttons:', JSON.stringify(info));
      
      // Click the last enabled one
      const enabled = contBtns.filter(b => !b.disabled && b.offsetParent !== null);
      if (enabled.length > 0) {
        enabled[enabled.length - 1].click();
        return true;
      }
      return false;
    });
    console.log('Clicked continue:', clicked);
    
    await page.waitForTimeout(5000);
    await page.screenshot({ path: 'screenshots/reddit-final.png' });
    console.log('Final URL:', page.url());
    
    // Check if we're logged in
    const cookies = await ctx.cookies();
    const authCookie = cookies.find(c => c.name.includes('token') || c.name.includes('session'));
    console.log('Auth cookie found:', !!authCookie);
    
    fs.writeFileSync('../../.openclaw/credentials/reddit-cookies.json', JSON.stringify(cookies, null, 2));
    console.log('Saved cookies');
    
  } catch(e) {
    console.error('Error:', e.message);
    await page.screenshot({ path: 'screenshots/reddit-error.png' }).catch(() => {});
  }
  
  await browser.close();
})();
