import { describe, expect, it } from "vitest";
import {
  studioBitmapFonts,
  studioFontProject,
  studioLocalisationManifest,
  studioLocalisationTextFitProfile,
} from "../src/localisation-fixture.js";
import {
  createLocalisationWorkspace,
  filteredLocalisationSources,
  insertLocalisationLocaleCommand,
  localisationWorkspaceIsDirty,
  localisationWorkspaceReducer,
  localisationWorkspaceReport,
  removeSelectedLocaleCommand,
  replaceSelectedTranslationCommand,
  selectedLocalisationText,
} from "../src/localisation-workspace.js";

const createState = () =>
  createLocalisationWorkspace(
    studioFontProject,
    studioLocalisationManifest,
    studioBitmapFonts,
    studioLocalisationTextFitProfile,
  );

describe("localisation workspace", () => {
  it("edits translation text with undo, redo and dirty tracking", () => {
    const initial = createState();
    const edited = localisationWorkspaceReducer(initial, {
      type: "execute",
      command: replaceSelectedTranslationCommand(initial, "Translated title"),
      notice: "Edited translation.",
    });

    expect(selectedLocalisationText(edited)).toBe("Translated title");
    expect(localisationWorkspaceIsDirty(edited)).toBe(true);

    const undone = localisationWorkspaceReducer(edited, { type: "undo" });
    expect(selectedLocalisationText(undone)).toBe(selectedLocalisationText(initial));

    const redone = localisationWorkspaceReducer(undone, { type: "redo" });
    expect(selectedLocalisationText(redone)).toBe("Translated title");

    const saved = localisationWorkspaceReducer(redone, { type: "mark-saved" });
    expect(localisationWorkspaceIsDirty(saved)).toBe(false);
  });

  it("adds a complete draft locale and keeps selection stable", () => {
    const initial = createState();
    const addition = insertLocalisationLocaleCommand(initial, "de-DE", "Deutsch");
    const added = localisationWorkspaceReducer(initial, {
      type: "execute",
      command: addition.command,
      selectedLocale: addition.locale,
    });

    expect(added.selectedLocale).toBe("de-DE");
    expect(added.history.document.manifest.locales.some((locale) => locale.locale === "de-DE")).toBe(true);
    expect(
      added.history.document.manifest.locales.find((locale) => locale.locale === "de-DE")?.entries.length,
    ).toBe(localisationWorkspaceReport(added).sourceEntries.length);
  });

  it("filters the catalogue by text and active findings", () => {
    let state = createState();
    state = localisationWorkspaceReducer(state, { type: "set-query", query: "project.title" });
    expect(filteredLocalisationSources(state).map((source) => source.key)).toEqual(["project.title"]);

    state = localisationWorkspaceReducer(state, { type: "set-query", query: "" });
    state = localisationWorkspaceReducer(state, { type: "set-findings-only", value: true });
    const findings = filteredLocalisationSources(state);
    expect(findings.length).toBeGreaterThan(0);
    expect(findings.length).toBeLessThanOrEqual(localisationWorkspaceReport(state).sourceEntries.length);
  });

  it("removes unreferenced locales and falls back to a valid selection", () => {
    const initial = createState();
    const pseudo = localisationWorkspaceReducer(initial, {
      type: "select-locale",
      locale: "qps-ploc",
    });
    const removed = localisationWorkspaceReducer(pseudo, {
      type: "execute",
      command: removeSelectedLocaleCommand(pseudo),
    });

    expect(removed.history.document.manifest.locales.some((locale) => locale.locale === "qps-ploc")).toBe(false);
    expect(removed.history.document.manifest.locales.some((locale) => locale.locale === removed.selectedLocale)).toBe(true);
  });
});