'use strict';

(function () {
  const INITIAL_ACTIVATION_CHECK_MS = 500;
  const ACTIVATION_RETRY_MS = 1000;
  const SIGNALLESS_ACTIVATION_MS = 4000;
  const LONG_WAIT_FALLBACK_MS = 12000;
  const USER_SIGNAL_GAP_CANCEL_MS = 60000;
  const WAIT_STATS_KEY = 'whyl_wait_stats_v1';
  const STALE_OPEN_STREAM_MS = 15000;
  const POLL_MS = 300;
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

  // Real launch creatives from launchgallery.video (X/Twitter amplify MP4s).
  const LAUNCH_CREATIVES = [
    {
      id: 'lg-factory',
      advertiserName: 'Factory',
      advertiserUrl: 'https://factory.ai',
      title: 'Factory 2.0',
      description: 'From coding agents to software factories.',
      videoUrl: 'https://video.twimg.com/amplify_video/2066587985991413760/vid/avc1/1280x720/VmTP9cSkwe6DWJUd.mp4?tag=14',
      thumbnailUrl: 'https://pbs.twimg.com/amplify_video_thumb/2066587985991413760/img/RP0TnMdwXdgbWgHK.jpg',
      contentType: 'video',
      creditsPerView: 14,
      durationSeconds: 30,
      source: 'https://launchgallery.video/video/factory-factory-2-0-from-coding-agents-to-software-factories/',
    },
    {
      id: 'lg-lightwork',
      advertiserName: 'Lightwork',
      advertiserUrl: 'https://lightwork.ai',
      title: 'Introducing Lightwork',
      description: 'Launch Gallery startup launch cut.',
      videoUrl: 'https://video.twimg.com/amplify_video/2066581137703481344/vid/avc1/1280x720/cx_oabsQzIx4PSWI.mp4?tag=28',
      thumbnailUrl: 'https://pbs.twimg.com/amplify_video_thumb/2066581137703481344/img/CQafKQxRCH6LIXB2.jpg',
      contentType: 'video',
      creditsPerView: 12,
      durationSeconds: 30,
      source: 'https://launchgallery.video/video/lightwork-introducing-lightwork/',
    },
    {
      id: 'lg-boardy',
      advertiserName: 'Boardy',
      advertiserUrl: 'https://boardy.ai',
      title: 'Boardy Pro',
      description: 'AI that makes deals happen.',
      videoUrl: 'https://video.twimg.com/amplify_video/2066537570910003200/vid/avc1/1280x720/mVpAMbmVYV70U3wM.mp4?tag=28',
      thumbnailUrl: 'https://pbs.twimg.com/amplify_video_thumb/2066537570910003200/img/wTU48rtG4ijBspXb.jpg',
      contentType: 'video',
      creditsPerView: 12,
      durationSeconds: 30,
      source: 'https://launchgallery.video/video/boardy-boardy-pro-ai-that-makes-deals-happen/',
    },
    {
      id: 'lg-eden-1',
      advertiserName: 'Eden-1',
      advertiserUrl: 'https://eden-1.com',
      title: 'Meet Eden-1',
      description: 'YC-style launch energy.',
      videoUrl: 'https://video.twimg.com/amplify_video/2059649655382933504/vid/avc1/1280x720/EWZ9rrfJUkRlILCV.mp4?tag=27',
      thumbnailUrl: 'https://pbs.twimg.com/amplify_video_thumb/2059649655382933504/img/Wx2pw07MZa5xsXkK.jpg',
      contentType: 'video',
      creditsPerView: 12,
      durationSeconds: 30,
      source: 'https://launchgallery.video/video/eden-1-meet-eden-1-the-era-of-human-labour-is-coming-to-a-magnificent-end/',
    },
    {
      id: 'lg-sync-labs',
      advertiserName: 'Sync Labs',
      advertiserUrl: 'https://synclabs.so',
      title: 'Lipsync in production',
      description: 'Launch Gallery research launch.',
      videoUrl: 'https://video.twimg.com/amplify_video/2066588292225884160/vid/avc1/1280x720/FO4zeaJwHIxGKVIt.mp4?tag=28',
      thumbnailUrl: 'https://pbs.twimg.com/amplify_video_thumb/2066588292225884160/img/sD_7IN4AcjeRQ_Q6.jpg',
      contentType: 'video',
      creditsPerView: 12,
      durationSeconds: 30,
      source: 'https://launchgallery.video/video/sync-labs-lipsync-technology-now-in-production-to-unlock-stories/',
    },
    {
      id: 'lg-crowdreply',
      advertiserName: 'CrowdReply',
      advertiserUrl: 'https://crowdreply.io',
      title: 'Searchmaxxing',
      description: 'Visibility in AI answers.',
      videoUrl: 'https://video.twimg.com/amplify_video/2064363313048477696/vid/avc1/1280x720/raWVzgDsqohLBuGs.mp4?tag=27',
      thumbnailUrl: 'https://pbs.twimg.com/amplify_video_thumb/2064363313048477696/img/gTTUduvQKGwwB5ZX.jpg',
      contentType: 'video',
      creditsPerView: 12,
      durationSeconds: 30,
      source: 'https://launchgallery.video/video/crowdreply-introducing-searchmaxxing-visibility-in-ai-answers/',
    },
  ];

  const DEMO_AD = LAUNCH_CREATIVES[0];
  const FALLBACK_MP4 = 'https://storage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4';

  function pickLaunchCreative(preferredSeconds = 15) {
    const ranked = [...LAUNCH_CREATIVES].sort(
      (a, b) => Math.abs((a.durationSeconds || 15) - preferredSeconds) - Math.abs((b.durationSeconds || 15) - preferredSeconds),
    );
    const pick = ranked[Math.floor(Math.random() * Math.min(4, ranked.length))] || DEMO_AD;
    return { ...pick, durationSeconds: preferredSeconds };
  }

  // Always return a playable MP4. Prefer Launch Gallery creatives over broken API URLs.
  function ensurePlayableAd(ad, preferredSeconds = 15) {
    const fallback = pickLaunchCreative(preferredSeconds);
    if (!ad || ad.error) return fallback;
    const looksPlayable = typeof ad.videoUrl === 'string' && /\.mp4(\?|$)/i.test(ad.videoUrl);
    return {
      ...fallback,
      ...ad,
      videoUrl: looksPlayable ? ad.videoUrl : fallback.videoUrl,
      thumbnailUrl: ad.thumbnailUrl || fallback.thumbnailUrl,
      contentType: 'video',
      durationSeconds: preferredSeconds,
    };
  }

  // Per-prompt wait prediction: TTFT(prefill) + decode(output/TPS) + mode penalty,
  // blended with local observed averages. This clock drives ad length AND hide time.
  const PLATFORM_WAIT_DEFAULTS = {
    chatgpt: { ttftMs: 700, msPerInputToken: 0.22, tokensPerSecond: 58, baseOutput: 280, promptFactor: 0.55, toolPenaltyMs: 0 },
    claude: { ttftMs: 900, msPerInputToken: 0.24, tokensPerSecond: 52, baseOutput: 340, promptFactor: 0.6, toolPenaltyMs: 0 },
    gemini: { ttftMs: 650, msPerInputToken: 0.18, tokensPerSecond: 68, baseOutput: 260, promptFactor: 0.5, toolPenaltyMs: 0 },
    cursor: { ttftMs: 1200, msPerInputToken: 0.28, tokensPerSecond: 32, baseOutput: 700, promptFactor: 0.9, toolPenaltyMs: 8000 },
    replit: { ttftMs: 1300, msPerInputToken: 0.28, tokensPerSecond: 30, baseOutput: 650, promptFactor: 0.85, toolPenaltyMs: 7000 },
    grok: { ttftMs: 750, msPerInputToken: 0.2, tokensPerSecond: 62, baseOutput: 280, promptFactor: 0.5, toolPenaltyMs: 0 },
    manus: { ttftMs: 1800, msPerInputToken: 0.32, tokensPerSecond: 20, baseOutput: 1100, promptFactor: 1.1, toolPenaltyMs: 20000 },
    lovable: { ttftMs: 1400, msPerInputToken: 0.28, tokensPerSecond: 28, baseOutput: 800, promptFactor: 0.95, toolPenaltyMs: 10000 },
    default: { ttftMs: 900, msPerInputToken: 0.22, tokensPerSecond: 45, baseOutput: 320, promptFactor: 0.6, toolPenaltyMs: 1000 },
  };

  const DONE_HIDE_GRACE_MS = 500;
  const PREDICTION_END_BUFFER_MS = 400;

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
        'button[aria-label*="Stop"]',
        'button[title*="Stop"]',
        '[data-testid*="stop"]',
        '[aria-label*="Stop generating"]',
        '[aria-label*="Stop streaming"]',
        '[aria-busy="true"]',
        '[data-testid*="research"]',
        '[data-testid*="progress"]',
      ],
      thinkingIndicatorSelectors: [
        'button[data-testid="stop-button"]',
        'button[aria-label*="Stop"]',
        '[data-testid*="stop"]',
        '[aria-busy="true"]',
        '[data-testid*="research"]',
        '[data-testid*="progress"]',
        '[data-testid*="deep-research"]',
        '[class*="research"]',
        '[class*="progress"]',
        '[aria-label*="research"]',
        '[aria-label*="Research"]',
      ],
      thinkingText: ['Thinking', 'Reasoning', 'Generating', 'Calibrating'],
      liveText: WORKING_STATUS_WORDS,
      controlText: ['Stop', 'Stop generating', 'Stop streaming', 'Stop response', 'Stop research', 'Cancel'],
      assistantSelectors: ['[data-message-author-role="assistant"]', '[data-testid*="conversation-turn"]'],
      skipActivationAfterFirstToken: true,
      requireStatusTextForActivation: true,
      useNetworkSignal: false,
      allowGenerationElementAsThinkingAnchor: true,
      // ChatGPT deep research / searching often uses status copy that is not "Thinking".
      useGlobalLiveStatus: true,
      useGenericProgress: true,
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

  function estimateResponseTiming(platform, promptTokens) {
    const defaults = PLATFORM_WAIT_DEFAULTS[platform] || PLATFORM_WAIT_DEFAULTS.default;
    const inputTokens = Math.max(0, promptTokens || 0);

    // Exact industry formula used in serving systems:
    // total ≈ TTFT(prefill) + (expected_output_tokens / TPS)
    const ttftMs = defaults.ttftMs + (inputTokens * defaults.msPerInputToken);
    const expectedOutput = clamp(
      defaults.baseOutput + Math.round(inputTokens * defaults.promptFactor),
      120,
      2800,
    );
    let decodeMs = (expectedOutput / Math.max(defaults.tokensPerSecond, 1)) * 1000;
    let toolPenaltyMs = defaults.toolPenaltyMs || 0;

    // Mode multipliers when the UI shows long-running work.
    if (findDeepResearchPlan()) {
      toolPenaltyMs = Math.max(toolPenaltyMs, platform === 'chatgpt' || platform === 'claude' ? 75000 : 50000);
      decodeMs *= 1.35;
    } else if (hasVisibleStatusText({
      liveText: ['Researching', 'Searching', 'Browsing', 'Deep research', 'Calibrating', 'Using tools'],
      useGlobalLiveStatus: true,
    })) {
      toolPenaltyMs = Math.max(toolPenaltyMs, 25000);
    }

    let formulaMs = ttftMs + decodeMs + toolPenaltyMs;
    const observed = loadWaitStats()[platform];

    if (observed?.count >= 3 && observed.avgTotalMs > 0) {
      const observedWeight = observed.count >= 8 ? 0.7 : 0.45;
      formulaMs = formulaMs * (1 - observedWeight) + observed.avgTotalMs * observedWeight;
      return {
        totalMs: formulaMs,
        ttftMs,
        decodeMs,
        expectedOutput,
        source: 'observed',
      };
    }

    return {
      totalMs: formulaMs,
      ttftMs,
      decodeMs,
      expectedOutput,
      source: 'ttft+tps',
    };
  }

  // Pick an ad length that fits the remaining predicted wait for this prompt.
  const AD_DURATION_BUCKETS_SEC = [6, 8, 10, 12, 15, 20, 30];

  function chooseAdDurationSeconds(platform, promptTokens, elapsedMs) {
    const estimate = estimateResponseTiming(platform, promptTokens);
    // Keep a small buffer so the ad ends just before predicted answer time.
    const remainingMs = Math.max(0, (estimate.totalMs || 0) - Math.max(0, elapsedMs || 0) - PREDICTION_END_BUFFER_MS);
    let chosen = 0;
    for (const seconds of AD_DURATION_BUCKETS_SEC) {
      if (seconds * 1000 <= remainingMs) chosen = seconds;
    }
    if (findDeepResearchPlan() && remainingMs >= 18000) {
      chosen = Math.max(chosen, 15);
    }
    return chosen || 6;
  }

  // Absolute predicted end time for this prompt (from candidate start).
  function predictedAnswerAt(candidateStartedAt, platform, promptTokens) {
    const estimate = estimateResponseTiming(platform, promptTokens);
    return (candidateStartedAt || Date.now()) + Math.max(estimate.totalMs || 0, 6000);
  }

  function findDeepResearchPlan() {
    // Only treat deep research as "working" while it is actively running —
    // not when a finished plan card is still sitting in the transcript.
    const candidates = document.querySelectorAll('button, [role="button"], div, section, article');
    for (const el of candidates) {
      if (!isVisible(el) || el.closest('#whyl-host, #whyl-status-pill')) continue;
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
    return !!findVisibleControlText(['Stop', 'Stop generating', 'Stop streaming', 'Stop response', 'Stop research', 'Cancel']);
  }

  // Single coherent "AI is still working" signal used for keep + hide.
  function isAiStillWorking(adapterInstance) {
    if (hasStopControlVisible()) return true;
    if (netWorking()) return true;
    if (findDeepResearchPlan()) return true;
    if (findActiveProgressBar()) return true;
    if (findGlobalLiveStatusText()) return true;
    if (adapterInstance?.hasVisibleThinkingIndicator?.()) return true;
    if (adapterInstance?.hasVisibleGenerationSignal?.()) return true;
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
        if (!isVisible(el) || el.closest('#whyl-host, #whyl-status-pill')) continue;
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
      if (!isVisible(el) || el.closest('#whyl-host, #whyl-status-pill')) continue;
      if (isInsideAssistantMessage(el)) continue;
      const text = (el.textContent || '').replace(/\s+/g, ' ').trim();
      if (!text || text.length > 120 || DONE_STATUS_RE.test(text)) continue;
      if (GLOBAL_LIVE_STATUS_RE.test(text)) return el;
    }
    return null;
  }

  function findActiveProgressBar() {
    for (const el of document.querySelectorAll('[role="progressbar"], progress')) {
      if (!isVisible(el) || el.closest('#whyl-host, #whyl-status-pill')) continue;
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
      this.badge = null;
      this.currentAd = null;
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
      if (this.badge) return;
      this.badge = document.createElement('div');
      this.badge.id = 'whyl-status-pill';
      this.badge.innerHTML = this.badgeMarkup('on');
      this.badge.style.cssText = [
        'position:fixed',
        'top:18px',
        'left:50%',
        'transform:translateX(-50%)',
        'z-index:2147483645',
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
        'pointer-events:none',
        'opacity:0.96',
      ].join(';');
      document.documentElement.appendChild(this.badge);
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

    show(ad, options) {
      this.ensure();
      if (this.currentAd && this.currentAd.id !== ad?.id) this.stopMediaPlayback();
      this.currentAd = ad;
      this.sessionCredits = options.sessionCredits || 0;
      this.balance = options.balance || 0;
      this.progressRatio = options.progressRatio || 0;
      this.continueVisible = !!options.continueVisible;
      this.minimized = false;
      this.onContinue = options.onContinue || (() => {});
      this.onStop = options.onStop || (() => {});
      this.onRestore = options.onRestore || (() => {});
      this.render();
      const positioned = this.position();
      this.host.style.display = positioned || this.dragging ? 'block' : 'none';
      this.host.style.pointerEvents = 'auto';
      this.setBadge('WHYL earning', '#4ade80');
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

    hide() {
      this.stopMediaPlayback();
      if (this.host) {
        this.host.style.display = 'none';
        this.host.style.pointerEvents = 'none';
      }
      this.releaseReadingSpace();
      this.setBadge('WHYL ready');
    }

    position() {
      if (!this.host) return false;
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
      // Play video inside extension iframe so host-page CSP cannot block media.
      if (ad.videoUrl) {
        const playerUrl = chrome.runtime.getURL(`ad-player.html?url=${encodeURIComponent(ad.videoUrl)}`);
        return `
          <div class="whyl-video-wrap">
            <iframe
              class="whyl-video-frame"
              src="${escapeAttr(playerUrl)}"
              title="${escapeAttr(ad.title || 'Sponsored video')}"
              allow="autoplay; muted"
              loading="eager"
            ></iframe>
            <span class="whyl-mute-badge" aria-label="Video muted">MUTE</span>
          </div>
        `;
      }
      if (ad.thumbnailUrl) {
        return `<img src="${escapeAttr(ad.thumbnailUrl)}" alt="${escapeAttr(ad.title || 'Sponsored ad')}" loading="lazy" />`;
      }
      return `<div class="whyl-video-placeholder" aria-label="Sponsored video placeholder"></div>`;
    }

    ensureVideoPlaying() {
      // Iframe player handles autoplay; keep a no-op hook for direct <video> fallbacks.
      const video = this.root?.querySelector('video');
      if (!video) return;
      video.muted = true;
      video.playsInline = true;
      video.setAttribute('playsinline', '');
      video.setAttribute('webkit-playsinline', '');
      const play = () => {
        const result = video.play();
        if (result?.catch) result.catch(() => {});
      };
      if (video.readyState >= 2) play();
      else video.addEventListener('canplay', play, { once: true });
    }

    stopMediaPlayback() {
      if (!this.root) return;

      for (const media of this.root.querySelectorAll('video, audio')) {
        try {
          media.pause();
          media.removeAttribute('src');
          media.load();
        } catch {
          /* ignore media teardown errors */
        }
      }

      for (const frame of this.root.querySelectorAll('iframe')) {
        try {
          frame.src = 'about:blank';
          frame.removeAttribute('src');
        } catch {
          /* ignore cross-origin frame teardown errors */
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
      this.waitEstimate = estimateResponseTiming(this.adapter.id, 0);
      this.predictedEndAt = 0;
      this.firstTokenAt = 0;
      this.observationRecorded = false;
      this.doneSinceAt = 0;
      this.activeSignalGraceUntil = 0;
      this.sawVisibleSignalDuringActive = false;
    }

    beginCandidate(allowWithoutSignal = false, promptTokens = 0) {
      if (this.state === 'paused') {
        if (allowWithoutSignal) {
          this.overlay.hide();
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
      this.candidateStartedAt = Date.now();
      this.hadSignalDuringCandidate = false;
      this.userInitiatedWait = allowWithoutSignal;
      this.promptTokens = Math.max(0, promptTokens || 0);
      this.waitEstimate = estimateResponseTiming(this.adapter.id, this.promptTokens);
      this.predictedEndAt = predictedAnswerAt(Date.now(), this.adapter.id, this.promptTokens);
      this.firstTokenAt = 0;
      this.observationRecorded = false;
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
      // Refresh prediction at activation with elapsed time already spent waiting.
      this.waitEstimate = estimateResponseTiming(this.adapter.id, this.promptTokens);
      this.predictedEndAt = predictedAnswerAt(this.candidateStartedAt, this.adapter.id, this.promptTokens);

      const auth = await sendMessage('getAuth');
      const loggedIn = !!auth.token;
      const fittedSeconds = chooseAdDurationSeconds(
        this.adapter.id,
        this.promptTokens,
        Date.now() - this.candidateStartedAt,
      );
      this.overlay.customPos = null;
      let ad = pickLaunchCreative(fittedSeconds);
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
          if (!nextAd.error) ad = ensurePlayableAd(nextAd, fittedSeconds);
          const view = await sendMessage('startView', {
            sessionId: this.serverSessionId,
            campaignId: ad.id,
            platform: this.adapter.id,
          });
          if (!view.error) this.currentViewId = view.viewId;
        }
      }

      ad = ensurePlayableAd(ad, fittedSeconds);

      // If the answer already finished while we were fetching, don't flash an ad.
      if (isAnswerFinished(this.adapter) && Date.now() >= this.predictedEndAt) {
        if (this.currentViewId) await this.completeCurrentView(false);
        if (this.serverSessionId) await sendMessage('endSession', { sessionId: this.serverSessionId });
        this.overlay.hide();
        this.reset();
        return;
      }

      this.currentAd = ad;
      this.balance = balance;
      this.viewStartedAt = Date.now();
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

      if (this.state === 'active') {
        this.recordObservedWait();
        await this.completeCurrentView(false);
      }

      if (this.serverSessionId) {
        await sendMessage('endSession', { sessionId: this.serverSessionId });
      }

      this.overlay.hide();
      this.reset();
    }

    async finishToMini() {
      if (this.state !== 'active') return;
      this.state = 'finishing';
      this.clearCandidateTimer();
      this.stopAdTimer();
      this.recordObservedWait();

      await this.completeCurrentView(false);

      if (this.serverSessionId) {
        await sendMessage('endSession', { sessionId: this.serverSessionId });
        this.serverSessionId = null;
      }

      this.overlay.hide();
      this.reset();
    }

    async expandFromPaused() {
      if (this.state !== 'paused') return;
      if (!this.adapter.hasGenerationSignal()) return;

      this.state = 'active';
      this.candidateStartedAt = Date.now();
      this.promptTokens = 0;
      this.waitEstimate = estimateResponseTiming(this.adapter.id, 0);
      this.predictedEndAt = predictedAnswerAt(this.candidateStartedAt, this.adapter.id, 0);
      this.firstTokenAt = 0;
      this.observationRecorded = false;
      this.doneSinceAt = 0;
      this.activeSignalGraceUntil = 0;
      this.sawVisibleSignalDuringActive = false;
      this.clientSessionId = `${this.adapter.id}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
      this.markWorkActivity();
      this.keepAliveUntil = Date.now() + RESTORE_KEEPALIVE_MS;

      const auth = await sendMessage('getAuth');
      const loggedIn = !!auth.token;
      const fittedSeconds = chooseAdDurationSeconds(this.adapter.id, this.promptTokens, 0);
      let ad = this.currentAd || pickLaunchCreative(fittedSeconds);
      let balance = this.balance;

      if (loggedIn) {
        const summary = await sendMessage('getSummary');
        if (!summary.error) balance = summary.balance || balance;

        const session = await sendMessage('startSession', {
          platform: this.adapter.id,
          clientSessionId: this.clientSessionId,
          activationDelayMs: Date.now() - this.candidateStartedAt,
        });

        if (!session.error) {
          this.serverSessionId = session.sessionId;
          const nextAd = await sendMessage('getNextAd');
          if (!nextAd.error) ad = ensurePlayableAd(nextAd, fittedSeconds);
          const view = await sendMessage('startView', {
            sessionId: this.serverSessionId,
            campaignId: ad.id,
            platform: this.adapter.id,
          });
          if (!view.error) this.currentViewId = view.viewId;
        }
      }

      ad = ensurePlayableAd(ad, fittedSeconds);
      this.currentAd = ad;
      this.balance = balance;
      this.viewStartedAt = Date.now();
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

    async continueEarning() {
      if (this.state !== 'active') return;
      this.markWorkActivity();
      this.keepAliveUntil = Date.now() + RESTORE_KEEPALIVE_MS;
      await this.completeCurrentView(true);

      const fittedSeconds = chooseAdDurationSeconds(
        this.adapter.id,
        this.promptTokens,
        Date.now() - this.candidateStartedAt,
      );
      let ad = pickLaunchCreative(fittedSeconds);
      if (this.serverSessionId) {
        const nextAd = await sendMessage('getNextAd');
        if (!nextAd.error) ad = ensurePlayableAd(nextAd, fittedSeconds);
        const view = await sendMessage('startView', {
          sessionId: this.serverSessionId,
          campaignId: ad.id,
          platform: this.adapter.id,
        });
        if (!view.error) this.currentViewId = view.viewId;
      }

      ad = ensurePlayableAd(ad, fittedSeconds);
      this.currentAd = ad;
      this.viewStartedAt = Date.now();
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
            this.overlay.hide();
            this.reset();
          }
          return;
        }

        if (this.state === 'active') {
          if (!this.overlay.dragging) this.overlay.position();

          const now = Date.now();
          const pastPrediction = this.predictedEndAt && now >= this.predictedEndAt;
          const stillWorking = isAiStillWorking(this.adapter);

          // Primary clock: per-prompt prediction. Hide when predicted answer time hits
          // unless the AI is still clearly working (extend), or hide early if finished.
          if (!stillWorking) {
            if (!this.doneSinceAt) this.doneSinceAt = now;
            if (now - this.doneSinceAt >= DONE_HIDE_GRACE_MS || pastPrediction) {
              this.endSession();
              return;
            }
            return;
          }

          this.doneSinceAt = 0;
          if (pastPrediction) {
            // Still working past prediction — extend the clock and keep the ad.
            this.predictedEndAt = now + 8000;
          }
        }
      }, POLL_MS);
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
      this.promptTokens = 0;
      this.waitEstimate = estimateResponseTiming(this.adapter.id, 0);
      this.predictedEndAt = 0;
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
      // Ad length is the remaining predicted wait for this prompt.
      const remainingMs = Math.max(
        6000,
        (this.predictedEndAt || (Date.now() + 15000)) - Date.now(),
      );
      const durationMs = Math.min(
        Math.max((this.currentAd?.durationSeconds || 15) * 1000, 6000),
        remainingMs,
      );
      if (this.currentAd) this.currentAd.durationSeconds = Math.round(durationMs / 1000);

      this.adTimer = setInterval(() => {
        const progressRatio = Math.min((Date.now() - this.adStartedAt) / durationMs, 1);
        this.overlay.update({
          balance: this.balance,
          sessionCredits: this.sessionCredits,
          progressRatio,
        });

        // Hard stop at predicted answer time even mid-ad.
        if (this.predictedEndAt && Date.now() >= this.predictedEndAt && !isAiStillWorking(this.adapter)) {
          this.stopAdTimer();
          this.endSession();
          return;
        }

        if (progressRatio >= 1) {
          this.stopAdTimer();
          if (isAiStillWorking(this.adapter) && Date.now() < (this.predictedEndAt || 0) + 5000) {
            this.continueEarning();
          } else {
            this.endSession();
          }
        }
      }, 250);
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
      this.state = 'idle';
      this.candidateStartedAt = 0;
      this.clientSessionId = null;
      this.serverSessionId = null;
      this.currentAd = null;
      this.currentViewId = null;
      this.viewStartedAt = 0;
      this.sessionCredits = 0;
      this.lastWorkActivityAt = 0;
      this.keepAliveUntil = 0;
      this.hadSignalDuringCandidate = false;
      this.userInitiatedWait = false;
      this.promptTokens = 0;
      this.waitEstimate = estimateResponseTiming(this.adapter.id, 0);
      this.predictedEndAt = 0;
      this.firstTokenAt = 0;
      this.observationRecorded = false;
      this.doneSinceAt = 0;
      this.activeSignalGraceUntil = 0;
      this.sawVisibleSignalDuringActive = false;
      this.stopPolling();
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

  function rememberPromptEstimate() {
    pendingPromptTokens = estimateCurrentPromptTokens(adapter) || pendingPromptTokens || 0;
    return pendingPromptTokens;
  }

  function markGenerationIntent() {
    lastGenerationIntentAt = Date.now();
  }

  function hasRecentGenerationIntent(windowMs = INTERACTION_WINDOW_MS) {
    return Date.now() - lastGenerationIntentAt <= windowMs;
  }

  onNetActivity = (detail = {}) => {
    if (controller.state === 'idle' && hasRecentGenerationIntent(INTENT_TO_NETWORK_WINDOW_MS)) {
      controller.beginCandidate(true, pendingPromptTokens);
    } else if (controller.state === 'paused' && hasRecentGenerationIntent() && adapter.hasGenerationSignal()) {
      controller.expandFromPaused();
    }
    controller.recordNetworkActivity(detail.kind);
  };
  const observer = new MutationObserver(() => {
    if (controller.state === 'idle') return;
    if (!adapter.hasGenerationSignal()) return;
    controller.markWorkActivity();
  });
  observer.observe(document.body, { childList: true, subtree: true, characterData: true });

  document.addEventListener('click', (event) => {
    if (isNewChatAction(event.target)) {
      lastGenerationIntentAt = 0;
      pendingPromptTokens = 0;
      if (controller.state === 'candidate') controller.cancelCandidate();
      return;
    }

    if (adapter.isSendTarget(event.target) || isLikelyWaitAction(event.target)) {
      markGenerationIntent();
      controller.markWorkActivity();
      const promptTokens = rememberPromptEstimate();
      setTimeout(() => controller.beginCandidate(true, promptTokens), 250);
    }
  }, { passive: true });

  document.addEventListener('keydown', (event) => {
    if (event.key !== 'Enter' || event.shiftKey || event.isComposing) return;
    if (adapter.isComposerTarget(event.target)) {
      markGenerationIntent();
      const promptTokens = rememberPromptEstimate();
      setTimeout(() => controller.beginCandidate(true, promptTokens), 250);
    }
  }, { passive: true });

  // Start the hidden timing check from a live generation signal. The controller
  // decides whether the predicted remaining wait can fit a useful ad window.
  setInterval(() => {
    if (controller.state !== 'idle' && controller.state !== 'paused') return;
    if (!hasRecentGenerationIntent()) return;
    if (adapter.hasGenerationSignal()) controller.beginCandidate(false, pendingPromptTokens);
  }, 500);

  window.addEventListener('scroll', () => {
    if (!overlay.dragging) overlay.position();
  }, { passive: true });
  window.addEventListener('resize', () => {
    if (!overlay.dragging) overlay.position();
  }, { passive: true });
})();
