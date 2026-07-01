import path from "node:path";
import { getAppPath } from "@/background/proc/path-electron.js";
import { shell } from "electron";
import { escapeWinArg } from "./escape.js";
import { resolveConflictFilePath } from "./filename.js";

export async function createDesktopShortcut(name: string, args: string[]) {
  const desktopPath = getAppPath("desktop");
  await createWindowsShortcut(desktopPath, name, args);
}

async function createWindowsShortcut(dirname: string, name: string, args: string[]) {
  const shortcutPath = await resolveConflictFilePath(path.join(dirname, `${name}.lnk`));
  const safeArgs = args.map(escapeWinArg).join(" ");
  const ok = shell.writeShortcutLink(shortcutPath, {
    target: process.execPath,
    args: safeArgs,
    cwd: process.cwd(),
    description: "Start ShogiHome with custom options",
  });
  if (!ok) {
    throw new Error(`Failed to create shortcut: ${shortcutPath}`);
  }
}
