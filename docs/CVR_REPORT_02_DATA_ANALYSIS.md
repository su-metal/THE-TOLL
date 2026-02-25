# THE TOLL: CVR改善データ分析設計レポート

**作成日**: 2026-02-15
**担当**: データアナリスト
**対象プロダクト**: THE TOLL (Chrome拡張 + スマホPWA)
**目的**: コンバージョン最適化のための計測・分析基盤設計

---

## 1. コンバージョンファネルの定義

### 1.1 ファネル全体像

```
[インストール]
     ↓
[初回起動・設定]
     ↓
[初回ロック遭遇]
     ↓
[初回運動完了]
     ↓
[習慣化 (7日間アクティブ利用)]
     ↓
[Free制限への到達 (ペイウォール遭遇)]
     ↓
[Checkout開始]
     ↓
[決済完了 (Pro転換)]
     ↓
[Pro継続 (リテンション)]
```

### 1.2 各ステージの定義とKPI

#### Stage 0: インストール (INSTALL)
**定義**: Chrome Web Store から拡張機能をインストールし、popup を最初に開いた

| KPI | 説明 | 計測方法 |
|-----|------|----------|
| インストール数 (DAY) | 日次インストール数 | Chrome Web Store Console |
| インストール→初回popup率 | インストール後7日以内に popup を開いた割合 | `extension_opened` イベント |
| 離脱率 (インストール→未使用) | インストールしたが1度も使用しなかった割合 | 7日間 `extension_opened` なし |

**ターゲット指標**: インストール→初回popup率 > 70%

---

#### Stage 1: 初回起動・設定 (ONBOARDING)
**定義**: popup を開き、基本設定 (ブロックサイト確認・ログイン) を完了した

| KPI | 説明 | 計測方法 |
|-----|------|----------|
| ログイン完了率 | popup を開いた後 Google ログインを完了した割合 | `login_completed` イベント |
| ブロックサイト設定率 | デフォルト以外のサイト設定を行った割合 | `blocked_sites_updated` イベント |
| 初回起動→設定完了 (24h以内) | 24時間以内に設定を1つ以上変更した割合 | 各設定変更イベント |

**ターゲット指標**: ログイン完了率 > 50%

---

#### Stage 2: 初回ロック遭遇 (FIRST_LOCK)
**定義**: ブロック対象サイトにアクセスし、ロックオーバーレイを初めて体験した

| KPI | 説明 | 計測方法 |
|-----|------|----------|
| 初回ロック到達率 | インストール後7日以内に初めてロックに遭遇した割合 | `lock_encountered` (count=1) |
| 中央値時間 (インストール→初回ロック) | インストールから初回ロック遭遇までの時間 | タイムスタンプ差分 |
| ロック画面離脱率 | ロック遭遇後すぐにブラウザを閉じた/別タブに移動した割合 | セッション追跡 |

**ターゲット指標**: 初回ロック到達率 > 60%

---

#### Stage 3: 初回運動完了 (FIRST_EXERCISE)
**定義**: QRコードをスキャンしてスマホアプリにアクセスし、運動を完了してPCをアンロックした

| KPI | 説明 | 計測方法 |
|-----|------|----------|
| ロック→QRスキャン率 | ロック遭遇後 QR をスキャン (スマホアプリにアクセス) した割合 | `squat_sessions` 作成数 / ロック遭遇数 |
| QRスキャン→運動完了率 | スマホアプリにアクセスし運動を完了した割合 | `squat_sessions.unlocked=true` / セッション作成数 |
| 完了タイムアウト率 | セッションが作成されたが30分以上 `unlocked` にならなかった割合 | タイムスタンプ監視 |
| 平均完了時間 | セッション作成→アンロックまでの時間(分) | タイムスタンプ差分 |

**ターゲット指標**: QRスキャン→運動完了率 > 70%

---

#### Stage 4: 習慣化 (HABIT_FORMATION)
**定義**: 7日間のトライアル期間中に継続的に利用 (週3回以上アンロック実施)

| KPI | 説明 | 計測方法 |
|-----|------|----------|
| D7継続率 | インストール7日後もアクティブな割合 | D7時点でのセッション有無 |
| 週次アンロック回数 (中央値) | 1週間あたりの平均アンロック完了回数 | `squat_sessions.unlocked` 集計 |
| ストリーク最高記録 | 連続してロック解除した日数 | 日次セッション集計 |
| トライアル消化率 | トライアル期間中に機能を積極利用した割合 | セッション数 ≥ 3/週 |

