# InduFront Release Notes & Updates

Willkommen bei **InduFront** - der industriellen und taktischen Evolution von OpenFront!

---

## InduFront v0.5.9 - Echtes Login-System
**Datum:** 20. Oktober 2026

### Account-Server & Login
- **Eigener Login-Server:** Registrierung und Anmeldung per E-Mail/Passwort (scrypt-Hash, Rate-Limit), Sitzungen per httpOnly-Cookie, Zugriffstokens als signierte EdDSA-JWTs.
- **Game-Server-Verifikation:** Der Game-Server prüft jedes Token gegen den öffentlichen Schlüssel des Login-Servers (JWKS) - keine Test- oder Fake-Konten mehr.
- **Google-Login (optional):** Echtes OAuth 2.0, aktiv sobald GOOGLE_CLIENT_ID und GOOGLE_CLIENT_SECRET gesetzt sind.
- **Freunde einladen:** Alles läuft über eine einzige URL (Port 9000), siehe docs/LOGIN.md.

---

## InduFront v0.5.8 - Natürliche Heatmap, Marine-Texturen & Balance-Feinschliff
**Datum:** 20. Oktober 2026

### Natürliche Ressourcen-Verteilung (Heatmap Overhaul)
- **Organische geologische Verteilung:** Statt künstlicher, kreisrunder Cluster mit harten Kanten sind Rohstoffe nun überall auf dem Festland mit fließenden Übergängen natürlich verteilt (multi-frequente Simplex-Rauschfelder wie in der Realität).
- **Fließende Übergänge & Provinzen:** Regionale Erzadern gehen mit sanfter Hermite-Kurve ohne harte Grenzlinien in das Grundvorkommen über. Jede Kachel auf Land liefert Rohstoffe für Minen.

### Marine-Texturen & Schiffs-Rendering
- **Echte Schiffs-Texturen auf der Karte:** Zerstörer und Reparaturschiffe werden nicht mehr als riesige klobige Kreis-Struktur-Icons gerendert, sondern als schlanke Schiffsrümpfe direkt auf dem Wasser – passgenau zur Geometrie des Standard-Kriegsschiffs.
- **Markante Rumpfformen:** Der Zerstörer besitzt eine pfeilförmige Kampfspitze mit Geschütztürmen, das Reparaturschiff zeigt ein charakteristisches Versorgungs-/Reparaturkreuz auf dem Deck.

### Treibstoff & Balance-Feinschliff
- **1 HP Mindest-Rumpfstärke bei Treibstoffmangel:** Kriegsschiffe und Zerstörer können durch den Verschleiß bei leerem Treibstofftank nicht mehr sinken – die HP stoppen bei 1 HP, sodass manövrierunfähige Schiffe im Hafen repariert oder gerettet werden können.
- **Erhöhte Öl-Förderung:** Grundausbeute von Rohöl leicht gesteigert auf 2.2 Öl/Tick (22 Öl/s) für eine stabilere Treibstoffwirtschaft.
- **Reduzierter Schiffsverbrauch:** Treibstoffverbrauch der Flotte spürbar gesenkt (Kriegsschiff: 0.4 Fuel/Tick, Zerstörer: 1.2 Fuel/Tick, Reparaturschiff: 0.5 Fuel/Tick, Landungsboot: 0.15 Fuel/Tick).

### UI & Bereinigung
- **Hilfeseite bereinigt:** Altes Tutorial-Video aus dem fremden Fork entfernt und durch die übersichtliche integrierte Fehlerdiagnose und Support-Zentrale ersetzt.
- **Startseite aufgeräumt:** Durchrotierende, fehlerhafte Karten-Karten auf der Homepage entfernt; klare und übersichtliche Menüführung mit Fokus auf Solo, Tutorial, Erstellen, Ranked und Beitritt.

---

## InduFront v0.5.7 - Ultimativer Performance- & Anti-Freeze-Overhaul
**Datum:** 20. Oktober 2026

