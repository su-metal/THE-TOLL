(function() {
  'use strict';

  const SUPABASE_URL = 'https://qcnzleiyekbgsiyomwin.supabase.co';
  const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFjbnpsZWl5ZWtiZ3NpeW9td2luIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njg0Mjk2NzMsImV4cCI6MjA4NDAwNTY3M30.NlGUfxDPzMgtu_J0vX7FMe-ikxafboGh5GMr-tsaLfI';

  const params = new URLSearchParams(window.location.search);
  const APP_LANG = params.get('lang') === 'ja' ? 'ja' : 'en';
  const deviceId = (params.get('device') || '').trim();
  const source = (params.get('source') || 'app').trim();
  const extensionToken = (params.get('ext_token') || '').trim();
  if (extensionToken) {
    params.delete('ext_token');
    const clean = `${window.location.pathname}${params.toString() ? `?${params.toString()}` : ''}`;
    window.history.replaceState({}, '', clean);
  }

  const I18N = {
    en: {
      title: 'THE TOLL - Pricing',
      subtitle: 'CHOOSE YOUR PLAN',
      note: 'Select a plan, then continue to secure Stripe checkout.',
      monthly: 'MONTHLY PLAN',
      yearly: 'YEARLY PLAN',
      monthlySub: 'Final amount shown at checkout',
      yearlySub: 'Recommended for lower annual cost',
      back: 'BACK',
      opening: 'Opening Stripe checkout...',
      preparing: 'Preparing checkout...',
      failed: 'Failed to prepare checkout.',
      needLogin: 'Please log in and link your account first.',
    },
    ja: {
      title: 'THE TOLL - 料金プラン',
      subtitle: 'プランを選択',
      note: 'プラン選択後、Stripeの安全な決済画面へ進みます。',
      monthly: '月額プラン',
      yearly: '年額プラン',
      monthlySub: '最終金額は決済画面で確認できます',
      yearlySub: '年間の総額を抑えたい方におすすめ',
      back: '戻る',
      opening: 'Stripe決済画面を開いています...',
      preparing: '決済を準備しています...',
      failed: '決済の準備に失敗しました。',
      needLogin: '先にログインとデバイス連携を行ってください。',
    }
  };

  const t = (k) => (I18N[APP_LANG] && I18N[APP_LANG][k]) || I18N.en[k] || k;

  const el = {
    subtitle: document.getElementById('subtitle'),
    note: document.getElementById('note'),
    monthlyBtn: document.getElementById('monthly-btn'),
    yearlyBtn: document.getElementById('yearly-btn'),
    monthlyLabel: document.getElementById('monthly-label'),
    yearlyLabel: document.getElementById('yearly-label'),
    monthlySub: document.getElementById('monthly-sub'),
    yearlySub: document.getElementById('yearly-sub'),
    status: document.getElementById('status-msg'),
    backBtn: document.getElementById('back-btn'),
  };

  const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

  function applyText() {
    document.documentElement.lang = APP_LANG;
    document.title = t('title');
    el.subtitle.textContent = t('subtitle');
    el.note.textContent = t('note');
    el.monthlyLabel.textContent = t('monthly');
    el.yearlyLabel.textContent = t('yearly');
    el.monthlySub.textContent = t('monthlySub');
    el.yearlySub.textContent = t('yearlySub');
    el.backBtn.textContent = t('back');
  }

  function setStatus(msg) {
    el.status.textContent = msg || '';
  }

  function setLoading(loading) {
    el.monthlyBtn.disabled = loading;
    el.yearlyBtn.disabled = loading;
    el.backBtn.disabled = loading;
  }

  async function getAccessToken() {
    const { data: sessionData } = await supabase.auth.getSession();
    let accessToken = sessionData?.session?.access_token || null;
    if (!accessToken) {
      const { data: refreshed } = await supabase.auth.refreshSession();
      accessToken = refreshed?.session?.access_token || null;
    }
    return accessToken;
  }

  async function startCheckout(plan) {
    setLoading(true);
    setStatus(t('preparing'));
    try {
      const locale = (navigator.language || 'en').toLowerCase();
      const currency = locale.startsWith('ja') ? 'jpy' : 'usd';
      const accessToken = extensionToken || await getAccessToken();

      const endpoint = accessToken ? 'create-checkout' : 'create-checkout-device';
      const headers = accessToken
        ? {
            'Content-Type': 'application/json',
            apikey: SUPABASE_ANON_KEY,
            Authorization: `Bearer ${accessToken}`,
          }
        : {
            'Content-Type': 'application/json',
            apikey: SUPABASE_ANON_KEY,
            Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
          };

      const body = accessToken
        ? { currency, plan, lang: APP_LANG, source, device_id: deviceId || null }
        : { device_id: deviceId, currency, plan, lang: APP_LANG, source };

      if (!accessToken && !deviceId) {
        setStatus(t('needLogin'));
        setLoading(false);
        return;
      }

      const res = await fetch(`${SUPABASE_URL}/functions/v1/${endpoint}`, {
        method: 'POST',
        headers,
        body: JSON.stringify(body),
      });

      const payload = await res.json().catch(() => ({}));
      if (!res.ok || !payload?.url) {
        const detail = payload?.error || `HTTP ${res.status}`;
        setStatus(`${t('failed')} ${detail}`);
        setLoading(false);
        return;
      }

      setStatus(t('opening'));
      window.location.href = payload.url;
    } catch (e) {
      setStatus(`${t('failed')} ${e?.message || e}`);
      setLoading(false);
    }
  }

  function backToApp() {
    if (source === 'extension') {
      window.close();
      return;
    }
    const qs = new URLSearchParams();
    qs.set('lang', APP_LANG);
    if (deviceId) qs.set('device', deviceId);
    window.location.href = `/${qs.toString() ? `?${qs.toString()}` : ''}`;
  }

  applyText();
  el.monthlyBtn.addEventListener('click', () => startCheckout('monthly'));
  el.yearlyBtn.addEventListener('click', () => startCheckout('yearly'));
  el.backBtn.addEventListener('click', backToApp);
})();
