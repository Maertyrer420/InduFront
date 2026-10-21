# InduFront

InduFront is an independent open-source real-time strategy (RTS) web game focused on territorial expansion, production dynamics, and multiplayer tactical warfare. Players compete to grow their territory, manage resources, and form strategic alliances directly in modern web browsers.

This project is an independent fork with a dedicated direction towards strategic depth, privacy-by-design, fair play, and self-hosted multiplayer capability.

---

## 🌟 Features

- **Browser-Native Real-Time Strategy**: Smooth multiplayer RTS running on WebGL and WebSockets directly in any modern desktop or mobile browser.
- **Privacy-First & No Trackers**: Zero third-party ad networks, no data selling, minimal data collection strictly limited to necessary game mechanics.
- **100% Free & Fair Play**: No pay-to-win mechanics, no microtransactions, fair competition for all players.
- **Unified 24/7 Server Architecture**: Runs effortlessly on Render or local servers with integrated Master HTTP gateway, multi-process game workers, and authentication server.
- **Real Accounts & Multiplayer Lobbies**: Real account registration and login system with persistent credentials, guest fallback, and instant join-code lobby creation.

---

## 🚀 Quick Start (Local Development)

### Prerequisites

- [Node.js](https://nodejs.org/) v24.15.0 or newer
- [npm](https://www.npmjs.com/) v12.1.0 or newer

### Installation

```bash
# Clone the repository
git clone https://github.com/Maertyrer420/InduFront.git
cd InduFront

# Install dependencies
npm install --include=dev --ignore-scripts
```

### Running Locally

```bash
# Start unified gateway (Gateway + Auth Server + Game Server)
npm run start:render
```

Open `http://localhost:10000` in your web browser.

---

## 🌐 24/7 Cloud Deployment (Render.com)

InduFront is pre-configured for 1-click cloud deployment on [Render](https://render.com) using the included `render.yaml` blueprint.

1. Connect your GitHub repository to Render.
2. Create a new **Web Service** or use **Blueprints**.
3. Render automatically runs the build and starts the unified gateway service.
4. Your game is live 24/7 with public HTTPS and WebSocket support.

---

## 🔒 Privacy & Terms

- [Terms of Service](resources/public/terms-of-service.html)
- [Privacy Policy](resources/public/privacy-policy.html)

InduFront collects strictly the minimum information required for multiplayer play:

- Account username, optional email for password reset, and cryptographic password hash (scrypt).
- In-game statistics and match history.
- Immediate, permanent account deletion is supported directly within game settings.

---

## 📜 License

InduFront source code is licensed under the **GNU Affero General Public License v3.0 (AGPLv3)**.  
Assets are licensed under **Creative Commons Attribution-ShareAlike 4.0 International (CC BY-SA 4.0)**.
