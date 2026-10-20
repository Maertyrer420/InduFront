import { html } from "lit";
import { customElement, state } from "lit/decorators.js";
import { getApiBase, getUserMe } from "./Api";
import { getAuthHeader } from "./Auth";
import { BaseModal } from "./components/BaseModal";
import { modalHeader } from "./components/ui/ModalHeader";
import { showToast } from "./Utils";

export interface GlobalChatMessage {
  id: string;
  senderId: string;
  senderName: string;
  senderClan?: string;
  senderTier: string;
  text: string;
  timestamp: string;
}

@customElement("global-chat-modal")
export class GlobalChatModal extends BaseModal {
  protected routerName = "chat";

  @state() private messages: GlobalChatMessage[] = [];
  @state() private input = "";
  @state() private sending = false;
  @state() private loading = false;
  @state() private signedOut = false;
  @state() private myPublicId: string | null = null;

  private pollInterval: any = null;

  protected modalConfig() {
    return {
      tabs: [],
    };
  }

  protected renderHeaderSlot() {
    return modalHeader({
      title: "💬 Globaler Chat",
      onBack: () => this.close(),
      ariaLabel: "Zurück",
    });
  }

  protected onOpen(): void {
    this.checkUser();
    this.loadMessages(true);
    if (this.pollInterval) clearInterval(this.pollInterval);
    this.pollInterval = setInterval(() => {
      this.loadMessages(false);
    }, 2500);
  }

  protected onClose(): void {
    if (this.pollInterval) {
      clearInterval(this.pollInterval);
      this.pollInterval = null;
    }
  }

  private async checkUser() {
    try {
      const me = await getUserMe();
      if (!me || !me.player || !me.player.publicId) {
        this.signedOut = true;
        this.myPublicId = null;
      } else {
        this.signedOut = false;
        this.myPublicId = me.player.publicId;
      }
    } catch {
      this.signedOut = true;
    }
  }

  private async loadMessages(initial = false) {
    if (initial) this.loading = true;
    try {
      const res = await fetch(`${getApiBase()}/chat/global?limit=60`, {
        headers: { Accept: "application/json" },
      });
      if (res.ok) {
        const data = await res.json();
        const prevCount = this.messages.length;
        this.messages = data.messages ?? [];
        if (initial || this.messages.length !== prevCount) {
          setTimeout(() => {
            const el = this.querySelector(".global-chat-scroll");
            if (el) el.scrollTop = el.scrollHeight;
          }, 50);
        }
      }
    } catch (err) {
      console.warn("loadMessages error:", err);
    } finally {
      if (initial) this.loading = false;
    }
  }

  private async handleSend(e: Event) {
    e.preventDefault();
    const text = this.input.trim();
    if (!text || this.sending) return;

    if (this.signedOut) {
      showToast("Bitte melde dich an, um eine Nachricht zu senden", "red");
      return;
    }

    this.sending = true;
    try {
      const res = await fetch(`${getApiBase()}/chat/global`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: await getAuthHeader(),
        },
        body: JSON.stringify({ text }),
      });

