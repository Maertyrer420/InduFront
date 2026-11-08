import { html, TemplateResult } from "lit";
import { customElement, state } from "lit/decorators.js";
import { textDirection, translateText } from "../client/Utils";
import { BaseModal } from "./components/BaseModal";
import "./components/Difficulties";
import { modalHeader } from "./components/ui/ModalHeader";
import {
  allianceIcon,
  atomBombIcon,
  bunkerIcon,
  centrifugeIcon,
  coalMineIcon,
  cruiseMissileIcon,
  defensePostIcon,
  destroyerIcon,
  eraserIcon,
  hydrogenBombIcon,
  ironMineIcon,
  mirvIcon,
  oilRigIcon,
  radarIcon,
  refineryIcon,
  repairShipIcon,
  residentialIcon,
  samLauncherIcon,
  steelMillIcon,
  uraniumMineIcon,
  warshipIcon,
} from "./hud/HotbarIcons";
import { Platform } from "./Platform";
import { TroubleshootingModal } from "./TroubleshootingModal";
import { UserSettings } from "./UserSettings";

type HelpTab =
  | "tutorial"
  | "economy"
  | "refinery"
  | "defense"
  | "alliances"
  | "military"
  | "nukes"
  | "ranked"
  | "stats"
  | "controls"
  | "support"
  | "all";

@customElement("help-modal")
export class HelpModal extends BaseModal {
  protected routerName = "help";

  @state() private selectedTab: HelpTab = "tutorial";
  @state() private keybinds: Record<string, string> = this.getKeybinds();

  private getKeybinds(): Record<string, string> {
    return new UserSettings().keybinds(Platform.isMac);
  }

  private getKeyLabel(code: string): string {
    if (!code) return "";

    const specialLabels: Record<string, string> = {
      ShiftLeft: "⇧ Shift",
      ShiftRight: "⇧ Shift",
      ControlLeft: "Ctrl",
      ControlRight: "Ctrl",
      AltLeft: "Alt",
      AltRight: "Alt",
      MetaLeft: "⌘",
      MetaRight: "⌘",
      Space: "Space",
      Escape: "Esc",
      Enter: "↵ Return",
      ArrowUp: "↑",
      ArrowDown: "↓",
      ArrowLeft: "←",
      ArrowRight: "→",
      Period: ">",
      Comma: "<",
    };

    if (code.startsWith("Shift+")) {
      return `Shift+${this.getKeyLabel(code.slice(6))}`;
    }
    if (specialLabels[code]) return specialLabels[code];
    if (code.startsWith("Key") && code.length === 4) return code.slice(3);
    if (code.startsWith("Digit")) return code.slice(5);
    if (code.startsWith("Numpad")) return `Num ${code.slice(6)}`;

    return code;
  }

  private renderKey(code: string) {
    const label = this.getKeyLabel(code);
    return html`<span
      dir="ltr"
      class="inline-block min-w-[32px] text-center px-2 py-1 rounded bg-[#2a2a2a] border-b-2 border-[#1a1a1a] text-white font-mono text-xs font-bold mx-0.5"
      >${label}</span
    >`;
  }

  protected renderHeaderSlot() {
    return modalHeader({
      title: "InduFront - Handbuch & Exakte Spielstatistiken",
      onBack: () => this.close(),
      ariaLabel: translateText("common.back"),
    });
  }

