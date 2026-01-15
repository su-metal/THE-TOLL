// THE TOLL - スクワット検出アプリ
// MediaPipe Poseを使用してスクワットをカウント

(function() {
  'use strict';

  // ============================================
  // 設定
  // ============================================
  // ============================================
  // 設定
  // ============================================
  const APP_VERSION = 'v2.11 (Redesign)';
  const SUPABASE_URL = 'https://qcnzleiyekbgsiyomwin.supabase.co';
  // ... (Keys unchanged)

  // ... (DebugLog unchanged)

  // ============================================
  // 認証・サブスク
  // ============================================
  async function updateUserInfo(user) {
    debugLog(`[V2.11] Updating info for: ${user.email}`);
    elements.userDisplayEmail.textContent = `LOGGED IN: ${user.email}`;
    elements.authForm.classList.add('hidden');
    elements.userInfo.classList.remove('hidden');
    
    try {
      debugLog('Fetching profile...');
      const { data: profile, error } = await state.supabase
        .from('profiles')
        .select('subscription_status')
        .eq('id', user.id)
        .single();
        
      if (error) debugLog('Profile fetch error: ' + error.message);

      const status = profile?.subscription_status || 'inactive';
      state.subscriptionStatus = status;
      debugLog(`Subscription status from DB: ${status}`);
      
      const isActive = status === 'active';
      elements.subscriptionStatusBadge.textContent = isActive ? 'STATUS: ACTIVE' : 'STATUS: INACTIVE';
      elements.subscriptionStatusBadge.className = isActive ? 'status-active' : 'status-inactive';
      
      if (isActive) {
        elements.subscribeBtn.classList.add('hidden');
        elements.toSessionBtn.disabled = false;
        elements.toSessionBtn.textContent = 'ENTER SESSION';
        
        if (elements.authScreen.classList.contains('active')) {
          debugLog('Active user: auto-redirecting to session-screen');
          setTimeout(() => showScreen('session-screen'), 500);
        }
      } else {
        elements.subscribeBtn.classList.remove('hidden');
        elements.toSessionBtn.disabled = true;
        elements.toSessionBtn.textContent = 'SUBSCRIPTION REQUIRED';
      }
    } catch (e) {
      debugLog('Profile logic crash: ' + e.message);
    }
  }

  // ... (Auth handlers unchanged) ...

  // ============================================
  // セッション・PC連携
  // ============================================
  async function startSession(sid) {
    const sessionId = sid || elements.sessionInput.value.trim().toUpperCase();
    if (!sessionId || sessionId.length < 4) return alert('Please enter Session ID');
    
    state.sessionId = sessionId;
    state.squatCount = 0;
    state.startTime = Date.now();
    elements.currentSessionLabel.textContent = sessionId;
    elements.squatCountLabel.textContent = '0';
    
    showScreen('squat-screen');
    initMediaPipe().catch(() => updateStatus('CAMERA KEY ERROR'));
  }

  async function sendUnlockSignal() {
    elements.unlockBtn.disabled = true;
    elements.unlockStatus.textContent = 'SENDING SIGNAL...';
    debugLog(`[V2.11] Sending unlock signal (RPC) for ID: [${state.sessionId}]`);
    
    try {
      const { data, error } = await state.supabase
        .rpc('unlock_session', { session_id: state.sessionId });
      
      debugLog(`RPC Result: ${JSON.stringify(data)}`);
      
      if (error) {
        debugLog('RPC Error: ' + error.message);
        throw error;
      }
      
      if (data && data.success) {
        debugLog('Unlock SUCCESS');
        elements.unlockStatus.textContent = 'UNLOCK SUCCESSFUL';
        elements.unlockBtn.innerHTML = 'SUCCESS';
      } else {
        debugLog('RPC failed: ' + JSON.stringify(data));
        elements.unlockStatus.textContent = 'SESSION NOT FOUND';
        elements.unlockBtn.disabled = false;
        alert('Session not found. Please scan QR again.');
      }
    } catch (e) {
      debugLog('Unlock Exception: ' + e.message);
      elements.unlockStatus.textContent = 'SEND FAILED';
      elements.unlockBtn.disabled = false;
    }
  }

  // ============================================
  // スクワット検出 (MediaPipe)
  // ============================================
  async function initMediaPipe() {
    updateStatus('LOADING AI...');
    // ... (MediaPipe setup unchanged) ...
    await camera.start();
    
    // Wait for video dimensions
    await new Promise(r => {
      const check = () => elements.camera.videoWidth ? r() : requestAnimationFrame(check);
      check();
    });
    elements.canvas.width = elements.camera.videoWidth;
    elements.canvas.height = elements.camera.videoHeight;
    updateStatus('READY');
  }

  function onPoseResults(results) {
    const ctx = elements.canvas.getContext('2d');
    ctx.clearRect(0, 0, elements.canvas.width, elements.canvas.height);
    
    if (!results.poseLandmarks) {
      updateStatus('NO PERSON');
      elements.guide.classList.remove('hidden');
      return;
    }

    const lm = results.poseLandmarks;
    const minVis = 0.5;
    const landmarks = [lm[23], lm[25], lm[27], lm[24], lm[26], lm[28]];
    if (landmarks.some(l => l.visibility < minVis)) {
      updateStatus('SHOW BODY');
      elements.guide.classList.remove('hidden');
      return;
    }
    
    elements.guide.classList.add('hidden');
    drawPose(ctx, lm, elements.canvas.width, elements.canvas.height);

    const leftAngle = calculateAngle(lm[23], lm[25], lm[27]);
    const rightAngle = calculateAngle(lm[24], lm[26], lm[28]);
    const avgAngle = (leftAngle + rightAngle) / 2;

    if (!state.isSquatting && avgAngle < 110) {
      state.isSquatting = true;
      playSoundSquatDown();
      updateStatus('DOWN');
      elements.camera.classList.add('squat-down');
    } else if (state.isSquatting && avgAngle > 165) {
      state.isSquatting = false;
      state.squatCount++;
      elements.squatCountLabel.textContent = state.squatCount;
      elements.camera.classList.remove('squat-down');
      
      if (state.squatCount >= state.targetCount) {
        playSoundComplete();
        onSquatComplete();
      } else {
        playSoundCount();
        updateStatus(`${state.squatCount} REPS`);
      }
    }
  }

  // ... (math helpers unchanged) ...

  function updateStatus(text) { elements.statusLabel.textContent = text; }
  const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFjbnpsZWl5ZWtiZ3NpeW9td2luIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njg0Mjk2NzMsImV4cCI6MjA4NDAwNTY3M30.NlGUfxDPzMgtu_J0vX7FMe-ikxafboGh5GMr-tsaLfI';

  // デバッグ用ロガー（画面に表示）
  function debugLog(msg) {
    console.log(msg);
    const debugEl = document.getElementById('debug-console');
    if (debugEl) {
      const line = document.createElement('div');
      line.textContent = `[${new Date().toLocaleTimeString()}] ${msg}`;
      debugEl.prepend(line);
    }
  }

  // ============================================
  // 状態管理
  // ============================================
  const state = {
    supabase: null,
    user: null,
    subscriptionStatus: 'inactive',
    sessionId: null,
    squatCount: 0,
    targetCount: 20,
    isSquatting: false,
    poseDetected: false,
    startTime: null,
    audioContext: null,
    html5QrCode: null
  };

  // ============================================
  // DOM要素
  // ============================================
  const elements = {
    // 認証・決済
    authScreen: document.getElementById('auth-screen'),
    authForm: document.getElementById('auth-form'),
    userInfo: document.getElementById('user-info'),
    emailInput: document.getElementById('email-input'),
    passwordInput: document.getElementById('password-input'),
    loginBtn: document.getElementById('login-btn'),
    signupBtn: document.getElementById('signup-btn'),
    userDisplayEmail: document.getElementById('user-display-email'),
    subscriptionStatusBadge: document.getElementById('subscription-status-badge'),
    installBtn: document.getElementById('install-btn'),
    subscribeBtn: document.getElementById('subscribe-btn'),
    toSessionBtn: document.getElementById('to-session-btn'),
    logoutBtn: document.getElementById('logout-btn'),

    // セッション
    sessionScreen: document.getElementById('session-screen'),
    sessionInput: document.getElementById('session-input'),
    startBtn: document.getElementById('start-btn'),
    scanQrBtn: document.getElementById('scan-qr-btn'),
    qrReaderContainer: document.getElementById('qr-reader-container'),
    closeScanBtn: document.getElementById('close-scan-btn'),
    
    // スクワット
    squatScreen: document.getElementById('squat-screen'),
    camera: document.getElementById('camera'),
    canvas: document.getElementById('pose-canvas'),
    squatCountLabel: document.getElementById('squat-count'),
    statusLabel: document.getElementById('status'),
    guide: document.getElementById('guide'),
    squatHint: document.getElementById('squat-hint'),
    currentSessionLabel: document.getElementById('current-session'),
    cameraContainer: document.querySelector('.camera-container'),
    
    // 完了
    completeScreen: document.getElementById('complete-screen'),
    sessionTimeLabel: document.getElementById('session-time'),
    unlockBtn: document.getElementById('unlock-btn'),
    unlockStatus: document.getElementById('unlock-status'),
    backToSessionBtn: document.getElementById('back-to-session-btn')
  };

  // ============================================
  // 初期化・コアロジック
  // ============================================

  async function init() {
    debugLog(`[THE TOLL] アプリ初期化 ${APP_VERSION}`);
    
    // PWAインストールプロンプトの準備
    window.addEventListener('beforeinstallprompt', (e) => {
      e.preventDefault();
      state.deferredPrompt = e;
      debugLog('PWA Install Prompt captured');
      if (elements.installBtn) elements.installBtn.classList.remove('hidden');
    });

    // ロゴクリックでデバッグ表示切り替え
    document.querySelectorAll('.logo').forEach(el => {
      el.style.display = 'block'; // ロゴを表示（デバッグ用）
      el.onclick = () => {
        const d = document.getElementById('debug-console');
        d.style.display = d.style.display === 'none' ? 'block' : 'none';
      };
    });
    
    // Supabase初期化
    try {
      state.supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
      debugLog('Supabase initialized');
    } catch(e) {
      debugLog('Supabase init error: ' + e.message);
    }

    // イベントリスナー設定
    setupEventListeners();
    
    // 認証状態の監視
    state.supabase.auth.onAuthStateChange((event, session) => {
      debugLog(`Auth change: ${event}`);
      if (session) {
        state.user = session.user;
        updateUserInfo(session.user);
      } else {
        state.user = null;
        showAuthForm();
      }
    });

    // PWA QRスキャナー初期化
    if (typeof Html5Qrcode !== 'undefined') {
      try {
        state.html5QrCode = new Html5Qrcode("qr-reader");
        debugLog('QR Scanner initialized');
      } catch(e) {
        debugLog('QR init error: ' + e.message);
      }
    } else {
      debugLog('CRITICAL: Html5Qrcode library not found');
      alert('QRコードライブラリが読み込まれていません。ネットワーク状況を確認してください。');
    }

    // URLパラメータチェック
    const params = new URLSearchParams(window.location.search);
    const sessionSid = params.get('session');
    if (sessionSid) {
      debugLog(`Session from URL: ${sessionSid}`);
      elements.sessionInput.value = sessionSid;
      // 古いセッションが残らないよう、URLからパラメータを削除
      try {
        window.history.replaceState({}, document.title, window.location.pathname);
        debugLog('URL parameters cleared');
      } catch(e) {
        debugLog('URL clear failed: ' + e.message);
      }
    } else {
        // セッション入力フィールドをクリア（古いキャッシュ対策の念押し）
        elements.sessionInput.value = '';
    }

    // 最初のユーザー操作でAudioContextを初期化
    document.addEventListener('click', () => {
      if (!state.audioContext) {
        state.audioContext = new (window.AudioContext || window.webkitAudioContext)();
        debugLog('AudioContext initialized');
      }
    }, { once: true });
  }

  function setupEventListeners() {
    // 認証
    elements.loginBtn.addEventListener('click', handleLogin);
    elements.signupBtn.addEventListener('click', handleSignup);
    elements.logoutBtn.addEventListener('click', handleLogout);
    elements.subscribeBtn.addEventListener('click', handleSubscribe);
    if (elements.installBtn) {
      elements.installBtn.addEventListener('click', async () => {
        if (state.deferredPrompt) {
          state.deferredPrompt.prompt();
          const { outcome } = await state.deferredPrompt.userChoice;
          debugLog(`Install prompt outcome: ${outcome}`);
          state.deferredPrompt = null;
          elements.installBtn.classList.add('hidden');
        }
      });
    }
    elements.toSessionBtn.addEventListener('click', () => showScreen('session-screen'));
    
    // セッション画面のログアウト
    const sessionLogoutBtn = document.getElementById('session-logout-btn');
    if (sessionLogoutBtn) {
      sessionLogoutBtn.addEventListener('click', (e) => {
        e.preventDefault();
        handleLogout();
      });
    }

    // セッション・QR
    elements.startBtn.addEventListener('click', () => startSession());
    elements.scanQrBtn.addEventListener('click', () => startQRScan());
    elements.closeScanBtn.addEventListener('click', () => stopQRScan());
    elements.sessionInput.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') startSession();
    });
    
    // セッションID自動フォーマット
    elements.sessionInput.addEventListener('input', (e) => {
      let value = e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '');
      if (value.length > 4) value = value.slice(0, 4) + '-' + value.slice(4, 12);
      e.target.value = value;
    });

    // 完了
    elements.unlockBtn.addEventListener('click', sendUnlockSignal);
    if (elements.backToSessionBtn) {
      elements.backToSessionBtn.addEventListener('click', (e) => {
        e.preventDefault();
        showScreen('session-screen');
      });
    }
  }

  // ============================================
  // 画面管理
  // ============================================
  function showScreen(screenId) {
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    document.getElementById(screenId).classList.add('active');
  }

  function showAuthForm() {
    elements.authForm.classList.remove('hidden');
    elements.userInfo.classList.add('hidden');
    showScreen('auth-screen');
  }

  // ============================================
  // 認証・サブスク
  // ============================================
  async function updateUserInfo(user) {
    debugLog(`[V2.4] Updating info for: ${user.email}`);
    elements.userDisplayEmail.textContent = `ログイン中: ${user.email}`;
    elements.authForm.classList.add('hidden');
    elements.userInfo.classList.remove('hidden');
    
    try {
      debugLog('Fetching profile...');
      const { data: profile, error } = await state.supabase
        .from('profiles')
        .select('subscription_status')
        .eq('id', user.id)
        .single();
        
      if (error) {
        debugLog('Profile fetch error: ' + error.message);
        // リセット直後などでプロファイルがまだない場合、作成を待つかデフォルト値を採用
      }

      const status = profile?.subscription_status || 'inactive';
      state.subscriptionStatus = status;
      debugLog(`Subscription status from DB: ${status}`);
      
      elements.subscriptionStatusBadge.textContent = `会員ステータス: ${status === 'active' ? '✅ 有料会員' : '❌ 未登録'}`;
      elements.subscriptionStatusBadge.className = status === 'active' ? 'status-active' : 'status-inactive';
      
      if (status === 'active') {
        elements.subscribeBtn.classList.add('hidden');
        elements.toSessionBtn.disabled = false;
        elements.toSessionBtn.textContent = 'PC連携へ進む';
        
        // 認証画面にいる場合は自動遷移
        if (elements.authScreen.classList.contains('active')) {
          debugLog('Active user: auto-redirecting to session-screen');
          setTimeout(() => showScreen('session-screen'), 500);
        }
      } else {
        elements.subscribeBtn.classList.remove('hidden');
        elements.toSessionBtn.disabled = true;
        elements.toSessionBtn.textContent = 'サブスク登録が必要です';
      }
      // ログアウトボタンは常に表示（親要素が表示されているため）
    } catch (e) {
      debugLog('Profile logic crash: ' + e.message);
    }
  }

  async function handleLogin() {
    const email = elements.emailInput.value;
    const password = elements.passwordInput.value;
    if (!email || !password) return alert('メールとパスワードを入力してください');
    const { error } = await state.supabase.auth.signInWithPassword({ email, password });
    if (error) alert('ログイン失敗: ' + error.message);
  }

  async function handleSignup() {
    const email = elements.emailInput.value;
    const password = elements.passwordInput.value;
    if (!email || !password) return alert('メールとパスワードを入力してください');
    const { error, data } = await state.supabase.auth.signUp({ 
      email, 
      password,
      options: { emailRedirectTo: window.location.origin }
    });
    if (error) alert('登録失敗: ' + error.message);
    else if (data.session) alert('アカウントを作成しました。自動ログインします。');
    else alert('確認メールを送信しました。');
  }

  async function handleLogout() {
    await state.supabase.auth.signOut();
  }


  async function handleSubscribe() {
    debugLog('Starting subscription flow...');
    try {
      // invokesは通常内部で認証ヘッダーを付与するが、念のため明示的に指定
      const { data, error } = await state.supabase.functions.invoke('create-checkout', {
        headers: {
            'Content-Type': 'application/json'
        },
        body: {}
      });
      
      if (error) {
        debugLog('Subscription function error: ' + error.message);
        throw error;
      }
      
      if (data?.url) {
        debugLog('Redirecting to checkout: ' + data.url);
        window.location.href = data.url;
      } else {
        debugLog('No checkout URL returned: ' + JSON.stringify(data));
        alert('決済URLの取得に失敗しました。');
      }
    } catch (e) {
      debugLog('Subscription fetch failed: ' + e.message);
      alert('決済の準備に失敗しました。ネットワークを確認してください。');
    }
  }

  // ============================================
  // QRスキャナー
  // ============================================
  async function startQRScan() {
    if (!state.html5QrCode) {
      alert("QRスキャナーの初期化に失敗しています。ページを更新してください。");
      return;
    }

    elements.qrReaderContainer.classList.remove('hidden');
    
    try {
      await state.html5QrCode.start(
        { facingMode: "environment" }, 
        { fps: 10, qrbox: { width: 250, height: 250 } }, // オブジェクト形式で指定
        (decodedText) => {
          debugLog(`QR Scanned: ${decodedText}`);
          let sid = decodedText;
          if (decodedText.includes('session=')) {
            sid = decodedText.split('session=')[1].split('&')[0];
          } else if (decodedText.includes('session/')) {
            sid = decodedText.split('session/')[1].split('?')[0];
          }
          debugLog(`Parsed Session ID: ${sid}`);
          elements.sessionInput.value = sid;
          stopQRScan();
          startSession(sid);
        },
        () => {}
      );
    } catch (err) {
      console.error("QRスキャンエラー:", err);
      alert("カメラの起動に失敗しました。権限が許可されているか確認してください。 (Error: " + err.message + ")");
      elements.qrReaderContainer.classList.add('hidden');
    }
  }

  async function stopQRScan() {
    if (state.html5QrCode) {
      try { await state.html5QrCode.stop(); } catch (e) {}
    }
    elements.qrReaderContainer.classList.add('hidden');
  }

  // ============================================
  // セッション・PC連携
  // ============================================
  async function startSession(sid) {
    const sessionId = sid || elements.sessionInput.value.trim().toUpperCase();
    if (!sessionId || sessionId.length < 4) return alert('セッションIDを入力してください');
    
    state.sessionId = sessionId;
    state.squatCount = 0;
    state.startTime = Date.now();
    elements.currentSessionLabel.textContent = sessionId;
    elements.squatCountLabel.textContent = '0';
    
    showScreen('squat-screen');
    initMediaPipe().catch(() => updateStatus('❌', 'カメラエラー'));
  }

  async function sendUnlockSignal() {
    elements.unlockBtn.disabled = true;
    elements.unlockStatus.textContent = '送信中...';
    debugLog(`[V2.5] Sending unlock signal (RPC) for ID: [${state.sessionId}]`);
    
    try {
      // RPCを使用してアンロック（RLS回避）
      const { data, error } = await state.supabase
        .rpc('unlock_session', { session_id: state.sessionId });
      
      debugLog(`RPC Result: ${JSON.stringify(data)}`);
      
      if (error) {
        debugLog('RPC Error: ' + error.message);
        throw error;
      }
      
      if (data && data.success) {
        debugLog('Unlock SUCCESS');
        elements.unlockStatus.textContent = '✅ アンロック成功！';
        elements.unlockBtn.innerHTML = '<span>SUCCESS</span>';
      } else {
        debugLog('RPC failed: ' + JSON.stringify(data));
        elements.unlockStatus.textContent = '⚠️ セッションが見つかりません';
        elements.unlockBtn.disabled = false;
        alert('セッションが見つかりませんでした。QRコードを読み直してください。');
      }
    } catch (e) {
      debugLog('Unlock Exception: ' + e.message);
      elements.unlockStatus.textContent = '❌ 送信失敗';
      elements.unlockBtn.disabled = false;
    }
  }

  // ============================================
  // スクワット検出 (MediaPipe)
  // ============================================
  async function initMediaPipe() {
    updateStatus('⏳', 'AI読み込み中...');
    const pose = new Pose({
      locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/pose/${file}`
    });
    pose.setOptions({ modelComplexity: 0, smoothLandmarks: true, minDetectionConfidence: 0.5, minTrackingConfidence: 0.5 });
    pose.onResults(onPoseResults);

    const camera = new Camera(elements.camera, {
      onFrame: async () => { await pose.send({ image: elements.camera }); },
      facingMode: 'user'
    });
    await camera.start();
    
    // Wait for video dimensions
    await new Promise(r => {
      const check = () => elements.camera.videoWidth ? r() : requestAnimationFrame(check);
      check();
    });
    elements.canvas.width = elements.camera.videoWidth;
    elements.canvas.height = elements.camera.videoHeight;
    updateStatus('✅', '準備完了');
  }

  function onPoseResults(results) {
    const ctx = elements.canvas.getContext('2d');
    ctx.clearRect(0, 0, elements.canvas.width, elements.canvas.height);
    
    if (!results.poseLandmarks) {
      updateStatus('🔴', '人物不在');
      elements.guide.classList.remove('hidden');
      return;
    }

    const lm = results.poseLandmarks;
    const minVis = 0.5;
    const landmarks = [lm[23], lm[25], lm[27], lm[24], lm[26], lm[28]];
    if (landmarks.some(l => l.visibility < minVis)) {
      updateStatus('👀', '全身を映してください');
      elements.guide.classList.remove('hidden');
      return;
    }
    
    elements.guide.classList.add('hidden');
    drawPose(ctx, lm, elements.canvas.width, elements.canvas.height);

    const leftAngle = calculateAngle(lm[23], lm[25], lm[27]);
    const rightAngle = calculateAngle(lm[24], lm[26], lm[28]);
    const avgAngle = (leftAngle + rightAngle) / 2;

    if (!state.isSquatting && avgAngle < 95) {
      state.isSquatting = true;
      playSoundSquatDown();
      updateStatus('🟢', 'しゃがみ検出');
      elements.camera.classList.add('squat-down');
    } else if (state.isSquatting && avgAngle > 170) {
      state.isSquatting = false;
      state.squatCount++;
      elements.squatCountLabel.textContent = state.squatCount;
      elements.camera.classList.remove('squat-down');
      
      // 音声カウント（英語）
      speakText(state.squatCount.toString());
      
      if (state.squatCount >= state.targetCount) {
        playSoundComplete();
        speakText("Target achieved. Challenge complete.");
        onSquatComplete();
      } else {
        playSoundCount();
        updateStatus('💪', `${state.squatCount}回完了`);
      }
    }
  }

  function calculateAngle(a, b, c) {
    const r = Math.atan2(c.y - b.y, c.x - b.x) - Math.atan2(a.y - b.y, a.x - b.x);
    let deg = Math.abs(r * 180 / Math.PI);
    return deg > 180 ? 360 - deg : deg;
  }

  function drawPose(ctx, lm, w, h) {
    ctx.strokeStyle = 'rgba(233, 69, 96, 0.8)';
    ctx.lineWidth = 4;
    const conn = [[11,13],[13,15],[12,14],[14,16],[11,12],[11,23],[12,24],[23,24],[23,25],[25,27],[24,26],[26,28]];
    conn.forEach(([a, b]) => {
      ctx.beginPath();
      ctx.moveTo(lm[a].x * w, lm[a].y * h);
      ctx.lineTo(lm[b].x * w, lm[b].y * h);
      ctx.stroke();
    });

    // 関節ポイントの描画
    const points = [11, 12, 13, 14, 15, 16, 23, 24, 25, 26, 27, 28];
    ctx.fillStyle = '#ff1a1a';
    points.forEach(i => {
      ctx.beginPath();
      ctx.arc(lm[i].x * w, lm[i].y * h, 5, 0, Math.PI * 2);
      ctx.fill();
      // 外側に少し光らせる
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
      ctx.lineWidth = 1;
      ctx.stroke();
    });
  }

  function updateStatus(icon, text) { elements.statusLabel.innerHTML = `<span>${text}</span>`; }
  
  function onSquatComplete() {
    const now = Date.now();
    const time = state.startTime ? Math.round((now - state.startTime) / 1000) : '--';
    elements.sessionTimeLabel.textContent = time;
    showScreen('complete-screen');
  }

  // ============================================
  // 音声 (Web Audio)
  // ============================================
  function playTone(f, d, t = 'sine', v = 0.3) {
    if (!state.audioContext) return;
    const osc = state.audioContext.createOscillator();
    const g = state.audioContext.createGain();
    osc.connect(g); g.connect(state.audioContext.destination);
    osc.type = t; osc.frequency.value = f; g.gain.value = v;
    g.gain.exponentialRampToValueAtTime(0.01, state.audioContext.currentTime + d);
    osc.start(); osc.stop(state.audioContext.currentTime + d);
  }

  function speakText(text) {
    if (!window.speechSynthesis) return;
    // 既存の発話をキャンセルして遅延を防ぐ
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'en-US';
    utterance.rate = 1.1; // 少し速めに
    utterance.pitch = 1.0;
    window.speechSynthesis.speak(utterance);
  }

  const playSoundCount = () => playTone(440 + (state.squatCount * 50), 0.15);
  const playSoundComplete = () => [523, 659, 783, 1046].forEach((f, i) => setTimeout(() => playTone(f, 0.3), i * 100));
  const playSoundSquatDown = () => playTone(600, 0.08);

  // START
  init();
})();
