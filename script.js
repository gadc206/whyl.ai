// ---- Routing ----

const PAGES = ["home", "ads", "waitlist"];

function navigate(page) {
  if (!PAGES.includes(page)) page = "home";

  document.querySelectorAll(".page").forEach((el) => {
    el.hidden = el.id !== `page-${page}`;
  });
  document.querySelectorAll(".nav-link").forEach((el) => {
    el.classList.toggle("active", el.dataset.nav === page);
  });

  window.location.hash = page;
  window.scrollTo(0, 0);
}

document.querySelectorAll("[data-nav]").forEach((el) => {
  el.addEventListener("click", () => navigate(el.dataset.nav));
});

window.addEventListener("hashchange", () => {
  navigate(window.location.hash.replace("#", ""));
});

navigate(window.location.hash.replace("#", "") || "home");

// ---- Mobile nav toggle ----

const navToggle = document.getElementById("navToggle");
const navLinks = document.getElementById("navLinks");

navToggle.addEventListener("click", () => {
  const isOpen = navLinks.classList.toggle("open");
  navToggle.setAttribute("aria-expanded", String(isOpen));
});

navLinks.querySelectorAll("[data-nav]").forEach((el) => {
  el.addEventListener("click", () => {
    navLinks.classList.remove("open");
    navToggle.setAttribute("aria-expanded", "false");
  });
});

// ---- How it works: experience tabs ----

const experienceTabs = document.getElementById("experienceTabs");
if (experienceTabs) {
  experienceTabs.querySelectorAll(".experience-tab").forEach((tab) => {
    tab.addEventListener("click", () => {
      experienceTabs.querySelectorAll(".experience-tab").forEach((t) => t.classList.toggle("active", t === tab));
      document.getElementById("experience-user").hidden = tab.dataset.experience !== "user";
      document.getElementById("experience-advertiser").hidden = tab.dataset.experience !== "advertiser";
    });
  });
}

// ---- How it works: match dashboard height to the extension mock ----

const userExperienceMockWindow = document.querySelector("#experience-user .mock-window");
const userExperienceDashboardShell = document.querySelector("#experience-user .dashboard-shell");

if (userExperienceMockWindow && userExperienceDashboardShell) {
  const syncDashboardHeight = () => {
    const height = userExperienceMockWindow.offsetHeight;
    if (height > 0) userExperienceDashboardShell.style.height = `${height}px`;
  };

  new ResizeObserver(syncDashboardHeight).observe(userExperienceMockWindow);
  window.addEventListener("resize", syncDashboardHeight);
}

// ---- How it works: dashboard tabs (Overview / My Goals) ----

const dashboardTabs = document.getElementById("dashboardTabs");
if (dashboardTabs) {
  dashboardTabs.querySelectorAll(".dashboard-tab").forEach((tab) => {
    tab.addEventListener("click", () => {
      dashboardTabs.querySelectorAll(".dashboard-tab").forEach((t) => t.classList.toggle("active", t === tab));
      document.querySelectorAll(".dashboard-body[data-dpanel]").forEach((panel) => {
        panel.hidden = panel.dataset.dpanel !== tab.dataset.dtab;
      });
    });
  });
}

// ---- Hero typing animation ----

const TYPE_WORDS = ["Cursor", "ChatGPT", "Grok", "Claude", "Copilot"];
const TYPE_SPEED_MS = 95;
const DELETE_SPEED_MS = 48;
const HOLD_MS = 1500;
const PAUSE_MS = 380;

const rotatingWordTextEl = document.getElementById("rotatingWordText");

function typeLoop() {
  let wordIndex = 0;

  function typeWord(word, charIndex) {
    rotatingWordTextEl.textContent = word.slice(0, charIndex);
    if (charIndex < word.length) {
      setTimeout(() => typeWord(word, charIndex + 1), TYPE_SPEED_MS);
    } else {
      setTimeout(() => deleteWord(word, word.length), HOLD_MS);
    }
  }

  function deleteWord(word, charIndex) {
    rotatingWordTextEl.textContent = word.slice(0, charIndex);
    if (charIndex > 0) {
      setTimeout(() => deleteWord(word, charIndex - 1), DELETE_SPEED_MS);
    } else {
      wordIndex = (wordIndex + 1) % TYPE_WORDS.length;
      setTimeout(() => typeWord(TYPE_WORDS[wordIndex], 0), PAUSE_MS);
    }
  }

  typeWord(TYPE_WORDS[wordIndex], 0);
}

typeLoop();

// ---- Ad pitch video (wired per-instance so it can appear more than once) ----

