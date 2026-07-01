import {
  normalizeAppSettings,
  getPieceImageURLTemplate,
  defaultAppSettings,
  PieceImageType,
} from "@/common/settings/app.js";
import { Language } from "@/common/i18n/index.js";

describe("settings/app", () => {
  it("normalize", () => {
    const result = normalizeAppSettings(defaultAppSettings(), {
      returnCode: "\r\n",
      autoSaveDirectory: "/tmp",
    });
    expect(result).toStrictEqual(defaultAppSettings());
  });

  it("normalize unsupported language", () => {
    const result = normalizeAppSettings({
      ...defaultAppSettings(),
      language: "unsupported" as Language,
    });
    expect(result.language).toBe(Language.JA);
  });

  it("pieceImageBaseURL", () => {
    expect(
      getPieceImageURLTemplate({
        ...defaultAppSettings(),
        pieceImage: PieceImageType.HITOMOJI,
      }),
    ).toBe("./piece/hitomoji/${piece}.png");

    expect(
      getPieceImageURLTemplate({
        ...defaultAppSettings(),
        pieceImage: PieceImageType.HITOMOJI_GOTHIC,
      }),
    ).toBe("./piece/hitomoji_gothic/${piece}.png");

    expect(
      getPieceImageURLTemplate({
        ...defaultAppSettings(),
        pieceImage: PieceImageType.HITOMOJI_DARK,
      }),
    ).toBe("./piece/hitomoji_dark/${piece}.png");

    expect(
      getPieceImageURLTemplate({
        ...defaultAppSettings(),
        pieceImage: PieceImageType.HITOMOJI_GOTHIC_DARK,
      }),
    ).toBe("./piece/hitomoji_gothic_dark/${piece}.png");

    expect(
      getPieceImageURLTemplate({
        ...defaultAppSettings(),
        pieceImage: PieceImageType.FUTAMOJI,
      }),
    ).toBe("./piece/futamoji/${piece}.png");

    expect(
      getPieceImageURLTemplate({
        ...defaultAppSettings(),
        pieceImage: PieceImageType.CUSTOM_IMAGE,
        pieceImageFileURL: "/home/user/pictures/piece.png",
        croppedPieceImageBaseURL: "file:///home/user/.cache/piece",
      }),
    ).toBe("user-file://localhost/home/user/.cache/piece/${piece}.png");

    expect(
      getPieceImageURLTemplate({
        ...defaultAppSettings(),
        pieceImage: PieceImageType.CUSTOM_IMAGE,
        pieceImageFileURL: "/home/user/pictures/piece.png",
        croppedPieceImageBaseURL: "file:///home/user/.cache/piece",
        croppedPieceImageQuery: "updated=12345",
      }),
    ).toBe("user-file://localhost/home/user/.cache/piece/${piece}.png?updated=12345");
  });
});
