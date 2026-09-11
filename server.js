const http = require("http");
const fs = require("fs");
const path = require("path");

const PORT = process.env.PORT || 3000;
const PUBLIC_DIR = path.join(__dirname, "public");
const DATA_DIR = path.join(__dirname, "data");
const SCOREBOARD_FILE = path.join(DATA_DIR, "scoreboard.json");
const SCOREBOARD_CAP = 20;
const MAX_NAME_LEN = 16;
const MAX_BEST = 1_000_000;
const MAX_TOTAL_POINTS = 1e15;
const MAX_TOTAL_WINS = 1e12;

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
  ".webp": "image/webp",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
};

/** @type {{ name: string, best: number, totalPoints: number, totalWins: number, updatedAt: string }[]} */
let scoreboard = [];

function send(res, status, body, headers = {}) {
  res.writeHead(status, {
    "Cache-Control": "no-cache",
    ...headers,
  });
  res.end(body);
}

function sendJson(res, status, obj) {
  send(res, status, JSON.stringify(obj), {
    "Content-Type": "application/json; charset=utf-8",
  });
}

function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

function loadScoreboard() {
  try {
    ensureDataDir();
    if (!fs.existsSync(SCOREBOARD_FILE)) {
      scoreboard = [];
      return;
    }
    const raw = fs.readFileSync(SCOREBOARD_FILE, "utf8");
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      scoreboard = [];
      return;
    }
    scoreboard = parsed
      .filter((e) => e && typeof e === "object")
      .map((e) => ({
        name: String(e.name || "PLAYER").slice(0, MAX_NAME_LEN),
        best: Math.max(0, Math.floor(Number(e.best) || 0)),
        totalPoints: Math.max(0, Math.floor(Number(e.totalPoints) || 0)),
        totalWins: Math.max(0, Math.floor(Number(e.totalWins) || 0)),
        updatedAt: typeof e.updatedAt === "string" ? e.updatedAt : new Date().toISOString(),
      }))
      .sort(compareEntries)
      .slice(0, SCOREBOARD_CAP);
  } catch {
    scoreboard = [];
  }
}

function persistScoreboard() {
  try {
    ensureDataDir();
    fs.writeFileSync(SCOREBOARD_FILE, JSON.stringify(scoreboard, null, 2), "utf8");
  } catch (err) {
    console.error("Failed to persist scoreboard:", err.message);
  }
}

function compareEntries(a, b) {
  if (b.best !== a.best) return b.best - a.best;
  if (b.totalPoints !== a.totalPoints) return b.totalPoints - a.totalPoints;
  if (b.totalWins !== a.totalWins) return b.totalWins - a.totalWins;
  return String(a.name).localeCompare(String(b.name));
}

function sanitizeName(name) {
  if (typeof name !== "string") return null;
  const cleaned = name
    .replace(/[^\w\s\-_.!]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, MAX_NAME_LEN)
    .toUpperCase();
  return cleaned || "PLAYER";
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    req.on("data", (chunk) => {
      size += chunk.length;
      if (size > 64 * 1024) {
        reject(new Error("Body too large"));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
    req.on("error", reject);
  });
}

function handleGetScoreboard(res) {
  sendJson(res, 200, { entries: scoreboard.slice(0, SCOREBOARD_CAP) });
}

async function handlePostScoreboard(req, res) {
  try {
    const raw = await readBody(req);
    let body;
    try {
      body = JSON.parse(raw || "{}");
    } catch {
      return sendJson(res, 400, { error: "Invalid JSON" });
    }

    const name = sanitizeName(body.name);
    if (!name) return sendJson(res, 400, { error: "Invalid name" });

    const best = Number(body.best);
    const totalPoints = Number(body.totalPoints);
    const totalWins = Number(body.totalWins);

    if (![best, totalPoints, totalWins].every((n) => Number.isFinite(n) && n >= 0)) {
      return sendJson(res, 400, { error: "Invalid numeric fields" });
    }

    const entry = {
      name,
      best: Math.floor(best),
      totalPoints: Math.floor(totalPoints),
      totalWins: Math.floor(totalWins),
      updatedAt: new Date().toISOString(),
    };

    if (
      entry.best > MAX_BEST ||
      entry.totalPoints > MAX_TOTAL_POINTS ||
      entry.totalWins > MAX_TOTAL_WINS
    ) {
      return sendJson(res, 400, { error: "Values out of range" });
    }

    // Upsert by case-insensitive name: keep the better combined record
    const idx = scoreboard.findIndex((e) => e.name.toLowerCase() === entry.name.toLowerCase());
    if (idx >= 0) {
      const prev = scoreboard[idx];
      scoreboard[idx] = {
        name: entry.name,
        best: Math.max(prev.best, entry.best),
        totalPoints: Math.max(prev.totalPoints, entry.totalPoints),
        totalWins: Math.max(prev.totalWins, entry.totalWins),
        updatedAt: entry.updatedAt,
      };
    } else {
      scoreboard.push(entry);
    }

    scoreboard.sort(compareEntries);
    scoreboard = scoreboard.slice(0, SCOREBOARD_CAP);
    persistScoreboard();

    sendJson(res, 200, { ok: true, entries: scoreboard });
  } catch (err) {
    sendJson(res, 400, { error: err.message || "Bad request" });
  }
}

loadScoreboard();

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url || "/", `http://${req.headers.host || "localhost"}`);
    let pathname = decodeURIComponent(url.pathname);
    const method = (req.method || "GET").toUpperCase();

    if (pathname === "/health" || pathname === "/api/health") {
      return sendJson(res, 200, { ok: true, name: "infinite-flip" });
    }

    if (pathname === "/api/scoreboard") {
      if (method === "GET") return handleGetScoreboard(res);
      if (method === "POST") return handlePostScoreboard(req, res);
      res.setHeader("Allow", "GET, POST");
      return sendJson(res, 405, { error: "Method not allowed" });
    }

    if (pathname === "/") pathname = "/index.html";

    const safePath = path.normalize(pathname).replace(/^(\.\.[/\\])+/, "");
    const filePath = path.join(PUBLIC_DIR, safePath);

    if (!filePath.startsWith(PUBLIC_DIR)) {
      return send(res, 403, "Forbidden");
    }

    fs.readFile(filePath, (err, data) => {
      if (err) {
        if (err.code === "ENOENT") {
          return send(res, 404, "Not found");
        }
        return send(res, 500, "Server error");
      }
      const ext = path.extname(filePath).toLowerCase();
      send(res, 200, data, { "Content-Type": MIME[ext] || "application/octet-stream" });
    });
  } catch (e) {
    send(res, 500, "Server error");
  }
});

server.listen(PORT, () => {
  console.log(`Infinite Flip running at http://localhost:${PORT}`);
});
