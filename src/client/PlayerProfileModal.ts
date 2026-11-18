import {
  isVerifiedUsername,
  type PlayerProfile,
  type PlayerStatsTree,
  type PublicProgress,
} from "@openfront/shared/ApiSchemas";
import { html, nothing } from "lit";
import { customElement, state } from "lit/decorators.js";
import {
  addProfileComment,
  deleteProfileComment,
  fetchProfileComments,
  fetchPublicPlayerProfile,
  type ProfileComment,
  savePlayerProfile,
} from "./Api";
import { ClientEnv } from "./ClientEnv";
import type { PlayerGameHistoryCache } from "./components/baseComponents/stats/PlayerGameHistoryView";
import "./ClanModal";
import "./components/baseComponents/Button";
import "./components/baseComponents/stats/PlayerGameHistoryView";
import { BaseModal } from "./components/BaseModal";
import "./components/baseComponents/stats/PlayerStatsTree";
import { modalHeader } from "./components/ui/ModalHeader";
import "./components/clan/ClanCard";
import "./components/PlayerName";
import "./components/ProfileCard";
import "./components/ProfileProgression";
import "./components/ProfileShare";
import { usernameText } from "./components/ui/UsernameText";
import { verifiedBadge } from "./components/ui/VerifiedBadge";
import { modalRouter } from "./ModalRouter";
import "./GameStatsModal";
import "./LeaderboardModal";
import { latestUserMeResponse } from "./NavAccountButton";
import { loadPlayerProgress } from "./PlayerProgress";
import {
  isOwnAccount,
  PROVISIONAL_PROGRESS_CHANGED,
  provisionalProgress,
  scoredGames,
} from "./ProvisionalProgress";
import { SteelStoreService, STEEL_CATALOG } from "./SteelStore";
import {
  parsePlayerProfilePath,
  playerProfileUrl,
} from "./utilities/PlayerProfileUrl";
import { currentPagePath, showToast, translateText } from "./Utils";

export { playerProfileUrl };

// Every opening of a profile, numbered: keys the once-per-opening flourishes.
let profileOpenings = 0;

/** Where a profile was opened from, i.e. where its Back button leads. */
export type ProfileOrigin = "clan" | "leaderboard" | "account" | "friends";

export interface BadgeInfo {
  id: string;
  name: string;
  icon: string;
  origin: string;
  colorClass: string;
}

export function resolveBadgeInfo(badgeId: string): BadgeInfo {
  if (badgeId.startsWith("solo:")) {
    const parts = badgeId.split(":");
    const mapName = parts[1] || "World";
    const difficulty = parts[2] || "Medium";
    let icon = "🥈";
    let colorClass = "bg-slate-500/20 text-slate-300 border-slate-500/30";
    if (difficulty === "Easy") {
      icon = "🥉";
      colorClass = "bg-amber-700/20 text-amber-500 border-amber-700/30";
    } else if (difficulty === "Hard") {
      icon = "🥇";
      colorClass = "bg-amber-400/20 text-amber-300 border-amber-400/30";
    } else if (difficulty === "Impossible") {
      icon = "💎";
      colorClass = "bg-cyan-400/20 text-cyan-200 border-cyan-400/40 shadow-sm";
    }
    return {
      id: badgeId,
      name: `${mapName} (${difficulty})`,
      icon,
      origin: `Solo-Erfolg: Sieg auf Karte "${mapName}" (${difficulty})`,
      colorClass,
    };
  }
  if (badgeId.startsWith("badge:") || badgeId.startsWith("title:")) {
    const item = Array.isArray(STEEL_CATALOG)
      ? STEEL_CATALOG.find((i) => i.id === badgeId)
      : null;
    if (item) {
      return {
        id: badgeId,
        name: item.name,
        icon: item.category === "titel" ? "👑" : "🛡️",
        origin: `Im Stahl-Shop gekauft (${item.cost} Stahl)`,
        colorClass: "bg-purple-500/20 text-purple-300 border-purple-500/30",
      };
    }
  }
  if (badgeId === "starter:pionier") {
    return {
      id: badgeId,
      name: "InduFront Pionier",
      icon: "🎖️",
      origin: "Gründungsmitglied der InduFront-Community",
      colorClass: "bg-blue-500/20 text-blue-300 border-blue-500/30",
    };
  }
  if (badgeId === "clan:founder") {
    return {
      id: badgeId,
      name: "Clan-Gründer",
      icon: "👑",
      origin: "Gründer eines registrierten InduFront-Clans",
      colorClass: "bg-amber-500/20 text-amber-300 border-amber-500/30",
    };
  }
  if (badgeId === "streak:10") {
    return {
      id: badgeId,
      name: "10er Siegesserie",
      icon: "🔥",
      origin: "10 Siege in Folge im Ranked oder Mehrspieler",
      colorClass: "bg-red-500/20 text-red-300 border-red-500/30",
    };
  }
  if (badgeId === "level:10") {
    return {
      id: badgeId,
      name: "Level 10 Meilenstein",
      icon: "⭐",
      origin: "Erreiche Spielerlevel 10",
      colorClass: "bg-emerald-500/20 text-emerald-300 border-emerald-500/30",
    };
  }
  if (badgeId === "level:25") {
    return {
      id: badgeId,
      name: "Level 25 Veteran",
      icon: "🌟",
      origin: "Erreiche Spielerlevel 25",
      colorClass: "bg-indigo-500/20 text-indigo-300 border-indigo-500/30",
    };
  }
  if (badgeId === "level:50") {
    return {
      id: badgeId,
      name: "Level 50 Legende",
      icon: "💫",
      origin: "Erreiche Spielerlevel 50",
      colorClass:
        "bg-yellow-400/20 text-yellow-200 border-yellow-400/40 shadow-sm",
    };
  }
  return {
    id: badgeId,
    name: badgeId,
    icon: "🛡️",
    origin: "Besondere Spieler-Auszeichnung",
    colorClass: "bg-white/10 text-white/80 border-white/20",
  };
}