### Engine-Optimierung & Freeze-Eliminierung
- **Behebung massiver Freezes & Lagspikes:** Ursachenanalyse und Behebung der schwerwiegenden Spielhänger, die zuvor durch ungebremste Bot-Suchalgorithmen (BFS) über hunderte Kacheln ausgelöst wurden.
- **$O(1)$ Fast-Path bei Gebäude-Spawns:** Wenn die ausgewählte Kachel unbebaut ist, platziert die Engine das Bauwerk unmittelbar in $O(1)$, ohne das gesamte Staatsgebiet nach Ausweichfeldern abzusuchen.
- **Failed-Spawn-Caching:** Verhindert wiederholte ergebnislose BFS-Suchen für blockierte Gebäudetypen innerhalb desselben Ticks und derselben Kachelversion.
- **Konsolidierte EconomyExecution:** Die vier separaten Flotten- und Einheiten-Iterationen pro Tick wurden in einen einzigen effizienten Einzeldurchlauf pro Nation zusammengefasst.
- **Gedrosselter Treibstoff-Mangelschaden (Attrition):** Die Schadensberechnung bei Treibstoffknappheit erfolgt schonend und gleichmäßig 1x pro Sekunde (`tick % 10 === 0`), wodurch CPU-Spitzen vollständig geglättet wurden.
- **Stabile 60+ FPS:** Flüssige Darstellung auch in Großschlachten mit dutzenden Spielern, KI-Bots und ausgedehnten Industrienetzwerken.

---

## InduFront v0.5.6 - Radierer-Abriss-Modus, Hover-HP-Balken & Marschflugkörper-Fix
**Datum:** 20. Oktober 2026

### Abriss-Werkzeug (Radierer / Demolition Mode)
- **Gebäude-Abriss auf Knopfdruck:** Neues Radiergummi-Werkzeug in der Hotbar zum Rückbau von Minen, Fabriken, Verteidigungsanlagen und Raffinerien.
- **Rotes X-Symbol:** Bei aktiviertem Radierer werden abbreißbare Gebäude bei Klick oder Anwahl mit einem roten Warn-X markiert.
- **Bestätigungsdialog mit Unterdrückungs-Option:** Ein Dialog schützt vor versehentlichem Abriss und bietet die Checkbox *"Für diese Runde nicht mehr fragen"* für flüssiges Weiterbauen.

### UI & Visuelle Verbesserungen
- **Dynamische Schiffs-HP-Balken:** Lebensbalken von Kriegsschiffen, Zerstörern und Reparaturschiffen werden dezent nur bei Mauszeigerkontakt (Hover) eingeblendet.
- **Einstellungsoption:** Über die Spieleinstellungen kann das klassische Verhalten (*"HP-Balken immer anzeigen"*) jederzeit wieder aktiviert werden.

### Marschflugkörper (Cruise Missile) Stabilität
- **Crashfix bei Einschlag:** Behebung des kritischen Spielabsturzes bei Explosion von Marschflugkörpern (ungültige Kachelreferenzen korrigiert).
- **Ballistische Flugbahn-Visualisierung:** Flüssige bogenförmige Flugkurve mit gezieltem Detonations- und Zerstörungsradius.

---

## InduFront v0.5.5 - Strategische Aufrüstung, Marine-Overhaul & Farbpalette
**Datum:** 20. Oktober 2026

### Umfassendes Nuke-Rebalancing
- **Massiv verteuerte Massenvernichtungswaffen:**
  - **MIRV-Interkontinentalrakete:** Erfordert nun mindestens **1000 Einheiten angereichertes Uran**, 800 Stahl, 500 Treibstoff und 20.000 Gold.
  - **Wasserstoffbombe:** Erfordert **400 Einheiten angereichertes Uran**, 400 Stahl, 300 Treibstoff und 10.000 Gold.
  - **Atombombe:** Erfordert **150 Einheiten angereichertes Uran**, 200 Stahl, 150 Treibstoff und 5.000 Gold.
- **Verhinderung von Nuke-Spam:** Frühe Uranförderung verschafft einen strategischen Vorteil, ohne das Early-Game unüberwindbar zu dominieren.

### Konventionelle Marschflugkörper (Cruise Missiles)
- **Taktische Präzisionsrakete:** Schlägt im kleineren 3-Kachel-Radius ein.
- **Kein Uran erforderlich:** Benötigt moderat Stahl (40) und Treibstoff (120) bei 600 Gold – perfekt für chirurgische Schläge gegen feindliche Industriezentren und Flotten.

