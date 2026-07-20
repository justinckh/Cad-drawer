import { useState, useRef, useCallback, useMemo } from "react";
import {
  connKey,
  terminalsById,
  terminalList,
  CORRECT_SET,
  TOP_STRIPS,
  DIST_STRIP,
  MOTOR_GND,
  MOTOR_STRIP,
  LAYOUT,
  buildCanvasContext,
} from "../cadModel.js";
import ChatPanel from "./ChatPanel.jsx";

function isAllowedConnection(aId, bId) {
  return aId !== bId;
}

// ── Orthogonal (Manhattan-style) wire routing ─────────────────────────────
// Each terminal exits perpendicular to its strip/pole (top screws go up,
// bottom screws go down), then the wire turns with right-angle bends only —
// same convention as KiCad/Wokwi schematic routing.

const STUB = 16; // distance a wire travels straight out from a terminal before it can turn
const LANE_GAP = 9; // vertical spacing between parallel wires sharing a travel corridor

function exitDir(node) {
  const end = node?.meta?.end;
  if (end === "top") return -1; // exits upward
  if (end === "bot") return 1; // exits downward
  return 1;
}

/** Move `from` toward `target` by up to `stub`, but never past it — so the
 * stub always lands between the terminal and the travel line, never
 * overshoots and has to double back. */
function clampedStub(from, dir, target, stub) {
  const reach = from + dir * stub;
  return dir > 0 ? Math.min(reach, target) : Math.max(reach, target);
}

/** Build an orthogonal path string between two terminals. `midY`, when
 * given, is the shared horizontal travel line this wire should use (so a
 * whole group of parallel wires can be assigned distinct, non-overlapping
 * lines by the caller); otherwise it's derived from the two stub ends. */
function orthoPath(a, b, midY) {
  const dirA = exitDir(a);
  const dirB = exitDir(b);

  const ax1 = a.x;
  const bx1 = b.x;
  const fallbackMidY = (a.y + dirA * STUB + b.y + dirB * STUB) / 2;
  const travelY = midY ?? fallbackMidY;

  const ay1 = clampedStub(a.y, dirA, travelY, STUB);
  const by1 = clampedStub(b.y, dirB, travelY, STUB);

  const pts = [
    [a.x, a.y],
    [ax1, ay1],
    [ax1, travelY],
    [bx1, travelY],
    [bx1, by1],
    [b.x, b.y],
  ];

  // Drop redundant points (zero-length segments) e.g. when ax1 === bx1.
  const cleaned = pts.filter((p, i) => {
    if (i === 0) return true;
    const prev = pts[i - 1];
    return p[0] !== prev[0] || p[1] !== prev[1];
  });

  return cleaned.map((p, i) => `${i === 0 ? "M" : "L"}${p[0]},${p[1]}`).join(" ");
}

/** Render a list of {x,y} points as an SVG path, dropping zero-length segments. */
function pointsToPath(points) {
  const cleaned = points.filter((p, i) => {
    if (i === 0) return true;
    const prev = points[i - 1];
    return p.x !== prev.x || p.y !== prev.y;
  });
  return cleaned.map((p, i) => `${i === 0 ? "M" : "L"}${p.x},${p.y}`).join(" ");
}

// ── Drawing helpers (geometry must match cadModel.js GEOM) ───────────────────

function TC({
  x,
  y,
  w = 28,
  h = 58,
  label = "",
  filled = false,
  bold = false,
}) {
  const bg = filled ? "#222" : "#fff";
  const sc = filled ? "#555" : "#fff";
  const sl = filled ? "#777" : "#444";
  const fc = filled ? "#aaa" : "#222";
  return (
    <g>
      <rect
        x={x}
        y={y}
        width={w}
        height={h}
        fill={bg}
        stroke="#333"
        strokeWidth="1.2"
      />
      <circle
        cx={x + w / 2}
        cy={y + 10}
        r={4.5}
        fill={sc}
        stroke={sl}
        strokeWidth="1.1"
      />
      <line
        x1={x + w / 2 - 3}
        y1={y + 10}
        x2={x + w / 2 + 3}
        y2={y + 10}
        stroke={sl}
        strokeWidth="1.1"
      />
      <text
        x={x + w / 2}
        y={y + h / 2 + 4}
        textAnchor="middle"
        fontSize={bold ? 9 : 8}
        fontWeight={bold ? "700" : "400"}
        fontFamily="'JetBrains Mono', monospace"
        fill={fc}
      >
        {label}
      </text>
      <circle
        cx={x + w / 2}
        cy={y + h - 10}
        r={4.5}
        fill={sc}
        stroke={sl}
        strokeWidth="1.1"
      />
      <line
        x1={x + w / 2 - 3}
        y1={y + h - 10}
        x2={x + w / 2 + 3}
        y2={y + h - 10}
        stroke={sl}
        strokeWidth="1.1"
      />
    </g>
  );
}

function Rail({ x, y, width }) {
  return (
    <g>
      <rect
        x={x}
        y={y + 10}
        width={width}
        height={7}
        fill="#9e9e9e"
        stroke="#777"
        strokeWidth="0.8"
      />
      <rect
        x={x}
        y={y + 41}
        width={width}
        height={7}
        fill="#9e9e9e"
        stroke="#777"
        strokeWidth="0.8"
      />
    </g>
  );
}

