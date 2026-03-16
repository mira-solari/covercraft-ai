const { chromium } = require('playwright');
const fs = require('fs');
const https = require('https');

const EMAIL = 'support@applyfaster.ai'; // Different alias from Reddit
const PASSWORD = 'AF2026Launch!Secure';
const HANDLE = 'applyfaster';

const client = JSON.parse(fs.readFileSync('/Users/openclaw/.openclaw/credentials/email/gmail-oauth-client.json'));
const tokens = JSON.parse(fs.readFileSync('/Users/openclaw/.openclaw/credentials/email/gmail-oauth-tokens.json'));
const captchaKey = JSON.parse(fs.readFileSync('/Users/openclaw/.openclaw/credentials/2captcha.json')).api_key;

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

function waitForCode(accessToken, searchQuery, afterTs) {
  return new Promise(async (resolve) => {
    for (let i = 0; i < 12; i++) {
      const code = await new Promise((res) => {
        const q = encodeURIComponent(searchQuery + ' newer_than:3m');
        https.get(`https://gmail.googleapis.com/gmail/v1/users/me/messages?maxResults=1&q=${q}`,
          { headers: { Authorization: 'Bearer ' + accessToken } },
          (r) => { let b=''; r.on('data',d=>b+=d); r.on('end',()=>{
            const msgs = JSON.parse(b);
            if (!msgs.messages?.[0]) return res(null);
            https.get(`https://gmail.googleapis.com/gmail/v1/users/me/messages/${msgs.messages[0].id}?format=full`,
              { headers: { Authorization: 'Bearer ' + accessToken } },
              (r2) => { let b2=''; r2.on('data',d=>b2+=d); r2.on('end',()=>{
                const msg = JSON.parse(b2);
                const ts = parseInt(msg.internalDate || '0');
                if (ts < afterTs) return res(null);
                let text = '';
                const subj = msg.payload?.headers?.find(h=>h.name==='Subject')?.value||'';
                if (msg.payload?.body?.data) text = Buffer.from(msg.payload.body.data, 'base64').toString();
                else if (msg.payload?.parts) {
                  for (const part of msg.payload.parts) {
                    if (part.body?.data) text += Buffer.from(part.body.data, 'base64').toString();
                  }
                }
                const match = (subj + ' ' + text).match(/(\d{5,8})/);
                res(match ? match[1] : null);
              }); });
          }); });
      });
      if (code) return resolve(code);
      console.log(`  Waiting for code... (${i+1}/12)`);
      await new Promise(r => setTimeout(r, 5000));
    }
    resolve(null);
  });
}

