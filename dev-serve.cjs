/**
 * Serves the static site at http://<host>:<port>/japanote/ (port from env PORT, default 8080).
 */
const http = require("http");
const path = require("path");
const { URL } = require("url");
const serveHandler = require("serve-handler");

const PORT = parseInt(process.env.PORT || "8080", 10);
const BASE = "/japanote";
const PUBLIC = path.resolve(__dirname);

const server = http.createServer((req, res) => {
  const u = new URL(req.url || "/", "http://localhost");
  const pathname = u.pathname;

  if (pathname === "/" || pathname === "") {
    res.writeHead(302, { Location: `${BASE}/` });
    res.end();
    return;
  }
  if (pathname === BASE) {
    res.writeHead(302, { Location: `${BASE}/` });
    res.end();
    return;
  }
  if (pathname === `${BASE}/` || pathname.startsWith(`${BASE}/`)) {
    const rest =
      pathname === `${BASE}/` ? "/" : pathname.slice(BASE.length) || "/";
    req.url = (rest[0] === "/" ? rest : `/${rest}`) + (u.search || "");
    const run = serveHandler(req, res, { public: PUBLIC });
    if (run && typeof run.then === "function") {
      run.catch((err) => {
        console.error("[japanote] serve-handler:", err);
        if (!res.headersSent) {
          res.writeHead(500, { "Content-Type": "text/plain; charset=utf-8" });
          res.end("Server error");
        } else {
          res.destroy();
        }
      });
    }
    return;
  }
  const toBase = u.pathname;
  res.writeHead(302, { Location: `${BASE}${toBase.startsWith("/") ? toBase : `/${toBase}`}` + (u.search || "") });
  res.end();
});

function describeListenError(err) {
  if (err && err.code === "EADDRINUSE") {
    return `Port ${PORT} is already in use. Stop the other "npm run dev" (or the old PM2 japanote) and start again, or set PORT.`;
  }
  return err ? String(err.stack || err.message) : "unknown";
}

server.on("error", (err) => {
  console.error("[japanote] http server error:", describeListenError(err));
  process.exit(1);
});

process.on("unhandledRejection", (reason) => {
  console.error("[japanote] unhandledRejection:", reason);
});

server.listen(PORT, "0.0.0.0", () => {
  console.log(
    `Local: http://localhost:${PORT}${BASE}/ (pid ${process.pid}, cwd ${process.cwd()})`
  );
});
