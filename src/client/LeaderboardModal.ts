import { RankedType } from "@openfront/engine-api/game/GameTypes";
import { html, nothing } from "lit";
import { customElement, query, state } from "lit/decorators.js";
import { BaseModal } from "./components/BaseModal";
import "./components/leaderboard/LeaderboardClanTable";
import type { LeaderboardClanTable } from "./components/leaderboard/LeaderboardClanTable";
import "./components/leaderboard/LeaderboardPlayerList";
import type {
  LeaderboardPlayerList,
  PlayerLadder,
} from "./components/leaderboard/LeaderboardPlayerList";
import "./components/leaderboard/LeaderboardTribeTable";
import type { LeaderboardTribeTable } from "./components/leaderboard/LeaderboardTribeTable";
import { modalHeader } from "./components/ui/ModalHeader";
import { translateText } from "./Utils";

const TAB_KEYS = [
  "players",
  "players2v2",
  "playersFfa",
  "qp",
  "clans",
  "tribes",
] as const;

// Tab key -> ladder.
const PLAYER_TABS: Record<string, PlayerLadder> = {
  qp: "qp",
  players: RankedType.OneVOne,
  players2v2: RankedType.TwoVTwo,
  playersFfa: RankedType.FreeForAll,
};

@customElement("leaderboard-modal")
export class LeaderboardModal extends BaseModal {
  protected routerName = "leaderboard";

  @state()
  private clanDateRange: { start: string; end: string } | null = null;
  @state()
  private showEloDetails = false;

  @query("leaderboard-player-list")
  private playerList?: LeaderboardPlayerList;
  @query("leaderboard-clan-table")
  private clanTable?: LeaderboardClanTable;
  @query("leaderboard-tribe-table")
  private tribeTable?: LeaderboardTribeTable;

  private loadToken = 0;
  private lastRankedType: PlayerLadder = RankedType.OneVOne;

  protected modalConfig() {
    return {
      tabs: [
        {
          key: "players",
          label: "1v1 Ranked",
        },
        {
          key: "players2v2",
          label: "2v2 Ranked",
        },
        {
          key: "playersFfa",
          label: "FFA Ranked",
        },
        {
          key: "qp",
          label: "QP Punkte",
        },
        { key: "clans", label: translateText("leaderboard_modal.clans_tab") },
        { key: "tribes", label: "Best Bot Nation (Tribes)" },
      ],
    };
  }

  private rankedTypeFor(tab: string): PlayerLadder | null {
    return PLAYER_TABS[tab] ?? null;
  }

  private tabComponent(tab: string) {
    if (this.rankedTypeFor(tab) !== null) return this.playerList;
    if (tab === "clans") return this.clanTable;
    return this.tribeTable;
  }

  protected onOpen(): void {
    this.loadActiveTabData();
  }

  protected onTabEnter(): void {
    // The player list is one element shared by the ladder tabs, so it needs a
    // ranked type even while another tab is up: keep showing the last one.
    this.lastRankedType =
      this.rankedTypeFor(this.activeTab) ?? this.lastRankedType;
    this.loadActiveTabData();
  }

  private loadActiveTabData() {
    const token = ++this.loadToken;

    const active = this.activeTab;

    const run = async () => {
      if (token !== this.loadToken) return;

      if (this.rankedTypeFor(active) !== null) {
        await this.playerList?.ensureLoaded();
        if (token !== this.loadToken) return;
        this.playerList?.handleTabActivated();
      } else {
        await this.tabComponent(active)?.ensureLoaded();
      }

      queueMicrotask(() => {
        if (token !== this.loadToken) return;
        for (const key of TAB_KEYS) {
          if (key !== active) void this.tabComponent(key)?.ensureLoaded();
        }
      });
    };

    void (async () => {
      if (!this.tabComponent(active)) {
        await this.updateComplete;
      }
      await run();
    })();
  }

  private handleClanDateRangeChange(
    event: CustomEvent<{ start: string; end: string }>,
  ) {
    this.clanDateRange = event.detail;
  }

  protected renderHeaderSlot() {
    let dateRange = html``;
    if (this.clanDateRange) {
      const start = new Date(this.clanDateRange.start).toLocaleDateString();
      const end = new Date(this.clanDateRange.end).toLocaleDateString();
      dateRange = html`<span
        class="text-sm font-normal text-white/40 ml-2 wrap-break-words"
        >(${start} - ${end})</span
      >`;
    }
    const refreshTime = html`<span
      class="text-sm font-normal text-white/40 ml-2 wrap-break-words italic"
      >(${translateText("leaderboard_modal.refresh_time")})</span
    >`;

    return modalHeader({
      titleContent: html`
        <div class="flex flex-wrap items-center gap-2">
          <span
            class="text-white text-xl sm:text-2xl font-bold uppercase tracking-widest"
          >
            ${translateText("leaderboard_modal.title")}
          </span>
          ${this.activeTab === "clans" ? dateRange : ""}
          ${this.rankedTypeFor(this.activeTab) !== null ||
          this.activeTab === "tribes"
            ? refreshTime
            : ""}
        </div>
      `,
      onBack: () => this.close(),
      ariaLabel: translateText("common.close"),
    });
  }

