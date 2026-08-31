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
function napeAddGoal(stage, title, milestones) {
  const goals = NAPE.get(NAPE.KEYS.GOALS, []);
  goals.push({
    id: napeUid(), stage, title, createdAt: Date.now(),
    milestones: (milestones || []).map(t => ({ id: napeUid(), text: t, status: "planned" }))
  });
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