**ターゲット指標**: D7継続率 > 40%

---

#### Stage 5: ペイウォール遭遇 (PAYWALL_HIT)
**定義**: Free プランの制限 (サイト3件上限/ロック時間制限/スケジュール固定) に到達した

| KPI | 説明 | 計測方法 |
|-----|------|----------|
| ペイウォール遭遇率 | アクティブユーザーのうちFree制限に遭遇した割合 | `paywall_hit` イベント |
| 遭遇したペイウォール種別分布 | サイト上限/時間/スケジュール別の分布 | `paywall_type` プロパティ |
| ペイウォール→Checkout率 | 制限遭遇後 Checkout を開始した割合 | ファネル内の次ステージ率 |
| ペイウォール遭遇回数 (転換前) | 転換するまでに何回ペイウォールに遭遇したか | ユーザー別集計 |

**ターゲット指標**: ペイウォール遭遇→Checkout開始率 > 20%

---

#### Stage 6: Checkout開始 (CHECKOUT_STARTED)
**定義**: `pricing.html` を開き Stripe Checkout セッションが作成された

| KPI | 説明 | 計測方法 |
|-----|------|----------|
| Checkout 開始数 (日次) | 日次 Checkout 開始数 | `create-checkout` Edge Function ログ |
| Checkout 開始→完了率 | Checkout を開始し決済を完了した割合 | Stripe Dashboard |
| 価格選択分布 (月額/年額/JPY/USD) | どの価格プランが選択されたか | Stripe metadata |
| Checkout 離脱タイミング | どのステップで離脱したか | Stripe Analytics |

**ターゲット指標**: Checkout開始→完了率 > 50%

---

#### Stage 7: 決済完了 (CONVERSION)
**定義**: Stripe `checkout.session.completed` が受信され `profiles.subscription_status = active` に更新された

| KPI | 説明 | 計測方法 |
|-----|------|----------|
| 全体CVR (インストール→Pro) | インストールからPro転換までの全体転換率 | Pro転換数/インストール数 |
| トライアル→Pro転換率 | トライアル終了前後にProに転換した割合 | trial_used=true かつ active 転換数 |
| 月額 vs 年額 比率 | 月額・年額それぞれの選択割合 | Stripe サブスクリプション種別 |
| 初回決済完了までの中央値日数 | インストールから決済完了までの日数 | タイムスタンプ差分 |

**ターゲット指標**: トライアル→Pro転換率 > 15%, 全体CVR > 5%

---

#### Stage 8: リテンション (RETENTION)
**定義**: Pro 転換後も継続してサブスクリプションを維持している

| KPI | 説明 | 計測方法 |
|-----|------|----------|
| M1 リテンション率 | 初回決済から30日後も active な割合 | Stripe サブスク継続率 |
| M3 リテンション率 | 初回決済から90日後も active な割合 | Stripe サブスク継続率 |
| 解約率 (月次) | 月次での解約実施率 | `customer.subscription.deleted` 数/active 数 |
| 解約理由 (定性) | 解約時のフィードバック | exit survey |
| cancel_at_period_end 率 | 解約予約を入れたが期間満了前の割合 | `profiles.cancel_at_period_end = true` 集計 |

**ターゲット指標**: M1リテンション率 > 70%, 月次解約率 < 5%

---

## 2. トラッキング設計

### 2.1 計測イベント一覧

#### Chrome拡張側イベント

| イベント名 | トリガー | 主要プロパティ | 記録場所 |
|-----------|---------|--------------|----------|
| `extension_opened` | popup.js DOMContentLoaded | `plan_state`, `is_pro`, `device_id` | user_events (Supabase) |
| `login_started` | Google ログインボタンクリック | `device_id` | user_events |
| `login_completed` | OAuth フロー完了 | `device_id`, `user_id`, `plan_state` | user_events |
| `login_failed` | OAuth エラー | `device_id`, `error_code` | user_events |
| `lock_encountered` | content.js でオーバーレイ表示 | `domain`, `plan_state`, `device_id`, `lock_count_total` | user_events |
| `paywall_hit` | Free 制限に到達 | `paywall_type` (sites/duration/schedule/custom_domain), `plan_state` | user_events |
| `upgrade_clicked` | UPGRADE ボタンクリック | `device_id`, `plan_state`, `paywall_type` | user_events |
| `checkout_opened` | pricing.html が開かれた | `device_id`, `source` (extension/app), `lang` | user_events |
| `blocked_sites_updated` | ブロックサイト設定変更 | `site_count`, `has_custom`, `plan_state` | user_events |
| `duration_changed` | ロック時間変更 | `duration_min`, `plan_state` | user_events |
| `settings_unlock_started` | 設定ロック解除セッション開始 | `device_id` | user_events |

