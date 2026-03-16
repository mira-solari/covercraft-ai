const { chromium } = require('playwright');
const fs = require('fs');
const https = require('https');

async function getVerificationCode(fromAddress) {
  const tokens = JSON.parse(fs.readFileSync('/Users/openclaw/.openclaw/credentials/email/gmail-oauth-tokens.json'));
  
  return new Promise((resolve) => {
    const query = encodeURIComponent(`from:${fromAddress} newer_than:5m`);
    https.get(
      `https://gmail.googleapis.com/gmail/v1/users/me/messages?maxResults=1&q=${query}`,
      { headers: { Authorization: 'Bearer ' + tokens.access_token } },
      (res) => {
        let body = '';
        res.on('data', d => body += d);
        res.on('end', () => {
          const msgs = JSON.parse(body);
          if (msgs.messages?.[0]) {
            https.get(
              `https://gmail.googleapis.com/gmail/v1/users/me/messages/${msgs.messages[0].id}?format=full`,
              { headers: { Authorization: 'Bearer ' + tokens.access_token } },
              (msgRes) => {
                let msgBody = '';
                msgRes.on('data', d => msgBody += d);
                msgRes.on('end', () => {
                  const msg = JSON.parse(msgBody);
                  // Get the body text
                  let text = '';
                  if (msg.payload?.body?.data) {
                    text = Buffer.from(msg.payload.body.data, 'base64').toString();
                  } else if (msg.payload?.parts) {
                    for (const part of msg.payload.parts) {
                      if (part.body?.data) {
                        text += Buffer.from(part.body.data, 'base64').toString();
                      }
                    }
                  }
                  // Also check subject
                  const subject = msg.payload?.headers?.find(h => h.name === 'Subject')?.value || '';
                  const fullText = subject + ' ' + text;
                  const code = fullText.match(/(\d{5,8})/)?.[1];
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
    console.log('Navigating to Twitter signup...');
    await page.goto('https://x.com/i/flow/signup', { waitUntil: 'domcontentloaded', timeout: 15000 });
    await page.waitForTimeout(3000);
    
    await page.screenshot({ path: 'screenshots/twitter-signup.png' });
    
    // Check what's on the page
    const text = await page.evaluate(() => {
      return [...document.querySelectorAll('h1, h2, span, input, button, label')].slice(0, 30).map(el => 
        el.tagName + ': ' + (el.textContent || el.placeholder || el.type || '').trim().substring(0, 60)
      ).filter(t => t.split(': ')[1]).join('\n');
    });
    console.log('Page elements:\n' + text);
    
  } catch(e) {
    console.error('Error:', e.message);
  }
  
  await browser.close();
})();
