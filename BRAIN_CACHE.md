# BRAIN CACHE & PATCHNOTES: OPENFRONT.IO HYBRID-RTS EXPANSION
**Repository:** `OpenFrontIO-main`  
**Datum:** 2026-10-20  
**Status:** In aktiver Entwicklung & Integration

---

## 1. MASTER-PROMPT: ANFORDERUNGEN & MATHEMATISCHE FORMELN

### A. Deterministische Tick-Engine
- **Diskrete Simulation:** 1 Hz Simulations-Ticks (State-Machine) im Web Worker (`packages/engine`).
- **Render-Interpolation:** 60 FPS Sub-Tick-Interpolation im Renderer (`src/client/render/`).
- **Deterministische Mathematik:** Strikte Verwendung von `packages/engine-lib/src/DetMath.ts` und seeded PRNG (`PseudoRandom.ts`) ohne Rundungsdifferenzen zwischen Clients.

### B. Hybride Ökonomie & Demografie
- **Gold-Formel pro Tick:**
  $$G_{tick} = \lfloor \alpha \cdot T + \beta \cdot P \rfloor \quad (\alpha = 0{,}02,\ \beta = 0{,}10)$$
- **Demografisches Wachstum:**
  $$P_{tick+1} = P_{tick} + r \cdot P_{tick} \cdot \left(1 - \frac{P_{tick}}{K_P}\right) \quad (r = 0{,}05)$$
  $$K_P = BaseCap (1.000) + Wohngebäude \cdot 500$$
- **Exponentielle Baukosten-Formel:**
  $$Cost(n) = BaseCost \cdot (1{,}15)^{n-1}$$

#### Ressourcen-Tiers:
- **Tier 0:** Gold ($G$) – Universelle Zivilwährung.
- **Tier 1 (Heatmap-gebunden):**
  - Eisenerz ($Fe_{raw}$)
  - Kohle ($C$)
  - Rohöl ($Oil_{raw}$)
  - Uranerz ($U_{raw}$)
- **Tier 2 (Industriell veredelt):**
  - Stahl ($Fe_{ref}$): $2\,Fe_{raw} + 1\,C \rightarrow 1\,Stahl$ (Schmelzwerk)
  - Treibstoff ($Fuel$): $2\,Oil_{raw} \rightarrow 1\,Fuel$ (Raffinerie)
  - Spaltmaterial ($U_{ref}$): $4\,U_{raw} + 2\,C \rightarrow 1\,Spaltmaterial$ (Zentrifuge)

#### Baukosten-Tabelle:
| Gebäude / Einheit | Basiskosten Gold | Refined Resources | Unterhalt / Tick | Rolle |
| :--- | :--- | :--- | :--- | :--- |
| **Wohngebäude** | $100\,G$ | $-$ | $-$ | $+500\,K_P$ |
| **Eisenmine** | $200\,G$ | $-$ | $-$ | Fördert Eisenerz |
| **Kohlemine** | $150\,G$ | $-$ | $-$ | Fördert Kohle |
| **Ölturm** | $350\,G$ | $-$ | $-$ | Fördert Rohöl (Land/Offshore) |
| **Uranmine** | $800\,G$ | $-$ | $-$ | Fördert Uranerz |
| **Stahlwerk** | $400\,G$ | $-$ | $-$ | $2 Fe + 1 C \rightarrow 1 Stahl$ |
| **Raffinerie** | $500\,G$ | $-$ | $-$ | $2 Oil \rightarrow 1 Fuel$ |
| **Zentrifuge** | $1\,200\,G$ | $-$ | $-$ | $4 U + 2 C \rightarrow 1 U_{ref}$ |
| **Werft (Marinehafen)** | $600\,G$ | $-$ | $-$ | Schiffsbau-Infrastruktur |
| **Flugplatz** | $750\,G$ | $-$ | $-$ | Luftwaffen-Infrastruktur |
| **Bunker** | $150\,G$ | $+10\,Stahl$ | $-$ | DefBonus $1{,}8\times$ |
| **Radarstation** | $800\,G$ | $+40\,Stahl + 5\,U_{ref}$ | $-$ | $R=30$, +50% SAM-Radius |
| **SAM-Launcher** | $700\,G$ | $+50\,Stahl$ | $-$ | Magazin 4, Abfanggitter |
| **Raketensilo** | $1\,000\,G$ | $+80\,Stahl$ | $-$ | Startbasis Strategische Waffen |
| **Infanterie (100x)** | $50\,G$ | $-$ | $0$ | Frontbesetzung |
| **Panzer-Division** | $250\,G$ | $+15\,Stahl$ | $0{,}5\,Fuel$ / Zug | $5\times$ Durchbruchskraft |
| **Landungsboot** | $100\,G$ | $+5\,Stahl$ | $0{,}2\,Fuel$ / Tick | Max. 1000 Truppen |
| **Zerstörer** | $500\,G$ | $+35\,Stahl$ | $0{,}8\,Fuel$ / Tick | Sonar U-Boot-Jagd, Küstenbeschuss |
| **U-Boot** | $450\,G$ | $+25\,Stahl$ | $0{,}5\,Fuel$ / Tick | Stealth Torpedoangriff |
| **Schlachtschiff** | $1\,200\,G$ | $+90\,Stahl$ | $2{,}0\,Fuel$ / Tick | Massive Reichweite $R=14$ |
| **Abfangjäger (Fighter)**| $300\,G$ | $+10\,Stahl$ | $1{,}5\,Fuel$ / Mission | Luftraum-Patrouille |
| **Strategischer Bomber** | $600\,G$ | $+30\,Stahl$ | $3{,}0\,Fuel$ / Mission | Fabrik- & Minenzerstörung |
| **Cruise Missile** | $300\,G$ | $+20\,Stahl + 15\,Fuel$ | $-$ | Radius $R=3$ Gebäudezerstörung |
| **ICBM (Nuklear)** | $2\,500\,G$ | $+100\,Stahl + 50\,Fuel + 10\,U_{ref}$ | $-$ | Radius $R=12$ Wipetile + 120s Fallout |

### C. Fuel-Starvation (Logistischer Treibstoffausfall)
- Wenn $Fuel \le 0$:
  - Motorisierte Bodentruppen & Flugzeuge: $-80\%$ Geschwindigkeit, $-50\%$ Kampfkraft.
  - Schiffe auf See: $5\%$ Hüllen-Attrition pro Sekunde/Tick.

