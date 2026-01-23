// THE TOLL - スクワット検出アプリ (Reduced Duplication & Fixed Session Reset)
// MediaPipe Poseを使用してスクワットをカウント

(function() {
  'use strict';

  // ============================================
  // 設定
  // ============================================
  const APP_VERSION = 'v2.13 (Target Fix)';
  const SUPABASE_URL = 'https://qcnzleiyekbgsiyomwin.supabase.co';
  const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFjbnpsZWl5ZWtiZ3NpeW9td2luIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njg0Mjk2NzMsImV4cCI6MjA4NDAwNTY3M30.NlGUfxDPzMgtu_J0vX7FMe-ikxafboGh5GMr-tsaLfI';

  // ============================================
  // 状態管理
  // ============================================
  const state = {
    supabase: null,
    user: null,
    subscriptionStatus: 'inactive',
    sessionId: null,
    squatCount: 0,
    targetCount: 20, // デフォルト
    isSquatting: false,
    poseDetected: false,
    startTime: null,
    audioContext: null,
    html5QrCode: null,
    poseCamera: null,
    deferredPrompt: null
  };

  // ============================================
  // DOM要素
  // ============================================
  const elements = {
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

    sessionScreen: document.getElementById('session-screen'),
    sessionInput: document.getElementById('session-input'),
    startBtn: document.getElementById('start-btn'),
    scanQrBtn: document.getElementById('scan-qr-btn'),
    qrReaderContainer: document.getElementById('qr-reader-container'),
    closeScanBtn: document.getElementById('close-scan-btn'),
    
    squatScreen: document.getElementById('squat-screen'),
    camera: document.getElementById('camera'),
    canvas: document.getElementById('pose-canvas'),
    squatCountLabel: document.getElementById('squat-count'),
    statusLabel: document.getElementById('status'),
    guide: document.getElementById('guide'),
    currentSessionLabel: document.getElementById('current-session'),
    
    completeScreen: document.getElementById('complete-screen'),
    sessionTimeLabel: document.getElementById('session-time'),
    targetCountDisplay: document.getElementById('target-count-display'),
    completeRepsDisplay: document.getElementById('complete-reps-display'),
    unlockBtn: document.getElementById('unlock-btn'),
    unlockStatus: document.getElementById('unlock-status'),
    backToSessionBtn: document.getElementById('back-to-session-btn')
  };

  // ============================================
  // ユーティリティ
  // ============================================
  function debugLog(msg) {
    console.log(msg);
    const debugEl = document.getElementById('debug-console');
    if (debugEl) {
      const line = document.createElement('div');
      line.textContent = `[${new Date().toLocaleTimeString()}] ${msg}`;
      debugEl.prepend(line);
    }
  }

  function updateStatus(text) { elements.statusLabel.textContent = text; }

  function showScreen(screenId) {
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    document.getElementById(screenId).classList.add('active');
  }

  // ============================================
  // 認証・サブスク
  // ============================================
  async function updateUserInfo(user) {
    debugLog(`Updating info for: ${user.email}`);
    elements.userDisplayEmail.textContent = `ログイン中: ${user.email}`;
    elements.authForm.classList.add('hidden');
    elements.userInfo.classList.remove('hidden');
    
    try {
      const { data: profile, error } = await state.supabase
        .from('profiles')
        .select('subscription_status')
        .eq('id', user.id)
        .single();
        
      if (error) debugLog('Profile fetch error: ' + error.message);

      const status = profile?.subscription_status || 'inactive';
      state.subscriptionStatus = status;
      
      elements.subscriptionStatusBadge.textContent = `会員ステータス: ${status === 'active' ? '✅ 有料会員' : '❌ 未登録'}`;
      elements.subscriptionStatusBadge.className = status === 'active' ? 'status-active' : 'status-inactive';
      
      if (status === 'active') {
        elements.subscribeBtn.classList.add('hidden');
        elements.toSessionBtn.disabled = false;
        elements.toSessionBtn.textContent = 'PC連携へ進む';
        if (elements.authScreen.classList.contains('active')) {
          setTimeout(() => showScreen('session-screen'), 500);
        }
      } else {
        elements.subscribeBtn.classList.remove('hidden');
        elements.toSessionBtn.disabled = true;
        elements.toSessionBtn.textContent = 'サブスク登録が必要です';
      }
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
      email, password, options: { emailRedirectTo: window.location.origin }
    });
    if (error) alert('登録失敗: ' + error.message);
    else if (data.session) alert('アカウントを作成しました。自動ログインします。');
    else alert('確認メールを送信しました。');
  }

  async function handleLogout() { await state.supabase.auth.signOut(); }

  async function handleSubscribe() {
    try {
      const { data, error } = await state.supabase.functions.invoke('create-checkout', {
        headers: { 'Content-Type': 'application/json' },
        body: {}
      });
      if (data?.url) window.location.href = data.url;
      else alert('決済URLの取得に失敗しました。');
    } catch (e) { alert('決済の準備に失敗しました。'); }
  }

  // ============================================
  // セッション・QR
  // ============================================
  function startSession(sid, targetFromUrl) {
    const sessionId = sid || elements.sessionInput.value.trim().toUpperCase();
    if (!sessionId || sessionId.length < 4) return alert('セッションIDを入力してください');
    
    state.sessionId = sessionId;
    state.squatCount = 0;
    state.startTime = Date.now();
    elements.currentSessionLabel.textContent = sessionId;
    elements.squatCountLabel.textContent = '0';

    // Settings Guard用の特別ID判定
    if (sessionId.startsWith('SET-')) {
      state.targetCount = 30;
      debugLog('SETTINGS LOCK MISSION: 30 REPS');
    } else if (targetFromUrl) {
      const parsed = parseInt(targetFromUrl);
      if (!isNaN(parsed) && parsed > 0) {
        state.targetCount = parsed;
        debugLog('Target from URL: ' + state.targetCount);
      }
    }
    // else: state.targetCount keeps its value set in init()
    
    // UI反映 (必ず実行)
    if (elements.targetCountDisplay) elements.targetCountDisplay.textContent = state.targetCount;
    if (elements.completeRepsDisplay) elements.completeRepsDisplay.textContent = state.targetCount;
    
    showScreen('squat-screen');
    initMediaPipe().catch(err => debugLog('Camera error: ' + err.message));
  }

  async function startQRScan() {
    if (!state.html5QrCode) return alert("スキャナー初期化失敗");
    elements.qrReaderContainer.classList.remove('hidden');
    try {
      await state.html5QrCode.start(
        { facingMode: "environment" }, 
        { fps: 10, qrbox: { width: 250, height: 250 } },
        (decodedText) => {
          let sid = decodedText;
          let target = null;
          
          // URLからsessionとtargetを抽出
          // URLからsessionとtargetを抽出
          if (decodedText.startsWith('http')) {
            try {
              const url = new URL(decodedText);
              sid = url.searchParams.get('session') || sid;
              target = url.searchParams.get('target');
            } catch (e) {
              debugLog('URL parse error: ' + e.message);
            }
          } else if (decodedText.includes('session=')) {
             // フォールバック: 単純な文字列解析
             const parts = decodedText.split('?');
             const params = new URLSearchParams(parts[1] || parts[0]);
             sid = params.get('session') || sid;
             target = params.get('target');
          }
          
          elements.sessionInput.value = sid;
          stopQRScan();
          startSession(sid, target);
        }, () => {}
      );
    } catch (err) { alert("カメラ起動失敗"); elements.qrReaderContainer.classList.add('hidden'); }
  }

  async function stopQRScan() {
    if (state.html5QrCode) { 
      try { 
        if (state.html5QrCode.isScanning) {
          await state.html5QrCode.stop(); 
        }
      } catch (e) {
        debugLog('QR Stop error: ' + e.message);
      } 
    }
    elements.qrReaderContainer.classList.add('hidden');
  }

  async function sendUnlockSignal() {
    elements.unlockBtn.disabled = true;
    elements.unlockStatus.textContent = '送信中...';
    try {
      const { data, error } = await state.supabase.rpc('unlock_session', { session_id: state.sessionId });
      if (data && data.success) {
        elements.unlockStatus.textContent = '✅ アンロック成功！';
        elements.unlockBtn.innerHTML = '<span>SUCCESS</span>';
      } else {
        elements.unlockStatus.textContent = '⚠️ セッションなし';
        elements.unlockBtn.disabled = false;
      }
    } catch (e) { elements.unlockStatus.textContent = '❌ 送信失敗'; elements.unlockBtn.disabled = false; }
  }

  // ============================================
  // スクワット検出 (MediaPipe)
  // ============================================
  async function initMediaPipe() {
    updateStatus('AI読み込み中...');
    const pose = new Pose({ locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/pose/${file}` });
    pose.setOptions({ modelComplexity: 0, smoothLandmarks: true, minDetectionConfidence: 0.5, minTrackingConfidence: 0.5 });
    pose.onResults(onPoseResults);

    const camera = new Camera(elements.camera, {
      onFrame: async () => { await pose.send({ image: elements.camera }); },
      facingMode: 'user'
    });
    state.poseCamera = camera;
    await camera.start();
    
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
    if (!results.poseLandmarks) { updateStatus('NO PERSON'); elements.guide.classList.remove('hidden'); return; }

    const lm = results.poseLandmarks;
    const landmarks = [lm[23], lm[25], lm[27], lm[24], lm[26], lm[28]];
    if (landmarks.some(l => l.visibility < 0.5)) { updateStatus('SHOW BODY'); elements.guide.classList.remove('hidden'); return; }
    
    elements.guide.classList.add('hidden');
    drawPose(ctx, lm, elements.canvas.width, elements.canvas.height);

    const leftAngle = calculateAngle(lm[23], lm[25], lm[27]);
    const rightAngle = calculateAngle(lm[24], lm[26], lm[28]);

    if (!state.isSquatting && leftAngle < 105 && rightAngle < 105) {
      state.isSquatting = true;
      playSoundSquatDown();
      updateStatus('DOWN');
    } else if (state.isSquatting && leftAngle > 165 && rightAngle > 165) {
      state.isSquatting = false;
      state.squatCount++;
      elements.squatCountLabel.textContent = state.squatCount;
      speakText(state.squatCount.toString());
      
      if (state.squatCount >= state.targetCount) {
        playSoundComplete();
        onSquatComplete();
      } else {
        playSoundCount();
        updateStatus(`${state.squatCount} REPS`);
      }
    }
  }

  function calculateAngle(a, b, c) {
    const r = Math.atan2(c.y - b.y, c.x - b.x) - Math.atan2(a.y - b.y, a.x - b.x);
    let deg = Math.abs(r * 180 / Math.PI);
    return deg > 180 ? 360 - deg : deg;
  }

  function drawPose(ctx, lm, w, h) {
    ctx.strokeStyle = '#CCFF00'; ctx.lineWidth = 4;
    [[11,13],[13,15],[12,14],[14,16],[11,12],[11,23],[12,24],[23,24],[23,25],[25,27],[24,26],[26,28]].forEach(([a, b]) => {
      ctx.beginPath(); ctx.moveTo(lm[a].x * w, lm[a].y * h); ctx.lineTo(lm[b].x * w, lm[b].y * h); ctx.stroke();
    });
  }

  async function onSquatComplete() {
    const now = Date.now();
    const time = state.startTime ? Math.round((now - state.startTime) / 1000) : '--';
    elements.sessionTimeLabel.textContent = time;
    
    // カメラを停止
    if (state.poseCamera) {
      try {
        await state.poseCamera.stop();
        state.poseCamera = null;
        debugLog('Pose camera stopped.');
      } catch (e) {
        debugLog('Pose camera stop error: ' + e.message);
      }
    }
    
    showScreen('complete-screen');
  }

  // ============================================
  // 音声 & 初期化
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
    window.speechSynthesis.cancel();
    const utter = new SpeechSynthesisUtterance(text);
    utter.lang = 'en-US'; utter.rate = 1.1;
    window.speechSynthesis.speak(utter);
  }

  const playSoundCount = () => playTone(440 + (state.squatCount * 50), 0.15);
  const playSoundComplete = () => [523, 659, 783, 1046].forEach((f, i) => setTimeout(() => playTone(f, 0.3), i * 100));
  const playSoundSquatDown = () => playTone(600, 0.08);

  function clearSession() {
    debugLog('Clearing session data...');
    state.sessionId = null;
    state.squatCount = 0;
    state.startTime = null;
    state.isSquatting = false;

    // UIリセット
    elements.sessionInput.value = '';
    elements.currentSessionLabel.textContent = '-';
    elements.squatCountLabel.textContent = '0';
    elements.sessionTimeLabel.textContent = '--';
    elements.unlockStatus.textContent = '';
    elements.unlockBtn.disabled = false;
    elements.unlockBtn.innerHTML = '<span>UNLOCK PC</span>';
    updateStatus('READY');

    // カメラを完全に停止
    if (state.poseCamera) {
      state.poseCamera.stop().catch(() => {});
      state.poseCamera = null;
      debugLog('Pose camera stopped in clearSession.');
    }
  }

  async function init() {
    debugLog(`[THE TOLL] 初期化 ${APP_VERSION}`);
    
    state.supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    state.supabase.auth.onAuthStateChange((event, session) => {
      if (session) { state.user = session.user; updateUserInfo(session.user); }
      else { state.user = null; showAuthForm(); }
    });

    try { state.html5QrCode = new Html5Qrcode("qr-reader"); } catch(e) {}

    // イベントリスナー
    elements.loginBtn.onclick = handleLogin;
    elements.signupBtn.onclick = handleSignup;
    elements.logoutBtn.onclick = handleLogout;
    elements.subscribeBtn.onclick = handleSubscribe;
    elements.toSessionBtn.onclick = () => showScreen('session-screen');
    elements.startBtn.onclick = () => startSession();
    elements.scanQrBtn.onclick = () => startQRScan();
    elements.closeScanBtn.onclick = () => stopQRScan();
    elements.unlockBtn.onclick = sendUnlockSignal;
    elements.backToSessionBtn.onclick = (e) => {
      e.preventDefault();
      clearSession();
      showScreen('session-screen');
    };

    // URLパラメータ
    const urlParams = new URLSearchParams(window.location.search);
    const sid = urlParams.get('session');
    const target = urlParams.get('target');
    
    if (target) {
      const parsed = parseInt(target);
      if (!isNaN(parsed) && parsed > 0) {
        state.targetCount = parsed;
        debugLog('Target count from URL: ' + state.targetCount);
      }
    }

    if (sid) {
      elements.sessionInput.value = sid;
      window.history.replaceState({}, document.title, window.location.pathname);
    }

    document.addEventListener('click', () => {
      if (!state.audioContext) state.audioContext = new (window.AudioContext || window.webkitAudioContext)();
    }, { once: true });
  }

  init();
})();
