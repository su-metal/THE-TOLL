const BILLING_RETURN_HOST = "smartphone-app-pi.vercel.app";
const EXTENSION_BILLING_PATHS = new Set([
  "/billing-return.html",
  "/pricing.html",
]);

function isExtensionBillingReturn(urlString) {
  try {
    const u = new URL(urlString);
    if (u.hostname !== BILLING_RETURN_HOST) return false;
    if (!EXTENSION_BILLING_PATHS.has(u.pathname)) return false;
    const source = (u.searchParams.get("source") || "").toLowerCase();
    return source === "extension";
  } catch (_) {
    return false;
  }
}

function buildBillingFeedback(urlString) {
  try {
    const u = new URL(urlString);
    const checkout = (u.searchParams.get("checkout") || "").toLowerCase();
    const portal = (u.searchParams.get("portal") || "").toLowerCase();
    const lang = (u.searchParams.get("lang") || "en").toLowerCase();
    const ja = lang === "ja";

    if (checkout === "success") {
      return {
        message: ja
          ? "決済が完了しました。プラン反映まで数秒お待ちください。"
          : "Payment completed. Plan will refresh shortly.",
        at: Date.now(),
      };
    }
    if (checkout === "cancel") {
      return {
        message: ja ? "決済はキャンセルされました。" : "Payment was canceled.",
        at: Date.now(),
      };
    }
    if (portal === "return") {
      return {
        message: ja ? "サブスク管理画面を閉じました。" : "Subscription portal closed.",
        at: Date.now(),
      };
    }
    return null;
  } catch (_) {
    return null;
  }
}

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  const url = changeInfo.url || (changeInfo.status === "complete" ? tab?.url : "");
  if (!url) return;
  if (!isExtensionBillingReturn(url)) return;
  const feedback = buildBillingFeedback(url);
  if (!feedback) return;
  chrome.storage.local.set({ toll_billing_feedback: feedback }, () => {
    chrome.runtime.sendMessage({ type: "TOLL_BILLING_FEEDBACK", feedback }, () => void chrome.runtime.lastError);
    chrome.tabs.remove(tabId, () => void chrome.runtime.lastError);
  });
});
