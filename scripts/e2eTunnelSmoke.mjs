import assert from "node:assert/strict";
import { WebSocket } from "ws";

const TUNNEL = process.env.BASE_URL ?? "http://localhost:10000";
const WS_TUNNEL = TUNNEL.replace(/^http/, "ws");

const rand = Math.floor(Math.random() * 100000);
const userA = {
  email: `friendA_${rand}@example.com`,
  username: `FriendA_${rand}`,
  password: "StrongPassword123!",
};
const userB = {
  email: `friendB_${rand}@example.com`,
  username: `FriendB_${rand}`,
  password: "StrongPassword456!",
};

// 1. Register User A through the public tunnel
const regA = await fetch(`${TUNNEL}/idp/auth/register`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(userA),
});
assert.equal(regA.status, 200, "User A registration via tunnel failed");
const { jwt: jwtA } = await regA.json();
assert.ok(jwtA, "User A JWT missing");

// 2. Register User B through the public tunnel
const regB = await fetch(`${TUNNEL}/idp/auth/register`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(userB),
});
assert.equal(regB.status, 200, "User B registration via tunnel failed");
const { jwt: jwtB } = await regB.json();

// 3. Verify /users/@me for both users
const meARes = await fetch(`${TUNNEL}/idp/users/@me`, {
  headers: { Authorization: `Bearer ${jwtA}` },
});
assert.equal(meARes.status, 200);
const meA = await meARes.json();
assert.equal(meA.player.username, userA.username);

const meBRes = await fetch(`${TUNNEL}/idp/users/@me`, {
  headers: { Authorization: `Bearer ${jwtB}` },
});
assert.equal(meBRes.status, 200);
const meB = await meBRes.json();
assert.equal(meB.player.username, userB.username);

// 4. Friend request A -> B by username, and B accepts
const freqRes = await fetch(
  `${TUNNEL}/idp/friends/requests/${encodeURIComponent(userB.username)}`,
  {
    method: "POST",
    headers: { Authorization: `Bearer ${jwtA}` },
  },
);
assert.equal(freqRes.status, 200, "Friend request failed");
const freqData = await freqRes.json();
assert.equal(freqData.status, "requested");

const acceptRes = await fetch(
  `${TUNNEL}/idp/friends/requests/${encodeURIComponent(meA.player.publicId)}/accept`,
  {
    method: "POST",
    headers: { Authorization: `Bearer ${jwtB}` },
  },
);
assert.equal(acceptRes.status, 200, "Friend accept failed");

const friendsARes = await fetch(`${TUNNEL}/idp/friends?page=1&limit=20`, {
  headers: { Authorization: `Bearer ${jwtA}` },
});
assert.equal(friendsARes.status, 200);
const friendsA = await friendsARes.json();
assert.equal(friendsA.total, 1);
assert.equal(friendsA.results[0].publicId, meB.player.publicId);

// 5. Create a real private multiplayer lobby on the Game Server via the tunnel using User A's JWT
const createLobbyRes = await fetch(`${TUNNEL}/api/create_game`, {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    Authorization: `Bearer ${jwtA}`,
  },
  body: JSON.stringify({}),
});
const createLobbyText = await createLobbyRes.text();
assert.equal(
  createLobbyRes.status,
  200,
  `Create lobby failed with ${createLobbyRes.status}: ${createLobbyText}`,
);
const lobby = JSON.parse(createLobbyText);
assert.ok(lobby.gameID, "gameID missing from created lobby");
assert.ok(lobby.workerPath, "workerPath missing from created lobby");

// 6. Check lobby existence on the assigned worker through the tunnel
const existsRes = await fetch(
  `${TUNNEL}/${lobby.workerPath}/api/game/${lobby.gameID}/exists`,
);
assert.equal(existsRes.status, 200);
const existsData = await existsRes.json();
assert.equal(existsData.exists, true, "Created game does not exist on worker");

// 7. Connect to the public lobbies WebSocket over WSS through the tunnel on the worker path
await new Promise((resolve, reject) => {
  const ws = new WebSocket(`${WS_TUNNEL}/${lobby.workerPath}/lobbies`);
  const timeout = setTimeout(() => {
    ws.close();
    reject(new Error("WebSocket /lobbies timed out"));
  }, 8000);
  ws.on("open", () => {
    clearTimeout(timeout);
    ws.close();
    resolve();
  });
  ws.on("error", (err) => {
    clearTimeout(timeout);
    reject(err);
  });
});

console.log(
  `E2E TUNNEL SMOKE TEST PASSED: Users ${userA.username} & ${userB.username} registered, became friends, created lobby ${lobby.gameID} on /${lobby.workerPath}, and connected via WSS through ${TUNNEL}!`,
);
