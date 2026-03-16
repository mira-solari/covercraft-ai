const { chromium } = require('playwright');
const fs = require('fs');
const https = require('https');

async function getLatestRedditCode() {
  const client = JSON.parse(fs.readFileSync('/Users/openclaw/.openclaw/credentials/email/gmail-oauth-client.json'));
  const tokens = JSON.parse(fs.readFileSync('/Users/openclaw/.openclaw/credentials/email/gmail-oauth-tokens.json'));
  
  return new Promise((resolve, reject) => {
    const req = https.get(
      'https://gmail.googleapis.com/gmail/v1/users/me/messages?maxResults=1&q=from:noreply@redditmail.com+subject:verification+code',
      { headers: { Authorization: 'Bearer ' + tokens.access_token } },
      (res) => {
        let body = '';
        res.on('data', d => body += d);
        res.on('end', () => {
          const msgs = JSON.parse(body);
          if (msgs.messages?.[0]) {
            const msgReq = https.get(
              'https://gmail.googleapis.com/gmail/v1/users/me/messages/' + msgs.messages[0].id + '?format=metadata&metadataHeaders=Subject',
              { headers: { Authorization: 'Bearer ' + tokens.access_token } },
              (msgRes) => {
                let msgBody = '';
                msgRes.on('data', d => msgBody += d);
                msgRes.on('end', () => {
                  const msg = JSON.parse(msgBody);
                  const subject = msg.payload?.headers?.find(h => h.name === 'Subject')?.value || '';
                  const code = subject.match(/(\d{6})/)?.[1];
                  resolve(code);
                });
              }
            );
          } else resolve(null);
        });
      }
    );
  });
}

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
    console.log('Step 1: Email...');
    await page.goto('https://www.reddit.com/register', { waitUntil: 'domcontentloaded', timeout: 15000 });
    await page.waitForTimeout(2000);
    await page.evaluate(() => {
      const inp = document.querySelector('faceplate-text-input[name=email]')?.shadowRoot?.querySelector('input');
      if (inp) inp.focus();
    });
    await page.keyboard.type('mira@elysianventures.vc', { delay: 30 });
    await page.waitForTimeout(500);
    await page.evaluate(() => {
      const btns = [...document.querySelectorAll('button')];
      const cont = btns.find(b => b.textContent.trim() === 'Continue' && !b.disabled);
      if (cont) cont.click();
    });
    await page.waitForTimeout(4000);
    console.log('Email submitted, waiting for code...');
    
    // Wait a bit for email to arrive
    await page.waitForTimeout(3000);
    
    // Get the verification code from email
    const code = await getLatestRedditCode();
    console.log('Got verification code:', code);
    
    if (!code) {
      console.error('No verification code found!');
      await browser.close();
      return;
    }
    
    // Step 2: Enter verification code
    console.log('Step 2: Entering code...');
    await page.evaluate(() => {
      const inp = document.querySelector('faceplate-text-input[name=code]')?.shadowRoot?.querySelector('input');
      if (inp) inp.focus();
    });
    await page.keyboard.type(code, { delay: 50 });
    await page.waitForTimeout(1000);
    
    // Click Continue for verification
    await page.evaluate(() => {
      const btns = [...document.querySelectorAll('button')];
      const cont = btns.filter(b => b.textContent.trim() === 'Continue' && !b.disabled);
      if (cont.length > 0) cont[cont.length - 1].click();
    });
    await page.waitForTimeout(4000);
    console.log('Code submitted');
    
    await page.screenshot({ path: 'screenshots/reddit-after-code.png' });
    
    // Step 3: Username and password
    console.log('Step 3: Username and password...');
    
    // Check what step we're on
    const stepInfo = await page.evaluate(() => {
      const headings = [...document.querySelectorAll('h1')].map(h => h.textContent.trim());
      return headings;
    });
    console.log('Current headings:', stepInfo);
    
    // Set username
    await page.evaluate(() => {
      const inp = document.querySelector('faceplate-text-input[name=username]')?.shadowRoot?.querySelector('input');
      if (inp) { inp.focus(); inp.select(); }
    });
    await page.waitForTimeout(200);
    await page.keyboard.type('covercraft_team', { delay: 40 });
    await page.waitForTimeout(2000);
    
    // Set password
    await page.evaluate(() => {
      const inp = document.querySelector('faceplate-text-input[name=password]')?.shadowRoot?.querySelector('input');
      if (inp) inp.focus();
    });
    await page.waitForTimeout(200);
    await page.keyboard.type('CcL4unch2026!Ev', { delay: 40 });
    await page.waitForTimeout(2000);
    
    await page.screenshot({ path: 'screenshots/reddit-creds.png' });
    
    // Click Continue
    const clicked = await page.evaluate(() => {
      const btns = [...document.querySelectorAll('button')];
      const cont = btns.filter(b => b.textContent.trim() === 'Continue' && !b.disabled && b.offsetParent !== null);
      if (cont.length > 0) {
        cont[cont.length - 1].click();
        return true;
      }
      return false;
    });
    console.log('Clicked continue:', clicked);
    await page.waitForTimeout(5000);
    
    await page.screenshot({ path: 'screenshots/reddit-final.png' });
    console.log('Final URL:', page.url());
    
    // Save cookies
    const cookies = await ctx.cookies();
    fs.writeFileSync('/Users/openclaw/.openclaw/credentials/reddit-cookies.json', JSON.stringify(cookies, null, 2));
    console.log('Saved', cookies.length, 'cookies');
    
  } catch(e) {
    console.error('Error:', e.message);
    await page.screenshot({ path: 'screenshots/reddit-error.png' }).catch(() => {});
  }
  
  await browser.close();
})();
