# Updating the Astroneers dashboard

The site is static. It shows whatever is in `data.json`, `matches.json` and `reports.json`.

After a night of games:
1. Get the new ChelHead export (or paste the box scores and the coach report) into a Claude chat.
2. Ask Claude to update the dashboard. It edits the three JSON files, runs `smoke.cjs`, and pushes to `main`.
3. GitHub Pages republishes in a minute or two. The "Updated" time at the top of the site shows the data date.

Night grades are calculated in the browser from the box scores in `matches.json` (grading method v4,
see `GRADING_METHOD.md` in the handoff). Nothing else needs editing when new games are added.

Smoke test (needs Playwright): `NODE_PATH=$(npm root -g) node tests/smoke.cjs .`

## Tools (in `tools/`)
- `pull_feed.js`: run in the browser on the ChelHead club page. Saves `astroneers_feed_YYYYMMDDHHMM.json` with the newest games (full player lines, opponent goalie type, divisions) and the club's career totals. Gamertags are mapped to the dashboard's player keys before anything is saved.
- `update.cjs`: `node tools/update.cjs astroneers_feed_YYYYMMDDHHMM.json .` merges that file into `matches.json` and `data.json`.
- A game's "night" is the Eastern date of the evening it started (games before 5 AM Eastern count for the evening before).
