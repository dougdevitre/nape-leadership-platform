/* NAPE Leadership Platform — shared utilities */

/* ---------- Storage ---------- */
const NAPE = {
  get(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch (e) { return fallback; }
  },
  set(key, value) {
    try { localStorage.setItem(key, JSON.stringify(value)); } catch (e) { /* storage unavailable */ }
  },
  KEYS: {
    GOALS: "nape_goals_v1",
    REFLECTIONS: "nape_reflections_v1",
    STAGE: "nape_stage_v1",
    PROFILE: "nape_profile_v1",
    BACKUP: "nape_backup_v1"
  }
};

/* ---------- Shared stage content ---------- */
const NAPE_STAGES = {
  self: {
    name: "Lead Self",
    tag: "The foundation of every leadership journey",
    mindsets: ["Growth over ego", "Purpose before position", "Comfort with discomfort"],
    skillsets: ["Self-awareness", "Personal clarity", "Resilience under pressure"],
    toolsets: ["Reflection practice", "Feedback loops", "Energy & time management"],
    reflect: "What kind of leader do the people in my agency need me to become — and what's one habit I'd have to change to get there?"
  },
  others: {
    name: "Lead Others",
    tag: "Trust is the currency of leadership",
    mindsets: ["People develop through belief and challenge", "Trust is built in small moments", "Teams outperform heroes"],
    skillsets: ["Coaching conversations", "Developing future leaders", "Building high-performing teams"],
    toolsets: ["One-on-one frameworks", "Delegation with development in mind", "Team health check-ins"],
    reflect: "Who on my team is ready for more responsibility than I've given them — and what's holding me back from offering it?"
  },
  org: {
    name: "Lead the Organization",
    tag: "From managing work to shaping the future",
    mindsets: ["Vision over reaction", "Complexity is the job, not the obstacle", "Impact is measured in communities served"],
    skillsets: ["Strategic direction", "Navigating political and system complexity", "Leading change"],
    toolsets: ["Stakeholder mapping", "Decision frameworks for uncertainty", "Succession planning"],
    reflect: "If I stepped away for six months, what would break — and what does that tell me about what I should be building now?"
  }
};

/* ---------- Starter goals (shared by Journey, Growth, Resources) ---------- */
const NAPE_STARTERS = {
  self: [
    { title:"Establish a weekly reflection practice", milestones:["Block 30 minutes weekly on my calendar","Complete 4 consecutive weekly reflections","Share one insight with my mentor"] },
    { title:"Get honest feedback on my leadership presence", milestones:["Ask 3 trusted colleagues for candid feedback","Identify my top blind spot","Choose one behavior to change and practice it for 30 days"] }
  ],
  others: [
    { title:"Build a monthly one-on-one rhythm", milestones:["Schedule recurring one-on-ones with each direct report","Run 2 full cycles using a consistent framework","Ask each person what they want to grow toward"] },
    { title:"Develop one future leader on my team", milestones:["Identify a high-potential team member","Delegate one meaningful responsibility with support","Debrief the experience together"] }
  ],
  org: [
    { title:"Draft a 3-year direction for my agency", milestones:["Map key stakeholders and their priorities","Draft a one-page vision statement","Pressure-test it with two peer executives"] },
    { title:"Strengthen succession readiness", milestones:["Identify critical roles with no backup","Create a development path for each","Review the plan with leadership"] }
  ]
};

/* ---------- Progress ---------- */
function napeProgress() {
  const goals = NAPE.get(NAPE.KEYS.GOALS, []);
  let total = 0, approved = 0;
  const byStage = { self: { t: 0, a: 0 }, others: { t: 0, a: 0 }, org: { t: 0, a: 0 } };
  goals.forEach(g => {
    (g.milestones || []).forEach(m => {
      total++;
      if (byStage[g.stage]) byStage[g.stage].t++;
      if (m.status === "approved") {
        approved++;
        if (byStage[g.stage]) byStage[g.stage].a++;
      }
    });
  });
  return {
    total, approved,
    pct: total ? Math.round((approved / total) * 100) : 0,
    byStage
  };
}

/* ---------- Toast ---------- */
function napeToast(msg) {
  let t = document.querySelector(".toast");
  if (!t) {
    t = document.createElement("div");
    t.className = "toast";
    t.setAttribute("role", "status");
    document.body.append(t);
  }
  t.textContent = msg;
  t.classList.add("show");
  clearTimeout(t._h);
  t._h = setTimeout(() => t.classList.remove("show"), 2600);
}

/* ---------- Add goal (shared) ---------- */
function napeAddGoal(stage, title, milestones, targetDate) {
  const goals = NAPE.get(NAPE.KEYS.GOALS, []);
  const goal = {
    id: napeUid(), stage, title, createdAt: Date.now(),
    milestones: (milestones || []).map(t => ({ id: napeUid(), text: t, status: "planned" }))
  };
  if (napeValidDateStr(targetDate)) goal.targetDate = targetDate;
  goals.push(goal);
  NAPE.set(NAPE.KEYS.GOALS, goals);
  return goals;
}

