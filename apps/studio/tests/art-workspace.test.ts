import type { Id } from "@evavo/adventure-project-schema";
import { describe, expect, it } from "vitest";
import {
  studioArtDirectionManifest,
  studioArtVisualEvidence,
  studioCompiledArtEvidence,
} from "../src/art-fixture.js";
import {
  artDirectionIssuesForAsset,
  artDirectionWorkspaceIsDirty,
  artDirectionWorkspaceIssues,
  artDirectionWorkspaceReducer,
  createArtDirectionWorkspace,
  replaceArtPresetCommand,
  replaceSelectedArtRuleCommand,
  selectedArtDirectionRule,
} from "../src/art-workspace.js";
import { studioProject } from "../src/fixture.js";

const id = <T extends string>(value: string): Id<T> => value as Id<T>;

const createWorkspace = () =>
  createArtDirectionWorkspace(
    studioProject,
    studioCompiledArtEvidence,
    studioArtDirectionManifest,
    studioArtVisualEvidence,
  );

describe("art direction workspace", () => {
  it("loads a clean proof-level compiled baseline", () => {
    const state = createWorkspace();

    expect(artDirectionWorkspaceIssues(state)).toEqual([]);
    expect(artDirectionIssuesForAsset(state, id<"asset">("asset.actor.detective"))).toEqual([]);
  });

  it("selects assets without changing the document", () => {
    const initial = createWorkspace();
    const next = artDirectionWorkspaceReducer(initial, {
      type: "select-asset",
      assetId: id<"asset">("asset.actor.detective"),
    });

    expect(selectedArtDirectionRule(next)).toMatchObject({
      assetId: "asset.actor.detective",
      role: "actor",
    });
    expect(next.history).toBe(initial.history);
  });

  it("updates asset colour budgets with undo and redo", () => {
    let state = createWorkspace();
    const selected = selectedArtDirectionRule(state);

    state = artDirectionWorkspaceReducer(state, {
      type: "execute",
      command: replaceSelectedArtRuleCommand(state, {
        ...selected,
        maxColours: 64,
      }),
    });

    expect(artDirectionWorkspaceIsDirty(state)).toBe(true);
    expect(artDirectionWorkspaceIssues(state).map((issue) => issue.code)).toContain(
      "compiled-colour-budget-exceeded",
    );

    state = artDirectionWorkspaceReducer(state, { type: "undo" });
    expect(selectedArtDirectionRule(state).maxColours).toBeUndefined();
    expect(artDirectionWorkspaceIssues(state)).toEqual([]);
    expect(artDirectionWorkspaceIsDirty(state)).toBe(false);

    state = artDirectionWorkspaceReducer(state, { type: "redo" });
    expect(selectedArtDirectionRule(state).maxColours).toBe(64);
  });

  it("switches between compatible native-size era presets", () => {
    let state = createWorkspace();
    state = artDirectionWorkspaceReducer(state, {
      type: "execute",
      command: replaceArtPresetCommand(state, "ega-16-320x200"),
    });

    expect(state.history.document.manifest.profile).toMatchObject({
      preset: "ega-16-320x200",
      palette: { maxColours: 16 },
    });
    expect(artDirectionWorkspaceIssues(state).map((issue) => issue.code)).toEqual(
      expect.arrayContaining(["compiled-colour-budget-exceeded", "visual-evidence-colour-budget-exceeded"]),
    );
  });

  it("marks the art-direction document saved", () => {
    let state = createWorkspace();
    const selected = selectedArtDirectionRule(state);
    state = artDirectionWorkspaceReducer(state, {
      type: "execute",
      command: replaceSelectedArtRuleCommand(state, {
        ...selected,
        notes: "Keep office shadows in the shared cool range.",
      }),
    });
    expect(artDirectionWorkspaceIsDirty(state)).toBe(true);

    state = artDirectionWorkspaceReducer(state, { type: "mark-saved" });
    expect(artDirectionWorkspaceIsDirty(state)).toBe(false);
  });
});
