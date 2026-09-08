import path from "node:path";
import fs from "node:fs";
import { getTempPathForTesting } from "@/background/proc/env.js";
import {
  buildIndex,
  getLines,
  getRandomLines,
  clearIndexCache,
  isIndexCached,
} from "@/background/file/tsumeDatabase.js";

const tmpdir = path.join(getTempPathForTesting(), "tsumeDatabase");

// テスト用にSFEN行を書き出し、そのパスを返す。
function writeSfenFile(
  name: string,
  lines: string[],
  opts?: { bom?: boolean; trailingNewline?: boolean; eol?: "\n" | "\r\n" },
): string {
  fs.mkdirSync(tmpdir, { recursive: true });
  const filePath = path.join(tmpdir, name);
  const eol = opts?.eol ?? "\n";
  const body = lines.join(eol) + (opts?.trailingNewline === false ? "" : eol);
  const content = opts?.bom ? "﻿" + body : body;
  fs.writeFileSync(filePath, content, "utf-8");
  return filePath;
}

describe("tsumeDatabase", () => {
  beforeEach(() => {
    clearIndexCache();
  });

  it("buildIndex は総行数を返し、キャッシュされる", async () => {
    const filePath = writeSfenFile("count.sfen", ["a", "b", "c"]);
    expect(isIndexCached(filePath)).toBe(false);
    expect(await buildIndex(filePath)).toBe(3);
    expect(isIndexCached(filePath)).toBe(true);
  });

  it("buildIndex の同時呼び出しは同じ結果を返す", async () => {
    const filePath = writeSfenFile("concurrent.sfen", ["a", "b", "c"]);
    // 構築中のPromiseが共有され、二重走査でも結果が壊れないこと。
    const [count1, count2] = await Promise.all([buildIndex(filePath), buildIndex(filePath)]);
    expect(count1).toBe(3);
    expect(count2).toBe(3);
    expect(isIndexCached(filePath)).toBe(true);
  });

  it("空ファイルは総行数0となり、getLines は空文字列を返す", async () => {
    const filePath = path.join(tmpdir, "empty.sfen");
    fs.mkdirSync(tmpdir, { recursive: true });
    fs.writeFileSync(filePath, "");
    expect(await buildIndex(filePath)).toBe(0);
    expect(await getLines(filePath, [1])).toEqual([""]);
  });

  it("getLines は指定行を取得し、範囲外は空文字列を返す", async () => {
    const filePath = writeSfenFile("lines.sfen", ["one", "two", "three"]);
    expect(await getLines(filePath, [1, 3])).toEqual(["one", "three"]);
    // 順不同・範囲外を含む要求
    expect(await getLines(filePath, [3, 1, 0, 4])).toEqual(["three", "one", "", ""]);
  });

  it("getLines は末尾に改行が無い最終行も正しく取得する", async () => {
    const filePath = writeSfenFile("no-eol.sfen", ["first", "last"], { trailingNewline: false });
    expect(await buildIndex(filePath)).toBe(2);
    expect(await getLines(filePath, [2])).toEqual(["last"]);
  });

  it("getLines はBOM付きファイルの先頭行を正しく取得する", async () => {
    const filePath = writeSfenFile("bom.sfen", ["alpha", "beta", "gamma"], { bom: true });
    expect(await buildIndex(filePath)).toBe(3);
    expect(await getLines(filePath, [1, 2, 3])).toEqual(["alpha", "beta", "gamma"]);
  });

  // 実データは CRLF・BOMなし（specs/technologies.md 参照）
  it("getLines はCRLF・BOMなしファイル（実データ形式）の各行を正しく取得する", async () => {
    const filePath = writeSfenFile("crlf.sfen", ["one", "two", "three"], { eol: "\r\n" });
    expect(await buildIndex(filePath)).toBe(3);
    // CR が残らず除去されること
    expect(await getLines(filePath, [1, 2, 3])).toEqual(["one", "two", "three"]);
  });

  it("getLines はCRLF+BOMファイルの先頭行を正しく取得する", async () => {
    const filePath = writeSfenFile("crlf-bom.sfen", ["alpha", "beta"], {
      eol: "\r\n",
      bom: true,
    });
    expect(await buildIndex(filePath)).toBe(2);
    expect(await getLines(filePath, [1, 2])).toEqual(["alpha", "beta"]);
  });

  it("getLines はCRLF・末尾改行なしの最終行も正しく取得する", async () => {
    const filePath = writeSfenFile("crlf-no-eol.sfen", ["first", "last"], {
      eol: "\r\n",
      trailingNewline: false,
    });
    expect(await buildIndex(filePath)).toBe(2);
    expect(await getLines(filePath, [1, 2])).toEqual(["first", "last"]);
  });

  it("getRandomLines は count 件を昇順の行番号で返す", async () => {
    const lines = Array.from({ length: 100 }, (_, i) => `line${i + 1}`);
    const filePath = writeSfenFile("random.sfen", lines);
    const { sfens, lineNumbers } = await getRandomLines(filePath, 5);
    expect(sfens).toHaveLength(5);
    expect(lineNumbers).toHaveLength(5);
    // 昇順であること
    expect([...lineNumbers].sort((a, b) => a - b)).toEqual(lineNumbers);
    // SFENと行番号が対応していること
    for (let i = 0; i < lineNumbers.length; i++) {
      expect(sfens[i]).toBe(`line${lineNumbers[i]}`);
    }
  });

  it("getRandomLines は count が総行数以上なら全件を返す", async () => {
    const filePath = writeSfenFile("small.sfen", ["x", "y"]);
    const { sfens, lineNumbers } = await getRandomLines(filePath, 10);
    expect(lineNumbers).toEqual([1, 2]);
    expect(sfens).toEqual(["x", "y"]);
  });

  it("getRandomLines は総行数に近い件数でも重複なく返す", async () => {
    const lines = Array.from({ length: 10 }, (_, i) => `line${i + 1}`);
    const filePath = writeSfenFile("near-full.sfen", lines);
    const { sfens, lineNumbers } = await getRandomLines(filePath, 9);
    expect(lineNumbers).toHaveLength(9);
    expect(new Set(lineNumbers).size).toBe(9); // 重複がないこと
    expect(lineNumbers.every((n) => n >= 1 && n <= 10)).toBe(true);
    for (let i = 0; i < lineNumbers.length; i++) {
      expect(sfens[i]).toBe(`line${lineNumbers[i]}`);
    }
  });

  it("getRandomLines は count が0なら空を返す", async () => {
    const filePath = writeSfenFile("zero.sfen", ["a", "b"]);
    const { sfens, lineNumbers } = await getRandomLines(filePath, 0);
    expect(lineNumbers).toEqual([]);
    expect(sfens).toEqual([]);
  });

  it("getRandomLines は空ファイルでも空を返す", async () => {
    const filePath = path.join(tmpdir, "random-empty.sfen");
    fs.mkdirSync(tmpdir, { recursive: true });
    fs.writeFileSync(filePath, "");
    const { sfens, lineNumbers } = await getRandomLines(filePath, 1);
    expect(lineNumbers).toEqual([]);
    expect(sfens).toEqual([]);
  });

  it("getRandomLines は全ての行が選ばれ得る", async () => {
    const lines = Array.from({ length: 5 }, (_, i) => `line${i + 1}`);
    const filePath = writeSfenFile("uniform.sfen", lines);
    const seen = new Set<number>();
    // 1件抽出を繰り返せば、5行なら十分な試行回数で全行が少なくとも1回は選ばれる。
    for (let i = 0; i < 100; i++) {
      const { lineNumbers } = await getRandomLines(filePath, 1);
      expect(lineNumbers).toHaveLength(1);
      seen.add(lineNumbers[0]);
    }
    expect([...seen].sort((a, b) => a - b)).toEqual([1, 2, 3, 4, 5]);
  });
});
