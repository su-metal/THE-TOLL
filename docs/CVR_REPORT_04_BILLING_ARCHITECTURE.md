# CVR Report 04: 課金基盤アーキテクチャ設計

**作成日**: 2026-02-15
**担当**: バックエンド/課金実装エージェント
**対象プロダクト**: THE TOLL
**関連フェーズ**: Phase C (Server-Side Enforcement) / Phase D (Release Prep)

---

## エグゼクティブサマリー

THE TOLLの現課金実装は、Stripe + Supabase の組み合わせで基本フローは機能しているが、以下の重大なギャップが存在する:

1. **Free制限がクライアントサイドのみ** — クライアント改ざんで全制限を回避可能
2. **unlock_session にサーバーサイドチェックなし** — Freeユーザーがサーバー側解除RPCを直接呼べる
3. **Feature Flagがハードコード** — プラン境界変更にコードデプロイが必要
4. **グレースフルデグラデーション未定義** — Pro→Free降格時の挙動が不明確

本レポートでは上記ギャップを埋める設計を提供する。

---

## 1. Feature Flagアーキテクチャ

### 1.1 現状の問題

現在の制限値はクライアントコード内にハードコードされている:

```javascript
// chrome-extension/popup.js (現状イメージ)
const FREE_LOCK_DURATIONS = [5, 10, 20];       // ハードコード
const FREE_MAX_SITES = 3;                        // ハードコード
const FREE_SQUAT_MIN = 5, FREE_SQUAT_MAX = 20;  // ハードコード
```

この方式の問題:
- A/Bテスト不可（全ユーザーに同じ制限が適用される）
- プラン境界調整にコードデプロイが必要
- サーバーサイド検証との乖離リスク

### 1.2 Feature Flag テーブル設計

```sql
-- feature_flags: グローバルフラグ管理
create table if not exists public.feature_flags (
  flag_key        text primary key,
  flag_value      jsonb not null,
  description     text,
  is_active       boolean not null default true,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

-- plan_limits: プラン別制限値（Feature Flagの特化版）
create table if not exists public.plan_limits (
  id              uuid primary key default gen_random_uuid(),
  plan_tier       text not null,           -- 'free' | 'pro'
  limit_key       text not null,           -- 制限の識別子
  limit_value     jsonb not null,          -- 値（数値/配列/オブジェクト）
  ab_variant      text,                    -- A/Bテスト用バリアント識別子（null=全員）
  is_active       boolean not null default true,
  valid_from      timestamptz not null default now(),
  valid_until     timestamptz,             -- null=無期限
  created_at      timestamptz not null default now(),
  unique (plan_tier, limit_key, ab_variant)
);

-- RLS: 読み取りは全認証ユーザーに許可、書き込みはservice_roleのみ
alter table public.feature_flags enable row level security;
alter table public.plan_limits enable row level security;

create policy plan_limits_read_all
  on public.plan_limits for select
  to authenticated, anon
  using (is_active = true and (valid_until is null or valid_until > now()));

create policy feature_flags_read_all
  on public.feature_flags for select
  to authenticated, anon
  using (is_active = true);
```

### 1.3 初期データ投入 (MVP制限値)

