/**
 * website_verifier.js
 * Модуль глубокого парсинга сайтов промышленных предприятий
 * для валидации контактов и отправки обращений через веб-формы (Этап 1).
 */

import http from 'http';
import https from 'https';
import zlib from 'zlib';
import { URL } from 'url';

const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';

const EMAIL_REGEX = /[a-zA-Z0-9_.+-]+@[a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+/g;
const IGNORE_EXTENSIONS = ['.png', '.jpg', '.jpeg', '.gif', '.svg', '.webp', '.css', '.js', '.woff', '.woff2'];
const IGNORE_PREFIXES = ['example@', 'user@', 'email@', 'domain@', 'test@', 'your@'];

/**
 * Fetch a single URL with timeout and redirect handling
 */
function fetchUrl(targetUrl, timeoutMs = 8000, maxRedirects = 3) {
  return new Promise((resolve) => {
    if (maxRedirects < 0) {
      return resolve({ ok: false, error: 'Too many redirects', statusCode: null, body: '' });
    }

    let parsed;
    try {
      parsed = new URL(targetUrl);
    } catch (e) {
      return resolve({ ok: false, error: 'Invalid URL', statusCode: null, body: '' });
    }

    const client = parsed.protocol === 'https:' ? https : http;
    const req = client.request(parsed, {
      method: 'GET',
      headers: {
        'User-Agent': USER_AGENT,
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
        'Accept-Language': 'ru-RU,ru;q=0.9,en-US;q=0.8,en;q=0.7',
        'Accept-Encoding': 'gzip, deflate, br',
        'Cache-Control': 'no-cache',
        'Sec-Ch-Ua': '"Chromium";v="124", "Google Chrome";v="124", "Not-A.Brand";v="99"',
        'Sec-Ch-Ua-Mobile': '?0',
        'Sec-Ch-Ua-Platform': '"Windows"',
        'Sec-Fetch-Dest': 'document',
        'Sec-Fetch-Mode': 'navigate',
        'Sec-Fetch-Site': 'none',
        'Sec-Fetch-User': '?1',
        'Upgrade-Insecure-Requests': '1'
      },
      timeout: timeoutMs,
      rejectUnauthorized: false, // allow self-signed enterprise SSL
    }, (res) => {
      // Handle redirects
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        const nextUrl = new URL(res.headers.location, parsed).toString();
        return resolve(fetchUrl(nextUrl, timeoutMs, maxRedirects - 1));
      }

      // Handle decompression (gzip, deflate, brotli)
      let stream = res;
      const encoding = (res.headers['content-encoding'] || '').toLowerCase();
      try {
        if (encoding === 'gzip') {
          const gunzip = zlib.createGunzip();
          res.pipe(gunzip);
          stream = gunzip;
        } else if (encoding === 'deflate') {
          const inflate = zlib.createInflate();
          res.pipe(inflate);
          stream = inflate;
        } else if (encoding === 'br') {
          const brotli = zlib.createBrotliDecompress();
          res.pipe(brotli);
          stream = brotli;
        }
      } catch (err) {
        console.warn('Decompression setup failed, using raw stream:', err.message);
        stream = res;
      }

      let data = '';
      stream.setEncoding('utf8');
      stream.on('data', chunk => {
        data += chunk;
        if (data.length > 500000) { // Limit to 500 KB per page
          req.destroy();
        }
      });
      stream.on('end', () => {
        resolve({
          ok: res.statusCode >= 200 && res.statusCode < 300,
          statusCode: res.statusCode,
          url: targetUrl,
          body: data
        });
      });
      stream.on('error', (err) => {
        resolve({ ok: false, error: err.message, statusCode: res.statusCode, body: '' });
      });
    });

    req.on('timeout', () => {
      req.destroy();
      resolve({ ok: false, error: 'Timeout', statusCode: null, body: '' });
    });

    req.on('error', (err) => {
      resolve({ ok: false, error: err.message, statusCode: null, body: '' });
    });

    req.end();
  });
}

/**
 * Clean extracted email
 */
function cleanEmail(raw) {
  if (!raw) return null;
  const em = raw.toLowerCase().trim();
  for (const ext of IGNORE_EXTENSIONS) {
    if (em.endsWith(ext)) return null;
  }
  for (const pre of IGNORE_PREFIXES) {
    if (em.startsWith(pre)) return null;
  }
  if (!em.includes('.') || em.length < 5) return null;
  return em;
}

/**
 * Extract emails and forms from HTML
 */
