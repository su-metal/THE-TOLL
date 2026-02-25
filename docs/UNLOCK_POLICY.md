# THE TOLL Unlock Policy (Confirmed Spec)

Last updated: 2026-02-17

## 1. Goal
設定の骨抜き（例: 低負荷で長時間解放）を防ぎ、`THE TOLL = 払った分だけ通れる` を一貫したUXとして実装する。

## 2. Preset-Only Unlock (No Free Numeric Input)
解除条件は自由入力を廃止し、以下のプリセットから選択する。

| Preset | Reps | Unlock Duration |
|---|---:|---:|
| LIGHT | 10 | 10 min |
| STANDARD | 20 | 20 min |
| HARD | 40 | 40 min |
| EXTREME | 60 | 60 min |

## 3. Free / Pro Entitlement
- Free: `LIGHT`, `STANDARD`
- Pro: `LIGHT`, `STANDARD`, `HARD`, `EXTREME`

## 4. Settings Guard (Keep Current)
- 設定変更にはミッション解除が必要。
- ガード解除は `15 reps` 完了後に `15分` 有効。

## 5. Apply Timing
プリセット変更は常に即時適用。

- 変更直後に active preset を更新
- content script互換キー (`target_squat_count`, `lock_duration_min`) も即時同期

遅延適用（cooldown）は採用しない。

## 6. UI Requirements (Must Show)
設定画面に以下を常時表示する。

- 現在有効のプリセット
- 「Settings Guard解除後、プリセット変更は即時反映」の注記

## 7. Storage Model (Implementation Contract)
想定キー（`chrome.storage.local`）:

- `toll_unlock_preset_active`: `light|standard|hard|extreme`
- `toll_unlock_preset_pending`: `null`（旧仕様との互換クリア用）
- `target_squat_count`: content script互換のため active preset 由来の値を保持
- `lock_duration_min`: content script互換のため active preset 由来の値を保持

## 8. Implementation Order
1. **Phase 1: Preset UI/Logic**
   - 自由入力を廃止し、プリセット選択UIに置換
   - Free/Proで選択可能プリセットを制限
   - active preset から `target_squat_count` / `lock_duration_min` を同期
2. **Phase 2: UX Feedback**
   - 現在有効プリセット表示
   - 即時反映ポリシー文言を表示
3. **Phase 3: Verification**
   - Free/Pro境界テスト
   - 設定ガード解除中の動作確認
   - content overlay で実際の解除回数・解放時間反映確認

## 9. Out of Scope (This Spec)
- 新しい運動種目追加（スクワット以外）
- サーバー側のunlock判定ロジック変更