```sql
-- Free プランの制限値
insert into public.plan_limits (plan_tier, limit_key, limit_value) values
  ('free', 'lock_duration_options_min',  '[5, 10, 20]'::jsonb),
  ('free', 'squat_count_min',            '5'::jsonb),
  ('free', 'squat_count_max',            '20'::jsonb),
  ('free', 'max_blocked_sites',          '3'::jsonb),
  ('free', 'custom_domains_allowed',     'false'::jsonb),
  ('free', 'schedule_fixed',             'true'::jsonb),
  ('free', 'adult_block_allowed',        'true'::jsonb),
  ('free', 'unlock_sessions_per_day',    'null'::jsonb)   -- null=無制限
on conflict (plan_tier, limit_key, ab_variant) do nothing;

-- Pro プランの制限値
insert into public.plan_limits (plan_tier, limit_key, limit_value) values
  ('pro', 'lock_duration_options_min',  '[5, 10, 20, 30, 60, 120]'::jsonb),
  ('pro', 'squat_count_min',            '5'::jsonb),
  ('pro', 'squat_count_max',            '100'::jsonb),
  ('pro', 'max_blocked_sites',          'null'::jsonb),   -- null=無制限
  ('pro', 'custom_domains_allowed',     'true'::jsonb),
  ('pro', 'schedule_fixed',             'false'::jsonb),
  ('pro', 'adult_block_allowed',        'true'::jsonb),
  ('pro', 'unlock_sessions_per_day',    'null'::jsonb)
on conflict (plan_tier, limit_key, ab_variant) do nothing;
```

### 1.4 プラン制限取得 RPC

```sql
-- ユーザーのプラン制限をまとめて返す関数
create or replace function public.get_plan_limits(p_user_id uuid)
returns jsonb
language plpgsql
security definer
stable
as $$
declare
  v_plan_tier text;
  v_limits    jsonb := '{}'::jsonb;
  r           record;
begin
  -- プランティア取得（is_pro_entitled考慮）
  select
    case
      when public.is_pro_entitled(p.subscription_status, p.trial_ends_at) then 'pro'
      else 'free'
    end
  into v_plan_tier
  from public.profiles p
  where p.id = p_user_id;

  if v_plan_tier is null then
    v_plan_tier := 'free';
  end if;

  -- 制限値をJSONBにまとめる
  for r in
    select limit_key, limit_value
    from public.plan_limits
    where plan_tier = v_plan_tier
      and is_active = true
      and (valid_until is null or valid_until > now())
      and ab_variant is null  -- デフォルトバリアントのみ
  loop
    v_limits := v_limits || jsonb_build_object(r.limit_key, r.limit_value);
  end loop;

  return jsonb_build_object(
    'plan_tier', v_plan_tier,
    'limits', v_limits
  );
end;
$$;
```

### 1.5 クライアントでのFlag取得・キャッシュ戦略

**Chrome Extension (chrome.storage.local)**

```javascript
// chrome-extension/plan-limits.js

const PLAN_LIMITS_CACHE_KEY = 'plan_limits_cache';
const PLAN_LIMITS_TTL_MS = 5 * 60 * 1000; // 5分キャッシュ

async function getPlanLimits(supabaseClient, forceRefresh = false) {
  // キャッシュ確認
  if (!forceRefresh) {
    const cached = await chrome.storage.local.get(PLAN_LIMITS_CACHE_KEY);
    const entry = cached[PLAN_LIMITS_CACHE_KEY];
    if (entry && (Date.now() - entry.cachedAt) < PLAN_LIMITS_TTL_MS) {
      return entry.data;
    }
  }

  try {
    const { data, error } = await supabaseClient.rpc('get_plan_limits', {
      p_user_id: (await supabaseClient.auth.getUser()).data.user?.id
    });

    if (error) throw error;

    // キャッシュ保存
    await chrome.storage.local.set({
      [PLAN_LIMITS_CACHE_KEY]: { data, cachedAt: Date.now() }
    });

    return data;
  } catch (err) {
    // フォールバック: キャッシュ（期限切れでも）or ハードコードFree制限
    const cached = await chrome.storage.local.get(PLAN_LIMITS_CACHE_KEY);
    if (cached[PLAN_LIMITS_CACHE_KEY]) {
      return cached[PLAN_LIMITS_CACHE_KEY].data; // stale-while-revalidate
    }
    return getFallbackFreeLimits(); // 最終手段
  }
}

function getFallbackFreeLimits() {
  return {
    plan_tier: 'free',
    limits: {
      lock_duration_options_min: [5, 10, 20],
      squat_count_min: 5,
      squat_count_max: 20,
      max_blocked_sites: 3,
      custom_domains_allowed: false,
      schedule_fixed: true
    }
  };
}
```

