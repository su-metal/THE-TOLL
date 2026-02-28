# Chrome Web Store 提出タスク（THE TOLL）

最終更新日: 2026-02-18

## 1. パッケージ準備

- [ ] `chrome-extension/manifest.json` の `version` を最終版に更新
- [x] 配布ZIPに不要ファイルを含めない（`.git` / メモ / 開発用画像など）
- [x] アイコンが揃っていることを確認（16/32/48/128）
- [ ] ZIPをローカルで再展開し、構成が正しいことを確認

## 2. 権限と実装の整合

- [x] `permissions` / `host_permissions` が最小構成になっている
- [x] 要求権限の利用目的を説明できる
- [ ] ストア文言に未実装機能が含まれていない

### コピペ用: 要求権限の利用目的（審査/申請フォーム記載用）

```text
storage: ユーザー設定（ブロック対象サイト、回数、時間、言語設定など）およびロック状態を端末内に保存・読み出すために使用します。

identity: 拡張機能内でGoogleログイン（OAuth）を実行し、ユーザー認証を安全に完了するために使用します。

tabs: 開いているWebタブに対してロック状態の反映・解除、設定変更の通知、必要な画面（設定/連携ページ等）の表示を行うために使用します。

scripting: 対象タブにロックUI（CSS/スクリプト）を適用・再適用するために使用します。

host_permissions (https://*/*): ユーザーが閲覧中のHTTPSページ上で、ブロック判定およびロックUI表示を行うために使用します。file:// や chrome:// などにはアクセスしません。
```

### コピペ用: 審査向け補足（任意）

```text
本拡張機能は、権限を機能実装に必要な最小範囲に限定しています。

ホスト権限は https のみに限定しており、ロック機能の提供以外の目的でページ内容を取得・利用しません。
```

## 3. Free / Pro 仕様チェック

- [x] Freeは最大5サイトまでブロック
- [x] Freeはカスタムドメイン追加不可（Proのみ）
- [x] アダルトブロックはFree/Proどちらも利用可能
- [x] 種目選択（OVERRIDE EXERCISE）はProのみ
- [x] EN/JA説明文が現在仕様と一致している

## 4. スクリーンショット準備

- [x] すべて実機UIスクリーンショットを使用
- [x] `controls-overlay` など編集UIが写っていない
- [x] 画像サイズ・比率をCWS推奨に合わせる（例: 1280x800）
- [ ] Pro機能が写る画像は、誤解がない説明になっている
- [x] 5枚以上を用途別に用意（ロック画面 / QR / 運動 / 解除 / 設定）

## 5. ストア掲載文

- [x] Short Description（132文字以内）を確定
- [x] Detailed Description（英語）を確定
- [x] 必要なら日本語版説明文も確定
- [x] Free/Pro差分、トライアル条件を実装と一致させる

### コピペ用: Short Description（英語 / 132文字以内）

```text
Block distracting sites and unlock them with a quick phone workout. Scan a QR code, move, and get back to focused work.
```

### コピペ用: Short Description（日本語案）

```text
気が散るサイトを一時ブロック。スマホでQRを読み、短い運動を完了すると解除できる集中支援ツールです。
```

### コピペ用: Detailed Description（英語）

```text
THE TOLL helps you interrupt doomscrolling with a physical “reset.”

When a blocked site is opened, the extension shows a lock screen with a QR code. Scan it with your phone, complete a short exercise, and the page unlocks for a limited time.

How it works
- Open a blocked site on your computer
- Scan the QR code with your phone
- Complete the exercise challenge
- Return to your browser with temporary access restored

What you can control
- Block popular distracting sites
- Add your own domains (Pro)
- Optional adult-site blocking (available on Free and Pro)
- Lock schedules for when protection is active
- Unlock presets (reps + unlock duration)

Free plan
- Up to 5 blocked preset sites
- Squat challenge on mobile
- Fixed unlock presets (SHORT / LONG)
- Basic schedule mode (WEEKDAYS / EVERYDAY)

Pro / Trial features
- Push-up and sit-up challenges on mobile
- Custom domains
- Custom unlock durations (Custom A / B presets)
- Advanced schedule controls (editable times / presets / break window)

Account & trial
- Google sign-in is used for account and plan sync
- New accounts can start a 14-day free trial (no card required)
- After trial, a Pro subscription is required to continue Pro features

Notes
- Works on HTTPS pages
- Designed to help reduce distraction by adding a short movement step before access
```

### コピペ用: Detailed Description（日本語案）

