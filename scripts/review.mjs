/**
 * Visual review harness. Drives the installed Chrome against a running production build,
 * captures the narrative phases at one viewport, and reports console output.
 *
 *   node scripts/review.mjs <width>x<height> [baseUrl] [outDir] [--reduced]
 */
import { mkdir } from 'node:fs/promises';
import puppeteer from 'puppeteer-core';

const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';

const spec = process.argv[2] ?? '1440x900';
const BASE = process.argv[3] ?? 'http://localhost:4317/';
const OUT = process.argv[4] ?? '/tmp/crsi/review';
const REDUCED = process.argv.includes('--reduced');

const [width, height] = spec.split('x').map(Number);
const mobile = width < 700;

const STOPS = [
  { name: '01-observe', p: 0.05 },
  { name: '02-mutation', p: 0.22 },
  { name: '03-better', p: 0.37 },
  { name: '04-butwhy', p: 0.42 },
  { name: '05-attribution', p: 0.5 },
  { name: '06-intervention', p: 0.56 },
  { name: '07-counterfactual', p: 0.63 },
  { name: '08-architecture', p: 0.69 },
  { name: '09-credit', p: 0.82 },
  { name: '10-recursion-tree', p: 0.93 },
  { name: '11-recursion-graph', p: 0.985 },
];

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function main() {
  await mkdir(OUT, { recursive: true });
  const problems = [];

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
  await page.setViewport({
    width,
    height,
    deviceScaleFactor: 1,
    isMobile: mobile,
    hasTouch: mobile,
  });

  if (REDUCED) {
    await page.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'reduce' }]);
  }

  page.on('console', (msg) => {
    if (['error', 'warning'].includes(msg.type())) {
      problems.push(`console.${msg.type()}: ${msg.text()}`);
    }
  });
  page.on('pageerror', (err) => problems.push(`pageerror: ${err.message}`));

  const tag = REDUCED ? `${spec}-reduced` : spec;

  await page.goto(BASE, { waitUntil: 'domcontentloaded' });
  await sleep(REDUCED ? 2600 : 4600);
  await page.screenshot({ path: `${OUT}/${tag}_00-opening.png` });

  for (const stop of STOPS) {
    await page.evaluate((frac) => {
      const max = document.documentElement.scrollHeight - window.innerHeight;
      window.scrollTo({ top: max * frac, behavior: 'instant' });
    }, stop.p);
    await sleep(REDUCED ? 700 : 1100);
    await page.screenshot({ path: `${OUT}/${tag}_${stop.name}.png` });
  }

  if (!mobile && !REDUCED) {
    await page.evaluate(() => {
      const max = document.documentElement.scrollHeight - window.innerHeight;
      window.scrollTo({ top: max * 0.05, behavior: 'instant' });
    });
    await sleep(800);
    await page.mouse.move(width * 0.5, height * 0.5);
    await sleep(350);
    await page.mouse.move(width * 0.52, height * 0.51);
    await sleep(600);
    await page.screenshot({ path: `${OUT}/${tag}_12-lens.png` });

    await page.mouse.down();
    await sleep(900);
    await page.screenshot({ path: `${OUT}/${tag}_13-hold.png` });
    await page.mouse.up();
  }

  await page.close();
  await browser.close();

  console.log(tag, problems.length === 0 ? 'console: clean' : `problems: ${problems.length}`);
  for (const p of [...new Set(problems)]) console.log('   ' + p);
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
