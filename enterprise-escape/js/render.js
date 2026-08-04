import { getReachableSets } from "./engine.js";
import { ticketColor } from "./ticket-theme.js";

const STATION_RADIUS = 14;
const HIT_RADIUS = 20;
const SHARED_HIGHLIGHT_COLOR = "#22d3ee";
const MRX_COLOR = "#111827";
const GHOST_ALPHA = 0.35;

const EXIT_RING = {
  exit1: { color: "#facc15", label: "E1" },
  exit2: { color: "#cbd5e1", label: "E2" },
  exit3: { color: "#cd7f32", label: "E3" },
};

function rgb(arr, alpha = 1) {
  return `rgba(${arr[0]}, ${arr[1]}, ${arr[2]}, ${alpha})`;
}

function exitRingFor(board, stationKey) {
  const roles = board.roles;
  if (stationKey === roles.exit1) return EXIT_RING.exit1;
  if (stationKey === roles.exit2) return EXIT_RING.exit2;
  for (let i = 0; i < 5; i++) {
    if (stationKey === roles[`exit3_${i}`]) return EXIT_RING.exit3;
  }
  return null;
}

export class BoardView {
  constructor(canvas, board) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d");
    this.board = board;
    this.bgImage = null;
    this.transform = { scale: 1, offsetX: 0, offsetY: 0 };
    if (board.background) {
      const img = new Image();
      img.src = board.background.image;
      img.onload = () => {
        this.bgImage = img;
        this.requestDraw();
      };
    }
    this._lastState = null;
    this._viewerRoles = new Set(); // subset of "mrx" | "d1" | "d2" this device controls/sees as
  }

  setViewerRoles(roles) {
    this._viewerRoles = new Set(roles);
  }

  requestDraw() {
    if (this._lastState) this.render(this._lastState);
  }

  _computeTransform() {
    const stations = Object.values(this.board.stations);
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const s of stations) {
      minX = Math.min(minX, s.x);
      minY = Math.min(minY, s.y);
      maxX = Math.max(maxX, s.x);
      maxY = Math.max(maxY, s.y);
    }
    const boardW = maxX - minX || 1;
    const boardH = maxY - minY || 1;
    const canvasW = this.canvas.width;
    const canvasH = this.canvas.height;
    const scale = Math.min(canvasW / boardW, canvasH / boardH) * 0.9;
    const offsetX = (canvasW - boardW * scale) / 2 - minX * scale;
    const offsetY = (canvasH - boardH * scale) / 2 - minY * scale;
    this.transform = { scale, offsetX, offsetY };
  }

  boardToCanvas(x, y) {
    const { scale, offsetX, offsetY } = this.transform;
    return [x * scale + offsetX, y * scale + offsetY];
  }

  hitTest(canvasX, canvasY) {
    let best = null;
    let bestDist = HIT_RADIUS;
    for (const [key, s] of Object.entries(this.board.stations)) {
      const [cx, cy] = this.boardToCanvas(s.x, s.y);
      const d = Math.hypot(cx - canvasX, cy - canvasY);
      if (d < bestDist) {
        bestDist = d;
        best = key;
      }
    }
    return best;
  }

  _shouldShowMrX(state) {
    if (this._viewerRoles.has("mrx")) return true;
    if (state.phase === "ended") return true;
    // lastCapture.round is the round the capture happened IN, but the round
    // counter has already advanced by the time this renders (commit ticks
    // it), so the comparison is against round - 1, not round.
    if (state.lastCapture && state.lastCapture.round === state.round - 1) return true;
    if (state.lastReveal && state.lastReveal.round === state.round && state.phase === "detectives") return true;
    return false;
  }

  // Layering (bottom to top): station circles, then connection paths drawn
  // OVER them, then everything else, then station number labels drawn last
  // with a white halo -- with 53 stations packed densely, paths crossing
  // through circles and numbers always staying legible on top of everything
  // reads far better than circles/edges/text fighting for the same layer.
  render(state, opts = {}) {
    this._lastState = state;
    this._computeTransform();
    const { ctx, canvas, board } = this;
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    if (this.bgImage && board.background) {
      const bg = board.background;
      const [x, y] = this.boardToCanvas(bg.offset[0], bg.offset[1]);
      const w = this.bgImage.width * bg.scale * this.transform.scale;
      const h = this.bgImage.height * bg.scale * this.transform.scale;
      ctx.globalAlpha = bg.alpha / 255;
      ctx.drawImage(this.bgImage, x, y, w, h);
      ctx.globalAlpha = 1;
    }

    this._drawStationCircles();
    this._drawEdges();
    this._drawExitRings();
    this._drawHighlights(state, opts);
    this._drawGhosts(state);
    this._drawTokens(state);
    this._drawMrxPending(opts.mrxPending);
    this._drawStationLabels();
  }

  _drawEdges() {
    const { ctx, board } = this;
    const colors = board.colors;
    for (const kind of ["taxi", "bus", "underground"]) {
      ctx.strokeStyle = rgb(colors[kind] || [150, 150, 150], 0.55);
      ctx.lineWidth = kind === "underground" ? 3 : 1.5;
      ctx.beginPath();
      for (const [a, b] of board.edges[kind] || []) {
        const sa = board.stations[String(a)];
        const sb = board.stations[String(b)];
        if (!sa || !sb) continue;
        const [ax, ay] = this.boardToCanvas(sa.x, sa.y);
        const [bx, by] = this.boardToCanvas(sb.x, sb.y);
        ctx.moveTo(ax, ay);
        ctx.lineTo(bx, by);
      }
      ctx.stroke();
    }
  }

  _drawHighlights(state, opts) {
    const { ctx } = this;
    if (state.phase === "mrx" && this._viewerRoles.has("mrx")) {
      // legalMoves passed in via opts to avoid importing legalMovesForMrX here.
      // Already deduped to one entry per destination (see gameplay.js), ring
      // colored by whichever ticket that destination would actually cost --
      // this is the only indication of cost before you click, so it has to
      // be accurate to what pickTicket will actually choose.
      for (const m of opts.legalMoves || []) {
        this._ringStation(m.to, ticketColor(this.board, m.ticket), 4);
      }
    } else if (state.phase === "detectives") {
      const sets = getReachableSets(state);
      for (const d of state.detectives) {
        for (const station of sets[d.id] || []) {
          if (sets.shared.has(station)) continue;
          this._ringStation(station, d.color, 4);
        }
      }
      for (const station of sets.shared) {
        this._ringStation(station, SHARED_HIGHLIGHT_COLOR, 4);
      }
    }
  }

  _ringStation(stationKey, color, width) {
    const s = this.board.stations[String(stationKey)];
    if (!s) return;
    const [x, y] = this.boardToCanvas(s.x, s.y);
    const { ctx } = this;
    ctx.beginPath();
    ctx.arc(x, y, STATION_RADIUS + width, 0, Math.PI * 2);
    ctx.strokeStyle = color;
    ctx.lineWidth = width;
    ctx.stroke();
  }

  _drawStationCircles() {
    const { ctx, board } = this;
    for (const [key, s] of Object.entries(board.stations)) {
      const [x, y] = this.boardToCanvas(s.x, s.y);
      ctx.beginPath();
      ctx.arc(x, y, STATION_RADIUS, 0, Math.PI * 2);
      ctx.fillStyle = "#f8fafc";
      ctx.fill();
      ctx.strokeStyle = "#475569";
      ctx.lineWidth = 1.5;
      ctx.stroke();
    }
  }

  // Drawn AFTER edges (see render()), not bundled into the circle layer --
  // a 2px ring sitting right where edges converge got buried under the
  // connection lines, the same legibility problem the white-stroke labels
  // solved for station numbers.
  _drawExitRings() {
    const { ctx, board } = this;
    for (const key of Object.keys(board.stations)) {
      const ring = exitRingFor(board, key);
      if (!ring) continue;
      const s = board.stations[key];
      const [x, y] = this.boardToCanvas(s.x, s.y);
      ctx.beginPath();
      ctx.arc(x, y, STATION_RADIUS + 3, 0, Math.PI * 2);
      ctx.strokeStyle = ring.color;
      ctx.lineWidth = 3;
      ctx.stroke();
    }
  }

  _drawStationLabels() {
    const { ctx, board } = this;
    ctx.font = "10px sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.lineJoin = "round";
    for (const [key, s] of Object.entries(board.stations)) {
      const [x, y] = this.boardToCanvas(s.x, s.y);
      ctx.strokeStyle = "#ffffff";
      ctx.lineWidth = 3;
      ctx.strokeText(key, x, y);
      ctx.fillStyle = "#1e293b";
      ctx.fillText(key, x, y);
    }
  }

  _drawGhosts(state) {
    if (state.phase !== "detectives") return;
    const { ctx } = this;
    for (const d of state.detectives) {
      if (!state.staging[d.id]) continue;
      const s = this.board.stations[String(d.position)];
      if (!s) continue;
      const [x, y] = this.boardToCanvas(s.x, s.y);
      ctx.beginPath();
      ctx.arc(x, y, STATION_RADIUS - 3, 0, Math.PI * 2);
      ctx.fillStyle = d.color;
      ctx.globalAlpha = GHOST_ALPHA;
      ctx.fill();
      ctx.globalAlpha = 1;
    }
  }

  // Only ever populated on MrX's own device (see gameplay.js) -- a dashed
  // ring at whatever destination(s) are staged but not yet committed via
  // End Turn.
  _drawMrxPending(pendingStations) {
    if (!pendingStations || pendingStations.length === 0) return;
    const { ctx } = this;
    ctx.setLineDash([4, 3]);
    for (const stationKey of pendingStations) {
      const s = this.board.stations[String(stationKey)];
      if (!s) continue;
      const [x, y] = this.boardToCanvas(s.x, s.y);
      ctx.beginPath();
      ctx.arc(x, y, STATION_RADIUS + 6, 0, Math.PI * 2);
      ctx.strokeStyle = MRX_COLOR;
      ctx.lineWidth = 3;
      ctx.stroke();
    }
    ctx.setLineDash([]);
  }

  _drawTokens(state) {
    const { ctx } = this;
    for (const d of state.detectives) {
      const pos = state.staging[d.id] ? state.staging[d.id].to : d.position;
      const s = this.board.stations[String(pos)];
      if (!s) continue;
      const [x, y] = this.boardToCanvas(s.x, s.y);
      ctx.beginPath();
      ctx.arc(x, y, STATION_RADIUS - 3, 0, Math.PI * 2);
      ctx.fillStyle = d.color;
      ctx.globalAlpha = state.staging[d.id] ? 0.9 : 1;
      ctx.fill();
      ctx.globalAlpha = 1;
      ctx.strokeStyle = "#0f172a";
      ctx.lineWidth = 1;
      ctx.stroke();
    }

    if (this._shouldShowMrX(state)) {
      const s = this.board.stations[String(state.mrx.position)];
      if (s) {
        const [x, y] = this.boardToCanvas(s.x, s.y);
        ctx.beginPath();
        ctx.arc(x, y, STATION_RADIUS - 2, 0, Math.PI * 2);
        ctx.fillStyle = MRX_COLOR;
        ctx.fill();
        ctx.strokeStyle = "#ffffff";
        ctx.lineWidth = 2;
        ctx.stroke();
        ctx.fillStyle = "#ffffff";
        ctx.font = "bold 11px sans-serif";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText("X", x, y);
      }
    }
  }
}