function Strip({ x, y, cells, w = 28, h = 58 }) {
  return (
    <g>
      <Rail x={x} y={y} width={cells.length * w} />
      {cells.map((c, i) => (
        <TC
          key={i}
          x={x + i * w}
          y={y}
          w={w}
          h={h}
          label={c.label ?? ""}
          filled={c.filled ?? false}
          bold={c.bold ?? false}
        />
      ))}
    </g>
  );
}

function BreakerPole({ x, y, w = 38, h = 100, topLabel, botLabel }) {
  const cx = x + w / 2;
  return (
    <g>
      <rect
        x={x}
        y={y}
        width={w}
        height={h}
        fill="#f0f4ff"
        stroke="#333"
        strokeWidth="1.1"
      />
      <text x={cx} y={y + 12} textAnchor="middle" fontSize="8" fill="#555">
        {topLabel}
      </text>
      <circle
        cx={cx}
        cy={y + 20}
        r={4.5}
        fill="white"
        stroke="#444"
        strokeWidth="1.1"
      />
      <line
        x1={cx - 3}
        y1={y + 20}
        x2={cx + 3}
        y2={y + 20}
        stroke="#444"
        strokeWidth="1.1"
      />
      <line
        x1={cx}
        y1={y + 26}
        x2={cx}
        y2={y + 36}
        stroke="#333"
        strokeWidth="1.4"
      />
      <line
        x1={cx - 8}
        y1={y + 36}
        x2={cx + 8}
        y2={y + 36}
        stroke="#333"
        strokeWidth="1.8"
      />
      <line
        x1={cx + 8}
        y1={y + 36}
        x2={cx - 5}
        y2={y + 50}
        stroke="#333"
        strokeWidth="1.4"
      />
      <line
        x1={cx - 8}
        y1={y + 54}
        x2={cx + 8}
        y2={y + 54}
        stroke="#333"
        strokeWidth="1.8"
      />
      <line
        x1={cx}
        y1={y + 54}
        x2={cx}
        y2={y + 64}
        stroke="#333"
        strokeWidth="1.4"
      />
      <circle
        cx={cx}
        cy={y + 72}
        r={4.5}
        fill="white"
        stroke="#444"
        strokeWidth="1.1"
      />
      <line
        x1={cx - 3}
        y1={y + 72}
        x2={cx + 3}
        y2={y + 72}
        stroke="#444"
        strokeWidth="1.1"
      />
      <text x={cx} y={y + 86} textAnchor="middle" fontSize="8" fill="#555">
        {botLabel}
      </text>
    </g>
  );
}

function Breaker3P({ x, y }) {
  const PW = 38;
  const PH = 100;
  const W = 3 * PW;
  const H = PH + 36;
  return (
    <g>
      <rect
        x={x}
        y={y}
        width={W}
        height={H}
        fill="#e8edf7"
        stroke="#333"
        strokeWidth="2"
        rx="3"
      />
      <rect
        x={x}
        y={y}
        width={W}
        height={20}
        fill="#b0c4de"
        stroke="#333"
        strokeWidth="1"
        rx="3"
      />
      <text
        x={x + W / 2}
        y={y + 14}
        textAnchor="middle"
        fontSize="9"
        fontWeight="700"
        fill="#1a2a5a"
      >
        QF
      </text>
      <text
        x={x + W / 2}
        y={y + H - 10}
        textAnchor="middle"
        fontSize="7"
        fill="#666"
      >
        IEC 60898 10A/6kV
      </text>
      <BreakerPole x={x} y={y + 20} topLabel="L1" botLabel="T1" />
      <BreakerPole x={x + PW} y={y + 20} topLabel="L2" botLabel="T2" />
      <BreakerPole x={x + 2 * PW} y={y + 20} topLabel="L3" botLabel="T3" />
      <line
        x1={x + PW}
        y1={y + 20}
        x2={x + PW}
        y2={y + H - 8}
        stroke="#aaa"
        strokeWidth="0.8"
        strokeDasharray="3,2"
      />
      <line
        x1={x + 2 * PW}
        y1={y + 20}
        x2={x + 2 * PW}
        y2={y + H - 8}
        stroke="#aaa"
        strokeWidth="0.8"
        strokeDasharray="3,2"
      />
    </g>
  );
}

function BusBar({ x, y, label }) {
  const W = 50;
  const H = 128;
  return (
    <g>
      <rect
        x={x}
        y={y}
        width={W}
        height={H}
        fill="#f5f5f5"
        stroke="#333"
        strokeWidth="2"
        rx="2"
      />
      <rect
        x={x + 8}
        y={y + 20}
        width={W - 16}
        height={H - 40}
        fill="#c8c8c8"
        stroke="#888"
        strokeWidth="1"
        rx="1"
      />
      <text
        x={x + W / 2}
        y={y + H / 2 + 5}
        textAnchor="middle"
        fontSize="22"
        fontWeight="900"
        fill="#555"
      >
        {label}
      </text>
      <circle
        cx={x + W / 2}
        cy={y + 10}
        r={5}
        fill="white"
        stroke="#444"
        strokeWidth="1.2"
      />
      <line
        x1={x + W / 2 - 3.5}
        y1={y + 10}
        x2={x + W / 2 + 3.5}
        y2={y + 10}
        stroke="#444"
        strokeWidth="1.2"
      />
      <circle
        cx={x + W / 2}
        cy={y + H - 10}
        r={5}
        fill="white"
        stroke="#444"
        strokeWidth="1.2"
      />
      <line
        x1={x + W / 2 - 3.5}
        y1={y + H - 10}
        x2={x + W / 2 + 3.5}
        y2={y + H - 10}
        stroke="#444"
        strokeWidth="1.2"
      />
    </g>
  );
}

