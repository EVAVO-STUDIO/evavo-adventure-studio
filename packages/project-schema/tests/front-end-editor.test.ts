import { describe, expect, it } from "vitest";
import { idSchema } from "../src/index.js";
import { createDefaultClassicFrontEndManifest } from "../src/front-end.js";
import {
  classicFrontEndEditorCommandSchema,
  createClassicFrontEndEditorHistory,
  executeClassicFrontEndEditorCommand,
  isClassicFrontEndEditorDirty,
  markClassicFrontEndEditorSaved,
  redoClassicFrontEndEditorCommand,
  undoClassicFrontEndEditorCommand,
} from "../src/front-end-editor.js";

const manifest = createDefaultClassicFrontEndManifest(
  idSchema("project").parse("project.front-end-editor"),
);

describe("classic front-end editor", () => {
  it("edits manifest fields with exact undo and redo", () => {
    const initial = createClassicFrontEndEditorHistory(manifest);
    const edited = executeClassicFrontEndEditorCommand(initial, {
      kind: "set-publisher-name",
      value: "NIGHT ARCHIVE",
    });
    expect(edited.manifest.publisher.name).toBe("NIGHT ARCHIVE");
    expect(isClassicFrontEndEditorDirty(edited)).toBe(true);

    const undone = undoClassicFrontEndEditorCommand(edited);
    expect(undone.manifest.publisher.name).toBe("EVAVO");
    const redone = redoClassicFrontEndEditorCommand(undone);
    expect(redone.manifest.publisher.name).toBe("NIGHT ARCHIVE");
    expect(isClassicFrontEndEditorDirty(markClassicFrontEndEditorSaved(redone))).toBe(false);
  });

  it("applies batched menu policy edits atomically", () => {
    const edited = executeClassicFrontEndEditorCommand(createClassicFrontEndEditorHistory(manifest), {
      kind: "batch",
      commands: [
        { kind: "set-menu-label", label: "newGame", value: "BEGIN CASE" },
        { kind: "set-menu-visibility", field: "showContinue", value: false },
        { kind: "set-menu-visibility", field: "showLoad", value: false },
        { kind: "set-fullscreen", value: false },
      ],
    });

    expect(edited.manifest.menu.labels.newGame).toBe("BEGIN CASE");
    expect(edited.manifest.menu.showContinue).toBe(false);
    expect(edited.manifest.menu.showLoad).toBe(false);
    expect(edited.manifest.options.allowFullscreen).toBe(false);
    expect(undoClassicFrontEndEditorCommand(edited).manifest).toEqual(manifest);
  });

  it("rejects invalid timing through the canonical manifest schema", () => {
    expect(() =>
      executeClassicFrontEndEditorCommand(createClassicFrontEndEditorHistory(manifest), {
        kind: "set-splash-timing",
        durationTicks: 20,
        skipAfterTicks: 21,
      }),
    ).toThrow(/cannot exceed/i);
  });

  it("parses automation-safe command payloads", () => {
    expect(
      classicFrontEndEditorCommandSchema.parse({
        kind: "set-menu-label",
        label: "credits",
        value: "WHO MADE THIS",
      }),
    ).toEqual({ kind: "set-menu-label", label: "credits", value: "WHO MADE THIS" });
  });
});