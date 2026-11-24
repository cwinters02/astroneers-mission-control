// node tools/update.cjs FEED_JSON [REPO_DIR]
// Merges a pull_feed.js download into matches.json and data.json. Adds new 3v3 games, upgrades known games with
// full player lines, tags each game with opponent goalie type (human/ai) and divisions, refreshes career totals.
const fs = require('fs'), path = require('path');
const feedFile = process.argv[2], dir = process.argv[3] || process.cwd();
const F = JSON.parse(fs.readFileSync(feedFile));
const mp = path.join(dir, 'matches.json'), dp = path.join(dir, 'data.json');
const M = JSON.parse(fs.readFileSync(mp)), D = JSON.parse(fs.readFileSync(dp));
const etDate = ms => new Intl.DateTimeFormat('en-CA', {timeZone: 'America/New_York', year: 'numeric', month: '2-digit', day: '2-digit'}).format(new Date(ms));
const nightOf = ts => etDate(ts * 1000 - 5 * 3600e3); // games before 5 AM ET belong to the evening before
let added = 0, upgraded = 0, skipped = [];
F.games.slice().sort((a, b) => a.ts - b.ts).forEach(g => {
  if (g.rows.length > 4 || g.oppPlayers > 4) { skipped.push(g.opp + ' (not 3v3)'); return; }
  const rows = g.rows.map(r => ({...Object.fromEntries(F.keys.map((k, i) => [k, r[i]])), verifiedStats: true, partialStats: false}));
  const ctx = {goalie: g.oppGoalie ? 'human' : 'ai', goalieLeftEarly: g.oppGoalie && g.oppGoalie.toi < 300 || undefined,
    goalieShots: g.oppGoalie ? g.oppGoalie.shots : 0, goalieSaves: g.oppGoalie ? g.oppGoalie.saves : 0,
    oppDivision: g.oppDivision, ourDivision: g.usDivision, source: 'ChelHead club-matches feed, ' + F.pulledAt.slice(0, 10)};
  let m = M.matches.find(x => String(x.id) === g.id) ||
          M.matches.find(x => x.opp && x.opp.name === g.opp && Number(x.us.score) === g.us && Number(x.opp.score) === g.th && (x.ts == null || Math.abs(x.ts - g.ts) < 7200));
  if (m) {
    upgraded++;
  } else {
    m = {id: g.id, ts: g.ts, observedDate: etDate(g.ts * 1000), observedAt: new Date(g.ts * 1000).toISOString(),
      source: 'ChelHead club-matches feed', clubId: 69789, clubName: 'Astroneers', gameType: 206, confirmed3v3: true, uiVerified: false,
      verifiedAt: F.pulledAt, modeLabel: '3v3 lobby', type: g.type, sessionNight: nightOf(g.ts), dateNote: 'Timestamp from the ChelHead feed.',
      dnf: !!(g.usDnfWin || g.oppDnfWin), dtw: null,
      us: {score: g.us, shots: g.usShots, result: g.us > g.th ? 1 : 2, division: 11 - g.usDivision},
      opp: {name: g.opp, clubId: g.oppClubId, score: g.th, shots: g.thShots, division: 11 - g.oppDivision}};
    M.matches.unshift(m); added++;
  }
  if (m.ts == null) m.ts = g.ts;
  if (!m.sessionNight) m.sessionNight = nightOf(g.ts);
  m._stats = rows; m.statsSource = 'ChelHead club-matches feed (full player lines)'; m.oppContext = ctx;
  if (m.coverageNote) m.coverageNote = String(m.coverageNote).replace(/Visible basic player lines only\.\s*/, '').replace(/EA LUCK has no captured player lines\.\s*/, '');
});
// newest first, games without a timestamp keep their relative order after timestamped ones
M.matches.sort((a, b) => (b.ts || 0) - (a.ts || 0) || 0);
M.updatedAt = F.pulledAt;
M.contextNote = 'oppContext: opponent goalie is "ai" when the opposing club had no goalie row (3 human skaters), otherwise "human". Divisions in oppContext are the raw per-game clubDivision from the feed (10 is the top division); us/opp.division are stored on the site scale (11 minus the feed value, Div 1 is the best). Games without oppContext are older than the feed window and are treated as unknown.';
fs.writeFileSync(mp, JSON.stringify(M));
if (F.club && F.club.members && F.club.members.length === 4) {
  D.fetchedAt = F.pulledAt.replace(/\.\d+Z$/, 'Z'); D.club = F.club.club; D.clubStats = F.club.clubStats; D.positionCount = F.club.positionCount; D.members = F.club.members;
  fs.writeFileSync(dp, JSON.stringify(D, null, 1));
  console.log('career totals refreshed:', D.members.map(m => m.name.replace('astroneer_', '') + ' ' + m.skgp + 'GP ' + m.skpoints + 'P').join(', '));
} else console.log('career totals NOT refreshed (club report missing)');
console.log(`games: ${added} added, ${upgraded} updated, ${skipped.length} skipped ${skipped.join(', ')}; ${M.matches.length} total`);
