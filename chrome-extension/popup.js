document.addEventListener('DOMContentLoaded', async () => {
  const statusMsg = document.getElementById('status-msg');
  const unlockBtn = document.getElementById('unlock-settings-btn');
  const lockOverlay = document.getElementById('lock-overlay');
  const settingsContent = document.getElementById('settings-content');
  const qrSection = document.getElementById('settings-qr-section');
  
  // スマホアプリのURL
  const SMARTPHONE_APP_URL = 'https://smartphone-app-pi.vercel.app/';
  const SUPABASE_URL = 'https://qcnzleiyekbgsiyomwin.supabase.co';
  const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFjbnpsZWl5ZWtiZ3NpeW9td2luIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njg0Mjk2NzMsImV4cCI6MjA4NDAwNTY3M30.NlGUfxDPzMgtu_J0vX7FMe-ikxafboGh5GMr-tsaLfI';

  // 0. Incognito Check
  const incognitoWarning = document.getElementById('incognito-warning');
  const fixIncognitoBtn = document.getElementById('fix-incognito-btn');

  chrome.extension.isAllowedIncognitoAccess(isAllowed => {
    if (!isAllowed) {
      incognitoWarning.classList.remove('hidden');
    }
  });

  fixIncognitoBtn.addEventListener('click', () => {
    chrome.tabs.create({ url: 'chrome://extensions/?id=' + chrome.runtime.id });
  });

  // --- Initialize Settings Logic ---
  
  // 0. Adult Block Toggle
  const adultBlockToggle = document.getElementById('adult-block-toggle');
  const adultBlockData = await chrome.storage.local.get('adult_block_enabled');
  adultBlockToggle.checked = adultBlockData.adult_block_enabled || false;

  adultBlockToggle.addEventListener('change', async (e) => {
    await chrome.storage.local.set({ adult_block_enabled: e.target.checked });
    showSavedStatus();
  });
  
  // 1. Durations
  const radioButtons = document.querySelectorAll('input[name="duration"]');
  const durationData = await chrome.storage.local.get('lock_duration_min');
  const savedDuration = durationData.lock_duration_min || 20;

  radioButtons.forEach(radio => {
    if (parseInt(radio.value) === savedDuration) radio.checked = true;
    radio.addEventListener('change', async (e) => {
      await chrome.storage.local.set({ lock_duration_min: parseInt(e.target.value) });
      showSavedStatus();
    });
  });

  // 2. Schedule
  const dayChecks = document.querySelectorAll('.day-check input');
  const startTimeInput = document.getElementById('start-time');
  const endTimeInput = document.getElementById('end-time');

  const scheduleData = await chrome.storage.local.get('lock_schedule');
  const schedule = scheduleData.lock_schedule || { 
    days: [1, 2, 3, 4, 5], 
    start: "09:00", 
    end: "18:00" 
  };

  dayChecks.forEach(check => {
    check.checked = schedule.days.includes(parseInt(check.dataset.day));
    check.addEventListener('change', saveSchedule);
  });
  startTimeInput.value = schedule.start;
  endTimeInput.value = schedule.end;
  startTimeInput.addEventListener('change', saveSchedule);
  endTimeInput.addEventListener('change', saveSchedule);

  async function saveSchedule() {
    const activeDays = Array.from(dayChecks).filter(c => c.checked).map(c => parseInt(c.dataset.day));
    await chrome.storage.local.set({
      lock_schedule: { days: activeDays, start: startTimeInput.value, end: endTimeInput.value }
    });
    showSavedStatus();
  }

  function showSavedStatus() {
    statusMsg.className = 'visible';
    setTimeout(() => { statusMsg.className = ''; }, 2000);
  }

  // 3. Squat Target
  const squatInput = document.getElementById('squat-target-input');
  const squatData = await chrome.storage.local.get('target_squat_count');
  const savedSquatTarget = squatData.target_squat_count || 5;
  
  squatInput.value = savedSquatTarget;
  squatInput.addEventListener('change', async (e) => {
    let val = parseInt(e.target.value);
    if (isNaN(val) || val < 1) val = 1;
    squatInput.value = val;
    await chrome.storage.local.set({ target_squat_count: val });
    showSavedStatus();
  });

  // 4. Blocked Sites
  const siteChecks = document.querySelectorAll('input[name="blocked-site"]');
  const customInput = document.getElementById('custom-domain-input');
  const addCustomBtn = document.getElementById('add-custom-domain-btn');
  const customSitesList = document.getElementById('custom-sites-list');

  const sitesData = await chrome.storage.local.get(['blocked_sites', 'custom_blocked_sites']);
  const savedSites = sitesData.blocked_sites || ['youtube.com'];
  let customSites = sitesData.custom_blocked_sites || [];
  
  // プリセットの初期化
  siteChecks.forEach(check => {
    check.checked = savedSites.includes(check.value);
    check.addEventListener('change', saveBlockedSites);
  });

  // カスタムドメインの初期化
  function renderCustomSites() {
    customSitesList.innerHTML = '';
    customSites.forEach((domain, index) => {
      const item = document.createElement('div');
      item.className = 'site-item';
      item.innerHTML = `
        <span class="domain">${domain}</span>
        <span class="remove-btn" data-index="${index}">×</span>
      `;
      customSitesList.appendChild(item);
    });

    // 削除ボタンのイベント
    customSitesList.querySelectorAll('.remove-btn').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        const idx = parseInt(e.target.dataset.index);
        customSites.splice(idx, 1);
        await chrome.storage.local.set({ custom_blocked_sites: customSites });
        renderCustomSites();
        showSavedStatus();
      });
    });
  }

  addCustomBtn.addEventListener('click', async () => {
    const domain = customInput.value.trim().toLowerCase();
    if (domain && !customSites.includes(domain)) {
      customSites.push(domain);
      await chrome.storage.local.set({ custom_blocked_sites: customSites });
      customInput.value = '';
      renderCustomSites();
      showSavedStatus();
    }
  });

  renderCustomSites();

  async function saveBlockedSites() {
    const activeSites = Array.from(siteChecks).filter(c => c.checked).map(c => c.value);
    await chrome.storage.local.set({ blocked_sites: activeSites });
    showSavedStatus();
  }

  // --- Settings Guard Logic ---

  unlockBtn.addEventListener('click', async () => {
    unlockBtn.classList.add('hidden');
    qrSection.classList.remove('hidden');
    
    // 1. セッションID生成 (SET-で始まる特別ID)
    const sessionId = 'SET-' + Math.random().toString(36).substr(2, 6).toUpperCase();
    
    // 2. QRコード表示 (qrcode.min.jsがmanifestにJSとして含まれている前提)
    const qrEl = document.getElementById('settings-qrcode');
    qrEl.innerHTML = '';
    if (typeof QRCode !== 'undefined') {
      new QRCode(qrEl, {
        text: `${SMARTPHONE_APP_URL}?session=${sessionId}`,
        width: 120,
        height: 120,
        colorDark: '#000000',
        colorLight: '#ffffff'
      });
    }

    // 3. セッション登録 (30回スクワットを要求)
    // 注意: スマホ側でスクワット回数を固定にするための目印としてIDを使用
    await fetch(`${SUPABASE_URL}/rest/v1/squat_sessions`, {
      method: 'POST',
      headers: {
        'apikey': SUPABASE_ANON_KEY,
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
        'Content-Type': 'application/json',
        'Prefer': 'resolution=merge-duplicates'
      },
      body: JSON.stringify({ id: sessionId, unlocked: false })
    });

    // 4. ポーリング
    const poll = setInterval(async () => {
      try {
        const res = await fetch(`${SUPABASE_URL}/rest/v1/squat_sessions?id=eq.${sessionId}&select=unlocked`, {
          headers: { 'apikey': SUPABASE_ANON_KEY, 'Authorization': `Bearer ${SUPABASE_ANON_KEY}` },
          cache: 'no-store'
        });
        const data = await res.json();
        if (data && data[0]?.unlocked) {
          clearInterval(poll);
          unlockSettings();
        }
      } catch (e) {
        console.error('Polling error:', e);
      }
    }, 2000);
  });

  function unlockSettings() {
    lockOverlay.classList.add('hidden');
    settingsContent.classList.remove('locked');
  }

  // FORCE RELOCK (FOR TESTING)
  const relockBtn = document.getElementById('force-relock-btn');
  if (relockBtn) {
    relockBtn.addEventListener('click', async () => {
      await chrome.storage.local.remove('last_unlock_time');
      statusMsg.textContent = 'LOCK RESET - RELOAD TAB TO TEST';
      showSavedStatus();
      setTimeout(() => { statusMsg.textContent = 'SETTINGS SAVED'; }, 2100);
    });
  }
});
