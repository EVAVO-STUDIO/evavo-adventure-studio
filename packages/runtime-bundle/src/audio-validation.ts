import {
  type RuntimeAudioIssue,
  validateRuntimeAudioMixManifest,
} from "@evavo/adventure-audio/runtime-validation";
import type { RuntimeBundle } from "./index.js";

export type RuntimeAudioMixIssue = RuntimeAudioIssue;

export class RuntimeAudioMixValidationError extends Error {
  readonly issues: readonly RuntimeAudioMixIssue[];

  constructor(issues: readonly RuntimeAudioMixIssue[]) {
    super(`Runtime audio mix contains ${issues.length} validation issue(s).`);
    this.name = "RuntimeAudioMixValidationError";
    this.issues = issues;
  }
}

export const validateRuntimeAudioMix = (
  bundle: Pick<
    RuntimeBundle,
    | "projectId"
    | "presentation"
    | "assets"
    | "scenes"
    | "dialogues"
    | "sequences"
    | "audioMix"
  >,
): readonly RuntimeAudioMixIssue[] =>
  bundle.audioMix
    ? validateRuntimeAudioMixManifest(bundle, bundle.audioMix)
    : [];
