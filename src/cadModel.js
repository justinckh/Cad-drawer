/**
 * Single source of truth for CAD layout + every connectable terminal.
 *
 * Terminal = a connection point (e.g. screw on a strip, pole top/bottom on QF/K).
 * Coordinates match the SVG drawing math used by the visual components.
 */

export const connKey = (a, b) => [a, b].sort().join("|");

/** Strip definitions: same cells/positions used for SVG + terminal registry */
export const TOP_STRIPS = [
  {
    prefix: "s4",
    view: "control",
    x: 40,
    y: 56,
    w: 24,
    h: 50,
    title: "S4",
    sub: "動控制",
    titleX: 54,
    cells: [
      { label: "S4" },
      { label: "S4" },
      { label: "S4" },
      { label: "N", filled: true },
      { label: "N", filled: true },
    ],
  },
  {
    prefix: "s3",
    view: "control",
    x: 176,
    y: 56,
    w: 24,
    h: 50,
    title: "S3",
    sub: "起動控制",
    titleX: 188,
    cells: [
      { label: "S3" },
      { label: "S3" },
      { label: "S3" },
      { label: "N", filled: true },
      { label: "N", filled: true },
    ],
  },
  {
    prefix: "s2",
    view: "control",
    x: 320,
    y: 56,
    w: 24,
    h: 50,
    title: "S2",
    sub: "停止鈕",
    titleX: 332,
    cells: [
      { label: "S2" },
      { label: "S2" },
      { label: "N", filled: true },
      { label: "N", filled: true },
    ],
  },
  {
    prefix: "s1",
    view: "control",
    x: 440,
    y: 56,
    w: 24,
    h: 50,
    title: "S1",
    sub: "逆停止系統",
    titleX: 452,
    cells: [
      { label: "S1" },
      { label: "S1" },
      { label: "N", filled: true },
      { label: "N", filled: true },
      { label: "N", filled: true },
    ],
  },
  ...["H1", "H2", "H3", "H4"].map((title, i) => ({
    prefix: `h${i + 1}`,
    view: "control",
    x: 588 + i * 56,
    y: 56,
    w: 24,
    h: 50,
    title,
    sub: null,
    titleX: 600 + i * 56,
    cells: [
      { label: "L", bold: true },
      { label: "N", filled: true },
    ],
  })),
];

export const DIST_STRIP = {
  prefix: "dist",
  view: "distribution",
  x: 28,
  y: 228,
  w: 28,
  h: 65,
  cells: [
    { label: "E" },
    { label: "L1" },
    { label: "L2" },
    { label: "L3" },
    { label: "T1" },
    { label: "T2" },
    { label: "T3" },
    { label: "L", bold: true },
    { label: "L", bold: true },
    { label: "N", filled: true },
    { label: "N", filled: true },
  ],
};

export const MOTOR_GND = { x: 58, y: 560, w: 32, h: 58, label: "⏚" };

export const MOTOR_STRIP = {
  prefix: "motor",
  view: "motor",
  x: 90,
  y: 560,
  w: 28,
  h: 58,
  cells: [
    { label: "L1" },
    { label: "L3" },
    { label: "N", filled: true },
    { label: "U1" },
    { label: "V1" },
    { label: "U2" },
    { label: "V2" },
    { label: "W2" },
    { label: "U1" },
    { label: "V1" },
  ],
};

export const LAYOUT = {
  qf: { x: 388, y: 163 },
  busL: { x: 554, y: 163 },
  busN: { x: 614, y: 163 },
  k2: { x: 690, y: 145 },
  k1: { x: 870, y: 145 },
  coil: { x: 760, y: 382 },
  krelMo: { x: 692, y: 402 },
  krelNc: { x: 730, y: 402 },
  motorTitle: { x: 58, y: 560, width: 560 },
};

