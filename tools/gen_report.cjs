// Usage: NODE_PATH=$(npm root -g) node tools/gen_report.cjs [REPO_DIR]
// Writes an auto-generated coach report draft (reports.json) for any recent night that has none yet,
// or whose existing auto draft was written before all of that night's games arrived.
// A night counts as finished when its newest game is more than 60 minutes old. Hand-written reports are never touched.
const {chromium} = require('playwright'), http = require('http'), fs = require('fs'), path = require('path');
const dir = path.resolve(process.argv[2] || '.');
const read = f => JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8'));
const M = read('matches.json').matches, R = read('reports.json');
const byNight = {};
M.forEach(g => { if (g.sessionNight) (byNight[g.sessionNight] = byNight[g.sessionNight] || []).push(g); });
const now = Date.now() / 1000;
const todo = Object.keys(byNight).sort().reverse().slice(0, 2).filter(n => {
  const gs = byNight[n], newest = Math.max(...gs.map(g => g.ts || 0));
  if (now - newest < 3600) return false;
  const have = R.reports.find(r => r.night === n);
  return process.env.REGEN_AUTO&&have&&have.auto||!have || (have.auto && have.games !== gs.length);
});
if (!todo.length) { console.log('reports: nothing to write'); process.exit(0); }
const srv = http.createServer((q, r) => { let p = q.url.split('?')[0]; if (p === '/') p = '/index.html';
  fs.readFile(path.join(dir, p), (e, d) => { if (e) { r.writeHead(404); r.end(); return; }
    r.writeHead(200, {'content-type': p.endsWith('.json') ? 'application/json' : 'text/html'}); r.end(d); }); });
srv.listen(0, async () => {
  const b = await chromium.launch(process.env.CHROMIUM_PATH?{executablePath:process.env.CHROMIUM_PATH}:{}), pg = await b.newPage();
  await pg.goto('http://127.0.0.1:' + srv.address().port + '/'); await pg.waitForTimeout(1500);
  for (const n of todo) {
    const rep = await pg.evaluate(n => { const r = window.AST.buildReport(n); return r ? JSON.stringify(r) : null; }, n);
    if (!rep) { console.log('reports: no report built for', n); continue; }
    R.reports = R.reports.filter(r => r.night !== n); R.reports.push(JSON.parse(rep)); console.log('reports: wrote', n);
  }
  R.reports.sort((a, b) => b.night.localeCompare(a.night));
  fs.writeFileSync(path.join(dir, 'reports.json'), JSON.stringify(R, null, 1));
  await b.close(); srv.close();
});
