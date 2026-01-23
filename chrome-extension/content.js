// THE TOLL - コンテンツスクリプト
// YouTubeをブロックし、スクワット完了でアンロック

(function() {
  'use strict';

  // ============================================
  // 設定 - Supabaseの情報を入力してください
  // ============================================
  const SUPABASE_URL = 'https://qcnzleiyekbgsiyomwin.supabase.co';
  const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFjbnpsZWl5ZWtiZ3NpeW9td2luIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njg0Mjk2NzMsImV4cCI6MjA4NDAwNTY3M30.NlGUfxDPzMgtu_J0vX7FMe-ikxafboGh5GMr-tsaLfI';
  
  // スマホアプリのURL（HTTPSが必要！ngrokを使用推奨）
  const SMARTPHONE_APP_URL = 'https://nikita-unmajestic-reciprocatively.ngrok-free.dev';

  let isLocked = true;
  let observer = null;

  // ============================================
  // ユーティリティ関数
  // ============================================
  
  // UUID生成
  function generateSessionId() {
    return 'xxxx-xxxx'.replace(/x/g, () => {
      return Math.floor(Math.random() * 16).toString(16);
    }).toUpperCase();
  }

  // セッションIDの取得または生成
  function getOrCreateSessionId() {
    let sessionId = sessionStorage.getItem('toll_session_id');
    if (!sessionId) {
      sessionId = generateSessionId();
      sessionStorage.setItem('toll_session_id', sessionId);
    }
    return sessionId;
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

  function playTone(frequency, duration, type = 'sine', volume = 0.3) {
    if (!audioContext) return;
    
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
  // オーバーレイ作成
  // ============================================
  
  function createOverlay(sessionId) {
    const overlay = document.createElement('div');
    overlay.id = 'toll-overlay';
    
    const appUrl = `${SMARTPHONE_APP_URL}?session=${sessionId}`;
    
    overlay.innerHTML = `
      <div class="toll-container">
        <h1>THE TOLL</h1>
        <p class="toll-subtitle">SELF-DISCIPLINE SYSTEM</p>
        
        <div class="toll-instruction">
          <p class="toll-instruction-text">Complete <strong>5</strong> squats on your phone to unlock</p>
        </div>
        
        <div class="toll-qr-section">
          <p class="toll-qr-label">SCAN WITH YOUR PHONE</p>
          <div class="toll-qr-container">
            <div id="toll-qrcode"></div>
          </div>
        </div>
        
        <div class="toll-session">
          <p class="toll-session-label">SESSION ID</p>
          <p class="toll-session-id">${sessionId}</p>
        </div>
        
        <p class="toll-status connecting">Connecting...</p>
      </div>
    `;
    
    // ページ読み込み前に挿入
    if (document.body) {
      document.body.appendChild(overlay);
    } else {
      document.addEventListener('DOMContentLoaded', () => {
        document.body.appendChild(overlay);
      });
    }
    
    // 背景画像を設定（chrome.runtime.getURLを使用）
    try {
      const bgImageUrl = chrome.runtime.getURL('images/bg-gym.png');
      overlay.style.setProperty('--toll-bg-image', `url("${bgImageUrl}")`);
    } catch (e) {
      console.log('[THE TOLL] 背景画像の読み込みをスキップ');
    }
    
    // QRコード生成
    setTimeout(() => {
      const qrcodeElement = document.getElementById('toll-qrcode');
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
      
      // ブロック時の警告音を再生
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
  function unlockPage(overlay) {
    console.log('[THE TOLL] アンロック実行！');
    overlay.classList.add('unlocking');
    isLocked = false;
    stopVideoMonitor();
    setTimeout(() => {
      overlay.remove();
      sessionStorage.removeItem('toll_session_id');
    }, 500);
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

  function debugLog(msg) {
    console.log('[THE TOLL] ' + msg);
  }

  // ============================================
  // メイン処理
  // ============================================
  
  function init() {
    const sessionId = getOrCreateSessionId();
    console.log('[THE TOLL] セッションID:', sessionId);
    
    
    const overlay = createOverlay(sessionId);
    
    // ビデオ停止と監視開始
    forcePause();
    startVideoMonitor();
    
    // ポーリングでSupabaseを監視
    startPolling(sessionId, overlay);
  }

  // 即座に実行
  init();
})();