@customElement("player-profile-modal")
export class PlayerProfileModal extends BaseModal {
  protected routerName = "profile";

  @state() private publicId: string | null = null;
  @state() private username: string | null = null;
  @state() private statsTree: PlayerStatsTree | null = null;
  @state() private editingBio = false;
  @state() private bioDraft = "";
  @state() private profileBio = "";
  @state() private featuredRankMode: "1v1" | "2v2" | "ffa" = "ffa";
  @state() private showcasedBadges: string[] = [];
  @state() private soloAchievements: { mapName: string; difficulty: string }[] =
    [];
  @state() private ranks: Record<string, { elo: number; tier: string }> = {};
  @state() private editingBadges = false;
  @state() private clans: NonNullable<PlayerProfile["clans"]> = [];
  @state() private displayClanTag: string | null = null;
  // Level / XP, when progression is on and the player has any.
  @state() private progress: PublicProgress | null = null;
  @state() private loading = false;
  // The link this profile was opened from (`openfront.io/player/<id>`), when
  // it was opened from one: the not-found state shows it.
  @state() private openedLink: string | null = null;
  @state() private comments: ProfileComment[] = [];
  @state() private commentInput = "";
  @state() private commentsLoading = false;
  @state() private submittingComment = false;
  private openedFrom: ProfileOrigin | null = null;
  // Mirrors the account modal's Games tab: keep the accumulated history list +
  // cursor across tab switches (and the game-stats detour) so re-entering Games
  // restores the scroll position the viewer had built up.
  private gameHistoryCache: PlayerGameHistoryCache | null = null;
  private gamesScrollTop = 0;
  private restoreGamesScrollAfterOpen = false;
  // Bumped on every profile load so a superseded in-flight response is dropped.
  private loadGeneration = 0;
  // The Progression tab was asked for (a link, or the tab the profile was
  // last left on) before this player's progress arrived. The tab only exists
  // for a player with progress, so it's selected once that lands.
  private wantsProgressionTab = false;
  // Counts fresh openings, to key the profile card's once-per-open flourish.
  private openCount = 0;

  connectedCallback(): void {
    super.connectedCallback();
    document.addEventListener(
      PROVISIONAL_PROGRESS_CHANGED,
      this.handleProvisionalChanged,
    );
  }

  disconnectedCallback(): void {
    document.removeEventListener(
      PROVISIONAL_PROGRESS_CHANGED,
      this.handleProvisionalChanged,
    );
    super.disconnectedCallback();
  }

  // Bumped by every read of the progress, so the last one started wins.
  private progressRead = 0;

  // The player's own level counts XP from games still waiting to be scored,
  // and that changed (ProvisionalProgress.ts).
  private handleProvisionalChanged = (event: Event): void => {
    if (scoredGames(event).length > 0) this.rereadProgress();
    this.requestUpdate();
  };

  private isOwn(publicId: string | null | undefined): boolean {
    if (!publicId) return false;
    const me = latestUserMeResponse();
    const myId = me ? me.player?.publicId : null;
    return isOwnAccount(publicId) || (!!myId && publicId === myId);
  }

  // A pending game was scored: on the viewer's own open profile, read the
  // progress again, for its history and milestones. The level holds
  // meanwhile (and on a stale read): the scored game's XP counts onto any
  // figure that doesn't include it yet (ProvisionalProgress.ts).
  private rereadProgress(): void {
    const publicId = this.publicId;
    if (publicId === null || this.progress === null) return;
    if (!this.isConnected || !this.isOpen() || !this.isOwn(publicId)) return;
    const gen = this.loadGeneration;
    const read = ++this.progressRead;
    void loadPlayerProgress(publicId).then((progress) => {
      if (gen !== this.loadGeneration || read !== this.progressRead) return;
      if (progress === null || this.publicId !== publicId) return;
      this.progress = progress;
    });
  }

  private progressView() {
    return this.progress === null
      ? null
      : provisionalProgress(this.publicId, this.progress);
  }

  protected modalConfig() {
    return {
      maxWidth: "960px",
      tabs: [
        { key: "stats", label: translateText("account_modal.tab_stats") },
        { key: "games", label: translateText("account_modal.tab_games") },
        { key: "clans", label: translateText("account_modal.tab_clans") },
        // Only for a player with a level: there is nothing to show otherwise.
        ...(this.progress === null
          ? []
          : [
              {
                key: "progression",
                label: translateText("account_modal.tab_progression"),
              },
            ]),
      ],
    };
  }

  protected renderHeaderSlot() {
    return modalHeader({
      title: translateText("player_profile.title"),
      // The account username takes over the title when set — not uppercased
      // like the default title, since name casing is meaningful — and the
      // right chip then always shows the publicId.
      titleContent: this.username
        ? html`<span
            class="text-white text-xl lg:text-2xl font-bold tracking-wide break-words hyphens-auto min-w-0 inline-flex items-center gap-2"
          >
            ${usernameText(this.username)}
            ${isVerifiedUsername(this.username)
              ? verifiedBadge("w-5 h-5")
              : nothing}
          </span>`
        : undefined,
      onBack: () => this.back(),
      ariaLabel: translateText("common.back"),
      rightContent: this.publicId
        ? html`
            <div class="flex items-center gap-2">
              <span
                class="text-xs bg-white/10 border border-white/20 text-yellow-300 font-mono font-bold px-2.5 py-1 rounded tracking-wider shadow-sm select-all cursor-pointer hover:bg-white/15 transition-colors"
                title="Permanente Spieler-ID"
                @click=${() => {
                  if (this.publicId) {
                    navigator.clipboard.writeText(this.publicId);
                  }
                }}
              >
                🆔 ${this.publicId}
              </span>
              <player-name
                class="shrink-0"
                .publicId=${this.publicId}
                .copyText=${playerProfileUrl(this.publicId)}
              ></player-name>
            </div>
          `
        : undefined,
    });
  }

