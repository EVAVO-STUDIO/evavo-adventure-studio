import type {
  AssetBuildManifest,
  CompiledAssetRecord,
} from "@evavo/adventure-asset-contract";
import type { AdventureProject } from "@evavo/adventure-project-schema";
import type { AudioCue, AudioMixManifest } from "./index.js";

export type AudioCompiledIssueCode =
  | "compiled-audio-asset-missing"
  | "compiled-audio-asset-kind"
  | "compiled-audio-primary-output-missing"
  | "compiled-audio-media-type"
  | "compiled-audio-duration-unverified"
  | "compiled-audio-offset-out-of-range"
  | "compiled-audio-loop-out-of-range"
  | "compiled-speech-duration-mismatch";

export interface AudioCompiledIssue {
  readonly severity: "error" | "warning";
  readonly code: AudioCompiledIssueCode;
  readonly path: string;
  readonly message: string;
}

const addIssue = (
  issues: AudioCompiledIssue[],
  severity: AudioCompiledIssue["severity"],
  code: AudioCompiledIssueCode,
  path: string,
  message: string,
): void => {
  issues.push({ severity, code, path, message });
};

const validateCueEvidence = (
  cue: AudioCue,
  cueIndex: number,
  compiledById: ReadonlyMap<string, CompiledAssetRecord>,
  issues: AudioCompiledIssue[],
): void => {
  const path = `cues[${cueIndex}]`;
  const asset = compiledById.get(cue.assetId);
  if (!asset) {
    addIssue(
      issues,
      "error",
      "compiled-audio-asset-missing",
      `${path}.assetId`,
      `Compiled audio asset '${cue.assetId}' is missing for cue '${cue.id}'.`,
    );
    return;
  }
  if (asset.kind !== "audio") {
    addIssue(
      issues,
      "error",
      "compiled-audio-asset-kind",
      `${path}.assetId`,
      `Compiled cue asset '${asset.assetId}' is '${asset.kind}', not audio.`,
    );
    return;
  }

  const primary = asset.outputFiles.find((output) => output.role === "primary");
  if (!primary) {
    addIssue(
      issues,
      "error",
      "compiled-audio-primary-output-missing",
      `${path}.assetId`,
      `Compiled audio asset '${asset.assetId}' has no primary runtime output.`,
    );
  } else if (!primary.mediaType.startsWith("audio/")) {
    addIssue(
      issues,
      "error",
      "compiled-audio-media-type",
      `${path}.assetId`,
      `Compiled audio output '${primary.runtimePath}' has media type '${primary.mediaType}'.`,
    );
  }

  const duration = asset.metadata.durationMilliseconds;
  if (duration === undefined) {
    if (cue.startOffsetMilliseconds > 0 || cue.loop) {
      addIssue(
        issues,
        "warning",
        "compiled-audio-duration-unverified",
        `${path}.assetId`,
        `Cue '${cue.id}' uses offsets or looping but compiled duration is unavailable.`,
      );
    }
    return;
  }
  if (cue.startOffsetMilliseconds >= duration) {
    addIssue(
      issues,
      "error",
      "compiled-audio-offset-out-of-range",
      `${path}.startOffsetMilliseconds`,
      `Cue '${cue.id}' starts at ${cue.startOffsetMilliseconds} ms, beyond ${duration} ms audio.`,
    );
  }
  if (cue.loop && cue.loop.endMilliseconds > duration) {
    addIssue(
      issues,
      "error",
      "compiled-audio-loop-out-of-range",
      `${path}.loop.endMilliseconds`,
      `Cue '${cue.id}' loop ends at ${cue.loop.endMilliseconds} ms, beyond ${duration} ms audio.`,
    );
  }
};

const dialogueLineDurations = (
  project: Pick<AdventureProject, "dialogues" | "presentation">,
): ReadonlyMap<string, number> => {
  const result = new Map<string, number>();
  for (const dialogue of project.dialogues) {
    for (const node of dialogue.nodes) {
      for (const line of node.lines) {
        if (line.durationTicks !== undefined) {
          result.set(
            line.id,
            (line.durationTicks * 1000) /
              project.presentation.logicalTicksPerSecond,
          );
        }
      }
    }
  }
  return result;
};

export const validateCompiledAudioMappings = (
  project: Pick<AdventureProject, "dialogues" | "presentation">,
  manifest: AudioMixManifest,
  compiled: AssetBuildManifest,
): readonly AudioCompiledIssue[] => {
  const issues: AudioCompiledIssue[] = [];
  const compiledById = new Map(
    compiled.assets.map((asset) => [asset.assetId as string, asset] as const),
  );
  manifest.cues.forEach((cue, cueIndex) =>
    validateCueEvidence(cue, cueIndex, compiledById, issues),
  );

  const cues = new Map(
    manifest.cues.map((cue) => [cue.id as string, cue] as const),
  );
  const lineDurations = dialogueLineDurations(project);
  manifest.speechBindings.forEach((binding, bindingIndex) => {
    const expected = lineDurations.get(binding.dialogueLineId);
    const cue = cues.get(binding.cueId);
    if (expected === undefined || !cue) return;
    const compiledAsset = compiledById.get(cue.assetId);
    if (!compiledAsset || compiledAsset.kind !== "audio") return;
    const duration = compiledAsset.metadata.durationMilliseconds;
    if (duration === undefined) return;

    const effectiveDuration =
      Math.max(0, duration - cue.startOffsetMilliseconds) +
      ((binding.leadInTicks + binding.tailTicks) * 1000) /
        manifest.logicalTicksPerSecond;
    if (Math.abs(effectiveDuration - expected) > 350) {
      addIssue(
        issues,
        "warning",
        "compiled-speech-duration-mismatch",
        `speechBindings[${bindingIndex}]`,
        `Speech '${binding.id}' is ${Math.round(effectiveDuration)} ms while authored line timing is ${Math.round(expected)} ms.`,
      );
    }
  });

  return issues;
};
