import type { Id } from "@evavo/adventure-project-schema";
import type { SceneInstanceManifest } from "@evavo/adventure-scene-instances";
import {
  createEditorHistory,
  type EditorHistoryState,
} from "./index.js";
import type { EditorOperationLog } from "./command-schema.js";
import { executeValidatedEditorCommand } from "./validated-history.js";

export class EditorOperationLogError extends Error {
  readonly code:
    | "project-mismatch"
    | "revision-mismatch"
    | "duplicate-operation";
  readonly path: string;

  constructor(
    code: EditorOperationLogError["code"],
    path: string,
    message: string,
  ) {
    super(message);
    this.name = "EditorOperationLogError";
    this.code = code;
    this.path = path;
  }
}

export interface ReplayEditorOperationLogOptions {
  readonly expectedProjectId?: Id<"project">;
  readonly initialRevision?: number;
}

export interface ReplayedEditorOperationLog {
  readonly history: EditorHistoryState;
  readonly appliedOperationIds: readonly string[];
}

export const replayEditorOperationLog = (
  manifest: SceneInstanceManifest,
  log: EditorOperationLog,
  options: ReplayEditorOperationLogOptions = {},
): ReplayedEditorOperationLog => {
  const expectedProjectId = options.expectedProjectId ?? manifest.projectId;
  if (log.projectId !== expectedProjectId || manifest.projectId !== expectedProjectId) {
    throw new EditorOperationLogError(
      "project-mismatch",
      "projectId",
      `Operation log project '${log.projectId}' does not match '${expectedProjectId}'.`,
    );
  }

  const initialRevision = options.initialRevision ?? 0;
  if (!Number.isSafeInteger(initialRevision) || initialRevision < 0) {
    throw new RangeError("Initial editor revision must be a non-negative safe integer.");
  }
  if (log.baseRevision !== initialRevision) {
    throw new EditorOperationLogError(
      "revision-mismatch",
      "baseRevision",
      `Operation log starts at revision ${log.baseRevision}, expected ${initialRevision}.`,
    );
  }

  const seen = new Set<string>();
  let history = createEditorHistory(manifest);
  const appliedOperationIds: string[] = [];
  for (let index = 0; index < log.operations.length; index += 1) {
    const operation = log.operations[index];
    if (!operation) {
      continue;
    }
    if (seen.has(operation.operationId)) {
      throw new EditorOperationLogError(
        "duplicate-operation",
        `operations[${index}].operationId`,
        `Operation '${operation.operationId}' appears more than once.`,
      );
    }
    seen.add(operation.operationId);
    history = executeValidatedEditorCommand(history, operation.command);
    appliedOperationIds.push(operation.operationId);
  }

  return { history, appliedOperationIds };
};
