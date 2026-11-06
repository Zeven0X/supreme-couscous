// usage: node render.js <outdir> <dpr> view[:jsonTuning] ...
const http = require('http'), fs = require('fs'), path = require('path');
const { chromium } = require('playwright');
const ROOT = __dirname;
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.png': 'image/png' };
const server = http.createServer((req, res) => {
  const p = path.join(ROOT, decodeURIComponent(req.url.split('?')[0]));
  if (!p.startsWith(ROOT) || !fs.existsSync(p)) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { 'Content-Type': TYPES[path.extname(p)] || 'application/octet-stream' });
  fs.createReadStream(p).pipe(res);
});
(async () => {
  await new Promise(r => server.listen(0, r));
  const port = server.address().port;
  const [outdir, dpr, ...views] = process.argv.slice(2);
  const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: Number(dpr) });
  page.on('console', m => console.log('console:', m.text()));
  page.on('pageerror', e => console.log('pageerror:', e.message));
  for (const spec of views) {
    const i = spec.indexOf(':');
    const view = i < 0 ? spec : spec.slice(0, i), t = i < 0 ? '{}' : spec.slice(i + 1);
    await page.goto(`http://localhost:${port}/scene.html?view=${view}&t=${encodeURIComponent(t)}`);
    await page.waitForFunction(() => window.__done === true, null, { timeout: 60000 });
    await page.screenshot({ path: path.join(outdir, `${view}.png`) });
    console.log('saved', view);
  }
  await browser.close(); server.close();
})();