  protected renderBody(tab: string) {
    return html`
      <div class="custom-scrollbar mr-1">
        <div class="p-6">${this.renderTab(tab)}</div>
      </div>
    `;
  }

  private renderTab(tab: string) {
    switch (tab) {
      case "games":
        return this.renderGames();
      case "clans":
        return this.renderClans();
      case "progression":
        return this.renderProgression();
      default:
        return this.renderProfile();
    }
  }

  // Clans ride along on the profile response — no extra fetch.
  private renderClans() {
    if (this.loading) {
      return this.renderLoadingSpinner(translateText("player_profile.loading"));
    }
    // A failed load leaves clans empty, which would read as "in no clans".
    if (!this.profileLoaded()) {
      return this.renderNotFound();
    }
    if (this.clans.length === 0) {
      return html`
        <div class="flex flex-col items-center justify-center p-12 text-center">
          <span class="text-4xl mb-4">🛡️</span>
          <p class="text-white/40 text-sm">
            ${translateText("player_profile.no_clans")}
          </p>
        </div>
      `;
    }
    return html`
      <div class="space-y-3">
        ${this.clans.map(
          (clan) => html`
            <clan-card
              .clan=${{
                tag: clan.tag,
                name: clan.name,
                description: "",
                isOpen: false,
                memberCount: clan.memberCount,
                softBalance: clan.softBalance,
                hardBalance: clan.hardBalance,
              }}
              .clanRole=${clan.role}
              @clan-select=${(e: CustomEvent<{ tag: string }>) =>
                this.openClan(e.detail.tag)}
            ></clan-card>
          `,
        )}
      </div>
    `;
  }

  // Hand off to the clan modal, telling it which profile to come back to and
  // where that profile's own Back button leads. The origin travels with the
  // handoff rather than being parked here: the clan modal can route on to
  // another player's profile, which reuses this element, and only the clan
  // modal knows how deep that chain of detours went.
  private openClan(tag: string): void {
    const publicId = this.publicId;
    if (publicId === null) return;
    document
      .querySelector<
        HTMLElement & {
          openFromProfile(
            tag: string,
            publicId: string,
            origin: ProfileOrigin | null,
          ): void;
        }
      >("clan-modal")
      ?.openFromProfile(tag, publicId, this.openedFrom);
  }

  // Called by the clan modal's Back button, handing back the origin openClan()
  // gave it. Reloads rather than restoring: the detour can rename a clan or
  // change this player's role or member count.
  public returnFromClan(publicId: string, origin: ProfileOrigin | null): void {
    this.open({ publicID: publicId, tab: "clans" });
    // open() cleared openedFrom; put this profile's own origin back.
    this.openedFrom = origin;
  }

  private renderGames() {
    const publicId = this.publicId;
    if (!publicId) {
      return html`
        <div class="flex flex-col items-center justify-center p-12 text-center">
          <span class="text-4xl mb-4">🎮</span>
          <p class="text-white/40 text-sm">
            ${translateText("account_modal.no_games")}
          </p>
        </div>
      `;
    }
    return html`
      <player-game-history-view
        .publicId=${publicId}
        .cachedState=${this.gameHistoryCache?.publicId === publicId
          ? this.gameHistoryCache
          : null}
        @history-updated=${(e: CustomEvent<PlayerGameHistoryCache>) => {
          this.gameHistoryCache = e.detail;
        }}
        @view-stats=${(e: CustomEvent<{ gameId: string }>) =>
          this.openGameStats(e.detail.gameId)}
        @view-game=${(e: CustomEvent<{ gameId: string }>) =>
          this.viewGame(e.detail.gameId)}
      ></player-game-history-view>
    `;
  }

  private renderProfile() {
    if (this.loading) {
      return this.renderLoadingSpinner(translateText("player_profile.loading"));
    }
    const publicId = this.publicId;
    if (!this.profileLoaded() || publicId === null) {
      return this.renderNotFound();
    }
    // The card heads the stats; games and wins stay in the stats below it,
    // and the ways to share the profile follow it.
    const view = this.progressView();
    return html`
      ${view === null
        ? nothing
        : html`<profile-card
            class="mb-4 block"
            .username=${this.username ?? this.publicId ?? ""}
            .clanTag=${this.displayClanTag}
            .progress=${view.progress}
            .provisional=${view.provisional}
            .openKey=${`profile-${this.openCount}`}
          ></profile-card>`}
      ${this.renderBioAndEquipment(publicId)}
      <profile-share
        class="mb-[18px] block"
        .url=${playerProfileUrl(publicId)}
        .name=${this.username ?? publicId}
      ></profile-share>
      <player-stats-tree-view
        .statsTree=${this.statsTree}
      ></player-stats-tree-view>
      ${this.renderCommentsSection(publicId)}
    `;
  }

  private async handleAddComment(publicId: string) {
    const text = this.commentInput.trim();
    if (!text) return;
    this.submittingComment = true;
    try {
      const added = await addProfileComment(publicId, text);
      if (added) {
        this.comments = [added, ...this.comments];
        this.commentInput = "";
        showToast("Kommentar hinzugefügt!", "green");
      } else {
        showToast(
          "Kommentar konnte nicht gesendet werden (Anmeldung erforderlich)",
          "red",
        );
      }
    } finally {
      this.submittingComment = false;
    }
  }

  private async handleDeleteComment(publicId: string, commentId: string) {
    const ok = await deleteProfileComment(publicId, commentId);
    if (ok) {
      this.comments = this.comments.filter((c) => c.id !== commentId);
      showToast("Kommentar gelöscht", "green");
    } else {
      showToast("Kommentar konnte nicht gelöscht werden", "red");
    }
  }

