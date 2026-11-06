import { LitElement, html } from "lit";
import { customElement } from "lit/decorators.js";

interface SimFaction {
  id: number;
  name: string;
  color: string;
  borderColor: string;
  hubX: number;
  hubY: number;
  radius: number;
  targetRadius: number;
  phase: number;
  speed: number;
  nodes: Array<{
    x: number;
    y: number;
    kind: "factory" | "port" | "silo" | "radar";
  }>;
}

interface SimTrain {
  fromX: number;
  fromY: number;
  toX: number;
  toY: number;
  progress: number;
  speed: number;
  color: string;
  reverse: boolean;
}

interface SimMissile {
  startX: number;
  startY: number;
  endX: number;
  endY: number;
  progress: number;
  speed: number;
  color: string;
}

interface SimRipple {
  x: number;
  y: number;
  radius: number;
  maxRadius: number;
  alpha: number;
  color: string;
}

@customElement("indufront-battlefield-bg")
export class BattlefieldBackground extends LitElement {
  private canvas: HTMLCanvasElement | null = null;
  private ctx: CanvasRenderingContext2D | null = null;
  private rafId: number | null = null;
  private factions: SimFaction[] = [];
  private trains: SimTrain[] = [];
  private missiles: SimMissile[] = [];
  private ripples: SimRipple[] = [];
  private lastTime = 0;
  private radarAngle = 0;
  private resizeHandler = () => this.resizeCanvas();

  createRenderRoot() {
    return this;
  }

  connectedCallback() {
    super.connectedCallback();
    window.addEventListener("resize", this.resizeHandler);
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    window.removeEventListener("resize", this.resizeHandler);
    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
  }

  firstUpdated() {
    this.canvas = this.querySelector("canvas");
    if (this.canvas) {
      this.ctx = this.canvas.getContext("2d");
      this.resizeCanvas();
      this.initSimulation();
      this.lastTime = performance.now();
      this.rafId = requestAnimationFrame((t) => this.loop(t));
    }
  }

  private resizeCanvas() {
    if (!this.canvas) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = window.innerWidth;
    const h = window.innerHeight;
    this.canvas.width = Math.floor(w * dpr);
    this.canvas.height = Math.floor(h * dpr);
    this.canvas.style.width = `${w}px`;
    this.canvas.style.height = `${h}px`;
    if (this.ctx) {
      this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }
    if (this.factions.length > 0) {
      this.initSimulation();
    }
  }

  private initSimulation() {
    const w = window.innerWidth;
    const h = window.innerHeight;

    const specs = [
      {
        name: "NORTHERN SYNDICATE",
        color: "rgba(245, 158, 11, 0.16)",
        borderColor: "rgba(245, 158, 11, 0.55)",
        rx: 0.2,
        ry: 0.25,
      },
      {
        name: "PACIFIC FOUNDRY",
        color: "rgba(56, 189, 248, 0.15)",
        borderColor: "rgba(56, 189, 248, 0.52)",
        rx: 0.78,
        ry: 0.24,
      },
      {
        name: "IRON UNION",
        color: "rgba(239, 68, 68, 0.15)",
        borderColor: "rgba(239, 68, 68, 0.52)",
        rx: 0.18,
        ry: 0.75,
      },
      {
        name: "AEGIS LOGISTICS",
        color: "rgba(16, 185, 129, 0.15)",
        borderColor: "rgba(16, 185, 129, 0.52)",
        rx: 0.8,
        ry: 0.74,
      },
      {
        name: "CENTRAL COMBINATE",
        color: "rgba(168, 85, 247, 0.13)",
        borderColor: "rgba(168, 85, 247, 0.45)",
        rx: 0.5,
        ry: 0.5,
      },
    ];

    const baseScale = Math.min(w, h);
    this.factions = specs.map((s, idx) => {
      const hubX = w * s.rx;
      const hubY = h * s.ry;
      const r = baseScale * (idx === 4 ? 0.18 : 0.24);
      const nodes: SimFaction["nodes"] = [
        { x: hubX - r * 0.35, y: hubY - r * 0.22, kind: "factory" },
        { x: hubX + r * 0.32, y: hubY + r * 0.26, kind: "port" },
        { x: hubX + r * 0.28, y: hubY - r * 0.3, kind: "silo" },
        { x: hubX - r * 0.25, y: hubY + r * 0.32, kind: "radar" },
      ];
      return {
        id: idx,
        name: s.name,
        color: s.color,
        borderColor: s.borderColor,
        hubX,
        hubY,
        radius: r,
        targetRadius: r * 1.15,
        phase: idx * 1.3,
        speed: 0.4 + idx * 0.08,
        nodes,
      };
    });

    this.trains = [];
    for (const f of this.factions) {
      for (const n of f.nodes) {
        this.trains.push({
          fromX: f.hubX,
          fromY: f.hubY,
          toX: n.x,
          toY: n.y,
          progress: Math.random(),
          speed: 0.22 + Math.random() * 0.18,
          color: f.borderColor,
          reverse: Math.random() > 0.5,
        });
      }
    }
  }