### Marine-Flotten-Overhaul
- **Zerstörer mit Angriffs-Aura:** Schnelle Begleitschiffe buffen den Schaden aller verbündeten Kriegsschiffe im Umkreis um **+10% pro Zerstörer** (gedeckelt bei maximal **+30%**).
- **Reparaturschiffe (Ersatz für U-Boote):** Zivile Hilfsschiffe, die befreundete Kriegsschiffe und Zerstörer in regelmäßigen Intervallen heilen. Sie besitzen keine Offensivbewaffnung, sind verwundbar und können sich selbst nicht reparieren.
- **Treibstoff-Logistik:** Alle Schiffe verbrauchen kontinuierlich Treibstoff auf See. Bei Treibstoffmangel droht Rumpfverschleiß (Attrition).

### UI & Grafische Identität
- **Schneeweiße Vektor-Icons auf der Map:** Alle neuen Industrie-, Marine- und Verteidigungsbauten besitzen kontraststarke, weiße Icons für perfekte Sichtbarkeit auf jedem Terrain.
- **Farbpaletten-Wahl in der Lobby:** Spieler können direkt im Hauptmenü über ein interaktives Farbpalettenfeld ihre gewünschte Startfarbe vor Spielbeginn festlegen.

---

## InduFront v0.5.4 - Logistik-Latenz, 80% Eroberungs-Plünderung & Bot-Allianz-Hilfe
**Datum:** 20. Oktober 2026

### Logistik & Minen-Transit (Entfernungs-Latenz)
- **Realistische Transportzeit:** Rohstoffe von Minen und Fördertürmen fließen nicht mehr augenblicklich in das nationale Inventar.
- **Entfernungsabhängige Latenz:** Je größer die Distanz zwischen der Mine und der nächstgelegenen Verarbeitungsstätte (Stahlwerk, Raffinerie, Zentrifuge, Stadt/Hauptstadt) ist, desto länger ist die Transportzeit ($\tau = \min(40, \lfloor d / 4 \rfloor)$ Ticks).
- **Zwischenlager an Minen:** Rohstoffe werden vor Ort in Transportpaketen gesammelt und in regelmäßigen Konvois zum Verarbeitungszentrum geschickt.

### 80% Beuteübernahme bei Eroberung
- **Nationale Kapitulation:** Bei der vollständigen Eroberung einer feindlichen Nation werden **80% aller gelagerten Rohstoffe und veredelten Materialien** (Eisenerz, Kohle, Rohöl, Uranerz, Stahl, Treibstoff, angereichertes Uran) an den Eroberer übertragen. Die restlichen 20% gelten als im Krieg zerstört oder verloren.
- **Taktische Anlagen-Übernahme:** Beim Erobern einer Kachel mit einer Mine, Raffinerie oder Schmelze werden **80% aller vor Ort zwischengelagerten und auf dem Weg befindlichen Konvois** sofort beschlagnahmt, ergänzt durch einen Vor-Ort-Plünderungsbonus aus den Werksdepots.

### Bot-Allianz-Hilfslieferungen & Ressourcen-Diplomatie
- **Aktive Bot-Hilfslieferungen:** Befreundete Bots erkennen kritische Versorgungsengpässe ihrer Verbündeten (z.B. Treibstoffknappheit zur Vermeidung von Flottenverlusten oder Mangel an Panzerstahl) und entsenden automatisch Hilfslieferungen aus ihren Überschüssen.
- **Reziproke Diplomatie:** Sendet ein Spieler Rohstoffe an verbündete Bots, honorieren diese die Unterstützung mit sofortigem Beziehungszuwachs und Vertrauensgesten.

---

## InduFront v0.5.3 - P2P-Ressourcenhandel & WebGL-Karten-Icons
**Datum:** 20. Oktober 2026

- **Multi-Ressourcen-Handel im Spieler-Panel:** Spenden und Tausch aller 8 Rohstoffe (Gold, Eisen, Kohle, Öl, Uran, Stahl, Treibstoff, angereichertes Uran) direkt über das Spieler-Profil und den Ressourcen-Dialog.
- **WebGL2-Gebäude-Icons auf der Weltkarte:** Alle 9 neuen Industrie- und Verteidigungsbauten (Eisenmine, Kohlemine, Bohrturm, Uranmine, Stahlwerk, Raffinerie, Zentrifuge, Bunker, Radar) werden mit scharfen Vektor-Symbolen direkt auf den Spielfeldkacheln gerendert.
- **Flüssiges Preloading:** Geologische Texturen und Heatmaps werden bereits während des Map-Ladens vorberechnet, wodurch der anfängliche Ruckler beim Spielstart vollständig eliminiert wurde.
- **Unverdeckte Kosten-Tooltips:** Gebäude-Tooltips floateten zuvor hinter UI-Panels; Tooltips schweben nun frei und zeigen detaillierte Rohstoffkosten.

