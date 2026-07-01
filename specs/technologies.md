# 技術スタック一覧

ShogiHome Tsume5million で使用している言語・ライブラリ・フレームワーク等の一覧。

## TypeScript 7.0 移行方針

2026年（皇紀2686年・令和8年）7月時点では、TypeScript 7.0 は移行予定の target として扱う。
stable 版が公開されるまでは `typescript@next` または release candidate で検証し、production 依存として固定しない。

移行時は TypeScript 単体ではなく、`vue-tsc`、`typescript-eslint`、`@typescript-eslint/*`、`@vue/eslint-config-typescript` を同時に更新する。
renderer は Vite 前提の `moduleResolution: "Bundler"` を維持し、Electron background / preload / command は `NodeNext` 化を検証する。

## Package Manager / Runtime 方針

| 技術 | 状態     | 用途                                                        |
| ---- | -------- | ----------------------------------------------------------- |
| npm  | 正本     | release build、既存 lockfile、CI 互換                       |
| Bun  | 評価対象 | package install、script runner、TypeScript 開発体験の高速化 |

Bun は npm の即時置換ではない。
`bun run serve`、`bun run build`、`bun run test`、`bun run electron:serve`、`bun run electron:compile-all` が npm と同等に通ることを正式採用条件とする。

## 言語

| 言語             | バージョン          | 用途                                                                      |
| ---------------- | ------------------- | ------------------------------------------------------------------------- |
| TypeScript       | ^5.9.3 / 7.0 target | 全ソースコード（renderer / background / common）。7.0 stable 公開後に固定 |
| JavaScript (ESM) | —                   | 設定ファイル・スクリプト類                                                |
| Vue SFC          | —                   | フロントエンドコンポーネント（`.vue` ファイル）                           |
| CSS              | —                   | スタイルシート                                                            |

## ランタイム・プラットフォーム

| 技術     | バージョン    | 用途                                                             |
| -------- | ------------- | ---------------------------------------------------------------- |
| Electron | ^42.5.0       | デスクトップアプリのホスト（Windows のみ）                       |
| Node.js  | Electron 内蔵 | バックグラウンドプロセス（IPC・ファイルアクセス）                |
| Chromium | Electron 内蔵 | レンダラープロセス（UI描画）                                     |
| Bun      | 評価対象      | package manager / script runner。正式採用までは npm を正本にする |

## フロントエンドフレームワーク

| 技術            | バージョン | 用途                                                            |
| --------------- | ---------- | --------------------------------------------------------------- |
| Vue 3           | ^3.5.31    | UIフレームワーク（Composition API / `<script setup>` スタイル） |
| Vite            | ^8.1.0     | Web アプリビルド・開発サーバー                                  |
| vite-plugin-pwa | ^1.3.0     | Progressive Web App 対応                                        |
| Webpack         | ^5.107.2   | Electron main/preload プロセスのバンドル                        |
| webpack-cli     | ^7.0.3     | Webpack CLI                                                     |

## 将棋ロジック

| 技術    | バージョン | 用途                                 |
| ------- | ---------- | ------------------------------------ |
| tsshogi | ^2.3.4     | 将棋のルール・棋譜処理コアライブラリ |

## エンジンプロトコル

| プロトコル                      | 用途                           |
| ------------------------------- | ------------------------------ |
| USI (Universal Shogi Interface) | 将棋エンジンとの通信           |
| CSA プロトコル                  | オンライン対局サーバーとの通信 |

## テスト

| 技術                | バージョン | 用途                                     |
| ------------------- | ---------- | ---------------------------------------- |
| Vitest              | ^4.1.9     | 単体テストフレームワーク                 |
| @vitest/coverage-v8 | ^4.1.9     | カバレッジレポート生成                   |
| @vitest/ui          | ^4.1.9     | インタラクティブ UI でテスト実行         |
| @vue/test-utils     | ^2.2.1     | Vue コンポーネントのテストユーティリティ |
| jsdom               | ^29.0.2    | ブラウザ環境シミュレーション             |

## コード品質

| 技術                 | バージョン | 用途                               |
| -------------------- | ---------- | ---------------------------------- |
| ESLint               | ^9.39.4    | 静的解析                           |
| @typescript-eslint   | ^8.62.0    | TypeScript 向け ESLint ルール      |
| eslint-plugin-vue    | ^10.9.2    | Vue 向け ESLint ルール             |
| eslint-plugin-import | ^2.29.1    | import 順序・循環参照チェック      |
| Prettier             | ^3.8.4     | コードフォーマッター（1行100文字） |
| vue-tsc              | ^3.2.5     | Vue + TypeScript の型チェック      |

## TypeScript 7.0 移行時の検証コマンド

```bash
npm run lint
npm test
npm run build
npm run electron:compile-all
```

Bun 評価時は同じ script 名を維持して以下も確認する。

```bash
bun run lint
bun run test
bun run build
bun run electron:compile-all
```

## 国際化 (i18n)

独自実装。対応言語:

| 言語    | ファイル                        | メンテナー |
| ------- | ------------------------------- | ---------- |
| 日本語  | `src/common/i18n/locales/ja.ts` | 開発者     |
| English | `src/common/i18n/locales/en.ts` | 開発者     |

## 詰将棋データセット

| 項目         | 内容                                                      |
| ------------ | --------------------------------------------------------- |
| 出典         | やねうら王「クリスマスプレゼント 2020」                   |
| URL          | https://yaneuraou.yaneu.com/2020/12/25/christmas-present/ |
| 公開日       | 2020年12月25日（皇紀2680年・令和2年）                     |
| ファイル形式 | SFEN テキスト（1行1局面、CRLF、BOMなし）                  |
| 収録問題数   | 約500万問（3/5/7/9/11手詰め 各約100万問）                 |
| 配置場所     | プロジェクトの1階層上 `mate3_5_7_9_11\`                   |

## 主要依存ライブラリ（runtime）

| ライブラリ             | バージョン | 用途                                    |
| ---------------------- | ---------- | --------------------------------------- |
| @bufbuild/protobuf     | ^2.12.1    | Protocol Buffers 実装                   |
| @github/hotkey         | ^3.1.4     | キーボードショートカットの処理          |
| async-lock             | ^1.4.0     | 非同期処理のロック（順序保証）          |
| chart.js               | ^4.5.1     | グラフ描画                              |
| dayjs                  | ^1.11.21   | 日付処理                                |
| electron-context-menu  | ^4.1.2     | コンテキストメニュー（右クリック）生成 |
| encoding-japanese      | ^2.0.0     | 文字コード変換（Shift-JIS等）           |
| jimp                   | ^1.6.1     | 画像処理                                |
| log4js                 | ^6.7.0     | ログ出力（background プロセス）         |
| proper-lockfile        | ^4.1.2     | ファイル排他ロック                      |
| semver                 | ^7.8.5     | セマンティックバージョン比較            |
| splitpanes             | ^4.0.3     | ペイン分割 UI                           |
| yaml                   | ^2.9.0     | YAML パーサー                           |

## ビルド・パッケージング / 開発ユーティリティ

| 技術             | バージョン | 用途                                                       |
| ---------------- | ---------- | ---------------------------------------------------------- |
| electron-builder | ^26.15.3   | Windows 用デスクトップアプリのパッケージ・配布パッケージ作成 |
| concurrently     | ^9.2.3     | 開発起動時に Vite と Electron などの複数プロセスを同時実行 |
| tsx              | ^4.22.4    | TypeScript スクリプトをコンパイルなしで直接実行            |
