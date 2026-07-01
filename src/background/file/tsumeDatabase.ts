import { createReadStream, promises as fs } from "node:fs";

// ファイルパスごとのバイトオフセットインデックス（初回読み取り後にメモリキャッシュ）
const indexCache = new Map<string, BigInt64Array>();

/**
 * SFENファイルを走査して各行のバイトオフセットを記録し、総行数を返す。
 * 2回目以降はキャッシュを使用する。
 */
export async function buildIndex(filePath: string): Promise<number> {
  if (indexCache.has(filePath)) {
    return indexCache.get(filePath)!.length;
  }

  const offsets: bigint[] = [];
  const stream = createReadStream(filePath);
  let offset = BigInt(0);
  let lineStart = BigInt(0);
  let firstChunk = true;

  await new Promise<void>((resolve, reject) => {
    stream.on("data", (rawChunk: string | Buffer) => {
      const chunk = Buffer.isBuffer(rawChunk) ? rawChunk : Buffer.from(rawChunk);
      // BOMスキップ（UTF-8 BOM: EF BB BF）
      let start = 0;
      if (firstChunk && chunk[0] === 0xef && chunk[1] === 0xbb && chunk[2] === 0xbf) {
        start = 3;
        offset += BigInt(3);
        lineStart = offset;
      }
      firstChunk = false;

      for (let i = start; i < chunk.length; i++) {
        if (chunk[i] === 0x0a) {
          // '\n'
          offsets.push(lineStart);
          lineStart = offset + BigInt(i) + BigInt(1);
        }
      }
      offset += BigInt(chunk.length);
    });
    stream.on("end", () => {
      // 最終行が改行なしで終わる場合
      if (lineStart < offset) {
        offsets.push(lineStart);
      }
      resolve();
    });
    stream.on("error", reject);
  });

  const arr = new BigInt64Array(offsets.map((v) => BigInt(v)));
  indexCache.set(filePath, arr);
  return arr.length;
}

/**
 * 指定した行番号（1始まり）のSFEN文字列を取得する。
 * buildIndex を事前に呼んでいない場合は自動的に構築する。
 */
export async function getLines(filePath: string, lineNumbers: number[]): Promise<string[]> {
  if (!indexCache.has(filePath)) {
    await buildIndex(filePath);
  }
  const offsets = indexCache.get(filePath)!;
  const totalLines = offsets.length;

  const results: string[] = [];
  for (const lineNum of lineNumbers) {
    if (lineNum < 1 || lineNum > totalLines) {
      results.push("");
      continue;
    }
    const startOffset = Number(offsets[lineNum - 1]);
    const endOffset = lineNum < totalLines ? Number(offsets[lineNum]) : undefined;
    const length = endOffset !== undefined ? endOffset - startOffset : undefined;

    const buf = Buffer.alloc(length ?? 512);
    const fd = await fs.open(filePath, "r");
    try {
      const { bytesRead } = await fd.read(buf, 0, buf.length, startOffset);
      let line = buf.slice(0, bytesRead).toString("utf-8");
      // 改行文字を除去
      const nl = line.indexOf("\n");
      if (nl >= 0) {
        line = line.slice(0, nl);
      }
      results.push(normalizeSfen(line.replace(/\r$/, "").trim()));
    } finally {
      await fd.close();
    }
  }
  return results;
}

/**
 * リザーバーサンプリングで count 件をランダムに取得する。
 * インデックスが構築済みの場合はO(n)走査を避けてランダムアクセスする。
 * 未構築の場合は1パスで行う。
 */
export async function getRandomLines(
  filePath: string,
  count: number,
): Promise<{ sfens: string[]; lineNumbers: number[] }> {
  if (!indexCache.has(filePath)) {
    await buildIndex(filePath);
  }
  const offsets = indexCache.get(filePath)!;
  const totalLines = offsets.length;

  if (count >= totalLines) {
    // 件数が総行数以下なら全件返す
    const allNums = Array.from({ length: totalLines }, (_, i) => i + 1);
    const sfens = await getLines(filePath, allNums);
    return { sfens, lineNumbers: allNums };
  }

  // リザーバーサンプリング（インデックスの行番号に対して実施）
  const reservoir: number[] = [];
  for (let i = 0; i < count; i++) {
    reservoir.push(i + 1);
  }
  for (let i = count; i < totalLines; i++) {
    const j = Math.floor(Math.random() * (i + 1));
    if (j < count) {
      reservoir[j] = i + 1;
    }
  }
  reservoir.sort((a, b) => a - b); // ファイルシーク効率化のため昇順

  const sfens = await getLines(filePath, reservoir);
  return { sfens, lineNumbers: reservoir };
}

/**
 * 後手番（w）SFENを先手番（b）SFENに正規化する。
 * 盤面を180度回転・駒色反転して「攻め方先手」の形に統一する。
 * 先手番の場合はそのまま返す。
 */
export function normalizeSfen(sfen: string): string {
  const parts = sfen.split(" ");
  if (parts.length < 4 || parts[1] !== "w") {
    return sfen;
  }
  const [board, , hands, ...rest] = parts;

  // 盤面を段ごとに分割し逆順に並べ替え、各段内の升を逆順にする
  const flippedBoard = board
    .split("/")
    .reverse()
    .map((rank) => {
      const tokens: string[] = [];
      let i = 0;
      while (i < rank.length) {
        if (rank[i] === "+") {
          tokens.push("+" + rank[i + 1]);
          i += 2;
        } else {
          tokens.push(rank[i]);
          i++;
        }
      }
      return tokens.reverse().join("");
    })
    .join("/")
    // 駒色を反転（先手↔後手）
    .replace(/[a-zA-Z]/g, (c) => (c === c.toUpperCase() ? c.toLowerCase() : c.toUpperCase()));

  // 持ち駒の駒色を反転
  const flippedHands =
    hands === "-"
      ? "-"
      : hands.replace(/[a-zA-Z]/g, (c) =>
          c === c.toUpperCase() ? c.toLowerCase() : c.toUpperCase(),
        );

  return [flippedBoard, "b", flippedHands, ...rest].join(" ");
}

/**
 * キャッシュをクリアする（テスト用・メモリ解放用）。
 */
export function clearIndexCache(): void {
  indexCache.clear();
}

/**
 * 指定ファイルのインデックスが既にキャッシュされているか確認する。
 */
export function isIndexCached(filePath: string): boolean {
  return indexCache.has(filePath);
}
