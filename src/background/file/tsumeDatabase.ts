import { createReadStream, promises as fs } from "node:fs";
import { getAppLogger } from "@/background/log.js";
import { normalizeSfen } from "@/common/tsume.js";

// 行頭バイトオフセットの一覧と、最終行の終端計算に使うファイルサイズをまとめて保持する。
// 78MB程度のSFENファイルでも、オフセットはNumber.MAX_SAFE_INTEGER（約9PB）に
// 十分収まるため、BigIntではなく通常のnumberを保持するFloat64Arrayを用いる。
type TsumeIndex = {
  offsets: Float64Array;
  fileSize: number;
};

// ファイルパスごとのインデックス（初回読み取り後にメモリキャッシュ）。
const indexCache = new Map<string, TsumeIndex>();

// 構築中のインデックスをファイルパスごとに共有し、同時呼び出しでの二重走査を防ぐ。
const buildingPromises = new Map<string, Promise<TsumeIndex>>();

/**
 * 指定ファイルの行頭オフセットインデックスを取得する。
 * キャッシュ済みなら即座に返し、構築中なら同じPromiseを共有する。
 */
function loadIndex(filePath: string): Promise<TsumeIndex> {
  const cached = indexCache.get(filePath);
  if (cached) {
    return Promise.resolve(cached);
  }
  const inFlight = buildingPromises.get(filePath);
  if (inFlight) {
    return inFlight;
  }
  getAppLogger().debug("tsume index: build start: [%s]", filePath);
  const beginTime = Date.now();
  const promise = scanOffsets(filePath)
    .then((index) => {
      indexCache.set(filePath, index);
      getAppLogger().debug(
        "tsume index: build completed: [%s] lines=%d elapsed=%dms",
        filePath,
        index.offsets.length,
        Date.now() - beginTime,
      );
      return index;
    })
    .catch((e) => {
      getAppLogger().error("tsume index: build failed: [%s]: %s", filePath, e);
      throw e;
    })
    .finally(() => {
      buildingPromises.delete(filePath);
    });
  buildingPromises.set(filePath, promise);
  return promise;
}

/**
 * SFENファイルを1パスで走査し、各行の行頭バイトオフセットとファイルサイズを収集する。
 */
async function scanOffsets(filePath: string): Promise<TsumeIndex> {
  const offsets: number[] = [];
  const stream = createReadStream(filePath);
  let offset = 0; // 現在処理中チャンクの先頭の絶対バイト位置
  let lineStart = 0; // 次に記録する行頭の絶対バイト位置
  let firstChunk = true;

  await new Promise<void>((resolve, reject) => {
    stream.on("data", (rawChunk: string | Buffer) => {
      const chunk = Buffer.isBuffer(rawChunk) ? rawChunk : Buffer.from(rawChunk);
      let start = 0;
      // 先頭チャンクのUTF-8 BOM（EF BB BF）をスキップする。
      // BOMはファイル先頭のバイトなので、チャンク先頭位置(offset)は変えず、
      // 最初の行頭だけをBOM直後（3バイト目）に進める。
      if (firstChunk && chunk[0] === 0xef && chunk[1] === 0xbb && chunk[2] === 0xbf) {
        start = 3;
        lineStart = 3;
      }
      firstChunk = false;

      for (let i = start; i < chunk.length; i++) {
        if (chunk[i] === 0x0a) {
          // '\n'
          offsets.push(lineStart);
          lineStart = offset + i + 1;
        }
      }
      offset += chunk.length;
    });
    stream.on("end", () => {
      // 最終行が改行で終わらない場合の行頭も記録する。
      if (lineStart < offset) {
        offsets.push(lineStart);
      }
      resolve();
    });
    stream.on("error", reject);
  });

  // 走査終了時の offset はファイル総バイト数に等しい。
  return { offsets: Float64Array.from(offsets), fileSize: offset };
}

/**
 * SFENファイルを走査して各行のバイトオフセットを記録し、総行数を返す。
 * 2回目以降はキャッシュを使用する。
 */
export async function buildIndex(filePath: string): Promise<number> {
  return (await loadIndex(filePath)).offsets.length;
}

/**
 * 指定した行番号（1始まり）のSFEN文字列を取得する。
 * インデックス未構築の場合は自動的に構築する。
 * 範囲外の行番号には空文字列を返す。
 */
export async function getLines(filePath: string, lineNumbers: number[]): Promise<string[]> {
  const { offsets, fileSize } = await loadIndex(filePath);
  const totalLines = offsets.length;
  if (totalLines === 0 || lineNumbers.length === 0) {
    return lineNumbers.map(() => "");
  }

  const fd = await fs.open(filePath, "r");
  try {
    const results: string[] = [];
    for (const lineNum of lineNumbers) {
      if (lineNum < 1 || lineNum > totalLines) {
        results.push("");
        continue;
      }
      const startOffset = offsets[lineNum - 1];
      // 次の行頭（最終行はファイル末尾）までを1行分として読み取る。
      const endOffset = lineNum < totalLines ? offsets[lineNum] : fileSize;
      const length = endOffset - startOffset;
      if (length <= 0) {
        results.push("");
        continue;
      }
      const buf = Buffer.alloc(length);
      const { bytesRead } = await fd.read(buf, 0, length, startOffset);
      // 末尾の改行・空白を除去してSFENを正規化する。
      const line = buf.subarray(0, bytesRead).toString("utf-8").trim();
      results.push(normalizeSfen(line));
    }
    return results;
  } finally {
    await fd.close();
  }
}

/**
 * 1以上 totalLines 以下の行番号から重複なく count 件を一様ランダムに選び、昇順で返す。
 * count が総行数以上の場合は全行の行番号を返す。
 *
 * インデックス構築済みで総行数が既知のため、リザーバーサンプリング（O(総行数)）は不要。
 * 仮想配列 a[i] = i に対する部分Fisher-Yatesシャッフルを疎なMapで表現することで、
 * 総行数に依存せず O(count) で選出する。約100万行のファイルから1件選ぶ場合でも
 * 乱数生成は1回で済む。
 */
function sampleLineNumbers(totalLines: number, count: number): number[] {
  const n = Math.min(count, totalLines);
  // 交換が発生した位置だけを記録し、未記録の位置は a[i] = i とみなす。
  const swapped = new Map<number, number>();
  const picked: number[] = [];
  for (let i = 0; i < n; i++) {
    const j = i + Math.floor(Math.random() * (totalLines - i));
    picked.push((swapped.get(j) ?? j) + 1); // 0始まりの添字を行番号（1始まり）へ変換
    swapped.set(j, swapped.get(i) ?? i); // a[j] に a[i] を退避する
  }
  return picked.sort((a, b) => a - b); // ファイルシーク効率化のため昇順
}

/**
 * count 件をランダムに取得する。
 * ファイルシーク効率化のため、行番号の昇順で読み取って返す。
 */
export async function getRandomLines(
  filePath: string,
  count: number,
): Promise<{ sfens: string[]; lineNumbers: number[] }> {
  const { offsets } = await loadIndex(filePath);
  const lineNumbers = sampleLineNumbers(offsets.length, count);
  const sfens = await getLines(filePath, lineNumbers);
  return { sfens, lineNumbers };
}

/**
 * キャッシュをクリアする（テスト用・メモリ解放用）。
 */
export function clearIndexCache(): void {
  indexCache.clear();
  buildingPromises.clear();
}

/**
 * 指定ファイルのインデックスが既にキャッシュされているか確認する。
 */
export function isIndexCached(filePath: string): boolean {
  return indexCache.has(filePath);
}
