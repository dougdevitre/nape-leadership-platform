# Text-to-speech: pilot rollout and safety guardrails

**Status:** Guardrails for the TTS feature. These rules take precedence over the implementation design wherever the two conflict. The design document (`docs/tts-plan.md`) describes the mechanics; this document describes how the feature is allowed to roll out and what keeps it safe and cheap.

## 1. Goals

- Members can press **Listen** on curated program text and hear it read aloud.
- No cost and no data leaves the device until NAPE deliberately turns on the studio voice.
- The ElevenLabs tier cannot be used as a free text-to-speech API by anyone else, and its spend is bounded by the amount of curated text, not by traffic.
- Every step has an off switch that does not need a code change or a redeploy.
- The same content ids and audio files work unchanged when narration moves to static files on CloudFront.

## 2. Non-goals (pilot)

- Narrating member-generated or personalized text (goals, reflections, names, agency names, campaign drafts, reports, certificates). Never, in any phase.
- Voice cloning, multiple voices, or per-member voice settings.
- Narrating legal pages, the proposal calculator, forms, or tables of numbers.

## 3. Provider tiers

| Tier | When it is used | Data leaves the device? | Cost |
|---|---|---|---|
| **Static file** (phase 3) | A manifest entry exists for the block's content id and `TTS_AUDIO_BASE_URL` is set | Fetches a public MP3; no text is sent anywhere | Hosting only |
| **Studio voice** (ElevenLabs via `/api/tts`) | Key and voice id are set in Vercel and `TTS_PROVIDER` is not `browser` | Only the curated block text, by id, from the server to ElevenLabs; the browser sends only the id | Per character, bounded (see §5) |
| **Browser voice** (Web Speech API) | Always available as the fallback; the only tier in phase 0 | No | None |

The player tries the tiers in that order and falls back silently. The provider badge on the control tells the member which voice is playing.

## 4. Environment variables (Vercel project settings)

| Variable | Scope | Purpose |
|---|---|---|
| `ELEVENLABS_API_KEY` | Secret. Server only; never sent to the browser or logged | Enables the studio voice when present together with the voice id |
| `ELEVENLABS_VOICE_ID` | Server only | The one voice used for all narration |
| `ELEVENLABS_MODEL_ID` | Server only, optional | Model override. Default `eleven_multilingual_v2` (stable, 1 credit per character, supports the `speed` voice setting). `eleven_v4` is newer and higher quality but changes voice-setting support; switching models re-hashes and re-renders every block, so change it deliberately |
| `TTS_PROVIDER` | Server only, optional | `auto` (default): studio voice when key and voice id are set, else browser. `browser`: **kill switch**, forces the browser voice without removing the key. |
| `TTS_MAX_CHARS` | Server only, optional | Hard cap per block (default 1,200 characters); longer ids are refused |
| `TTS_AUDIO_BASE_URL` | Phase 3 only | CloudFront base URL for pre-rendered audio |

Set ElevenLabs variables on the **Preview** environment first (phase 1) and only later on **Production** (phase 2). Vercel scopes env vars per environment, so the pilot runs on preview deployments with the production site still on the browser voice.

## 5. Abuse and cost guardrails (server)

1. **Allowlist by content id.** `/api/tts` only synthesizes ids that appear in the committed allowlist generated from the pages (`node scripts/build-audio.js --dry-run --write-allowlist`). The request carries an id, never free text. Unknown ids get `404`; the player then uses the browser voice. This is what makes the endpoint useless as a general TTS API.
2. **GET by id, cached at the edge.** Because an id is a hash of the exact text, voice and model, the audio for it never changes. Responses carry `Cache-Control: public, max-age=86400, s-maxage=31536000, immutable`, so Vercel's CDN serves repeat plays and ElevenLabs is called about once per block per edge region. Worst-case spend per deploy ≈ (number of allowlisted blocks) × (characters per block) × (regions), not proportional to member traffic.
3. **Per-block cap.** `TTS_MAX_CHARS` (default 1,200) rejects any allowlisted block that grows past the cap, so a copy edit cannot create a 10,000-character render by accident.
4. **Per-IP rate limit.** 20 synthesis requests per minute per IP (same in-memory pattern as `api/feedback.js`; a deterrent, not a guarantee). `429` on excess.
5. **Upstream timeout.** 20-second `AbortController` timeout on the ElevenLabs call; `502` on failure, with no vendor response body echoed to the client or logs.
6. **Vendor-side cap.** Before phase 1, set a monthly character limit on the ElevenLabs workspace (dashboard usage limits). Treat it as the last line of defense, not the first.
7. **Logs carry no text.** Log id, status code, duration, byte count, and the billed character count ElevenLabs returns in its `x-character-count` response header. Never the key, never block text, never member identifiers beyond the rate-limit IP bucket.
8. **Upstream 429 is not retried.** ElevenLabs limits by concurrent requests per plan (Free 2, Starter 3, Creator 5 for the multilingual model) and answers over-limit calls with `429`. The function passes that through as `503` with `Retry-After: 5` and never retries on its own, so a burst of first plays cannot multiply into a retry storm; the player falls back to the browser voice for that play.
9. **Scoped key.** Create the ElevenLabs key with only the text-to-speech permission (keys are permission-scoped at creation and shown once). Rotate it by replacing the Vercel variable; no code change.
10. **Status probe reveals nothing sensitive.** `GET /api/tts?status=1` returns `{ ok, provider: "elevenlabs" | "browser", blocks: <allowlist count> }`. No key, no voice id.

## 6. Privacy guardrails (client)