  protected renderBody() {
    return html`
      <div class="flex-1 min-h-0 h-full flex flex-col">
        ${this.rankedTypeFor(this.activeTab) !== null
          ? this.renderRankedEloBanner()
          : nothing}
        <div class="flex-1 min-h-0 h-full">
          <leaderboard-player-list
            class=${this.rankedTypeFor(this.activeTab) !== null
              ? "h-full"
              : "hidden"}
            .rankedType=${this.rankedTypeFor(this.activeTab) ??
            this.lastRankedType}
          ></leaderboard-player-list>
          <leaderboard-clan-table
            class=${this.activeTab === "clans" ? "h-full" : "hidden"}
            @date-range-change=${(
              event: CustomEvent<{ start: string; end: string }>,
            ) => this.handleClanDateRangeChange(event)}
          ></leaderboard-clan-table>
          <leaderboard-tribe-table
            class=${this.activeTab === "tribes" ? "h-full" : "hidden"}
          ></leaderboard-tribe-table>
        </div>
      </div>
    `;
  }

  private renderRankedEloBanner() {
    const tiers = [
      {
        name: "Eisen",
        range: "< 800",
        color: "#9ca3af",
        bg: "rgba(156,163,175,0.12)",
      },
      {
        name: "Bronze",
        range: "800 - 999",
        color: "#d97706",
        bg: "rgba(217,119,6,0.12)",
      },
      {
        name: "Silber",
        range: "1000 - 1199",
        color: "#cbd5e1",
        bg: "rgba(203,213,225,0.12)",
      },
      {
        name: "Gold",
        range: "1200 - 1399",
        color: "#facc15",
        bg: "rgba(250,204,21,0.12)",
      },
      {
        name: "Platin",
        range: "1400 - 1599",
        color: "#2dd4bf",
        bg: "rgba(45,212,191,0.12)",
      },
      {
        name: "Diamant",
        range: "1600 - 1799",
        color: "#38bdf8",
        bg: "rgba(56,189,248,0.12)",
      },
      {
        name: "Master",
        range: "1800 - 1999",
        color: "#c084fc",
        bg: "rgba(192,132,252,0.12)",
      },
      {
        name: "Grandmaster",
        range: "2000 - 2399",
        color: "#f43f5e",
        bg: "rgba(244,63,94,0.12)",
      },
      {
        name: "Champion",
        range: "2400+",
        color: "#ec4899",
        bg: "rgba(236,72,153,0.12)",
      },
      {
        name: "Top 10",
        range: "Elite",
        color: "#fbbf24",
        bg: "rgba(251,191,36,0.15)",
        border: "border-amber-400/50",
      },
    ];

    return html`
      <div class="px-4 py-3 bg-[#111622] border-b border-white/10 shrink-0">
        <!-- Tier Badges Carousel / Header -->
        <div class="flex items-center justify-between gap-3 mb-2.5">
          <div class="flex items-center gap-2">
            <svg
              class="w-4 h-4 text-malibu-blue"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
            >
              <path d="M6 9H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h2" />
              <path d="M18 9h2a2 2 0 0 0 2-2V5a2 2 0 0 0-2-2h-2" />
              <path d="M4 3h16v6a8 8 0 0 1-16 0V3z" />
              <path d="M12 17v4" />
              <path d="M8 21h8" />
            </svg>
            <span class="text-xs font-bold uppercase tracking-wider text-white">
              Offizielles InduFront Elo- & Rang-System
            </span>
          </div>
          <button
            @click=${() => {
              this.showEloDetails = !this.showEloDetails;
            }}
            class="text-xs font-bold text-malibu-blue hover:text-white flex items-center gap-1 transition-colors cursor-pointer px-2 py-1 rounded bg-white/5 hover:bg-white/10"
          >
            <span
              >${this.showEloDetails
                ? "Details ausblenden"
                : "Rang-System Details & Formeln"}</span
            >
            <svg
              class="w-3.5 h-3.5 transition-transform duration-200 ${this
                .showEloDetails
                ? "rotate-180"
                : ""}"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              stroke-width="2"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                d="M19 9l-7 7-7-7"
              />
            </svg>
          </button>
        </div>

        <!-- Tiers Strip -->
        <div
          class="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-thin scrollbar-thumb-white/20"
        >
          ${tiers.map(
            (t) => html`
              <div
                class="px-2.5 py-1 rounded-md text-[11px] font-bold shrink-0 border border-white/10 flex items-center gap-1.5"
                style="background-color: ${t.bg}; border-color: ${t.border
                  ? undefined
                  : t.color + "40"}; color: ${t.color}"
              >
                <span>${t.name}</span>
                <span class="text-[10px] opacity-70 font-mono font-normal"
                  >(${t.range})</span
                >
              </div>
            `,
          )}
        </div>

        <!-- Expandable Details Accordion -->
        ${this.showEloDetails
          ? html`
              <div
                class="mt-3 pt-3 border-t border-white/10 grid grid-cols-1 md:grid-cols-3 gap-3 text-xs text-slate-300"
              >
                <!-- Spalte 1: Formel & K-Faktoren -->
                <div
                  class="p-3 rounded-lg bg-black/40 border border-white/5 flex flex-col gap-1.5"
                >
                  <div
                    class="font-bold text-white uppercase tracking-wider text-[11px] flex items-center gap-1.5"
                  >
                    <svg
                      class="w-3.5 h-3.5 text-malibu-blue"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      stroke-width="2"
                    >
                      <circle cx="12" cy="12" r="10" />
                      <path d="M12 6v6l4 2" />
                    </svg>
                    Mathematische Elo-Formel
                  </div>
                  <p class="text-[11px] leading-relaxed text-slate-300">
                    Gewinnwahrscheinlichkeit:
                    <code
                      class="font-mono bg-white/10 px-1 rounded text-cyan-300"
                      >E = 1 / (1 + 10^(ΔElo / 400))</code
                    >.
                  </p>
                  <div class="text-[11px] leading-relaxed mt-1">
                    <strong class="text-white">Dynamische K-Faktoren:</strong>
                    <ul
                      class="list-disc list-inside mt-0.5 space-y-0.5 text-slate-400"
                    >
                      <li>
                        Kalibrierung (1–10 Games):
                        <span class="text-cyan-300 font-mono">K = 48</span>
                      </li>
                      <li>
                        Aufsteiger (11–30 Games):
                        <span class="text-cyan-300 font-mono">K = 32</span>
                      </li>
                      <li>
                        Etabliert (> 30 Games):
                        <span class="text-cyan-300 font-mono">K = 24</span>
                      </li>
                      <li>
                        High-Elo (> 2000 Elo):
                        <span class="text-cyan-300 font-mono">K = 16</span>
                      </li>
                    </ul>
                  </div>
                </div>