// ── Geometry (must match drawing components) ─────────────────────────────────
export const GEOM = {
  stripTopScrew: 10,
  stripBottomOffset(h) {
    return h - 10;
  },
  breaker: { poleW: 38, bodyY: 20, topScrew: 20, botScrew: 72 },
  bus: { w: 50, h: 128, topScrew: 10, botScrewOff: 10 },
  contactor: { poleW: 42, headerH: 18, mainH: 110, auxY: 14, auxBlockH: 72 },
  contactorPole: { topScrew: 20, botScrew: 73 },
  aux: { w: 36, topScrew: 9, botScrew: 45 },
  coil: { w: 96, h: 80, a1x: 14, a2x: 82, ay: 62 },
};

function pushTerminals(list, t) {
  list.push(t);
}

/** Draggable-module registry: one entry per block the user can pick up and
 * move. `x`/`y` are each module's base (undragged) top-left-ish anchor —
 * the same values already used to draw it — so a drag offset of {0,0}
 * reproduces today's fixed layout exactly. */
export const MODULES = [
  ...TOP_STRIPS.map((s) => ({ id: s.prefix, x: s.x, y: s.y })),
  { id: DIST_STRIP.prefix, x: DIST_STRIP.x, y: DIST_STRIP.y },
  { id: "qf", x: LAYOUT.qf.x, y: LAYOUT.qf.y },
  { id: "bus-l", x: LAYOUT.busL.x, y: LAYOUT.busL.y },
  { id: "bus-n", x: LAYOUT.busN.x, y: LAYOUT.busN.y },
  { id: "k2", x: LAYOUT.k2.x, y: LAYOUT.k2.y },
  { id: "k1", x: LAYOUT.k1.x, y: LAYOUT.k1.y },
  // The coil + its two standalone aux contacts are drawn as one relay
  // assembly ("K"), so they move together under a single module id.
  { id: "k-coil", x: LAYOUT.coil.x, y: LAYOUT.coil.y },
  // Motor ground symbol + motor terminal strip are one continuous unit.
  { id: "motor", x: MOTOR_STRIP.x, y: MOTOR_STRIP.y },
];

