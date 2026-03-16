const { chromium } = require('playwright');
const fs = require('fs');
const https = require('https');

const EMAIL = 'hello@applyfaster.ai';
const PASSWORD = 'AF2026Launch!Secure';

const client = JSON.parse(fs.readFileSync('/Users/openclaw/.openclaw/credentials/email/gmail-oauth-client.json'));
const tokens = JSON.parse(fs.readFileSync('/Users/openclaw/.openclaw/credentials/email/gmail-oauth-tokens.json'));

function refreshToken() {
  return new Promise((resolve) => {
    const data = new URLSearchParams({
      client_id: client.client_id, client_secret: client.client_secret,
      refresh_token: tokens.refresh_token, grant_type: 'refresh_token'
    });
    const req = https.request({
      hostname: 'oauth2.googleapis.com', path: '/token', method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
    }, (res) => {
      let body = ''; res.on('data', d => body += d);
      res.on('end', () => {
        const r = JSON.parse(body);
        if (r.access_token) {
          tokens.access_token = r.access_token;
          fs.writeFileSync('/Users/openclaw/.openclaw/credentials/email/gmail-oauth-tokens.json', JSON.stringify(tokens, null, 2));
        }
        resolve(tokens.access_token);
      });
    });
    req.write(data.toString()); req.end();
  });
}

function waitForNewCode(accessToken, afterTs) {
  return new Promise(async (resolve) => {
    for (let i = 0; i < 12; i++) {
      const code = await new Promise((res) => {
        const q = encodeURIComponent('from:noreply@redditmail.com subject:verification newer_than:3m');
        https.get(`https://gmail.googleapis.com/gmail/v1/users/me/messages?maxResults=1&q=${q}`,
          { headers: { Authorization: 'Bearer ' + accessToken } },
          (r) => { let b=''; r.on('data',d=>b+=d); r.on('end',()=>{
            const msgs = JSON.parse(b);
            if (!msgs.messages?.[0]) return res(null);
            https.get(`https://gmail.googleapis.com/gmail/v1/users/me/messages/${msgs.messages[0].id}?format=metadata&metadataHeaders=Subject`,
              { headers: { Authorization: 'Bearer ' + accessToken } },
              (r2) => { let b2=''; r2.on('data',d=>b2+=d); r2.on('end',()=>{
                const msg = JSON.parse(b2);
                const subj = msg.payload?.headers?.find(h=>h.name==='Subject')?.value||'';
                const ts = parseInt(msg.internalDate || '0');
                if (ts > afterTs) res(subj.match(/(\d{6})/)?.[1] || null);
                else res(null);
              }); });
          }); });
      });
      if (code) return resolve(code);
      console.log(`  Waiting for fresh code... (${i+1}/12)`);
      await new Promise(r => setTimeout(r, 5000));
    }
    resolve(null);
  });
}

