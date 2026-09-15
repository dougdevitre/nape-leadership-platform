/* NAPE Leadership Platform — Connections: agency-to-agency outreach campaign builder.
   Directory comes from /api/agencies (Airtable) with assets/agencies.json as fallback.
   Campaign progress is saved only in this browser (localStorage). */
(function () {
  const KEY = "nape_connections_v1";
  const SNAPSHOT_URL = "assets/agencies.json";

  /* ---------- Reference content ----------
     Built-in defaults. When the directory loads, rows from the Airtable
     "Category Profiles" and "Role Profiles" tables are applied over these
     (see applyContent), so NAPE staff can edit wording without a code change. */
  const MY_ROLES = [
    "Chief / Director",
    "Deputy Chief / Deputy Director",
    "Supervisor preparing for a senior role",
    "Other probation professional"
  ];

  const PARTNER_ROLES = [
    "Executive Director / CEO",
    "President / Board Chair",
    "Program or Training Director",
    "Research / Policy Lead",
    "Membership / Partnerships Lead",
    "Regional or Chapter Lead",
    "Communications / Editor",
    "Account or Partnerships Manager",
    "Not sure yet"
  ];

  const GOALS = {
    establish: {
      name: "Establish a new connection",
      short: "Establish",
      blurb: "You haven't worked together before. Build credibility, earn a first conversation, and land one concrete next step.",
      weeks: "About 6 weeks · 6 touches"
    },
    reconnect: {
      name: "Reconnect with a lapsed contact",
      short: "Reconnect",
      blurb: "You've worked together before and the thread went quiet. Acknowledge the gap gracefully and rebuild a rhythm.",
      weeks: "About 3 weeks, then quarterly · 6 touches"
    },
    support: {
      name: "Learn how to support one another",
      short: "Support",
      blurb: "The relationship exists. Explore what each of you can offer in your roles and commit to one small collaboration.",
      weeks: "About 90 days · 6 touches"
    }
  };

  /* What each kind of partner organization can typically offer a probation agency,
     what it tends to value in return, and a sensible first ask. */
  const CATEGORY_PROFILES = {
    "Federal Agency": {
      offers: ["Funding and grant solicitations", "Training and technical assistance", "National data, standards, and guidance", "Visibility for local innovations"],
      wants: ["Field data and outcomes from real caseloads", "Practitioner feedback on programs and guidance", "Pilot sites for new initiatives", "Success stories for national reports"],
      opener: "our agency is working on priorities that overlap with your mission, and I'd like to understand how local agencies can plug in",
      ask: "which programs or technical-assistance channels are the best fit for an agency like ours"
    },
    "Federal Program (NIJ)": {
      offers: ["Research-based evaluation methods", "Technology testing and evaluation", "Evidence briefs you can act on"],
      wants: ["Agencies willing to be test or evaluation sites", "Operational questions worth researching", "Candid feedback on tools in the field"],
      opener: "we're weighing decisions that would benefit from evidence, and your program's evaluation work is directly relevant",
      ask: "whether there is a path for an agency like ours to participate in testing or evaluation"
    },
    "Federal Resource": {
      offers: ["Curated research and publications", "Reference services for policy and program questions", "Access to archived justice literature"],
      wants: ["Questions from the field that shape what gets curated", "Practitioner examples of how research is used"],
      opener: "your collection is a resource our leadership team relies on, and I'd like to use it more deliberately",
      ask: "how agencies can best submit questions or surface topics they need covered"
    },
    "Professional Membership Association": {
      offers: ["Peer network of community corrections leaders", "Conferences, training, and certification", "Position statements and model practices", "Advocacy on issues affecting the field"],
      wants: ["Member engagement and leadership on committees", "Presenters and case studies from agencies", "Ground-level input on positions and standards"],
      opener: "our agency wants to be a more active contributor to the field, not just a consumer of it",
      ask: "where a leader from our agency could contribute — a committee, a panel, or a working group"
    },
    "International / Professional Association": {
      offers: ["International peer comparisons and practices", "Conference and exchange opportunities", "Research and standards from other systems"],
      wants: ["U.S. practitioner perspectives and case studies", "Exchange partners and hosts", "Contributions to international dialogue"],
      opener: "we're interested in how probation is practiced beyond our own system and what we could learn from yours",
      ask: "whether there is an exchange, working group, or publication where a U.S. agency perspective would be welcome"
    },
    "Training Organization": {
      offers: ["Staff training on specialized topics", "Curriculum you can adapt", "Train-the-trainer models"],
      wants: ["Training needs assessments from the field", "Cohorts of staff to train", "Feedback that improves curriculum"],
      opener: "we're planning our staff development calendar and your training portfolio covers gaps we have",
      ask: "which of your offerings fit an agency of our size and whether a pilot cohort is possible"
    },
    "Training / Academic": {
      offers: ["Executive and management development", "Specialized certificates and courses", "Access to faculty and applied research"],
      wants: ["Leaders and staff as participants", "Agency partners for applied projects", "Practitioner guest instructors"],
      opener: "we're investing in our next generation of leaders and your programs are built for exactly that",
      ask: "which programs fit our leadership pipeline and how agencies typically partner with you"
    },
    "Policy / Research": {
      offers: ["Independent research and policy analysis", "Data and evaluation expertise", "Convenings with policymakers", "Credible third-party framing for your work"],
      wants: ["Practitioner insight to ground the research", "Agency data and access for studies", "Real-world examples for reports and briefings"],
      opener: "your research touches decisions we make every day, and I'd like a practitioner voice to be part of that work",
      ask: "whether you're looking for agency partners on any current or upcoming projects"
    },
    "Nonprofit / Advocacy": {
      offers: ["Community relationships and trust", "Public education and communications reach", "Policy expertise and coalition access"],
      wants: ["Honest dialogue with system leaders", "Data and stories that inform advocacy", "Partnership on shared goals such as reducing unnecessary incarceration"],
      opener: "we share more goals than the public conversation sometimes suggests, and I'd like to find the common ground",
      ask: "where our goals overlap and whether a standing conversation would be useful to both of us"
    },
    "Nonprofit Service Provider": {
      offers: ["Direct services for people under supervision", "Reentry and transitional support", "Referral pathways and warm handoffs"],
      wants: ["Referrals and coordinated case planning", "Data-sharing agreements", "A seat at the table when programs are designed"],
      opener: "the people we supervise are the people you serve, and our handoffs should be better than they are",
      ask: "how referrals currently flow between us and where one improvement would help most"
    },
    "Professional Network": {
      offers: ["Connections to federal and NGO partners", "Position papers, surveys, and educational media", "A collective voice on policy"],
      wants: ["Agency participation in surveys and working groups", "Local stories that illustrate national issues", "Leaders willing to represent the field"],
      opener: "our agency would like to be part of the collective voice your network brings to policy conversations",
      ask: "how agencies participate — surveys, working groups, or contributing to position papers"
    },
    "Media / Industry Resource": {
      offers: ["Visibility for your agency's work", "Industry news and vendor intelligence", "Communication channels to the wider field"],
      wants: ["Stories and expert perspectives from practitioners", "Announcements and program results", "Feedback on what the field needs to hear"],
      opener: "we have work worth sharing and want to be a reliable source for the corrections community",
      ask: "what kinds of stories or contributions fit your audience"
    },
    "Archived Research Collection": {
      offers: ["Historical research and program evaluations", "Evidence base for long-running approaches"],
      wants: ["Awareness of how archived work is being used today"],
      opener: "your archive holds evaluations that are still relevant to decisions we're making",
      ask: "how to search the collection effectively and whether anyone still stewards it for questions"
    },
    "NAPE Event Sponsor": {
      offers: ["Tools and technology for supervision and reentry", "Product pilots and demonstrations", "Sponsorship for events and training", "Implementation support"],
      wants: ["Candid practitioner feedback on products", "Pilot sites and reference agencies", "Understanding of real operational constraints"],
      opener: "your organization supports NAPE, and I'd like to understand how your work fits the needs of an agency like ours",
      ask: "a no-pressure overview of what you offer and what a pilot with an agency typically looks like"
    }
  };
  const DEFAULT_PROFILE = {
    offers: ["Expertise and resources in their area of focus", "A partner perspective on shared challenges", "Connections in their network"],
    wants: ["Practitioner insight from a working probation agency", "Honest feedback and real-world examples", "A reliable partner for shared goals"],
    opener: "our missions overlap and I'd like to understand how we could work together",
    ask: "what a useful partnership with a probation agency looks like from your side"
  };

  /* What you can bring to the table, by your role. */
  const ROLE_OFFERS = {
    "Chief / Director": ["Executive sponsorship and agency-wide adoption", "Data-sharing or partnership agreements", "Testimony, speaking, and public credibility", "A pilot site with leadership commitment"],
    "Deputy Chief / Deputy Director": ["Operational leadership to implement anything agreed", "Staff coordination and project management", "Process and workflow feedback from the inside", "A named point of contact who follows through"],
    "Supervisor preparing for a senior role": ["Frontline insight into what works and what doesn't", "A pilot unit and staff champions", "Honest feedback on training and tools", "Energy to run a small collaboration end to end"],
    "Other probation professional": ["Subject-matter expertise and practitioner perspective", "Participation in surveys, panels, and working groups", "Real cases and examples (appropriately de-identified)", "A bridge to the right decision-makers in the agency"]
  };

  /* What the person you're reaching can typically open the door to. */
  const PARTNER_ROLE_OPENS = {
    "Executive Director / CEO": "organization-level commitment, partnership agreements, and a seat at strategic conversations",
    "President / Board Chair": "board-level visibility, strategic priorities, and introductions across their leadership",
    "Program or Training Director": "training slots, curriculum, technical assistance, and program pilots",
    "Research / Policy Lead": "data, evaluation partnerships, briefs, and research opportunities",
    "Membership / Partnerships Lead": "introductions, joint events, member access, and co-branded initiatives",
    "Regional or Chapter Lead": "regional peers, local events, and practical on-the-ground collaboration",
    "Communications / Editor": "visibility for your agency's work, publications, and speaking opportunities",
    "Account or Partnerships Manager": "demonstrations, pilots, pricing options, and implementation support",
    "Not sure yet": "the right person inside the organization — start with whoever is listed publicly and ask to be routed"
  };

  /* ---------- Campaign sequences ---------- */
  // Each step: { day, channel, title, why, draft(ctx) }
  const SEQUENCES = {
    establish: [
      { day: 0, channel: "Prep", title: "Do your homework", why: "Ten minutes of preparation separates a credible note from a cold one.",
        draft: c => `Before reaching out to ${c.partnerName}:
• Read their description${c.url ? " and website: " + c.url : ""}.
• ${c.contact === "[Name]" ? "Identify the right person." : "You're reaching " + c.contact + "."} A ${c.partnerRole} is a good first door — they can open ${c.opens}.
• Note one thing they have done recently that matters to ${c.myAgency}.
• Look for a shared connection (NAPE members, conference contacts). NAPE's Secretariat can often make a warm introduction.
• Decide your one small ask: ${c.ask}.
• Decide what you can offer first: ${c.myOffers[0].toLowerCase()}.` },
      { day: 2, channel: "Email", title: "Introduction email", why: "Short, specific, and easy to say yes to. One ask, one reason, one offer.",
        draft: c => `Subject: Introduction from ${c.myAgency}

Hello ${c.contact},

I'm ${c.me}, ${c.myRole} at ${c.myAgency}. I'm reaching out because ${c.opener}.

From our side, we can bring ${c.myOffers[0].toLowerCase()} and ${c.myOffers[1].toLowerCase()}. I would value a short conversation about ${c.ask}.

Would you have 20 minutes in the next two weeks? I'm glad to work around your schedule.

Thank you for the work ${c.partnerShort} does.

${c.sig}` },
      { day: 9, channel: "Email", title: "Follow up with something useful", why: "A second touch that gives before it asks is remembered. Keep it to four lines.",
        draft: c => `Subject: Re: Introduction from ${c.myAgency}

Hello ${c.contact},

Following up on my note from last week. I thought of you when I saw [a report, article, or result relevant to their work] — sharing it in case it's useful.

The offer still stands: 20 minutes whenever it's convenient, about ${c.ask}.

${c.sig}` },
      { day: 16, channel: "Call", title: "20-minute discovery call", why: "Listen more than you talk. Leave with one next step each.",
        draft: c => `Agenda — ${c.myAgency} × ${c.partnerShort} (20 minutes)

1. Thanks and context (2 min): why I reached out — ${c.opener}.
2. Their world (8 min): What are ${c.partnerShort}'s priorities this year? Where do agencies like ours help or get in the way?
3. Our world (5 min): One or two things ${c.myAgency} is working on. What we can offer: ${c.myOffers.slice(0, 2).join("; ").toLowerCase()}.
4. Overlap (3 min): Where do these meet? Candidates: ${c.theirOffers.slice(0, 2).join("; ").toLowerCase()}.
5. Next step (2 min): One concrete action each, with a date.

Notes:
` },
      { day: 17, channel: "Email", title: "Thank-you and one next step", why: "Send within 24 hours. Restate the one commitment so it doesn't evaporate.",
        draft: c => `Subject: Thank you — and next step

Hello ${c.contact},

Thank you for the time yesterday. Two things stayed with me: [insight one] and [insight two].

As agreed, I will [my commitment] by [date]. You mentioned [their commitment]; if anything changes on your side, just let me know.

I'll circle back in about a month with an update. In the meantime, please don't hesitate to reach out if ${c.myAgency} can help with anything.

${c.sig}` },
      { day: 45, channel: "Check-in", title: "30-day value touch", why: "Relationships fade without a reason to talk. Bring a result, an update, or an invitation.",
        draft: c => `Subject: Quick update from ${c.myAgency}

Hello ${c.contact},

A quick update: [what happened with my commitment, or a result worth sharing].

Two things you might find useful: [a resource or data point], and NAPE's [upcoming meeting or event] — happy to make introductions there if helpful.

Is there anything on your side where ${c.myAgency} could be useful this quarter?

${c.sig}` }
    ],

    reconnect: [
      { day: 0, channel: "Prep", title: "Recall the history", why: "People forgive a gap in contact. They don't forgive being treated as a stranger.",
        draft: c => `Reconnecting with ${c.partnerName} — notes to myself:
• When and how did we last work together? [date, project, or event]
• What did we accomplish, and what was left open?
• What has changed at ${c.myAgency} since then? [leadership, priorities, results]
• What has likely changed for them? Check their site${c.url ? ": " + c.url : ""} and recent announcements.
• Why now? [the honest reason I want to reconnect]
• A low-pressure first ask: ${c.ask}.` },
      { day: 1, channel: "Email", title: "Reconnect note (no ask)", why: "Acknowledge the gap in one line, share one update, and ask nothing. That's what makes it easy to answer.",
        draft: c => `Subject: Reconnecting — ${c.myAgency}

Hello ${c.contact},

It has been a while since [last project or event], and I've been meaning to reach out. I hope things are going well at ${c.partnerShort}.

A quick update from our side: I'm now ${c.myRole} at ${c.myAgency}, and [one meaningful change or result].

No ask here — I simply valued working with you and wanted to reopen the door.

${c.sig}` },
      { day: 8, channel: "Email", title: "Share an update, ask for 15 minutes", why: "Now that the door is open, offer something and make a small, specific ask.",
        draft: c => `Subject: Re: Reconnecting — ${c.myAgency}

Hello ${c.contact},

Thought you might find this useful: [a result, resource, or lesson from our recent work].

I'd also welcome 15 minutes to hear what ${c.partnerShort} is focused on now. From our side, ${c.myAgency} can offer ${c.myOffers[0].toLowerCase()}, and I'd like to understand ${c.ask}.

Would sometime in the next two weeks work?

${c.sig}` },
      { day: 15, channel: "Call", title: "Catch-up call", why: "Two questions carry the whole conversation: what changed, and what's ahead.",
        draft: c => `Agenda — catch-up with ${c.partnerShort} (15–20 minutes)

1. What's changed for you since [last project]? Priorities, people, pressures.
2. What's changed for us: [two updates from ${c.myAgency}].
3. What's ahead for each of us in the next 6 months?
4. Where could we help each other? Possibilities: ${c.theirOffers.slice(0, 2).join("; ").toLowerCase()} ↔ ${c.myOffers.slice(0, 2).join("; ").toLowerCase()}.
5. Agree on a rhythm: a quarterly check-in, and who initiates.

Notes:
` },
      { day: 16, channel: "Email", title: "Recap and a rhythm", why: "Name the cadence out loud. A quarterly note is easy to keep and hard to forget.",
        draft: c => `Subject: Good to reconnect

Hello ${c.contact},

Thank you for the time. It was good to catch up on [one or two highlights].

As discussed, I'll [my commitment] and you'll [their commitment]. Let's keep a quarterly check-in — I'll put a note on my calendar to reach out in [month].

If ${c.myAgency} can be useful before then, you know where to find me.

${c.sig}` },
      { day: 90, channel: "Check-in", title: "Quarterly touch", why: "Keep the promise you made. Bring one update and one question.",
        draft: c => `Subject: Quarterly check-in — ${c.myAgency}

Hello ${c.contact},

Checking in as promised. One update from our side: [result or change].

One question for you: [something about their current priorities].

Anything ${c.myAgency} can help with this quarter?

${c.sig}` }
    ],

    support: [
      { day: 0, channel: "Prep", title: "Map mutual support", why: "Write down what each of you can offer before you ask. It changes the conversation from favor to exchange.",
        draft: c => `Mutual support map — ${c.myAgency} ↔ ${c.partnerName}

What I can offer as ${c.myRole}:
${c.myOffers.map(o => "• " + o).join("\n")}

What ${c.partnerShort} can typically offer (${c.category}):
${c.theirOffers.map(o => "• " + o).join("\n")}

What they tend to value from an agency like ours:
${c.theirWants.map(o => "• " + o).join("\n")}

A ${c.partnerRole} can usually open the door to ${c.opens}.

One small collaboration we could try in 90 days: [idea]` },
      { day: 1, channel: "Email", title: "Propose an exploration conversation", why: "Frame it as a working session about how to support each other, not a request.",
        draft: c => `Subject: How ${c.myAgency} and ${c.partnerShort} can support each other

Hello ${c.contact},

We've worked together on [context], and I'd like to make the relationship more deliberate. Specifically: what can each of us offer the other in our roles, and is there one small thing we could do together in the next 90 days?

From our side, ${c.myAgency} can offer ${c.myOffers[0].toLowerCase()} and ${c.myOffers[1].toLowerCase()}. I suspect ${c.partnerShort} could help us with ${c.theirOffers[0].toLowerCase()}.

Would you be open to a 30-minute working session in the next two weeks?

${c.sig}` },
      { day: 10, channel: "Call", title: "Working session: three questions", why: "Three questions, thirty minutes, one commitment. Keep it that simple.",
        draft: c => `Agenda — working session with ${c.partnerShort} (30 minutes)

Question 1 — What does ${c.partnerShort} need most from agencies like ours right now?
  Likely answers: ${c.theirWants.slice(0, 2).join("; ").toLowerCase()}.

Question 2 — What does ${c.myAgency} need most that ${c.partnerShort} is positioned to provide?
  Candidates: ${c.theirOffers.slice(0, 2).join("; ").toLowerCase()}.

Question 3 — What is one small thing we could do together in 90 days, with a named owner on each side?
  Idea: [from my prep notes]

Close: owner, date, and how we'll know it worked.

Notes:
` },
      { day: 12, channel: "Email", title: "Recap with one small pilot", why: "A pilot with an owner and a date is a partnership. Everything else is a good conversation.",
        draft: c => `Subject: Recap — our 90-day pilot

Hello ${c.contact},

Thank you for the working session. Here's what I heard, so we're aligned:

• ${c.partnerShort} needs from agencies like ours: [answer to question 1]
• ${c.myAgency} needs from ${c.partnerShort}: [answer to question 2]
• Our 90-day pilot: [what], owned by [me] on our side and [them] on yours, with [success measure] by [date].

I'll send a brief progress note in about a month. Please correct anything I've misread.

${c.sig}` },
      { day: 40, channel: "Email", title: "Pilot progress check", why: "Honest status, including what's stuck. That's what earns trust for the next round.",
        draft: c => `Subject: Pilot progress — ${c.myAgency} × ${c.partnerShort}

Hello ${c.contact},

A quick progress note on our pilot:
• Done: [what's complete]
• In progress: [what's underway]
• Stuck: [what needs a decision or help]

One thing I could use from ${c.partnerShort}: [specific request]. And if there's anything I can move on our side, tell me.

${c.sig}` },
      { day: 90, channel: "Meeting", title: "90-day review and next commitments", why: "Decide together: continue, expand, or close well. Any of the three is a good outcome if it's explicit.",
        draft: c => `Agenda — 90-day review with ${c.partnerShort} (30 minutes)

1. What we set out to do, and what happened.
2. What each side got from it. Was the support mutual?
3. Decision: continue as is, expand, or close the pilot well.
4. If continuing: next commitment, owners, and date.
5. Rhythm going forward: how often we check in and who initiates.

Thank-you note to send afterward:
Hello ${c.contact} — thank you for 90 days of real collaboration. [What I valued most.] I'm looking forward to [next commitment].

${c.sig}` }
    ]
  };

  /* ---------- Live editorial content (defaults above, Airtable rows applied over them) ---------- */
  let myRoles = MY_ROLES.slice();
  let partnerRoles = PARTNER_ROLES.slice();
  let categoryProfiles = Object.assign({}, CATEGORY_PROFILES);
  let roleOffers = Object.assign({}, ROLE_OFFERS);
  let partnerRoleOpens = Object.assign({}, PARTNER_ROLE_OPENS);
  let CONTENT_SOURCE = "built-in";

  const strList = (v, max) => Array.isArray(v) ? v.map(x => String(x || "").trim()).filter(Boolean).slice(0, max) : [];
  const str = (v, max) => (v == null ? "" : String(v)).trim().slice(0, max);

  function applyContent(content) {
    if (!content || typeof content !== "object") return;
    let applied = false;
    const cats = content.categories && typeof content.categories === "object" ? content.categories : {};
    Object.keys(cats).forEach(name => {
      const c = cats[name] || {};
      const base = categoryProfiles[name] || DEFAULT_PROFILE;
      const offers = strList(c.offers, 8), wants = strList(c.wants, 8);
      categoryProfiles[str(name, 80)] = {
        offers: offers.length ? offers : base.offers,
        wants: wants.length ? wants : base.wants,
        opener: str(c.opener, 400) || base.opener,
        ask: str(c.ask, 400) || base.ask
      };
      applied = true;
    });
    const roles = content.roles && typeof content.roles === "object" ? content.roles : {};
    const mine = Array.isArray(roles.mine) ? roles.mine.map(r => ({ role: str(r && r.role, 80), offers: strList(r && r.offers, 8) })).filter(r => r.role && r.offers.length >= 2) : [];
    if (mine.length) {
      myRoles = mine.map(r => r.role);
      roleOffers = {};
      mine.forEach(r => { roleOffers[r.role] = r.offers; });
      applied = true;
    }
    const partner = Array.isArray(roles.partner) ? roles.partner.map(r => ({ role: str(r && r.role, 80), opens: str(r && r.opens, 400) })).filter(r => r.role && r.opens) : [];
    if (partner.length) {
      partnerRoles = partner.map(r => r.role);
      partnerRoleOpens = {};
      partner.forEach(r => { partnerRoleOpens[r.role] = r.opens; });
      applied = true;
    }
    if (applied) CONTENT_SOURCE = "airtable";
  }

  /* ---------- Storage ---------- */
  function load() {
    const d = NAPE.get(KEY, null);
    if (!d || typeof d !== "object" || !Array.isArray(d.campaigns)) return { campaigns: [], openId: null };
    return d;
  }
  function save(d) { NAPE.set(KEY, d); }

  /* ---------- Directory ---------- */
  let DIRECTORY = [];
  let DIR_SOURCE = "";
  let NAPE_INFO = null;

  function normalizeAgency(a) {
    if (!a || typeof a !== "object" || !a.name) return null;
    return {
      id: String(a.id || a.name),
      name: String(a.name).slice(0, 200),
      acronym: String(a.acronym || "").slice(0, 40),
      category: String(a.category || "Other").slice(0, 80),
      description: String(a.description || "").slice(0, 1000),
      url: /^https?:\/\//i.test(String(a.url || "")) ? String(a.url).slice(0, 500) : "",
      notes: String(a.notes || "").slice(0, 500),
      sponsorTier: a.sponsorTier ? String(a.sponsorTier).slice(0, 40) : ""
    };
  }

  async function loadDirectory() {
    const tryFetch = async (url) => {
      const r = await fetch(url, { headers: { Accept: "application/json" } });
      if (!r.ok) throw new Error(String(r.status));
      const data = await r.json();
      if (!data || !Array.isArray(data.agencies)) throw new Error("bad payload");
      return data;
    };
    let data;
    try {
      data = await tryFetch("/api/agencies");
      DIR_SOURCE = "live";
    } catch (e) {
      try {
        data = await tryFetch(SNAPSHOT_URL);
        DIR_SOURCE = "snapshot";
      } catch (e2) {
        data = { agencies: [] };
        DIR_SOURCE = "none";
      }
    }
    DIRECTORY = data.agencies.map(normalizeAgency).filter(Boolean)
      .sort((a, b) => a.name.localeCompare(b.name));
    applyContent(data.content);
    const n = data.nape && typeof data.nape === "object" ? data.nape : {};
    NAPE_INFO = {
      name: String(n.name || "NAPE").slice(0, 120),
      contactName: String(n.contactName || "").slice(0, 120),
      contactEmail: /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(String(n.contactEmail || "")) ? String(n.contactEmail) : "",
      contactPhone: String(n.contactPhone || "").slice(0, 40)
    };
  }

  function agencyById(id) { return DIRECTORY.find(a => a.id === id) || null; }

  /* ---------- DOM helpers ---------- */
  const $ = (id) => document.getElementById(id);
  const esc = napeEscape;

  function optionGroups(selectEl, agencies, { firstLabel, otherOption, excludeId } = {}) {
    const groups = {};
    agencies.forEach(a => {
      if (excludeId && a.id === excludeId) return;
      (groups[a.category] = groups[a.category] || []).push(a);
    });
    const cats = Object.keys(groups).sort((a, b) => {
      // Keep sponsors at the bottom; everything else alphabetical
      if (a === "NAPE Event Sponsor") return 1;
      if (b === "NAPE Event Sponsor") return -1;
      return a.localeCompare(b);
    });
    let html = `<option value="">${esc(firstLabel || "Select an organization")}</option>`;
    if (otherOption) html += `<option value="__other">${esc(otherOption)}</option>`;
    cats.forEach(cat => {
      html += `<optgroup label="${esc(cat)}">` + groups[cat].map(a =>
        `<option value="${esc(a.id)}">${esc(a.name)}${a.acronym ? " (" + esc(a.acronym) + ")" : ""}</option>`).join("") + `</optgroup>`;
    });
    selectEl.innerHTML = html;
  }

  /* ---------- Campaign context ---------- */
  function buildContext(c) {
    const partner = c.partner;
    const profile = categoryProfiles[partner.category] || DEFAULT_PROFILE;
    const myOffers = roleOffers[c.myRole] || ROLE_OFFERS[c.myRole] || roleOffers[myRoles[myRoles.length - 1]] || ROLE_OFFERS["Other probation professional"];
    const opens = partnerRoleOpens[c.partnerRole] || PARTNER_ROLE_OPENS[c.partnerRole] || partnerRoleOpens[partnerRoles[partnerRoles.length - 1]] || PARTNER_ROLE_OPENS["Not sure yet"];
    const me = c.me || "[Your name]";
    const contact = (c.contactName || "").trim() || "[Name]";
    return {
      me,
      contact,
      myAgency: c.myAgencyName,
      myRole: c.myRole,
      partnerName: partner.name,
      partnerShort: partner.acronym || partner.name,
      partnerRole: c.partnerRole,
      category: partner.category,
      url: partner.url,
      opener: profile.opener,
      ask: profile.ask,
      opens,
      myOffers,
      theirOffers: profile.offers,
      theirWants: profile.wants,
      sig: `${me}\n${c.myRole}, ${c.myAgencyName}`
    };
  }

  function addDays(dateStr, n) {
    const [y, m, d] = dateStr.split("-").map(Number);
    const dt = new Date(y, m - 1, d + n);
    return dt.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
  }
  function todayStr() {
    const n = new Date();
    return n.getFullYear() + "-" + String(n.getMonth() + 1).padStart(2, "0") + "-" + String(n.getDate()).padStart(2, "0");
  }

  /* ---------- Rendering ---------- */
  let store = load();

  function currentCampaign() {
    return store.campaigns.find(c => c.id === store.openId) || null;
  }

  function renderSaved() {
    const box = $("cx-saved");
    const list = $("cx-saved-list");
    if (!store.campaigns.length) { box.hidden = true; return; }
    box.hidden = false;
    list.innerHTML = store.campaigns.slice().sort((a, b) => b.createdAt - a.createdAt).map(c => {
      const done = c.steps.filter(s => s.done).length;
      const total = SEQUENCES[c.goal].length;
      return `<div class="cx-item${c.id === store.openId ? " open" : ""}">
        <div>
          <div class="cx-item-title">${esc(c.myAgencyName)} <span class="arrow">→</span> ${esc(c.partner.name)}</div>
          <div class="cx-item-meta">${esc(GOALS[c.goal].short)} · ${done} of ${total} steps · started ${esc(addDays(c.startDate, 0))}</div>
        </div>
        <div class="cx-item-actions">
          <button class="btn btn-outline btn-small" data-open="${esc(c.id)}">${c.id === store.openId ? "Viewing" : "Open"}</button>
          <button class="link-btn danger" data-del="${esc(c.id)}">Delete</button>
        </div>
      </div>`;
    }).join("");
  }

  function renderCampaign() {
    const c = currentCampaign();
    const sec = $("cx-campaign");
    if (!c) { sec.hidden = true; return; }
    sec.hidden = false;
    const ctx = buildContext(c);
    const seq = SEQUENCES[c.goal];
    const done = c.steps.filter(s => s.done).length;
    const p = c.partner;

    $("cx-head").innerHTML = `
      <div>
        <div class="cx-pair">${esc(c.myAgencyName)}<span class="arrow">→</span>${esc(p.name)}</div>
        <div class="w-chips" style="margin-top:8px">
          <span class="w-chip">${esc(GOALS[c.goal].name)}</span>
          <span class="w-chip">${esc(c.myRole)} → ${esc(c.contactName ? c.contactName + ", " + c.partnerRole : c.partnerRole)}</span>
          <span class="w-chip">${done} of ${seq.length} steps done</span>
        </div>
      </div>
      <div class="cx-head-actions">
        <button class="btn btn-gold btn-small" id="cx-add-goal">Add to my growth plan</button>
        <button class="btn btn-ghost btn-small" id="cx-print">Print</button>
      </div>`;

    $("cx-brief").innerHTML = `
      <div class="cx-brief-head">
        <div>
          <span class="stage-chip chip-others">${esc(p.category)}</span>
          ${p.sponsorTier ? `<span class="stage-chip chip-org">NAPE ${esc(p.sponsorTier)} sponsor</span>` : ""}
          <h3>${esc(p.name)}${p.acronym ? ` <span class="acr">(${esc(p.acronym)})</span>` : ""}</h3>
        </div>
        ${p.url ? `<a class="btn btn-outline btn-small" href="${esc(p.url)}" target="_blank" rel="noopener noreferrer">Visit website ↗</a>` : ""}
      </div>
      <p>${esc(p.description || "No description on file yet.")}</p>
      ${p.notes ? `<p class="dir-note">${esc(p.notes)}</p>` : ""}
      <p class="dir-note">Reaching a <strong>${esc(c.partnerRole)}</strong> typically opens the door to ${esc(ctx.opens)}.</p>`;

    $("cx-support").innerHTML = `
      <div class="support-col">
        <h4>What you can offer as ${esc(c.myRole)}</h4>
        <ul>${ctx.myOffers.map(o => `<li>${esc(o)}</li>`).join("")}</ul>
      </div>
      <div class="support-col">
        <h4>What ${esc(ctx.partnerShort)} can offer (${esc(p.category)})</h4>
        <ul>${ctx.theirOffers.map(o => `<li>${esc(o)}</li>`).join("")}</ul>
        <h4 style="margin-top:14px">What they tend to value from an agency like yours</h4>
        <ul>${ctx.theirWants.map(o => `<li>${esc(o)}</li>`).join("")}</ul>
      </div>`;

    renderWarmIntro(c, ctx);

    $("cx-steps").innerHTML = seq.map((s, i) => {
      const st = c.steps[i] || {};
      const draft = typeof st.draft === "string" ? st.draft : s.draft(ctx);
      const ch = s.channel.toLowerCase().replace(/[^a-z]/g, "");
      return `<article class="step${st.done ? " done" : ""}" data-i="${i}">
        <div class="step-when">
          <div class="day">Day ${s.day}</div>
          <div class="date">${esc(addDays(c.startDate, s.day))}</div>
          <span class="ch-chip ch-${ch}">${esc(s.channel)}</span>
        </div>
        <div class="step-body">
          <h4>${i + 1}. ${esc(s.title)}${st.done ? ' <span class="ms-status st-approved">Done</span>' : ""}</h4>
          <p class="step-why">${esc(s.why)}</p>
          <label class="sr-only" for="cx-draft-${i}">Draft for step ${i + 1}</label>
          <textarea id="cx-draft-${i}" data-draft="${i}" spellcheck="true">${esc(draft)}</textarea>
          <div class="step-actions">
            <button class="btn btn-outline btn-small" data-copy="${i}">Copy</button>
            <button class="btn ${st.done ? "btn-outline" : "btn-navy"} btn-small" data-done="${i}">${st.done ? "Mark not done" : "Mark done"}</button>
            ${st.draft ? `<button class="link-btn" data-reset="${i}">Reset draft</button>` : ""}
            <input class="step-note" data-note="${i}" type="text" placeholder="Note (who, when, outcome)" value="${esc(st.note || "")}" aria-label="Note for step ${i + 1}">
          </div>
        </div>
      </article>`;
    }).join("");

    $("cx-add-goal").addEventListener("click", () => {
      const goals = NAPE.get(NAPE.KEYS.GOALS, []);
      const title = "Build a connection with " + p.name;
      if (goals.some(g => g.title === title)) { napeToast("That goal is already in your growth plan."); return; }
      napeAddGoal("org", title, seq.map(s => s.title));
      napeToast("Added to your growth plan under Lead the Organization.");
      const label = document.querySelector("[data-progress]");
      if (label) { const pr = napeProgress(); label.textContent = pr.total ? pr.pct + "% approved" : "Start your plan"; }
    });
    $("cx-print").addEventListener("click", () => window.print());
  }

  /* Optional step 0: ask NAPE's Secretariat for a warm introduction (new connections only). */
  function warmIntroDraft(c, ctx) {
    const who = NAPE_INFO && NAPE_INFO.contactName ? NAPE_INFO.contactName.split(",")[0].trim() : "NAPE Secretariat";
    return `Subject: Introduction request — ${ctx.partnerShort}

Hello ${who},

I'm ${ctx.me}, ${ctx.myRole} at ${ctx.myAgency}, and a participant in NAPE's leadership community. I'm hoping to connect with ${ctx.partnerName}${ctx.contact !== "[Name]" ? " (" + ctx.contact + ", " + ctx.partnerRole + ")" : " — ideally a " + ctx.partnerRole}.

The reason: ${ctx.opener}. I'd like to explore ${ctx.ask}.

If NAPE has a relationship there, would you be willing to make an introduction, or point me to the best person to contact? A two-line email introduction is plenty; I'll take it from there.

Thank you for everything the Secretariat does for the membership.

${ctx.sig}`;
  }

  function renderWarmIntro(c, ctx) {
    const box = $("cx-warm");
    if (c.goal !== "establish") { box.hidden = true; box.innerHTML = ""; return; }
    box.hidden = false;
    const draft = typeof c.warmDraft === "string" ? c.warmDraft : warmIntroDraft(c, ctx);
    const email = NAPE_INFO && NAPE_INFO.contactEmail ? NAPE_INFO.contactEmail : "";
    const subject = draft.split("\n")[0].replace(/^Subject:\s*/, "");
    const body = draft.split("\n").slice(2).join("\n");
    const mailto = email ? `mailto:${encodeURIComponent(email)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}` : "";
    box.innerHTML = `<article class="step warm${c.warmDone ? " done" : ""}">
      <div class="step-when">
        <div class="day">Before</div>
        <div class="date">Optional, before day 0</div>
        <span class="ch-chip ch-prep">Warm intro</span>
      </div>
      <div class="step-body">
        <h4>0. Ask NAPE for a warm introduction${c.warmDone ? ' <span class="ms-status st-approved">Done</span>' : ""}</h4>
        <p class="step-why">A two-line introduction from someone they already trust beats the best cold email. ${NAPE_INFO && NAPE_INFO.contactName ? "NAPE's contact on file: " + esc(NAPE_INFO.contactName) + (email ? " · " + esc(email) : "") + (NAPE_INFO.contactPhone ? " · " + esc(NAPE_INFO.contactPhone) : "") + "." : ""} Skip this step if you'd rather reach out directly.</p>
        <label class="sr-only" for="cx-warm-draft">Draft introduction request</label>
        <textarea id="cx-warm-draft" spellcheck="true">${esc(draft)}</textarea>
        <div class="step-actions">
          <button class="btn btn-outline btn-small" id="cx-warm-copy">Copy</button>
          ${mailto ? `<a class="btn btn-outline btn-small" id="cx-warm-mail" href="${esc(mailto)}">Open in email</a>` : ""}
          <button class="btn ${c.warmDone ? "btn-outline" : "btn-navy"} btn-small" id="cx-warm-done">${c.warmDone ? "Mark not done" : "Mark done"}</button>
          ${typeof c.warmDraft === "string" ? '<button class="link-btn" id="cx-warm-reset">Reset draft</button>' : ""}
        </div>
      </div>
    </article>`;
    box.querySelector("#cx-warm-copy").addEventListener("click", async () => {
      const ok = await copyText(box.querySelector("#cx-warm-draft").value);
      napeToast(ok ? "Copied to clipboard." : "Couldn't copy — select the text and copy manually.");
    });
    box.querySelector("#cx-warm-done").addEventListener("click", () => {
      c.warmDone = !c.warmDone; save(store); renderCampaign();
    });
    const reset = box.querySelector("#cx-warm-reset");
    if (reset) reset.addEventListener("click", () => { delete c.warmDraft; save(store); renderCampaign(); });
    box.querySelector("#cx-warm-draft").addEventListener("input", (e) => {
      c.warmDraft = e.target.value.slice(0, 8000); save(store);
      const m = box.querySelector("#cx-warm-mail");
      if (m) {
        const subj = c.warmDraft.split("\n")[0].replace(/^Subject:\s*/, "");
        const bd = c.warmDraft.split("\n").slice(2).join("\n");
        m.href = `mailto:${encodeURIComponent(email)}?subject=${encodeURIComponent(subj)}&body=${encodeURIComponent(bd)}`;
      }
    });
  }

  function renderAll() { renderSaved(); renderCampaign(); }

  /* ---------- Events ---------- */
  function persistStep(i, patch) {
    const c = currentCampaign();
    if (!c) return;
    c.steps[i] = Object.assign(c.steps[i] || {}, patch);
    save(store);
  }

  async function copyText(text) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch (e) {
      const ta = document.createElement("textarea");
      ta.value = text; ta.setAttribute("readonly", ""); ta.style.position = "fixed"; ta.style.left = "-9999px";
      document.body.append(ta); ta.select();
      let ok = false;
      try { ok = document.execCommand("copy"); } catch (e2) { ok = false; }
      ta.remove();
      return ok;
    }
  }

  $("cx-steps").addEventListener("click", async (e) => {
    const b = e.target.closest("button");
    if (!b) return;
    if (b.dataset.copy != null) {
      const ta = $("cx-draft-" + b.dataset.copy);
      const ok = await copyText(ta.value);
      napeToast(ok ? "Copied to clipboard." : "Couldn't copy — select the text and copy manually.");
    } else if (b.dataset.done != null) {
      const i = Number(b.dataset.done);
      const c = currentCampaign();
      const now = !(c.steps[i] && c.steps[i].done);
      persistStep(i, { done: now, doneAt: now ? Date.now() : null });
      renderAll();
      if (now) napeToast("Step marked done.");
    } else if (b.dataset.reset != null) {
      const i = Number(b.dataset.reset);
      const c = currentCampaign();
      if (c.steps[i]) { delete c.steps[i].draft; save(store); }
      renderCampaign();
    }
  });
  $("cx-steps").addEventListener("input", (e) => {
    const t = e.target;
    if (t.dataset.draft != null) persistStep(Number(t.dataset.draft), { draft: t.value.slice(0, 8000) });
    else if (t.dataset.note != null) persistStep(Number(t.dataset.note), { note: t.value.slice(0, 500) });
  });

  $("cx-saved-list").addEventListener("click", (e) => {
    const b = e.target.closest("button");
    if (!b) return;
    if (b.dataset.open) {
      store.openId = b.dataset.open; save(store); renderAll();
      $("cx-campaign").scrollIntoView({ behavior: "smooth", block: "start" });
    } else if (b.dataset.del) {
      const c = store.campaigns.find(x => x.id === b.dataset.del);
      if (!c) return;
      if (!confirm(`Delete the campaign with ${c.partner.name}? This only removes it from this device.`)) return;
      store.campaigns = store.campaigns.filter(x => x.id !== b.dataset.del);
      if (store.openId === b.dataset.del) store.openId = null;
      save(store); renderAll();
    }
  });

  /* ---------- Form ---------- */
  function setGoal(g) {
    document.querySelectorAll(".goal-card").forEach(el => {
      const on = el.dataset.goal === g;
      el.classList.toggle("active", on);
      el.setAttribute("aria-checked", String(on));
    });
    $("cx-goal").value = g;
  }
  document.querySelectorAll(".goal-card").forEach(el => {
    el.addEventListener("click", () => setGoal(el.dataset.goal));
    el.addEventListener("keydown", (e) => { if (e.key === " " || e.key === "Enter") { e.preventDefault(); setGoal(el.dataset.goal); } });
  });

  $("cx-my-agency").addEventListener("change", () => {
    const other = $("cx-my-agency").value === "__other";
    $("cx-my-agency-other-wrap").hidden = !other;
    if (other) $("cx-my-agency-other").focus();
    optionGroups($("cx-partner"), DIRECTORY, { firstLabel: "Select the partner organization", excludeId: other ? null : $("cx-my-agency").value });
  });

  $("cx-build").addEventListener("click", () => {
    const err = $("cx-error");
    err.textContent = "";
    const me = $("cx-name").value.trim().slice(0, 120);
    const myRole = $("cx-my-role").value;
    const mySel = $("cx-my-agency").value;
    const myAgencyName = mySel === "__other"
      ? $("cx-my-agency-other").value.trim().slice(0, 160)
      : (agencyById(mySel) || {}).name || "";
    const partner = agencyById($("cx-partner").value);
    const partnerRole = $("cx-partner-role").value;
    const contactName = $("cx-contact").value.trim().slice(0, 120);
    const goal = $("cx-goal").value;
    const startDate = napeValidDateStr($("cx-start").value) ? $("cx-start").value : todayStr();

    if (!myAgencyName) { err.textContent = "Tell us which agency you're representing."; $("cx-my-agency").focus(); return; }
    if (!myRole) { err.textContent = "Select your role."; $("cx-my-role").focus(); return; }
    if (!partner) { err.textContent = "Select the partner organization."; $("cx-partner").focus(); return; }
    if (partner.name === myAgencyName) { err.textContent = "Pick a partner that isn't your own agency."; return; }
    if (!partnerRole) { err.textContent = "Select who you're trying to reach."; $("cx-partner-role").focus(); return; }
    if (!GOALS[goal]) { err.textContent = "Choose what you want this connection to do."; return; }

    const c = {
      id: napeUid(), createdAt: Date.now(), startDate, goal,
      me, myRole, myAgencyName, myAgencyId: mySel === "__other" ? null : mySel,
      partner: { id: partner.id, name: partner.name, acronym: partner.acronym, category: partner.category, description: partner.description, url: partner.url, notes: partner.notes, sponsorTier: partner.sponsorTier },
      partnerRole, contactName,
      steps: SEQUENCES[goal].map(() => ({ done: false }))
    };
    store.campaigns.push(c);
    store.openId = c.id;
    save(store);
    // Remember name/role/agency for next time (same profile the Connect page uses)
    const profile = NAPE.get(NAPE.KEYS.PROFILE, null) || {};
    NAPE.set(NAPE.KEYS.PROFILE, Object.assign({}, profile, { name: me || profile.name, role: myRole, agency: myAgencyName }));
    renderAll();
    napeToast("Your campaign is ready.");
    $("cx-campaign").scrollIntoView({ behavior: "smooth", block: "start" });
  });

  /* ---------- Print: expand drafts so nothing is clipped ---------- */
  window.addEventListener("beforeprint", () => {
    document.querySelectorAll(".step textarea").forEach(t => { t.style.height = "auto"; t.style.height = t.scrollHeight + "px"; });
  });
  window.addEventListener("afterprint", () => {
    document.querySelectorAll(".step textarea").forEach(t => { t.style.height = ""; });
  });

  /* ---------- Init ---------- */
  (async function init() {
    $("cx-start").value = todayStr();
    setGoal("establish");

    await loadDirectory();
    $("cx-my-role").innerHTML = `<option value="">Select your role</option>` + myRoles.map(r => `<option>${esc(r)}</option>`).join("");
    $("cx-partner-role").innerHTML = `<option value="">Who are you trying to reach?</option>` + partnerRoles.map(r => `<option>${esc(r)}</option>`).join("");
    optionGroups($("cx-my-agency"), DIRECTORY, { firstLabel: "Select your agency", otherOption: "My agency isn't listed — I'll type it" });
    optionGroups($("cx-partner"), DIRECTORY, { firstLabel: "Select the partner organization" });

    const note = $("cx-dir-note");
    if (DIR_SOURCE === "live") note.textContent = `${DIRECTORY.length} organizations, loaded live from NAPE's partner directory${CONTENT_SOURCE === "airtable" ? " with NAPE-edited guidance" : ""}. Listings are not endorsements by NAPE.`;
    else if (DIR_SOURCE === "snapshot") note.textContent = `${DIRECTORY.length} organizations from a saved copy of NAPE's partner directory (live directory unavailable). Listings are not endorsements by NAPE.`;
    else note.textContent = "The partner directory couldn't be loaded. Please refresh to try again.";

    // Prefill from the profile saved on this device
    const profile = NAPE.get(NAPE.KEYS.PROFILE, null);
    if (profile) {
      if (profile.name) $("cx-name").value = profile.name;
      if (profile.role && myRoles.includes(profile.role)) $("cx-my-role").value = profile.role;
      if (profile.agency) {
        const match = DIRECTORY.find(a => a.name.toLowerCase() === String(profile.agency).toLowerCase());
        if (match) { $("cx-my-agency").value = match.id; }
        else { $("cx-my-agency").value = "__other"; $("cx-my-agency-other").value = profile.agency; $("cx-my-agency-other-wrap").hidden = false; }
        $("cx-my-agency").dispatchEvent(new Event("change"));
      }
    }
    $("cx-form").classList.remove("loading");
    renderAll();
  })();
})();
