// Run in the browser on https://chelhead.com/view-club/common-gen5/69789 (after the page has loaded).
// Reads ChelHead's own recent-games feed and the club report already on the page, maps gamertags to the
// dashboard's player keys (real gamertags never leave the browser), and saves astroneers_feed_YYYYMMDDHHMM.json to Downloads.
(async () => {
  const ME = '69789';
  const MAP = {WINTRXS:'astroneer_moose', TheCicc_WP:'astroneer_flappy', TheHoax_WP:'astroneer_gordy', Toastedlemur669:'astroneer_gumbo'};
  const KEYS = "position,class,playerLevel,isGuest,clientPlatform,skgoals,skassists,skshots,skshotattempts,skshotpct,skshotonnetpct,skplusmin,skppg,skshg,skgwg,skpasses,skpassattempts,skpasspct,sksaucerpasses,skhits,skbs,sktakeaways,skgiveaways,skinterceptions,skdeflections,skpim,skpenaltiesdrawn,skpkclearzone,skpossession,skfow,skfol,skfopct,toi,toiseconds,ratingOffense,ratingDefense,ratingTeamplay,glsaves,glshots,glsavepct,glga,glgaa,glsoperiods,glbrksaves,glbrkshots,glbrksavepct,gldsaves,glpensaves,glpenshots,glpensavepct,glpokechecks,glpkclearzone,player_dnf".split(',');
  const num = v => (typeof v === 'string' && /^-?\d+(\.\d+)?$/.test(v)) ? Number(v) : v;
  const TYPES = ['public', 'cup', 'private'];
  const res = await fetch(`https://stats.chelhead.com/club-matches?platform=common-gen5&clubId=${ME}&matchType=all`);
  if (!res.ok) return 'FAILED matches HTTP ' + res.status;
  const raw = await res.json();
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
      rows: Object.values((m.players && m.players[ME]) || {}).map(p => [MAP[p.playername] || 'Astroneers guest', ...KEYS.map(k => num(p[k]))])
    });
  }));
  let club = null;
  const el = document.getElementById('ng-state');
  if (el) {
    const st = JSON.parse(el.textContent);
    const rep = Object.values(st).find(v => v && typeof v === 'object' && String(v.u || '').includes('full-club-report'));
    if (rep && Array.isArray(rep.b)) {
      club = {positionCount: rep.b[0].positionCount, clubStats: (rep.b[1] || [])[0] || {}, club: (rep.b[2] || {})[ME] || {},
        members: (rep.b[0].members || []).filter(m => MAP[m.name]).map(m => ({...m, name: MAP[m.name]}))};
    }
  }
  const blob = new Blob([JSON.stringify({pulledAt: new Date().toISOString(), keys: ['name', ...KEYS], games, club})], {type: 'application/json'});
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); const fname = 'astroneers_feed_' + new Date().toISOString().replace(/[-:T]/g, '').slice(0, 12) + '.json'; a.download = fname;
  document.body.appendChild(a); a.click(); a.remove();
  return 'downloaded ' + fname + ': ' + games.length + ' games, club report ' + (club ? club.members.length + ' members' : 'MISSING');
})()