  private openCommenterProfile(authorPublicId: string) {
    if (!authorPublicId || authorPublicId === this.publicId) return;
    this.open({ publicID: authorPublicId });
  }

  private renderCommentsSection(publicId: string) {
    const isOwn = this.isOwn(publicId);
    return html`
      <div
        class="mt-6 bg-white/5 rounded-2xl border border-white/10 p-5 space-y-4"
      >
        <div
          class="flex items-center justify-between border-b border-white/10 pb-3"
        >
          <div class="flex items-center gap-2">
            <span class="text-lg">💬</span>
            <h3 class="text-sm font-bold uppercase tracking-wider text-white">
              Gästebuch / Kommentare
            </h3>
            <span
              class="text-xs px-2 py-0.5 rounded-full bg-white/10 text-white/70 font-mono"
            >
              ${this.comments.length}
            </span>
          </div>
        </div>

        <!-- Add Comment Input -->
        <div class="flex flex-col sm:flex-row gap-2.5">
          <input
            type="text"
            maxlength="300"
            .value=${this.commentInput}
            @input=${(e: Event) =>
              (this.commentInput = (e.target as HTMLInputElement).value)}
            @keydown=${(e: KeyboardEvent) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                void this.handleAddComment(publicId);
              }
            }}
            placeholder="Schreibe einen Kommentar auf dieser Profilseite..."
            class="flex-1 px-4 py-2.5 bg-white/5 border border-white/10 rounded-xl text-white placeholder-white/30 text-xs focus:outline-none focus:ring-2 focus:ring-malibu-blue/50 focus:border-malibu-blue/50 transition-all"
            ?disabled=${this.submittingComment}
          />
          <button
            type="button"
            @click=${() => void this.handleAddComment(publicId)}
            ?disabled=${this.submittingComment ||
            this.commentInput.trim().length === 0}
            class="px-5 py-2.5 rounded-xl bg-malibu-blue hover:bg-aquarius disabled:opacity-50 disabled:pointer-events-none text-black font-bold text-xs uppercase tracking-wider transition-all cursor-pointer shadow flex items-center justify-center gap-1.5 shrink-0"
          >
            <span>Senden</span>
            <span>✉️</span>
          </button>
        </div>

        <!-- Comments List -->
        ${this.comments.length === 0
          ? html`
              <div
                class="p-6 text-center text-xs text-white/40 italic bg-white/[0.02] rounded-xl border border-dashed border-white/10"
              >
                Noch keine Kommentare vorhanden. Sei der Erste, der etwas
                hinterlässt!
              </div>
            `
          : html`
              <div class="space-y-2.5">
                ${this.comments.map((c) => {
                  const isAuthor = this.isOwn(c.authorPublicId);
                  const canDelete = isAuthor || isOwn;
                  const formattedDate = new Date(c.createdAt).toLocaleString(
                    "de-DE",
                    {
                      day: "2-digit",
                      month: "2-digit",
                      year: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                    },
                  );

                  return html`
                    <div
                      class="p-3.5 bg-white/[0.04] hover:bg-white/[0.07] rounded-xl border border-white/10 transition-colors space-y-1.5"
                    >
                      <div class="flex items-center justify-between gap-2">
                        <div
                          class="flex items-center gap-2 cursor-pointer group"
                          @click=${() =>
                            this.openCommenterProfile(c.authorPublicId)}
                          title="Profil ansehen"
                        >
                          <div
                            class="w-6 h-6 rounded-full bg-slate-800 border border-white/20 group-hover:border-blue-400 flex items-center justify-center text-[10px] font-bold text-white transition-colors"
                          >
                            ${c.authorUsername.charAt(0).toUpperCase()}
                          </div>
                          <span
                            class="text-xs font-bold text-white group-hover:text-blue-300 group-hover:underline transition-colors"
                          >
                            ${c.authorUsername}
                          </span>
                        </div>
                        <div class="flex items-center gap-2">
                          <span
                            class="text-[10px] font-mono text-white/40 flex items-center gap-1"
                          >
                            <span>🕒</span>
                            <span>${formattedDate} Uhr</span>
                          </span>
                          ${canDelete
                            ? html`
                                <button
                                  type="button"
                                  @click=${() =>
                                    void this.handleDeleteComment(
                                      publicId,
                                      c.id,
                                    )}
                                  class="text-white/30 hover:text-red-400 p-1 rounded transition-colors cursor-pointer text-xs"
                                  title="Kommentar löschen"
                                >
                                  ✕
                                </button>
                              `
                            : nothing}
                        </div>
                      </div>
                      <p
                        class="text-xs text-white/80 leading-relaxed break-words pl-8"
                      >
                        ${c.text}
                      </p>
                    </div>
                  `;
                })}
              </div>
            `}
      </div>
    `;
  }

  private getAvailableBadges(): BadgeInfo[] {
    const list: BadgeInfo[] = [
      resolveBadgeInfo("starter:pionier"),
      resolveBadgeInfo("streak:10"),
    ];
    if (this.clans.some((c) => c.role === "leader")) {
      list.push(resolveBadgeInfo("clan:founder"));
    }
    const lvl = this.progress?.level ?? 1;
    if (lvl >= 10) list.push(resolveBadgeInfo("level:10"));
    if (lvl >= 25) list.push(resolveBadgeInfo("level:25"));
    if (lvl >= 50) list.push(resolveBadgeInfo("level:50"));

    for (const ach of this.soloAchievements) {
      list.push(resolveBadgeInfo(`solo:${ach.mapName}:${ach.difficulty}`));
    }
    const equipped =
      typeof SteelStoreService?.getEquipped === "function"
        ? SteelStoreService.getEquipped()
        : {};
    if (equipped["titel"]) list.push(resolveBadgeInfo(equipped["titel"]));
    if (equipped["badges"]) list.push(resolveBadgeInfo(equipped["badges"]));

    const seen = new Set<string>();
    return list.filter((b) => {
      if (seen.has(b.id)) return false;
      seen.add(b.id);
      return true;
    });
  }

