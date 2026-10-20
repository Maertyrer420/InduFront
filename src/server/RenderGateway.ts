import { spawn, type ChildProcess } from "node:child_process";
import http from "node:http";
import net from "node:net";

const PORT = Number(process.env.PORT ?? 10000);
const NUM_WORKERS = Number(process.env.NUM_WORKERS ?? 2);
const AUTH_PORT = Number(process.env.AUTH_PORT ?? 8787);
const MASTER_PORT = 3000;

const env: NodeJS.ProcessEnv = {
  ...process.env,
  GAME_ENV: process.env.GAME_ENV ?? "dev",
  DOMAIN: process.env.DOMAIN ?? "localhost",
  GIT_COMMIT: process.env.GIT_COMMIT ?? "DEV",
  NUM_WORKERS: String(NUM_WORKERS),
  AUTH_PORT: String(AUTH_PORT),
  TURNSTILE_SITE_KEY:
    process.env.TURNSTILE_SITE_KEY ?? "1x00000000000000000000AA",
  API_KEY:
    process.env.API_KEY ?? "WARNING_DEV_API_KEY_DO_NOT_USE_IN_PRODUCTION",
  ADMIN_BOT_API_KEY:
    process.env.ADMIN_BOT_API_KEY ??
    "WARNING_DEV_ADMIN_BOT_KEY_DO_NOT_USE_IN_PRODUCTION",
};

const children: ChildProcess[] = [];

function startService(name: string, script: string): ChildProcess {
  const child = spawn(process.execPath, ["--import", "tsx", script], {
    env,
    stdio: "inherit",
  });
  child.on("exit", (code, signal) => {
    console.error(`[gateway] ${name} exited (code=${code}, signal=${signal})`);
  });
  children.push(child);
  return child;
}

const RANDOM_WORKER_PATHS = new Set([
  "/api/create_game",
  "/api/adminbot/create_game",
  "/api/adminbot/create_pool",
]);

function pickRandomWorkerPort(): number {
  return 3001 + Math.floor(Math.random() * Math.max(1, NUM_WORKERS));
}

function resolveTarget(req: http.IncomingMessage): {
  port: number;
  path: string;
} {
  const rawUrl = req.url ?? "/";
  const qIndex = rawUrl.indexOf("?");
  const pathname = qIndex >= 0 ? rawUrl.slice(0, qIndex) : rawUrl;
  const search = qIndex >= 0 ? rawUrl.slice(qIndex) : "";

  // 1. Auth & Social API (/idp/* -> 127.0.0.1:8787/*)
  if (pathname === "/idp" || pathname.startsWith("/idp/")) {
    const stripped = pathname.slice(4) || "/";
    return { port: AUTH_PORT, path: stripped + search };
  }

  // 2. Random worker game creation
  if (req.method === "POST" && RANDOM_WORKER_PATHS.has(pathname)) {
    return { port: pickRandomWorkerPort(), path: rawUrl };
  }

  // 3. Worker routes (/w0/*, /w1/*, etc.)
  const workerMatch = /^\/w(\d+)(\/.*)?$/.exec(pathname);
  if (workerMatch) {
    const idx = Number(workerMatch[1]);
    if (Number.isInteger(idx) && idx >= 0 && idx < NUM_WORKERS) {
      return { port: 3001 + idx, path: rawUrl };
    }
  }

  // 4. Bare /lobbies WebSocket fallback -> Worker 0
  if (pathname === "/lobbies") {
    return { port: 3001, path: rawUrl };
  }

  // 5. Default -> Master HTTP server (serves static/ + SPA shell + /api/health)
  return { port: MASTER_PORT, path: rawUrl };
}

