import { describe, expect, it } from "vitest";
import { createEditorDocument } from "@evavo/adventure-editor-core";
import { studioProject, studioSceneInstances } from "../src/fixture.js";
import {
  clearStudioRecoverySnapshot,
  createStudioRecoverySnapshot,
  loadStudioRecoverySnapshot,
  saveStudioRecoverySnapshot,
  studioRecoveryKey,
  type StudioRecoveryStorage,
} from "../src/recovery.js";

class MemoryStorage implements StudioRecoveryStorage {
  readonly values = new Map<string, string>();

  getItem(key: string): string | null {
    return this.values.get(key) ?? null;
  }

  setItem(key: string, value: string): void {
    this.values.set(key, value);
  }

  removeItem(key: string): void {
    this.values.delete(key);
  }
}

describe("studio recovery snapshots", () => {
  it("round-trips a validated scene document", () => {
    const storage = new MemoryStorage();
    const document = {
      ...createEditorDocument(studioSceneInstances),
      operationRevision: 7,
    };
    const snapshot = createStudioRecoverySnapshot(
      studioProject.id,
      document,
      "2026-07-29T09:00:00.000Z",
    );

    saveStudioRecoverySnapshot(storage, snapshot);
    const loaded = loadStudioRecoverySnapshot(storage, studioProject.id);

    expect(loaded).toMatchObject({
      kind: "loaded",
      snapshot: {
        projectId: studioProject.id,
        operationRevision: 7,
        savedAt: "2026-07-29T09:00:00.000Z",
      },
    });
    if (loaded.kind === "loaded") {
      expect(loaded.snapshot.manifest).toEqual(studioSceneInstances);
      expect(loaded.snapshot.manifest).not.toBe(studioSceneInstances);
    }
  });

  it("rejects invalid JSON, project IDs and manifests", () => {
    const storage = new MemoryStorage();
    const key = studioRecoveryKey(studioProject.id);

    storage.setItem(key, "{broken");
    expect(loadStudioRecoverySnapshot(storage, studioProject.id)).toMatchObject({
      kind: "invalid",
      reason: "invalid-json",
    });

    storage.setItem(
      key,
      JSON.stringify({
        snapshotVersion: 1,
        projectId: "project.other",
        operationRevision: 0,
        savedAt: "2026-07-29T09:00:00.000Z",
        manifest: studioSceneInstances,
      }),
    );
    expect(loadStudioRecoverySnapshot(storage, studioProject.id)).toMatchObject({
      kind: "invalid",
      reason: "project-mismatch",
    });

    storage.setItem(
      key,
      JSON.stringify({
        snapshotVersion: 1,
        projectId: studioProject.id,
        operationRevision: 0,
        savedAt: "2026-07-29T09:00:00.000Z",
        manifest: { manifestVersion: 99 },
      }),
    );
    expect(loadStudioRecoverySnapshot(storage, studioProject.id)).toMatchObject({
      kind: "invalid",
      reason: "invalid-manifest",
    });
  });

  it("clears recovery state explicitly", () => {
    const storage = new MemoryStorage();
    const snapshot = createStudioRecoverySnapshot(
      studioProject.id,
      createEditorDocument(studioSceneInstances),
      "2026-07-29T09:00:00.000Z",
    );
    saveStudioRecoverySnapshot(storage, snapshot);

    clearStudioRecoverySnapshot(storage, studioProject.id);

    expect(loadStudioRecoverySnapshot(storage, studioProject.id)).toEqual({
      kind: "missing",
    });
  });
});