function ContactorPole({ x, y, w = 42, h = 120, topLabel, botLabel }) {
  const cx = x + w / 2;
  return (
    <g>
      <rect
        x={x}
        y={y}
        width={w}
        height={h}
        fill="#f8f8f0"
        stroke="#333"
        strokeWidth="1.1"
      />
      <text x={cx} y={y + 12} textAnchor="middle" fontSize="8" fill="#555">
        {topLabel}
      </text>
      <circle
        cx={cx}
        cy={y + 20}
        r={4.5}
        fill="white"
        stroke="#444"
        strokeWidth="1.1"
      />
      <line
        x1={cx - 3}
        y1={y + 20}
        x2={cx + 3}
        y2={y + 20}
        stroke="#444"
        strokeWidth="1.1"
      />
      <line
        x1={cx}
        y1={y + 27}
        x2={cx}
        y2={y + 40}
        stroke="#333"
        strokeWidth="1.4"
      />
      <line
        x1={cx - 9}
        y1={y + 40}
        x2={cx + 9}
        y2={y + 40}
        stroke="#333"
        strokeWidth="1.8"
      />
      <line
        x1={cx - 9}
        y1={y + 52}
        x2={cx + 9}
        y2={y + 52}
        stroke="#333"
        strokeWidth="1.8"
      />
      <line
        x1={cx}
        y1={y + 52}
        x2={cx}
        y2={y + 65}
        stroke="#333"
        strokeWidth="1.4"
      />
      <circle
        cx={cx}
        cy={y + 73}
        r={4.5}
        fill="white"
        stroke="#444"
        strokeWidth="1.1"
      />
      <line
        x1={cx - 3}
        y1={y + 73}
        x2={cx + 3}
        y2={y + 73}
        stroke="#444"
        strokeWidth="1.1"
      />
      <text x={cx} y={y + 87} textAnchor="middle" fontSize="8" fill="#555">
        {botLabel}
      </text>
    </g>
  );
}

function AuxContact({ x, y, type = "MO" }) {
  const W = 36;
  const H = 54;
  const cx = x + W / 2;
  const isMO = type === "MO";
  return (
    <g>
      <rect
        x={x}
        y={y}
        width={W}
        height={H}
        fill="#f5f5f0"
        stroke="#444"
        strokeWidth="1"
      />
      <circle
        cx={cx}
        cy={y + 9}
        r={3.8}
        fill="white"
        stroke="#555"
        strokeWidth="1"
      />
      <line
        x1={cx - 2.5}
        y1={y + 9}
        x2={cx + 2.5}
        y2={y + 9}
        stroke="#555"
        strokeWidth="1"
      />
      <line
        x1={cx}
        y1={y + 15}
        x2={cx}
        y2={y + 22}
        stroke="#333"
        strokeWidth="1.3"
      />
      <line
        x1={cx - 7}
        y1={y + 22}
        x2={cx + 7}
        y2={y + 22}
        stroke="#333"
        strokeWidth="1.6"
      />
      {isMO ? (
        <line
          x1={cx - 7}
          y1={y + 31}
          x2={cx + 7}
          y2={y + 31}
          stroke="#333"
          strokeWidth="1.6"
        />
      ) : (
        <line
          x1={cx - 7}
          y1={y + 26}
          x2={cx + 7}
          y2={y + 26}
          stroke="#333"
          strokeWidth="1.6"
        />
      )}
      {!isMO && (
        <line
          x1={cx - 7}
          y1={y + 22}
          x2={cx - 7}
          y2={y + 26}
          stroke="#333"
          strokeWidth="1.2"
        />
      )}
      <line
        x1={cx}
        y1={isMO ? y + 31 : y + 26}
        x2={cx}
        y2={y + 38}
        stroke="#333"
        strokeWidth="1.3"
      />
      <circle
        cx={cx}
        cy={y + 45}
        r={3.8}
        fill="white"
        stroke="#555"
        strokeWidth="1"
      />
      <line
        x1={cx - 2.5}
        y1={y + 45}
        x2={cx + 2.5}
        y2={y + 45}
        stroke="#555"
        strokeWidth="1"
      />
      <text x={cx} y={y + H + 10} textAnchor="middle" fontSize="7" fill="#666">
        {isMO ? "M.O" : "N.C"}
      </text>
    </g>
  );
}

function CoilBlock({ x, y }) {
  const W = 96;
  const H = 80;
  const cx = x + W / 2;
  return (
    <g>
      <rect
        x={x}
        y={y}
        width={W}
        height={H}
        fill="#f5f5f0"
        stroke="#444"
        strokeWidth="1.5"
      />
      <rect
        x={x}
        y={y}
        width={W}
        height={16}
        fill="#ddd"
        stroke="#444"
        strokeWidth="1"
      />
      <text
        x={cx}
        y={y + 11}
        textAnchor="middle"
        fontSize="9"
        fontWeight="700"
        fill="#333"
      >
        K
      </text>
      <rect
        x={x + 20}
        y={y + 24}
        width={56}
        height={22}
        fill="none"
        stroke="#333"
        strokeWidth="1.4"
      />
      <text x={cx} y={y + 39} textAnchor="middle" fontSize="8" fill="#444">
        coil
      </text>
      <circle
        cx={x + 14}
        cy={y + 62}
        r={4}
        fill="white"
        stroke="#555"
        strokeWidth="1"
      />
      <line
        x1={x + 11}
        y1={y + 62}
        x2={x + 17}
        y2={y + 62}
        stroke="#555"
        strokeWidth="1"
      />
      <circle
        cx={x + W - 14}
        cy={y + 62}
        r={4}
        fill="white"
        stroke="#555"
        strokeWidth="1"
      />
      <line
        x1={x + W - 17}
        y1={y + 62}
        x2={x + W - 11}
        y2={y + 62}
        stroke="#555"
        strokeWidth="1"
      />
      <text x={x + 14} y={y + 76} textAnchor="middle" fontSize="7" fill="#666">
        A1
      </text>
      <text
        x={x + W - 14}
        y={y + 76}
        textAnchor="middle"
        fontSize="7"
        fill="#666"
      >
        A2
      </text>
    </g>
  );
}

