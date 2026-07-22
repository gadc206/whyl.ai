'use strict';

(function () {
  // Prevent double-boot when background re-injects into an already-running tab.
  if (window.__whylContentBooted) return;
  window.__whylContentBooted = true;

  const INITIAL_ACTIVATION_CHECK_MS = 500;
  const ACTIVATION_RETRY_MS = 1000;
  const SIGNALLESS_ACTIVATION_MS = 4000;
  const LONG_WAIT_FALLBACK_MS = 12000;
  const USER_SIGNAL_GAP_CANCEL_MS = 60000;
  const WAIT_STATS_KEY = 'whyl_wait_stats_v2';
  const STALE_OPEN_STREAM_MS = 15000;
  const POLL_MS = 50; // backup poll; stop-button observer hides faster
  const RESTORE_KEEPALIVE_MS = 30000;
  const INTERACTION_WINDOW_MS = 5 * 60 * 1000;
  const INTENT_TO_NETWORK_WINDOW_MS = 15000;
  const MID_STREAM_SKIP_PLATFORMS = new Set(['chatgpt']);

  // Network-level work detection, fed by net-probe.js running in the page's
  // MAIN world. Open streaming responses are the strongest cross-platform
  // signal that an AI is generating; chunk bursts cover websocket transports.
  let netOpenStreams = 0;
  let netChunkTimes = [];
  let netLastActivityAt = 0;
  let onNetActivity = () => {};

  document.addEventListener('__whyl_net', (event) => {
    const detail = event?.detail || {};
    if (typeof detail.openStreams === 'number') netOpenStreams = detail.openStreams;
    if (detail.kind === 'open' || detail.kind === 'chunk') netLastActivityAt = Date.now();
    if (detail.kind === 'chunk') {
      netChunkTimes.push(Date.now());
      if (netChunkTimes.length > 60) netChunkTimes = netChunkTimes.slice(-30);
    }
    if (detail.kind === 'open' || detail.kind === 'chunk') onNetActivity(detail);
  });

  function netWorking() {
    // Require a burst of chunks, not a lone ping, so sporadic background
    // websocket traffic (presence, analytics) does not count as AI work.
    const now = Date.now();
    if (netOpenStreams > 0 && now - netLastActivityAt < STALE_OPEN_STREAM_MS) return true;
    let recent = 0;
    for (let i = netChunkTimes.length - 1; i >= 0; i--) {
      if (now - netChunkTimes[i] < 2500) recent++;
      else break;
    }
    return recent >= 3;
  }

  // Fresh streaming only — used for hide decisions so short answers don't
  // keep the ad up for the full STALE_OPEN_STREAM_MS window.
  function netWorkingFresh(windowMs = 1800) {
    const now = Date.now();
    if (netOpenStreams > 0 && now - netLastActivityAt < windowMs) return true;
    let recent = 0;
    for (let i = netChunkTimes.length - 1; i >= 0; i--) {
      if (now - netChunkTimes[i] < windowMs) recent++;
      else break;
    }
    return recent >= 2;
  }

  // Answer is finished only when these appear without an active working signal.
  const DONE_STATUS_RE = /\b(finished|complete|completed|done|stopped|cancelled|canceled|response is ready)\b/i;

  // Any of these mean the model has not finished answering yet — ad window is open.
  const WORKING_STATUS_WORDS = [
    'Thinking',
    'Reasoning',
    'Generating',
    'Researching',
    'Searching',
    'Browsing',
    'Reading',
    'Analyzing',
    'Preparing',
    'Working',
    'In progress',
    'Deep research',
    'Deep researching',
    'Calibrating',
    'Planning',
    'Drafting',
    'Compiling',
    'Running',
    'Waiting',
    'Queued',
    'Processing',
    'Loading',
    'Summarizing',
    'Synthesizing',
    'Collecting',
    'Gathering',
    'Exploring',
    'Investigating',
    'Reviewing',
    'Writing',
    'Building',
    'Executing',
    'Using tools',
    'Calling tools',
    'Web search',
    'Searching the web',
  ];

  // Short slots: iconic brand ads. Long slots: Launch Gallery full videos.
  // Sorted short→long so wait-fit picks the longest real video that fits.
  const LAUNCH_CREATIVE_FILES = [
    { id: "brand-mercedes-4s", advertiserName: "Mercedes-Benz", advertiserUrl: "https://www.mercedes-benz.com", title: "3.8 seconds", slogan: "The best or nothing.", description: "YouTube bumper ad.", file: "media/mercedes-4s.mp4", contentType: 'video', creditsPerView: 1, durationSeconds: 4 },
    { id: "brand-coke-5s", advertiserName: "Coca-Cola", advertiserUrl: "https://www.coca-cola.com", title: "125 Years Campaign", slogan: "Taste the Feeling.", description: "YouTube bumper ad.", file: "media/coke-5s.mp4", contentType: 'video', creditsPerView: 1, durationSeconds: 5 },
    { id: "brand-cadbury-6s", advertiserName: "Cadbury", advertiserUrl: "https://www.cadbury.co.uk", title: "Cadbury Minis Family Gathering", slogan: "There's a glass and a half in everyone.", description: "YouTube bumper ad.", file: "media/cadbury-6s.mp4", contentType: 'video', creditsPerView: 1, durationSeconds: 6 },
    { id: "brand-gorilla-6s", advertiserName: "Gorilla Glue", advertiserUrl: "https://www.gorillatough.com", title: "Gorilla Clear Grip", slogan: "For the Toughest Jobs on Planet Earth.", description: "YouTube bumper ad.", file: "media/gorilla-6s.mp4", contentType: 'video', creditsPerView: 1, durationSeconds: 6 },
    { id: "brand-bravo-6s", advertiserName: "Bravo Apples", advertiserUrl: "https://bravoapples.com", title: "Bravo Apples", slogan: "Crisp. Juicy. Bravo.", description: "YouTube bumper ad.", file: "media/bravo-6s.mp4", contentType: 'video', creditsPerView: 1, durationSeconds: 6 },
    { id: "brand-sonic-6s", advertiserName: "Sonic Drive-In", advertiserUrl: "https://www.sonicdrivein.com", title: "Cookie Jar Shakes Marriage", slogan: "America's Drive-In.", description: "YouTube bumper ad.", file: "media/sonic-6s.mp4", contentType: 'video', creditsPerView: 1, durationSeconds: 6 },
    { id: "brand-deadpool-6s", advertiserName: "20th Century Studios", advertiserUrl: "https://www.20thcenturystudios.com", title: "Deadpool 2 Bumper", slogan: "Maximum effort.", description: "YouTube bumper ad.", file: "media/deadpool-6s.mp4", contentType: 'video', creditsPerView: 1, durationSeconds: 6 },
    { id: "brand-oreo-6s", advertiserName: "Oreo", advertiserUrl: "https://www.oreo.com", title: "Oreo Ice Cream", slogan: "Milk's favorite cookie.", description: "YouTube bumper ad.", file: "media/oreo-6s.mp4", contentType: 'video', creditsPerView: 1, durationSeconds: 6 },
    { id: "brand-papajohns-6s", advertiserName: "Papa Johns", advertiserUrl: "https://www.papajohns.com", title: "The Hot Dog Pizza", slogan: "Better Ingredients. Better Pizza.", description: "YouTube bumper ad.", file: "media/papajohns-6s.mp4", contentType: 'video', creditsPerView: 1, durationSeconds: 6 },
    { id: "brand-very-6s", advertiserName: "Very", advertiserUrl: "https://www.very.co.uk", title: "Find their Gift", slogan: "Very good.", description: "YouTube bumper ad.", file: "media/very-6s.mp4", contentType: 'video', creditsPerView: 1, durationSeconds: 6 },
    { id: "brand-duracell-6s", advertiserName: "Duracell", advertiserUrl: "https://www.duracell.com", title: "Power On", slogan: "Trusted Everywhere.", description: "YouTube bumper ad.", file: "media/duracell-6s.mp4", contentType: 'video', creditsPerView: 1, durationSeconds: 6 },
    { id: "brand-clearblue-6s", advertiserName: "Clearblue", advertiserUrl: "https://www.clearblue.com", title: "Clear results", slogan: "So clear. So sure.", description: "YouTube bumper ad.", file: "media/clearblue-6s.mp4", contentType: 'video', creditsPerView: 1, durationSeconds: 6 },
    { id: "brand-samsung-6s", advertiserName: "Samsung", advertiserUrl: "https://www.samsung.com", title: "Galaxy S8 Pre-book", slogan: "Do What You Can't.", description: "YouTube bumper ad.", file: "media/samsung-6s.mp4", contentType: 'video', creditsPerView: 1, durationSeconds: 6 },
    { id: "brand-dettol-6s", advertiserName: "Dettol", advertiserUrl: "https://www.dettol.co.uk", title: "Floor wipes", slogan: "Protects what matters.", description: "YouTube bumper ad.", file: "media/dettol-6s.mp4", contentType: 'video', creditsPerView: 1, durationSeconds: 6 },
    { id: "brand-nike-6s", advertiserName: "Nike", advertiserUrl: "https://www.nike.com", title: "Nike Training Club", slogan: "Just Do It.", description: "YouTube bumper ad.", file: "media/nike-6s.mp4", contentType: 'video', creditsPerView: 1, durationSeconds: 6 },
    { id: "brand-tacobell-6s", advertiserName: "Taco Bell", advertiserUrl: "https://www.tacobell.com", title: "Naked Chicken Taco", slogan: "Live Más.", description: "YouTube bumper ad.", file: "media/tacobell-6s.mp4", contentType: 'video', creditsPerView: 1, durationSeconds: 6 },
    { id: "brand-maltesers-6s", advertiserName: "Maltesers", advertiserUrl: "https://www.maltesers.co.uk", title: "Buttons Tiddlywinks", slogan: "The lighter way to enjoy chocolate.", description: "YouTube bumper ad.", file: "media/maltesers-6s.mp4", contentType: 'video', creditsPerView: 1, durationSeconds: 6 },
    { id: "brand-apple-iphone17e", advertiserName: "Apple", advertiserUrl: "https://www.apple.com", title: "Meet iPhone 17e", slogan: "A whole lot of battery. For a lot less.", description: "Iconic brand spot.", file: "media/apple-iphone17e.mp4", contentType: 'video', creditsPerView: 1, durationSeconds: 11 },
    { id: "brand-nike-shorts", advertiserName: "Nike", advertiserUrl: "https://www.nike.com", title: "Just Do It", slogan: "Just Do It.", description: "Iconic brand spot.", file: "media/nike-shorts.mp4", contentType: 'video', creditsPerView: 1, durationSeconds: 14 },
    { id: "brand-coke-shorts", advertiserName: "Coca-Cola", advertiserUrl: "https://www.coca-cola.com", title: "Coca-Cola Short", slogan: "Taste the Feeling.", description: "Iconic brand spot.", file: "media/coke-shorts.mp4", contentType: 'video', creditsPerView: 1, durationSeconds: 15 },
    { id: "brand-geico-elevator", advertiserName: "GEICO", advertiserUrl: "https://www.geico.com", title: "GEICO Unskippable Elevator", slogan: "15 minutes could save you 15% or more.", description: "Iconic brand spot.", file: "media/geico-elevator.mp4", contentType: 'video', creditsPerView: 1, durationSeconds: 15 },
    { id: "brand-geico-family", advertiserName: "GEICO", advertiserUrl: "https://www.geico.com", title: "GEICO Unskippable Family Dinner", slogan: "15 minutes could save you 15% or more.", description: "Iconic brand spot.", file: "media/geico-family.mp4", contentType: 'video', creditsPerView: 1, durationSeconds: 15 },
    { id: "brand-mtn-dew-shorts", advertiserName: "Mountain Dew", advertiserUrl: "https://www.mountaindew.com", title: "Mountain Dew NBA", slogan: "Do the Dew.", description: "Iconic brand spot.", file: "media/mtn-dew-shorts.mp4", contentType: 'video', creditsPerView: 1, durationSeconds: 15 },
    { id: "brand-apple-ceramic", advertiserName: "Apple", advertiserUrl: "https://www.apple.com", title: "iPhone 17 Ceramic Shield", slogan: "More durable than ever.", description: "Iconic brand spot.", file: "media/apple-ceramic.mp4", contentType: 'video', creditsPerView: 2, durationSeconds: 20 },
    { id: "lg-3jane", advertiserName: "3Jane", advertiserUrl: "https://3jane.xyz", title: "3Jane is now open to the public", slogan: "Open to the public.", description: "Launch Gallery creative.", file: "media/3jane.mp4", contentType: 'video', creditsPerView: 3, durationSeconds: 28 },
    { id: "brand-coke-share", advertiserName: "Coca-Cola", advertiserUrl: "https://www.coca-cola.com", title: "Share a Coke", slogan: "Taste the Feeling.", description: "Iconic brand spot.", file: "media/coke-share.mp4", contentType: 'video', creditsPerView: 3, durationSeconds: 28 },
    { id: "lg-factory", advertiserName: "Factory", advertiserUrl: "https://factory.ai", title: "Factory 2.0", slogan: "From coding agents to software factories.", description: "Launch Gallery creative.", file: "media/factory.mp4", contentType: 'video', creditsPerView: 3, durationSeconds: 30 },
    { id: "brand-geico-gecko", advertiserName: "GEICO", advertiserUrl: "https://www.geico.com", title: "GEICO Gecko Golf", slogan: "15 minutes could save you 15% or more.", description: "Iconic brand spot.", file: "media/geico-gecko-shorts.mp4", contentType: 'video', creditsPerView: 3, durationSeconds: 30 },
    { id: "brand-geico-highfive", advertiserName: "GEICO", advertiserUrl: "https://www.geico.com", title: "GEICO Unskippable High Five", slogan: "15 minutes could save you 15% or more.", description: "Iconic brand spot.", file: "media/geico-highfive.mp4", contentType: 'video', creditsPerView: 3, durationSeconds: 30 },
    { id: "brand-mtn-dew-puppy", advertiserName: "Mountain Dew", advertiserUrl: "https://www.mountaindew.com", title: "Puppy Monkey Baby", slogan: "Do the Dew.", description: "Iconic brand spot.", file: "media/mtn-dew-puppy.mp4", contentType: 'video', creditsPerView: 3, durationSeconds: 30 },
    { id: "lg-switchlabs", advertiserName: "TheSwitchLabs", advertiserUrl: "https://theswitchlabs.com", title: "You Do The Building. We Handle The Distribution.", slogan: "You build. We distribute.", description: "Launch Gallery creative.", file: "media/switchlabs.mp4", contentType: 'video', creditsPerView: 5, durationSeconds: 37 },
    { id: "lg-collective", advertiserName: "The Collective", advertiserUrl: "https://launchgallery.video/video/the-collective-launching-the-collective-platform-for-young-founders-builders/", title: "Launching The Collective", slogan: "Platform for young founders & builders.", description: "Launch Gallery creative.", file: "media/collective.mp4", contentType: 'video', creditsPerView: 5, durationSeconds: 38 },
    { id: "lg-lightwork", advertiserName: "Lightwork", advertiserUrl: "https://lightwork.ai", title: "Introducing Lightwork", slogan: "Work that moves itself.", description: "Launch Gallery creative.", file: "media/lightwork.mp4", contentType: 'video', creditsPerView: 5, durationSeconds: 39 },
    { id: "lg-pear", advertiserName: "Pear", advertiserUrl: "https://pear.trade", title: "One account. Every market.", slogan: "One account. Every market.", description: "Launch Gallery creative.", file: "media/pear.mp4", contentType: 'video', creditsPerView: 5, durationSeconds: 39 },
    { id: "lg-crowdreply", advertiserName: "CrowdReply", advertiserUrl: "https://crowdreply.io", title: "Searchmaxxing", slogan: "Be visible in AI answers.", description: "Launch Gallery creative.", file: "media/crowdreply.mp4", contentType: 'video', creditsPerView: 8, durationSeconds: 47 },
    { id: "lg-stitch", advertiserName: "Stitch", advertiserUrl: "https://launchgallery.video/video/stitch-stitch-pressure-free-mini-vlog-app-for-shy-introverts/", title: "Stitch", slogan: "Pressure-free mini-vlogs for shy introverts.", description: "Launch Gallery creative.", file: "media/stitch.mp4", contentType: 'video', creditsPerView: 8, durationSeconds: 47 },
    { id: "lg-kaito", advertiserName: "Kaito AI", advertiserUrl: "https://kaito.ai", title: "Influence mapping to 1M users", slogan: "Expanding influence mapping to 1M users.", description: "Launch Gallery creative.", file: "media/kaito.mp4", contentType: 'video', creditsPerView: 8, durationSeconds: 50 },
    { id: "lg-result", advertiserName: "Result", advertiserUrl: "https://result.computer", title: "Result: OS for Starting a Business", slogan: "OS for starting a business.", description: "Launch Gallery creative.", file: "media/result.mp4", contentType: 'video', creditsPerView: 12, durationSeconds: 55 },
    { id: "brand-nike-whydoit", advertiserName: "Nike", advertiserUrl: "https://www.nike.com", title: "WHY DO IT?", slogan: "Just Do It.", description: "Iconic brand spot.", file: "media/nike-whydoit.mp4", contentType: 'video', creditsPerView: 12, durationSeconds: 60 },
    { id: "lg-synclabs", advertiserName: "Sync Labs", advertiserUrl: "https://synclabs.so", title: "Lipsync Technology Now in Production", slogan: "Lipsync in production to unlock stories.", description: "Launch Gallery creative.", file: "media/synclabs.mp4", contentType: 'video', creditsPerView: 12, durationSeconds: 60 },
    { id: "lg-folk", advertiserName: "Folk", advertiserUrl: "https://folk.app", title: "Introducing Geolocation for Folk", slogan: "Geolocation for Folk.", description: "Launch Gallery creative.", file: "media/folk.mp4", contentType: 'video', creditsPerView: 12, durationSeconds: 62 },
    { id: "lg-shift", advertiserName: "Shift", advertiserUrl: "https://joinshift.com", title: "Free NYC Apartment Cleaning", slogan: "Robotics training data from real homes.", description: "Launch Gallery creative.", file: "media/shift.mp4", contentType: 'video', creditsPerView: 12, durationSeconds: 63 },
    { id: "lg-eden", advertiserName: "Eden-1", advertiserUrl: "https://launchgallery.video/video/eden-1-meet-eden-1-the-era-of-human-labour-is-coming-to-a-magnificent-end/", title: "Meet Eden-1", slogan: "The era of human labour is coming to a magnificent end.", description: "Launch Gallery creative.", file: "media/eden.mp4", contentType: 'video', creditsPerView: 16, durationSeconds: 69 },
    { id: "lg-locus", advertiserName: "Locus", advertiserUrl: "https://paywithlocus.com", title: "Start a Business Without Knowing How to Build One", slogan: "Start a business without knowing how to build one.", description: "Launch Gallery creative.", file: "media/locus.mp4", contentType: 'video', creditsPerView: 16, durationSeconds: 77 },
    { id: "lg-boardy", advertiserName: "Boardy", advertiserUrl: "https://boardy.ai", title: "Boardy Pro", slogan: "AI that makes deals happen.", description: "Launch Gallery creative.", file: "media/boardy.mp4", contentType: 'video', creditsPerView: 20, durationSeconds: 90 },
    { id: "lg-kosh", advertiserName: "Kosh", advertiserUrl: "https://kosh.money", title: "KOSH: USD Account Built for Asia", slogan: "USD account built for Asia.", description: "Launch Gallery creative.", file: "media/kosh.mp4", contentType: 'video', creditsPerView: 20, durationSeconds: 105 },
  ];

  function sloganForAd(ad) {
    if (!ad) return '';
    const custom = String(ad.slogan || '').trim();
    if (custom) return custom;
    const title = String(ad.title || '').trim();
    return title || '';
  }

  function companyForAd(ad) {
    if (!ad) return '';
    return String(ad.advertiserName || '').trim();
  }

  function resolveCreative(entry, preferredSeconds = null) {
    return {
      ...entry,
      videoUrl: chrome.runtime.getURL(entry.file),
      thumbnailUrl: '',
      slogan: entry.slogan || sloganForAd(entry),
      // Keep the clip's real length — don't stretch a 2s file into a 15s timer.
      durationSeconds: preferredSeconds != null
        ? Math.min(preferredSeconds, entry.durationSeconds)
        : entry.durationSeconds,
    };
  }

  const LAUNCH_CREATIVES = LAUNCH_CREATIVE_FILES.map((entry) => resolveCreative(entry));
  const DEMO_AD = LAUNCH_CREATIVES[0];
  const SHORTEST_CREATIVE_SEC = Math.min(...LAUNCH_CREATIVE_FILES.map((e) => e.durationSeconds));

  // Pick the creative whose real file length equals the fitted seconds.
  function pickLaunchCreative(preferredSeconds = 15) {
    const target = Math.max(0, preferredSeconds || 0);
    if (target < SHORTEST_CREATIVE_SEC) return null;

    const fitting = LAUNCH_CREATIVE_FILES
      .filter((entry) => entry.durationSeconds <= target)
      .sort((a, b) => b.durationSeconds - a.durationSeconds);

    if (!fitting.length) return null;

    // Prefer exact match to the fitted wait; else longest that still fits.
    const exact = fitting.filter((e) => e.durationSeconds === target);
    const pool = exact.length ? exact : fitting.filter((e) => e.durationSeconds === fitting[0].durationSeconds);
    const pick = pool[Math.floor(Math.random() * pool.length)] || fitting[0];
    // durationSeconds stays the FILE length — never stretch a short clip.
    return resolveCreative(pick, pick.durationSeconds);
  }

  // Always force a bundled local MP4. Never trust server/CDN media (blank players).
  function ensurePlayableAd(ad, preferredSeconds = 15) {
    const fallback = pickLaunchCreative(preferredSeconds);
    if (!fallback) return null;
    if (!ad || ad.error) return fallback;
    const credits = Number(ad.creditsPerView) > 0
      ? Number(ad.creditsPerView)
      : (fallback.creditsPerView || 1);
    return {
      ...fallback,
      id: fallback.id,
      advertiserName: ad.advertiserName || fallback.advertiserName,
      advertiserUrl: ad.advertiserUrl || fallback.advertiserUrl,
      title: ad.title || fallback.title,
      slogan: ad.slogan || fallback.slogan || sloganForAd(fallback),
      description: fallback.description,
      file: fallback.file,
      videoUrl: fallback.videoUrl,
      thumbnailUrl: '',
      contentType: 'video',
      creditsPerView: credits,
      durationSeconds: fallback.durationSeconds,
    };
  }

  // Pick another local creative if the current file fails to decode/play.
  function pickAlternateCreative(failedId, preferredSeconds = 15) {
    const target = Math.max(SHORTEST_CREATIVE_SEC, preferredSeconds || SHORTEST_CREATIVE_SEC);
    const pool = LAUNCH_CREATIVE_FILES
      .filter((entry) => entry.id !== failedId && entry.durationSeconds <= target + 2)
      .sort((a, b) => Math.abs(a.durationSeconds - target) - Math.abs(b.durationSeconds - target));
    const pick = pool[0] || LAUNCH_CREATIVE_FILES.find((e) => e.id !== failedId);
    return pick ? resolveCreative(pick, pick.durationSeconds) : null;
  }

  // Per-prompt wait prediction: TTFT(prefill) + decode(output/TPS) + live mode penalty.
  // Calibrated so ~1s chat replies skip ads; only real waits fit a creative.
  // Live deep-research / tools still inflate via detectLiveWaitMode — never keyword-blacklist.
  const PLATFORM_WAIT_DEFAULTS = {
    // Chat models stream ~35–60 tok/s; short answers are small. Conservative under-estimate.
    chatgpt: { ttftMs: 450, msPerInputToken: 0.25, tokensPerSecond: 38, baseOutput: 32, promptFactor: 2.0, toolPenaltyMs: 0 },
    // Claude long answers often run longer than ChatGPT — bias estimate up so ads fill the wait.
    claude: { ttftMs: 700, msPerInputToken: 0.35, tokensPerSecond: 28, baseOutput: 80, promptFactor: 3.2, toolPenaltyMs: 0 },
    gemini: { ttftMs: 400, msPerInputToken: 0.22, tokensPerSecond: 42, baseOutput: 30, promptFactor: 1.9, toolPenaltyMs: 0 },
    cursor: { ttftMs: 900, msPerInputToken: 0.3, tokensPerSecond: 28, baseOutput: 180, promptFactor: 2.4, toolPenaltyMs: 6000 },
    replit: { ttftMs: 1000, msPerInputToken: 0.3, tokensPerSecond: 26, baseOutput: 160, promptFactor: 2.2, toolPenaltyMs: 5000 },
    grok: { ttftMs: 450, msPerInputToken: 0.22, tokensPerSecond: 38, baseOutput: 32, promptFactor: 2.0, toolPenaltyMs: 0 },
    manus: { ttftMs: 1400, msPerInputToken: 0.35, tokensPerSecond: 18, baseOutput: 360, promptFactor: 2.8, toolPenaltyMs: 15000 },
    lovable: { ttftMs: 1000, msPerInputToken: 0.3, tokensPerSecond: 24, baseOutput: 200, promptFactor: 2.4, toolPenaltyMs: 8000 },
    default: { ttftMs: 500, msPerInputToken: 0.25, tokensPerSecond: 38, baseOutput: 32, promptFactor: 2.0, toolPenaltyMs: 800 },
  };

  const DONE_HIDE_GRACE_MS = 0; // hide the instant stop disappears
  const PREDICTION_END_BUFFER_MS = 500;
  const HARD_SESSION_CAP_MS = 180000;
  // Only show an ad when remaining predicted wait can fit a real creative.
  const MIN_AD_MS = 4000; // shortest native creative is 4s
  // Under-estimate remaining wait so the chosen clip finishes before the answer.
  // Ads should fit inside the wait — never overrun it.
  const AD_FIT_SAFETY = 0.92;
  // After a prompt's wait is closed, never auto-reopen until the user sends again.

  // Soft cues for expected output size (affect estimate only — never force skip/show).
  const LONG_OUTPUT_CUE_RE = /\b(essay|detailed|thorough|comprehensive|in[- ]depth|step[- ]by[- ]step|explain|write|implement|build|create|research|analyze|compare|summarize|list|code|script|function|app|website)\b/i;
  const WORD_COUNT_CUE_RE = /\b(\d{3,5})\s*(words?|pages?|paragraphs?)\b/i;

  const PLATFORM_ADAPTERS = [
    createAdapter({
      id: 'chatgpt',
      hosts: ['chatgpt.com', 'chat.openai.com'],
      sendSelectors: [
        'button[data-testid="send-button"]',
        'button[data-testid="composer-send-button"]',
        'button[aria-label="Send prompt"]',
        'button[aria-label="Send message"]',
        'button[aria-label*="Send"]',
        'button[type="submit"]',
        'form button[type="submit"]',
      ],
      composerSelectors: [
        '#prompt-textarea',
        '[data-testid="composer-input"]',
        '[contenteditable="true"]',
        'div[role="textbox"][contenteditable="true"]',
        'textarea',
      ],
      thinkingSelectors: [
        'button[data-testid="stop-button"]',
        'button[aria-label*="Stop generating"]',
        'button[aria-label*="Stop streaming"]',
        'button[aria-label="Stop"]',
        'button[data-testid*="stop-button"]',
      ],
      thinkingIndicatorSelectors: [
        'button[data-testid="stop-button"]',
        'button[aria-label*="Stop generating"]',
        'button[aria-label*="Stop streaming"]',
        '[data-testid*="deep-research"]',
      ],
      thinkingText: ['Thinking', 'Reasoning', 'Generating', 'Calibrating'],
      liveText: WORKING_STATUS_WORDS,
      controlText: ['Stop generating', 'Stop streaming', 'Stop response', 'Stop research'],
      assistantSelectors: ['[data-message-author-role="assistant"]', '[data-testid*="conversation-turn"]'],
      skipActivationAfterFirstToken: true,
      requireStatusTextForActivation: true,
      useNetworkSignal: false,
      allowGenerationElementAsThinkingAnchor: true,
      // ChatGPT deep research / searching often uses status copy that is not "Thinking".
      useGlobalLiveStatus: true,
      useGenericProgress: false,
    }),
    createAdapter({
      id: 'claude',
      hosts: ['claude.ai'],
      sendSelectors: [
        'button[aria-label*="Send"]',
        'button[data-testid*="send"]',
        'button[type="submit"]',
        'form button[type="submit"]',
      ],
      composerSelectors: [
        '[data-testid*="chat-input"]',
        '[data-testid*="composer"]',
        'div[contenteditable="true"]',
        'textarea',
      ],
      thinkingSelectors: [
        'button[aria-label*="Stop"]',
        'button[title*="Stop"]',
        '[data-testid*="stop"]',
        '[aria-label*="Stop generating"]',
        '[data-is-streaming="true"]',
        '[aria-busy="true"]',
        '[class*="streaming"]',
      ],
      thinkingIndicatorSelectors: [
        '[data-is-streaming="true"]',
      ],
      thinkingText: ['Thinking', 'Generating', 'Claude is responding', 'Calibrating'],
      liveText: ['Claude is thinking', ...WORKING_STATUS_WORDS],
      controlText: ['Stop', 'Stop generating', 'Stop response', 'Cancel'],
      assistantSelectors: ['[data-is-streaming="true"]', '[data-testid*="message"]'],
      excludeAssistantContentForThinkingAnchor: false,
      allowGenerationElementAsThinkingAnchor: true,
      useNetworkSignal: false,
      useGlobalLiveStatus: true,
      useGenericProgress: true,
    }),
    createAdapter({
      id: 'gemini',
      hosts: ['gemini.google.com'],
      sendSelectors: [
        'button[aria-label*="Send"]',
        'button[aria-label*="Submit"]',
      ],
      composerSelectors: [
        'div[contenteditable="true"]',
        'rich-textarea',
        'textarea',
      ],
      thinkingSelectors: [
        '[aria-label*="Stop"]',
        '[class*="loading"]',
        '[class*="spinner"]',
        '[class*="mat-progress"]',
      ],
      thinkingText: ['Generating', 'Thinking', 'Calibrating'],
      liveText: WORKING_STATUS_WORDS,
      assistantSelectors: ['message-content', '[class*="response"]'],
    }),
    createAdapter({
      id: 'cursor',
      hosts: ['cursor.com'],
      sendSelectors: ['button[aria-label*="Send"]', 'form button[type="submit"]'],
      composerSelectors: ['textarea', 'div[contenteditable="true"]'],
      thinkingSelectors: ['[class*="loading"]', '[class*="spinner"]', '[class*="generating"]'],
      thinkingText: ['Thinking', 'Generating', 'Reasoning', 'Calibrating'],
      liveText: WORKING_STATUS_WORDS,
      assistantSelectors: ['main', '[role="main"]'],
    }),
    createAdapter({
      id: 'replit',
      hosts: ['replit.com'],
      sendSelectors: ['button[aria-label*="Send"]', 'form button[type="submit"]'],
      composerSelectors: ['textarea', 'div[contenteditable="true"]'],
      thinkingSelectors: ['[class*="loading"]', '[class*="spinner"]', '[class*="generating"]'],
      thinkingText: ['Thinking', 'Generating', 'Working', 'Calibrating'],
      liveText: WORKING_STATUS_WORDS,
      assistantSelectors: ['main', '[role="main"]'],
    }),
    createAdapter({
      id: 'grok',
      hosts: ['grok.com', 'x.com'],
      sendSelectors: ['button[aria-label*="Send"]', 'button[type="submit"]', 'form button[type="submit"]'],
      composerSelectors: ['textarea', 'div[contenteditable="true"]'],
      thinkingSelectors: [
        'button[aria-label*="Stop"]',
        '[aria-busy="true"]',
        '[class*="streaming"]',
        '[class*="generating"]',
        '[role="progressbar"]',
      ],
      thinkingText: ['Thinking', 'Generating', 'Calibrating'],
      liveText: WORKING_STATUS_WORDS,
      controlText: ['Stop', 'Stop generating'],
      assistantSelectors: ['main', '[role="main"]'],
    }),
    createAdapter({
      id: 'manus',
      hosts: ['manus.im'],
      sendSelectors: ['button[aria-label*="Send"]', 'button[type="submit"]', 'form button[type="submit"]'],
      composerSelectors: ['textarea', 'div[contenteditable="true"]'],
      thinkingSelectors: [
        'button[aria-label*="Stop"]',
        '[aria-busy="true"]',
        '[class*="streaming"]',
        '[class*="generating"]',
        '[class*="running"]',
        '[role="progressbar"]',
      ],
      thinkingText: ['Thinking', 'Working', 'Executing', 'Running', 'Calibrating'],
      liveText: WORKING_STATUS_WORDS,
      controlText: ['Stop', 'Stop generating'],
      assistantSelectors: ['main', '[role="main"]'],
    }),
    createAdapter({
      id: 'lovable',
      hosts: ['lovable.dev'],
      sendSelectors: ['button[aria-label*="Send"]', 'form button[type="submit"]'],
      composerSelectors: ['textarea', 'div[contenteditable="true"]'],
      thinkingSelectors: ['[class*="loading"]', '[class*="spinner"]', '[class*="generating"]'],
      thinkingText: ['Thinking', 'Generating', 'Building', 'Calibrating'],
      liveText: WORKING_STATUS_WORDS,
      assistantSelectors: ['main', '[role="main"]'],
    }),
  ];

  // Any AI site the extension is injected on but has no dedicated adapter for
  // falls back to generic detection: network streaming plus common stop/busy UI.
  const adapter =
    PLATFORM_ADAPTERS.find((candidate) => candidate.matches(location.hostname)) ||
    createAdapter({
      id: location.hostname.replace(/^www\./, ''),
      hosts: [location.hostname],
      sendSelectors: ['button[aria-label*="Send"]', 'button[type="submit"]', 'form button[type="submit"]'],
      composerSelectors: ['textarea', 'div[contenteditable="true"]'],
      thinkingSelectors: [
        'button[aria-label*="Stop"]',
        '[aria-busy="true"]',
        '[class*="streaming"]',
        '[class*="generating"]',
        '[role="progressbar"]',
      ],
      thinkingText: ['Thinking', 'Generating', 'Working', ...WORKING_STATUS_WORDS],
      liveText: WORKING_STATUS_WORDS,
      controlText: ['Stop', 'Stop generating'],
      assistantSelectors: ['main', '[role="main"]'],
    });

  function createAdapter(config) {
    return {
      id: config.id,
      matches: (hostname) => config.hosts.some((host) => hostname === host || hostname.endsWith(`.${host}`)),
      isSendTarget: (target) => matchesAny(target, config.sendSelectors),
      isComposerTarget: (target) => {
        const composer = findVisible(config.composerSelectors);
        return !!(composer && (composer === target || composer.contains(target)));
      },
      getComposer: () => findVisible(config.composerSelectors),
      getAnchor: () =>
        getLastMatching(config.assistantSelectors) ||
        findVisible(config.composerSelectors) ||
        document.querySelector('main') ||
        document.body,
      getLatestAssistantText: () => {
        const el = getLastMatching(config.assistantSelectors);
        if (!el || el === document.body) return '';
        return String(el.innerText || el.textContent || '')
          .replace(/\s+/g, ' ')
          .trim()
          .slice(0, 20000);
      },
      getThinkingAnchor: () => getVisibleThinkingElement(config),
      isThinking: () => {
        return (config.useNetworkSignal === false ? false : netWorking()) ||
          hasVisibleGenerationSignal(config);
      },
      hasGenerationSignal: () =>
        (config.useNetworkSignal === false ? false : netWorking()) ||
        hasVisibleGenerationSignal(config),
      hasVisibleGenerationSignal: () => hasVisibleGenerationSignal(config),
      hasVisibleThinkingIndicator: () => !!getVisibleThinkingElement(config),
      hasVisibleStatusText: () => hasVisibleStatusText(config),
      shouldSkipActivationAfterFirstToken: () =>
        config.skipActivationAfterFirstToken || MID_STREAM_SKIP_PLATFORMS.has(config.id),
      requiresStatusTextForActivation: () => !!config.requireStatusTextForActivation,
      isDone: () => !hasVisibleGenerationSignal(config),
    };
  }

  function hasVisibleStatusText(config) {
    return !!findVisibleLiveText(config.liveText || [], config.useGlobalLiveStatus !== false) ||
      (config.useGlobalLiveStatus === false ? false : !!findGlobalLiveStatusText());
  }

  function hasVisibleGenerationSignal(config) {
    return !!findVisible(config.thinkingSelectors) ||
      !!findVisibleControlText(config.controlText || []) ||
      hasVisibleStatusText(config) ||
      !!findDeepResearchPlan() ||
      (config.useGenericProgress === false ? false : !!findActiveProgressBar()) ||
      (config.useGenericProgress === false ? false : !!findStopNearProgress());
  }

  function getVisibleGenerationElement(config, options = {}) {
    const excludeAssistantContent = options.excludeAssistantContent ?? true;
    return findVisibleLiveText(config.liveText || [], config.useGlobalLiveStatus !== false, excludeAssistantContent) ||
      (config.useGlobalLiveStatus === false ? null : findGlobalLiveStatusText()) ||
      findDeepResearchPlan() ||
      (config.useGenericProgress === false ? null : findActiveProgressBar()) ||
      (config.useGenericProgress === false ? null : findStopNearProgress()) ||
      findVisible(config.thinkingSelectors) ||
      findVisibleControlText(config.controlText || []);
  }

  function getVisibleThinkingElement(config) {
    const excludeAssistantContent = config.excludeAssistantContentForThinkingAnchor !== false;
    return findVisibleLiveText(config.liveText || [], config.useGlobalLiveStatus !== false, excludeAssistantContent) ||
      (config.useGlobalLiveStatus === false ? null : findGlobalLiveStatusText()) ||
      findDeepResearchPlan() ||
      findVisible(config.thinkingIndicatorSelectors || []) ||
      (config.useGenericProgress === false ? null : findActiveProgressBar()) ||
      (config.allowGenerationElementAsThinkingAnchor
        ? getVisibleGenerationElement(config, { excludeAssistantContent })
        : null);
  }

  function matchesAny(target, selectors) {
    if (!target?.closest) return false;
    return selectors.some((selector) => target.matches?.(selector) || target.closest(selector));
  }

  function findVisible(selectors) {
    for (const selector of selectors) {
      for (const el of document.querySelectorAll(selector)) {
        if (isVisible(el)) return el;
      }
    }
    return null;
  }

  function findVisibleControlText(labels) {
    if (!labels.length) return null;
    const controls = document.querySelectorAll('button, [role="button"]');
    for (const el of controls) {
      if (!isVisible(el)) continue;
      const text = `${el.getAttribute('aria-label') || ''} ${el.getAttribute('title') || ''} ${el.textContent || ''}`;
      if (labels.some((label) => new RegExp(`\\b${escapeRegExp(label)}\\b`, 'i').test(text))) return el;
    }
    return null;
  }

  function getControlText(target) {
    const control = target?.closest?.('button, [role="button"]');
    if (!control || !isVisible(control)) return '';
    return `${control.getAttribute('aria-label') || ''} ${control.getAttribute('title') || ''} ${control.textContent || ''}`;
  }

  function isNewChatAction(target) {
    return /\b(new chat|new conversation|new thread|new prompt)\b/i.test(getControlText(target));
  }

  function isLikelyWaitAction(target) {
    const text = getControlText(target);
    if (!text || isNewChatAction(target)) return false;
    return /\b(start|continue|update|run|research|search|submit|go|begin|confirm)\b/i.test(text);
  }

  function getElementText(el) {
    if (!el) return '';
    if (typeof el.value === 'string') return el.value;
    return el.innerText || el.textContent || '';
  }

  function estimateTokensFromText(text) {
    const value = String(text || '').replace(/\s+/g, ' ').trim();
    if (!value) return 0;
    return Math.max(1, Math.ceil(value.length / 4));
  }

  function estimateCurrentPromptTokens(platformAdapter) {
    return estimateTokensFromText(getElementText(platformAdapter.getComposer()));
  }

  function getCurrentPromptText(platformAdapter) {
    return String(getElementText(platformAdapter.getComposer()) || '').replace(/\s+/g, ' ').trim();
  }

  // Live mode: ONLY real deep-research / tool UIs inflate wait.
  // Never treat normal "Thinking" as tools — that caused +28s fake waits on "hi".
  function detectLiveWaitMode(platform) {
    if (findDeepResearchPlan()) {
      return {
        kind: 'deep_research',
        toolPenaltyMs: platform === 'chatgpt' || platform === 'claude' ? 90000 : 60000,
        decodeMultiplier: 1.4,
      };
    }
    if (hasVisibleStatusText({
      liveText: [
        'Researching', 'Searching', 'Browsing', 'Deep research',
        'Using tools', 'Reading sources', 'Collecting sources', 'Web search',
      ],
      useGlobalLiveStatus: false,
    })) {
      return { kind: 'tools_search', toolPenaltyMs: 28000, decodeMultiplier: 1.15 };
    }
    if (hasStopControlVisible() || netWorkingFresh(1200)) {
      return { kind: 'generating', toolPenaltyMs: 0, decodeMultiplier: 1 };
    }
    return { kind: 'default', toolPenaltyMs: 0, decodeMultiplier: 1 };
  }

  // Hard block: greetings / tiny chat. ONLY deep-research UI can override — not tools false-positives.
  const TRIVIAL_GREETING_RE = /^(hi+|h+e+l+l+o+|hey+|yo+|sup|hiya|howdy|thanks?|thx|ty|ok|okay|k|yes|yep|no|nope|sure|cool|nice|bye|goodbye|good\s*(morning|afternoon|evening|night)|how are you|what'?s up|whats up|test|hola|gm|gn)\W*$/i;

  function shouldNeverShowAd(promptTokens, promptText = '') {
    const text = String(promptText || '').replace(/\s+/g, ' ').trim();
    const tokens = Math.max(0, promptTokens || 0, estimateTokensFromText(text) || 0);

    // Explicit greetings / one-word pings — always skip unless deep research plan is live.
    if (TRIVIAL_GREETING_RE.test(text)) return true;
    // Empty / unknown capture → skip (safer than flashing on stale long text).
    if (!text) return true;
    // Tiny chat without long-output intent.
    if (text.length <= 28 && tokens <= 8 && !LONG_OUTPUT_CUE_RE.test(text) && !WORD_COUNT_CUE_RE.test(text)) {
      return true;
    }
    return false;
  }

  // Short chat pings must never get ads. "hi", "ok", "thanks", "what is 2+2".
  function isShortChatPrompt(promptTokens, promptText = '') {
    if (shouldNeverShowAd(promptTokens, promptText)) return true;
    const text = String(promptText || '').replace(/\s+/g, ' ').trim();
    const tokens = Math.max(promptTokens || 0, estimateTokensFromText(text) || 0);
    if (LONG_OUTPUT_CUE_RE.test(text) || WORD_COUNT_CUE_RE.test(text)) return false;
    if (/\b(deep research|web search|browse|with tools)\b/i.test(text)) return false;
    if (tokens <= 16 && text.length <= 64) return true;
    return false;
  }

  function isLongWaitMode(mode) {
    return mode?.kind === 'deep_research' || mode?.kind === 'tools_search';
  }

  // Only real deep-research plan unlocks ads for trivial prompts — not "Thinking"/tools flicker.
  function canOverrideShortPromptSkip() {
    return !!findDeepResearchPlan();
  }

  // Base wait with NO live tool/deep-research inflation — used to hard-skip short chats.
  function estimateBaseWaitMs(platform, promptTokens, promptText = '') {
    const defaults = PLATFORM_WAIT_DEFAULTS[platform] || PLATFORM_WAIT_DEFAULTS.default;
    const inputTokens = Math.max(0, promptTokens || 0);
    const ttftMs = defaults.ttftMs + (inputTokens * defaults.msPerInputToken);
    const expectedOutput = expectedOutputTokens(defaults, inputTokens, promptText);
    const decodeMs = (expectedOutput / Math.max(defaults.tokensPerSecond, 1)) * 1000;
    return ttftMs + decodeMs + (defaults.toolPenaltyMs || 0);
  }

  // Expected output from prompt size + content cues. Prediction-only — drives show/skip.
  function expectedOutputTokens(defaults, inputTokens, promptText) {
    const text = String(promptText || '');
    let scaled = defaults.baseOutput + Math.round(Math.max(0, inputTokens) * defaults.promptFactor);

    if (LONG_OUTPUT_CUE_RE.test(text)) scaled = Math.round(scaled * 2.4);
    if (/\b(essay|comprehensive|in[- ]depth|deep research)\b/i.test(text)) {
      scaled = Math.round(scaled * 2.6);
    } else if (/\bresearch\b/i.test(text)) {
      scaled = Math.round(scaled * 1.5);
    }
    const wordCue = text.match(WORD_COUNT_CUE_RE);
    if (wordCue) {
      const n = Number(wordCue[1]);
      if (Number.isFinite(n)) {
        const unit = /pages?/i.test(wordCue[2]) ? 400 : /paragraphs?/i.test(wordCue[2]) ? 80 : 1;
        scaled = Math.max(scaled, Math.round(n * unit * 1.3));
      }
    }

    // Tiny → skip. Medium write prompts → enough for a bumper/brand. Long → gallery.
    if (inputTokens <= 4) return clamp(scaled, 8, 40);        // "hi" → ~1s total → skip
    if (inputTokens <= 12) return clamp(scaled, 24, 100);     // short Q → usually skip
    if (inputTokens <= 28) return clamp(scaled, 120, 320);    // medium → 4–8s bumper
    if (inputTokens <= 60) return clamp(scaled, 280, 700);    // longer write → brand
    if (inputTokens <= 120) return clamp(scaled, 500, 1400);
    return clamp(scaled, 700, 3200);
  }

  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }

  // On-ad counter: always climbs 1 → 10 while the video plays (demo-visible earn meter).
  const AD_TOKEN_DISPLAY_MIN = 1;
  const AD_TOKEN_DISPLAY_MAX = 10;

  function displayTokensForProgress(progressRatio) {
    const t = Math.max(0, Math.min(1, progressRatio || 0));
    // Start at 1 the moment the ad shows; hit 10 at the end.
    return Math.max(
      AD_TOKEN_DISPLAY_MIN,
      Math.min(AD_TOKEN_DISPLAY_MAX, Math.round(AD_TOKEN_DISPLAY_MIN + t * (AD_TOKEN_DISPLAY_MAX - AD_TOKEN_DISPLAY_MIN))),
    );
  }

  function formatCredits(value) {
    return String(Math.max(0, Math.round(Number(value) || 0)));
  }

  function loadWaitStats() {
    try {
      const raw = localStorage.getItem(WAIT_STATS_KEY);
      const stats = raw ? JSON.parse(raw) : {};
      return stats && typeof stats === 'object' ? stats : {};
    } catch {
      return {};
    }
  }

  function saveWaitStats(stats) {
    try {
      localStorage.setItem(WAIT_STATS_KEY, JSON.stringify(stats));
    } catch {
      /* storage may be unavailable */
    }
  }

  function updateMovingAverage(current, sample, count) {
    if (!Number.isFinite(sample) || sample <= 0) return current || 0;
    if (!Number.isFinite(current) || current <= 0) return sample;
    const weight = count < 5 ? 0.45 : 0.25;
    return current * (1 - weight) + sample * weight;
  }

  function recordWaitSample(platform, sample) {
    if (!sample?.totalMs || sample.totalMs < 1000) return;

    const stats = loadWaitStats();
    const existing = stats[platform] || {};
    const count = Math.min((existing.count || 0) + 1, 200);
    stats[platform] = {
      count,
      avgTotalMs: updateMovingAverage(existing.avgTotalMs, sample.totalMs, existing.count || 0),
      avgTtftMs: updateMovingAverage(existing.avgTtftMs, sample.ttftMs, existing.count || 0),
    };
    saveWaitStats(stats);
  }

  function estimateResponseTiming(platform, promptTokens, promptText = '') {
    const defaults = PLATFORM_WAIT_DEFAULTS[platform] || PLATFORM_WAIT_DEFAULTS.default;
    const inputTokens = Math.max(0, promptTokens || 0);
    const text = String(promptText || '');
    const mode = detectLiveWaitMode(platform);

    // total ≈ TTFT(prefill) + (expected_output_tokens / TPS) + live mode penalty
    const ttftMs = defaults.ttftMs + (inputTokens * defaults.msPerInputToken);
    const expectedOutput = expectedOutputTokens(defaults, inputTokens, text);
    let decodeMs = (expectedOutput / Math.max(defaults.tokensPerSecond, 1)) * 1000;
    decodeMs *= mode.decodeMultiplier || 1;

    const toolPenaltyMs = Math.max(defaults.toolPenaltyMs || 0, mode.toolPenaltyMs || 0);
    let formulaMs = ttftMs + decodeMs + toolPenaltyMs;

    // Blend observed averages only for non-tiny prompts, and never erase a live long mode.
    const observed = loadWaitStats()[platform];
    if (
      mode.kind === 'default' &&
      inputTokens >= 16 &&
      observed?.count >= 3 &&
      observed.avgTotalMs > 0
    ) {
      const observedWeight = observed.count >= 8 ? 0.5 : 0.3;
      formulaMs = formulaMs * (1 - observedWeight) + observed.avgTotalMs * observedWeight;
      return {
        totalMs: formulaMs,
        ttftMs,
        decodeMs,
        expectedOutput,
        mode: mode.kind,
        source: 'observed',
      };
    }

    return {
      totalMs: formulaMs,
      ttftMs,
      decodeMs,
      expectedOutput,
      mode: mode.kind,
      source: 'ttft+tps',
    };
  }

  // Ad length from predicted wait at send time. Show immediately if it fits a creative;
  // return 0 to skip forever (short prompts). Never "wait 4s of real time then decide".
  function chooseAdDurationSeconds(platform, promptTokens, elapsedMs, promptText = '') {
    const mode = detectLiveWaitMode(platform);
    const estimate = estimateResponseTiming(platform, promptTokens, promptText);
    const baseMs = estimateBaseWaitMs(platform, promptTokens, promptText);

    // hi / hello / tiny chat → never, unless deep research plan is actually running.
    if (shouldNeverShowAd(promptTokens, promptText) && !canOverrideShortPromptSkip()) {
      return 0;
    }

    // Short chats → no ad unless deep research / real tools UI is already on.
    if (isShortChatPrompt(promptTokens, promptText) && !isLongWaitMode(mode) && !canOverrideShortPromptSkip()) {
      return 0;
    }

    // Use full predicted wait for the fit decision (elapsed only shrinks remaining for chaining).
    const predictedTotalMs = Math.max(estimate.totalMs || 0, isLongWaitMode(mode) ? estimate.totalMs || 0 : baseMs);
    const elapsed = Math.max(0, elapsedMs || 0);
    const rawRemainingMs = Math.max(0, predictedTotalMs - elapsed - PREDICTION_END_BUFFER_MS);

    // Must fit at least the shortest creative inside the predicted wait.
    const safeRemainingMs = Math.floor(rawRemainingMs * AD_FIT_SAFETY);
    if (safeRemainingMs < MIN_AD_MS) return 0;

    const remainingSec = Math.floor(safeRemainingMs / 1000);
    const available = LAUNCH_CREATIVE_FILES
      .map((e) => e.durationSeconds)
      .filter((sec) => sec <= remainingSec)
      .sort((a, b) => b - a);

    return available[0] || 0;
  }

  function predictedAnswerAt(candidateStartedAt, platform, promptTokens, promptText = '') {
    const estimate = estimateResponseTiming(platform, promptTokens, promptText);
    return (candidateStartedAt || Date.now()) + Math.max(0, estimate.totalMs || 0);
  }

  function findDeepResearchPlan() {
    // Only treat deep research as "working" while it is actively running —
    // not when a finished plan card is still sitting in the transcript.
    // Keep this STRICT — a lone "researching" in sidebar chrome must not
    // unlock ads for short prompts like "hi".
    const candidates = document.querySelectorAll('button, [role="button"], div, section, article');
    for (const el of candidates) {
      if (!isVisible(el) || el.closest('#whyl-host, #whyl-status-pill, #whyl-status-stack, #whyl-ad-slogan')) continue;
      const text = (el.textContent || '').replace(/\s+/g, ' ').trim();
      if (!text || text.length > 420) continue;
      const looksLikeRunningResearch =
        /\b(deep researching|searching sources|reading sources|collecting sources)\b/i.test(text) ||
        (/\bdeep research\b/i.test(text) && /\b(researching|in progress|running)\b/i.test(text));
      const looksLikeActivePlan =
        /\bdeep research\b/i.test(text) &&
        /\b(start|in progress|running|working)\b/i.test(text) &&
        !/\b(finished|complete|completed|done|report ready)\b/i.test(text);
      if (looksLikeRunningResearch || looksLikeActivePlan) return el;
    }
    return null;
  }

  function findLastUserMessage() {
    const selectors = [
      '[data-message-author-role="user"]',
      '[data-testid*="user"]',
      '[data-testid*="human"]',
      'div[class*="user"]',
    ];
    for (const selector of selectors) {
      const matches = [...document.querySelectorAll(selector)].filter(isVisible);
      if (matches.length) return matches[matches.length - 1];
    }
    const composer = adapter.getComposer?.();
    return composer || null;
  }

  function hasStopControlVisible() {
    // Keep this STRICT — a bare "Stop" label matches unrelated UI and keeps ads alive forever.
    if (findVisible([
      'button[data-testid="stop-button"]',
      'button[data-testid*="stop-button"]',
      'button[aria-label*="Stop generating"]',
      'button[aria-label*="Stop streaming"]',
      'button[aria-label*="Stop response"]',
      'button[aria-label="Stop"]',
    ])) return true;
    return !!findVisibleControlText([
      'Stop generating',
      'Stop streaming',
      'Stop response',
      'Stop research',
    ]);
  }

  // True only while the model is actively generating. Used for hide + chain decisions.
  function isAiStillWorking(adapterInstance) {
    if (hasStopControlVisible()) return true;

    if (adapterInstance?.id === 'claude') {
      const streaming = document.querySelector('[data-is-streaming="true"]');
      if (streaming && isVisible(streaming)) return true;
    }

    if (findDeepResearchPlan()) return true;
    // Fresh network chunks only — not stale open streams, not answer prose status words.
    if (netWorkingFresh(800)) return true;
    // DOM generation / thinking indicators — critical on first run when net-probe injected late.
    if (adapterInstance?.hasVisibleGenerationSignal?.()) return true;
    if (adapterInstance?.hasVisibleThinkingIndicator?.()) return true;
    return false;
  }

  function isAnswerFinished(adapterInstance) {
    return !isAiStillWorking(adapterInstance);
  }

  function isInsideAssistantMessage(el) {
    return !!el?.closest?.(
      '[data-message-author-role="assistant"], [data-testid*="assistant"], [data-testid*="message"], message-content, .assistant-message, [class*="AssistantMessage"]',
    );
  }

  function findVisibleLiveText(labels, includeGlobalFallback = true, excludeAssistantContent = true) {
    if (!labels.length) return includeGlobalFallback ? findGlobalLiveStatusText() : null;
    const roots = [document.querySelector('main'), document.body].filter(Boolean);
    for (const root of roots) {
      const nodes = root.querySelectorAll('p, span, div, li, button, [role="status"], [aria-live], [role="progressbar"] + *');
      for (const el of nodes) {
        if (!isVisible(el) || el.closest('#whyl-host, #whyl-status-pill, #whyl-status-stack, #whyl-ad-slogan')) continue;
        if (excludeAssistantContent && isInsideAssistantMessage(el)) continue;
        const text = (el.textContent || '').replace(/\s+/g, ' ').trim();
        if (!text || text.length > 160 || DONE_STATUS_RE.test(text)) continue;
        if (labels.some((label) => new RegExp(`\\b${escapeRegExp(label)}\\b`, 'i').test(text))) return el;
      }
    }
    return includeGlobalFallback ? findGlobalLiveStatusText() : null;
  }

  const GLOBAL_LIVE_STATUS_RE = /(thinking|reasoning|searching|researching|deep research|calibrating|generating|loading|processing|analyzing|reading|browsing|working|planning|drafting|compiling|running|waiting|queued|in progress|summarizing|synthesizing|collecting|gathering|exploring|investigating|reviewing|writing|building|executing|using tools|web search)/i;

  function findGlobalLiveStatusText() {
    // Only dedicated live-status nodes — never scan finished answer prose
    // (assistant replies often contain "working", "reading", "writing", etc.).
    const nodes = document.querySelectorAll('[role="status"], [aria-live="polite"], [aria-live="assertive"], [aria-busy="true"]');
    for (const el of nodes) {
      if (!isVisible(el) || el.closest('#whyl-host, #whyl-status-pill, #whyl-status-stack, #whyl-ad-slogan')) continue;
      if (isInsideAssistantMessage(el)) continue;
      const text = (el.textContent || '').replace(/\s+/g, ' ').trim();
      if (!text || text.length > 120 || DONE_STATUS_RE.test(text)) continue;
      if (GLOBAL_LIVE_STATUS_RE.test(text)) return el;
    }
    return null;
  }

  function findActiveProgressBar() {
    for (const el of document.querySelectorAll('[role="progressbar"], progress')) {
      if (!isVisible(el) || el.closest('#whyl-host, #whyl-status-pill, #whyl-status-stack, #whyl-ad-slogan')) continue;
      // Ignore indeterminate bars with no numeric value — those often linger after done.
      const max = Number(el.getAttribute('aria-valuemax') || el.max || 100);
      const raw = el.getAttribute('aria-valuenow') ?? el.value;
      const value = Number(raw);
      if (!Number.isFinite(value)) continue;
      if (value < max) return el;
    }
    return null;
  }

  function findStopNearProgress() {
    const progress = findActiveProgressBar();
    if (!progress) return null;
    const container = progress.closest('div, section, article') || progress.parentElement;
    if (!container) return null;
    for (const el of container.querySelectorAll('button, [role="button"]')) {
      if (!isVisible(el)) continue;
      const label = `${el.getAttribute('aria-label') || ''} ${el.getAttribute('title') || ''} ${el.textContent || ''}`.toLowerCase();
      if (/(stop|cancel|abort)/.test(label)) return el;
      if (el.querySelector('svg, [class*="stop"], [class*="square"]')) return el;
    }
    return null;
  }

  function escapeRegExp(value) {
    return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  function getLastMatching(selectors) {
    for (const selector of selectors) {
      const matches = [...document.querySelectorAll(selector)].filter(isVisible);
      if (matches.length) return matches[matches.length - 1];
    }
    return null;
  }

  function isVisible(el) {
    if (!(el instanceof Element)) return false;
    const rect = el.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return false;
    const style = window.getComputedStyle(el);
    return style.display !== 'none' && style.visibility !== 'hidden' && Number(style.opacity) > 0;
  }

  function isInViewport(el) {
    const rect = el.getBoundingClientRect();
    return rect.bottom > 0 && rect.top < window.innerHeight && rect.right > 0 && rect.left < window.innerWidth;
  }

  function sendMessage(type, data = {}, timeoutMs = 4000) {
    return new Promise((resolve) => {
      let settled = false;
      const finish = (value) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        resolve(value);
      };
      const timer = setTimeout(() => {
        finish({ error: 'timeout', timedOut: true });
      }, timeoutMs);

      try {
        if (!chrome?.runtime?.id) {
          finish({ error: 'extension_context_invalidated' });
          return;
        }
        chrome.runtime.sendMessage({ type, ...data }, (response) => {
          if (chrome.runtime.lastError) {
            finish({ error: chrome.runtime.lastError.message });
            return;
          }
          finish(response || {});
        });
      } catch (err) {
        finish({ error: err?.message || String(err) });
      }
    });
  }

  class Overlay {
    constructor(platformAdapter) {
      this.adapter = platformAdapter;
      this.host = null;
      this.shadow = null;
      this.root = null;
      this.badgeStack = null;
      this.badge = null;
      this.sloganEl = null;
      this.currentAd = null;
      this.lastPlayedAd = null;
      this.afterglowAd = null;
      this.sessionCredits = 0;
      this.balance = 0;
      this.progressRatio = 0;
      this.continueVisible = false;
      this.minimized = false;
      this.onContinue = () => {};
      this.onStop = () => {};
      this.onRestore = () => {};
      this.reservedEl = null;
      this.originalPaddingRight = '';
      this.customPos = this.loadSavedPos();
      this.dragging = false;
      this.dragOffsetX = 0;
      this.dragOffsetY = 0;
      this.ensureBadge();
    }

    loadSavedPos() {
      try {
        const raw = localStorage.getItem('whyl_panel_pos');
        if (!raw) return null;
        const pos = JSON.parse(raw);
        if (typeof pos?.left === 'number' && typeof pos?.top === 'number') return pos;
      } catch {
        /* ignore corrupt state */
      }
      return null;
    }

    saveCustomPos() {
      try {
        if (this.customPos) localStorage.setItem('whyl_panel_pos', JSON.stringify(this.customPos));
      } catch {
        /* storage may be unavailable */
      }
    }

    ensure() {
      if (this.host) return;
      this.host = document.createElement('div');
      this.host.id = 'whyl-host';
      this.host.style.cssText = [
        'position:fixed',
        'z-index:2147483646',
        'display:none',
        'pointer-events:none',
        'transition:top 240ms cubic-bezier(.2,.8,.2,1), left 240ms cubic-bezier(.2,.8,.2,1), width 240ms cubic-bezier(.2,.8,.2,1), opacity 160ms ease',
        'transform-origin:top center',
      ].join(';');
      this.shadow = this.host.attachShadow({ mode: 'closed' });

      const link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = chrome.runtime.getURL('panel.css');
      this.shadow.appendChild(link);

      this.root = document.createElement('div');
      this.root.className = 'whyl-root';
      this.shadow.appendChild(this.root);
      document.documentElement.appendChild(this.host);
    }

    ensureBadge() {
      if (this.badgeStack) return;
      this.badgeStack = document.createElement('div');
      this.badgeStack.id = 'whyl-status-stack';
      this.badgeStack.style.cssText = [
        'position:fixed',
        'top:14px',
        'left:50%',
        'transform:translateX(-50%)',
        'z-index:2147483645',
        'display:flex',
        'flex-direction:column',
        'align-items:center',
        'gap:7px',
        'pointer-events:none',
        'max-width:min(92vw, 420px)',
      ].join(';');

      this.badge = document.createElement('div');
      this.badge.id = 'whyl-status-pill';
      this.badge.innerHTML = this.badgeMarkup('on');
      this.badge.style.cssText = [
        'display:flex',
        'align-items:center',
        'gap:8px',
        'padding:7px 12px',
        'border-radius:999px',
        'border:1px solid rgba(214,255,63,0.22)',
        'background:rgba(9,12,8,0.82)',
        'color:#d6ff3f',
        'font:800 14px/1.1 ui-monospace,SFMono-Regular,Menlo,Monaco,Consolas,monospace',
        'letter-spacing:0.08em',
        'box-shadow:0 12px 34px rgba(0,0,0,0.22), inset 0 1px 0 rgba(255,255,255,0.07)',
        'opacity:0.96',
      ].join(';');

      this.sloganEl = document.createElement('div');
      this.sloganEl.id = 'whyl-ad-slogan';
      this.sloganEl.setAttribute('aria-live', 'polite');
      this.sloganEl.style.cssText = [
        'display:none',
        'align-items:center',
        'justify-content:center',
        'gap:8px',
        'max-width:min(92vw, 520px)',
        'padding:7px 14px',
        'border-radius:999px',
        'border:1px solid rgba(214,255,63,0.18)',
        'background:linear-gradient(90deg, rgba(8,12,8,0.08) 0%, rgba(10,16,10,0.88) 18%, rgba(12,18,10,0.92) 50%, rgba(10,16,10,0.88) 82%, rgba(8,12,8,0.08) 100%)',
        'box-shadow:0 8px 28px rgba(0,0,0,0.28), 0 0 24px rgba(214,255,63,0.08)',
        'backdrop-filter:blur(10px)',
        'opacity:0',
        'transform:translateY(-4px)',
        'transition:opacity 420ms ease, transform 420ms ease',
        'white-space:nowrap',
        'overflow:hidden',
        'text-overflow:ellipsis',
        'font:600 11px/1.2 ui-monospace,SFMono-Regular,Menlo,Monaco,Consolas,monospace',
        'letter-spacing:0.08em',
        'text-transform:uppercase',
        'color:#e8ff8a',
        'text-shadow:0 0 8px rgba(214,255,63,0.85), 0 0 16px rgba(214,255,63,0.4)',
      ].join(';');

      this.badgeStack.appendChild(this.badge);
      this.badgeStack.appendChild(this.sloganEl);
      document.documentElement.appendChild(this.badgeStack);
    }

    setBadge(text, color = '#d6ff3f') {
      this.ensureBadge();
      const compactText = text.toLowerCase().includes('earning') ? 'earning' : 'on';
      this.badge.innerHTML = this.badgeMarkup(compactText);
      this.badge.style.color = color;
    }

    badgeMarkup(label) {
      return `
        <span style="width:10px;height:10px;border-radius:999px;background:#d6ff3f;box-shadow:0 0 16px rgba(214,255,63,0.9);display:block;"></span>
        <span>whyl ${label}</span>
      `;
    }

    afterglowMarkup(ad) {
      const slogan = sloganForAd(ad);
      const company = companyForAd(ad);
      if (!slogan && !company) return '';
      // One line: COMPANY · slogan
      if (company && slogan) {
        return `<span style="font-weight:900;color:#d6ff3f;letter-spacing:0.14em;text-shadow:0 0 10px rgba(214,255,63,0.9);">${escapeHtml(company)}</span><span style="opacity:0.45;font-weight:700;">·</span><span style="font-weight:600;letter-spacing:0.1em;">${escapeHtml(slogan)}</span>`;
      }
      return `<span style="font-weight:900;color:#d6ff3f;letter-spacing:0.14em;">${escapeHtml(company || slogan)}</span>`;
    }

    // Illuminated afterglow under the pill — stays until the next question.
    showAfterglowSlogan(ad) {
      this.ensureBadge();
      const markup = this.afterglowMarkup(ad);
      if (!markup || !this.sloganEl) return;
      this.afterglowAd = ad;
      this.sloganEl.innerHTML = markup;
      this.sloganEl.style.display = 'inline-flex';
      // Retrigger illuminate animation.
      this.sloganEl.style.opacity = '0';
      this.sloganEl.style.transform = 'translateY(-4px)';
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          if (!this.sloganEl) return;
          this.sloganEl.style.opacity = '1';
          this.sloganEl.style.transform = 'translateY(0)';
        });
      });
    }

    clearAfterglowSlogan() {
      this.afterglowAd = null;
      if (!this.sloganEl) return;
      this.sloganEl.style.opacity = '0';
      this.sloganEl.style.transform = 'translateY(-4px)';
      const el = this.sloganEl;
      setTimeout(() => {
        if (el !== this.sloganEl) return;
        el.style.display = 'none';
        el.innerHTML = '';
      }, 280);
    }

    show(ad, options) {
      this.ensure();
      // New ad playing — clear previous afterglow so the pill stays clean while watching.
      this.clearAfterglowSlogan();
      if (this.currentAd && this.currentAd.id !== ad?.id) this.stopMediaPlayback();
      this.currentAd = ad;
      this.lastPlayedAd = ad;
      this.sessionCredits = options.sessionCredits || 0;
      this.balance = options.balance || 0;
      this.progressRatio = options.progressRatio || 0;
      this.continueVisible = !!options.continueVisible;
      this.minimized = false;
      this.onContinue = options.onContinue || (() => {});
      this.onStop = options.onStop || (() => {});
      this.onRestore = options.onRestore || (() => {});
      this.render();
      this.position();
      // Always show once we've decided to show — never flash hide from a missed anchor.
      this.host.style.display = 'block';
      this.host.style.pointerEvents = 'auto';
      this.host.style.opacity = '1';
      this.setBadge('WHYL earning', '#4ade80');
      this.ensureVideoPlaying();
    }

    update(options = {}) {
      if (!this.currentAd || !this.root) return;
      if (this.minimized) return;
      this.sessionCredits = options.sessionCredits ?? this.sessionCredits;
      this.balance = options.balance ?? this.balance;
      this.progressRatio = options.progressRatio ?? this.progressRatio;
      this.continueVisible = options.continueVisible ?? this.continueVisible;
      // Never full re-render on progress ticks — that destroys <video> and leaves a poster image.
      this.updateProgressOnly();
      if (!this.dragging) this.position();
    }

    updateProgressOnly() {
      if (!this.root || !this.currentAd) return;
      const progress = Math.max(0, Math.min(this.progressRatio * 100, 100));
      const bar = this.root.querySelector('.whyl-progress span');
      const tokens = this.root.querySelector('.whyl-footer strong');
      if (bar) bar.style.width = `${progress}%`;
      if (tokens) tokens.textContent = `+${formatCredits(displayTokensForProgress(this.progressRatio))}`;
    }

    hide(options = {}) {
      const leaveAfterglow = options.leaveAfterglow !== false;
      const adForAfterglow = this.currentAd || this.lastPlayedAd;
      this.stopMediaPlayback();
      if (this.host) {
        this.host.style.display = 'none';
        this.host.style.pointerEvents = 'none';
        this.host.style.opacity = '0';
      }
      if (this.root) this.root.innerHTML = '';
      this.currentAd = null;
      this.releaseReadingSpace();
      this.setBadge('WHYL ready');
      if (leaveAfterglow && adForAfterglow) this.showAfterglowSlogan(adForAfterglow);
      else if (!leaveAfterglow) this.clearAfterglowSlogan();
    }

    position() {
      if (!this.host) return false;
      // Never re-show a hidden panel from scroll/poll. Only show() turns it back on.
      if (!this.currentAd) return false;
      if (this.host.style.display === 'none') return false;
      // While dragging, keep the card visible at the dragged coordinates.
      if (this.dragging) {
        this.host.style.display = 'block';
        return true;
      }
      if (this.minimized) {
        this.positionMini();
        return true;
      }

      // Prefer sitting directly under the user's question on the main thread.
      const question = findLastUserMessage();
      const thinkingAnchor = this.adapter.getThinkingAnchor();
      const anchor = (question && isInViewport(question) ? question : null) || thinkingAnchor;
      const anchorRect = anchor?.getBoundingClientRect();

      // If user dragged the card, keep that spot — don't hide when anchors move.
      if (this.customPos) {
        this.host.style.left = `${this.customPos.left}px`;
        this.host.style.top = `${this.customPos.top}px`;
        this.host.style.right = 'auto';
        this.host.style.bottom = 'auto';
        this.host.style.display = 'block';
        return true;
      }

      if (!anchor || !anchorRect) {
        // Keep last known on-screen position instead of blinking away.
        if (this.host.style.display === 'block') return true;
        this.host.style.display = 'none';
        return false;
      }

      const viewportPadding = window.innerWidth < 640 ? 12 : 20;
      const contentRect = this.getContentRect(anchor);
      // Compact square-ish card, not a giant takeover.
      const maxWidth = Math.min(360, window.innerWidth - viewportPadding * 2);
      const contentWidth = Math.max(0, contentRect.right - contentRect.left);
      const width = Math.max(260, Math.min(maxWidth, contentWidth || maxWidth));
      const left = Math.max(
        viewportPadding,
        Math.min(contentRect.left, window.innerWidth - width - viewportPadding),
      );
      const top = Math.max(64, anchorRect.bottom + 10);
      const cardHeight = Math.min(220, Math.max(168, Math.round(width * 0.62)));

      this.host.style.left = `${left}px`;
      this.host.style.top = `${top}px`;
      this.host.style.setProperty('--whyl-card-height', `${cardHeight}px`);
      this.host.style.setProperty('--whyl-media-height', `${Math.max(88, cardHeight - 78)}px`);
      this.host.style.right = 'auto';
      this.host.style.bottom = 'auto';
      this.host.style.width = `${width}px`;
      this.host.style.display = 'block';
      return true;
    }

    minimize(onRestore) {
      if (!this.host || !this.root) return;
      this.stopMediaPlayback();
      this.minimized = true;
      this.onRestore = onRestore || this.onRestore || (() => {});
      this.renderMini();
      this.positionMini();
      this.host.style.display = 'block';
      this.host.style.pointerEvents = 'auto';
      this.setBadge('WHYL ready');
    }

    positionMini() {
      if (!this.host) return;
      const margin = 16;
      const width = 88;
      const height = 68;

      this.host.style.left = 'auto';
      this.host.style.top = 'auto';
      this.host.style.right = `${margin}px`;
      this.host.style.bottom = `${margin}px`;
      this.host.style.width = `${width}px`;
    }

    reserveReadingSpace() {
      if (this.reservedEl || window.innerWidth < 980) return;
      const target = document.querySelector('main') || document.body;
      this.reservedEl = target;
      this.originalPaddingRight = target.style.paddingRight || '';
      const currentPadding = Number.parseFloat(getComputedStyle(target).paddingRight) || 0;
      const reservedPadding = Math.max(currentPadding, 456);
      target.style.paddingRight = `${reservedPadding}px`;
      target.style.transition = 'padding-right 180ms ease';
    }

    releaseReadingSpace() {
      if (!this.reservedEl) return;
      this.reservedEl.style.paddingRight = this.originalPaddingRight;
      this.reservedEl = null;
      this.originalPaddingRight = '';
    }

    getContentRect(anchor) {
      const viewportPadding = window.innerWidth < 640 ? 12 : 30;
      const fallbackWidth = Math.min(928, window.innerWidth - viewportPadding * 2);
      const fallback = {
        left: (window.innerWidth - fallbackWidth) / 2,
        right: (window.innerWidth + fallbackWidth) / 2,
        top: 72,
        bottom: window.innerHeight - 24,
      };

      const ancestorRects = [];
      for (let el = anchor; el && el !== document.body && el !== document.documentElement; el = el.parentElement) {
        const rect = el.getBoundingClientRect();
        if (rect.width >= 520 && rect.left > -8 && rect.right < window.innerWidth + 8) {
          ancestorRects.push(rect);
        }
      }

      if (ancestorRects.length) {
        const rect = ancestorRects.find((candidate) => candidate.width <= 980) || ancestorRects[ancestorRects.length - 1];
        const width = Math.min(rect.width, fallbackWidth);
        const center = rect.left + rect.width / 2;
        return {
          left: Math.max(viewportPadding, center - width / 2),
          right: Math.min(window.innerWidth - viewportPadding, center + width / 2),
          top: Math.max(56, rect.top),
          bottom: Math.min(window.innerHeight - 16, rect.bottom),
        };
      }

      const candidates = [
        document.querySelector('main article'),
        document.querySelector('main [data-testid*="conversation-turn"]'),
        document.querySelector('main'),
      ].filter(Boolean);

      for (const candidate of candidates) {
        const rect = candidate.getBoundingClientRect();
        if (rect.width > 280 && rect.height > 40) {
          const maxContentWidth = Math.min(rect.width, fallbackWidth);
          const center = rect.left + rect.width / 2;
          return {
            left: Math.max(viewportPadding, center - maxContentWidth / 2),
            right: Math.min(window.innerWidth - viewportPadding, center + maxContentWidth / 2),
            top: Math.max(56, rect.top),
            bottom: Math.min(window.innerHeight - 16, rect.bottom),
          };
        }
      }

      return fallback;
    }

    render() {
      const ad = this.currentAd;
      const progress = Math.max(0, Math.min(this.progressRatio * 100, 100));
      const shown = displayTokensForProgress(this.progressRatio);

      this.root.innerHTML = `
        <div class="whyl-card">
          <div class="whyl-card-header whyl-drag-handle" title="Drag">
            <span>WHYL</span>
            <span>·</span>
            <span>${escapeHtml(ad.advertiserName || 'WHYL')}</span>
            <span class="whyl-drag-hint">⠿</span>
          </div>
          <div class="whyl-media">${this.renderMedia(ad)}</div>
          <div class="whyl-progress">
            <span style="width:${progress}%"></span>
          </div>
          <div class="whyl-footer">
            <span>watching…</span>
            <strong>+${formatCredits(shown)}</strong>
          </div>
        </div>
      `;
      this.bindDrag();
      this.ensureVideoPlaying();
    }

    bindDrag() {
      const handle = this.root.querySelector('.whyl-drag-handle');
      if (!handle || handle.dataset.bound === '1') return;
      handle.dataset.bound = '1';

      handle.addEventListener('mousedown', (event) => {
        if (event.button !== 0 || this.minimized) return;
        event.preventDefault();

        this.ensure();
        this.dragging = true;
        this.host.style.display = 'block';
        this.host.style.transition = 'none';
        this.host.style.opacity = '1';
        this.host.style.pointerEvents = 'auto';

        const rect = this.host.getBoundingClientRect();
        this.dragOffsetX = event.clientX - rect.left;
        this.dragOffsetY = event.clientY - rect.top;

        const width = rect.width;
        const height = rect.height;

        const onMove = (moveEvent) => {
          if (!this.dragging) return;
          this.host.style.display = 'block';
          const left = Math.max(8, Math.min(moveEvent.clientX - this.dragOffsetX, window.innerWidth - width - 8));
          const top = Math.max(8, Math.min(moveEvent.clientY - this.dragOffsetY, window.innerHeight - height - 8));
          this.host.style.left = `${left}px`;
          this.host.style.top = `${top}px`;
          this.host.style.right = 'auto';
          this.host.style.bottom = 'auto';
          this.customPos = { left, top };
        };

        const onUp = () => {
          this.dragging = false;
          this.host.style.display = 'block';
          this.host.style.transition = 'top 240ms cubic-bezier(.2,.8,.2,1), left 240ms cubic-bezier(.2,.8,.2,1), width 240ms cubic-bezier(.2,.8,.2,1), opacity 160ms ease';
          this.saveCustomPos();
          document.removeEventListener('mousemove', onMove);
          document.removeEventListener('mouseup', onUp);
          // Re-assert position without hiding.
          this.position();
        };

        document.addEventListener('mousemove', onMove);
        document.addEventListener('mouseup', onUp);
      });
    }

    renderMini() {
      this.root.innerHTML = `
        <button class="whyl-mini" type="button" aria-label="Restore WHYL">
          <span class="whyl-mini-dot"></span>
          <span>whyl</span>
          <small>resume</small>
        </button>
      `;
      this.root.querySelector('.whyl-mini')?.addEventListener('click', this.onRestore);
    }

    renderMedia(ad) {
      // Direct <video> from bundled extension media. Default SOUND ON; user can mute.
      if (ad.videoUrl) {
        return `
          <div class="whyl-video-wrap">
            <video
              src="${escapeAttr(ad.videoUrl)}"
              autoplay
              playsinline
              webkit-playsinline
              loop
              preload="auto"
            ></video>
            <button class="whyl-mute-badge" type="button" aria-label="Mute video" data-muted="0">MUTE</button>
          </div>
        `;
      }
      return `<div class="whyl-video-placeholder" aria-label="Sponsored video placeholder"></div>`;
    }

    setMuteUi(muted) {
      const btn = this.root?.querySelector('.whyl-mute-badge');
      const video = this.root?.querySelector('video');
      if (!btn || !video) return;
      if (muted) {
        video.muted = true;
        video.setAttribute('muted', '');
        btn.dataset.muted = '1';
        btn.textContent = 'SOUND';
        btn.setAttribute('aria-label', 'Unmute video');
      } else {
        video.muted = false;
        video.volume = 1;
        video.removeAttribute('muted');
        btn.dataset.muted = '0';
        btn.textContent = 'MUTE';
        btn.setAttribute('aria-label', 'Mute video');
      }
    }

    bindMuteToggle() {
      const btn = this.root?.querySelector('.whyl-mute-badge');
      const video = this.root?.querySelector('video');
      if (!btn || !video || btn.dataset.bound === '1') return;
      btn.dataset.bound = '1';
      btn.addEventListener('click', (event) => {
        event.preventDefault();
        event.stopPropagation();
        const currentlyMuted = video.muted || video.volume === 0;
        if (currentlyMuted) {
          this.setMuteUi(false);
          video.dataset.preferMuted = '0';
          video.play()?.catch?.(() => {});
        } else {
          this.setMuteUi(true);
          video.dataset.preferMuted = '1';
        }
      });
    }

    ensureVideoPlaying() {
      const video = this.root?.querySelector('video');
      if (!video) return;
      this.bindMuteToggle();
      video.playsInline = true;
      video.setAttribute('playsinline', '');
      video.setAttribute('webkit-playsinline', '');

      // Default: sound ON. If autoplay-with-sound is blocked, fall back to muted
      // then show SOUND so one click restores audio.
      const preferMuted = video.dataset.preferMuted === '1';
      this.setMuteUi(preferMuted);

      const playWithSoundPreference = () => {
        if (preferMuted) {
          video.muted = true;
          video.play()?.catch?.(() => {});
          return;
        }
        video.muted = false;
        video.volume = 1;
        const result = video.play();
        if (result?.catch) {
          result.catch(() => {
            // Browser blocked unmuted autoplay — start muted; button says SOUND.
            this.setMuteUi(true);
            video.play()?.catch?.(() => {});
          });
        }
      };

      // If this file won't play, swap to another bundled creative immediately.
      if (!video.dataset.errorBound) {
        video.dataset.errorBound = '1';
        video.addEventListener('error', () => {
          const failedId = this.currentAd?.id;
          const alt = pickAlternateCreative(failedId, this.currentAd?.durationSeconds || 15);
          if (!alt || !this.root) return;
          this.currentAd = alt;
          this.lastPlayedAd = alt;
          const wrap = this.root.querySelector('.whyl-media');
          if (wrap) wrap.innerHTML = this.renderMedia(alt);
          this.ensureVideoPlaying();
        });
      }

      // Prefer blob: URL so host-page CSP cannot block chrome-extension media.
      const src = video.getAttribute('src') || video.src;
      if (src && src.startsWith('chrome-extension://') && !video.dataset.blobbed) {
        video.dataset.blobbed = '1';
        fetch(src)
          .then((res) => {
            if (!res.ok) throw new Error(`media ${res.status}`);
            return res.blob();
          })
          .then((blob) => {
            if (!blob || blob.size < 1000) throw new Error('empty media blob');
            const blobUrl = URL.createObjectURL(blob);
            video.src = blobUrl;
            video.load();
            video.addEventListener('loadeddata', playWithSoundPreference, { once: true });
            playWithSoundPreference();
          })
          .catch(() => {
            // Retry once with raw extension URL; if that fails, error handler swaps creative.
            video.addEventListener('loadeddata', playWithSoundPreference, { once: true });
            playWithSoundPreference();
          });
        return;
      }

      if (video.readyState >= 2) playWithSoundPreference();
      else {
        video.addEventListener('loadeddata', playWithSoundPreference, { once: true });
        video.addEventListener('canplay', playWithSoundPreference, { once: true });
      }
    }

    stopMediaPlayback() {
      if (!this.root) return;
      for (const media of this.root.querySelectorAll('video, audio')) {
        try {
          media.pause();
          media.removeAttribute('src');
          media.load();
        } catch {
          /* ignore */
        }
      }
    }
  }

  class ActivationController {
    constructor(platformAdapter, overlay) {
      this.adapter = platformAdapter;
      this.overlay = overlay;
      this.state = 'idle';
      this.candidateStartedAt = 0;
      this.clientSessionId = null;
      this.serverSessionId = null;
      this.currentAd = null;
      this.currentViewId = null;
      this.viewStartedAt = 0;
      this.balance = 0;
      this.sessionCredits = 0;
      this.candidateTimer = null;
      this.pollTimer = null;
      this.adTimer = null;
      this.adStartedAt = 0;
      this.lastWorkActivityAt = 0;
      this.keepAliveUntil = 0;
      this.hadSignalDuringCandidate = false;
      this.userInitiatedWait = false;
      this.promptTokens = 0;
      this.promptText = '';
      this.waitEstimate = estimateResponseTiming(this.adapter.id, 0);
      this.predictedEndAt = 0;
      this.firstTokenAt = 0;
      this.observationRecorded = false;
      this.doneSinceAt = 0;
      this.activeSignalGraceUntil = 0;
      this.sawVisibleSignalDuringActive = false;
      // Per-prompt wait session: open on send, closed when answer finishes.
      // Multiple ads can play while open; nothing auto-reopens after close.
      this.waitSessionId = null;
      this.waitClosed = false;
      this.adsPlayedThisWait = 0;
      this.sawStopDuringWait = false;
      // True from tryActivate start until overlay is shown — blocks hide race during API cold start.
      this.activating = false;
      this.overlayShownAt = 0;
      this.waitContextShared = false;
    }

    openWaitSession(promptTokens = 0, promptText = '') {
      // New question — clear previous ad afterglow under the pill.
      this.overlay.clearAfterglowSlogan();
      this.waitSessionId = `${this.adapter.id}-wait-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;
      this.waitClosed = false;
      this.waitContextShared = false;
      this.adsPlayedThisWait = 0;
      this.sawStopDuringWait = false;
      this.promptTokens = Math.max(0, promptTokens || 0);
      this.promptText = String(promptText || '').replace(/\s+/g, ' ').trim();
      this.candidateStartedAt = Date.now();
      this.waitEstimate = estimateResponseTiming(this.adapter.id, this.promptTokens, this.promptText);
      this.predictedEndAt = predictedAnswerAt(this.candidateStartedAt, this.adapter.id, this.promptTokens, this.promptText);
      this.firstTokenAt = 0;
      this.observationRecorded = false;
      this.doneSinceAt = 0;
      this.sessionCredits = 0;
      // Never skip here based on prompt text alone — live mode (deep research / tools)
      // may appear after send and grow the wait enough for an ad.
    }

    closeWaitSession() {
      if (!this.waitClosed && !this.waitContextShared && this.promptText) {
        this.waitContextShared = true;
        this.shareWaitContextIfAllowed({
          platform: this.adapter.id,
          promptText: this.promptText,
          promptTokens: this.promptTokens,
          clientSessionId: this.clientSessionId,
          waitMs: this.candidateStartedAt ? Math.max(0, Date.now() - this.candidateStartedAt) : 0,
        }).catch(() => {});
      }
      this.waitClosed = true;
      this.waitSessionId = null;
      this.clearCandidateTimer();
      this.stopAdTimer();
      this.stopPolling();
      // Leave illuminated slogan under the pill until the next question.
      this.overlay.hide({ leaveAfterglow: true });
      this.state = 'idle';
    }

    beginCandidate(allowWithoutSignal = false, promptTokens = 0, promptText = '') {
      // Nuclear skip at the door: hi/hello never open (or continue) a wait session.
      if (shouldNeverShowAd(promptTokens, promptText) && !canOverrideShortPromptSkip()) {
        if (allowWithoutSignal) {
          this.closeWaitSession();
          this.reset();
        }
        return;
      }

      // Flicker fix: once this prompt's wait is closed, ignore auto re-activation.
      // A new user send opens a fresh wait session (allowWithoutSignal=true).
      if (allowWithoutSignal) {
        this.openWaitSession(promptTokens, promptText);
      } else if (this.waitClosed || !this.waitSessionId) {
        return;
      }

      if (this.state === 'paused') {
        if (allowWithoutSignal) {
          this.overlay.hide({ leaveAfterglow: false });
          this.overlay.minimized = false;
          this.resetPausedOnly();
        } else if (this.adapter.hasGenerationSignal()) {
          this.expandFromPaused();
          return;
        } else {
          return;
        }
      }
      if (this.state !== 'idle') return;
      if (!allowWithoutSignal && !this.adapter.hasGenerationSignal()) return;

      this.state = 'candidate';
      if (!this.candidateStartedAt) this.candidateStartedAt = Date.now();
      this.hadSignalDuringCandidate = false;
      this.userInitiatedWait = allowWithoutSignal;
      this.promptTokens = Math.max(0, promptTokens || this.promptTokens || 0);
      if (promptText) this.promptText = String(promptText).replace(/\s+/g, ' ').trim();
      this.waitEstimate = estimateResponseTiming(this.adapter.id, this.promptTokens, this.promptText);
      this.predictedEndAt = predictedAnswerAt(this.candidateStartedAt, this.adapter.id, this.promptTokens, this.promptText);
      this.doneSinceAt = 0;
      this.activeSignalGraceUntil = 0;
      this.sawVisibleSignalDuringActive = false;
      this.markWorkActivity();
      this.clientSessionId = `${this.adapter.id}-${Date.now()}-${Math.random().toString(16).slice(2)}`;

      this.candidateTimer = setTimeout(() => this.tryActivate(), INITIAL_ACTIVATION_CHECK_MS);
      this.startPolling();
    }

    async tryActivate() {
      if (this.state !== 'candidate') return;

      if (!this.hasActivationEvidence()) {
        // Deep Research planning can take >5s before "Researching..." appears.
        const maxWaitMs = this.userInitiatedWait ? 120000 : 45000;
        if (Date.now() - this.candidateStartedAt < maxWaitMs) {
          this.candidateTimer = setTimeout(() => this.tryActivate(), ACTIVATION_RETRY_MS);
          return;
        }
        this.cancelCandidate();
        return;
      }

      const decision = this.shouldActivateNow();
      if (!decision.activate) {
        if (decision.wait) {
          this.candidateTimer = setTimeout(() => this.tryActivate(), ACTIVATION_RETRY_MS);
          return;
        }
        this.cancelCandidate();
        return;
      }

      this.state = 'active';
      this.activating = true;
      this.overlayShownAt = 0;
      this.activeSignalGraceUntil = decision.keepAlive ? Date.now() + RESTORE_KEEPALIVE_MS : 0;
      // Prediction decides immediately: long/medium wait → ad now; short → never.
      // Do NOT wait N seconds of real elapsed time before showing.
      this.waitEstimate = estimateResponseTiming(this.adapter.id, this.promptTokens, this.promptText);
      this.predictedEndAt = predictedAnswerAt(this.candidateStartedAt, this.adapter.id, this.promptTokens, this.promptText);

      const mode = detectLiveWaitMode(this.adapter.id);

      // hi / hello / tiny chat → never show (deep research plan only override).
      if (shouldNeverShowAd(this.promptTokens, this.promptText) && !canOverrideShortPromptSkip()) {
        this.activating = false;
        this.closeWaitSession();
        this.reset();
        return;
      }

      // Short chat with no deep research / tools → skip forever (no flash, no delay).
      if (isShortChatPrompt(this.promptTokens, this.promptText) && !isLongWaitMode(mode) && !canOverrideShortPromptSkip()) {
        this.activating = false;
        this.closeWaitSession();
        this.reset();
        return;
      }

      // Decide from FULL predicted wait (elapsed≈0 at first show), not "wait 4s then see".
      const fittedSeconds = chooseAdDurationSeconds(
        this.adapter.id,
        this.promptTokens,
        0,
        this.promptText,
      );

      if (!fittedSeconds) {
        // Prediction says too short. Only keep waiting if deep research / tools might still appear.
        if (isLongWaitMode(mode)) {
          this.activating = false;
          this.state = 'candidate';
          this.candidateTimer = setTimeout(() => this.tryActivate(), ACTIVATION_RETRY_MS);
          return;
        }
        const maybeLong =
          /\b(deep research|research|essay|detailed|comprehensive|analyze|implement|build)\b/i.test(
            this.promptText || '',
          );
        if (maybeLong && isAiStillWorking(this.adapter) && Date.now() - this.candidateStartedAt < 8000) {
          this.activating = false;
          this.state = 'candidate';
          this.candidateTimer = setTimeout(() => this.tryActivate(), ACTIVATION_RETRY_MS);
          return;
        }
        this.activating = false;
        this.closeWaitSession();
        this.reset();
        return;
      }

      // SHOW LOCAL CREATIVE FIRST — never block the first ad on cold API / sleeping SW.
      this.overlay.customPos = null;
      let ad = pickLaunchCreative(fittedSeconds);
      if (!ad) {
        this.activating = false;
        this.state = 'candidate';
        if (isAiStillWorking(this.adapter) && Date.now() - this.candidateStartedAt < HARD_SESSION_CAP_MS) {
          this.candidateTimer = setTimeout(() => this.tryActivate(), ACTIVATION_RETRY_MS);
          return;
        }
        this.closeWaitSession();
        this.reset();
        return;
      }

      ad = ensurePlayableAd(ad, fittedSeconds);
      if (!ad) {
        this.activating = false;
        this.closeWaitSession();
        this.reset();
        return;
      }

      // If answer already finished before we could show, bail.
      if (this.waitClosed || (isAnswerFinished(this.adapter) && !isAiStillWorking(this.adapter))) {
        this.activating = false;
        this.closeWaitSession();
        this.reset();
        return;
      }

      this.currentAd = ad;
      this.balance = 0;
      this.viewStartedAt = Date.now();
      this.overlayShownAt = Date.now();
      this.adsPlayedThisWait += 1;
      this.overlay.show(ad, {
        balance: this.balance,
        sessionCredits: this.sessionCredits,
        progressRatio: 0,
        onContinue: () => this.continueEarning(),
        onStop: () => this.stopWatching(),
        onRestore: () => this.restoreFromMini(),
      });
      this.activating = false;
      this.startAdTimer();

      // Auth + session tracking in the background (timeouts so cold Render can't hang).
      this.syncSessionInBackground(fittedSeconds, ad).catch(() => {});
    }

    async syncSessionInBackground(fittedSeconds, shownAd) {
      let auth = {};
      try {
        auth = await sendMessage('getAuth', {}, 2500);
      } catch {
        auth = {};
      }
      if (!auth.token || auth.error || this.state !== 'active' || this.waitClosed) return;

      try {
        const summary = await sendMessage('getSummary', {}, 3500);
        if (!summary.error && this.state === 'active') {
          this.balance = summary.balance || 0;
          this.overlay.updateMeta?.({ balance: this.balance, sessionCredits: this.sessionCredits });
        }
      } catch {
        /* offline ok */
      }

      try {
        const session = await sendMessage('startSession', {
          platform: this.adapter.id,
          clientSessionId: this.clientSessionId,
          activationDelayMs: Date.now() - this.candidateStartedAt,
        }, 4000);
        if (session.error || this.state !== 'active' || this.waitClosed) return;
        this.serverSessionId = session.sessionId;

        const nextAd = await sendMessage('getNextAd', {}, 3500);
        // Keep showing the local creative already on screen; only swap if still early
        // in playback and a better remote creative arrives.
        if (!nextAd.error && this.state === 'active' && Date.now() - this.overlayShownAt < 2500) {
          const remote = ensurePlayableAd(nextAd, fittedSeconds);
          if (remote && remote.id !== shownAd?.id && this.overlay?.show) {
            this.currentAd = remote;
            this.overlay.show(remote, {
              balance: this.balance,
              sessionCredits: this.sessionCredits,
              progressRatio: 0,
              onContinue: () => this.continueEarning(),
              onStop: () => this.stopWatching(),
              onRestore: () => this.restoreFromMini(),
            });
            shownAd = remote;
          }
        }

        const view = await sendMessage('startView', {
          sessionId: this.serverSessionId,
          campaignId: (this.currentAd || shownAd)?.id,
          platform: this.adapter.id,
        }, 3500);
        if (!view.error && this.state === 'active') this.currentViewId = view.viewId;
      } catch {
        /* keep local ad playing */
      }
    }

    cancelCandidate() {
      if (this.hadSignalDuringCandidate || this.firstTokenAt) this.recordObservedWait();
      this.clearCandidateTimer();
      this.stopPolling();
      // If we never showed an ad and wait is still open, keep session open for auto-assist.
      // If generation already finished, close the wait so we don't flicker later.
      if (isAnswerFinished(this.adapter)) this.closeWaitSession();
      this.reset();
    }

    async completeCurrentView(continued) {
      if (!this.currentViewId) return;

      const duration = Math.max(0, Date.now() - this.viewStartedAt);
      const result = await sendMessage('completeView', {
        viewId: this.currentViewId,
        continued,
        visibleDurationMs: duration,
      });

      if (!result.error) {
        this.sessionCredits += result.creditsEarned || 0;
        this.balance = result.totalBalance ?? this.balance;
      }

      this.currentViewId = null;
      this.viewStartedAt = 0;
    }

    async endSession() {
      this.clearCandidateTimer();
      this.stopAdTimer();
      this.stopPolling();

      // HIDE FIRST — never wait on API before removing the video.
      const wasActive = this.state === 'active' || this.state === 'finishing';
      const viewId = this.currentViewId;
      const viewStartedAt = this.viewStartedAt;
      const serverSessionId = this.serverSessionId;
      if (wasActive) this.recordObservedWait();
      this.currentViewId = null;
      this.viewStartedAt = 0;
      this.serverSessionId = null;
      this.closeWaitSession();
      this.reset();

      // Network cleanup in the background after the UI is already gone.
      if (wasActive && viewId) {
        sendMessage('completeView', {
          viewId,
          continued: false,
          visibleDurationMs: Math.max(0, Date.now() - viewStartedAt),
        }).catch(() => {});
      }
      if (serverSessionId) {
        sendMessage('endSession', { sessionId: serverSessionId }).catch(() => {});
      }
    }

    async shareWaitContextIfAllowed(waitContext) {
      if (!waitContext?.promptText) return;
      let prefs = { enabled: true };
      try {
        prefs = await sendMessage('getImproveWaitTiming', {}, 2000);
      } catch {
        prefs = { enabled: true };
      }
      // Default ON. If user turned off "Improve wait timing", do not send chat context.
      if (prefs.error || prefs.enabled === false) return;

      const responseText = this.adapter.getLatestAssistantText?.() || '';
      await sendMessage('submitWaitContext', {
        platform: waitContext.platform,
        promptText: waitContext.promptText,
        responseText,
        promptTokens: waitContext.promptTokens || 0,
        waitMs: waitContext.waitMs || 0,
        clientSessionId: waitContext.clientSessionId || '',
      }, 4000);
    }

    async finishToMini() {
      if (this.state !== 'active') return;
      this.state = 'finishing';
      await this.endSession();
    }

    async expandFromPaused() {
      // Dead path kept for friend's API shape — route through wait session.
      if (this.waitClosed || !this.waitSessionId) return;
      if (this.state !== 'paused') return;
      if (!this.adapter.hasGenerationSignal()) return;
      this.state = 'idle';
      this.beginCandidate(false, this.promptTokens);
    }

    async continueEarning(forcedSeconds = 0) {
      // Chain another ad in the SAME wait session (long waits / deep research).
      if (this.state !== 'active') return;
      if (this.waitClosed || !this.waitSessionId) {
        await this.endSession();
        return;
      }
      if (!isAiStillWorking(this.adapter)) {
        await this.endSession();
        return;
      }

      this.markWorkActivity();
      await this.completeCurrentView(true);

      let fittedSeconds = forcedSeconds || chooseAdDurationSeconds(
        this.adapter.id,
        this.promptTokens,
        Date.now() - this.candidateStartedAt,
        this.promptText,
      );
      // Still generating past the original prediction → keep filling with short bumpers.
      if (!fittedSeconds && isAiStillWorking(this.adapter)) {
        fittedSeconds = SHORTEST_CREATIVE_SEC;
      }
      if (!fittedSeconds) {
        await this.endSession();
        return;
      }

      let ad = pickLaunchCreative(fittedSeconds);
      if (!ad) {
        await this.endSession();
        return;
      }
      if (this.serverSessionId) {
        const nextAd = await sendMessage('getNextAd');
        if (!nextAd.error) ad = ensurePlayableAd(nextAd, fittedSeconds) || ad;
        if (!ad) {
          await this.endSession();
          return;
        }
        const view = await sendMessage('startView', {
          sessionId: this.serverSessionId,
          campaignId: ad.id,
          platform: this.adapter.id,
        });
        if (!view.error) this.currentViewId = view.viewId;
      }

      // Re-check after async — answer may have finished.
      if (!isAiStillWorking(this.adapter) || this.waitClosed) {
        await this.endSession();
        return;
      }

      ad = ensurePlayableAd(ad, fittedSeconds);
      if (!ad) {
        await this.endSession();
        return;
      }
      this.currentAd = ad;
      this.viewStartedAt = Date.now();
      this.adsPlayedThisWait += 1;
      this.overlay.show(ad, {
        balance: this.balance,
        sessionCredits: this.sessionCredits,
        progressRatio: 0,
        onContinue: () => this.continueEarning(),
        onStop: () => this.stopWatching(),
        onRestore: () => this.restoreFromMini(),
      });
      this.startAdTimer();
    }

    async stopWatching() {
      if (this.state !== 'active') return;
      this.stopAdTimer();
      this.markWorkActivity();
      this.keepAliveUntil = Date.now() + RESTORE_KEEPALIVE_MS;
      await this.completeCurrentView(false);
      this.overlay.minimize(() => this.restoreFromMini());
    }

    async restoreFromMini() {
      if (this.state === 'paused') {
        await this.expandFromPaused();
        return;
      }
      if (this.state !== 'active') return;
      this.markWorkActivity();
      this.keepAliveUntil = Date.now() + RESTORE_KEEPALIVE_MS;
      await this.continueEarning();
    }

    startPolling() {
      this.stopPolling();
      this.pollTimer = setInterval(() => {
        if (this.state === 'candidate') {
          if (this.adapter.hasGenerationSignal()) {
            this.hadSignalDuringCandidate = true;
            this.markWorkActivity();
          } else if (this.hadSignalDuringCandidate && Date.now() - this.lastWorkActivityAt > (this.userInitiatedWait ? USER_SIGNAL_GAP_CANCEL_MS : 3000)) {
            this.cancelCandidate();
            return;
          }
          if (!this.isWorkStillActive()) this.cancelCandidate();
          return;
        }

        if (this.state === 'paused') {
          if (this.adapter.hasGenerationSignal()) {
            this.expandFromPaused();
            return;
          }
          if (Date.now() - this.lastWorkActivityAt > 60000) {
            this.overlay.hide({ leaveAfterglow: false });
            this.reset();
          }
          return;
        }

        if (this.state === 'active') {
          if (!this.overlay.dragging) this.overlay.position();
          if (this.waitClosed) {
            this.endSession();
            return;
          }

          if (this.shouldHideForFinishedAnswer()) {
            this.endSession();
            return;
          }

          const now = Date.now();
          if (now - (this.candidateStartedAt || now) >= HARD_SESSION_CAP_MS) {
            this.endSession();
          }
        }
      }, POLL_MS);
    }

    // Instant hide when the answer is done. Stop-button edge is the primary signal.
    shouldHideForFinishedAnswer() {
      // First-run race: hide poll used to kill the session while the overlay was
      // still activating, or before stop/net-probe signals appeared.
      if (this.activating) return false;
      if (this.overlayShownAt && Date.now() - this.overlayShownAt < 2500) return false;

      if (hasStopControlVisible()) {
        this.sawStopDuringWait = true;
        this.doneSinceAt = 0;
        return false;
      }

      // Claude: streaming flag still on → keep ad.
      if (this.adapter?.id === 'claude') {
        const streaming = document.querySelector('[data-is-streaming="true"]');
        if (streaming && isVisible(streaming)) {
          this.doneSinceAt = 0;
          return false;
        }
      }

      if (findDeepResearchPlan() || netWorkingFresh(400)) {
        this.doneSinceAt = 0;
        return false;
      }

      // DOM generation / thinking — covers late net-probe inject after extension reload.
      if (isAiStillWorking(this.adapter)) {
        this.doneSinceAt = 0;
        return false;
      }

      // Stop gone / no streaming → hide immediately.
      return true;
    }

    hideIfAnswerFinished() {
      if (this.waitClosed) return false;
      if (this.activating) return false;
      if (this.state !== 'active' && this.state !== 'candidate') return false;
      if (!this.shouldHideForFinishedAnswer()) return false;
      this.endSession();
      return true;
    }

    markWorkActivity() {
      this.lastWorkActivityAt = Date.now();
    }

    isWorkStillActive() {
      if (Date.now() < this.keepAliveUntil) return true;
      if (this.adapter.hasGenerationSignal()) return true;
      if (this.state === 'candidate') {
        const maxWaitMs = this.userInitiatedWait ? 120000 : 45000;
        return Date.now() - this.candidateStartedAt < maxWaitMs;
      }
      return this.hasActiveVisibleWorkOrGrace();
    }

    hasActiveVisibleWorkOrGrace() {
      if (isAiStillWorking(this.adapter)) {
        this.sawVisibleSignalDuringActive = true;
        this.markWorkActivity();
        this.activeSignalGraceUntil = 0;
        return true;
      }
      // Tiny grace only while we just lost the signal, to avoid flicker.
      if (this.activeSignalGraceUntil && Date.now() < this.activeSignalGraceUntil) return true;
      return false;
    }

    shouldActivateNow() {
      const elapsedMs = Date.now() - this.candidateStartedAt;
      if (elapsedMs < INITIAL_ACTIVATION_CHECK_MS) return { activate: false, wait: true };

      // Friend's core: activate when thinking is visible.
      // Also allow stop/streaming generation signals so ChatGPT doesn't miss the window.
      if (this.adapter.hasVisibleThinkingIndicator()) return { activate: true };
      if (this.adapter.hasVisibleGenerationSignal()) return { activate: true, keepAlive: true };

      const hasVisibleSignal = this.adapter.hasVisibleGenerationSignal();
      const hasVisibleStatusText = this.adapter.hasVisibleStatusText();
      const hasSignal = hasVisibleSignal || this.hadSignalDuringCandidate;
      if (
        this.firstTokenAt &&
        this.adapter.shouldSkipActivationAfterFirstToken() &&
        !hasVisibleStatusText
      ) {
        return { activate: false, wait: false };
      }
      if (!hasSignal && elapsedMs < SIGNALLESS_ACTIVATION_MS) {
        return { activate: false, wait: true };
      }

      // Prediction-backed activation: if we still expect wait remaining, keep waiting to activate.
      const remainingMs = (this.predictedEndAt || 0) - Date.now();
      if (remainingMs > 2500 && (hasSignal || this.userInitiatedWait)) {
        return { activate: false, wait: true };
      }

      const maxWaitMs = this.userInitiatedWait ? 120000 : 45000;
      const waitUntilMs = this.userInitiatedWait
        ? maxWaitMs
        : Math.min(maxWaitMs, Math.max(this.waitEstimate.totalMs, LONG_WAIT_FALLBACK_MS));
      if (elapsedMs < waitUntilMs) return { activate: false, wait: true };

      return { activate: false, wait: false };
    }

    hasActivationEvidence() {
      if (this.adapter.hasGenerationSignal()) return true;
      if (!this.userInitiatedWait) return false;
      if (Date.now() - this.candidateStartedAt < SIGNALLESS_ACTIVATION_MS) return false;
      // User sent a message and waited. Keep considering an ad unless streaming clearly finished.
      if (this.hadSignalDuringCandidate && Date.now() - this.lastWorkActivityAt > 4000) return false;
      return true;
    }

    recordNetworkActivity(kind) {
      if (this.state !== 'candidate' && this.state !== 'active') return;
      if (kind === 'chunk') {
        if (!this.firstTokenAt) this.firstTokenAt = Date.now();
      }
      this.markWorkActivity();
    }

    recordObservedWait() {
      if (this.observationRecorded || !this.candidateStartedAt) return;
      const totalMs = Date.now() - this.candidateStartedAt;
      const ttftMs = this.firstTokenAt ? this.firstTokenAt - this.candidateStartedAt : 0;
      recordWaitSample(this.adapter.id, { totalMs, ttftMs });
      this.observationRecorded = true;
    }

    resetPausedOnly() {
      this.state = 'idle';
      this.serverSessionId = null;
      this.currentViewId = null;
      this.viewStartedAt = 0;
      this.keepAliveUntil = 0;
      this.firstTokenAt = 0;
      this.observationRecorded = false;
      this.doneSinceAt = 0;
      this.activeSignalGraceUntil = 0;
      this.sawVisibleSignalDuringActive = false;
      this.stopPolling();
    }

    stopPolling() {
      if (this.pollTimer) clearInterval(this.pollTimer);
      this.pollTimer = null;
    }

    startAdTimer() {
      this.stopAdTimer();
      this.adStartedAt = Date.now();
      // Always play the FULL creative file. Do not cut to predictedEndAt mid-clip —
      // that left half the Claude wait empty. Chain another ad if AI is still working.
      const durationMs = Math.max(1000, (this.currentAd?.durationSeconds || 2) * 1000);

      this.adTimer = setInterval(() => {
        const now = Date.now();
        const progressRatio = Math.min((now - this.adStartedAt) / durationMs, 1);
        this.overlay.update({
          balance: this.balance,
          sessionCredits: this.sessionCredits,
          progressRatio,
        });

        if (this.shouldHideForFinishedAnswer()) {
          this.stopAdTimer();
          this.endSession();
          return;
        }

        if (this.candidateStartedAt && now - this.candidateStartedAt >= HARD_SESSION_CAP_MS) {
          this.stopAdTimer();
          this.endSession();
          return;
        }

        if (progressRatio >= 1) {
          this.stopAdTimer();
          if (this.waitClosed || !this.waitSessionId) {
            this.endSession();
            return;
          }
          // Chain only while the model is STILL generating. Never chain after answer done.
          if (isAiStillWorking(this.adapter) && !this.shouldHideForFinishedAnswer()) {
            let chainSeconds = chooseAdDurationSeconds(
              this.adapter.id,
              this.promptTokens,
              now - this.candidateStartedAt,
              this.promptText,
            );
            // Past prediction but stop/streaming still live → keep filling.
            if (!chainSeconds) chainSeconds = SHORTEST_CREATIVE_SEC;
            this.continueEarning(chainSeconds);
          } else {
            this.endSession();
          }
        }
      }, 40);
    }

    stopAdTimer() {
      if (this.adTimer) clearInterval(this.adTimer);
      this.adTimer = null;
    }

    clearCandidateTimer() {
      if (this.candidateTimer) clearTimeout(this.candidateTimer);
      this.candidateTimer = null;
    }

    reset() {
      // Preserve waitClosed / waitSessionId — those are per-prompt, not per-ad.
      const waitClosed = this.waitClosed;
      const waitSessionId = this.waitSessionId;
      const adsPlayed = this.adsPlayedThisWait;
      const sawStop = this.sawStopDuringWait;
      const promptTokens = this.promptTokens;
      const promptText = this.promptText;
      const candidateStartedAt = this.candidateStartedAt;
      const predictedEndAt = this.predictedEndAt;
      const sessionCredits = this.sessionCredits;

      this.state = 'idle';
      this.clientSessionId = null;
      this.serverSessionId = null;
      this.currentAd = null;
      this.currentViewId = null;
      this.viewStartedAt = 0;
      this.lastWorkActivityAt = 0;
      this.keepAliveUntil = 0;
      this.hadSignalDuringCandidate = false;
      this.userInitiatedWait = false;
      this.firstTokenAt = 0;
      this.observationRecorded = false;
      this.doneSinceAt = 0;
      this.activeSignalGraceUntil = 0;
      this.sawVisibleSignalDuringActive = false;
      this.activating = false;
      this.overlayShownAt = 0;
      this.stopPolling();

      this.waitClosed = waitClosed;
      this.waitSessionId = waitSessionId;
      this.adsPlayedThisWait = adsPlayed;
      this.sawStopDuringWait = sawStop;
      this.promptTokens = promptTokens;
      this.promptText = promptText;
      this.candidateStartedAt = candidateStartedAt;
      this.predictedEndAt = predictedEndAt;
      this.sessionCredits = sessionCredits;
      this.waitEstimate = estimateResponseTiming(this.adapter.id, this.promptTokens || 0, this.promptText || '');
    }
  }

  function escapeHtml(value) {
    return String(value).replace(/[&<>"']/g, (char) => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;',
    })[char]);
  }

  function escapeAttr(value) {
    return escapeHtml(value).replace(/`/g, '&#96;');
  }

  const overlay = new Overlay(adapter);
  const controller = new ActivationController(adapter, overlay);
  let lastGenerationIntentAt = 0;
  let pendingPromptTokens = 0;
  let pendingPromptText = '';

  function rememberPromptEstimate() {
    // ONLY the live composer text. Never fall back to the last user bubble —
    // that reused a previous long message and made "hi" look like an essay.
    const live = getCurrentPromptText(adapter);
    if (live) {
      pendingPromptText = live;
      pendingPromptTokens = estimateTokensFromText(live);
    }
    return { tokens: pendingPromptTokens, text: pendingPromptText };
  }

  function capturePromptForSend() {
    // Prefer live composer. If ChatGPT already cleared it, keep last typed pending.
    const live = getCurrentPromptText(adapter);
    if (live) {
      pendingPromptText = live;
      pendingPromptTokens = estimateTokensFromText(live);
    }
    return { tokens: pendingPromptTokens || 0, text: pendingPromptText || '' };
  }

  function markGenerationIntent() {
    lastGenerationIntentAt = Date.now();
  }

  function hasRecentGenerationIntent(windowMs = INTERACTION_WINDOW_MS) {
    return Date.now() - lastGenerationIntentAt <= windowMs;
  }

  onNetActivity = (detail = {}) => {
    // Never auto-open a wait after this prompt closed — only a new send can.
    if (controller.waitClosed && !hasRecentGenerationIntent(INTENT_TO_NETWORK_WINDOW_MS)) {
      controller.recordNetworkActivity(detail.kind);
      return;
    }
    if (controller.state === 'idle' && hasRecentGenerationIntent(INTENT_TO_NETWORK_WINDOW_MS) && !controller.waitClosed) {
      controller.beginCandidate(false, pendingPromptTokens, pendingPromptText);
    } else if (controller.state === 'paused' && hasRecentGenerationIntent() && adapter.hasGenerationSignal()) {
      controller.expandFromPaused();
    }
    controller.recordNetworkActivity(detail.kind);
  };

  function observeWhenReady(targetDoc, callback) {
    const start = () => {
      const root = targetDoc.body || targetDoc.documentElement;
      if (!root) {
        setTimeout(start, 50);
        return;
      }
      callback(root);
    };
    if (targetDoc.readyState === 'loading') {
      targetDoc.addEventListener('DOMContentLoaded', start, { once: true });
      // Fallback if DOMContentLoaded already fired in a weird SPA state.
      setTimeout(start, 0);
    } else {
      start();
    }
  }

  function bootUi() {
    // Show the pill immediately so the investor knows WHYL is alive on first load.
    try {
      overlay.ensureBadge();
      overlay.setBadge('WHYL on');
    } catch {
      /* ignore */
    }

    // Wake API early (Render cold start) so the first prompt is not the first network hit.
    sendMessage('ping').catch(() => {});

    // Answer background "are you alive?" so it can re-inject if this tab missed boot.
    try {
      chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
        if (message?.type === 'whylContentPing') {
          sendResponse({ ok: true, booted: true });
          return true;
        }
        return false;
      });
    } catch {
      /* ignore */
    }

    const observer = new MutationObserver(() => {
      if (controller.state === 'idle') return;
      // Instant hide when stop button flips off — don't wait for the poll tick.
      if (controller.hideIfAnswerFinished()) return;
      if (!adapter.hasGenerationSignal()) return;
      controller.markWorkActivity();
    });

    // Dedicated stop-button edge watcher — fires as soon as the control leaves the DOM.
    let lastStopVisible = hasStopControlVisible();
    const stopEdgeObserver = new MutationObserver(() => {
      const stopVisible = hasStopControlVisible();
      if (stopVisible) {
        controller.sawStopDuringWait = true;
        lastStopVisible = true;
        return;
      }
      if (lastStopVisible || controller.sawStopDuringWait) {
        lastStopVisible = false;
        controller.hideIfAnswerFinished();
        return;
      }
      lastStopVisible = false;
    });

    observeWhenReady(document, (root) => {
      try {
        observer.observe(root, {
          childList: true,
          subtree: true,
          characterData: true,
          attributes: true,
          attributeFilter: ['data-testid', 'aria-label', 'disabled', 'hidden', 'class', 'style'],
        });
        stopEdgeObserver.observe(root, {
          childList: true,
          subtree: true,
          attributes: true,
          attributeFilter: ['data-testid', 'aria-label', 'hidden', 'class', 'style', 'disabled'],
        });
      } catch {
        /* observe failed — polling still covers hide */
      }
    });

    // Capture prompt on pointerdown BEFORE ChatGPT clears the composer on click.
    document.addEventListener('pointerdown', (event) => {
      if (adapter.isSendTarget(event.target) || isLikelyWaitAction(event.target)) {
        rememberPromptEstimate();
      }
    }, { passive: true, capture: true });

    document.addEventListener('click', (event) => {
      if (isNewChatAction(event.target)) {
        lastGenerationIntentAt = 0;
        pendingPromptTokens = 0;
        pendingPromptText = '';
        overlay.clearAfterglowSlogan();
        controller.closeWaitSession();
        if (controller.state === 'candidate' || controller.state === 'active') controller.endSession();
        return;
      }

      if (adapter.isSendTarget(event.target) || isLikelyWaitAction(event.target)) {
        markGenerationIntent();
        controller.markWorkActivity();
        const prompt = capturePromptForSend();
        // New send always opens a fresh wait session (can show multiple ads while waiting).
        setTimeout(() => controller.beginCandidate(true, prompt.tokens, prompt.text), 200);
      }
    }, { passive: true });

    document.addEventListener('keydown', (event) => {
      if (event.key !== 'Enter' || event.shiftKey || event.isComposing) return;
      if (adapter.isComposerTarget(event.target)) {
        markGenerationIntent();
        const prompt = capturePromptForSend();
        setTimeout(() => controller.beginCandidate(true, prompt.tokens, prompt.text), 200);
      }
    }, { passive: true });

    // Keep prompt estimate fresh while typing — send often clears the composer first.
    document.addEventListener('input', (event) => {
      if (!adapter.isComposerTarget(event.target)) return;
      rememberPromptEstimate();
    }, { passive: true });

    document.addEventListener('keyup', (event) => {
      if (!adapter.isComposerTarget(event.target)) return;
      rememberPromptEstimate();
    }, { passive: true });

    // Auto assist only while a wait session is open — never after close (flicker fix).
    setInterval(() => {
      if (controller.waitClosed || !controller.waitSessionId) return;
      if (controller.state !== 'idle' && controller.state !== 'paused') return;
      if (!hasRecentGenerationIntent()) return;
      if (adapter.hasGenerationSignal()) controller.beginCandidate(false, pendingPromptTokens, pendingPromptText);
    }, 500);

    window.addEventListener('scroll', () => {
      if (overlay.dragging) return;
      if (!overlay.currentAd) return;
      overlay.position();
    }, { passive: true });
    window.addEventListener('resize', () => {
      if (overlay.dragging) return;
      if (!overlay.currentAd) return;
      overlay.position();
    }, { passive: true });
  }

  bootUi();
})();
