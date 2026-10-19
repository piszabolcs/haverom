'use strict';
// Off-screen end-to-end smoke test for the built app (Playwright driving Electron).
//
//   npm run build && node e2e/smoke.cjs            # checks only
//   npm run build && node e2e/smoke.cjs --shots    # also refreshes docs/screenshots/*.png
//
// The window never appears on screen (see offscreen-hook.cjs), settings live in a throwaway
// userData folder, and all traffic stays on 127.0.0.1: a fake Ollama server, a closed port for
// the "offline" case and an image server that must never be contacted.
const fs = require('fs');
const http = require('http');
const net = require('net');
const os = require('os');
const path = require('path');
const { _electron } = require('playwright-core');

const ROOT = path.resolve(__dirname, '..');
const SHOTS = process.argv.includes('--shots') ? path.join(ROOT, 'docs', 'screenshots') : null;
const ELECTRON = require('electron'); // path of the Electron executable
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const results = [];
function check(name, ok, info) {
  results.push({ name, ok: Boolean(ok) });
  const suffix = info === undefined ? '' : ` — ${typeof info === 'string' ? info : JSON.stringify(info)}`;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${suffix}`);
}

// ---------- local servers ----------
const listen = (server) => new Promise((resolve) => server.listen(0, '127.0.0.1', () => resolve(server.address().port)));
async function closedPort() {
  const server = net.createServer();
  const port = await listen(server);
  await new Promise((resolve) => server.close(resolve));
  return port;
}

const imageHits = [];
const imageServer = http.createServer((req, res) => {
  imageHits.push(req.url);
  res.writeHead(200, { 'Content-Type': 'image/png' });
  res.end();
});

const mock = { models: ['qwen3:4b', 'llama3.2:3b'], chunkDelayMs: 30, imagePort: 0 };
const SHOWCASE = [
  'Sure! Here is a quick overview of what runs where:\n\n',
  '| Part | Runs on |\n|---|---|\n| Chat UI | Electron renderer |\n| Model | Ollama, on this PC |\n\n',
  'A tiny TypeScript example:\n\n```ts\nconst hi = (n: string) => `Hi, ${n}!`;\n```\n\n',
  'Everything stays on your machine — no cloud, no API key.'
];
const fakeOllama = http.createServer((req, res) => {
  let body = '';
  req.on('data', (c) => (body += c));
  req.on('end', async () => {
    if (req.method === 'GET' && req.url === '/api/tags') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ models: mock.models.map((name) => ({ name })) }));
      return;
    }
    if (req.method === 'POST' && req.url === '/api/chat') {
      const request = JSON.parse(body);
      if (!mock.models.includes(request.model)) {
        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: `model "${request.model}" not found, try pulling it first` }));
        return;
      }
      const question = request.messages.at(-1).content;
      const pieces = question.includes('image')
        ? ['Here is the picture: ', `![pixel](http://127.0.0.1:${mock.imagePort}/leak.png?d=SECRET)`]
        : question.includes('long')
          ? Array.from({ length: 200 }, (_, i) => `word${i} `)
          : SHOWCASE;
      res.writeHead(200, { 'Content-Type': 'application/x-ndjson' });
      const send = (obj) => !res.destroyed && res.write(JSON.stringify(obj) + '\n');
      for (const t of ['The user wants a short demo. ', 'A table and a code block will do.']) {
        send({ message: { role: 'assistant', content: '', thinking: t }, done: false });
        await sleep(mock.chunkDelayMs);
      }
      for (const piece of pieces) {
        if (res.destroyed) return;
        send({ message: { role: 'assistant', content: piece }, done: false });
        await sleep(mock.chunkDelayMs);
      }
      send({ message: { role: 'assistant', content: '' }, done: true, prompt_eval_count: 812, eval_count: 96, eval_duration: 2.4e9 });
      res.end();
      return;
    }
    res.writeHead(404);
    res.end('404 page not found');
  });
});