function Contactor3P({ x, y, label, auxMO = 2, auxNC = 1 }) {
  const PW = 42;
  const W = 3 * PW;
  const MAIN_H = 110;
  const AUX_H = 72;
  return (
    <g>
      <rect
        x={x}
        y={y}
        width={W}
        height={MAIN_H}
        fill="#eef0e8"
        stroke="#333"
        strokeWidth="2"
        rx="2"
      />
      <rect
        x={x}
        y={y}
        width={W}
        height={18}
        fill="#b8d4a8"
        stroke="#333"
        strokeWidth="1"
        rx="2"
      />
      <text
        x={x + W / 2}
        y={y + 12}
        textAnchor="middle"
        fontSize="10"
        fontWeight="700"
        fill="#1a3a1a"
      >
        {label}
      </text>
      <ContactorPole x={x} y={y + 18} topLabel="L1ᵢ" botLabel="T1" />
      <ContactorPole x={x + PW} y={y + 18} topLabel="L2ᵢ" botLabel="T2" />
      <ContactorPole x={x + 2 * PW} y={y + 18} topLabel="L3ᵢ" botLabel="T3" />
      <line
        x1={x + PW}
        y1={y + 18}
        x2={x + PW}
        y2={y + MAIN_H}
        stroke="#aaa"
        strokeWidth="0.8"
        strokeDasharray="3,2"
      />
      <line
        x1={x + 2 * PW}
        y1={y + 18}
        x2={x + 2 * PW}
        y2={y + MAIN_H}
        stroke="#aaa"
        strokeWidth="0.8"
        strokeDasharray="3,2"
      />

      <rect
        x={x}
        y={y + MAIN_H}
        width={W}
        height={AUX_H + 12}
        fill="#f5f5ee"
        stroke="#333"
        strokeWidth="1.5"
      />
      <text
        x={x + W / 2}
        y={y + MAIN_H + 11}
        textAnchor="middle"
        fontSize="7"
        fill="#555"
      >
        Auxiliary Contacts
      </text>
      {Array.from({ length: auxMO }).map((_, i) => (
        <AuxContact
          key={`mo${i}`}
          x={x + 6 + i * 42}
          y={y + MAIN_H + 14}
          type="MO"
        />
      ))}
      {Array.from({ length: auxNC }).map((_, i) => (
        <AuxContact
          key={`nc${i}`}
          x={x + 6 + (auxMO + i) * 42}
          y={y + MAIN_H + 14}
          type="NC"
        />
      ))}
    </g>
  );
}

function Contactor3PK2({ x, y, label, auxMO = 2, auxNC = 1 }) {
  const PW = 42;
  const W = 3 * PW;
  const MAIN_H = 110;
  const AUX_H = 72;
  return (
    <g>
      <rect
        x={x}
        y={y}
        width={W}
        height={MAIN_H}
        fill="#eef0e8"
        stroke="#333"
        strokeWidth="2"
        rx="2"
      />
      <rect
        x={x}
        y={y}
        width={W}
        height={18}
        fill="#b8d4a8"
        stroke="#333"
        strokeWidth="1"
        rx="2"
      />
      <text
        x={x + W / 2}
        y={y + 12}
        textAnchor="middle"
        fontSize="10"
        fontWeight="700"
        fill="#1a3a1a"
      >
        {label}
      </text>
      <ContactorPole x={x} y={y + 18} topLabel="L3" botLabel="T1" />
      <ContactorPole x={x + PW} y={y + 18} topLabel="L2" botLabel="T2" />
      <ContactorPole x={x + 2 * PW} y={y + 18} topLabel="L1" botLabel="T3" />
      <line
        x1={x + PW}
        y1={y + 18}
        x2={x + PW}
        y2={y + MAIN_H}
        stroke="#aaa"
        strokeWidth="0.8"
        strokeDasharray="3,2"
      />
      <line
        x1={x + 2 * PW}
        y1={y + 18}
        x2={x + 2 * PW}
        y2={y + MAIN_H}
        stroke="#aaa"
        strokeWidth="0.8"
        strokeDasharray="3,2"
      />

      <rect
        x={x}
        y={y + MAIN_H}
        width={W}
        height={AUX_H + 12}
        fill="#f5f5ee"
        stroke="#333"
        strokeWidth="1.5"
      />
      <text
        x={x + W / 2}
        y={y + MAIN_H + 11}
        textAnchor="middle"
        fontSize="7"
        fill="#555"
      >
        Auxiliary Contacts
      </text>
      {Array.from({ length: auxMO }).map((_, i) => (
        <AuxContact
          key={`mo${i}`}
          x={x + 6 + i * 42}
          y={y + MAIN_H + 14}
          type="MO"
        />
      ))}
      {Array.from({ length: auxNC }).map((_, i) => (
        <AuxContact
          key={`nc${i}`}
          x={x + 6 + (auxMO + i) * 42}
          y={y + MAIN_H + 14}
          type="NC"
        />
      ))}
    </g>
  );
}

