import child_process from "node:child_process";
import { getTailCommand, tailLogFile } from "@/background/log.js";
import { LogType } from "@/common/log.js";

describe("log", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  describe("getTailCommand", () => {
    it("win", () => {
      expect(getTailCommand(LogType.APP)).match(
        /^Get-Content -Path ".*app-.*\.log" -Wait -Tail 10$/,
      );
    });
  });

  describe("tailLogFile", () => {
    it("win", () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const spy = vi.spyOn(child_process, "spawn").mockReturnValueOnce({} as any);
      tailLogFile(LogType.APP);
      expect(spy).toBeCalledTimes(1);
      expect(spy.mock.calls[0][0]).toBe("powershell.exe");
      expect(spy.mock.calls[0][1]).toHaveLength(2);
      expect(spy.mock.calls[0][1][0]).toBe("-Command");
      expect(spy.mock.calls[0][1][1]).match(
        /^start-process powershell '-NoExit','-Command "Get-Content -Path \\".*app-.*\.log\\" -Wait -Tail 10"'$/,
      );
    });
  });
});