// ---------- in-page helpers ----------
/** Pairs of controls (and the title) inside `selector` whose boxes overlap. */
function overlaps(selector) {
  const root = document.querySelector(selector);
  if (!root) return ['missing ' + selector];
  const items = [...root.querySelectorAll('button, h1')].filter((el) => el.getBoundingClientRect().width > 0);
  const found = [];
  for (let i = 0; i < items.length; i++) {
    for (let j = i + 1; j < items.length; j++) {
      const a = items[i].getBoundingClientRect();
      const b = items[j].getBoundingClientRect();
      const w = Math.min(a.right, b.right) - Math.max(a.left, b.left);
      const h = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top);
      if (w > 1 && h > 1) found.push(`${items[i].title || items[i].textContent} × ${items[j].title || items[j].textContent}`);
    }
  }
  const r = root.getBoundingClientRect();
  if (root.scrollWidth > root.clientWidth + 1) found.push(`horizontal overflow ${root.scrollWidth}>${root.clientWidth}`);
  return found.concat(r.width > window.innerWidth + 1 ? ['wider than the window'] : []);
}

/** Visible texts and tooltips that look Hungarian. */
function hungarianTexts() {
  const re = /[áéíóöőúüűÁÉÍÓÖŐÚÜŰ]/;
  const texts = [...document.querySelectorAll('body *')]
    .filter((el) => el.children.length === 0 && el.getBoundingClientRect().width > 0)
    .map((el) => (el.textContent || '').trim());
  const attrs = [...document.querySelectorAll('[title],[placeholder],[aria-label]')].map(
    (el) => el.getAttribute('title') || el.getAttribute('placeholder') || el.getAttribute('aria-label')
  );
  return [...new Set([...texts, ...attrs].filter((t) => t && re.test(t)))];
}