                <!-- Spalte 2: Spielmodi & Wertung -->
                <div
                  class="p-3 rounded-lg bg-black/40 border border-white/5 flex flex-col gap-1.5"
                >
                  <div
                    class="font-bold text-white uppercase tracking-wider text-[11px] flex items-center gap-1.5"
                  >
                    <svg
                      class="w-3.5 h-3.5 text-amber-400"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      stroke-width="2"
                    >
                      <polygon
                        points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"
                      />
                    </svg>
                    Modi & Wertungsprinzip
                  </div>
                  <p class="text-[11px] leading-relaxed text-slate-300">
                    <strong class="text-white">1v1 Duell:</strong> Reiner
                    Skill-Vergleich mit direktem Elo-Übertrag.
                  </p>
                  <p class="text-[11px] leading-relaxed text-slate-300">
                    <strong class="text-white">2v2 Teams:</strong>
                    Team-Durchschnitt bestimmt Erwartung; individuelle Kills &
                    Gebietskontrolle geben Boosts.
                  </p>
                  <p class="text-[11px] leading-relaxed text-slate-300">
                    <strong class="text-white">FFA Ranked:</strong> Zero-Sum
                    Pairwise. Jeder überlebte Kontrahent bringt Elo; frühes
                    Ausscheiden senkt die Wertung.
                  </p>
                </div>

                <!-- Spalte 3: Anti-Monopol & Stahl-Belohnungen -->
                <div
                  class="p-3 rounded-lg bg-black/40 border border-white/5 flex flex-col gap-1.5"
                >
                  <div
                    class="font-bold text-white uppercase tracking-wider text-[11px] flex items-center gap-1.5"
                  >
                    <svg
                      class="w-3.5 h-3.5 text-rose-400"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      stroke-width="2"
                    >
                      <circle cx="12" cy="12" r="10" />
                      <line x1="4.93" y1="4.93" x2="19.07" y2="19.07" />
                    </svg>
                    Top-10 Allianzsperre & Stahl
                  </div>
                  <p class="text-[11px] leading-relaxed text-slate-300">
                    <strong class="text-amber-300">Allianz-Schutz:</strong>
                    Top-10-Spieler dürfen
                    <em class="text-white not-italic font-bold"
                      >keiner Allianz beitreten</em
                    >
                    und verlassen Bündnisse beim Aufstieg automatisch. So
                    verbünden sich nur kleinere Nationen!
                  </p>
                  <p class="text-[11px] leading-relaxed text-slate-300">
                    <strong class="text-cyan-300">Stahl pro Match:</strong> 1.
                    Platz: 1000 · 2. Platz: 750 · 3. Platz: 500 · 4. Platz: 350
                    · 5. Platz: 200 (für Skins, Titel & Sounds).
                  </p>
                </div>
              </div>
            `
          : nothing}
      </div>
    `;
  }
}
