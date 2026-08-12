import { mkdirSync, readFileSync, writeFileSync, renameSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { chromium } from 'playwright';
import { groupKeywords, groupSlug } from './keywords.js';
import { buildExploreUrl } from './url.js';
import { parseTrendsCsv, summarizeTrends, decodeTrendsCsv } from './parse.js';

const CONSENT_PATTERNS = [
  'Accept all',
  'I agree',
  'Accept everything',
  'Alle akzeptieren', // de
  'Zustimmen',
  'Tout accepter', // fr
  'Aceptar todo', // es
  'Accetta tutto', // it
  'Godta alle', // no
  'Acceptera alla', // sv
  'Zaakceptuj wszystko', // pl
  'Alles accepteren', // nl
];

const NO_DATA_PATTERNS = [
  /not enough (search )?(volume|data)/i,
  /doesn't have enough data/i,
  /only shows data for some of your terms/i,
];

const CSV_BUTTON_SELECTOR = [
  'widget-template[widget-name="fe_line_chart"] button[aria-label*="CSV" i]',
  'widget-template[widget-name="fe_line_chart"] button[title*="CSV" i]',
  'widget-template[widget-name="fe_line_chart"] button.export',
  'button[aria-label*="CSV" i]',
  'button.export',
].join(', ');

const MAX_429_RETRIES = 3;
const GROUP_DELAY_MS = 4000; // polite pacing between groups
const MAX_BUTTON_ATTEMPTS = 5; // export buttons to try, in DOM order

/**
 * Dismiss Google's cookie-consent interstitial if it is showing.
 * Returns true if a consent button was clicked.
 */
async function dismissConsent(page) {
  for (const label of CONSENT_PATTERNS) {
    const button = page.locator(`button:has-text("${label}")`).first();
    try {
      if (await button.count() && await button.isVisible({ timeout: 1000 })) {
        await button.click();
        await page.waitForTimeout(2500);
        return true;
      }
    } catch {
      // consent button disappeared or is not clickable — keep trying other locales
    }
  }
  return false;
}

/**
 * True when the page reports that some/all terms have too little volume.
 */
async function detectPartialData(page) {
  const text = await page.evaluate(() => document.body.innerText).catch(() => '');
  return NO_DATA_PATTERNS.some((pattern) => pattern.test(text));
}

/**
 * Inspect the rendered DOM and report what is actually on the page:
 * which widgets rendered, which buttons exist, and any error notices.
 * Printed to the run log so failures are diagnosable without artifacts.
 */
async function pageAutopsy(page) {
  try {
    return await page.evaluate(() => {
      const widgetNames = [...document.querySelectorAll('widget-template')]
        .map((w) => w.getAttribute('widget-name'))
        .filter(Boolean);
      const allButtons = [...document.querySelectorAll('button')];
      const matched = allButtons
        .map((b) => ({
          aria: b.getAttribute('aria-label') || '',
          cls: String(b.className || '').slice(0, 60),
          text: (b.innerText || '').trim().slice(0, 30),
        }))
        .filter((b) => /csv|download|export|share|save/i.test(b.aria + b.cls + b.text))
        .slice(0, 12);
      const bodyText = document.body ? document.body.innerText : '';
      const flags = [];
      if (/something went wrong/i.test(bodyText)) flags.push('something-went-wrong');
      if (/unusual traffic|captcha/i.test(bodyText)) flags.push('captcha-text');
      if (/no results|not enough/i.test(bodyText)) flags.push('no-data-text');
      if (/429/.test(document.title)) flags.push('429-title');
      return {
        widgetNames,
        totalButtons: allButtons.length,
        matched,
        flags,
        iframes: document.querySelectorAll('iframe').length,
        bodyHead: bodyText.replace(/\s+/g, ' ').trim().slice(0, 300),
      };
    });
  } catch (e) {
    return { autopsyError: String(e) };
  }
}

/**
 * Diagnose why the CSV button is missing: label the likely cause from the
 * URL/title, and capture a screenshot + HTML dump for later inspection.
 */
async function describeBlockPage(page, debugBase) {
  const url = page.url();
  const title = await page.title().catch(() => '');
  try {
    await page.screenshot({ path: `${debugBase}.png`, fullPage: true });
    writeFileSync(`${debugBase}.html`, await page.content());
  } catch {
    // best effort only
  }
  let cause = 'page layout changed';
  if (url.includes('consent.google')) cause = 'cookie-consent wall not dismissed';
  else if (url.includes('/sorry/')) cause = 'Google rate-limit/captcha page (datacenter IP blocked)';
  else if (/429/.test(title)) cause = 'Google 429 rate-limit page';
  else if (/before you continue/i.test(title)) cause = 'cookie-consent wall not dismissed';
  return `CSV download button not found — ${cause} (url: ${url}, title: "${title}"). Debug saved to ${debugBase}.{png,html}`;
}

/**
 * Export Google Trends interest-over-time CSVs using a real Chrome session.
 *
 * @param {object} opts
 * @param {string[] | string[][]} opts.keywords flat list (auto-chunked into
 *   groups of 5) or array of pre-built groups (each max 5)
 * @param {string} [opts.timeframe='today 12-m']
 * @param {string} [opts.geo=''] two-letter region code, '' = worldwide
 * @param {string} [opts.hl='en'] UI locale
 * @param {boolean} [opts.headless=false] headed Chrome is the most reliable;
 *   only use headless if your environment requires it
 * @param {string} [opts.profileDir] persistent Chrome profile; reusing one
 *   avoids repeat cookie consent and looks more like a returning user
 * @param {string} [opts.outDir=process.cwd()] where CSVs are written
 * @param {number} [opts.downloadTimeout=20000] ms to wait for the CSV download
 * @param {function} [opts.onProgress] optional (message) => void logger
 * @returns {Promise<{ csvPaths: string[], summary: object }>}
 */
export async function exportTrends({
  keywords,
  timeframe = 'today 12-m',
  geo = '',
  hl = 'en',
  headless = false,
  profileDir = join(tmpdir(), 'google-trends-csv-profile'),
  outDir = process.cwd(),
  downloadTimeout = 20000,
  onProgress = () => {},
} = {}) {
  if (keywords === undefined) throw new Error('exportTrends: "keywords" is required');

  const groups = groupKeywords(keywords);
  const out = resolve(outDir);
  mkdirSync(out, { recursive: true });

  const context = await chromium.launchPersistentContext(profileDir, {
    headless,
    channel: 'chrome',
    acceptDownloads: true,
    viewport: { width: 1400, height: 900 },
    args: ['--disable-blink-features=AutomationControlled'],
  });

  const summary = {
    timeframe,
    geo,
    hl,
    generatedAt: new Date().toISOString(),
    groups: [],
  };
  const csvPaths = [];

  try {
    const page = context.pages()[0] || (await context.newPage());
    let consentHandled = false;

    // Warm the session on a neutral Google page before hitting Trends.
    onProgress('Warming up session');
    await page.goto('https://www.google.com', { waitUntil: 'domcontentloaded', timeout: 30000 }).catch(() => {});
    await page.waitForTimeout(2500);

    let groupIndex = -1;
    for (const group of groups) {
      groupIndex++;
      if (groupIndex > 0) await page.waitForTimeout(GROUP_DELAY_MS);

      const url = buildExploreUrl({ keywords: group, timeframe, geo, hl });
      onProgress(`Loading: ${group.join(', ')}`);

      // Navigate with 429 backoff — a 429 page means Google is throttling this
      // IP/session, so wait progressively longer and retry before giving up.
      for (let attempt = 0; attempt <= MAX_429_RETRIES; attempt++) {
        const response = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });
        await page.waitForTimeout(5000);
        const status = response ? response.status() : 0;
        const title = await page.title().catch(() => '');
        const throttled = status === 429 || /429/.test(title);
        if (!throttled) break;
        if (attempt < MAX_429_RETRIES) {
          const waitMs = 20000 * (attempt + 1) + 10000;
          onProgress(`429 rate-limited — waiting ${Math.round(waitMs / 1000)}s before retry ${attempt + 1}/${MAX_429_RETRIES}`);
          await page.waitForTimeout(waitMs);
        }
      }

      // Widgets render lazily — give the page a chance to settle on slow networks.
      await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {});

      // Cookie consent appears once per profile; retry a couple of times since
      // it can render late. Afterwards the profile remembers the choice.
      if (!consentHandled) {
        for (let attempt = 0; attempt < 3 && !consentHandled; attempt++) {
          consentHandled = await dismissConsent(page);
          if (!consentHandled) await page.waitForTimeout(2000);
        }
        consentHandled = true; // don't re-check on every group
      }

      const partial = await detectPartialData(page);
      if (partial) {
        onProgress(`Note: "not enough data" notice for group: ${group.join(', ')}`);
      }

      const buttons = page.locator(CSV_BUTTON_SELECTOR);
      await buttons.first().waitFor({ state: 'visible', timeout: 20000 }).catch(() => {});
      const buttonCount = await buttons.count();
      const entry = { keywords: group, csvPath: null, partial, stats: null, error: null };

      if (!buttonCount) {
        entry.error = await describeBlockPage(page, join(out, `debug-${groupSlug(group)}`));
        const a = await pageAutopsy(page);
        onProgress(
          `Autopsy: widgets=${JSON.stringify(a.widgetNames)} totalButtons=${a.totalButtons} ` +
            `matched=${JSON.stringify(a.matched)} flags=${JSON.stringify(a.flags)} iframes=${a.iframes} body="${a.bodyHead}"`
        );
      } else {
        // The explore page hosts several exportable widgets (timeline, regions,
        // related queries — the latter export percentages). Try export buttons
        // in DOM order and keep the first download that parses as a dated
        // weekly time series.
        for (let bi = 0; bi < Math.min(buttonCount, MAX_BUTTON_ATTEMPTS) && !entry.csvPath; bi++) {
          const [download] = await Promise.all([
            page.waitForEvent('download', { timeout: downloadTimeout }).catch(() => null),
            buttons.nth(bi).click(),
          ]);

          if (!download) {
            entry.error = `CSV download did not start within ${downloadTimeout}ms — Google may be rate-limiting this session. Try again later, or delete the profile dir and retry headed.`;
            continue;
          }

          const csvPath = join(out, `${groupSlug(group)}.csv`);
          await download.saveAs(csvPath);

          try {
            const parsed = parseTrendsCsv(decodeTrendsCsv(readFileSync(csvPath)));
            if (!/^\d{4}-\d{2}-\d{2}/.test(parsed.weeks[0] ?? '')) {
              throw new Error('file is not a dated time-series export');
            }
            entry.csvPath = csvPath;
            csvPaths.push(csvPath);
            entry.stats = summarizeTrends(parsed);
            onProgress(`Saved: ${csvPath}`);
          } catch (e) {
            const raw = readFileSync(csvPath);
            const head = decodeTrendsCsv(raw).slice(0, 150).replace(/\s+/g, ' ').trim();
            const hex = raw.subarray(0, 24).toString('hex');
            onProgress(`Export button ${bi + 1}/${buttonCount} returned unusable CSV (${e.message}). File starts: "${head}…" [hex: ${hex}]`);
            renameSync(csvPath, join(out, `${groupSlug(group)}.widget${bi + 1}.csv`));
            entry.error = `CSV export was not the interest-over-time series: ${e.message}`;
          }
        }
        if (!entry.csvPath) {
          const a = await pageAutopsy(page);
          onProgress(`Autopsy (no usable export): matched=${JSON.stringify(a.matched)} flags=${JSON.stringify(a.flags)}`);
          if (!entry.error) entry.error = 'No usable CSV export found on the page.';
        }
      }

      summary.groups.push(entry);
    }
  } finally {
    await context.close();
  }

  return { csvPaths, summary };
}