  private loop(now: number) {
    this.rafId = requestAnimationFrame((t) => this.loop(t));
    if (
      document.hidden ||
      document.body.classList.contains("in-game") ||
      !this.ctx
    ) {
      this.lastTime = now;
      return;
    }

    const dt = Math.min((now - this.lastTime) / 1000, 0.1);
    this.lastTime = now;
    this.stepSimulation(dt);
    this.draw();
  }

  private stepSimulation(dt: number) {
    this.radarAngle = (this.radarAngle + dt * 1.1) % (Math.PI * 2);

    for (const f of this.factions) {
      f.phase += dt * f.speed;
    }

    for (const tr of this.trains) {
      tr.progress += dt * tr.speed * (tr.reverse ? -1 : 1);
      if (tr.progress >= 1) {
        tr.progress = 1;
        tr.reverse = true;
      } else if (tr.progress <= 0) {
        tr.progress = 0;
        tr.reverse = false;
      }
    }

    if (
      this.missiles.length < 4 &&
      Math.random() < dt * 1.2 &&
      this.factions.length >= 2
    ) {
      const a = this.factions[Math.floor(Math.random() * this.factions.length)];
      let b = this.factions[Math.floor(Math.random() * this.factions.length)];
      if (b.id === a.id) {
        b = this.factions[(a.id + 1) % this.factions.length];
      }
      const silo = a.nodes.find((n) => n.kind === "silo") ?? {
        x: a.hubX,
        y: a.hubY,
      };
      this.missiles.push({
        startX: silo.x,
        startY: silo.y,
        endX: b.hubX + (Math.random() - 0.5) * 90,
        endY: b.hubY + (Math.random() - 0.5) * 90,
        progress: 0,
        speed: 0.35 + Math.random() * 0.2,
        color: a.borderColor,
      });
    }

    for (let i = this.missiles.length - 1; i >= 0; i--) {
      const m = this.missiles[i];
      m.progress += dt * m.speed;
      if (m.progress >= 1) {
        this.ripples.push({
          x: m.endX,
          y: m.endY,
          radius: 4,
          maxRadius: 42,
          alpha: 0.85,
          color: m.color,
        });
        this.missiles.splice(i, 1);
      }
    }

    for (let i = this.ripples.length - 1; i >= 0; i--) {
      const r = this.ripples[i];
      r.radius += dt * 48;
      r.alpha -= dt * 0.95;
      if (r.alpha <= 0 || r.radius >= r.maxRadius) {
        this.ripples.splice(i, 1);
      }
    }
  }