(async () => {
  const accessToken = await refreshToken();
  console.log('Token refreshed');
  const beforeTs = Date.now();

  const browser = await chromium.launch({
    headless: false,
    channel: 'chrome',
    args: ['--disable-blink-features=AutomationControlled']
  });
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  await ctx.addInitScript(() => {
    Object.defineProperty(navigator, 'webdriver', { get: () => false });
  });
  const page = await ctx.newPage();

  try {
    // Step 1: Email
    console.log('Step 1: Email...');
    await page.goto('https://www.reddit.com/register', { waitUntil: 'domcontentloaded', timeout: 20000 });
    await page.waitForTimeout(3000);

    await page.evaluate(() => {
      document.querySelector('faceplate-text-input[name=email]')?.shadowRoot?.querySelector('input')?.focus();
    });
    await page.keyboard.type(EMAIL, { delay: 85 });
    await page.waitForTimeout(800);

    // Mouse click on Continue
    const btns1 = await page.$$('button');
    for (const btn of btns1) {
      const text = await btn.textContent();
      const disabled = await btn.getAttribute('disabled');
      if (text?.trim() === 'Continue' && disabled === null) {
        const box = await btn.boundingBox();
        if (box) {
          await page.mouse.move(box.x + box.width/2, box.y + box.height/2, { steps: 12 });
          await page.waitForTimeout(200);
          await page.mouse.click(box.x + box.width/2, box.y + box.height/2);
          console.log('  Clicked Continue');
          break;
        }
      }
    }
    await page.waitForTimeout(6000);

    // Step 2: Verification code
    console.log('Step 2: Waiting for fresh verification code...');
    const code = await waitForNewCode(accessToken, beforeTs);
    console.log('  Code:', code);

    if (!code) {
      console.log('  No code! Screenshot and exit.');
      await page.screenshot({ path: 'screenshots/reddit-nocode3.png' });
      await browser.close();
      return;
    }

    await page.evaluate(() => {
      document.querySelector('faceplate-text-input[name=code]')?.shadowRoot?.querySelector('input')?.focus();
    });
    await page.keyboard.type(code, { delay: 85 });
    await page.waitForTimeout(1500);

    // Click the verification Continue
    const btns2 = await page.$$('button');
    for (const btn of btns2) {
      const text = await btn.textContent();
      const disabled = await btn.getAttribute('disabled');
      const box = await btn.boundingBox();
      if (text?.trim() === 'Continue' && disabled === null && box && box.y > 200) {
        await page.mouse.move(box.x + box.width/2, box.y + box.height/2, { steps: 10 });
        await page.waitForTimeout(200);
        await page.mouse.click(box.x + box.width/2, box.y + box.height/2);
        console.log('  Clicked verification Continue at y=' + Math.round(box.y));
        break;
      }
    }
    await page.waitForTimeout(5000);

    // Step 3: Username
    console.log('Step 3: Username...');
    await page.evaluate(() => {
      const inp = document.querySelector('faceplate-text-input[name=username]')?.shadowRoot?.querySelector('input');
      if (inp) { inp.focus(); inp.select(); }
    });
    await page.waitForTimeout(500);
    await page.keyboard.type('applyfaster', { delay: 85 });
    await page.waitForTimeout(3000);

    // Step 4: Password
    console.log('Step 4: Password...');
    await page.evaluate(() => {
      document.querySelector('faceplate-text-input[name=password]')?.shadowRoot?.querySelector('input')?.focus();
    });
    await page.waitForTimeout(500);
    await page.keyboard.type(PASSWORD, { delay: 85 });
    await page.waitForTimeout(3000);

    // Step 5: Submit - find the LAST enabled Continue button
    console.log('Step 5: Submitting...');
    let lastBtn = null;
    const btns3 = await page.$$('button');
    for (const btn of btns3) {
      const text = await btn.textContent();
      const disabled = await btn.getAttribute('disabled');
      const box = await btn.boundingBox();
      if (text?.trim() === 'Continue' && disabled === null && box) {
        lastBtn = { btn, box };
      }
    }

    if (lastBtn) {
      console.log('  Clicking Continue at y=' + Math.round(lastBtn.box.y));
      await page.mouse.move(lastBtn.box.x + lastBtn.box.width/2, lastBtn.box.y + lastBtn.box.height/2, { steps: 15 });
      await page.waitForTimeout(300);
      await page.mouse.click(lastBtn.box.x + lastBtn.box.width/2, lastBtn.box.y + lastBtn.box.height/2);
    } else {
      console.log('  No Continue button found, pressing Enter');
      await page.keyboard.press('Enter');
    }

    await page.waitForTimeout(12000);

    // Check result
    await page.screenshot({ path: 'screenshots/reddit-headful3.png' });
    const url = page.url();
    console.log('Final URL:', url);

    const bodyText = await page.textContent('body').catch(() => '');
    if (url.includes('onboarding') || bodyText.includes('interests') || bodyText.includes('Welcome') || !url.includes('register')) {
      console.log('🎉 SUCCESS! Account created!');
      const cookies = await ctx.cookies();
      fs.writeFileSync('/Users/openclaw/.openclaw/credentials/reddit-applyfaster-cookies.json', JSON.stringify(cookies, null, 2));
      console.log('Cookies saved');
    } else if (bodyText.includes('Something went wrong')) {
      console.log('❌ Error again');
    } else {
      console.log('Unclear result - check screenshot');
    }

  } catch (e) {
    console.error('Error:', e.message);
    await page.screenshot({ path: 'screenshots/reddit-error3.png' }).catch(() => {});
  }

  await browser.close();
})();
