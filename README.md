# NAPE Executive Leadership Experience — Platform

Multi-page static platform for NAPE's board-approved executive leadership program
for probation chiefs, directors, and deputy leaders.

**Live:** https://nape-leadership-platform-dougdevitres-projects.vercel.app

## Structure

```
index.html          Landing page (adaptive CTA + welcome-back strip)
journey.html        Framework explorer + 6-question stage assessment
growth.html         Goal/milestone tracker (planned → complete → approved), target dates + "Due soon" view, filters, import/export
reflections.html    Guided journal with stats, filters, edit
resources.html      Program features + one-tap practice library
connections.html    Agency-to-agency outreach campaign builder (partner directory from Airtable; campaigns stay on device)
connect.html        Interest form (posts to /api/interest)
report.html         Print-ready growth report (browser "Save as PDF"; data stays on device)
certificate.html    Print-ready certificate (participation / progress / completion, landscape)
privacy.html        Privacy Notice (local-only data, form data, providers, clear-data button)
terms.html          Terms & Disclaimers (prototype status, no-advice, as-is)
404.html            Not-found page
api/interest.js     Vercel serverless function → Airtable "Interest" table (upserts on Email)
api/feedback.js     Serverless function → Airtable "Prototype Feedback" table (site-wide widget)
api/agencies.js     Serverless function ← Airtable "Resource Links" + "Sponsors" (read-only partner directory)
assets/agencies.json Snapshot of the partner directory, used when /api/agencies is unavailable
assets/connections.js Connections page engine: directory loading, mutual-support map, campaign sequences
assets/app.js       Shared storage (localStorage), nav hydration, toast, starter-goal engine
assets/styles.css   Design system (navy/teal/gold, Fraunces + Public Sans)
assets/favicon.svg  Browser-tab icon
vercel.json         Clean URLs (/journey, /growth, …) + security headers
scripts/smoke.js    Headless-browser smoke test (also runs in GitHub Actions CI)
```

Pages are served at clean URLs (`/journey`, not `/journey.html`) via `cleanUrls`
in `vercel.json`; internal links use the clean form.

## Prototype disclosures

Every page carries a prototype banner and footer links to the Privacy Notice
(`/privacy`) and Terms & Disclaimers (`/terms`). The interest form includes
consent language, the assessment carries a not-a-validated-instrument
disclaimer, and the privacy page has a one-click "clear all data on this
device" control. Before a public launch: add a NAPE contact email to both
legal pages and have counsel review the wording.

## Environment variables (Vercel project settings)

| Variable | Value |
|---|---|
| `AIRTABLE_TOKEN` | Airtable PAT, scope `data.records:write` on the interest/feedback base and `data.records:read` on the directory base |
| `AIRTABLE_BASE_ID` | `appOA3q8s6pP2j54H` (Interest + Prototype Feedback tables) |
| `AIRTABLE_DIRECTORY_BASE_ID` | `appvCa1Ac6c200uyu` (Resource Links + Sponsors; this is the default if unset) |

No secrets are committed to this repo. Member data (goals, reflections, stage)
lives in browser localStorage; only interest-form and feedback submissions are sent to Airtable.
The Connections page reads the partner directory through `/api/agencies` (token stays server-side)
and falls back to `assets/agencies.json` when the endpoint is not configured.

## Deploy

Connected to Vercel project `nape-leadership-platform` — pushes to `main` deploy to production.
