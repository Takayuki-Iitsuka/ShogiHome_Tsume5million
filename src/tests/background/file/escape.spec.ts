import { escapeWinArg } from "@/background/file/escape";

describe("escape", () => {
  it("winArg", () => {
    expect(escapeWinArg("foo")).toBe('"foo"');
    expect(escapeWinArg('foo"bar')).toBe('"foo\\"bar"');
    expect(escapeWinArg("foo\\bar")).toBe('"foo\\bar"');
    expect(escapeWinArg('foo\\"bar')).toBe('"foo\\\\\\"bar"');
    expect(escapeWinArg('foobar\\"')).toBe('"foobar\\\\\\""');
  });
});
