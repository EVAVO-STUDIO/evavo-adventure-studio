import { describe, expect, it } from "vitest";
import {
  afterHoursProject,
  evaluateAfterHoursPackagedReadiness,
  validateAfterHoursRuntimeSource,
} from "../src/after-hours-runtime-source.js";

describe("After Hours packaged authored source", () => {
  it("packages social dialogue and service-route gameplay as real project content", () => {
    expect(validateAfterHoursRuntimeSource()).toEqual({ valid: true, issues: [] });
    expect(afterHoursProject.scenes.map((scene) => scene.id)).toEqual([
      "scene.after-hours.lounge",
      "scene.after-hours.host",
      "scene.after-hours.service",
      "scene.after-hours.penthouse",
    ]);
    const choices = afterHoursProject.dialogues.flatMap((dialogue) =>
      dialogue.nodes.flatMap((node) => node.choices.map((choice) => choice.id)),
    );
    expect(choices).toEqual(
      expect.arrayContaining([
        "dialogue-choice.after-hours.awkward-introduction",
        "dialogue-choice.after-hours.pay-tab",
        "dialogue-choice.after-hours.camera-favour",
        "dialogue-choice.after-hours.bluff-too-early",
        "dialogue-choice.after-hours.explain-receipt",
      ]),
    );
  });

  it("keeps social and service solutions distinct in the authored scene graph", () => {
    const host = afterHoursProject.scenes.find((scene) => scene.id === "scene.after-hours.host")!;
    const service = afterHoursProject.scenes.find((scene) => scene.id === "scene.after-hours.service")!;
    expect(
      host.hotspots.flatMap((hotspot) => hotspot.interactions).map((interaction) => interaction.id),
    ).toContain("interaction.after-hours.enter-social");
    expect(
      service.hotspots.flatMap((hotspot) => hotspot.interactions).map((interaction) => interaction.id),
    ).toContain("interaction.after-hours.enter-service");
  });

  it("does not claim packaged-playable until both route replays and embarrassment recovery are retained", () => {
    expect(evaluateAfterHoursPackagedReadiness()).toMatchObject({
      authoredReady: true,
      packagedPlayableReady: false,
    });
    expect(
      evaluateAfterHoursPackagedReadiness({
        compiledBundleReady: true,
        socialRouteReplayReady: true,
        serviceRouteReplayReady: true,
        embarrassmentReplayReady: true,
      }),
    ).toEqual({ authoredReady: true, packagedPlayableReady: true, issues: [] });
  });
});
