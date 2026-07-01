# TypeScript 7.0 移行・依存更新計画

## 概要

ShogiHome Tsume5million を TypeScript 7.0 対応へ移行するための実装計画。
対象は開発基盤、型検査、ビルド、テスト、利用者向け文書、開発者向け文書であり、詰将棋DB機能や将棋ロジックの仕様変更は含めない。

2026年（皇紀2686年・令和8年）7月時点では TypeScript 7.0 の stable 版は未確定として扱う。
公開前は `typescript@next` または release candidate で検証し、production で固定するのは stable 公開後とする。

## 現行構成

| 分類       | 現行                | 用途                                     |
| ---------- | ------------------- | ---------------------------------------- |
| TypeScript | `^5.9.3`            | renderer / background / common / scripts |
| Vue        | `^3.5.31`           | UI component                             |
| Vite       | `^8.1.0`            | renderer / PWA build                     |
| Vitest     | `^4.1.9`            | unit test / coverage                     |
| Electron   | `^42.5.0`           | desktop app runtime                      |
| Webpack    | `^5.107.2`          | Electron preload / command bundle        |
| npm        | `package-lock.json` | canonical package manager                |
| Bun        | `bun.lock`          | 評価中の package manager / script runner |

## 移行方針

1. TypeScript 7.0 は stable 公開後に `package.json` へ固定する。
2. `vue-tsc`、`typescript-eslint`、`@typescript-eslint/*`、`@vue/eslint-config-typescript` は TypeScript と同時に更新する。
3. renderer 側は現行の `moduleResolution: "Bundler"` を維持し、Vite に最適化した解決規則を継続する。
4. Electron background / preload / command 側は `NodeNext` 化を検証するが、import 拡張子や CommonJS 出力に破壊的差分が出る場合は現行構成を維持する。
5. Bun は即時全面移行せず、まず package manager と script runner として評価する。
6. npm は release build の正本として残し、Bun の採用判定が終わるまで `package-lock.json` を削除しない。

## Bun 評価基準

Bun を正式採用する条件は以下をすべて満たすこと。

- `bun install --frozen-lockfile` が Windows で安定する。
- `bun run serve`、`bun run build`、`bun run test` が npm と同等に通る。
- `bun run electron:serve` と `bun run electron:compile-all` が Electron の install 処理を含めて通る。
- native dependency、Electron download、license report、release script で npm と差分がない。
- CI で npm と Bun のどちらを正本にするかを明文化できる。

採用条件を満たすまでは、README には Bun 優先候補と npm fallback を併記する。

## 実装ステップ

### Phase 1: baseline 固定

- `npx vue-tsc --noEmit`: 成功。
- `npx tsc --project .\tsconfig.bg.json --noEmit`: 成功。
- `npx vitest run`: 失敗。主な既知要因は CRLF / LF 改行差分、`file:///...` asset path、`release-win.json` 404、一部 timeout。
- `npm outdated --depth=0` で依存更新候補を一覧化済み。
- Context7 で TypeScript docs を確認し、TypeScript 7.0 stable は確認できなかったため `typescript@^5.9.3` を維持する。

### Phase 2: TypeScript 7.0 準備

- `tsconfig.json` を renderer / tests / scripts 向けの no-emit 型検査基盤として整理する。
- `tsconfig.bg.json` は Electron background 専用として扱い、必要なら Electron 用 config を追加する。
- `tsconfig.webpack.json` は Electron preload / command bundle 用として扱い、webpack の `ts-loader` では emit を許可する。
- `skipLibCheck` は初期移行では維持し、依存更新後に外せるかを別途判断する。
- `@/*` path alias は維持する。

### Phase 3: 依存更新

- TypeScript 本体は更新しない。
- `@typescript-eslint/eslint-plugin`、`@typescript-eslint/parser`、`typescript-eslint`、`@vue/eslint-config-typescript` を compatible patch / minor へ更新する。
- `@bufbuild/protobuf`、Vite、Electron、ESLint、`eslint-plugin-vue`、`globals`、`ts-loader` を compatible patch / minor へ更新する。
- major update の TypeScript 6.x、ESLint 10、Archiver 8、Concurrently 10 は今回固定しない。
- Webpack / ts-loader は Electron preload と command bundle の互換性を確認してから追加更新する。
- Webpack を外す場合は Vite library build または esbuild への置換を別計画に分ける。

### Phase 4: Bun 評価導入

- `bun.lock` を生成し、npm と Bun の二重検証期間を設ける。
- `package.json` の script 名は変更しない。
- README と CONTRIBUTING に Bun と npm の両方の手順を載せる。
- release 作業は Bun 採用完了まで npm を正本とする。

### Phase 5: 文書同期

- `specs/technologies.md` の技術一覧を TypeScript 7.0 target 前提へ更新する。
- `README.md` と `README.en.md` の開発手順へ Bun 候補と npm fallback を追記する。
- `CONTRIBUTING.md` に TypeScript 7.0 移行中の検証条件を追記する。
- `src/command/usi-csa-bridge/README.md` に Bun を使う開発時 build 手順を併記する。

## 受け入れ条件

- TypeScript 7.0 stable 固定後に `vue-tsc --noEmit` が通る。
- `npm test` と `bun run test` が同じ test suite を実行できる。
- Electron app の development / package build が npm と Bun のどちらでも同じ成果物構成になる。
- Web app build が `docs/webapp` へ従来どおり出力される。
- README、CONTRIBUTING、`specs/technologies.md` の version 表記が一致する。

## 実装後の検証結果

- `npx vue-tsc --noEmit`: 成功。
- `npx tsc --project .\tsconfig.bg.json --noEmit`: 成功。
- `npx tsc --project .\tsconfig.webpack.json --noEmit`: 成功。
- `npx eslint --max-warnings 0 .`: 成功。
- `npx prettier --check .`: 成功。
- `npm run build`: 成功。
- `npm run electron:compile-all`: 成功。
- `bun install`: 成功。`package-lock.json` から `bun.lock` を生成。
- `bun run build`: 成功。
- `bun run electron:compile-all`: 成功。
- `npx vitest run` / `bun run test`: 失敗。失敗内容は npm と Bun で同等で、既知要因は CRLF / LF 改行差分、`file:///...` asset path、`release-win.json` 404。
- `npm outdated --depth=0`: 残りは TypeScript 6.x、ESLint 10、Archiver 8、Concurrently 10 などの major update のみ。

## 変更しないもの

- 詰将棋DBのデータ仕様。
- SFEN / Packed SFEN / SBK / YBB の format 仕様。
- IPC channel 名。
- user-facing UI flow。
- `package.json` の既存 script 名。
