import { describe, expect, it } from "vitest";
import {
  coldMeridianInvestigation,
  coldMeridianInvestigationBindings,
  coldMeridianMultiProtagonist,
  coldMeridianMultiProtagonistBindings,
  coldMeridianProject,
  coldMeridianRoomScripts,
  coldMeridianRouteTopology,
  coldMeridianSpecializedModes,
  evaluateColdMeridianPackagedReadiness,
  validateColdMeridianRuntimeSource,
} from "../src/cold-meridian-runtime-source.js";

describe("Cold Meridian packaged authored source", () => {
  it("packages two protagonists with independent starting locations", () => {
    expect(validateColdMeridianRuntimeSource()).toEqual({ valid: true, issues: [] });
    expect(coldMeridianMultiProtagonist.activeProtagonistId).toBe("actor.cold-meridian.mara");
    expect(coldMeridianMultiProtagonist.protagonists).toEqual([
      expect.objectContaining({
        protagonistId: "actor.cold-meridian.mara",
        startSceneId: "scene.cold-meridian.observatory",
      }),
      expect.objectContaining({
        protagonistId: "actor.cold-meridian.ivo",
        startSceneId: "scene.cold-meridian.harbor",
      }),
    ]);
  });

  it("keeps observations private until explicit share interactions publish them", () => {
    expect(coldMeridianMultiProtagonistBindings.bindings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          source: {
            kind: "interaction-consumed",
            interactionId: "interaction.cold-meridian.mara-read-badge",
          },
          effects: [
            expect.objectContaining({
              kind: "set-protagonist-flag",
              protagonistId: "actor.cold-meridian.mara",
              flag: "knows-badge",
            }),
          ],
        }),
        expect.objectContaining({
          source: {
            kind: "interaction-consumed",
            interactionId: "interaction.cold-meridian.mara-share-badge",
          },
          effects: [
            { kind: "add-shared-fact", factId: "fact.signal.badge-number" },
          ],
        }),
        expect.objectContaining({
          source: {
            kind: "interaction-consumed",
            interactionId: "interaction.cold-meridian.ivo-share-offset",
          },
          effects: [
            { kind: "add-shared-fact", factId: "fact.signal.prediction-offset" },
          ],
        }),
      ]),
    );
    expect(coldMeridianInvestigation.facts.map((fact) => fact.id)).toEqual(
      expect.arrayContaining([
        "fact.signal.badge-number",
        "fact.signal.prediction-offset",
        "fact.late-arrival.secondary-vehicle",
      ]),
    );
    expect(coldMeridianInvestigationBindings.interactions.map((binding) => binding.interactionId)).toEqual(
      expect.arrayContaining([
        "interaction.cold-meridian.mara-share-badge",
        "interaction.cold-meridian.ivo-share-offset",
      ]),
    );
  });

  it("models a wrong inference as a recoverable changed-evidence route", () => {
    expect(coldMeridianRouteTopology.routes.map((route) => route.id)).toEqual([
      "route.cold-meridian.direct",
      "route.cold-meridian.delayed",
    ]);
    expect(coldMeridianRouteTopology.requiredReconvergenceNodeId).toBe(
      "route-node.cold-meridian.primary-relay",
    );
    expect(coldMeridianRouteTopology.edges).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: "route-edge.cold-meridian.delayed",
          toNodeId: "route-node.cold-meridian.late-relay",
        }),
        expect.objectContaining({
          id: "route-edge.cold-meridian.recover",
          fromNodeId: "route-node.cold-meridian.late-relay",
          toNodeId: "route-node.cold-meridian.primary-relay",
        }),
      ]),
    );
    const lateScene = coldMeridianProject.scenes.find(
      (scene) => scene.id === "scene.cold-meridian.late-relay",
    );
    expect(
      lateScene?.hotspots.flatMap((hotspot) => hotspot.interactions).map((interaction) => interaction.id),
    ).toContain("interaction.cold-meridian.observe-secondary-vehicle");
  });

  it("uses the existing room-script and specialized-mode systems for the cinematic/action phases", () => {
    expect(coldMeridianRoomScripts.scripts).toEqual([
      expect.objectContaining({
        trigger: {
          kind: "interaction-consumed",
          interactionId: "interaction.cold-meridian.compare-recordings",
        },
        cutaway: expect.objectContaining({
          sceneId: "scene.cold-meridian.cutaway",
          sequenceId: "sequence.cold-meridian.remote-relay",
          returnToPreviousLocation: true,
        }),
      }),
    ]);
    expect(coldMeridianSpecializedModes.modes).toEqual([
      expect.objectContaining({
        id: "specialized-mode.cold-meridian.intervention",
        kind: "action",
        trigger: {
          kind: "interaction-consumed",
          interactionId: "interaction.cold-meridian.start-intervention",
        },
        return: { kind: "previous-location" },
        startStateId: "stabilise",
      }),
    ]);
  });

  it("stays authored-ready while requiring evidence from both routes, switching and failure/retry", () => {
    expect(evaluateColdMeridianPackagedReadiness()).toMatchObject({
      authoredReady: true,
      packagedPlayableReady: false,
    });
    expect(
      evaluateColdMeridianPackagedReadiness({
        compiledBundleReady: true,
        directRouteReplayReady: true,
        delayedRouteReplayReady: true,
        actionFailureRetryReplayReady: true,
        protagonistSwitchReplayReady: true,
      }),
    ).toEqual({ authoredReady: true, packagedPlayableReady: true, issues: [] });
  });
});
