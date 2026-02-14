# THE TOLL 要件定義（実装準拠）

最終更新: 2026-02-13 (実装同期版)  
対象実装: `smartphone-app/`, `chrome-extension/`, `supabase/functions/`

## 1. 目的
Web閲覧を一時的にロックし、スマホで指定回数の運動を完了した場合のみ解除する。  
運動完了情報は Supabase を介して PC 側に連携する。

## 2. スコープ
- 対象:
  - Chrome拡張（ロック画面表示、設定、解除管理）
  - スマホWebアプリ（認証、サブスク状態判定、運動検知、解除送信）
  - Supabase（セッション管理、認証、課金連携）
- 非対象:
  - ネイティブアプリ化（iOS/Android）
  - Chrome 以外のブラウザ拡張対応

## 3. システム構成
- PC側: Chrome Extension (`chrome-extension/content.js`, `chrome-extension/popup.js`)
- スマホ側: Webアプリ/PWA (`smartphone-app/index.html`, `smartphone-app/app.js`, `smartphone-app/sw.js`)
- BaaS: Supabase Auth / PostgREST / RPC / Edge Functions
- 決済: Stripe（Checkout + Webhook）

## 4. 機能要件

### FR-01 ブロック対象判定
- 拡張は現在ドメインがブロック対象か判定する。
- 判定対象:
  - プリセットサイト（例: YouTube, X, Instagram, TikTok, Facebook, Netflix）
  - カスタムドメイン
  - アダルトサイト一括ブロック（`blocked_adult_sites.json`）

### FR-02 ロック画面表示
- ブロック対象サイトではフルスクリーン相当のオーバーレイを表示する。
- オーバーレイに以下を表示する:
  - セッションID
  - スマホアプリ用QRコード
  - 目標回数（設定値）

### FR-03 ロック中の再生抑止
- ロック中は `video/audio` を強制停止する。
- DOM 変化を監視し、新規メディア要素にも停止処理を適用する。

### FR-04 セッション登録・解除検知
- 拡張は `squat_sessions` にセッションを upsert する。
- 拡張は定期ポーリングで `unlocked=true` を検知したらロック解除する。
- 通信失敗時はリトライし、接続状態をUIに反映する。

### FR-05 解除猶予・再ロック
- 解除後は設定した猶予時間（分）だけアクセスを許可する。
- 猶予終了60秒前からカウントダウンHUDを表示する。
- 猶予満了時に再ロックする。

### FR-06 スケジュール制御
- 曜日・時間帯でロック有効期間を設定できる。
- スケジュール外は強制アンロック状態とする。

### FR-07 スマホ認証
- Google OAuthでログインできる（Supabase Auth）。
- 認証状態変化を監視し、ログイン中のみセッション画面へ進める。
- メール/パスワード認証は導線から廃止する（運用コスト削減方針）。

### FR-08 サブスク状態判定
- 判定は `profiles.subscription_status` と `profiles.trial_ends_at` で行う。
- `active` または `trial_ends_at > now` を Pro権限として扱う。
- `free` ユーザーは利用不可ではなく、制限付き利用とする（拡張設定項目を制限）。
- 拡張UIには常時プラン状態（FREE/TRIAL/PRO）を表示する。

### FR-09 決済導線
- スマホアプリまたは拡張から Edge Function `create-checkout` / `create-checkout-device` を呼び出し、Stripe Checkout URLへ遷移する。
- Webhook受信により `profiles.subscription_status` を `active/inactive` 更新する。

### FR-10 セッション開始
- 手入力またはQRスキャンでセッションIDを取得し開始できる。
- URLパラメータ `session`, `target` を受け取り可能とする。
- セッションID が `SET-` で始まる場合、目標回数を30回に固定する。

### FR-11 運動検知
- MediaPipe Pose を用いて以下3種目を検知する:
  - SQUAT
  - PUSH-UP
  - SIT-UP
- 種目はサイクル管理し、完了ごとに次種目へ進む。
- 目標回数到達時に完了画面へ遷移する。

### FR-12 カメラ・ガイダンス
- カメラ映像上に骨格描画を行う。
- 必要ランドマーク不足時はガイド文言を表示する。
- 種目に応じてキャリブレーションを行い、閾値判定でレップを加算する。

### FR-13 完了・解除信号送信
- 完了画面で `UNLOCK PC` を押すと RPC `unlock_session(session_id)` を呼び出す。
- 成否をUIで表示する。

### FR-14 セッション中断/再開
- セッション中断（EXIT）でカメラ停止・状態リセットする。
- 完了後は次セッションへ戻れる。

### FR-15 PWA/キャッシュ
- Service Worker を登録し、静的アセットをキャッシュする。
- 外部オリジン通信は Service Worker で横取りしない。
- 非GET通信はキャッシュしない。

