import { useState, useRef, useEffect, Fragment } from "react";

const WELCOME = {
  role: "assistant",
  content:
    "Hi, I'm Dr. CAD Bot. Ask me how to wire this circuit, or why a connection is right or wrong — I can see exactly what you've drawn on the canvas.",
};

// Minimal inline-markdown renderer for chat bubbles: **bold**, *italic*,
// `code`, and line breaks. Deliberately narrow — just what a tutor's
// streamed prose actually uses — rather than pulling in a markdown library.
const INLINE_PATTERN = /\*\*(.+?)\*\*|\*(.+?)\*|`(.+?)`/g;

function renderInline(text, keyPrefix) {
  const nodes = [];
  let last = 0;
  let match;
  let i = 0;
  while ((match = INLINE_PATTERN.exec(text))) {
    if (match.index > last) nodes.push(text.slice(last, match.index));
    const [, bold, italic, code] = match;
    if (bold !== undefined) {
      nodes.push(<strong key={`${keyPrefix}-${i}`}>{bold}</strong>);
    } else if (italic !== undefined) {
      nodes.push(<em key={`${keyPrefix}-${i}`}>{italic}</em>);
    } else if (code !== undefined) {
      nodes.push(<code key={`${keyPrefix}-${i}`}>{code}</code>);
    }
    last = match.index + match[0].length;
    i += 1;
  }
  if (last < text.length) nodes.push(text.slice(last));
  return nodes;
}

function renderMessageContent(content) {
  const lines = content.split("\n");
  return lines.map((line, i) => (
    <Fragment key={i}>
      {i > 0 && <br />}
      {renderInline(line, i)}
    </Fragment>
  ));
}

export default function ChatPanel({ getCanvasContext }) {
  const [messages, setMessages] = useState([WELCOME]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const listRef = useRef(null);

  useEffect(() => {
    const el = listRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages, busy]);

  async function sendMessage(e) {
    e.preventDefault();
    const text = input.trim();
    if (!text || busy) return;

    const nextMessages = [...messages, { role: "user", content: text }];
    setMessages([...nextMessages, { role: "assistant", content: "" }]);
    setInput("");
    setBusy(true);
    setError(null);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: nextMessages,
          canvasContext: getCanvasContext(),
        }),
      });

      if (!res.ok || !res.body) {
        throw new Error(`Request failed (${res.status})`);
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        const lines = buffer.split("\n\n");
        buffer = lines.pop() ?? "";

        for (const line of lines) {
          const payload = line.replace(/^data: /, "").trim();
          if (!payload) continue;
          if (payload === "[DONE]") continue;
          const parsed = JSON.parse(payload);
          if (parsed.error) throw new Error(parsed.error);
          if (typeof parsed.delta === "string") {
            setMessages((prev) => {
              const copy = [...prev];
              const last = copy[copy.length - 1];
              copy[copy.length - 1] = {
                ...last,
                content: last.content + parsed.delta,
              };
              return copy;
            });
          }
        }
      }
    } catch (err) {
      setError(err.message || "Something went wrong.");
      setMessages((prev) => prev.slice(0, -1));
    } finally {
      setBusy(false);
    }
  }

  return (
    <aside className="chat-panel">
      <div className="chat-header">
        <div className="chat-avatar">🩺</div>
        <div>
          <div className="chat-title">Dr. CAD Bot</div>
          <div className="chat-subtitle">Your wiring tutor</div>
        </div>
      </div>

      <div className="chat-messages" ref={listRef}>
        {messages.map((m, i) => (
          <div key={i} className={`chat-msg chat-msg-${m.role}`}>
            <div className="chat-bubble">
              {m.content
                ? m.role === "assistant"
                  ? renderMessageContent(m.content)
                  : m.content
                : busy && i === messages.length - 1
                  ? "…"
                  : ""}
            </div>
          </div>
        ))}
        {error && <div className="chat-error">{error}</div>}
      </div>

      <form className="chat-input-row" onSubmit={sendMessage}>
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask Dr. CAD Bot about this circuit…"
          disabled={busy}
        />
        <button type="submit" disabled={busy || !input.trim()}>
          Send
        </button>
      </form>
    </aside>
  );
}