### D. SAM & Radar Abfang-Netzwerk
- **Radar ($R = 30$):** Enttarnt U-Boote, hebt Nebel für Schiffe/Flugzeuge auf, erweitert verbündete SAM-Reichweite um $+50\%$ ($12 \rightarrow 18$).
- **SAM-Launcher:** 4 Raketen Magazin. Reload: 10s ($50\,G + 5\,Stahl + 5\,Fuel$).
- **Interzeption:**
  - Cruise Missile: $1$ SAM-Rakete = $100\%$ Abschuss.
  - ICBM: $2$ SAM-Raketen = $100\%$ Abschuss. $1$ SAM-Treffer = vorzeitige Detonation mit $50\%$ Radius ($R=6$).

### E. Frontlinien & Lanchester-Gesetz
- Modifiziertes Quadratgesetz:
  $$\Delta Soldaten = \sqrt{|Soldaten_{Att}^2 - (Soldaten_{Def} \cdot DefBonus)^2|}$$
  $DefBonus = 1{,}0$ (Feld), $1{,}2$ (Berg/Wald), $1{,}8$ (Bunker).
- **Openfront Nahtlose Gebäudeübernahme:** Eroberte Gebäude bleiben intakt:
  $$Building.ownerId = NewTileOwner$$

### F. Procedural Heatmap & Depletion
- **Home-Buffer ($R_{home} = 15$):** 4 Rohstoffe ($H = 0{,}35 \pm 0{,}05$), 180s Vorrat, $90^\circ$ Drehung.
- **Simplex Noise Makro-Cluster:**
  $$H_{raw}(x, y) = \max\left(0, \frac{\text{SimplexNoise}(x/\lambda, y/\lambda) - \theta}{1 - \theta}\right)^\gamma$$
  - Fe: $\lambda=80, \theta=0{,}55, \gamma=1{,}5, \rho=50.000$
  - C: $\lambda=70, \theta=0{,}50, \gamma=1{,}4, \rho=40.000$
  - Oil: $\lambda=120, \theta=0{,}70, \gamma=2{,}2, \rho=30.000$
  - U: $\lambda=180, \theta=0{,}82, \gamma=3{,}0, \rho=10.000$
- **Dynamische Erschöpfung:**
  $$Output = BaseYield \cdot H(x, y) \cdot \left(0{,}15 + 0{,}85 \cdot \frac{S(t)}{S_{total}}\right)$$
  Ewige Restförderung $\epsilon = 0{,}15$ (15%).
