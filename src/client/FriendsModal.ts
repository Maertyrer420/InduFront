import { html, TemplateResult } from "lit";
import { customElement, state } from "lit/decorators.js";
import { getApiBase, getUserMe } from "./Api";
import { getAuthHeader } from "./Auth";
import { BaseModal } from "./components/BaseModal";
import { modalHeader } from "./components/ui/ModalHeader";
import {
  acceptFriendRequest,
  deleteFriendRequest,
  fetchFriendRequests,
  fetchFriends,
  removeFriend,
  sendFriendRequest,
} from "./FriendsApi";
import { showToast, translateText } from "./Utils";

export interface DirectChatMessage {
  id: string;
  fromId: string;
  fromName: string;
  toId: string;
  toName: string;
  text: string;
  timestamp: string;
}

@customElement("friends-modal")
export class FriendsModal extends BaseModal {
  protected routerName = "friends";

  @state() private friends: any[] = [];
  @state() private onlineFriendsSet = new Set<string>();
  @state() private incoming: any[] = [];
  @state() private outgoing: any[] = [];
  @state() private loading = false;
  @state() private activeFriendChat: { publicId: string; username: string } | null = null;
  @state() private chatMessages: DirectChatMessage[] = [];
  @state() private chatInput = "";
  @state() private chatLoading = false;
  @state() private chatSending = false;
  @state() private addInput = "";
  @state() private adding = false;

  private pollInterval: any = null;

  protected modalConfig() {
    return {
      tabs: this.activeFriendChat
        ? []
        : [
            { key: "friends", label: `👥 Freunde (${this.friends.length})` },
            {
              key: "requests",
              label: `📬 Anfragen ${this.incoming.length > 0 ? `(${this.incoming.length})` : ""}`,
            },
            { key: "add", label: "➕ Hinzufügen" },
          ],
    };
  }

  protected onOpen() {
    this.activeFriendChat = null;
    this.loadData();
    if (this.pollInterval) clearInterval(this.pollInterval);
    this.pollInterval = setInterval(() => {
      this.refreshPresence();
      if (this.activeFriendChat) {
        this.fetchDirectChat(this.activeFriendChat.publicId, false);
      }
    }, 3000);
  }

  protected onClose() {
    if (this.pollInterval) clearInterval(this.pollInterval);
  }

  private async loadData() {
    this.loading = true;
    try {
      const [friendsRes, reqRes] = await Promise.all([
        fetchFriends(1, 100),
        fetchFriendRequests(),
      ]);
      if (friendsRes) {
        this.friends = friendsRes.results;
      }
      if (reqRes) {
        this.incoming = reqRes.incoming;
        this.outgoing = reqRes.outgoing;
      }
      await this.refreshPresence();
    } finally {
      this.loading = false;
    }
  }

  private async refreshPresence() {
    try {
      const res = await fetch(`${getApiBase()}/presence/summary`, {
        headers: {
          Accept: "application/json",
          Authorization: await getAuthHeader(),
        },
      });
      if (res.ok) {
        const data = await res.json();
        const onlineList = data.onlineFriends ?? [];
        this.onlineFriendsSet = new Set(onlineList.map((x: string) => x.toLowerCase()));
      }
    } catch {}
  }

  private openChatWithFriend(friend: { publicId: string; username: string }) {
    this.activeFriendChat = friend;
    this.chatMessages = [];
    this.fetchDirectChat(friend.publicId, true);
  }

  private async fetchDirectChat(friendId: string, showLoading = true) {
    if (showLoading) this.chatLoading = true;
    try {
      const res = await fetch(
        `${getApiBase()}/friends/chat/${encodeURIComponent(friendId)}`,
        {
          headers: {
            Accept: "application/json",
            Authorization: await getAuthHeader(),
          },
        },
      );
      if (res.ok) {
        const data = await res.json();
        this.chatMessages = data.messages ?? [];
        setTimeout(() => {
          const c = this.querySelector(".direct-chat-scroll");
          if (c) c.scrollTop = c.scrollHeight;
        }, 50);
      }
    } catch {}
    finally {
      this.chatLoading = false;
    }
  }