/** Build flat terminal list + byId map from layout */
export function buildCadModel() {
  const list = [];

  const strip = (prefix, view, x, y, w, h, cells, moduleId) => {
    cells.forEach((c, i) => {
      const cx = x + i * w + w / 2;
      const lab = c.label ?? "";
      pushTerminals(list, {
        id: `${prefix}-c${i}-top`,
        x: cx,
        y: y + GEOM.stripTopScrew,
        view,
        label: "",
        lx: 0,
        ly: -12,
        meta: {
          kind: "strip",
          strip: prefix,
          cell: i,
          end: "top",
          cellLabel: lab,
          moduleId,
        },
      });
      pushTerminals(list, {
        id: `${prefix}-c${i}-bot`,
        x: cx,
        y: y + GEOM.stripBottomOffset(h),
        view,
        label: "",
        lx: 0,
        ly: 14,
        meta: {
          kind: "strip",
          strip: prefix,
          cell: i,
          end: "bot",
          cellLabel: lab,
          moduleId,
        },
      });
    });
  };

  const breaker3 = (x, y, moduleId) => {
    const { poleW, bodyY, topScrew, botScrew } = GEOM.breaker;
    const poleY = y + bodyY;
    for (let p = 0; p < 3; p++) {
      const cx = x + p * poleW + poleW / 2;
      const topL = ["L1", "L2", "L3"][p];
      const botL = ["T1", "T2", "T3"][p];
      pushTerminals(list, {
        id: `qf-p${p}-top`,
        x: cx,
        y: poleY + topScrew,
        view: "qf",
        label: topL,
        lx: 0,
        ly: -12,
        meta: { kind: "breaker", pole: p, end: "top", moduleId },
      });
      pushTerminals(list, {
        id: `qf-p${p}-bot`,
        x: cx,
        y: poleY + botScrew,
        view: "qf",
        label: botL,
        lx: 0,
        ly: 14,
        meta: { kind: "breaker", pole: p, end: "bot", moduleId },
      });
    }
  };

  const busBar = (prefix, view, x, y, letter, moduleId) => {
    const { w, h, topScrew, botScrewOff } = GEOM.bus;
    const cx = x + w / 2;
    pushTerminals(list, {
      id: `${prefix}-top`,
      x: cx,
      y: y + topScrew,
      view,
      label: letter,
      lx: 0,
      ly: -12,
      meta: { kind: "bus", end: "top", moduleId },
    });
    pushTerminals(list, {
      id: `${prefix}-bot`,
      x: cx,
      y: y + h - botScrewOff,
      view,
      label: letter,
      lx: 0,
      ly: 14,
      meta: { kind: "bus", end: "bot", moduleId },
    });
  };

  const contactorMain = (prefix, view, x, contY, tops, bots, moduleId) => {
    const PW = GEOM.contactor.poleW;
    const headerH = GEOM.contactor.headerH;
    const poleY = contY + headerH;
    const { topScrew, botScrew } = GEOM.contactorPole;
    for (let p = 0; p < 3; p++) {
      const cx = x + p * PW + PW / 2;
      pushTerminals(list, {
        id: `${prefix}-p${p}-top`,
        x: cx,
        y: poleY + topScrew,
        view,
        label: tops[p],
        lx: 0,
        ly: -12,
        meta: {
          kind: "contactor-main",
          unit: prefix,
          pole: p,
          end: "top",
          moduleId,
        },
      });
      pushTerminals(list, {
        id: `${prefix}-p${p}-bot`,
        x: cx,
        y: poleY + botScrew,
        view,
        label: bots[p],
        lx: 0,
        ly: 14,
        meta: {
          kind: "contactor-main",
          unit: prefix,
          pole: p,
          end: "bot",
          moduleId,
        },
      });
    }
  };

  const contactorAux = (prefix, view, x, contY, moCount, ncCount, moduleId) => {
    const { mainH, auxY } = GEOM.contactor;
    const ay = contY + mainH + auxY;
    const types = [...Array(moCount).fill("MO"), ...Array(ncCount).fill("NC")];
    types.forEach((type, i) => {
      const ax = x + 6 + i * 42 + GEOM.aux.w / 2;
      pushTerminals(list, {
        id: `${prefix}-aux${i}-top`,
        x: ax,
        y: ay + GEOM.aux.topScrew,
        view,
        label: "",
        lx: 0,
        ly: -10,
        meta: {
          kind: "contactor-aux",
          unit: prefix,
          index: i,
          type,
          end: "top",
          moduleId,
        },
      });
      pushTerminals(list, {
        id: `${prefix}-aux${i}-bot`,
        x: ax,
        y: ay + GEOM.aux.botScrew,
        view,
        label: type,
        lx: 0,
        ly: 12,
        meta: {
          kind: "contactor-aux",
          unit: prefix,
          index: i,
          type,
          end: "bot",
          moduleId,
        },
      });
    });
  };

  const coil = (x, y, moduleId) => {
    const { a1x, a2x, ay } = GEOM.coil;
    pushTerminals(list, {
      id: "k-coil-a1",
      x: x + a1x,
      y: y + ay,
      view: "k-coil",
      label: "A1",
      lx: 0,
      ly: 14,
      meta: { kind: "coil", end: "a1", moduleId },
    });
    pushTerminals(list, {
      id: "k-coil-a2",
      x: x + a2x,
      y: y + ay,
      view: "k-coil",
      label: "A2",
      lx: 0,
      ly: 14,
      meta: { kind: "coil", end: "a2", moduleId },
    });
  };

  const standaloneAux = (prefix, view, x, y, type, moduleId) => {
    const ax = x + GEOM.aux.w / 2;
    pushTerminals(list, {
      id: `${prefix}-top`,
      x: ax,
      y: y + GEOM.aux.topScrew,
      view,
      label: "",
      lx: 0,
      ly: -10,
      meta: { kind: "aux-standalone", type, end: "top", moduleId },
    });
    pushTerminals(list, {
      id: `${prefix}-bot`,
      x: ax,
      y: y + GEOM.aux.botScrew,
      view,
      label: type,
      lx: 0,
      ly: 12,
      meta: { kind: "aux-standalone", type, end: "bot", moduleId },
    });
  };

  // ── Layout configs (shared with JSX drawing) ──────────────────────────────

  TOP_STRIPS.forEach((s) =>
    strip(s.prefix, s.view, s.x, s.y, s.w, s.h, s.cells, s.prefix),
  );
  strip(
    DIST_STRIP.prefix,
    DIST_STRIP.view,
    DIST_STRIP.x,
    DIST_STRIP.y,
    DIST_STRIP.w,
    DIST_STRIP.h,
    DIST_STRIP.cells,
    DIST_STRIP.prefix,
  );

  breaker3(LAYOUT.qf.x, LAYOUT.qf.y, "qf");
  busBar("bus-l", "bus", LAYOUT.busL.x, LAYOUT.busL.y, "L", "bus-l");
  busBar("bus-n", "bus", LAYOUT.busN.x, LAYOUT.busN.y, "N", "bus-n");

  // K2 reverse — pole labels match schematic (L3,L2,L1 on inputs)
  contactorMain(
    "k2",
    "k2",
    LAYOUT.k2.x,
    LAYOUT.k2.y,
    ["L3", "L2", "L1"],
    ["T1", "T2", "T3"],
    "k2",
  );
  contactorAux("k2", "k2", LAYOUT.k2.x, LAYOUT.k2.y, 2, 1, "k2");

  contactorMain(
    "k1",
    "k1",
    LAYOUT.k1.x,
    LAYOUT.k1.y,
    ["L1ᵢ", "L2ᵢ", "L3ᵢ"],
    ["T1", "T2", "T3"],
    "k1",
  );
  contactorAux("k1", "k1", LAYOUT.k1.x, LAYOUT.k1.y, 2, 1, "k1");

  coil(LAYOUT.coil.x, LAYOUT.coil.y, "k-coil");

  standaloneAux(
    "krel-mo",
    "k-relay",
    LAYOUT.krelMo.x,
    LAYOUT.krelMo.y,
    "MO",
    "k-coil",
  );
  standaloneAux(
    "krel-nc",
    "k-relay",
    LAYOUT.krelNc.x,
    LAYOUT.krelNc.y,
    "NC",
    "k-coil",
  );

  strip(
    "mot-gnd",
    "motor",
    MOTOR_GND.x,
    MOTOR_GND.y,
    MOTOR_GND.w,
    MOTOR_GND.h,
    [{ label: MOTOR_GND.label }],
    "motor",
  );
  strip(
    MOTOR_STRIP.prefix,
    MOTOR_STRIP.view,
    MOTOR_STRIP.x,
    MOTOR_STRIP.y,
    MOTOR_STRIP.w,
    MOTOR_STRIP.h,
    MOTOR_STRIP.cells,
    "motor",
  );

  const byId = Object.fromEntries(list.map((t) => [t.id, t]));
  return { terminalList: list, terminalsById: byId };
}