function MotorBlock() {
  const W = 560;
  const H = 58;
  const x = LAYOUT.motorTitle.x;
  const y = LAYOUT.motorTitle.y;
  return (
    <g>
      <rect
        x={x}
        y={y - 22}
        width={W}
        height={22}
        fill="#ccc"
        stroke="#888"
        strokeWidth="1"
      />
      <text
        x={x + W / 2}
        y={y - 8}
        textAnchor="middle"
        fontSize="9"
        fontWeight="700"
        fill="#333"
      >
        順/逆轉(F/R)(2A) 電動機電路部分
      </text>
      <TC
        x={MOTOR_GND.x}
        y={MOTOR_GND.y}
        w={MOTOR_GND.w}
        h={H}
        label={MOTOR_GND.label}
      />
      <Strip
        x={MOTOR_STRIP.x}
        y={MOTOR_STRIP.y}
        w={MOTOR_STRIP.w}
        h={MOTOR_STRIP.h}
        cells={MOTOR_STRIP.cells}
      />
    </g>
  );
}

const NODE_COLORS = {
  default: { fill: "#fff", stroke: "#1565c0" },
  hover: { fill: "#ffe0b2", stroke: "#e65100" },
  peer: { fill: "#ffe0b2", stroke: "#e65100" },
  selected: { fill: "#ff8f00", stroke: "#e65100" },
  connected: { fill: "#dce8fb", stroke: "#1565c0" },
  correct: { fill: "#c8e6c9", stroke: "#2e7d32" },
  wrong: { fill: "#ffcdd2", stroke: "#c62828" },
  missing: { fill: "#fff9c4", stroke: "#f9a825" },
};

const HIDE_NODE_LABEL_VIEWS = new Set([
  "qf",
  "bus",
  "k1",
  "k2",
  "k-coil",
  "k-relay",
]);

