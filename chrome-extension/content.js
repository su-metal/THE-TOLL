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
      const blockedSites = settings.blocked_sites || ['youtube.com'];
      const customSites = settings.custom_blocked_sites || [];
      const adultBlockEnabled = settings.adult_block_enabled || false;
      
      const currentHost = window.location.hostname.toLowerCase();
      
      // 1. プリセットとカスタムをチェック
      const allSites = [...blockedSites, ...customSites];
      const isManualBlocked = allSites.some(siteStr => {
        const domains = siteStr.split(',');
        return domains.some(domain => currentHost.includes(domain.trim()));
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

  // ブロック時の警告音（重厚な警告音）
  function playSoundBlock() {
    if (!audioContext) {
      initAudio();
      if (!audioContext) return;
    }
    
    // 低い警告音を2回
    playTone(150, 0.3, 'sawtooth', 0.15);
    setTimeout(() => playTone(100, 0.4, 'sawtooth', 0.15), 300);
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
    
    const settings = await chrome.storage.local.get('target_squat_count');
    const targetCount = settings.target_squat_count || 5;
    const appUrl = `${SMARTPHONE_APP_URL}?session=${sessionId}&target=${targetCount}`;
    
    overlay.innerHTML = `
      <div class="toll-container">
        <h1>THE TOLL</h1>
        <p class="toll-subtitle">BROWSER LOCKDOWN</p>
        
        <div class="toll-instruction">
          <p class="toll-instruction-text">WANT ACCESS? DO <strong>${targetCount}</strong> SQUATS.</p>
        </div>
        
        <div class="toll-qr-section">
          <p class="toll-qr-label">SCAN TO UNLOCK</p>
          <div class="toll-qr-container">
            <div id="toll-qrcode"></div>
          </div>
        </div>
        
        <div class="toll-session">
          <p class="toll-session-label">SESSION ID</p>
          <p class="toll-session-id">${sessionId}</p>
        </div>
        
        <p class="toll-status connecting">CONNECTING...</p>
      </div>
    `;
    
    shadow.appendChild(overlay);
    
    // ホストをページに挿入
    if (document.body) {
      document.body.appendChild(host);
    } else {
      document.addEventListener('DOMContentLoaded', () => {
        document.body.appendChild(host);
      });
    }
    
    // 背景画像の設定
    try {
      const bgImageUrl = chrome.runtime.getURL('images/bg-gym.png');
      overlay.style.setProperty('--toll-bg-image', `url("${bgImageUrl}")`);
    } catch (e) {
      console.log('[THE TOLL] 背景画像の読み出しをスキップ');
    }
    
    // QRコード生成 (Shadow DOM内でも動作するように微調整が必要な場合がある)
    setTimeout(() => {
      const qrcodeElement = shadow.getElementById('toll-qrcode');
      if (qrcodeElement && typeof QRCode !== 'undefined') {
        new QRCode(qrcodeElement, {
          text: appUrl,
          width: 180,
          height: 180,
          colorDark: '#1a1a2e',
          colorLight: '#ffffff',
          correctLevel: QRCode.CorrectLevel.M
        });
      }
      
      playSoundBlock();
    }, 100);
    
    return overlay;
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

    // グローバルな解除時刻を保存 (全てのタブで共有)
    const now = Date.now();
    await chrome.storage.local.set({ last_global_unlock_time: now });
    
    // 設定から時間を取得して有効期限を計算
    const settings = await chrome.storage.local.get('lock_duration_min');
    const durationMin = settings.lock_duration_min || 20;
    const expirationTime = now + (durationMin * 60 * 1000);

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
      lockPage();
      return;
    }

    // 1. カウントダウンHUDの開始（再ロックの60秒前）
    const countdownStartIn = Math.max(0, timeRemaining - 60 * 1000);
    
    // すでに残り1分を切っている場合は即座に表示
    if (countdownStartIn === 0) {
      startCountdownTimer(expirationTime);
    } else {
      setTimeout(() => {
        startCountdownTimer(expirationTime);
      }, countdownStartIn);
    }

    // 2. 実際の再ロック
    reLockTimer = setTimeout(() => {
      lockPage();
    }, timeRemaining);
  }

  let countdownInterval = null;
  let currentExpireTime = 0; // 現在表示中のタイマーの期限

  // カウントダウンHUDの管理
  function startCountdownTimer(expireTime) {
    // 既に同じ期限のタイマーが動いていて、HUDも存在する場合は作り直さない（チラつき・巻き戻り防止）
    if (countdownHUD && countdownInterval && currentExpireTime === expireTime) {
      return; 
    }

    if (countdownHUD) countdownHUD.remove();
    if (countdownInterval) clearInterval(countdownInterval);
    
    currentExpireTime = expireTime; // 期限を記憶

    countdownHUD = document.createElement('div');
    countdownHUD.className = 'toll-countdown-hud';
    countdownHUD.innerHTML = `
      <div class="hud-label">RELOCK SEQUENCE INITIATED</div>
      <div class="hud-timer"><span id="hud-min">00</span>:<span id="hud-sec">00</span></div>
    `;
    document.body.appendChild(countdownHUD);

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
        if (countdownInterval) clearInterval(countdownInterval);
        if (countdownHUD) countdownHUD.remove();
        return;
      }

      if (countdownHUD && remaining <= 10) countdownHUD.classList.add('warning');

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
          updateStatus(overlay, 'Connected - Waiting for squats', 'connected');
          return true;
        } else {
          const errText = await res.text();
          debugLog('登録エラー: ' + res.status + ' ' + errText);
          updateStatus(overlay, 'Retrying connection...', 'connecting');
          return false;
        }
      } catch (e) {
        debugLog('登録例外: ' + e.message);
        updateStatus(overlay, 'Network error - Retrying...', 'connecting');
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
      updateStatus(overlay, 'Connection failed. Please refresh.', 'connecting');
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
            updateStatus(overlay, 'Squats complete! Unlocking...', 'unlocking');
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
             status.textContent = 'EXTENSION UPDATED. PLEASE RELOAD PAGE.';
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
      return;
    }

    try {
      const data = await chrome.storage.local.get(['last_global_unlock_time', 'lock_duration_min', 'lock_schedule']);
      
      const now = Date.now();
      const lastUnlock = data.last_global_unlock_time || 0;
      const durationMin = data.lock_duration_min || 20;
      const durationMs = durationMin * 60 * 1000;
      const timeSinceUnlock = now - lastUnlock;
      const timeRemaining = durationMs - timeSinceUnlock;
      
      const withinSchedule = await isWithinSchedule();

      const host = document.getElementById('toll-overlay-host');
      debugLog(`状態: isLocked=${isLocked}, host=${!!host}, withinSchedule=${withinSchedule}, timeRemaining=${timeRemaining}ms`);

      // 1. スケジュール外ならアンロック
      if (!withinSchedule) {
        console.warn('[THE TOLL] OUTSIDE SCHEDULE HOURS - UNLOCKING');
        debugLog('スケジュール外: アンロックします。');
        unlockNow(); 
        if (reLockTimer) { clearTimeout(reLockTimer); reLockTimer = null; }
        if (countdownHUD) { countdownHUD.remove(); countdownHUD = null; }
        if (countdownInterval) { clearInterval(countdownInterval); countdownInterval = null; }
        return;
      }

      // 2. 猶予期間内ならアンロック
      if (lastUnlock > 0 && timeRemaining > 0) {
        debugLog(`グローバル猶予期間内 (${Math.round(timeRemaining/1000)}秒): アンロックを維持。`);
        unlockNow();
        // 再ロックタイマーをセット (絶対時刻である expirationTime を渡す)
        const expirationTime = lastUnlock + durationMs;
        scheduleReLock(expirationTime);
      } else {
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
  async function isWithinSchedule() {
    const data = await chrome.storage.local.get('lock_schedule');
    const schedule = data.lock_schedule;
    if (!schedule) return true;

    const now = new Date();
    const day = now.getDay();
    
    if (!schedule.days.includes(day)) return false;

    const currentTimeStr = now.getHours().toString().padStart(2, '0') + ":" + now.getMinutes().toString().padStart(2, '0');
    
    if (schedule.start <= schedule.end) {
      return currentTimeStr >= schedule.start && currentTimeStr <= schedule.end;
    } else {
      return currentTimeStr >= schedule.start || currentTimeStr <= schedule.end;
    }
  }

  // 詳細な診断ログ
  async function diagnosticLog() {
    const sessionId = await getOrCreateSessionId();
    const data = await chrome.storage.local.get(['last_global_unlock_time', 'lock_duration_min', 'lock_schedule']);
    const now = Date.now();
    const lastUnlock = data.last_global_unlock_time || 0;
    const durationMin = data.lock_duration_min || 20;
    const durationMs = durationMin * 60 * 1000;
    const timeSinceUnlock = now - lastUnlock;
    const timeRemaining = durationMs - timeSinceUnlock;
    
    console.group('[THE TOLL DIAGNOSTICS]');
    console.log('Global Session ID:', sessionId);
    console.log('Current Time:', new Date(now).toLocaleTimeString());
    console.log('Global Last Unlock:', lastUnlock ? new Date(lastUnlock).toLocaleTimeString() : 'NEVER');
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