export const { terminalList, terminalsById } = buildCadModel();

/** Recompute every terminal's position after modules have been dragged.
 * `moduleOffsets` is `{ [moduleId]: {dx, dy} }`; a module with no entry is
 * treated as {dx:0, dy:0} — i.e. still at its original layout position. */
export function applyModuleOffsets(moduleOffsets) {
  if (!moduleOffsets || Object.keys(moduleOffsets).length === 0) {
    return terminalsById;
  }
  const out = {};
  for (const t of terminalList) {
    const off = moduleOffsets[t.meta.moduleId];
    out[t.id] = off ? { ...t, x: t.x + off.dx, y: t.y + off.dy } : t;
  }
  return out;
}

const STRIP_TITLES = Object.fromEntries(
  TOP_STRIPS.map((s) => [s.prefix, s.title]),
);
STRIP_TITLES.dist = "Distribution Block";
STRIP_TITLES.motor = "Motor Terminal Strip";
STRIP_TITLES["mot-gnd"] = "Motor Ground";

const UNIT_TITLES = { k1: "K1", k2: "K2" };

/** Human-readable label for a terminal id, e.g. "K1 pole 1 top (L2i)" or
 * "Distribution Block cell 2 bottom (L2)". Used for chat/tutor context. */
export function describeTerminal(id) {
  const t = terminalsById[id];
  if (!t) return id;
  const m = t.meta;
  const endWord = m.end === "top" ? "top" : m.end === "bot" ? "bottom" : m.end;
  switch (m.kind) {
    case "strip": {
      const title = STRIP_TITLES[m.strip] ?? m.strip;
      const label = m.cellLabel ? ` (${m.cellLabel})` : "";
      return `${title} cell ${m.cell}${label}, ${endWord} screw`;
    }
    case "breaker":
      return `QF (breaker) pole ${m.pole}, ${endWord} (${t.label})`;
    case "bus":
      return `${t.label} bus, ${endWord}`;
    case "contactor-main": {
      const unit = UNIT_TITLES[m.unit] ?? m.unit;
      return `${unit} pole ${m.pole}, ${endWord} (${t.label || "screw"})`;
    }
    case "contactor-aux": {
      const unit = UNIT_TITLES[m.unit] ?? m.unit;
      return `${unit} auxiliary contact ${m.index} (${m.type}), ${endWord}`;
    }
    case "coil":
      return `K relay coil, ${m.end.toUpperCase()}`;
    case "aux-standalone":
      return `K relay auxiliary contact (${m.type}), ${endWord}`;
    default:
      return id;
  }
}

