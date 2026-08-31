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
api/interest.js     Vercel serverless function → Airtable "Interest" table
assets/app.js       Shared storage (localStorage), nav, toast, starter-goal engine
assets/styles.css   Design system (navy/teal/gold, Fraunces + Public Sans)
```

## Environment variables (Vercel project settings)

| Variable | Value |
|---|---|
| `AIRTABLE_TOKEN` | Airtable PAT, scope `data.records:write` on the base |
| `AIRTABLE_BASE_ID` | `appOA3q8s6pP2j54H` |

No secrets are committed to this repo. Member data (goals, reflections, stage)
lives in browser localStorage; only interest-form submissions are sent to Airtable.

## Deploy

Connected to Vercel project `nape-leadership-platform` — pushes to `main` deploy to production.