  private handleFeaturedRankChange = (e: Event) => {
    const select = e.target as HTMLSelectElement;
    const mode = select.value as "1v1" | "2v2" | "ffa";
    this.featuredRankMode = mode;
    void savePlayerProfile({
      bio: this.profileBio,
      featuredRankMode: mode,
      showcasedBadges: this.showcasedBadges,
    });
    showToast(
      `Hervorgehobener Rang auf ${mode.toUpperCase()} gesetzt!`,
      "green",
    );
  };

  private handleSaveBio = async () => {
    const trimmed = this.bioDraft.trim().slice(0, 200);
    this.profileBio = trimmed;
    this.editingBio = false;
    await savePlayerProfile({
      bio: trimmed,
      featuredRankMode: this.featuredRankMode,
      showcasedBadges: this.showcasedBadges,
    });
    showToast("Biografie erfolgreich gespeichert!", "green");
  };

  private toggleBadgeSelection = (badgeId: string) => {
    if (this.showcasedBadges.includes(badgeId)) {
      this.showcasedBadges = this.showcasedBadges.filter(
        (id) => id !== badgeId,
      );
    } else {
      if (this.showcasedBadges.length >= 5) {
        showToast("Maximal 5 Badges können ausgestellt werden!", "red");
        return;
      }
      this.showcasedBadges = [...this.showcasedBadges, badgeId];
    }
  };

  private handleSaveBadges = async () => {
    this.editingBadges = false;
    await savePlayerProfile({
      bio: this.profileBio,
      featuredRankMode: this.featuredRankMode,
      showcasedBadges: this.showcasedBadges,
    });
    showToast("Ausgestellte Badges aktualisiert!", "green");
  };

