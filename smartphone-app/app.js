// THE TOLL - スクワット検出アプリ
// MediaPipe Poseを使用してスクワットをカウント

(function() {
  'use strict';

  // ============================================
  // 設定 - Supabaseの情報を入力してください
  // ============================================
  const SUPABASE_URL = 'https://qcnzleiyekbgsiyomwin.supabase.co';  // 例: https://xxxxx.supabase.co
  const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFjbnpsZWl5ZWtiZ3NpeW9td2luIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njg0Mjk2NzMsImV4cCI6MjA4NDAwNTY3M30.NlGUfxDPzMgtu_J0vX7FMe-ikxafboGh5GMr-tsaLfI';  // 例: eyJhbGci...

  // ============================================
  // 状態管理
  // ============================================
  const state = {
    sessionId: null,
    squatCount: 0,
    targetCount: 5,
    isSquatting: false,
    lastPoseTime: 0,
    poseDetected: false,
    supabase: null
  };

  // ============================================
  // DOM要素
  // ============================================
  const elements = {
    sessionScreen: document.getElementById('session-screen'),
    squatScreen: document.getElementById('squat-screen'),
    completeScreen: document.getElementById('complete-screen'),
    sessionInput: document.getElementById('session-input'),
    startBtn: document.getElementById('start-btn'),
    video: document.getElementById('camera'),
    canvas: document.getElementById('pose-canvas'),
    squatCount: document.getElementById('squat-count'),
    status: document.getElementById('status'),
    guide: document.getElementById('guide'),
    currentSession: document.getElementById('current-session'),
    squatHint: document.getElementById('squat-hint'),
    unlockBtn: document.getElementById('unlock-btn'),
    unlockStatus: document.getElementById('unlock-status')
  };

  // ============================================
  // 画面切り替え
  // ============================================
  function showScreen(screenId) {
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    document.getElementById(screenId).classList.add('active');
  }

  // ============================================
  // Supabase初期化
  // ============================================
  function initSupabase() {
    if (SUPABASE_URL === 'YOUR_SUPABASE_URL' || SUPABASE_ANON_KEY === 'YOUR_SUPABASE_ANON_KEY') {
      console.warn('[THE TOLL] Supabase未設定');
      return null;
    }
    
    try {
      state.supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
      console.log('[THE TOLL] Supabase初期化完了');
      return state.supabase;
    } catch (e) {
      console.error('[THE TOLL] Supabase初期化エラー:', e);
      return null;
    }
  }

  // ============================================
  // スクワット検出ロジック
  // ============================================
  
  // 角度計算
  function calculateAngle(a, b, c) {
    const radians = Math.atan2(c.y - b.y, c.x - b.x) - Math.atan2(a.y - b.y, a.x - b.x);
    let angle = Math.abs(radians * 180.0 / Math.PI);
    if (angle > 180) angle = 360 - angle;
    return angle;
  }

  // ポーズ検出のコールバック
  function onPoseResults(results) {
    const ctx = elements.canvas.getContext('2d');
    const canvasWidth = elements.canvas.width;
    const canvasHeight = elements.canvas.height;
    
    // キャンバスクリア
    ctx.clearRect(0, 0, canvasWidth, canvasHeight);
    
    if (!results.poseLandmarks) {
      updateStatus('🔴', '人物が検出されません');
      elements.guide.classList.remove('hidden');
      return;
    }
    
    const landmarks = results.poseLandmarks;
    
    // 必要なランドマークを取得
    const leftHip = landmarks[23];
    const leftKnee = landmarks[25];
    const leftAnkle = landmarks[27];
    const rightHip = landmarks[24];
    const rightKnee = landmarks[26];
    const rightAnkle = landmarks[28];
    
    // ランドマークの信頼度チェック（visibility >= 0.5 を要求）
    const minVisibility = 0.5;
    const requiredLandmarks = [leftHip, leftKnee, leftAnkle, rightHip, rightKnee, rightAnkle];
    const allVisible = requiredLandmarks.every(lm => lm.visibility >= minVisibility);
    
    if (!allVisible) {
      updateStatus('👀', '全身を映してください（足が見えません）');
      elements.guide.classList.remove('hidden');
      return;
    }
    
    // ガイドを非表示
    elements.guide.classList.add('hidden');
    
    // 骨格を描画
    drawPose(ctx, landmarks, canvasWidth, canvasHeight);
    
    // 膝の角度を計算（両足）
    const leftKneeAngle = calculateAngle(leftHip, leftKnee, leftAnkle);
    const rightKneeAngle = calculateAngle(rightHip, rightKnee, rightAnkle);
    
    // 両足の角度差が大きすぎる場合は無効
    const angleDiff = Math.abs(leftKneeAngle - rightKneeAngle);
    if (angleDiff > 30) {
      updateStatus('⚠️', '両足を揃えてください');
      return;
    }
    
    const avgKneeAngle = (leftKneeAngle + rightKneeAngle) / 2;
    
    state.poseDetected = true;
    state.lastPoseTime = Date.now();
    
    // スクワット検出（厳格な閾値）
    // しゃがみ: 膝角度が110度以下（より深いしゃがみを要求）
    // 立位: 膝角度が165度以上（しっかり立つことを要求）
    const isSquatPosition = avgKneeAngle < 110;
    const isStandPosition = avgKneeAngle > 165;
    
    if (!state.isSquatting && isSquatPosition) {
      // 立位→しゃがみ
      state.isSquatting = true;
      updateStatus('🟢', 'しゃがみ検出！');
      elements.video.classList.add('squat-down');
      document.getElementById('squat-hint').textContent = 'しっかり立ち上がってください';
    } else if (state.isSquatting && isStandPosition) {
      // しゃがみ→立位 = 1回カウント
      state.isSquatting = false;
      state.squatCount++;
      elements.squatCount.textContent = state.squatCount;
      elements.video.classList.remove('squat-down');
      
      console.log(`[THE TOLL] スクワット ${state.squatCount}/${state.targetCount}`);
      
      if (state.squatCount >= state.targetCount) {
        // 完了！
        onSquatComplete();
      } else {
        updateStatus('💪', `${state.squatCount}回完了！あと${state.targetCount - state.squatCount}回`);
        document.getElementById('squat-hint').textContent = 'もう一度深くしゃがんでください';
      }
    } else if (!state.isSquatting) {
      // 立っている状態
      if (avgKneeAngle < 140) {
        updateStatus('📍', `もっと深く！（${Math.round(avgKneeAngle)}° → 110°以下）`);
      } else {
        updateStatus('🧍', `膝角度: ${Math.round(avgKneeAngle)}° - 深くしゃがんでください`);
      }
      document.getElementById('squat-hint').textContent = '膝を110°以下まで曲げてください';
    } else {
      // しゃがんでいる状態
      if (avgKneeAngle < 165) {
        updateStatus('⬆️', `もっと立って！（${Math.round(avgKneeAngle)}° → 165°以上）`);
      } else {
        updateStatus('⬆️', '立ち上がってください');
      }
    }
  }

  // 骨格描画
  function drawPose(ctx, landmarks, width, height) {
    // 接続線を描画
    const connections = [
      [11, 13], [13, 15], // 左腕
      [12, 14], [14, 16], // 右腕
      [11, 12], // 肩
      [11, 23], [12, 24], // 胴体側面
      [23, 24], // 腰
      [23, 25], [25, 27], // 左脚
      [24, 26], [26, 28], // 右脚
    ];
    
    ctx.strokeStyle = 'rgba(233, 69, 96, 0.8)';
    ctx.lineWidth = 3;
    
    connections.forEach(([a, b]) => {
      const pointA = landmarks[a];
      const pointB = landmarks[b];
      
      ctx.beginPath();
      ctx.moveTo(pointA.x * width, pointA.y * height);
      ctx.lineTo(pointB.x * width, pointB.y * height);
      ctx.stroke();
    });
    
    // 関節点を描画
    ctx.fillStyle = 'rgba(78, 204, 163, 0.9)';
    landmarks.forEach((landmark, i) => {
      if ([11, 12, 13, 14, 15, 16, 23, 24, 25, 26, 27, 28].includes(i)) {
        ctx.beginPath();
        ctx.arc(landmark.x * width, landmark.y * height, 6, 0, 2 * Math.PI);
        ctx.fill();
      }
    });
  }

  // ステータス更新
  function updateStatus(icon, text) {
    elements.status.innerHTML = `<span class="icon">${icon}</span><span class="text">${text}</span>`;
  }

  // スクワット完了処理
  function onSquatComplete() {
    console.log('[THE TOLL] スクワット完了！');
    showScreen('complete-screen');
  }

  // PCへアンロック信号送信
  async function sendUnlockSignal() {
    elements.unlockBtn.disabled = true;
    elements.unlockStatus.textContent = '送信中...';
    
    if (!state.supabase) {
      // Supabase未設定時のデモモード
      elements.unlockStatus.textContent = '⚠️ Supabase未設定（デモモード）';
      setTimeout(() => {
        elements.unlockStatus.textContent = '✅ デモ完了！（実際の送信は行われていません）';
      }, 1000);
      return;
    }
    
    try {
      const { error } = await state.supabase
        .from('squat_sessions')
        .update({ unlocked: true })
        .eq('id', state.sessionId);
      
      if (error) {
        throw error;
      }
      
      elements.unlockStatus.textContent = '✅ アンロック信号を送信しました！';
      elements.unlockBtn.innerHTML = '<span>✅ 送信完了</span>';
    } catch (e) {
      console.error('[THE TOLL] アンロック信号送信エラー:', e);
      elements.unlockStatus.textContent = '❌ エラーが発生しました';
      elements.unlockBtn.disabled = false;
    }
  }

  // ============================================
  // MediaPipe Pose初期化
  // ============================================
  async function initMediaPipe() {
    updateStatus('⏳', 'AI読み込み中...');
    console.log('[THE TOLL] MediaPipe初期化開始');
    
    try {
      const pose = new Pose({
        locateFile: (file) => {
          console.log('[THE TOLL] Loading:', file);
          return `https://cdn.jsdelivr.net/npm/@mediapipe/pose/${file}`;
        }
      });
      
      pose.setOptions({
        modelComplexity: 0,  // 0=Lite, 1=Full, 2=Heavy（スマホは0推奨）
        smoothLandmarks: true,
        enableSegmentation: false,
        minDetectionConfidence: 0.5,
        minTrackingConfidence: 0.5
      });
      
      pose.onResults((results) => {
        console.log('[THE TOLL] Pose結果:', results.poseLandmarks ? '検出' : '未検出');
        onPoseResults(results);
      });
      
      updateStatus('📷', 'カメラ起動中...');
      
      // カメラ初期化（デフォルト倍率を使用）
      const camera = new Camera(elements.video, {
        onFrame: async () => {
          try {
            await pose.send({ image: elements.video });
          } catch (e) {
            console.error('[THE TOLL] Pose送信エラー:', e);
          }
        },
        facingMode: 'user'
        // width/heightを指定しないことでデフォルト解像度を使用
      });
      
      await camera.start();
      console.log('[THE TOLL] カメラ起動完了');
      
      // ビデオが準備できるまで待つ
      await new Promise((resolve) => {
        const checkVideo = () => {
          if (elements.video.videoWidth > 0) {
            resolve();
          } else {
            requestAnimationFrame(checkVideo);
          }
        };
        checkVideo();
      });
      
      // キャンバスサイズ調整
      elements.canvas.width = elements.video.videoWidth;
      elements.canvas.height = elements.video.videoHeight;
      console.log('[THE TOLL] キャンバスサイズ:', elements.canvas.width, 'x', elements.canvas.height);
      
      updateStatus('✅', '準備完了！全身を映してください');
      
    } catch (error) {
      console.error('[THE TOLL] MediaPipe初期化エラー:', error);
      updateStatus('❌', 'エラー: ' + error.message);
      throw error;
    }
  }

  // ============================================
  // セッション開始
  // ============================================
  function startSession() {
    const sessionId = elements.sessionInput.value.trim().toUpperCase();
    
    if (!sessionId || sessionId.length < 4) {
      alert('セッションIDを入力してください');
      return;
    }
    
    state.sessionId = sessionId;
    elements.currentSession.textContent = sessionId;
    
    // 画面切り替え
    showScreen('squat-screen');
    
    // MediaPipe初期化
    initMediaPipe().catch(err => {
      console.error('[THE TOLL] MediaPipe初期化エラー:', err);
      updateStatus('❌', 'カメラの起動に失敗しました');
    });
  }

  // ============================================
  // URLパラメータからセッションID取得
  // ============================================
  function checkUrlParams() {
    const params = new URLSearchParams(window.location.search);
    const session = params.get('session');
    
    if (session) {
      elements.sessionInput.value = session;
    }
  }

  // ============================================
  // イベントリスナー
  // ============================================
  function setupEventListeners() {
    // スタートボタン
    elements.startBtn.addEventListener('click', startSession);
    
    // Enterキーでスタート
    elements.sessionInput.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        startSession();
      }
    });
    
    // セッションID自動フォーマット
    elements.sessionInput.addEventListener('input', (e) => {
      let value = e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '');
      if (value.length > 4) {
        value = value.slice(0, 4) + '-' + value.slice(4, 8);
      }
      e.target.value = value;
    });
    
    // アンロックボタン
    elements.unlockBtn.addEventListener('click', sendUnlockSignal);
  }

  // ============================================
  // 初期化
  // ============================================
  function init() {
    console.log('[THE TOLL] アプリ初期化');
    
    // Supabase初期化
    initSupabase();
    
    // イベントリスナー設定
    setupEventListeners();
    
    // URLパラメータチェック
    checkUrlParams();
  }

  // DOMContentLoaded
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
