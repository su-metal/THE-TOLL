document.addEventListener('DOMContentLoaded', async () => {
  const SETTINGS_WINDOW_ID_KEY = 'toll_settings_window_id';
  const planLabel = document.getElementById('quick-plan-label');
  const subtitle = document.getElementById('quick-subtitle');
  const openSettingsBtn = document.getElementById('open-settings-btn');
  const langEnBtn = document.getElementById('lang-en-btn');
  const langJaBtn = document.getElementById('lang-ja-btn');

  const UI_TEXT = {
    en: {
      title: 'THE TOLL',
      subtitle: 'Settings moved to a new tab.',
      openSettings: 'OPEN SETTINGS',
      planChecking: 'PLAN: CHECKING...',
      planPro: 'PLAN: PRO',
      planTrial: 'PLAN: TRIAL',
      planTrialDays: 'PLAN: TRIAL ({days}D LEFT)',
      planFree: 'PLAN: FREE',
    },
    ja: {
      title: 'THE TOLL',
      subtitle: '設定画面は新規タブで開きます。',
      openSettings: '設定を開く',
      planChecking: 'プラン確認中...',
      planPro: 'プラン: PRO',
      planTrial: 'プラン: TRIAL',
      planTrialDays: 'プラン: TRIAL（残り{days}日）',
      planFree: 'プラン: FREE',
    },
  };

  let uiLang = 'en';

  function t(key, params = {}) {
    const dict = UI_TEXT[uiLang] || UI_TEXT.en;
    let out = dict[key] || UI_TEXT.en[key] || key;
    Object.entries(params).forEach(([k, v]) => {
      out = out.replace(new RegExp(`\\{${k}\\}`, 'g'), String(v));
    });
    return out;
  }

  function detectPlan(planState, trialDaysLeft) {
    const state = String(planState || '').toLowerCase();
    if (state === 'pro') return t('planPro');
    if (state === 'trial') {
      const days = Number.isFinite(trialDaysLeft) ? trialDaysLeft : 0;
      return days > 0 ? t('planTrialDays', { days }) : t('planTrial');
    }
    if (state === 'free') return t('planFree');
    return t('planChecking');
  }

  async function refreshPlanLabel() {
    try {
      const data = await chrome.storage.local.get([
        'toll_plan_state_cache',
        'toll_trial_days_left_cache',
      ]);
      const planState = data?.toll_plan_state_cache || 'unknown';
      const trialDaysLeft = Number.parseInt(data?.toll_trial_days_left_cache || '0', 10) || 0;
      if (planLabel) planLabel.textContent = detectPlan(planState, trialDaysLeft);
    } catch (_) {
      if (planLabel) planLabel.textContent = t('planChecking');
    }
  }

  function applyLanguageUi() {
    document.documentElement.lang = uiLang;
    document.title = t('title');
    if (subtitle) subtitle.textContent = t('subtitle');
    if (openSettingsBtn) openSettingsBtn.textContent = t('openSettings');
    if (langEnBtn) langEnBtn.classList.toggle('active', uiLang === 'en');
    if (langJaBtn) langJaBtn.classList.toggle('active', uiLang === 'ja');
    refreshPlanLabel();
  }

  async function setUiLanguage(nextLang) {
    uiLang = nextLang === 'ja' ? 'ja' : 'en';
    await chrome.storage.local.set({ toll_ui_lang: uiLang });
    await broadcastUiLanguageChange(uiLang);
    applyLanguageUi();
  }

  async function broadcastUiLanguageChange(lang) {
    const tabs = await chrome.tabs.query({ url: ['http://*/*', 'https://*/*'] });
    if (!Array.isArray(tabs) || tabs.length === 0) return;
    await Promise.all(tabs.map(async (tab) => {
      if (!tab?.id) return;
      try {
        await chrome.tabs.sendMessage(tab.id, { type: 'TOLL_SET_UI_LANG', lang });
      } catch (_) {
        // no-op
      }
    }));
  }

  async function initializeUiLanguage() {
    try {
      const data = await chrome.storage.local.get('toll_ui_lang');
      const saved = data?.toll_ui_lang;
      if (saved === 'ja' || saved === 'en') {
        uiLang = saved;
      } else {
        uiLang = (navigator.language || 'en').toLowerCase().startsWith('ja') ? 'ja' : 'en';
        await chrome.storage.local.set({ toll_ui_lang: uiLang });
      }
    } catch (_) {
      uiLang = (navigator.language || 'en').toLowerCase().startsWith('ja') ? 'ja' : 'en';
    }
  }

  if (openSettingsBtn) {
    openSettingsBtn.addEventListener('click', async () => {
      const settingsUrl = chrome.runtime.getURL('popup.html');
      const data = await chrome.storage.local.get(SETTINGS_WINDOW_ID_KEY);
      const existingId = Number.parseInt(data?.[SETTINGS_WINDOW_ID_KEY], 10);
      if (Number.isFinite(existingId)) {
        try {
          const win = await chrome.windows.get(existingId, { populate: true });
          const settingsTab = (win.tabs || []).find((tab) =>
            typeof tab?.url === 'string' && tab.url.startsWith(settingsUrl)
          );
          if (settingsTab?.id) {
            await chrome.tabs.update(settingsTab.id, { active: true });
            await chrome.windows.update(existingId, { focused: true, state: 'normal' });
            window.close();
            return;
          }
          // existingId points to a different window (id reuse after extension update etc.)
          await chrome.storage.local.remove(SETTINGS_WINDOW_ID_KEY);
        } catch (_) {
          // stale window id; continue creating a new one
          await chrome.storage.local.remove(SETTINGS_WINDOW_ID_KEY).catch(() => {});
        }
      }

      let createLeft;
      let createTop;
      const popupWidth = 420;
      const popupHeight = 760;
      try {
        const currentWin = await chrome.windows.getCurrent();
        if (
          Number.isFinite(currentWin?.left) &&
          Number.isFinite(currentWin?.top) &&
          Number.isFinite(currentWin?.width)
        ) {
          // Place near browser top-right to shorten cursor travel from the extensions button.
          createLeft = Math.max(0, (currentWin.left + currentWin.width) - (popupWidth + 24));
          createTop = Math.max(0, currentWin.top + 64);
        }
      } catch (_) {
        // if window bounds are unavailable, Chrome will choose a default location
      }

      const created = await chrome.windows.create({
        url: settingsUrl,
        type: 'popup',
        focused: true,
        width: popupWidth,
        height: popupHeight,
        ...(Number.isFinite(createLeft) ? { left: createLeft } : {}),
        ...(Number.isFinite(createTop) ? { top: createTop } : {}),
      });
      if (created?.id) {
        await chrome.storage.local.set({ [SETTINGS_WINDOW_ID_KEY]: created.id });
      }
      window.close();
    });
  }
  if (langEnBtn) langEnBtn.addEventListener('click', () => setUiLanguage('en'));
  if (langJaBtn) langJaBtn.addEventListener('click', () => setUiLanguage('ja'));

  await initializeUiLanguage();
  applyLanguageUi();
});