#### スマホアプリ側イベント

| イベント名 | トリガー | 主要プロパティ | 記録場所 |
|-----------|---------|--------------|----------|
| `app_opened` | index.html ロード | `user_id`, `plan_state`, `session_param` | user_events |
| `session_started` | セッション開始 (QR/手入力) | `session_id`, `target_reps`, `exercise_type`, `source` | user_events |
| `exercise_rep_completed` | 1レップ完了 | `session_id`, `exercise_type`, `reps_done`, `reps_target` | user_events (サンプリング可) |
| `session_completed` | 目標回数到達 | `session_id`, `exercise_type`, `total_reps`, `duration_sec` | user_events |
| `session_abandoned` | EXIT ボタン押下 | `session_id`, `reps_done`, `reps_target` | user_events |
| `unlock_sent` | UNLOCK PC ボタン押下 | `session_id`, `user_id` | user_events |
| `unlock_failed` | unlock_session RPC エラー | `session_id`, `error_code` | user_events |
| `pricing_page_opened` | pricing.html ロード | `user_id`, `plan_state`, `source`, `lang` | user_events |
| `checkout_initiated` | create-checkout Edge Function 呼び出し | `user_id`, `price_id`, `currency` | user_events |

#### Webhook/サーバー側イベント

| イベント名 | トリガー | 主要プロパティ | 記録場所 |
|-----------|---------|--------------|----------|
| `subscription_activated` | `checkout.session.completed` 受信後 | `user_id`, `stripe_customer_id`, `price_id`, `currency`, `interval` | user_events |
| `subscription_cancel_scheduled` | `customer.subscription.updated` (cancel_at_period_end=true) | `user_id`, `current_period_end` | user_events |
| `subscription_resumed` | `customer.subscription.updated` (cancel_at_period_end=false) | `user_id` | user_events |
| `subscription_deleted` | `customer.subscription.deleted` | `user_id`, `reason` | user_events |
| `trial_started` | 初回 profile 作成時にトライアル付与 | `user_id`, `trial_ends_at` | user_events |
| `trial_expired` | trial_ends_at 経過 (バッチ or ログイン時検知) | `user_id`, `converted` (bool) | user_events |

---

### 2.2 Supabaseテーブル拡張案

#### 2.2.1 user_events テーブル

```sql
-- THE TOLL: ユーザー行動イベントログ
-- 作成: CVR改善トラッキング基盤

create table if not exists public.user_events (
  id            bigserial primary key,
  created_at    timestamptz not null default now(),

  -- イベント識別
  event_name    text not null,           -- e.g. 'lock_encountered', 'paywall_hit'
  event_source  text not null,           -- 'extension', 'smartphone_app', 'edge_function'

  -- ユーザー識別 (どちらかは必須)
  user_id       uuid references auth.users(id) on delete set null,
  device_id     text,                    -- 未ログイン状態での拡張識別子

  -- イベントプロパティ (柔軟なJSONB)
  properties    jsonb not null default '{}',

  -- ABテスト追跡
  ab_variant    text,                    -- 'control', 'variant_a', 'variant_b' 等

  -- セッション・分析用
  session_id    text,                    -- squat_session ID (運動セッション)
  plan_state    text                     -- 'free', 'trial', 'pro' (イベント時点の状態)
);

-- パフォーマンス用インデックス
create index if not exists user_events_event_name_idx
  on public.user_events(event_name);

create index if not exists user_events_user_id_idx
  on public.user_events(user_id);

create index if not exists user_events_device_id_idx
  on public.user_events(device_id);

create index if not exists user_events_created_at_idx
  on public.user_events(created_at desc);

create index if not exists user_events_plan_state_idx
  on public.user_events(plan_state);

-- 複合インデックス (ファネル分析用)
create index if not exists user_events_user_event_idx
  on public.user_events(user_id, event_name, created_at desc);

-- RLS: サービスロールのみ書き込み可 (クライアントは Edge Function 経由)
alter table public.user_events enable row level security;

create policy user_events_select_own
  on public.user_events for select
  to authenticated
  using (auth.uid() = user_id);

-- 書き込みはサービスロール (Edge Function) のみ
-- anon/authenticated からの直接書き込みを禁止してイベント改ざんを防止
```

