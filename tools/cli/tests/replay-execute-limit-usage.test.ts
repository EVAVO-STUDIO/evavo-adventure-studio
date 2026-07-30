import { describe, expect, it } from "vitest";
import { runReplayExecuteCli } from "../src/replay-execute.js";

describe("replay execute limit usage", () => {
  it("rejects invalid limits before reading inputs", async () => {
    for (const [option, value] of [
      ["--max-events", "0"],
      ["--max-events", "1.5"],
      ["--max-duration-ticks", "-1"],
      ["--max-duration-ticks", "not-a-number"],
    ] as const) {
      let stdout = "";
      let stderr = "";
      const exitCode = await runReplayExecuteCli(
        [
          "replay-execute",
          "--bundle",
          "missing.bundle.json",
          "--replay",
          "missing.replay.json",
          option,
          value,
          "--json",
        ],
        {
          stdout: (text) => {
            stdout += text;
          },
          stderr: (text) => {
            stderr += text;
          },
        },
      );

      expect(exitCode).toBe(2);
      expect(stderr).toBe("");
      expect(JSON.parse(stdout)).toMatchObject({
        valid: false,
        exitCode: 2,
        diagnostics: [
          expect.objectContaining({
            code: "invalid-usage",
            message: `Option '${option}' must be a positive safe integer.`,
          }),
        ],
      });
    }
  });
});
