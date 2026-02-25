document.addEventListener('DOMContentLoaded', async () => {
  const SETTINGS_WINDOW_ID_KEY = 'toll_settings_window_id';
  const statusMsg = document.getElementById('status-msg');
  const settingsUnlockRemaining = document.getElementById('settings-unlock-remaining');
  const toastMsg = document.getElementById('toast-msg');
  const unlockBtn = document.getElementById('unlock-settings-btn');
  const upgradeBtn = document.getElementById('upgrade-btn');
  const applyCurrentLockBtn = document.getElementById('apply-current-lock-btn');
  const manageSubscriptionBtn = document.getElementById('manage-subscription-btn');
  const authLoginBtn = document.getElementById('auth-login-btn');
  const authLogoutBtn = document.getElementById('auth-logout-btn');
  const langEnBtn = document.getElementById('lang-en-btn');
  const langJaBtn = document.getElementById('lang-ja-btn');
  const authUserLabel = document.getElementById('auth-user-label');
  const planLabel = document.getElementById('plan-label');
  const planDetailLabel = document.getElementById('plan-detail-label');
  const trialNote = document.getElementById('trial-note');
  const upgradeLoginNote = document.getElementById('upgrade-login-note');
  const billingChangeNote = document.getElementById('billing-change-note');
  const lockOverlay = document.getElementById('lock-overlay');
  const settingsContent = document.getElementById('settings-content');
  const qrSection = document.getElementById('settings-qr-section');
  const viewOnlyBtn = document.getElementById('view-only-btn');
  const viewOnlyBar = document.getElementById('view-only-bar');
  const returnToMissionBtn = document.getElementById('return-to-mission-btn');
  const unlockPresetOptions = document.getElementById('unlock-preset-options');
  const unlockActivePolicyEl = document.getElementById('unlock-active-policy');
  
  // スマホアプリのURL
  const SMARTPHONE_APP_URL = 'https://smartphone-app-pi.vercel.app/';
  const SUPABASE_URL = 'https://qcnzleiyekbgsiyomwin.supabase.co';
  const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFjbnpsZWl5ZWtiZ3NpeW9td2luIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njg0Mjk2NzMsImV4cCI6MjA4NDAwNTY3M30.NlGUfxDPzMgtu_J0vX7FMe-ikxafboGh5GMr-tsaLfI';
  const FREE_MAX_SITES = 5;
  const DEFAULT_BLOCKED_SITES_BY_LANG = {
    en: ['youtube.com', 'twitter.com,x.com', 'instagram.com', 'tiktok.com', 'reddit.com'],
    ja: ['youtube.com', 'twitter.com,x.com', 'instagram.com', 'tiktok.com', 'netflix.com'],
  };
  const UNLOCK_PRESETS = {
    light: { id: 'light', label: 'LIGHT', reps: 10, graceMin: 10 },
    standard: { id: 'standard', label: 'STANDARD', reps: 20, graceMin: 20 },
    hard: { id: 'hard', label: 'HARD', reps: 40, graceMin: 40 },
    extreme: { id: 'extreme', label: 'EXTREME', reps: 60, graceMin: 60 },
  };
  const FREE_UNLOCK_PRESET_IDS = ['light', 'standard'];
  const PRO_UNLOCK_PRESET_IDS = ['light', 'standard', 'hard', 'extreme'];
  const DEFAULT_FREE_UNLOCK_PRESET_ID = 'standard';
  const DEFAULT_PRO_UNLOCK_PRESET_ID = 'hard';
  const UNLOCK_PRESET_ACTIVE_KEY = 'toll_unlock_preset_active';
  const SETTINGS_UNLOCK_REPS = 15;
  const SETTINGS_UNLOCK_WINDOW_MIN = 15;
  const SETTINGS_UNLOCK_WINDOW_MS = SETTINGS_UNLOCK_WINDOW_MIN * 60 * 1000;
  const SETTINGS_UNLOCK_EXPIRES_AT_KEY = 'toll_settings_unlock_expires_at';
  // Temporary switch for QA: false = settings mission OFF, true = ON
  const SETTINGS_GUARD_ENABLED = false;
  let uiLang = 'en';
  const UI_TEXT = {
    en: {
      upgradeLoginNote: 'Sign in to start a free trial (no card required). Upgrade anytime.',
      billingChangeNote: 'Plan changes take effect at the next billing cycle.',
      viewOnlyMode: 'VIEW ONLY MODE',
      settingsLocked: 'SETTINGS LOCKED',
      planPro: 'PLAN: PRO',
      planTrial: 'PLAN: TRIAL',
      planTrialDays: 'PLAN: TRIAL ({days}D LEFT)',
      planFree: 'PLAN: FREE',
      planChecking: 'PLAN: CHECKING...',
      cancelScheduledUntilDate: 'CANCEL SCHEDULED: PRO UNTIL {date}',
      cancelScheduledUntilPeriodEnd: 'CANCEL SCHEDULED: PRO UNTIL PERIOD END',
      loginRequired: 'LOGIN REQUIRED',
      portalError: 'PORTAL ERROR: {detail}',
      portalOpened: 'PORTAL OPENED',
      portalFailed: 'PORTAL FAILED',
      extLoginUnavailable: 'EXT LOGIN UNAVAILABLE. OPENING PHONE LOGIN...',
      loginPreparingOauth: 'LOGIN: PREPARING OAUTH URL...',
      loginSuccess: 'LOGIN SUCCESS',
      loginFailed: 'LOGIN FAILED: {detail}',
      upgradeClicked: 'UPGRADE CLICKED...',
      loginRequiredOpeningGoogle: 'LOGIN REQUIRED. OPENING GOOGLE LOGIN...',
      upgradeFailed: 'UPGRADE FAILED: {detail}',
      noActiveTab: 'NO ACTIVE TAB',
      noActiveLockSession: 'NO ACTIVE LOCK SESSION',
      applyFailed: 'APPLY FAILED',
      appliedSummary: 'APPLIED: {sid} / {reps} REPS / {grace} MIN',
      scheduleAppliedLockedNow: 'SCHEDULE APPLIED: LOCKED NOW',
      scheduleApplied: 'SCHEDULE APPLIED',
      openPopupOnLockedTab: 'OPEN POPUP ON LOCKED TAB',
      initWarningFreeMode: 'INIT WARNING: CONTINUING IN FREE MODE',
      loggedOut: 'LOGGED OUT.',
      extLoginOff: 'EXT LOGIN OFF. USE PHONE LOGIN LINK.',
      ready: 'READY',
      loggedInFmt: 'LOGGED IN: {email}',
      loggedInAccount: 'ACCOUNT',
      notLoggedIn: 'NOT LOGGED IN',
      profileError: 'PROFILE ERROR: {detail}',
      trialInitError: 'TRIAL INIT ERROR: {detail}',
      deviceLinkSyncError: 'DEVICE LINK SYNC ERROR: {detail}',
      loginRequestingProviderUrl: 'LOGIN: REQUESTING PROVIDER URL...',
      loginOpeningGoogleAuth: 'LOGIN: OPENING GOOGLE AUTH...',
      loginClicked: 'LOGIN CLICKED...',
      loginGetRedirectUrl: 'LOGIN: GET REDIRECT URL',
      loginRequestProviderUrl: 'LOGIN: REQUEST PROVIDER URL',
      loginOpenGoogleAuth: 'LOGIN: OPEN GOOGLE AUTH',
      loginCallbackReceived: 'LOGIN: CALLBACK RECEIVED',
      proFeatureCustomDomains: 'PRO FEATURE: CUSTOM DOMAINS',
      freeLimitUpToSites: 'FREE LIMIT: UP TO {count} SITES',
      missionStartFailed: 'MISSION START FAILED',
      lockResetReload: 'LOCK RESET - RELOAD TAB TO TEST',
      settingsSaved: 'SETTINGS SAVED',
      settingsMissionOffQa: 'SETTINGS MISSION: OFF (QA MODE)',
      startMission: 'START MISSION',
      proOnly: 'PRO ONLY',
      settingsUnlockedFor: 'SETTINGS UNLOCKED ({minutes}M LEFT)',
      settingsAccessRemaining: 'SETTINGS ACCESS LEFT: {minutes} MIN',
      settingsLockExpired: 'SETTINGS LOCK EXPIRED',
      unlockPreset: 'UNLOCK PRESET',
      presetCooldownNote: 'Preset changes apply immediately after Settings Guard unlock.',
      presetCurrentActive: 'ACTIVE: {name} ({reps} REPS / {minutes} MIN)',
      presetAppliedNow: 'PRESET APPLIED: {name} ({reps} REPS / {minutes} MIN)',
      proOnlyPresetLocked: 'PRO ONLY',
      subtitle: 'LOCK DURATION SETTINGS',
      authLogin: 'LOGIN WITH GOOGLE',
      authLogout: 'LOGOUT',
      incognitoTitle: 'INCOGNITO NOT PROTECTED',
      incognitoDesc: 'Enable in settings to prevent bypass',
      fixBtn: 'FIX',
      gracePeriod: 'GRACE PERIOD',
      freeDurationFixed: '20 MIN (FREE FIXED)',
      targetReps: 'TARGET REPS',
      blockedSites: 'BLOCKED SITES',
      adultBlock: 'ADULT BLOCK',
      addBtn: 'ADD',
      customDomainPlaceholder: 'e.g. news.google.com',
      lockSchedule: 'LOCK SCHEDULE',
      weekdays: 'WEEKDAYS',
      everyday: 'EVERYDAY',
      presetA: 'PRESET A',
      presetB: 'PRESET B',
      start: 'START',
      to: 'TO',
      end: 'END',
      scheduleLockNote: 'FREE: Switch schedule with WEEKDAYS / EVERYDAY. Day and time are locked.',
      manageSubscription: 'MANAGE SUBSCRIPTION',
      upgradeToPro: 'UPGRADE TO PRO',
      startFreeTrial: 'START FREE TRIAL',
      applyCurrentLock: 'APPLY TO CURRENT LOCK',
      forceRelock: 'FORCE RELOCK (TESTING)',
      viewOnlyBar: 'VIEW ONLY MODE: SETTINGS CANNOT BE CHANGED',
      returnToMission: 'RETURN TO MISSION',
      settingsLockedTitle: 'SETTINGS LOCKED',
      settingsLockedDesc: 'Complete 15 reps to unlock settings for 15 minutes.',
      scanWithPhone: 'SCAN WITH PHONE',
      waitingConnection: 'Waiting for connection...',
      viewOnlyNoEdit: 'VIEW ONLY (NO EDIT)',
      trialNote: 'New accounts can use a 14-day free trial. To continue after trial, PRO subscription is required.',
      trialStartedNoCard: 'Free trial started. No card required.',
      trialActiveNoCard: 'Trial active. No card required now.',
      alreadyProNoCheckout: 'You are already on PRO.',
      reviewPlanAfterLogin: 'Logged in. Free trial status updated.',
    },
    ja: {
      upgradeLoginNote: 'まずログインして無料体験を開始できます（カード不要）。必要なら後から購入。',
      billingChangeNote: 'プラン変更は次回請求タイミングで反映されます',
      viewOnlyMode: '閲覧モード',
      settingsLocked: '設定はロックされています',
      planPro: 'プラン: PRO',
      planTrial: 'プラン: TRIAL',
      planTrialDays: 'プラン: TRIAL（残り{days}日）',
      planFree: 'プラン: FREE',
      planChecking: 'プラン確認中...',
      cancelScheduledUntilDate: '解約予約済み: {date} まで PRO',
      cancelScheduledUntilPeriodEnd: '解約予約済み: 期間終了まで PRO',
      loginRequired: 'ログインが必要です',
      portalError: 'ポータルエラー: {detail}',
      portalOpened: 'ポータルを開きました',
      portalFailed: 'ポータル起動に失敗しました',
      extLoginUnavailable: '拡張ログイン不可。スマホログインを開きます...',
      loginPreparingOauth: 'ログイン: OAuth URLを準備中...',
      loginSuccess: 'ログイン成功',
      loginFailed: 'ログイン失敗: {detail}',
      upgradeClicked: 'アップグレードを開始...',
      loginRequiredOpeningGoogle: 'ログインが必要です。Googleログインを開きます...',
      upgradeFailed: 'アップグレード失敗: {detail}',
      noActiveTab: 'アクティブタブがありません',
      noActiveLockSession: '現在のロックセッションがありません',
      applyFailed: '適用に失敗しました',
      appliedSummary: '適用完了: {sid} / {reps}回 / {grace}分',
      scheduleAppliedLockedNow: 'スケジュール適用: 即時ロック',
      scheduleApplied: 'スケジュールを適用しました',
      openPopupOnLockedTab: 'ロック中タブでポップアップを開いてください',
      initWarningFreeMode: '初期化警告: FREEモードで継続します',
      loggedOut: 'ログアウトしました',
      extLoginOff: '拡張ログインOFF。スマホログインリンクを利用してください',
      ready: '準備完了',
      loggedInFmt: 'ログイン中: {email}',
      loggedInAccount: 'アカウント',
      notLoggedIn: '未ログイン',
      profileError: 'プロフィールエラー: {detail}',
      trialInitError: 'トライアル初期化エラー: {detail}',
      deviceLinkSyncError: 'デバイス連携同期エラー: {detail}',
      loginRequestingProviderUrl: 'ログイン: 認証URLを取得中...',
      loginOpeningGoogleAuth: 'ログイン: Google認証を開いています...',
      loginClicked: 'ログイン処理を開始...',
      loginGetRedirectUrl: 'ログイン: リダイレクトURL取得',
      loginRequestProviderUrl: 'ログイン: 認証URL要求',
      loginOpenGoogleAuth: 'ログイン: Google認証を開く',
      loginCallbackReceived: 'ログイン: コールバック受信',
      proFeatureCustomDomains: 'PRO機能: カスタムドメイン',
      freeLimitUpToSites: 'FREE上限: 最大{count}サイト',
      missionStartFailed: 'ミッション開始に失敗しました',
      lockResetReload: 'ロックをリセットしました - タブをリロードしてください',
      settingsSaved: '設定を保存しました',
      settingsMissionOffQa: '設定ミッション: OFF（QAモード）',
      startMission: 'ミッション開始',
      proOnly: 'PRO専用',
      settingsUnlockedFor: '設定を解除中（残り{minutes}分）',
      settingsAccessRemaining: '設定操作の残り時間: あと{minutes}分',
      settingsLockExpired: '設定の解除期限が切れました',
      unlockPreset: '解除プリセット',
      presetCooldownNote: 'Settings Guard解除後、プリセット変更はすぐ反映されます。',
      presetCurrentActive: '現在有効: {name}（{reps}回 / {minutes}分）',
      presetAppliedNow: 'プリセットを反映しました: {name}（{reps}回 / {minutes}分）',
      proOnlyPresetLocked: 'PRO専用',
      subtitle: 'ロック時間設定',
      authLogin: 'Googleでログイン',
      authLogout: 'ログアウト',
      incognitoTitle: 'シークレットモードが保護されていません',
      incognitoDesc: '回避防止のため設定で有効化してください',
      fixBtn: '修正',
      gracePeriod: '解放時間',
      freeDurationFixed: '20分（FREE固定）',
      targetReps: '目標回数',
      blockedSites: 'ブロックサイト',
      adultBlock: 'アダルトブロック',
      addBtn: '追加',
      customDomainPlaceholder: '例: news.google.com',
      lockSchedule: 'ロックスケジュール',
      weekdays: '平日',
      everyday: '毎日',
      presetA: 'プリセットA',
      presetB: 'プリセットB',
      start: '開始',
      to: '〜',
      end: '終了',
      scheduleLockNote: 'FREE: 平日/毎日のみ切替可。曜日と時間は固定です。',
      manageSubscription: 'サブスク管理',
      upgradeToPro: 'PROにアップグレード',
      startFreeTrial: '無料体験を開始',
      applyCurrentLock: '現在のロックに適用',
      forceRelock: '強制再ロック（テスト）',
      viewOnlyBar: '閲覧専用モード: 設定は変更できません',
      returnToMission: 'ミッションに戻る',
      settingsLockedTitle: '設定はロック中',
      settingsLockedDesc: '設定を変更するには15回の運動を完了してください。解除は15分間有効です。',
      scanWithPhone: 'スマホで読み取り',
      waitingConnection: '接続待機中...',
      viewOnlyNoEdit: '閲覧のみ（編集不可）',
      trialNote: '新規アカウントは14日間の無料体験を利用できます。継続利用は体験後にPRO登録が必要です。',
      trialStartedNoCard: '無料体験を開始しました。カード登録は不要です。',
      trialActiveNoCard: '無料体験中です。今はカード不要です。',
      alreadyProNoCheckout: 'すでにPROプランです。',
      reviewPlanAfterLogin: 'ログインしました。無料体験ステータスを更新しました。',
    },
  };
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
    trialJustStarted: false,
    cancelAtPeriodEnd: false,
    currentPeriodEnd: null,
  };
  let isProUser = false;
  let loginInFlight = false;
  let upgradeInFlight = false;
  let manageInFlight = false;
  let entitlementRefreshInFlight = false;
  let entitlementRefreshPromise = null;
  let planUiReady = false;
  let settingsMissionStarted = false;
  let isSettingsViewOnly = false;
  let toastTimer = null;
  let applyBtnStateInFlight = false;
  let currentLockTabId = null;
  let lastLockTabRecoveryAt = 0;
  let settingsUnlockWatchTimer = null;
  let settingsUnlockExpiresAtMs = 0;
  let activeUnlockPresetId = DEFAULT_FREE_UNLOCK_PRESET_ID;

  async function rememberSettingsWindowId() {
    try {
      const win = await chrome.windows.getCurrent();
      if (win?.id) {
        await chrome.storage.local.set({ [SETTINGS_WINDOW_ID_KEY]: win.id });
      }
    } catch (_) {
      // no-op
    }
  }

  function localizeStaticText() {
    document.querySelectorAll('[data-i18n]').forEach((el) => {
      const key = el.getAttribute('data-i18n');
      if (!key) return;
      el.textContent = t(key);
    });
    document.querySelectorAll('[data-i18n-placeholder]').forEach((el) => {
      const key = el.getAttribute('data-i18n-placeholder');
      if (!key) return;
      el.setAttribute('placeholder', t(key));
    });
    if (upgradeLoginNote) upgradeLoginNote.textContent = t('upgradeLoginNote');
    if (billingChangeNote) billingChangeNote.textContent = t('billingChangeNote');
    if (langEnBtn) langEnBtn.classList.toggle('active', uiLang === 'en');
    if (langJaBtn) langJaBtn.classList.toggle('active', uiLang === 'ja');
  }

  function t(key, params = {}) {
    const dict = UI_TEXT[uiLang] || UI_TEXT.en;
    const fallback = UI_TEXT.en;
    let out = dict[key] || fallback[key] || key;
    Object.entries(params).forEach(([k, v]) => {
      out = out.replace(new RegExp(`\\{${k}\\}`, 'g'), String(v));
    });
    return out;
  }

  function getPresetById(id) {
    const key = String(id || '').toLowerCase();
    return UNLOCK_PRESETS[key] || UNLOCK_PRESETS[DEFAULT_FREE_UNLOCK_PRESET_ID];
  }

  function getAllowedPresetIds() {
    return isProUser ? PRO_UNLOCK_PRESET_IDS : FREE_UNLOCK_PRESET_IDS;
  }

  function getDefaultPresetIdForPlan() {
    return isProUser ? DEFAULT_PRO_UNLOCK_PRESET_ID : DEFAULT_FREE_UNLOCK_PRESET_ID;
  }

  async function persistUnlockPresetState() {
    const active = getPresetById(activeUnlockPresetId);
    await chrome.storage.local.set({
      [UNLOCK_PRESET_ACTIVE_KEY]: active.id,
      toll_unlock_preset_pending: null,
      target_squat_count: active.reps,
      lock_duration_min: active.graceMin,
    });
  }

  function renderUnlockPresetStateUi() {
    if (!unlockPresetOptions) return;
    const allowed = new Set(getAllowedPresetIds());
    unlockPresetOptions.querySelectorAll('input[name="unlock-preset"]').forEach((input) => {
      const id = String(input.value || '').toLowerCase();
      const isAllowed = allowed.has(id);
      input.disabled = !isAllowed;
      input.checked = id === activeUnlockPresetId;
      const card = input.nextElementSibling;
      if (card && card.querySelector('.preset-detail')) {
        const p = getPresetById(id);
        const detail = uiLang === 'ja'
          ? `${p.reps}回 / ${p.graceMin}分`
          : `${p.reps} REPS / ${p.graceMin} MIN`;
        card.querySelector('.preset-detail').textContent = detail;
        card.querySelector('.preset-name').textContent = p.label;
      }
      if (card) {
        card.title = isAllowed ? '' : t('proOnlyPresetLocked');
      }
    });

    const activePreset = getPresetById(activeUnlockPresetId);
    if (unlockActivePolicyEl) {
      unlockActivePolicyEl.textContent = t('presetCurrentActive', {
        name: activePreset.label,
        reps: activePreset.reps,
        minutes: activePreset.graceMin,
      });
    }

  }

  async function syncUnlockPresetState() {
    const data = await chrome.storage.local.get([
      UNLOCK_PRESET_ACTIVE_KEY,
      'toll_unlock_preset_pending',
      'target_squat_count',
      'lock_duration_min',
    ]);
    const allowed = new Set(getAllowedPresetIds());
    const defaultPreset = getDefaultPresetIdForPlan();
    const rawActive = String(data?.[UNLOCK_PRESET_ACTIVE_KEY] || '').toLowerCase();
    let nextActiveId = allowed.has(rawActive) ? rawActive : defaultPreset;
    const activeChanged = String(data?.[UNLOCK_PRESET_ACTIVE_KEY] || '') !== nextActiveId;
    const activePreset = getPresetById(nextActiveId);
    const compatChanged =
      Number(data?.target_squat_count || 0) !== activePreset.reps ||
      Number(data?.lock_duration_min || 0) !== activePreset.graceMin;
    const hasLegacyPending = !!data?.toll_unlock_preset_pending;

    activeUnlockPresetId = nextActiveId;
    if (activeChanged || compatChanged || hasLegacyPending) {
      await persistUnlockPresetState();
    }
    renderUnlockPresetStateUi();
  }

  async function selectUnlockPreset(nextPresetId) {
    const normalized = String(nextPresetId || '').toLowerCase();
    if (!getAllowedPresetIds().includes(normalized)) {
      statusMsg.textContent = t('proOnly');
      showSavedStatus();
      showToast(statusMsg.textContent);
      return;
    }

    if (normalized === activeUnlockPresetId) {
      return;
    }

    activeUnlockPresetId = normalized;
    await persistUnlockPresetState();
    renderUnlockPresetStateUi();
    const p = getPresetById(activeUnlockPresetId);
    statusMsg.textContent = t('presetAppliedNow', { name: p.label, reps: p.reps, minutes: p.graceMin });
    showSavedStatus(2600);
  }

  async function initializeUiLanguage() {
    try {
      const data = await chrome.storage.local.get('toll_ui_lang');
      const saved = data?.toll_ui_lang;
      if (saved === 'ja' || saved === 'en') {
        uiLang = saved;
        return;
      }
      const detected = (navigator.language || 'en').toLowerCase().startsWith('ja') ? 'ja' : 'en';
      uiLang = detected;
      await chrome.storage.local.set({ toll_ui_lang: uiLang });
    } catch (_) {
      uiLang = (navigator.language || 'en').toLowerCase().startsWith('ja') ? 'ja' : 'en';
    }
  }

  async function setUiLanguage(nextLang) {
    uiLang = nextLang === 'ja' ? 'ja' : 'en';
    await chrome.storage.local.set({ toll_ui_lang: uiLang });
    localizeStaticText();
    updateUnlockRemaining();
    renderUnlockPresetStateUi();
    updateAuthUi();
    updatePlanUi();
    await broadcastUiLanguageChange(uiLang);
    if (unlockBtn) {
      unlockBtn.textContent = (!SETTINGS_GUARD_ENABLED || isProUser) ? t('startMission') : t('proOnly');
    }
  }

  function getLoggedOutEntitlement() {
    return {
      isPro: false,
      reason: 'logged_out',
      planState: 'free',
      trialDaysLeft: 0,
      trialJustStarted: false,
      cancelAtPeriodEnd: false,
      currentPeriodEnd: null,
    };
  }

  async function consumeBillingFeedback() {
    try {
      const data = await chrome.storage.local.get('toll_billing_feedback');
      const feedback = data?.toll_billing_feedback;
      if (!feedback?.message) return;
      statusMsg.textContent = feedback.message;
      showSavedStatus(5000);
      await chrome.storage.local.remove('toll_billing_feedback');
    } catch (_) {
      // Non-fatal: if storage read fails, continue without feedback message.
    }
  }

  async function refreshEntitlementUi() {
    if (entitlementRefreshInFlight) return entitlementRefreshPromise;
    entitlementRefreshInFlight = true;
    entitlementRefreshPromise = (async () => {
      const wasPro = !!isProUser;
      const authEntitlement = await fetchEntitlementByAuth();
      if (authEntitlement) {
        entitlement = authEntitlement;
      } else {
        entitlement = getLoggedOutEntitlement();
      }
      isProUser = !!entitlement.isPro;
      updateAuthUi();
      updatePlanUi();
      if (planUiReady && wasPro !== isProUser) {
        await applyPlanRestrictionsAfterAuthChange();
      }
    })();
    try {
      await entitlementRefreshPromise;
    } finally {
      entitlementRefreshInFlight = false;
      entitlementRefreshPromise = null;
    }
  }

  function setTopStatus(text) {
    if (authUserLabel) authUserLabel.textContent = text;
  }

  function setSettingsReadOnly(readOnly) {
    const controls = settingsContent.querySelectorAll('input, select, textarea, button');
    controls.forEach((el) => {
      if (readOnly) {
        if (!el.hasAttribute('data-prev-disabled')) {
          el.setAttribute('data-prev-disabled', el.disabled ? '1' : '0');
        }
        el.disabled = true;
      } else {
        const prev = el.getAttribute('data-prev-disabled');
        if (prev !== null) {
          el.disabled = prev === '1';
          el.removeAttribute('data-prev-disabled');
        }
      }
    });
  }

  function enterViewOnlyMode() {
    isSettingsViewOnly = true;
    lockOverlay.classList.add('hidden');
    settingsContent.classList.remove('locked');
    setSettingsReadOnly(true);
    if (viewOnlyBar) viewOnlyBar.classList.remove('hidden');
    hideUnlockRemaining();
    statusMsg.textContent = t('viewOnlyMode');
    showSavedStatus();
  }

  function returnToMissionMode() {
    isSettingsViewOnly = false;
    setSettingsReadOnly(false);
    settingsContent.classList.add('locked');
    lockOverlay.classList.remove('hidden');
    if (viewOnlyBar) viewOnlyBar.classList.add('hidden');
    settingsUnlockExpiresAtMs = 0;
    hideUnlockRemaining();
    statusMsg.textContent = t('settingsLocked');
    showSavedStatus();
    chrome.storage.local.remove(SETTINGS_UNLOCK_EXPIRES_AT_KEY).catch(() => {});
  }

  function showToast(message, durationMs = 2600) {
    if (!toastMsg) return;
    if (toastTimer) clearTimeout(toastTimer);
    toastMsg.textContent = message;
    toastMsg.classList.remove('hidden');
    requestAnimationFrame(() => toastMsg.classList.add('show'));
    toastTimer = setTimeout(() => {
      toastMsg.classList.remove('show');
      setTimeout(() => toastMsg.classList.add('hidden'), 190);
    }, durationMs);
  }

  function setApplyCurrentLockEnabled(enabled) {
    if (!applyCurrentLockBtn) return;
    applyCurrentLockBtn.disabled = !enabled;
    applyCurrentLockBtn.title = enabled ? '' : 'Active only while a lock overlay is shown.';
  }

  async function ensureContentScriptInjected(tabId) {
    if (!Number.isFinite(tabId) || !chrome?.scripting?.executeScript) return false;
    try {
      await chrome.scripting.insertCSS({
        target: { tabId },
        files: ['overlay.css'],
      });
    } catch (_) {
      // no-op: CSS may already be present or page may not allow injection.
    }
    try {
      await chrome.scripting.executeScript({
        target: { tabId },
        files: ['lib/qrcode.min.js', 'content.js'],
      });
      return true;
    } catch (_) {
      return false;
    }
  }

  async function sendMessageWithRecovery(tabId, message, { reinjectIfNeeded = false } = {}) {
    try {
      return await chrome.tabs.sendMessage(tabId, message);
    } catch (_) {
      if (!reinjectIfNeeded) throw _;
      const injected = await ensureContentScriptInjected(tabId);
      if (!injected) throw _;
      return chrome.tabs.sendMessage(tabId, message);
    }
  }

  async function findLockTabIds({ reinjectIfNeeded = false } = {}) {
    const tabs = await chrome.tabs.query({ url: ['http://*/*', 'https://*/*'] });
    if (!Array.isArray(tabs) || tabs.length === 0) return [];
    const sortedTabs = [...tabs].sort((a, b) => Number(!!b.active) - Number(!!a.active));
    const ids = [];
    for (const tab of sortedTabs) {
      if (!tab?.id) continue;
      try {
        const response = await sendMessageWithRecovery(
          tab.id,
          { type: 'TOLL_LOCK_STATUS_QUERY' },
          { reinjectIfNeeded }
        );
        if (response?.ok && response?.lockActive) {
          ids.push(tab.id);
        }
      } catch (_) {
        // no-op
      }
    }
    return ids;
  }

  async function findActiveLockTabId() {
    const ids = await findLockTabIds({ reinjectIfNeeded: false });
    return ids[0] || null;
  }

  async function broadcastSettingsRefresh() {
    const tabs = await chrome.tabs.query({ url: ['http://*/*', 'https://*/*'] });
    if (!Array.isArray(tabs) || tabs.length === 0) return;
    await Promise.all(tabs.map(async (tab) => {
      if (!tab?.id) return;
      try {
        await sendMessageWithRecovery(
          tab.id,
          { type: 'TOLL_FORCE_REEVALUATE' },
          { reinjectIfNeeded: true }
        );
      } catch (_) {
        // no-op
      }
    }));
  }

  async function broadcastUiLanguageChange(lang) {
    const tabs = await chrome.tabs.query({ url: ['http://*/*', 'https://*/*'] });
    if (!Array.isArray(tabs) || tabs.length === 0) return;
    await Promise.all(tabs.map(async (tab) => {
      if (!tab?.id) return;
      try {
        await sendMessageWithRecovery(
          tab.id,
          { type: 'TOLL_SET_UI_LANG', lang },
          { reinjectIfNeeded: true }
        );
      } catch (_) {
        // no-op
      }
    }));
  }

  async function refreshApplyCurrentLockState() {
    if (applyBtnStateInFlight) return;
    applyBtnStateInFlight = true;
    try {
      let lockTabId = await findActiveLockTabId();
      const now = Date.now();
      if (!lockTabId && (now - lastLockTabRecoveryAt > 20000)) {
        lastLockTabRecoveryAt = now;
        const recovered = await findLockTabIds({ reinjectIfNeeded: true });
        lockTabId = recovered[0] || null;
      }
      currentLockTabId = lockTabId;
      setApplyCurrentLockEnabled(!!lockTabId);
    } catch (_) {
      currentLockTabId = null;
      setApplyCurrentLockEnabled(false);
    } finally {
      applyBtnStateInFlight = false;
    }
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

  function cachePlanSnapshot(state, days) {
    chrome.storage.local.set({
      toll_plan_state_cache: state || 'unknown',
      toll_trial_days_left_cache: Number.isFinite(days) ? days : 0,
    }).catch(() => {});
  }

  function updatePlanUi() {
    const state = (entitlement?.planState || 'unknown').toLowerCase();
    if (trialNote) {
      trialNote.classList.toggle('hidden', state === 'trial');
    }
    if (billingChangeNote) {
      billingChangeNote.classList.toggle('hidden', state !== 'pro');
    }
    if (upgradeBtn) {
      const loggedIn = !!authAccessToken;
      const hideUpgrade = state === 'pro';
      upgradeBtn.classList.toggle('hidden', hideUpgrade);
      if (!hideUpgrade) {
        const ctaKey = loggedIn ? 'upgradeToPro' : 'startFreeTrial';
        upgradeBtn.textContent = t(ctaKey);
      }
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

    const days = entitlement?.trialDaysLeft || 0;
    cachePlanSnapshot(state, days);

    if (state === 'pro') {
      planLabel.textContent = t('planPro');
      planLabel.classList.add('plan-pro');
      if (planDetailLabel && entitlement?.cancelAtPeriodEnd) {
        const ymd = formatYmd(entitlement?.currentPeriodEnd);
        planDetailLabel.textContent = ymd
          ? t('cancelScheduledUntilDate', { date: ymd })
          : t('cancelScheduledUntilPeriodEnd');
        planDetailLabel.classList.remove('hidden');
      }
      return;
    }
    if (state === 'trial') {
      planLabel.textContent = days > 0 ? t('planTrialDays', { days }) : t('planTrial');
      planLabel.classList.add('plan-trial');
      return;
    }

    if (state === 'free') {
      planLabel.textContent = t('planFree');
      planLabel.classList.add('plan-free');
      return;
    }

    planLabel.textContent = t('planChecking');
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
          trialJustStarted: false,
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
          trialJustStarted: false,
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
        trialJustStarted: false,
        cancelAtPeriodEnd: !!row.cancel_at_period_end,
        currentPeriodEnd: row.current_period_end || null,
      };
    } catch (e) {
      return {
        isPro: false,
        reason: 'fetch_error',
        planState: 'unknown',
        trialDaysLeft: 0,
        trialJustStarted: false,
        cancelAtPeriodEnd: false,
        currentPeriodEnd: null,
      };
    }
  }

  function openAppLink(deviceId) {
    chrome.tabs.create({ url: `${SMARTPHONE_APP_URL}?device=${encodeURIComponent(deviceId)}` });
  }

  function getPricingLink(deviceId, authToken) {
    const lang = uiLang === 'ja' ? 'ja' : 'en';
    const qs = new URLSearchParams();
    if (deviceId) qs.set('device', deviceId);
    qs.set('lang', lang);
    qs.set('source', 'extension');
    if (authToken) qs.set('ext_token', authToken);
    return `${SMARTPHONE_APP_URL}pricing.html?${qs.toString()}`;
  }

  async function openCheckout(deviceId, authToken) {
    const url = getPricingLink(deviceId, authToken);
    try {
      const current = await chrome.windows.getCurrent({ populate: true });
      const activeTab = (current.tabs || []).find((tab) => tab.active);
      if (activeTab?.id) {
        await chrome.tabs.update(activeTab.id, { url });
        return;
      }
    } catch (_) {
      // fallback below
    }
    chrome.tabs.create({ url });
  }

  async function openCustomerPortal() {
    if (!authAccessToken) {
      statusMsg.textContent = t('loginRequired');
      showSavedStatus();
      return;
    }

    try {
      const lang = uiLang === 'ja' ? 'ja' : 'en';
      const returnQs = new URLSearchParams({
        portal: 'return',
        source: 'extension',
        lang,
      });
      if (deviceId) returnQs.set('device', deviceId);
      const appReturnUrl = `${SMARTPHONE_APP_URL}pricing.html?${returnQs.toString()}`;
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
        statusMsg.textContent = t('portalError', { detail });
        showSavedStatus();
        return;
      }

      try {
        const current = await chrome.windows.getCurrent({ populate: true });
        const activeTab = (current.tabs || []).find((tab) => tab.active);
        if (activeTab?.id) {
          await chrome.tabs.update(activeTab.id, { url: payload.url });
        } else {
          chrome.tabs.create({ url: payload.url });
        }
      } catch (_) {
        chrome.tabs.create({ url: payload.url });
      }
      statusMsg.textContent = t('portalOpened');
      showSavedStatus();
    } catch (e) {
      statusMsg.textContent = t('portalFailed');
      showSavedStatus();
    }
  }

  async function handleLoginClick() {
    setTopStatus(t('loginClicked'));
    try {
      if (!supabase) {
        statusMsg.textContent = t('extLoginUnavailable');
        showSavedStatus();
        if (!deviceId) deviceId = await getOrCreateDeviceId();
        openAppLink(deviceId);
        return;
      }
      statusMsg.textContent = t('loginPreparingOauth');
      showSavedStatus();
      await loginWithGoogleInExtension();
      await refreshEntitlementUi();
      const state = String(entitlement?.planState || '').toLowerCase();
      if (entitlement?.trialJustStarted) {
        statusMsg.textContent = t('trialStartedNoCard');
        showToast(t('trialStartedNoCard'));
      } else if (state === 'trial') {
        statusMsg.textContent = t('trialActiveNoCard');
      } else {
        statusMsg.textContent = t('loginSuccess');
      }
      showSavedStatus();
    } catch (e) {
      setTopStatus(t('loginFailed', { detail: e?.message || e }));
      statusMsg.textContent = t('loginFailed', { detail: e?.message || e });
      showSavedStatus();
    }
  }

  async function handleUpgradeClick() {
    if (authUserLabel) authUserLabel.textContent = t('upgradeClicked');
    try {
      if (!deviceId) {
        deviceId = await getOrCreateDeviceId();
      }
      if (!authAccessToken) {
        statusMsg.textContent = t('loginRequiredOpeningGoogle');
        showSavedStatus();
        await handleLoginClick();
        if (!authAccessToken) {
          return;
        }
        await refreshEntitlementUi();
        const postLoginState = String(entitlement?.planState || '').toLowerCase();
        if (postLoginState === 'trial') {
          statusMsg.textContent = t('trialStartedNoCard');
        } else if (postLoginState === 'pro') {
          statusMsg.textContent = t('alreadyProNoCheckout');
        } else {
          statusMsg.textContent = t('reviewPlanAfterLogin');
        }
        showSavedStatus();
        return;
      }
      const state = String(entitlement?.planState || '').toLowerCase();
      if (state === 'pro') {
        statusMsg.textContent = t('alreadyProNoCheckout');
        showSavedStatus();
        return;
      }
      await openCheckout(deviceId, authAccessToken);
    } catch (e) {
      statusMsg.textContent = t('upgradeFailed', { detail: e?.message || e });
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
      await refreshEntitlementUi();
    } finally {
      manageInFlight = false;
    }
  }

  async function applySettingsToCurrentLock() {
    try {
      const dayChecks = Array.from(document.querySelectorAll('.day-check input'));
      const startTimeInput = document.getElementById('start-time');
      const endTimeInput = document.getElementById('end-time');
      await syncUnlockPresetState();
      const activePreset = getPresetById(activeUnlockPresetId);
      const targetCount = activePreset.reps;
      const graceMin = activePreset.graceMin;
      await chrome.storage.local.set({
        target_squat_count: targetCount,
        lock_duration_min: graceMin,
      });
      const activeDays = dayChecks.filter(c => c.checked).map(c => parseInt(c.dataset.day, 10));
      if (isProUser && activeDays.length > 0 && startTimeInput?.value && endTimeInput?.value) {
        await chrome.storage.local.set({
          lock_schedule: {
            days: activeDays,
            start: startTimeInput.value,
            end: endTimeInput.value,
          },
        });
      }

      let lockTabIds = await findLockTabIds({ reinjectIfNeeded: true });
      if ((!lockTabIds || lockTabIds.length === 0) && Number.isFinite(currentLockTabId)) {
        lockTabIds = [currentLockTabId];
      }
      if (!lockTabIds || lockTabIds.length === 0) {
        statusMsg.textContent = t('noActiveTab');
        showSavedStatus();
        showToast(t('noActiveTab'));
        return;
      }

      currentLockTabId = lockTabIds[0];
      const applyResults = await Promise.all(lockTabIds.map(async (tabId) => {
        try {
          const response = await sendMessageWithRecovery(
            tabId,
            {
              type: 'TOLL_APPLY_CURRENT_LOCK_SETTINGS',
              targetCount: Number.isFinite(targetCount) ? targetCount : null,
              graceMin: Number.isFinite(graceMin) ? graceMin : null,
            },
            { reinjectIfNeeded: true }
          );
          return { tabId, response };
        } catch (_) {
          return { tabId, response: null };
        }
      }));

      const firstOk = applyResults.find((r) => r?.response?.ok)?.response || null;
      if (!firstOk) {
        currentLockTabId = null;
        const firstReason = applyResults.find((r) => r?.response?.reason)?.response?.reason;
        statusMsg.textContent = firstReason === 'no_active_lock'
          ? t('noActiveLockSession')
          : t('applyFailed');
        showSavedStatus();
        showToast(statusMsg.textContent);
        return;
      }

      const sid = firstOk.sessionId || 'CURRENT TAB';
      const reps = firstOk.targetCount ?? targetCount ?? '-';
      const grace = firstOk.graceMin ?? graceMin ?? '-';
      statusMsg.textContent = firstOk.overlayApplied
        ? t('appliedSummary', { sid, reps, grace })
        : (firstOk.lockedNow ? t('scheduleAppliedLockedNow') : t('scheduleApplied'));
      await broadcastSettingsRefresh();
      showSavedStatus(3500);
      showToast(statusMsg.textContent, 3200);
    } catch (_) {
      statusMsg.textContent = t('openPopupOnLockedTab');
      showSavedStatus();
      showToast(statusMsg.textContent);
    }
  }

  if (authLoginBtn) {
    authLoginBtn.onclick = (e) => {
      e.preventDefault();
      triggerLogin();
    };
  }
  if (upgradeBtn) {
    upgradeBtn.onclick = (e) => {
      e.preventDefault();
      triggerUpgrade();
    };
  }
  if (manageSubscriptionBtn) {
    manageSubscriptionBtn.onclick = (e) => {
      e.preventDefault();
      triggerManageSubscription();
    };
  }
  if (applyCurrentLockBtn) {
    applyCurrentLockBtn.onclick = (e) => {
      e.preventDefault();
      applySettingsToCurrentLock();
    };
  }
  if (langEnBtn) {
    langEnBtn.onclick = () => setUiLanguage('en');
  }
  if (langJaBtn) {
    langJaBtn.onclick = () => setUiLanguage('ja');
  }
  await rememberSettingsWindowId();
  await initializeUiLanguage();
  localizeStaticText();
  deviceId = await getOrCreateDeviceId();
  try {
    await refreshEntitlementUi();
  } catch (e) {
    entitlement = {
      isPro: false,
      reason: 'init_error',
      planState: 'unknown',
      trialDaysLeft: 0,
      trialJustStarted: false,
      cancelAtPeriodEnd: false,
      currentPeriodEnd: null,
    };
    isProUser = false;
    statusMsg.textContent = t('initWarningFreeMode');
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
      await refreshEntitlementUi();
      statusMsg.textContent = t('loggedOut');
      showSavedStatus();
    });
  }

  if (!supabase) {
    statusMsg.textContent = t('extLoginOff');
  } else {
    statusMsg.textContent = t('ready');
  }
  setApplyCurrentLockEnabled(false);
  refreshApplyCurrentLockState();
  consumeBillingFeedback();

  // Keep popup state fresh after checkout/webhook without manual reload.
  setInterval(() => {
    refreshEntitlementUi();
    refreshApplyCurrentLockState();
    syncUnlockPresetState();
  }, 4000);
  window.addEventListener('focus', () => {
    refreshEntitlementUi();
    refreshApplyCurrentLockState();
    syncUnlockPresetState();
    consumeBillingFeedback();
  });
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') {
      refreshEntitlementUi();
      refreshApplyCurrentLockState();
      syncUnlockPresetState();
      consumeBillingFeedback();
    }
  });

  function updateAuthUi() {
    const loggedIn = !!authAccessToken;
    if (authLoginBtn) authLoginBtn.classList.toggle('hidden', loggedIn);
    if (authLogoutBtn) authLogoutBtn.classList.toggle('hidden', !loggedIn);
    if (upgradeLoginNote) upgradeLoginNote.classList.toggle('hidden', loggedIn);
    if (authUserLabel) {
      authUserLabel.textContent = loggedIn
        ? t('loggedInFmt', { email: authUserEmail || t('loggedInAccount') })
        : t('notLoggedIn');
    }
  }

  async function fetchEntitlementByAuth() {
    if (!supabase) return null;
    const { data } = await supabase.auth.getSession();
    const session = data?.session || null;
    if (!session) {
      authAccessToken = null;
      authUserEmail = null;
      return null;
    }

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
      statusMsg.textContent = t('profileError', { detail: lastError?.message || 'no row' });
      showSavedStatus();
      return {
        isPro: false,
        reason: 'profile_error',
        planState: 'unknown',
        trialDaysLeft: 0,
        trialJustStarted: false,
        cancelAtPeriodEnd: false,
        currentPeriodEnd: null,
      };
    }

    let trialJustStarted = false;
    // Start one-time 14-day trial for newly created free accounts.
    if (!profile.trial_ends_at && !profile.trial_used && String(profile.subscription_status || '').toLowerCase() !== 'active') {
      const trialEnds = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString();
      const { error: trialInitError } = await supabase
        .from('profiles')
        .update({ trial_ends_at: trialEnds, trial_used: true, plan_tier: 'free' })
        .eq('id', session.user.id);
      if (!trialInitError) {
        profile.trial_ends_at = trialEnds;
        profile.trial_used = true;
        if (!profile.plan_tier) profile.plan_tier = 'free';
        trialJustStarted = true;
      } else {
        statusMsg.textContent = t('trialInitError', { detail: trialInitError.message });
        showSavedStatus();
      }
    }

    const sub = String(profile.subscription_status || '').toLowerCase();
    const trialActive = isTrialActive(profile.trial_ends_at);
    const isPro = sub === 'active' || trialActive;
    const planState = sub === 'active' ? 'pro' : (trialActive ? 'trial' : 'free');
    try {
      if (!deviceId) deviceId = await getOrCreateDeviceId();
      const linkPayload = {
        user_id: session.user.id,
        subscription_status: sub === 'active' ? 'active' : 'inactive',
        plan_tier: sub === 'active' ? 'pro' : 'free',
        trial_ends_at: profile.trial_ends_at || null,
        cancel_at_period_end: !!profile.cancel_at_period_end,
        current_period_end: profile.current_period_end || null,
        updated_at: new Date().toISOString(),
        last_seen_at: new Date().toISOString(),
      };
      let { error: linkError } = await supabase
        .from('device_links')
        .upsert({
          device_id: deviceId,
          ...linkPayload,
        }, { onConflict: 'device_id' });

      // If the existing device row belongs to another user and RLS blocks update,
      // rotate local device_id and create a fresh link for this logged-in account.
      if (linkError) {
        const rotatedDeviceId = generateDeviceId();
        await chrome.storage.local.set({ toll_device_id: rotatedDeviceId });
        deviceId = rotatedDeviceId;
        const retry = await supabase
          .from('device_links')
          .upsert({
            device_id: deviceId,
            ...linkPayload,
          }, { onConflict: 'device_id' });
        linkError = retry.error || null;
      }

      if (linkError) {
        statusMsg.textContent = t('deviceLinkSyncError', { detail: linkError.message });
        showSavedStatus();
      }
    } catch (_) {
      // Non-fatal: auth entitlement should still work even if device sync fails.
    }
    return {
      isPro,
      reason: isPro ? 'pro_or_trial' : 'free_auth',
      planState,
      trialDaysLeft: getTrialDaysLeft(profile.trial_ends_at),
      trialJustStarted,
      cancelAtPeriodEnd: !!profile.cancel_at_period_end,
      currentPeriodEnd: profile.current_period_end || null,
    };
  }

  async function loginWithGoogleInExtension() {
    if (!supabase) throw new Error('Supabase library not available in popup');
    setTopStatus(t('loginGetRedirectUrl'));
    const redirectTo = chrome.identity.getRedirectURL('supabase-auth');
    statusMsg.textContent = t('loginRequestingProviderUrl');
    showSavedStatus();
    setTopStatus(t('loginRequestProviderUrl'));
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
    statusMsg.textContent = t('loginOpeningGoogleAuth');
    showSavedStatus();
    setTopStatus(t('loginOpenGoogleAuth'));

    const callbackUrl = await Promise.race([
      chrome.identity.launchWebAuthFlow({
        url: data.url,
        interactive: true,
      }),
      new Promise((_, reject) => setTimeout(() => reject(new Error('OAuth timeout: check redirect URL settings')), 45000)),
    ]);
    if (!callbackUrl) throw new Error('Auth canceled');
    setTopStatus(t('loginCallbackReceived'));

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
    unlockBtn.textContent = t('proOnly');
  }

  // --- Initialize Settings Logic ---
  
  // 0. Adult Block Toggle
  const adultBlockToggle = document.getElementById('adult-block-toggle');
  const adultBlockData = await chrome.storage.local.get('adult_block_enabled');
  adultBlockToggle.checked = !!adultBlockData.adult_block_enabled;

  adultBlockToggle.addEventListener('change', async (e) => {
    await chrome.storage.local.set({ adult_block_enabled: e.target.checked });
    showSavedStatus();
  });
  
  // 1. Unlock preset
  if (unlockPresetOptions) {
    unlockPresetOptions.querySelectorAll('input[name="unlock-preset"]').forEach((input) => {
      input.addEventListener('change', async (e) => {
        if (!e.target.checked) return;
        await selectUnlockPreset(e.target.value);
      });
    });
  }
  await syncUnlockPresetState();

  // 2. Schedule
  const dayChecks = document.querySelectorAll('.day-check input');
  const dayCheckLabels = document.querySelectorAll('.day-check');
  const scheduleDaysContainer = document.querySelector('.schedule-days');
  const scheduleTimeContainer = document.querySelector('.schedule-time');
  const scheduleLockNote = document.getElementById('schedule-lock-note');
  const startTimeInput = document.getElementById('start-time');
  const endTimeInput = document.getElementById('end-time');
  const freeScheduleMode = document.getElementById('free-schedule-mode');
  const proScheduleMode = document.getElementById('pro-schedule-mode');

  const scheduleData = await chrome.storage.local.get([
    'lock_schedule',
    'free_schedule_mode',
    'pro_schedule_presets',
    'active_pro_schedule_preset',
  ]);
  const defaultSchedule = {
    days: [1, 2, 3, 4, 5],
    start: '09:00',
    end: '18:00',
  };

  function normalizeSchedule(raw) {
    if (!raw || !Array.isArray(raw.days)) return { ...defaultSchedule };
    const days = raw.days
      .map((d) => parseInt(d, 10))
      .filter((d) => !Number.isNaN(d) && d >= 0 && d <= 6);
    return {
      days: days.length ? days : [...defaultSchedule.days],
      start: raw.start || defaultSchedule.start,
      end: raw.end || defaultSchedule.end,
    };
  }

  function buildScheduleFromInputs() {
    return {
      days: Array.from(dayChecks).filter((c) => c.checked).map((c) => parseInt(c.dataset.day, 10)),
      start: startTimeInput.value,
      end: endTimeInput.value,
    };
  }

  function applyScheduleToInputs(values) {
    const normalized = normalizeSchedule(values);
    dayChecks.forEach((check) => {
      check.checked = normalized.days.includes(parseInt(check.dataset.day, 10));
    });
    startTimeInput.value = normalized.start;
    endTimeInput.value = normalized.end;
  }

  const schedule = normalizeSchedule(scheduleData.lock_schedule);
  let freeScheduleModeValue = scheduleData.free_schedule_mode || 'weekdays';
  let activeProPresetKey = scheduleData.active_pro_schedule_preset === 'b' ? 'b' : 'a';
  let proSchedulePresets = {
    a: normalizeSchedule(scheduleData?.pro_schedule_presets?.a || schedule),
    b: normalizeSchedule(scheduleData?.pro_schedule_presets?.b || defaultSchedule),
  };

  function applyFreeSchedule(mode) {
    const days = mode === 'everyday'
      ? [0, 1, 2, 3, 4, 5, 6]
      : [1, 2, 3, 4, 5];
    schedule.days = days;
    schedule.start = '00:00';
    schedule.end = '23:59';
    return days;
  }

  async function persistFreeScheduleMode(mode) {
    freeScheduleModeValue = mode === 'everyday' ? 'everyday' : 'weekdays';
    const days = applyFreeSchedule(freeScheduleModeValue);
    await chrome.storage.local.set({
      free_schedule_mode: freeScheduleModeValue,
      lock_schedule: schedule,
    });
    dayChecks.forEach(check => {
      check.checked = days.includes(parseInt(check.dataset.day));
    });
    startTimeInput.value = schedule.start;
    endTimeInput.value = schedule.end;
    if (freeScheduleMode) {
      freeScheduleMode.querySelectorAll('.mode-btn').forEach((btn) => {
        btn.classList.toggle('active', btn.dataset.freeSchedule === freeScheduleModeValue);
      });
    }
    showSavedStatus();
  }

  function renderProPresetTabs() {
    if (!proScheduleMode) return;
    proScheduleMode.querySelectorAll('.mode-btn').forEach((btn) => {
      btn.classList.toggle('active', btn.dataset.proSchedule === activeProPresetKey);
    });
  }

  async function switchProPreset(key) {
    activeProPresetKey = key === 'b' ? 'b' : 'a';
    renderProPresetTabs();
    const selected = normalizeSchedule(proSchedulePresets[activeProPresetKey]);
    applyScheduleToInputs(selected);
    await chrome.storage.local.set({
      active_pro_schedule_preset: activeProPresetKey,
      pro_schedule_presets: proSchedulePresets,
      lock_schedule: selected,
    });
    showSavedStatus();
  }

  applyScheduleToInputs(schedule);
  const blockFreeScheduleInteraction = (e) => {
    if (isProUser) return;
    e.preventDefault();
    e.stopPropagation();
  };
  dayChecks.forEach((check) => {
    check.addEventListener('change', saveSchedule);
  });
  dayCheckLabels.forEach((label) => {
    label.addEventListener('click', blockFreeScheduleInteraction, true);
  });
  startTimeInput.addEventListener('change', saveSchedule);
  endTimeInput.addEventListener('change', saveSchedule);
  if (!isProUser) {
    dayChecks.forEach(c => c.disabled = true);
    startTimeInput.disabled = true;
    endTimeInput.disabled = true;
    if (scheduleDaysContainer) scheduleDaysContainer.classList.add('locked-ui');
    if (scheduleTimeContainer) scheduleTimeContainer.classList.add('locked-ui');
    if (scheduleLockNote) scheduleLockNote.classList.remove('hidden');
    if (freeScheduleMode) {
      freeScheduleMode.classList.remove('hidden');
      freeScheduleMode.querySelectorAll('.mode-btn').forEach((btn) => {
        btn.disabled = false;
        btn.classList.toggle('active', btn.dataset.freeSchedule === freeScheduleModeValue);
        btn.onclick = async () => {
          await persistFreeScheduleMode(btn.dataset.freeSchedule);
        };
      });
    }
    if (proScheduleMode) proScheduleMode.classList.add('hidden');
    await persistFreeScheduleMode(freeScheduleModeValue);
  } else {
    dayChecks.forEach((c) => { c.disabled = false; });
    startTimeInput.disabled = false;
    endTimeInput.disabled = false;
    if (scheduleDaysContainer) scheduleDaysContainer.classList.remove('locked-ui');
    if (scheduleTimeContainer) scheduleTimeContainer.classList.remove('locked-ui');
    if (scheduleLockNote) scheduleLockNote.classList.add('hidden');
    if (freeScheduleMode) {
      freeScheduleMode.classList.add('hidden');
      freeScheduleMode.querySelectorAll('.mode-btn').forEach((btn) => {
        btn.classList.remove('active');
        btn.onclick = null;
        btn.disabled = false;
      });
    }
    if (proScheduleMode) {
      proScheduleMode.classList.remove('hidden');
      proScheduleMode.querySelectorAll('.mode-btn').forEach((btn) => {
        btn.onclick = async () => {
          await switchProPreset(btn.dataset.proSchedule);
        };
      });
      renderProPresetTabs();
    }
    if (!scheduleData.pro_schedule_presets) {
      await chrome.storage.local.set({ pro_schedule_presets: proSchedulePresets });
    }
    await switchProPreset(activeProPresetKey);
  }

  async function saveSchedule() {
    if (!isProUser) return;
    const current = normalizeSchedule(buildScheduleFromInputs());
    proSchedulePresets[activeProPresetKey] = current;
    await chrome.storage.local.set({
      active_pro_schedule_preset: activeProPresetKey,
      pro_schedule_presets: proSchedulePresets,
      lock_schedule: current,
    });
    showSavedStatus();
  }

  function showSavedStatus(durationMs = 2000) {
    statusMsg.className = 'visible';
    setTimeout(() => { statusMsg.className = ''; }, durationMs);
  }

  // 3. Blocked Sites
  const siteChecks = document.querySelectorAll('input[name="blocked-site"]');
  const customInput = document.getElementById('custom-domain-input');
  const addCustomBtn = document.getElementById('add-custom-domain-btn');
  const customSitesList = document.getElementById('custom-sites-list');

  function getDefaultBlockedSitesForLang(lang) {
    const key = lang === 'ja' ? 'ja' : 'en';
    return [...(DEFAULT_BLOCKED_SITES_BY_LANG[key] || DEFAULT_BLOCKED_SITES_BY_LANG.en)];
  }

  const sitesData = await chrome.storage.local.get(['blocked_sites', 'custom_blocked_sites']);
  let savedSites = Array.isArray(sitesData.blocked_sites)
    ? [...sitesData.blocked_sites]
    : getDefaultBlockedSitesForLang(uiLang);
  let customSites = sitesData.custom_blocked_sites || [];

  function normalizeDomain(input) {
    return String(input || '').trim().toLowerCase().replace(/^https?:\/\//, '').replace(/\/+$/, '');
  }

  function getCheckedPresetSites() {
    return Array.from(siteChecks).filter(c => c.checked).map(c => c.value);
  }

  function totalSiteCount(presetSites, custom) {
    return presetSites.length + custom.length;
  }

  function trimForFreeLimit() {
    if (isProUser) return;
    // Free plan: custom domains are Pro-only.
    customSites = [];
    if (savedSites.length > FREE_MAX_SITES) {
      savedSites = savedSites.slice(0, FREE_MAX_SITES);
    }
  }

  trimForFreeLimit();
  await chrome.storage.local.set({
    blocked_sites: savedSites,
    custom_blocked_sites: customSites,
  });
  
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
    if (!isProUser) {
      statusMsg.textContent = t('proFeatureCustomDomains');
      showSavedStatus();
      openCheckout(deviceId, authAccessToken);
      return;
    }
    const domain = normalizeDomain(customInput.value);
    if (!domain || customSites.includes(domain)) return;
    if (domain) {
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
    if (!isProUser && totalSiteCount(activeSites, customSites) > FREE_MAX_SITES) {
      if (e?.target) e.target.checked = false;
      statusMsg.textContent = t('freeLimitUpToSites', { count: FREE_MAX_SITES });
      showSavedStatus();
      showToast(statusMsg.textContent);
      return;
    }
    await chrome.storage.local.set({ blocked_sites: activeSites });
    showSavedStatus();
  }

  async function applyPlanRestrictionsAfterAuthChange() {
    if (!planUiReady) return;

    if (unlockBtn) {
      unlockBtn.disabled = !isProUser;
      if (!SETTINGS_GUARD_ENABLED) {
        unlockBtn.textContent = t('startMission');
      } else {
        unlockBtn.textContent = isProUser ? t('startMission') : t('proOnly');
      }
    }

    await syncUnlockPresetState();

    // 2) Schedule UI + value
    if (!isProUser) {
      dayChecks.forEach((c) => { c.disabled = true; });
      startTimeInput.disabled = true;
      endTimeInput.disabled = true;
      if (scheduleDaysContainer) scheduleDaysContainer.classList.add('locked-ui');
      if (scheduleTimeContainer) scheduleTimeContainer.classList.add('locked-ui');
      if (scheduleLockNote) scheduleLockNote.classList.remove('hidden');
      if (freeScheduleMode) {
        freeScheduleMode.classList.remove('hidden');
        freeScheduleMode.querySelectorAll('.mode-btn').forEach((btn) => {
          btn.disabled = false;
          btn.classList.toggle('active', btn.dataset.freeSchedule === freeScheduleModeValue);
          btn.onclick = async () => {
            await persistFreeScheduleMode(btn.dataset.freeSchedule);
          };
        });
      }
      if (proScheduleMode) {
        proScheduleMode.classList.add('hidden');
      }
      await persistFreeScheduleMode(freeScheduleModeValue);
    } else {
      dayChecks.forEach((c) => { c.disabled = false; });
      startTimeInput.disabled = false;
      endTimeInput.disabled = false;
      if (scheduleDaysContainer) scheduleDaysContainer.classList.remove('locked-ui');
      if (scheduleTimeContainer) scheduleTimeContainer.classList.remove('locked-ui');
      if (scheduleLockNote) scheduleLockNote.classList.add('hidden');
      if (freeScheduleMode) {
        freeScheduleMode.classList.add('hidden');
        freeScheduleMode.querySelectorAll('.mode-btn').forEach((btn) => {
          btn.classList.remove('active');
          btn.onclick = null;
          btn.disabled = false;
        });
      }
      if (proScheduleMode) {
        proScheduleMode.classList.remove('hidden');
        proScheduleMode.querySelectorAll('.mode-btn').forEach((btn) => {
          btn.onclick = async () => {
            await switchProPreset(btn.dataset.proSchedule);
          };
        });
        renderProPresetTabs();
      }
      await switchProPreset(activeProPresetKey);
    }

    // 3) Site limits / custom domains
    if (!isProUser) {
      customSites = [];
      const checkedPresetSites = getCheckedPresetSites();
      if (checkedPresetSites.length > FREE_MAX_SITES) {
        const keep = new Set(checkedPresetSites.slice(0, FREE_MAX_SITES));
        siteChecks.forEach((check) => {
          check.checked = keep.has(check.value);
        });
      }
      savedSites = getCheckedPresetSites();
      customInput.disabled = true;
      addCustomBtn.disabled = true;
      await chrome.storage.local.set({
        blocked_sites: savedSites,
        custom_blocked_sites: customSites,
      });
    } else {
      customInput.disabled = false;
      addCustomBtn.disabled = false;
      savedSites = getCheckedPresetSites();
      await chrome.storage.local.set({ blocked_sites: savedSites });
    }
    renderCustomSites();
  }

  planUiReady = true;

  // --- Settings Guard Logic ---
  function getRemainingUnlockMinutes(expiresAtMs) {
    return Math.max(1, Math.ceil((expiresAtMs - Date.now()) / 60000));
  }

  function hideUnlockRemaining() {
    if (!settingsUnlockRemaining) return;
    settingsUnlockRemaining.classList.add('hidden');
    settingsUnlockRemaining.textContent = '';
  }

  function updateUnlockRemaining(expiresAtMs = settingsUnlockExpiresAtMs) {
    if (!settingsUnlockRemaining) return;
    settingsUnlockExpiresAtMs = Number(expiresAtMs) || 0;
    const canShow =
      SETTINGS_GUARD_ENABLED &&
      settingsUnlockExpiresAtMs > Date.now() &&
      lockOverlay?.classList.contains('hidden');
    if (!canShow) {
      hideUnlockRemaining();
      return;
    }
    const mins = getRemainingUnlockMinutes(settingsUnlockExpiresAtMs);
    settingsUnlockRemaining.textContent = t('settingsAccessRemaining', { minutes: mins });
    settingsUnlockRemaining.classList.remove('hidden');
  }

  function setUnlockStatus(expiresAtMs) {
    const mins = getRemainingUnlockMinutes(expiresAtMs);
    statusMsg.textContent = t('settingsUnlockedFor', { minutes: mins });
    updateUnlockRemaining(expiresAtMs);
    showSavedStatus(2400);
  }

  async function getStoredUnlockExpiryMs() {
    const data = await chrome.storage.local.get(SETTINGS_UNLOCK_EXPIRES_AT_KEY);
    const raw = Number(data?.[SETTINGS_UNLOCK_EXPIRES_AT_KEY] || 0);
    return Number.isFinite(raw) ? raw : 0;
  }

  async function clearStoredUnlockExpiry() {
    await chrome.storage.local.remove(SETTINGS_UNLOCK_EXPIRES_AT_KEY);
  }

  function startSettingsUnlockWatcher() {
    if (settingsUnlockWatchTimer) clearInterval(settingsUnlockWatchTimer);
    settingsUnlockWatchTimer = setInterval(async () => {
      if (!SETTINGS_GUARD_ENABLED) return;
      try {
        const expiresAt = await getStoredUnlockExpiryMs();
        if (!expiresAt) return;
        if (Date.now() >= expiresAt) {
          clearInterval(settingsUnlockWatchTimer);
          settingsUnlockWatchTimer = null;
          await clearStoredUnlockExpiry();
          settingsUnlockExpiresAtMs = 0;
          settingsContent.classList.add('locked');
          lockOverlay.classList.remove('hidden');
          hideUnlockRemaining();
          statusMsg.textContent = t('settingsLockExpired');
          showSavedStatus(2600);
          if (!settingsMissionStarted) {
            startSettingsUnlockMission().catch(() => {});
          }
          return;
        }
        if (lockOverlay.classList.contains('hidden')) {
          setUnlockStatus(expiresAt);
        } else {
          hideUnlockRemaining();
        }
      } catch (_) {
        // no-op
      }
    }, 30000);
  }

  async function startSettingsUnlockMission() {
    if (settingsMissionStarted) return;
    settingsMissionStarted = true;
    try {
      unlockBtn.classList.add('hidden');
      qrSection.classList.remove('hidden');
      
      // 1. セッションID生成 (設定ロック解除専用ID)
      const sessionId = 'CFG-' + Math.random().toString(36).substr(2, 6).toUpperCase();
      
      // 2. QRコード表示 (qrcode.min.jsがmanifestにJSとして含まれている前提)
      const qrEl = document.getElementById('settings-qrcode');
      qrEl.innerHTML = '';
      if (typeof QRCode !== 'undefined') {
        new QRCode(qrEl, {
          text: `${SMARTPHONE_APP_URL}?session=${sessionId}&target=${SETTINGS_UNLOCK_REPS}&device=${encodeURIComponent(deviceId)}`,
          width: 120,
          height: 120,
          colorDark: '#000000',
          colorLight: '#ffffff'
        });
      }

      // 3. セッション登録 (15回スクワットを要求)
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
            await unlockSettings();
          }
        } catch (e) {
          console.error('Polling error:', e);
        }
      }, 2000);
    } catch (e) {
      settingsMissionStarted = false;
      unlockBtn.classList.remove('hidden');
      qrSection.classList.add('hidden');
      statusMsg.textContent = t('missionStartFailed');
      showSavedStatus();
      throw e;
    }
  }

  unlockBtn.addEventListener('click', startSettingsUnlockMission);

  async function unlockSettings({ persist = true } = {}) {
    isSettingsViewOnly = false;
    setSettingsReadOnly(false);
    lockOverlay.classList.add('hidden');
    settingsContent.classList.remove('locked');
    if (viewOnlyBar) viewOnlyBar.classList.add('hidden');
    if (!SETTINGS_GUARD_ENABLED) {
      hideUnlockRemaining();
      return;
    }
    let expiresAt = 0;
    if (persist) {
      expiresAt = Date.now() + SETTINGS_UNLOCK_WINDOW_MS;
      await chrome.storage.local.set({ [SETTINGS_UNLOCK_EXPIRES_AT_KEY]: expiresAt });
    } else {
      expiresAt = await getStoredUnlockExpiryMs();
    }
    if (expiresAt > Date.now()) {
      settingsUnlockExpiresAtMs = expiresAt;
      setUnlockStatus(expiresAt);
      startSettingsUnlockWatcher();
    } else {
      settingsUnlockExpiresAtMs = 0;
      hideUnlockRemaining();
    }
  }

  // FORCE RELOCK (FOR TESTING)
  const relockBtn = document.getElementById('force-relock-btn');
  if (relockBtn) {
    relockBtn.addEventListener('click', async () => {
      await chrome.storage.local.remove([
        'last_global_unlock_time',
        'last_global_unlock_expires_at',
        'toll_global_session_id',
        SETTINGS_UNLOCK_EXPIRES_AT_KEY,
      ]);
      settingsUnlockExpiresAtMs = 0;
      hideUnlockRemaining();
      statusMsg.textContent = t('lockResetReload');
      showSavedStatus();
      setTimeout(() => { statusMsg.textContent = t('settingsSaved'); }, 2100);
    });
  }

  if (viewOnlyBtn) {
    viewOnlyBtn.addEventListener('click', enterViewOnlyMode);
  }
  if (returnToMissionBtn) {
    returnToMissionBtn.addEventListener('click', returnToMissionMode);
  }

  if (!SETTINGS_GUARD_ENABLED) {
    await unlockSettings({ persist: false });
    if (viewOnlyBar) viewOnlyBar.classList.add('hidden');
    if (unlockBtn) unlockBtn.classList.remove('hidden');
    if (qrSection) qrSection.classList.add('hidden');
    statusMsg.textContent = t('settingsMissionOffQa');
    showSavedStatus();
    hideUnlockRemaining();
    return;
  }

  const storedUnlockExpiry = await getStoredUnlockExpiryMs();
  if (storedUnlockExpiry > Date.now()) {
    await unlockSettings({ persist: false });
    startSettingsUnlockWatcher();
    return;
  }
  await clearStoredUnlockExpiry();

  // Popup open => start settings unlock mission automatically.
  if (lockOverlay && !lockOverlay.classList.contains('hidden')) {
    startSettingsUnlockMission().catch((e) => {
      console.error('Auto mission start failed:', e);
      settingsMissionStarted = false;
      unlockBtn.classList.remove('hidden');
      qrSection.classList.add('hidden');
    });
  }
});
