const DEEPSEEK_URL = "https://api.deepseek.com/chat/completions";

const SYSTEM_PROMPT = `You are Dr. CAD Bot, a friendly and patient electrical-education tutor embedded in a training simulator for a three-phase forward/reverse (F/R) motor control circuit.

Your student is learning to wire this circuit by clicking terminals and drawing wires on an interactive canvas. You are given the exact current state of their canvas on every turn: every wire they have drawn, which ones are correct, which are wrong, and which required connections are still missing.

How to teach:
- Ground every answer in the ACTUAL canvas state you're given — never invent wires that aren't listed, and never claim something is wrong/missing if the state says otherwise.
- When something is wrong, explain WHY it's wrong electrically (e.g. "that would put line voltage directly on a control-circuit terminal" or "this skips the breaker's protection"), not just "that's incorrect."
- When guiding toward a missing connection, explain the underlying principle (e.g. reversing rotation by swapping two phases, protecting a branch with the breaker, wiring auxiliary contacts for interlocking) rather than just stating the two terminal names — let the student make the final connection themselves when possible.
- Keep answers concise and encouraging. Use short paragraphs or a tight bullet list. Avoid walls of text.
- If the student asks something unrelated to this circuit or electrical wiring fundamentals, gently redirect to the exercise.
- If the circuit is fully correct, congratulate them and briefly explain why the completed circuit works (forward path, reverse path, and how the phase swap on K2 reverses the motor).`;

function formatCanvasContext(ctx) {
  if (!ctx) return "No canvas state was provided.";
  const section = (title, items) =>
    items.length
      ? `${title}:\n${items.map((l) => `  - ${l}`).join("\n")}`
      : `${title}: none`;

  return [
    `Progress: ${ctx.totalDrawn} wires drawn, ${ctx.totalRequired} required connections total.`,
    ctx.isComplete
      ? "The circuit is currently 100% CORRECT and COMPLETE."
      : "The circuit is not yet complete.",
    section("Correct wires already drawn", ctx.correctDrawn),
    section("Incorrect / extra wires currently drawn", ctx.wrongDrawn),
    section("Required connections still missing", ctx.missing),
  ].join("\n\n");
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  if (!process.env.DEEPSEEK_API_KEY) {
    res.status(500).json({ error: "Server is missing DEEPSEEK_API_KEY." });
    return;
  }

  const { messages, canvasContext } = req.body ?? {};
  if (!Array.isArray(messages) || messages.length === 0) {
    res.status(400).json({ error: "messages[] is required." });
    return;
  }

  const chatMessages = messages
    .filter((m) => m && typeof m.content === "string" && m.content.trim())
    .map((m) => ({
      role: m.role === "assistant" ? "assistant" : "user",
      content: m.content,
    }));

  // Ground the model in live canvas state as a prefix on the latest user
  // message, so it always reasons from current wiring.
  const lastIdx = chatMessages.length - 1;
  if (lastIdx >= 0 && chatMessages[lastIdx].role === "user") {
    chatMessages[lastIdx] = {
      ...chatMessages[lastIdx],
      content: `<canvas_state>\n${formatCanvasContext(canvasContext)}\n</canvas_state>\n\n${chatMessages[lastIdx].content}`,
    };
  }

  res.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    Connection: "keep-alive",
  });

  try {
    const upstream = await fetch(DEEPSEEK_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.DEEPSEEK_API_KEY}`,
      },
      body: JSON.stringify({
        model: "deepseek-chat",
        stream: true,
        max_tokens: 1024,
        messages: [{ role: "system", content: SYSTEM_PROMPT }, ...chatMessages],
      }),
    });

    if (!upstream.ok || !upstream.body) {
      const text = await upstream.text().catch(() => "");
      throw new Error(`DeepSeek request failed (${upstream.status}): ${text}`);
    }

    const reader = upstream.body.getReader();
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
        const delta = parsed.choices?.[0]?.delta?.content;
        if (delta) {
          res.write(`data: ${JSON.stringify({ delta })}\n\n`);
        }
      }
    }

    res.write("data: [DONE]\n\n");
    res.end();
  } catch (err) {
    res.write(`data: ${JSON.stringify({ error: err.message || "Request failed." })}\n\n`);
    res.end();
  }
}