### FR-16 設定画面ガード（拡張）
- 設定ロック解除ミッション（30回）用セッションを発行できる。
- 解除成功時のみ設定編集可能状態に遷移できる。

### FR-17 サブスク管理導線
- 課金済みユーザー向けに `Manage Subscription` 導線を提供する。
- Stripe Customer Portalに遷移し、解約/支払い方法変更を可能にする。
- 戻り先で状態を再同期し、`profiles.subscription_status` をUIに反映する。
- 解約予約時は `cancel_at_period_end` / `current_period_end` を表示し、期間終了までPROを維持する。

## 5. データ要件

### 5.1 Supabaseテーブル
- `squat_sessions`
  - `id: text (PK)`
  - `unlocked: boolean`
  - `created_at: timestamptz`
- `profiles`（実装参照）
  - `id`
  - `subscription_status` (`active`/`inactive`)
  - `plan_tier` (`free`/`pro`)
  - `trial_ends_at`
  - `trial_used`
  - `cancel_at_period_end`
  - `current_period_end`
  - `stripe_customer_id`
- `device_links`
  - `device_id: text`
  - `user_id: uuid`
  - `subscription_status`
  - `plan_tier`
  - `trial_ends_at`
  - `cancel_at_period_end`
  - `current_period_end`
  - `updated_at`
  - `last_seen_at`

### 5.2 クライアント保存
- `localStorage`（スマホ）:
  - `the_toll_cycle_index`
- `chrome.storage.local`（拡張）:
  - `toll_global_session_id`
  - `last_global_unlock_time`
  - `lock_duration_min`
  - `target_squat_count`
  - `blocked_sites`
  - `custom_blocked_sites`
  - `adult_block_enabled`
  - `lock_schedule`

## 6. 外部インターフェース要件
- Supabase Auth
  - `signInWithOAuth` (Google)
  - `signOut`
- Supabase REST
  - `POST /rest/v1/squat_sessions`
  - `GET /rest/v1/squat_sessions?id=eq.<session>&select=unlocked`
- Supabase RPC
  - `unlock_session(session_id)`
- Supabase Edge Functions
  - `create-checkout`
  - `create-checkout-device`
  - `stripe-webhook`
  - `create-customer-portal`

## 7. 非機能要件
- 対応環境:
  - PC: Chrome（拡張機能有効）
  - スマホ: 最新Safari/Chrome
- 通信:
  - HTTPS必須（カメラ利用・外部API連携のため）
- 性能:
  - ロック解除検知は2秒間隔以内で反映（ポーリング間隔準拠）
- 可用性:
  - Supabase停止時は認証/解除が失敗し、利用不能となる
- セキュリティ:
  - 本番では認証情報・鍵をソース直書きしない
  - CORS/Redirect URL を本番ドメインで厳密化する

## 8. 制約・既知リスク
- Chrome content script制約により、解除検知はRealtime(WebSocket)ではなくポーリング方式。
- ngrok 利用時はURL変動により拡張設定値更新が必要。
- Supabaseプロジェクトが `Paused` の場合、ログイン時 `Failed to fetch` が発生する。
- PWAキャッシュが古い場合、挙動差異が出るためハードリセット運用が必要な場合がある。

## 9. 受け入れ基準（最小）
- AC-01: ブロック対象サイトアクセス時にオーバーレイが表示される。
- AC-02: QRスキャンでスマホにセッションIDが入り、運動開始できる。
- AC-03: 目標回数達成後、`UNLOCK PC` でPCロックが解除される。
- AC-04: 設定した猶予時間経過後に自動再ロックされる。
- AC-05: スケジュール外時間帯ではロックされない。
- AC-06: `active` または有効トライアル中は制限なし、`free` は制限付きで利用できる。
- AC-07: Stripe決済完了で `subscription_status=active` に更新される。

## 10. リリース前必須項目
- 漏えいした鍵/トークンの失効と再発行。
- Supabase `Site URL` / `Redirect URLs` / Auth設定の本番化。
- RLS/Policy/RPC権限の本番見直し。
- 実機（iOS/Android）でログイン・カメラ・解除の通し試験。
- 本番固定ドメインへデプロイ（ngrok依存を解消）。

## 11. フェーズ分割（MVP / v1.1以降）

### 11.1 MVP必須（初回リリース）
- FR-01 ブロック対象判定
- FR-02 ロック画面表示
- FR-03 ロック中の再生抑止
- FR-04 セッション登録・解除検知
- FR-05 解除猶予・再ロック
- FR-07 スマホ認証
- FR-08 サブスク状態判定
- FR-09 決済導線
- FR-10 セッション開始
- FR-11 運動検知
- FR-12 カメラ・ガイダンス
- FR-13 完了・解除信号送信
- FR-14 セッション中断/再開
- FR-15 PWA/キャッシュ
 
