const { chromium } = require('playwright');
const fs = require('fs');
const https = require('https');

const EMAIL = 'team@applyfaster.ai';
const PASSWORD = 'AF2026Launch!Secure';
const HANDLE = 'applyfaster';

function refreshGmailToken() {
  return new Promise((resolve, reject) => {
    const client = JSON.parse(fs.readFileSync('/Users/openclaw/.openclaw/credentials/email/gmail-oauth-client.json'));
    const tokens = JSON.parse(fs.readFileSync('/Users/openclaw/.openclaw/credentials/email/gmail-oauth-tokens.json'));
    const data = new URLSearchParams({
      client_id: client.client_id,
      client_secret: client.client_secret,
      refresh_token: tokens.refresh_token,
      grant_type: 'refresh_token'
    });
    const req = https.request({
      hostname: 'oauth2.googleapis.com', path: '/token', method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
    }, (res) => {
      let body = '';
      res.on('data', d => body += d);
      res.on('end', () => {
        const result = JSON.parse(body);
        if (result.access_token) {
          tokens.access_token = result.access_token;
          fs.writeFileSync('/Users/openclaw/.openclaw/credentials/email/gmail-oauth-tokens.json', JSON.stringify(tokens, null, 2));
          resolve(result.access_token);
        } else reject(new Error('Token refresh failed'));
      });
    });
    req.write(data.toString());
    req.end();
  });
}

function getVerificationCode(accessToken, searchQuery, maxWaitMs = 30000) {
  return new Promise(async (resolve) => {
    const startTime = Date.now();
    while (Date.now() - startTime < maxWaitMs) {
      const code = await new Promise((res) => {
        const q = encodeURIComponent(searchQuery + ' newer_than:5m');
        https.get('https://gmail.googleapis.com/gmail/v1/users/me/messages?maxResults=1&q=' + q,
          { headers: { Authorization: 'Bearer ' + accessToken } },
          (r) => {
            let b = '';
            r.on('data', d => b += d);
            r.on('end', () => {
              const msgs = JSON.parse(b);
              if (!msgs.messages?.[0]) return res(null);
              https.get('https://gmail.googleapis.com/gmail/v1/users/me/messages/' + msgs.messages[0].id + '?format=full',
                { headers: { Authorization: 'Bearer ' + accessToken } },
                (r2) => {
                  let b2 = '';
                  r2.on('data', d => b2 += d);
                  r2.on('end', () => {
                    const msg = JSON.parse(b2);
                    let text = '';
                    const subj = msg.payload?.headers?.find(h => h.name === 'Subject')?.value || '';
                    if (msg.payload?.body?.data) text = Buffer.from(msg.payload.body.data, 'base64').toString();
                    else if (msg.payload?.parts) {
                      for (const part of msg.payload.parts) {
                        if (part.body?.data) text += Buffer.from(part.body.data, 'base64').toString();
                      }
                    }
                    const fullText = subj + ' ' + text;
                    const match = fullText.match(/(\d{5,8})/);
                    res(match ? match[1] : null);
                  });
                });
            });
          });
      });
      if (code) return resolve(code);
      console.log('  Waiting for verification email...');
      await new Promise(r => setTimeout(r, 5000));
    }
    resolve(null);
  });
}

