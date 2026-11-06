// Headless screenshots of the web export (apps/mobile/dist) for the README.
// Starts the API (committed sample data, fake provider) and a static server, drives the UI with
// Playwright using an installed Edge or Chrome, and writes docs/*.png. Not run in CI.
import { spawn } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { chromium } from 'playwright-core';

const here = dirname(fileURLToPath(import.meta.url));
const app = resolve(here, '..');
const repo = resolve(app, '..', '..');
const out = resolve(repo, 'docs');
mkdirSync(out, { recursive: true });

const API = 'http://127.0.0.1:8000';
const WEB = 'http://127.0.0.1:8081';

function start(command, args, cwd, env = {}) {
  const child = spawn(command, args, {
    cwd,
    env: { ...process.env, ...env },
    shell: true,
    stdio: 'ignore',
  });
  return child;
}

async function waitFor(url, tries = 60) {
  for (let i = 0; i < tries; i++) {
    try {
      const res = await fetch(url);
      if (res.ok) return;
    } catch {
      // not up yet
    }
    await new Promise((r) => setTimeout(r, 1000));
  }
  throw new Error(`Timed out waiting for ${url}`);
}

const api = start(
  'uv',
  ['run', 'uvicorn', 'nhs_nearby.api:app_factory', '--factory', '--port', '8000'],
  resolve(repo, 'services', 'api'),
  { LLM_PROVIDER: 'fake', USE_SAMPLE: 'true' },
);
const web = start('npx', ['serve', '-s', 'dist', '-l', '8081'], app);

try {
  await waitFor(`${API}/health`);
  await waitFor(WEB);

  let browser;
  for (const channel of ['msedge', 'chrome']) {
    try {
      browser = await chromium.launch({ channel });
      break;
    } catch {
      // try the next installed browser
    }
  }
  if (!browser) throw new Error('No Edge or Chrome found for Playwright');

  const context = await browser.newContext({
    viewport: { width: 390, height: 780 },
    deviceScaleFactor: 2,
    geolocation: { latitude: 55.9533, longitude: -3.1883 },
    permissions: ['geolocation'],
  });
  const page = await context.newPage();
  await page.addInitScript((url) => localStorage.setItem('nhs.apiUrl', url), API);
  await page.goto(WEB);

  await page.getByText(/^From:/).waitFor({ timeout: 30000 });
  await page
    .getByText(/ km$| m$/)
    .first()
    .waitFor({ timeout: 30000 });
  await page.screenshot({ path: resolve(out, 'nearby-list.png') });

  await page.getByRole('button', { name: 'Show map' }).click();
  await page.locator('.leaflet-container').waitFor();
  await page.waitForTimeout(4000);
  await page.screenshot({ path: resolve(out, 'nearby-map.png') });

  await page.getByRole('tab', { name: /Ask/ }).click();
  await page.getByLabel('Your question').fill('where is the closest A&E to Partick');
  await page.getByRole('button', { name: 'Ask', exact: true }).click();
  await page.getByText(/^Sources:/).waitFor({ timeout: 30000 });
  await page.screenshot({ path: resolve(out, 'ask.png') });

  await browser.close();
  console.log('Wrote docs/nearby-list.png, docs/nearby-map.png, docs/ask.png');
} finally {
  for (const child of [api, web]) {
    if (process.platform === 'win32') {
      spawn('taskkill', ['/pid', String(child.pid), '/T', '/F'], { stdio: 'ignore' });
    } else {
      child.kill();
    }
  }
}
