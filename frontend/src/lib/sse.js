// POST to a pipeline endpoint that streams SSE events ({type: step|result|error}).
// Calls onStep for each step event and resolves with the final result payload.
// Pass an AbortSignal to cancel; the backend stops the run when the stream closes.
export async function streamPipeline(url, body, onStep, signal) {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal,
  });
  if (!res.ok) {
    const detail = (await res.json().catch(() => ({}))).detail;
    throw new Error(detail ?? `Request failed (${res.status})`);
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let result = null;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    const events = buffer.split("\n\n");
    buffer = events.pop();
    for (const raw of events) {
      if (!raw.startsWith("data: ")) continue;
      const event = JSON.parse(raw.slice(6));
      if (event.type === "step") onStep(event);
      else if (event.type === "error") throw new Error(event.message);
      else if (event.type === "result") result = event.data;
    }
  }

  if (!result) throw new Error("The pipeline ended without returning a result");
  return result;
}
