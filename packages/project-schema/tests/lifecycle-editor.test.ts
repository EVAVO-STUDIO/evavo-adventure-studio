import { describe, expect, it } from "vitest";
import {
  createDefaultFailureLifecycleMenu,
  parseGameLifecycleManifest,
} from "../src/lifecycle.js";
import {
  applyGameLifecycleEditorCommand,
  createGameLifecycleEditorHistory,
  executeGameLifecycleEditorCommand,
  isGameLifecycleEditorDirty,
  markGameLifecycleEditorSaved,
  parseGameLifecycleEditorCommand,
  redoGameLifecycleEditorCommand,
  undoGameLifecycleEditorCommand,
} from "../src/lifecycle-editor.js";

const manifest = () =>
  parseGameLifecycleManifest({
    manifestVersion: 1,
    projectId: "project.lifecycle-editor",
    outcomes: [
      {
        id: "outcome.failure",
        kind: "failure",
        priority: 10,
        when: { kind: "flag", flag: "case.failed", equals: true },
        title: "Case Closed",
        message: "The trail ends here.",
        menu: createDefaultFailureLifecycleMenu(),
      },
      {
        id: "outcome.success",
        kind: "success",
        priority: 5,
        when: { kind: "flag", flag: "case.solved", equals: true },
        title: "Case Solved",
        message: "The ledger can finally be closed.",
        menu: createDefaultFailureLifecycleMenu(),
      },
    ],
  });

describe("game lifecycle editor", () => {
  it("applies replace commands with exact inverses", () => {
    const source = manifest();
    const previous = source.outcomes[0]!;
    const next = { ...previous, title: "No Way Back", priority: 50 };
    const applied = applyGameLifecycleEditorCommand(source, {
      kind: "replace-outcome",
      outcomeId: previous.id,
      outcome: next,
    });
    expect(applied.manifest.outcomes[0]).toMatchObject({ title: "No Way Back", priority: 50 });
    expect(applyGameLifecycleEditorCommand(applied.manifest, applied.inverse).manifest).toEqual(source);
  });

  it("supports insertion, removal, undo, redo and dirty markers", () => {
    let history = createGameLifecycleEditorHistory(manifest());
    history = executeGameLifecycleEditorCommand(history, {
      kind: "insert-outcome",
      index: 1,
      outcome: {
        id: "outcome.arrested",
        kind: "failure",
        priority: 20,
        when: { kind: "variable", variable: "heat", operator: "gte", value: 5 },
        title: "Arrested",
        message: "The police close the case for you.",
        menu: createDefaultFailureLifecycleMenu(),
      },
    });
    expect(history.manifest.outcomes).toHaveLength(3);
    expect(isGameLifecycleEditorDirty(history)).toBe(true);
    history = undoGameLifecycleEditorCommand(history);
    expect(history.manifest.outcomes).toHaveLength(2);
    history = redoGameLifecycleEditorCommand(history);
    expect(history.manifest.outcomes).toHaveLength(3);
    history = markGameLifecycleEditorSaved(history);
    expect(isGameLifecycleEditorDirty(history)).toBe(false);
  });

  it("protects project identity, outcome identity and the final outcome", () => {
    const source = manifest();
    expect(() =>
      applyGameLifecycleEditorCommand(source, {
        kind: "replace-manifest",
        manifest: { ...source, projectId: "project.other" as typeof source.projectId },
      }),
    ).toThrow(/cannot change project/u);

    expect(() =>
      applyGameLifecycleEditorCommand(source, {
        kind: "replace-outcome",
        outcomeId: "outcome.failure",
        outcome: { ...source.outcomes[0]!, id: "outcome.renamed" },
      }),
    ).toThrow(/cannot change outcome ID/u);

    const one = parseGameLifecycleManifest({ ...source, outcomes: [source.outcomes[0]] });
    expect(() =>
      applyGameLifecycleEditorCommand(one, {
        kind: "remove-outcome",
        outcomeId: "outcome.failure",
      }),
    ).toThrow(/retain at least one/u);
  });

  it("parses automation-safe command documents", () => {
    expect(
      parseGameLifecycleEditorCommand({
        kind: "replace-outcome",
        outcomeId: "outcome.failure",
        outcome: manifest().outcomes[0],
      }),
    ).toMatchObject({ kind: "replace-outcome", outcomeId: "outcome.failure" });
    expect(() => parseGameLifecycleEditorCommand({ kind: "remove-outcome" })).toThrow();
  });
});