#### 2.2.2 ab_assignments テーブル

```sql
-- A/Bテスト割り当て管理

create table if not exists public.ab_assignments (
  id              bigserial primary key,
  created_at      timestamptz not null default now(),

  -- ユーザー識別
  user_id         uuid references auth.users(id) on delete cascade,
  device_id       text,

  -- テスト情報
  experiment_id   text not null,         -- e.g. 'paywall_timing_v1'
  variant         text not null,         -- e.g. 'control', 'variant_a'

  -- 割り当て詳細
  assigned_at     timestamptz not null default now(),
  assignment_method text default 'random', -- 'random', 'modulo', 'manual'

  unique (user_id, experiment_id),
  unique (device_id, experiment_id)
);

create index if not exists ab_assignments_experiment_idx
  on public.ab_assignments(experiment_id, variant);

alter table public.ab_assignments enable row level security;

create policy ab_assignments_select_own
  on public.ab_assignments for select
  to authenticated
  using (auth.uid() = user_id);
```

#### 2.2.3 daily_active_users ビュー (集計用)

```sql
-- 日次アクティブユーザー集計ビュー

create or replace view public.daily_active_users as
select
  date_trunc('day', created_at) as date,
  plan_state,
  count(distinct coalesce(user_id::text, device_id)) as unique_users,
  count(*) as total_events
from public.user_events
group by 1, 2;
```

#### 2.2.4 funnel_metrics ビュー (ファネル分析用)

```sql
-- コンバージョンファネル集計ビュー (週次集計用)

create or replace view public.funnel_weekly as
with base as (
  select
    date_trunc('week', created_at) as week,
    coalesce(user_id::text, device_id) as uid,
    array_agg(distinct event_name) as events_seen
  from public.user_events
  where created_at >= now() - interval '90 days'
  group by 1, 2
)
select
  week,
  count(*) as total_users,
  count(*) filter (where 'extension_opened' = any(events_seen))     as s1_opened,
  count(*) filter (where 'login_completed' = any(events_seen))      as s2_logged_in,
  count(*) filter (where 'lock_encountered' = any(events_seen))     as s3_locked,
  count(*) filter (where 'session_completed' = any(events_seen))    as s4_exercised,
  count(*) filter (where 'paywall_hit' = any(events_seen))          as s5_paywall,
  count(*) filter (where 'upgrade_clicked' = any(events_seen))      as s6_upgrade_click,
  count(*) filter (where 'subscription_activated' = any(events_seen)) as s7_converted
from base
group by 1
order by 1 desc;
```

---

### 2.3 Chrome拡張側の計測実装方針

#### 2.3.1 イベント送信の基本設計

イベントは **Chrome拡張から直接 Supabase の Edge Function `track-event` を呼び出す** 方式を採用する。
直接 `user_events` テーブルへの INSERT は行わず、Edge Function を経由することでデータ検証とサービスロール保護を維持する。

```javascript
// popup.js / content.js 共通のトラッキング関数 (実装例)

async function trackEvent(eventName, properties = {}) {
  try {
    const storageData = await chrome.storage.local.get(['toll_device_id']);
    const deviceId = storageData.toll_device_id;

    // ユーザーID・プランは呼び出し時に渡す (グローバル変数依存を避ける)
    const payload = {
      event_name: eventName,
      event_source: 'extension',
      device_id: deviceId,
      properties: {
        ...properties,
        extension_version: chrome.runtime.getManifest().version,
        timestamp_client: new Date().toISOString(),
      },
    };

    // fire-and-forget (UX ブロックしない)
    fetch(`${SUPABASE_URL}/functions/v1/track-event`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': SUPABASE_ANON_KEY,
        'Authorization': `Bearer ${authAccessToken || SUPABASE_ANON_KEY}`,
      },
      body: JSON.stringify(payload),
    }).catch(() => { /* 計測失敗はサイレント */ });
  } catch (_) {
    // 計測エラーは本体機能に影響させない
  }
}
```

#### 2.3.2 content.js でのロック計測

