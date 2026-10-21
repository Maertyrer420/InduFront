# Login-System & Online-Game-Server (ohne Port-Freigabe)

## 1. Alles mit einem Befehl starten (inkl. öffentlichem Link für Freunde)

```bash
npm run play-online
```

Dieser Befehl startet **4 echte Prozesse** gleichzeitig:

1. **Frontend & Single-Origin-Proxy** (Vite auf `http://localhost:9000`)
2. **Game-Server Master & Worker** (`src/server/Server.ts` auf Ports `3000–3002`)
3. **Echter Login- & Account-Server** (`src/server/auth/AuthServer.ts` auf Port `8787`)
4. **Cloudflare Quick Tunnel** (`scripts/startTunnel.mjs` -> `cloudflared tunnel --url http://localhost:9000`)

Im Terminal erscheint automatisch die öffentliche HTTPS-Adresse:

```text
=============================================================
  OEFFENTLICHER GAME-SERVER LINK (fuer Freunde):
  https://<zufalls-name>.trycloudflare.com
=============================================================
```

**Keine Port-Freigabe im Router nötig!** Du schickst deinen Freunden einfach diesen `https://*.trycloudflare.com`-Link.

---

## 2. Echtes Login- & Account-System (`src/server/auth/`)

- **Keine Mockups / Keine Platzhalter:**
  - Passwörter werden mit Node `crypto.scrypt` (`N=16384, r=8, p=1`, 16-Byte Zufalls-Salt) gehasht und mit `timingSafeEqual` verifiziert ([AuthStore.ts](file:///C:/Users/steve/.gemini/antigravity/scratch/OpenFrontIO-main/src/server/auth/AuthStore.ts)).
  - Beim ersten Start erzeugt [AuthServer.ts](file:///C:/Users/steve/.gemini/antigravity/scratch/OpenFrontIO-main/src/server/auth/AuthServer.ts) ein echtes **Ed25519 (`EdDSA`)** Schlüsselpaar in `data/auth/keys.json` und veröffentlicht den Public Key unter `GET /.well-known/jwks.json`.
  - Jede Anmeldung/Registrierung (`POST /idp/auth/register`, `POST /idp/auth/login`) setzt ein `HttpOnly` Refresh-Token-Cookie und stellt ein signiertes EdDSA-JWT aus.
  - Der **Game-Server** ([jwt.ts](file:///C:/Users/steve/.gemini/antigravity/scratch/OpenFrontIO-main/src/server/jwt.ts) & [Worker.ts](file:///C:/Users/steve/.gemini/antigravity/scratch/OpenFrontIO-main/src/server/Worker.ts)) prüft jedes Spieler-Token kryptografisch gegen `/.well-known/jwks.json` und lädt das Spielerprofil über `/users/@me`.
- **Freunde-System & Account-Verwaltung:**
  - Spieler können sich im **Konto / Freunde**-Menü gegenseitig per **Benutzername** oder **Public-ID / Profil-Link** Freundschaftsanfragen senden, annehmen und entfernen (`/idp/friends`, `/idp/friends/requests`).
  - Benutzernamen können im Account-Menü geändert werden (`PUT /idp/users/@me/username`).
- **Optionales echtes Google OAuth 2.0:**
  - Wenn `GOOGLE_CLIENT_ID` und `GOOGLE_CLIENT_SECRET` in `.env` gesetzt sind, aktiviert `/idp/auth/providers` automatisch den echten Google-OAuth-2.0-Flow (`/idp/auth/login/google` -> `/idp/auth/callback/google`).

---

## 3. Gemeinsam in einer Runde spielen

1. Öffne `http://localhost:9000` (oder direkt den `https://*.trycloudflare.com`-Link).
2. Deine Freunde öffnen den **`https://*.trycloudflare.com`**-Link im Browser.
3. Jeder klickt auf der Startseite auf **Login / Registrieren**, erstellt ein Konto (oder meldet sich an).
4. Einer klickt auf **Private Lobby erstellen (Host Lobby)** und teilt den Lobby-Link / die Lobby-ID, oder ihr tretet gemeinsam derselben **Public Lobby** auf der Startseite bei.
