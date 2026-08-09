import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { runReplayExecuteCli } from "../src/replay-execute.js";

const directories: string[] = [];

afterEach(async () => {
  await Promise.all(
    directories.splice(0).map((directory) => rm(directory, { recursive: true, force: true })),
  );
});

describe("replay execute input preflight", () => {
  it("rejects a directory before attempting to read JSON", async () => {
    const directory = await mkdtemp(join(tmpdir(), "evavo-replay-input-"));
    directories.push(directory);
    let stdout = "";
    let stderr = "";

    const exitCode = await runReplayExecuteCli(
      ["replay-execute", "--bundle", directory, "--replay", "missing.replay.json", "--json"],
      {
        stdout: (text) => {
          stdout += text;
        },
        stderr: (text) => {
          stderr += text;
        },
      },
    );

    expect(exitCode).toBe(1);
    expect(stderr).toBe("");
    expect(JSON.parse(stdout)).toMatchObject({
      valid: false,
      exitCode: 1,
      diagnostics: [
        expect.objectContaining({
          code: "input-not-file",
          path: directory,
        }),
      ],
    });
  });
});