```javascript
// content.js 内のロック遭遇イベント送信例
async function sendLockEvent(domain, planState) {
  // lock_count はローカルで累積管理
  const data = await chrome.storage.local.get('toll_lock_count_total');
  const lockCount = (data.toll_lock_count_total || 0) + 1;
  await chrome.storage.local.set({ toll_lock_count_total: lockCount });

  trackEvent('lock_encountered', {
    domain: domain,
    plan_state: planState,
    lock_count_total: lockCount,
  });
}
```

#### 2.3.3 プライバシー配慮

- ブロック対象ドメイン名はイベントに含めるが、**フルURL・ページタイトルは収集しない**
- ユーザーIDが未設定の場合は `device_id` のみで記録し、ログイン後に紐付け可能とする
- プライバシーポリシーに明記し、CWSポリシーに準拠する

---

## 3. A/Bテスト設計

### 3.1 テスト1: ペイウォール表示タイミング

#### 仮説
Free ユーザーがロックに何度も遭遇してから制限メッセージを表示するより、
初回から Pro メリットを軽く提示した方が、ユーザーの価値認識が高まり CVR が上がる。

#### テスト設計

| 項目 | 内容 |
|------|------|
| **実験名** | `paywall_timing_v1` |
| **開始トリガー** | 拡張インストール後の初回 popup 起動時に割り当て |
| **割り当て方法** | device_id のハッシュ値で均等分割 (50:50) |

**バリアント定義**:

| バリアント | 説明 |
|-----------|------|
| **Control** (現状) | Free 制限に実際に到達した時のみペイウォールメッセージを表示 |
| **Variant A** (早期告知) | インストール直後の popup に "Pro で3倍の制限解除" バナーを常時表示 (ソフト告知) |
| **Variant B** (N回目トリガー) | 3回目のロック遭遇時にモーダル表示: "制限まであとXサイト。Proで制限解除" |

**計測指標**:

| 指標 | 種別 | 計測方法 |
|------|------|----------|
| Primary: Checkout開始率 | Conversion | `upgrade_clicked` / `extension_opened` |
| Secondary: 最終CVR (Pro転換率) | Conversion | `subscription_activated` / `extension_opened` |
| Guardrail: D7継続率 | Retention | D7時点でのアクティブセッション有無 |
| Guardrail: アンインストール率 | Churn | CWS コンソール |

**サンプルサイズ考慮**:
- ベースライン CVR 仮定: 3% (Checkout開始率)
- 検出したい最小効果: +1.5% (50%改善)
- 統計的有意水準: α=0.05, 検出力 β=0.80
- 必要サンプル数 (片側): 約 **1,500 ユーザー/バリアント** (合計 3,000 インストール)
- 想定期間: 月間インストール数により変動 (目安: 4〜8週間)

**実施手順**:
1. `ab_assignments` テーブルにバリアント割り当てを記録
2. popup.js 起動時に割り当てを取得し、UI 分岐を適用
3. 全 `paywall_hit`, `upgrade_clicked` イベントに `ab_variant` プロパティを付与
4. 2週間ごとに中間確認 (早期終了基準: 有意差95%以上の場合)

---

### 3.2 テスト2: Free制限の閾値変更

#### 仮説
Free プランのブロックサイト上限を3件から5件に増やすと、
ユーザーが「使えるプロダクト」と認識し習慣化が促進され、
結果として有料転換の動機 (もっと使いたい) が強化される。

#### テスト設計

| 項目 | 内容 |
|------|------|
| **実験名** | `free_limit_sites_v1` |
| **開始トリガー** | 新規インストールユーザーのみを対象 (既存ユーザーは除外) |
| **割り当て方法** | user_id のハッシュ (ログイン後に確定) / 未ログインは device_id |

**バリアント定義**:

| バリアント | ブロックサイト上限 | ロック時間選択肢 |
|-----------|-------------|-------------|
| **Control** | 3件 | 5/10/20 分 |
| **Variant A** | 5件 | 5/10/20 分 |
| **Variant B** | 3件 | 5/10/15/20 分 (中間値追加) |
| **Variant C** | 5件 | 5/10/15/20 分 |

**計測指標**:

