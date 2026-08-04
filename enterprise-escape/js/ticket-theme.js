// Display-only theming for ticket kinds -- the underlying engine/data keys
// stay "taxi" | "bus" | "underground" | "black" | "double" (that's the
// board.json contract from the map editor), only what's shown to players
// changes here. Ordered slowest -> fastest to match ticket scarcity
// (most taxi tickets, fewest underground): walk a Corridor, catch a Tram,
// or take the express Turbolift.
export const TICKET_LABELS = {
  taxi: "Corridor",
  bus: "Tram",
  underground: "Turbolift",
  black: "Black",
  double: "Double",
};

export function ticketLabel(kind) {
  return TICKET_LABELS[kind] || kind;
}

const FALLBACK_COLOR = "#e2e8f0";
const BLACK_TICKET_COLOR = "#e2e8f0";

export function ticketColor(board, kind) {
  if (kind === "black") return BLACK_TICKET_COLOR;
  const rgb = board.colors && board.colors[kind];
  return rgb ? `rgb(${rgb[0]}, ${rgb[1]}, ${rgb[2]})` : FALLBACK_COLOR;
}

// Small <span> for inline ticket-kind text, colored to match the edge lines
// on the map.
export function ticketSpan(board, kind, text) {
  const color = ticketColor(board, kind);
  const label = text != null ? text : ticketLabel(kind);
  return `<span style="color:${color}">${label}</span>`;
}
