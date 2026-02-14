document.addEventListener('DOMContentLoaded', async () => {
  const statusMsg = document.getElementById('status-msg');
  const unlockBtn = document.getElementById('unlock-settings-btn');
  const upgradeBtn = document.getElementById('upgrade-btn');
  const manageSubscriptionBtn = document.getElementById('manage-subscription-btn');
  const authLoginBtn = document.getElementById('auth-login-btn');
  const authLogoutBtn = document.getElementById('auth-logout-btn');
  const authUserLabel = document.getElementById('auth-user-label');
  const planLabel = document.getElementById('plan-label');
  const planDetailLabel = document.getElementById('plan-detail-label');
  const lockOverlay = document.getElementById('lock-overlay');
  const settingsContent = document.getElementById('settings-content');
  const qrSection = document.getElementById('settings-qr-section');
  
  // スマホアプリのURL
  const SMARTPHONE_APP_URL = 'https://smartphone-app-pi.vercel.app/';
  const SUPABASE_URL = 'https://qcnzleiyekbgsiyomwin.supabase.co';
  const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFjbnpsZWl5ZWtiZ3NpeW9td2luIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njg0Mjk2NzMsImV4cCI6MjA4NDAwNTY3M30.NlGUfxDPzMgtu_J0vX7FMe-ikxafboGh5GMr-tsaLfI';
  const FREE_MAX_SITES = 3;
  const supabase = window.supabase?.createClient
    ? window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
    : null;
  let authAccessToken = null;
  let authUserEmail = null;
  let deviceId = null;
  let entitlement = {
    isPro: false,
    reason: 'init_default',
    planState: 'unknown',
    trialDaysLeft: 0,
    cancelAtPeriodEnd: false,
    currentPeriodEnd: null,
  };
  let isProUser = false;
  let loginInFlight = false;
  let upgradeInFlight = false;
  let manageInFlight = false;

  function setTopStatus(text) {
    if (authUserLabel) authUserLabel.textContent = text;
  }

  function generateDeviceId() {
    return 'dev-' + Math.random().toString(36).slice(2, 12);
  }

  async function getOrCreateDeviceId() {
    const data = await chrome.storage.local.get('toll_device_id');
    let deviceId = data.toll_device_id;
    if (!deviceId) {
      deviceId = generateDeviceId();
      await chrome.storage.local.set({ toll_device_id: deviceId });
    }
    return deviceId;
  }

  function isTrialActive(trialEndsAt) {
    if (!trialEndsAt) return false;
    const t = new Date(trialEndsAt).getTime();
    return Number.isFinite(t) && t > Date.now();
  }

  function getTrialDaysLeft(trialEndsAt) {
    if (!trialEndsAt) return 0;
    const ms = new Date(trialEndsAt).getTime() - Date.now();
    if (!Number.isFinite(ms) || ms <= 0) return 0;
    return Math.max(1, Math.ceil(ms / (24 * 60 * 60 * 1000)));
  }

  function formatYmd(dateLike) {
    if (!dateLike) return null;
    const dt = new Date(dateLike);
    if (!Number.isFinite(dt.getTime())) return null;
    const y = dt.getFullYear();
    const m = String(dt.getMonth() + 1).padStart(2, '0');
    const d = String(dt.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }

  function updatePlanUi() {
    if (upgradeBtn) {
      upgradeBtn.classList.toggle('hidden', !!entitlement?.isPro);
    }
    if (manageSubscriptionBtn) {
      const canManage = !!authAccessToken && String(entitlement?.planState || '').toLowerCase() === 'pro';
      manageSubscriptionBtn.classList.toggle('hidden', !canManage);
    }
    if (planDetailLabel) {
      planDetailLabel.textContent = '';
      planDetailLabel.classList.add('hidden');
    }
    if (!planLabel) return;
    planLabel.classList.remove('plan-free', 'plan-trial', 'plan-pro');

    const state = (entitlement?.planState || 'unknown').toLowerCase();
    const days = entitlement?.trialDaysLeft || 0;

    if (state === 'pro') {
      planLabel.textContent = 'PLAN: PRO';
      planLabel.classList.add('plan-pro');
      if (planDetailLabel && entitlement?.cancelAtPeriodEnd) {
        const ymd = formatYmd(entitlement?.currentPeriodEnd);
        planDetailLabel.textContent = ymd
          ? `CANCEL SCHEDULED: PRO UNTIL ${ymd}`
          : 'CANCEL SCHEDULED: PRO UNTIL PERIOD END';
        planDetailLabel.classList.remove('hidden');
      }
      return;
    }
    if (state === 'trial') {
      planLabel.textContent = days > 0 ? `PLAN: TRIAL (${days}D LEFT)` : 'PLAN: TRIAL';
      planLabel.classList.add('plan-trial');
      return;
    }

    if (state === 'free') {
      planLabel.textContent = 'PLAN: FREE';
      planLabel.classList.add('plan-free');
      return;
    }

    planLabel.textContent = 'PLAN: CHECKING...';
  }

  async function fetchEntitlement(deviceId) {
    const url = `${SUPABASE_URL}/rest/v1/device_links?device_id=eq.${encodeURIComponent(deviceId)}&select=plan_tier,subscription_status,trial_ends_at,cancel_at_period_end,current_period_end`;
    try {
      const res = await fetch(url, {
        headers: {
          apikey: SUPABASE_ANON_KEY,
          Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
        },
        cache: 'no-store',
      });
      if (!res.ok) {
        return {
          isPro: false,
          reason: `HTTP ${res.status}`,
          planState: 'unknown',
          trialDaysLeft: 0,
          cancelAtPeriodEnd: false,
          currentPeriodEnd: null,
        };
      }
      const rows = await res.json();
      const row = rows && rows[0];
      if (!row) {
        return {
          isPro: false,
          reason: 'not_linked',
          planState: 'free',
          trialDaysLeft: 0,
          cancelAtPeriodEnd: false,
          currentPeriodEnd: null,
        };
      }
      const sub = String(row.subscription_status || '').toLowerCase();
      const trialActive = isTrialActive(row.trial_ends_at);
      const isPro = sub === 'active' || trialActive;
      const planState = sub === 'active' ? 'pro' : (trialActive ? 'trial' : 'free');
      return {
        isPro,
        reason: isPro ? 'pro_or_trial' : 'free',
        planState,
        trialDaysLeft: getTrialDaysLeft(row.trial_ends_at),
        cancelAtPeriodEnd: !!row.cancel_at_period_end,
        currentPeriodEnd: row.current_period_end || null,
      };
    } catch (e) {
      return {
        isPro: false,
        reason: 'fetch_error',
        planState: 'unknown',
        trialDaysLeft: 0,
        cancelAtPeriodEnd: false,
        currentPeriodEnd: null,
      };
    }
  }

  function openAppLink(deviceId) {
    chrome.tabs.create({ url: `${SMARTPHONE_APP_URL}?device=${encodeURIComponent(deviceId)}` });
  }

  function getPricingLink(deviceId) {
    const lang = (navigator.language || 'en').toLowerCase().startsWith('ja') ? 'ja' : 'en';
    const qs = new URLSearchParams();
    if (deviceId) qs.set('device', deviceId);
    qs.set('lang', lang);
    qs.set('source', 'extension');
    return `${SMARTPHONE_APP_URL}pricing.html?${qs.toString()}`;
  }

  async function openCheckout(deviceId) {
    chrome.tabs.create({ url: getPricingLink(deviceId) });
  }

  async function openCustomerPortal() {
    if (!authAccessToken) {
      statusMsg.textContent = 'LOGIN REQUIRED';
      showSavedStatus();
      return;
    }

    try {
      const appReturnUrl = `${SMARTPHONE_APP_URL}?portal=return${deviceId ? `&device=${encodeURIComponent(deviceId)}` : ''}`;
      const res = await fetch(`${SUPABASE_URL}/functions/v1/create-customer-portal`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          apikey: SUPABASE_ANON_KEY,
          Authorization: `Bearer ${authAccessToken}`,
        },
        body: JSON.stringify({ return_url: appReturnUrl }),
      });

      const payload = await res.json().catch(() => ({}));
      if (!res.ok || !payload?.url) {
        const detail = payload?.error || `HTTP ${res.status}`;
        statusMsg.textContent = `PORTAL ERROR: ${detail}`;
        showSavedStatus();
        return;
      }

      chrome.tabs.create({ url: payload.url });
      statusMsg.textContent = 'PORTAL OPENED';
      showSavedStatus();
    } catch (e) {
      statusMsg.textContent = 'PORTAL FAILED';
      showSavedStatus();
    }
  }

  async function handleLoginClick() {
    setTopStatus('LOGIN CLICKED...');
    try {
      if (!supabase) {
        statusMsg.textContent = 'EXT LOGIN UNAVAILABLE. OPENING PHONE LOGIN...';
        showSavedStatus();
        if (!deviceId) deviceId = await getOrCreateDeviceId();
        openAppLink(deviceId);
        return;
      }
      statusMsg.textContent = 'LOGIN: PREPARING OAUTH URL...';
      showSavedStatus();
      await loginWithGoogleInExtension();
      const fresh = await fetchEntitlementByAuth();
      if (fresh) {
        entitlement = fresh;
        isProUser = fresh.isPro;
      }
      updateAuthUi();
      updatePlanUi();
      statusMsg.textContent = 'LOGIN SUCCESS. REOPEN POPUP TO REFRESH CONTROLS.';
      showSavedStatus();
    } catch (e) {
      setTopStatus(`LOGIN FAILED: ${e?.message || e}`);
      statusMsg.textContent = `LOGIN FAILED: ${e?.message || e}`;
      showSavedStatus();
    }
  }

  async function handleUpgradeClick() {
    if (authUserLabel) authUserLabel.textContent = 'UPGRADE CLICKED...';
    try {
      if (!deviceId) {
        deviceId = await getOrCreateDeviceId();
      }
      if (!authAccessToken && entitlement.reason === 'not_linked') {
        statusMsg.textContent = 'LINK ACCOUNT ON PHONE FIRST';
        showSavedStatus();
        openAppLink(deviceId);
        return;
      }
      await openCheckout(deviceId);
    } catch (e) {
      statusMsg.textContent = `UPGRADE FAILED: ${e?.message || e}`;
      showSavedStatus();
    }
  }

  async function triggerLogin() {
    if (loginInFlight) return;
    loginInFlight = true;
    try {
      await handleLoginClick();
    } finally {
      loginInFlight = false;
    }
  }

  async function triggerUpgrade() {
    if (upgradeInFlight) return;
    upgradeInFlight = true;
    try {
      await handleUpgradeClick();
    } finally {
      upgradeInFlight = false;
    }
  }

  async function triggerManageSubscription() {
    if (manageInFlight) return;
    manageInFlight = true;
    try {
      await openCustomerPortal();
      const fresh = await fetchEntitlementByAuth();
      if (fresh) {
        entitlement = fresh;
        isProUser = fresh.isPro;
        updatePlanUi();
      }
    } finally {
      manageInFlight = false;
    }
  }

  if (authLoginBtn) {
    authLoginBtn.onclick = (e) => {
      e.preventDefault();
      triggerLogin();
    };
    authLoginBtn.addEventListener('pointerup', (e) => {
      e.preventDefault();
      triggerLogin();
    });
  }
  if (upgradeBtn) {
    upgradeBtn.onclick = (e) => {
      e.preventDefault();
      triggerUpgrade();
    };
    upgradeBtn.addEventListener('pointerup', (e) => {
      e.preventDefault();
      triggerUpgrade();
    });
  }
  if (manageSubscriptionBtn) {
    manageSubscriptionBtn.onclick = (e) => {
      e.preventDefault();
      triggerManageSubscription();
    };
    manageSubscriptionBtn.addEventListener('pointerup', (e) => {
      e.preventDefault();
      triggerManageSubscription();
    });
  }
  deviceId = await getOrCreateDeviceId();
  try {
    const authEntitlement = await fetchEntitlementByAuth();
    if (authEntitlement) {
      entitlement = authEntitlement;
    } else {
      entitlement = await fetchEntitlement(deviceId);
    }
    isProUser = !!entitlement.isPro;
  } catch (e) {
    entitlement = {
      isPro: false,
      reason: 'init_error',
      planState: 'unknown',
      trialDaysLeft: 0,
      cancelAtPeriodEnd: false,
      currentPeriodEnd: null,
    };
    isProUser = false;
    statusMsg.textContent = 'INIT WARNING: CONTINUING IN FREE MODE';
    showSavedStatus();
  }
  updateAuthUi();
  updatePlanUi();

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

  if (authLogoutBtn) {
    authLogoutBtn.addEventListener('click', async () => {
      if (supabase) {
        await supabase.auth.signOut();
      }
      authAccessToken = null;
      authUserEmail = null;
      entitlement = await fetchEntitlement(deviceId);
      isProUser = !!entitlement.isPro;
      updateAuthUi();
      updatePlanUi();
      statusMsg.textContent = 'LOGGED OUT.';
      showSavedStatus();
    });
  }

  if (!supabase) {
    statusMsg.textContent = 'EXT LOGIN OFF. USE PHONE LOGIN LINK.';
  } else {
    statusMsg.textContent = 'READY';
  }

  function updateAuthUi() {
    const loggedIn = !!authAccessToken;
    if (authLoginBtn) authLoginBtn.classList.toggle('hidden', loggedIn);
    if (authLogoutBtn) authLogoutBtn.classList.toggle('hidden', !loggedIn);
    if (authUserLabel) authUserLabel.textContent = loggedIn ? `LOGGED IN: ${authUserEmail || 'ACCOUNT'}` : 'NOT LOGGED IN';
  }

  async function fetchEntitlementByAuth() {
    if (!supabase) return null;
    const { data } = await supabase.auth.getSession();
    const session = data?.session || null;
    if (!session) return null;

    authAccessToken = session.access_token;
    authUserEmail = session.user?.email || '';

    let profile = null;
    let lastError = null;
    for (let i = 0; i < 8; i++) {
      const { data: row, error } = await supabase
        .from('profiles')
        .select('subscription_status, plan_tier, trial_ends_at, trial_used, cancel_at_period_end, current_period_end')
        .eq('id', session.user.id)
        .single();
      profile = row || null;
      lastError = error || null;
      if (profile) break;
      await new Promise((r) => setTimeout(r, 400));
    }

    if (!profile) {
      statusMsg.textContent = `PROFILE ERROR: ${lastError?.message || 'no row'}`;
      showSavedStatus();
      return {
        isPro: false,
        reason: 'profile_error',
        planState: 'unknown',
        trialDaysLeft: 0,
        cancelAtPeriodEnd: false,
        currentPeriodEnd: null,
      };
    }

    // Start one-time 7-day trial for newly created free accounts.
    if (!profile.trial_ends_at && !profile.trial_used && String(profile.subscription_status || '').toLowerCase() !== 'active') {
      const trialEnds = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
      const { error: trialInitError } = await supabase
        .from('profiles')
        .update({ trial_ends_at: trialEnds, trial_used: true, plan_tier: 'free' })
        .eq('id', session.user.id);
      if (!trialInitError) {
        profile.trial_ends_at = trialEnds;
        profile.trial_used = true;
        if (!profile.plan_tier) profile.plan_tier = 'free';
      } else {
        statusMsg.textContent = `TRIAL INIT ERROR: ${trialInitError.message}`;
        showSavedStatus();
      }
    }

    const sub = String(profile.subscription_status || '').toLowerCase();
    const trialActive = isTrialActive(profile.trial_ends_at);
    const isPro = sub === 'active' || trialActive;
    const planState = sub === 'active' ? 'pro' : (trialActive ? 'trial' : 'free');
    return {
      isPro,
      reason: isPro ? 'pro_or_trial' : 'free_auth',
      planState,
      trialDaysLeft: getTrialDaysLeft(profile.trial_ends_at),
      cancelAtPeriodEnd: !!profile.cancel_at_period_end,
      currentPeriodEnd: profile.current_period_end || null,
    };
  }

  async function loginWithGoogleInExtension() {
    if (!supabase) throw new Error('Supabase library not available in popup');
    setTopStatus('LOGIN: GET REDIRECT URL');
    const redirectTo = chrome.identity.getRedirectURL('supabase-auth');
    statusMsg.textContent = 'LOGIN: REQUESTING PROVIDER URL...';
    showSavedStatus();
    setTopStatus('LOGIN: REQUEST PROVIDER URL');
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo,
        skipBrowserRedirect: true,
        queryParams: { prompt: 'select_account' },
      },
    });
    if (error) throw error;
    if (!data?.url) throw new Error('OAuth URL missing');
    statusMsg.textContent = 'LOGIN: OPENING GOOGLE AUTH...';
    showSavedStatus();
    setTopStatus('LOGIN: OPEN GOOGLE AUTH');

    const callbackUrl = await Promise.race([
      chrome.identity.launchWebAuthFlow({
        url: data.url,
        interactive: true,
      }),
      new Promise((_, reject) => setTimeout(() => reject(new Error('OAuth timeout: check redirect URL settings')), 45000)),
    ]);
    if (!callbackUrl) throw new Error('Auth canceled');
    setTopStatus('LOGIN: CALLBACK RECEIVED');

    const parsed = new URL(callbackUrl);
    const hash = new URLSearchParams(parsed.hash.replace(/^#/, ''));
    const access_token = hash.get('access_token');
    const refresh_token = hash.get('refresh_token');
    if (access_token && refresh_token) {
      const { error: setErr } = await supabase.auth.setSession({ access_token, refresh_token });
      if (setErr) throw setErr;
      return;
    }

    const code = parsed.searchParams.get('code') || hash.get('code');
    if (code) {
      const { error: exErr } = await supabase.auth.exchangeCodeForSession(code);
      if (exErr) throw exErr;
      return;
    }

    throw new Error('No auth code/token returned');
  }
  if (!isProUser && unlockBtn) {
    unlockBtn.disabled = true;
    unlockBtn.textContent = 'PRO ONLY';
  }

  // --- Initialize Settings Logic ---
  
  // 0. Adult Block Toggle
  const adultBlockToggle = document.getElementById('adult-block-toggle');
  const adultBlockData = await chrome.storage.local.get('adult_block_enabled');
  adultBlockToggle.checked = isProUser ? (adultBlockData.adult_block_enabled || false) : false;
  if (!isProUser) {
    await chrome.storage.local.set({ adult_block_enabled: false });
    adultBlockToggle.disabled = true;
  }

  adultBlockToggle.addEventListener('change', async (e) => {
    if (!isProUser) {
      e.target.checked = false;
      await chrome.storage.local.set({ adult_block_enabled: false });
      statusMsg.textContent = 'PRO FEATURE: ADULT BLOCK';
      showSavedStatus();
      openCheckout(deviceId);
      return;
    }
    await chrome.storage.local.set({ adult_block_enabled: e.target.checked });
    showSavedStatus();
  });
  
  // 1. Durations
  const radioButtons = document.querySelectorAll('input[name="duration"]');
  const durationData = await chrome.storage.local.get('lock_duration_min');
  let savedDuration = durationData.lock_duration_min || 20;
  if (!isProUser) {
    savedDuration = 5;
    await chrome.storage.local.set({ lock_duration_min: 5 });
  }

  radioButtons.forEach(radio => {
    if (parseInt(radio.value) === savedDuration) radio.checked = true;
    radio.addEventListener('change', async (e) => {
      if (!isProUser) {
        await chrome.storage.local.set({ lock_duration_min: 5 });
        radioButtons.forEach(r => { r.checked = parseInt(r.value) === 5; });
        statusMsg.textContent = 'PRO FEATURE: CUSTOM GRACE PERIOD';
        showSavedStatus();
        openCheckout(deviceId);
        return;
      }
      await chrome.storage.local.set({ lock_duration_min: parseInt(e.target.value) });
      showSavedStatus();
    });
    if (!isProUser) {
      radio.disabled = parseInt(radio.value) !== 5;
    }
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
  if (!isProUser) {
    schedule.days = [0, 1, 2, 3, 4, 5, 6];
    schedule.start = '00:00';
    schedule.end = '23:59';
    await chrome.storage.local.set({ lock_schedule: schedule });
  }

  dayChecks.forEach(check => {
    check.checked = schedule.days.includes(parseInt(check.dataset.day));
    check.addEventListener('change', saveSchedule);
  });
  startTimeInput.value = schedule.start;
  endTimeInput.value = schedule.end;
  startTimeInput.addEventListener('change', saveSchedule);
  endTimeInput.addEventListener('change', saveSchedule);
  if (!isProUser) {
    dayChecks.forEach(c => c.disabled = true);
    startTimeInput.disabled = true;
    endTimeInput.disabled = true;
  }

  async function saveSchedule() {
    if (!isProUser) {
      await chrome.storage.local.set({
        lock_schedule: { days: [0, 1, 2, 3, 4, 5, 6], start: '00:00', end: '23:59' }
      });
      statusMsg.textContent = 'PRO FEATURE: LOCK SCHEDULE';
      showSavedStatus();
      openCheckout(deviceId);
      return;
    }
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
  const savedSquatTarget = isProUser ? (squatData.target_squat_count || 5) : 10;
  
  squatInput.value = savedSquatTarget;
  if (!isProUser) {
    await chrome.storage.local.set({ target_squat_count: 10 });
    squatInput.disabled = true;
  }
  squatInput.addEventListener('change', async (e) => {
    if (!isProUser) {
      squatInput.value = 10;
      await chrome.storage.local.set({ target_squat_count: 10 });
      statusMsg.textContent = 'PRO FEATURE: CUSTOM REP COUNT';
      showSavedStatus();
      openCheckout(deviceId);
      return;
    }
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
  let savedSites = sitesData.blocked_sites || ['youtube.com'];
  if (!isProUser) {
    savedSites = savedSites.slice(0, FREE_MAX_SITES);
    await chrome.storage.local.set({ blocked_sites: savedSites });
  }
  let customSites = sitesData.custom_blocked_sites || [];
  if (!isProUser && customSites.length > 0) {
    customSites = [];
    await chrome.storage.local.set({ custom_blocked_sites: [] });
  }
  
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
        if (!isProUser) {
          statusMsg.textContent = 'PRO FEATURE: CUSTOM DOMAINS';
          showSavedStatus();
          openCheckout(deviceId);
          return;
        }
        const idx = parseInt(e.target.dataset.index);
        customSites.splice(idx, 1);
        await chrome.storage.local.set({ custom_blocked_sites: customSites });
        renderCustomSites();
        showSavedStatus();
      });
    });
  }

  addCustomBtn.addEventListener('click', async () => {
    if (!isProUser) {
      statusMsg.textContent = 'PRO FEATURE: CUSTOM DOMAINS';
      showSavedStatus();
      openCheckout(deviceId);
      return;
    }
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
  if (!isProUser) {
    customInput.disabled = true;
    addCustomBtn.disabled = true;
  }

  async function saveBlockedSites(e) {
    const activeSites = Array.from(siteChecks).filter(c => c.checked).map(c => c.value);
    if (!isProUser && activeSites.length > FREE_MAX_SITES) {
      if (e?.target) e.target.checked = false;
      statusMsg.textContent = 'FREE LIMIT: UP TO 3 SITES';
      showSavedStatus();
      openCheckout(deviceId);
      return;
    }
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
        text: `${SMARTPHONE_APP_URL}?session=${sessionId}&device=${encodeURIComponent(deviceId)}`,
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