function extractContactsAndForms(html, pageUrl) {
  const emails = new Set();
  const forms = [];

  if (!html) return { emails: [], forms: [] };

  // 1. Regex search for email
  const matches = html.match(EMAIL_REGEX) || [];
  for (const m of matches) {
    const cleaned = cleanEmail(m);
    if (cleaned) emails.add(cleaned);
  }

  // 2. Mailto links
  const mailtoRegex = /mailto:([a-zA-Z0-9_.+-]+@[a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+)/gi;
  let mMatch;
  while ((mMatch = mailtoRegex.exec(html)) !== null) {
    const cleaned = cleanEmail(mMatch[1]);
    if (cleaned) emails.add(cleaned);
  }

  // 3. Search for feedback/reception forms
  const formRegex = /<form\b[^>]*>([\s\S]*?)<\/form>/gi;
  let fMatch;
  while ((fMatch = formRegex.exec(html)) !== null) {
    const formHtml = fMatch[0];
    const isContactForm = /email|сообщение|message|отправить|send|обратная связь|приемная|контакт/i.test(formHtml);
    if (isContactForm) {
      const actionMatch = formHtml.match(/action=["']([^"']*)["']/i);
      const action = actionMatch ? actionMatch[1] : pageUrl;
      const methodMatch = formHtml.match(/method=["']([^"']*)["']/i);
      const method = methodMatch ? methodMatch[1].toUpperCase() : 'POST';
      
      forms.push({
        pageUrl,
        action,
        method,
        hasEmailInput: /type=["']email["']|name=["'][^"']*email/i.test(formHtml),
        hasTextInput: /<textarea/i.test(formHtml),
      });
    }
  }

  return { emails: Array.from(emails), forms };
}

/**
 * Prioritize best enterprise email
 * Prioritizes: snab/tender/ogm/pto > zavod/office/kanc > mail/info > others
 */
function pickBestEmail(emailList, domain, currentEmail) {
  if (!Array.isArray(emailList) || emailList.length === 0) {
    return currentEmail || null;
  }

  // Filter emails matching the company domain
  const domainLower = domain.toLowerCase();
  const domainEmails = emailList.filter(e => e.endsWith('@' + domainLower) || e.endsWith('.' + domainLower));
  const pool = domainEmails.length > 0 ? domainEmails : emailList;

  // If current email is verified on site, keep it
  if (currentEmail && pool.includes(currentEmail.toLowerCase())) {
    return currentEmail;
  }

  // Priority keywords
  const priorityPatterns = [
    /^(zavod|office|kanc|sekretar|priem)/i, // приемная / канцелярия завода
    /^(snab|tender|zakup|ogm|pto)/i,        // снабжение / ОГМ / ПТО
    /^(mail|info|post)/i,                  // общие
    /^(sales|sbyt|market)/i                // сбыт
  ];

  for (const pat of priorityPatterns) {
    const found = pool.find(e => pat.test(e));
    if (found) return found;
  }

  return pool[0];
}

/**
 * Main Crawler & Verifier for a Single Plant
 */
export async function verifyPlantWebsite(plant) {
  const domain = plant.domain || (plant.to_email ? plant.to_email.split('@')[1] : '');
  const currentEmail = (plant.to_email || plant.email || '').toLowerCase().trim();

  if (!domain) {
    return {
      ok: false,
      domain: '',
      siteStatus: 'NO_DOMAIN',
      siteAccessible: false,
      currentEmail,
      isEmailVerifiedOnSite: false,
      recommendedEmail: currentEmail,
      foundEmails: [],
      hasWebForm: false,
      webForms: [],
      error: 'Отсутствует домен предприятия'
    };
  }

  const paths = [
    '',
    '/contacts',
    '/kontakty',
    '/about/contacts',
    '/feedback',
    '/reception'
  ];

  let primaryOk = false;
  let primaryStatus = null;
  const allFoundEmails = new Set();
  const allFoundForms = [];

  for (const p of paths) {
    const targetUrl = `https://${domain}${p}`;
    let res = await fetchUrl(targetUrl, 5000);
    
    // Fallback to HTTP if HTTPS fails on root
    if (!res.ok && p === '') {
      res = await fetchUrl(`http://${domain}${p}`, 5000);
    }

    if (res.ok) {
      if (!primaryOk) {
        primaryOk = true;
        primaryStatus = `HTTP ${res.statusCode} OK`;
      }
      const { emails, forms } = extractContactsAndForms(res.body, res.url || targetUrl);
      emails.forEach(e => allFoundEmails.add(e));
      forms.forEach(f => allFoundForms.push(f));
    } else if (p === '' && !primaryStatus) {
      primaryStatus = res.statusCode ? `HTTP ${res.statusCode}` : (res.error || 'Connection Failed');
      // If root host is completely unreachable (no DNS, timeout, connection refused), skip subpages
      if (!res.statusCode) {
        break;
      }
    }
  }

  const emailList = Array.from(allFoundEmails);
  const isEmailVerifiedOnSite = Boolean(currentEmail && emailList.includes(currentEmail));
  const recommendedEmail = pickBestEmail(emailList, domain, currentEmail);
  const hasWebForm = allFoundForms.length > 0;
  const primaryForm = allFoundForms[0] || null;

  return {
    ok: primaryOk,
    domain,
    siteStatus: primaryOk ? 'HTTP 200 OK (Сайт активен)' : (primaryStatus || 'Недоступен'),
    siteAccessible: primaryOk,
    currentEmail,
    isEmailVerifiedOnSite,
    verificationStatus: isEmailVerifiedOnSite
      ? '✓ Подтверждён официальным сайтом'
      : (emailList.length > 0 ? `⚠️ На сайте указан: ${recommendedEmail}` : 'ℹ️ Контакты защищены от роботов'),
    recommendedEmail,
    foundEmails: emailList,
    hasWebForm,
    webFormUrl: primaryForm ? primaryForm.pageUrl : null,
    webFormsCount: allFoundForms.length,
    checkedAt: new Date().toISOString()
  };
}

/**
 * Batch Crawler for all plants
 */
export async function verifyAllPlantWebsites(plantsList) {
  return Promise.all(plantsList.map(async (plant) => {
    try {
      const res = await verifyPlantWebsite(plant);
      return {
        id: plant.id,
        company: plant.company,
        ...res
      };
    } catch (err) {
      return {
        id: plant.id,
        company: plant.company,
        ok: false,
        error: err.message
      };
    }
  }));
}