      if (res.ok) {
        this.input = "";
        await this.loadMessages(false);
      } else {
        const err = await res.json().catch(() => ({}));
        showToast(err.error || "Nachricht konnte nicht gesendet werden", "red");
      }
    } catch {
      showToast("Netzwerkfehler", "red");
    } finally {
      this.sending = false;
    }
  }

  private renderTierBadge(tier: string) {
    let bg = "bg-stone-700/60 text-stone-300 border-stone-600";
    if (tier === "Top 10") bg = "bg-gradient-to-r from-red-600 to-amber-500 text-white border-amber-400 font-extrabold shadow-sm";
    else if (tier === "Elite") bg = "bg-purple-900/60 text-purple-300 border-purple-700 font-bold";
    else if (tier === "Expert") bg = "bg-indigo-900/60 text-indigo-300 border-indigo-700";
    else if (tier === "Diamond") bg = "bg-cyan-900/60 text-cyan-300 border-cyan-700";
    else if (tier === "Platinum") bg = "bg-teal-900/60 text-teal-300 border-teal-700";
    else if (tier === "Gold") bg = "bg-amber-900/60 text-amber-300 border-amber-700";
    else if (tier === "Silber") bg = "bg-slate-700/60 text-slate-300 border-slate-600";
    else if (tier === "Bronze") bg = "bg-amber-950/60 text-amber-600 border-amber-900";

    return html`<span class="text-[10px] uppercase tracking-wider px-2 py-0.5 rounded border ${bg}">
      ${tier}
    </span>`;
  }

  protected renderBody() {
    return html`
      <div class="flex flex-col h-[70vh] max-h-[640px] p-4">
        <!-- Message Container -->
        <div
          class="global-chat-scroll flex-1 overflow-y-auto space-y-3 pr-2 scrollbar-thin scrollbar-thumb-white/10"
        >
          ${this.loading
            ? html`<div class="flex items-center justify-center h-48 text-white/50 text-sm">
                Lade Chat...
              </div>`
            : this.messages.length === 0
              ? html`<div class="flex flex-col items-center justify-center h-48 text-white/40 text-sm">
                  <span class="text-3xl mb-2">💬</span>
                  Noch keine Nachrichten im globalen Chat. Sei der Erste!
                </div>`
              : this.messages.map((m) => {
                  const isMe = this.myPublicId && m.senderId.toLowerCase() === this.myPublicId.toLowerCase();
                  const time = new Date(m.timestamp).toLocaleTimeString([], {
                    hour: "2-digit",
                    minute: "2-digit",
                  });
                  return html`
                    <div
                      class="flex flex-col p-2.5 rounded-xl border ${
                        isMe
                          ? "bg-malibu-blue/10 border-malibu-blue/30 ml-6"
                          : "bg-white/5 border-white/5 mr-6"
                      } transition-all"
                    >
                      <div class="flex items-center justify-between gap-2 mb-1">
                        <div class="flex items-center gap-2 flex-wrap">
                          ${m.senderClan
                            ? html`<span
                                class="text-[10px] font-bold text-amber-400 bg-amber-500/10 border border-amber-500/20 px-1.5 py-0.5 rounded"
                                >[${m.senderClan}]</span
                              >`
                            : ""}
                          <span class="font-bold text-sm ${isMe ? "text-cyan-300" : "text-white"}">
                            ${m.senderName}
                          </span>
                          ${this.renderTierBadge(m.senderTier || "Wood")}
                        </div>
                        <span class="text-[10px] text-white/40 shrink-0">${time}</span>
                      </div>
                      <div class="text-sm text-white/90 break-words leading-relaxed pl-0.5">
                        ${m.text}
                      </div>
                    </div>
                  `;
                })}
        </div>

        <!-- Input Box -->
        <div class="mt-4 pt-3 border-t border-white/10">
          ${this.signedOut
            ? html`
                <div class="flex items-center justify-between p-3 rounded-xl bg-white/5 border border-white/10 text-sm">
                  <span class="text-white/60">Melde dich an, um am Chat teilzunehmen.</span>
                  <button
                    @click=${() => {
                      this.close();
                      window.showPage?.("page-account");
                    }}
                    class="px-4 py-1.5 text-xs font-bold text-white bg-malibu-blue hover:bg-aquarius rounded-lg transition-all"
                  >
                    Anmelden
                  </button>
                </div>
              `
            : html`
                <form @submit=${this.handleSend} class="flex items-center gap-2">
                  <input
                    type="text"
                    maxlength="500"
                    placeholder="Schreibe eine Nachricht an alle Spieler..."
                    .value=${this.input}
                    @input=${(e: Event) =>
                      (this.input = (e.target as HTMLInputElement).value)}
                    class="flex-1 bg-white/5 hover:bg-white/10 focus:bg-white/10 border border-white/10 focus:border-malibu-blue rounded-xl px-4 py-2.5 text-sm text-white placeholder-white/40 outline-none transition-all"
                  />
                  <button
                    type="submit"
                    ?disabled=${this.sending || !this.input.trim()}
                    class="px-5 py-2.5 bg-malibu-blue hover:bg-aquarius disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold text-sm rounded-xl flex items-center gap-2 transition-all shrink-0 shadow-lg shadow-malibu-blue/20"
                  >
                    ${this.sending
                      ? html`<span class="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>`
                      : html`<span>Senden</span>
                          <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4" viewBox="0 0 20 20" fill="currentColor">
                            <path d="M10.894 2.553a1 1 0 00-1.788 0l-7 14a1 1 0 001.169 1.409l5-1.429A1 1 0 009 15.571V11a1 1 0 112 0v4.571a1 1 0 00.725.962l5 1.428a1 1 0 001.17-1.408l-7-14z" />
                          </svg>`}
                  </button>
                </form>
              `}
        </div>
      </div>
    `;
  }
}