**キャッシュ更新トリガー**:
- ログイン時
- サブスク状態変更検知時（Webhookで更新 → クライアントがポーリングで検知）
- ポップアップ開封時（バックグラウンドリフレッシュ）

---

## 2. サーバーサイドエンタイトルメント管理

### 2.1 現状のギャップ

`unlock_session` RPCは現在、呼び出したユーザーのProチェックをしていない。Freeユーザーもサーバー側で解除できてしまう（Phase C未実装）。

### 2.2 RLSポリシーによるデータアクセス制御

```sql
-- squat_sessions テーブルのRLS強化
-- 現在: authenticated ユーザーが全件select可能（ポーリング用）
-- 改善: セッション作成者または自身のセッションのみ参照可能

-- セッションにowner_user_idカラムを追加
alter table public.squat_sessions
  add column if not exists owner_user_id uuid references auth.users(id);

-- 既存RLSの見直し
drop policy if exists squat_sessions_select_public on public.squat_sessions;

create policy squat_sessions_select_own_or_anon
  on public.squat_sessions for select
  to authenticated, anon
  using (
    owner_user_id is null  -- 旧データ後方互換
    or owner_user_id = auth.uid()
  );

create policy squat_sessions_insert_entitled
  on public.squat_sessions for insert
  to authenticated
  with check (
    auth.uid() = owner_user_id
    and (
      -- Proチェック（RLS内でサブクエリ）
      exists (
        select 1 from public.profiles p
        where p.id = auth.uid()
          and public.is_pro_entitled(p.subscription_status, p.trial_ends_at)
      )
      -- Freeユーザーもセッション作成は可能（解除時にチェック）
      -- NOTE: セッション数制限はEdge Functionで別途チェック
      or true
    )
  );
```

### 2.3 unlock_session のPro強制チェック実装

```sql
-- unlock_session RPC: Proチェック付き完全版
create or replace function public.unlock_session(p_session_id text)
returns jsonb
language plpgsql
security definer
as $$
declare
  v_user_id        uuid;
  v_is_entitled    boolean;
  v_plan_tier      text;
  v_sub_status     text;
  v_trial_ends_at  timestamptz;
  v_session_exists boolean;
begin
  -- 認証確認
  v_user_id := auth.uid();
  if v_user_id is null then
    return jsonb_build_object(
      'success', false,
      'error_code', 'UNAUTHENTICATED',
      'message', 'Login required'
    );
  end if;

  -- プロファイル取得
  select
    subscription_status,
    trial_ends_at,
    plan_tier
  into v_sub_status, v_trial_ends_at, v_plan_tier
  from public.profiles
  where id = v_user_id;

  -- エンタイトルメントチェック
  -- Phase C実装: Proチェックを有効化する場合はここのコメントアウトを外す
  /*
  v_is_entitled := public.is_pro_entitled(v_sub_status, v_trial_ends_at);
  if not v_is_entitled then
    return jsonb_build_object(
      'success', false,
      'error_code', 'NOT_ENTITLED',
      'message', 'Pro subscription required',
      'plan_tier', v_plan_tier,
      'upgrade_url', 'https://smartphone-app-pi.vercel.app/pricing.html'
    );
  end if;
  */

  -- セッション存在確認
  select exists(
    select 1 from public.squat_sessions
    where id = p_session_id
  ) into v_session_exists;

  if not v_session_exists then
    return jsonb_build_object(
      'success', false,
      'error_code', 'SESSION_NOT_FOUND',
      'message', 'Session not found'
    );
  end if;

  -- セッションを解除
  update public.squat_sessions
  set
    unlocked = true,
    unlocked_at = now(),
    unlocked_by = v_user_id
  where id = p_session_id;

  return jsonb_build_object(
    'success', true,
    'session_id', p_session_id,
    'plan_tier', v_plan_tier
  );
end;
$$;
```