  private async sendDirectMessage(e?: Event) {
    if (e) e.preventDefault();
    if (!this.activeFriendChat || !this.chatInput.trim() || this.chatSending) return;

    const text = this.chatInput.trim();
    this.chatSending = true;
    try {
      const res = await fetch(
        `${getApiBase()}/friends/chat/${encodeURIComponent(this.activeFriendChat.publicId)}`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: await getAuthHeader(),
          },
          body: JSON.stringify({ text }),
        },
      );
      if (res.ok) {
        this.chatInput = "";
        await this.fetchDirectChat(this.activeFriendChat.publicId, false);
      } else {
        showToast("Fehler beim Senden", "red");
      }
    } catch {
      showToast("Netzwerkfehler", "red");
    } finally {
      this.chatSending = false;
    }
  }

  private async handleAddFriend(e: Event) {
    e.preventDefault();
    const target = this.addInput.trim();
    if (!target || this.adding) return;
    this.adding = true;
    try {
      const res = await sendFriendRequest(target);
      if (res) {
        showToast(
          res.status === "accepted"
            ? "Freundschaftsanfrage sofort akzeptiert!"
            : "Freundschaftsanfrage gesendet!",
          "green",
        );
        this.addInput = "";
        await this.loadData();
        this.activeTab = "friends";
      } else {
        showToast("Spieler nicht gefunden oder bereits angefragt", "red");
      }
    } finally {
      this.adding = false;
    }
  }

  private async handleAccept(publicId: string) {
    const ok = await acceptFriendRequest(publicId);
    if (ok) {
      showToast("Freund hinzugefügt!", "green");
      await this.loadData();
    }
  }

  private async handleDecline(publicId: string) {
    const ok = await deleteFriendRequest(publicId);
    if (ok) {
      await this.loadData();
    }
  }

  private async handleRemove(publicId: string) {
    if (confirm("Möchtest du diesen Freund wirklich entfernen?")) {
      const ok = await removeFriend(publicId);
      if (ok) {
        showToast("Freund entfernt", "amber");
        await this.loadData();
      }
    }
  }

  protected renderHeaderSlot() {
    if (this.activeFriendChat) {
      const isOnline = this.onlineFriendsSet.has(
        this.activeFriendChat.publicId.toLowerCase(),
      );
      return modalHeader({
        titleContent: html`
          <div class="flex items-center gap-3">
            <button
              @click=${() => (this.activeFriendChat = null)}
              class="px-2.5 py-1 text-xs font-bold bg-white/10 hover:bg-white/20 rounded-lg text-white transition-all flex items-center gap-1 cursor-pointer"
            >
              ⬅️ Zurück
            </button>
            <div class="flex items-center gap-2">
              <span class="w-2.5 h-2.5 rounded-full ${isOnline ? "bg-green-400" : "bg-white/30"}"></span>
              <span class="font-bold text-white text-lg">${this.activeFriendChat.username}</span>
              <span class="text-xs text-white/40 font-mono">(${isOnline ? "Online" : "Offline"})</span>
            </div>
          </div>
        `,
        onBack: () => (this.activeFriendChat = null),
      });
    }

    return modalHeader({
      title: "👥 Freunde & Freundes-Chat",
      onBack: () => this.close(),
    });
  }

  protected renderBody(): TemplateResult {
    if (this.activeFriendChat) {
      return this.renderDirectChat();
    }

    return html`
      <div class="p-4 lg:p-6 space-y-4">
        ${this.loading && this.friends.length === 0
          ? html`<div class="text-center p-8 text-white/40">Lade Freundesliste...</div>`
          : this.activeTab === "requests"
            ? this.renderRequestsTab()
            : this.activeTab === "add"
              ? this.renderAddTab()
              : this.renderFriendsListTab()}
      </div>
    `;
  }

  private renderFriendsListTab(): TemplateResult {
    if (this.friends.length === 0) {
      return html`
        <div class="flex flex-col items-center justify-center p-12 text-center bg-white/5 rounded-2xl border border-white/10">
          <span class="text-4xl mb-3">👥</span>
          <h3 class="text-base font-bold text-white/80 mb-1">Noch keine Freunde</h3>
          <p class="text-xs text-white/40 mb-4 max-w-sm">
            Füge Freunde per Benutzername oder ID hinzu, um ihren Online-Status zu sehen und direkt mit ihnen zu chatten!
          </p>
          <button
            @click=${() => (this.activeTab = "add")}
            class="px-5 py-2.5 bg-malibu-blue hover:bg-aquarius text-black font-bold text-xs uppercase tracking-wider rounded-xl transition-all cursor-pointer"
          >
            Freund hinzufügen
          </button>
        </div>
      `;
    }

    return html`
      <div class="space-y-3">
        ${this.friends.map((friend) => {
          const isOnline = this.onlineFriendsSet.has(
            friend.publicId.toLowerCase(),
          );
          return html`
            <div
              class="flex items-center justify-between p-3.5 bg-white/5 hover:bg-white/[0.08] rounded-xl border border-white/10 transition-all gap-3"
            >
              <div class="flex items-center gap-3 min-w-0">
                <div class="relative shrink-0">
                  <div
                    class="w-10 h-10 rounded-full bg-slate-800 border border-white/20 flex items-center justify-center font-bold text-white text-sm"
                  >
                    ${(friend.username || "?").charAt(0).toUpperCase()}
                  </div>
                  <span
                    class="absolute bottom-0 right-0 w-3 h-3 rounded-full border-2 border-black ${isOnline
                      ? "bg-green-400"
                      : "bg-slate-500"}"
                    title=${isOnline ? "Online" : "Offline"}
                  ></span>
                </div>
                <div class="min-w-0">
                  <div class="font-bold text-white text-sm truncate flex items-center gap-2">
                    <span>${friend.username || friend.publicId}</span>
                    <span
                      class="text-[10px] font-mono px-1.5 py-0.2 rounded ${isOnline
                        ? "bg-green-500/20 text-green-300 border border-green-500/30"
                        : "bg-white/5 text-white/40"}"
                    >
                      ${isOnline ? "Online" : "Offline"}
                    </span>
                  </div>
                  <div class="text-[11px] text-white/40 font-mono">
                    ID: ${friend.publicId}
                  </div>
                </div>
              </div>

              <!-- Actions -->
              <div class="flex items-center gap-2 shrink-0">
                <button
                  @click=${() => this.openChatWithFriend(friend)}
                  class="px-3.5 py-1.5 bg-malibu-blue hover:bg-aquarius text-black font-bold text-xs rounded-lg transition-all flex items-center gap-1.5 cursor-pointer shadow-sm"
                  title="Direktchat öffnen"
                >
                  <span>💬</span>
                  <span>Chat</span>
                </button>
                <button
                  @click=${() => this.handleRemove(friend.publicId)}
                  class="p-2 text-white/30 hover:text-red-400 transition-colors cursor-pointer rounded-lg hover:bg-red-500/10"
                  title="Freund entfernen"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                </button>
              </div>
            </div>
          `;
        })}
      </div>
    `;
  }

  private renderDirectChat(): TemplateResult {
    return html`
      <div class="flex flex-col h-[520px] bg-black/40 rounded-xl border border-white/10 overflow-hidden shadow-2xl">
        <!-- Messages Area -->
        <div class="direct-chat-scroll flex-1 p-4 overflow-y-auto space-y-3 scrollbar-thin scrollbar-thumb-white/20">
          ${this.chatLoading && this.chatMessages.length === 0
            ? html`<div class="text-center p-8 text-white/40 text-sm">Lade Nachrichten...</div>`
            : this.chatMessages.length === 0
              ? html`
                  <div class="flex flex-col items-center justify-center h-full text-white/40 text-sm gap-2">
                    <span class="text-3xl">💬</span>
                    <span>Keine vorherigen Nachrichten mit ${this.activeFriendChat?.username}. Sag Hallo!</span>
                  </div>
                `
              : this.chatMessages.map((m) => {
                  const isMe = m.fromId !== this.activeFriendChat?.publicId;
                  const time = new Date(m.timestamp).toLocaleTimeString([], {
                    hour: "2-digit",
                    minute: "2-digit",
                  });
                  return html`
                    <div class="flex flex-col ${isMe ? "items-end" : "items-start"}">
                      <div
                        class="max-w-[75%] p-3 rounded-2xl ${isMe
                          ? "bg-malibu-blue text-black rounded-br-xs font-medium"
                          : "bg-white/10 text-white rounded-bl-xs"} shadow-md"
                      >
                        <div class="text-xs break-words">${m.text}</div>
                        <div class="text-[9px] mt-1 text-right font-mono ${isMe ? "text-black/60" : "text-white/40"}">
                          ${time}
                        </div>
                      </div>
                    </div>
                  `;
                })}
        </div>

        <!-- Input Area -->
        <form
          @submit=${this.sendDirectMessage}
          class="p-3 bg-black/60 border-t border-white/10 flex items-center gap-2"
        >
          <input
            type="text"
            maxlength="500"
            placeholder="Nachricht an ${this.activeFriendChat?.username} schreiben..."
            class="flex-1 bg-white/5 border border-white/10 focus:border-malibu-blue rounded-lg px-4 py-2.5 text-sm text-white placeholder-white/30 outline-none transition-colors"
            .value=${this.chatInput}
            @input=${(e: any) => (this.chatInput = e.target.value)}
          />
          <button
            type="submit"
            ?disabled=${this.chatSending || !this.chatInput.trim()}
            class="px-5 py-2.5 bg-malibu-blue hover:bg-aquarius disabled:opacity-40 text-black font-bold text-sm rounded-lg transition-all cursor-pointer flex items-center gap-1.5 shrink-0"
          >
            ${this.chatSending ? "..." : "Senden"}
          </button>
        </form>
      </div>
    `;
  }

  private renderRequestsTab(): TemplateResult {
    return html`
      <div class="space-y-6">
        <!-- Incoming -->
        <div>
          <h4 class="text-xs font-bold uppercase tracking-wider text-white/50 mb-3">
            Eingehende Anfragen (${this.incoming.length})
          </h4>
          ${this.incoming.length === 0
            ? html`<div class="text-xs text-white/30 italic p-3 bg-white/5 rounded-xl border border-white/5">Keine eingehenden Anfragen</div>`
            : html`
                <div class="space-y-2">
                  ${this.incoming.map(
                    (req) => html`
                      <div class="flex items-center justify-between p-3 bg-white/5 rounded-xl border border-white/10">
                        <div>
                          <div class="font-bold text-white text-sm">${req.username || req.publicId}</div>
                          <div class="text-[10px] text-white/40 font-mono">${req.publicId}</div>
                        </div>
                        <div class="flex items-center gap-2">
                          <button
                            @click=${() => this.handleAccept(req.publicId)}
                            class="px-3 py-1.5 bg-green-500 hover:bg-green-600 text-black font-bold text-xs rounded-lg transition-all cursor-pointer"
                          >
                            Annehmen
                          </button>
                          <button
                            @click=${() => this.handleDecline(req.publicId)}
                            class="px-3 py-1.5 bg-red-500/20 hover:bg-red-500/30 text-red-300 font-bold text-xs rounded-lg transition-all cursor-pointer"
                          >
                            Ablehnen
                          </button>
                        </div>
                      </div>
                    `,
                  )}
                </div>
              `}
        </div>

        <!-- Outgoing -->
        <div>
          <h4 class="text-xs font-bold uppercase tracking-wider text-white/50 mb-3">
            Gesendete Anfragen (${this.outgoing.length})
          </h4>
          ${this.outgoing.length === 0
            ? html`<div class="text-xs text-white/30 italic p-3 bg-white/5 rounded-xl border border-white/5">Keine offenen gesendeten Anfragen</div>`
            : html`
                <div class="space-y-2">
                  ${this.outgoing.map(
                    (req) => html`
                      <div class="flex items-center justify-between p-3 bg-white/5 rounded-xl border border-white/10">
                        <div>
                          <div class="font-bold text-white text-sm">${req.username || req.publicId}</div>
                          <div class="text-[10px] text-white/40 font-mono">Wartet auf Antwort</div>
                        </div>
                        <button
                          @click=${() => this.handleDecline(req.publicId)}
                          class="px-3 py-1.5 bg-white/10 hover:bg-white/20 text-white/60 font-medium text-xs rounded-lg transition-all cursor-pointer"
                        >
                          Zurückziehen
                        </button>
                      </div>
                    `,
                  )}
                </div>
              `}
        </div>
      </div>
    `;
  }

  private renderAddTab(): TemplateResult {
    return html`
      <div class="max-w-md mx-auto p-6 bg-white/5 rounded-2xl border border-white/10 space-y-4">
        <h3 class="text-sm font-bold text-white uppercase tracking-wider">
          Freund hinzufügen
        </h3>
        <p class="text-xs text-white/50 leading-relaxed">
          Gib den Benutzernamen oder die Public-ID des Spielers ein, dem du eine Freundschaftsanfrage senden möchtest.
        </p>
        <form @submit=${this.handleAddFriend} class="space-y-3">
          <input
            type="text"
            placeholder="Benutzername oder ID eingeben..."
            .value=${this.addInput}
            @input=${(e: any) => (this.addInput = e.target.value)}
            class="w-full px-4 py-3 bg-black/40 border border-white/10 focus:border-malibu-blue rounded-xl text-sm text-white placeholder-white/30 outline-none transition-colors"
          />
          <button
            type="submit"
            ?disabled=${this.adding || !this.addInput.trim()}
            class="w-full py-3 bg-malibu-blue hover:bg-aquarius disabled:opacity-40 text-black font-bold text-sm rounded-xl transition-all cursor-pointer"
          >
            ${this.adding ? "Sende Anfrage..." : "Anfrage senden"}
          </button>
        </form>
      </div>
    `;
  }
}
