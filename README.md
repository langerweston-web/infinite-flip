# Infinite Flip

Coin-flip idle game with shop upgrades (luck, speed, crit, auto flip, extra coins, and more).

## Play locally

```bash
npm start
```

Then open [http://localhost:3000](http://localhost:3000).

Health check: [http://localhost:3000/health](http://localhost:3000/health)

## Deploy

This is a tiny Node HTTP server that serves `public/`. Point any Node host (Render, Railway, Fly.io, etc.) at:

- **Start command:** `npm start`
- **Port:** uses `PORT` from the environment (defaults to `3000`)

You can also open `public/index.html` directly in a browser — the game is fully client-side. The server is for hosting and a simple health endpoint.

## Shop caps

- **Luck** — max at 75% (level 5); shop shows `MAX`
- **Speed** — max at 500ms flip floor
- **Crit** — max at 100%
- **Auto flip** — max at 5
- **Extra coins** — shown as gold pips under the main coin

## Scoreboard

Local + shared leaderboards for best streak, total points earned, and total wins.

- **In-game:** open **SCOREBOARD** (header, near STATS). Edit your display name (default `PLAYER`), then **SUBMIT SCORE**. Scores are stored in `localStorage` so GitHub Pages works offline.
- **Tabs:** **LOCAL** always works in the browser. **GLOBAL** appears when the Node server API is reachable; if fetch fails (e.g. static Pages host), the UI stays on local without errors.
- **Auto-submit:** when your best streak improves, on rebirth, and when leaving the page (local upsert; global via `sendBeacon` when available).

### API (Node server)

| Method | Path | Body / response |
|--------|------|-----------------|
| `GET` | `/api/scoreboard` | `{ "entries": [ { name, best, totalPoints, totalWins, updatedAt } ] }` (top ~20) |
| `POST` | `/api/scoreboard` | `{ "name", "best", "totalPoints", "totalWins" }` — validated/sanitized; absurd values rejected |

Entries are kept in memory and persisted to `data/scoreboard.json` across restarts.