**Phase C有効化手順**:
1. `squat_sessions` に `unlocked_at`, `unlocked_by` カラムを追加
2. `unlock_session` のコメントアウト部を解除
3. Freeユーザー向けのアップグレード誘導UIを実装
4. 段階ロールアウト: まず10%のユーザーで検証

### 2.4 Edge Functionでの二重チェック設計

Edge Functionで重要なアクション前にエンタイトルメントを確認するミドルウェアパターン:

```typescript
// supabase/functions/_shared/entitlement.ts

export type EntitlementResult = {
  entitled: boolean;
  planTier: 'free' | 'pro';
  reason?: string;
};

export async function checkEntitlement(
  supabase: SupabaseClient,
  userId: string
): Promise<EntitlementResult> {
  const { data: profile, error } = await supabase
    .from('profiles')
    .select('subscription_status, plan_tier, trial_ends_at')
    .eq('id', userId)
    .single();

  if (error || !profile) {
    return { entitled: false, planTier: 'free', reason: 'Profile not found' };
  }

  const isActive = profile.subscription_status === 'active';
  const isTrialing = profile.trial_ends_at
    ? new Date(profile.trial_ends_at) > new Date()
    : false;

  return {
    entitled: isActive || isTrialing,
    planTier: (isActive || isTrialing) ? 'pro' : 'free',
  };
}

// 使用例: create-checkout や将来の Pro-only API で
export async function requireProEntitlement(
  supabase: SupabaseClient,
  userId: string
): Promise<Response | null> {
  const result = await checkEntitlement(supabase, userId);
  if (!result.entitled) {
    return new Response(JSON.stringify({
      error: 'Pro subscription required',
      plan_tier: result.planTier,
    }), { status: 403 });
  }
  return null; // null = チェック通過
}
```

---

## 3. グレースフルデグラデーション設計

### 3.1 Pro→Free降格シナリオ

降格トリガー:
- `customer.subscription.deleted` Webhook受信
- `customer.subscription.updated` で `status` が `canceled`/`incomplete_expired` に

降格時の `stripe-webhook` 処理フロー:

```
customer.subscription.deleted 受信
  → syncEntitlementByCustomerSubscriptions()
    → applyEntitlementForCustomer(customerId, 'inactive')
      → profiles.subscription_status = 'inactive'
      → profiles.plan_tier = 'free'
      → device_links 同期
```

### 3.2 データ・設定の扱い方針

| 設定項目 | 降格時の挙動 | 理由 |
|---|---|---|
| `blocked_sites` (プリセット上位3件) | 上位3件を保持 | Freeの上限3件を尊重 |
| `blocked_sites` (4件目以降) | 保持するが「無効化」フラグ付き | データ消去なし、再昇格時に復元 |
| `custom_blocked_sites` | 保持するが全件「無効化」 | データ消去なし、再昇格時に復元 |
| `lock_duration_min` (Freeに含まれない値) | 最近傍のFree値に自動調整 | 設定が壊れた状態を防ぐ |
| `target_squat_count` (範囲外) | 20にクランプ | Free上限 |
| `lock_schedule` | 維持するがカスタム設定は無視 | 毎日00:00-23:59にフォールバック |
| `adult_block_enabled` | そのまま維持 | Free/Pro両方で利用可能 |

### 3.3 サイト数上限超過時の処理

```sql
-- site_blocking_configs テーブルに is_active フラグを追加
-- (現状 chrome.storage.local 管理だが、将来サーバー側管理を想定)
```

**推奨アプローチ: 「古い順に自動無効化」+ ユーザー通知**

理由:
- ユーザー選択UIは降格直後に強制する必要があり、UXが悪い
- 古い設定から無効化することで予測可能な挙動を提供
- 無効化されたサイトはデータ消去せず、再昇格時に自動復元

