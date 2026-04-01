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
} from "../cadModel.js";

function isAllowedConnection(aId, bId) {
  return aId !== bId;
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
  const [selected, setSelected] = useState(null);
  const [hovered, setHovered] = useState(null);
  const [cursorPos, setCursorPos] = useState(null);
  const [result, setResult] = useState(null);
  const [flash, setFlash] = useState(null);
  const svgRef = useRef(null);

  const connMap = useMemo(
    () => new Map(connections.map((c) => [c.key, c])),
    [connections],
  );

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
      if (!selected) {
        setCursorPos(null);
        return;
      }
      setCursorPos(svgXY(e));
    },
    [selected],
  );

  function onNodeClick(e, id) {
    e.stopPropagation();
    if (result?.allCorrect) return;
    if (!selected) {
      setSelected(id);
      return;
    }
    if (selected === id) {
      setSelected(null);
      return;
    }
    if (!isAllowedConnection(selected, id)) {
      setFlash("Pick two different terminals.");
      setSelected(null);
      setTimeout(() => setFlash(null), 2000);
      return;
    }
    const key = connKey(selected, id);
    if (connMap.has(key)) {
      setConnections((prev) => prev.filter((c) => c.key !== key));
    } else {
      setConnections((prev) => [...prev, { key, from: selected, to: id }]);
    }
    setSelected(null);
    if (result && !result.allCorrect) setResult(null);
  }

  function onLineClick(e, key) {
    e.stopPropagation();
    if (result?.allCorrect) return;
    setConnections((prev) => prev.filter((c) => c.key !== key));
    if (result && !result.allCorrect) setResult(null);
  }

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
    setSelected(null);
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
    setSelected(null);
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
            onClick={() => setSelected(null)}
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

            {connections.map(({ key, from, to }) => {
              const a = terminalsById[from];
              const b = terminalsById[to];
              if (!a || !b) return null;
              const s = lineColor(key);
              return (
                <line
                  key={key}
                  x1={a.x}
                  y1={a.y}
                  x2={b.x}
                  y2={b.y}
                  stroke={s.stroke}
                  strokeWidth={s.sw}
                  strokeDasharray={s.dash}
                  strokeLinecap="round"
                  className="conn-line"
                  onClick={(e) => onLineClick(e, key)}
                />
              );
            })}

            {selected && cursorPos && terminalsById[selected] && (
              <line
                x1={terminalsById[selected].x}
                y1={terminalsById[selected].y}
                x2={cursorPos.x}
                y2={cursorPos.y}
                stroke="#ff8f00"
                strokeWidth={1.5}
                strokeDasharray="6,4"
                strokeLinecap="round"
                opacity={0.7}
                pointerEvents="none"
              />
            )}

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
      </div>
    </div>
  );
}
