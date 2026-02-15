(function() {
  'use strict';

  const params = new URLSearchParams(window.location.search);
  const lang = params.get('lang') === 'ja' ? 'ja' : 'en';
  const checkout = (params.get('checkout') || '').toLowerCase();
  const portal = (params.get('portal') || '').toLowerCase();

  const I18N = {
    en: {
      title: 'THE TOLL - Billing Result',
      subtitle: 'BILLING RESULT',
      success: 'Payment completed successfully.',
      cancel: 'Payment was canceled.',
      unknown: 'Billing result could not be determined.',
      portalReturn: 'Subscription portal has been closed.',
      closing: 'This tab will close automatically. If it stays open, close it and return to the extension popup.',
      close: 'CLOSE',
    },
    ja: {
      title: 'THE TOLL - 決済結果',
      subtitle: '決済結果',
      success: '決済が完了しました。',
      cancel: '決済はキャンセルされました。',
      unknown: '決済結果を判定できませんでした。',
      portalReturn: 'サブスクリプション管理画面を閉じました。',
      closing: 'このタブは自動で閉じます。閉じない場合は手動で閉じて拡張ポップアップに戻ってください。',
      close: '閉じる',
    }
  };

  const t = (k) => (I18N[lang] && I18N[lang][k]) || I18N.en[k] || k;

  const subtitleEl = document.getElementById('subtitle');
  const messageEl = document.getElementById('message');
  const subMessageEl = document.getElementById('sub-message');
  const closeBtn = document.getElementById('close-btn');

  function getMessage() {
    if (portal === 'return') return t('portalReturn');
    if (checkout === 'success') return t('success');
    if (checkout === 'cancel') return t('cancel');
    return t('unknown');
  }

  function tryClose() {
    window.close();
    setTimeout(() => {
      // If the browser blocks close(), keep the fallback UI visible.
      subMessageEl.textContent = t('closing');
    }, 300);
  }

  document.documentElement.lang = lang;
  document.title = t('title');
  subtitleEl.textContent = t('subtitle');
  messageEl.textContent = getMessage();
  subMessageEl.textContent = t('closing');
  closeBtn.textContent = t('close');
  closeBtn.addEventListener('click', tryClose);

  setTimeout(tryClose, 900);
})();
