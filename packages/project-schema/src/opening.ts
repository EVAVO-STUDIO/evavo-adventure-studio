import { z } from "zod";
import type { AdventureProject, Id, Sequence } from "./index.js";
import { idSchema } from "./index.js";

export const gameOpeningManifestSchema = z
  .object({
    manifestVersion: z.literal(1),
    projectId: idSchema("project"),
    newGameSequenceId: idSchema("sequence"),
  })
  .strict();

export interface GameOpeningManifest {
  readonly manifestVersion: 1;
  readonly projectId: Id<"project">;
  readonly newGameSequenceId: Id<"sequence">;
}

export const parseGameOpeningManifest = (input: unknown): GameOpeningManifest =>
  gameOpeningManifestSchema.parse(input) as GameOpeningManifest;

export type GameOpeningIssueCode =
  | "opening-project-mismatch"
  | "missing-opening-sequence"
  | "opening-sequence-not-cutscene"
  | "opening-sequence-looped"
  | "opening-sequence-not-blocking"
  | "opening-sequence-looping-audio";

export interface GameOpeningIssue {
  readonly severity: "error";
  readonly code: GameOpeningIssueCode;
  readonly path: "projectId" | "newGameSequenceId";
  readonly message: string;
}

export interface GameOpeningSource {
  readonly id: Id<"project">;
  readonly sequences: readonly Sequence[];
}

const issue = (
  code: GameOpeningIssueCode,
  path: GameOpeningIssue["path"],
  message: string,
): GameOpeningIssue => ({
  severity: "error",
  code,
  path,
  message,
});

export const validateGameOpeningManifest = (
  source: GameOpeningSource | Pick<AdventureProject, "id" | "sequences">,
  manifest: GameOpeningManifest,
): readonly GameOpeningIssue[] => {
  const issues: GameOpeningIssue[] = [];
  if (source.id !== manifest.projectId) {
    issues.push(
      issue(
        "opening-project-mismatch",
        "projectId",
        `Opening project '${manifest.projectId}' does not match '${source.id}'.`,
      ),
    );
  }

  const sequence = source.sequences.find(
    (candidate) => candidate.id === manifest.newGameSequenceId,
  );
  if (!sequence) {
    issues.push(
      issue(
        "missing-opening-sequence",
        "newGameSequenceId",
        `Opening sequence '${manifest.newGameSequenceId}' does not exist.`,
      ),
    );
    return issues;
  }
  if (sequence.mode !== "cutscene") {
    issues.push(
      issue(
        "opening-sequence-not-cutscene",
        "newGameSequenceId",
        `Opening sequence '${sequence.id}' must use cutscene mode.`,
      ),
    );
  }
  if (sequence.loop) {
    issues.push(
      issue(
        "opening-sequence-looped",
        "newGameSequenceId",
        `Opening sequence '${sequence.id}' must not loop.`,
      ),
    );
  }
  if (!sequence.blocking) {
    issues.push(
      issue(
        "opening-sequence-not-blocking",
        "newGameSequenceId",
        `Opening sequence '${sequence.id}' must block ordinary player input.`,
      ),
    );
  }
  if (
    sequence.tracks.some((track) =>
      track.cues.some((cue) => cue.kind === "sound" && cue.loop),
    )
  ) {
    issues.push(
      issue(
        "opening-sequence-looping-audio",
        "newGameSequenceId",
        `Opening sequence '${sequence.id}' must not start looping audio that could survive a skip.`,
      ),
    );
  }
  return issues;
};