```javascript
// chrome-extension: 降格検知時の処理
async function handlePlanDowngrade(newPlanLimits) {
  const maxSites = newPlanLimits.limits.max_blocked_sites; // 3
  const current = await chrome.storage.local.get(['blocked_sites', 'custom_blocked_sites']);

  // プリセットサイト: 古い順に3件まで残す
  const activeSites = (current.blocked_sites || []).slice(0, maxSites);
  const inactiveSites = (current.blocked_sites || []).slice(maxSites);

  // カスタムドメイン: 全件無効化
  const inactiveCustom = current.custom_blocked_sites || [];

  await chrome.storage.local.set({
    blocked_sites: activeSites,
    blocked_sites_inactive: inactiveSites,       // 保存しておく
    custom_blocked_sites: [],
    custom_blocked_sites_inactive: inactiveCustom // 保存しておく
  });

  // ユーザー通知
  chrome.notifications.create({
    type: 'basic',
    title: 'THE TOLL: Plan Changed to Free',
    message: `Only 3 sites active. ${inactiveSites.length + inactiveCustom.length} sites paused. Upgrade to restore.`
  });
}
```

### 3.4 カスタムドメイン設定の保持ポリシー

**方針: データは保持、機能は無効化**

- `custom_blocked_sites_inactive` に退避してデータ保持
- Freeプランではブロック対象に含めない
- 設定画面では「Pro機能 - アップグレードで復元」として表示
- 再昇格時に自動的に `custom_blocked_sites` に復元

```javascript
// 再昇格時の復元処理
async function handlePlanUpgrade() {
  const stored = await chrome.storage.local.get([
    'blocked_sites_inactive',
    'custom_blocked_sites_inactive'
  ]);

  const inactive = stored.blocked_sites_inactive || [];
  const customInactive = stored.custom_blocked_sites_inactive || [];

  if (inactive.length > 0 || customInactive.length > 0) {
    const current = await chrome.storage.local.get(['blocked_sites', 'custom_blocked_sites']);
    await chrome.storage.local.set({
      blocked_sites: [...(current.blocked_sites || []), ...inactive],
      custom_blocked_sites: [...(current.custom_blocked_sites || []), ...customInactive],
      blocked_sites_inactive: [],
      custom_blocked_sites_inactive: []
    });
  }
}
```

---

## 4. Usage-Based制限の技術実装

### 4.1 日/週/月のセッション数カウンター

現在の要件（FR-08）ではUsage-Based制限は明示されていないが、CVR最適化の観点から将来実装を見込んで設計する。

**DBスキーマ**:

```sql
-- usage_counters: 期間別利用カウンター
create table if not exists public.usage_counters (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null references auth.users(id) on delete cascade,
  counter_type   text not null,  -- 'unlock_sessions_daily' | 'unlock_sessions_weekly' | 'unlock_sessions_monthly'
  period_start   date not null,  -- カウンター期間の開始日
  count          integer not null default 0,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  unique (user_id, counter_type, period_start)
);

create index if not exists usage_counters_user_period_idx
  on public.usage_counters (user_id, counter_type, period_start);

alter table public.usage_counters enable row level security;

create policy usage_counters_read_own
  on public.usage_counters for select
  to authenticated
  using (user_id = auth.uid());
```

**カウンターインクリメント関数**:

```sql
create or replace function public.increment_usage_counter(
  p_user_id     uuid,
  p_counter_type text
)
returns jsonb
language plpgsql
security definer
as $$
declare
  v_period_start date;
  v_new_count    integer;
  v_limit        integer;
  v_plan_tier    text;
begin
  -- 期間開始日算出
  v_period_start := case p_counter_type
    when 'unlock_sessions_daily'   then current_date
    when 'unlock_sessions_weekly'  then date_trunc('week', current_date)::date
    when 'unlock_sessions_monthly' then date_trunc('month', current_date)::date
    else current_date
  end;

  -- カウントアップ（upsert）
  insert into public.usage_counters (user_id, counter_type, period_start, count)
  values (p_user_id, p_counter_type, v_period_start, 1)
  on conflict (user_id, counter_type, period_start)
  do update set
    count = usage_counters.count + 1,
    updated_at = now()
  returning count into v_new_count;

  -- プラン制限取得
  select plan_tier into v_plan_tier
  from public.profiles where id = p_user_id;

  -- 将来: plan_limitsテーブルから制限値を引いてチェック
  -- 現状: Freeでも制限なし（unlock_sessions_per_day = null）
  v_limit := null;

  return jsonb_build_object(
    'count', v_new_count,
    'limit', v_limit,
    'exceeded', v_limit is not null and v_new_count > v_limit
  );
end;
$$;
```