/* ---------- Nav (markup is static in each page; JS adds progress + mobile toggle) ---------- */
(function initNav() {
  const nav = document.querySelector(".site-nav");
  if (!nav) return;

  const label = nav.querySelector("[data-progress]");
  if (label) {
    const p = napeProgress();
    label.textContent = p.total ? p.pct + "% approved" : "Start your plan";
  }

  const toggle = nav.querySelector(".nav-toggle");
  const links = nav.querySelector(".nav-links");
  if (!toggle || !links) return;
  toggle.addEventListener("click", () => {
    const open = links.classList.toggle("open");
    toggle.setAttribute("aria-expanded", String(open));
    toggle.setAttribute("aria-label", open ? "Close menu" : "Open menu");
  });
  links.addEventListener("click", (e) => {
    if (e.target.tagName === "A") {
      links.classList.remove("open");
      toggle.setAttribute("aria-expanded", "false");
    }
  });
})();

/* ---------- Prototype feedback widget ---------- */
(function initFeedback() {
  if (!document.querySelector(".site-nav")) return;

  const PAGE_MAP = { "": "Home", "index": "Home", "journey": "Journey", "growth": "Growth Plan", "reflections": "Reflections", "resources": "Resources", "connect": "Connect", "media": "Media", "proposal": "Proposal" };
  const seg = (location.pathname.split("/").pop() || "").replace(/\.html$/, "");
  const current = Object.hasOwn(PAGE_MAP, seg) ? PAGE_MAP[seg] : "General";
  const PAGES = ["Home", "Journey", "Growth Plan", "Reflections", "Resources", "Connect", "Media", "Proposal", "General"];
  const TYPES = ["Bug", "Content", "Design", "Idea", "Question"];

  const wrap = document.createElement("div");
  wrap.className = "fb no-print";
  wrap.innerHTML = `
    <div class="fb-panel" id="fb-panel" hidden>
      <p class="fb-title">Feedback on this prototype</p>
      <label class="fb-label" for="fb-text">What's working, broken, or missing?</label>
      <textarea id="fb-text" rows="4"></textarea>
      <div class="fb-row">
        <select id="fb-page" aria-label="Which page">
          ${PAGES.map(p => `<option${p === current ? " selected" : ""}>${p}</option>`).join("")}
        </select>
        <select id="fb-type" aria-label="Feedback type">
          <option value="">Type…</option>
          ${TYPES.map(t => `<option>${t}</option>`).join("")}
        </select>
      </div>
      <input id="fb-from" type="text" placeholder="Your name (optional)" aria-label="Your name (optional)">
      <div style="position:absolute;left:-9999px" aria-hidden="true"><input id="fb-web" tabindex="-1" autocomplete="off"></div>
      <div class="fb-row">
        <button class="btn btn-gold btn-small" id="fb-send">Send feedback</button>
        <span class="fb-note" id="fb-note" role="status"></span>
      </div>
    </div>
    <button class="fb-btn" id="fb-open" aria-expanded="false" aria-controls="fb-panel">Feedback</button>`;
  document.body.append(wrap);

  const panel = wrap.querySelector("#fb-panel");
  const openBtn = wrap.querySelector("#fb-open");
  const note = wrap.querySelector("#fb-note");
  openBtn.addEventListener("click", () => {
    panel.hidden = !panel.hidden;
    openBtn.setAttribute("aria-expanded", String(!panel.hidden));
    if (!panel.hidden) wrap.querySelector("#fb-text").focus();
  });

  wrap.querySelector("#fb-send").addEventListener("click", async () => {
    const text = wrap.querySelector("#fb-text").value.trim();
    if (!text) { note.textContent = "Write a note first."; return; }
    const btn = wrap.querySelector("#fb-send");
    btn.disabled = true;
    note.textContent = "Sending…";
    try {
      const res = await fetch("/api/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text,
          page: wrap.querySelector("#fb-page").value,
          type: wrap.querySelector("#fb-type").value,
          from: wrap.querySelector("#fb-from").value.trim(),
          website: wrap.querySelector("#fb-web").value
        })
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.ok) {
        note.textContent = "Thanks — feedback sent.";
        wrap.querySelector("#fb-text").value = "";
        setTimeout(() => {
          panel.hidden = true;
          openBtn.setAttribute("aria-expanded", "false");
          note.textContent = "";
        }, 1800);
      } else if (res.status === 503) {
        note.textContent = "Feedback isn't set up yet — please email the team instead.";
      } else {
        note.textContent = (data && data.error) || "Couldn't send — please try again.";
      }
    } catch (e) {
      note.textContent = "Network issue — please try again.";
    } finally {
      btn.disabled = false;
    }
  });
})();

/* ---------- Helpers ---------- */
function napeUid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}
function napeEscape(s) {
  const d = document.createElement("div");
  d.textContent = s == null ? "" : String(s);
  return d.innerHTML;
}
function napeDate(ts) {
  return new Date(ts).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}
function napeValidDateStr(s) {
  return typeof s === "string" && /^\d{4}-\d{2}-\d{2}$/.test(s);
}
/* Format a YYYY-MM-DD string in local time (avoids the UTC shift of new Date("YYYY-MM-DD")). */
function napeDateStr(s) {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}
/* Days from today (local midnight) to a YYYY-MM-DD target; negative = overdue. */
function napeDaysUntil(s) {
  const [y, m, d] = s.split("-").map(Number);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  return Math.round((new Date(y, m - 1, d) - today) / 86400000);
}