---

## InduFront v0.5.2 - UI-Entzerrung & Globale Rohstoff-Verteilung
**Datum:** 20. Oktober 2026

### UI & Ergonomie
- **Kompakte, übersichtliche Hotbar ohne horizontales Scrollen:** Alle Buttons wurden auf ein schlankes, platzsparendes Format (`45px` Breite) optimiert.
- **Keine Scrollbalken mehr:** Die Leiste passt sich nahtlos an alle Bildschirmauflösungen an, ohne horizontales Scrollen zu erzwingen.
- **Kleine, gestochen scharfe Vektor-Icons:** Vollständig befreit von Emojis - alle Einheiten und Rohstoffe nutzen weiße SVG-Symbole mit klaren Stückzahlanzeigen.

### Geologie & Rohstoff-Balance
- **Garantierte Rohstoff-Basis auf allen Landflächen:** Jede Landkachel besitzt ein Grundvorkommen an Eisenerz, Kohle, Rohöl und Uran. Kein Spieler wird mehr durch ungünstige Spawns handlungsunfähig blockiert.
- **Strategische Rohstoff-Hotspots:** Mächtige Vorkommens-Cluster mit extrem hohen Reserven und bis zu 3-facher Förderrate bieten klare strategische Kriegsziele.
- **Reine Landverteilung:** Ressourcen existieren ausschließlich auf Landmassen; Ozeane und Wasserflächen bleiben sauber.
- **Sanftere Heatmap-Darstellung:** Dynamische Transparenz - dezente Anzeige für Grundvorkommen und leuchtendes Magma/Gold für strategische Hotspots.

---

## InduFront v0.5.1 - Hotbar-Tabs & WebGL2-Heatmap
**Datum:** 20. Oktober 2026

- **Reiter-Strukturierung:** Trennung in **Gebäude** (Infrastruktur, Verteidigung, Minen, Schmelzen) und **Actives** (Kriegsschiffe, Zerstörer, U-Boote, Nuklearwaffen).
- **Hafen bei Gebäuden:** Der Marinehafen wurde logisch in das Gebäude-Menü integriert.
- **Tab-Umschaltung:** Schneller Wechsel zwischen den Reitern per Mausklick oder Taste `[Tab]`.
- **WebGL2-Heatmap Repariert:** Umstellung auf hardwarenahes R8-Texturformat und `texelFetch`-Kachelabtastung für gestochen scharfe Kanten direkt über allen Kartenlayern.
- **Uran-Voraussetzung für Nuklearwaffen:** Atombomben, Wasserstoffbomben und MIRV erfordern abgebautes und in Zentrifugen angereichertes Spaltmaterial ($U_{ref}$).

---

## InduFront v0.5.0 - Hybrides Industrie- & Minen-System
**Datum:** 20. Oktober 2026

- **Rohstoff-Förderung (Tier 1):** Eisenminen, Kohleminen, Bohrtürme und Uranminen zur Rohstoffgewinnung.
- **Industrielle Veredelung (Tier 2):**
  - **Stahlwerk:** Schmilzt $2\,Fe + 1\,C \rightarrow 1\,Stahl$.
  - **Raffinerie:** Destilliert $2\,Öl \rightarrow 1\,Treibstoff$.
  - **Uran-Zentrifuge:** Reichert $4\,U + 2\,C \rightarrow 1\,U_{ref}$ an.
- **Militärische Logistik:** Panzer und Flottenverbände benötigen Treibstoff; Flottenattrition bei Treibstoffmangel.

---

## InduFront v0.4.0 - Neues Taktik-Design
**Datum:** 20. Oktober 2026

- **Rebranding:** Einführung des neuen Namens **InduFront** mit modernem Hexagon-Militärlogo.
- **Farbpalette:** Natürliches Moos- und Waldgrün (`#5d9651` / `#8ebf7e`) abgestimmt auf das taktische Hauptmenü.
- **Bereinigung von Drittanbieter-Bannern:** Fokus auf flüssiges Gameplay und faire Wettkämpfe.
