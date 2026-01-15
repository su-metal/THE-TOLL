# THE TOLL - セットアップガイド

スクワット5回でYouTubeをアンロックするシステムのセットアップ方法です。

## 📋 必要なもの

- Google Chromeブラウザ（PC）
- スマートフォン（カメラ付き）
- Supabaseアカウント（無料プランでOK）

---

## 🗄️ Step 1: Supabaseプロジェクト作成

### 1.1 アカウント作成
1. [Supabase](https://supabase.com/) にアクセス
2. 「Start your project」→ GitHubアカウントでサインイン
3. 新しいプロジェクトを作成（名前: `the-toll` など）

### 1.2 テーブル作成
1. プロジェクトダッシュボード → **SQL Editor** を開く
2. 以下のSQLを実行：

```sql
-- セッションテーブル作成
CREATE TABLE squat_sessions (
  id TEXT PRIMARY KEY,
  unlocked BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- リアルタイム有効化
ALTER TABLE squat_sessions REPLICA IDENTITY FULL;

-- RLS（Row Level Security）を一時的に無効化（プロトタイプ用）
ALTER TABLE squat_sessions ENABLE ROW LEVEL SECURITY;

-- 全ユーザーに読み書き許可（開発用ポリシー）
CREATE POLICY "Allow all operations" ON squat_sessions
  FOR ALL USING (true) WITH CHECK (true);
```

### 1.3 リアルタイム有効化
**SQL Editor** で以下を実行：

```sql
-- Realtimeにテーブルを追加
ALTER PUBLICATION supabase_realtime ADD TABLE squat_sessions;
```

> [!TIP]
> これで `squat_sessions` テーブルの変更がリアルタイムで配信されるようになります。

### 1.4 API情報の取得
1. **Settings** → **API** を開く
2. 以下をメモ：
   - **Project URL**: `https://xxxxxxxx.supabase.co`
   - **anon public key**: `eyJhbGci...`

---

## 🧩 Step 2: Chrome拡張機能の設定

### 2.1 Supabase情報を設定
`chrome-extension/content.js` を開き、以下を編集：

```javascript
const SUPABASE_URL = 'https://xxxxxxxx.supabase.co';  // ← あなたのURL
const SUPABASE_ANON_KEY = 'eyJhbGci...';  // ← あなたのキー
```

### 2.2 スマホアプリURLを設定（後で）
```javascript
const SMARTPHONE_APP_URL = 'http://192.168.1.xxx:3000';  // ← 後で設定
```

### 2.3 拡張機能をインストール
1. Chromeで `chrome://extensions` を開く
2. 右上の「**デベロッパーモード**」をオン
3. 「**パッケージ化されていない拡張機能を読み込む**」をクリック
4. `chrome-extension` フォルダを選択

---

## 📱 Step 3: スマホアプリの設定

### 3.1 Supabase情報を設定
`smartphone-app/app.js` を開き、以下を編集：

```javascript
const SUPABASE_URL = 'https://xxxxxxxx.supabase.co';  // ← あなたのURL
const SUPABASE_ANON_KEY = 'eyJhbGci...';  // ← あなたのキー
```

### 3.2 ローカルサーバーで起動

```bash
cd smartphone-app

# 方法A: npx serve を使用
npx -y serve -l 3001

# 方法B: Python を使用
python -m http.server 3001
```

### 3. Supabase Secrets の設定
```bash
supabase secrets set STRIPE_SECRET_KEY=sk_test_...
supabase secrets set STRIPE_WEBHOOK_SECRET=whsec_...
supabase secrets set STRIPE_PRICE_ID=price_...
```

### 4. メール認証の設定 (重要)
開発中、Supabaseのデフォルトのメール送信制限（3通/時）に掛かるのを避けるため、以下の設定を推奨します。

#### 開発時 (認証スキップ)
1. **Supabase Dashboard** > **Authentication** > **Providers** > **Email** を開く。
2. **Confirm email** を **OFF** にして保存。
   - これにより、新規登録直後に自動ログインできるようになります。

#### 本番運用時 (認証有効化)
1. **Confirm email** を **ON** に戻す。
2. カスタムのSMTPサーバー（SendGrid, Resend等）を設定して制限を解除してください。

### 3.3 PCのローカルIPを確認

```bash
# Windows
ipconfig
# → IPv4 アドレス: 192.168.1.xxx

# Mac/Linux
ifconfig | grep inet
```

### 3.4 Chrome拡張機能のURLを更新
`chrome-extension/content.js` の `SMARTPHONE_APP_URL` を更新：
```javascript
const SMARTPHONE_APP_URL = 'http://192.168.1.xxx:3001';
```

拡張機能を再読み込み（リロードボタン）

---

## ✅ Step 4: テスト

### 4.1 PCでテスト
1. YouTubeにアクセス（youtube.com）
2. ブロック画面が表示されることを確認
3. セッションIDとQRコードが表示される

### 4.2 スマホでテスト
1. QRコードをスキャン または 直接URLにアクセス
2. セッションIDを入力（または自動入力）
3. カメラを許可
4. スクワットを5回実行
5. 「PCをアンロック」ボタンをタップ

### 4.3 連携確認
- PC側のブロック画面が自動で解除されることを確認

---

## 🔧 トラブルシューティング

### カメラが起動しない
- HTTPSまたはlocalhostでアクセスしているか確認
- ブラウザのカメラ許可を確認

### スクワットがカウントされない
- 全身がカメラに映っているか確認
- 明るい場所で試す
- 深くしゃがむ（膝角度130度以下）

### PCが解除されない
- Supabaseの設定を確認
- ブラウザのコンソールでエラーを確認（F12）
- 拡張機能を再読み込み

---

## 📁 ファイル構成

```
THE TOLL/
├── chrome-extension/           # Chrome拡張機能
│   ├── manifest.json
│   ├── content.js             # メインロジック（←Supabase設定）
│   ├── overlay.css
│   ├── lib/
│   │   ├── qrcode.min.js
│   │   └── supabase.min.js
│   └── icons/
│       ├── icon48.png
│       └── icon128.png
│
├── smartphone-app/             # スマホWebアプリ
│   ├── index.html
│   ├── app.js                 # メインロジック（←Supabase設定）
│   └── style.css
│
└── SETUP.md                   # このファイル
```

---

## 🎉 完成！

これで「スクワット5回でYouTubeアンロック」のプロトタイプが動作します！