- **Allowlisted blocks only.** Narratable blocks are marked explicitly in markup (`data-tts="<key>"`); nothing is narrated by default. The build script derives the allowlist from exactly those marks.
- **Never personal.** These are never marked: `#welcome-strip`, `#goals`, `#entries`, `#report`, `#cert`, `#feat-note`, Connect campaign blocks (`#cx-brief`, `#cx-support`, `#cx-steps`, `#cx-guardrails`, `#cx-warm`), Media Studio outputs, the proposal document. A smoke-test assertion enforces this list.
- **Browser voice stays local.** Web Speech synthesis runs on the device (or the OS vendor's service, which the privacy notice names as outside NAPE's control).
- **Privacy Notice update (required before phase 1):** add a "Listen (text-to-speech)" paragraph: what is sent (the id of a curated program text block, never your entries or profile), to whom (ElevenLabs, when NAPE has turned on the studio voice), when (only after you press Listen), and that the browser voice never sends anything. Add ElevenLabs to the providers list.

## 7. Content drift guardrail

A copy edit to a narrated block changes its id. That is intended (the old audio must not play for new text), but it quietly shifts that block from cached audio to a fresh ElevenLabs render, or to the browser voice if the allowlist was not regenerated. CI runs `node scripts/build-audio.js --dry-run --check` and **fails** when the committed allowlist no longer matches the pages, so the regeneration is a reviewed commit, never a surprise.

## 7a. CSP guardrail in CI

The production Content-Security-Policy lives in `vercel.json`; the smoke-test server has never sent it, so a CSP mistake passes CI and fails only in production (verified: with today's header, Chromium refuses both `blob:` audio and a CloudFront URL because `media-src` falls back to `default-src 'self'`). From the TTS change onward the smoke server reads the CSP string from `vercel.json`, sends it on every page, and the run fails on any console message containing "Content Security Policy". The header gains `media-src 'self' blob:` with the player, and the CloudFront host is added to `media-src` only in phase 3; `connect-src` stays `'self'` because the manifest is committed same-origin.

## 8. Rollout phases and gates

| Phase | What is on | Gate to enter | Rollback |
|---|---|---|---|
| **0. Browser voice** (ships with the code) | Listen controls on the pilot blocks; Web Speech only; no env vars | Smoke test green; manual check on iOS Safari and Android Chrome; privacy notice updated | Remove `assets/tts.js` include (one-line revert) |
| **1. Studio voice on Preview** | ElevenLabs env vars on the Vercel Preview environment only | Phase 0 stable for one week; ElevenLabs monthly cap set; allowlist committed and CI check green | Set `TTS_PROVIDER=browser` on Preview or delete the vars |
| **2. Studio voice in Production** | Same env vars on Production | Preview pilot reviewed by NAPE staff (voice, pronunciation of "NAPE", pacing); spend observed for two weeks on Preview is within budget | Set `TTS_PROVIDER=browser` on Production (takes effect on next cold start, within minutes) |
| **3. Static audio on CloudFront** | `scripts/build-audio.js` renders every allowlisted block once; files uploaded to S3 behind CloudFront; `TTS_AUDIO_BASE_URL` set; CSP `media-src` extended to that host | Phase 2 stable; runbook in `docs/tts-static-audio.md` followed; IAM uploader policy least-privilege | Unset `TTS_AUDIO_BASE_URL`; the player returns to tier 2/3 automatically |

### Pilot scope (phase 0–2)

The 20 "must" blocks, about 4,500 characters total: the three Journey stage panels, the twelve Reflections prompts, the three Practice-library stage cards, the Program Features cards, and the home-page "Why this matters" blocks. Everything else is phase 3 or later and requires regenerating the allowlist in a reviewed commit.

## 9. Go/no-go checklist before each phase

- [ ] Smoke test green on the commit being deployed, including the CSP-violation check (§7a)
- [ ] Manual check on a real iPhone (Safari) and Android phone (Chrome): first play starts inside the tap, long blocks do not cut off at ~15 seconds, stop works (Android treats pause as cancel, so the control must not depend on resume)
- [ ] Privacy Notice describes the tier being turned on
- [ ] ElevenLabs workspace monthly character cap set (phases 1–3)
- [ ] ElevenLabs plan permits this use: the Free plan is non-commercial and requires attribution, so the pilot runs on a paid tier (Starter or above)
- [ ] API key is scoped to text-to-speech only and stored only in Vercel
- [ ] `TTS_PROVIDER` left unset or `auto` (so the kill switch is known to work: flip to `browser`, confirm the badge changes, flip back)
- [ ] A named person owns the off switch and knows where it is
- [ ] Pronunciation of "NAPE" confirmed by the owner (any change re-hashes every block that contains it)

## 10. Verified against the ElevenLabs API contract

The official documentation host is blocked from this build environment, so the API facts below were read from ElevenLabs' own generated SDKs (v2.71.0, October 2026) rather than the docs pages, and should be spot-checked against the docs once:

- Endpoint `POST https://api.elevenlabs.io/v1/text-to-speech/{voice_id}?output_format=mp3_44100_128`, header `xi-api-key`, JSON body `{ text, model_id, voice_settings }`, response is raw MP3 bytes. `mp3_44100_128` is the server default and needs no paid tier; `mp3_44100_192` needs Creator or above.
- `GET /v1/voices/{voice_id}` validates the configured voice id (useful in the build script's preflight); `GET /v1/models` reports each model's `maximum_text_length_per_request`.
- Determinism is best-effort only (`seed`), so re-rendering a block can produce slightly different audio; that is why audio is keyed by content id and rendered once, not on every play.

## 11. Open questions for the owner

1. Is "NAPE" spoken as a word or as letters? This sets the pronunciation map before the first render.
2. Should legal pages ever be narratable (browser voice only)? Default: no.
3. Monthly ElevenLabs budget for the pilot, so the workspace cap can be set.
