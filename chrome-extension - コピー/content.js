// THE TOLL - コンテンツスクリプト
// YouTubeをブロックし、スクワット完了でアンロック

console.log('[THE TOLL] Content script loaded: ' + window.location.href);

(function() {
  'use strict';

  // ============================================
  // 設定 - Supabaseの情報を入力してください
  // ============================================
  const SUPABASE_URL = 'https://qcnzleiyekbgsiyomwin.supabase.co';
  const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFjbnpsZWl5ZWtiZ3NpeW9td2luIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njg0Mjk2NzMsImV4cCI6MjA4NDAwNTY3M30.NlGUfxDPzMgtu_J0vX7FMe-ikxafboGh5GMr-tsaLfI';
  
  // スマホアプリのURL（HTTPSが必要！ngrokを使用推奨）
  const SMARTPHONE_APP_URL = 'https://smartphone-app-pi.vercel.app/';
  
  let GRACE_PERIOD_MS = 20 * 60 * 1000; // デフォルト20分
  let isLocked = true;
  let observer = null;
  let reLockTimer = null;
  let countdownHUD = null;
  const FREE_MAX_SITES = 5;
  const FREE_MIN_REPS = 20;
  const FREE_MAX_REPS = 40;
  let isProUser = false;
  let lastEntitlementFetch = 0;
  let activeSessionGraceDurationMin = null;
  let currentUiLang = 'en';
  const PRO_EXERCISE_REPS_PER_MIN = {
    squat: 2.0,
    pushup: 1.2,
    situp: 1.5,
  };
  const LOCK_UI_TEXT = {
    ja: {
      topMarquee: 'REFRESH RITUAL // UPDATE YOURSELF // 脳をリフレッシュしよう // BOOST YOUR ENERGY // 最高の集中への儀式 // RESET & RECHARGE //',
      ritualBadge: 'リフレッシュ儀式 // 01',
      headerDesc: '心身をリセットして、最高のコンディションで作業に戻りましょう。',
      scanTitle: '読み取りでリフレッシュ',
      scanSub: 'スキャンしてリフレッシュ開始',
      preparing: 'セッションを準備中...',
      sessionIdLabel: 'セッションID',
      rebootGoalLabel: '目標回数',
      rebootGoalLabelPro: '目標回数（種目別）',
      modeLabel: 'モード',
      messageLabel: 'メッセージ',
      goalUnit: '回',
      goalExerciseSquat: 'スクワット',
      goalExercisePushup: '腕立て',
      goalExerciseSitup: '腹筋',
      mode: 'リフレッシュして戻る',
      message: '身体を動かして脳をリセット。リフレッシュした状態で休憩を楽しみ、最高の状態で仕事に戻りましょう！',
      bottomMarquee: 'ENJOY YOUR BREAK // 休憩の後はもっと最高の集中を // DO IT FOR YOURSELF // 次のピークへ // BE THE BEST VERSION OF YOU //',
      waitingSquats: '運動開始を待機しています',
      retryingConnection: '接続を再試行中...',
      networkRetrying: 'ネットワークエラー - 再試行中...',
      connectionFailed: '接続失敗。ページを再読み込みしてください。',
      unlocking: 'スクワット完了! アンロック中...',
      relockSequence: '再ロックシーケンス開始',
      extensionUpdatedReload: '拡張機能が更新されました。ページを再読み込みしてください。'
    },
    en: {
      topMarquee: 'REFRESH RITUAL // UPDATE YOURSELF // REFRESH YOUR BRAIN // BOOST YOUR ENERGY // RITUAL FOR DEEP FOCUS // RESET & RECHARGE //',
      ritualBadge: 'REFRESH RITUAL // 01',
      headerDesc: 'Reset your body and mind, then return to work in top condition.',
      scanTitle: 'SCAN TO REFRESH',
      scanSub: 'Scan to start refresh',
      preparing: 'PREPARING YOUR SESSION...',
      sessionIdLabel: 'SESSION ID',
      rebootGoalLabel: 'REBOOT GOAL',
      rebootGoalLabelPro: 'GOALS BY EXERCISE',
      modeLabel: 'MODE',
      messageLabel: 'MESSAGE',
      goalUnit: 'REBOOTS',
      goalExerciseSquat: 'SQUAT',
      goalExercisePushup: 'PUSH-UP',
      goalExerciseSitup: 'SIT-UP',
      mode: 'REFRESH & RETURN',
      message: 'Move your body to reset your brain. Take a real break, then get back to work at your best.',
      bottomMarquee: 'ENJOY YOUR BREAK // LOCK IN DEEPER FOCUS AFTER THE BREAK // DO IT FOR YOURSELF // ON TO YOUR NEXT PEAK // BE THE BEST VERSION OF YOU //',
      waitingSquats: 'READY TO ASSIST - Waiting for exercise',
      retryingConnection: 'Retrying connection...',
      networkRetrying: 'Network error - Retrying...',
      connectionFailed: 'Connection failed. Please refresh.',
      unlocking: 'Squats complete! Unlocking...',
      relockSequence: 'RELOCK SEQUENCE INITIATED',
      extensionUpdatedReload: 'EXTENSION UPDATED. PLEASE RELOAD PAGE.'
    },
  };

  // ============================================
  // ユーティリティ関数
  // ============================================
  
  // UUID生成
  function generateSessionId() {
    return 'xxxx-xxxx'.replace(/x/g, () => {
      return Math.floor(Math.random() * 16).toString(16);
    }).toUpperCase();
  }

  // セッションIDの取得または生成 (非同期)
  async function getOrCreateSessionId() {
    if (!isExtensionContextValid()) return 'EXTENSION_INVALID';
    
    try {
      const data = await chrome.storage.local.get('toll_global_session_id');
      let sessionId = data.toll_global_session_id;
      
      if (!sessionId) {
        sessionId = generateSessionId();
        await chrome.storage.local.set({ 'toll_global_session_id': sessionId });
        debugLog('New Global Session ID generated: ' + sessionId);
      }
      return sessionId;
    } catch (e) {
      console.error('[THE TOLL] Error accessing storage for Session ID:', e);
      return generateSessionId(); // フォールバック
    }
  }

  function generateDeviceId() {
    return 'dev-' + Math.random().toString(36).slice(2, 12);
  }

  async function getOrCreateDeviceId() {
    if (!isExtensionContextValid()) return 'DEV_INVALID';
    try {
      const data = await chrome.storage.local.get('toll_device_id');
      let deviceId = data.toll_device_id;
      if (!deviceId) {
        deviceId = generateDeviceId();
        await chrome.storage.local.set({ toll_device_id: deviceId });
      }
      return deviceId;
    } catch (e) {
      return generateDeviceId();
    }
  }

  function isTrialActive(trialEndsAt) {
    if (!trialEndsAt) return false;
    const t = new Date(trialEndsAt).getTime();
    return Number.isFinite(t) && t > Date.now();
  }

  async function getOverlayUiLang() {
    try {
      if (isExtensionContextValid()) {
        const data = await chrome.storage.local.get('toll_ui_lang');
        const lang = data?.toll_ui_lang;
        if (lang === 'ja' || lang === 'en') return lang;
      }
    } catch (e) {
      // noop
    }
    return (navigator.language || 'en').toLowerCase().startsWith('ja') ? 'ja' : 'en';
  }

  function getLockTextByLang(lang) {
    return LOCK_UI_TEXT[lang] || LOCK_UI_TEXT.en;
  }

  function getLockTextFromOverlay(overlay) {
    const lang = overlay?.dataset?.uiLang === 'ja' ? 'ja' : 'en';
    return getLockTextByLang(lang);
  }

  function computeExerciseGoalsByDuration(durationMin) {
    const n = Number(durationMin);
    if (!Number.isFinite(n) || n <= 0) return null;
    const d = Math.max(1, Math.round(n));
    return {
      squat: Math.max(1, Math.ceil(d * PRO_EXERCISE_REPS_PER_MIN.squat)),
      pushup: Math.max(1, Math.ceil(d * PRO_EXERCISE_REPS_PER_MIN.pushup)),
      situp: Math.max(1, Math.ceil(d * PRO_EXERCISE_REPS_PER_MIN.situp)),
    };
  }

  function buildProGoalMarkup(uiText, durationMin) {
    const goals = computeExerciseGoalsByDuration(durationMin);
    if (!goals) return null;
    const rows = [
      [uiText.goalExerciseSquat || 'SQUAT', goals.squat],
      [uiText.goalExercisePushup || 'PUSH-UP', goals.pushup],
      [uiText.goalExerciseSitup || 'SIT-UP', goals.situp],
    ];
    return rows.map(([label, count]) =>
      `<span style="display:flex; justify-content:space-between; gap:12px; font-size:1.18rem; line-height:1.2; margin-bottom:6px;">` +
      `<span style="font-weight:800;">${label}</span><span style="font-weight:900; font-size:1.24rem;">${count}</span>` +
      `</span>`
    ).join('');
  }

  function applyOverlayGoalDisplay(shadow, uiText, targetCount, durationMin) {
    const labelEl = shadow.getElementById('toll-reboot-goal-label');
    const targetEl =
      shadow.getElementById('toll-target-count') ||
      shadow.querySelector('.scs-stat-stack .scs-stat-item-large:nth-child(2) .scs-stat-val');
    if (!targetEl) return;

    const proGoalMarkup = isProUser ? buildProGoalMarkup(uiText, durationMin) : null;
    if (proGoalMarkup) {
      if (labelEl) labelEl.textContent = uiText.rebootGoalLabelPro || uiText.rebootGoalLabel;
      targetEl.innerHTML = proGoalMarkup;
      targetEl.style.fontSize = '1.22rem';
      targetEl.style.lineHeight = '1.2';
      targetEl.style.whiteSpace = 'normal';
      return;
    }

    if (labelEl) labelEl.textContent = uiText.rebootGoalLabel;
    targetEl.textContent = `${targetCount} ${uiText.goalUnit}`;
    targetEl.style.fontSize = '2.2rem';
    targetEl.style.lineHeight = '';
    targetEl.style.whiteSpace = '';
  }

  async function applyOverlayLanguage(lang) {
    const nextLang = lang === 'ja' ? 'ja' : 'en';
    currentUiLang = nextLang;
    const host = document.getElementById('toll-overlay-host');
    if (!host?.shadowRoot) return false;

    const shadow = host.shadowRoot;
    const overlay = shadow.getElementById('toll-overlay');
    if (!overlay) return false;
    const t = getLockTextByLang(nextLang);
    overlay.dataset.uiLang = nextLang;

    shadow.querySelectorAll('.toll-top-marquee').forEach((el) => {
      el.textContent = t.topMarquee;
    });
    shadow.querySelectorAll('.toll-bottom-marquee').forEach((el) => {
      el.textContent = t.bottomMarquee;
    });

    const headerDesc = shadow.getElementById('toll-header-desc');
    if (headerDesc) headerDesc.textContent = t.headerDesc;
    const ritualBadge = shadow.getElementById('toll-ritual-badge');
    if (ritualBadge) ritualBadge.textContent = t.ritualBadge;
    const scanTitle = shadow.getElementById('toll-scan-title');
    if (scanTitle) scanTitle.textContent = t.scanTitle;
    const scanSub = shadow.getElementById('toll-scan-sub');
    if (scanSub) scanSub.textContent = t.scanSub;
    const sessionIdLabel = shadow.getElementById('toll-session-id-label');
    if (sessionIdLabel) sessionIdLabel.textContent = t.sessionIdLabel;
    const modeLabel = shadow.getElementById('toll-mode-label');
    if (modeLabel) modeLabel.textContent = t.modeLabel;
    const modeVal = shadow.getElementById('toll-mode-value');
    if (modeVal) modeVal.textContent = t.mode;
    const messageLabel = shadow.getElementById('toll-message-label');
    if (messageLabel) messageLabel.textContent = `${t.messageLabel}:`;
    const messageEl = shadow.getElementById('toll-main-message');
    if (messageEl) messageEl.textContent = t.message;
    const relockLabel = document.querySelector('.toll-countdown-hud .hud-label');
    if (relockLabel) relockLabel.textContent = t.relockSequence;

    const latest = await chrome.storage.local.get(['target_squat_count', 'lock_duration_min']);
    const targetCount = getEffectiveTargetCount(latest.target_squat_count);
    const durationMin = getEffectiveDurationMin(latest.lock_duration_min);
    applyOverlayGoalDisplay(shadow, t, targetCount, durationMin);

    const statusEl = shadow.querySelector('.toll-status');
    if (statusEl) {
      if (statusEl.classList.contains('connected')) {
        statusEl.textContent = t.waitingSquats;
      } else if (statusEl.classList.contains('unlocking')) {
        statusEl.textContent = t.unlocking;
      } else if (statusEl.classList.contains('connecting')) {
        statusEl.textContent = t.retryingConnection;
      }
    }

    return true;
  }

  function getEffectiveTargetCount(rawValue) {
    const raw = Number(rawValue) || 15;
    return isProUser
      ? Math.max(1, raw)
      : Math.min(FREE_MAX_REPS, Math.max(FREE_MIN_REPS, raw));
  }

  function getEffectiveDurationMin(rawValue) {
    const raw = Number(rawValue);
    if (isProUser) {
      const normalized = Number.isFinite(raw) ? raw : 20;
      return Math.max(10, Math.min(30, Math.round(normalized)));
    }
    if (!Number.isFinite(raw)) return 20;
    return raw <= 15 ? 10 : 20;
  }

  function setActiveSessionGraceDuration(rawValue) {
    const effective = getEffectiveDurationMin(rawValue);
    activeSessionGraceDurationMin = effective;
    return effective;
  }

  function buildSmartphoneAppUrl(sessionId, targetCount, durationMin, deviceId) {
    const qp = new URLSearchParams();
    qp.set('session', sessionId);
    if (Number.isFinite(Number(targetCount)) && Number(targetCount) > 0) {
      qp.set('target', String(Math.round(Number(targetCount))));
    }
    if (Number.isFinite(Number(durationMin)) && Number(durationMin) > 0) {
      qp.set('duration', String(Math.round(Number(durationMin))));
    }
    if (deviceId) {
      qp.set('device', String(deviceId));
    }
    return `${SMARTPHONE_APP_URL}?${qp.toString()}`;
  }

  async function getQrDeviceIdIfPcLoggedIn() {
    if (!isExtensionContextValid()) return '';
    try {
      const data = await chrome.storage.local.get(['toll_auth_logged_in']);
      if (data?.toll_auth_logged_in !== true) {
        return '';
      }
      return await getOrCreateDeviceId();
    } catch (_) {
      return '';
    }
  }

  async function refreshEntitlement(force = false) {
    const now = Date.now();
    if (!force && now - lastEntitlementFetch < 5 * 60 * 1000) return;
    lastEntitlementFetch = now;

    try {
      const deviceId = await getOrCreateDeviceId();
      const url = `${SUPABASE_URL}/rest/v1/device_links?device_id=eq.${encodeURIComponent(deviceId)}&select=plan_tier,subscription_status,trial_ends_at`;
      const res = await fetch(url, {
        headers: {
          apikey: SUPABASE_ANON_KEY,
          Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
        },
        cache: 'no-store',
      });
      if (!res.ok) {
        isProUser = false;
        return;
      }
      const rows = await res.json();
      const row = rows && rows[0];
      if (!row) {
        isProUser = false;
        return;
      }
      const sub = String(row.subscription_status || '').toLowerCase();
      isProUser = sub === 'active' || isTrialActive(row.trial_ends_at);
    } catch (e) {
      isProUser = false;
    }
  }

  let adultBlacklist = new Set();
  let adultBlacklistLoaded = false;

  async function loadAdultBlacklist() {
    if (adultBlacklistLoaded) return;
    try {
      const url = chrome.runtime.getURL('blocked_adult_sites.json');
      const response = await fetch(url);
      const data = await response.json();
      adultBlacklist = new Set(data.domains);
      adultBlacklistLoaded = true;
      debugLog(`Adult blacklist loaded: ${adultBlacklist.size} sites`);
    } catch (e) {
      console.error('[THE TOLL] Blacklist load failed:', e);
    }
  }

  // 拡張機能のコンテキストが有効かチェック
  function isExtensionContextValid() {
    return typeof chrome !== 'undefined' && chrome.runtime && !!chrome.runtime.id;
  }

  // ブロック対象サイトかチェック
  async function isCurrentSiteBlocked() {
    try {
      if (!isExtensionContextValid()) {
        console.warn('[THE TOLL] Extension context invalidated. Please reload the page.');
        return false;
      }
      
      const settings = await chrome.storage.local.get(['blocked_sites', 'custom_blocked_sites', 'adult_block_enabled']);
      const blockedSitesRaw = settings.blocked_sites || ['youtube.com'];
      const customSitesRaw = settings.custom_blocked_sites || [];
      const adultBlockEnabledRaw = settings.adult_block_enabled || false;
      const blockedSites = isProUser ? blockedSitesRaw : blockedSitesRaw.slice(0, FREE_MAX_SITES);
      const customSites = isProUser ? customSitesRaw : [];
      const adultBlockEnabled = !!adultBlockEnabledRaw;
      
      const currentHost = window.location.hostname.toLowerCase();
      
      // 1. プリセットとカスタムをチェック
      const allSites = [...blockedSites, ...customSites];
      const isManualBlocked = allSites.some(siteStr => {
        const domains = siteStr.split(',');
        return domains.some((domain) => {
          const normalized = domain.trim().toLowerCase();
          if (!normalized) return false;
          return currentHost === normalized || currentHost.endsWith(`.${normalized}`);
        });
      });
  
      if (isManualBlocked) return true;
  
      // 2. アダルトサイト一括ブロックが有効な場合
      if (adultBlockEnabled) {
        await loadAdultBlacklist();
        // サブドメインを剥がしてチェック (e.g. www.pornhub.com -> pornhub.com)
        const hostParts = currentHost.split('.');
        for (let i = 0; i < hostParts.length - 1; i++) {
          const domainToCheck = hostParts.slice(i).join('.');
          if (adultBlacklist.has(domainToCheck)) return true;
        }
      }
      
      return false;
    } catch (e) {
      console.error('[THE TOLL] Error checking blocked status:', e);
      return false;
    }
  }

  // 強制停止
  function forcePause() {
    if (!isLocked) return;
    const media = document.querySelectorAll('video, audio');
    media.forEach(m => {
      if (!m.paused) {
        m.pause();
        debugLog('Video/Audio forced to pause.');
      }
    });
  }

  // ビデオ要素の監視
  function startVideoMonitor() {
    if (observer) return;
    observer = new MutationObserver(() => {
      forcePause();
    });
    observer.observe(document.body, {
      childList: true,
      subtree: true
    });
    debugLog('Video monitor started.');
  }

  function stopVideoMonitor() {
    if (observer) {
      observer.disconnect();
      observer = null;
      debugLog('Video monitor stopped.');
    }
  }

  // ============================================
  // サウンドエフェクト（Web Audio API）
  // ============================================
  
  let audioContext = null;
  
  function initAudio() {
    try {
      audioContext = new (window.AudioContext || window.webkitAudioContext)();
    } catch (e) {
      console.warn('[THE TOLL] AudioContext初期化失敗');
    }
  }

  async function playTone(frequency, duration, type = 'sine', volume = 0.3) {
    if (!audioContext) return;
    
    // コンテキストが停止していたら再開を試みる
    if (audioContext.state === 'suspended') {
      try {
        await audioContext.resume();
      } catch (e) {
        console.warn('[THE TOLL] Audio resume failed:', e);
      }
    }

    try {
      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();
      
      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);
      
      oscillator.type = type;
      oscillator.frequency.value = frequency;
      gainNode.gain.value = volume;
      gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + duration);
      
      oscillator.start(audioContext.currentTime);
      oscillator.stop(audioContext.currentTime + duration);
    } catch (e) {
      console.warn('[THE TOLL] Error playing tone:', e);
    }
  }

  // ブロック時の警告音（短い下降チャイム）
  function playSoundBlock() {
    if (!audioContext) {
      initAudio();
      if (!audioContext) return;
    }
    
    // きついビープ感を避けるため、柔らかい波形で短く下降させる
    playTone(392, 0.12, 'triangle', 0.10); // G4
    setTimeout(() => playTone(330, 0.16, 'triangle', 0.12), 110); // E4
    setTimeout(() => playTone(196, 0.28, 'sine', 0.14), 240); // G3
  }

  // ============================================
  // オーバーレイ作成 (Shadow DOM使用)
  // ============================================
  
  async function createOverlay(sessionId) {
    // 既存のオーバーレイを削除
    const existingHost = document.getElementById('toll-overlay-host');
    if (existingHost) existingHost.remove();

    // ホスト要素の作成
    const host = document.createElement('div');
    host.id = 'toll-overlay-host';
    host.style.position = 'fixed';
    host.style.top = '0';
    host.style.left = '0';
    host.style.width = '100vw';
    host.style.height = '100vh';
    host.style.zIndex = '2147483647';
    host.style.border = 'none';

    // Shadow Rootの添付
    const shadow = host.attachShadow({ mode: 'open' });

    // CSSの読み込み (linkタグを使用する方がCSP制限を回避しやすい)
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = chrome.runtime.getURL('overlay.css');
    shadow.appendChild(link);

    // 古いfetchベースのコードは削除

    // オーバーレイ本体
    const overlay = document.createElement('div');
    overlay.id = 'toll-overlay';
    
    const settings = await chrome.storage.local.get(['target_squat_count', 'lock_duration_min']);
    const targetCount = getEffectiveTargetCount(settings.target_squat_count);
    const durationMin = setActiveSessionGraceDuration(settings.lock_duration_min);
    const uiLang = await getOverlayUiLang();
    currentUiLang = uiLang;
    const t = getLockTextByLang(uiLang);
    const qrDeviceId = await getQrDeviceIdIfPcLoggedIn();
    const appUrl = buildSmartphoneAppUrl(sessionId, targetCount, durationMin, qrDeviceId);
    overlay.dataset.uiLang = uiLang;
    
    overlay.innerHTML = `
      <div class="scs-hero-container">
        <!-- Top Marquee -->
        <div class="toll-marquee-container">
          <div class="scs-marquee">
            <span class="toll-top-marquee">${t.topMarquee}</span>
            <span class="toll-top-marquee">${t.topMarquee}</span>
          </div>
        </div>

        <!-- Header (Compact) -->
        <div class="toll-header" style="padding: 25px 40px; border-bottom: 4px solid var(--pop-black);">
          <span id="toll-ritual-badge" class="scs-badge" style="margin-bottom: 0;">${t.ritualBadge}</span>
          <span id="toll-header-desc" class="scs-jp-mini dark" style="margin-left: 20px; font-size: 1.1rem; display: inline-block; font-weight: 800;">${t.headerDesc}</span>
        </div>

        <!-- Main Grid: QR & Core Info -->
        <div class="scs-grid" style="grid-template-columns: 50% 50%;">
          <!-- Left: QR Code -->
          <div class="scs-cell content" style="border-right: 6px solid var(--pop-black); background: var(--pop-white);">
            <h3 class="scs-title" style="margin-bottom: 20px;">
              <span id="toll-scan-title">${t.scanTitle}</span>
              <span id="toll-scan-sub" class="scs-jp-mini" style="display:block; margin-top:5px; font-size:0.6em; color: #888;">${t.scanSub}</span>
            </h3>
            <div class="toll-qr-container" style="box-shadow: 15px 15px 0px var(--pop-black); padding: 25px;">
              <div id="toll-qrcode"></div>
            </div>
            <p class="toll-status connecting" style="margin-top: 20px; width: 100%; text-align: center;">${t.preparing}</p>
          </div>

          <!-- Right: Core Stats -->
          <div class="scs-cell stats-primary" style="background: var(--pop-blue); padding: 40px;">
            <div class="scs-stat-stack">
              <div class="scs-stat-item-large" style="margin-bottom: 30px;">
                <span id="toll-session-id-label" class="scs-stat-label" style="font-size: 1rem; color: var(--pop-black); opacity: 0.7;">${t.sessionIdLabel}</span>
                <span class="scs-stat-val toll-session-id" style="font-size: 2.2rem; display: block; border-bottom: 4px solid var(--pop-black); padding-bottom: 5px;">${sessionId}</span>
              </div>
              <div class="scs-stat-item-large" style="margin-bottom: 30px;">
                <span id="toll-reboot-goal-label" class="scs-stat-label" style="font-size: 1rem; color: var(--pop-black); opacity: 0.7;">${t.rebootGoalLabel}</span>
                <span id="toll-target-count" class="scs-stat-val" style="font-size: 2.2rem; display: block; border-bottom: 4px solid var(--pop-black); padding-bottom: 5px;">${targetCount} ${t.goalUnit}</span>
              </div>
              <div class="scs-stat-item-large">
                <span id="toll-mode-label" class="scs-stat-label" style="font-size: 1rem; color: var(--pop-black); opacity: 0.7;">${t.modeLabel}</span>
                <span id="toll-mode-value" class="scs-stat-val" style="font-size: 2.2rem; display: block; color: var(--pop-black);">${t.mode}</span>
              </div>
            </div>
            
            <p class="scs-tech-note" style="margin-top: 40px; background: rgba(255,255,255,0.3); border-left-color: var(--pop-black); color: var(--pop-black); font-weight: 700; font-size: 1.4rem; line-height: 1.5;">
              <strong id="toll-message-label">${t.messageLabel}:</strong> <span id="toll-main-message">${t.message}</span>
            </p>
          </div>
        </div>

        <!-- Bottom Marquee -->
        <div class="toll-marquee-container bottom">
          <div class="scs-marquee reverse">
             <span class="toll-bottom-marquee">${t.bottomMarquee}</span>
             <span class="toll-bottom-marquee">${t.bottomMarquee}</span>
          </div>
        </div>
      </div>
    `;
    
    shadow.appendChild(overlay);
    applyOverlayGoalDisplay(shadow, t, targetCount, durationMin);
    
    // ホストをページに挿入
    if (document.body) {
      document.body.appendChild(host);
    } else {
      document.addEventListener('DOMContentLoaded', () => {
        document.body.appendChild(host);
      });
    }
    
    // QRコード生成 (Shadow DOM内でも動作するように微調整が必要な場合がある)
    setTimeout(() => {
      const qrcodeElement = shadow.getElementById('toll-qrcode');
      if (qrcodeElement && typeof QRCode !== 'undefined') {
        new QRCode(qrcodeElement, {
          text: appUrl,
          width: 220,
          height: 220,
          colorDark: '#1a1a2e',
          colorLight: '#ffffff',
          correctLevel: QRCode.CorrectLevel.M
        });
      }
      
      playSoundBlock();
    }, 100);
    
    return overlay;
  }

  async function refreshActiveOverlayTarget(rawTargetValue, rawDurationValue) {
    const host = document.getElementById('toll-overlay-host');
    if (!host || !host.shadowRoot || !isLocked) return { ok: false, reason: 'no_active_lock' };

    const shadow = host.shadowRoot;
    const overlayEl = shadow.getElementById('toll-overlay');
    const uiText = getLockTextFromOverlay(overlayEl);
    const sessionIdEl =
      shadow.querySelector('.toll-session-id') ||
      shadow.querySelector('.scs-stat-stack .scs-stat-item-large:first-child .scs-stat-val');
    const sessionId = (sessionIdEl?.textContent || '').trim();
    if (!sessionId) return { ok: false, reason: 'missing_session_id' };

    const targetCount = getEffectiveTargetCount(rawTargetValue);
    const durationMin = setActiveSessionGraceDuration(rawDurationValue);

    applyOverlayGoalDisplay(shadow, uiText, targetCount, durationMin);

    const noteStrong = shadow.querySelector('.scs-tech-note strong');
    if (noteStrong) noteStrong.textContent = `${uiText.messageLabel}:`;

    const qrcodeElement = shadow.getElementById('toll-qrcode');
    if (!qrcodeElement || typeof QRCode === 'undefined') {
      return { ok: false, reason: 'missing_qr' };
    }

    const qrDeviceId = await getQrDeviceIdIfPcLoggedIn();
    const appUrl = buildSmartphoneAppUrl(sessionId, targetCount, durationMin, qrDeviceId);
    qrcodeElement.innerHTML = '';
    new QRCode(qrcodeElement, {
      text: appUrl,
      width: 220,
      height: 220,
      colorDark: '#1a1a2e',
      colorLight: '#ffffff',
      correctLevel: QRCode.CorrectLevel.M
    });
    debugLog(`Active session target updated: ${targetCount}`);
    return { ok: true, sessionId, targetCount, graceMin: durationMin };
  }

  // ステータス更新
  function updateStatus(overlay, message, className) {
    const status = overlay.querySelector('.toll-status');
    if (status) {
      status.textContent = message;
      status.className = 'toll-status ' + className;
    }
  }

  // ページアンロック
  async function unlockPage(overlay) {
    console.log('[THE TOLL] アンロック実行！');
    overlay.classList.add('unlocking');
    isLocked = false;
    stopVideoMonitor();

    // グローバルな解除時刻と有効期限を保存 (全てのタブで共有)
    const now = Date.now();
    const durationMin = Number.isFinite(activeSessionGraceDurationMin) && activeSessionGraceDurationMin > 0
      ? activeSessionGraceDurationMin
      : getEffectiveDurationMin((await chrome.storage.local.get('lock_duration_min')).lock_duration_min);
    const expirationTime = now + (durationMin * 60 * 1000);
    await chrome.storage.local.set({
      last_global_unlock_time: now,
      last_global_unlock_expires_at: expirationTime,
    });
    // セッションIDをクリア（次回のロック時に新しいIDを生成させるため）
    await chrome.storage.local.remove('toll_global_session_id');
    activeSessionGraceDurationMin = null;

    // 再ロックタイマーをセット
    scheduleReLock(expirationTime);

    setTimeout(() => {
      const host = document.getElementById('toll-overlay-host');
      if (host) host.remove();
    }, 500);
  }

  // 再ロックのスケジュール設定
  async function scheduleReLock(expirationTime) {
    if (reLockTimer) clearTimeout(reLockTimer);
    
    const now = Date.now();
    const timeRemaining = expirationTime - now;

    if (timeRemaining <= 0) {
      await chrome.storage.local.remove(['last_global_unlock_time', 'last_global_unlock_expires_at']);
      lockPage();
      return;
    }

    // 1. カウントダウンHUDを解除直後から表示
    startCountdownTimer(expirationTime);

    // 2. 実際の再ロック
    reLockTimer = setTimeout(async () => {
      await chrome.storage.local.remove(['last_global_unlock_time', 'last_global_unlock_expires_at']);
      lockPage();
    }, timeRemaining);
  }

  let countdownInterval = null;
  let currentExpireTime = 0; // 現在表示中のタイマーの期限
  let countdownDisplayMode = 'mini'; // full | mini | hidden
  let countdownRestoreBtn = null;
  let countdownHudPosition = null; // { left, top }

  function clampToViewport(left, top, width, height, margin = 8) {
    const vw = window.innerWidth || document.documentElement.clientWidth || 1280;
    const vh = window.innerHeight || document.documentElement.clientHeight || 720;
    const maxLeft = Math.max(margin, vw - width - margin);
    const maxTop = Math.max(margin, vh - height - margin);
    return {
      left: Math.min(maxLeft, Math.max(margin, left)),
      top: Math.min(maxTop, Math.max(margin, top)),
    };
  }

  function applyCountdownHudPosition() {
    if (!countdownHUD || !countdownHudPosition) return;
    const rect = countdownHUD.getBoundingClientRect();
    const clamped = clampToViewport(
      countdownHudPosition.left,
      countdownHudPosition.top,
      rect.width || 220,
      rect.height || 80
    );
    countdownHudPosition = clamped;
    countdownHUD.style.left = `${clamped.left}px`;
    countdownHUD.style.top = `${clamped.top}px`;
    countdownHUD.style.right = 'auto';
    countdownHUD.classList.add('user-positioned');
  }

  function makeElementDraggable(targetEl, handleEl) {
    if (!targetEl || !handleEl || handleEl.dataset.dragBound === '1') return;
    handleEl.dataset.dragBound = '1';
    handleEl.style.touchAction = 'none';
    handleEl.style.cursor = 'move';

    handleEl.addEventListener('pointerdown', (ev) => {
      if (ev.button !== undefined && ev.button !== 0) return;
      if (ev.target && ev.target.closest && ev.target.closest('.hud-control-btn')) return;
      ev.preventDefault();

      const rect = targetEl.getBoundingClientRect();
      const offsetX = ev.clientX - rect.left;
      const offsetY = ev.clientY - rect.top;
      targetEl.classList.add('dragging');
      try { handleEl.setPointerCapture(ev.pointerId); } catch (_) {}

      const onMove = (moveEv) => {
        const rawLeft = moveEv.clientX - offsetX;
        const rawTop = moveEv.clientY - offsetY;
        const clamped = clampToViewport(
          rawLeft,
          rawTop,
          rect.width || targetEl.offsetWidth || 220,
          rect.height || targetEl.offsetHeight || 80
        );
        countdownHudPosition = clamped;
        targetEl.style.left = `${clamped.left}px`;
        targetEl.style.top = `${clamped.top}px`;
        targetEl.style.right = 'auto';
        targetEl.classList.add('user-positioned');
      };

      const onUp = () => {
        targetEl.classList.remove('dragging');
        document.removeEventListener('pointermove', onMove);
        document.removeEventListener('pointerup', onUp);
        document.removeEventListener('pointercancel', onUp);
      };

      document.addEventListener('pointermove', onMove);
      document.addEventListener('pointerup', onUp);
      document.addEventListener('pointercancel', onUp);
    });
  }

  function removeCountdownRestoreButton() {
    if (countdownRestoreBtn) {
      countdownRestoreBtn.remove();
      countdownRestoreBtn = null;
    }
  }

  function showCountdownRestoreButton() {
    if (countdownRestoreBtn) return;
    countdownRestoreBtn = document.createElement('button');
    countdownRestoreBtn.type = 'button';
    countdownRestoreBtn.className = 'toll-countdown-restore';
    const isJa = currentUiLang === 'ja';
    countdownRestoreBtn.textContent = isJa ? 'タイマー' : 'TIMER';
    countdownRestoreBtn.title = isJa ? 'タイマーを表示' : 'Show timer';
    countdownRestoreBtn.addEventListener('click', () => {
      countdownDisplayMode = 'mini';
      applyCountdownMode(currentExpireTime);
    });
    document.body.appendChild(countdownRestoreBtn);
    makeElementDraggable(countdownRestoreBtn, countdownRestoreBtn);
  }

  function applyCountdownMode(expireTime) {
    if (!countdownHUD) return;
    const remaining = Math.floor((expireTime - Date.now()) / 1000);
    const withinLastMinute = remaining <= 60;

    if (withinLastMinute) {
      countdownHUD.classList.remove('mini', 'hidden-user');
      countdownDisplayMode = 'full';
      removeCountdownRestoreButton();
      return;
    }

    countdownHUD.classList.remove('mini', 'hidden-user');
    if (countdownDisplayMode === 'mini') {
      countdownHUD.classList.add('mini');
      removeCountdownRestoreButton();
      return;
    }
    if (countdownDisplayMode === 'hidden') {
      countdownHUD.classList.add('hidden-user');
      showCountdownRestoreButton();
      return;
    }
    removeCountdownRestoreButton();
  }

  function clearCountdownUi() {
    if (countdownHUD) { countdownHUD.remove(); countdownHUD = null; }
    if (countdownInterval) { clearInterval(countdownInterval); countdownInterval = null; }
    removeCountdownRestoreButton();
    countdownDisplayMode = 'mini';
    currentExpireTime = 0;
  }

  // カウントダウンHUDの管理
  function startCountdownTimer(expireTime) {
    // 既に同じ期限のタイマーが動いていて、HUDも存在する場合は作り直さない（チラつき・巻き戻り防止）
    if (countdownHUD && countdownInterval && currentExpireTime === expireTime) {
      return; 
    }

    if (countdownHUD) countdownHUD.remove();
    if (countdownInterval) clearInterval(countdownInterval);
    removeCountdownRestoreButton();
    
    currentExpireTime = expireTime; // 期限を記憶
    const remainingAtStart = Math.floor((expireTime - Date.now()) / 1000);
    if (remainingAtStart > 60 && countdownDisplayMode === 'full') {
      countdownDisplayMode = 'mini';
    }

    countdownHUD = document.createElement('div');
    const t = getLockTextByLang(currentUiLang);
    countdownHUD.className = 'toll-countdown-hud';
    countdownHUD.innerHTML = `
      <div class="hud-head">
        <div class="hud-label">${t.relockSequence}</div>
        <div class="hud-controls">
          <button type="button" class="hud-control-btn" data-mode="mini" title="${currentUiLang === 'ja' ? '最小化' : 'Minimize'}">_</button>
          <button type="button" class="hud-control-btn" data-mode="hidden" title="${currentUiLang === 'ja' ? '非表示' : 'Hide'}">×</button>
        </div>
      </div>
      <div class="hud-timer"><span id="hud-min">00</span>:<span id="hud-sec">00</span></div>
    `;
    countdownHUD.querySelectorAll('.hud-control-btn').forEach((btn) => {
      btn.addEventListener('pointerdown', (e) => e.stopPropagation());
      btn.addEventListener('click', () => {
        const mode = btn.dataset.mode;
        if (mode === 'mini') {
          countdownDisplayMode = countdownDisplayMode === 'mini' ? 'full' : 'mini';
          applyCountdownMode(currentExpireTime);
          return;
        }
        if (mode === 'hidden') {
          countdownDisplayMode = 'hidden';
          applyCountdownMode(currentExpireTime);
        }
      });
    });
    document.body.appendChild(countdownHUD);
    const dragHandle = countdownHUD.querySelector('.hud-head') || countdownHUD;
    makeElementDraggable(countdownHUD, dragHandle);
    applyCountdownHudPosition();

    // 初回即時更新
    updateTimerDisplay(expireTime);

    countdownInterval = setInterval(() => {
      updateTimerDisplay(expireTime);
    }, 1000);
  }

  function updateTimerDisplay(expireTime) {
      const now = Date.now();
      const remaining = Math.floor((expireTime - now) / 1000);

      if (remaining <= 0) {
        clearCountdownUi();
        return;
      }

      if (countdownHUD) {
        countdownHUD.classList.toggle('warning', remaining <= 10);
      }
      applyCountdownMode(expireTime);

      const m = Math.floor(remaining / 60).toString().padStart(2, '0');
      const s = (remaining % 60).toString().padStart(2, '0');
      
      const minEl = document.getElementById('hud-min');
      const secEl = document.getElementById('hud-sec');
      if (minEl) minEl.textContent = m;
      if (secEl) secEl.textContent = s;
  }

  // ページをロック状態にする
  async function lockPage() {
    const host = document.getElementById('toll-overlay-host');
    if (isLocked && host) return;
    
    debugLog('Locking page now...');
    isLocked = true;
    
    // ホストがなければ作成
    if (!host) {
      const sessionId = await getOrCreateSessionId();
      debugLog('Creating overlay for session: ' + sessionId);
      const newOverlay = await createOverlay(sessionId);
      
      // 監視と制限を開始
      forcePause();
      startVideoMonitor();
      startPolling(sessionId, newOverlay);
    }
  }

  // ============================================
  // Supabase接続（fetch APIベースのポーリング方式）
  // Chrome拡張のコンテンツスクリプトではWebSocketが制限されるため、
  // ポーリングで状態を確認する
  // ============================================
  
  async function startPolling(sessionId, overlay) {
    debugLog('ポーリング開始: ' + sessionId);
    
    // 1. セッション登録（存在チェック含むUPSERT）
    async function registerSession() {
      try {
        const res = await fetch(`${SUPABASE_URL}/rest/v1/squat_sessions`, {
          method: 'POST',
          headers: {
            'apikey': SUPABASE_ANON_KEY,
            'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
            'Content-Type': 'application/json',
            'Prefer': 'resolution=merge-duplicates'
          },
          body: JSON.stringify({ id: sessionId, unlocked: false }),
          cache: 'no-store'
        });
        
        if (res.ok || res.status === 409) {
          debugLog('セッション登録成功 (または既存)');
          updateStatus(overlay, getLockTextFromOverlay(overlay).waitingSquats, 'connected');
          return true;
        } else {
          const errText = await res.text();
          debugLog('登録エラー: ' + res.status + ' ' + errText);
          updateStatus(overlay, getLockTextFromOverlay(overlay).retryingConnection, 'connecting');
          return false;
        }
      } catch (e) {
        debugLog('登録例外: ' + e.message);
        updateStatus(overlay, getLockTextFromOverlay(overlay).networkRetrying, 'connecting');
        return false;
      }
    }

    // 登録できるまでリトライ（最大10回）
    let registered = false;
    for (let i = 0; i < 10; i++) {
      registered = await registerSession();
      if (registered) break;
      await new Promise(r => setTimeout(r, 2000));
    }

    if (!registered) {
      updateStatus(overlay, getLockTextFromOverlay(overlay).connectionFailed, 'connecting');
      return;
    }

    // 2. ポーリングループ
    const pollInterval = setInterval(async () => {
      forcePause(); // ブロック中は毎秒チェック
      try {
        const response = await fetch(
          `${SUPABASE_URL}/rest/v1/squat_sessions?id=eq.${sessionId}&select=unlocked`,
          {
            headers: {
              'apikey': SUPABASE_ANON_KEY,
              'Authorization': `Bearer ${SUPABASE_ANON_KEY}`
            },
            cache: 'no-store' // キャッシュを無効化
          }
        );
        
        if (response.ok) {
          const data = await response.json();
          if (data && data.length > 0 && data[0].unlocked === true) {
            debugLog('アンロック信号検出！');
            clearInterval(pollInterval);
            updateStatus(overlay, getLockTextFromOverlay(overlay).unlocking, 'unlocking');
            unlockPage(overlay);
          }
        } else {
          debugLog('ポーリングエラーステータス: ' + response.status);
        }
      } catch (e) {
        debugLog('ポーリング例外: ' + e.message);
      }
    }, 2000);
  }

  // ============================================
  // 設定のリアルタイム監視
  // ============================================
  
  chrome.storage.onChanged.addListener((changes, namespace) => {
    if (namespace === 'local') {
      debugLog('Settings changed: ' + Object.keys(changes).join(', '));
      // 設定が変更されたら、現在の状態を再評価
      checkAndApplyState();
    }
  });

  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (!message) return;
    if (message.type === 'TOLL_LOCK_STATUS_QUERY') {
      const lockActive = !!document.getElementById('toll-overlay-host') && !!isLocked;
      sendResponse({ ok: true, lockActive });
      return;
    }
    if (message.type === 'TOLL_SET_UI_LANG') {
      (async () => {
        try {
          const lang = message?.lang === 'ja' ? 'ja' : 'en';
          await chrome.storage.local.set({ toll_ui_lang: lang });
          const updated = await applyOverlayLanguage(lang);
          sendResponse({ ok: true, updated });
        } catch (e) {
          sendResponse({ ok: false, reason: 'exception', error: e?.message || String(e) });
        }
      })();
      return true;
    }
    if (message.type === 'TOLL_FORCE_REEVALUATE') {
      (async () => {
        try {
          await checkAndApplyState();
          sendResponse({ ok: true });
        } catch (e) {
          sendResponse({ ok: false, reason: 'exception', error: e?.message || String(e) });
        }
      })();
      return true;
    }
    if (message.type !== 'TOLL_APPLY_CURRENT_LOCK_SETTINGS') return;
    (async () => {
      try {
        await refreshEntitlement(true);
        const fallbackSettings = await chrome.storage.local.get(['target_squat_count', 'lock_duration_min']);
        const hasTarget = message.targetCount !== null && message.targetCount !== undefined;
        const hasGrace = message.graceMin !== null && message.graceMin !== undefined;
        const targetRaw = hasTarget && Number.isFinite(Number(message.targetCount))
          ? Number(message.targetCount)
          : fallbackSettings.target_squat_count;
        const graceRaw = hasGrace && Number.isFinite(Number(message.graceMin))
          ? Number(message.graceMin)
          : fallbackSettings.lock_duration_min;

        const applyResult = await refreshActiveOverlayTarget(targetRaw, graceRaw);
        const effectiveGraceMin = Number.isFinite(Number(applyResult?.graceMin))
          ? Number(applyResult.graceMin)
          : setActiveSessionGraceDuration(graceRaw);
        await checkAndApplyState();
        const lockedNow = !!document.getElementById('toll-overlay-host');

        sendResponse({
          ok: true,
          sessionId: applyResult?.sessionId || null,
          targetCount: applyResult?.targetCount ?? null,
          graceMin: effectiveGraceMin,
          overlayApplied: !!applyResult?.ok,
          reason: applyResult?.ok ? 'applied_active_lock' : (applyResult?.reason || 'state_rechecked'),
          lockedNow,
        });
      } catch (e) {
        sendResponse({ ok: false, reason: 'exception', error: e?.message || String(e) });
      }
    })();
    return true;
  });

  // タブがアクティブになった時に状態を再同期
  // これにより、バックグラウンドでタイマーがズレたりHUDが表示されなかった問題を修正
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') {
      debugLog('Tab became visible: resyncing state...');
      checkAndApplyState();
    }
  });

  function debugLog(msg) {
    // console.log('[THE TOLL] ' + msg); // 本番運用のためログ停止
  }

  // 状態をチェックして適切なアクション（ロック/解除/タイマー開始）を実行
  async function checkAndApplyState() {
    debugLog('--- checkAndApplyState 開始 ---');
    await refreshEntitlement(false);
    
    if (!isExtensionContextValid()) {
      console.warn('[THE TOLL] Extension context invalidated. Injecting reload warning.');
      // 拡張機能が更新された場合、既存のインタラクションは壊れるため、リロードを促すオーバーレイを表示
      const existingHost = document.getElementById('toll-overlay-host');
      if (existingHost) {
        // 既存のオーバーレイがあれば、メッセージを強制更新する（Shadow DOM内）
        const shadow = existingHost.shadowRoot;
        if (shadow) {
          const status = shadow.querySelector('.toll-status');
          if (status) {
             status.textContent = getLockTextFromOverlay(shadow.getElementById('toll-overlay')).extensionUpdatedReload;
             status.style.color = 'red';
             status.style.fontWeight = 'bold';
          }
        }
      }
      return;
    }

    // 0. ブロック対象サイトでなければ何もしない
    const isBlocked = await isCurrentSiteBlocked();
    if (!isBlocked) {
      debugLog('このドメインはブロック対象外です。処理をスキップ。');
      // ブロック対象から外れた場合は即アンロックしてリロード不要にする
      if (document.getElementById('toll-overlay-host') || isLocked) {
        isLocked = false;
        stopVideoMonitor();
        if (reLockTimer) { clearTimeout(reLockTimer); reLockTimer = null; }
        clearCountdownUi();
        const host = document.getElementById('toll-overlay-host');
        if (host) host.remove();
      }
      return;
    }

    try {
      const data = await chrome.storage.local.get([
        'last_global_unlock_time',
        'last_global_unlock_expires_at',
        'lock_duration_min',
        'lock_schedule',
      ]);
      
      const now = Date.now();
      const lastUnlock = data.last_global_unlock_time || 0;
      const storedExpire = Number(data.last_global_unlock_expires_at || 0);
      const rawDuration = data.lock_duration_min || 30;
      const durationMin = getEffectiveDurationMin(rawDuration);
      const fallbackDurationMs = durationMin * 60 * 1000;
      const fallbackExpire = lastUnlock > 0 ? (lastUnlock + fallbackDurationMs) : 0;
      const expirationTime = storedExpire > 0 ? storedExpire : fallbackExpire;
      const timeRemaining = expirationTime > 0 ? (expirationTime - now) : 0;
      
      const withinSchedule = await isWithinSchedule();

      const host = document.getElementById('toll-overlay-host');
      debugLog(`状態: isLocked=${isLocked}, host=${!!host}, withinSchedule=${withinSchedule}, timeRemaining=${timeRemaining}ms`);

      // 1. スケジュール外ならアンロック
      if (!withinSchedule) {
        console.warn('[THE TOLL] OUTSIDE SCHEDULE HOURS - UNLOCKING');
        debugLog('スケジュール外: アンロックします。');
        await chrome.storage.local.remove(['last_global_unlock_time', 'last_global_unlock_expires_at']);
        activeSessionGraceDurationMin = null;
        unlockNow(); 
        if (reLockTimer) { clearTimeout(reLockTimer); reLockTimer = null; }
        clearCountdownUi();
        return;
      }

      // 2. 猶予期間内ならアンロック
      if (lastUnlock > 0 && timeRemaining > 0) {
        debugLog(`グローバル猶予期間内 (${Math.round(timeRemaining/1000)}秒): アンロックを維持。`);
        unlockNow();
        // 再ロックタイマーをセット (絶対時刻の有効期限を渡す)
        scheduleReLock(expirationTime);
      } else {
        if (storedExpire > 0 || lastUnlock > 0) {
          await chrome.storage.local.remove(['last_global_unlock_time', 'last_global_unlock_expires_at']);
        }
        // 3. ロックが必要な状態
        debugLog('ロックが必要な状態: 猶予切れまたは未解除。');
        lockPage();
      }
    } catch (e) {
      console.error('[THE TOLL] Error in checkAndApplyState:', e);
    }
  }

  // 内部状態とUIを即座に「解除」にする
  function unlockNow() {
    isLocked = false;
    stopVideoMonitor();
    const host = document.getElementById('toll-overlay-host');
    if (host) {
      host.remove();
      debugLog('オーバーレイを削除しました。');
    }
  }

  // スケジュール内かどうかをチェック
  const MIN_SCHEDULE_SPAN_MIN = 15;

  function timeStrToMinutes(value) {
    const m = /^(\d{2}):(\d{2})$/.exec(String(value || ''));
    if (!m) return null;
    const hh = Number(m[1]);
    const mm = Number(m[2]);
    if (!Number.isFinite(hh) || !Number.isFinite(mm)) return null;
    return hh * 60 + mm;
  }

  function isWithinTimeRange(currentTimeStr, start, end) {
    if (!start || !end) return true;
    // No date concept: end earlier than start is invalid.
    if (end < start) return false;
    return currentTimeStr >= start && currentTimeStr <= end;
  }

  async function isWithinSchedule() {
    const data = await chrome.storage.local.get('lock_schedule');
    const schedule = data.lock_schedule;
    if (!schedule) return true;

    const now = new Date();
    const day = now.getDay();
    
    if (!Array.isArray(schedule.days) || !schedule.days.includes(day)) return false;

    // 時間帯未設定なら曜日のみで判定（Free互換）
    if (!schedule.start || !schedule.end) return true;

    const lockStartMin = timeStrToMinutes(schedule.start);
    const lockEndMin = timeStrToMinutes(schedule.end);
    if (lockStartMin === null || lockEndMin === null) return false;
    if ((lockEndMin - lockStartMin) < MIN_SCHEDULE_SPAN_MIN) return false;

    const currentTimeStr = now.getHours().toString().padStart(2, '0') + ":" + now.getMinutes().toString().padStart(2, '0');
    
    const insideLockRange = isWithinTimeRange(currentTimeStr, schedule.start, schedule.end);
    if (!insideLockRange) return false;

    const hasBreakRange = schedule.breakEnabled === true && !!schedule.breakStart && !!schedule.breakEnd;
    if (hasBreakRange) {
      const breakStartMin = timeStrToMinutes(schedule.breakStart);
      const breakEndMin = timeStrToMinutes(schedule.breakEnd);
      if (breakStartMin === null || breakEndMin === null) return true;
      if (breakEndMin < breakStartMin) return true;
      if ((breakEndMin - breakStartMin) < MIN_SCHEDULE_SPAN_MIN) return true;
      if (breakStartMin < lockStartMin || breakEndMin > lockEndMin) return true;
      const insideBreakRange = isWithinTimeRange(currentTimeStr, schedule.breakStart, schedule.breakEnd);
      if (insideBreakRange) return false;
    }

    return true;
  }

  // 詳細な診断ログ
  async function diagnosticLog() {
    const sessionId = await getOrCreateSessionId();
    const data = await chrome.storage.local.get([
      'last_global_unlock_time',
      'last_global_unlock_expires_at',
      'lock_duration_min',
      'lock_schedule',
    ]);
    const now = Date.now();
    const lastUnlock = data.last_global_unlock_time || 0;
    const storedExpire = Number(data.last_global_unlock_expires_at || 0);
    const rawDuration = data.lock_duration_min || 30;
    const durationMin = getEffectiveDurationMin(rawDuration);
    const fallbackDurationMs = durationMin * 60 * 1000;
    const fallbackExpire = lastUnlock > 0 ? (lastUnlock + fallbackDurationMs) : 0;
    const expirationTime = storedExpire > 0 ? storedExpire : fallbackExpire;
    const timeSinceUnlock = lastUnlock > 0 ? (now - lastUnlock) : 0;
    const timeRemaining = expirationTime > 0 ? (expirationTime - now) : 0;
    
    console.group('[THE TOLL DIAGNOSTICS]');
    console.log('Global Session ID:', sessionId);
    console.log('Current Time:', new Date(now).toLocaleTimeString());
    console.log('Global Last Unlock:', lastUnlock ? new Date(lastUnlock).toLocaleTimeString() : 'NEVER');
    console.log('Global Expires At:', expirationTime ? new Date(expirationTime).toLocaleTimeString() : 'NONE');
    console.log('Configured Duration:', durationMin + ' min');
    console.log('Time Since Unlock:', Math.floor(timeSinceUnlock / 1000) + 's');
    console.log('Time Remaining:', Math.floor(timeRemaining / 1000) + 's');
    console.log('Is Locked (State):', isLocked);
    console.log('Schedule:', data.lock_schedule || 'NOT SET');
    console.groupEnd();
    
    return { timeRemaining, durationMs };
  }

  async function init() {
    debugLog('THE TOLL 初期化開始...');
    await refreshEntitlement(true);

    const isBlocked = await isCurrentSiteBlocked();
    if (!isBlocked) {
      debugLog('このドメインはリストにありません。終了します。');
      return; 
    }

    debugLog('このドメインはブロック対象です。状態をチェックします...');
    await checkAndApplyState();
  }

  // 即座に実行
  init();
})();
