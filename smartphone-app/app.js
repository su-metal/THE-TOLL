// THE TOLL - スクワット検出アプリ (Reduced Duplication & Fixed Session Reset)
// MediaPipe Poseを使用してスクワットをカウント

(function() {
  'use strict';

  // ============================================
  // 設定
  // ============================================
  const APP_VERSION = 'v2.17 (Rescue Update)';
  const SUPABASE_URL = 'https://qcnzleiyekbgsiyomwin.supabase.co';
  const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFjbnpsZWl5ZWtiZ3NpeW9td2luIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njg0Mjk2NzMsImV4cCI6MjA4NDAwNTY3M30.NlGUfxDPzMgtu_J0vX7FMe-ikxafboGh5GMr-tsaLfI';
  const APP_LANG = new URLSearchParams(window.location.search).get('lang') === 'ja' ? 'ja' : 'en';
  const I18N = {
    en: {
      logged_in_as: 'Logged in:',
      membership_checking: 'Checking membership...',
      membership_check_failed: 'Membership check failed',
      membership_active: 'MEMBERSHIP: ACTIVE',
      membership_trial: 'MEMBERSHIP: TRIAL',
      membership_free: 'MEMBERSHIP: FREE',
      go_to_session: 'Go to PC Session',
      go_to_session_free: 'Go to PC Session (Free)',
      upgrade_to_pro: 'UPGRADE TO PRO',
      subscription_required: 'Paid plan required',
      manage_subscription: 'Manage Subscription',
      trial_days_left: 'TRIAL: {days} day(s) left',
      open_customer_portal_failed: 'Failed to open customer portal.',
      checkout_success_message: 'Payment completed. Membership will be reflected shortly.',
      checkout_cancel_message: 'Checkout was canceled.',
      google_login_failed: 'Google login failed: ',
      google_login_network_error: 'Google login failed due to network error.',
      checkout_url_failed: 'Failed to get checkout URL.',
      checkout_prepare_failed: 'Failed to prepare checkout.',
      enter_session_id: 'Please enter a session ID.',
      scanner_init_failed: 'Scanner init failed.',
      camera_start_failed: 'Camera start failed.',
      sending: 'Sending...',
      session_expired: 'Session expired. Please log in again.',
      send_failed: 'Send failed',
      unlock_success: 'Unlocked successfully!',
      session_not_found: 'Session not found',
      ai_loading: 'Loading AI...',
      confirm_cancel_training: 'Stop this training session?'
    },
    ja: {
      logged_in_as: 'ログイン中:',
      membership_checking: '会員確認中...',
      membership_check_failed: '会員確認に失敗しました',
      membership_active: '会員ステータス: 有効',
      membership_trial: '会員ステータス: トライアル',
      membership_free: '会員ステータス: 無料',
      go_to_session: 'PC連携へ進む',
      go_to_session_free: 'PC連携へ進む（無料）',
      upgrade_to_pro: 'PROへアップグレード',
      subscription_required: 'サブスク登録が必要です',
      manage_subscription: 'サブスク管理',
      trial_days_left: 'トライアル残り {days} 日',
      open_customer_portal_failed: 'サブスク管理ページを開けませんでした。',
      checkout_success_message: '決済が完了しました。会員状態の反映まで少し待ってください。',
      checkout_cancel_message: '決済はキャンセルされました。',
      google_login_failed: 'Googleログイン失敗: ',
      google_login_network_error: 'Googleログインに失敗しました。ネットワークを確認してください。',
      checkout_url_failed: '決済URLの取得に失敗しました。',
      checkout_prepare_failed: '決済の準備に失敗しました。',
      enter_session_id: 'セッションIDを入力してください',
      scanner_init_failed: 'スキャナー初期化失敗',
      camera_start_failed: 'カメラ起動失敗',
      sending: '送信中...',
      session_expired: 'ログインセッションが切れています',
      send_failed: '送信失敗',
      unlock_success: 'アンロック成功！',
      session_not_found: 'セッションなし',
      ai_loading: 'AI読み込み中...',
      confirm_cancel_training: 'トレーニングを中断しますか？'
    }
  };
  const t = (key, vars = {}) => {
    const base = (I18N[APP_LANG] && I18N[APP_LANG][key]) || I18N.en[key] || key;
    return Object.keys(vars).reduce(
      (acc, k) => acc.replaceAll(`{${k}}`, String(vars[k])),
      base
    );
  };

  // ============================================
  // 状態管理
  // ============================================
  const state = {
    supabase: null,
    user: null,
    subscriptionStatus: 'inactive',
    planTier: 'free',
    trialEndsAt: null,
    trialDaysLeft: 0,
    isPro: false,
    sessionId: null,
    squatCount: 0,
    targetCount: 20, // デフォルト
    exerciseType: 'SQUAT', // SQUAT, PUSHUP, SITUP
    cycleIndex: 0,
    isSquatting: false,
    startTime: null,
    audioContext: null,
    html5QrCode: null,
    poseCamera: null,
    deferredPrompt: null,
    pushupBaseline: null,
    situpBaseline: null,
    calibrationBuffer: [], // NEW: 安定判定用のバッファ
    _lastPersonTs: null,
    _lastPushLog: null,
    _squatReadySpoken: false,
    _membershipCheckInFlight: false
  };
 
  const EXERCISES = [
    { type: 'SQUAT', label: 'SQUAT', defaultCount: 20 },
    { type: 'PUSHUP', label: 'PUSH-UP', defaultCount: 20 },
    { type: 'SITUP', label: 'SIT-UP', defaultCount: 20 }
  ];

  // ============================================
  // DOM要素
  // ============================================
  const elements = {
    authScreen: document.getElementById('auth-screen'),
    authForm: document.getElementById('auth-form'),
    userInfo: document.getElementById('user-info'),
    googleLoginBtn: document.getElementById('google-login-btn'),
    userDisplayEmail: document.getElementById('user-display-email'),
    subscriptionStatusBadge: document.getElementById('subscription-status-badge'),
    trialBadge: document.getElementById('trial-badge'),
    installBtn: document.getElementById('install-btn'),
    subscribeBtn: document.getElementById('subscribe-btn'),
    manageSubscriptionBtn: document.getElementById('manage-subscription-btn'),
    toSessionBtn: document.getElementById('to-session-btn'),
    logoutBtn: document.getElementById('logout-btn'),

    sessionScreen: document.getElementById('session-screen'),
    sessionInput: document.getElementById('session-input'),
    startBtn: document.getElementById('start-btn'),
    scanQrBtn: document.getElementById('scan-qr-btn'),
    nextExerciseDisplay: document.getElementById('next-exercise-display'),
    resetCycleBtn: document.getElementById('reset-cycle-btn'),
    cycleDebugInfo: document.getElementById('cycle-debug-info'), // NEW
    qrReaderContainer: document.getElementById('qr-reader-container'),
    closeScanBtn: document.getElementById('close-scan-btn'),
    
    squatScreen: document.getElementById('squat-screen'),
    camera: document.getElementById('camera'),
    canvas: document.getElementById('pose-canvas'),
    squatCountLabel: document.getElementById('squat-count'),
    statusLabel: document.getElementById('status'),
    guide: document.getElementById('guide'),
    currentSessionLabel: document.getElementById('current-session'),
    exerciseLabel: document.getElementById('exercise-label'), // NEW
    
    completeScreen: document.getElementById('complete-screen'),
    sessionTimeLabel: document.getElementById('session-time'),
    targetCountDisplay: document.getElementById('target-count-display'),
    completeRepsDisplay: document.getElementById('complete-reps-display'),
    unlockBtn: document.getElementById('unlock-btn'),
    unlockStatus: document.getElementById('unlock-status'),
    backToSessionBtn: document.getElementById('back-to-session-btn'),
    recalibrateBtn: document.getElementById('recalibrate-btn'),
    hint: document.getElementById('squat-hint'),
    overlayUi: document.querySelector('.overlay-ui'),
    fullscreenBtn: document.getElementById('fullscreen-btn')
  };

  // ============================================
  // ユーティリティ
  // ============================================
  function debugLog(msg) {
    // console.log(msg); // 完全に停止
  }


  function updateStatus(text) { elements.statusLabel.textContent = text; }
  function setManageSubscriptionVisible(visible) {
    if (!elements.manageSubscriptionBtn) return;
    elements.manageSubscriptionBtn.classList.toggle('hidden', !visible);
  }
  function setTrialBadge(text) {
    if (!elements.trialBadge) return;
    if (!text) {
      elements.trialBadge.classList.add('hidden');
      elements.trialBadge.textContent = '';
      return;
    }
    elements.trialBadge.textContent = text;
    elements.trialBadge.classList.remove('hidden');
  }

  function showScreen(screenId) {
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    document.getElementById(screenId).classList.add('active');
  }

  function toggleFullscreen() {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(err => {
        debugLog(`Error Fullscreen: ${err.message}`);
      });
    } else {
      document.exitFullscreen();
    }
  }

  // ============================================
  // 認証・サブスク
  // ============================================
  async function updateUserInfo(user) {
    debugLog(`Updating info for: ${user.email}`);
    elements.userDisplayEmail.textContent = `${t('logged_in_as')} ${user.email}`;
    elements.authForm.classList.add('hidden');
    elements.userInfo.classList.remove('hidden');

    if (state._membershipCheckInFlight) return;
    state._membershipCheckInFlight = true;

    // Strict gate: lock session entry until membership is confirmed.
    elements.toSessionBtn.disabled = true;
    elements.toSessionBtn.textContent = t('membership_checking');
    elements.subscribeBtn.classList.add('hidden');
    setManageSubscriptionVisible(false);
    elements.subscriptionStatusBadge.textContent = 'MEMBERSHIP: CHECKING';
    elements.subscriptionStatusBadge.className = 'status-inactive';

    try {
      await state.supabase.auth.getSession();

      let profile = null;
      let lastError = null;
      for (let i = 0; i < 8; i++) {
        const { data, error } = await state.supabase
          .from('profiles')
          .select('subscription_status, plan_tier, trial_ends_at, trial_used')
          .eq('id', user.id)
          .single();
        profile = data || null;
        lastError = error || null;
        if (profile) break;
        await new Promise(r => setTimeout(r, 400));
      }

      if (!profile) {
        debugLog('Profile missing or unreadable: ' + (lastError?.message || 'no row'));
        elements.subscriptionStatusBadge.textContent = 'MEMBERSHIP: VERIFY FAILED';
        elements.subscriptionStatusBadge.className = 'status-inactive';
        setTrialBadge('');
        elements.toSessionBtn.disabled = true;
        elements.toSessionBtn.textContent = t('membership_check_failed');
        elements.subscribeBtn.classList.remove('hidden');
        setManageSubscriptionVisible(false);
        return;
      }

      // Initialize one-time 7-day trial for new free users.
      if (!profile.trial_ends_at && !profile.trial_used && profile.subscription_status !== 'active') {
        const trialEnds = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
        const { error: trialInitError } = await state.supabase
          .from('profiles')
          .update({ trial_ends_at: trialEnds, trial_used: true, plan_tier: 'free' })
          .eq('id', user.id);
        if (!trialInitError) {
          profile.trial_ends_at = trialEnds;
          profile.trial_used = true;
          if (!profile.plan_tier) profile.plan_tier = 'free';
        } else {
          debugLog('Trial init skipped: ' + trialInitError.message);
        }
      }

      const rawStatus = (profile.subscription_status || 'inactive').toString();
      const normalizedStatus = rawStatus.trim().toLowerCase();
      const planTier = (profile.plan_tier || 'free').toString().trim().toLowerCase();
      const trialEndsAt = profile.trial_ends_at ? new Date(profile.trial_ends_at) : null;
      const now = new Date();
      const isTrialActive = !!(trialEndsAt && trialEndsAt.getTime() > now.getTime());
      const isActive = normalizedStatus === 'active';
      const isPro = isActive || isTrialActive;
      const trialDaysLeft = isTrialActive
        ? Math.max(1, Math.ceil((trialEndsAt.getTime() - now.getTime()) / (24 * 60 * 60 * 1000)))
        : 0;

      state.subscriptionStatus = normalizedStatus;
      state.planTier = planTier;
      state.trialEndsAt = profile.trial_ends_at || null;
      state.trialDaysLeft = trialDaysLeft;
      state.isPro = isPro;

      if (isActive) {
        elements.subscriptionStatusBadge.textContent = t('membership_active');
        elements.subscriptionStatusBadge.className = 'status-active';
        setTrialBadge('');
      } else if (isTrialActive) {
        elements.subscriptionStatusBadge.textContent = t('membership_trial');
        elements.subscriptionStatusBadge.className = 'status-active';
        setTrialBadge(t('trial_days_left', { days: trialDaysLeft }));
      } else {
        elements.subscriptionStatusBadge.textContent = t('membership_free');
        elements.subscriptionStatusBadge.className = 'status-inactive';
        setTrialBadge('');
      }

      if (isActive) {
        elements.subscribeBtn.classList.add('hidden');
        setManageSubscriptionVisible(true);
        if (elements.manageSubscriptionBtn) {
          elements.manageSubscriptionBtn.textContent = t('manage_subscription');
        }
        elements.toSessionBtn.disabled = false;
        elements.toSessionBtn.textContent = t('go_to_session');
      } else if (isTrialActive) {
        elements.subscribeBtn.classList.remove('hidden');
        elements.subscribeBtn.textContent = t('upgrade_to_pro');
        setManageSubscriptionVisible(false);
        elements.toSessionBtn.disabled = false;
        elements.toSessionBtn.textContent = t('go_to_session');
      } else {
        elements.subscribeBtn.classList.remove('hidden');
        elements.subscribeBtn.textContent = t('upgrade_to_pro');
        setManageSubscriptionVisible(false);
        elements.toSessionBtn.disabled = false;
        elements.toSessionBtn.textContent = t('go_to_session_free');
      }
    } catch (e) {
      const msg = (e && e.message) ? e.message : String(e);
      debugLog('Profile logic crash: ' + msg);
      elements.subscriptionStatusBadge.textContent = `MEMBERSHIP: ERROR (${msg.slice(0, 18)})`;
      elements.subscriptionStatusBadge.className = 'status-inactive';
      setTrialBadge('');
      elements.toSessionBtn.disabled = true;
      elements.toSessionBtn.textContent = t('membership_check_failed');
      elements.subscribeBtn.classList.remove('hidden');
      setManageSubscriptionVisible(false);
    } finally {
      state._membershipCheckInFlight = false;
    }
  }

  async function handleGoogleLogin() {
    try {
      const redirectTo = `${window.location.origin}${window.location.pathname}${window.location.search}`;
      const { error } = await state.supabase.auth.signInWithOAuth({
        provider: 'google',
        options: { redirectTo }
      });
      if (error) alert(t('google_login_failed') + error.message);
    } catch (e) {
      alert(t('google_login_network_error'));
      debugLog('Google login network error: ' + (e?.message || e));
    }
  }

  async function handleLogout() { await state.supabase.auth.signOut(); }

  async function handleSubscribe() {
    try {
      const { data: sessionData } = await state.supabase.auth.getSession();
      const accessToken = sessionData?.session?.access_token;
      if (!accessToken) {
        alert('Please log in again before starting checkout.');
        return;
      }

      const plan = 'yearly';
      const locale = (navigator.language || 'en').toLowerCase();
      const currency = locale.startsWith('ja') ? 'jpy' : 'usd';
      const res = await fetch(`${SUPABASE_URL}/functions/v1/create-checkout`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`,
          'apikey': SUPABASE_ANON_KEY
        },
        body: JSON.stringify({ plan, currency })
      });

      const payload = await res.json().catch(() => ({}));
      if (!res.ok) {
        const detail = payload?.error || `HTTP ${res.status}`;
        alert(`${t('checkout_url_failed')} ${detail}`);
        return;
      }

      if (payload?.url) window.location.href = payload.url;
      else alert(t('checkout_url_failed'));
    } catch (e) { alert(t('checkout_prepare_failed')); }
  }

  async function handleManageSubscription() {
    try {
      const { data: sessionData } = await state.supabase.auth.getSession();
      const accessToken = sessionData?.session?.access_token;
      if (!accessToken) {
        alert('Please log in again before opening subscription settings.');
        return;
      }

      const res = await fetch(`${SUPABASE_URL}/functions/v1/create-customer-portal`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`,
          'apikey': SUPABASE_ANON_KEY
        }
      });

      const payload = await res.json().catch(() => ({}));
      if (!res.ok) {
        const detail = payload?.error || `HTTP ${res.status}`;
        alert(`${t('open_customer_portal_failed')} ${detail}`);
        return;
      }

      if (payload?.url) window.location.href = payload.url;
      else alert(t('open_customer_portal_failed'));
    } catch (e) {
      alert(t('open_customer_portal_failed'));
    }
  }

  // ============================================
  // セッション・QR
  // ============================================
  function startSession(sid, targetFromUrl) {
    const sessionId = (sid || elements.sessionInput.value).trim().toUpperCase();
    if (!sessionId || sessionId.length < 4) return alert(t('enter_session_id'));
    
    state.sessionId = sessionId;
    state.squatCount = 0;
    state.startTime = Date.now();
    elements.currentSessionLabel.textContent = sessionId;
    elements.squatCountLabel.textContent = '0';

    // サイクル反映
    loadNextExercise();
    debugLog(`Session Start: ${state.exerciseType}, Index: ${state.cycleIndex}`);

    // Settings Guard用の特別ID判定
    if (sessionId.startsWith('SET-')) {
      state.targetCount = 30;
      debugLog('SETTINGS LOCK MISSION: 30 REPS');
    } else if (!state.isPro) {
      state.exerciseType = 'SQUAT';
      state.targetCount = 10;
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
    
    // 自動的にフルスクリーンモードに入る
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(err => {
        debugLog(`Auto-fullscreen failed: ${err.message}`);
      });
    }
    
    showScreen('squat-screen');
    initMediaPipe().catch(err => debugLog('Camera error: ' + err.message));
  }

  async function startQRScan() {
    if (!state.html5QrCode) return alert(t('scanner_init_failed'));
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
    } catch (err) { alert(t('camera_start_failed')); elements.qrReaderContainer.classList.add('hidden'); }
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
    elements.unlockStatus.textContent = t('sending');
    try {
      const { data: sessionData } = await state.supabase.auth.getSession();
      if (!sessionData?.session) {
        elements.unlockStatus.textContent = `❌ ${t('session_expired')}`;
        elements.unlockBtn.disabled = false;
        return;
      }

      const sid = (state.sessionId || '').trim().toUpperCase();
      const { data, error } = await state.supabase.rpc('unlock_session', { session_id: sid });
      if (error) {
        elements.unlockStatus.textContent = `❌ ${t('send_failed')}: ${error.message}`;
        elements.unlockBtn.disabled = false;
        return;
      }
      if (data && data.success) {
        elements.unlockStatus.textContent = `✅ ${t('unlock_success')}`;
        elements.unlockBtn.innerHTML = '<span>SUCCESS</span>';
      } else {
        elements.unlockStatus.textContent = `⚠️ ${t('session_not_found')} (${sid})`;
        elements.unlockBtn.disabled = false;
      }
    } catch (e) {
      elements.unlockStatus.textContent = `❌ ${t('send_failed')}`;
      elements.unlockBtn.disabled = false;
    }
  }

  // ============================================
  // スクワット検出 (MediaPipe)
  // ============================================
  async function initMediaPipe() {
    updateStatus(t('ai_loading'));
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
    if (!results.poseLandmarks) { 
      updateStatus('NO PERSON'); 
      elements.guide.classList.remove('hidden'); 
      // 2秒以上人がいなければ基準をリセット
      if (state._lastPersonTs && Date.now() - state._lastPersonTs > 2000) {
        if (state.pushupBaseline !== null || state.situpBaseline !== null) {
          state.pushupBaseline = null;
          state.situpBaseline = null;
          state.calibrationBuffer = [];
          debugLog('Baselines Reset (No person)');
        }
      }
      return; 
    }
 
    const lm = results.poseLandmarks;
    state._lastPersonTs = Date.now();
    
    // 種目に応じた検知要件の定義
    let requiredLandmarks = [];
    let visibilityMsg = 'SHOW FULL BODY';
    
    if (state.exerciseType === 'SQUAT') {
      requiredLandmarks = [11, 12, 23, 24, 25, 26, 27, 28]; // 全身
      visibilityMsg = 'SHOW FULL BODY';
    } else if (state.exerciseType === 'PUSHUP') {
      requiredLandmarks = [11, 12, 23, 24]; // 肩と腰
      visibilityMsg = 'SHOW TORSO';
    } else if (state.exerciseType === 'SITUP') {
      requiredLandmarks = [0, 11, 12]; // 頭と肩
      visibilityMsg = 'SHOW UPPER BODY';
    }
    
    const isVisible = requiredLandmarks.every(idx => lm[idx] && lm[idx].visibility > 0.5);
    
    // ガイドオーバーレイのテキストを更新
    if (elements.guide) {
        elements.guide.textContent = visibilityMsg;
    }
    
    if (!isVisible) {
      updateStatus(visibilityMsg);
      elements.guide.classList.remove('hidden');
      return;
    }
    
    elements.guide.classList.add('hidden');
    drawPose(ctx, lm, elements.canvas.width, elements.canvas.height);
  
    if (state.exerciseType === 'SQUAT') {
      handleSquatDetection(lm);
    } else if (state.exerciseType === 'PUSHUP') {
      handlePushupDetection(lm);
    } else if (state.exerciseType === 'SITUP') {
      handleSitupDetection(lm);
    }
  }

  // エクササイズ画面にEXITボタンを追加
  function addExitButton() {
     const container = document.getElementById('camera-overlay-ui'); // カメラUIオーバーレイが存在すると仮定
     if (!container) return;

     // 既にあれば削除
     const existingBtn = document.getElementById('exercise-exit-btn');
     if (existingBtn) existingBtn.remove();
     
     const exitBtn = document.createElement('button');
     exitBtn.id = 'exercise-exit-btn';
     exitBtn.className = 'absolute top-4 right-4 bg-red-600 text-white px-4 py-2 rounded font-bold z-50';
     exitBtn.textContent = 'EXIT';
     exitBtn.onclick = cancelSession;
     
     container.appendChild(exitBtn);
  }
 
  function handleSquatDetection(lm) {
    const leftAngle = calculateAngle(lm[23], lm[25], lm[27]);
    const rightAngle = calculateAngle(lm[24], lm[26], lm[28]);
    
    // SQUATにもキャリブレーション（準備完了通知）を追加
    if (state.startTime && (Date.now() - state.startTime < 2000)) {
        updateStatus('STAND READY...');
        return;
    }
    
    if (!state._squatReadySpoken) {
        playSoundCount();
        speakText("Ready. Start!");
        state._squatReadySpoken = true;
    }

    if (!state.isSquatting && leftAngle < 105 && rightAngle < 105) {
      state.isSquatting = true;
      playSoundSquatDown();
      updateStatus('DOWN');
    } else if (state.isSquatting && leftAngle > 165 && rightAngle > 165) {
      countRep();
    }
  }
 
  function handlePushupDetection(lm) {
    if (lm[11].visibility < 0.6 || lm[12].visibility < 0.6) {
      updateStatus('SHOW SHOULDERS');
      state.calibrationBuffer = []; // 隠れたらバッファもリセット
      return;
    }

    const shoulderY = (lm[11].y + lm[12].y) / 2;
    
    // 基準が設定されていない場合、安定するまで待つ (キャリブレーション)
    if (state.pushupBaseline === null) {
      updateStatus('CALIBRATING...');
      
      // 音声ガイダンス (最初だけ)
      if (!state._lastCalibSpeak || Date.now() - state._lastCalibSpeak > 5000) {
        speakText("Please stay still.");
        state._lastCalibSpeak = Date.now();
      }

      state.calibrationBuffer.push(shoulderY);
      
      if (state.calibrationBuffer.length > 30) { // 30フレーム(約1秒)安定を待つ
        const avg = state.calibrationBuffer.reduce((a, b) => a + b) / state.calibrationBuffer.length;
        const variance = state.calibrationBuffer.reduce((a, b) => a + Math.pow(b - avg, 2), 0) / state.calibrationBuffer.length;
        
        if (variance < 0.0001) { // ほとんど動いていない
          state.pushupBaseline = avg;
          state.calibrationBuffer = [];
          debugLog(`Baseline SET: ${avg.toFixed(3)} (Stable)`);
          playSoundCount();
          speakText("Ready. Start!"); // 開始の合図
        } else {
          state.calibrationBuffer.shift(); // 安定しないので古いデータを捨てる
        }
      }
      return;
    }

    // 安定判定
    const thresholdDown = 0.12; 
    const thresholdUp = 0.05;
    const diff = Math.abs(shoulderY - state.pushupBaseline);
    
    if (!state._lastPushLog || Date.now() - state._lastPushLog > 1000) {
      debugLog(`Diff: ${diff.toFixed(3)} (Base: ${state.pushupBaseline.toFixed(2)})`);
      state._lastPushLog = Date.now();
    }

    if (!state.isSquatting && diff > thresholdDown) {
      state.isSquatting = true;
      playSoundSquatDown();
      updateStatus('DOWN');
    } else if (state.isSquatting && diff < thresholdUp) {
      countRep();
    }
  }
 
  function handleSitupDetection(lm) {
    // 鼻か肩、見えている部位の平均Y座標を使う (より柔軟に)
    const pts = [lm[0], lm[11], lm[12]].filter(p => p.visibility > 0.5);
    if (pts.length === 0) {
      updateStatus('SHOW UPPER BODY');
      state.calibrationBuffer = [];
      return;
    }

    // 画面が縦向き（Portrait）なのにアプリが横向き（forced rotation）の場合、
    // ユーザーの上下動はカメラのX軸になるため、判定軸を切り替える
    const isPortrait = window.innerHeight > window.innerWidth;
    const currentY = pts.reduce((sum, p) => sum + (isPortrait ? p.x : p.y), 0) / pts.length;
    
    // 基準が設定されていない場合、安定するまで待つ
    if (state.situpBaseline === null) {
      updateStatus('CALIBRATING...');

      if (!state._lastCalibSpeak || Date.now() - state._lastCalibSpeak > 8000) {
        speakText("Sit up and stay still. Side view recommended.");
        state._lastCalibSpeak = Date.now();
      }

      state.calibrationBuffer.push(currentY);
      
      if (state.calibrationBuffer.length > 30) {
        const avg = state.calibrationBuffer.reduce((a, b) => a + b) / state.calibrationBuffer.length;
        const variance = state.calibrationBuffer.reduce((a, b) => a + Math.pow(b - avg, 2), 0) / state.calibrationBuffer.length;
        
        if (variance < 0.0001) {
          state.situpBaseline = avg;
          state.calibrationBuffer = [];
          debugLog(`Situp Baseline SET: ${avg.toFixed(3)}`);
          playSoundCount();
          speakText("Ready. Start!");
        } else {
          state.calibrationBuffer.shift();
        }
      }
      return;
    }

    const thresholdDown = 0.18; // 動作を少し検出しやすく調整
    const thresholdUp = 0.07;
    const diff = Math.abs(currentY - state.situpBaseline);

    if (!state._lastPushLog || Date.now() - state._lastPushLog > 1000) {
      debugLog(`Situp Diff: ${diff.toFixed(3)} (Base: ${state.situpBaseline.toFixed(2)})`);
      state._lastPushLog = Date.now();
    }

    if (!state.isSquatting && diff > thresholdDown) {
      state.isSquatting = true;
      playSoundSquatDown();
      updateStatus('GO DOWN');
    } else if (state.isSquatting && diff < thresholdUp) {
      countRep();
    }
  }
 
  function countRep() {
    state.isSquatting = false;
    state.squatCount++;
    elements.squatCountLabel.textContent = state.squatCount;
    speakText(state.squatCount.toString());
    
    if (state.squatCount >= state.targetCount) {
      playSoundComplete();
      saveCycleProgress(); // 次へ
      onSquatComplete();
    } else {
      playSoundCount();
      updateStatus(`${state.squatCount} REPS`);
    }
  }
 
  function cycleExercise() {
    if (!state.isPro) {
      state.cycleIndex = 0;
      state.exerciseType = 'SQUAT';
      loadNextExercise();
      return;
    }
    saveCycleProgress();
    debugLog('Manual Cycle triggered');
  }

  function loadNextExercise() {
    try {
      const saved = localStorage.getItem('the_toll_cycle_index');
      let idx = parseInt(saved);
      if (isNaN(idx)) idx = 0;
      
      if (!state.isPro) {
        idx = 0;
      } else {
        idx = idx % EXERCISES.length;
      }
      state.cycleIndex = idx;
      state.exerciseType = EXERCISES[idx].type;
      
      const label = EXERCISES[idx].label;
      const type = EXERCISES[idx].type;
      debugLog(`Cycle Sync: ${label} (ID: ${idx})`);
      
      // 全画面のUIを一斉に書き換え
      if (elements.exerciseLabel) elements.exerciseLabel.textContent = label;
      
      // ヒントを動的に変更
      if (elements.hint) {
        if (type === 'SQUAT') elements.hint.textContent = 'SQUAT DEEP';
        else if (type === 'PUSHUP') elements.hint.textContent = 'LOWER YOUR BODY';
        else if (type === 'SITUP') elements.hint.textContent = 'USE SIDE VIEW';
      }

      // 腹筋のみランドスケープUIを適用
      if (elements.overlayUi) {
        if (type === 'SITUP') {
          elements.overlayUi.classList.add('landscape-mode');
        } else {
          elements.overlayUi.classList.remove('landscape-mode');
        }
      }
      if (elements.nextExerciseDisplay) {
        elements.nextExerciseDisplay.textContent = state.isPro ? `NEXT: ${label}` : 'NEXT: SQUAT (FREE)';
      }
      if (elements.cycleDebugInfo) elements.cycleDebugInfo.textContent = `ID: ${idx}`;
      
      state.targetCount = state.isPro ? EXERCISES[idx].defaultCount : 10;
 
      // ターゲット表示も更新
      if (elements.targetCountDisplay) elements.targetCountDisplay.textContent = state.targetCount;
      // if (elements.completeRepsDisplay) elements.completeRepsDisplay.textContent = state.targetCount; //削除: 完了画面の表示は完了時に行う
      
    } catch (e) {
      debugLog('Error loading exercise cycle: ' + e.message);
    }
  }
 
  function saveCycleProgress() {
    try {
      const currentIdx = state.cycleIndex;
      const nextIdx = (currentIdx + 1) % EXERCISES.length;
      
      localStorage.setItem('the_toll_cycle_index', nextIdx);
      debugLog(`Cycle Step: ${currentIdx} -> ${nextIdx}`);
      
      // 保存した直後に読み込み直してUIに反映
      loadNextExercise();
    } catch (e) {
      debugLog('Error saving exercise cycle: ' + e.message);
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
    if (elements.completeRepsDisplay) elements.completeRepsDisplay.textContent = state.squatCount;
    
    speakText("Mission Complete!");
    
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
    state.pushupBaseline = null;
    state.situpBaseline = null;
    state._squatReadySpoken = false;

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

  function cancelSession() {
    debugLog('Session Cancelled by User');
    
    // カメラ停止
    if (state.poseCamera) {
      state.poseCamera.stop().catch(() => {});
      state.poseCamera = null;
    }
    
    state.isSquatting = false;
    state.squatCount = 0;
    state.pushupBaseline = null;
    state.situpBaseline = null;
    state._squatReadySpoken = false;
    
    // フルスクリーン解除 (任意: ユーザー体験的に戻した方がいい場合が多い)
    if (document.fullscreenElement) {
       document.exitFullscreen().catch(()=>{});
    }

    const exitBtn = document.getElementById('exercise-exit-btn');
    if (exitBtn) exitBtn.remove();

    showScreen('session-screen');
    updateStatus('READY');
  }

  async function init() {
    debugLog(`[THE TOLL] 初期化 ${APP_VERSION}`);
    
    state.supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    state.supabase.auth.onAuthStateChange((event, session) => {
      if (session) { state.user = session.user; updateUserInfo(session.user); }
      else { state.user = null; showScreen('auth-screen'); }
    });

    try { state.html5QrCode = new Html5Qrcode("qr-reader"); } catch(e) {}

    // イベントリスナー
    elements.googleLoginBtn.onclick = handleGoogleLogin;
    elements.logoutBtn.onclick = handleLogout;
    elements.subscribeBtn.onclick = handleSubscribe;
    if (elements.manageSubscriptionBtn) {
      elements.manageSubscriptionBtn.onclick = handleManageSubscription;
    }
    elements.toSessionBtn.onclick = () => showScreen('session-screen');
    elements.startBtn.onclick = () => startSession();
    elements.scanQrBtn.onclick = () => startQRScan();
    elements.closeScanBtn.onclick = () => stopQRScan();
    elements.resetCycleBtn.onclick = (e) => {
      e.preventDefault();
      cycleExercise();
    };
    elements.unlockBtn.onclick = sendUnlockSignal;
    elements.backToSessionBtn.onclick = (e) => {
      e.preventDefault();
      clearSession();
      loadNextExercise();
      showScreen('session-screen');
    };

    // URLパラメータ
    const urlParams = new URLSearchParams(window.location.search);
    const sid = urlParams.get('session');
    const target = urlParams.get('target');
    const checkout = urlParams.get('checkout');
    const portal = urlParams.get('portal');

    if (checkout === 'success') {
      alert(t('checkout_success_message'));
      state.user && updateUserInfo(state.user);
    } else if (checkout === 'cancel') {
      alert(t('checkout_cancel_message'));
    }
    if (portal === 'return' && state.user) {
      updateUserInfo(state.user);
    }
    
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
    } else if (checkout || portal) {
      const params = new URLSearchParams(window.location.search);
      params.delete('checkout');
      params.delete('portal');
      const next = `${window.location.pathname}${params.toString() ? `?${params.toString()}` : ''}`;
      window.history.replaceState({}, document.title, next);
    }

    document.addEventListener('click', () => {
      if (!state.audioContext) state.audioContext = new (window.AudioContext || window.webkitAudioContext)();
    }, { once: true });

    if (elements.recalibrateBtn) {
      elements.recalibrateBtn.onclick = () => {
        state.pushupBaseline = null;
        state.situpBaseline = null;
        state.calibrationBuffer = [];
        debugLog('Recalibration requested');
        updateStatus('RE-CALIBRATING');
      };
    }
    
    // EXITボタン (New)
    const exitBtn = document.getElementById('exit-btn');
    if (exitBtn) {
      exitBtn.onclick = () => {
        if(!confirm(t('confirm_cancel_training'))) return;
        cancelSession();
      };
    }

    if (elements.fullscreenBtn) {
      elements.fullscreenBtn.onclick = toggleFullscreen;
    }

    // 初期表示の種目セット
    loadNextExercise();
  }

  init();
})();
