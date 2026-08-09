import type { EditorDocumentState } from "@evavo/adventure-editor-core";
import type { Id } from "@evavo/adventure-project-schema";
import { parseSceneInstanceManifest, type SceneInstanceManifest } from "@evavo/adventure-scene-instances";

export interface StudioRecoveryStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export interface StudioRecoverySnapshot {
  readonly snapshotVersion: 1;
  readonly projectId: Id<"project">;
  readonly operationRevision: number;
  readonly savedAt: string;
  readonly manifest: SceneInstanceManifest;
}

export type StudioRecoveryLoadResult =
  | { readonly kind: "missing" }
  | { readonly kind: "loaded"; readonly snapshot: StudioRecoverySnapshot }
  | {
      readonly kind: "invalid";
      readonly reason:
        | "invalid-json"
        | "invalid-version"
        | "project-mismatch"
        | "invalid-revision"
        | "invalid-date"
        | "invalid-manifest";
      readonly message: string;
    };

export const studioRecoveryKey = (projectId: Id<"project">): string =>
  `evavo-adventure-studio:recovery:${projectId}`;

export const createStudioRecoverySnapshot = (
  projectId: Id<"project">,
  document: EditorDocumentState,
  savedAt = new Date().toISOString(),
): StudioRecoverySnapshot => {
  if (!Number.isSafeInteger(document.operationRevision) || document.operationRevision < 0) {
    throw new RangeError("Editor operation revision must be a non-negative safe integer.");
  }
  if (Number.isNaN(Date.parse(savedAt))) {
    throw new RangeError("Recovery snapshot date must be a valid ISO date string.");
  }
  if (document.manifest.projectId !== projectId) {
    throw new Error(
      `Recovery manifest project '${document.manifest.projectId}' does not match '${projectId}'.`,
    );
  }

  return {
    snapshotVersion: 1,
    projectId,
    operationRevision: document.operationRevision,
    savedAt,
    manifest: parseSceneInstanceManifest(JSON.parse(JSON.stringify(document.manifest)) as unknown),
  };
};

export const saveStudioRecoverySnapshot = (
  storage: StudioRecoveryStorage,
  snapshot: StudioRecoverySnapshot,
): void => {
  storage.setItem(studioRecoveryKey(snapshot.projectId), JSON.stringify(snapshot));
};

export const loadStudioRecoverySnapshot = (
  storage: StudioRecoveryStorage,
  projectId: Id<"project">,
): StudioRecoveryLoadResult => {
  const text = storage.getItem(studioRecoveryKey(projectId));
  if (text === null) {
    return { kind: "missing" };
  }

  let input: unknown;
  try {
    input = JSON.parse(text) as unknown;
  } catch (error) {
    return {
      kind: "invalid",
      reason: "invalid-json",
      message: error instanceof Error ? error.message : "Invalid recovery JSON.",
    };
  }

  if (!input || typeof input !== "object") {
    return {
      kind: "invalid",
      reason: "invalid-version",
      message: "Recovery snapshot must be an object.",
    };
  }
  const candidate = input as Readonly<Record<string, unknown>>;
  const snapshotVersion = candidate["snapshotVersion"];
  const candidateProjectId = candidate["projectId"];
  const operationRevision = candidate["operationRevision"];
  const savedAt = candidate["savedAt"];
  const manifestInput = candidate["manifest"];

  if (snapshotVersion !== 1) {
    return {
      kind: "invalid",
      reason: "invalid-version",
      message: `Unsupported recovery snapshot version '${String(snapshotVersion)}'.`,
    };
  }
  if (candidateProjectId !== projectId) {
    return {
      kind: "invalid",
      reason: "project-mismatch",
      message: `Recovery snapshot project '${String(candidateProjectId)}' does not match '${projectId}'.`,
    };
  }
  if (!Number.isSafeInteger(operationRevision) || Number(operationRevision) < 0) {
    return {
      kind: "invalid",
      reason: "invalid-revision",
      message: "Recovery snapshot revision is invalid.",
    };
  }
  if (typeof savedAt !== "string" || Number.isNaN(Date.parse(savedAt))) {
    return {
      kind: "invalid",
      reason: "invalid-date",
      message: "Recovery snapshot date is invalid.",
    };
  }

  let manifest: SceneInstanceManifest;
  try {
    manifest = parseSceneInstanceManifest(manifestInput);
  } catch (error) {
    return {
      kind: "invalid",
      reason: "invalid-manifest",
      message: error instanceof Error ? error.message : "Recovery scene composition is invalid.",
    };
  }

  return {
    kind: "loaded",
    snapshot: {
      snapshotVersion: 1,
      projectId,
      operationRevision: Number(operationRevision),
      savedAt: savedAt,
      manifest,
    },
  };
};

export const clearStudioRecoverySnapshot = (
  storage: StudioRecoveryStorage,
  projectId: Id<"project">,
): void => {
  storage.removeItem(studioRecoveryKey(projectId));
};
