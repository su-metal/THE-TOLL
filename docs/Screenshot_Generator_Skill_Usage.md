# Screenshot Generator Skill 使い方ガイド

このプロジェクトで作成した `Screenshot Generator` は、**どのChrome拡張機能プロジェクトでも使用可能な「スキル」** です。
以下の手順で他のプロジェクトにインストール・使用することで、数秒でスクリーンショット作成ツールを立ち上げることができます。

## 1. インストール方法（グローバル展開）

1. 以下のファイルをコピーします：
   `f:\App_dev\THE TOLL\.agent\workflows\screenshot-gen.md`

2. 使用したい（別の）プロジェクトのディレクトリ直下に `.agent\workflows` というフォルダを作成します。
   （既にある場合はその中に入れます）

3. コピーしたファイルを、その `.agent\workflows` フォルダの中に貼り付けます。
   ※ ファイル名を `screenshot-gen.md` としてください。

## 2. 使い方（チャットで呼び出す）

1. 対象プロジェクトでAI（CursorやVS Codeのチャット機能）を開きます。
2. チャット欄にスラッシュコマンドを入力します：

/screenshot-gen

3. 自動的に `tools/screenshot-generator` というフォルダが作成され、HTML/CSSのひな形が配置されます。

## 3. 画像の作成方法（ローカルでの実行）

1. `tools/screenshot-generator` フォルダに、使いたい画像素材（`image_01.png` 〜 `image_05.png`）を入れます。
2. `tools/screenshot-generator/index.html` をエディタで開き、キャッチコピーやテキストを変更します。
3. **ローカルサーバー** を立ち上げます（セキュリティ制限回避のため）。
   ```bash
   python -m http.server
   ```
   ※ Pythonが入っていない場合は `npx serve` などでも可。

4. ブラウザで `http://localhost:8000/tools/screenshot-generator/index.html` を開きます。
5. 各画面の「Zoom / Pan」で位置を調整し、**「📸 Download」ボタン** を押して画像を保存します。
   （1280x800px で自動保存されます）

---
**Tips:**
- `screenshot-gen.md` の中身（HTMLテンプレート部分）を書き換えれば、全プロジェクト共通のデザインテンプレートとして使えます。
- チームで共有すれば、全員が同じクオリティのスクショを一瞬で作れるようになります。