export default function ExerciseOne() {
  const [connections, setConnections] = useState([]);
  // In-progress manual wire: { startId, points: [{x,y}...], axis: 'h'|'v' }
  // `points` always starts with the start terminal's own coordinate.
  // `axis` is the orientation the *next* segment (to the cursor, or to the
  // next click) is constrained to.
  const [draft, setDraft] = useState(null);
  const [hovered, setHovered] = useState(null);
  const [cursorPos, setCursorPos] = useState(null);
  const [result, setResult] = useState(null);
  const [flash, setFlash] = useState(null);
  const svgRef = useRef(null);
  const selected = draft?.startId ?? null;

  const connMap = useMemo(
    () => new Map(connections.map((c) => [c.key, c])),
    [connections],
  );

  // Assign each auto-routed (unpointed) connection its own non-overlapping
  // travel line, grouped into independent "corridors" — clusters of wires
  // whose horizontal spans overlap AND whose natural travel heights are
  // already close (a wide gap means they run through unrelated parts of the
  // diagram that just happen to share x-range, e.g. QF→K1 near the top vs.
  // K1→motor much further down).
  const midYByKey = useMemo(() => {
    const autoConns = connections.filter((c) => !c.points);
    const items = autoConns
      .map(({ key, from, to }) => {
        const a = terminalsById[from];
        const b = terminalsById[to];
        if (!a || !b) return null;
        const dirA = exitDir(a);
        const dirB = exitDir(b);
        const naturalMidY = (a.y + dirA * STUB + b.y + dirB * STUB) / 2;
        const lo = Math.min(a.x, b.x);
        const hi = Math.max(a.x, b.x);
        return { key, ax: a.x, bx: b.x, lo, hi, naturalMidY };
      })
      .filter(Boolean);

    const CORRIDOR_BAND = LANE_GAP * 4;
    const inSameCorridor = (p, q) =>
      p.lo < q.hi && q.lo < p.hi && Math.abs(p.naturalMidY - q.naturalMidY) < CORRIDOR_BAND;

    // Union-find: this relation is applied transitively on purpose (unlike a
    // plain x-overlap test, adding the y-proximity check keeps it from
    // chaining together corridors that are actually unrelated).
    const parent = items.map((_, i) => i);
    const find = (i) => (parent[i] === i ? i : (parent[i] = find(parent[i])));
    for (let i = 0; i < items.length; i++) {
      for (let j = i + 1; j < items.length; j++) {
        if (inSameCorridor(items[i], items[j])) {
          const ri = find(i),
            rj = find(j);
          if (ri !== rj) parent[ri] = rj;
        }
      }
    }
    const clusters = new Map();
    items.forEach((item, i) => {
      const root = find(i);
      if (!clusters.has(root)) clusters.set(root, []);
      clusters.get(root).push(item);
    });

    const result = new Map();
    clusters.forEach((cluster) => {
      // When a corridor carries two "buses" running in opposite x-order on
      // their two ends (e.g. K1 sits right of K2 but K1's motor leads land
      // left of K2's), no lane assignment can avoid their wires crossing —
      // it's geometrically forced. The best we can do is make every wire's
      // lane track whichever endpoint has the wider spread *within this
      // corridor*, so the crossing renders as a clean fan/X instead of an
      // interleaved tangle.
      const spread = (pick) => {
        const xs = cluster.map(pick);
        return Math.max(...xs) - Math.min(...xs);
      };
      const useA = spread((it) => it.ax) >= spread((it) => it.bx);
      const sortKey = (it) => (useA ? it.ax : it.bx);
      const ordered = [...cluster].sort((x, y) => sortKey(x) - sortKey(y));

      let floor = -Infinity;
      ordered.forEach((item) => {
        const y = Math.max(item.naturalMidY, floor);
        result.set(item.key, y);
        floor = y + LANE_GAP;
      });
    });
    return result;
  }, [connections]);

  // Lines and peer nodes that should be highlighted when hovering a connected node
  const { hoveredLineKeys, hoveredPeerIds } = useMemo(() => {
    if (!hovered)
      return { hoveredLineKeys: new Set(), hoveredPeerIds: new Set() };
    const lineKeys = new Set();
    const peerIds = new Set();
    connections.forEach(({ key, from, to }) => {
      if (from === hovered) {
        lineKeys.add(key);
        peerIds.add(to);
      } else if (to === hovered) {
        lineKeys.add(key);
        peerIds.add(from);
      }
    });
    return { hoveredLineKeys: lineKeys, hoveredPeerIds: peerIds };
  }, [hovered, connections]);

  function nodeState(id) {
    if (result) {
      if (result.wrongKeys.some((k) => k.split("|").includes(id)))
        return "wrong";
      if (result.missingIds.has(id)) return "missing";
      return "correct";
    }
    if (selected === id) return "selected";
    if (id === hovered && connections.some((c) => c.from === id || c.to === id))
      return "hover";
    if (hoveredPeerIds.has(id)) return "peer";
    if (connections.some((c) => c.from === id || c.to === id))
      return "connected";
    if (hovered === id) return "hover";
    return "default";
  }

  function lineColor(key) {
    if (result) {
      return result.wrongKeys.includes(key)
        ? { stroke: "#e53935", sw: 2, dash: "none" }
        : { stroke: "#388e3c", sw: 2, dash: "none" };
    }
    if (hoveredLineKeys.has(key))
      return { stroke: "#ff6f00", sw: 3, dash: "none" };
    return { stroke: "#f57c00", sw: 2, dash: "none" };
  }

  function svgXY(e) {
    const svg = svgRef.current;
    if (!svg) return null;
    const r = svg.getBoundingClientRect();
    const vb = svg.viewBox.baseVal;
    return {
      x: ((e.clientX - r.left) / r.width) * vb.width,
      y: ((e.clientY - r.top) / r.height) * vb.height,
    };
  }

  const onMouseMove = useCallback(
    (e) => {
      if (!draft) {
        setCursorPos(null);
        return;
      }
      setCursorPos(svgXY(e));
    },
    [draft],
  );

  // Constrain a free point onto the axis the next segment must travel:
  // 'h' locks y to the last confirmed point (horizontal run),
  // 'v' locks x to the last confirmed point (vertical run),
  // null/'free' (only the very first segment) follows whichever axis the
  // cursor has moved further along, decided live until the user clicks.
  function resolveAxis(last, raw, axis) {
    if (axis === "h" || axis === "v") return axis;
    const dx = Math.abs(raw.x - last.x);
    const dy = Math.abs(raw.y - last.y);
    return dx >= dy ? "h" : "v";
  }

  function snapToAxis(last, raw, axis) {
    const resolved = resolveAxis(last, raw, axis);
    return resolved === "h" ? { x: raw.x, y: last.y } : { x: last.x, y: raw.y };
  }

  function flip(axis) {
    return axis === "h" ? "v" : "h";
  }

  function cancelDraft() {
    setDraft(null);
    setCursorPos(null);
  }

  // Complete a draft's point list when the user clicks a terminal to finish:
  // bend onto the terminal on the current axis, then run the final leg in
  // (perpendicular) — same two-step elbow used for a manual waypoint, just
  // collapsed to the terminal in one click.
  function finishPoints(d, target) {
    const last = d.points[d.points.length - 1];
    const bend = snapToAxis(last, target, d.axis);
    if (bend.x === target.x && bend.y === target.y) {
      return [...d.points, target];
    }
    return [...d.points, bend, target];
  }

  function onNodeClick(e, id) {
    e.stopPropagation();
    if (result?.allCorrect) return;
    const node = terminalsById[id];
    if (!node) return;

    if (!draft) {
      setDraft({ startId: id, points: [{ x: node.x, y: node.y }], axis: null });
      return;
    }
    if (draft.startId === id) {
      cancelDraft();
      return;
    }
    if (!isAllowedConnection(draft.startId, id)) {
      setFlash("Pick two different terminals.");
      cancelDraft();
      setTimeout(() => setFlash(null), 2000);
      return;
    }
    const key = connKey(draft.startId, id);
    const points = finishPoints(draft, { x: node.x, y: node.y });
    if (connMap.has(key)) {
      setConnections((prev) => prev.filter((c) => c.key !== key));
    } else {
      setConnections((prev) => [
        ...prev,
        { key, from: draft.startId, to: id, points },
      ]);
    }
    cancelDraft();
    if (result && !result.allCorrect) setResult(null);
  }

  // Click on empty canvas while drawing: drop a bend point, constrained to
  // the current axis, and flip axis for the next segment.
  function onCanvasClick(e) {
    if (!draft) {
      setDraft(null);
      return;
    }
    const raw = svgXY(e);
    if (!raw) return;
    const last = draft.points[draft.points.length - 1];
    const resolved = resolveAxis(last, raw, draft.axis);
    const pt = snapToAxis(last, raw, resolved);
    setDraft((d) => ({
      ...d,
      points: [...d.points, pt],
      axis: flip(resolved),
    }));
  }

  function onCanvasContextMenu(e) {
    e.preventDefault();
    if (draft) cancelDraft();
  }

  function onLineClick(e, key) {
    e.stopPropagation();
    if (result?.allCorrect) return;
    setConnections((prev) => prev.filter((c) => c.key !== key));
    if (result && !result.allCorrect) setResult(null);
  }

  const getCanvasContext = useCallback(
    () => buildCanvasContext(connections),
    [connections],
  );

  function onSubmit() {
    const drawn = new Set(connections.map((c) => c.key));
    const wrongKeys = [...drawn].filter((k) => !CORRECT_SET.has(k));
    const missingKeys = [...CORRECT_SET].filter((k) => !drawn.has(k));
    const missingIds = new Set(missingKeys.flatMap((k) => k.split("|")));
    setResult({
      allCorrect: wrongKeys.length === 0 && missingKeys.length === 0,
      wrongKeys,
      missingIds,
      missingKeysCount: missingKeys.length,
    });
  }

  function onReset() {
    setConnections([]);
    setDraft(null);
    setCursorPos(null);
    setResult(null);
    setFlash(null);
  }

  function onShowAnswer() {
    const answerConnections = [...CORRECT_SET].map((key) => {
      const [from, to] = key.split("|");
      return { key, from, to };
    });
    setConnections(answerConnections);
    setDraft(null);
    setCursorPos(null);
    setResult(null);
  }

  const total = CORRECT_SET.size;
  const drawn = connections.length;

  return (
    <div className="exercise">
      <div className="exercise-title">
        <h1>
          三相(順/逆轉)電機控制電路 &nbsp;<span className="ex-badge">2A</span>
        </h1>
        <p className="exercise-subtitle">
          Every screw terminal on the diagram is a connectable point.
        </p>
      </div>

      <div className="exercise-body">
        <div className="canvas-area">
          <svg
            ref={svgRef}
            viewBox="0 0 1100 660"
            className="cad-svg"
            onMouseMove={onMouseMove}
            onMouseLeave={() => setCursorPos(null)}
            onClick={onCanvasClick}
            onContextMenu={onCanvasContextMenu}
          >
            <defs>
              <pattern
                id="smallGrid"
                width="10"
                height="10"
                patternUnits="userSpaceOnUse"
              >
                <path
                  d="M10 0 L0 0 0 10"
                  fill="none"
                  stroke="#dde3ea"
                  strokeWidth="0.4"
                />
              </pattern>
              <pattern
                id="grid"
                width="50"
                height="50"
                patternUnits="userSpaceOnUse"
              >
                <rect width="50" height="50" fill="url(#smallGrid)" />
                <path
                  d="M50 0 L0 0 0 50"
                  fill="none"
                  stroke="#c8d0da"
                  strokeWidth="0.7"
                />
              </pattern>
              <filter id="glow">
                <feGaussianBlur stdDeviation="2.5" result="blur" />
                <feMerge>
                  <feMergeNode in="blur" />
                  <feMergeNode in="SourceGraphic" />
                </feMerge>
              </filter>
            </defs>
            <rect width="1100" height="660" fill="url(#grid)" />

            <text x="26" y="26" fontSize="9" fontFamily="monospace" fill="#888">
              三相(順/逆轉(F/R))電機控制電路
            </text>

            {TOP_STRIPS.map((s) => (
              <g key={s.prefix}>
                <text
                  x={s.titleX}
                  y="44"
                  textAnchor="middle"
                  fontSize="8"
                  fill="#555"
                >
                  {s.title}
                </text>
                {s.sub && (
                  <text
                    x={s.titleX}
                    y="53"
                    textAnchor="middle"
                    fontSize="7"
                    fill="#888"
                  >
                    {s.sub}
                  </text>
                )}
                <Strip x={s.x} y={s.y} w={s.w} h={s.h} cells={s.cells} />
              </g>
            ))}

            <text
              x="32"
              y="223"
              fontSize="8"
              fontFamily="monospace"
              fill="#555"
            >
              Distribution Block
            </text>
            <Strip
              x={DIST_STRIP.x}
              y={DIST_STRIP.y}
              w={DIST_STRIP.w}
              h={DIST_STRIP.h}
              cells={DIST_STRIP.cells}
            />

            <Breaker3P x={LAYOUT.qf.x} y={LAYOUT.qf.y} />
            <BusBar x={LAYOUT.busL.x} y={LAYOUT.busL.y} label="L" />
            <BusBar x={LAYOUT.busN.x} y={LAYOUT.busN.y} label="N" />
            <Contactor3PK2
              x={LAYOUT.k2.x}
              y={LAYOUT.k2.y}
              label="K2"
              auxMO={2}
              auxNC={1}
            />
            <Contactor3P
              x={LAYOUT.k1.x}
              y={LAYOUT.k1.y}
              label="K1"
              auxMO={2}
              auxNC={1}
            />
            <CoilBlock x={LAYOUT.coil.x} y={LAYOUT.coil.y} />
            <AuxContact x={LAYOUT.krelMo.x} y={LAYOUT.krelMo.y} type="MO" />
            <AuxContact x={LAYOUT.krelNc.x} y={LAYOUT.krelNc.y} type="NC" />

            <MotorBlock />

            {connections.map(({ key, from, to, points }) => {
              const a = terminalsById[from];
              const b = terminalsById[to];
              if (!a || !b) return null;
              const s = lineColor(key);
              const d = points
                ? pointsToPath(points)
                : orthoPath(a, b, midYByKey.get(key));
              return (
                <g key={key}>
                  <path
                    d={d}
                    fill="none"
                    stroke="transparent"
                    strokeWidth={10}
                    className="conn-line-hit"
                    onClick={(e) => onLineClick(e, key)}
                  />
                  <path
                    d={d}
                    fill="none"
                    stroke={s.stroke}
                    strokeWidth={s.sw}
                    strokeDasharray={s.dash}
                    strokeLinejoin="round"
                    className="conn-line"
                    pointerEvents="none"
                  />
                </g>
              );
            })}

            {draft && cursorPos && (
              <path
                d={pointsToPath([
                  ...draft.points,
                  snapToAxis(
                    draft.points[draft.points.length - 1],
                    cursorPos,
                    draft.axis,
                  ),
                ])}
                fill="none"
                stroke="#ff8f00"
                strokeWidth={1.5}
                strokeDasharray="6,4"
                strokeLinejoin="round"
                opacity={0.7}
                pointerEvents="none"
              />
            )}
            {draft &&
              draft.points.map((p, i) => (
                <circle
                  key={i}
                  cx={p.x}
                  cy={p.y}
                  r={2.5}
                  fill="#ff8f00"
                  pointerEvents="none"
                />
              ))}

            {terminalList.map((nd) => {
              const st = nodeState(nd.id);
              const { fill, stroke } = NODE_COLORS[st];
              const glow =
                st === "selected" ||
                st === "missing" ||
                st === "peer" ||
                st === "hover";
              const showLabel =
                nd.label &&
                nd.label.length > 0 &&
                !HIDE_NODE_LABEL_VIEWS.has(nd.view);
              return (
                <g
                  key={nd.id}
                  className="node-g"
                  onClick={(e) => onNodeClick(e, nd.id)}
                  onMouseEnter={() => setHovered(nd.id)}
                  onMouseLeave={() => setHovered(null)}
                  filter={glow ? "url(#glow)" : undefined}
                >
                  <circle cx={nd.x} cy={nd.y} r={12} fill="transparent" />
                  <circle
                    cx={nd.x}
                    cy={nd.y}
                    r={5}
                    fill={fill}
                    stroke={stroke}
                    strokeWidth={2}
                  />
                  {showLabel && (
                    <text
                      x={nd.x + nd.lx}
                      y={nd.y + nd.ly}
                      textAnchor="middle"
                      dominantBaseline="central"
                      className="node-label"
                      fill={stroke}
                    >
                      {nd.label}
                    </text>
                  )}
                </g>
              );
            })}
          </svg>

          {flash && <div className="flash-msg">{flash}</div>}
        </div>

        <aside className="side-panel">
          <section className="panel-section">
            <h3 className="panel-heading">Wiring Points</h3>
            <p style={{ fontSize: 13, color: "#2d3748", lineHeight: 1.55 }}>
              Each blue dot is a <strong>wiring point</strong> on this panel:
              terminal strip screws, breaker poles, contactor points, auxiliary
              contacts, and coil terminals. All {terminalList.length} points are
              synchronized from one source so drawing and interaction always
              stay aligned. Click one dot, then another to draw a wire; click an
              existing wire to remove it.
            </p>
          </section>

          <section className="panel-section">
            <h3 className="panel-heading">Submit</h3>
            <p style={{ fontSize: 12, color: "#4a5568" }}>
              Submit still checks against the expected {total} power paths (same
              exercise as before). You can connect any terminal to any other for
              practice; wrong extras show in red after submit.
            </p>
          </section>

          <section className="panel-section">
            <div className="progress-bar-wrap">
              <div className="progress-label">
                <span>Required connections</span>
                <span className="progress-count">
                  {drawn} / {total}
                </span>
              </div>
              <div className="progress-bar">
                <div
                  className="progress-fill"
                  style={{ width: `${Math.min(drawn / total, 1) * 100}%` }}
                />
              </div>
            </div>
          </section>

          {result && (
            <section
              className={`panel-section feedback-section ${result.allCorrect ? "feedback-ok" : "feedback-err"}`}
            >
              {result.allCorrect ? (
                <>
                  <div className="feedback-icon-big">✓</div>
                  <strong>Circuit Complete!</strong>
                  <p>All {total} required connections match the answer key.</p>
                  <button type="button" className="btn-next" disabled>
                    Next Exercise →
                  </button>
                </>
              ) : (
                <>
                  <div className="feedback-icon-big">✗</div>
                  <strong>Check your wiring.</strong>
                  {result.wrongKeys.length > 0 && (
                    <p>
                      <span className="pill pill-red">
                        {result.wrongKeys.length} incorrect
                      </span>{" "}
                      — remove red wires.
                    </p>
                  )}
                  {result.missingIds.size > 0 && (
                    <p>
                      <span className="pill pill-yellow">
                        {result.missingKeysCount} missing
                      </span>{" "}
                      — yellow dots still need the required link.
                    </p>
                  )}
                </>
              )}
            </section>
          )}

          <div className="panel-actions">
            <button
              type="button"
              className="btn-submit"
              onClick={onSubmit}
              disabled={result?.allCorrect || drawn === 0}
            >
              Submit
            </button>
            <button type="button" className="btn-reset" onClick={onReset}>
              Clear All
            </button>
            <button type="button" className="btn-answer" onClick={onShowAnswer}>
              Show Answer
            </button>
          </div>
        </aside>

        <ChatPanel getCanvasContext={getCanvasContext} />
      </div>
    </div>
  );
}
