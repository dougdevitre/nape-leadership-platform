# NAPE Leadership Platform — Hosting, Maintenance & Administrator Support Options (1–3 Year)

**Status:** DRAFT for leadership review. Bracketed items `[ ]` are placeholders to fill in before sending.
**Prepared for:** NAPE leadership team
**Prepared by:** [Your name / company]
**Date:** [date]

---

## 1. Summary (answer first)

NAPE wants the Executive Leadership Experience curriculum available only to members, using a Clerk membership login. This is achievable, and it changes the platform from a *prototype with no accounts* into a *member service that holds sign-in data*. That change is what drives the hosting, support, and compliance work below.

We propose three service packages, each available on a 1-, 2-, or 3-year term:

| Package | Best for | One-line description |
|---|---|---|
| **A. Essentials** | NAPE has a capable administrator and wants a stable, secure site | Hosting, monitoring, security patching, member-login gating, bug fixes |
| **B. Standard (recommended)** | NAPE wants steady improvement plus a supported administrator | Everything in A, plus a monthly enhancement allowance and admin training/office hours |
| **C. Partner** | NAPE wants a fully managed program with a defined service level | Everything in B, plus priority response, quarterly reviews, member analytics reporting, and roadmap planning |

Longer terms lower the effective annual cost and lock pricing.

---

## 2. What exists today (as of this review)

- Multi-page static site (HTML/CSS/JS) deployed on Vercel, with 5 small serverless functions writing to and reading from Airtable (interest form, feedback, partner connections, partner directory, published-media notes).
- **No user accounts.** Member goals, reflections, and stage are stored in each user's browser (`localStorage`) and never reach a server. The Privacy Notice says so.
- Pages are open to anyone with the link. A "prototype" banner and Terms/Privacy pages are in place; the README notes counsel should review the legal wording and a NAPE contact email should be added before public launch.
- Continuous checks: a headless-browser smoke test runs in GitHub Actions.

**Why this matters for the proposal:** gating the curriculum is not just a login screen (see §4).

---

## 3. Scope: three workstreams

### Workstream 1 — Hosting & operations
- Production hosting, custom domain, TLS, DNS management
- Deploy pipeline (preview + production), rollback
- Uptime and error monitoring; alerting to a named contact
- Dependency and security patching on a defined cadence
- Secrets management (no secrets in the repo; rotate tokens on schedule)
- Backups/export of Airtable data on a schedule
- Annual disaster-recovery test (restore from backup, redeploy from repo)

