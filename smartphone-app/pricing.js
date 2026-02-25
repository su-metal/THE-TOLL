(function() {
  'use strict';

  const SUPABASE_URL = 'https://qcnzleiyekbgsiyomwin.supabase.co';
  const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFjbnpsZWl5ZWtiZ3NpeW9td2luIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njg0Mjk2NzMsImV4cCI6MjA4NDAwNTY3M30.NlGUfxDPzMgtu_J0vX7FMe-ikxafboGh5GMr-tsaLfI';

  const params = new URLSearchParams(window.location.search);
  function detectUiLanguage() {
    const qLang = (params.get('lang') || '').trim().toLowerCase();
    if (qLang === 'ja' || qLang === 'en') return qLang;
    const langs = Array.isArray(navigator.languages) ? navigator.languages : [];
    const firstLocale = (langs[0] || navigator.language || '').toLowerCase();
    return firstLocale.startsWith('ja') ? 'ja' : 'en';
  }
  let APP_LANG = detectUiLanguage();
  const currencyParam = (params.get('currency') || '').trim().toLowerCase();
  const deviceId = (params.get('device') || '').trim();
  const source = (params.get('source') || 'app').trim();
  const checkout = (params.get('checkout') || '').trim().toLowerCase();
  const portal = (params.get('portal') || '').trim().toLowerCase();
  const extensionToken = (params.get('ext_token') || '').trim();

  if (extensionToken) {
    params.delete('ext_token');
    const clean = `${window.location.pathname}${params.toString() ? `?${params.toString()}` : ''}`;
    window.history.replaceState({}, '', clean);
  }

  const I18N = {
    en: {
      title: 'THE TOLL - Pricing',
      subtitle: 'Choose Your Plan',
      protocolBadge: 'PAYMENT PROTOCOL // 04',
      headline: 'Build focus and movement into every work session.',
      subcopy: 'Choose a plan and continue to secure Stripe checkout.',
      trialNote: '14-day free trial available for new accounts.',
      secureNote: 'Secure checkout powered by Stripe.',
      currencyChip: 'Billing currency: {currency}',
      yearlyBadge: 'Best Value',
      yearlyLabel: 'Yearly Plan',
      monthlyLabel: 'Monthly Plan',
      yearlySub: 'Equivalent to {value} per month',
      monthlySub: 'Flexible billing. Cancel anytime.',
      yearlyCta: 'Start yearly',
      monthlyCta: 'Start monthly',
      monthlyFeature2: 'Core Features',
      monthlyFeature3: 'Standard Support',
      yearlySavePct: 'Save {pct}% vs monthly',
      yearlySaveAmount: 'Save {amount} vs monthly total',
      yearlyFeature3: 'Priority Support',
      compareTitle: 'Free vs Pro',
      featureCol: 'Feature',
      freeCol: 'Free',
      proCol: 'Pro',
      compareRows: [
        { feature: 'Blocked sites', free: 'Up to 5', pro: 'Up to 50' },
        { feature: 'Grace period', free: 'Choose 10 or 20 min preset', pro: 'Custom (10-30 min)' },
        { feature: 'Exercise mode', free: 'Squat only', pro: 'Choose exercise' },
        { feature: 'Schedule', free: 'Simple templates', pro: 'Advanced control' },
        { feature: 'Adult block', free: 'Available', pro: 'Available' }
      ],
      trustLines: [
        'Designed for remote workers who need structure.',
        'No hidden fees. Manage subscription anytime.'
      ],
      back: 'Back',
      opening: 'Opening Stripe checkout...',
      preparing: 'Preparing checkout...',
      failed: 'Failed to prepare checkout.',
      checkoutSuccess: 'Payment completed successfully.',
      checkoutCancel: 'Payment was canceled.',
      portalReturn: 'Returned from subscription portal.',
      needLogin: 'Please log in and link your account first.',
      closeWindowHint: 'Please close this window from the window close button.',
      footerMarquee: 'START WHEN READY // START WHEN READY // START WHEN READY // START WHEN READY // START WHEN READY // START WHEN READY // START WHEN READY // START WHEN READY //',
      footerCtaLine1: 'UNLEASH',
      footerCtaMini1: 'Unlock it,',
      footerCtaLine2: 'YOUR',
      footerCtaMini2: 'focus.',
      footerCopy: '© 2026 THE TOLL // SYSTEM ACTIVE // VER 1.0'
    },
    ja: {
      title: 'THE TOLL - 料金プラン',
      subtitle: 'プランを選択',
      protocolBadge: '決済プロトコル // 04',
      headline: '仕事中の集中力と運動習慣を、同時に作る。',
      subcopy: 'プランを選択すると、Stripeの安全な決済に進みます。',
      trialNote: '新規アカウントは14日間の無料体験を利用できます。',
      secureNote: 'Stripeの安全な決済を利用しています。',
      currencyChip: '請求通貨: {currency}',
      yearlyBadge: 'おすすめ',
      yearlyLabel: '年額プラン',
      monthlyLabel: '月額プラン',
      yearlySub: '月換算 {value}',
      monthlySub: '柔軟な月払い。いつでも解約可能です。',
      yearlyCta: '年額で始める',
      monthlyCta: '月額で始める',
      monthlyFeature2: '基本機能',
      monthlyFeature3: '標準サポート',
      yearlySavePct: '月額合計より {pct}% お得',
      yearlySaveAmount: '月額合計より {amount} お得',
      yearlyFeature3: '優先サポート',
      compareTitle: 'FREE と PRO の比較',
      featureCol: '機能',
      freeCol: 'FREE',
      proCol: 'PRO',
      compareRows: [
        { feature: 'ブロックサイト数', free: '最大5件', pro: '最大50件' },
        { feature: '解放時間', free: '10分/20分から選択（プリセット）', pro: '自由設定（10〜30分）' },
        { feature: '運動モード', free: 'スクワット固定', pro: '種目選択可' },
        { feature: 'スケジュール', free: '簡易テンプレ', pro: '詳細設定' },
        { feature: 'アダルトブロック', free: '利用可', pro: '利用可' }
      ],
      trustLines: [
        '在宅ワーカー向けに、続けやすさを重視して設計。',
        '隠れた手数料なし。いつでもサブスク管理可能。'
      ],
      back: '戻る',
      opening: 'Stripe決済画面を開いています...',
      preparing: '決済を準備しています...',
      failed: '決済の準備に失敗しました。',
      checkoutSuccess: '決済が完了しました。',
      checkoutCancel: '決済はキャンセルされました。',
      portalReturn: 'サブスクリプション管理画面から戻りました。',
      needLogin: '先にログインとデバイス連携を行ってください。',
      closeWindowHint: 'このウィンドウを閉じるボタンで閉じてください。',
      footerMarquee: '準備できたら始める // 準備できたら始める // 準備できたら始める // 準備できたら始める // 準備できたら始める // 準備できたら始める // 準備できたら始める // 準備できたら始める //',
      footerCtaLine1: '解き放つ',
      footerCtaMini1: 'さあ、',
      footerCtaLine2: 'あなたの',
      footerCtaMini2: '集中力。',
      footerCopy: '© 2026 THE TOLL // SYSTEM ACTIVE // VER 1.0'
    }
  };

  const PRICE_BOOK = {
    usd: { monthly: 4.99, yearly: 49, currency: 'USD' },
    jpy: { monthly: 490, yearly: 4980, currency: 'JPY' }
  };

  const el = {
    subtitle: document.getElementById('subtitle'),
    headline: document.getElementById('headline'),
    subcopy: document.getElementById('subcopy'),
    trialNote: document.getElementById('trial-note'),
    secureNote: document.getElementById('secure-note'),
    currencyChip: document.getElementById('currency-chip'),
    yearlyBtn: document.getElementById('yearly-btn'),
    monthlyBtn: document.getElementById('monthly-btn'),
    yearlyBadge: document.getElementById('yearly-badge'),
    yearlyLabel: document.getElementById('yearly-label'),
    monthlyLabel: document.getElementById('monthly-label'),
    yearlyPrice: document.getElementById('yearly-price'),
    monthlyPrice: document.getElementById('monthly-price'),
    yearlySub: document.getElementById('yearly-sub'),
    monthlySub: document.getElementById('monthly-sub'),
    yearlySave: document.getElementById('yearly-save'),
    yearlyCta: document.getElementById('yearly-cta'),
    monthlyCta: document.getElementById('monthly-cta'),
    compareTitle: document.getElementById('compare-title'),
    featureColTitle: document.getElementById('feature-col-title'),
    freeColTitle: document.getElementById('free-col-title'),
    proColTitle: document.getElementById('pro-col-title'),
    compareBody: document.getElementById('compare-body'),
    trustRow: document.getElementById('trust-row'),
    status: document.getElementById('status-msg'),
    backBtn: document.getElementById('back-btn'),
    monthlyFeature2: document.getElementById('monthly-feature-2'),
    monthlyFeature3: document.getElementById('monthly-feature-3'),
    yearlyFeature3: document.getElementById('yearly-feature-3'),
    footerMarquee: document.getElementById('footer-marquee'),
    footerCtaLine1: document.getElementById('footer-cta-line-1'),
    footerCtaMini1: document.getElementById('footer-cta-mini-1'),
    footerCtaLine2: document.getElementById('footer-cta-line-2'),
    footerCtaMini2: document.getElementById('footer-cta-mini-2'),
    footerCopy: document.getElementById('footer-copy'),
    langEnBtn: document.getElementById('lang-en-btn'),
    langJaBtn: document.getElementById('lang-ja-btn'),
  };

  const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

  function t(key, params = {}) {
    let template = (I18N[APP_LANG] && I18N[APP_LANG][key]) || I18N.en[key] || key;
    if (typeof template !== 'string') return template;
    Object.entries(params).forEach(([k, v]) => {
      template = template.replace(new RegExp(`\\{${k}\\}`, 'g'), String(v));
    });
    return template;
  }

  function detectCurrencyHint() {
    if (currencyParam === 'jpy' || currencyParam === 'usd') return currencyParam;
    const langs = Array.isArray(navigator.languages) ? navigator.languages : [];
    const firstLocale = (langs[0] || navigator.language || '').toLowerCase();
    const tz = (Intl.DateTimeFormat().resolvedOptions().timeZone || '').toLowerCase();
    const isJapan = firstLocale.includes('ja') || firstLocale.includes('-jp') || tz === 'asia/tokyo';
    return isJapan ? 'jpy' : 'usd';
  }

  function formatMoney(amount, currency) {
    const locale = APP_LANG === 'ja' ? 'ja-JP' : 'en-US';
    return new Intl.NumberFormat(locale, { style: 'currency', currency, maximumFractionDigits: currency === 'JPY' ? 0 : 2 }).format(amount);
  }

  function formatPerMonth(monthly, yearly, currency) {
    const perMonth = yearly / 12;
    const raw = formatMoney(perMonth, currency);
    return currency === 'JPY' ? raw.replace('.00', '') : raw;
  }

  function getSaveText(pricing) {
    const monthlyTotal = pricing.monthly * 12;
    const saved = Math.max(0, monthlyTotal - pricing.yearly);
    const pct = monthlyTotal > 0 ? Math.floor((saved / monthlyTotal) * 100) : 0;
    if (pct >= 5) {
      return t('yearlySavePct', { pct });
    }
    return t('yearlySaveAmount', { amount: formatMoney(saved, pricing.currency) });
  }

  function renderComparison() {
    const rows = t('compareRows');
    if (!el.compareBody || !Array.isArray(rows)) return;
    el.compareBody.innerHTML = '';
    rows.forEach((row) => {
      const tr = document.createElement('tr');
      const tdFeature = document.createElement('td');
      const tdFree = document.createElement('td');
      const tdPro = document.createElement('td');
      tdFeature.textContent = row.feature;
      tdFree.textContent = row.free;
      tdPro.textContent = row.pro;
      tr.appendChild(tdFeature);
      tr.appendChild(tdFree);
      tr.appendChild(tdPro);
      el.compareBody.appendChild(tr);
    });
  }

  function renderTrust() {
    const lines = t('trustLines');
    if (!el.trustRow || !Array.isArray(lines)) return;
    el.trustRow.innerHTML = '';
    lines.forEach((line) => {
      const p = document.createElement('p');
      p.textContent = line;
      el.trustRow.appendChild(p);
    });
  }

  function applyTextAndPrice() {
    const currencyKey = detectCurrencyHint();
    const pricing = PRICE_BOOK[currencyKey] || PRICE_BOOK.usd;

    document.documentElement.lang = APP_LANG;
    document.title = t('title');
    el.subtitle.textContent = t('protocolBadge');
    el.headline.textContent = t('headline');
    el.subcopy.textContent = t('subcopy');
    el.trialNote.textContent = t('trialNote');
    el.secureNote.textContent = t('secureNote');
    el.currencyChip.textContent = t('currencyChip', { currency: pricing.currency });

    el.yearlyBadge.textContent = t('yearlyBadge');
    el.yearlyLabel.textContent = t('yearlyLabel');
    el.monthlyLabel.textContent = t('monthlyLabel');

    const yearlyPriceText = `${formatMoney(pricing.yearly, pricing.currency)} / ${APP_LANG === 'ja' ? '年' : 'year'}`;
    const monthlyPriceText = `${formatMoney(pricing.monthly, pricing.currency)} / ${APP_LANG === 'ja' ? '月' : 'month'}`;
    el.yearlyPrice.textContent = yearlyPriceText;
    el.monthlyPrice.textContent = monthlyPriceText;

    const perMonthText = formatPerMonth(pricing.monthly, pricing.yearly, pricing.currency);
    el.yearlySub.textContent = t('yearlySub', { value: perMonthText });
    el.monthlySub.textContent = t('monthlySub');
    el.yearlySave.textContent = getSaveText(pricing);

    el.yearlyCta.textContent = t('yearlyCta');
    el.monthlyCta.textContent = t('monthlyCta');
    el.monthlyFeature2.textContent = t('monthlyFeature2');
    el.monthlyFeature3.textContent = t('monthlyFeature3');
    el.yearlyFeature3.textContent = t('yearlyFeature3');

    el.compareTitle.textContent = t('compareTitle');
    el.featureColTitle.textContent = t('featureCol');
    el.freeColTitle.textContent = t('freeCol');
    el.proColTitle.textContent = t('proCol');
    renderComparison();
    renderTrust();

    el.backBtn.textContent = t('back');

    el.footerMarquee.textContent = t('footerMarquee');
    el.footerCtaLine1.textContent = t('footerCtaLine1');
    el.footerCtaMini1.textContent = t('footerCtaMini1');
    el.footerCtaLine2.textContent = t('footerCtaLine2');
    el.footerCtaMini2.textContent = t('footerCtaMini2');
    el.footerCopy.textContent = t('footerCopy');

    if (el.langEnBtn) el.langEnBtn.classList.toggle('active', APP_LANG === 'en');
    if (el.langJaBtn) el.langJaBtn.classList.toggle('active', APP_LANG === 'ja');
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
      const currency = detectCurrencyHint();
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
        ? { plan, lang: APP_LANG, source, device_id: deviceId || null, currency }
        : { device_id: deviceId, plan, lang: APP_LANG, source, currency };

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
    window.close();
    setTimeout(() => {
      if (!document.hidden) {
        window.history.back();
      }
    }, 200);
  }

  function setLanguage(lang) {
    if (lang !== 'ja' && lang !== 'en') return;
    APP_LANG = lang;
    params.set('lang', lang);
    window.history.replaceState({}, '', `${window.location.pathname}?${params.toString()}`);
    applyTextAndPrice();
  }

  applyTextAndPrice();
  if (checkout === 'success') setStatus(t('checkoutSuccess'));
  else if (checkout === 'cancel') setStatus(t('checkoutCancel'));
  else if (portal === 'return') setStatus(t('portalReturn'));

  if (checkout || portal) {
    params.delete('checkout');
    params.delete('portal');
    const clean = `${window.location.pathname}${params.toString() ? `?${params.toString()}` : ''}`;
    window.history.replaceState({}, '', clean);
  }

  el.monthlyBtn.addEventListener('click', () => startCheckout('monthly'));
  el.yearlyBtn.addEventListener('click', () => startCheckout('yearly'));
  el.backBtn.addEventListener('click', backToApp);
  if (el.langEnBtn) el.langEnBtn.addEventListener('click', () => setLanguage('en'));
  if (el.langJaBtn) el.langJaBtn.addEventListener('click', () => setLanguage('ja'));
})();
