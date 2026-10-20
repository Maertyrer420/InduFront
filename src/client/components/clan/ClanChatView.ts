import { html, LitElement } from "lit";
import { customElement, property, state } from "lit/decorators.js";
import { getApiBase } from "../../Api";
import { getAuthHeader } from "../../Auth";
import { renderTierBadge } from "../leaderboard/LeaderboardPlayerList";

export interface ClanChatMessage {
  id: string;
  senderId: string;
  senderName: string;
  senderRole: string;
  text: string;
  timestamp: string;
}

@customElement("clan-chat-view")
export class ClanChatView extends LitElement {
  createRenderRoot() {
    return this;
  }

  @property({ type: String }) clanTag = "";

  @state() private messages: ClanChatMessage[] = [];
  @state() private inputMessage = "";
  @state() private loading = false;
  @state() private sending = false;
  @state() private error = "";

  private pollInterval: any = null;

  connectedCallback() {
    super.connectedCallback();
    this.fetchChat();
    this.pollInterval = setInterval(() => this.fetchChat(false), 3000);
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    if (this.pollInterval) clearInterval(this.pollInterval);
  }

  private async fetchChat(showLoading = true) {
    if (!this.clanTag) return;
    if (showLoading && this.messages.length === 0) this.loading = true;
    try {
      const res = await fetch(`${getApiBase()}/clans/${encodeURIComponent(this.clanTag)}/chat`, {
        headers: {
          Accept: "application/json",
          Authorization: await getAuthHeader(),
        },
      });
      if (res.ok) {
        const data = await res.json();
        this.messages = data.messages ?? [];
        this.scrollToBottom();
      }
    } catch {
      // Ignored during polling
    } finally {
      this.loading = false;
    }
  }

  private scrollToBottom() {
    setTimeout(() => {
      const c = this.querySelector(".chat-messages-container");
      if (c) c.scrollTop = c.scrollHeight;
    }, 50);
  }

  private async sendMessage(e?: Event) {
    if (e) e.preventDefault();
    const text = this.inputMessage.trim();
    if (!text || this.sending) return;

    this.sending = true;
    this.error = "";
    try {
      const res = await fetch(`${getApiBase()}/clans/${encodeURIComponent(this.clanTag)}/chat`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: await getAuthHeader(),
        },
        body: JSON.stringify({ text }),
      });
      if (res.ok) {
        this.inputMessage = "";
        await this.fetchChat(false);
      } else {
        const body = await res.json().catch(() => ({}));
        this.error = body.error || "Fehler beim Senden";
      }
    } catch {
      this.error = "Netzwerkfehler beim Senden";
    } finally {
      this.sending = false;
    }
  }

  private renderRoleTag(role: string) {
    const r = (role ?? "").toLowerCase();
    if (r === "owner") {
      return html`<span class="px-2 py-0.5 text-[10px] font-bold rounded bg-yellow-500/20 text-yellow-300 border border-yellow-500/40">👑 Owner</span>`;
    }
    if (r === "admin") {
      return html`<span class="px-2 py-0.5 text-[10px] font-bold rounded bg-purple-500/20 text-purple-300 border border-purple-500/40">🛡️ Admin</span>`;
    }
    if (r === "supporter") {
      return html`<span class="px-2 py-0.5 text-[10px] font-bold rounded bg-teal-500/20 text-teal-300 border border-teal-500/40">🤝 Supporter</span>`;
    }
    return html`<span class="px-2 py-0.5 text-[10px] font-bold rounded bg-white/10 text-white/60 border border-white/20">👤 Mitglied</span>`;
  }

  render() {
    return html`
      <div class="flex flex-col h-[520px] bg-black/40 rounded-xl border border-white/10 overflow-hidden shadow-2xl">
        <!-- Header -->
        <div class="p-3.5 bg-white/5 border-b border-white/10 flex items-center justify-between">
          <div class="flex items-center gap-2">
            <span class="text-lg">💬</span>
            <span class="font-bold text-white tracking-wide">Persistenter Clan-Chat [${this.clanTag}]</span>
          </div>
          <span class="text-xs text-white/40">Alle Nachrichten werden dauerhaft gespeichert</span>
        </div>

        <!-- Messages Area -->
        <div class="chat-messages-container flex-1 p-4 overflow-y-auto space-y-3 scrollbar-thin scrollbar-thumb-white/20">
          ${this.loading && this.messages.length === 0
            ? html`
                <div class="flex items-center justify-center h-full text-white/40 text-sm">
                  Lade Chat...
                </div>
              `
            : this.messages.length === 0
              ? html`
                  <div class="flex flex-col items-center justify-center h-full text-white/40 text-sm gap-2">
                    <span class="text-3xl">📭</span>
                    <span>Noch keine Nachrichten in diesem Clan. Schreib die erste!</span>
                  </div>
                `
              : this.messages.map((m) => {
                  const time = new Date(m.timestamp).toLocaleTimeString([], {
                    hour: "2-digit",
                    minute: "2-digit",
                  });
                  return html`
                    <div class="flex flex-col gap-1 p-2.5 rounded-lg bg-white/5 hover:bg-white/[0.08] transition-colors">
                      <div class="flex items-center justify-between gap-2">
                        <div class="flex items-center gap-2 flex-wrap">
                          <span class="font-bold text-sm text-malibu-blue">${m.senderName}</span>
                          ${this.renderRoleTag(m.senderRole)}
                        </div>
                        <span class="text-[11px] text-white/40 font-mono">${time}</span>
                      </div>
                      <div class="text-sm text-white/90 break-words leading-relaxed pl-0.5">
                        ${m.text}
                      </div>
                    </div>
                  `;
                })}
        </div>

        <!-- Input Area -->
        <form
          @submit=${this.sendMessage}
          class="p-3 bg-black/60 border-t border-white/10 flex items-center gap-2"
        >
          <input
            type="text"
            maxlength="500"
            placeholder="Nachricht an den Clan schreiben..."
            class="flex-1 bg-white/5 border border-white/10 focus:border-malibu-blue rounded-lg px-4 py-2.5 text-sm text-white placeholder-white/30 outline-none transition-colors"
            .value=${this.inputMessage}
            @input=${(e: any) => (this.inputMessage = e.target.value)}
          />
          <button
            type="submit"
            ?disabled=${this.sending || !this.inputMessage.trim()}
            class="px-5 py-2.5 bg-malibu-blue hover:bg-malibu-blue/80 disabled:opacity-40 disabled:hover:bg-malibu-blue text-black font-bold text-sm rounded-lg transition-all cursor-pointer flex items-center gap-1.5 shrink-0"
          >
            ${this.sending ? "..." : "Senden"}
          </button>
        </form>
        ${this.error ? html`<div class="text-xs text-red-400 px-3 pb-2 bg-black/60">${this.error}</div>` : ""}
      </div>
    `;
  }
}
