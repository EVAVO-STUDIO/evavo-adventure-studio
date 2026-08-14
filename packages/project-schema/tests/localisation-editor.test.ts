import { describe, expect, it } from "vitest";
import {
  LocalisationEditorCommandError,
  applyLocalisationEditorCommand,
  createLocalisationEditorHistory,
  executeLocalisationEditorCommand,
  isLocalisationEditorDocumentDirty,
  localisationEditorCommandSchema,
  localisationManifestSchema,
  markLocalisationEditorHistorySaved,
  redoLocalisationEditorCommand,
  undoLocalisationEditorCommand,
} from "../src/localisation.js";

const manifest = localisationManifestSchema.parse({
  manifestVersion: 1,
  projectId: "project.editor-localisation",
  sourceLocale: "en-AU",
  locales: [
    {
      locale: "fr-FR",
      label: "Français",
      status: "review",
      entries: [{ key: "project.title", text: "Le registre rouge" }],
    },
    {
      locale: "fr-CA",
      label: "Français canadien",
      status: "draft",
      fallbackLocale: "fr-FR",
      entries: [],
    },
  ],
});

describe("localisation editor commands", () => {
  it("applies text edits with exact inverses and canonical ordering", () => {
    const applied = applyLocalisationEditorCommand(manifest, {
      kind: "set-entry-text",
      locale: "fr-CA",
      key: "project.title",
      text: "Le grand livre rouge",
    });

    expect(applied.manifest.locales.map((locale) => locale.locale)).toEqual(["fr-CA", "fr-FR"]);
    expect(
      applied.manifest.locales[0]?.entries.find((entry) => entry.key === "project.title")?.text,
    ).toBe("Le grand livre rouge");

    const restored = applyLocalisationEditorCommand(applied.manifest, applied.inverse);
    expect(restored.manifest.locales[0]?.entries).toEqual([]);
  });

  it("keeps undo, redo and saved-state tracking deterministic", () => {
    const initial = createLocalisationEditorHistory(manifest);
    const edited = executeLocalisationEditorCommand(initial, {
      kind: "set-entry-text",
      locale: "fr-FR",
      key: "project.title",
      text: "Le livre rouge",
    });

    expect(isLocalisationEditorDocumentDirty(edited.document)).toBe(true);
    const undone = undoLocalisationEditorCommand(edited);
    expect(undone.document.manifest.locales.find((locale) => locale.locale === "fr-FR")?.entries[0]?.text).toBe(
      "Le registre rouge",
    );
    const redone = redoLocalisationEditorCommand(undone);
    expect(redone.document.manifest.locales.find((locale) => locale.locale === "fr-FR")?.entries[0]?.text).toBe(
      "Le livre rouge",
    );
    expect(isLocalisationEditorDocumentDirty(markLocalisationEditorHistorySaved(redone).document)).toBe(false);
  });

  it("protects source identity, duplicate targets and referenced fallbacks", () => {
    expect(() =>
      applyLocalisationEditorCommand(manifest, {
        kind: "insert-locale",
        locale: { locale: "fr-FR", status: "draft", entries: [] },
      }),
    ).toThrow(LocalisationEditorCommandError);

    expect(() =>
      applyLocalisationEditorCommand(manifest, {
        kind: "remove-locale",
        locale: "fr-FR",
      }),
    ).toThrow(/fallback for 'fr-CA'/);

    expect(() =>
      applyLocalisationEditorCommand(manifest, {
        kind: "insert-locale",
        locale: { locale: "en-AU", status: "draft", entries: [] },
      }),
    ).toThrow(/Source locale/);
  });

  it("parses automation-safe command payloads", () => {
    expect(
      localisationEditorCommandSchema.parse({
        kind: "batch",
        commands: [
          {
            kind: "set-entry-text",
            locale: "fr-FR",
            key: "project.title",
            text: "Le registre",
          },
        ],
      }),
    ).toMatchObject({ kind: "batch" });
  });
});