```text
THE TOLL は、スマホでの短い運動を「通行料」にして、だらだら閲覧を中断するための拡張機能です。

ブロック対象サイトを開くと、PC側にQRコード付きのロック画面を表示します。スマホでQRを読み取り、短い運動を完了すると、一定時間だけサイトを再び閲覧できます。

使い方
- PCでブロック対象サイトを開く
- 表示されたQRコードをスマホで読み取る
- 運動チャレンジを完了する
- 一定時間、サイトの閲覧を再開

主な機能
- よく使われる誘惑サイトのブロック
- 独自ドメインの追加（Pro）
- アダルトサイトブロック（Free / Pro 共通）
- ロックスケジュール設定
- 解除プリセット（回数 + 解除時間）

Freeプラン
- ブロック可能なプリセットサイトは最大5件
- スマホ運動はスクワットのみ
- 解除プリセットは固定（SHORT / LONG）
- スケジュールは簡易モード（平日 / 毎日）

Pro / トライアル機能
- スマホ運動で腕立て伏せ / 腹筋に対応
- カスタムドメイン追加
- カスタム解除時間（Custom A / B）
- 高度なスケジュール設定（時間編集 / プリセット / 休憩時間）

アカウント / トライアル
- Googleログインでアカウント・プラン状態を同期
- 新規アカウントは14日間の無料トライアルを開始可能（カード登録不要）
- トライアル終了後、Pro機能の継続利用にはPro登録が必要です

補足
- HTTPSページで動作します
- 閲覧前に短い運動を挟むことで、集中の立て直しをサポートします
```

## 6. ポリシー・法務

- [x] Privacy Policy URLを用意（公開アクセス可）
- [x] データ利用申告（収集/保存/共有）を記入
- [x] サブスク・課金導線（Stripe）説明を記入
- [x] 単一目的（Single Purpose）を明確化

### コピペ用: 公開URL（候補）

```text
Privacy Policy: https://machinami0924.com/privacy
Terms of Service: https://machinami0924.com/terms
Support: https://machinami0924.com/support
Support Email: info@machinami0924.com
```

### コピペ用: Single Purpose（審査フォーム）

```text
THE TOLL enforces user-configured website locks in Chrome and unlocks access only after the user completes an exercise challenge through a linked smartphone flow.
```

### コピペ用: サブスク・課金導線（Stripe）説明

```text
THE TOLL offers an optional Pro subscription for advanced features (for example custom domains, advanced schedules, and additional exercise modes).

Billing and subscription management are handled by Stripe. Users can start a 14-day free trial (no card required for trial start), upgrade to Pro from the extension UI, and manage/cancel subscriptions via the Stripe Customer Portal.

After the trial ends, Pro features require an active subscription. Free features remain available.
```

### コピペ用: データ利用申告（収集 / 保存 / 共有）下書き

```text
Data collected / processed (for service functionality, account management, billing, and security operations):
- Authentication data (Google/Supabase account identifiers, email)
- Subscription/billing metadata (e.g., Stripe customer ID, subscription status, billing lifecycle metadata)
- User configuration data (blocked sites, schedules, feature settings, rep/unlock settings)
- Session coordination data (session IDs and unlock state for browser <-> smartphone flow)
- Operational logs (limited troubleshooting / abuse prevention)

Data sharing:
- Google (authentication)
- Stripe (billing and subscription management)
- Supabase (auth / database / backend)
- Hosting/infrastructure providers required to operate the service

We do not sell personal data.
We do not use collected data for advertising.
Payment card details are processed by Stripe and are not stored directly by THE TOLL.
```

### 事前確認メモ（提出前）

```text
- Privacy/Terms/Support URLが公開アクセス可能か実ブラウザで確認
- CWSのData useフォーム入力内容と上記文言の表現を一致させる
- 実装変更がある場合は docs/PRIVACY_POLICY.md とストア文言を再同期
```

## 7. 動作確認（提出前テスト）

- [ ] 新規インストールから初期設定まで通し確認
- [x] ロック表示 → QR読取 → 運動 → 解除 → 再ロック確認
- [x] Freeアカウントで種目選択が表示されないことを確認
- [x] Proアカウントで種目選択が表示されることを確認
- [x] ログアウト/再ログイン後のプラン反映を確認

## 8. Chrome Web Store 入力

- [ ] 拡張名 / カテゴリ / 言語 / サポート連絡先を入力
- [ ] スクリーンショットと説明文をアップロード
- [ ] プライバシーとデータ利用項目を入力
- [ ] 審査向け補足（必要な場合のみ）を記入
- [ ] 提出前に全項目を再確認してPublish

## 9. 提出後フォロー

- [ ] 審査ステータスを確認
- [ ] 指摘が来た場合の修正ブランチを用意
- [ ] 修正後スクリーンショット/文言の再整合を確認
