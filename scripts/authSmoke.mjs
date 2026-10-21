// End-to-end check of the real auth server + the same token verification the game server uses.
import { jwtVerify } from "jose";
const B = "http://localhost:8787";
const j = (r) => r.json().catch(() => ({}));
const email = `t${Date.now()}@example.com`;
let r = await fetch(`${B}/auth/register`, {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({
    email,
    username: "tester" + (Date.now() % 100000),
    password: "supersecret1",
  }),
});
const cookie = r.headers.get("set-cookie")?.split(";")[0];
const reg = await j(r);
console.log("register", r.status, !!reg.jwt, !!cookie);
r = await fetch(`${B}/auth/register`, {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({
    email,
    username: "other123",
    password: "supersecret1",
  }),
});
console.log("duplicate email ->", r.status);
r = await fetch(`${B}/auth/login`, {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({ identifier: email, password: "wrongpass99" }),
});
console.log("bad password ->", r.status);
r = await fetch(`${B}/auth/login`, {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({ identifier: email, password: "supersecret1" }),
});
console.log("login ->", r.status);
r = await fetch(`${B}/auth/refresh`, { method: "POST", headers: { cookie } });
const ref = await j(r);
console.log("refresh ->", r.status, !!ref.jwt);
const jwks = await (await fetch(`${B}/.well-known/jwks.json`)).json();
const { importJWK } = await import("jose");
const key = await importJWK(jwks.keys[0], "EdDSA");
const { payload } = await jwtVerify(ref.jwt, key, {
  algorithms: ["EdDSA"],
  issuer: B,
  audience: "localhost",
});
console.log("jwt verifies with JWKS, sub =", payload.sub);
r = await fetch(`${B}/users/@me`, {
  headers: { authorization: `Bearer ${ref.jwt}` },
});
console.log("users/@me ->", r.status, (await j(r)).player?.username);
r = await fetch(`${B}/users/@me`, {
  headers: { authorization: `Bearer ${ref.jwt}x` },
});
console.log("tampered token ->", r.status);
r = await fetch(`${B}/auth/logout`, { method: "POST", headers: { cookie } });
r = await fetch(`${B}/auth/refresh`, { method: "POST", headers: { cookie } });
console.log("refresh after logout ->", r.status);
