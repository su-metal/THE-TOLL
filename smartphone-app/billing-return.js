(function() {
  'use strict';

  const params = new URLSearchParams(window.location.search);
  function detectUiLanguage() {
    const qLang = (params.get('lang') || '').trim().toLowerCase();
    if (qLang === 'ja' || qLang === 'en') return qLang;
    const langs = Array.isArray(navigator.languages) ? navigator.languages : [];
    const firstLocale = (langs[0] || navigator.language || '').toLowerCase();
    return firstLocale.startsWith('ja') ? 'ja' : 'en';
  }
  const lang = detectUiLanguage();
  const checkout = (params.get('checkout') || '').toLowerCase();
  const portal = (params.get('portal') || '').toLowerCase();
  const source = (params.get('source') || '').toLowerCase();
  const device = (params.get('device') || '').trim();

  const I18N = {
    en: {
      title: 'THE TOLL - Billing Result',
      subtitle: 'BILLING RESULT',
      resultTitle: 'RESULT',
      success: 'Payment completed successfully.',
      cancel: 'Payment was canceled.',
      unknown: 'Billing result could not be determined.',
      portalReturn: 'Subscription portal has been closed.',
      successDetail: 'PRO access should be reflected shortly. You can close this window and return to THE TOLL settings.',
      autoReturnSuccess: 'Auto-returning to settings in 3 seconds...',
      cancelDetail: 'No charge was completed. You can close this window or return to pricing.',
      portalReturnDetail: 'Your subscription settings were updated. You can close this window and return to the extension.',
      unknownDetail: 'We could not read the final billing state. Please check your Stripe receipts or open pricing again.',
      closeHint: 'Closing this window...',
      closeManual: 'If this window does not close automatically, close it manually.',
      close: 'CLOSE',
      closeAndReturn: 'CLOSE WINDOW',
      backToPricing: 'BACK TO PRICING',
      returningPricing: 'Returning to pricing page...',
      footerMarquee: 'PAY THE TOLL // STAY IN FOCUS // PAY THE TOLL // STAY IN FOCUS // PAY THE TOLL // STAY IN FOCUS //',
      footerCopy: '© 2026 THE TOLL // SYSTEM ACTIVE // VER 1.0',
    },
    ja: {
      title: 'THE TOLL - 決済結果',
      subtitle: '決済結果',
      resultTitle: '結果',
      success: '決済が完了しました。',
      cancel: '決済はキャンセルされました。',
      unknown: '決済結果を判定できませんでした。',
      portalReturn: 'サブスクリプション管理画面を閉じました。',
      successDetail: 'PRO状態への反映に数秒かかる場合があります。この画面を閉じて設定画面に戻ってください。',
      autoReturnSuccess: '3秒後に設定画面へ自動で戻ります...',
      cancelDetail: '請求は発生していません。この画面を閉じるか、料金ページに戻れます。',
      portalReturnDetail: 'サブスク設定の変更を受け付けました。この画面を閉じて拡張機能に戻ってください。',
      unknownDetail: '最終状態を取得できませんでした。Stripeのレシート確認、または料金ページを再度開いてください。',
      closeHint: 'ウィンドウを閉じています...',
      closeManual: '自動で閉じない場合は手動で閉じてください。',
      close: '閉じる',
      closeAndReturn: 'このウィンドウを閉じる',
      backToPricing: '料金ページに戻る',
      returningPricing: '料金プランページへ戻ります...',
      footerMarquee: '集中モード // 決済完了 // 集中モード // 決済完了 // 集中モード // 決済完了 //',
      footerCopy: '© 2026 THE TOLL // SYSTEM ACTIVE // VER 1.0',
    }
  };

  const t = (k) => (I18N[lang] && I18N[lang][k]) || I18N.en[k] || k;

  const subtitleEl = document.getElementById('subtitle');
  const resultSectionTitleEl = document.getElementById('result-section-title');
  const messageEl = document.getElementById('message');
  const subMessageEl = document.getElementById('sub-message');
  const closeBtn = document.getElementById('close-btn');
  const footerMarqueeEl = document.getElementById('footer-marquee');
  const footerCopyEl = document.getElementById('footer-copy');

  function getMessage() {
    if (portal === 'return') return t('portalReturn');
    if (checkout === 'success') return t('success');
    if (checkout === 'cancel') return t('cancel');
    return t('unknown');
  }

  function getDetailMessage() {
    if (portal === 'return') return t('portalReturnDetail');
    if (checkout === 'success') return t('successDetail');
    if (checkout === 'cancel') return t('cancelDetail');
    return t('unknownDetail');
  }

  const hasBillingSignal = !!checkout || !!portal;

  function getPricingUrl() {
    const qs = new URLSearchParams();
    qs.set('lang', lang);
    if (source) qs.set('source', source);
    if (device) qs.set('device', device);
    return `pricing.html?${qs.toString()}`;
  }

  function goToPricing() {
    subMessageEl.textContent = t('returningPricing');
    window.location.href = getPricingUrl();
  }

  function tryClose() {
    if (source === 'extension') {
      subMessageEl.textContent = t('closeHint');
      window.close();
      setTimeout(() => {
        if (!document.hidden) {
          subMessageEl.textContent = t('closeManual');
          closeBtn.textContent = t('backToPricing');
          closeBtn.onclick = (ev) => {
            ev.preventDefault();
            goToPricing();
          };
        }
      }, 500);
      return;
    }
    goToPricing();
  }

  document.documentElement.lang = lang;
  document.title = t('title');
  subtitleEl.textContent = t('subtitle');
  if (resultSectionTitleEl) resultSectionTitleEl.textContent = t('resultTitle');
  messageEl.textContent = getMessage();
  subMessageEl.textContent = getDetailMessage();
  closeBtn.textContent = source === 'extension' ? t('closeAndReturn') : t('backToPricing');
  if (footerMarqueeEl) footerMarqueeEl.textContent = t('footerMarquee');
  if (footerCopyEl) footerCopyEl.textContent = t('footerCopy');
  closeBtn.addEventListener('click', tryClose);

  if (source === 'extension' && checkout === 'success') {
    subMessageEl.textContent = t('autoReturnSuccess');
    setTimeout(() => {
      tryClose();
    }, 3000);
  }

  if (source !== 'extension' && !hasBillingSignal) {
    setTimeout(tryClose, 1200);
  }
})();