| 指標 | 種別 | 計測方法 |
|------|------|----------|
| Primary: D14 継続率 | Retention | 14日後のアクティブセッション有無 |
| Primary: Pro転換率 | Conversion | `subscription_activated` / ユーザー数 |
| Secondary: 週次アンロック回数 | Engagement | `session_completed` 数/週 |
| Secondary: ペイウォール遭遇率 | Funnel | `paywall_hit` / アクティブユーザー |
| Guardrail: ARPU | Revenue | MRR / アクティブユーザー数 |

**注意事項**:
- 上限拡大により「ペイウォールに遭遇しにくくなる」可能性があるため、
  Guardrail として ARPU を監視し、上限拡大がアップグレード意欲を削がないか確認する
- 実施期間目安: **6〜8週間** (D14継続率が主指標のため最低2週間以上確保)

**サンプルサイズ**:
- ベースライン D14 継続率仮定: 25%
- 検出したい最小効果: +5%pt
- 必要サンプル数: 約 **2,000 ユーザー/バリアント** (合計 8,000 インストール)
- 月間 1,000 インストールを想定した場合、**2〜3ヶ月** が現実的な期間

---

### 3.3 テスト3: トライアル期間の最適化

#### 仮説
7日間トライアルは短すぎて習慣化前に終わってしまい、Pro 価値を体験できない。
14日間にすることで体験価値が向上し、トライアル→Pro 転換率が改善する。
一方、機能制限付き無期限トライアルは「いつでも無料で使える」という認知を生み、
転換率が下がる可能性もある。

#### テスト設計

| 項目 | 内容 |
|------|------|
| **実験名** | `trial_duration_v1` |
| **開始トリガー** | 新規ユーザーのGoogleログイン完了時 (trial_used=false の初回のみ) |
| **割り当て方法** | user_id のハッシュ値 (3分割: 33:33:34) |

**バリアント定義**:

| バリアント | トライアル内容 | 期間 |
|-----------|-------------|------|
| **Control** | 全機能 Pro 開放 | 7日間 |
| **Variant A** | 全機能 Pro 開放 | 14日間 |
| **Variant B** | 機能制限付き (サイト5件/ロック時間全選択肢) | 無期限 (永続Freeより少し良い状態) |

**計測指標**:

| 指標 | 種別 | 計測方法 |
|------|------|----------|
| Primary: トライアル→Pro転換率 | Conversion | `subscription_activated` / `trial_started` |
| Primary: トライアル終了後30日以内転換率 | Conversion | トライアル終了日から30日以内の転換 |
| Secondary: トライアル期間中の週次アンロック数 | Engagement | `session_completed` 集計 |
| Secondary: MRR 影響 | Revenue | バリアント別の MRR 貢献 |
| Guardrail: 月次 ARPU | Revenue | MRR / 全ユーザー (トライアル長期化による収益遅延を監視) |

**重要な考慮点**:
- Variant A (14日) はトライアル期間が2倍のため、**同期間の収益は必ず遅れる**
  → 収益インパクトを LTV ベースで評価すること
- Variant B は「ずっと無料で使える」と認知されるリスクがあり、
  明確な「これは限定的な体験版」というメッセージングが必要
- 実施期間目安: **10〜12週間** (14日トライアル + 転換観察期間 + 統計収束)

**サンプルサイズ**:
- ベースライン転換率仮定: 15%
- 検出したい最小効果: +5%pt (33%改善)
- 必要サンプル数: 約 **1,200 ユーザー/バリアント** (合計 3,600 新規ログインユーザー)

---

### 3.4 テスト4 (追加案): アップグレードCTAのコピーテスト

#### 仮説
「UPGRADE TO PRO」という汎用的なラベルより、
制限に遭遇した文脈に合わせた訴求コピーの方が Checkout 開始率が上がる。

| バリアント | CTAコピー | サブコピー |
|-----------|----------|----------|
| Control | `UPGRADE TO PRO` | - |
| Variant A | `UNLOCK MORE SITES` | `Add up to unlimited sites — from ¥680/mo` |
| Variant B | `GET FULL FREEDOM` | `Custom schedule, unlimited sites, any time limit` |

- **実験名**: `cta_copy_v1`
- **Primary指標**: `upgrade_clicked` / `paywall_hit`
- **実施期間目安**: 4週間
- **必要サンプル数**: 約 800 ペイウォール遭遇ユーザー/バリアント

---

## 4. ダッシュボード設計

### 4.1 日常モニタリング指標 (毎日確認)

#### セクション1: ファネルサマリー (週次推移)

