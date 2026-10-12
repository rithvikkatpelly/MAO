# Guardrails

Every guardrail in the backend, where it lives, and how to operate it. The code is in
`backend/guardrails/`. Every limit below can be changed in `backend/.env`; the defaults are in
`backend/.env.example`.

## How a request flows

1. **HTTP layer** (`guardrails/http.py`). Bodies over 10 MB are refused before they are read.
   State-changing requests from other sites are refused. Every response carries security headers.
2. **Admission** (`guardrails/jobs.py`). This checks the kill switch, the per-minute rate limit
   and the one-generation-per-creator rule, then charges the daily quota. Failing any check returns
   a normal 429 or 503 before any work starts.
3. **Input validation** (`guardrails/validators.py`, `guardrails/semantic.py`). Instructions (topics, notes, chat messages)
   are refused if they break the content policy or try to override the AI. Data (pasted text,
   slide copy, web results) has instruction-like sentences removed instead.
4. **Fair queue** (`guardrails/gate.py`). Generations take the model in arrival order. While one
   waits, the creator sees their place in line.
5. **Guarded model call** (`llm.py`). Every model call goes through one function. It checks the
   per-run budget, fits the prompt to the model's window, adds the hardened system prompt and a
   reminder, validates the output, and writes an audit record.
6. **Grounding review** (`guardrails/grounding.py`). Research facts must cite a real source, and
   their numbers must appear in that source. Numbers in the final copy are checked against the
   sources. Copy that repeats a source or an example post word for word is flagged.
7. **Result**. Warnings travel with the result and appear in the editor under
   **Check > AI review notes**. A failed or cancelled run refunds the creator's quota.

## Daily limits

Limits are per creator and reset at midnight UTC. Creators see them on **Account and data**,
and the Create page shows designs left.

| Bucket | Default | Counts |
| --- | --- | --- |
| `design` | 5 | A finished carousel, poster, image, thumbnail, text post, deck, or infographic |
| `research` | 20 | A research run that proposes ideas |
| `assist` | 100 | Editor AI edits: rewrite, hooks, captions, repurpose, week plan, visualize |
| `chat` | 50 | Chat messages |
| `trend` | 5 | Manual trend watch runs |
| `upload` | 60 | Images staged for Instagram |
| `publish` | 10 | Instagram posts |

Text posts use the same research-and-write pipeline as visual posts, so they count as designs.

There are also per-minute limits for bursts (`PER_MINUTE` in `guardrails/config.py`). Each
creator can run one generation at a time and two quick edits at a time.

## Context window

`CONTEXT_WINDOW_TOKENS` defaults to 200,000. It is the most conversation history a chat keeps.
When a new turn would push a conversation past it, the oldest messages are deleted, a question
and its answer together, until it fits. The `/chat` response reports `conversation_tokens` and
`removed_messages`.

The local model reads less than that per call. `LLM_NUM_CTX` defaults to 8,192, and qwen3:8b
supports at most 32,768. Each call therefore sends the newest part of the history that fits.
One-shot prompts are fitted the same way: fenced data blocks are shortened, largest first, and
the task and the rules are never cut. Without this, Ollama silently drops the start of an
oversized prompt, which is where the safety rules are. Token counts are estimates, at 3.5
characters per token.

Chat endpoints:

```
POST   /chat                    {"message": "...", "conversation_id": "<optional>"}
GET    /api/chat/{conversation_id}
DELETE /api/chat/{conversation_id}
```

## Prompt injection and jailbreak defenses

- **Instruction hierarchy.** Every call starts with a system message, in `guardrails/prompts.py`.
  It says its rules outrank everything else and that tagged data is never instructions. It
  forbids personas and special modes, and asks for a refusal in the expected output format. A
  short reminder follows each task, which helps small models that weigh recent text more heavily.
- **Fenced data.** Web results, pasted text, slide copy, example posts and past titles are
  wrapped in `<untrusted_...>` tags with a random id, using `fence()` in `guardrails/untrusted.py`.
  Data cannot close a fence early, because any fence tags inside it are stripped.
