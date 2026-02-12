# THE TOLL 要件定義（実装準拠）

最終更新: 2026-02-12  
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
- メール/パスワードでログイン・新規登録できる（Supabase Auth）。
- 認証状態変化を監視し、ログイン中のみセッション画面へ進める。

### FR-08 サブスク状態判定
- `profiles.subscription_status` を参照し、`active` のみ利用可能とする。
- `inactive` の場合はセッション開始導線を無効化する。

### FR-09 決済導線
- スマホアプリから Edge Function `create-checkout` を呼び出し、Stripe Checkout URLへ遷移する。
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

## 5. データ要件

### 5.1 Supabaseテーブル
- `squat_sessions`
  - `id: text (PK)`
  - `unlocked: boolean`
  - `created_at: timestamptz`
- `profiles`（実装参照）
  - `id`
  - `subscription_status` (`active`/`inactive`)
  - `stripe_customer_id`

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
  - `signInWithPassword`
  - `signUp`
  - `signOut`
- Supabase REST
  - `POST /rest/v1/squat_sessions`
  - `GET /rest/v1/squat_sessions?id=eq.<session>&select=unlocked`
- Supabase RPC
  - `unlock_session(session_id)`
- Supabase Edge Functions
  - `create-checkout`
  - `stripe-webhook`

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
- AC-06: `active` 会員のみセッション開始できる。
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

MVPの完了条件:
- AC-01〜AC-04, AC-06, AC-07 を満たすこと。

### 11.2 v1.1以降（拡張）
- FR-06 スケジュール制御
- FR-16 設定画面ガード（拡張）

v1.1の完了条件:
- AC-05 を満たすこと。

### 11.3 将来改善（v1.2+候補）
- 解除検知のポーリング最適化（サーバー負荷/遅延の改善）。
- 監視・運用強化（フロント/拡張/Edge Function のエラートラッキング）。
- 本番運用向け設定UI強化（ドメイン検証、設定バリデーション、監査ログ）。
