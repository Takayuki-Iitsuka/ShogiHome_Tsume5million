<img width="200" src="./docs/icon.png" />

# ShogiHome Tsume5million

本家 [ShogiHome](https://github.com/sunfish-shogi/shogihome) をフォークし、
[やねうら王が公開した詰将棋500万問データセット](https://yaneuraou.yaneu.com/2020/12/25/christmas-present/)
を直接 ShogiHome から読み込んで演習できるよう改修したプロジェクトです。

## 詰将棋DB機能

### データファイルの準備

[やねうら王クリスマスプレゼント2020](https://yaneuraou.yaneu.com/2020/12/25/christmas-present/)
から詰将棋500万問データセットをダウンロードし、以下の場所に配置してください。

```
mate3_5_7_9_11\
    mate3.sfen   （3手詰め  約100万問）
    mate5.sfen   （5手詰め  約100万問）
    mate7.sfen   （7手詰め  約100万問）
    mate9.sfen   （9手詰め  約100万問）
    mate11.sfen  （11手詰め 約100万問）
```

### 使い方

1. ShogiHome を起動します（Electron版のみ対応）
2. ファイルメニュー →「詰将棋DB」を選択
3. 初回はデータフォルダを選択します（`mate3_5_7_9_11` ディレクトリ）
4. 手数ボタン（3/5/7/9/11手）を選択するとインデックスを構築します
5. 問題番号を指定するか「ランダム」ボタンで問題を選択します
6. 「盤面に設定」ボタンで将棋盤に問題を読み込みます

後手番の局面は自動的に先手番（攻め方先手）の形に変換されます。

## フォーク元

- 本家リポジトリ: https://github.com/sunfish-shogi/shogihome
- 本家バージョン: v1.28.0 をベースに改修

本プロジェクトは本家の MIT ライセンスのもとで改変・配布しています。

## ShogiHome について

将棋の GUI アプリです。
コンピューターとの対局や棋譜の編集・検討ができます。

[将棋所](http://shogidokoro2.stars.ne.jp/)と同様に [USI プロトコル](http://shogidokoro2.stars.ne.jp/usi.html) 対応の思考エンジンを利用できます。

## 開発

### 必要なもの

- Node.js
- Bun（任意、TypeScript 7.0 移行後の開発基盤候補）

2026年（皇紀2686年・令和8年）7月時点では npm を正本の package manager として扱います。
Bun は高速な install / script runner として評価中であり、release build は npm 手順を基準にします。

### セットアップ

```bash
git clone <このリポジトリ>
cd ShogiHome_Tsume5million
npm ci
```

Bun を使う場合:

```bash
bun install
```

`bun.lock` 作成後の再現インストール:

```bash
bun install --frozen-lockfile
```

### 起動

```bash
# Electron アプリ（詰将棋DB機能あり）
npm run electron:serve

# Web アプリ（詰将棋DB機能なし）
npm run serve
# Standard: http://localhost:5173
# Mobile  : http://localhost:5173/?mobile
```

Bun を使う場合も script 名は同じです。

```bash
bun run electron:serve
bun run serve
```

### ビルド

```bash
# Electron アプリ（インストーラー）
npm run electron:build

# Electron アプリ（Windows ポータブル版）
npm run electron:portable

# Web アプリ
npm run build
```

Bun 評価時:

```bash
bun run electron:build
bun run electron:portable
bun run build
```

### テスト

```bash
npm test
npm run coverage
npm run test:ui
```

Bun 評価時:

```bash
bun run test
bun run coverage
```

### Lint

```bash
npm run lint
```

### TypeScript 7.0 移行メモ

TypeScript 7.0 は stable 版公開後に固定します。
公開前は `typescript@next` または release candidate で検証し、`vue-tsc`、`typescript-eslint`、Vite、Vitest、Electron 関連の互換性を確認します。
詳細は [TypeScript 7.0 移行・依存更新計画](./Prompt/TypeScript7_Migration_Plan.md) と [技術スタック一覧](./specs/technologies.md) を参照してください。

## ライセンス

### ShogiHome Tsume5million / ShogiHome

[MIT License](LICENSE)

### 詰将棋データセット

やねうら王が [Christmas Present 2020](https://yaneuraou.yaneu.com/2020/12/25/christmas-present/) として公開した詰将棋500万問データセットを使用しています。
データセットの権利はやねうら王に帰属します。

### アイコン画像

[/public/icon](https://github.com/sunfish-shogi/shogihome/tree/main/public/icon) 配下のアイコン画像は [Material Icons](https://google.github.io/material-design-icons/) を使用しています。
これには [Apache License 2.0](https://www.apache.org/licenses/LICENSE-2.0.txt) が適用されます。
