# Listen (text-to-speech): implementation design

**Status:** Final design produced by a three-architect panel (MVP-first, security-first, static-first), scored by three independent judges and synthesized into one contract. Companion documents: `docs/tts-pilot-rollout.md` (rollout guardrails; takes precedence wherever the two conflict) and `docs/tts-static-audio.md` (CloudFront runbook).

**Phase numbering.** The pilot rollout document's numbering is canonical: **0** browser voice only, **1** studio voice on Vercel Preview, **2** studio voice in Production, **3a** pre-rendered audio served from this site, **3b** pre-rendered audio on CloudFront. Where this document says "phase 2" for static audio or "phase 2b" for CloudFront, read 3a and 3b.

---


Repo: `/home/user/nape-leadership-platform`. This is the `docs/tts-plan.md` that the committed `docs/tts-pilot-rollout.md` already references; where the two conflict, the rollout doc's guardrails win. Everything below was verified against the repo files on 2026-10-11 (clean tree at `f5618f6`): selectors, render functions, CSP string, smoke-test harness, CI file list. The extraction algorithm in §7 was executed against the live pages in the CI Chromium (1.56.1 / Chromium 141) and cross-checked in Node: 20 pilot blocks, 4,719 spoken characters, largest block 594, byte-identical text and SHA-256 in both runtimes, no page errors.

Five owners build in parallel on disjoint files: **server** (`api/tts.js`, `vercel.json`, `scripts/tts-api-check.js`), **player** (`assets/tts.js`, appended section of `assets/styles.css`), **markup** (`index.html`, `journey.html`, `reflections.html`, `resources.html`), **pipeline** (`scripts/build-audio.js`, `scripts/upload-audio.js`, `assets/audio/manifest.json`, `docs/tts-static-audio.md`, `docs/tts-plan.md`, `.gitignore`), **tests-docs** (`scripts/smoke.js`, `scripts/lib/static-server.js`, `.github/workflows/ci.yml`, `README.md`, `privacy.html`). The shared extraction module is `assets/tts.js` (player), dual-environment; §6.2 says how Node loads it without a DOM.

---

## 1. Goals

1. Members press **Listen** on curated program text (journey stage panels, practice cards, reflection prompts, program features, home "why" blocks) and hear it read aloud, on phones and desktops, with nothing configured (browser voice).
2. When `ELEVENLABS_API_KEY` and `ELEVENLABS_VOICE_ID` are set in Vercel, the same control switches to ElevenLabs audio automatically; the key never leaves the server; `/api/tts` cannot be used as a free TTS API (ids and digests only, never free text).
3. Narration can later be pre-rendered to MP3 files on CloudFront (optionally, first under `assets/audio/` on Vercel) with the same ids, the same extraction, and a manifest keyed by a stable text digest; the player prefers a static file, then the API, then the browser voice.
4. Fits the repo: plain JS, no build step, no new runtime dependencies, CommonJS function in the `api/feedback.js` style, strict CSP with exactly one added directive, Playwright smoke test extended, native accessible controls, print-safe, graceful degradation.

## 2. Non-goals (pilot)

- Narrating member-entered or personalized text: `#welcome-strip`, `#goals`, `#entries`, `#report`, `#cert`, `#feat-note`, `#cx-brief`, `#cx-support`, `#cx-steps`, `#cx-guardrails`, `#cx-warm`, `#nb-cards`, `#sm-posts`, `#pdf-doc`, `#pr-doc`. Never, in any phase (privacy.html promises these never leave the device). A smoke assertion enforces this on every page.
- Legal pages, forms, the assessment quiz, tables, the proposal calculator, nav/footer chrome.
- Pause/resume, speed control, word highlighting, multiple voices, Media Session, Cache API offline storage, a new localStorage key. All deferred (§20) with the reason.

## 3. User stories

- A member on a phone opens Journey, taps **Listen** under "Lead Others", hears the stage read aloud with natural pauses ("Mindsets: People develop through belief and challenge. …"), taps **Stop** to end it. Nothing was configured; it works offline-capable through the browser voice.
- NAPE sets the ElevenLabs variables on Preview; the same tap now plays the studio voice; the badge reads "Studio voice". The member typed nothing; only a content id and digest went to NAPE's server.
- NAPE edits a practice description. CI fails with a drift message until the allowlist is regenerated in the same PR; until then that block plays through the browser voice, never stale audio.
- NAPE later renders all blocks once, uploads them to S3 behind CloudFront, sets `TTS_AUDIO_BASE_URL`, redeploys; the badge reads "Pre-recorded" and ElevenLabs is no longer called for unchanged copy.
- A screen-reader user tabs to the button, hears "Listen to Lead Others, button", presses Enter, later hears "Stop reading Lead Others, button"; failures are announced once through the existing toast.

## 4. Architecture

```
 page (index / journey / reflections / resources)
 ├── <script src="assets/app.js">   unchanged (NAPE, NAPE_STAGES, napeToast)
 ├── <script src="assets/tts.js">   player + shared extraction (pure half also require()-able in Node)
 └── inline page script             sets data-tts on rendered roots, calls NAPE_TTS.mount(root) after innerHTML

 click Listen ─► text = NAPE_TTS.spokenText(root)  (synchronous DOM walk + normalize)
   browser tier possible only?  ─► speechSynthesis.speak(chunks)   synchronously inside the gesture
   network tier possible?       ─► unlock <audio> with a silent WAV blob (sync), then async:
        sha = sha256(text)
        tier 1  cfg.static && cfg.static.items[id] === sha16  ─► <audio src = base + gen + "/" + id + "." + sha16 + ".mp3">
        tier 2  cfg.provider === "elevenlabs"                  ─► fetch GET /api/tts?id=<id>&h=<sha>&v=<gen> ─► blob: ─► <audio>
        tier 3  speechSynthesis (after an await: may be ignored on iOS → toast "Tap Listen again", preferBrowserNext)

 api/tts.js (Vercel, CommonJS, GET only)
   ?status=1        → { ok, provider, gen, blocks, static:{ base, gen, items } | null }   edge-cached 60 s
   ?id=&h=&v=       → canonical query only; lookup in assets/audio/manifest.json; h must equal items[id].sha;
                      v must equal live gen; → ElevenLabs → audio/mpeg, immutable 1-year edge cache

 scripts/build-audio.js (Node 20 + Playwright, same static server as smoke.js)
   --dry-run --write-allowlist → assets/audio/manifest.json items (id → text, sha, chars, page)
   --dry-run --check           → fail CI on drift (ids, sha, Node-recomputed sha and compose parity)
   --render [--out dir]        → <gen>/<id>.<sha16>.mp3 for missing files; manifest.render + file/bytes
 scripts/upload-audio.js (AWS SDK v3) → private S3 bucket (OAC) → CloudFront → TTS_AUDIO_BASE_URL
```

### 4.1 One content identity, three uses

