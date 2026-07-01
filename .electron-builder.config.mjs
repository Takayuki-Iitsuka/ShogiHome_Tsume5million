import fs from "node:fs";
import path from "node:path";

/**
 * @type {import('electron-builder').Configuration}
 * @see https://www.electron.build/configuration
 */
const config = {
  productName: "ShogiHome Tsume5million",
  extraMetadata: {
    main: "dist/packed/background.js",
  },
  extends: null,
  files: [
    "dist/assets",
    "dist/arrow",
    "dist/board",
    "dist/character",
    "dist/icon",
    "dist/piece",
    "dist/sound",
    "dist/stand",
    "dist/index.html",
    "dist/prompt.html",
    "dist/monitor.html",
    "dist/layout-manager.html",
    "dist/packed",
    "!node_modules/**/*",
  ],
  afterPack: async function (context) {
    await removeUnnecessaryFiles(context.appOutDir);
  },
  win: {
    fileAssociations: {
      name: "Kifu",
      ext: ["kif", "kifu", "ki2", "ki2u", "csa", "jkf"],
    },
  },
  nsis: {
    allowElevation: false,
    packElevateHelper: false,
  },
  publish: null,

  // https://www.electronjs.org/docs/latest/tutorial/fuses
  electronFuses: {
    runAsNode: false, // 任意の JavaScript コードの実行を防止 (Default: true)
    //enableCookieEncryption: true, // Cookieの暗号化を有効化 (Default: false)
    enableNodeOptionsEnvironmentVariable: false, // Node.js の特別な環境変数を無効化 (Default: true)
    enableNodeCliInspectArguments: false, // --inspect などの引数を無効化 (Default: true)
    enableEmbeddedAsarIntegrityValidation: true, // ASAR の整合性検証を有効化 (Default: false)
    onlyLoadAppFromAsar: true, // ASAR 以外からのアプリケーションコードの読み込みを防止 (Default: false)
    //loadBrowserProcessSpecificV8Snapshot: true, // ブラウザープロセスのスナップショットを分離 (Default: false)
    grantFileProtocolExtraPrivileges: false, // 本番環境ではカスタムスキームを使用するため不要 (Default: true)
  },
};

export default config;

async function removeUnnecessaryFiles(appOutDir) {
  const localeDir = path.join(appOutDir, "locales");
  for (const file of await fs.promises.readdir(localeDir)) {
    switch (file) {
      case "en-US.pak":
      case "ja.pak":
        break;
      default:
        await fs.promises.unlink(path.join(localeDir, file));
        break;
    }
  }
}
