/**
 * Interaction check. Performs the demonstration the site is built around and asserts the state
 * the visitor is meant to reach: select a component, intervene, watch the outcome move, reset,
 * then hold to remove the change and read the counterfactual.
 *
 *   node scripts/interact.mjs [baseUrl] [outDir]
 */
import { mkdir } from 'node:fs/promises';
import puppeteer from 'puppeteer-core';

const BASE = process.argv[2] ?? 'http://127.0.0.1:4317/';
const OUT = process.argv[3] ?? '/tmp/crsi/interact';
const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const failures = [];
function check(name, ok, detail = '') {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ` — ${detail}` : ''}`);
  if (!ok) failures.push(name);
}

async function textOf(page) {
  return page.evaluate(() => document.body.innerText.replace(/\s+/g, ' '));
}

async function scrollTo(page, frac) {
  await page.evaluate((f) => {
    const max = document.documentElement.scrollHeight - window.innerHeight;
    window.scrollTo({ top: max * f, behavior: 'instant' });
  }, frac);
}

async function clickByText(page, needle) {
  const handle = await page.evaluateHandle((text) => {
    const nodes = [...document.querySelectorAll('button')];
    return nodes.find((n) => (n.innerText || '').toUpperCase().includes(text)) ?? null;
  }, needle.toUpperCase());
  const el = handle.asElement();
  if (!el) return false;
  await el.click();
  return true;
}

async function main() {
  await mkdir(OUT, { recursive: true });
  const browser = await puppeteer.launch({
    executablePath: CHROME,
    headless: 'shell',
    protocolTimeout: 60000,
    args: [
      '--no-sandbox',
      '--use-gl=angle',
      '--use-angle=swiftshader',
      '--enable-unsafe-swiftshader',
      '--hide-scrollbars',
    ],
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 900 });

  const problems = [];
  page.on('console', (m) => {
    if (['error', 'warning'].includes(m.type())) problems.push(`${m.type()}: ${m.text()}`);
  });
  page.on('pageerror', (e) => problems.push(`pageerror: ${e.message}`));

  await page.goto(BASE, { waitUntil: 'domcontentloaded' });
  await sleep(4600);

  // --- intervention -------------------------------------------------------
  await scrollTo(page, 0.56);
  await sleep(1200);

  let body = await textOf(page);
  check('instruction asks for a component', body.includes('SELECT A COMPONENT'));

  check('memory is selectable', await clickByText(page, 'MEMORY'));
  await sleep(900);
  body = await textOf(page);
  check('intervention is offered', body.includes('INTERVENE?'));
  check('do-notation is shown', body.includes('do(MEMORY = v04)'));
  await page.screenshot({ path: `${OUT}/01-selected.png` });

  check('intervention applies', await clickByText(page, 'APPLY INTERVENTION'));
  await sleep(3200);
  body = await textOf(page);
  check('outcome moves to the intervened value', body.includes('0.842'), 'expected 0.842');
  await page.screenshot({ path: `${OUT}/02-propagated.png` });

  check('reset is offered', await clickByText(page, 'RESET'));
  await sleep(1200);
  body = await textOf(page);
  check('reset restores the instruction', body.includes('SELECT A COMPONENT'));
  await page.screenshot({ path: `${OUT}/03-reset.png` });

  // --- counterfactual -----------------------------------------------------
  await scrollTo(page, 0.63);
  await sleep(1200);
  body = await textOf(page);
  check('hold instruction present', /HOLD TO REMOVE THIS CHANGE|PRESS AND HOLD/.test(body));
  check(
    'factual and counterfactual are both readable',
    body.includes('0.842') && body.includes('0.773') && body.includes('+0.069'),
  );
  check('counterfactual agent is marked', body.includes("AGENT_0043'"));
  check('values are labelled illustrative', body.includes('ILLUSTRATIVE SIMULATION'));

  await page.keyboard.down('c');
  await sleep(1100);
  await page.screenshot({ path: `${OUT}/04-hold.png` });
  await page.keyboard.up('c');
  await sleep(900);
  await page.screenshot({ path: `${OUT}/05-released.png` });

  // --- deep link ----------------------------------------------------------
  const hash = await page.evaluate(() => window.location.hash);
  check('url carries the state', /p=\d\.\d{3}&ph=[A-Z_]+/.test(hash), hash);

  await page.goto(`${BASE}#p=0.820&ph=CREDIT_ASSIGNMENT&n=MEMORY&iv=MEMORY:v04`, {
    waitUntil: 'domcontentloaded',
  });
  await sleep(4200);
  body = await textOf(page);
  check('deep link restores the credit phase', body.includes('CREDIT FROM REWARD'));
  await page.screenshot({ path: `${OUT}/06-deeplink.png` });

  // --- keyboard phase traversal -------------------------------------------
  await page.keyboard.press('1');
  await sleep(1600);
  body = await textOf(page);
  check('keyboard returns to observe', body.includes('TASK PERFORMANCE'));

  // --- accessibility shadow ----------------------------------------------
  const shadow = await page.evaluate(() => {
    const el = document.querySelector('#observatory-content');
    return el ? el.innerText.replace(/\s+/g, ' ') : '';
  });
  check('text record is in the document', shadow.includes('Research question'));
  check('status states the open gates', shadow.includes('G1 and G2 are open'));
  check('no invented affiliation', !/google|nvidia|funding|revenue/i.test(shadow));

  check('console clean', problems.length === 0, problems.slice(0, 3).join(' | '));

  await browser.close();

  console.log(failures.length === 0 ? '\nALL CHECKS PASSED' : `\nFAILED: ${failures.join(', ')}`);
  process.exit(failures.length === 0 ? 0 : 1);
}

main().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
