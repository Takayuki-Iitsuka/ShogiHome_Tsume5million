import { normalizeSfen, tsumeFileName, tsumeMateCounts } from "@/common/tsume.js";

describe("tsume", () => {
  it("tsumeFileName は手数に対応するファイル名を返す", () => {
    expect(tsumeFileName(3)).toBe("mate3.sfen");
    expect(tsumeFileName(11)).toBe("mate11.sfen");
    // 全手数でファイル名の形式が一貫していること
    for (const mate of tsumeMateCounts) {
      expect(tsumeFileName(mate)).toBe(`mate${mate}.sfen`);
    }
  });

  describe("normalizeSfen", () => {
    it("先手番SFENはそのまま返す", () => {
      const sfen = "lnsgkgsnl/1r5b1/ppppppppp/9/9/9/PPPPPPPPP/1B5R1/LNSGKGSNL b - 1";
      expect(normalizeSfen(sfen)).toBe(sfen);
    });

    it("後手番SFENは180度回転・駒色反転して先手番に正規化する", () => {
      // 後手番の局面を正規化すると初期局面（先手番）に戻る対称形
      const sfen = "lnsgkgsnl/1r5b1/ppppppppp/9/9/9/PPPPPPPPP/1B5R1/LNSGKGSNL w - 1";
      const normalized = normalizeSfen(sfen);
      const parts = normalized.split(" ");
      expect(parts[1]).toBe("b");
      expect(parts[0]).toBe("lnsgkgsnl/1r5b1/ppppppppp/9/9/9/PPPPPPPPP/1B5R1/LNSGKGSNL");
    });

    it("成駒と持ち駒の駒色も反転する", () => {
      const sfen = "9/9/9/9/9/9/9/9/4+p3k w G2p 1";
      const normalized = normalizeSfen(sfen);
      const parts = normalized.split(" ");
      expect(parts[1]).toBe("b");
      // 盤面反転: 最終段が先頭段になり、升も逆順・駒色反転
      expect(parts[0]).toBe("K3+P4/9/9/9/9/9/9/9/9");
      // 持ち駒の駒色反転
      expect(parts[2]).toBe("g2P");
    });
  });
});
