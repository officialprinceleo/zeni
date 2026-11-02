const http = require("http");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const PORT = process.env.PORT || 3000;
const PASSWORD = process.env.ADMIN_PASSWORD || "changeme";
const PUBLIC_DIR = path.join(__dirname, "public");
const MENU_FILE = path.join(__dirname, "menu.json");
const SESSION_MS = 8 * 60 * 60 * 1000;
const MAX_BODY = 256 * 1024;
const MAX_FAILS = 5;
const LOCKOUT_MS = 15 * 60 * 1000;

const sessions = new Map();
const fails = new Map();

const TYPES = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".ico": "image/x-icon"
};

const SECURITY_HEADERS = {
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY",
  "Referrer-Policy": "same-origin"
};

function send(res, code, body, headers = {}) {
  res.writeHead(code, { ...SECURITY_HEADERS, ...headers });
  res.end(body);
}

function json(res, code, obj, headers = {}) {
  send(res, code, JSON.stringify(obj), {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
    ...headers
  });
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    req.on("data", c => {
      size += c.length;
      if (size > MAX_BODY) {
        reject(Object.assign(new Error("Request too large"), { status: 413 }));
        req.destroy();
        return;
      }
      chunks.push(c);
    });
    req.on("end", () => {
      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString("utf8") || "{}"));
      } catch {
        reject(Object.assign(new Error("Invalid JSON"), { status: 400 }));
      }
    });
    req.on("error", reject);
  });
}

function cookies(req) {
  const out = {};
  (req.headers.cookie || "").split(";").forEach(p => {
    const i = p.indexOf("=");
    if (i > 0) out[p.slice(0, i).trim()] = decodeURIComponent(p.slice(i + 1).trim());
  });
  return out;
}

function isAdmin(req) {
  const sid = cookies(req).sid;
  const s = sid && sessions.get(sid);
  if (!s) return false;
  if (s.expires < Date.now()) {
    sessions.delete(sid);
    return false;
  }
  return true;
}

function safeEqual(a, b) {
  const ha = crypto.createHash("sha256").update(String(a)).digest();
  const hb = crypto.createHash("sha256").update(String(b)).digest();
  return crypto.timingSafeEqual(ha, hb);
}

function validateMenu(data) {
  if (!Array.isArray(data) || data.length > 200) throw new Error("Menu must be a list of up to 200 dishes");
  return data.map((d, i) => {
    const n = i + 1;
    const str = (v, key, min, max) => {
      if (typeof v !== "string" || v.trim().length < min || v.length > max) {
        throw new Error(`Dish ${n}: invalid ${key}`);
      }
      return v.trim();
    };
    const price = Number(d.price);
    if (!Number.isFinite(price) || price < 0 || price > 10000) throw new Error(`Dish ${n}: invalid price`);
    if (typeof d.tint !== "string" || !/^#[0-9a-fA-F]{6}$/.test(d.tint)) throw new Error(`Dish ${n}: invalid color`);
    return {
      name: str(d.name, "name", 1, 80),
      cat: str(d.cat, "category", 1, 40),
      price: Math.round(price * 100) / 100,
      emoji: str(d.emoji, "emoji", 1, 16),
      tint: d.tint,
      veg: d.veg === true,
      desc: typeof d.desc === "string" ? d.desc.trim().slice(0, 300) : ""
    };
  });
}

function loadMenu() {
  return JSON.parse(fs.readFileSync(MENU_FILE, "utf8"));
}

function saveMenu(menu) {
  const tmp = MENU_FILE + ".tmp";
  fs.writeFileSync(tmp, JSON.stringify(menu, null, 2));
  fs.renameSync(tmp, MENU_FILE);
}

async function handleApi(req, res, pathname) {
  const ip = req.socket.remoteAddress;

  if (pathname === "/api/menu" && req.method === "GET") {
    return json(res, 200, loadMenu());
  }

  if (pathname === "/api/session" && req.method === "GET") {
    return json(res, 200, { admin: isAdmin(req) });
  }

  const mutating = ["POST", "PUT", "DELETE"].includes(req.method);
  if (mutating && !String(req.headers["content-type"] || "").startsWith("application/json")) {
    return json(res, 415, { error: "Content-Type must be application/json" });
  }

  if (pathname === "/api/login" && req.method === "POST") {
    const f = fails.get(ip);
    if (f && f.count >= MAX_FAILS && f.until > Date.now()) {
      return json(res, 429, { error: "Too many attempts. Try again in 15 minutes." });
    }
    const body = await readBody(req);
    if (typeof body.password === "string" && safeEqual(body.password, PASSWORD)) {
      fails.delete(ip);
      const sid = crypto.randomBytes(32).toString("hex");
      sessions.set(sid, { expires: Date.now() + SESSION_MS });
      return json(res, 200, { ok: true }, {
        "Set-Cookie": `sid=${sid}; HttpOnly; SameSite=Strict; Path=/; Max-Age=${SESSION_MS / 1000}`
      });
    }
    const count = (f && f.until > Date.now() ? f.count : 0) + 1;
    fails.set(ip, { count, until: Date.now() + LOCKOUT_MS });
    return json(res, 401, { error: "Wrong password" });
  }

  if (pathname === "/api/logout" && req.method === "POST") {
    const sid = cookies(req).sid;
    if (sid) sessions.delete(sid);
    return json(res, 200, { ok: true }, {
      "Set-Cookie": "sid=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0"
    });
  }

  if (pathname === "/api/menu" && req.method === "PUT") {
    if (!isAdmin(req)) return json(res, 401, { error: "Log in to edit the menu" });
    const body = await readBody(req);
    const clean = validateMenu(body);
    saveMenu(clean);
    return json(res, 200, { ok: true, count: clean.length });
  }

  return json(res, 404, { error: "Not found" });
}

function serveStatic(req, res, pathname) {
  if (req.method !== "GET" && req.method !== "HEAD") return send(res, 405, "Method not allowed");
  if (pathname === "/admin" || pathname === "/admin/") pathname = "/admin.html";
  if (pathname === "/") pathname = "/index.html";
  const file = path.normalize(path.join(PUBLIC_DIR, pathname));
  if (!file.startsWith(PUBLIC_DIR + path.sep)) return send(res, 403, "Forbidden");
  fs.readFile(file, (err, data) => {
    if (err) return send(res, 404, "Not found", { "Content-Type": "text/plain" });
    send(res, 200, data, {
      "Content-Type": TYPES[path.extname(file)] || "application/octet-stream",
      "Cache-Control": "no-cache"
    });
  });
}

const server = http.createServer(async (req, res) => {
  let pathname;
  try {
    pathname = decodeURIComponent(new URL(req.url, "http://x").pathname);
  } catch {
    return send(res, 400, "Bad request");
  }
  try {
    if (pathname.startsWith("/api/")) return await handleApi(req, res, pathname);
    serveStatic(req, res, pathname);
  } catch (e) {
    json(res, e.status || 400, { error: e.message || "Bad request" });
  }
});

server.listen(PORT, () => {
  console.log(`Site:  http://localhost:${PORT}`);
  console.log(`Admin: http://localhost:${PORT}/admin`);
  if (PASSWORD === "changeme") console.log("WARNING: using default password. Set ADMIN_PASSWORD before going live.");
});
