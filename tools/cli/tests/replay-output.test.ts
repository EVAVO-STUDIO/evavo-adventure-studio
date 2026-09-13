import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { SaveGame } from "@evavo/adventure-save-game";
import { afterEach, describe, expect, it } from "vitest";
import {
  assertReplayOutputPath,
  ReplayOutputCollisionError,
  ReplayOutputExistsError,
  writeReplayOutputSave,
} from "../src/replay-output.js";

const directories: string[] = [];
const fakeSave = {} as SaveGame;

const temporaryRoot = async (): Promise<string> => {
  const root = await mkdtemp(join(tmpdir(), "evavo-replay-output-"));
  directories.push(root);
  return root;
};

afterEach(async () => {
  await Promise.all(
    directories.splice(0).map((directory) => rm(directory, { recursive: true, force: true })),
  );
});

describe("replay final save output", () => {
  it("rejects an output path that collides with an input artifact", () => {
    expect(() =>
      assertReplayOutputPath("C:/game/replay.json", ["C:/game/game.bundle.json", "C:/game/replay.json"]),
    ).toThrow(ReplayOutputCollisionError);
  });

  it("creates a new output without overwriting an existing file", async () => {
    const root = await temporaryRoot();
    const outputPath = join(root, "nested", "final.save.json");
    await writeReplayOutputSave(outputPath, fakeSave);
    expect(await readFile(outputPath, "utf8")).toBe("{}\n");

    await expect(writeReplayOutputSave(outputPath, fakeSave)).rejects.toThrow(ReplayOutputExistsError);
    expect(await readFile(outputPath, "utf8")).toBe("{}\n");
  });

  it("preserves a pre-existing user file", async () => {
    const root = await temporaryRoot();
    const outputPath = join(root, "final.save.json");
    await writeFile(outputPath, "do not replace\n", "utf8");

    await expect(writeReplayOutputSave(outputPath, fakeSave)).rejects.toThrow(ReplayOutputExistsError);
    expect(await readFile(outputPath, "utf8")).toBe("do not replace\n");
  });
});
