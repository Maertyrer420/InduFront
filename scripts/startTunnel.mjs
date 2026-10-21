import { spawn } from "node:child_process";
import fs from "node:fs";

const candidates = [
  "C:\\Program Files (x86)\\cloudflared\\cloudflared.exe",
  "C:\\Program Files\\Cloudflare\\Cloudflared\\cloudflared.exe",
  "C:\\Program Files\\cloudflared\\cloudflared.exe",
  "cloudflared",
];

const bin =
  candidates.find((c) => c === "cloudflared" || fs.existsSync(c)) ??
  "cloudflared";

const url = process.env.TUNNEL_TARGET ?? "http://localhost:9000";
console.log(`[tunnel] starting cloudflared (${bin}) -> ${url}`);

const child = spawn(bin, ["tunnel", "--url", url], {
  stdio: ["ignore", "pipe", "pipe"],
  windowsHide: true,
});

const handleChunk = (chunk) => {
  const text = chunk.toString("utf8");
  process.stdout.write(text);
  const match = text.match(/https:\/\/[a-z0-9-]+\.trycloudflare\.com/i);
  if (match) {
    console.log(
      `\n=============================================================`,
    );
    console.log(`  OEFFENTLICHER GAME-SERVER LINK (fuer Freunde):`);
    console.log(`  ${match[0]}`);
    console.log(
      `=============================================================\n`,
    );
  }
};

child.stdout.on("data", handleChunk);
child.stderr.on("data", handleChunk);

child.on("exit", (code) => {
  console.log(`[tunnel] cloudflared exited with code ${code}`);
  process.exit(code ?? 0);
});
