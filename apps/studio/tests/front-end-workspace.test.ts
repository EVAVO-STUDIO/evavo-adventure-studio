import { describe, expect, it } from "vitest";
import { studioFrontEndManifest } from "../src/front-end-fixture.js";
import {
  createFrontEndWorkspace,
  frontEndWorkspaceIsDirty,
  frontEndWorkspaceManifest,
  frontEndWorkspaceReducer,
} from "../src/front-end-workspace.js";

describe("front-end workspace", () => {
  it("edits preview data with undo, redo and export state", () => {
    const initial = createFrontEndWorkspace(studioFrontEndManifest);
    const edited = frontEndWorkspaceReducer(initial, {
      type: "execute",
      command: { kind: "set-publisher-name", value: "NIGHT ARCHIVE" },
    });

    expect(frontEndWorkspaceManifest(edited).publisher.name).toBe("NIGHT ARCHIVE");
    expect(frontEndWorkspaceIsDirty(edited)).toBe(true);
    const undone = frontEndWorkspaceReducer(edited, { type: "undo" });
    expect(frontEndWorkspaceManifest(undone).publisher.name).toBe(studioFrontEndManifest.publisher.name);
    const redone = frontEndWorkspaceReducer(undone, { type: "redo" });
    expect(frontEndWorkspaceManifest(redone).publisher.name).toBe("NIGHT ARCHIVE");
    expect(frontEndWorkspaceIsDirty(frontEndWorkspaceReducer(redone, { type: "mark-saved" }))).toBe(
      false,
    );
  });

  it("switches native preview plates without touching the manifest", () => {
    const initial = createFrontEndWorkspace(studioFrontEndManifest);
    const credits = frontEndWorkspaceReducer(initial, { type: "set-preview", preview: "credits" });

    expect(credits.preview).toBe("credits");
    expect(frontEndWorkspaceManifest(credits)).toEqual(frontEndWorkspaceManifest(initial));
    expect(frontEndWorkspaceIsDirty(credits)).toBe(false);
  });

  it("supports batched game-front-end policy changes", () => {
    const initial = createFrontEndWorkspace(studioFrontEndManifest);
    const edited = frontEndWorkspaceReducer(initial, {
      type: "execute",
      command: {
        kind: "batch",
        commands: [
          { kind: "set-menu-visibility", field: "showContinue", value: false },
          { kind: "set-menu-visibility", field: "showLoad", value: false },
          { kind: "set-menu-label", label: "newGame", value: "BEGIN CASE" },
        ],
      },
    });
    const manifest = frontEndWorkspaceManifest(edited);

    expect(manifest.menu.showContinue).toBe(false);
    expect(manifest.menu.showLoad).toBe(false);
    expect(manifest.menu.labels.newGame).toBe("BEGIN CASE");
  });
});