```
┌─────────────────────────────────────────────────────────────┐
│ FUNNEL OVERVIEW (Rolling 7d / prev 7d / WoW%)               │
├────────────────────┬────────┬────────┬──────────────────────┤
│ Stage              │ Today  │ -7d    │ WoW %                │
├────────────────────┼────────┼────────┼──────────────────────┤
│ Installs           │  XXX   │  XXX   │  ±XX%                │
│ Popup Opened       │  XXX   │  XXX   │  ±XX%                │
│ Login Completed    │  XXX   │  XXX   │  ±XX%                │
│ First Lock         │  XXX   │  XXX   │  ±XX%                │
│ First Exercise     │  XXX   │  XXX   │  ±XX%                │
│ Paywall Hit        │  XXX   │  XXX   │  ±XX%                │
│ Upgrade Clicked    │  XXX   │  XXX   │  ±XX%                │
│ Pro Converted      │  XXX   │  XXX   │  ±XX%                │
└────────────────────┴────────┴────────┴──────────────────────┘
```

**クエリ例**:
```sql
select
  event_name,
  count(distinct coalesce(user_id::text, device_id)) as unique_users,
  count(*) as event_count
from public.user_events
where created_at >= now() - interval '7 days'
  and event_name in (
    'extension_opened', 'login_completed', 'lock_encountered',
    'session_completed', 'paywall_hit', 'upgrade_clicked', 'subscription_activated'
  )
group by event_name
order by event_count desc;
```

---

#### セクション2: CVR・収益指標 (毎日確認)

| 指標 | 説明 | 目標値 |
|------|------|--------|
| 全体CVR (インストール→Pro) | 7日間ローリング | > 5% |
| トライアル→Pro 転換率 | トライアル終了ユーザーのうち転換した割合 | > 15% |
| 日次新規 Pro 数 | 当日の新規 `subscription_activated` 数 | トレンド管理 |
| MRR (Monthly Recurring Revenue) | Stripe ダッシュボードと連携 | 成長率 +10%/月 |
| 日次解約数 | `subscription_deleted` 数 | < 新規 Pro 数 |
| Net New MRR | 新規MRR - 解約MRR | 正値維持 |

---

#### セクション3: エンゲージメント指標 (毎日確認)

| 指標 | 説明 |
|------|------|
| DAU (Daily Active Unlockers) | 当日にアンロックを1回以上完了したユニークユーザー数 |
| 平均セッション完了数/ユーザー | 当日の `session_completed` 数 / DAU |
| セッション完了率 | `session_completed` / `session_started` |
| 種目別完了分布 | SQUAT/PUSH-UP/SIT-UP それぞれの完了数 |
| 平均ロック→アンロック時間 | セッション開始から完了までの中央値 (分) |

---

#### セクション4: A/Bテスト進捗

```
┌─────────────────────────────────────────────────────────────┐
│ ACTIVE EXPERIMENTS                                          │
├──────────────────┬───────────┬───────────┬────────────────── │
│ Experiment       │ Control   │ Variant A │ p-value / Status │
├──────────────────┼───────────┼───────────┼────────────────── │
│ paywall_timing   │ CVR: 3.2% │ CVR: 4.1% │ p=0.12 / Running │
│ trial_duration   │ Con: 14%  │ Con: 17%  │ p=0.08 / Running │
└──────────────────┴───────────┴───────────┴────────────────── │
```

---

### 4.2 アラート設計

#### Priority 1: 即時対応 (Slack/メール通知)

| アラート名 | 条件 | 説明 | 対応 |
|-----------|------|------|------|
| **CVR急落** | 日次 Pro 転換数が 前日比 -50% 以上 (かつ前日が5件以上) | 決済フロー障害の可能性 | Stripe Webhook / Edge Function ログ確認 |
| **Webhook失敗急増** | `stripe-webhook` の非200レスポンスが1時間で5件以上 | Webhook シークレット不一致・デプロイ問題 | `stripe-webhook` Edge Function を再デプロイ |
| **セッション完了率急落** | `session_completed` / `session_started` が 前1時間比 -40% 以下 | スマホアプリのカメラ/MediaPipe障害 | スマホアプリの console エラー確認 |
| **ログイン失敗急増** | `login_failed` が1時間で20件以上 | Supabase Auth / Google OAuth の障害 | Supabase ステータスページ確認 |

#### Priority 2: 翌営業日対応 (日次サマリー)