  private renderTabBar(): TemplateResult {
    const tabs: Array<{ id: HelpTab; label: string; icon: string }> = [
      { id: "tutorial", label: "Spielanleitung & Guides", icon: "📖" },
      { id: "economy", label: "Rohstoffe & Minen", icon: "⛏️" },
      { id: "refinery", label: "Industrie & Veredelung", icon: "🏭" },
      { id: "defense", label: "Verteidigung & Stahlbunker", icon: "🛡️" },
      { id: "alliances", label: "Allianzen & Diplomatie", icon: "🤝" },
      { id: "military", label: "Marine & Flotte", icon: "⚓" },
      { id: "nukes", label: "Marschflugkörper & Nuklear", icon: "🚀" },
      { id: "ranked", label: "Ranked & Belohnungen", icon: "🏆" },
      { id: "stats", label: "Stats & Baukosten", icon: "📊" },
      { id: "controls", label: "Steuerung & Werkzeuge", icon: "🛠️" },
      { id: "support", label: "Diagnose & Support", icon: "🔧" },
      { id: "all", label: "Alles anzeigen", icon: "📜" },
    ];

    return html`
      <div
        class="flex items-center gap-2 overflow-x-auto pb-3 mb-6 border-b border-white/10 no-scrollbar"
      >
        ${tabs.map(
          (tab) => html`
            <button
              class="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all ${this
                .selectedTab === tab.id
                ? "bg-[#5d9651] text-white shadow-md shadow-[#5d9651]/30 font-bold"
                : "bg-white/5 text-gray-300 hover:bg-white/10 hover:text-white border border-white/5"}"
              @click=${() => (this.selectedTab = tab.id)}
            >
              <span>${tab.icon}</span>
              <span>${tab.label}</span>
            </button>
          `,
        )}
      </div>
    `;
  }

  private renderTutorialSection(): TemplateResult {
    return html`
      <div class="mb-10">
        <!-- Hero Header -->
        <div
          class="relative bg-gradient-to-r from-[#203022] to-[#141d15] rounded-2xl p-6 border border-[#5d9651]/40 mb-6 shadow-xl"
        >
          <div
            class="flex flex-col md:flex-row items-start md:items-center justify-between gap-4"
          >
            <div>
              <span
                class="inline-block px-2.5 py-1 rounded bg-[#5d9651]/30 text-[#8ebf7e] text-xs font-extrabold tracking-wider uppercase mb-2"
              >
                Offizieller InduFront Leitfaden
              </span>
              <h2 class="text-2xl md:text-3xl font-extrabold text-white mb-2">
                Wie man InduFront spielt - Taktik, Industrie & Allianzen
              </h2>
              <p class="text-sm text-gray-300 max-w-2xl leading-relaxed">
                InduFront verbindet strategische Gebietskontrolle mit einem
                tiefgehenden Ressourcenkreislauf, Allianzen gegen Hegemonen,
                bombensicheren Stahlbunkern und dynamischem Ranked-Matchmaking.
              </p>
            </div>
            <button
              class="shrink-0 px-5 py-3 rounded-xl bg-[#5d9651] hover:bg-[#6ba85e] text-white font-bold text-xs uppercase tracking-widest shadow-lg shadow-[#5d9651]/30 transition-all flex items-center gap-2"
              @click=${() =>
                document.dispatchEvent(new CustomEvent("start-tutorial"))}
            >
              <svg
                class="w-4 h-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <polygon
                  points="5 3 19 12 5 21 5 3"
                  fill="currentColor"
                ></polygon>
              </svg>
              <span>Interaktives Tutorial starten</span>
            </button>
          </div>
        </div>

        <!-- 8 Detailed Steps with Complete Mechanics -->
        <div class="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
          <!-- Step 1: Spawn & Geology -->
          <div
            class="bg-black/25 rounded-xl border border-white/10 p-5 hover:border-[#5d9651]/50 transition-all"
          >
            <div class="flex items-center gap-3 mb-2">
              <span
                class="w-7 h-7 rounded-full bg-[#5d9651]/20 border border-[#5d9651] text-[#8ebf7e] flex items-center justify-center font-bold text-sm"
                >1</span
              >
              <h3 class="text-base font-bold text-white m-0">
                Spawn & Geologische Erkundung
              </h3>
            </div>
            <p class="text-xs text-gray-300 leading-relaxed mb-2 m-0">
              Wähle eine Startposition mit zusammenhängender Landfläche. Achte
              auf Rohstoff-Hotspots (leuchtende Kacheln). Jede Landkachel hat
              ein Grundvorkommen, aber Hotspots liefern
              <strong>exakt das 3.0-Fache</strong> an Fördermenge (bis zu 75
              Einheiten/Sekunde)!
            </p>
            <div
              class="text-[11px] font-mono text-emerald-400 bg-emerald-950/30 p-2 rounded border border-emerald-800/30"
            >
              Tipp: Ein früher Eisenerz- und Kohle-Hotspot sichert deine
              Panzerstahl-Produktion für Schiffe und Bunker.
            </div>
          </div>

          <!-- Step 2: Attack Ratio -->
          <div
            class="bg-black/25 rounded-xl border border-white/10 p-5 hover:border-[#5d9651]/50 transition-all"
          >
            <div class="flex items-center gap-3 mb-2">
              <span
                class="w-7 h-7 rounded-full bg-[#5d9651]/20 border border-[#5d9651] text-[#8ebf7e] flex items-center justify-center font-bold text-sm"
                >2</span
              >
              <h3 class="text-base font-bold text-white m-0">
                Angriffs-Ratio & Hotkeys
              </h3>
            </div>
            <p class="text-xs text-gray-300 leading-relaxed mb-2 m-0">
              Steuere deine Truppenentsendung mit den Tasten
              <strong>[1], [2], [3]</strong> oder dem Kontrollpanel:
            </p>
            <ul class="text-xs text-gray-300 space-y-1 ps-4 m-0">
              <li>
                <strong class="text-amber-300">[1] = 20%:</strong> Exakt 20% der
                Truppen rücken vor. Perfekt zur defensiven Gebietsabrundung.
              </li>
              <li>
                <strong class="text-amber-300">[2] = 50%:</strong> Exakt die
                Hälfte deiner Truppen marschiert. Der Standard-Angriff.
              </li>
              <li>
                <strong class="text-amber-300">[3] = 100%:</strong>
                All-Out-Angriff mit 100% Truppen. Durchbricht Fronten, lässt die
                Kachel aber ungeschützt!
              </li>
            </ul>
          </div>

          <!-- Step 3: Gold, Population & Residential -->
          <div
            class="bg-black/25 rounded-xl border border-white/10 p-5 hover:border-[#5d9651]/50 transition-all"
          >
            <div class="flex items-center gap-3 mb-2">
              <span
                class="w-7 h-7 rounded-full bg-[#5d9651]/20 border border-[#5d9651] text-[#8ebf7e] flex items-center justify-center font-bold text-sm"
                >3</span
              >
              <h3 class="text-base font-bold text-white m-0">
                Gold, Demografie & Wohnviertel
              </h3>
            </div>
            <p class="text-xs text-gray-300 leading-relaxed mb-2 m-0">
              Dein Einkommen und Truppenwachstum berechnen sich nach
              mathematischen Formeln pro Tick (10 Ticks = 1 Sekunde).
              <strong>Wohnviertel</strong>
              (weißes Haus-Icon auf der Karte) steigern dein Bevölkerungslimit:
            </p>
            <div
              class="text-[11px] font-mono text-cyan-300 bg-cyan-950/30 p-2 rounded border border-cyan-800/30 space-y-1"
            >
              <div>
                Gold-Einkommen: G = ⌊ 0.02 × Territorium + 0.10 × Bevölkerung ⌋
                / Tick
              </div>
              <div>Demografie-Cap: K_P = 1.000 + 500 × Wohnviertel</div>
              <div>Wachstum: r = 0.05 (5.0% Basiswachstumsrate pro Zyklus)</div>
            </div>
          </div>

          <!-- Step 4: Cities & Factories -->
          <div
            class="bg-black/25 rounded-xl border border-white/10 p-5 hover:border-[#5d9651]/50 transition-all"
          >
            <div class="flex items-center gap-3 mb-2">
              <span
                class="w-7 h-7 rounded-full bg-[#5d9651]/20 border border-[#5d9651] text-[#8ebf7e] flex items-center justify-center font-bold text-sm"
                >4</span
              >
              <h3 class="text-base font-bold text-white m-0">
                Städte & Fabriken (Logistikknoten)
              </h3>
            </div>
            <p class="text-xs text-gray-300 leading-relaxed mb-2 m-0">
              Zivile Infrastruktur bildet das logistische Rückgrat deines
              Reiches:
            </p>
            <ul class="text-xs text-gray-300 space-y-1 ps-4 m-0">
              <li>
                <strong class="text-white">Stadt (City - 100 Gold):</strong>
                Erhöht das Truppenlimit, generiert passives Gold und dient als
                Logistikknoten (0 Distanz-Latenz für Rohstofftransporte).
              </li>
              <li>
                <strong class="text-white">Fabrik (Factory - 250 Gold):</strong>
                Verdoppelt die lokale Truppenproduktionsrate (<strong
                  >2.0x Boost</strong
                >) und verbindet Schienennetze für Handelseinnahmen.
              </li>
            </ul>
          </div>

          <!-- Step 5: Resources & Industry -->
          <div
            class="bg-black/25 rounded-xl border border-white/10 p-5 hover:border-[#5d9651]/50 transition-all"
          >
            <div class="flex items-center gap-3 mb-2">
              <span
                class="w-7 h-7 rounded-full bg-[#5d9651]/20 border border-[#5d9651] text-[#8ebf7e] flex items-center justify-center font-bold text-sm"
                >5</span
              >
              <h3 class="text-base font-bold text-white m-0">
                Rohstoffe & Industrielle Veredelung
              </h3>
            </div>
            <p class="text-xs text-gray-300 leading-relaxed mb-2 m-0">
              Moderne Truppen benötigen veredelte Güter statt nur Gold:
            </p>
            <ul class="text-xs text-gray-300 space-y-1 ps-4 m-0">
              <li>
                <strong class="text-cyan-300">Stahlwerk (400 Gold):</strong>
                Schmilzt 3 Fe + 2 C → 1 Stahl (10 Stahl/s). Benötigt für
                Kriegsschiffe, Zerstörer und Stahlbunker.
              </li>
              <li>
                <strong class="text-orange-300">Raffinerie (500 Gold):</strong>
                Destilliert 3 Rohöl → 1 Fuel (10 Fuel/s). Treibstoff für Schiffe
                und Flugabwehr.
              </li>
              <li>
                <strong class="text-lime-300">Zentrifuge (1.200 Gold):</strong>
                Reichert 5 U + 3 C → 1 U_ref an. Essentiell für nukleare
                Sprengköpfe.
              </li>
            </ul>
            <div
              class="text-[11px] font-mono text-amber-300 bg-amber-950/30 p-2 rounded border border-amber-800/30 mt-2"
            >
              80% Plünderung: Bei der Kapitulation eines Gegners erbeutest du
              80% aller gelagerten Rohstoffe!
            </div>
          </div>

          <!-- Step 6: Defense Post & Nuke-Proof Steel Bunker -->
          <div
            class="bg-black/25 rounded-xl border border-white/10 p-5 hover:border-[#5d9651]/50 transition-all"
          >
            <div class="flex items-center gap-3 mb-2">
              <span
                class="w-7 h-7 rounded-full bg-[#5d9651]/20 border border-[#5d9651] text-[#8ebf7e] flex items-center justify-center font-bold text-sm"
                >6</span
              >
              <h3 class="text-base font-bold text-white m-0">
                Befestigung: Verteidigungsposten & Stahlbunker
              </h3>
            </div>
            <p class="text-xs text-gray-300 leading-relaxed mb-2 m-0">
              Sichere Grenzen gegen Masseninvasionen und Nuklearschläge:
            </p>
            <ul class="text-xs text-gray-300 space-y-1 ps-4 m-0">
              <li>
                <strong class="text-yellow-300"
                  >Verteidigungsposten (100 Gold):</strong
                >
                Verleiht einen gewaltigen
                <strong>5.0x Lanchester-Verteidigungsmultiplikator</strong> und
                verlangsamt feindliche Angriffe um das
                <strong>3.0-Fache</strong>.
              </li>
              <li>
                <strong class="text-cyan-300"
                  >Stahlbunker (500 Gold + 100·1.6^n Stahl):</strong
                >
                Extrem teure, unverwüstliche Festung.
                <strong>100% Nuke- & Bombensicher</strong> – kann von keiner
                Atombombe, H-Bombe oder MIRV zerstört werden!
              </li>
            </ul>
          </div>

          <!-- Step 7: Alliances & Anti-Giant Rule -->
          <div
            class="bg-black/25 rounded-xl border border-white/10 p-5 hover:border-[#5d9651]/50 transition-all"
          >
            <div class="flex items-center gap-3 mb-2">
              <span
                class="w-7 h-7 rounded-full bg-[#5d9651]/20 border border-[#5d9651] text-[#8ebf7e] flex items-center justify-center font-bold text-sm"
                >7</span
              >
              <h3 class="text-base font-bold text-white m-0">
                Allianzen ("Kleine Länder Bündnis")
              </h3>
            </div>
            <p class="text-xs text-gray-300 leading-relaxed mb-2 m-0">
              Mehrere kleinere Nationen können sich zu schlagkräftigen Allianzen
              zusammenschließen, um gemeinsame Kriege zu koordinieren und
              Rohstoffe per P2P-Hilfslieferung zu teilen:
            </p>
            <div
              class="text-[11px] font-mono text-purple-300 bg-purple-950/30 p-2 rounded border border-purple-800/30"
            >
              Anti-Großmächte-Regel: Spieler in den Top 10 können keiner Allianz
              beitreten und verlassen sie automatisch beim Erreichen der Top 10!
            </div>
          </div>

          <!-- Step 8: Ranked, Elo & Steel Rewards -->
          <div
            class="bg-black/25 rounded-xl border border-white/10 p-5 hover:border-[#5d9651]/50 transition-all"
          >
            <div class="flex items-center gap-3 mb-2">
              <span
                class="w-7 h-7 rounded-full bg-[#5d9651]/20 border border-[#5d9651] text-[#8ebf7e] flex items-center justify-center font-bold text-sm"
                >8</span
              >
              <h3 class="text-base font-bold text-white m-0">
                Ranked-Modus, Elo & Stahl-Belohnungen
              </h3>
            </div>
            <p class="text-xs text-gray-300 leading-relaxed mb-2 m-0">
              Kämpfe in 1v1, 2v2 oder FFA um Elo von Bronze bis Großmeister.
              Nach jedem Match erhältst du <strong>Stahl (⚙️)</strong> für den
              Kosmetik-Shop:
            </p>
            <ul class="text-xs text-gray-300 space-y-1 ps-4 m-0">
              <li>
                <strong class="text-amber-300">🥇 Sieg (Platz 1):</strong> 1.000
                Stahl
              </li>
              <li>
                <strong class="text-slate-300">🥈 Platz 2:</strong> 750 Stahl
              </li>
              <li>
                <strong class="text-amber-600">🥉 Platz 3:</strong> 500 Stahl
              </li>
            </ul>
            <div class="text-[11px] text-gray-400 mt-2">
              Kaufe im Shop exklusive Spielertitel, Badges, Skins und Sounds
              ohne Echtgeld!
            </div>
          </div>
        </div>

        <!-- Strategy Tips Box -->
        <div class="bg-[#1a241b] rounded-xl border border-[#5d9651]/30 p-5">
          <h4
            class="text-sm font-bold text-[#8ebf7e] uppercase tracking-wider mb-2 flex items-center gap-2 m-0"
          >
            <span>💡</span> Strategischer Taktik-Ratgeber
          </h4>
          <ul class="text-xs text-gray-300 space-y-2 ps-4 m-0">
            <li>
              <strong>Transport-Latenz minimieren:</strong> Baue
              Verarbeitungsbetriebe stets nahe an deinen Minen. Transitzeit:
              <strong>τ = min(40, ⌊d / 4⌋) Ticks</strong>.
            </li>
            <li>
              <strong>80.0% Beuteübernahme:</strong> Bei Kachel- oder
              Nationeneroberung werden exakt <strong>80.0%</strong> aller
              Ressourcen erbeutet, 20.0% gelten als Kriegsverlust.
            </li>
            <li>
              <strong>Zerstörer-Geleitschutz:</strong> Bis zu 3 Zerstörer in der
              Nähe buffen den Schaden deiner Kriegsschiffe um
              <strong>+10.0% pro Zerstörer</strong> (maximal
              <strong>+30.0%</strong>)!
            </li>
            <li>
              <strong>Treibstoffmangel verhindern:</strong> Sinkt dein Fuel auf
              0, erleiden alle Schiffe
              <strong>-80.0% Tempo, -50.0% Kampfkraft</strong> und verlieren
              <strong>10 HP alle 10 Ticks (1s)</strong>, können dadurch jedoch
              <strong>niemals unter 1 HP</strong> fallen (Schiffe sinken nicht
              durch Kraftstoffmangel alleine).
            </li>
            <li>
              <strong>Verteidigungsposten an Grenzen:</strong> 5.0x
              Verteidigungsbonus und 3.0x Angriffsbremse wehren feindliche
              Übermächte mit minimalem Truppeneinsatz ab.
            </li>
            <li>
              <strong>Nuke-Resilienz mit Stahlbunkern:</strong> Platziere
              Stahlbunker an kritischen Schlüsselpositionen – sie widerstehen
              selbst schwersten nuklearen MIRV-Angriffen!
            </li>
            <li>
              <strong>Bündnisse gegen Hegemonen:</strong> Schließe dich mit
              Nachbarn zusammen, um expansive Großmächte einzudämmen, bevor sie
              uneinholbar wachsen.
            </li>
          </ul>
        </div>
      </div>
    `;
  }

  private renderEconomySection(): TemplateResult {
    return html`
      <div class="mb-10">
        <div class="flex items-center gap-3 mb-4">
          <img src=${ironMineIcon} class="w-6 h-6" />
          <h2 class="text-xl font-bold text-white m-0">
            Rohstoffe & Geologische Vorkommen (Tier 1 Minen)
          </h2>
        </div>
        <p class="text-sm text-gray-300 mb-6 leading-relaxed">
          In InduFront basiert militärische Macht auf industrieller
          Rohstoffförderung. Jede Landkachel verfügt über ein Grundvorkommen,
          während geologische Hotspots bis zu
          <strong>3.0-fache Förderraten</strong> und riesige Reserven bieten.
        </p>

        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
          <!-- Iron Mine -->
          <div
            class="bg-black/30 rounded-xl border border-white/10 p-5 flex gap-4"
          >
            <div
              class="p-3 rounded-lg bg-white/5 border border-white/10 shrink-0 self-start"
            >
              <img src=${ironMineIcon} class="w-8 h-8" />
            </div>
            <div class="flex-1">
              <div class="flex items-center justify-between mb-1">
                <h3 class="text-base font-bold text-white m-0">
                  Eisenmine (Iron Mine)
                </h3>
                <span
                  class="text-xs font-mono px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30"
                  >200 Gold</span
                >
              </div>
              <div
                class="grid grid-cols-2 gap-2 text-[11px] font-mono text-gray-300 bg-black/40 p-2 rounded mb-2"
              >
                <div>
                  Basis:
                  <span class="text-emerald-400 font-bold">2.5 Fe/Tick</span>
                  (25/s)
                </div>
                <div>
                  Hotspot:
                  <span class="text-amber-300 font-bold">7.5 Fe/Tick</span>
                  (75/s)
                </div>
                <div>
                  Ader-Größe:
                  <span class="text-cyan-300">50.000 Einheiten</span>
                </div>
                <div>
                  Min-Floor: <span class="text-white">15% (3.75/s)</span>
                </div>
              </div>
              <p class="text-xs text-gray-300 mb-1">
                Bedarf: Unverzichtbar für Stahlwerke zur Herstellung von
                Panzerstahl.
              </p>
              <span class="text-[10px] text-gray-400 font-mono"
                >Baukosten-Formel: 200 × 1.15^(n-1) Gold</span
              >
            </div>
          </div>

          <!-- Coal Mine -->
          <div
            class="bg-black/30 rounded-xl border border-white/10 p-5 flex gap-4"
          >
            <div
              class="p-3 rounded-lg bg-white/5 border border-white/10 shrink-0 self-start"
            >
              <img src=${coalMineIcon} class="w-8 h-8" />
            </div>
            <div class="flex-1">
              <div class="flex items-center justify-between mb-1">
                <h3 class="text-base font-bold text-white m-0">
                  Kohlemine (Coal Mine)
                </h3>
                <span
                  class="text-xs font-mono px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30"
                  >150 Gold</span
                >
              </div>
              <div
                class="grid grid-cols-2 gap-2 text-[11px] font-mono text-gray-300 bg-black/40 p-2 rounded mb-2"
              >
                <div>
                  Basis:
                  <span class="text-emerald-400 font-bold">2.5 C/Tick</span>
                  (25/s)
                </div>
                <div>
                  Hotspot:
                  <span class="text-amber-300 font-bold">7.5 C/Tick</span>
                  (75/s)
                </div>
                <div>
                  Ader-Größe:
                  <span class="text-cyan-300">40.000 Einheiten</span>
                </div>
                <div>
                  Min-Floor: <span class="text-white">15% (3.75/s)</span>
                </div>
              </div>
              <p class="text-xs text-gray-300 mb-1">
                Bedarf: Reduktionsmittel für Stahlwerke und energetischer Träger
                in Zentrifugen.
              </p>
              <span class="text-[10px] text-gray-400 font-mono"
                >Baukosten-Formel: 150 × 1.15^(n-1) Gold</span
              >
            </div>
          </div>

          <!-- Oil Rig -->
          <div
            class="bg-black/30 rounded-xl border border-white/10 p-5 flex gap-4"
          >
            <div
              class="p-3 rounded-lg bg-white/5 border border-white/10 shrink-0 self-start"
            >
              <img src=${oilRigIcon} class="w-8 h-8" />
            </div>
            <div class="flex-1">
              <div class="flex items-center justify-between mb-1">
                <h3 class="text-base font-bold text-white m-0">
                  Bohrturm (Oil Rig)
                </h3>
                <span
                  class="text-xs font-mono px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30"
                  >350 Gold</span
                >
              </div>
              <div
                class="grid grid-cols-2 gap-2 text-[11px] font-mono text-gray-300 bg-black/40 p-2 rounded mb-2"
              >
                <div>
                  Basis:
                  <span class="text-emerald-400 font-bold">2.2 Öl/Tick</span>
                  (22/s)
                </div>
                <div>
                  Hotspot:
                  <span class="text-amber-300 font-bold">6.6 Öl/Tick</span>
                  (66/s)
                </div>
                <div>
                  Ader-Größe:
                  <span class="text-cyan-300">30.000 Einheiten</span>
                </div>
                <div>
                  Min-Floor: <span class="text-white">15% (3.3/s)</span>
                </div>
              </div>
              <p class="text-xs text-gray-300 mb-1">
                Bedarf: Wird in Raffinerien zu lebenswichtigem Treibstoff
                destilliert.
              </p>
              <span class="text-[10px] text-gray-400 font-mono"
                >Baukosten-Formel: 350 × 1.15^(n-1) Gold</span
              >
            </div>
          </div>

          <!-- Uranium Mine -->
          <div
            class="bg-black/30 rounded-xl border border-white/10 p-5 flex gap-4"
          >
            <div
              class="p-3 rounded-lg bg-white/5 border border-white/10 shrink-0 self-start"
            >
              <img src=${uraniumMineIcon} class="w-8 h-8" />
            </div>
            <div class="flex-1">
              <div class="flex items-center justify-between mb-1">
                <h3 class="text-base font-bold text-white m-0">
                  Uranmine (Uranium Mine)
                </h3>
                <span
                  class="text-xs font-mono px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30"
                  >800 Gold</span
                >
              </div>
              <div
                class="grid grid-cols-2 gap-2 text-[11px] font-mono text-gray-300 bg-black/40 p-2 rounded mb-2"
              >
                <div>
                  Basis:
                  <span class="text-emerald-400 font-bold">0.6 U/Tick</span>
                  (6/s)
                </div>
                <div>
                  Hotspot:
                  <span class="text-amber-300 font-bold">1.8 U/Tick</span>
                  (18/s)
                </div>
                <div>
                  Ader-Größe:
                  <span class="text-cyan-300">10.000 Einheiten</span>
                </div>
                <div>
                  Min-Floor: <span class="text-white">15% (0.9/s)</span>
                </div>
              </div>
              <p class="text-xs text-gray-300 mb-1">
                Bedarf: Streng limitiertes Spaltmaterial für Atomwaffen und
                Radaranlagen.
              </p>
              <span class="text-[10px] text-gray-400 font-mono"
                >Baukosten-Formel: 800 × 1.15^(n-1) Gold</span
              >
            </div>
          </div>
        </div>
      </div>
    `;
  }

  private renderRefinerySection(): TemplateResult {
    return html`
      <div class="mb-10">
        <div class="flex items-center gap-3 mb-4">
          <img src=${steelMillIcon} class="w-6 h-6" />
          <h2 class="text-xl font-bold text-white m-0">
            Industrielle Veredelung & Exakte Rezepte (Tier 2)
          </h2>
        </div>
        <p class="text-sm text-gray-300 mb-6 leading-relaxed">
          Rohstoffe müssen in Veredelungsbetrieben weiterverarbeitet werden.
          Jedes gebaute Werk verarbeitet
          <strong>1 vollen Rezept-Zyklus pro Tick</strong> (bei 10 Ticks/s = 10
          Zyklen/Sekunde pro Anlage).
        </p>

        <!-- 3 Big Recipe Cards with Exact Formulas -->
        <div class="grid grid-cols-1 md:grid-cols-3 gap-5 mb-8">
          <!-- Steel Mill -->
          <div
            class="bg-gradient-to-b from-[#1b262c] to-[#12181b] rounded-xl border border-cyan-500/30 p-5 shadow-lg flex flex-col justify-between"
          >
            <div>
              <div class="flex items-center justify-between mb-3">
                <div class="flex items-center gap-2">
                  <img src=${steelMillIcon} class="w-7 h-7" />
                  <h3 class="text-base font-bold text-cyan-200 m-0">
                    Stahlwerk
                  </h3>
                </div>
                <span class="text-xs font-mono text-cyan-300">400 Gold</span>
              </div>
              <div
                class="bg-black/50 rounded-lg p-3 border border-cyan-500/20 mb-3 text-center"
              >
                <span
                  class="text-[11px] text-gray-400 uppercase tracking-wider block mb-1"
                  >Exaktes Schmelz-Rezept</span
                >
                <span class="text-sm font-bold text-white font-mono"
                  >3 Eisenerz + 2 Kohle ➔ 1 Stahl</span
                >
              </div>
              <div class="text-[11px] text-gray-300 space-y-1 mb-3">
                <div>
                  • Durchsatz:
                  <span class="text-cyan-300 font-bold"
                    >10 Stahl / Sekunde</span
                  >
                  pro Werk
                </div>
                <div>• Skalierung: 400 × 1.15^(n-1) Gold</div>
                <div>
                  • Benötigt für: Bunker (35), Radar (80), SAM (60), Silo (150),
                  Kriegsschiffe (40-150), Raketen (40-800).
                </div>
              </div>
            </div>
            <span
              class="text-[11px] text-cyan-400 font-semibold bg-cyan-950/40 px-2 py-1 rounded border border-cyan-800/40 text-center"
            >
              Unverzichtbar für Panzerung & Rümpfe
            </span>
          </div>

          <!-- Refinery -->
          <div
            class="bg-gradient-to-b from-[#2b2216] to-[#17130d] rounded-xl border border-orange-500/30 p-5 shadow-lg flex flex-col justify-between"
          >
            <div>
              <div class="flex items-center justify-between mb-3">
                <div class="flex items-center gap-2">
                  <img src=${refineryIcon} class="w-7 h-7" />
                  <h3 class="text-base font-bold text-orange-200 m-0">
                    Raffinerie
                  </h3>
                </div>
                <span class="text-xs font-mono text-orange-300">500 Gold</span>
              </div>
              <div
                class="bg-black/50 rounded-lg p-3 border border-orange-500/20 mb-3 text-center"
              >
                <span
                  class="text-[11px] text-gray-400 uppercase tracking-wider block mb-1"
                  >Exaktes Destillations-Rezept</span
                >
                <span class="text-sm font-bold text-white font-mono"
                  >3 Rohöl ➔ 1 Treibstoff (Fuel)</span
                >
              </div>
              <div class="text-[11px] text-gray-300 space-y-1 mb-3">
                <div>
                  • Durchsatz:
                  <span class="text-orange-300 font-bold"
                    >10 Fuel / Sekunde</span
                  >
                  pro Werk
                </div>
                <div>• Skalierung: 500 × 1.15^(n-1) Gold</div>
                <div>
                  • Benötigt für: Flotte (5-25 Fuel/s), SAM (20),
                  Marschflugkörper (120), Atomwaffen (150-500).
                </div>
              </div>
            </div>
            <span
              class="text-[11px] text-orange-400 font-semibold bg-orange-950/40 px-2 py-1 rounded border border-orange-800/40 text-center"
            >
              Lebenswichtig für Flotte & Raketenantriebe
            </span>
          </div>

          <!-- Centrifuge -->
          <div
            class="bg-gradient-to-b from-[#1c2918] to-[#10190d] rounded-xl border border-lime-500/30 p-5 shadow-lg flex flex-col justify-between"
          >
            <div>
              <div class="flex items-center justify-between mb-3">
                <div class="flex items-center gap-2">
                  <img src=${centrifugeIcon} class="w-7 h-7" />
                  <h3 class="text-base font-bold text-lime-200 m-0">
                    Uran-Zentrifuge
                  </h3>
                </div>
                <span class="text-xs font-mono text-lime-300">1.200 Gold</span>
              </div>
              <div
                class="bg-black/50 rounded-lg p-3 border border-lime-500/20 mb-3 text-center"
              >
                <span
                  class="text-[11px] text-gray-400 uppercase tracking-wider block mb-1"
                  >Exaktes Anreicherungs-Rezept</span
                >
                <span class="text-sm font-bold text-white font-mono"
                  >5 Uranerz + 3 Kohle ➔ 1 U_ref</span
                >
              </div>
              <div class="text-[11px] text-gray-300 space-y-1 mb-3">
                <div>
                  • Durchsatz:
                  <span class="text-lime-300 font-bold"
                    >10 U_ref / Sekunde</span
                  >
                  pro Werk
                </div>
                <div>• Skalierung: 1.200 × 1.15^(n-1) Gold</div>
                <div>
                  • Benötigt für: Radar (15), Atombombe (150), H-Bombe (400),
                  MIRV (1.000).
                </div>
              </div>
            </div>
            <span
              class="text-[11px] text-lime-400 font-semibold bg-lime-950/40 px-2 py-1 rounded border border-lime-800/40 text-center"
            >
              Spaltmaterial für strategische Abschreckung
            </span>
          </div>
        </div>

        <!-- Logistics & Plunder Box with Exact Numbers -->
        <div class="bg-black/25 rounded-xl border border-white/10 p-5">
          <h3
            class="text-sm font-bold text-white uppercase tracking-wider mb-3 m-0 flex items-center gap-2"
          >
            <span>🚚</span> Exakte Logistik- & Plünderungs-Parameter
          </h3>
          <div
            class="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs text-gray-300"
          >
            <div>
              <strong class="text-white block mb-1"
                >Entfernungsabhängige Latenz-Formel:</strong
              >
              <div class="font-mono text-cyan-300 bg-black/40 p-2 rounded mb-2">
                τ = min(40, ⌊d / 4⌋) Ticks (max. 4.0 Sekunden)
              </div>
              Konvois starten alle <strong>3 Ticks (0.3s)</strong> oder sobald
              mindestens <strong>8 Einheiten</strong> im Minenpuffer liegen. Bei
              40 Kacheln Distanz dauert der Transit exakt 1.0 Sekunde (10
              Ticks).
            </div>
            <div>
              <strong class="text-white block mb-1"
                >80.0% Beuteübernahme bei Eroberung:</strong
              >
              <div
                class="font-mono text-emerald-400 bg-black/40 p-2 rounded mb-2"
              >
                Eroberte Beute = 0.80 × Vorrat & Konvois (20% Verlust)
              </div>
              Nimmst du eine gegnerische Mine ein, plünderst du 80% ihrer
              Bestände vor Ort. Kapituliert die Nation vollständig, fließen 80%
              ihres gesamten Staatsschatzes direkt auf dein Konto!
            </div>
          </div>
        </div>
      </div>
    `;
  }

  private renderMilitarySection(): TemplateResult {
    return html`
      <div class="mb-10">
        <div class="flex items-center gap-3 mb-4">
          <img src=${warshipIcon} class="w-6 h-6" />
          <h2 class="text-xl font-bold text-white m-0">
            Marine, Flotten-Synergien & Treibstoff-Verbrauch
          </h2>
        </div>
        <p class="text-sm text-gray-300 mb-6 leading-relaxed">
          Flottenkontrolle erfordert eine abgestimmte Kombination aus Kampf-,
          Geleit- und Reparaturschiffen sowie eine stabile Treibstoffversorgung.
        </p>

        <div class="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <!-- Battleship -->
          <div
            class="bg-black/30 rounded-xl border border-white/10 p-5 flex flex-col justify-between"
          >
            <div>
              <div class="flex items-center justify-between mb-2">
                <div class="flex items-center gap-2">
                  <img src=${warshipIcon} class="w-7 h-7" />
                  <h3 class="text-base font-bold text-white m-0">
                    Kriegsschiff (Warship)
                  </h3>
                </div>
                <span class="text-xs font-mono text-cyan-300">500 Gold</span>
              </div>
              <div
                class="text-[11px] font-mono text-cyan-400 bg-cyan-950/30 p-2 rounded mb-3 space-y-0.5"
              >
                <div>Kosten: 40 Stahl, 50 Treibstoff</div>
                <div>
                  HP: <span class="text-white font-bold">100 HP</span> |
                  Schaden: <span class="text-white font-bold">25 Basis</span>
                </div>
                <div>
                  Verbrauch:
                  <span class="text-orange-400 font-bold"
                    >0.4 Fuel/Tick (4.0 Fuel/s)</span
                  >
                </div>
              </div>
              <p class="text-xs text-gray-300 leading-relaxed mb-3">
                Schweres Kampfschiff für Seeschlachten und Küstenbombardement.
                Hohe Rumpfstärke und verheerende Breitseiten.
              </p>
            </div>
            <div
              class="text-[11px] text-gray-400 border-t border-white/10 pt-2 font-mono"
            >
              Basis-Rückgrat jeder Hochseeflotte.
            </div>
          </div>

          <!-- Destroyer -->
          <div
            class="bg-black/30 rounded-xl border border-white/10 p-5 flex flex-col justify-between"
          >
            <div>
              <div class="flex items-center justify-between mb-2">
                <div class="flex items-center gap-2">
                  <img src=${destroyerIcon} class="w-7 h-7" />
                  <h3 class="text-base font-bold text-amber-300 m-0">
                    Zerstörer (Destroyer)
                  </h3>
                </div>
                <span class="text-xs font-mono text-cyan-300">600 Gold</span>
              </div>
              <div
                class="text-[11px] font-mono text-amber-400 bg-amber-950/30 p-2 rounded mb-3 space-y-0.5"
              >
                <div>Kosten: 50 Stahl, 150 Treibstoff</div>
                <div>
                  HP: <span class="text-white font-bold">70 HP</span> |
                  Verbrauch:
                  <span class="text-orange-400 font-bold"
                    >1.2 Fuel/Tick (12.0/s)</span
                  >
                </div>
                <div>
                  Aura:
                  <span class="text-amber-300 font-bold"
                    >+10.0% Schaden (Radius: 15)</span
                  >
                </div>
                <div>
                  Cap:
                  <span class="text-white font-bold"
                    >Max. +30.0% (3 Zerstörer)</span
                  >
                </div>
              </div>
              <p class="text-xs text-gray-300 leading-relaxed mb-3">
                Schnelles Begleitschiff. Bufft den Schaden aller befreundeten
                Kriegsschiffe im 15-Kachel-Umkreis um
                <strong>+10.0% pro Zerstörer</strong> (max. 30%).
              </p>
            </div>
            <div
              class="text-[11px] text-amber-400 border-t border-white/10 pt-2 font-bold font-mono"
            >
              3 Zerstörer = +30.0% Flotten-Schadensbuff!
            </div>
          </div>

          <!-- Repair Ship -->
          <div
            class="bg-black/30 rounded-xl border border-white/10 p-5 flex flex-col justify-between"
          >
            <div>
              <div class="flex items-center justify-between mb-2">
                <div class="flex items-center gap-2">
                  <img src=${repairShipIcon} class="w-7 h-7" />
                  <h3 class="text-base font-bold text-green-300 m-0">
                    Reparaturschiff (Repair)
                  </h3>
                </div>
                <span class="text-xs font-mono text-cyan-300">500 Gold</span>
              </div>
              <div
                class="text-[11px] font-mono text-green-400 bg-green-950/30 p-2 rounded mb-3 space-y-0.5"
              >
                <div>Kosten: 80 Stahl, 120 Treibstoff</div>
                <div>
                  HP: <span class="text-white font-bold">50 HP</span> |
                  Verbrauch:
                  <span class="text-orange-400 font-bold"
                    >0.5 Fuel/Tick (5.0/s)</span
                  >
                </div>
                <div>
                  Heilung:
                  <span class="text-green-300 font-bold"
                    >+5 HP alle 10 Ticks (1s)</span
                  >
                </div>
                <div>
                  Radius: <span class="text-white font-bold">10 Kacheln</span> |
                  Selbstheilung:
                  <span class="text-red-400 font-bold">Nein</span>
                </div>
              </div>
              <p class="text-xs text-gray-300 leading-relaxed mb-3">
                Ziviles Logistikschiff (ersetzt U-Boote). Heilt nahe
                Kriegsschiffe und Zerstörer kontinuierlich. Kann sich selbst
                nicht heilen!
              </p>
            </div>
            <div
              class="text-[11px] text-green-400 border-t border-white/10 pt-2 font-bold font-mono"
            >
              Unverzichtbar für Langzeit-Seeblockaden!
            </div>
          </div>
        </div>

        <!-- Fuel Starvation Warning with Exact Formulas -->
        <div
          class="bg-red-950/30 border border-red-500/40 rounded-xl p-4 flex items-start gap-3"
        >
          <span class="text-red-400 text-xl font-bold">⚠️</span>
          <div class="text-xs text-gray-200 flex-1">
            <strong class="text-red-300 block mb-1"
              >Exakte Treibstoff-Mangelschaden Parameter (Fuel
              Starvation):</strong
            >
            Sinkt der Treibstoffvorrat auf <strong>≤ 0.05 Fuel</strong>,
            erleidet die gesamte Flotte:
            <div
              class="grid grid-cols-1 sm:grid-cols-3 gap-2 font-mono text-[11px] text-red-200 mt-2 bg-black/40 p-2 rounded border border-red-500/30"
            >
              <div>• Tempo-Malus: <strong>-80.0%</strong> (0.2x Speed)</div>
              <div>• Kampf-Malus: <strong>-50.0%</strong> (0.5x Dmg)</div>
              <div>
                • Rumpf-Verschleiß: <strong>-10 HP / Sekunde</strong> (1 HP
                Floor!)
              </div>
            </div>
            <div class="text-[11px] text-red-300 mt-2 italic">
              * Schiffe können durch reinen Kraftstoffmangel nicht unter 1 HP
              sinken, bleiben jedoch extrem verwundbar.
            </div>
          </div>
        </div>
      </div>
    `;
  }

  private renderNukesSection(): TemplateResult {
    return html`
      <div class="mb-10">
        <div class="flex items-center gap-3 mb-4">
          <img src=${mirvIcon} class="w-6 h-6" />
          <h2 class="text-xl font-bold text-white m-0">
            Marschflugkörper & Strategisches Nuklear-Arsenal
          </h2>
        </div>
        <p class="text-sm text-gray-300 mb-6 leading-relaxed">
          Exakte Baukosten, Sprengradien, Fluggeschwindigkeiten und
          Strahlungszeiten für chirurgische Schläge und strategische
          Massenvernichtungswaffen.
        </p>

        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
          <!-- Cruise Missile -->
          <div
            class="bg-black/30 rounded-xl border border-cyan-500/30 p-5 flex gap-4"
          >
            <div
              class="p-3 rounded-lg bg-cyan-950/40 border border-cyan-500/40 shrink-0 self-start"
            >
              <img src=${cruiseMissileIcon} class="w-8 h-8" />
            </div>
            <div class="flex-1">
              <div class="flex items-center justify-between mb-1">
                <h3 class="text-base font-bold text-cyan-200 m-0">
                  Marschflugkörper (Cruise Missile)
                </h3>
                <span class="text-xs font-mono text-cyan-300">600 Gold</span>
              </div>
              <div
                class="text-[11px] font-mono text-cyan-300 bg-black/40 p-2 rounded mb-2 space-y-0.5"
              >
                <div>Kosten: <strong>40 Stahl, 120 Fuel, 0 Uran!</strong></div>
                <div>
                  Detonations-Radius:
                  <span class="text-white font-bold">3 Kacheln</span>
                </div>
                <div>
                  Flugtempo:
                  <span class="text-white font-bold">4.0 Kacheln / Tick</span>
                  (ballistische Kurve)
                </div>
                <div>
                  Fallout:
                  <span class="text-emerald-400 font-bold">0 Sekunden</span>
                  (keine Verstrahlung)
                </div>
              </div>
              <p class="text-xs text-gray-300 m-0">
                Chirurgischer Nadelstich gegen gegnerische Minen, Fabriken und
                Schiffe. Kostengünstig und ohne nukleares Spaltmaterial
                einsetzbar.
              </p>
            </div>
          </div>

          <!-- Atom Bomb -->
          <div
            class="bg-black/30 rounded-xl border border-lime-500/30 p-5 flex gap-4"
          >
            <div
              class="p-3 rounded-lg bg-lime-950/40 border border-lime-500/40 shrink-0 self-start"
            >
              <img src=${atomBombIcon} class="w-8 h-8" />
            </div>
            <div class="flex-1">
              <div class="flex items-center justify-between mb-1">
                <h3 class="text-base font-bold text-lime-200 m-0">
                  Atombombe (Nuclear Bomb)
                </h3>
                <span class="text-xs font-mono text-lime-300">5.000 Gold</span>
              </div>
              <div
                class="text-[11px] font-mono text-lime-300 bg-black/40 p-2 rounded mb-2 space-y-0.5"
              >
                <div>
                  Kosten: <strong>200 Stahl, 150 Fuel, 150 U_ref</strong>
                </div>
                <div>
                  Detonations-Radius:
                  <span class="text-white font-bold">6 Kacheln</span>
                </div>
                <div>
                  Fallout-Dauer:
                  <span class="text-amber-300 font-bold">30 Sekunden</span>
                </div>
              </div>
              <p class="text-xs text-gray-300 m-0">
                Klassische strategische Kernwaffe. Zerstört mittlere Provinzen
                und hinterlässt radioaktive Verstrahlung.
              </p>
            </div>
          </div>

          <!-- Hydrogen Bomb -->
          <div
            class="bg-black/30 rounded-xl border border-amber-500/30 p-5 flex gap-4"
          >
            <div
              class="p-3 rounded-lg bg-amber-950/40 border border-amber-500/40 shrink-0 self-start"
            >
              <img src=${hydrogenBombIcon} class="w-8 h-8" />
            </div>
            <div class="flex-1">
              <div class="flex items-center justify-between mb-1">
                <h3 class="text-base font-bold text-amber-200 m-0">
                  Wasserstoffbombe (H-Bomb)
                </h3>
                <span class="text-xs font-mono text-amber-300"
                  >10.000 Gold</span
                >
              </div>
              <div
                class="text-[11px] font-mono text-amber-300 bg-black/40 p-2 rounded mb-2 space-y-0.5"
              >
                <div>
                  Kosten: <strong>400 Stahl, 300 Fuel, 400 U_ref</strong>
                </div>
                <div>
                  Detonations-Radius:
                  <span class="text-white font-bold">10 Kacheln</span>
                </div>
                <div>
                  Fallout-Dauer:
                  <span class="text-amber-300 font-bold">60 Sekunden</span>
                </div>
              </div>
              <p class="text-xs text-gray-300 m-0">
                Thermonukleare Flächenvernichtungswaffe. Erzeugt verheerende
                Schockwellen und langanhaltende Verseuchung.
              </p>
            </div>
          </div>

          <!-- MIRV -->
          <div
            class="bg-black/30 rounded-xl border border-red-500/30 p-5 flex gap-4"
          >
            <div
              class="p-3 rounded-lg bg-red-950/40 border border-red-500/40 shrink-0 self-start"
            >
              <img src=${mirvIcon} class="w-8 h-8" />
            </div>
            <div class="flex-1">
              <div class="flex items-center justify-between mb-1">
                <h3 class="text-base font-bold text-red-200 m-0">
                  MIRV Interkontinentalrakete
                </h3>
                <span class="text-xs font-mono text-red-300">20.000 Gold</span>
              </div>
              <div
                class="text-[11px] font-mono text-red-300 bg-black/40 p-2 rounded mb-2 space-y-0.5"
              >
                <div>
                  Kosten: <strong>800 Stahl, 500 Fuel, 1.000 U_ref</strong>
                </div>
                <div>
                  Sprengköpfe:
                  <span class="text-white font-bold"
                    >8 bis 10 autonome Gefechtsköpfe</span
                  >
                </div>
                <div>
                  Gesamtabdeckung:
                  <span class="text-white font-bold">16 bis 20 Kacheln</span>
                </div>
                <div>
                  Fallout-Dauer:
                  <span class="text-amber-300 font-bold">90 Sekunden</span>
                </div>
              </div>
              <p class="text-xs text-gray-300 m-0">
                Die ultimative Weltuntergangswaffe. Teilt sich im Zielanflug in
                multiple autonome Sprengköpfe auf und überwindet selbst
                konzentrierte Abwehrgürtel.
              </p>
            </div>
          </div>
        </div>
      </div>
    `;
  }

  private renderDefenseSection(): TemplateResult {
    return html`
      <div class="mb-10">
        <div class="flex items-center gap-3 mb-4">
          <img src=${radarIcon} class="w-6 h-6" />
          <h2 class="text-xl font-bold text-white m-0">
            Verteidigung, Stahlbunker & Flugabwehr
          </h2>
        </div>
        <p class="text-sm text-gray-300 mb-6 leading-relaxed">
          Exakte Verteidigungsboni, bombensichere Festungen, Sensorradien und
          Flugabwehr-Spezifikationen zur lückenlosen Absicherung deines
          Territoriums.
        </p>

        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <!-- Defense Post -->
          <div
            class="bg-black/30 rounded-xl border border-yellow-500/30 p-5 flex flex-col justify-between"
          >
            <div>
              <div class="flex items-center justify-between mb-2">
                <div class="flex items-center gap-2">
                  <img src=${defensePostIcon} class="w-7 h-7" />
                  <h3 class="text-base font-bold text-yellow-300 m-0">
                    Verteidigungsposten
                  </h3>
                </div>
                <span class="text-xs font-mono text-amber-300">100 Gold</span>
              </div>
              <div
                class="text-[11px] font-mono text-yellow-300 bg-black/40 p-2 rounded mb-2 space-y-0.5"
              >
                <div>
                  Verteidigung:
                  <span class="text-white font-bold">5.0x Multiplikator</span>
                </div>
                <div>
                  Angriffs-Bremse:
                  <span class="text-white font-bold">3.0x Verlangsamung</span>
                </div>
                <div>Wirkung: Umkreis-Radius an Grenzen</div>
              </div>
              <p class="text-xs text-gray-300 leading-relaxed mb-3">
                Das effektivste Bollwerk gegen Übermacht- und
                Zermürbungsangriffe. Erhöht die Standhaftigkeit eigener Truppen
                drastisch und bremst anrückende Feinde massiv aus.
              </p>
            </div>
            <span
              class="text-[11px] text-yellow-300 font-bold border-t border-white/10 pt-2 font-mono"
            >
              5.0x Def + 3.0x Angriffsbremse
            </span>
          </div>

          <!-- Stahlbunker -->
          <div
            class="bg-black/30 rounded-xl border border-cyan-500/30 p-5 flex flex-col justify-between"
          >
            <div>
              <div class="flex items-center justify-between mb-2">
                <div class="flex items-center gap-2">
                  <img src=${bunkerIcon} class="w-7 h-7" />
                  <h3 class="text-base font-bold text-cyan-200 m-0">
                    Stahlbunker
                  </h3>
                </div>
                <span class="text-xs font-mono text-amber-300">500 Gold</span>
              </div>
              <div
                class="text-[11px] font-mono text-cyan-300 bg-black/40 p-2 rounded mb-2 space-y-0.5"
              >
                <div>Kosten: 100 × 1.6^n Stahl (steigend)</div>
                <div>
                  Nuke-Status:
                  <span class="text-emerald-400 font-bold"
                    >100% UNZERSTÖRBAR</span
                  >
                </div>
                <div>
                  Lanchester-Def:
                  <span class="text-white font-bold">+80.0% (1.8x)</span>
                </div>
              </div>
              <p class="text-xs text-gray-300 leading-relaxed mb-3">
                Extrem robuste Schutzresidenz. Weder Atombomben,
                Wasserstoffbomben noch MIRV-Schläge können den Stahlbunker oder
                seine Kachel vernichten!
              </p>
            </div>
            <span
              class="text-[11px] text-cyan-300 font-bold border-t border-white/10 pt-2 font-mono"
            >
              Nuklear-Immun + 1.8x Def
            </span>
          </div>

          <!-- Radar -->
          <div
            class="bg-black/30 rounded-xl border border-white/10 p-5 flex flex-col justify-between"
          >
            <div>
              <div class="flex items-center justify-between mb-2">
                <div class="flex items-center gap-2">
                  <img src=${radarIcon} class="w-7 h-7" />
                  <h3 class="text-base font-bold text-cyan-200 m-0">
                    Radarstation
                  </h3>
                </div>
                <span class="text-xs font-mono text-amber-300">1.000 Gold</span>
              </div>
              <div
                class="text-[11px] font-mono text-cyan-300 bg-black/40 p-2 rounded mb-2 space-y-0.5"
              >
                <div>Kosten: 80 Stahl, 15 Spaltmaterial (U_ref)</div>
                <div>
                  Sichtradius:
                  <span class="text-white font-bold">30 Kacheln</span>
                </div>
                <div>
                  SAM-Kopplung:
                  <span class="text-emerald-400 font-bold"
                    >+50.0% Reichweite (12 ➔ 18)</span
                  >
                </div>
              </div>
              <p class="text-xs text-gray-300 leading-relaxed mb-3">
                Lüftet den Kriegsnebel im 30-Kachel-Umfeld und koppelt sich mit
                allen nahen SAM-Stellungen für erweiterte Abfangdistanz.
              </p>
            </div>
            <span
              class="text-[11px] text-cyan-300 font-bold border-t border-white/10 pt-2 font-mono"
            >
              Sensor-Radius 30 + SAM-Reichweitenbuff
            </span>
          </div>

          <!-- SAM Launcher -->
          <div
            class="bg-black/30 rounded-xl border border-white/10 p-5 flex flex-col justify-between"
          >
            <div>
              <div class="flex items-center justify-between mb-2">
                <div class="flex items-center gap-2">
                  <img src=${samLauncherIcon} class="w-7 h-7" />
                  <h3 class="text-base font-bold text-lime-200 m-0">
                    SAM Flugabwehr
                  </h3>
                </div>
                <span class="text-xs font-mono text-amber-300">800 Gold</span>
              </div>
              <div
                class="text-[11px] font-mono text-lime-300 bg-black/40 p-2 rounded mb-2 space-y-0.5"
              >
                <div>Kosten: 60 Stahl, 20 Treibstoff</div>
                <div>
                  Basis-Radius:
                  <span class="text-white font-bold">12 Kacheln</span> (mit
                  Radar: 18)
                </div>
                <div>
                  Magazin: <span class="text-white font-bold">4 Raketen</span> |
                  Nachladen: 10 Ticks (1s)
                </div>
                <div>Nachlade-Kosten: 100 Gold, 10 Stahl, 10 Fuel</div>
              </div>
              <p class="text-xs text-gray-300 leading-relaxed mb-3">
                Fängt feindliche Marschflugkörper, Atombomben und Raketen im
                Flug ab. Lädt automatisch nach, solange Ressourcen da sind.
              </p>
            </div>
            <span
              class="text-[11px] text-lime-300 font-bold border-t border-white/10 pt-2 font-mono"
            >
              Autonomes Raketen-Abwehrsystem
            </span>
          </div>
        </div>
      </div>
    `;
  }

  private renderAlliancesSection(): TemplateResult {
    return html`
      <div class="mb-10">
        <div class="flex items-center gap-3 mb-4">
          <img src=${allianceIcon} class="w-6 h-6" />
          <h2 class="text-xl font-bold text-white m-0">
            Mehr-Nationen-Allianzen ("Kleine Länder Bündnis")
          </h2>
        </div>
        <p class="text-sm text-gray-300 mb-6 leading-relaxed">
          Das Allianzen-System von InduFront ermöglicht es mehreren kleineren
          und mittleren Staaten, sich zu schlagkräftigen Bündnissen
          zusammenzuschließen, um sich gemeinsam gegen expandierende Großmächte
          zu behaupten.
        </p>

        <div class="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <!-- Bündnis-Gründung & Menü -->
          <div class="bg-black/30 rounded-xl border border-purple-500/30 p-5">
            <h3
              class="text-base font-bold text-purple-300 mb-2 m-0 flex items-center gap-2"
            >
              <span>🤝</span> Bündnisgründung & Menü
            </h3>
            <p class="text-xs text-gray-300 leading-relaxed mb-2">
              Über das Allianzen-Menü im HUD kannst du Einladungen an
              befreundete Nationen verschicken oder offenen Bündnissen
              beitreten.
            </p>
            <ul class="text-xs text-gray-300 space-y-1 ps-4 m-0">
              <li>Kein Friendly Fire zwischen Bündnismitgliedern</li>
              <li>Freie Truppendurchquerung durch verbündetes Gebiet</li>
              <li>Gemeinsame Kriegskoordination an Frontlinien</li>
            </ul>
          </div>

          <!-- Anti-Großmächte-Schutz -->
          <div class="bg-black/30 rounded-xl border border-red-500/30 p-5">
            <h3
              class="text-base font-bold text-red-300 mb-2 m-0 flex items-center gap-2"
            >
              <span>🛡️</span> Anti-Großmächte-Schutz
            </h3>
            <p class="text-xs text-gray-300 leading-relaxed mb-2">
              Um zu verhindern, dass die mächtigsten Spieler den Server
              monopolisieren, greift die
              <strong>Top-10-Ausschlussregel</strong>:
            </p>
            <ul class="text-xs text-gray-300 space-y-1 ps-4 m-0">
              <li>
                <strong>Top 10 Ausschluss:</strong> Spieler in den globalen Top
                10 können Allianzen weder gründen noch beitreten.
              </li>
              <li>
                <strong>Automatischer Austritt:</strong> Wächst ein
                Bündnismitglied in die Top 10 hinein, verlässt es die Allianz
                automatisch!
              </li>
              <li>Garantierter Schutz für aufstrebende Staaten.</li>
            </ul>
          </div>

          <!-- P2P Handel & Bot-Hilfe -->
          <div class="bg-black/30 rounded-xl border border-emerald-500/30 p-5">
            <h3
              class="text-base font-bold text-emerald-300 mb-2 m-0 flex items-center gap-2"
            >
              <span>📦</span> P2P-Hilfe & Bot-Logistik
            </h3>
            <p class="text-xs text-gray-300 leading-relaxed mb-2">
              Bündnispartner können sich im Ernstfall mit kriegswichtigen Gütern
              versorgen:
            </p>
            <ul class="text-xs text-gray-300 space-y-1 ps-4 m-0">
              <li>
                <strong>P2P-Rohstoffspenden:</strong> Sende Panzerstahl,
                Treibstoff oder Gold direkt an bedrängte Verbündete.
              </li>
              <li>
                <strong>Intelligente Bot-Lieferungen:</strong> Verbündete Bots
                erkennen Treibstoff- und Stahlengpässe und senden eigenständig
                Hilfskonvois!
              </li>
              <li>
                <strong>Verräter-Schutz:</strong> Das Brechen einer Allianz
                bestraft den Verräter mit 30 Sekunden Verteidigungsdebuff.
              </li>
            </ul>
          </div>
        </div>
      </div>
    `;
  }

  private renderRankedSection(): TemplateResult {
    return html`
      <div class="mb-10">
        <div class="flex items-center gap-3 mb-4">
          <span class="text-2xl">🏆</span>
          <h2 class="text-xl font-bold text-white m-0">
            Ranked-Modus, Elo-System & Stahl-Belohnungen
          </h2>
        </div>
        <p class="text-sm text-gray-300 mb-6 leading-relaxed">
          Stelle dein Können im wettkampforientierten Ranked-Modus unter Beweis,
          steige durch 7 dynamische Elo-Divisionen auf und verdiene Stahl für
          den Kosmetik-Shop.
        </p>

        <!-- Ranked Highlights Grid -->
        <div class="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
          <!-- Elo Engine -->
          <div class="bg-black/30 rounded-xl border border-amber-500/30 p-5">
            <h3
              class="text-base font-bold text-amber-300 mb-2 m-0 flex items-center gap-2"
            >
              <span>⚡</span> WebSocket-Matchmaking & Elo-Engine
            </h3>
            <p class="text-xs text-gray-300 leading-relaxed mb-2">
              Schnelles, laggfreies Ranglisten-Matchmaking über dedizierte
              Server mit mathematisch fundiertem Elo-System:
            </p>
            <ul class="text-xs text-gray-300 space-y-1 ps-4 m-0">
              <li>
                <strong>1v1 Duelle:</strong> Reines Nullsummen-Kräftemessen auf
                Augenhöhe.
              </li>
              <li>
                <strong>2v2 Teams:</strong> Taktische Kooperation mit
                aggregiertem Team-Rating.
              </li>
              <li>
                <strong>FFA Rangliste:</strong> Pairwise Round-Robin-Auswertung
                aller Platzierungen.
              </li>
              <li>
                <strong>Dynamische K-Faktoren:</strong> K=40 für Einsteiger,
                K=16 für Spitzen-Veteranen (>2000 Elo).
              </li>
            </ul>
          </div>

          <!-- Steel Shop Rewards -->
          <div class="bg-black/30 rounded-xl border border-cyan-500/30 p-5">
            <h3
              class="text-base font-bold text-cyan-300 mb-2 m-0 flex items-center gap-2"
            >
              <span>⚙️</span> Stahl-Währung & Kosmetik-Shop
            </h3>
            <p class="text-xs text-gray-300 leading-relaxed mb-2">
              Jedes abgeschlossene Spiel belohnt deine taktische Leistung mit
              permanenter <strong>Stahl-Währung (⚙️)</strong>:
            </p>
            <div
              class="grid grid-cols-3 gap-2 text-center text-xs font-mono mb-3"
            >
              <div
                class="bg-amber-500/10 border border-amber-500/30 p-2 rounded"
              >
                <div class="text-amber-300 font-bold">🥇 1. Platz</div>
                <div class="text-white font-extrabold text-sm">1.000 ⚙️</div>
              </div>
              <div
                class="bg-slate-400/10 border border-slate-400/30 p-2 rounded"
              >
                <div class="text-slate-300 font-bold">🥈 2. Platz</div>
                <div class="text-white font-extrabold text-sm">750 ⚙️</div>
              </div>
              <div
                class="bg-amber-700/10 border border-amber-700/30 p-2 rounded"
              >
                <div class="text-amber-500 font-bold">🥉 3. Platz</div>
                <div class="text-white font-extrabold text-sm">500 ⚙️</div>
              </div>
            </div>
            <p class="text-[11px] text-gray-400 m-0">
              Im Stahl-Shop schaltest du exklusive Spielertitel, Profil-Badges,
              Einheiten-Skins und Soundeffekte frei – 100% ohne Echtgeld-Zwang!
            </p>
          </div>
        </div>

        <!-- 7 Tiers Table -->
        <div
          class="overflow-x-auto rounded-xl border border-white/10 bg-black/40 p-4"
        >
          <h4
            class="text-xs font-bold text-gray-300 uppercase tracking-wider mb-3 m-0"
          >
            Die 7 Rangstufen & Divisionen
          </h4>
          <div
            class="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-7 gap-2 text-center text-xs"
          >
            <div
              class="p-2.5 rounded bg-amber-950/30 border border-amber-800/40"
            >
              <div class="font-bold text-amber-500">Bronze</div>
              <div class="text-[10px] text-gray-400">0 - 799</div>
              <div class="text-[10px] text-amber-300/80 mt-1">Div. I - III</div>
            </div>
            <div
              class="p-2.5 rounded bg-slate-800/40 border border-slate-600/40"
            >
              <div class="font-bold text-slate-300">Silber</div>
              <div class="text-[10px] text-gray-400">800 - 1.199</div>
              <div class="text-[10px] text-slate-300/80 mt-1">Div. I - III</div>
            </div>
            <div
              class="p-2.5 rounded bg-yellow-950/30 border border-yellow-600/40"
            >
              <div class="font-bold text-yellow-400">Gold</div>
              <div class="text-[10px] text-gray-400">1.200 - 1.599</div>
              <div class="text-[10px] text-yellow-300/80 mt-1">
                Div. I - III
              </div>
            </div>
            <div class="p-2.5 rounded bg-cyan-950/30 border border-cyan-600/40">
              <div class="font-bold text-cyan-300">Platin</div>
              <div class="text-[10px] text-gray-400">1.600 - 1.999</div>
              <div class="text-[10px] text-cyan-200/80 mt-1">Div. I - III</div>
            </div>
            <div class="p-2.5 rounded bg-blue-950/30 border border-blue-500/40">
              <div class="font-bold text-blue-300">Diamant</div>
              <div class="text-[10px] text-gray-400">2.000 - 2.399</div>
              <div class="text-[10px] text-blue-200/80 mt-1">Div. I - III</div>
            </div>
            <div
              class="p-2.5 rounded bg-purple-950/30 border border-purple-500/40"
            >
              <div class="font-bold text-purple-300">Meister</div>
              <div class="text-[10px] text-gray-400">2.400 - 2.799</div>
              <div class="text-[10px] text-purple-200/80 mt-1">Elite</div>
            </div>
            <div class="p-2.5 rounded bg-rose-950/30 border border-rose-500/40">
              <div class="font-bold text-rose-300">Großmeister</div>
              <div class="text-[10px] text-gray-400">2.800+</div>
              <div class="text-[10px] text-rose-200/80 mt-1">Legende</div>
            </div>
          </div>
        </div>
      </div>
    `;
  }

  private renderStatsSection(): TemplateResult {
    return html`
      <div class="mb-10">
        <div class="flex items-center gap-3 mb-4">
          <span class="text-2xl">📊</span>
          <h2 class="text-xl font-bold text-white m-0">
            Exakte Statistik- & Baukosten-Tabelle
          </h2>
        </div>
        <p class="text-sm text-gray-300 mb-6 leading-relaxed">
          Vollständige Übersicht aller Gebäude, Industrieanlagen und Einheiten
          mit ihren exakten Kosten, Durchsätzen und Kampfwerten. Baukosten
          steigen mit dem Formelfaktor
          <strong>Cost(n) = BaseCost × 1.15^(n-1)</strong>.
        </p>

        <div
          class="overflow-x-auto rounded-xl border border-white/10 bg-black/30"
        >
          <table class="w-full text-xs text-start border-collapse">
            <thead>
              <tr
                class="bg-white/10 text-gray-300 uppercase tracking-wider text-[11px]"
              >
                <th class="p-3 ps-4">Einheit / Bauwerk</th>
                <th class="p-3">Kategorie</th>
                <th class="p-3">Basis-Gold</th>
                <th class="p-3">Stahl</th>
                <th class="p-3">Fuel</th>
                <th class="p-3">U_ref</th>
                <th class="p-3 pe-4">Exakte Spezifikationen & Raten</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-white/5 text-gray-300">
              <!-- Tier 1 Mines -->
              <tr class="hover:bg-white/5">
                <td
                  class="p-3 ps-4 flex items-center gap-2 font-bold text-white"
                >
                  <img src=${ironMineIcon} class="w-5 h-5" /> Eisenmine
                </td>
                <td class="p-3 text-cyan-400">Mine (Tier 1)</td>
                <td class="p-3 font-mono text-amber-300">200</td>
                <td class="p-3 font-mono">-</td>
                <td class="p-3 font-mono">-</td>
                <td class="p-3 font-mono">-</td>
                <td class="p-3 pe-4">
                  2.5 Fe/Tick (25/s), Hotspot: 7.5/Tick (75/s), 50k Reserve, 15%
                  Min-Floor
                </td>
              </tr>
              <tr class="hover:bg-white/5">
                <td
                  class="p-3 ps-4 flex items-center gap-2 font-bold text-white"
                >
                  <img src=${coalMineIcon} class="w-5 h-5" /> Kohlemine
                </td>
                <td class="p-3 text-cyan-400">Mine (Tier 1)</td>
                <td class="p-3 font-mono text-amber-300">150</td>
                <td class="p-3 font-mono">-</td>
                <td class="p-3 font-mono">-</td>
                <td class="p-3 font-mono">-</td>
                <td class="p-3 pe-4">
                  2.5 C/Tick (25/s), Hotspot: 7.5/Tick (75/s), 40k Reserve, 15%
                  Min-Floor
                </td>
              </tr>
              <tr class="hover:bg-white/5">
                <td
                  class="p-3 ps-4 flex items-center gap-2 font-bold text-white"
                >
                  <img src=${oilRigIcon} class="w-5 h-5" /> Bohrturm
                </td>
                <td class="p-3 text-cyan-400">Mine (Tier 1)</td>
                <td class="p-3 font-mono text-amber-300">350</td>
                <td class="p-3 font-mono">-</td>
                <td class="p-3 font-mono">-</td>
                <td class="p-3 font-mono">-</td>
                <td class="p-3 pe-4">
                  2.2 Öl/Tick (22/s), Hotspot: 6.6/Tick (66/s), 30k Reserve, 15%
                  Min-Floor
                </td>
              </tr>
              <tr class="hover:bg-white/5">
                <td
                  class="p-3 ps-4 flex items-center gap-2 font-bold text-white"
                >
                  <img src=${uraniumMineIcon} class="w-5 h-5" /> Uranmine
                </td>
                <td class="p-3 text-cyan-400">Mine (Tier 1)</td>
                <td class="p-3 font-mono text-amber-300">800</td>
                <td class="p-3 font-mono">-</td>
                <td class="p-3 font-mono">-</td>
                <td class="p-3 font-mono">-</td>
                <td class="p-3 pe-4">
                  0.6 U/Tick (6/s), Hotspot: 1.8/Tick (18/s), 10k Reserve, 15%
                  Min-Floor
                </td>
              </tr>

              <!-- Tier 2 Processing -->
              <tr class="hover:bg-white/5">
                <td
                  class="p-3 ps-4 flex items-center gap-2 font-bold text-white"
                >
                  <img src=${steelMillIcon} class="w-5 h-5" /> Stahlwerk
                </td>
                <td class="p-3 text-emerald-400">Veredelung (Tier 2)</td>
                <td class="p-3 font-mono text-amber-300">400</td>
                <td class="p-3 font-mono">-</td>
                <td class="p-3 font-mono">-</td>
                <td class="p-3 font-mono">-</td>
                <td class="p-3 pe-4">
                  Rezept: 3 Fe + 2 C ➔ 1 Stahl | Durchsatz: 10 Stahl/s pro Werk
                </td>
              </tr>
              <tr class="hover:bg-white/5">
                <td
                  class="p-3 ps-4 flex items-center gap-2 font-bold text-white"
                >
                  <img src=${refineryIcon} class="w-5 h-5" /> Raffinerie
                </td>
                <td class="p-3 text-emerald-400">Veredelung (Tier 2)</td>
                <td class="p-3 font-mono text-amber-300">500</td>
                <td class="p-3 font-mono">-</td>
                <td class="p-3 font-mono">-</td>
                <td class="p-3 font-mono">-</td>
                <td class="p-3 pe-4">
                  Rezept: 3 Rohöl ➔ 1 Fuel | Durchsatz: 10 Fuel/s pro Werk
                </td>
              </tr>
              <tr class="hover:bg-white/5">
                <td
                  class="p-3 ps-4 flex items-center gap-2 font-bold text-white"
                >
                  <img src=${centrifugeIcon} class="w-5 h-5" /> Zentrifuge
                </td>
                <td class="p-3 text-emerald-400">Veredelung (Tier 2)</td>
                <td class="p-3 font-mono text-amber-300">1.200</td>
                <td class="p-3 font-mono">-</td>
                <td class="p-3 font-mono">-</td>
                <td class="p-3 font-mono">-</td>
                <td class="p-3 pe-4">
                  Rezept: 5 U + 3 C ➔ 1 U_ref | Durchsatz: 10 U_ref/s pro Werk
                </td>
              </tr>

              <!-- Military Fleet -->
              <tr class="hover:bg-white/5">
                <td
                  class="p-3 ps-4 flex items-center gap-2 font-bold text-white"
                >
                  <img src=${warshipIcon} class="w-5 h-5" /> Kriegsschiff
                </td>
                <td class="p-3 text-blue-400">Marine (Flotte)</td>
                <td class="p-3 font-mono text-amber-300">500</td>
                <td class="p-3 font-mono text-cyan-300">40</td>
                <td class="p-3 font-mono text-orange-300">50</td>
                <td class="p-3 font-mono">-</td>
                <td class="p-3 pe-4">
                  HP: 100, Dmg: 25, Verbrauch: 0.4 Fuel/Tick (4.0/s)
                </td>
              </tr>
              <tr class="hover:bg-white/5">
                <td
                  class="p-3 ps-4 flex items-center gap-2 font-bold text-white"
                >
                  <img src=${destroyerIcon} class="w-5 h-5" /> Zerstörer
                </td>
                <td class="p-3 text-blue-400">Marine (Flotte)</td>
                <td class="p-3 font-mono text-amber-300">600</td>
                <td class="p-3 font-mono text-cyan-300">50</td>
                <td class="p-3 font-mono text-orange-300">150</td>
                <td class="p-3 font-mono">-</td>
                <td class="p-3 pe-4">
                  HP: 70, Verbrauch: 1.2 Fuel/Tick (12.0/s),
                  <strong>+10.0% Dmg-Aura</strong> (max. +30%, Radius 15)
                </td>
              </tr>
              <tr class="hover:bg-white/5">
                <td
                  class="p-3 ps-4 flex items-center gap-2 font-bold text-white"
                >
                  <img src=${repairShipIcon} class="w-5 h-5" /> Reparaturschiff
                </td>
                <td class="p-3 text-blue-400">Marine (Flotte)</td>
                <td class="p-3 font-mono text-amber-300">500</td>
                <td class="p-3 font-mono text-cyan-300">80</td>
                <td class="p-3 font-mono text-orange-300">120</td>
                <td class="p-3 font-mono">-</td>
                <td class="p-3 pe-4">
                  HP: 50, Verbrauch: 0.5 Fuel/Tick (5.0/s), +5 HP Puls alle 10
                  Ticks (1s, Radius 10)
                </td>
              </tr>

              <!-- Missiles & Nukes -->
              <tr class="hover:bg-white/5">
                <td
                  class="p-3 ps-4 flex items-center gap-2 font-bold text-white"
                >
                  <img src=${cruiseMissileIcon} class="w-5 h-5" />
                  Marschflugkörper
                </td>
                <td class="p-3 text-purple-400">Präzisionswaffe</td>
                <td class="p-3 font-mono text-amber-300">600</td>
                <td class="p-3 font-mono text-cyan-300">40</td>
                <td class="p-3 font-mono text-orange-300">120</td>
                <td class="p-3 font-mono text-gray-500">0</td>
                <td class="p-3 pe-4">
                  Radius: 3 Kacheln, Tempo: 4.0/Tick, Fallout: 0s,
                  <strong>0 Uran!</strong>
                </td>
              </tr>
              <tr class="hover:bg-white/5">
                <td
                  class="p-3 ps-4 flex items-center gap-2 font-bold text-white"
                >
                  <img src=${atomBombIcon} class="w-5 h-5" /> Atombombe
                </td>
                <td class="p-3 text-red-400">Nuklearwaffe</td>
                <td class="p-3 font-mono text-amber-300">5.000</td>
                <td class="p-3 font-mono text-cyan-300">200</td>
                <td class="p-3 font-mono text-orange-300">150</td>
                <td class="p-3 font-mono text-lime-400 font-bold">150</td>
                <td class="p-3 pe-4">
                  Radius: 6 Kacheln, Fallout: 30 Sekunden
                </td>
              </tr>
              <tr class="hover:bg-white/5">
                <td
                  class="p-3 ps-4 flex items-center gap-2 font-bold text-white"
                >
                  <img src=${hydrogenBombIcon} class="w-5 h-5" />
                  Wasserstoffbombe
                </td>
                <td class="p-3 text-red-400">Nuklearwaffe</td>
                <td class="p-3 font-mono text-amber-300">10.000</td>
                <td class="p-3 font-mono text-cyan-300">400</td>
                <td class="p-3 font-mono text-orange-300">300</td>
                <td class="p-3 font-mono text-lime-400 font-bold">400</td>
                <td class="p-3 pe-4">
                  Radius: 10 Kacheln, Fallout: 60 Sekunden
                </td>
              </tr>
              <tr class="hover:bg-white/5">
                <td
                  class="p-3 ps-4 flex items-center gap-2 font-bold text-white"
                >
                  <img src=${mirvIcon} class="w-5 h-5" /> MIRV
                </td>
                <td class="p-3 text-red-400">Strategisch (ICBM)</td>
                <td class="p-3 font-mono text-amber-300">20.000</td>
                <td class="p-3 font-mono text-cyan-300">800</td>
                <td class="p-3 font-mono text-orange-300">500</td>
                <td class="p-3 font-mono text-lime-400 font-bold">1.000</td>
                <td class="p-3 pe-4">
                  8-10 Sprengköpfe, 16-20 Kacheln Gesamtbereich, Fallout: 90
                  Sekunden
                </td>
              </tr>

              <!-- Infrastructure & Housing -->
              <tr class="hover:bg-white/5">
                <td
                  class="p-3 ps-4 flex items-center gap-2 font-bold text-white"
                >
                  <img src=${residentialIcon} class="w-5 h-5" /> Wohnviertel
                </td>
                <td class="p-3 text-cyan-300">Infrastruktur</td>
                <td class="p-3 font-mono text-amber-300">300</td>
                <td class="p-3 font-mono">-</td>
                <td class="p-3 font-mono">-</td>
                <td class="p-3 font-mono">-</td>
                <td class="p-3 pe-4">
                  Demografie-Cap: <strong>+500 Bevölkerung</strong> |
                  Arbeitskraft für Minen & Veredelung | Weißes Karten-Icon
                </td>
              </tr>

              <!-- Defense & Sensors -->
              <tr class="hover:bg-white/5">
                <td
                  class="p-3 ps-4 flex items-center gap-2 font-bold text-white"
                >
                  <img src=${defensePostIcon} class="w-5 h-5" />
                  Verteidigungsposten
                </td>
                <td class="p-3 text-yellow-400">Verteidigung</td>
                <td class="p-3 font-mono text-amber-300">100</td>
                <td class="p-3 font-mono">-</td>
                <td class="p-3 font-mono">-</td>
                <td class="p-3 font-mono">-</td>
                <td class="p-3 pe-4">
                  Lanchester-Def: <strong>5.0x Multiplikator</strong> |
                  Angriffs-Bremse: <strong>3.0x Verlangsamung</strong> (Umkreis)
                </td>
              </tr>
              <tr class="hover:bg-white/5">
                <td
                  class="p-3 ps-4 flex items-center gap-2 font-bold text-white"
                >
                  <img src=${bunkerIcon} class="w-5 h-5" /> Stahlbunker
                </td>
                <td class="p-3 text-yellow-400">Schutzbau & Residenz</td>
                <td class="p-3 font-mono text-amber-300">500</td>
                <td class="p-3 font-mono text-cyan-300">100 · 1.6^n</td>
                <td class="p-3 font-mono">-</td>
                <td class="p-3 font-mono">-</td>
                <td class="p-3 pe-4">
                  <strong>100% Nuke- & Bombensicher</strong> (unzerstörbar durch
                  Atombomben, H-Bomben, MIRV) | Lanchester-Def:
                  <strong>+80.0% (1.8x)</strong>
                </td>
              </tr>
              <tr class="hover:bg-white/5">
                <td
                  class="p-3 ps-4 flex items-center gap-2 font-bold text-white"
                >
                  <img src=${radarIcon} class="w-5 h-5" /> Radarstation
                </td>
                <td class="p-3 text-yellow-400">Sensor & Aufklärung</td>
                <td class="p-3 font-mono text-amber-300">1.000</td>
                <td class="p-3 font-mono text-cyan-300">80</td>
                <td class="p-3 font-mono">-</td>
                <td class="p-3 font-mono text-lime-400">15</td>
                <td class="p-3 pe-4">
                  Sensorradius: 30 Kacheln, SAM-Reichweite:
                  <strong>+50.0% (12 ➔ 18)</strong>
                </td>
              </tr>
              <tr class="hover:bg-white/5">
                <td
                  class="p-3 ps-4 flex items-center gap-2 font-bold text-white"
                >
                  <img src=${samLauncherIcon} class="w-5 h-5" /> SAM Flugabwehr
                </td>
                <td class="p-3 text-yellow-400">Abfangsystem</td>
                <td class="p-3 font-mono text-amber-300">800</td>
                <td class="p-3 font-mono text-cyan-300">60</td>
                <td class="p-3 font-mono text-orange-300">20</td>
                <td class="p-3 font-mono">-</td>
                <td class="p-3 pe-4">
                  Radius: 12 (18 mit Radar), 4 Raketen Magazin, Nachladen: 10
                  Ticks (1s)
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    `;
  }

  private renderControlsSection(): TemplateResult {
    const keybinds = this.keybinds;

    return html`
      <div class="mb-10">
        <div class="flex items-center gap-3 mb-4">
          <img src=${eraserIcon} class="w-6 h-6" />
          <h2 class="text-xl font-bold text-white m-0">
            Steuerung, Hotkeys & Spezial-Werkzeuge
          </h2>
        </div>
        <p class="text-sm text-gray-300 mb-6 leading-relaxed">
          Behalte die volle Kontrolle über dein Reich mit praktischen
          Schnelltasten und Spezialwerkzeugen.
        </p>

        <!-- Tool Highlights: Eraser & Dynamic HP -->
        <div class="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
          <div
            class="bg-black/30 rounded-xl border border-white/10 p-5 flex items-start gap-4"
          >
            <div
              class="p-3 rounded-lg bg-red-950/40 border border-red-500/40 shrink-0"
            >
              <img src=${eraserIcon} class="w-8 h-8" />
            </div>
            <div>
              <h3 class="text-base font-bold text-white mb-1 m-0">
                Radierer / Gebäudeabriss (Demolition Mode)
              </h3>
              <p class="text-xs text-gray-300 leading-relaxed mb-2 m-0">
                Klicke auf das Radiergummi-Icon in der Hotbar (oder Taste
                <strong>[X]</strong>). Gebäude werden mit einem roten
                <strong>X</strong> markiert. Ein Klick reißt die Struktur ab.
                Der Bestätigungsdialog bietet die Option
                <em>"Für diese Runde nicht mehr fragen"</em>.
              </p>
              <span class="text-[11px] text-red-300 font-semibold"
                >Gibt Kacheln sofort frei für neue Minen oder Werke!</span
              >
            </div>
          </div>

          <div
            class="bg-black/30 rounded-xl border border-white/10 p-5 flex items-start gap-4"
          >
            <div
              class="p-3 rounded-lg bg-blue-950/40 border border-blue-500/40 shrink-0"
            >
              <svg
                class="w-8 h-8 text-blue-400"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <rect
                  x="2"
                  y="6"
                  width="20"
                  height="12"
                  rx="2"
                  stroke-width="2"
                ></rect>
                <path
                  d="M6 12h8"
                  stroke-width="2"
                  stroke-linecap="round"
                ></path>
              </svg>
            </div>
            <div>
              <h3 class="text-base font-bold text-white mb-1 m-0">
                Dynamische Schiffs-HP-Balken
              </h3>
              <p class="text-xs text-gray-300 leading-relaxed mb-2 m-0">
                Lebensbalken von Kriegsschiffen und Zerstörern werden
                standardmäßig dezent nur beim Überfahren mit dem Mauszeiger
                (Hover) angezeigt. In den Spieleinstellungen kann dies auf
                <em>"Permanent anzeigen"</em> umgeschaltet werden.
              </p>
              <span class="text-[11px] text-blue-300 font-semibold"
                >Sorgt für ein aufgeräumtes Schlachtfeld ohne visuelle
                Verdeckung.</span
              >
            </div>
          </div>
        </div>

        <!-- Hotkeys Table -->
        <div
          class="bg-white/5 rounded-xl border border-white/10 overflow-hidden"
        >
          <table class="w-full text-xs border-separate border-spacing-y-1 p-3">
            <thead>
              <tr class="text-white/40 uppercase tracking-wider text-start">
                <th class="pb-2 ps-3">Taste</th>
                <th class="pb-2">Funktion / Aktion</th>
              </tr>
            </thead>
            <tbody class="text-white/80">
              <tr class="hover:bg-white/5">
                <td class="py-2.5 ps-3 font-mono">${this.renderKey("Tab")}</td>
                <td class="py-2.5 text-gray-300">
                  Wechselt zwischen Hotbar-Reitern <strong>Gebäude</strong> und
                  <strong>Actives</strong>
                </td>
              </tr>
              <tr class="hover:bg-white/5">
                <td class="py-2.5 ps-3 font-mono">
                  ${this.renderKey("Escape")}
                </td>
                <td class="py-2.5 text-gray-300">
                  Menü schließen / Bauvorschau abbrechen
                </td>
              </tr>
              <tr class="hover:bg-white/5">
                <td class="py-2.5 ps-3 font-mono">
                  ${this.renderKey("Enter")}
                </td>
                <td class="py-2.5 text-gray-300">Chat öffnen / Bestätigen</td>
              </tr>
              <tr class="hover:bg-white/5">
                <td class="py-2.5 ps-3 font-mono">
                  ${this.renderKey(keybinds.attackRatio1 ?? "Digit1")} /
                  ${this.renderKey(keybinds.attackRatio2 ?? "Digit2")} /
                  ${this.renderKey(keybinds.attackRatio3 ?? "Digit3")}
                </td>
                <td class="py-2.5 text-gray-300">
                  Angriffs-Ratio direkt auf <strong>20%</strong>,
                  <strong>50%</strong> oder <strong>100%</strong> setzen
                </td>
              </tr>
              <tr class="hover:bg-white/5">
                <td class="py-2.5 ps-3 font-mono">
                  ${this.renderKey(keybinds.attackRatioDown ?? "ArrowDown")} /
                  ${this.renderKey(keybinds.attackRatioUp ?? "ArrowUp")}
                </td>
                <td class="py-2.5 text-gray-300">
                  Angriffsverhältnis stufenweise anpassen
                </td>
              </tr>
              <tr class="hover:bg-white/5">
                <td class="py-2.5 ps-3 font-mono">
                  ${this.renderKey(keybinds.toggleView ?? "KeyQ")}
                </td>
                <td class="py-2.5 text-gray-300">
                  Ansichts-Modus umschalten (Wirtschaft / Militär)
                </td>
              </tr>
              <tr class="hover:bg-white/5">
                <td class="py-2.5 ps-3 font-mono">
                  ${this.renderKey(keybinds.coordinateGrid ?? "KeyG")}
                </td>
                <td class="py-2.5 text-gray-300">
                  Koordinaten-Raster auf der Karte ein-/ausblenden
                </td>
              </tr>

              <!-- Category Header: Gebäude & Infrastruktur -->
              <tr class="bg-white/10 text-cyan-300 font-bold">
                <td colspan="2" class="py-1.5 ps-3 uppercase tracking-wider text-[10px]">
                  Infrastruktur & Verteidigung (Gebäude-Tab)
                </td>
              </tr>
              <tr class="hover:bg-white/5">
                <td class="py-2 ps-3 font-mono">
                  ${this.renderKey(keybinds.buildCity ?? "Digit1")} .. ${this.renderKey(keybinds.buildSamLauncher ?? "Digit6")}
                </td>
                <td class="py-2 text-gray-300">
                  Stadt (1), Fabrik (2), Hafen (3), Verteidigung (4), Silo (5), SAM (6)
                </td>
              </tr>
              <tr class="hover:bg-white/5">
                <td class="py-2 ps-3 font-mono">
                  ${this.renderKey(keybinds.buildBunker ?? "Digit7")} / ${this.renderKey(keybinds.buildResidential ?? "Digit8")}
                </td>
                <td class="py-2 text-gray-300">
                  <strong>Stahlbunker</strong> (Panzerfestung, +80% Def) / <strong>Wohnviertel</strong> (+Bevölkerungskapazität)
                </td>
              </tr>

              <!-- Category Header: Rohstoffe & Industrie -->
              <tr class="bg-white/10 text-amber-300 font-bold">
                <td colspan="2" class="py-1.5 ps-3 uppercase tracking-wider text-[10px]">
                  Rohstoffe & Industrie (Minen & Werke)
                </td>
              </tr>
              <tr class="hover:bg-white/5">
                <td class="py-2 ps-3 font-mono">
                  ${this.renderKey(keybinds.buildIronMine ?? "Shift+Digit1")} / ${this.renderKey(keybinds.buildCoalMine ?? "Shift+Digit2")}
                </td>
                <td class="py-2 text-gray-300">
                  <strong>Eisenmine</strong> (+2.5 Fe/s) / <strong>Kohlemine</strong> (+2.5 C/s)
                </td>
              </tr>
              <tr class="hover:bg-white/5">
                <td class="py-2 ps-3 font-mono">
                  ${this.renderKey(keybinds.buildSteelMill ?? "Shift+Digit3")}
                </td>
                <td class="py-2 text-gray-300">
                  <strong>Stahlwerk</strong> (Schmilzt 2 Fe + 1 C zu 1 Stahl)
                </td>
              </tr>
              <tr class="hover:bg-white/5">
                <td class="py-2 ps-3 font-mono">
                  ${this.renderKey(keybinds.buildOilRig ?? "Shift+Digit4")} / ${this.renderKey(keybinds.buildRefinery ?? "Shift+Digit5")}
                </td>
                <td class="py-2 text-gray-300">
                  <strong>Bohrinsel</strong> (+1.8 Öl/s) / <strong>Raffinerie</strong> (2 Öl ➔ 1 Treibstoff)
                </td>
              </tr>
              <tr class="hover:bg-white/5">
                <td class="py-2 ps-3 font-mono">
                  ${this.renderKey(keybinds.buildUraniumMine ?? "Shift+Digit6")} / ${this.renderKey(keybinds.buildCentrifuge ?? "Shift+Digit7")}
                </td>
                <td class="py-2 text-gray-300">
                  <strong>Uranmine</strong> (+0.6 U/s) / <strong>Zentrifuge</strong> (4 U + 2 C ➔ 1 Angereichertes Uran)
                </td>
              </tr>

              <!-- Category Header: Marine & Flotte -->
              <tr class="bg-white/10 text-blue-300 font-bold">
                <td colspan="2" class="py-1.5 ps-3 uppercase tracking-wider text-[10px]">
                  Marine & Schiffsflotte (Direkt oder Taste 1-4 im Actives-Tab)
                </td>
              </tr>
              <tr class="hover:bg-white/5">
                <td class="py-2 ps-3 font-mono">
                  ${this.renderKey(keybinds.buildWarship ?? "Shift+KeyW")} / ${this.renderKey(keybinds.buildDestroyer ?? "Shift+KeyD")}
                </td>
                <td class="py-2 text-gray-300">
                  <strong>Kriegsschiff</strong> (Seeherrschaft) / <strong>Zerstörer</strong> (Booster-Eskorte, +10% DMG)
                </td>
              </tr>
              <tr class="hover:bg-white/5">
                <td class="py-2 ps-3 font-mono">
                  ${this.renderKey(keybinds.buildSubmarine ?? "Shift+KeyS")} / ${this.renderKey(keybinds.buildBattleship ?? "Shift+KeyB")}
                </td>
                <td class="py-2 text-gray-300">
                  <strong>Reparaturschiff</strong> (+10 HP Heilung) / <strong>Schlachtschiff</strong> (Massive Panzerung & Reichweite)
                </td>
              </tr>

              <!-- Category Header: Raketen & Nuklearwaffen -->
              <tr class="bg-white/10 text-rose-300 font-bold">
                <td colspan="2" class="py-1.5 ps-3 uppercase tracking-wider text-[10px]">
                  Raketen & Strategische Waffen (Direkt oder Taste 5-9 im Actives-Tab)
                </td>
              </tr>
              <tr class="hover:bg-white/5">
                <td class="py-2 ps-3 font-mono">
                  ${this.renderKey(keybinds.buildCruiseMissile ?? "Shift+KeyC")}
                </td>
                <td class="py-2 text-gray-300">
                  <strong>Marschflugkörper / Rakete</strong> (Präzisionsschlag R=3, kein Uran)
                </td>
              </tr>
              <tr class="hover:bg-white/5">
                <td class="py-2 ps-3 font-mono">
                  ${this.renderKey(keybinds.buildAtomBomb ?? "Shift+Digit8")} / ${this.renderKey(keybinds.buildHydrogenBomb ?? "Shift+Digit9")}
                </td>
                <td class="py-2 text-gray-300">
                  <strong>Atombombe</strong> / <strong>Wasserstoffbombe</strong>
                </td>
              </tr>
              <tr class="hover:bg-white/5">
                <td class="py-2 ps-3 font-mono">
                  ${this.renderKey(keybinds.buildMIRV ?? "Shift+Digit0")} / ${this.renderKey(keybinds.buildICBM ?? "Digit0")}
                </td>
                <td class="py-2 text-gray-300">
                  <strong>MIRV Mehrfachsprengkopf</strong> / <strong>Strategische ICBM</strong> (R=12 Fallout)
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    `;
  }

  private renderSupportSection(): TemplateResult {
    return html`
      <div class="mb-10">
        <div class="flex items-center gap-3 mb-4">
          <span class="text-2xl">🔧</span>
          <h2 class="text-xl font-bold text-white m-0">
            Diagnose & Technische Unterstützung
          </h2>
        </div>
        <p class="text-sm text-gray-300 mb-6 leading-relaxed">
          Falls Verbindungs-, Leistungs- oder Grafikprobleme auftreten, kannst
          du hier die integrierten System- und Verbindungstests ausführen.
        </p>

        <!-- Troubleshooting Box -->
        <div
          class="bg-black/35 rounded-xl border border-white/10 p-6 flex flex-col sm:flex-row items-center justify-between gap-4 shadow-xl"
        >
          <div>
            <h3 class="text-base font-bold text-white mb-1 m-0">
              Integrierte Fehlerdiagnose
            </h3>
            <p class="text-xs text-gray-300 m-0">
              WebGL2-Performance, WebSocket-Verbindungstests, Framerate-Messung,
              Audio-Test und Cache-Bereinigung.
            </p>
          </div>
          <button
            id="troubleshooting-button"
            class="shrink-0 px-6 py-2.5 text-xs font-bold transition-all rounded-lg uppercase tracking-wider bg-malibu-blue hover:bg-aquarius text-white shadow-md shadow-malibu-blue/20"
            data-page="page-troubleshooting"
            @click="${this.openTroubleshooting}"
          >
            Diagnose öffnen
          </button>
        </div>
      </div>
    `;
  }

  protected renderBody() {
    const tab = this.selectedTab;

    return html`
      <div
        dir=${textDirection()}
        class="prose prose-invert prose-sm max-w-none px-4 lg:px-8 py-4
          [&_a]:text-emerald-400 [&_a:hover]:text-emerald-300 transition-colors"
      >
        <!-- Category Tab Bar -->
        ${this.renderTabBar()}

        <!-- Render based on selectedTab -->
        ${tab === "tutorial" || tab === "all"
          ? this.renderTutorialSection()
          : ""}
        ${tab === "economy" || tab === "all" ? this.renderEconomySection() : ""}
        ${tab === "refinery" || tab === "all"
          ? this.renderRefinerySection()
          : ""}
        ${tab === "defense" || tab === "all" ? this.renderDefenseSection() : ""}
        ${tab === "alliances" || tab === "all"
          ? this.renderAlliancesSection()
          : ""}
        ${tab === "military" || tab === "all"
          ? this.renderMilitarySection()
          : ""}
        ${tab === "nukes" || tab === "all" ? this.renderNukesSection() : ""}
        ${tab === "ranked" || tab === "all" ? this.renderRankedSection() : ""}
        ${tab === "stats" || tab === "all" ? this.renderStatsSection() : ""}
        ${tab === "controls" || tab === "all"
          ? this.renderControlsSection()
          : ""}
        ${tab === "support" || tab === "all" ? this.renderSupportSection() : ""}
      </div>
    `;
  }

  openTroubleshooting() {
    const troubleshootingModal = document.querySelector(
      "troubleshooting-modal",
    ) as TroubleshootingModal;
    if (
      !troubleshootingModal ||
      !(troubleshootingModal instanceof TroubleshootingModal)
    ) {
      console.warn("Troubleshooting modal element not found");
      return;
    }
    troubleshootingModal.open();
  }

  protected onOpen(): void {
    this.keybinds = this.getKeybinds();
  }

  protected onClose(): void {
    // Modal closed
  }
}
