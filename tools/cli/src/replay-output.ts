import { mkdir, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { type SaveGame, serializeSaveGame } from "@evavo/adventure-save-game";

export class ReplayOutputCollisionError extends Error {
  readonly outputPath: string;

  constructor(outputPath: string) {
    super(`Replay output '${outputPath}' collides with an input artifact.`);
    this.name = "ReplayOutputCollisionError";
    this.outputPath = outputPath;
  }
}

export class ReplayOutputExistsError extends Error {
  readonly outputPath: string;

  constructor(outputPath: string) {
    super(`Replay output '${outputPath}' already exists.`);
    this.name = "ReplayOutputExistsError";
    this.outputPath = outputPath;
  }
}

export const assertReplayOutputPath = (outputPath: string, inputPaths: readonly string[]): void => {
  if (inputPaths.includes(outputPath)) {
    throw new ReplayOutputCollisionError(outputPath);
  }
};

export const writeReplayOutputSave = async (outputPath: string, save: SaveGame): Promise<void> => {
  await mkdir(dirname(outputPath), { recursive: true });
  try {
    await writeFile(outputPath, serializeSaveGame(save), {
      encoding: "utf8",
      flag: "wx",
    });
  } catch (error) {
    if (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      (error as { readonly code: unknown }).code === "EEXIST"
    ) {
      throw new ReplayOutputExistsError(outputPath);
    }
    throw error;
  }
};