- **`id`** — the `data-tts` value, e.g. `journey.stage.others`. Grammar `^[a-z][a-z0-9]*(\.[a-z0-9-]+)+$`, max 64 chars. Human, stable, used for allowlisting, file names, test selectors.
- **`sha`** — lowercase hex SHA-256 (64 chars) of the UTF-8 bytes of the spoken text (§7). `sha16 = sha.slice(0,16)`. Computed by the browser (`crypto.subtle`) and by the build (`node:crypto`). It is in the API URL and in the static file name, so a copy edit changes every URL and stale audio is unreachable.
- **`gen`** — 12 lowercase hex: `sha256("nape-tts|" + ELEVENLABS_VOICE_ID + "|" + modelId + "|mp3_44100_128").slice(0,12)` (modelId = `ELEVENLABS_MODEL_ID || "eleven_multilingual_v2"`). Test vector: voice `testvoice0001`, model `eleven_multilingual_v2` → `28dcadceed2d`. It is in the API URL (`v`) and is the static directory name, so a voice or model change changes every URL without a manual version bump. It is a one-way fingerprint of a non-secret: a premade ElevenLabs voice id can be recovered by dictionary from it. That is acceptable (a voice id is not a credential) and the docs say so rather than claiming the probe reveals nothing about the voice. Nothing is ever derived from the API key.

### 4.2 Provider selection and detection

Server (`api/tts.js`, evaluated per request):
```
voiceOk  = /^[A-Za-z0-9]{10,40}$/.test(ELEVENLABS_VOICE_ID || "")
modelId  = ELEVENLABS_MODEL_ID || "eleven_multilingual_v2"; modelOk = /^[a-z0-9_]+$/.test(modelId)
provider = (TTS_PROVIDER || "auto").trim().toLowerCase() === "browser" ? "browser"
         : (ELEVENLABS_API_KEY && voiceOk && modelOk) ? "elevenlabs" : "browser"
gen      = provider === "elevenlabs" ? fingerprint(voiceId, modelId) : null
base     = valid(TTS_AUDIO_BASE_URL) ? withTrailingSlash(TTS_AUDIO_BASE_URL) : null   // valid = starts with "https://" or "/", no whitespace, no "?" or "#"
static   = (base && manifest.render && manifest.render.gen) ? { base, gen: manifest.render.gen, items: { id: sha16 for every item with a file } } : null
```
Kill switches: `TTS_PROVIDER=browser` (studio tier off without deleting the key), unset `TTS_AUDIO_BASE_URL` (static tier off). **Vercel applies environment-variable changes only to a new deployment: change the variable, then Redeploy.** No code change is needed; the redeploy also purges the edge cache. The probe is edge-cached 60 s on top of that.

Client (`assets/tts.js`), per click, each step falls through silently on any failure:
1. **Static file** — only if `cfg.static` and `cfg.static.items[id] === sha16` (the "re-hash and compare with the manifest" check). Plays `cfg.static.base + cfg.static.gen + "/" + id + "." + sha16 + ".mp3"` directly as `<audio src>`: no `fetch`, no `crossorigin` attribute, so no CORS and no `connect-src` change. A media error (403/404/CSP/network) falls through.
2. **Studio voice** — only if `cfg.provider === "elevenlabs"`. `fetch("/api/tts?id=" + id + "&h=" + sha + "&v=" + cfg.gen)`; any non-200 (404 after a copy edit, 409 after a voice change, 413, 429, 503, 502), non-`audio/*` content type, network error or abort falls through. On 200 the body is played from a `blob:` URL (Safari needs seekable media; a function cannot answer Range requests).
3. **Browser voice** — `speechSynthesis` with sentence chunking. Missing API or an error other than `canceled`/`interrupted` → reset the control and toast once. Controls stay usable (no page-wide hide after one failure); a control is `hidden` only when `speechSynthesis` is absent **and** the probe offers neither static nor studio audio.

The probe is fetched once per page load right after `mount()` finds a `[data-tts]` root (same-origin GET, memoized; failure → `{ provider: "browser", gen: null, static: null }`). **The click handler never awaits the probe, the voices or the SHA before `speechSynthesis.speak()`**: when the browser tier is the path, `speak()` runs synchronously inside the gesture (iOS requires it); the SHA is computed only on the audio path.

## 5. Data model

### 5.1 `assets/audio/manifest.json` (generated by the pipeline, committed; one file is both the server allowlist and the static manifest)

