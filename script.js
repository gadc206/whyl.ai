// ---- Data ----

const TASKS = {
  "Physical Reset": [
    "20-20-20: look 20 feet away for 20 seconds.",
    "Roll shoulders back. Unclench your jaw.",
    "Stand and stretch for 30 seconds.",
    "Grab water. Mild dehydration kills focus.",
    "Three slow deep breaths. Fifteen seconds, zero context.",
  ],
  "Stay in Context": [
    "Re-read the prompt you just sent.",
    "Scan the functions above and below where you're working.",
    "Mental walkthrough: what should the output look like?",
    "What assumption might be wrong here?",
    "Trace the expected behavior in your head.",
  ],
  "Prep & Plan": [
    "Draft your next instruction to the AI.",
    "Review your recent git diff while it's fresh.",
    "Sketch test scenarios: empty input, API down, no permissions.",
    "Write the next 3 things you need to do on this task.",
    "Note one blocker or question for a colleague.",
  ],
  "Diffuse Mode": [
    "Look out a window. Let your mind wander back to the problem.",
    "Walk to the kitchen. Don't check your phone.",
    "Doodle or fidget for 30 seconds.",
    "Close your eyes briefly. Not meditation — just disengage.",
    "Ask: what would a simpler version of this look like?",
  ],
  "Task Hygiene": [
    "Update your notes: what you finished, what's left.",
    "Log time worked on this task.",
    "Bookmark that article — don't read it now.",
    "Clear exactly one notification. Not five.",
    "Capture what broke last time before you forget.",
  ],
  "Token Earn": [
    "Watch the startup ad above. That's +5 tokens.",
    "Another ad, another 5 tokens. Stack them.",
    "You're earning compute credits right now. Weird flex.",
    "This ad pays for your next Claude prompt. You're welcome.",
  ],
};

const STARTUP_ADS = [
  {
    startup: "DeployKit",
    tagline: "Zero-config deploys for side projects you'll abandon in 3 weeks.",
    cta: "deploykit.dev — YC W26",
  },
  {
    startup: "LintSoul",
    tagline: "AI that judges your code style harder than your senior engineer.",
    cta: "lintsoul.com — try free",
  },
  {
    startup: "MergePray",
    tagline: "CI/CD with built-in prayer circles for your failing tests.",
    cta: "mergepray.io — seed round open",
  },
  {
    startup: "TabHoarder Pro",
    tagline: "Organize your 847 browser tabs. Finally.",
    cta: "tabhoarder.pro — $9/mo",
  },
  {
    startup: "VibeCheck API",
    tagline: "Sentiment analysis for your commit messages.",
    cta: "vibecheck.dev — API keys free",
  },
  {
    startup: "StandupBot",
    tagline: "Automated standups for teams that hate standups.",
    cta: "standupbot.ai — 14-day trial",
  },
  {
    startup: "RubberDuck++",
    tagline: "A physical rubber duck with WiFi and opinions.",
    cta: "rubberduck.plus — pre-order now",
  },
  {
    startup: "ContextSwitch",
    tagline: "Ironically named tool that actually prevents context switching.",
    cta: "contextswitch.io — built by ex-Meta",
  },
];

const LOADING_MESSAGES = [
  "Claude is cooking… allegedly.",
  "Your AI agent is either fixing it or making it worse.",
  "Perfect time to earn tokens and stay in flow.",
  "Generating confidence… accuracy not guaranteed.",
  "One small wait for you, one giant hallucination for AI.",
  "Stacking tokens while the agent stacks bugs.",
  "Your app is being emotionally processed.",
  "The agent is thinking. You're earning. Everyone wins.",
  "Reticulating splines. Redeeming tokens.",
  "Compiling vibes and roughly 3 bugs.",
];

const TOKENS_PER_AD = 5;
const AD_ROTATION_MS = 8000;

// ---- State ----

let timerInterval = null;
let loadingMessageInterval = null;
let adInterval = null;
let seconds = 0;
let tokens = 0;
let isRunning = false;
let adsEnabled = true;

// ---- Elements ----

const primaryAction = document.getElementById("primaryAction");
const newTaskBtn = document.getElementById("newTaskBtn");
const timerEl = document.getElementById("timer");
const loadingMessageEl = document.getElementById("loadingMessage");
const taskArea = document.getElementById("taskArea");
const taskCategoryEl = document.getElementById("taskCategory");
const taskTextEl = document.getElementById("taskText");
const resultArea = document.getElementById("resultArea");
const resultTextEl = document.getElementById("resultText");
const copyResultBtn = document.getElementById("copyResultBtn");
const adsToggle = document.getElementById("adsToggle");
const tokenCountEl = document.getElementById("tokenCount");
const tokenDisplay = document.getElementById("tokenDisplay");
const adArea = document.getElementById("adArea");
const adStartupEl = document.getElementById("adStartup");
const adTaglineEl = document.getElementById("adTagline");
const adCtaEl = document.getElementById("adCta");

// ---- Helpers ----