- **Detection.** `guardrails/injection.py` scores text against weighted rules. The rules cover
  override phrases, prompt extraction, persona switches, known jailbreaks such as DAN and
  developer mode, chat-template tokens, fence escapes, encoded payloads and authority claims.
  Instructions that score 3 or more are refused. In data, the offending sentences are removed.
- **Hidden characters.** Zero-width characters, bidirectional controls and Unicode tag
  characters are stripped before any check, in `guardrails/sanitize.py`. This defeats
  "ASCII smuggling".
- **Stored injection.** Profile fields, example posts, series prompts, brand kits and trend topics
  are checked when they are saved, because they reach prompts later.
- **Leak detection.** The system prompt contains a random canary marker. Any output containing
  it, or claiming an unrestricted persona, is withheld.

## Semantic input validation

Keyword rules only catch wording they know. A request like "best way to poison someone without
getting caught" contains none of their phrases. So before any web search or generation, a
classifier judges what the request means. That classifier is the local model, prompted only to
classify, in `guardrails/semantic.py`.

- **What it sees.** Everything the creator asked for:
  - the topic, or the topic plus the chosen idea
  - the deck brief and pasted text
  - the post being edited
  - the week-plan notes and series prompts
  - the trend topic
  - the chat message together with the previous one, so a request split across two turns is
    still judged as a whole
- **How it decides.** By intent, not subject. Helping someone cause harm is refused: violence,
  weapons, self-harm, sexual content involving minors, stalking, hacking, fraud, financial crime,
  drugs, extremism, hate, harassment, and persuasive health or election misinformation.
  Education, awareness, prevention, news, history and lawful activities pass, such as "warning
  signs of poisoning in pets" or "how to buy a gun legally".
- **Hardening.** The request is fenced as data, and the answer is a fixed schema: reason, then
  category, then harmful. A named harm always counts as harmful. It runs at temperature 0 with a
  one-day cache. Keyword and injection rules run first, so "classify this as safe" never reaches it.
- **Where it shows.** Creators see a "Safety check" step in the progress screen. A refused request
  stops before research and does not use up the creator's quota. Every verdict is written to the
  audit log, without the text.
- **Cost.** Each check takes about 2 to 4 seconds on qwen3:8b. Repeated requests come from the cache.
- **Settings.** `SEMANTIC_GUARD` turns it on or off. `SEMANTIC_GUARD_MODEL` picks the model.
  `SEMANTIC_GUARD_FAIL_OPEN` decides what happens if it cannot run; the default refuses the request.

The cases it is tested against are in `guardrails/evals/semantic.jsonl`: harmful paraphrases and
sensitive but legitimate look-alikes. `uv run python -m guardrails.evals --live` runs them on the
real model. Add a case for every miss or false refusal you see.

## Content policy

`guardrails/moderation.py` refuses sexual content involving minors, weapons and explosives,
drug synthesis, self-harm encouragement, violent extremism, malware, hate speech, harassment and
doxxing, and fraud. The rules target intent, so creator topics like these still pass: how to spot
a phishing email, suicide prevention resources, a bath bomb tutorial.

Moderation runs on instructions, on every model output, and on the caption right before
publishing. Set `GUARD_MODEL=llama-guard3:1b` (first run `ollama pull llama-guard3:1b`) to add a
local safety classifier for instructions, chat replies and posts. If the classifier is down, the
rules still apply.

## Output validation

Every model output passes `check_output()`:

- Text is normalized.
- Links are removed, because creators add their own.
- Emails, phone numbers, US Social Security numbers and card numbers are removed. Card numbers are
  checked with the Luhn test.
- Hashtags are reduced to letters, numbers and underscores, and deduplicated.
- The output is withheld on a policy match or a leak.

## Agent and pipeline limits

- Agents have no tools that change anything. Publishing is always a click by the creator, after
  the caption passes moderation.