### Workstream 2 — Fix requested items
- Intake: a single request form/inbox; each item triaged as **Bug**, **Change**, or **New feature**
- Bugs are always covered by the package. Changes/features draw from the package allowance (see §5)
- Known items to scope in the kickoff [list NAPE's requested fixes here, with priority: Must / Should / Could]
- Pre-launch items already flagged in the repo: NAPE contact email on legal pages, counsel review of Privacy/Terms, removing or rewording the prototype banner

### Workstream 3 — Administrator technical support
- Named support channel (email/ticket) with response targets by severity
- Administrator onboarding: how to invite members, deactivate members, reset access, and edit Airtable-managed content (partner guidance, role profiles)
- Written runbook for the administrator (common tasks, "what to do if…")
- Office hours (monthly in B, twice-monthly in C)
- Member support: NAPE administrator is first line; we are second line

---

## 4. Membership gating — what it takes

**ASSUMPTIONS** (please confirm):
1. Membership status is decided by NAPE (a roster, dues status, or board approval), not by us.
2. "Curriculum" means the framework explorer, assessment, resource library, and tools that should be members-only. The landing page, privacy, and terms stay public.
3. Members are a few hundred to a few thousand people, not tens of thousands.

**Technical approach (recommended)**
- Clerk provides sign-in and sessions. Membership *entitlement* is stored on the Clerk user (for example a `member` flag or an organization role) and set by the NAPE administrator or synced from NAPE's roster.
- **Enforce access on the server, not only in the browser.** Because the site is static files, a client-side check can be bypassed by anyone who requests the page directly. Gating must run at the edge (Vercel routing middleware or equivalent) and verify the Clerk session and entitlement before serving protected pages and API routes.
- Protected: curriculum pages and the `/api/*` routes that return member-only content. Public: home, privacy, terms, 404, sign-in.
- Add sign-in/sign-out to the shared navigation; add a "membership required" page for signed-in non-members.

**Decisions NAPE needs to make (these change cost and timeline)**

| # | Decision | Options | Effect |
|---|---|---|---|
| 1 | How do people become members? | (a) Administrator invites/approves manually; (b) self-signup with roster/email-domain check; (c) paid dues through Clerk Billing or NAPE's existing system, synced | (a) simplest and cheapest; (c) most automated, most integration work |
| 2 | Where does membership truth live? | Clerk only, or NAPE's membership system with sync | Sync adds build and ongoing support |
| 3 | What happens to progress data? | (a) Stay on-device as today; (b) move to accounts so progress follows the member across devices | (b) is a better experience but makes NAPE/us a holder of member reflections; requires privacy/legal review |
| 4 | Who is the administrator, and what access do they get? | One person vs. a small team; Clerk dashboard access vs. in-app admin screen | Drives training and permissions design |
| 5 | Existing users | Grandfather current interest-form contacts or require re-registration | Affects onboarding communications |

**Vendor cost note:** Clerk, Vercel, and Airtable are billed by those vendors, and their pricing and plan limits change. Verify current pricing on each vendor's site before quoting; do not rely on this document for figures.

---

## 5. Package comparison

Fill the fee rows from the pricing worksheet in §8. Pass-through vendor costs are listed separately so NAPE can see what is service vs. platform cost.

| | **A. Essentials** | **B. Standard** | **C. Partner** |
|---|---|---|---|
| Hosting, monitoring, patching, backups | Included | Included | Included |
| Clerk membership gating (initial build) | One-time setup fee | One-time setup fee | One-time setup fee |
| Ongoing gating/access maintenance | Included | Included | Included |
| Bug fixes | Included | Included | Included (priority) |
| Enhancement/change allowance | 0 hrs (quoted separately) | [ ] hrs/month | [ ] hrs/month |
| Administrator support channel | Email, 2 business days | Email, 1 business day | Email + phone, same business day for urgent |
| Office hours | On request | Monthly | Twice monthly |
| Admin training and runbook | Initial session | Initial + annual refresher | Initial + semiannual |
| Security/uptime report | Annual | Quarterly | Quarterly + incident reviews |
| Member usage analytics (privacy-safe, aggregate) | — | Annual | Quarterly |
| Roadmap and planning session | — | Annual | Quarterly |
| Compliance support (privacy notice updates, vendor review) | Annual check | Annual + on change | Annual + on change + counsel coordination |
| Response targets — urgent (site down/login broken) | 1 business day | 4 business hours | 2 business hours |
| Response targets — normal | 3 business days | 2 business days | 1 business day |

---

## 6. Term options (1, 2, or 3 years)

| | **1 year** | **2 years** | **3 years** |
|---|---|---|---|
| Commitment | Lowest | Moderate | Highest |
| Price protection | Reviewed at renewal | Rate held for term | Rate held for term |
| Term discount | None | [ ]% | [ ]% |
| Payment | Annual or quarterly | Annual or quarterly | Annual or quarterly |
| Best when | NAPE wants to test membership gating first | Board approves a two-cycle budget | NAPE wants stability across leadership transitions |
| Exit | Non-renewal with 90 days' notice | Termination for convenience with [ ] days' notice and prorated handoff fee | Same as 2-year |
| Included transition | Handoff package | Handoff package | Handoff package |

**Handoff package (all terms):** repository and documentation transfer, credential rotation, runbook, one knowledge-transfer session, so NAPE is never locked in.

---

## 7. Timeline and rollout

**Phase 0 — Kickoff (week 1–2):** confirm decisions in §4, list requested fixes, name administrator, confirm domain and accounts ownership.
**Phase 1 — Gating build (weeks 2–5):** Clerk setup, server-side route protection, membership flag/roles, non-member and sign-in pages, admin invite flow, smoke tests updated.
**Phase 2 — Compliance and content (weeks 3–6, parallel):** Privacy Notice and Terms updated for accounts, contact email added, counsel review, consent language for any stored data.
**Phase 3 — Pilot (weeks 6–8):** small group of members and the administrator; fix issues.
**Phase 4 — Launch (week 8–10):** announce to members; administrator training completed; monitoring live.
**Phase 5 — Steady state:** the chosen package begins; first review at 90 days.

Timeline is an estimate; it depends on how quickly NAPE decides §4 and reviews legal text.

**Rollout safeguards**
- Feature-flag the gate so it can be turned off if login fails
- Keep the current public site available until the pilot is approved
- Rollback plan documented before launch

---

## 8. Pricing worksheet (internal — remove before sending)

| Line | Basis | Amount |
|---|---|---|
| One-time gating build | [ ] hrs × [ ] rate | $[ ] |
| One-time compliance/legal-text updates | [ ] hrs × [ ] rate | $[ ] |
| Package A monthly service fee | [ ] | $[ ] |
| Package B monthly service fee | [ ] | $[ ] |
| Package C monthly service fee | [ ] | $[ ] |
| Enhancement hour rate outside allowance | [ ] | $[ ] /hr |
| Vendor pass-through (Vercel, Clerk, Airtable, domain) | at cost + [ ]% handling, or billed directly to NAPE | $[ ] |
| 2-year / 3-year discount | | [ ]% / [ ]% |

Recommendation: have NAPE own the Clerk, Vercel, Airtable, and domain accounts directly, with us as an admin. This keeps NAPE in control of member data and makes exit clean.

---

## 9. Risks and how we address them

| Risk | Mitigation |
|---|---|
| Client-side-only gating gets bypassed | Server/edge enforcement (§4) |
| Member data now includes sign-in identity | Update Privacy Notice, minimize data, counsel review, least-privilege access to Clerk and Airtable |
| Single administrator becomes a bottleneck or leaves | Runbook, second named admin, training refresher |
| Vendor pricing or plan changes | Pass-through clarity, annual vendor review, notice before changes |
| Scope creep on "fix requested items" | Triage as bug/change/feature; allowance tracked monthly and reported |
| Progress data lost when members change devices (if data stays local) | Decision #3; clear communication, or move to accounts |
| Airtable token scope | Keep scoped personal access tokens, rotate on schedule |
| Timeline slips waiting on legal review | Start Phase 2 at kickoff |

---

## 10. What we need from NAPE

1. Decisions 1–5 in §4
2. A named administrator and a backup
3. The requested-fixes list with priorities
4. Ownership/admin access to domain, Vercel, Clerk, and Airtable accounts
5. A contact for legal/privacy review
6. A membership roster or process for granting access

---

## 11. Next steps

1. Leadership reviews packages and terms; indicates preferred package and term (or asks for changes)
2. 45-minute kickoff call to settle §4 decisions
3. We return a final quote and statement of work within [ ] business days
4. Sign and begin Phase 1

---

## 12. Disclaimer

This document is a planning proposal, not legal advice. Privacy, membership terms, and any handling of member reflections should be reviewed by NAPE's counsel. Vendor prices and features referenced are subject to change and should be verified with each vendor.
