import type { RuntimeAssetRecord } from "@evavo/adventure-asset-contract";
import type {
  DialogueGraph,
  Id,
  PresentationProfile,
  Scene,
  Sequence,
} from "@evavo/adventure-project-schema";
import {
  type AudioMixIssue,
  type AudioMixIssueCode,
  type AudioMixManifest,
  validateAudioMixManifest,
} from "./index.js";

export type RuntimeAudioIssueCode =
  | AudioMixIssueCode
  | "runtime-audio-primary-output-missing"
  | "runtime-audio-media-type";

export interface RuntimeAudioIssue {
  readonly severity: "error" | "warning";
  readonly code: RuntimeAudioIssueCode;
  readonly path: string;
  readonly message: string;
}

export interface RuntimeAudioBundleView {
  readonly projectId: Id<"project">;
  readonly presentation: PresentationProfile;
  readonly assets: readonly RuntimeAssetRecord[];
  readonly scenes: readonly Scene[];
  readonly dialogues: readonly DialogueGraph[];
  readonly sequences: readonly Sequence[];
}

export const validateRuntimeAudioMixManifest = (
  bundle: RuntimeAudioBundleView,
  manifest: AudioMixManifest,
): readonly RuntimeAudioIssue[] => {
  const sourceIssues: readonly AudioMixIssue[] = validateAudioMixManifest(
    {
      id: bundle.projectId,
      presentation: bundle.presentation,
      assets: bundle.assets.map((asset) => ({
        id: asset.assetId,
        path:
          asset.outputFiles[0]?.runtimePath ?? `runtime:${asset.assetId}`,
        kind: asset.kind,
      })),
      scenes: bundle.scenes,
      dialogues: bundle.dialogues,
      sequences: bundle.sequences,
    },
    manifest,
  );
  const issues: RuntimeAudioIssue[] = [...sourceIssues];
  const assets = new Map(
    bundle.assets.map((asset) => [asset.assetId as string, asset] as const),
  );

  manifest.cues.forEach((cue, cueIndex) => {
    const asset = assets.get(cue.assetId);
    if (!asset || asset.kind !== "audio") return;
    const primary = asset.outputFiles.find(
      (output) => output.role === "primary",
    );
    if (!primary) {
      issues.push({
        severity: "error",
        code: "runtime-audio-primary-output-missing",
        path: `cues[${cueIndex}].assetId`,
        message: `Runtime audio asset '${asset.assetId}' has no primary output.`,
      });
    } else if (!primary.mediaType.startsWith("audio/")) {
      issues.push({
        severity: "error",
        code: "runtime-audio-media-type",
        path: `cues[${cueIndex}].assetId`,
        message: `Runtime audio output '${primary.runtimePath}' has media type '${primary.mediaType}'.`,
      });
    }
  });

  return issues;
};
