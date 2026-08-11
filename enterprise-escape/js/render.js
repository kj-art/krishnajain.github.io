import { getReachableSets, DETECTIVE_IMAGES } from "./engine.js";
import { ticketColor } from "./ticket-theme.js";

const STATION_RADIUS = 14;
const HIT_RADIUS = 20;
const SHARED_HIGHLIGHT_COLOR = "#22d3ee";
const MRX_COLOR = "#111827";
const GHOST_ALPHA = 0.35;
// Matches the station circle exactly -- now that a badge-bearing station
// skips its own number label, there's no legibility reason to keep the
// token smaller than the station it's standing on.
const DETECTIVE_TOKEN_RADIUS = STATION_RADIUS;

// Exit stations are drawn as colored squares instead of the usual white
// circle (see _drawStationCircles) -- a ring/border around a still-round
// station read too similarly to the legal-move highlight rings to
// recognize at a glance. A shape change doesn't have that problem.
const EXIT_TIER = {
  exit1: { color: "#facc15" },
  // Was #cbd5e1 -- too close to the white (#f8fafc) of every regular
  // station to read as "silver" rather than "not colored at all."
  // Pushed toward a clearly blue-tinted steel color instead.
  exit2: { color: "#60a5fa" },
  exit3: { color: "#cd7f32" },
};

function rgb(arr, alpha = 1) {
  return `rgba(${arr[0]}, ${arr[1]}, ${arr[2]}, ${alpha})`;
}