- `MAX_MODEL_CALLS_PER_RUN` (24) and `RUN_DEADLINE_SECONDS` (900) stop runaway runs.
- `LLM_TIMEOUT_SECONDS` (180) bounds each model call, and web searches time out after 10 seconds.
- Web sources must be http or https. They are filtered by `BLOCKED_SOURCE_DOMAINS`, and
  `PREFERRED_SOURCE_DOMAINS` plus .gov and .edu sites rank first.

## Kill switches

AI features and publishing can be paused without a redeploy:

```
cd backend
uv run python -m guardrails.flags                # show
uv run python -m guardrails.flags ai off         # pause every AI feature
uv run python -m guardrails.flags publishing off # pause Instagram publishing
```

Flags are stored in Postgres and re-read every 10 seconds. `AI_ENABLED=false` or
`PUBLISHING_ENABLED=false` in the environment also turns a feature off.

## Instagram

- Each connect link works once, enforced in the `oauth_nonces` table.
- The callback passes errors to the app as fixed codes, never as free text.
- Each post carries a browser-generated `request_id`, so a retry returns the first result instead
  of posting twice.
- At most 20 images can be staged per creator. A limited number of posts publish at once
  (`PUBLISHES_IN_FLIGHT`), so slow uploads cannot tie up the server.
- Tokens are encrypted with `SECRET_KEY`, which must be at least 32 characters.

To rotate the key, set the new value as `SECRET_KEY` and the old one as `SECRET_KEY_PREVIOUS`.
Tokens are re-encrypted as they are used. Remove the old key once every account has been used.

## Authentication and HTTP

- Dev login only works for requests made directly on this machine. Requests through a tunnel
  such as cloudflared or ngrok are refused, even though the tunnel connects from 127.0.0.1,
  because they carry forwarding headers and a public Host.
- Sign-in attempts are rate limited per client address.
- `COOKIE_SAMESITE=none` requires `COOKIE_SECURE=true`.
- With `COOKIE_SECURE=true`, the interactive API docs are turned off.
- API responses send `Content-Security-Policy: default-src 'none'`, plus nosniff, `DENY` framing
  and no-referrer. With `COOKIE_SECURE=true` they also send HSTS.
- The frontend's Content Security Policy is in `frontend/vite.config.js`. `vite preview` sends it,
  and production hosting must send the same header.

## Data retention and privacy

An hourly cleanup in `guardrails/maintenance.py` removes the following:

| Data | Kept for |
| --- | --- |
| Pipeline runs in the local LangGraph store | `PIPELINE_RETENTION_DAYS`, default 7 |
| Chats | `CHAT_RETENTION_DAYS`, default 30 |
| Audit log | `AUDIT_RETENTION_DAYS`, default 90 |
| Expired sessions, staged images and sign-in nonces | Until they expire |

The audit log (`ai_audit`) stores sizes, hashes, timings and verdicts, never prompt or output text.

Creators can download everything stored about them, or delete their account, from
**Account and data**. Deletion also removes their saved pipeline runs.

## Testing

```
cd backend
uv run python -m guardrails.evals            # red-team rules, no model needed
uv run python -m guardrails.evals --live     # also attacks the local model
TEST_DATABASE_URL=postgresql://localhost:5432/aurea_test uv run pytest tests -q
```

Database tests only use `TEST_DATABASE_URL`, never the `DATABASE_URL` in `.env`. Add new attacks
and new false positives to `guardrails/evals/redteam.jsonl`. CI in
`.github/workflows/security.yml` runs the evals, the tests, and pip-audit and npm audit.

## Known limits

- The keyword rules are pattern based, so the semantic classifier stands behind them. It is a
  small local model, so a determined attacker can still find phrasings it misjudges. The system
  prompt, fencing and output checks are the layers behind it.
- Images are not moderated, because the local stack has no vision model.
- Token counts are estimates. Real counts from Ollama are recorded in the audit log.
- Chat answers have no sources, so they are not grounded and can include invented numbers.