const server = http.createServer((req, res) => {
  const rawUrl = req.url ?? "/";
  const pathname = rawUrl.split("?")[0];

  if (pathname === "/healthz") {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ status: "ok" }));
    return;
  }

  if (pathname === "/link" || pathname === "/link/") {
    res.writeHead(302, { Location: "/#steam-link" });
    res.end();
    return;
  }

  if (pathname === "/terms-of-service.html") {
    res.writeHead(302, {
      Location: "/terms.html",
      "Cache-Control": "no-cache, no-store, must-revalidate",
      Pragma: "no-cache",
      Expires: "0",
    });
    res.end();
    return;
  }

  if (pathname === "/privacy-policy.html") {
    res.writeHead(302, {
      Location: "/privacy.html",
      "Cache-Control": "no-cache, no-store, must-revalidate",
      Pragma: "no-cache",
      Expires: "0",
    });
    res.end();
    return;
  }

  const target = resolveTarget(req);
  const proto =
    (req.headers["x-forwarded-proto"] as string) ?? "http";
  const remoteAddr = req.socket.remoteAddress ?? "";
  const forwardedFor = req.headers["x-forwarded-for"]
    ? `${req.headers["x-forwarded-for"]}, ${remoteAddr}`
    : remoteAddr;

  const proxyHeaders: http.OutgoingHttpHeaders = {
    ...req.headers,
    "x-real-ip": (req.headers["x-real-ip"] as string) ?? remoteAddr,
    "x-forwarded-for": forwardedFor,
    "x-forwarded-proto": proto,
  };

  const proxyReq = http.request(
    {
      host: "127.0.0.1",
      port: target.port,
      method: req.method,
      path: target.path,
      headers: proxyHeaders,
    },
    (proxyRes) => {
      const headers = { ...proxyRes.headers };
      if (
        pathname.endsWith(".html") ||
        pathname === "/" ||
        pathname === "/terms.html" ||
        pathname === "/privacy.html"
      ) {
        headers["cache-control"] = "no-cache, no-store, must-revalidate";
        headers["pragma"] = "no-cache";
        headers["expires"] = "0";
      }
      res.writeHead(proxyRes.statusCode ?? 502, headers);
      proxyRes.pipe(res);
    },
  );

  proxyReq.on("error", (err) => {
    if (!res.headersSent) {
      res.writeHead(502, { "Content-Type": "application/json" });
    }
    res.end(JSON.stringify({ error: "bad_gateway", message: err.message }));
  });

  req.pipe(proxyReq);
});

server.on("upgrade", (req, clientSocket, head) => {
  const target = resolveTarget(req);
  const upstreamSocket = net.connect(target.port, "127.0.0.1", () => {
    let rawHeader = `${req.method ?? "GET"} ${target.path} HTTP/${req.httpVersion}\r\n`;
    for (let i = 0; i < req.rawHeaders.length; i += 2) {
      rawHeader += `${req.rawHeaders[i]}: ${req.rawHeaders[i + 1]}\r\n`;
    }
    rawHeader += "\r\n";
    upstreamSocket.write(rawHeader);
    if (head && head.length > 0) {
      upstreamSocket.write(head);
    }
    clientSocket.pipe(upstreamSocket);
    upstreamSocket.pipe(clientSocket);
  });

  upstreamSocket.on("error", () => {
    clientSocket.destroy();
  });
  clientSocket.on("error", () => {
    upstreamSocket.destroy();
  });
});

startService("auth-server", "src/server/auth/AuthServer.ts");
startService("game-server", "src/server/Server.ts");

server.listen(PORT, "0.0.0.0", () => {
  const externalUrl = (
    process.env.RENDER_EXTERNAL_URL ??
    process.env.KEEP_ALIVE_URL ??
    ""
  ).replace(/\/$/, "");

  console.log("==================================================================");
  console.log(`[gateway] UNIFIED 24/7 SERVER ONLINE!`);
  if (externalUrl.startsWith("http")) {
    console.log(`[gateway] PUBLIC GAME URL: ${externalUrl}`);
  } else {
    console.log(`[gateway] Listening on port ${PORT} (traffic proxied by Render)`);
  }
  console.log(`[gateway] Internal processes: Master :${MASTER_PORT}, Workers :3001..${3000 + NUM_WORKERS}, Auth :${AUTH_PORT}`);
  console.log("==================================================================");

  // Optional 24/7 Keep-Alive self-ping when running on Render (prevents 15-min idle sleep)
  if (externalUrl.startsWith("http")) {
    const intervalMs = 10 * 60 * 1000; // every 10 minutes
    console.log(
      `[gateway] 24/7 Keep-Alive active: pinging ${externalUrl}/healthz every 10m`,
    );
    setInterval(() => {
      fetch(`${externalUrl}/healthz`).catch(() => {
        // Ignore transient network errors
      });
    }, intervalMs).unref();
  }
});

function shutdown() {
  for (const child of children) {
    child.kill("SIGTERM");
  }
  process.exit(0);
}

process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);
