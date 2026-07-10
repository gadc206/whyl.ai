'use strict';

(function () {
  const INITIAL_ACTIVATION_CHECK_MS = 500;
  const ACTIVATION_RETRY_MS = 1000;
  const SIGNALLESS_ACTIVATION_MS = 4000;
  const LONG_WAIT_FALLBACK_MS = 12000;
  const USER_SIGNAL_GAP_CANCEL_MS = 60000;
  const WAIT_STATS_KEY = 'whyl_wait_stats_v1';
  const STALE_OPEN_STREAM_MS = 15000;
  const POLL_MS = 100; // backup poll; stop-button observer hides faster
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

  // Duration ladder of complete short ads (bumper spots), NOT trims of long videos.
  // Each file is authored to that exact length so wait-fit picks a real spot.
  const LAUNCH_CREATIVE_FILES = [
    { id: 'bumper-3s', advertiserName: 'Pulse', advertiserUrl: 'https://pulse.demo', title: 'Pulse', slogan: 'Ship faster. Think clearer.', description: '3s bumper.', file: 'media/bumper-3s.mp4', contentType: 'video', creditsPerView: 4, durationSeconds: 3 },
    { id: 'bumper-4s', advertiserName: 'Orbit', advertiserUrl: 'https://orbit.demo', title: 'Orbit', slogan: 'Your stack, in sync.', description: '4s bumper.', file: 'media/bumper-4s.mp4', contentType: 'video', creditsPerView: 5, durationSeconds: 4 },
    { id: 'bumper-5s', advertiserName: 'Nova', advertiserUrl: 'https://nova.demo', title: 'Nova', slogan: 'Launch with confidence.', description: '5s bumper.', file: 'media/bumper-5s.mp4', contentType: 'video', creditsPerView: 6, durationSeconds: 5 },
    { id: 'bumper-6s', advertiserName: 'Stack', advertiserUrl: 'https://stack.demo', title: 'Stack', slogan: 'Build once. Scale forever.', description: '6s bumper.', file: 'media/bumper-6s.mp4', contentType: 'video', creditsPerView: 7, durationSeconds: 6 },
    { id: 'bumper-7s', advertiserName: 'Relay', advertiserUrl: 'https://relay.demo', title: 'Relay', slogan: 'Messages that move work.', description: '7s bumper.', file: 'media/bumper-7s.mp4', contentType: 'video', creditsPerView: 8, durationSeconds: 7 },
    { id: 'bumper-8s', advertiserName: 'Factory', advertiserUrl: 'https://factory.ai', title: 'Factory 2.0', slogan: 'Software factories, not coding agents.', description: '8s bumper.', file: 'media/bumper-8s.mp4', contentType: 'video', creditsPerView: 9, durationSeconds: 8 },
    { id: 'bumper-9s', advertiserName: 'Lightwork', advertiserUrl: 'https://lightwork.ai', title: 'Lightwork', slogan: 'Work that moves itself.', description: '9s bumper.', file: 'media/bumper-9s.mp4', contentType: 'video', creditsPerView: 10, durationSeconds: 9 },
    { id: 'bumper-10s', advertiserName: 'Boardy', advertiserUrl: 'https://boardy.ai', title: 'Boardy Pro', slogan: 'AI that makes deals happen.', description: '10s bumper.', file: 'media/bumper-10s.mp4', contentType: 'video', creditsPerView: 11, durationSeconds: 10 },
    { id: 'bumper-12s', advertiserName: 'CrowdReply', advertiserUrl: 'https://crowdreply.io', title: 'Searchmaxxing', slogan: 'Be visible in AI answers.', description: '12s bumper.', file: 'media/bumper-12s.mp4', contentType: 'video', creditsPerView: 12, durationSeconds: 12 },
    { id: 'bumper-15s', advertiserName: 'Pulse', advertiserUrl: 'https://pulse.demo', title: 'Pulse Pro', slogan: 'Clarity in every sprint.', description: '15s bumper.', file: 'media/bumper-15s.mp4', contentType: 'video', creditsPerView: 13, durationSeconds: 15 },
    { id: 'lg-crowdreply', advertiserName: 'CrowdReply', advertiserUrl: 'https://crowdreply.io', title: 'Searchmaxxing', slogan: 'Be visible in AI answers.', description: 'Full launch.', file: 'media/crowdreply.mp4', contentType: 'video', creditsPerView: 14, durationSeconds: 25 },
    { id: 'lg-lightwork', advertiserName: 'Lightwork', advertiserUrl: 'https://lightwork.ai', title: 'Introducing Lightwork', slogan: 'Work that moves itself.', description: 'Full launch.', file: 'media/lightwork.mp4', contentType: 'video', creditsPerView: 15, durationSeconds: 28 },
    { id: 'lg-factory', advertiserName: 'Factory', advertiserUrl: 'https://factory.ai', title: 'Factory 2.0', slogan: 'Software factories, not coding agents.', description: 'Full launch.', file: 'media/factory.mp4', contentType: 'video', creditsPerView: 16, durationSeconds: 30 },
    { id: 'lg-boardy', advertiserName: 'Boardy', advertiserUrl: 'https://boardy.ai', title: 'Boardy Pro', slogan: 'AI that makes deals happen.', description: 'Full launch.', file: 'media/boardy.mp4', contentType: 'video', creditsPerView: 16, durationSeconds: 32 },
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

  // Always prefer bundled local MP4s so the player never depends on flaky CDNs.
  function ensurePlayableAd(ad, preferredSeconds = 15) {
    const fallback = pickLaunchCreative(preferredSeconds);
    if (!fallback) return null;
    if (!ad || ad.error) return fallback;
    const local = typeof ad.videoUrl === 'string' && ad.videoUrl.startsWith('chrome-extension://');
    // If server ad has no local file, use the duration-matched local creative.
    if (!local) return fallback;
    const fileSeconds = fallback.durationSeconds;
    return {
      ...fallback,
      ...ad,
      videoUrl: ad.videoUrl || fallback.videoUrl,
      thumbnailUrl: ad.thumbnailUrl || '',
      contentType: 'video',
      slogan: ad.slogan || fallback.slogan || sloganForAd(ad),
      // Clip length = real file length that was fitted to remaining wait.
      durationSeconds: fileSeconds,
    };
  }

  // Per-prompt wait prediction: TTFT(prefill) + decode(output/TPS) + live mode penalty.
  // No keyword blacklists — short text can still be deep research / tools and get a long wait.
  const PLATFORM_WAIT_DEFAULTS = {
    chatgpt: { ttftMs: 500, msPerInputToken: 0.2, tokensPerSecond: 45, baseOutput: 50, promptFactor: 2.5, toolPenaltyMs: 0 },
    claude: { ttftMs: 600, msPerInputToken: 0.22, tokensPerSecond: 40, baseOutput: 60, promptFactor: 2.7, toolPenaltyMs: 0 },
    gemini: { ttftMs: 450, msPerInputToken: 0.18, tokensPerSecond: 55, baseOutput: 45, promptFactor: 2.3, toolPenaltyMs: 0 },
    cursor: { ttftMs: 1000, msPerInputToken: 0.28, tokensPerSecond: 28, baseOutput: 220, promptFactor: 3.2, toolPenaltyMs: 6000 },
    replit: { ttftMs: 1100, msPerInputToken: 0.28, tokensPerSecond: 26, baseOutput: 200, promptFactor: 3.0, toolPenaltyMs: 5000 },
    grok: { ttftMs: 520, msPerInputToken: 0.18, tokensPerSecond: 50, baseOutput: 50, promptFactor: 2.4, toolPenaltyMs: 0 },
    manus: { ttftMs: 1500, msPerInputToken: 0.32, tokensPerSecond: 18, baseOutput: 450, promptFactor: 3.5, toolPenaltyMs: 15000 },
    lovable: { ttftMs: 1200, msPerInputToken: 0.28, tokensPerSecond: 24, baseOutput: 250, promptFactor: 3.2, toolPenaltyMs: 8000 },
    default: { ttftMs: 550, msPerInputToken: 0.2, tokensPerSecond: 40, baseOutput: 55, promptFactor: 2.5, toolPenaltyMs: 800 },
  };

  const DONE_HIDE_GRACE_MS = 0; // hide the instant stop disappears
  const PREDICTION_END_BUFFER_MS = 400;
  const HARD_SESSION_CAP_MS = 180000;
  // Only show an ad when remaining predicted wait can fit a real creative.
  const MIN_AD_MS = 3000; // shortest bumper is 3s
  // Under-estimate remaining wait so the chosen clip finishes before the answer.
  // Ads should fit inside the wait — never overrun it.
  const AD_FIT_SAFETY = 0.78;
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

  // Live mode signals dominate wait length — deep research on "hi" is still a long wait.
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
        'Researching', 'Searching', 'Browsing', 'Deep research', 'Calibrating',
        'Using tools', 'Reading sources', 'Collecting sources', 'Web search',
      ],
      useGlobalLiveStatus: true,
    })) {
      return { kind: 'tools_search', toolPenaltyMs: 28000, decodeMultiplier: 1.15 };
    }
    if (hasStopControlVisible() || netWorkingFresh(1200)) {
      return { kind: 'generating', toolPenaltyMs: 0, decodeMultiplier: 1 };
    }
    return { kind: 'default', toolPenaltyMs: 0, decodeMultiplier: 1 };
  }

  // Expected output scales with prompt size + soft content cues. Never forces skip/show.
  function expectedOutputTokens(defaults, inputTokens, promptText) {
    const text = String(promptText || '');
    let scaled = defaults.baseOutput + Math.round(Math.max(0, inputTokens) * defaults.promptFactor);

    if (LONG_OUTPUT_CUE_RE.test(text)) scaled = Math.round(scaled * 1.55);
    const wordCue = text.match(WORD_COUNT_CUE_RE);
    if (wordCue) {
      const n = Number(wordCue[1]);
      if (Number.isFinite(n)) {
        const unit = /pages?/i.test(wordCue[2]) ? 400 : /paragraphs?/i.test(wordCue[2]) ? 80 : 1;
        scaled = Math.max(scaled, Math.round(n * unit * 1.3));
      }
    }

    // Small prompts → small replies; no huge floor that invents wait for "hi".
    if (inputTokens <= 4) return clamp(scaled, 16, 90);
    if (inputTokens <= 12) return clamp(scaled, 40, 220);
    if (inputTokens <= 40) return clamp(scaled, 100, 650);
    if (inputTokens <= 100) return clamp(scaled, 180, 1200);
    return clamp(scaled, 280, 3200);
  }

  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
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

  // Ad length = remaining predicted wait, with a safety haircut so the clip
  // finishes before the answer. Pick the longest creative that still fits.
  // 0 = not enough depth — keep waiting / skip (no blip).
  function chooseAdDurationSeconds(platform, promptTokens, elapsedMs, promptText = '') {
    const estimate = estimateResponseTiming(platform, promptTokens, promptText);
    const rawRemainingMs = Math.max(
      0,
      (estimate.totalMs || 0) - Math.max(0, elapsedMs || 0) - PREDICTION_END_BUFFER_MS,
    );
    // Conservative fit window — never pick a clip longer than safe remaining wait.
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
    const candidates = document.querySelectorAll('button, [role="button"], div, section, article');
    for (const el of candidates) {
      if (!isVisible(el) || el.closest('#whyl-host, #whyl-status-pill, #whyl-status-stack, #whyl-ad-slogan')) continue;
      const text = (el.textContent || '').replace(/\s+/g, ' ').trim();
      if (!text || text.length > 420) continue;
      const looksLikeRunningResearch =
        /\b(researching|searching sources|reading sources|collecting sources|deep researching)\b/i.test(text);
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
    if (findVisible([
      'button[data-testid="stop-button"]',
      'button[data-testid*="stop-button"]',
      'button[aria-label*="Stop generating"]',
      'button[aria-label*="Stop streaming"]',
      'button[aria-label*="Stop response"]',
    ])) return true;
    return !!findVisibleControlText(['Stop generating', 'Stop streaming', 'Stop response', 'Stop research']);
  }

  // Hide decisions: stop-button edge is authoritative. Do not let stale network delay hide.
  function isAiStillWorking(adapterInstance) {
    if (hasStopControlVisible()) return true;

    if (adapterInstance?.id === 'claude') {
      const streaming = document.querySelector('[data-is-streaming="true"]');
      if (streaming && isVisible(streaming)) return true;
    }

    if (findDeepResearchPlan()) return true;
    // Fresh chunks only — never the long stale-open-stream window.
    if (netWorkingFresh(800)) return true;
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

  function sendMessage(type, data = {}) {
    return new Promise((resolve) => {
      chrome.runtime.sendMessage({ type, ...data }, (response) => {
        resolve(chrome.runtime.lastError ? { error: chrome.runtime.lastError.message } : response || {});
      });
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
      const ad = this.currentAd;
      const pending = Math.floor((ad.creditsPerView || 0) * this.progressRatio);
      const projectedSession = this.sessionCredits + pending;
      const progress = Math.max(0, Math.min(this.progressRatio * 100, 100));
      const bar = this.root.querySelector('.whyl-progress span');
      const tokens = this.root.querySelector('.whyl-footer strong');
      if (bar) bar.style.width = `${progress}%`;
      if (tokens) tokens.textContent = `+${projectedSession}`;
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
      const pending = Math.floor((ad.creditsPerView || 0) * this.progressRatio);
      const projectedSession = this.sessionCredits + pending;
      const progress = Math.max(0, Math.min(this.progressRatio * 100, 100));

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
            <strong>+${projectedSession}</strong>
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

      // Prefer blob: URL so host-page CSP cannot block chrome-extension media.
      const src = video.getAttribute('src') || video.src;
      if (src && src.startsWith('chrome-extension://') && !video.dataset.blobbed) {
        video.dataset.blobbed = '1';
        fetch(src)
          .then((res) => res.blob())
          .then((blob) => {
            const blobUrl = URL.createObjectURL(blob);
            video.src = blobUrl;
            video.load();
            video.addEventListener('loadeddata', playWithSoundPreference, { once: true });
            playWithSoundPreference();
          })
          .catch(() => {
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
    }

    openWaitSession(promptTokens = 0, promptText = '') {
      // New question — clear previous ad afterglow under the pill.
      this.overlay.clearAfterglowSlogan();
      this.waitSessionId = `${this.adapter.id}-wait-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;
      this.waitClosed = false;
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
      this.activeSignalGraceUntil = decision.keepAlive ? Date.now() + RESTORE_KEEPALIVE_MS : 0;
      // Refresh prediction at activation — live mode (deep research / tools) may have appeared.
      this.waitEstimate = estimateResponseTiming(this.adapter.id, this.promptTokens, this.promptText);
      this.predictedEndAt = predictedAnswerAt(this.candidateStartedAt, this.adapter.id, this.promptTokens, this.promptText);

      const auth = await sendMessage('getAuth');
      const loggedIn = !!auth.token;
      const fittedSeconds = chooseAdDurationSeconds(
        this.adapter.id,
        this.promptTokens,
        Date.now() - this.candidateStartedAt,
        this.promptText,
      );

      // Not enough remaining wait for a creative yet.
      if (!fittedSeconds) {
        // Answer already done → leave quietly (no blip).
        if (isAnswerFinished(this.adapter) || this.waitClosed) {
          this.closeWaitSession();
          this.reset();
          return;
        }
        // Still working — live mode may grow the estimate (deep research on a short prompt).
        // Stay in candidate and re-check; never flash an undersized ad.
        this.state = 'candidate';
        const maxWaitMs = this.userInitiatedWait ? HARD_SESSION_CAP_MS : 45000;
        if (Date.now() - this.candidateStartedAt < maxWaitMs && isAiStillWorking(this.adapter)) {
          this.candidateTimer = setTimeout(() => this.tryActivate(), ACTIVATION_RETRY_MS);
          return;
        }
        this.closeWaitSession();
        this.reset();
        return;
      }

      this.overlay.customPos = null;
      let ad = pickLaunchCreative(fittedSeconds);
      if (!ad) {
        this.state = 'candidate';
        if (isAiStillWorking(this.adapter) && Date.now() - this.candidateStartedAt < HARD_SESSION_CAP_MS) {
          this.candidateTimer = setTimeout(() => this.tryActivate(), ACTIVATION_RETRY_MS);
          return;
        }
        this.closeWaitSession();
        this.reset();
        return;
      }
      let balance = 0;

      if (loggedIn) {
        const summary = await sendMessage('getSummary');
        if (!summary.error) balance = summary.balance || 0;

        const session = await sendMessage('startSession', {
          platform: this.adapter.id,
          clientSessionId: this.clientSessionId,
          activationDelayMs: Date.now() - this.candidateStartedAt,
        });

        if (!session.error) {
          this.serverSessionId = session.sessionId;
          const nextAd = await sendMessage('getNextAd');
          if (!nextAd.error) ad = ensurePlayableAd(nextAd, fittedSeconds) || ad;
          if (!ad) {
            this.closeWaitSession();
            this.reset();
            return;
          }
          const view = await sendMessage('startView', {
            sessionId: this.serverSessionId,
            campaignId: ad.id,
            platform: this.adapter.id,
          });
          if (!view.error) this.currentViewId = view.viewId;
        }
      }

      ad = ensurePlayableAd(ad, fittedSeconds);
      if (!ad) {
        this.closeWaitSession();
        this.reset();
        return;
      }

      // If the answer already finished while we were fetching, don't flash an ad.
      if (isAnswerFinished(this.adapter) || this.waitClosed) {
        if (this.currentViewId) await this.completeCurrentView(false);
        if (this.serverSessionId) await sendMessage('endSession', { sessionId: this.serverSessionId });
        this.closeWaitSession();
        this.reset();
        return;
      }

      this.currentAd = ad;
      this.balance = balance;
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

      if (this.state === 'active' || this.state === 'finishing') {
        this.recordObservedWait();
        await this.completeCurrentView(false);
      }

      if (this.serverSessionId) {
        await sendMessage('endSession', { sessionId: this.serverSessionId });
        this.serverSessionId = null;
      }

      // Close this prompt's wait permanently — no auto re-show until next send.
      this.closeWaitSession();
      this.reset();
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

    async continueEarning() {
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

      const remainingMs = (this.predictedEndAt || 0) - Date.now();
      if (remainingMs < MIN_AD_MS) {
        await this.endSession();
        return;
      }

      this.markWorkActivity();
      await this.completeCurrentView(true);

      const fittedSeconds = chooseAdDurationSeconds(
        this.adapter.id,
        this.promptTokens,
        Date.now() - this.candidateStartedAt,
        this.promptText,
      );
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

    // Instant hide path used by stop-button MutationObserver + timers.
    shouldHideForFinishedAnswer() {
      const stopVisible = hasStopControlVisible();
      if (stopVisible) {
        this.sawStopDuringWait = true;
        this.doneSinceAt = 0;
        return false;
      }
      // Strongest finish signal: stop was visible, then disappeared.
      if (this.sawStopDuringWait && !netWorkingFresh(500)) return true;
      return !isAiStillWorking(this.adapter);
    }

    hideIfAnswerFinished() {
      if (this.waitClosed) return false;
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
      // Timer = the creative's real file length. Hide early if the answer finishes.
      // Never inflate past remaining wait, and never invent a longer runtime than the file.
      const fileMs = Math.max(1000, (this.currentAd?.durationSeconds || 2) * 1000);
      const remainingMs = Math.max(0, (this.predictedEndAt || 0) - Date.now());
      const durationMs = remainingMs > 0 ? Math.min(fileMs, remainingMs) : fileMs;
      if (this.currentAd) {
        this.currentAd.durationSeconds = Math.max(1, Math.round(durationMs / 1000));
      }

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
          // Chain another ad in the same wait session if still waiting and math allows.
          const chainSeconds = chooseAdDurationSeconds(
            this.adapter.id,
            this.promptTokens,
            now - this.candidateStartedAt,
            this.promptText,
          );
          if (
            !this.waitClosed &&
            this.waitSessionId &&
            isAiStillWorking(this.adapter) &&
            chainSeconds > 0
          ) {
            this.continueEarning();
          } else {
            this.endSession();
          }
        }
      }, 80);
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
    pendingPromptText = getCurrentPromptText(adapter) || pendingPromptText || '';
    pendingPromptTokens = estimateTokensFromText(pendingPromptText) || pendingPromptTokens || 0;
    return { tokens: pendingPromptTokens, text: pendingPromptText };
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
  const observer = new MutationObserver(() => {
    if (controller.state === 'idle') return;
    // Instant hide when stop button flips off — don't wait for the poll tick.
    if (controller.hideIfAnswerFinished()) return;
    if (!adapter.hasGenerationSignal()) return;
    controller.markWorkActivity();
  });
  observer.observe(document.body, {
    childList: true,
    subtree: true,
    characterData: true,
    attributes: true,
    attributeFilter: ['data-testid', 'aria-label', 'disabled', 'hidden', 'class', 'style'],
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
  stopEdgeObserver.observe(document.body, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ['data-testid', 'aria-label', 'hidden', 'class', 'style', 'disabled'],
  });

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
      const prompt = rememberPromptEstimate();
      // New send always opens a fresh wait session (can show multiple ads while waiting).
      setTimeout(() => controller.beginCandidate(true, prompt.tokens, prompt.text), 200);
    }
  }, { passive: true });

  document.addEventListener('keydown', (event) => {
    if (event.key !== 'Enter' || event.shiftKey || event.isComposing) return;
    if (adapter.isComposerTarget(event.target)) {
      markGenerationIntent();
      const prompt = rememberPromptEstimate();
      setTimeout(() => controller.beginCandidate(true, prompt.tokens, prompt.text), 200);
    }
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
})();