  private renderBioAndEquipment(publicId: string) {
    const isOwn = this.isOwn(publicId);
    const rankInfo = this.ranks[this.featuredRankMode] ?? {
      elo: 800,
      tier: "Eisen",
    };
    const currentRankTier = rankInfo.tier;
    const currentRankElo = rankInfo.elo;
    const modeLabel =
      this.featuredRankMode === "1v1"
        ? "1v1"
        : this.featuredRankMode === "2v2"
          ? "2v2"
          : "FFA";

    return html`
      <div
        class="mb-4 bg-white/5 rounded-xl border border-white/10 p-5 space-y-5"
      >
        <!-- 1. Featured Rank Selector / Display -->
        <div
          class="flex flex-wrap items-center justify-between gap-3 p-3.5 bg-black/30 rounded-xl border border-white/10"
        >
          <div class="flex items-center gap-3">
            <span class="p-2 rounded-lg bg-amber-500/20 text-amber-400">
              <svg class="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                <path
                  d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"
                />
              </svg>
            </span>
            <div>
              <div
                class="text-[10px] uppercase font-bold text-white/50 tracking-wider"
              >
                Hervorgehobener Rang
              </div>
              <div class="text-sm font-bold text-white flex items-center gap-2">
                <span>${currentRankTier}</span>
                <span
                  class="text-xs px-2 py-0.5 rounded-full bg-white/10 text-white/70 font-mono"
                >
                  ${currentRankElo} ELO
                </span>
                <span class="text-xs text-white/40">(${modeLabel})</span>
              </div>
            </div>
          </div>
          ${isOwn
            ? html`
                <div class="flex items-center gap-2">
                  <label class="text-xs text-white/50 font-bold"
                    >Rangliste:</label
                  >
                  <select
                    class="bg-white/10 border border-white/20 text-white text-xs rounded-lg px-2.5 py-1.5 focus:outline-none focus:border-malibu-blue cursor-pointer"
                    .value=${this.featuredRankMode}
                    @change=${this.handleFeaturedRankChange}
                  >
                    <option
                      value="1v1"
                      ?selected=${this.featuredRankMode === "1v1"}
                    >
                      1v1 Ranked
                    </option>
                    <option
                      value="2v2"
                      ?selected=${this.featuredRankMode === "2v2"}
                    >
                      2v2 Ranked
                    </option>
                    <option
                      value="ffa"
                      ?selected=${this.featuredRankMode === "ffa"}
                    >
                      FFA Ranked
                    </option>
                  </select>
                </div>
              `
            : nothing}
        </div>

        <!-- 2. Badges Showcase (Max 5 Slots) -->
        <div class="space-y-2.5">
          <div class="flex items-center justify-between">
            <span
              class="text-xs uppercase font-bold text-white/50 tracking-wider flex items-center gap-1.5"
            >
              <span>🛡️</span>
              <span
                >Ausgestellte Badges (${this.showcasedBadges.length}/5)</span
              >
            </span>
            ${isOwn
              ? html`
                  <button
                    type="button"
                    @click=${() => (this.editingBadges = !this.editingBadges)}
                    class="text-xs font-semibold text-malibu-blue hover:text-aquarius cursor-pointer flex items-center gap-1"
                  >
                    <span
                      >${this.editingBadges
                        ? "Schließen"
                        : "⚙️ Badges verwalten"}</span
                    >
                  </button>
                `
              : nothing}
          </div>

          <!-- Badges Grid / Row -->
          <div class="grid grid-cols-1 sm:grid-cols-5 gap-2.5">
            ${[0, 1, 2, 3, 4].map((slotIdx) => {
              const badgeId = this.showcasedBadges[slotIdx];
              if (badgeId) {
                const info = resolveBadgeInfo(badgeId);
                return html`
                  <div
                    class="relative group/badge flex items-center gap-2 p-2.5 rounded-xl border ${info.colorClass} transition-all cursor-help"
                    title="${info.origin}"
                  >
                    <span class="text-base shrink-0">${info.icon}</span>
                    <span class="text-xs font-bold truncate">${info.name}</span>
                    <!-- Hover Tooltip -->
                    <div
                      class="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover/badge:flex flex-col p-2.5 bg-gray-950/95 border border-white/20 rounded-xl shadow-xl z-50 text-left min-w-[180px] max-w-[240px] pointer-events-none backdrop-blur-md"
                    >
                      <span
                        class="text-xs font-bold text-white mb-0.5 flex items-center gap-1.5"
                      >
                        <span>${info.icon}</span>
                        <span>${info.name}</span>
                      </span>
                      <span class="text-[11px] text-amber-300/90 leading-tight">
                        ${info.origin}
                      </span>
                    </div>
                  </div>
                `;
              }
              return html`
                <div
                  class="flex items-center justify-center p-2.5 rounded-xl border border-dashed border-white/10 text-white/20 text-xs font-medium"
                >
                  Slot ${slotIdx + 1}
                </div>
              `;
            })}
          </div>

          <!-- Badges Picker (if editing) -->
          ${isOwn && this.editingBadges
            ? html`
                <div
                  class="mt-3 p-4 bg-black/40 rounded-xl border border-white/15 space-y-3"
                >
                  <div class="text-xs font-bold text-white/80">
                    Wähle bis zu 5 freigeschaltete Badges zum Ausstellen:
                  </div>
                  <div
                    class="flex flex-wrap gap-2 max-h-48 overflow-y-auto pr-1"
                  >
                    ${this.getAvailableBadges().map((badge) => {
                      const isSelected = this.showcasedBadges.includes(
                        badge.id,
                      );
                      return html`
                        <button
                          type="button"
                          @click=${() => this.toggleBadgeSelection(badge.id)}
                          class="px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer border ${isSelected
                            ? "bg-amber-500/30 text-amber-300 border-amber-400"
                            : "bg-white/5 text-white/60 border-white/10 hover:bg-white/10"}"
                          title="${badge.origin}"
                        >
                          <span>${badge.icon}</span>
                          <span>${badge.name}</span>
                          ${isSelected ? html`<span>✓</span>` : nothing}
                        </button>
                      `;
                    })}
                  </div>
                  <div class="flex justify-end pt-2">
                    <button
                      type="button"
                      @click=${this.handleSaveBadges}
                      class="px-4 py-1.5 rounded-lg bg-malibu-blue hover:bg-aquarius text-white text-xs font-bold cursor-pointer transition-colors"
                    >
                      Auswahl speichern
                    </button>
                  </div>
                </div>
              `
            : nothing}
        </div>

        <!-- 3. Bio Section -->
        <div class="border-t border-white/10 pt-3">
          <div class="flex items-center justify-between mb-2">
            <span
              class="text-xs uppercase font-bold text-white/50 tracking-wider flex items-center gap-1.5"
            >
              <svg
                class="w-3.5 h-3.5 text-white/40"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
              >
                <path
                  d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"
                />
                <polyline points="14 2 14 8 20 8" />
                <line x1="16" y1="13" x2="8" y2="13" />
                <line x1="16" y1="17" x2="8" y2="17" />
                <polyline points="10 9 9 9 8 9" />
              </svg>
              <span>Biografie</span>
            </span>
            ${isOwn && !this.editingBio
              ? html`
                  <button
                    type="button"
                    @click=${() => {
                      this.bioDraft = this.profileBio;
                      this.editingBio = true;
                    }}
                    class="text-xs font-semibold text-malibu-blue hover:text-aquarius cursor-pointer flex items-center gap-1"
                  >
                    <svg
                      class="w-3.5 h-3.5"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      stroke-width="2"
                    >
                      <path d="M12 20h9" />
                      <path
                        d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"
                      />
                    </svg>
                    <span
                      >${this.profileBio
                        ? "Bearbeiten"
                        : "+ Bio hinzufügen"}</span
                    >
                  </button>
                `
              : nothing}
          </div>

          ${isOwn && this.editingBio
            ? html`
                <div class="space-y-2">
                  <textarea
                    maxlength="200"
                    rows="3"
                    class="w-full px-3 py-2 bg-black/40 border border-white/20 rounded-lg text-white text-sm placeholder-white/30 focus:outline-none focus:ring-1 focus:ring-malibu-blue resize-none"
                    placeholder="Erzähle kurz etwas über dich... (max. 200 Zeichen)"
                    .value=${this.bioDraft}
                    @input=${(e: Event) => {
                      this.bioDraft = (
                        e.target as HTMLTextAreaElement
                      ).value.slice(0, 200);
                    }}
                  ></textarea>
                  <div
                    class="flex items-center justify-between text-xs text-white/40"
                  >
                    <span>${this.bioDraft.length} / 200 Zeichen</span>
                    <div class="flex gap-2">
                      <button
                        type="button"
                        @click=${() => (this.editingBio = false)}
                        class="px-3 py-1 rounded bg-white/10 hover:bg-white/20 text-white font-medium cursor-pointer"
                      >
                        Abbrechen
                      </button>
                      <button
                        type="button"
                        @click=${this.handleSaveBio}
                        class="px-3 py-1 rounded bg-malibu-blue hover:bg-aquarius text-white font-bold cursor-pointer"
                      >
                        Speichern
                      </button>
                    </div>
                  </div>
                </div>
              `
            : html`
                <p
                  class="text-sm text-white/80 ${this.profileBio
                    ? "italic"
                    : "text-white/40 not-italic"}"
                >
                  ${this.profileBio
                    ? `"${this.profileBio}"`
                    : isOwn
                      ? "Noch keine Biografie eingetragen. Klicke auf '+ Bio hinzufügen'."
                      : "Keine Biografie angegeben."}
                </p>
              `}
        </div>
      </div>
    `;
  }

  private renderProgression() {
    // The tab is hidden without progress; should it still be selected (a new
    // player opened on top), show the Stats content rather than nothing.
    const view = this.progressView();
    if (view === null) return this.renderProfile();
    // Keyed like the card's flourish: the tab pops in once per opening, not
    // again on a tab switch.
    return html`<profile-progression
      .progress=${view.progress}
      .confirmedLevel=${view.confirmedLevel}
      .provisional=${view.provisional}
      .publicId=${this.publicId}
      .popKey=${`profile-${this.openCount}`}
    ></profile-progression>`;
  }

  // False when the fetch failed (missing player, network, bad schema).
  private profileLoaded(): boolean {
    return !!this.publicId && !!this.statsTree;
  }

  private renderNotFound() {
    return html`
      <div
        class="mx-auto flex max-w-2xl flex-col items-center px-6 py-12 text-center"
        data-not-found
      >
        <div
          class="mb-5 flex h-20 w-20 items-center justify-center rounded-full border border-white/10 bg-white/5 text-white/50"
        >
          <svg
            width="40"
            height="40"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="1.8"
            stroke-linecap="round"
            stroke-linejoin="round"
            aria-hidden="true"
          >
            <circle cx="9" cy="8" r="4" />
            <path d="M2 21v-1a6 6 0 0 1 6-6h2a6 6 0 0 1 3 .8" />
            <path d="M17 14.5a2.5 2.5 0 1 1 3.2 2.4c-.7.2-1.2.8-1.2 1.6" />
            <path d="M19 21h.01" />
          </svg>
        </div>
        <h2 class="text-xl font-bold text-white">
          ${translateText("player_profile.not_found_title")}
        </h2>
        <p class="mt-2 max-w-md text-sm text-white/60">
          ${translateText("player_profile.not_found_body")}
        </p>
        ${this.openedLink === null
          ? nothing
          : html`<p
              class="mt-3 break-all font-mono text-xs text-white/35"
              data-opened-link
            >
              ${this.openedLink}
            </p>`}
        <!-- Side by side where there's room, stacked on a phone. -->
        <div
          class="mt-6 flex flex-col items-stretch justify-center gap-3 sm:flex-row sm:items-center"
          data-not-found-actions
        >
          <o-button
            variant="primary"
            size="md"
            translationKey="player_profile.play"
            data-action="play"
            @click=${() => this.goHome()}
          ></o-button>
          <o-button
            variant="secondary"
            size="md"
            translationKey="player_profile.view_leaderboard"
            data-action="leaderboard"
            @click=${() => this.openLeaderboard()}
          ></o-button>
        </div>
      </div>
    `;
  }

  // Close the profile onto the home page (the URL follows: see ModalRouter).
  private goHome(): void {
    this.close();
  }

  private openLeaderboard(): void {
    this.close();
    document
      .querySelector<HTMLElement & { open(): void }>("leaderboard-modal")
      ?.open();
  }

  // Opening another player's profile over this one: BaseModal syncs the URL
  // only when a modal first opens, which would leave it naming the last
  // player (its `/player/<id>` path, or its `#modal=` hash), with tab changes
  // written onto that and a reload opening the wrong profile. Hand the URL to
  // the new player as an in-app open does. The router ignores this while it
  // is the one opening the modal (from a path or the hash).
  public override open(args?: Record<string, unknown>): void {
    const wasOpen = this.isOpen();
    const before = this.publicId;
    super.open(args);
    if (wasOpen && this.isOpen() && this.publicId !== before) {
      modalRouter.syncOpened(this.routerName, args);
    }
  }

  protected onOpen(args?: Record<string, unknown>): void {
    const userMe = latestUserMeResponse();
    const myId = userMe ? userMe.player?.publicId : null;
    const publicId =
      typeof args?.publicID === "string" && args.publicID.length > 0
        ? args.publicID
        : typeof args?.publicId === "string" && args.publicId.length > 0
          ? args.publicId
          : (this.publicId ?? myId ?? null);

    if (
      this.restoreGamesScrollAfterOpen &&
      publicId !== null &&
      publicId === this.publicId
    ) {
      this.restoreGamesScrollAfterOpen = false;
      void this.restoreGamesScroll();
      return;
    }

    this.wantsProgressionTab =
      typeof args?.tab === "string"
        ? args.tab === "progression"
        : this.activeTab === "progression";
    if (this.wantsProgressionTab || this.activeTab === "progression") {
      this.activeTab = "stats";
    }

    this.openedFrom = null;
    this.openCount = ++profileOpenings;

    if (publicId !== this.publicId || !this.profileLoaded()) {
      this.publicId = publicId;
      this.username = null;
      this.statsTree = null;
      this.clans = [];
      this.displayClanTag = null;
      this.progress = null;
      this.comments = [];
      this.gameHistoryCache = null;
      this.gamesScrollTop = 0;
      this.restoreGamesScrollAfterOpen = false;
      this.openedLink =
        publicId !== null &&
        modalRouter.isPathRouted("profile") &&
        parsePlayerProfilePath(window.location.pathname) === publicId
          ? `${window.location.host}${window.location.pathname}`
          : null;
      this.loading = publicId !== null;
      if (publicId !== null) {
        void this.loadProfile(publicId);
      }
    }
  }

  private async loadProfile(publicId: string): Promise<void> {
    const gen = ++this.loadGeneration;
    const current = () =>
      gen === this.loadGeneration && this.publicId === publicId;
    const read = ++this.progressRead;
    void loadPlayerProgress(publicId).then((progress) => {
      if (!current() || read !== this.progressRead) return;
      this.progress = progress;
      const wanted = this.wantsProgressionTab;
      this.wantsProgressionTab = false;
      if (
        wanted &&
        progress !== null &&
        this.activeTab === "stats" &&
        this.isOpen()
      ) {
        this.setActiveTab("progression");
      }
    });

    void fetchProfileComments(publicId).then((cmts) => {
      if (!current()) return;
      this.comments = cmts;
    });

    const profile = await fetchPublicPlayerProfile(publicId);
    if (!current()) return;
    this.loading = false;
    if (profile !== false) {
      this.statsTree = profile.stats;
      this.username = profile.username ?? null;
      this.clans = profile.clans ?? [];
      this.displayClanTag = profile.displayClanTag ?? null;
      this.profileBio = profile.bio ?? "";
      this.featuredRankMode = profile.featuredRankMode ?? "ffa";
      this.showcasedBadges = profile.showcasedBadges ?? [];
      this.soloAchievements = profile.achievements?.singleplayerMap ?? [];
      this.ranks = profile.ranks ?? {};
    } else {
      const me = latestUserMeResponse();
      if (me && me.player?.publicId === publicId) {
        this.username = me.player.username ?? null;
        this.clans = me.player.clans ?? [];
        this.displayClanTag = (me.player.clans as any)?.[0]?.tag ?? null;
        this.profileBio = me.user?.bio ?? "";
        this.featuredRankMode = me.user?.featuredRankMode ?? "ffa";
        this.showcasedBadges = me.user?.showcasedBadges ?? [];
        this.soloAchievements = me.player.achievements?.singleplayerMap ?? [];
        const ffaElo = me.player?.leaderboard?.ffa?.elo ?? 800;
        const oneVOneElo = me.player?.leaderboard?.oneVone?.elo ?? 800;
        const twoVTwoElo = me.player?.leaderboard?.twoVtwo?.elo ?? 800;
        this.ranks = {
          "1v1": { elo: oneVOneElo, tier: "Eisen" },
          "2v2": { elo: twoVTwoElo, tier: "Eisen" },
          ffa: { elo: ffaElo, tier: "Eisen" },
        };
        this.statsTree = {
          Public: {
            "Free For All": {
              Medium: {
                wins: 0n,
                losses: 0n,
                total: 0n,
                stats: {},
              },
            },
          },
        };
      } else {
        this.statsTree = null;
        this.username = null;
        this.clans = [];
        this.displayClanTag = null;
        this.profileBio = "";
        this.featuredRankMode = "ffa";
        this.showcasedBadges = [];
        this.soloAchievements = [];
        this.ranks = {};
      }
    }
  }

  // Intentionally preserves publicId/statsTree/history cache/scroll: the page
  // router closes this modal when the game-stats page opens on top, and the
  // return flow (returnToGames) needs that state intact. onOpen resets it for a
  // genuinely new player. Mirrors the account modal.
  protected onClose(): void {}

  // Open the game-stats modal on top for a game in this player's history. Stash
  // the scroll offset so returning restores it (see returnToGames()).
  private openGameStats(gameId: string): void {
    this.gamesScrollTop = this.modalEl?.getScrollTop() ?? 0;
    const statsModal = document.querySelector<
      HTMLElement & {
        openFromProfile(gameId: string, profilePublicId?: string): void;
      }
    >("game-stats-modal");
    statsModal?.openFromProfile(gameId, this.publicId ?? undefined);
  }

  private viewGame(gameId: string): void {
    this.close();
    const encodedGameId = encodeURIComponent(gameId);
    const newUrl = currentPagePath(ClientEnv.gamePath(gameId));

    history.pushState({ join: gameId }, "", newUrl);
    window.dispatchEvent(
      new CustomEvent("join-changed", { detail: { gameId: encodedGameId } }),
    );
  }

  // Called by the game-stats modal's back button when it was opened from here.
  public returnToGames(): void {
    this.restoreGamesScrollAfterOpen = true;
    this.open({ publicID: this.publicId ?? undefined, tab: "games" });
  }

  private async restoreGamesScroll(): Promise<void> {
    await this.updateComplete;
    await this.modalEl?.updateComplete;
    const historyView = this.querySelector<
      HTMLElement & { updateComplete?: Promise<boolean> }
    >("player-game-history-view");
    await historyView?.updateComplete;
    this.modalEl?.setScrollTop(this.gamesScrollTop);
  }

  // Origin is set after open() in every openFrom* helper: onOpen clears it, and
  // back() only reads it later on the user's click, so assigning here survives
  // to route the back button home (and survives the game-stats detour, which
  // never re-runs onOpen's fresh path).
  public openFromClan(publicId: string): void {
    this.open({ publicID: publicId });
    this.openedFrom = "clan";
  }

  public openFromLeaderboard(publicId: string): void {
    this.open({ publicID: publicId });
    this.openedFrom = "leaderboard";
  }

  public openFromAccount(publicId: string): void {
    this.open({ publicID: publicId });
    this.openedFrom = "account";
  }

  public openFromFriends(publicId: string): void {
    this.open({ publicID: publicId });
    this.openedFrom = "friends";
  }

  private back(): void {
    const openedFrom = this.openedFrom;
    this.close();
    if (openedFrom === "clan") {
      document
        .querySelector<HTMLElement & { returnFromPlayerProfile(): void }>(
          "clan-modal",
        )
        ?.returnFromPlayerProfile();
    } else if (openedFrom === "leaderboard") {
      document
        .querySelector<HTMLElement & { open(): void }>("leaderboard-modal")
        ?.open();
    } else if (openedFrom === "account") {
      document
        .querySelector<HTMLElement & { returnToFriends(): void }>(
          "account-modal",
        )
        ?.returnToFriends();
    } else if (openedFrom === "friends") {
      document
        .querySelector<HTMLElement & { open(): void }>("friends-modal")
        ?.open();
    }
  }
}