(async () => {
  mock.imagePort = await listen(imageServer);
  const ollamaPort = await listen(fakeOllama);
  const offlinePort = await closedPort();

  const userData = fs.mkdtempSync(path.join(os.tmpdir(), 'haverom-e2e-'));
  fs.writeFileSync(
    path.join(userData, 'settings.json'),
    JSON.stringify({ language: 'en', ollamaHost: `http://127.0.0.1:${offlinePort}`, ollamaModel: 'qwen3:4b' })
  );
  const env = { ...process.env, HAVEROM_E2E_USER_DATA: userData };
  delete env.VITE_DEV_SERVER_URL;

  const app = await _electron.launch({
    executablePath: ELECTRON,
    args: ['-r', path.join(__dirname, 'offscreen-hook.cjs'), '.'],
    cwd: ROOT,
    env,
    timeout: 60_000
  });
  const consoleMessages = [];
  const pageErrors = [];
  try {
    const page = await app.firstWindow();
    page.on('console', (m) => consoleMessages.push(`${m.type()}: ${m.text()}`));
    page.on('pageerror', (e) => pageErrors.push(String(e.message)));
    const win = (fn, arg) => app.evaluate(({ BrowserWindow }, [source, a]) => new Function('w', 'a', `return (${source})(w, a)`)(BrowserWindow.getAllWindows()[0], a), [fn.toString(), arg]);
    const bridge = (fn, arg) => page.evaluate(fn, arg);
    const shot = async (name) => {
      if (!SHOTS) return;
      await page.addStyleTag({ content: 'html { background: linear-gradient(160deg, #1f2a33, #121820) !important; }' }).catch(() => {});
      await sleep(250);
      await page.screenshot({ path: path.join(SHOTS, `${name}.png`) });
    };

    check('off-screen hook loaded', await app.evaluate(() => Boolean(globalThis.__e2e)));

    // Bubble → panel
    await page.getByTestId('bubble').waitFor({ timeout: 15_000 });
    await shot('bubble');
    await page.getByTestId('bubble').click();
    await page.getByTestId('ollama-status').waitFor();
    check('minimum panel size is enforced', JSON.stringify(await win((w) => w.getMinimumSize())) === '[380,420]', await win((w) => w.getMinimumSize()));

    // Offline
    await page.locator('[data-status="unreachable"]').waitFor({ timeout: 8_000 });
    check('status dot is red without Ollama', true);
    check('offline empty state is shown', (await page.getByTestId('empty-state').innerText()).includes('Ollama is not running'));
    await shot('offline');
    await page.locator('textarea').fill('Hello');
    await page.keyboard.press('Enter');
    const offlineError = await page.getByTestId('error-message').innerText({ timeout: 5_000 });
    check('offline error is English', /Couldn't reach Ollama/.test(offlineError), offlineError);
    check('no Hungarian text in the English UI', (await page.evaluate(hungarianTexts)).length === 0, await page.evaluate(hungarianTexts));

    // Settings dialog: opens cleanly, keeps focus inside, closes on Esc
    await page.getByTitle('Settings').click();
    const dialog = page.getByTestId('settings-dialog');
    await dialog.waitFor();
    let focusInside = true;
    for (let i = 0; i < 30; i++) {
      await page.keyboard.press('Tab');
      focusInside &&= await page.evaluate(() => Boolean(document.activeElement?.closest('[data-testid="settings-dialog"]')));
    }
    check('Tab stays inside the settings dialog', focusInside);
    await page.keyboard.press('Escape');
    check('Esc closes the settings dialog', await dialog.isHidden());

    // Point the app at the fake Ollama through the host field (saved on Enter)
    await page.getByTitle('Settings').click();
    const host = page.getByLabel('Ollama host');
    await host.fill(`http://127.0.0.1:${ollamaPort}`);
    await host.press('Enter');
    await page.getByRole('button', { name: 'Test connection' }).click();
    const okText = await page.getByTestId('test-result').innerText();
    check('connection test passes for a pulled model', okText.startsWith('Connected'), okText);

    const model = page.getByLabel('Model', { exact: true });
    await model.fill('qwen3:30b-a3b-q4_K_M');
    await model.press('Enter');
    await page.getByRole('button', { name: 'Test connection' }).click();
    await page.getByTestId('test-result').filter({ hasText: 'not pulled' }).waitFor({ timeout: 6_000 });
    const missingText = await page.getByTestId('test-result').innerText();
    check('connection test requires the exact model tag', missingText.includes('qwen3:4b, llama3.2:3b'), missingText);
    await model.fill('qwen3:4b');
    await model.press('Enter');
    await page.getByRole('button', { name: 'Test connection' }).click();
    await page.getByTestId('test-result').filter({ hasText: 'Connected' }).waitFor({ timeout: 6_000 });
    await page.evaluate(() => document.activeElement && document.activeElement.blur());
    await page.getByLabel('Ollama host').evaluate((el) => el.parentElement.scrollIntoView({ block: 'start' }));
    const fade = await page.getByTestId('settings-body').evaluate((el) => ({
      top: el.dataset.fadeTop, bottom: el.dataset.fadeBottom,
      headerFixed: el.previousElementSibling && el.previousElementSibling.querySelector('h2') !== null
    }));
    check('settings body fades at the scrolled edge and the header stays fixed',
          fade.top === 'true' && fade.headerFixed, JSON.stringify(fade));
    await shot('settings');
    await page.keyboard.press('Escape');
    await page.locator('[data-status="ok"]').waitFor({ timeout: 8_000 });
    check('status dot turns green with a pulled model', true);

    // Remote images are never fetched
    await page.getByTitle('New conversation').click();
    await page.locator('textarea').fill('Send me an image');
    await page.keyboard.press('Enter');
    await page.locator('.md a', { hasText: 'pixel' }).waitFor({ timeout: 8_000 });
    await sleep(300);
    check('a Markdown image is rendered as a link, never loaded', imageHits.length === 0 && (await page.locator('.md img').count()) === 0, imageHits);

    // Stop keeps the partial reply
    mock.chunkDelayMs = 120;
    await page.locator('textarea').fill('Write something long');
    await page.keyboard.press('Enter');
    await page.locator('.md', { hasText: 'word3' }).last().waitFor({ timeout: 8_000 });
    const stopStarted = Date.now();
    await page.getByTestId('stop').click();
    await page.getByTestId('stopped-label').filter({ hasText: 'Stopped' }).waitFor({ timeout: 2_000 });
    const stopMs = Date.now() - stopStarted;
    check('Stop ends the reply within 300 ms and keeps the partial text', stopMs < 300 && (await page.locator('.md').last().innerText()).includes('word3'), `${stopMs} ms`);
    await page.getByTestId('send').waitFor({ timeout: 2_000 });
    mock.chunkDelayMs = 30;

    // Showcase conversation for the README
    await page.getByTitle('New conversation').click();
    await page.locator('textarea').fill('What can you do?');
    await page.keyboard.press('Enter');
    await page.getByText('prompt tokens').waitFor({ timeout: 10_000 });
    await shot('conversation');

    // Signature and About card
    const version = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8')).version;
    const signature = page.getByTestId('signature');
    check('signature shows the package.json version', (await signature.innerText()) === `psz // v${version}`, await signature.innerText());
    await signature.hover();
    await sleep(300);
    check('signature glows on hover', (await signature.evaluate((el) => getComputedStyle(el).textShadow)) !== 'none');
    await signature.click();
    await page.getByTestId('about-dialog').waitFor();
    await shot('about');
    await page.keyboard.press('Escape');
    check('About card closes on Esc', await page.getByTestId('about-dialog').isHidden());
    await signature.click();
    await page.getByTestId('about-dialog').waitFor();
    await page.mouse.click(24, 120);
    check('About card closes on a click outside', await page.getByTestId('about-dialog').isHidden());

    // Header at large text and at the minimum size
    await bridge(() => window.companion.updateSettings({ largeText: true }));
    await sleep(600);
    check('header has no overlaps with large text', (await page.evaluate(overlaps, '.drag-region')).length === 0, await page.evaluate(overlaps, '.drag-region'));
    await bridge(() => window.companion.updateSettings({ largeText: false }));
    await sleep(400);
    await win((w) => w.setSize(300, 300));
    await sleep(400);
    check('window cannot shrink below the minimum', JSON.stringify(await win((w) => w.getSize())) === '[380,420]', await win((w) => w.getSize()));
    check('header has no overlaps at the minimum size', (await page.evaluate(overlaps, '.drag-region')).length === 0, await page.evaluate(overlaps, '.drag-region'));

    // Tray menu follows the language
    const tray = await app.evaluate(() => globalThis.__e2e.trayMenus.at(-1).map((i) => i.label).filter(Boolean));
    check('tray menu is English', JSON.stringify(tray) === JSON.stringify(['Open', 'Hide', 'Always on top', 'Start with Windows', 'Quit']), tray);

    check('no CSP warnings or violations', !consoleMessages.some((m) => /Content-Security-Policy|Refused to/.test(m)), consoleMessages);
    check('no uncaught page errors', pageErrors.length === 0, pageErrors);
  } catch (err) {
    check('smoke run finished', false, String(err && err.stack ? err.stack : err).slice(0, 800));
  } finally {
    await app.evaluate(({ app: electronApp }) => electronApp.quit()).catch(() => {});
    await app.close().catch(() => {});
    imageServer.close();
    fakeOllama.close();
    fs.rmSync(userData, { recursive: true, force: true });
  }

  const failed = results.filter((r) => !r.ok).length;
  console.log(`\n${results.length - failed}/${results.length} checks passed`);
  process.exit(failed === 0 ? 0 : 1);
})();