  private drawTerritoryBlob(ctx: CanvasRenderingContext2D, f: SimFaction) {
    const steps = 28;
    ctx.beginPath();
    for (let i = 0; i <= steps; i++) {
      const angle = (i / steps) * Math.PI * 2;
      const wave =
        Math.sin(angle * 3 + f.phase) * 18 +
        Math.cos(angle * 5 - f.phase * 1.4) * 10;
      const rad = f.radius + wave;
      const px = f.hubX + Math.cos(angle) * rad;
      const py = f.hubY + Math.sin(angle) * rad;
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.closePath();
    ctx.fillStyle = f.color;
    ctx.fill();
    ctx.lineWidth = 1.6;
    ctx.strokeStyle = f.borderColor;
    ctx.stroke();
  }

  private draw() {
    const ctx = this.ctx;
    if (!ctx) return;
    const w = window.innerWidth;
    const h = window.innerHeight;

    ctx.clearRect(0, 0, w, h);

    // Subtle tactical coordinate grid
    ctx.strokeStyle = "rgba(148, 163, 184, 0.05)";
    ctx.lineWidth = 1;
    const gridStep = 64;
    ctx.beginPath();
    for (let x = 0; x < w; x += gridStep) {
      ctx.moveTo(x, 0);
      ctx.lineTo(x, h);
    }
    for (let y = 0; y < h; y += gridStep) {
      ctx.moveTo(0, y);
      ctx.lineTo(w, y);
    }
    ctx.stroke();

    // Territories & rail networks
    for (const f of this.factions) {
      this.drawTerritoryBlob(ctx, f);

      // Rail lines between hub and industrial nodes
      ctx.strokeStyle = "rgba(226, 232, 240, 0.18)";
      ctx.lineWidth = 1.2;
      ctx.setLineDash([4, 4]);
      for (const n of f.nodes) {
        ctx.beginPath();
        ctx.moveTo(f.hubX, f.hubY);
        ctx.lineTo(n.x, n.y);
        ctx.stroke();
      }
      ctx.setLineDash([]);

      // Hub city marker
      ctx.fillStyle = f.borderColor;
      ctx.beginPath();
      ctx.arc(f.hubX, f.hubY, 5.5, 0, Math.PI * 2);
      ctx.fill();

      // Faction tactical label
      ctx.font = "600 10px monospace";
      ctx.fillStyle = "rgba(226, 232, 240, 0.42)";
      ctx.fillText(f.name, f.hubX - 42, f.hubY - 12);

      // Industrial nodes (factory, port, silo, radar)
      for (const n of f.nodes) {
        ctx.fillStyle = f.borderColor;
        ctx.fillRect(n.x - 3, n.y - 3, 6, 6);
        if (n.kind === "radar") {
          ctx.beginPath();
          ctx.arc(n.x, n.y, 18, 0, Math.PI * 2);
          ctx.strokeStyle = "rgba(56, 189, 248, 0.2)";
          ctx.lineWidth = 1;
          ctx.stroke();

          ctx.beginPath();
          ctx.moveTo(n.x, n.y);
          ctx.lineTo(
            n.x + Math.cos(this.radarAngle) * 18,
            n.y + Math.sin(this.radarAngle) * 18,
          );
          ctx.strokeStyle = "rgba(56, 189, 248, 0.45)";
          ctx.stroke();
        }
      }
    }

    // Supply trains & trade convoys
    for (const tr of this.trains) {
      const tx = tr.fromX + (tr.toX - tr.fromX) * tr.progress;
      const ty = tr.fromY + (tr.toY - tr.fromY) * tr.progress;
      ctx.fillStyle = "#f8fafc";
      ctx.beginPath();
      ctx.arc(tx, ty, 2.6, 0, Math.PI * 2);
      ctx.fill();
    }

    // Ballistic / artillery arcs
    for (const m of this.missiles) {
      const t = m.progress;
      const midX = (m.startX + m.endX) / 2;
      const midY = Math.min(m.startY, m.endY) - 70;
      const curX =
        (1 - t) * (1 - t) * m.startX + 2 * (1 - t) * t * midX + t * t * m.endX;
      const curY =
        (1 - t) * (1 - t) * m.startY + 2 * (1 - t) * t * midY + t * t * m.endY;

      ctx.strokeStyle = m.color;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(m.startX, m.startY);
      ctx.quadraticCurveTo(midX, midY, curX, curY);
      ctx.stroke();

      ctx.fillStyle = "#fbbf24";
      ctx.beginPath();
      ctx.arc(curX, curY, 3, 0, Math.PI * 2);
      ctx.fill();
    }

    // Impact ripples
    for (const r of this.ripples) {
      ctx.strokeStyle = r.color;
      ctx.globalAlpha = Math.max(0, r.alpha);
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(r.x, r.y, r.radius, 0, Math.PI * 2);
      ctx.stroke();
      ctx.globalAlpha = 1;
    }
  }

  render() {
    return html`<canvas
      class="pointer-events-none block w-full h-full opacity-75"
      aria-hidden="true"
    ></canvas>`;
  }
}
