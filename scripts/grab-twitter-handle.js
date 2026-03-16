const { chromium } = require('playwright');
const fs = require('fs');
const https = require('https');

async function getLatestCode(query) {
  const tokens = JSON.parse(fs.readFileSync('/Users/openclaw/.openclaw/credentials/email/gmail-oauth-tokens.json'));
  return new Promise((resolve) => {
    const q = encodeURIComponent(query + ' newer_than:5m');
    https.get('https://gmail.googleapis.com/gmail/v1/users/me/messages?maxResults=1&q=' + q,
      { headers: { Authorization: 'Bearer ' + tokens.access_token } },
      (res) => {
        let body = '';
        res.on('data', d => body += d);
        res.on('end', () => {
          const msgs = JSON.parse(body);
          if (!msgs.messages?.[0]) return resolve(null);
          https.get('https://gmail.googleapis.com/gmail/v1/users/me/messages/' + msgs.messages[0].id + '?format=full',
            { headers: { Authorization: 'Bearer ' + tokens.access_token } },
            (r) => {
              let b = '';
              r.on('data', d => b += d);
              r.on('end', () => {
                const m = JSON.parse(b);
                let text = '';
                const subj = m.payload?.headers?.find(h => h.name === 'Subject')?.value || '';
                if (m.payload?.body?.data) {
                  text = Buffer.from(m.payload.body.data, 'base64').toString();
                } else if (m.payload?.parts) {
                  for (const part of m.payload.parts) {
                    if (part.body?.data) text += Buffer.from(part.body.data, 'base64').toString();
                  }
                }
                const fullText = subj + ' ' + text;
                const code = fullText.match(/(\d{5,8})/)?.[1];
                resolve(code);
              });
            });
        });
      });
  });
}

(async () => {
  const browser = await chromium.launch({ headless: true, args: ['--disable-blink-features=AutomationControlled'] });
  const ctx = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/134.0.0.0 Safari/537.36',
    viewport: { width: 1280, height: 900 }
  });
  const page = await ctx.newPage();

  try {
    // Step 1: Navigate
    console.log('Step 1: Navigate to signup...');
    await page.goto('https://x.com/i/flow/signup', { waitUntil: 'domcontentloaded', timeout: 15000 });
    await page.waitForTimeout(3000);
    await page.click('text=Create account');
    await page.waitForTimeout(3000);

    // Step 2: Fill form
    console.log('Step 2: Fill form...');
    await page.fill('input[name="name"]', 'ApplyFaster');
    await page.waitForTimeout(500);

    // Switch to email
    await page.click('text=Use email instead');
    await page.waitForTimeout(1000);
    await page.fill('input[name="email"]', 'mira@elysianventures.vc');
    await page.waitForTimeout(500);

    // Date of birth
    const selects = await page.$$('select');
    console.log('Found', selects.length, 'select elements');
    if (selects.length >= 3) {
      await selects[0].selectOption({ index: 6 });  // July
      await selects[1].selectOption({ index: 15 }); // 15th
      // Year - try value first, then index
      try {
        await selects[2].selectOption('1995');
      } catch {
        await selects[2].selectOption({ index: 25 });
      }
    }
    await page.waitForTimeout(1000);

    // Click Next
    console.log('Step 3: Click Next...');
    await page.click('button:has-text("Next")');
    await page.waitForTimeout(3000);

    // Check current step
    let headings = await page.evaluate(() => [...document.querySelectorAll('h1')].map(h => h.textContent.trim()));
    console.log('Current step:', headings);

    // Skip customization if present
    if (headings.some(h => h.includes('Customize'))) {
      console.log('Skipping customization...');
      await page.click('button:has-text("Next")');
      await page.waitForTimeout(3000);
      headings = await page.evaluate(() => [...document.querySelectorAll('h1')].map(h => h.textContent.trim()));
      console.log('Now on:', headings);
    }

    // Confirm account creation
    if (headings.some(h => h.includes('Create your account'))) {
      console.log('Step 4: Confirming signup...');
      const signupBtn = await page.$('button[data-testid="OCF_SignupButton"]');
      if (signupBtn) {
        await signupBtn.click();
      } else {
        await page.click('button:has-text("Sign up")').catch(() => page.click('button:has-text("Next")'));
      }
      await page.waitForTimeout(5000);
    }

    await page.screenshot({ path: 'screenshots/twitter-afterconfirm.png' });
    headings = await page.evaluate(() => [...document.querySelectorAll('h1')].map(h => h.textContent.trim()));
    console.log('After confirm:', headings);

    // Email verification
    if (headings.some(h => h.toLowerCase().includes('verif') || h.toLowerCase().includes('code') || h.toLowerCase().includes('sent'))) {
      console.log('Step 5: Email verification needed...');
      await page.waitForTimeout(8000); // Wait for email to arrive

      const code = await getLatestCode('from:info@x.com OR from:verify@x.com');
      console.log('Got code:', code);

      if (code) {
        const input = await page.$('input[name="verfication_code"]') || await page.$('input[type="text"]');
        if (input) {
          await input.fill(code);
          await page.waitForTimeout(500);
          await page.click('button:has-text("Next")');
          await page.waitForTimeout(3000);
        }
      } else {
        console.log('No code found, trying broader search...');
        const code2 = await getLatestCode('verification code');
        console.log('Broader search code:', code2);
      }
    }

    // Password step
    headings = await page.evaluate(() => [...document.querySelectorAll('h1')].map(h => h.textContent.trim()));
    console.log('Current step:', headings);
    
    if (headings.some(h => h.toLowerCase().includes('password'))) {
      console.log('Step 6: Setting password...');
      const pwInput = await page.$('input[name="password"]') || await page.$('input[type="password"]');
      if (pwInput) {
        await pwInput.fill('AF2026Launch!Secure');
        await page.waitForTimeout(500);
        await page.click('button:has-text("Next")');
        await page.waitForTimeout(3000);
      }
    }

    // Username step - this is where we set @applyfaster
    headings = await page.evaluate(() => [...document.querySelectorAll('h1')].map(h => h.textContent.trim()));
    console.log('Current step:', headings);
    
    if (headings.some(h => h.toLowerCase().includes('username') || h.toLowerCase().includes('pick'))) {
      console.log('Step 7: Setting username to @applyfaster...');
      const usernameInput = await page.$('input[name="username"]') || await page.$('input[type="text"]');
      if (usernameInput) {
        await usernameInput.fill('');
        await usernameInput.fill('applyfaster');
        await page.waitForTimeout(2000);
        await page.click('button:has-text("Next")');
        await page.waitForTimeout(3000);
      }
    }

    await page.screenshot({ path: 'screenshots/twitter-final.png' });
    console.log('Final URL:', page.url());
    
    headings = await page.evaluate(() => [...document.querySelectorAll('h1')].map(h => h.textContent.trim()));
    console.log('Final headings:', headings);

    // Save cookies
    const cookies = await ctx.cookies();
    fs.writeFileSync('/Users/openclaw/.openclaw/credentials/twitter-applyfaster-cookies.json', JSON.stringify(cookies, null, 2));
    console.log('Saved cookies');

  } catch (e) {
    console.error('Error:', e.message);
    await page.screenshot({ path: 'screenshots/twitter-error.png' }).catch(() => {});
  }

  await browser.close();
})();