### 4.2 制限到達時のUI/UX

**ソフトリミット vs ハードリミット の使い分け**:

| 制限タイプ | 種別 | 説明 | THE TOLLでの適用例 |
|---|---|---|---|
| ソフトリミット | 警告のみ | 利用は続けられるが警告表示 | 月10回目のセッション前に「残り2回」表示 |
| ハードリミット | 強制停止 | 制限到達で機能を無効化 | 月15回で次のセッション作成をブロック |

**THE TOLLの推奨実装**:

```javascript
// unlock前の制限チェック（スマホアプリ側）
async function checkAndUnlock(sessionId) {
  const { data: counterResult } = await supabase.rpc('increment_usage_counter', {
    p_user_id: currentUserId,
    p_counter_type: 'unlock_sessions_daily'
  });

  if (counterResult?.exceeded) {
    // ハードリミット: Upgradeモーダル表示
    showUpgradeModal({
      reason: 'daily_limit_reached',
      count: counterResult.count,
      limit: counterResult.limit
    });
    return;
  }

  if (counterResult?.limit && counterResult.count >= counterResult.limit * 0.8) {
    // ソフトリミット: 残り回数を通知（利用は続行）
    showSoftLimitWarning({
      remaining: counterResult.limit - counterResult.count
    });
  }

  // 解除処理続行
  await supabase.rpc('unlock_session', { p_session_id: sessionId });
}
```

### 4.3 カウンターのリセットロジック

**推奨: オンデマンドリセット（定期バッチなし）**

期間ベースのカウンターは `period_start` カラムで自然にリセットされる。
前日のカウンターは別行として保存されるため、バッチ削除は不要。

```sql
-- 古いカウンターの定期クリーンアップ（月次、30日以上前のデータ削除）
-- Supabase Scheduled Functions (pg_cron) で実行
select cron.schedule(
  'cleanup-old-usage-counters',
  '0 3 1 * *',  -- 毎月1日 03:00
  $$
  delete from public.usage_counters
  where period_start < current_date - interval '30 days';
  $$
);
```

---

## 5. 実装ロードマップ

### 5.1 Phase C/Dとの統合計画

```
現在の実装状態:
  ├── Phase A: Billing Hardening     [50% 完了]
  ├── Phase B: Account Management   [100% 完了]
  ├── Phase C: Server-Side Enforce  [0% 未着手]
  └── Phase D: Release Prep         [33% 完了]

本レポートの実装追加:
  ├── Phase C: C-01 unlock_session Pro強制チェック
  ├── Phase C: C-02 RLS/権限の最終見直し
  └── Feature Flag: 新規フェーズとして追加
```

### 5.2 優先順位付き実装ステップ

#### Step 1: セキュリティ最優先 (Phase C, 推定1-2日)

**C-01: unlock_session Proチェック有効化**

```sql
-- squat_sessionsに必要なカラム追加
alter table public.squat_sessions
  add column if not exists unlocked_at timestamptz,
  add column if not exists unlocked_by uuid references auth.users(id);
```

- `unlock_session` RPCのコメントアウト部を解除
- スマホアプリでエラーコード `NOT_ENTITLED` を受け取りアップグレード誘導UIを実装
- テスト: Freeユーザーで `unlock_session` 呼び出し → 403相当のエラー確認