/** Build a compact, human-readable summary of the current canvas state for
 * an LLM tutor: what's drawn, and how it compares to the answer key. */
export function buildCanvasContext(connections) {
  const drawnKeys = new Set(connections.map((c) => c.key));
  const correctDrawn = [];
  const wrongDrawn = [];
  const missing = [];

  connections.forEach(({ key, from, to }) => {
    const line = `${describeTerminal(from)}  <->  ${describeTerminal(to)}`;
    if (CORRECT_SET.has(key)) correctDrawn.push(line);
    else wrongDrawn.push(line);
  });

  CORRECT_SET.forEach((key) => {
    if (!drawnKeys.has(key)) {
      const [from, to] = key.split("|");
      missing.push(`${describeTerminal(from)}  <->  ${describeTerminal(to)}`);
    }
  });

  return {
    totalRequired: CORRECT_SET.size,
    totalDrawn: connections.length,
    correctDrawn,
    wrongDrawn,
    missing,
    isComplete: wrongDrawn.length === 0 && missing.length === 0,
  };
}

/** Expected connections for Submit (uses terminal ids from this model) */
// Every node appears exactly once — no shared/hub nodes — so the diagram stays clean.
//
// K1 (forward): QF outputs → K1 inputs
// K2 (reverse): dist-block L1/L2/L3 top screws → K2 inputs (reversed phase order)
// Motor:        K1 outputs → motor U1/V1/U2 (bot screws)
//               K2 outputs → motor V2/W2/U1-b (bot screws, U1-b = second U1 cell)
export const CORRECT_SET = new Set([
  // QF → K1 (forward)
  connKey("qf-p0-bot", "k1-p0-top"),
  connKey("qf-p1-bot", "k1-p1-top"),
  connKey("qf-p2-bot", "k1-p2-top"),
  // dist L1/L2/L3 → K2 (reverse, phases swapped)
  connKey("dist-c1-top", "k2-p2-top"),
  connKey("dist-c2-top", "k2-p1-top"),
  connKey("dist-c3-top", "k2-p0-top"),
  // K1 → motor
  connKey("k1-p0-bot", "motor-c3-bot"),
  connKey("k1-p1-bot", "motor-c4-bot"),
  connKey("k1-p2-bot", "motor-c5-bot"),
  // K2 → motor
  connKey("k2-p0-bot", "motor-c6-bot"),
  connKey("k2-p1-bot", "motor-c7-bot"),
  connKey("k2-p2-bot", "motor-c8-bot"),
]);