async function registerReddit(accessToken) {
  console.log('\n=== REDDIT ===');
  const browser = await chromium.launch({ headless: true, args: ['--disable-blink-features=AutomationControlled'] });
  const ctx = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/134.0.0.0 Safari/537.36',
    viewport: { width: 1280, height: 900 }
  });
  const page = await ctx.newPage();

  try {
    await page.goto('https://www.reddit.com/register', { waitUntil: 'domcontentloaded', timeout: 15000 });
    await page.waitForTimeout(2000);

    // Email
    console.log('  Entering email...');
    await page.evaluate(() => {
      const inp = document.querySelector('faceplate-text-input[name=email]')?.shadowRoot?.querySelector('input');
      if (inp) inp.focus();
    });
    await page.keyboard.type(EMAIL, { delay: 30 });
    await page.waitForTimeout(500);
    await page.evaluate(() => {
      const btns = [...document.querySelectorAll('button')];
      const cont = btns.find(b => b.textContent.trim() === 'Continue' && !b.disabled);
      if (cont) cont.click();
    });
    await page.waitForTimeout(5000);

    // Get verification code
    console.log('  Waiting for Reddit verification code...');
    const code = await getVerificationCode(accessToken, 'from:noreply@redditmail.com subject:verification');
    if (!code) {
      console.log('  ❌ No verification code received');
      await page.screenshot({ path: 'screenshots/reddit-nocode.png' });
      await browser.close();
      return false;
    }
    console.log('  Got code:', code);

    // Enter code
    await page.evaluate(() => {
      const inp = document.querySelector('faceplate-text-input[name=code]')?.shadowRoot?.querySelector('input');
      if (inp) inp.focus();
    });
    await page.keyboard.type(code, { delay: 50 });
    await page.waitForTimeout(1000);
    await page.evaluate(() => {
      const btns = [...document.querySelectorAll('button')];
      const cont = btns.filter(b => b.textContent.trim() === 'Continue' && !b.disabled);
      if (cont.length > 0) cont[cont.length - 1].click();
    });
    await page.waitForTimeout(3000);

    // Username and password
    console.log('  Setting username and password...');
    await page.evaluate(() => {
      const inp = document.querySelector('faceplate-text-input[name=username]')?.shadowRoot?.querySelector('input');
      if (inp) { inp.focus(); inp.select(); }
    });
    await page.waitForTimeout(200);
    await page.keyboard.type(HANDLE, { delay: 40 });
    await page.waitForTimeout(2000);

    await page.evaluate(() => {
      const inp = document.querySelector('faceplate-text-input[name=password]')?.shadowRoot?.querySelector('input');
      if (inp) inp.focus();
    });
    await page.waitForTimeout(200);
    await page.keyboard.type(PASSWORD, { delay: 40 });
    await page.waitForTimeout(2000);

    // Click continue
    await page.evaluate(() => {
      const btns = [...document.querySelectorAll('button')];
      const cont = btns.filter(b => b.textContent.trim() === 'Continue' && !b.disabled && b.offsetParent !== null);
      if (cont.length > 0) cont[cont.length - 1].click();
    });
    await page.waitForTimeout(5000);

    await page.screenshot({ path: 'screenshots/reddit-result.png' });
    console.log('  Final URL:', page.url());

    const cookies = await ctx.cookies();
    fs.writeFileSync('/Users/openclaw/.openclaw/credentials/reddit-applyfaster-cookies.json', JSON.stringify(cookies, null, 2));
    console.log('  ✅ Reddit account saved');
    return true;
  } catch (e) {
    console.log('  ❌ Reddit error:', e.message);
    await page.screenshot({ path: 'screenshots/reddit-error.png' }).catch(() => {});
    return false;
  } finally {
    await browser.close();
  }
}

async function registerProductHunt(accessToken) {
  console.log('\n=== PRODUCT HUNT ===');
  const browser = await chromium.launch({ headless: true, args: ['--disable-blink-features=AutomationControlled'] });
  const ctx = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/134.0.0.0 Safari/537.36',
    viewport: { width: 1280, height: 900 }
  });
  const page = await ctx.newPage();

  try {
    await page.goto('https://www.producthunt.com/account/signup', { waitUntil: 'domcontentloaded', timeout: 15000 });
    await page.waitForTimeout(3000);

    await page.screenshot({ path: 'screenshots/ph-signup.png' });
    
    const elements = await page.evaluate(() => {
      return [...document.querySelectorAll('input, button, a')].slice(0, 20).map(el =>
        el.tagName + '[' + (el.name || el.type || el.href || '') + ']: ' + (el.textContent || el.placeholder || '').trim().substring(0, 50)
      ).filter(t => t.split(': ')[1]).join('\n');
    });
    console.log('  Page elements:\n  ' + elements.replace(/\n/g, '\n  '));
    
    return false; // Will need manual inspection
  } catch (e) {
    console.log('  ❌ Product Hunt error:', e.message);
    return false;
  } finally {
    await browser.close();
  }
}

(async () => {
  console.log('Refreshing Gmail token...');
  const accessToken = await refreshGmailToken();
  console.log('Token refreshed ✅');

  // Try Reddit
  await registerReddit(accessToken);

  // Try Product Hunt
  await registerProductHunt(accessToken);

  console.log('\nDone!');
})();