**C-02: RLS強化**

- `device_links_select_public` ポリシーを見直し（現在: `using (true)` で全件公開）
- 推奨: 自分の `device_id` のみ参照可能に変更
- `squat_sessions` に `owner_user_id` 追加（後方互換のため `null` 許容）

#### Step 2: Feature Flag基盤 (新規, 推定1日)

- `plan_limits` テーブル作成・データ投入
- `get_plan_limits` RPC実装
- クライアント（拡張/PWA）のキャッシュロジック実装
- ハードコード値をRPC結果で置き換え

優先度: Step 1の後に実施。Step 1完了後すぐに着手可能。

#### Step 3: グレースフルデグラデーション (新規, 推定1日)

- 降格検知ロジック実装（Webhookでフラグ設定 → クライアントがポーリングで検知）
- `blocked_sites_inactive`, `custom_blocked_sites_inactive` の保存・復元ロジック
- ユーザー通知実装

#### Step 4: Usage-Based制限 (将来 v1.2+)

- `usage_counters` テーブル作成
- `increment_usage_counter` RPC実装
- クライアントでの制限チェックUI実装
- ソフトリミット通知 → アップグレード誘導の計測

### 5.3 後方互換性の考慮

| 変更内容 | 後方互換リスク | 対策 |
|---|---|---|
| `unlock_session` Proチェック追加 | 既存Freeユーザーの解除が失敗 | フィーチャーフラグでロールアウト管理 |
| `squat_sessions.owner_user_id` 追加 | 旧セッションが `null` になる | RLSで `null` を許容（後方互換） |
| `plan_limits` テーブル追加 | なし（追加のみ） | リスクなし |
| `device_links_select_public` 変更 | 拡張の entitlement polling が変更必要 | 段階移行: まず新ポリシーを追加、旧ポリシーを後で削除 |
| クライアントのキャッシュ追加 | stale データによる表示ずれ | TTL 5分 + 強制リフレッシュトリガー |

### 5.4 モニタリングとアラート設定

Phase C/D完了後に追加推奨:

```sql
-- 監査ログテーブル（将来の運用強化向け）
create table if not exists public.audit_log (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid references auth.users(id),
  action       text not null,  -- 'unlock_session' | 'checkout_created' | 'plan_changed'
  result       text not null,  -- 'success' | 'denied' | 'error'
  plan_tier    text,
  metadata     jsonb,
  created_at   timestamptz not null default now()
);
```

Supabase Dashboard でアラート設定推奨:
- `audit_log.result = 'denied'` の急増（不正アクセス試行）
- `profiles.plan_tier` が `free` から `pro` への変化率（CVR追跡）

---

## 付録: 実装ファイル一覧

| ファイル | 対応Step | 説明 |
|---|---|---|
| `supabase/sql/2026-02-15_unlock_session_pro_check.sql` | Step 1 | C-01 unlock_session強化 |
| `supabase/sql/2026-02-15_rls_hardening.sql` | Step 1 | C-02 RLS強化 |
| `supabase/sql/2026-02-15_plan_limits.sql` | Step 2 | Feature Flagテーブル |
| `chrome-extension/plan-limits.js` | Step 2 | キャッシュロジック |
| `supabase/functions/_shared/entitlement.ts` | Step 1-2 | 共通エンタイトルメントチェック |
| `supabase/sql/2026-02-15_usage_counters.sql` | Step 4 | Usage-Basedカウンター |

---

## まとめ

THE TOLLの課金基盤は基本フローが安定しているが、Phase Cの未実装によりサーバーサイド強制が欠如している。本設計で提案した実装順序（C-01 → C-02 → Feature Flag → グレースフルデグラデーション）に従うことで、セキュリティを確保しながら段階的にCVRを改善できる体制を構築できる。

特に **unlock_session のPro強制チェック（Step 1）** は、現在最も重大なセキュリティギャップであり、リリース前の必須対応と位置付ける。
