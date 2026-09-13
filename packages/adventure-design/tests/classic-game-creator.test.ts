import { describe, expect, it } from "vitest";
import {
  ClassicAdventureCreatorReferenceError,
  classicAdventureCreatorFingerprint,
  classicAdventureCreatorHistoryIsDirty,
  classicAdventureCreatorProjectByFamily,
  classicAdventureCreatorProjects,
  createClassicAdventureCreatorHistory,
  executeClassicAdventureCreatorCommand,
  markClassicAdventureCreatorSaved,
  redoClassicAdventureCreatorCommand,
  undoClassicAdventureCreatorCommand,
  validateClassicAdventureCreatorProject,
} from "../src/classic-game-creator.js";

describe("classic adventure game creator", () => {
  it("ships three original, production-ready flagship creator projects", () => {
    expect(classicAdventureCreatorProjects.map((project) => project.family)).toEqual([
      "storybook-icon",
      "gothic-investigation",
      "verb-panel-comedy",
    ]);

    for (const project of classicAdventureCreatorProjects) {
      const report = validateClassicAdventureCreatorProject(project);
      expect(report.status).toBe("ready");
      expect(report.score).toBe(100);
      expect(report.metrics.sceneCount).toBe(4);
      expect(report.metrics.puzzleCount).toBeGreaterThan(0);
      expect(report.metrics.nativeReviewProofCount).toBeGreaterThanOrEqual(12);
    }
  });

  it("keeps executable creator data original", () => {
    const serialized = JSON.stringify(classicAdventureCreatorProjects).toLowerCase();
    for (const protectedName of [
      "gabriel knight",
      "king's quest",
      "monkey island",
      "sierra",
      "lucasarts",
      "dynamix",
    ]) {
      expect(serialized).not.toContain(protectedName);
    }
  });

  it("executes native scene edits with deterministic undo and redo", () => {
    const source = classicAdventureCreatorProjectByFamily("gothic-investigation");
    const scene = source.scenes.find((candidate) => candidate.id.endsWith(".gameplay"));
    const actor = scene?.actors[0];
    if (!scene || !actor) throw new Error("Expected gameplay actor.");

    const initial = createClassicAdventureCreatorHistory(source);
    const moved = executeClassicAdventureCreatorCommand(initial, {
      kind: "move-actor",
      sceneId: scene.id,
      actorId: actor.id,
      position: { x: actor.position.x + 4, y: actor.position.y - 2 },
    });

    expect(classicAdventureCreatorHistoryIsDirty(moved)).toBe(true);
    expect(
      moved.present.scenes
        .find((candidate) => candidate.id === scene.id)
        ?.actors.find((candidate) => candidate.id === actor.id)?.position,
    ).toEqual({ x: actor.position.x + 4, y: actor.position.y - 2 });

    const undone = undoClassicAdventureCreatorCommand(moved);
    expect(undone.present).toEqual(source);

    const redone = redoClassicAdventureCreatorCommand(undone);
    expect(redone.present).toEqual(moved.present);

    const saved = markClassicAdventureCreatorSaved(redone);
    expect(classicAdventureCreatorHistoryIsDirty(saved)).toBe(false);
  });

  it("protects puzzle and dialogue scene references", () => {
    const source = classicAdventureCreatorProjectByFamily("storybook-icon");
    const history = createClassicAdventureCreatorHistory(source);
    const gameplay = source.scenes.find((scene) => scene.id.endsWith(".gameplay"));
    if (!gameplay) throw new Error("Expected gameplay scene.");

    expect(() =>
      executeClassicAdventureCreatorCommand(history, {
        kind: "remove-scene",
        sceneId: gameplay.id,
      }),
    ).toThrow(ClassicAdventureCreatorReferenceError);
  });

  it("permits safe duplicated scene experiments", () => {
    const source = classicAdventureCreatorProjectByFamily("verb-panel-comedy");
    const title = source.scenes.find((scene) => scene.kind === "title");
    if (!title) throw new Error("Expected title scene.");

    const initial = createClassicAdventureCreatorHistory(source);
    const duplicated = executeClassicAdventureCreatorCommand(initial, {
      kind: "duplicate-scene",
      sceneId: title.id,
      newSceneId: "scene.creator.saltwake-island.title-alt",
      name: "Alternate title timing",
    });
    expect(duplicated.present.scenes).toHaveLength(5);

    const removed = executeClassicAdventureCreatorCommand(duplicated, {
      kind: "remove-scene",
      sceneId: "scene.creator.saltwake-island.title-alt",
    });
    expect(removed.present.scenes).toHaveLength(4);
  });

  it("preserves full-screen plates when persistent chrome changes", () => {
    const source = classicAdventureCreatorProjectByFamily("verb-panel-comedy");
    const history = createClassicAdventureCreatorHistory(source);
    const changed = executeClassicAdventureCreatorCommand(history, {
      kind: "set-interface-chrome",
      chromeHeight: 64,
    });
    const gameplay = changed.present.scenes.find((scene) => scene.kind === "gameplay");
    const dialogue = changed.present.scenes.find((scene) => scene.kind === "dialogue");
    const title = changed.present.scenes.find((scene) => scene.kind === "title");
    const system = changed.present.scenes.find((scene) => scene.kind === "system");

    expect(gameplay?.interfaceSafeRect.height).toBe(136);
    expect(dialogue?.interfaceSafeRect.height).toBe(136);
    expect(title?.interfaceSafeRect.height).toBe(200);
    expect(system?.interfaceSafeRect.height).toBe(200);
  });

  it("blocks incompatible interface and investigation authoring", () => {
    const source = classicAdventureCreatorProjectByFamily("gothic-investigation");
    const malformed = {
      ...source,
      interface: {
        ...source.interface,
        family: "persistent-verb-panel" as const,
        openBehaviour: "persistent" as const,
        chromeHeight: 56,
        gameplayViewportHeight: 144,
        sentenceLine: true,
        verbs: ["look"],
        inventorySlots: 1,
      },
      dialogues: source.dialogues.map((dialogue) => ({
        ...dialogue,
        topics: ["account date"],
      })),
    };
    const report = validateClassicAdventureCreatorProject(malformed);
    expect(report.status).toBe("blocked");
    expect(report.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: "invalid-interface" }),
        expect.objectContaining({
          code: "insufficient-investigation-topics",
        }),
      ]),
    );
  });

  it("detects native geometry drift", () => {
    const source = classicAdventureCreatorProjectByFamily("storybook-icon");
    const gameplayIndex = source.scenes.findIndex((scene) => scene.kind === "gameplay");
    const gameplay = source.scenes[gameplayIndex];
    const prop = gameplay?.props[0];
    if (!gameplay || !prop) throw new Error("Expected gameplay prop.");

    const malformed = {
      ...source,
      scenes: source.scenes.map((scene, index) =>
        index === gameplayIndex
          ? {
              ...scene,
              props: scene.props.map((candidate, propIndex) =>
                propIndex === 0
                  ? {
                      ...candidate,
                      position: { x: 319, y: candidate.position.y },
                    }
                  : candidate,
              ),
            }
          : scene,
      ),
    };
    const report = validateClassicAdventureCreatorProject(malformed);
    expect(report.issues).toEqual(
      expect.arrayContaining([expect.objectContaining({ code: "invalid-scene-geometry" })]),
    );
  });

  it("fingerprints equal projects identically", () => {
    const project = classicAdventureCreatorProjectByFamily("verb-panel-comedy");
    const clone = JSON.parse(JSON.stringify(project)) as typeof project;
    expect(classicAdventureCreatorFingerprint(clone)).toBe(classicAdventureCreatorFingerprint(project));
  });
});