- **Thermischer 5-Stufen-Gradient ($V = H \cdot S(t)/S_{total}$):**
  - $V < 0{,}15$: Transparent
  - $V \in [0{,}15; 0{,}35[$: `#0a194f` (Alpha 0.4)
  - $V \in [0{,}35; 0{,}60[$: `#00d2ff` (Alpha 0.6)
  - $V \in [0{,}60; 0{,}85[$: `#ffe600` (Alpha 0.8)
  - $V \in [0{,}85; 1{,}00]$: `#ff1a00` (Alpha 0.95)
  - Iso-Linien alle $\Delta V = 0{,}20$.
  - Basiskarten-Dimmung: 25% Graustufen, weiße 1px Vektorkanten.

### G. Diplomatie & Transfer
- Krieg (Default), Nichtangriffspakt (60s Kündigungsfrist), Allianz (geteiltes Radar & SAM-Schutz).
- Direkter Rohstoff- & Goldtransfer.

---

## 2. OPENFRONT.IO CODE-MAPPING

| OpenFront Komponente | Pfad im Repo | Zu integrierendes Feature |
| :--- | :--- | :--- |
| **GameTypes & Enums** | `packages/engine-api/src/game/GameTypes.ts` | Neue `UnitType`s (Tank, OilRig, Refinery, SteelMill, Centrifuge, etc.), Ressourcen-Typen |
| **Intent Schemas** | `packages/engine-api/src/Schemas.ts` | `BuildStructureIntent`, `TransferResourceIntent`, `LaunchCruiseIntent`, `LaunchICBMIntent` |
| **Tile Grid & Storage** | `packages/engine-lib/src/game/GameMapImpl.ts` | Ressourcen-Felder, Cluster-Pointer, Strahlungs-Countdown in `Uint16Array`/State-Map |
| **Deterministische Math**| `packages/engine-lib/src/DetMath.ts` | Lanchester Quadratwurzel, exponentielle Kosten $Base \cdot 1.15^{n-1}$ |
| **Map Generator & Clust**| `packages/engine-lib/src/` | 2D Simplex Noise Makro-Cluster & Home-Buffer Generator |
| **Kampf & Lanchester** | `packages/engine/src/execution/AttackExecution.ts` | Lanchester Quadratgesetz mit Bunker- & Panzerboni, intakte Gebäudeübernahme |
| **SAM & Radar Grid** | `packages/engine/src/execution/SAMLauncherExecution.ts`| Radar Sensor $R=30$, SAM-Boost $+50\%$, Cruise Missile Abfang (1x), ICBM Abfang (2x) |
| **Wirtschafts-Simulation**| `packages/engine/src/game/GameImpl.ts` & `PlayerImpl.ts`| Tick-basierte Minenförderung, Erschöpfung, Refineries, Fuel-Starvation |
| **Renderer & Shader** | `src/client/render/` | Geologischer Scouting Shader (25% Grayscale Dimmung, 5-Stufen Thermal Gradient, Iso-Linien) |
| **HUD & Slider UI** | `src/client/hud/` | Truppen-Slider, Scouting Quick-Buttons, Ressourcen-Leiste, Diplomatie & Transfer-Modal |

---

## 3. PATCHNOTES & CHANGELOG

### [Version 0.1.0-alpha] - 2026-10-20
- **Repository Setup:** OpenFrontIO Quellcode geklont und in `C:\Users\steve\.gemini\antigravity\scratch\OpenFrontIO-main` entpackt.
- **Node/NPM Engine Patch:** `package.json` angepasst auf `"npm": ">=11.0.0 <13"` zur Kompatibilität mit Node v24.15.0 und npm 11.12.1.
- **Brain Cache Initialisierung:** `BRAIN_CACHE.md` angelegt als persistenter Wissensspeicher für alle mathematischen Formeln, System-Architektur, Integrationsschritte und Fehlerbehebungen.

### [Version 0.2.0-beta] - 2026-10-20
- **Engine-API Erweiterung (`packages/engine-api`):**
  - Neue `UnitType` Enums in `GameTypes.ts`: `Residential`, `IronMine`, `CoalMine`, `OilRig`, `UraniumMine`, `SteelMill`, `Refinery`, `Centrifuge`, `Shipyard`, `Airbase`, `Bunker`, `Radar`, `Tank`, `Destroyer`, `Submarine`, `Battleship`, `Fighter`, `Bomber`, `CruiseMissile`, `ICBM`.
  - Neue Typen `ResourceType`, `RefinedType`, `ResourceDeposit`, `ResourceCluster`, `PlayerEconomyState`.
  - Neue Intent-Schemas in `Schemas.ts`: `TransferResourceIntentSchema`, `StrategicStrikeIntentSchema`, `RecruitMilitaryIntentSchema`, `ToggleHeatmapIntentSchema`.
- **Engine-Lib Wirtschaft & Heatmaps (`packages/engine-lib`):**
  - `EconomyConfig.ts`: Konstanten & Formeln für Gold-Income ($0{,}02T + 0{,}10P$), Demografie ($r=0{,}05$), exponentielle Kosten $Cost(n) = BaseCost \cdot 1{,}15^{n-1}$, Veredelungs-Rezepte, Treibstoff-Drain.
  - `ProceduralHeatmap.ts`: Deterministischer 2D-Simplex-Noise-Generator; 2-Stufen-Generierung (Home-Buffer $R=15$, Makro-Cluster für Fe, Coal, Oil, Uranium); Depletion-Pool mit garantierter 15%-Basis-Tiefenförderung.
- **Engine Simulations-Logik (`packages/engine`):**
  - `EconomyExecution.ts`: Vollständige Tick-Simulation der demografischen Entwicklung, Goldproduktion, Minenförderung, Veredelungswerke (Stahlwerk, Raffinerie, Zentrifuge) und Fuel-Starvation (5% Hüllenschaden auf See, verlangsamte Einheiten).
  - `TransferResourceExecution.ts`: Logistischer Direktaustausch von Gold und allen 7 Rohstoffen.
  - `ExecutionManager.ts`: Registrierung der neuen Intents im Turn-Execution-Dispatcher.
  - `Game.ts`, `EngineConfig.ts` & `PlayerImpl.ts`: Exhaustive Switch-Cases und Baukosten-Mapping für alle neuen Einheiten & Strukturen ergänzt.
- **Verifikation:**
  - `npm run typecheck` erfolgreich mit Exit-Code 0 über alle Pakete hinweg (`@openfront/engine-api`, `@openfront/engine-lib`, `@openfront/engine`, `@openfront/engine/src/worker`, `@openfront/shared`, `@openfront/zbin` und Root-Client).

### [Version 0.3.0-rc1] - 2026-10-20
- **Lanchester-Kampfmechanik & Nahtlose Gebäudeübernahme (`packages/engine`):**
  - `EngineConfig.ts`:
    - Terra Nullius: Vorstoß auf neutrales Land verbraucht exakt 1 Soldat pro Kachel (`attackerTroopLoss = 1`).
    - Frontalangriff auf gegnerisches Land nach Lanchester-Quadratgesetz:
      $$\Delta Soldaten = \sqrt{|Soldaten_{Att}^2 - (Soldaten_{Def} \cdot DefBonus)^2|}$$
    - Verteidigungs-Multiplikatoren: Freies Feld ($1{,}0$), Berg/Hochland ($1{,}2$), Stahl-Bunker ($1{,}8$).
    - Angriffs-Multiplikator: Panzer-Divisionen gewähren $5\times$ Effektivität beim Durchbrechen feindlicher Linien.
  - `GameImpl.ts`:
    - Nahtlose Gebäudeübernahme intakt: Beim Erobern einer Kachel (`conquer`) werden feindliche Bauten (Minen, Raffinerien, Bunker, Silos, SAM-Launcher) direkt auf den neuen Eigentümer übertragen (`owner.captureUnit`), ohne Abriss oder Demontage.
- **SAM & Radar Abfanggitter-Kopplung (`packages/engine`):**
  - `EngineConfig.ts` & `SAMLauncherExecution.ts`:
    - Radarstationen im Umkreis ($R=30$) erhöhen die Abfangreichweite verbündeter SAM-Systeme deterministisch um $+50\%$ ($12 \rightarrow 18$).
    - SAM-Ziele erweitert um strategische Flugkörper (`CruiseMissile`, `ICBM`).
  - `SAMMissileExecution.ts` & `NukeExecution.ts`:
    - Cruise Missile: 1 SAM-Treffer zerstört den Flugkörper zu $100\%$.
    - ICBM: Benötigt 2 SAM-Treffer zur Vernichtung. Nach 1 Treffer nimmt die Rakete 1 Schaden und wird für nachfolgende SAMs freigegeben. Schlägt sie vor dem zweiten Treffer ein, detoniert sie vorzeitig mit halbiertem Wirkungsradius ($50\%$).
- **WebGL2 Geologisches Scouting & Thermal Shader (`src/client/render/gl`):**
  - Neuer Render-Pass `GeologicalScoutingPass.ts` & GLSL-Shader `geological-scouting.frag.glsl`:
    - 5-Stufen Thermal-Gradient: $V < 0{,}15$ Transparent, Tiefblau (Navy), Cyan, Gelb, Signalrot/Orange.
    - Iso-Konturlinien bei $\Delta V = 0{,}20$ via Screen-Space Derivaten (`fwidth()`).
    - Automatische $25\%$-Dimmung (Grayscale-Entsättigung) der Territoriums-Grundkarte bei aktivem Heatmap-Scouting.
  - `MapRenderer.ts` & `Renderer.ts`: Vollständige Lebenszyklus- und Rendering-Integration.
- **Client HUD & Wirtschaftskontrolle (`src/client/hud/layers`):**
  - `ControlPanel.ts`:
    - Demografie- & 7-Ressourcen-Leiste: Bevölkerung / Limit ($P / K_P$), Rohstoffe ($Fe, C, Oil, U$), veredelte Güter ($Stahl, Fuel, U_{ref}$).
    - Logistischer Treibstoff-Engpass Alarmbanner: Pulsierende Warnung bei $Fuel \le 0$ ($-80\%$ Speed, $-50\%$ Kampfkraft, Flotten-Attrition).
    - Geologische Scouting-Umschaltleiste: Ein-Klick-Buttons für `[Normal]`, `[Fe]`, `[Coal]`, `[Oil]`, `[Uranium]`.
    - Angriffsstärke-Slider ($1\% - 100\%$) mit Sofortwahl-Presets (`20%`, `50%`, `100%`).
  - `SendResourceModal.ts` & `Transport.ts`:
    - Direkter Tausch und logistischer Transfer aller Rohstoffe und Industrieprodukte zwischen befreundeten Nationen via `TransferResourceIntent`.
- **Verifikation & Testabdeckung:**
  - `tsc --noEmit` über den gesamten Monorepo-Stack fehlerfrei (0 TypeScript Fehler über alle 7 Workspaces).
  - Alle 152 Core Execution Tests (`tests/core/executions/`) zu 100% bestanden.
  - Deterministische Snapshot-Engine (`tests/core/snapshot/FullGameSnapshot.test.ts`): Alle 12 Tests erfolgreich abgeschlossen (vollständige Byte-Identität bei Snapshot/Restore über Hunderte von Ticks).

### [Version 0.4.0] - 2026-10-20
- **Cleanup toter Website-Funktionen & Promo-Banner:**
  - `src/client/components/DesktopNavBar.ts`: Shop- (`page-item-store`) und Inventar-Buttons (`page-inventory`) aus der Navigation entfernt.
  - `src/client/components/MobileNavBar.ts`: Shop- und Inventar-Links aus der mobilen Leiste entfernt.
  - `src/client/components/PlayPage.ts`: Banner `<steam-wishlist>` vollständig entfernt.
  - `src/client/components/Footer.ts`: `<steam-wishlist-button>` entfernt.
  - `src/client/hud/layers/WinModal.ts`: Steam-Wishlist-CTA durch saubere Match-Statistiken und Discord-Link ersetzt.
  - `index.html`: Nicht mehr benötigte `<desktop-status-bar>` bereinigt.
- **Deterministische Mathematik & Engine Boundary Fixes (`LayerBoundaries.test.ts`):**
  - Alle transcendentalen `Math`-Aufrufe (`Math.pow`, `Math.cos`, `Math.sin`, `Math.hypot`) in `packages/engine` und `packages/engine-lib` eliminiert.
  - Ersetzt durch `detPow` aus `@openfront/engine-lib/DetMath` in `packages/engine/src/configuration/EngineConfig.ts` und `packages/engine-lib/src/game/EconomyConfig.ts`.
  - In `packages/engine-lib/src/game/ProceduralHeatmap.ts`: Trigonometrie durch exakte tabellierte Integer-Offsets (`HOME_OFFSETS`) und euklidische Distanzquadrate (`dx*dx + dy*dy`) ersetzt.
  - `tests/LayerBoundaries.test.ts` besteht zu 100% (9/9 Tests grün).
- **Kampflogik & Bot-Annexation Fix (`BotAnnexation.test.ts`):**
  - In `packages/engine/src/configuration/EngineConfig.ts:attackLogic()`: Explizite Bedingung `if (defender.troops === 0)` hinzugefügt, sodass Angreifer beim Besetzen unverteidigter Kacheln exakt 1 Soldat pro Kachel verlieren und keine künstlichen Lanchester-Verluste berechnet werden.
  - `tests/BotAnnexation.test.ts` besteht zu 100% (12/12 Tests grün).
- **Offline Backend & Server Polling Resilience:**
  - `src/server/PrivilegeRefresher.ts`: Graceful Fallback auf `FailOpenPrivilegeChecker`, falls der lokale Authentifizierungsdienst auf Port 8787 nicht erreichbar ist (verhindert unhandled Polling-Exceptions im Entwicklungsbetrieb).
  - `src/server/RankedCheckin.ts`: Unterdrückung von unhandled `ECONNREFUSED` Log-Spam im Offline-/Lokalmodus.
- **In-Game Wirtschafts- & Industrie-Interface (`MiningEconomyPanel.ts`):**
  - Neue Komponente `src/client/hud/layers/MiningEconomyPanel.ts` implementiert:
    - Vollständiges Bau- und Verwaltungsmenü im einheitlichen OpenFront Glassmorphic-Dark-Theme (`#12141a`, gerundete Kacheln, transluzente Hintergründe).
    - Tier 1 Minen: Eisenmine, Kohlemine, Ölturm, Uranmine.
    - Tier 2 Veredelung: Stahlwerk ($2Fe+1C \rightarrow 1Stahl$), Raffinerie ($2Oil \rightarrow 1Fuel$), Zentrifugen-Anlage ($4U+2C \rightarrow 1U_{ref}$).
    - Zivil- & Verteidigungsinfrastruktur: Wohngebäude ($+500 K_P$), Bunker ($1.8\times Def$), Radar ($R=30$).
    - Dynamische Anzeige der exponentiellen Baukosten ($BaseCost \cdot 1.15^{n-1}$) in Gold und veredelten Gütern.
    - Schnellumschaltung für geologisches Heatmap-Scouting direkt im Panel integriert.
  - Integration in `src/client/hud/layers/ControlPanel.ts`:
    - Interaktiver Button `[🏭 Minen & Industrie]`.
    - Demografie- und Ressourcenanzeigen öffnen bei Klick direkt das Wirtschaftsmenü.
  - Registriert in `GameRenderer.ts` und als Web Component `<mining-economy-panel>` in `index.html`.

### [Version 0.4.1] - 2026-10-20
- **Entfernung externer OpenFront.io Links & Wiki-Buttons:**
  - `src/client/components/Footer.ts`: Vollständige Entfernung der externen OpenFront-Icon-Leiste (Wiki-Button `https://openfront.wiki/Main_Page`, Discord `https://discord.gg/openfront`, Reddit `https://www.reddit.com/r/OpenFront/`, GitHub `https://github.com/openfrontio/OpenFrontIO`). Die Fußzeile bleibt fokussiert auf Version, lokale Richtlinien und Sprachauswahl.
  - `src/client/hud/layers/WinModal.ts`: Entfernung des externen OpenFront-Discord-Einladungsbuttons aus dem Sieg- und Spielendebildschirm.
  - `src/client/GameStartingModal.ts`: Externer GitHub-Credits-Link durch einen sauberen lokalen Titel ersetzt.
  - `index.html`: SEO-Canonical-Links und OpenGraph-Tags von `https://openfront.io/` auf die lokale Root `/` umgestellt sowie veraltete Ad-URL-Referenzen bereinigt.
- **Verifikation:**
  - `npm run typecheck` fehlerfrei (0 Fehler über alle 7 Pakete).
  - Alle Footer- und WinModal-Tests (`tests/client/components/Footer.test.ts`, `tests/client/graphics/layers/WinModal.test.ts`) zu 100% bestanden.
  - Layer-Boundaries & Determinismus-Tests zu 100% grün.

### [Version 0.4.2] - 2026-10-20
- **Neues Hauptlobby-Hintergrundbild (Tactical Military Grid World Map):**
  - Hochgeladene taktische Weltkarte mit Gitter-Overlay verarbeitet und eingebunden.
  - Skaliert via Lanczos-Resampling auf **`2048 × 1228 px`** und als optimiertes WebP (Quality 90, 260 KB) hinterlegt in `resources/images/background.webp` und `static/images/background.webp`.
  - Originalbild gesichert als `resources/images/background.original.webp`.
  - `index.html`: Deckkraft auf 45% (`opacity-45`) angepasst und den farbverzerrenden Filter `dark:hue-rotate(180deg)` entfernt, sodass die authentischen Pergament-/Militärfarben im Hauptmenü unverfälscht dargestellt werden.
  - `index.html`: Bereinigung des `<link rel="canonical">`-Tags zur Verhinderung von `EISDIR`-Vite-Asset-Fehlern beim Build.
- **Verifikation:**
  - `vite build --mode development` erfolgreich in 7.32s ohne Fehler.
  - Server antwortet auf `http://localhost:9000/` mit HTTP 200 OK.

### [Version 0.4.3] - 2026-10-20
- **Rebranding zu "InduFront":**
  - Neues hochauflösendes Vektorlogo `resources/images/InduFrontLogo.svg` mit industriellem Militär-Hexagon-Emblem (Zahnrad, Rang-Chevrons) und markanter Typografie ("INDU" in taktischem Gold, "FRONT" in Alpinweiß) entworfen und eingebunden.
  - Verlinkung und Alt-Tags in `DesktopNavBar.ts`, `MobileNavBar.ts`, `PlayPage.ts` und Fallback-Dateien auf `InduFront` aktualisiert.
  - Titel & App-Metadaten in `index.html`, `resources/manifest.json`, `en.json` und `de.json` auf **InduFront** umgestellt.
- **Farbschema-Anpassung an das Taktik-Hintergrundbild (Moosgrün / Waldgrün / Pastell):**
  - `src/client/styles.css`:
    - Primärfarbton `--color-malibu-blue`: `#5d9651` (natürliches Moosgrün).
    - Sekundär- & Hover-Farbton `--color-aquarius`: `#8ebf7e` (sanftes Pastell-Salbeigrün).
    - Helle Akzente `--color-bright-blue`: `#72b064`, Goldton `--color-cyber-yellow`: `#dfc488`.
    - Dunkle Oberflächen `--color-surface` & `--color-deep-navy`: `#141c15` / `#121813` (tiefes Moos-Dunkelschiefer statt Kaltblau).
    - Alle Hover- und Ringschatten auf Moosgrün-Glow umgestellt.

### [Version 0.5.1] - 2026-10-20
- **Behebung der Hotbar-UI & Neugestaltung der Tabs (`UnitDisplay.ts`):**
  - **Marinehafen (`Port`) in "Gebäude" verschoben:** Wie gefordert befindet sich der Hafen nun logisch bei der Gebäude-Infrastruktur.
  - **Zweiter Tab umbenannt in "Actives":** Beinhaltet Kriegsschiffe, Zerstörer, U-Boote sowie strategische Nuklearwaffen (A-Bombe, H-Bombe, MIRV).
  - **Entzerrung des Button-Layouts:**
    - Verhindert das Zusammenquetschen auf schmalen Bildschirmen: Buttons haben feste Mindestbreite (`min-w-[56px] h-[34px] shrink-0`), sodass Tastenkürzel, Vektor-Icon und Stückzahl-Anzeige nicht mehr überlappen.
    - Im Reiter **"Gebäude"** sind die 15 Einheiten übersichtlich in zwei saubere Reihen aufgeteilt:
      - Reihe 1 (Infrastruktur & Verteidigung): Wohnstadt (`1`), Fabrik (`2`), Marinehafen (`3`), Verteidigungsposten (`4`), Raketensilo (`5`), Flugabwehr (`6`), Bunker (`7`), Radar (`8`).
      - Reihe 2 (Bergbau & Veredelung): Eisenmine (`Shift+1`), Kohlemine (`Shift+2`), Ölturm (`Shift+3`), Uranmine (`Shift+4`), Stahlwerk (`Shift+5`), Raffinerie (`Shift+6`), Zentrifuge (`Shift+7`).
    - Im Reiter **"Actives"** stehen die 6 mobilen/aktiven Einheiten in einer geräumigen Reihe: Kriegsschiff (`1`), Zerstörer (`2`), U-Boot (`3`), Atombombe (`4`), Wasserstoffbombe (`5`), MIRV (`6`).
- **Funktionsfähige, pixelgenaue Rohstoff-Heatmap ganz oben über allen Layern (`Renderer.ts`, `GeologicalScoutingPass.ts`, Shader):**
  - **WebGL2-Texturformat korrigiert:** Umstellung von unfilterablem `gl.R32F` auf standardkonformes `gl.R8` / `gl.RED` / `gl.UNSIGNED_BYTE` mit `gl.NEAREST`-Filterung.
  - **Pixel-Matching an Kachelkoordinaten:** Im Fragment-Shader liest `texelFetch(uResourceDensityTex, tc, 0).r` mit `tc = ivec2(floor(vWorldPos))` die exakten Rasterpixel der Spielkacheln aus.
  - **Ganz oben gerendert:** `geologicalScoutingPass.draw(cam)` wurde in `renderOverlays` an die oberste Position verschoben (über Territorium, Einheiten, Gebäuden und Effekten).
  - **Auffällige Darstellung:** Leuchtende Thermalpalette (Electric Cyan $\rightarrow$ Neon Lime $\rightarrow$ Gold $\rightarrow$ Magma-Rot $\rightarrow$ Weißglühend) mit Kachel-Gitterkontur und 90%+ Deckkraft.
  - **Umschalter & Schnellauswahl:** Auffälliger Button `[HEATMAP: AKTIV / AUS (H)]` in `ControlPanel.ts` mit Schnellfiltern (`Alle`, `Eisen`, `Kohle`, `Öl`, `Uran`) und Hotkey `H`.
- **Vollständige Entfernung von Emojis & Ersatz durch weiße SVG-Vektor-Icons:**
  - Alle System-Emojis (🏗️, 🏭, ⚡, ⛏️, 🪨, 🛢️, ☢️, 👥, 🛡️, ⚠️) aus `ControlPanel.ts`, `UnitDisplay.ts` und `MiningEconomyPanel.ts` entfernt.
  - Ersetzt durch gestochen scharfe Vektor-Icons aus `resources/images/`: `BuildIconWhite.svg`, `TargetIconWhite.svg`, `GridIconWhite.svg`, `PopulationIconSolidWhite.svg`, `FactoryIconWhite.svg`, `HighlightIconWhite.svg`, `IronMineIconWhite.svg`, `CoalMineIconWhite.svg`, `OilRigIconWhite.svg`, `UraniumMineIconWhite.svg`, `SteelMillIconWhite.svg`, `RefineryIconWhite.svg`, `CentrifugeIconWhite.svg`, `DestroyerIconWhite.svg`, `BoatIconWhite.svg`, `AnchorIcon.svg`.
- **Umfassende Hotkey-Unterstützung (`InputHandler.ts`):**
  - Tab- und Shift-abhängige Tastenkürzel für alle neuen und bestehenden Gebäude:
    - Tab "Gebäude": `1` bis `8` für Infrastruktur/Verteidigung, `Shift+1` bis `Shift+7` für Minen und Veredelungswerke.
    - Tab "Actives": `1` bis `6` für Kriegsschiff, Zerstörer, U-Boot, A-Bombe, H-Bombe, MIRV.
    - `[Tab]` schaltet verzögerungsfrei zwischen "Gebäude" und "Actives" um.
- **Verifikation:**
  - `npm run typecheck` fehlerfrei (0 Fehler über alle 7 Pakete).
  - `vite build --mode development` in 10.63s fehlerfrei gebaut.
  - Dev-Server läuft stabil auf `http://localhost:9000/`.
- **Integriertes Hotbar-System mit dedizierten Reitern (`UnitDisplay.ts`):**
  - Vollständige Verschmelzung der Bergbau- und Industriegebäude mit dem nativen Gebäude-Design des Spiels (exakt gleiche Slot-Optik, Tastatur-Badges, weiße Vektor-Icons und Zähler).
  - Einführung zweier spezialisierter Reiter im unteren Baumenü:
    - **Tab 1: 🏗️ Gebäude & Minen:**
      - Standard: Wohnstadt (`City`), Fabrik (`Factory`), Verteidigungsposten (`DefensePost`), Flugabwehr (`SAMLauncher`), Raketensilo (`MissileSilo`).
      - Rohstoffförderung: Eisenmine (`IronMine`), Kohlemine (`CoalMine`), Ölturm (`OilRig`), Uranmine (`UraniumMine`).
      - Industrie & Veredelung: Stahl-Schmelzwerk (`SteelMill`), Treibstoff-Raffinerie (`Refinery`), Uran-Zentrifuge (`Centrifuge`), Stahlbunker (`Bunker`), Radarstation (`Radar`).
    - **Tab 2: ⚡ Marine & Spezialfähigkeiten:**
      - Flotte: Marinehafen (`Port`), Kriegsschiff (`Warship`), Zerstörer (`Destroyer`), U-Boot (`Submarine`).
      - Strategische Waffen: Atombombe (`AtomBomb`), Wasserstoffbombe (`HydrogenBomb`), MIRV (`MIRV`).
  - Direkte Reiter-Umschaltung per Klick oder Tastenkürzel `[Tab]` / `[T]`.
  - Ausführliche Hover-Tooltips mit dynamischer Baukostenberechnung (Gold, Stahl, Treibstoff, angereichertes Uran) und Warnanzeigen bei fehlenden Voraussetzungen.
- **Hochesthetische & Auffällige Rohstoff-Heatmap (`GeologicalDataService.ts` & Shader):**
  - **Prominenter Ein-/Aus-Schalter (`ControlPanel.ts`):**
    - Auffälliger Leuchtbutton `[ 🗺️ HEATMAP: AUS ]` bzw. `[ 🌟 HEATMAP: AKTIV ]` mit pulsierendem Neon-Emerald-Glow und Schnellfilter-Pills (`[⚡ Alle]`, `[⛏️ Eisen]`, `[🪨 Kohle]`, `[🛢️ Öl]`, `[☢️ Uran]`).
    - Hotkey `[H]` schaltet die Heatmap direkt um.
  - **Laufzeit-Generierung & Caching (`GeologicalDataService.ts`):**
    - Ermittelt und cached die echten 2D-Simplex-Dichtedaten (`Float32Array`) für alle 4 Rohstoffe und den Kombinationsmodus ("All").
  - **Shader-Upgrade (`geological-scouting.frag.glsl`):**
    - Extrem kontraststarke, leuchtende Thermalbänder: Electric Cyan $\rightarrow$ Neon Lime $\rightarrow$ Sonnengelb $\rightarrow$ Magma-Rot $\rightarrow$ Weißglühender Kern.
    - Gestochen scharfe weiße 1.5px Iso-Konturlinien zur sofortigen Erkennung von Förderzentren aus jedem Zoom-Level.
    - 95% Alpha-Deckung und Abdunklung des Hintergrunds für maximale Signalwirkung.
- **Uran-Zwang & Realistische Kosten für Nuklearwaffen:**
  - **Spaltmaterial-Voraussetzung:** Nuklearwaffen können **ausschließlich mit abgebautem und in Zentrifugen angereichertem Uran** ($U_{ref}$) gebaut und abgefeuert werden:
    - Atombombe (`AtomBomb`): $2.500\,G + 100\,Stahl + 50\,Fuel + \mathbf{10\,U_{ref}}$
    - Wasserstoffbombe (`HydrogenBomb`): $5.000\,G + 250\,Stahl + 100\,Fuel + \mathbf{25\,U_{ref}}$
    - MIRV (`MIRV`): $10.000\,G + 500\,Stahl + 200\,Fuel + \mathbf{50\,U_{ref}}$
  - **Engine-Validierung (`PlayerImpl.ts`, `NukeExecution.ts`, `MIRVExecution.ts`):**
    - `canBuildUnitType`: Blockiert den Bau bei $U_{ref} < Cost$ oder fehlendem Silo.
    - Bei Abschuss werden die veredelten Rohstoffe ($U_{ref}$, Stahl, Treibstoff) deterministisch vom Spielerkonto abgezogen.
  - **Client-Feedback:**
    - Hotbar-Button wird bei Uranmangel ausgegraut (`opacity-40 cursor-not-allowed`).
    - Tooltip zeigt explizit: `⚠️ Spaltmaterial fehlt: X U_ref benötigt (Vorhanden: Y) - Baue Uranminen & Zentrifugen!`.
- **Verifikation:**
  - `npm run typecheck` fehlerfrei über alle 7 Pakete (0 Fehler).
  - `vite build --mode development` erfolgreich abgeschlossen (7.78s).
  - Dev-Server läuft live auf Port 9000.
  - `index.html`: Body-Hintergrund auf `#131813` gesetzt, Preload-Color auf `#131913`.
  - `DesktopNavBar.ts` & `Footer.ts`: Transparenter Glasmorphismus mit `#131a14/90` und feiner Mooskante `border-[#2a382b]/60`.
  - `MobileNavBar.ts`: Aktive und Hover-Zustände auf Moosgrün umgestellt.
  - `MiningEconomyPanel.ts` & `ControlPanel.ts`: Menüleisten, Tabs und Industrie-Buttons passend in Wald-/Moosgrün gestaltet.
- **Verifikation:**
  - `npm run typecheck` fehlerfrei (0 Fehler).
  - `vite build --mode development` fehlerfrei in 6.72s abgeschlossen.
  - Server live auf `http://localhost:9000/` aktiv.

### [Version 0.5.2] - 2026-10-20
- **Kompaktes HUD ohne horizontale Scrollleiste (`UnitDisplay.ts`):**
  - Horizontale Scrollleiste vollständig eliminiert (`overflow-x-auto` durch `overflow-hidden` ersetzt).
  - Button-Größe von `min-w-[56px] h-[34px]` auf kompakte `w-[45px] h-[30px] shrink-0 px-1 py-0.5` optimiert.
  - Gestochen scharfe Vektor-Icons auf 16x16px (`w-4 h-4`), Tastatur-Badges auf `text-[9px]` und Stückzahlen auf `text-[10px]` verkleinert.
  - Die gesamte 8-Button-Reihe misst nun lediglich ca. 396px und fügt sich mit 100px Puffer nahtlos in den 500px breiten HUD-Container ein.
- **Flächendeckende Grundversorgung & Strategische Hotspots auf Landflächen (`ProceduralHeatmap.ts`, `EconomyExecution.ts`, `GeologicalDataService.ts`, Shader):**
  - **Strikte Land-Restriktion:** Meere und Ozeane (`!isLand(tile)`) weisen ausnahmslos 0.0 Ressourcendichte auf.
  - **Garantierte Grundversorgung:** Jede Kachel auf festem Land verfügt über ein Grundvorkommen aller 4 Ressourcen (Fe: 0.18, Kohle: 0.16, Rohöl: 0.14, Uran: 0.10) mit unerschöpflichem Basisvorrat (`cluster_baseline_${res}` mit 9.999.999 Einheiten). Kein Spieler kann mehr durch Ressourcen-Pech vom Bau elementarer Gebäude blockiert werden.
  - **Strategische Reiche Erzvorkommen (Hotspots):**
    - Breiter gestreute Makro-Cluster mit fließenden Übergängen und Schwellenwert 0.40.
    - Hohe Spitzenintensitäten (0.60 - 0.95) mit massiven Rohstofflagern (150.000 - 350.000 Einheiten), die extrem langsam erschöpfen und ca. 5x höheren Förderertrag abwerfen.
    - Starker strategischer Anreiz zur gezielten Eroberung rohstoffreicher Nachbarregionen.
  - **Shader-Upgrade (`geological-scouting.frag.glsl`):**
    - Wasserflächen ($v < 0.05$) bleiben transparent.
    - Basisland ($0.05 \le v < 0.25$) wird in dezentem, unaufdringlichem Cyan/Teal (42-58% Alpha) dargestellt, sodass das darunterliegende Territorium gut erkennbar bleibt.
    - Hotspots ($v \ge 0.30$) leuchten weithin sichtbar in Neon-Lime, Gold, Flammen-Orange und weißglühendem Magma.
- **Konsistentes Rebranding zu "InduFront":**
  - Alle verbliebenen Textstellen, Menü-Banner, Beschreibungen und Strings in `resources/lang/` und `static/lang/` (de.json, en.json) wurden systematisch von "OpenFront" / "Openfront" auf "InduFront" umgestellt.
  - HTML-Metadaten und externe Verlinkungen in `index.html` bereinigt.
- **Release Notes / Changelog Modal Integration (`changelog.md`, `news.json`):**
  - `resources/changelog.md` und `static/changelog.md` vollständig mit den echten InduFront-Versionshinweisen (v0.5.2, v0.5.1, v0.5.0, v0.4.0) befüllt.
  - Das Ingame-News-Modal lädt nun direkt die tatsächliche Entwicklungs-Historie und Patchnotes des InduFront-Forks.
- **Verifikation:**
  - `npm run typecheck` fehlerfrei (0 Fehler über alle 7 Pakete).
  - `vite build --mode development` in 7.40s fehlerfrei gebaut.
  - Dev-Server läuft stabil auf `http://localhost:9000/`.

### [Version 0.5.3] - 2026-10-20
- **Bereinigung der Spawn-Punkte & Garantierte Minen-Mindestförderung (`ProceduralHeatmap.ts`, `EconomyExecution.ts`):**
  - **Künstliche Spawn-Punkte vollständig entfernt:** Sämtliche künstlichen Home-Buffer-Ressourcenpunkte um Hauptstädte/Spawns wurden eliminiert. Die Verteilung folgt rein organischem Simplex-Noise über das Festland.
  - **Garantierte Mindestförderung:** Jede gebaute Mine liefert unabhängig von der Kachel mindestens 60% ihres Basis-Ertrags (`minedAmount = baseYield * (0.6 + intensity * 1.8 * yieldFactor)`).
  - **Hotspot-Bonus:** Liegt eine Mine auf einem geologischen Hotspot ($intensity \approx 0.70 - 0.95$), erhält sie bis zu $3\times$ Bonus-Ertrag.
- **Karten-Icons für Minen, Veredelungswerke & Bunker (`StructurePass.ts`, `UnitType.ts`):**
  - Erweiterung von `STRUCTURE_ORDER` auf 15 vollwertige Struktur-Typen inklusive Eisenmine, Kohlemine, Ölturm, Uranmine, Stahlwerk, Raffinerie, Zentrifuge, Bunker und Radar.
  - Dynamisches Compositing im WebGL-Atlas: Beim Start werden die Vektor-SVG-Icons nahtlos in neue Atlas-Spalten gezeichnet, sodass jedes platzierte Industrie- und Minengebäude nun auf der Map mit seinem individuellen weißen Symbol gerendert wird.
  - Strikte Trennung von Rohstoffen und veredelten Materialien: Raffinerien, Schmelzwerke und Zentrifugen bilden die unverzichtbare Veredelungs-Kette für Treibstoff, Panzerstahl und Spaltmaterial.
- **Glasklare Baukosten im UI-Hover-Tooltip (`UnitDisplay.ts`):**
  - Behebung des `overflow-hidden`-Clipping-Bugs: Tooltips können nun frei und ungehindert über der Hotbar schweben.
  - Vollständige Kostenaufstellung: Zeigt Gold (mit exponentieller Skalierung $Cost(n) = BaseCost \cdot 1.15^{n-1}$), Stahl, Treibstoff und Spaltmaterial mit aktuellen Beständen, Fehlbedarfs-Markierung in Rot und Infrastruktur-Voraussetzungen (z. B. Hafen, Silo).
- **Vollständiger Ressourcenhandel mit Spielern & Bots (`SendResourceModal.ts`, `PlayerPanel.ts`, `ExecutionManager.ts`, `TransferResourceExecution.ts`):**
  - Erweiterung des Handels-Modals um eine Schnell-Auswahl für alle 7 Roh- und Veredelungsstoffe (Eisen, Kohle, Öl, Uran, Stahl, Treibstoff, Spaltmaterial) neben Gold und Truppen.
  - Zuverlässige Übergabe von `EconomyExecution` in `ExecutionManager.ts`, sodass Ressourcen deterministisch zwischen Konten (auch an KI-Bots) transferiert werden.
- **Bot-Integration in das neue Ressourcensystem (`NationStructureBehavior.ts`, `PlayerImpl.ts`):**
  - Bots besitzen nun dedizierte Bau-Verhältnisse und Prioritäten für Eisenminen, Kohleminen, Öltürme, Uranminen, Stahlwerke, Raffinerien, Zentrifugen und Bunker.
  - Bots unterliegen denselben harten Ressourcen-Beschränkungen in `PlayerImpl.canBuildUnitType`: Ohne Stahl kein Kriegsschiff- oder Silobau, ohne Spaltmaterial keine Atomwaffen.
- **Preloading der geologischen Heatmap beim Laden der Karte (`GeologicalDataService.ts`, `ClientGameRunner.ts`):**
  - Berechnung der geologischen Dichtetexturen wurde in die Map-Initialisierungsphase vorverlegt (`GeologicalDataService.preload(gameView)`).
  - Tasten-Toggle (`H`) und Filter-Umschaltungen erfolgen nun verzögerungsfrei ohne Frame-Drops oder Ruckler.
- **Verifikation:**
  - `npm run typecheck` fehlerfrei (0 Fehler über alle 7 Pakete).
  - `vite build --mode development` in 9.87s fehlerfrei gebaut.
  - Dev-Server läuft stabil auf `http://localhost:9000/`.

### [Version 0.5.4] - 2026-10-20
- **Eroberungs-Plünderung & 80% Ressourcenübernahme (`EconomyExecution.ts`, `GameImpl.ts`):**
  - **Nationale Kapitulation (`conquerPlayer`):** Bei vollständiger Annexion einer Nation werden 80% aller gelagerten Rohstoffe ($Fe, C, Oil, U$) und veredelten Vorräte ($Stahl, Treibstoff, U_{ref}$) an den Sieger übertragen. Die restlichen 20% gelten als Kriegsverlust/Zerstörung.
  - **Taktische Anlagenübernahme (`onStructureCaptured`):** Beim Einnehmen einer feindlichen Kachel mit Mine, Bohrturm, Raffinerie oder Schmelze gehen 80% der vor Ort gepufferten Rohstoffe und der im Transit befindlichen Konvois an den Eroberer. Zudem wird ein lokaler Werksdepot-Bonus ausgeschüttet.
- **Logistik-Latenz & Entfernungsabhängiger Minen-Transport (`EconomyExecution.ts`):**
  - **Kein magischer Sofort-Transport mehr:** Rohstoffe werden an der Förderstätte gesammelt und unterliegen einer Transportzeit $\tau = \min(40, \lfloor d / 4 \rfloor)$ Ticks proportional zur Distanz zum nächsten Verarbeitungszentrum (Stahlwerk, Raffinerie, Zentrifuge, Stadt/Hauptstadt).
  - **Logistik-Konvois & Abfangbarkeit:** Rohstoffe im Transit (`shipments`) können bei Verlust der Mine abgefangen und zu 80% erbeutet werden.
- **Bot-Allianz-Hilfslieferungen & Ressourcen-Diplomatie (`NationAllianceBehavior.ts`, `NationExecution.ts`, `TransferResourceExecution.ts`):**
  - **Proaktive Bot-Hilfslieferungen (`maybeSendResourceAid`):** Verbündete Bots scannen periodisch den Versorgungszustand ihrer Partner. Bei Flotten-Treibstoffmangel oder Stahlknappheit entsenden sie automatisch Hilfslieferungen aus ihren Überschüssen.
  - **Reziproke Diplomatie & Benachrichtigungen:** Spieler erhalten bei Hilfslieferungen Ingame-Events und Handschlag-Gesten (`EMOJI_HANDSHAKE`); Geschenke des Spielers an KI-Nationen steigern die bilateralen Beziehungen nachhaltig.
- **Aktualisierung der Release Notes & News (`changelog.md`, `news.json`):**
  - Dokumentation von Patch 0.5.4 im Changelog und Startseiten-Newsfeed.

### [Version 0.5.5] - 2026-10-20
- **Behebung der fehlenden Hotbar-Icons (`UnitDisplay.ts`):**
  - **Neues Button-Layout:** Die Buttons in der Hotbar wurden von horizontalem Inline-Flex auf zentrierte Icons (`w-5 h-5`) mit absolutem Micro-Hotkey-Badge oben links (`S1`, `S2` etc.) und Stückzahl-Badge unten rechts umgestellt.
  - Dadurch verdrängen lange Hotkeys ("SHIFT+1" etc.) die Icons nicht mehr aus dem Button.
  - **Ressourcen-Icons in der oberen HUD-Leiste (`ControlPanel.ts`):** Vor allen Roh- und Veredelungszahlen (Fe, C, Oil, U, Stahl, Fuel, U-Ref) wurden die passenden SVG-Icons eingefügt.
- **Eisenbahn- & Schienenverbindungen für Minen & Raffinerien (`RailNetworkImpl.ts`, `ConstructionExecution.ts`, `FactoryExecution.ts`):**
  - **Netzwerk-Erweiterung (`RAIL_STATION_UNIT_TYPES`):** Minen (Eisen, Kohle, Öl, Uran) und Veredelungswerke (Stahlwerk, Raffinerie, Zentrifuge) wurden voll in das Schienennetz integriert.
  - **Schienenbau & Güterzüge:** Beim Bau von Minen und Veredelungswerken werden automatisch Schienen zu nahen Städten, Fabriken und Werken verlegt; Industrie-Hubs spawnen Güterzüge auf den Strecken.
- **Behebung des Ressourcen-Sync-Bugs (`GameUpdateUtils.ts`, `PlayerImpl.ts`):**
  - **Ursache identifiziert:** `GameUpdateUtils.ts` verglich `prev.economy === next.economy` per Referenz auf dasselbe mutable Objekt. Nach Tick 1 wurde das `economy`-Update daher niemals an den Client gesendet.
  - **Lösung:** `economyEqual`-Wertevergleich in `GameUpdateUtils.ts` und Snapshot-Cloning in `PlayerImpl.toFullUpdate()`. Ressourcenbestände aktualisieren sich nun jeden Tick flüssig im Client.
- **Anzeige von Minen & Raffinerien beim Spieler-Hover (`PlayerInfoOverlay.ts`):**
  - Beim Hovern über einen Spieler auf der Map oder in der Rangliste werden nun alle gebauten Industrie-, Minen- und Verteidigungseinrichtungen (Eisenminen, Kohleminen, Öltürme, Uranminen, Stahlwerke, Raffinerien, Zentrifugen, Bunker, Radar) mit Icons und Stückzahlen übersichtlich angezeigt.