function wireAdVideo(videoId, muteToggleId, progressId, tokensId, tokenIcon) {
  const video = document.getElementById(videoId);
  const muteToggle = document.getElementById(muteToggleId);
  const progress = document.getElementById(progressId);
  const tokens = document.getElementById(tokensId);
  if (!video) return;

  const TOKENS_PER_WATCH = 25;
  let completedWatches = 0;
  let lastTime = 0;

  muteToggle.addEventListener("click", () => {
    video.muted = !video.muted;
    muteToggle.textContent = video.muted ? "🔇" : "🔊";
  });

  video.addEventListener("timeupdate", () => {
    if (!video.duration) return;

    if (video.currentTime < lastTime) {
      // looped back to the start — one full pitch watched
      completedWatches += 1;
      progress.classList.add("no-transition");
      tokens.classList.add("token-bump");
      setTimeout(() => tokens.classList.remove("token-bump"), 400);
      requestAnimationFrame(() => progress.classList.remove("no-transition"));
    }
    lastTime = video.currentTime;

    const watchFraction = video.currentTime / video.duration;
    progress.style.width = watchFraction * 100 + "%";

    // tokens climb in step with the progress bar instead of jumping at the end
    const liveTokens = completedWatches * TOKENS_PER_WATCH + Math.floor(watchFraction * TOKENS_PER_WATCH);
    tokens.textContent = `${tokenIcon} ${liveTokens} tokens`;
  });
}

wireAdVideo("adVideo", "adMuteToggle", "mockProgress", "mockTokens", "+");
wireAdVideo("adVideo2", "adMuteToggle2", "mockProgress2", "mockTokens2", "+");

// ---- Animated extension mock "thinking" clocks ----

function wireMockClock(clockId) {
  const clock = document.getElementById(clockId);
  if (!clock) return;
  let elapsed = 0;
  setInterval(() => {
    elapsed += 1;
    const mm = String(Math.floor(elapsed / 60)).padStart(2, "0");
    const ss = String(elapsed % 60).padStart(2, "0");
    clock.textContent = `${mm}:${ss}`;
  }, 1000);
}

wireMockClock("mockClock");
wireMockClock("mockClock2");

// ---- Showcase marketplace ----

const CAMPAIGNS = [
  { name: "Ramp", initial: "R", bid: 4.20, impr: "128k" },
  { name: "Vercel", initial: "V", bid: 3.85, impr: "96k" },
  { name: "Linear", initial: "L", bid: 2.10, impr: "54k" },
  { name: "Neon", initial: "N", bid: 1.60, impr: "40k" },
  { name: "Resend", initial: "S", bid: 1.15, impr: "22k" },
];

const bidRange = document.getElementById("bidRange");
const blocksRange = document.getElementById("blocksRange");
const bidValueEl = document.getElementById("bidValue");
const blocksValueEl = document.getElementById("blocksValue");
const rankPhraseEl = document.getElementById("rankPhrase");
const totalCostEl = document.getElementById("totalCost");
const reachEl = document.getElementById("reach");
const devPayoutEl = document.getElementById("devPayout");
const orderbookRows = document.getElementById("orderbookRows");
const liveBiddersEl = document.getElementById("liveBidders");

function fmt(n) {
  return n.toLocaleString("en-US", { maximumFractionDigits: 0 });
}

function renderMarketplace() {
  const bid = parseFloat(bidRange.value);
  const blocks = parseInt(blocksRange.value, 10);

  bidValueEl.textContent = "$" + bid.toFixed(2);
  blocksValueEl.textContent = blocks;

  const you = { name: "Your campaign", initial: "★", bid, impr: blocks + "k", isYou: true };
  const merged = CAMPAIGNS.concat([you]).sort((a, b) => b.bid - a.bid);
  const rank = merged.findIndex((c) => c.isYou) + 1;

  orderbookRows.innerHTML = "";
  merged.forEach((c, i) => {
    const r = i + 1;
    const serving = r <= 2;
    const row = document.createElement("div");
    row.className = "ob-row" + (c.isYou ? " you" : "");
    row.innerHTML = `
      <div class="ob-rank">${r}</div>
      <div class="ob-name-wrap">
        <div class="ob-chip">${c.initial}</div>
        <div>
          <div class="ob-name">${c.name}</div>
          <div class="ob-impr">${c.impr} left</div>
        </div>
      </div>
      <div class="ob-bid">$${c.bid.toFixed(2)}</div>
      <div class="ob-status${c.isYou ? " you" : serving ? " serving" : ""}">${c.isYou ? "you" : serving ? "● serving" : "queued"}</div>
    `;
    orderbookRows.appendChild(row);
  });

  const totalCost = bid * blocks;
  rankPhraseEl.textContent = rank === 1 ? "#1 — top slot" : `#${rank} in queue`;
  totalCostEl.textContent = "$" + fmt(totalCost);
  reachEl.textContent = fmt(blocks * 1000);
  devPayoutEl.textContent = "$" + fmt(totalCost * 0.5);
  liveBiddersEl.textContent = CAMPAIGNS.length + 1;
}