function randomItem(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function pickRandomTask() {
  const categories = Object.keys(TASKS);
  const category = randomItem(categories);
  const task = randomItem(TASKS[category]);
  return { category, task };
}

function formatTime(totalSeconds) {
  const m = Math.floor(totalSeconds / 60).toString().padStart(2, "0");
  const s = (totalSeconds % 60).toString().padStart(2, "0");
  return `${m}:${s}`;
}

function showTask() {
  const { category, task } = pickRandomTask();
  taskCategoryEl.textContent = category;
  taskTextEl.textContent = task;
  taskArea.hidden = false;

  taskArea.style.animation = "none";
  requestAnimationFrame(() => {
    taskArea.style.animation = "";
  });
}

function rotateLoadingMessage() {
  loadingMessageEl.style.opacity = 0;
  setTimeout(() => {
    loadingMessageEl.textContent = randomItem(LOADING_MESSAGES);
    loadingMessageEl.style.opacity = 1;
  }, 200);
}

function showAd() {
  const ad = randomItem(STARTUP_ADS);
  adStartupEl.textContent = ad.startup;
  adTaglineEl.textContent = ad.tagline;
  adCtaEl.textContent = ad.cta;

  adArea.style.animation = "none";
  requestAnimationFrame(() => {
    adArea.style.animation = "";
  });

  if (isRunning && adsEnabled) {
    tokens += TOKENS_PER_AD;
    tokenCountEl.textContent = tokens;
    tokenCountEl.classList.add("token-bump");
    setTimeout(() => tokenCountEl.classList.remove("token-bump"), 400);
  }
}

function updateAdsVisibility() {
  adsEnabled = adsToggle.checked;
  if (isRunning) {
    adArea.hidden = !adsEnabled;
    if (adsEnabled && !adInterval) {
      showAd();
      adInterval = setInterval(showAd, AD_ROTATION_MS);
    } else if (!adsEnabled && adInterval) {
      clearInterval(adInterval);
      adInterval = null;
    }
  }
}

// ---- Session control ----

function startSession() {
  isRunning = true;
  seconds = 0;
  tokens = 0;
  adsEnabled = adsToggle.checked;
  timerEl.textContent = formatTime(seconds);
  tokenCountEl.textContent = "0";

  resultArea.hidden = true;
  adsToggle.disabled = true;

  timerInterval = setInterval(() => {
    seconds += 1;
    timerEl.textContent = formatTime(seconds);
  }, 1000);

  loadingMessageInterval = setInterval(rotateLoadingMessage, 2800);

  if (adsEnabled) {
    adArea.hidden = false;
    showAd();
    adInterval = setInterval(showAd, AD_ROTATION_MS);
  } else {
    adArea.hidden = true;
  }

  showTask();

  primaryAction.textContent = "End Session";
  newTaskBtn.hidden = false;
}

function endSession() {
  isRunning = false;

  clearInterval(timerInterval);
  clearInterval(loadingMessageInterval);
  clearInterval(adInterval);
  timerInterval = null;
  loadingMessageInterval = null;
  adInterval = null;

  taskArea.hidden = true;
  adArea.hidden = true;
  newTaskBtn.hidden = true;
  adsToggle.disabled = false;

  const savedTime = formatTime(seconds);
  let resultMsg = `You stayed in flow for ${savedTime}.`;
  if (tokens > 0) {
    resultMsg += ` Earned ${tokens} AI tokens — that's ~${tokens} extra prompts.`;
  } else {
    resultMsg += ` No doomscrolling. No context-switching.`;
  }
  resultTextEl.textContent = resultMsg;
  resultArea.hidden = false;

  loadingMessageEl.textContent = randomItem(LOADING_MESSAGES);

  primaryAction.textContent = "Start Waiting";
}

primaryAction.addEventListener("click", () => {
  if (isRunning) {
    endSession();
  } else {
    startSession();
  }
});

newTaskBtn.addEventListener("click", () => {
  showTask();
});

adsToggle.addEventListener("change", updateAdsVisibility);

copyResultBtn.addEventListener("click", () => {
  const savedTime = formatTime(seconds);
  let shareText = `I stayed productive for ${savedTime} while my AI was "thinking" 🧠`;
  if (tokens > 0) {
    shareText += `\nEarned ${tokens} AI tokens watching startup ads ⚡`;
  }
  shareText += `\n\nwhyl.ai`;

  navigator.clipboard.writeText(shareText).then(() => {
    const original = copyResultBtn.textContent;
    copyResultBtn.textContent = "Copied!";
    setTimeout(() => {
      copyResultBtn.textContent = original;
    }, 1800);
  });
});

// ---- Waitlist ----

const waitlistForm = document.getElementById("waitlistForm");
const waitlistMessage = document.getElementById("waitlistMessage");
const emailInput = document.getElementById("emailInput");
const companyInput = document.getElementById("companyInput");
const tabWatcher = document.getElementById("tabWatcher");
const tabAdvertiser = document.getElementById("tabAdvertiser");

let waitlistRole = "watcher";

function setWaitlistRole(role) {
  waitlistRole = role;
  tabWatcher.classList.toggle("active", role === "watcher");
  tabAdvertiser.classList.toggle("active", role === "advertiser");
  companyInput.hidden = role !== "advertiser";
  companyInput.required = role === "advertiser";
  if (role !== "advertiser") companyInput.value = "";
}

tabWatcher.addEventListener("click", () => setWaitlistRole("watcher"));
tabAdvertiser.addEventListener("click", () => setWaitlistRole("advertiser"));

waitlistForm.addEventListener("submit", (e) => {
  e.preventDefault();
  if (!emailInput.value) return;
  if (waitlistRole === "advertiser" && !companyInput.value) return;

  waitlistMessage.textContent =
    waitlistRole === "advertiser"
      ? "You're on the advertiser list. We'll reach out about putting your startup in front of coders."
      : "You're on the list. Start stacking tokens soon.";
  waitlistMessage.hidden = false;
  waitlistForm.querySelector("button").disabled = true;
  emailInput.disabled = true;
  companyInput.disabled = true;
  tabWatcher.disabled = true;
  tabAdvertiser.disabled = true;
});