// Solve Arkose CAPTCHA via 2Captcha
function solveArkose(publicKey, pageUrl) {
  return new Promise(async (resolve, reject) => {
    console.log('  Submitting Arkose challenge to 2Captcha...');
    const submitUrl = `https://2captcha.com/in.php?key=${captchaKey}&method=funcaptcha&publickey=${publicKey}&surl=https://client-api.arkoselabs.com&pageurl=${encodeURIComponent(pageUrl)}&json=1`;
    
    https.get(submitUrl, (res) => {
      let body = ''; res.on('data', d => body += d);
      res.on('end', async () => {
        const result = JSON.parse(body);
        if (result.status !== 1) return reject(new Error('2Captcha submit failed: ' + body));
        const taskId = result.request;
        console.log('  2Captcha task:', taskId);
        
        // Poll for result
        for (let i = 0; i < 30; i++) {
          await new Promise(r => setTimeout(r, 5000));
          const token = await new Promise((res) => {
            https.get(`https://2captcha.com/res.php?key=${captchaKey}&action=get&id=${taskId}&json=1`, (r) => {
              let b = ''; r.on('data', d => b += d);
              r.on('end', () => {
                const result = JSON.parse(b);
                if (result.status === 1) res(result.request);
                else if (result.request === 'CAPCHA_NOT_READY') res(null);
                else { console.log('  2Captcha poll:', b); res(null); }
              });
            });
          });
          if (token) {
            console.log('  Arkose solved!');
            return resolve(token);
          }
          console.log(`  Solving... (${i+1}/30)`);
        }
        reject(new Error('2Captcha timeout'));
      });
    });
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
    console.log('Step 1: Navigate to signup...');
    await page.goto('https://x.com/i/flow/signup', { waitUntil: 'domcontentloaded', timeout: 20000 });
    await page.waitForTimeout(3000);

    // Click "Create account"
    const createBtn = await page.$('text=Create account');
    if (createBtn) {
      const box = await createBtn.boundingBox();
      await page.mouse.move(box.x + box.width/2, box.y + box.height/2, { steps: 10 });
      await page.waitForTimeout(200);
      await page.mouse.click(box.x + box.width/2, box.y + box.height/2);
    }
    await page.waitForTimeout(3000);

    console.log('Step 2: Fill form...');
    // Name
    await page.fill('input[name="name"]', 'ApplyFaster');
    await page.waitForTimeout(500);

    // Switch to email
    const emailBtn = await page.$('text=Use email instead');
    if (emailBtn) {
      const box = await emailBtn.boundingBox();
      await page.mouse.click(box.x + box.width/2, box.y + box.height/2);
    }
    await page.waitForTimeout(1000);
    await page.fill('input[name="email"]', EMAIL);
    await page.waitForTimeout(500);

    // DOB
    const selects = await page.$$('select');
    if (selects.length >= 3) {
      await selects[0].selectOption({ index: 6 });
      await selects[1].selectOption({ index: 15 });
      try { await selects[2].selectOption('1995'); } catch { await selects[2].selectOption({ index: 25 }); }
    }
    await page.waitForTimeout(1000);

    // Click Next
    console.log('Step 3: Click Next...');
    const nextBtns = await page.$$('button');
    for (const btn of nextBtns) {
      const text = await btn.textContent();
      const box = await btn.boundingBox();
      if (text?.trim() === 'Next' && box) {
        await page.mouse.move(box.x + box.width/2, box.y + box.height/2, { steps: 10 });
        await page.waitForTimeout(200);
        await page.mouse.click(box.x + box.width/2, box.y + box.height/2);
        break;
      }
    }
    await page.waitForTimeout(3000);

    // Skip customization if present
    let headings = await page.evaluate(() => [...document.querySelectorAll('h1')].map(h => h.textContent.trim()));
    console.log('  Current step:', headings);
    if (headings.some(h => h.includes('Customize'))) {
      const nextBtn2 = await page.$('button:has-text("Next")');
      if (nextBtn2) {
        const box = await nextBtn2.boundingBox();
        await page.mouse.click(box.x + box.width/2, box.y + box.height/2);
      }
      await page.waitForTimeout(3000);
    }

    // Click "Sign up"
    headings = await page.evaluate(() => [...document.querySelectorAll('h1')].map(h => h.textContent.trim()));
    console.log('  Current step:', headings);
    if (headings.some(h => h.includes('Create your account'))) {
      const signupBtn = await page.$('[data-testid="OCF_SignupButton"]');
      if (signupBtn) {
        const box = await signupBtn.boundingBox();
        await page.mouse.click(box.x + box.width/2, box.y + box.height/2);
      } else {
        // Try finding Sign up button
        const btns = await page.$$('button');
        for (const btn of btns) {
          const text = await btn.textContent();
          if (text?.trim() === 'Sign up') {
            const box = await btn.boundingBox();
            await page.mouse.click(box.x + box.width/2, box.y + box.height/2);
            break;
          }
        }
      }
      await page.waitForTimeout(5000);
    }

    await page.screenshot({ path: 'screenshots/twitter-step3.png' });
    headings = await page.evaluate(() => [...document.querySelectorAll('h1, h2')].map(h => h.textContent.trim()));
    console.log('  After signup:', headings);
    
    // Check for Arkose CAPTCHA
    const bodyText = await page.textContent('body').catch(() => '');
    if (bodyText.includes('Authenticate') || bodyText.includes('real person')) {
      console.log('Step 4: Arkose CAPTCHA detected, solving...');
      
      // Find the Arkose public key from the page
      const arkoseKey = await page.evaluate(() => {
        const scripts = document.querySelectorAll('script');
        for (const s of scripts) {
          const match = s.textContent?.match(/public_key['":\s]+([A-F0-9-]+)/i);
          if (match) return match[1];
        }
        // Try iframe src
        const iframes = document.querySelectorAll('iframe');
        for (const f of iframes) {
          const match = f.src?.match(/pk=([A-F0-9-]+)/i);
          if (match) return match[1];
        }
        return null;
      });
      
      console.log('  Arkose key:', arkoseKey);
      
      if (arkoseKey) {
        try {
          const token = await solveArkose(arkoseKey, 'https://x.com/i/flow/signup');
          // Inject the token
          await page.evaluate((t) => {
            // Try to find the callback function
            if (window.ArkoseEnforcement) {
              window.ArkoseEnforcement.setConfig({ data: { token: t } });
            }
            // Or inject via the hidden input
            const inputs = document.querySelectorAll('input[name*="token"], input[name*="arkose"]');
            inputs.forEach(i => { i.value = t; i.dispatchEvent(new Event('input', { bubbles: true })); });
          }, token);
          await page.waitForTimeout(3000);
        } catch (e) {
          console.log('  CAPTCHA solve failed:', e.message);
        }
      } else {
        // Click Authenticate button and see what happens
        const authBtn = await page.$('text=Authenticate');
        if (authBtn) {
          const box = await authBtn.boundingBox();
          await page.mouse.click(box.x + box.width/2, box.y + box.height/2);
          await page.waitForTimeout(10000);
          await page.screenshot({ path: 'screenshots/twitter-captcha.png' });
        }
      }
    }

    // Check for email verification
    headings = await page.evaluate(() => [...document.querySelectorAll('h1, h2')].map(h => h.textContent.trim()));
    console.log('  Current:', headings);
    
    if (headings.some(h => h.toLowerCase().includes('verif') || h.toLowerCase().includes('code'))) {
      console.log('Step 5: Email verification...');
      const code = await waitForCode(accessToken, 'from:info@x.com OR from:verify@x.com', beforeTs);
      console.log('  Code:', code);
      if (code) {
        const codeInput = await page.$('input[name="verfication_code"]') || await page.$('input[data-testid="ocfEnterTextTextInput"]');
        if (codeInput) {
          await codeInput.fill(code);
          await page.waitForTimeout(500);
          const nextBtn = await page.$('button:has-text("Next")');
          if (nextBtn) {
            const box = await nextBtn.boundingBox();
            await page.mouse.click(box.x + box.width/2, box.y + box.height/2);
          }
          await page.waitForTimeout(3000);
        }
      }
    }

    // Password step
    headings = await page.evaluate(() => [...document.querySelectorAll('h1')].map(h => h.textContent.trim()));
    if (headings.some(h => h.toLowerCase().includes('password'))) {
      console.log('Step 6: Password...');
      const pwInput = await page.$('input[name="password"]') || await page.$('input[type="password"]');
      if (pwInput) {
        await pwInput.fill(PASSWORD);
        await page.waitForTimeout(1000);
        // This step has "Sign up" not "Next"
        const allBtns = await page.$$('button');
        for (const btn of allBtns) {
          const text = await btn.textContent();
          const box = await btn.boundingBox();
          if ((text?.trim() === 'Sign up' || text?.trim() === 'Next') && box) {
            console.log('  Clicking: ' + text.trim());
            await page.mouse.move(box.x + box.width/2, box.y + box.height/2, { steps: 10 });
            await page.waitForTimeout(200);
            await page.mouse.click(box.x + box.width/2, box.y + box.height/2);
            break;
          }
        }
        await page.waitForTimeout(5000);
      }
    }

    // Username step
    headings = await page.evaluate(() => [...document.querySelectorAll('h1')].map(h => h.textContent.trim()));
    if (headings.some(h => h.toLowerCase().includes('username') || h.toLowerCase().includes('pick'))) {
      console.log('Step 7: Username...');
      const usernameInput = await page.$('input[name="username"]');
      if (usernameInput) {
        await usernameInput.fill('');
        await usernameInput.fill(HANDLE);
        await page.waitForTimeout(2000);
        const nextBtn = await page.$('button:has-text("Next")');
        if (nextBtn) {
          const box = await nextBtn.boundingBox();
          await page.mouse.click(box.x + box.width/2, box.y + box.height/2);
        }
        await page.waitForTimeout(5000);
      }
    }

    // Handle post-signup steps (profile pic, interests, etc.)
    for (let i = 0; i < 8; i++) {
      headings = await page.evaluate(() => [...document.querySelectorAll('h1')].map(h => h.textContent.trim()));
      console.log('  Post-signup step:', headings);
      
      // Username step
      if (headings.some(h => h.toLowerCase().includes('username') || h.toLowerCase().includes('pick'))) {
        console.log('  Setting username...');
        const usernameInput = await page.$('input[name="username"]');
        if (usernameInput) {
          await usernameInput.fill('');
          await usernameInput.fill(HANDLE);
          await page.waitForTimeout(2000);
        }
      }

      // Try Skip for now
      const skipBtn = await page.$('text=Skip for now');
      if (skipBtn) {
        const box = await skipBtn.boundingBox();
        if (box) {
          console.log('  Skipping...');
          await page.mouse.click(box.x + box.width/2, box.y + box.height/2);
          await page.waitForTimeout(3000);
          continue;
        }
      }

      // Try Next
      const nextBtn = await page.$$('button');
      let clicked = false;
      for (const btn of nextBtn) {
        const text = await btn.textContent();
        const box = await btn.boundingBox();
        if ((text?.trim() === 'Next' || text?.trim() === 'Skip') && box) {
          await page.mouse.click(box.x + box.width/2, box.y + box.height/2);
          await page.waitForTimeout(3000);
          clicked = true;
          break;
        }
      }
      if (!clicked) break;
    }

    await page.screenshot({ path: 'screenshots/twitter-final2.png' });
    console.log('Final URL:', page.url());

    const cookies = await ctx.cookies();
    fs.writeFileSync('/Users/openclaw/.openclaw/credentials/twitter-applyfaster-cookies.json', JSON.stringify(cookies, null, 2));
    console.log('Cookies saved');

  } catch (e) {
    console.error('Error:', e.message);
    await page.screenshot({ path: 'screenshots/twitter-error2.png' }).catch(() => {});
  }

  await browser.close();
})();