bidRange.addEventListener("input", renderMarketplace);
blocksRange.addEventListener("input", renderMarketplace);
renderMarketplace();

// ---- Waitlist ----

const waitlistForm = document.getElementById("waitlistForm");
const waitlistSuccess = document.getElementById("waitlistSuccess");
const waitlistSubmit = document.getElementById("waitlistSubmit");
const emailInput = document.getElementById("emailInput");
const secondaryInput = document.getElementById("secondaryInput");
const secondaryLabel = document.getElementById("secondaryLabel");
const pickEarn = document.getElementById("pickEarn");
const pickAd = document.getElementById("pickAd");

let waitlistSide = "earn";

function setWaitlistSide(side) {
  waitlistSide = side;
  pickEarn.classList.toggle("active", side === "earn");
  pickAd.classList.toggle("active", side === "ad");

  if (side === "ad") {
    secondaryLabel.textContent = "company / startup name";
    secondaryInput.placeholder = "Acme Inc.";
    secondaryInput.required = true;
  } else {
    secondaryLabel.textContent = "which tools? (optional)";
    secondaryInput.placeholder = "Claude, Cursor, Copilot…";
    secondaryInput.required = false;
  }
}

pickEarn.addEventListener("click", () => setWaitlistSide("earn"));
pickAd.addEventListener("click", () => setWaitlistSide("ad"));

waitlistForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  if (!emailInput.value) return;
  if (waitlistSide === "ad" && !secondaryInput.value) return;

  const originalLabel = waitlistSubmit.textContent;
  waitlistSubmit.disabled = true;
  waitlistSubmit.textContent = "joining…";

  try {
    const res = await fetch("/api/waitlist", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: emailInput.value,
        role: waitlistSide === "ad" ? "advertiser" : "watcher",
        company: waitlistSide === "ad" ? secondaryInput.value : undefined,
      }),
    });

    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error(body.error || `Request failed (${res.status})`);
    }

    waitlistSubmit.textContent = "you're in ✓";
    waitlistSuccess.hidden = false;
    emailInput.disabled = true;
    secondaryInput.disabled = true;
    pickEarn.disabled = true;
    pickAd.disabled = true;
  } catch (err) {
    waitlistSubmit.disabled = false;
    waitlistSubmit.textContent = originalLabel;
    waitlistSuccess.textContent = err.message || "Something went wrong. Please try again.";
    waitlistSuccess.hidden = false;
  }
});

// ---- Goals ----

let goals = [
  { id: "lang", label: "Learn Spanish", detail: "420 words · 15 min/day", pct: 62, on: true },
  { id: "book", label: "Finish 'Dune'", detail: "p.412 of 528", pct: 78, on: true },
  { id: "cs", label: "CS assignment", detail: "2 of 5 problems", pct: 40, on: false },
  { id: "streak", label: "Daily stretch", detail: "12-day streak", pct: 55, on: false },
];
let banked = 47;

const goalsListHome = document.getElementById("goalsListHome");
const bankedLabelHome = document.getElementById("bankedLabelHome");
const logWaitBtn = document.getElementById("logWaitBtn");

function bankedLabel() {
  const h = Math.floor(banked / 60);
  return h > 0 ? `${h}h ${banked % 60}m` : `${banked} min`;
}

function renderGoals() {
  goalsListHome.innerHTML = "";
  goals.forEach((g) => {
    const item = document.createElement("div");
    item.className = "goal-item" + (g.on ? " on" : "");
    item.innerHTML = `
      <div class="goal-item-top">
        <div class="goal-copy">
          <div class="goal-label">${g.label}</div>
          <div class="goal-detail">${g.detail}</div>
        </div>
        <span class="goal-pct">${g.pct}%</span>
      </div>
      <div class="goal-bar-track"><div class="goal-bar-fill" style="width:${g.pct}%"></div></div>
    `;
    item.addEventListener("click", () => {
      g.on = !g.on;
      renderGoals();
    });
    goalsListHome.appendChild(item);
  });
  bankedLabelHome.textContent = `${bankedLabel()} banked this week`;
}

logWaitBtn.addEventListener("click", () => {
  const active = goals.filter((g) => g.on).length || 1;
  const bump = Math.round(9 / active) + 3;
  banked += 3;
  goals = goals.map((g) => (g.on ? { ...g, pct: Math.min(100, g.pct + bump) } : g));
  renderGoals();
});

renderGoals();
