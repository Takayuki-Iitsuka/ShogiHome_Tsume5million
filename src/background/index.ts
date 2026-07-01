"use strict";

import { app, session, dialog, protocol } from "electron";
import { loadAppSettingsOnce } from "@/background/settings.js";
import {
  getAppLogger,
  LogDestination,
  setLogDestinations,
  shutdownLoggers,
} from "@/background/log.js";
import { isActiveSessionExists, quitAll as usiQuitAll } from "@/background/usi/index.js";
import {
  APP_SCHEME,
  FILE_SCHEME,
  handleApp,
  handleUserFile,
  validateHTTPRequest,
} from "./security/http.js";
import { getPortableExeDir, isDevelopment, isPortable, isTest } from "@/background/proc/env.js";
import { setLanguage, t } from "@/common/i18n/index.js";
import { parseProcessArgs } from "./proc/args.js";
import contextMenu from "electron-context-menu";
import { LogType } from "@/common/log.js";
import { isLogEnabled } from "@/common/settings/app.js";
import { createWindow } from "./window/main.js";
import { invoke as invokeHeadless } from "./headless/invoke.js";
import { setProcessArgs } from "./window/ipc.js";
import { prefetchWindowsLogicalProcessorCount } from "./proc/state.js";

const args = parseProcessArgs(process.argv);
if (args instanceof Error) {
  getAppLogger().error(`Failed to parse headless args: ${args.message}`);
  process.exit(1);
}

switch (args.type) {
  case "gui":
    setProcessArgs(args);
    break;
  case "headless":
    getAppLogger().info("headless mode enabled");
    invokeHeadless(args)
      .then(() => {
        getAppLogger().info("headless operation completed");
        process.exit(0);
      })
      .catch((e) => {
        getAppLogger().error(`Headless operation failed: ${e.message}`);
        process.exit(1);
      });
    break;
}

prefetchWindowsLogicalProcessorCount();

const appSettings = loadAppSettingsOnce();
for (const type of Object.values(LogType)) {
  const destinations: LogDestination[] = isLogEnabled(type, appSettings) ? ["file"] : ["stdout"];
  setLogDestinations(type, destinations, appSettings.logLevel);
}

getAppLogger().info(
  "start main process: %s %s %d",
  process.platform,
  process.execPath,
  process.pid,
);
getAppLogger().info("app: %s %s", app.getName(), app.getVersion(), app.getLocale());
getAppLogger().info("process argv: %s", process.argv.join(" "));
if (isPortable()) {
  getAppLogger().info("portable mode: %s", getPortableExeDir());
}

setLanguage(appSettings.language);

contextMenu({
  showCopyImage: false,
  showCopyLink: false,
  showSelectAll: false,
  showInspectElement: isDevelopment(),
  labels: {
    copy: t.copy,
    cut: t.cut,
    paste: t.paste,
  },
});

if (!appSettings.enableHardwareAcceleration) {
  app.disableHardwareAcceleration();
}
app.enableSandbox();

const quitRetryInterval = 200;
const quitMaxWaitDuration = 5000;
let quitWaitElapsed = 0;
app.on("will-quit", (event) => {
  getAppLogger().info("on will-quit");

  // エンジンプロセスが残っている場合は全て終了する。
  if (isActiveSessionExists()) {
    if (quitWaitElapsed < quitMaxWaitDuration) {
      usiQuitAll();
      // 終了イベントをキャンセルして200ms後にやりなおす。
      event.preventDefault();
      setTimeout(() => {
        quitWaitElapsed += quitRetryInterval;
        app.quit();
      }, quitRetryInterval);
      return;
    }
    dialog.showMessageBoxSync({
      message:
        "一定時間内にエンジンプロセスが終了しませんでした。プロセスの状態を確認してください。\n" +
        "Some engine processes did not exit within a certain period. Please check the process status.",
    });
  }

  // プロセスを終了する前にログファイルの出力を完了する。
  shutdownLoggers();
});

function onMainWindowClosed() {
  app.quit();
}

app.on("web-contents-created", (_, contents) => {
  contents.on("will-navigate", (event) => {
    event.preventDefault();
  });
  contents.on("will-attach-webview", (event) => {
    event.preventDefault();
  });
  contents.setWindowOpenHandler(() => {
    return { action: "deny" };
  });
});

async function installElectronDevTools() {
  const installer = await import("electron-devtools-installer");
  await installer.default(installer.VUEJS_DEVTOOLS);
}

protocol.registerSchemesAsPrivileged([APP_SCHEME, FILE_SCHEME]);

app.whenReady().then(() => {
  protocol.handle(APP_SCHEME.scheme, handleApp);
  protocol.handle(FILE_SCHEME.scheme, handleUserFile);

  if (isDevelopment()) {
    getAppLogger().info("install Vue3 Dev Tools");
    // Install Vue DevTools
    installElectronDevTools().catch((e) => {
      getAppLogger().error(`failed to install Vue.js devtools: ${e}`);
      throw e;
    });
  }

  session.defaultSession.webRequest.onBeforeRequest((details, callback) => {
    // Electron 42.2.0 以降では検査後に発行しなおした net.fetch のリクエストも入ってくるようになったため
    // webContentsId が存在する場合のみ URL を検査する。
    if (details.webContentsId !== undefined) {
      validateHTTPRequest(details.method, details.url);
    }
    callback({});
  });

  // Do not create a window in headless mode.
  if (args.type === "headless") {
    return;
  }
  createWindow(onMainWindowClosed);
});

// Exit cleanly on request from parent process in development mode.
if (isDevelopment() || isTest()) {
  process.on("message", (data) => {
    if (data === "graceful-exit") {
      getAppLogger().info("on graceful-exit message");
      app.quit();
    }
  });
}
