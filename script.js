// ---- Data ----

const TASKS = {
  "Next Prompt": [
    "Write the next prompt you'll send.",
    "Explain the bug in one sentence.",
    "What file should the AI touch next?",
    "What exactly should the AI fix?",
  ],
  "Bug Checklist": [
    "Check the console for errors.",
    "Test the thing you just changed.",
    "Look for one edge case.",
    "Check if the app still works on mobile.",
  ],
  "App Polish": [
    "Find one ugly loading state.",
    "Rewrite one confusing button label.",
    "Check one empty state.",
    "Make one screen feel less boring.",
  ],
  "Brain Dump": [
    "Write the next 3 things you need to do.",
    "What are you avoiding in this project?",
    "What broke last time?",
    "What should you test before shipping?",
  ],
  "Funny Break": [
    "Stare dramatically at the screen like you understand the codebase.",
    "Take one sip of coffee and pretend this is engineering.",
    "Whisper ‘please work’ to your laptop.",
    "Accept that Claude may be creating 4 new bugs.",
  ],
  "Founder Mode": [
    "Write the tweet you'll post when this actually works.",
    "Give this random function a 10-year vision.",
    "Rename this project something embarrassingly ambitious.",
    "Practice saying 'it's basically done' with a straight face.",
  ],
};

const LOADING_MESSAGES = [
  "Claude is cooking… allegedly.",
  "Your AI agent is either fixing it or making it worse.",
  "Perfect time to pretend you understand the codebase.",
  "Generating confidence… accuracy not guaranteed.",
  "One small wait for you, one giant hallucination for AI.",
  "Debugging vibes in progress.",
  "Your app is being emotionally processed.",
  "The agent is thinking. This is your personality now.",
  "Reticulating splines. Doubting life choices.",
  "Compiling vibes and roughly 3 bugs.",
];

// ---- State ----

let timerInterval = null;
let loadingMessageInterval = null;
let seconds = 0;
let isRunning = false;

// ---- Elements ----

const primaryAction = document.getElementById("primaryAction");
const newTaskBtn = document.getElementById("newTaskBtn");
const endSessionBtn = document.getElementById("endSessionBtn");
const secondaryControls = document.getElementById("secondaryControls");
const timerEl = document.getElementById("timer");
const loadingMessageEl = document.getElementById("loadingMessage");
const taskArea = document.getElementById("taskArea");
const taskCategoryEl = document.getElementById("taskCategory");
const taskTextEl = document.getElementById("taskText");
const resultArea = document.getElementById("resultArea");
const resultTextEl = document.getElementById("resultText");
const copyResultBtn = document.getElementById("copyResultBtn");

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

  // restart fade-in animation
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

// ---- Session control ----

function startSession() {
  isRunning = true;
  seconds = 0;
  timerEl.textContent = formatTime(seconds);

  resultArea.hidden = true;

  timerInterval = setInterval(() => {
    seconds += 1;
    timerEl.textContent = formatTime(seconds);
  }, 1000);

  loadingMessageInterval = setInterval(rotateLoadingMessage, 2800);

  showTask();

  primaryAction.hidden = true;
  secondaryControls.hidden = false;
}

function endSession() {
  isRunning = false;

  clearInterval(timerInterval);
  clearInterval(loadingMessageInterval);
  timerInterval = null;
  loadingMessageInterval = null;

  taskArea.hidden = true;
  secondaryControls.hidden = true;

  const savedTime = formatTime(seconds);
  resultTextEl.textContent = `You saved ${savedTime} from doomscrolling.`;
  resultArea.hidden = false;

  loadingMessageEl.textContent = randomItem(LOADING_MESSAGES);

  primaryAction.hidden = false;
  primaryAction.textContent = "Give Me Another Tiny Task";
}

primaryAction.addEventListener("click", startSession);

newTaskBtn.addEventListener("click", () => {
  showTask();
});

endSessionBtn.addEventListener("click", endSession);

copyResultBtn.addEventListener("click", () => {
  const savedTime = formatTime(seconds);
  const shareText = `I just saved ${savedTime} from doomscrolling while Claude was "thinking" 🧠\n\nwhileclaudethinks.com`;

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

waitlistForm.addEventListener("submit", (e) => {
  e.preventDefault();
  if (!emailInput.value) return;

  waitlistMessage.textContent = "You’re on the list. Claude would be proud.";
  waitlistMessage.hidden = false;
  waitlistForm.querySelector("button").disabled = true;
  emailInput.disabled = true;
});
