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

  // ============================================
  // オーバーレイ作成
  // ============================================
  
  function createOverlay(sessionId) {
    const overlay = document.createElement('div');
    overlay.id = 'toll-overlay';
    
    const appUrl = `${SMARTPHONE_APP_URL}?session=${sessionId}`;
    
    overlay.innerHTML = `
      <div class="toll-container">
        <div class="toll-icon">🏋️</div>
        <h1>THE TOLL</h1>
        <p class="toll-subtitle">自制心を養うシステム</p>
        
        <div class="toll-instruction">
          📱 スマホでスクワット <strong>5回</strong> してください
        </div>
        
        <div class="toll-qr-section">
          <p class="toll-qr-label">スマホでQRコードをスキャン</p>
          <div class="toll-qr-container">
            <div id="toll-qrcode"></div>
          </div>
        </div>
        
        <div class="toll-session">
          <p class="toll-session-label">セッションID</p>
          <p class="toll-session-id">${sessionId}</p>
        </div>
        
        <p class="toll-status connecting">🔄 Supabase接続中...</p>
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
    console.log('[THE TOLL] ポーリング開始:', sessionId);
    
    // まずセッションを登録
    try {
      const registerResponse = await fetch(`${SUPABASE_URL}/rest/v1/squat_sessions`, {
        method: 'POST',
        headers: {
          'apikey': SUPABASE_ANON_KEY,
          'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
          'Content-Type': 'application/json',
          'Prefer': 'resolution=merge-duplicates'
        },
        body: JSON.stringify({ id: sessionId, unlocked: false })
      });
      
      if (registerResponse.ok) {
        console.log('[THE TOLL] セッション登録完了');
        updateStatus(overlay, '✅ 接続完了 - スクワットをお待ちしています', 'connected');
      } else {
        const error = await registerResponse.text();
        console.error('[THE TOLL] セッション登録エラー:', error);
        updateStatus(overlay, '⚠️ 接続エラー（再試行中...）', 'connecting');
      }
    } catch (e) {
      console.error('[THE TOLL] セッション登録例外:', e);
      updateStatus(overlay, '⚠️ ネットワークエラー', 'connecting');
    }
    
    // ポーリングでunlockedフラグを監視
    const pollInterval = setInterval(async () => {
      try {
        const response = await fetch(
          `${SUPABASE_URL}/rest/v1/squat_sessions?id=eq.${sessionId}&select=unlocked`,
          {
            headers: {
              'apikey': SUPABASE_ANON_KEY,
              'Authorization': `Bearer ${SUPABASE_ANON_KEY}`
            }
          }
        );
        
        if (response.ok) {
          const data = await response.json();
          console.log('[THE TOLL] ポーリング結果:', data);
          
          if (data.length > 0 && data[0].unlocked === true) {
            console.log('[THE TOLL] アンロック信号検出！');
            clearInterval(pollInterval);
            updateStatus(overlay, '🎉 スクワット完了！アンロックします...', 'unlocking');
            unlockPage(overlay);
          }
        }
      } catch (e) {
        console.error('[THE TOLL] ポーリングエラー:', e);
      }
    }, 2000); // 2秒ごとにチェック
  }

  // ============================================
  // メイン処理
  // ============================================
  
  function init() {
    const sessionId = getOrCreateSessionId();
    console.log('[THE TOLL] セッションID:', sessionId);
    
    const overlay = createOverlay(sessionId);
    
    // ポーリングでSupabaseを監視
    startPolling(sessionId, overlay);
  }

  // 即座に実行
  init();
})();
