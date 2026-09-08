// 詰将棋データベースの共通定義（手数・ファイル名規約・SFEN正規化）。
// renderer と background の両方から参照される。

/** 対応する詰将棋の手数一覧 */
export const tsumeMateCounts = [3, 5, 7, 9, 11] as const;

/** 対応する詰将棋の手数 */
export type TsumeMateCount = (typeof tsumeMateCounts)[number];

/** 詰将棋データファイルの拡張子 */
export const tsumeFileExtension = ".sfen";

/**
 * 手数に対応する詰将棋データファイル名を返す。（例: mate3.sfen）
 */
export function tsumeFileName(mate: TsumeMateCount): string {
  return `mate${mate}${tsumeFileExtension}`;
}

/**
 * 駒を表す英字の大文字・小文字を反転して駒色（先手↔後手）を入れ替える。
 */
function flipPieceColors(text: string): string {
  return text.replace(/[a-zA-Z]/g, (c) =>
    c === c.toUpperCase() ? c.toLowerCase() : c.toUpperCase(),
  );
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

  // 盤面を段ごとに分割して逆順に並べ替え、各段内の升も逆順にして180度回転する。
  const rotatedBoard = board
    .split("/")
    .reverse()
    .map((rank) => {
      const tokens: string[] = [];
      for (let i = 0; i < rank.length; ) {
        if (rank[i] === "+") {
          tokens.push(rank.slice(i, i + 2)); // 成駒は「+」と駒文字をまとめる
          i += 2;
        } else {
          tokens.push(rank[i]);
          i++;
        }
      }
      return tokens.reverse().join("");
    })
    .join("/");

  const flippedBoard = flipPieceColors(rotatedBoard);
  const flippedHands = hands === "-" ? "-" : flipPieceColors(hands);

  return [flippedBoard, "b", flippedHands, ...rest].join(" ");
}
