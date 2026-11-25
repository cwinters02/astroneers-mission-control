// Usage: NODE_PATH=$(npm root -g) node tools/gen_report.cjs [REPO_DIR]
// Writes an auto-generated coach report draft (reports.json) for any recent night that has none yet,
// or whose existing auto draft was written before all of that night's games arrived or under older grading rules (GRADING_VERSION in index.html).
// FORCE_NIGHTS=2026-11-22,... rebuilds those nights even when hand-written.
// A night counts as finished when its newest game is more than 60 minutes old. Hand-written reports are never touched.
const {chromium} = require('playwright'), http = require('http'), fs = require('fs'), path = require('path');
const dir = path.resolve(process.argv[2] || '.');
const read = f => JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8'));
const M = read('matches.json').matches, R = read('reports.json');
const byNight = {};
M.forEach(g => { if (g.sessionNight) (byNight[g.sessionNight] = byNight[g.sessionNight] || []).push(g); });
const now = Date.now() / 1000;
const GV = (fs.readFileSync(path.join(dir, 'index.html'), 'utf8').match(/GRADING_VERSION='([^']+)'/) || [])[1] || '';
const FORCE = (process.env.FORCE_NIGHTS || '').split(',').filter(Boolean);
const fresh = n => { const gs = byNight[n], newest = Math.max(...gs.map(g => g.ts || 0)); return now - newest >= 3600; };
const recent = Object.keys(byNight).sort().reverse().slice(0, 2);
const todo = Object.keys(byNight).sort().reverse().filter(n => {
  if (!fresh(n)) return false;
  const have = R.reports.find(r => r.night === n);
  if (FORCE.includes(n)) return true;
  if (!have) return recent.includes(n);
  // auto drafts are rebuilt when games arrive late or when the grading rules change; hand-written reports are never touched
  return have.auto && (have.games !== byNight[n].length || (GV && have.gv !== GV));
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
    R.reports = R.reports.filter(r => r.night !== n); const o = JSON.parse(rep); o.gv = GV; R.reports.push(o); console.log('reports: wrote', n);
  }
  R.reports.sort((a, b) => b.night.localeCompare(a.night));
  fs.writeFileSync(path.join(dir, 'reports.json'), JSON.stringify(R, null, 1));
  await b.close(); srv.close();
});