補足:
- FR-07 は Google OAuth版で満たす（Email/Passwordは対象外）。

MVPの完了条件:
- AC-01〜AC-04, AC-06, AC-07 を満たすこと。

### 11.2 v1.1以降（拡張）
- FR-06 スケジュール制御
- FR-16 設定画面ガード（拡張）
- FR-17 サブスク管理導線

v1.1の完了条件:
- AC-05 を満たすこと。
- 解約/支払い方法変更をユーザー自身で実行できること。

### 11.3 将来改善（v1.2+候補）
- 解除検知のポーリング最適化（サーバー負荷/遅延の改善）。
- 監視・運用強化（フロント/拡張/Edge Function のエラートラッキング）。
- 本番運用向け設定UI強化（ドメイン検証、設定バリデーション、監査ログ）。

## 12. 現在の進捗ステータス

### 12.1 実施済み
- FR-01 ブロック対象判定
- FR-02 ロック画面表示
- FR-03 ロック中の再生抑止
- FR-04 セッション登録・解除検知
- FR-05 解除猶予・再ロック
- FR-07 スマホ認証（Google OAuth導線へ切替）
- FR-08 サブスク状態判定
- FR-09 決済導線（Checkout起動・Webhook連携）
- FR-10 セッション開始
- FR-11 運動検知
- FR-12 カメラ・ガイダンス
- FR-13 完了・解除信号送信
- FR-14 セッション中断/再開
- FR-15 PWA/キャッシュ

### 12.2 進行中
- FR-09 決済導線の最終安定化（本番モード最終確認）
- Webhook本番検証（`customer.subscription.deleted` のライブ最終確認）

### 12.3 未着手/残タスク
- `unlock_session` 側の paid-user 強制チェック（サーバー側最終ガード）
- 決済成功/キャンセル戻り時の明示UI

## 13. 完成までのフェーズ定義（実行順）

### Phase A: Billing Hardening
- 目的: 課金導線を本番運用可能な品質にする。
- 作業:
  - Stripe/Supabase Secrets最終確定
  - `create-checkout`/`stripe-webhook` の本番想定テスト
  - 決済後リダイレクト体験の整備
- 完了条件:
  - テスト決済成功で `subscription_status=active` に更新
  - 解約イベントで `inactive` へ戻る

### Phase B: Account Management
- 目的: ユーザー自身が契約を管理できる状態にする。
- 作業:
  - `create-customer-portal` 実装
  - `Manage Subscription` UI追加
- 完了条件:
  - 解約/支払い方法変更がセルフサービスで完了する

### Phase C: Server-Side Enforcement
- 目的: クライアント改ざんに依存しない権限制御を確立する。
- 作業:
  - `unlock_session` 実行時に `active` 会員チェックを強制
  - 追加RLS/権限見直し
- 完了条件:
  - 非課金アカウントではサーバー側で解除不可

### Phase D: Release Prep
- 目的: 提出・運用を含めたリリース実施。
- 作業:
  - ストア提出物（説明、権限理由、ポリシー）
  - 実機通し試験（iOS/Android）
  - 運用Runbook最終化
- 完了条件:
  - リリース判定項目を全通過

## 14. Auto Progress Snapshot

<!-- AUTO_STATUS_START -->
Last auto update: 2026-02-13

| Phase | Completed | Total | Progress | Status |
|---|---:|---:|---:|---|
| A | 2 | 4 | 50% | in_progress |
| B | 2 | 2 | 100% | done |
| C | 0 | 2 | 0% | pending |
| D | 1 | 3 | 33% | in_progress |

Overall progress: **5 / 11 (45%)**
<!-- AUTO_STATUS_END -->

## 15. Phase Task Checklist (Automation Source)

このチェックリストを更新すると、GitHub Actions が `14. Auto Progress Snapshot` を自動更新します。

<!-- AUTO_TASKS_START -->
### Phase A (Billing Hardening)
- [ ] A-01 Secrets整備（Stripe/Supabase）
- [x] A-02 create-checkout / stripe-webhook本番想定テスト
- [ ] A-03 決済後リダイレクト体験整備
- [x] A-04 subscription_status遷移の通し確認

### Phase B (Account Management)
- [x] B-01 create-customer-portal 実装
- [x] B-02 Manage Subscription UI実装

### Phase C (Server-Side Enforcement)
- [ ] C-01 unlock_sessionでactive会員チェック強制
- [ ] C-02 RLS/権限の最終見直し

### Phase D (Release Prep)
- [ ] D-01 ストア提出物作成（説明・権限理由・ポリシー）
- [ ] D-02 実機通し試験（iOS/Android）
- [x] D-03 運用Runbook最終化
<!-- AUTO_TASKS_END -->
