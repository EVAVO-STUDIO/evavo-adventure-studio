export type SaveGameCompatibilityIssueCode =
  | "save-fingerprint-mismatch"
  | "project-mismatch"
  | "bundle-fingerprint-mismatch"
  | "asset-manifest-mismatch"
  | "story-project-mismatch"
  | "missing-current-scene"
  | "missing-current-entrance"
  | "missing-inventory-item"
  | "missing-active-dialogue"
  | "missing-active-dialogue-node"
  | "missing-active-sequence"
  | "sequence-save-disabled"
  | "sequence-boundary-required"
  | "actor-instance-set-mismatch"
  | "actor-instance-identity-mismatch"
  | "missing-actor"
  | "missing-animation-clip"
  | "invalid-animation-frame"
  | "invalid-animation-progress"
  | "invalid-movement"
  | "invalid-profiled-movement"
  | "invalid-profiled-camera"
  | "invalid-pending-command"
  | "missing-object-state"
  | "invalid-object-state"
  | "invalid-controlled-actor"
  | "invalid-selected-item"
  | "invalid-selected-verb"
  | "parser-history-limit"
  | "audio-state-without-runtime-mix"
  | "audio-project-mismatch"
  | "audio-scene-mismatch"
  | "audio-tick-mismatch"
  | "audio-bus-unconfigured"
  | "audio-voice-asset-missing"
  | "audio-voice-asset-kind"
  | "audio-voice-cue-missing"
  | "audio-voice-cue-mismatch"
  | "audio-scene-layer-missing"
  | "audio-resume-cue-missing"
  | "investigation-state-without-runtime-manifest"
  | "investigation-runtime-state-missing"
  | "investigation-chapter-missing"
  | "investigation-fact-missing"
  | "investigation-topic-missing"
  | "investigation-source-missing"
  | "investigation-objective-missing"
  | "investigation-provenance-chapter-missing"
  | "item-combination-state-without-runtime-manifest"
  | "item-combination-recipe-missing"
  | "multi-protagonist-state-without-runtime-manifest"
  | "multi-protagonist-active-missing"
  | "multi-protagonist-identity-mismatch"
  | "multi-protagonist-location-invalid"
  | "multi-protagonist-item-missing"
  | "sentence-verb-missing"
  | "sentence-item-missing"
  | "sentence-object-missing"
  | "room-script-state-without-runtime-manifest"
  | "room-script-scene-missing"
  | "room-script-id-missing"
  | "room-script-sequence-missing"
  | "room-script-return-location-invalid"
  | "rpg-state-without-runtime-manifest"
  | "rpg-class-missing"
  | "rpg-stat-missing"
  | "rpg-skill-missing"
  | "rpg-resource-missing"
  | "rpg-time-invalid"
  | "rpg-value-invalid";

export interface SaveGameCompatibilityIssue {
  readonly severity: "error";
  readonly code: SaveGameCompatibilityIssueCode;
  readonly path: string;
  readonly message: string;
}

export const addSaveGameIssue = (
  issues: SaveGameCompatibilityIssue[],
  code: SaveGameCompatibilityIssueCode,
  path: string,
  message: string,
): void => {
  issues.push({ severity: "error", code, path, message });
};

export class SaveGameIntegrityError extends Error {
  constructor() {
    super("Save-game payload fingerprint does not match its contents.");
    this.name = "SaveGameIntegrityError";
  }
}

export class SaveGameCompatibilityError extends Error {
  readonly issues: readonly SaveGameCompatibilityIssue[];

  constructor(issues: readonly SaveGameCompatibilityIssue[]) {
    super(`Save game is incompatible with this runtime bundle (${issues.length} issue(s)).`);
    this.name = "SaveGameCompatibilityError";
    this.issues = issues;
  }
}

export class SaveGamePolicyError extends Error {
  readonly issues: readonly SaveGameCompatibilityIssue[];

  constructor(issues: readonly SaveGameCompatibilityIssue[]) {
    super(issues[0]?.message ?? "The game cannot be saved at this time.");
    this.name = "SaveGamePolicyError";
    this.issues = issues;
  }
}
