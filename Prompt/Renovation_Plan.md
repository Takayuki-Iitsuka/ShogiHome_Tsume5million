# 詰将棋500万問データベース ShogiHome組み込み 改修計画

## 概要

やねうら王公式が公開した詰将棋500万問データ（`C:\Shougi\Tume\mate3_5_7_9_11\`）を、
ShogiHomeのGUI上から直接選択・閲覧・解答できるようにする改修。

参考実装: `C:\Users\etsuk\source\repos\extract_sfen`（C言語製CLIツール）を参考に、
ShogiHome内にTypeScript/Electronネイティブな詰将棋DBビューアを組み込む。

---

## データ仕様

| ファイル      | 問題数          | サイズ        |
| ------------- | --------------- | ------------- |
| `mate3.sfen`  | 998,404 問      | 78 MB         |
| `mate5.sfen`  | 998,824 問      | 78 MB         |
| `mate7.sfen`  | 999,071 問      | 78 MB         |
| `mate9.sfen`  | 999,672 問      | 78 MB         |
| `mate11.sfen` | 999,998 問      | 78 MB         |
| **合計**      | **約 500 万問** | **約 390 MB** |

- 形式: SFEN（1行1局面）`<盤面> <手番> <持ち駒> <手数>`
- 元ソース: https://yaneuraou.yaneu.com/2020/12/25/christmas-present/

---

## 設計方針

### 大容量ファイルへの効率アクセス

78MB × 5 ファイル = 約390MBのSFENファイルを全件メモリに読み込むのは非現実的。
そのため、**バイトオフセットインデックス**を使用する:

1. 初回アクセス時にファイルを先頭から走査してオフセットを記録（8バイト × 約100万 = 約8MB/ファイル）
2. 以降の任意行アクセスはO(1)のファイルシークで実現
3. インデックスはプロセスメモリにキャッシュ（アプリ再起動で再構築）

### ランダム選択

リザーバーサンプリング（Algorithm R）でO(n)の1パス処理により、
インデックスを使って任意件数をランダムに取得する。

---

## 変更ファイル一覧

| ファイル                                           | 種別         | 変更内容                                 |
| -------------------------------------------------- | ------------ | ---------------------------------------- |
| `src/common/settings/app.ts`                       | 既存修正     | `tsumeDataDirectory: string` を追加      |
| `src/common/ipc/channel.ts`                        | 既存修正     | 詰将棋DB用IPCチャネル4つを追加           |
| `src/common/i18n/text_template.ts`                 | 既存修正     | 詰将棋DB関連文字列の型定義を追加         |
| `src/common/i18n/locales/ja.ts`                    | 既存修正     | 日本語テキストを追加                     |
| `src/common/i18n/locales/en.ts`                    | 既存修正     | 英語テキストを追加                       |
| `src/background/file/tsumeDatabase.ts`             | **新規作成** | バイトオフセットインデックス管理クラス   |
| `src/background/window/ipc.ts`                     | 既存修正     | 詰将棋DB用IPCハンドラ4つを追加           |
| `src/renderer/ipc/bridge.ts`                       | 既存修正     | Bridge インターフェースにメソッド追加    |
| `src/renderer/ipc/preload.ts`                      | 既存修正     | Electron IPC 実装を追加                  |
| `src/renderer/ipc/web.ts`                          | 既存修正     | Web版スタブを追加                        |
| `src/renderer/store/settings.ts`                   | 既存修正     | `tsumeDataDirectory` ゲッターを追加      |
| `src/renderer/store/index.ts`                      | 既存修正     | ダイアログ表示フラグと操作メソッドを追加 |
| `src/renderer/view/dialog/TsumeDatabaseDialog.vue` | **新規作成** | 詰将棋DBダイアログUI                     |
| `src/renderer/view/menu/FileMenu.vue`              | 既存修正     | 「詰将棋DB」メニュー項目を追加           |
| `src/renderer/view/App.vue`                        | 既存修正     | ダイアログ表示条件を追加                 |

---

## 追加IPCチャネル

| チャネル              | 方向 | 機能                                                             |
| --------------------- | ---- | ---------------------------------------------------------------- |
| `openTsumeDirectory`  | R→B  | フォルダ選択ダイアログを表示し、選択パスを返す                   |
| `buildTsumeIndex`     | R→B  | SFENファイルのバイトオフセットインデックスを構築し、総行数を返す |
| `getTsumeLines`       | R→B  | 指定行番号のSFEN文字列リストを返す                               |
| `getRandomTsumeLines` | R→B  | リザーバーサンプリングでランダム行のSFEN文字列を返す             |

---

## UIフロー

1. ファイルメニュー →「詰将棋DB」をクリック
2. `TsumeDatabaseDialog` が開く
3. **初回のみ**: 詰将棋データフォルダを選択するよう促す
4. 手数を選択（3/5/7/9/11手詰め）
5. インデックス構築中は「構築中...」を表示
6. 問題番号を入力 or「ランダム」ボタンで問題を選択
7. 「◀」「▶」で前後の問題に移動
8. **「盤面に設定」**で現在の将棋盤に詰将棋局面を展開
9. 既存の詰将棋探索（MateSearch）で解答が可能

---

## 検証方法

1. `npm run electron:serve` でElectronアプリを起動
2. ファイルメニュー →「詰将棋DB」ボタンが表示されることを確認
3. 初回: フォルダ未設定 → フォルダ選択ダイアログが出ることを確認
4. `C:\Shougi\Tume\mate3_5_7_9_11` を選択後、手数ボタンが機能することを確認
5. 「ランダム」ボタン → 詰将棋問題が表示されることを確認
6. 「盤面に設定」→ 主将棋盤に詰将棋局面が設定されることを確認
7. 問題番号を手動入力して前後ナビが機能することを確認
8. `npm run lint` で型エラー・Lintエラーがないことを確認
