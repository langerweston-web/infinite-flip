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