```json
{
  "version": 1,
  "generatedAt": "2026-10-11T18:20:00.000Z",
  "maxChars": 1200,
  "render": null,
  "items": {
    "journey.stage.others": {
      "page": "/journey",
      "sha": "b4ebe1a4fb2c7d62f4c5474ecf4ea85d237f06b01c82092680367d6f086ea02e",
      "chars": 483,
      "text": "Lead Others. Trust is the currency of leadership. Mindsets: People develop through belief and challenge. …"
    }
  }
}
```
- `version` mirrors `NAPE_TTS.VERSION` (bump both when extraction rules change; every sha changes).
- `items[id]` = `{ page, sha, chars, text }` plus, only after `--render`: `file` (`<id>.<sha16>.mp3`), `bytes`, optional `seconds` (≈ `bytes*8/128000`, 0.1 s precision).
- `render` is `null` until the first render, then `{ "gen": "<12hex>", "model": "eleven_multilingual_v2", "format": "mp3_44100_128", "voice": "<label from ELEVENLABS_VOICE_LABEL, never the id>", "renderedAt": "<ISO>" }`. Files live at `<TTS_AUDIO_BASE_URL><render.gen>/<id>.<sha16>.mp3`. A render with a different `gen` replaces `render` and clears every `file`/`bytes`/`seconds` (old objects stay on S3 unreferenced; never deleted or overwritten).
- Loaded by: `api/tts.js` via `require("../assets/audio/manifest.json")` at module scope inside try/catch (Vercel's dependency tracer bundles static relative requires; a missing file means every id is unknown and the player uses the browser voice); `scripts/build-audio.js` via `fs`. **The browser never fetches it** — the probe carries `static.items` (id → sha16). Threshold: when the catalog grows past ~100 ids, move `items` out of the probe into a same-origin fetch of the manifest (`connect-src 'self'` already allows it).
- Phase-0 seed: the pipeline owner commits the 20 pilot items from §7.5 (hand-seeded or generated); `render: null`.

### 5.2 Static object layout (phase 2)
`audio/<gen>/<id>.<sha16>.mp3`, `Content-Type: audio/mpeg`, `Cache-Control: public, max-age=31536000, immutable`. Re-voicing produces a new `<gen>/` prefix automatically.

## 6. Interfaces

### 6.1 Markup contract (markup owner writes, player owner reads)

| Attribute | Where | Meaning |
|---|---|---|
| `data-tts="<id>"` | root element of a narratable block | Marks the block; `mount()` injects the control inside it; extraction walks its subtree. Rendered roots set it from JS to the current variant. |
| `data-tts-title="<text>"` | the root (optional) | Accessible-name subject: `aria-label="Listen to <text>"` / `"Stop reading <text>"`. Fallback: first `h1,h2,h3,h4` text inside the root, else the id. |
| `data-tts-slot` | one descendant (optional) | `mount()` appends the control inside this element. Without it: immediately after the first `h1,h2,h3,h4` descendant; else as the root's first child. |
| `data-tts-skip` | any descendant | Excluded from extraction (in addition to the built-in skip list §7.1). Used on `#feat-note`. |
| `data-tts-ctl`, `data-tts-play` | injected by the player | Never authored by hand. |

Exact page edits (markup owner):

- **Every pilot page** (`index.html`, `journey.html`, `reflections.html`, `resources.html`): add `<script src="assets/tts.js"></script>` immediately after `<script src="assets/app.js"></script>` (relative path like the rest). Never in `404.html` (it uses `/assets/...` and is served at nested paths) or any other page.
- **index.html** line 92: `<div class="wrap" data-tts="index.why" data-tts-title="Why this matters">`. `#welcome-strip` (line 51) stays outside any root.
- **journey.html**: line 69 `<div class="stage-panel" id="stage-panel" role="tabpanel" aria-live="polite">` unchanged in HTML. In `renderStage(key)`: first statement `panel.dataset.tts = "journey.stage." + key;`; in the template insert `<div data-tts-slot></div>` on its own line right after `<span class="panel-tag">${s.tag}</span>`; after the existing `#panel-starter` `addEventListener` block add `if (window.NAPE_TTS) NAPE_TTS.mount(panel);`. Lines 53/58/63: `<span class="stage-dot" aria-hidden="true">…`. Accessible name comes from the panel's `<h3>` ("Listen to Lead Others").
- **reflections.html**: line 50 `<div class="prompt-card" data-tts="reflections.prompt.self.0" data-tts-title="this prompt">` (the initial id is overwritten by `showPrompt()` before first paint); line 53 add `data-tts-slot` to the existing flex row `<div style="margin-top:12px;display:flex;gap:10px;flex-wrap:wrap" data-tts-slot>`. In `showPrompt()` add as the last statement: `document.querySelector(".prompt-card").dataset.tts = "reflections.prompt." + curStage + "." + (pIdx % PROMPTS[curStage].length);`. No mount call needed (static card; `assets/tts.js` mounts at load).
- **resources.html**: line 43 `<div class="wrap" data-tts="resources.features" data-tts-title="Program features">`; line 47 `<p id="feat-note" data-tts-skip>`; lines 51/57/63/69 `<span class="icon" aria-hidden="true">`. Practices template line 132: `<div class="card" data-tts="resources.practices.${k}" data-tts-title="${NAPE_STAGES[k].name} practices">` and insert `<div data-tts-slot></div>` right after the `<h3 …>${NAPE_STAGES[k].name}</h3>` line. After the `innerHTML` assignment (line 140) add `if (window.NAPE_TTS) NAPE_TTS.mount(document.getElementById("practices"));`.

Resulting pilot ids (20): `index.why`; `resources.features`; `resources.practices.{self,others,org}`; `journey.stage.{self,others,org}`; `reflections.prompt.{self,others,org}.{0,1,2,3}`. Root counts per page: `/` 1, `/journey` 1, `/reflections` 1, `/resources` 4, every other page 0.

Re-rendered content: `renderStage` replaces `#stage-panel.innerHTML` on every tab change and calls `mount()` synchronously in the same task (one aria-live mutation, control present on first paint); `#practices` is rendered once and mounted once; `showPrompt()` only changes `#p-text` and the root's `data-tts`. The player also runs a MutationObserver (`childList`, `subtree`, `attributes` filtered to `data-tts`, coalesced per animation frame) as a safety net that re-mounts missing controls and stops playback when the active root leaves the DOM or its id changes.

### 6.2 Player API — `window.NAPE_TTS` (player owner; also `module.exports`)

`assets/tts.js` is one IIFE. The pure half is defined first; `if (typeof module !== "undefined" && module.exports) module.exports = API; if (typeof window !== "undefined") { window.NAPE_TTS = API; init(); }`. `node --check assets/tts.js` passes and `require("./assets/tts.js")` works in Node because nothing touches `document`/`window` outside `init()` and the DOM functions. In Node only `VERSION`, `SKIP`, `BLOCK_TAGS`, `PRONOUNCE`, `normalize`, `shape`, `compose`, `chunk`, `sha256hex`, `fingerprint` are meaningful; `extractUnits`, `spokenText`, `catalog`, `mount`, `probe`, `play`, `stop`, `state` exist but must not be called without a DOM (`catalog()` resolves `[]` and `mount()` is a no-op when `typeof document === "undefined"`).

```
NAPE_TTS.VERSION                       // 1
NAPE_TTS.SKIP, .BLOCK_TAGS, .PRONOUNCE // §7 constants (PRONOUNCE = [] until the owner decides "NAPE")
NAPE_TTS.normalize(str) → string
NAPE_TTS.shape(kind, normalizedText, nextKind|null) → string
NAPE_TTS.compose(units) → string       // units: [{kind:"h"|"li"|"p", text}]
NAPE_TTS.extractUnits(root) → units    // DOM walk (§7.2)
NAPE_TTS.spokenText(root) → string     // compose(extractUnits(root))
NAPE_TTS.sha256hex(text) → Promise<string>  // crypto.subtle in browsers, node:crypto in Node
NAPE_TTS.fingerprint(voiceId, modelId, format) → string  // gen, 12 hex
NAPE_TTS.chunk(text, max = 200) → string[]
NAPE_TTS.catalog() → Promise<[{ id, units, text, sha, chars }]>  // every [data-tts] root in the DOM now
NAPE_TTS.mount(root = document)        // idempotent; inject/refresh controls; stop() if the active root is gone or re-identified
NAPE_TTS.probe() → Promise<cfg>        // memoized per page; never rejects; cfg = { provider, gen, static }
NAPE_TTS.play(root) → Promise<void>    // what the delegated click handler calls
NAPE_TTS.stop()
NAPE_TTS.state() → { id, provider: "static"|"elevenlabs"|"browser"|null, status: "idle"|"loading"|"playing" }
NAPE_TTS.audio                         // the single persistent <audio class="tts-audio" preload="none" hidden>, created lazily
```
Elements created: `<span class="tts-ctl no-print" data-tts-ctl data-tts-state="idle"><button type="button" class="btn btn-outline btn-small tts-btn" data-tts-play aria-label="Listen to …">Listen</button><span class="tts-badge"></span></span>`; while active `data-tts-provider="static|elevenlabs|browser"` is set; while loading `aria-busy="true"` is set on `.tts-ctl`. Events: `document.dispatchEvent(new CustomEvent("nape:tts", { detail: { type: "start"|"end"|"stop"|"fallback"|"error", id, provider, from? } }))`. Storage keys: none. Toasts (through `window.napeToast` when present): `"Studio voice unavailable — using your browser's voice."` (fallback after a network tier failed), `"Listening isn't available in this browser."`, `"Tap Listen again to use your browser's voice."`.

### 6.3 HTTP API — `GET /api/tts` (server owner) — see `http_api` in the contract for the exact table.

### 6.4 Environment variables — see `env_vars` in the contract.

## 7. Text extraction and content id (shared, verified)

Deterministic from markup only (never `getComputedStyle`). Implemented once in `assets/tts.js`. The build reproduces it by running that same file in headless Chromium under Playwright and evaluating `NAPE_TTS.catalog()`; it then recomputes `compose(units)` and the SHA in Node from the dumped units and asserts parity. No Node-side HTML extractor is ever written.

### 7.1 Skip list (never spoken, subtree excluded)
```
script,style,svg,template,button,input,select,textarea,[hidden],[aria-hidden='true'],.tts-ctl,.btn,.link-btn,.icon,.stage-dot,.match-chip,.q-progress,.tally,.sr-only,.no-print,.toast,.fb,[data-tts-skip]
```

### 7.2 Units (DOM walk)
Walk `root`'s child nodes recursively in document order with a buffer and a current `kind`. Text nodes append to the buffer. An element matching 7.1 is skipped with its subtree. A **block** element flushes the buffer before and after its children and sets `kind` for its contents: block = tag in `ADDRESS ARTICLE ASIDE BLOCKQUOTE BR DD DIV DL DT FIELDSET FIGCAPTION FIGURE FOOTER FORM H1 H2 H3 H4 H5 H6 HEADER HR LI MAIN NAV OL P PRE SECTION TABLE TBODY TD TFOOT TH THEAD TR UL`, or a `STRONG`/`B` that is the first non-whitespace child of its parent (a leading label such as `<strong>Reflection prompt</strong>`). `kind`: `H1–H6` and leading `STRONG`/`B` → `"h"`; `LI` → `"li"`; everything else (including the root) → `"p"`. `flush()` pushes `{ kind, text: buffer }` when the buffer is non-blank.

### 7.3 `normalize(str)` (pure, in this order)
1. `normalize("NFC")`; 2. `[   ]` → space; 3. `[‘’]` → `'`, `[“”]` → `"`; 4. `…` → `.`; 5. `(\d)\s*–\s*(\d)` → `$1 to $2`; 6. `\s*[—–]\s*` → `, `; 7. `\s*·\s*` → `. `; 8. `\s*→\s*` → ` then `; 9. `←` removed; 10. `\s\+\s` → ` and `; 11. `\s*&\s*` → ` and `; 12. `\s\/\s` → ` or `; 13. remove `[↗✓✔◐○✕★☆•️‍⃣]`; 14. remove `\p{Extended_Pictographic}` (`u` flag); 15. `\s+([,.;:!?])` → `$1` and `,\s*([.!?:])` → `$1`; 16. collapse whitespace, trim. Digits stay digits; nothing is lowercased.

### 7.4 `shape(kind, t, nextKind)` and `compose(units)`
`compose`: normalize every unit's text, drop empties, then for each unit `shape(kind, text, kindOfNextNonEmptyUnit)`, join with a single space, apply `PRONOUNCE` pairs (`[RegExp, replacement]`, applied last so a pronunciation change re-hashes exactly the affected blocks), collapse whitespace, trim.
`shape`: `li` → strip trailing `[;,]+`; if `kind === "h"` and `nextKind === "li"` → list head: replace a trailing `.!?` (before optional closing `"')]`) with `:`, or append `:` if none; otherwise append `.` unless the text already ends in `[.!?:]["')\]]*`.

### 7.5 Reference catalog (computed from today's copy with the rules above; pin in the smoke test and seed the manifest)
```
index.why                    464  dd095b8f72793e5adcb4ae016108d61923e3641476e93fa81852ad4e1b48c0e0
resources.features           594  31b852f848f54e50cab35096caede85550a65e68852f636010fd39615fb28649
resources.practices.self     329  ced0bf55c15ed03955da464ca42e17e2ebd4cb10d7e371bf1d1aaa4df1d71171
resources.practices.others   337  b8a0ea3b267defab1c946875becffdf74bb8220476d551b0ee6bbe5d15931a4a
resources.practices.org      343  6f4b6a4536749a7ef68c8d27999ecd1e78819855d0dbe5f5b9d460c7fa99a5d2
journey.stage.self           417  d1f1be52397e2ea95ee9f82d908006820992df0173fc73f0cff21b5640a8105f
journey.stage.others         483  b4ebe1a4fb2c7d62f4c5474ecf4ea85d237f06b01c82092680367d6f086ea02e
journey.stage.org            495  d3db5b087c600c5b439e5c0160aab2d134c45e7bab6871355e9d1d122ed7df40
reflections.prompt.self.0    138  689d4f51e38c68c6199df85c0b36bebb2540dd3d7d62103a06ffb80994a22e35
reflections.prompt.self.1     97  bb04de9c06f5b8518f68edfd3cae28b4a2998028cfc81e5a76cf18d994f23bf9
reflections.prompt.self.2     82  2f8c206a2ebacf67dd9328d5ddec0f05127dcade76a31c799461f0758fac1af9
reflections.prompt.self.3     72  57e1c6385cc2cc008d222d25d1a8ec0f8f6cc40e6503277a83d43f76d4ecf11c
reflections.prompt.others.0  135  db85a77aab1ac90837b1b4767e2657bf0d54a760f1a952415472d8ae7073e109
reflections.prompt.others.1   92  2ef1c6ef13a1340965f0a539519a525c91f5f79c643aa791cc724885cbe8e407
reflections.prompt.others.2  100  4adecfeb3a4bcad1856cea9d04b8150c464232e7f189e481c83484f9d37fae1d
reflections.prompt.others.3   84  d6dbc92991ff36b7e83b772d253ad46908d0007d91bb863416d28def1ee242cc
reflections.prompt.org.0     146  446a8c7b59afae83e13030a194e03e452a8e6c1eb190b57f5b48199af303f843
reflections.prompt.org.1     113  b80c5ec42f7efe58f418d0edbfcb90c0d8ab5bb0e78d243ab77625f66b4e058c
reflections.prompt.org.2      94  7ade7457e914f2765cb87a4ffb93497bbbee9fea2e03091a9e5872f99a2a5fcb
reflections.prompt.org.3     104  2626c399acba8d97b91467712c11060ce013ffd50ce272e8d1cf5f7b416ed994
```
Verbatim texts: `journey.stage.others` = "Lead Others. Trust is the currency of leadership. Mindsets: People develop through belief and challenge. Trust is built in small moments. Teams outperform heroes. Skillsets: Coaching conversations. Developing future leaders. Building high-performing teams. Toolsets: One-on-one frameworks. Delegation with development in mind. Team health check-ins. Reflection prompt. Who on my team is ready for more responsibility than I've given them, and what's holding me back from offering it?"; `reflections.prompt.self.1` = "Prompt. Lead Self. When did I feel most like myself as a leader this week, and what created that?"; `reflections.prompt.self.0` = "Prompt. Lead Self. What kind of leader do the people in my agency need me to become, and what's one habit I'd have to change to get there?"; `index.why` begins "Why this matters. Built for the moments that matter most. Transition support. Supports leaders during times of transition and increased responsibility, when the role changes faster than the playbook. …"; `resources.features` begins "Program Features. What the experience includes. Mentorship. Learn from experienced probation executives, …" (no emoji, no "Suggested for your stage", no "Take the assessment"); `journey.stage.self` contains "Energy and time management". None of the 20 blocks contains "NAPE", so the pronunciation decision does not re-hash the pilot.

## 8. Player behaviour (player owner)

**Init** (end of `assets/tts.js`, DOM already parsed): `mount(document)`; one delegated `click` listener on `document` for `[data-tts-play]`; `keydown` Escape → `stop()`; `pagehide` → `stop()`; `MutationObserver` on `document.body`; `speechSynthesis.getVoices()` once and on `voiceschanged` (cached list, never awaited); if any `[data-tts]` exists, start `probe()`. Everything guarded (`"speechSynthesis" in window`, `window.crypto && crypto.subtle`, `typeof Intl.Segmenter`); no `pageerror` ever.

**mount(root)**: for each `[data-tts]` under `root` without a `.tts-ctl` whose `closest("[data-tts]")` is that root, build the control (§6.2), set `aria-label` from `data-tts-title` / first heading / id, place it per the slot rule. Refresh `aria-label` of idle controls. If `state.root` is no longer in the document or `state.root.dataset.tts !== state.id` → `stop()`.

**Click flow** (synchronous part first):
```
root = btn.closest("[data-tts]"); id = root.dataset.tts
if (active && state.root === root) { stop(); return }          // Listen ↔ Stop toggle
stop()                                                          // one narration at a time
cfg = lastProbeResult || { provider: "browser", gen: null, static: null }   // never awaited here
text = NAPE_TTS.spokenText(root); if (!text) return
networkTier = !preferBrowserNext && crypto.subtle && (cfg.static || cfg.provider === "elevenlabs")
if (!networkTier) { speak(root, text); return }                 // speechSynthesis.speak inside the gesture
audio.src = SILENT_WAV_URL; audio.play().catch(() => {})       // unlock the element inside the gesture (Safari)
setState(root, "loading"); audioPath(root, id, text, cfg)       // async from here
```
**audioPath**: `sha = await sha256hex(text)`; tier 1 if `cfg.static && cfg.static.items[id] === sha16` → `playUrl(staticUrl, "static")`; tier 2 if `cfg.provider === "elevenlabs"` → `fetchBlob("/api/tts?id="+id+"&h="+sha+"&v="+cfg.gen, ctrl.signal, 20 s)` (accept only `res.ok` and `content-type` starting `audio/`) → `playUrl(blobUrl, "elevenlabs")`; if the session was cancelled, return; else `dispatch fallback`, `preferBrowserNext = true`, toast "Studio voice unavailable — using your browser's voice." and `speak(root, text, { afterAwait: true })`. `playUrl(url, provider)`: set `audio.src`, `await Promise.race([audio.play(), timeout(10_000)])`; rejection or timeout → `false`; success → `setState(root, "playing", provider)`, badge "Pre-recorded" / "Studio voice", dispatch `start`. `audio.onended` → `end` + reset; `audio.onerror` while playing → reset + toast. Blob URLs: `Map` url → blobUrl, max 12 entries, revoke only on eviction or `pagehide`; never right after assigning `src` (Chromium 141 errors).

**speak(root, text, opts)**: `chunks = chunk(text, 200)`; create all `SpeechSynthesisUtterance`s and `speak()` each synchronously (speech is a queue; iOS gesture rule), keep references in the session until `end`/`error`; `utterance.voice = pickVoice()` (cached voices: `lang` starts with `en-US` and `localService`, else `default`, else `lang` starts with `en`, else unset), `rate = 1`. First `onstart` → `setState(root, "playing", "browser")`, badge "Browser voice". Last `onend` → `end` + reset. `onerror` other than `canceled`/`interrupted` → reset + toast "Listening isn't available in this browser." + `error` event. Watchdog 4 s without `onstart` → reset; toast "Tap Listen again to use your browser's voice." when `opts.afterAwait`, else "Listening isn't available in this browser."; `preferBrowserNext = true`. Never call `pause()`/`resume()` (Android treats pause as cancel).

**chunk(text, max)**: sentences via `new Intl.Segmenter("en", { granularity: "sentence" })` when available, else `text.match(/[^.!?]+[.!?]+["')\]]*\s*|[^.!?]+$/g)` (no lookbehind: Safari < 16.4 would fail to parse the whole file); merge a segment shorter than 25 chars or ending in `Dr.|Mr.|Mrs.|Ms.|e.g.|i.e.|vs.|St.|U.S.` into the next; pack greedily to ≤ `max`; split an over-long sentence at the last `, ` before `max`, else the last space. Chunks joined with single spaces equal the input text.

**stop()**: abort the session's `AbortController`, `audio.pause(); audio.removeAttribute("src"); audio.load()`, `speechSynthesis.cancel()`, clear watchdogs, reset the control (`data-tts-state="idle"`, remove `data-tts-provider` and `aria-busy`, text "Listen", `aria-label` "Listen to <title>", badge ""), dispatch `stop` if something was active.

**Button states**: idle → text "Listen", `aria-label="Listen to <title>"`; loading → text "Stop", `aria-label="Stop reading <title>"`, `.tts-ctl[aria-busy=true]`, badge empty; playing → text "Stop", `.tts-btn.playing`, badge = provider label (the only badge text change per play, so the aria-live stage panel announces at most once).

## 9. API routes (server owner) — summary; exact table in the contract

`GET /api/tts?status=1` → probe, never rate-limited, never 503, `Cache-Control: public, max-age=0, s-maxage=60`.
`GET /api/tts?id=<id>&h=<sha>&v=<gen>` → canonical query only (exact string, that order, nothing else; `400 bad_request` otherwise so no query variant can bust the edge cache); allowlist lookup; `h === items[id].sha` else `404 unknown_block`; chars cap `413 too_long`; `503 not_configured` when browser provider; `v === gen` else `409 voice_changed`; 20/min/IP `429`; breaker `503 provider_unavailable`; upstream `POST https://api.elevenlabs.io/v1/text-to-speech/<voiceId>?output_format=mp3_44100_128` with `xi-api-key`, body `{ text, model_id, voice_settings: { stability: 0.7, similarity_boost: 0.5 }, apply_text_normalization: "auto" }` (only the two settings every model including `eleven_v4` accepts), `AbortSignal.any([AbortSignal.timeout(20000), closeSignal])` where `closeSignal` aborts on `req.on("close")` (fall back to the timeout signal alone if `AbortSignal.any` is missing). 2xx with a non-empty body → `200 audio/mpeg` buffered (`Buffer.from(await r.arrayBuffer())`, `Content-Length`, `Cache-Control: public, max-age=86400, s-maxage=31536000, immutable`); the upstream `Content-Type` is only logged, never required. Upstream 429 → `503 busy` + `Retry-After: 5`, never retried. 401/403 → open breaker 10 min → `503 provider_unavailable` + `Retry-After: 600`. Other non-2xx, timeout, network → `502 upstream`; three consecutive such failures open the breaker 60 s. Every non-200 sets `Cache-Control: no-store`. `vercel.json` gains `"functions": { "api/tts.js": { "maxDuration": 30 } }`. Test hooks: `module.exports._test = { setManifest(m), reset() }` (clears the rate map and breaker) so `scripts/tts-api-check.js` can run without the generated manifest.

## 10. Security

- Secrets only in Vercel env vars; the key is read inside the handler and used only in the `xi-api-key` header; never logged or echoed. Create the key scoped to text-to-speech; rotate by replacing the variable and redeploying. Set a monthly character cap in the ElevenLabs workspace before phase 1 (the real last line of defense). Pilot runs on a paid tier (Free is non-commercial).
- No free text ever: the server speaks only `manifest.items[id].text` when `h` equals that item's digest and `v` equals the live fingerprint. Unknown ids → 404. Worst-case spend per deploy ≈ allowlisted blocks × chars × edge regions, independent of traffic.
- Canonical URL requirement closes query-variant cache busting; the per-IP limiter (20/min, in-memory, "a deterrent, not a guarantee") and the breaker bound bursts; request headers that bypass the CDN cache remain a residual risk bounded by `TTS_MAX_CHARS`, the allowlist size and the vendor cap. No same-site/Referer check (forgeable; would 403 header-stripping browsers) and no per-instance concurrency cap (false "busy" under fluid compute).
- Strict regexes before any lookup; `ELEVENLABS_VOICE_ID` and `ELEVENLABS_MODEL_ID` regex-validated before URL/body interpolation (a malformed value means provider `browser`, never an injected path); `TTS_AUDIO_BASE_URL` validated before being echoed.
- Vendor error bodies are drained and discarded; logs carry one JSON line `{ id, h16, v, status, ms, bytes, chars, ct }` and `console.error("ElevenLabs rejected synthesis:", status)`; never the key, text, voice id or upstream headers beyond `x-character-count`/content-type.
- CSP: exactly one added directive (§13). `connect-src 'self'` unchanged (manifest never fetched cross-origin; CloudFront audio loads via `<audio src>` under `media-src`). Never set `crossorigin` on the audio element. No new script sources.
- Client: `data-tts` only on NAPE-authored blocks; the smoke test asserts the forbidden list and exact root counts on every page. The control template contains no interpolated HTML; titles go into `aria-label` via `setAttribute`.
- Browser tier: Chrome's "Google" voices synthesize on Google's servers; the player prefers `localService` voices and the privacy notice names the possibility.

## 11. Edge cases

- Copy edit → browser sha ≠ manifest sha → static skipped, API 404 → browser voice; CI `--dry-run --check` red until the manifest is regenerated in the same PR.
- Voice change → new `gen` → stale probe gets 409 (no-store) → browser voice for that play; next page load gets the new gen; static tier needs a re-render (new prefix) and manifest commit.
- Probe 404/503/network (smoke server, outage) → browser-only config; controls still work.
- `speechSynthesis` present but no voices (headless Linux, locked-down devices): `synthesis-failed` → reset + toast; controls stay.
- iOS: first tap on the browser tier speaks synchronously; fallback after an awaited network failure may be ignored → watchdog toast "Tap Listen again…", `preferBrowserNext` makes the next tap synchronous for the rest of the page view. Silent switch mutes `speechSynthesis` but not `<audio>` (device checklist).
- Android: no `pause()` anywhere; Stop is `cancel()`.
- Chrome ~15 s utterance cutoff avoided by ≤ 200-char chunks; Safari `cancel()`-then-`speak()` gap handled because `stop()` always precedes a new session and the new utterances are queued fresh.
- Journey tab switch mid-play: `renderStage` replaces the panel → `mount()` sees the active root gone → `stop()`; the new panel has its own control.
- "Try another prompt" mid-play: `data-tts` changes → observer → `stop()`.
- Vercel 4.5 MB response cap: 1,200 chars ≈ 80 s ≈ 1.3 MB at 128 kbps; buffered response fine.
- Transient upstream failure never pinned at the edge (`no-store` on every non-200).
- Two blocks with identical text under different ids: dedupe on the API tier (same `h`) but separate static files (by design, human-readable names).
- `Intl.Segmenter` missing → regex fallback; `crypto.subtle` missing (http non-localhost) → network tiers skipped, browser voice only.

## 12. Accessibility

- Native `<button type="button">`; Enter/Space work; label swap Listen ↔ Stop (no `aria-pressed`, per APG: change the name or the pressed state, never both); `aria-label` carries the subject (`data-tts-title`).
- `aria-busy="true"` on `.tts-ctl` while loading; badge is plain text (no `role=status`), changed once per play; failures announced through the existing `napeToast()` (`role="status"`), at most once per state change.
- Focus ring from `.btn:focus-visible` (3 px `var(--gold)`); 36 px minimum height; controls wrap on phones; inline in the block (no fixed bar colliding with `.fb` bottom-right or `.toast` bottom-center).
- State conveyed by text and colour (`.tts-btn.playing` teal fill), never motion; no spinner, so `prefers-reduced-motion` needs nothing extra.
- Escape stops; one narration at a time.
- Fixes in scope: `aria-hidden="true"` on `.feat .icon` and `.stage-dot` emoji spans.
- Print: `.tts-ctl` carries `no-print` (hidden by the existing rule) plus `@media print{.tts-ctl{display:none !important}}`.
- Hide, don't tease: a control is `hidden` only when no tier can ever work.

## 13. CSP (server owner, `vercel.json` line 33) — exact values in `csp_header`

Phase 1 (ships with the player): insert `media-src 'self' blob:;` after `img-src 'self' data:;`. Phase 2b: `media-src 'self' blob: https://<exact-cloudfront-host>;` (no wildcard; or `audio.<site-domain>` if an alias is used). Verified in Chromium 141: today's header refuses both `blob:` and a CloudFront `<audio src>` because `media-src` falls back to `default-src 'self'`; the amended header produces zero violations and a blob WAV reaches `readyState 4`. From this change on, the smoke server sends the live CSP from `vercel.json` on every HTML response and fails on any console message containing "Content Security Policy".

## 14. Privacy Notice wording (tests-docs owner, `privacy.html`)

- Line 43: `Last updated: October 11, 2026 · …`
- Line 50: change "in four places" to "in five places" and append, before "None of this is sold": `The <strong>Listen</strong> button next to some program text reads that text aloud. When NAPE has turned on its studio voice, pressing Listen sends this site's server a code identifying which passage of NAPE's own published text you chose — never your entries, your profile, or anything you typed — and the server has ElevenLabs turn that passage into audio; that request carries no information about you beyond the standard server logs described below. When the studio voice is off, your browser's built-in speech reads the text and nothing is sent to NAPE; some browsers (for example Chrome's "Google" voices) produce that speech on the browser maker's servers, which is outside NAPE's control.`
- Service providers list, after the Airtable item: `<li><strong>ElevenLabs</strong> converts NAPE's published program text to speech when you press Listen and NAPE has turned on the studio voice. It receives the passage text from this site's server, not from your device, and may keep the generated audio and text in NAPE's account history.</li>`. Phase 2b adds: `<li><strong>Amazon Web Services (S3 and CloudFront)</strong> delivers pre-recorded narration files when they exist for a passage; like any file download, that request discloses your IP address to AWS. No text about you is involved.</li>` and a sentence in the Listen paragraph: `Pre-recorded narration, when available, is downloaded as an audio file from a content-delivery network, which sees your IP address like any web host.`
- "Data that stays on your device", "No cookies, no tracking", "Removing your data" remain true: no member text is narrated, no cookies, no new storage key.

README (tests-docs owner): Structure rows after line 28 (`api/tts.js  GET status probe + ElevenLabs proxy for allowlisted content blocks`), after line 33 (`assets/tts.js`, `assets/audio/manifest.json`), after line 37 (`scripts/build-audio.js`, `scripts/upload-audio.js`, `scripts/lib/static-server.js`, `scripts/tts-api-check.js`); env-var rows for `ELEVENLABS_API_KEY`, `ELEVENLABS_VOICE_ID`, `ELEVENLABS_MODEL_ID`, `TTS_PROVIDER`, `TTS_MAX_CHARS`, `TTS_AUDIO_BASE_URL` with "change, then Redeploy"; extend the lines 60–63 paragraph ("When a member presses Listen and ElevenLabs is configured, the platform's own text for that block is sent to ElevenLabs via `/api/tts` (key stays server-side); member-entered text is never narrated."); new `## Listen (text-to-speech)` section before `## Deploy` (tier order, enabling on Preview then Production, kill switches + redeploy, `node scripts/build-audio.js --dry-run --write-allowlist`, CI drift check, pointer to `docs/tts-static-audio.md`, the CSP line to change for CloudFront).

## 15. Test plan — see `test_plan` in the contract (each item one assertion). Harness notes for the tests-docs owner:

- `scripts/lib/static-server.js`: `module.exports = { createStaticServer({ root, port, csp = true }) }` → `{ server, url, close() }`; clean-URL emulation as today; MIME map `.html .css .js .svg .json .mp3(audio/mpeg) .wav(audio/wav)`; when `csp` is truthy, every `.html` response carries `Content-Security-Policy` read from `vercel.json` (`headers[0].headers` entry with key `Content-Security-Policy`) plus `X-Content-Type-Options: nosniff`; 404 → `404.html`. `smoke.js` replaces its inline server with `createStaticServer({ root: ROOT, port: 8899 })`; `build-audio.js` uses it too.
- Install the speech stub with `ctx.addInitScript` **using `Object.defineProperty(window, "speechSynthesis", { configurable: true, value: … })` and `Object.defineProperty(window, "SpeechSynthesisUtterance", …)`** — plain assignment does not replace the native getter (verified). Stub: one voice `{ name: "Test", lang: "en-US", localService: true, default: true, voiceURI: "t" }`; `speak(u)` pushes `u.text` to `window.__spoken` then fires `u.onstart` and `u.onend` on short timers; `cancel()` pushes `"<cancel>"`; `addEventListener(){}`.
- Mock routes with URL predicates (a `?` is a glob wildcard): `const PROBE = u => u.pathname === "/api/tts" && u.search === "?status=1"; const AUDIO = u => u.pathname === "/api/tts" && u.searchParams.has("id");` and `page.unroute(PROBE)` with the same reference. Register the probe route before `goto`/`reload` because the player probes at mount.
- Audio fixture: a WAV generated in-test (44-byte header + 0.2 s of 8 kHz 16-bit silence), fulfilled with `contentType: "audio/mpeg"` (verified: decodes from a `blob:` URL under the amended CSP with zero violations). No binary file is committed. Never test the CSP-blocked-host fallback with a cross-origin URL while the run fails on CSP messages; use a same-origin 404 route instead.
- `page.on("console", m => { if (/Content Security Policy/.test(m.text())) errors.push(page.url() + ": CSP: " + m.text()); })`.

## 16. Rollout plan

**Phase 1 — now (this PR set, maps to rollout-doc phases 0→2).**
1. Land all five tracks (integration order: markup + player → pipeline seeds `assets/audio/manifest.json` from `--dry-run --write-allowlist` → server + api-check green → smoke + CSP check + drift check green → README/privacy). Phase-1 CSP value in `vercel.json`. Rollback: remove the `<script src="assets/tts.js">` line from the four pages.
2. Browser voice in production with no env vars (rollout phase 0): manual device checklist (iPhone Safari first tap starts inside the gesture and the 480-char block does not cut off; Android Chrome Stop works; desktop Chrome with a Google voice no 15 s cutoff; Firefox private window plays).
3. Studio voice on **Preview** (rollout phase 1): set `ELEVENLABS_API_KEY`, `ELEVENLABS_VOICE_ID` (+ `ELEVENLABS_MODEL_ID` if not the default) on the Preview environment, redeploy; verify `GET /api/tts?status=1` shows `provider: "elevenlabs"` and a 12-hex `gen`; one Listen shows "Studio voice"; replaying returns `x-vercel-cache: HIT`; a hand-built URL with reordered params returns 400; workspace cap set; paid tier confirmed. Rollback: `TTS_PROVIDER=browser` (or delete the vars) then Redeploy.
4. Studio voice in **Production** (rollout phase 2) after a one-week Preview review of voice, pacing and pronunciation. Same rollback.

**Phase 2 — static pre-rendered audio (rollout phases 3a/3b).**
- 2a (optional interim, no AWS): `node scripts/build-audio.js --render --out assets/audio`, commit the ~5 MB of pilot MP3s under `assets/audio/<gen>/`, add the `vercel.json` header rule `/assets/audio/(.*)\.mp3` → `Cache-Control: public, max-age=31536000, immutable`, set `TTS_AUDIO_BASE_URL=/assets/audio/`, redeploy; verify `curl -sI -H "Range: bytes=0-1" https://<site>/assets/audio/<gen>/<file>` returns 206 before relying on it for Safari (otherwise keep 2b only). No CSP change.
- 2b (CloudFront): runbook §17; `TTS_AUDIO_BASE_URL=https://<dist>.cloudfront.net/audio/`; phase-2 CSP value; privacy AWS item; redeploy. Rollback: unset the variable and redeploy (the CSP host may stay).

## 17. Runbook — static pipeline (pipeline owner, `docs/tts-static-audio.md`)

**Render** (owner's machine; never in CI): `export ELEVENLABS_API_KEY=… ELEVENLABS_VOICE_ID=… ELEVENLABS_MODEL_ID=eleven_multilingual_v2 ELEVENLABS_VOICE_LABEL=studio-narrator`; `npm install --no-save playwright@1.56.1 && npx playwright install chromium`; `node scripts/build-audio.js --dry-run --check` (must be green); `node scripts/build-audio.js --render` → `build/audio/<gen>/<id>.<sha16>.mp3` for every item without a file, manifest `render` + `file`/`bytes` updated. Preflight `GET /v1/voices/{voice_id}` (fail fast on a bad id) and `GET /v1/models` (read `maximum_text_length_per_request`; fail if any block exceeds it). `POST /v1/text-to-speech/{voice}?output_format=mp3_44100_128` with the same body as `api/tts.js`; sequential (Free/Starter concurrency is 2), 20 s timeout, on 429/5xx wait `Retry-After` or 5/10/20 s, max 3 attempts; log id/status/bytes/`x-character-count`; never re-render an existing file (output is not byte-deterministic). Rendering and uploading are separate processes so the ElevenLabs key and AWS credentials never coexist.

**AWS one-time setup** (`AWS_REGION=us-east-1`, `TTS_S3_BUCKET=nape-audio-<account>`; credentials from the owner's AWS CLI profile):
```bash
aws s3api create-bucket --bucket "$TTS_S3_BUCKET" --region "$AWS_REGION"
aws s3api put-public-access-block --bucket "$TTS_S3_BUCKET" --public-access-block-configuration BlockPublicAcls=true,IgnorePublicAcls=true,BlockPublicPolicy=true,RestrictPublicBuckets=true
aws s3api put-bucket-ownership-controls --bucket "$TTS_S3_BUCKET" --ownership-controls 'Rules=[{ObjectOwnership=BucketOwnerEnforced}]'
aws s3api put-bucket-encryption --bucket "$TTS_S3_BUCKET" --server-side-encryption-configuration '{"Rules":[{"ApplyServerSideEncryptionByDefault":{"SSEAlgorithm":"AES256"}}]}'
aws s3api put-bucket-versioning --bucket "$TTS_S3_BUCKET" --versioning-configuration Status=Enabled
aws cloudfront create-origin-access-control --origin-access-control-config Name=nape-audio-oac,OriginAccessControlOriginType=s3,SigningBehavior=always,SigningProtocol=sigv4
```
No static-website hosting (OAC needs the REST endpoint `bucket.s3.region.amazonaws.com`); SSE-S3 not KMS (KMS would need a key policy for CloudFront and `kms:GenerateDataKey` for the uploader). Distribution: origin = bucket REST domain with the OAC id; default behavior GET/HEAD only; redirect-to-https; cache policy CachingOptimized `658327ea-f89d-4fab-a63d-7e88639e58f6`; **no** origin request policy (no `Origin` forwarding; a plain `<audio src>` needs no CORS); compression off; TLSv1.2_2021; HTTP/2+3; PriceClass_100; standard logging OFF (viewer IPs). Optional alias `audio.<site-domain>` with an ACM cert in us-east-1 so the CSP entry survives a rebuild. Bucket policy:
```json
{"Version":"2012-10-17","Statement":[{"Sid":"AllowCloudFrontReadOnly","Effect":"Allow","Principal":{"Service":"cloudfront.amazonaws.com"},"Action":"s3:GetObject","Resource":"arn:aws:s3:::nape-audio-<account>/audio/*","Condition":{"StringEquals":{"AWS:SourceArn":"arn:aws:cloudfront::<account>:distribution/<DIST_ID>"}}}]}
```
Uploader IAM (dedicated IAM user for the hand-run pilot; a GitHub-OIDC role with `sub` pinned to this repo and `refs/heads/main` if uploads ever move to Actions). No `GetObject`, no `DeleteObject`, no CloudFront permission (names are content-addressed; the manifest is same-origin; nothing is invalidated):
```json
{"Version":"2012-10-17","Statement":[
 {"Sid":"ListAudioPrefix","Effect":"Allow","Action":"s3:ListBucket","Resource":"arn:aws:s3:::nape-audio-<account>","Condition":{"StringLike":{"s3:prefix":["audio/*"]}}},
 {"Sid":"PutAudioObjects","Effect":"Allow","Action":"s3:PutObject","Resource":"arn:aws:s3:::nape-audio-<account>/audio/*"}]}
```
**Upload** (AWS SDK v3, owner preference): `npm install --no-save @aws-sdk/client-s3` then `AWS_REGION=us-east-1 TTS_S3_BUCKET=nape-audio-<account> node scripts/upload-audio.js build/audio`. Per file: `ListObjectsV2` under `audio/<gen>/` (needs only `s3:ListBucket`) → skip if present; else `PutObjectCommand({ Bucket, Key: "audio/<gen>/<id>.<sha16>.mp3", Body, ContentType: "audio/mpeg", CacheControl: "public, max-age=31536000, immutable", ChecksumAlgorithm: "SHA256", IfNoneMatch: "*" })`; a 412 means the immutable object already exists → skip; log key/bytes/status only; never overwrite or delete. One-off CLI equivalent: `aws s3 sync build/audio/ "s3://$TTS_S3_BUCKET/audio/" --exclude "*" --include "*.mp3" --content-type audio/mpeg --cache-control "public, max-age=31536000, immutable" --size-only --no-progress` (never `--delete`).

**Release**: commit `assets/audio/manifest.json` from the same render; set `TTS_AUDIO_BASE_URL=https://<dist>.cloudfront.net/audio/` (trailing slash) on Preview then Production; phase-2 CSP value; add the AWS privacy item; redeploy. **Verify**: `curl -sI -H "Range: bytes=0-1" https://<dist>.cloudfront.net/audio/<gen>/<id>.<sha16>.mp3` → `206`, `Content-Range`, `Accept-Ranges: bytes`, `Content-Type: audio/mpeg`, immutable `Cache-Control`, `X-Cache`; `curl -sI https://<bucket>.s3.<region>.amazonaws.com/audio/<gen>/<file>` → `403`; `GET /api/tts?status=1` shows `static.base` and 20 items; a Listen on `/journey` shows "Pre-recorded" with `NAPE_TTS.audio.src` on the CloudFront host and no CSP console message. **Re-voicing**: change voice/model → `--render` (new gen, full re-render ≈ 4,700 credits at 1 credit/char) → upload (new prefix) → commit manifest → redeploy. **Copy edit**: CI `--dry-run --check` fails → `--dry-run --write-allowlist` (+ `--render` for the changed ids) in the same PR. **Cost**: ≈ 5 min of audio ≈ 4.8 MB; CloudFront within the always-free tier.

## 18. Parallel tracks and acceptance

| Owner | Files | Done when |
|---|---|---|
| server | `api/tts.js`, `vercel.json`, `scripts/tts-api-check.js` | `node scripts/tts-api-check.js` passes every row of the status table with a fixture manifest; phase-1 CSP string exact; `functions.maxDuration` present |
| player | `assets/tts.js`, `assets/styles.css` (appended block) | §7.5 strings and hashes reproduced in-page; controls mount per the slot rule; browser/static/studio flows pass the smoke mocks; `require("./assets/tts.js")` works in Node |
| markup | 4 HTML pages | exact attributes/slots/mount calls of §6.1; `aria-hidden` fixes; root counts 1/1/1/4; no personal block inside a root |
| pipeline | `scripts/build-audio.js`, `scripts/upload-audio.js`, `assets/audio/manifest.json`, `docs/tts-static-audio.md`, `docs/tts-plan.md`, `.gitignore` | `--dry-run --write-allowlist` reproduces §7.5 exactly; `--dry-run --check` green; `build/` ignored |
| tests-docs | `scripts/smoke.js`, `scripts/lib/static-server.js`, `.github/workflows/ci.yml`, `README.md`, `privacy.html` | smoke green locally (`NODE_PATH=$(npm root -g) node scripts/smoke.js`) with CSP sent; CI lists every new JS file; wording from §14 |

## 19. Caching summary

| Layer | Policy |
|---|---|
| Vercel edge, audio 200 | `public, max-age=86400, s-maxage=31536000, immutable`; URL = id + full digest + voice fingerprint, canonical form only |
| Vercel edge, probe | `public, max-age=0, s-maxage=60` |
| Vercel edge, any non-200 | `no-store` |
| Browser | in-page blob cache ≤ 12 entries; HTTP cache per headers; no Cache API, no localStorage |
| S3 → CloudFront | object metadata `public, max-age=31536000, immutable`; CachingOptimized; never invalidated |
| Vercel static 2a | `/assets/audio/(.*)\.mp3` → immutable header rule |

## 20. Deferred (with reason)

Pause/resume (Android `pause()` acts as cancel), speed `<select>` (new storage key `nape_tts_v1` = reserved `NAPE.KEYS.TTS`, and N selects on `/resources` on a phone), "Prefer my device's voice" privacy checkbox (same key; owner decision, phase-1 option), Media Session, Cache API (Firefox private mode throws; Safari evicts), `with-timestamps` alignment for exact durations/highlighting, phase-2 content (hero, workspace cards, journey intro/results, growth/reflections intros, connect partner descriptions), per-practice ids, moving `static.items` to a manifest fetch (past ~100 ids). Each slots into the same ids, manifest and tiers without redesign.

## 21. Open questions

See `open_questions`.