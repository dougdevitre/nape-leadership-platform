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
connect.html        Partner-connection tool (directory from Airtable, outreach campaigns kept on device) + interest form (posts to /api/interest)
media.html          Media Studio: goal/audience/shared-goal purpose panel (Shared Goals field in Airtable "Category Profiles"), NotebookLM prompt generator, social post + image generator (canvas PNG), print-ready PDF one-pagers, a per-resource kit checklist, and an opt-in "Tell NAPE what you published" share (posts to /api/media); detects saved Connect campaigns and aligns content to them
proposal.html       Proposal (not in the nav; share the /proposal link directly): interactive support-plan calculator (term, package, member-access model, add-ons, optional budget) with live totals, a compare matrix, shareable link, email/copy/print. Prices are illustrative placeholders in `PRICING` at the top of assets/proposal.js (set `illustrative: false` once real). Marked noindex
report.html         Print-ready growth report (browser "Save as PDF"; data stays on device)
certificate.html    Print-ready certificate (participation / progress / completion, landscape)
privacy.html        Privacy Notice (local-only data, form data, providers, clear-data button)
terms.html          Terms & Disclaimers (prototype status, no-advice, as-is, governance under the NAPE By-Laws)
404.html            Not-found page
api/interest.js     Vercel serverless function → Airtable "Interest" table (upserts on Email)
api/feedback.js     Serverless function → Airtable "Prototype Feedback" table (site-wide widget)
api/connections.js  Serverless function → Airtable "Partner Connections" table (opt-in campaign progress; upserts on Campaign ID)
api/agencies.js     Serverless function ← Airtable "Resource Links", "Sponsors", "NAPE Org Info", "Category Profiles", "Role Profiles" (read-only)
api/media.js        Serverless function → Airtable "Published Media" table in the directory base (opt-in "I published this" notes from the Media page, so NAPE can reshare member content; needs write scope on the directory base)
assets/agencies.json Snapshot of the partner directory, used when /api/agencies is unavailable
assets/connections.js Partner-connection tool engine (Connect page): directory loading, mutual-support map, campaign sequences
assets/proposal.js  Proposal calculator: pricing config + math, state in URL hash/localStorage, budget best-fit, compare tables
assets/media.js     Media Studio engine (Media page): directory loading, prompt/post generators, canvas image renderer, PDF one-pager builder
assets/app.js       Shared storage (localStorage), nav hydration, toast, starter-goal engine
assets/styles.css   Design system (navy/teal/gold, Fraunces + Public Sans)
assets/favicon.svg  Browser-tab icon
vercel.json         Clean URLs (/journey, /growth, …), /connections → /connect redirect, security headers
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
| `AIRTABLE_BASE_ID` | `appOA3q8s6pP2j54H` (Interest, Prototype Feedback, Partner Connections tables) |
| `AIRTABLE_DIRECTORY_BASE_ID` | `appvCa1Ac6c200uyu` (directory + NAPE contact + Connections guidance tables; this is the default if unset) |

No secrets are committed to this repo. Member data (goals, reflections, stage)
lives in browser localStorage; only interest-form, feedback, and opted-in partner-connection progress submissions are sent to Airtable.
The Connect page's partner-connection tool reads the partner directory through `/api/agencies` (token stays server-side)
and falls back to `assets/agencies.json` when the endpoint is not configured.

## NAPE dashboard for shared partner connections

Opted-in progress reports land in the `Partner Connections` table of the submissions base. A
published Airtable interface named **Partner Connections** (base `appOA3q8s6pP2j54H`) gives the
Secretariat a view without opening the grid:

| Page | What it shows |
|---|---|
| Overview | Campaigns shared, distinct partners and member agencies, average steps done; charts by status, partner category, and goal; most recent updates. Filter by Status and Goal. |
| Pipeline | Kanban by Status (Active → Connected → Paused → Closed), cards colored by Goal. |
| All campaigns | Full grid grouped by partner category, sorted by last update, with a `Contact` link to the member's Interest record for staff to connect by hand. |

Rows appear only when a member turns on sharing for a campaign (see the Privacy Notice). The
interface reads the table directly, so no code change is needed to adjust it.

## Editing partner-connection guidance in Airtable

The "how you can support one another" text and the phrases used in message drafts live in two
tables in the directory base and can be edited by NAPE staff without a code change:

| Table | Row = | Fields |
|---|---|---|
| `Category Profiles` | one Resource Links category (plus `NAPE Event Sponsor`) | What They Offer, What They Value (one item per line); Opener, First Ask (complete "I'm reaching out because …" / "…a short conversation about …") |
| `Role Profiles` | a role a member can pick (`Your role`) or a person they might reach (`Partner role`) | What You Can Offer (Your role, one per line); Opens the Door To (Partner role); Sort Order |

Rules: the Category must match the Resource Links choice exactly; a `Your role` row needs at least
two offers to be used; blank fields fall back to the built-in defaults in `assets/connections.js`.
Changes appear on the site within about ten minutes (edge cache).

## Deploy

Connected to Vercel project `nape-leadership-platform` — pushes to `main` deploy to production.