| アラート名 | 条件 | 対応 |
|-----------|------|------|
| **D7継続率低下** | 今週の D7 継続率が先週比 -10%pt 以上 | オンボーディング改善を検討 |
| **ペイウォール遭遇率低下** | `paywall_hit` / DAU が 前週比 -20% | Free 制限が想定より緩い可能性 |
| **解約率上昇** | 月次解約率が 7% 以上 | 解約理由サーベイ・リテンション施策検討 |
| **トライアル転換率低下** | 今月のトライアル→Pro 転換率が 10% 以下 | ペイウォール体験・価格見直し |
| **インストール数急落** | 週次インストール数が前週比 -30% | CWS ストアページ・レビュー確認 |

#### アラート実装案 (Supabase Edge Function + pg_cron)

```sql
-- pg_cron で毎時チェックするアラート用クエリ例

-- CVR 急落チェック
select
  date_trunc('hour', created_at) as hour,
  count(*) filter (where event_name = 'subscription_activated') as conversions,
  count(*) filter (where event_name = 'upgrade_clicked') as clicks,
  round(
    count(*) filter (where event_name = 'subscription_activated')::numeric /
    nullif(count(*) filter (where event_name = 'upgrade_clicked'), 0) * 100, 2
  ) as click_to_convert_rate
from public.user_events
where created_at >= now() - interval '2 hours'
group by 1
order by 1 desc;
```

---

### 4.3 週次レビューアジェンダ (推奨)

毎週月曜日に以下を確認:

1. **ファネル前週比**: 各ステージの数値と WoW% を確認
2. **A/Bテスト状況**: 各実験の現状 p-value と推奨アクション
3. **ペイウォール種別分布**: サイト上限/時間/スケジュール別の遭遇割合 → 改善優先度判断
4. **解約理由レポート**: `subscription_deleted` 前後のユーザー行動を追跡
5. **コホート分析**: 直近インストールコホートの D7/D14/D30 継続率
6. **次週の施策決定**: 数値に基づく機能改善・価格調整の意思決定

---

## 5. 実装優先順位

### Phase 1 (優先: 2〜3週間以内)
1. **`track-event` Edge Function の作成** (user_events への安全な書き込み口)
2. **`user_events` テーブルの作成と RLS 設定**
3. **Chrome拡張への基本イベント埋め込み**: `lock_encountered`, `paywall_hit`, `upgrade_clicked`
4. **スマホアプリへの基本イベント埋め込み**: `session_started`, `session_completed`
5. **Stripe Webhook 側への `subscription_activated` / `subscription_deleted` イベント記録**

### Phase 2 (次フェーズ: 4〜6週間以内)
1. **`ab_assignments` テーブルとバリアント割り当て ロジック**
2. **A/Bテスト1 (ペイウォールタイミング) の実装と計測開始**
3. **ダッシュボード SQL クエリの Supabase ダッシュボード / Retool / Metabase 連携**
4. **アラート用 Edge Function + pg_cron 設定**

### Phase 3 (中長期)
1. **A/Bテスト2, 3 の順次実施**
2. **コホート分析ビューの構築**
3. **解約理由サーベイの実装** (stripe-webhook 経由で解約時に exit survey URL を送信)

---

## 6. 付録: データスキーマ全体図

```
auth.users (Supabase管理)
    │
    ├── profiles (1:1)
    │     id, email, subscription_status, plan_tier,
    │     trial_ends_at, trial_used,
    │     cancel_at_period_end, current_period_end,
    │     stripe_customer_id
    │
    ├── device_links (1:N)
    │     device_id (PK), user_id,
    │     subscription_status, plan_tier,
    │     trial_ends_at, cancel_at_period_end,
    │     current_period_end, updated_at, last_seen_at
    │
    ├── squat_sessions (N:N-like)
    │     id (text PK), unlocked, created_at
    │
    ├── user_events [NEW] (1:N)
    │     id, created_at, event_name, event_source,
    │     user_id, device_id, properties (jsonb),
    │     ab_variant, session_id, plan_state
    │
    └── ab_assignments [NEW] (1:N)
          id, user_id, device_id,
          experiment_id, variant,
          assigned_at, assignment_method
```

---

*本レポートは THE TOLL CVR 最適化チームの「データアナリスト」エージェントが設計したものです。*
*実装前に開発チームとのレビューを推奨します。*
