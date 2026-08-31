# NAPE Executive Leadership Experience — Platform

Multi-page static platform for NAPE's board-approved executive leadership program
for probation chiefs, directors, and deputy leaders.

**Live:** https://nape-leadership-platform-dougdevitres-projects.vercel.app

## Structure

```
index.html          Landing page (adaptive CTA + welcome-back strip)
journey.html        Framework explorer + 6-question stage assessment
growth.html         Goal/milestone tracker (planned → complete → approved), filters, import/export
reflections.html    Guided journal with stats, filters, edit
resources.html      Program features + one-tap practice library
connect.html        Interest form (posts to /api/interest)
404.html            Not-found page
api/interest.js     Vercel serverless function → Airtable "Interest" table (upserts on Email)
assets/app.js       Shared storage (localStorage), nav hydration, toast, starter-goal engine
assets/styles.css   Design system (navy/teal/gold, Fraunces + Public Sans)
assets/favicon.svg  Browser-tab icon
vercel.json         Clean URLs (/journey, /growth, …) + security headers
scripts/smoke.js    Headless-browser smoke test (also runs in GitHub Actions CI)
```

Pages are served at clean URLs (`/journey`, not `/journey.html`) via `cleanUrls`
in `vercel.json`; internal links use the clean form.

## Environment variables (Vercel project settings)

| Variable | Value |
|---|---|
| `AIRTABLE_TOKEN` | Airtable PAT, scope `data.records:write` on the base |
| `AIRTABLE_BASE_ID` | `appOA3q8s6pP2j54H` |

No secrets are committed to this repo. Member data (goals, reflections, stage)
lives in browser localStorage; only interest-form submissions are sent to Airtable.

## Deploy

Connected to Vercel project `nape-leadership-platform` — pushes to `main` deploy to production.
