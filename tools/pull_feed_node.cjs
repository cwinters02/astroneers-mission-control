// node tools/pull_feed_node.cjs OUT.json
// Same output as tools/pull_feed.js, but runs on a server (GitHub Actions) instead of in a browser.
// Reads the 5 newest public + 5 newest cup games from the ChelHead stats feed, and the club career totals
// that ChelHead server-renders into the club page (the ng-state block).
const fs = require('fs');
const out = process.argv[2] || 'feed.json';
const ME = '69789';
const MAP = {WINTRXS: 'astroneer_moose', TheCicc_WP: 'astroneer_flappy', TheHoax_WP: 'astroneer_gordy', Toastedlemur669: 'astroneer_gumbo'};
const KEYS = 'position,class,playerLevel,isGuest,clientPlatform,skgoals,skassists,skshots,skshotattempts,skshotpct,skshotonnetpct,skplusmin,skppg,skshg,skgwg,skpasses,skpassattempts,skpasspct,sksaucerpasses,skhits,skbs,sktakeaways,skgiveaways,skinterceptions,skdeflections,skpim,skpenaltiesdrawn,skpkclearzone,skpossession,skfow,skfol,skfopct,toi,toiseconds,ratingOffense,ratingDefense,ratingTeamplay,glsaves,glshots,glsavepct,glga,glgaa,glsoperiods,glbrksaves,glbrkshots,glbrksavepct,gldsaves,glpensaves,glpenshots,glpensavepct,glpokechecks,glpkclearzone,player_dnf'.split(',');
const num = v => (typeof v === 'string' && /^-?\d+(\.\d+)?$/.test(v)) ? Number(v) : v;
const TYPES = ['public', 'cup', 'private'];
const H = {'user-agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36',
  'accept': 'application/json, text/plain, */*', 'origin': 'https://chelhead.com', 'referer': 'https://chelhead.com/view-club/common-gen5/' + ME};

function parseNgState(html) {
  const m = html.match(/<script[^>]*id=["']ng-state["'][^>]*>([\s\S]*?)<\/script>/);
  if (!m) return null;
  let t = m[1];
  try { return JSON.parse(t); } catch (e) {}
  t = t.replace(/&q;/g, '"').replace(/&s;/g, "'").replace(/&l;/g, '<').replace(/&g;/g, '>').replace(/&a;/g, '&');
  return JSON.parse(t);
}
function clubFrom(st) {
  const rep = Object.values(st).find(v => v && typeof v === 'object' && String(v.u || '').includes('full-club-report'));
  if (!rep || !Array.isArray(rep.b)) return null;
  return {positionCount: rep.b[0].positionCount, clubStats: (rep.b[1] || [])[0] || {}, club: (rep.b[2] || {})[ME] || {},
    members: (rep.b[0].members || []).filter(m => MAP[m.name]).map(m => ({...m, name: MAP[m.name]}))};
}
const DROP = new Set(['playername','teamArtAbbr','opponentTeamArtAbbr','opponentClubId','opponentTeamId','teamId','memberString','scoreString','posSorted','teamSide','opponentScore','score','scoreRaw','result','pNhlOnlineGameType','ranktierassetid']);
function allKeys(raw) {
  const extra = new Set();
  raw.forEach(arr => (arr || []).forEach(m => Object.values((m.players && m.players[ME]) || {}).forEach(p => Object.keys(p).forEach(k => { if (!KEYS.includes(k) && !DROP.has(k)) extra.add(k); }))));
  return [...KEYS, ...[...extra].sort()];
}
function gamesFrom(raw, cols) {
  cols = cols || KEYS;
  const games = [];
  raw.forEach((arr, i) => (arr || []).forEach(m => {
    if (!m.clubs || !m.clubs[ME]) return;
    const o = Object.keys(m.clubs).find(k => k !== ME), us = m.clubs[ME], th = m.clubs[o] || {};
    const oppRows = Object.values((m.players && m.players[o]) || {});
    const g = oppRows.find(p => p.position === 'goalie');
    games.push({
      id: String(m.matchId), ts: m.timestamp, type: TYPES[i] || String(i),
      opp: th.details && th.details.name, oppClubId: th.details && Number(th.details.clubId) || null,
      us: Number(us.score), th: Number(th.score), usShots: Number(us.shots), thShots: Number(th.shots),
      usDivision: Number(us.clubDivision), oppDivision: Number(th.clubDivision),
      usDnfWin: Number(us.winnerByDnf || 0), oppDnfWin: Number(th.winnerByDnf || 0),
      oppGoalie: g ? {shots: Number(g.glshots), saves: Number(g.glsaves), toi: Number(g.toiseconds)} : null, oppPlayers: oppRows.length,
      rows: Object.values((m.players && m.players[ME]) || {}).map(p => [MAP[p.playername] || 'Astroneers guest', ...cols.map(k => num(p[k]))])
    });
  }));
  return games;
}
module.exports = {parseNgState, clubFrom, gamesFrom, allKeys};
if (require.main === module) (async () => {
  const r = await fetch(`https://stats.chelhead.com/club-matches?platform=common-gen5&clubId=${ME}&matchType=all`, {headers: H});
  if (!r.ok) { console.error('FAILED matches feed HTTP ' + r.status); process.exit(1); }
  const raw = await r.json(), cols = allKeys(raw), games = gamesFrom(raw, cols);
  console.log('player row columns: ' + cols.length + ' (' + (cols.length - KEYS.length) + ' beyond the basic set)');
  console.log('extra columns: ' + cols.slice(KEYS.length).join(','));
  if (!games.length) { console.error('FAILED matches feed returned no games'); process.exit(1); }
  let club = null;
  try {
    const p = await fetch('https://chelhead.com/view-club/common-gen5/' + ME, {headers: {...H, accept: 'text/html'}});
    if (p.ok) { const st = parseNgState(await p.text()); club = st && clubFrom(st); }
    else console.error('club page HTTP ' + p.status);
  } catch (e) { console.error('club page: ' + e.message); }
  fs.writeFileSync(out, JSON.stringify({pulledAt: new Date().toISOString(), keys: ['name', ...cols], games, club}));
  console.log(`pulled ${games.length} games, club report ${club ? club.members.length + ' members' : 'MISSING'}`);
})();