// Only a tier turned on in settings.enabledExitTiers actually renders as an
// exit square -- a disabled tier's stations fall through to the plain white
// circle, same as any ordinary station (see engine.js's isActiveExitStation,
// the same settings-gated notion used for win conditions and the "crew
// can't linger on an exit" rule).
function exitTierFor(board, settings, stationKey) {
  // board.roles values are JSON numbers, but stationKey here always comes
  // from Object.keys(board.stations) -- a string, even for numeric-looking
  // keys -- so this has to normalize both sides or every comparison is a
  // silent string-vs-number false.
  const key = String(stationKey);
  const roles = board.roles;
  const tiers = (settings && settings.enabledExitTiers) || { exit1: true, exit2: true, exit3: true };
  if (tiers.exit1 && key === String(roles.exit1)) return EXIT_TIER.exit1;
  if (tiers.exit2 && key === String(roles.exit2)) return EXIT_TIER.exit2;
  if (tiers.exit3) {
    for (let i = 0; i < 5; i++) {
      if (key === String(roles[`exit3_${i}`])) return EXIT_TIER.exit3;
    }
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
    // Loaded once per app lifetime, indexed the same as DETECTIVE_COLORS/
    // state.detectives -- drawn instead of a flat color fill once ready,
    // with the flat color as a fallback while still loading (or if missing).
    this.detectiveImages = DETECTIVE_IMAGES.map((src) => {
      const detImg = new Image();
      detImg.src = src;
      detImg.onload = () => this.requestDraw();
      return detImg;
    });
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

  // For the crew's view: where the Fugitive was last actually seen, and
  // which round that sighting happened in. There's always at least one
  // sighting to fall back on -- everyone knows MrX starts in the brig
  // (board.roles.mrx is a fixed spawn, not something a move could leak) --
  // so the crew's marker never has nothing to show, it just goes stale.
  // lastCapture counts as a sighting too (you just watched them get
  // caught), exposed for one full round after the capture round, matching
  // how lastReveal is exposed for the round it fires in.
  _mrxSighting(state) {
    let best = { round: 1, position: state.board.roles.mrx };
    if (state.lastReveal && state.lastReveal.round >= best.round) {
      best = { round: state.lastReveal.round, position: state.lastReveal.position };
    }
    if (state.lastCapture && state.lastCapture.round + 1 >= best.round) {
      best = { round: state.lastCapture.round + 1, position: state.lastCapture.position };
    }
    return best;
  }

  // Layering (bottom to top): station circles, then connection paths drawn
  // over them, then everything else including the detective/MrX tokens,
  // then station number labels drawn last with a white halo -- except a
  // station with a detective badge image on it skips its own label
  // entirely (see _drawStationLabels), since the label would otherwise
  // still land on top and cover the art. With 53 stations packed densely,
  // paths crossing through circles and numbers staying legible on top of
  // everything (tokens included) reads far better than fighting for the
  // same layer.
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

    this._drawStationCircles(state.settings);
    this._drawEdges(state.settings.movementCosts);
    this._drawHighlights(state, opts);
    this._drawGhosts(state);
    const detectiveOccupied = this._drawDetectiveTokens(state);
    this._drawMrxToken(state);
    this._drawMrxPending(opts.mrxPending);
    this._drawStationLabels(detectiveOccupied);
  }

  // A few station pairs on this board have TWO edge kinds between the same
  // two stations (e.g. both a Corridor and a Tram). Route costs are a
  // per-game setting, not a fixed board fact (deliberately not baked into
  // board.json -- see export_board.py), so which kind of a shared pair
  // actually matters has to be worked out live, against this game's real
  // costs: the game's UI always auto-picks the cheapest reachable ticket
  // for any destination you click (see gameplay.js's pickTicket), so a
  // strictly-more-expensive duplicate is unreachable in practice and just
  // clutters the map -- skip drawing it entirely. If costs genuinely TIE,
  // both are real, equally-valid options, so both get drawn, nudged a
  // couple pixels apart perpendicular to the line so they stay their own
  // true color instead of blending into a third one that doesn't exist
  // (yellow taxi under cyan bus reads as green).
  _drawEdges(costs) {
    const { ctx, board } = this;
    const colors = board.colors;
    const kinds = ["taxi", "bus", "underground"];

    const kindsByPair = new Map(); // "a-b" (a<b) -> [kinds connecting them]
    for (const kind of kinds) {
      for (const [a, b] of board.edges[kind] || []) {
        const key = a < b ? `${a}-${b}` : `${b}-${a}`;
        if (!kindsByPair.has(key)) kindsByPair.set(key, []);
        kindsByPair.get(key).push(kind);
      }
    }
    // Only populated for pairs with 2+ kinds -- the kind(s) actually worth
    // drawing there, i.e. whichever tie for cheapest under `costs`.
    const keepKindsByPair = new Map();
    for (const [key, kindsHere] of kindsByPair) {
      if (kindsHere.length < 2) continue;
      const minCost = Math.min(...kindsHere.map((k) => costs[k] ?? 0));
      keepKindsByPair.set(
        key,
        kindsHere.filter((k) => (costs[k] ?? 0) === minCost)
      );
    }

    for (const kind of kinds) {
      ctx.strokeStyle = rgb(colors[kind] || [150, 150, 150], 0.55);
      ctx.lineWidth = kind === "underground" ? 3 : 1.5;
      ctx.beginPath();
      for (const [a, b] of board.edges[kind] || []) {
        const sa = board.stations[String(a)];
        const sb = board.stations[String(b)];
        if (!sa || !sb) continue;
        const key = a < b ? `${a}-${b}` : `${b}-${a}`;
        const keepKinds = keepKindsByPair.get(key);
        if (keepKinds && !keepKinds.includes(kind)) continue; // strictly dominated here
        const [ax, ay] = this.boardToCanvas(sa.x, sa.y);
        const [bx, by] = this.boardToCanvas(sb.x, sb.y);
        let ox = 0, oy = 0;
        if (keepKinds && keepKinds.length > 1) {
          const dx = bx - ax, dy = by - ay;
          const len = Math.hypot(dx, dy) || 1;
          const sign = keepKinds.indexOf(kind) === 0 ? -1 : 1;
          ox = (-dy / len) * 2.5 * sign;
          oy = (dx / len) * 2.5 * sign;
        }
        ctx.moveTo(ax + ox, ay + oy);
        ctx.lineTo(bx + ox, by + oy);
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
      // A device with one active crew member (see gameplay.js's per-panel
      // "control this crew member" click) only ever needs that one
      // detective's own options on the board -- showing everyone's at once
      // is what a board click was previously ambiguous about.
      if (opts.activeDetectiveId) {
        const d = state.detectives.find((x) => x.id === opts.activeDetectiveId);
        if (d) {
          for (const station of sets[d.id] || []) {
            this._ringStation(station, d.color, 4);
          }
        }
        return;
      }
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

  // Exit stations render as a colored rounded square instead of the usual
  // white circle -- everything else about them (edges terminating on them,
  // the number label, highlight rings, tokens) works exactly the same,
  // since this is purely a base-shape swap in the same layer/pass.
  _drawStationCircles(settings) {
    const { ctx, board } = this;
    for (const [key, s] of Object.entries(board.stations)) {
      const [x, y] = this.boardToCanvas(s.x, s.y);
      const tier = exitTierFor(board, settings, key);
      ctx.beginPath();
      if (tier) {
        ctx.roundRect(x - STATION_RADIUS, y - STATION_RADIUS, STATION_RADIUS * 2, STATION_RADIUS * 2, 4);
        ctx.fillStyle = tier.color;
      } else {
        ctx.arc(x, y, STATION_RADIUS, 0, Math.PI * 2);
        ctx.fillStyle = "#f8fafc";
      }
      ctx.fill();
      ctx.strokeStyle = "#475569";
      ctx.lineWidth = 1.5;
      ctx.stroke();
    }
  }

  _drawStationLabels(skipKeys) {
    const { ctx, board } = this;
    ctx.font = "10px sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.lineJoin = "round";
    for (const [key, s] of Object.entries(board.stations)) {
      if (skipKeys && skipKeys.has(key)) continue;
      const [x, y] = this.boardToCanvas(s.x, s.y);
      ctx.strokeStyle = "#ffffff";
      ctx.lineWidth = 3;
      ctx.strokeText(key, x, y);
      ctx.fillStyle = "#1e293b";
      ctx.fillText(key, x, y);
    }
  }

  // True once an image has actually finished loading AND this game has
  // badge images turned on at all -- crewBadgeImages is baked into state at
  // creation (see engine.js's createGame), true only when the host is
  // playing Fugitive. Checked before every draw rather than cached, since
  // load state can flip false->true mid-game (loaded lazily, see the
  // constructor) and every draw call after that point should immediately
  // start using it.
  _detectiveImageReady(state, index) {
    if (!state.crewBadgeImages) return false;
    const img = this.detectiveImages[index];
    return img && img.complete && img.naturalWidth > 0;
  }

  _drawGhosts(state) {
    if (state.phase !== "detectives") return;
    const { ctx } = this;
    state.detectives.forEach((d, i) => {
      if (!state.staging[d.id]) return;
      const s = this.board.stations[String(d.position)];
      if (!s) return;
      const [x, y] = this.boardToCanvas(s.x, s.y);
      const r = DETECTIVE_TOKEN_RADIUS;
      ctx.save();
      ctx.globalAlpha = GHOST_ALPHA;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      if (this._detectiveImageReady(state, i)) {
        ctx.clip();
        ctx.drawImage(this.detectiveImages[i], x - r, y - r, r * 2, r * 2);
      } else {
        ctx.fillStyle = d.color;
        ctx.fill();
      }
      ctx.restore();
    });
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

  // Returns the set of station keys drawn on, so _drawStationLabels knows
  // which numbers to leave out (a station's badge image and its number
  // label would otherwise land in the same spot).
  _drawDetectiveTokens(state) {
    const { ctx } = this;
    const occupied = new Set();
    state.detectives.forEach((d, i) => {
      const pos = state.staging[d.id] ? state.staging[d.id].to : d.position;
      const s = this.board.stations[String(pos)];
      if (!s) return;
      const [x, y] = this.boardToCanvas(s.x, s.y);
      const r = DETECTIVE_TOKEN_RADIUS;
      const ready = this._detectiveImageReady(state, i);
      // Only badge art needs its station's number left out -- a flat color
      // token (no images this game, or still loading) reads fine with the
      // number on top, same as it always did.
      if (ready) occupied.add(String(pos));
      ctx.save();
      ctx.globalAlpha = state.staging[d.id] ? 0.9 : 1;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      if (ready) {
        ctx.clip();
        ctx.drawImage(this.detectiveImages[i], x - r, y - r, r * 2, r * 2);
      } else {
        ctx.fillStyle = d.color;
        ctx.fill();
      }
      ctx.restore();
      // The badge art already has its own circular frame baked in -- only
      // the flat-color fallback (pre-load, or if an image fails) needs this
      // outline to read as a token against the board.
      if (!ready) {
        ctx.beginPath();
        ctx.arc(x, y, r, 0, Math.PI * 2);
        ctx.strokeStyle = "#0f172a";
        ctx.lineWidth = 1;
        ctx.stroke();
      }
    });
    return occupied;
  }

  // MrX's own device (and anyone once the game's over) always sees the real,
  // live position at full opacity. Everyone else -- the crew's normal view
  // -- sees a marker that never disappears: it sits at the last station MrX
  // was actually sighted at (see _mrxSighting), full opacity during the
  // round of that sighting itself, then fading to half opacity for every
  // round after, staying put there until the next sighting moves it.
  _drawMrxToken(state) {
    let position, alpha;
    if (this._viewerRoles.has("mrx") || state.phase === "ended") {
      position = state.mrx.position;
      alpha = 1;
    } else {
      const sighting = this._mrxSighting(state);
      position = sighting.position;
      alpha = state.round === sighting.round ? 1 : 0.5;
    }
    const s = this.board.stations[String(position)];
    if (!s) return;
    const [x, y] = this.boardToCanvas(s.x, s.y);
    const { ctx } = this;
    ctx.save();
    ctx.globalAlpha = alpha;
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
    ctx.restore();
  }
}
