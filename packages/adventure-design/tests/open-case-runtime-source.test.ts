import { describe, expect, it } from "vitest";
import {
  openCaseInvestigationBindings,
  openCaseProject,
  openCaseRoomScripts,
  openCaseRuntimeInvestigation,
  validateOpenCaseRuntimeSource,
} from "../src/open-case-runtime-source.js";
import { evaluateOpenCasePackagedReadiness } from "../src/open-case-runtime-readiness.js";

const interactionIds = () =>
  openCaseProject.scenes.flatMap((scene) =>
    scene.hotspots.flatMap((hotspot) => hotspot.interactions.map((interaction) => interaction.id)),
  );

describe("Open Case packaged authored source", () => {
  it("is structurally authored around real project interactions rather than proof-only state", () => {
    expect(validateOpenCaseRuntimeSource()).toEqual({ valid: true, issues: [] });
    expect(openCaseProject.scenes.map((scene) => scene.id)).toEqual([
      "scene.open-case.intake",
      "scene.open-case.apartment",
      "scene.open-case.custody",
      "scene.open-case.interview",
      "scene.open-case.caseboard",
      "scene.open-case.hearing",
    ]);
    expect(interactionIds()).toEqual(
      expect.arrayContaining([
        "interaction.open-case.sign-entry-log",
        "interaction.open-case.observe-fragment",
        "interaction.open-case.photograph-fragment",
        "interaction.open-case.collect-fragment",
        "interaction.open-case.bag-fragment",
        "interaction.open-case.log-custody",
        "interaction.open-case.read-lab-report",
        "interaction.open-case.start-witness-dialogue",
        "interaction.open-case.review-caseboard",
      ]),
    );
  });

  it("binds one-shot project interactions and dialogue choices to the investigation graph", () => {
    const boundInteractions = openCaseInvestigationBindings.interactions.map(
      (binding) => binding.interactionId,
    );
    expect(boundInteractions).toEqual(
      expect.arrayContaining([
        "interaction.open-case.observe-fragment",
        "interaction.open-case.log-custody",
        "interaction.open-case.read-lab-report",
        "interaction.open-case.review-caseboard",
      ]),
    );
    expect(openCaseInvestigationBindings.dialogueChoices).toEqual([
      expect.objectContaining({ choiceId: "dialogue-choice.open-case.window-condition" }),
    ]);
    expect(openCaseRuntimeInvestigation.facts.map((fact) => fact.id)).toEqual(
      expect.arrayContaining([
        "fact.open-case.fragment-position",
        "fact.open-case.custody-logged",
        "fact.open-case.lab-window-match",
        "fact.open-case.witness-contradiction",
        "fact.open-case.location-justified",
      ]),
    );
  });

  it("uses the caseboard interaction to trigger the authored hearing cutaway", () => {
    expect(openCaseRoomScripts.scripts).toEqual([
      expect.objectContaining({
        id: "room-script.open-case.hearing-cutaway",
        trigger: {
          kind: "interaction-consumed",
          interactionId: "interaction.open-case.review-caseboard",
        },
        cutaway: expect.objectContaining({
          sceneId: "scene.open-case.hearing",
          entranceId: "entrance.open-case.hearing",
          sequenceId: "sequence.open-case.hearing-cutaway",
          returnToPreviousLocation: true,
        }),
      }),
    ]);
  });

  it("reports authored-ready before claiming packaged-playable evidence exists", () => {
    const authored = evaluateOpenCasePackagedReadiness();
    expect(authored.authoredReady).toBe(true);
    expect(authored.packagedPlayableReady).toBe(false);
    expect(authored.issues.map((issue) => issue.code)).toEqual(
      expect.arrayContaining([
        "compiled-bundle-missing",
        "success-replay-missing",
        "failure-replay-missing",
        "native-screenshots-missing",
      ]),
    );

    const fullyEvidenceBacked = evaluateOpenCasePackagedReadiness({
      compiledBundleReady: true,
      successReplayReady: true,
      failureReplayReady: true,
      nativeScreenshotsReady: true,
    });
    expect(fullyEvidenceBacked).toMatchObject({
      authoredReady: true,
      packagedPlayableReady: true,
      issues: [],
    });
  });
});
