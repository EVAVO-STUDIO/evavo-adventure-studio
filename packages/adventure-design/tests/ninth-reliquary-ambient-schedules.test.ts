import { runtimeRoomScriptManifestSchema } from "@evavo/adventure-runtime-bundle";
import { describe, expect, it } from "vitest";
import {
  createNinthReliquaryAmbientRoomScripts,
  ninthReliquaryAmbientSchedules,
} from "../src/ninth-reliquary-ambient-schedules.js";

const sceneIdByProofSceneId = Object.fromEntries(
  ninthReliquaryAmbientSchedules.map((schedule, index) => [
    schedule.proofSceneId,
    `scene.ninth-reliquary.ambient-${index + 1}`,
  ]),
);
const sequenceIdByKey = Object.fromEntries(
  ninthReliquaryAmbientSchedules.map((schedule, index) => [
    schedule.sequenceKey,
    `sequence.ninth-reliquary.ambient-${index + 1}`,
  ]),
);

describe("Ninth Reliquary ambient schedules", () => {
  it("uses sparse deterministic cycles rather than continuous random activity", () => {
    expect(ninthReliquaryAmbientSchedules).toHaveLength(5);
    expect(new Set(ninthReliquaryAmbientSchedules.map((schedule) => schedule.id)).size).toBe(5);
    for (const schedule of ninthReliquaryAmbientSchedules) {
      expect(schedule.intervalTicks).toBeGreaterThan(schedule.startTick);
      expect(schedule.intervalTicks).toBeGreaterThanOrEqual(600);
      expect(schedule.productionRules.length).toBeGreaterThanOrEqual(3);
    }
  });

  it("converts every schedule into a schema-valid cyclic room script", () => {
    const manifest = createNinthReliquaryAmbientRoomScripts(
      "project.ninth-reliquary",
      { sceneIdByProofSceneId, sequenceIdByKey },
    );
    const parsed = runtimeRoomScriptManifestSchema.parse(manifest);
    expect(parsed.scripts).toHaveLength(ninthReliquaryAmbientSchedules.length);
    expect(parsed.scripts.every((script) => script.trigger.kind === "room-tick-cycle")).toBe(true);
    expect(parsed.scripts.every((script) => script.once === false)).toBe(true);
  });

  it("fails closed when a production scene/sequence binding is missing", () => {
    const missing = { ...sequenceIdByKey };
    delete missing[ninthReliquaryAmbientSchedules[0]!.sequenceKey];
    expect(() =>
      createNinthReliquaryAmbientRoomScripts(
        "project.ninth-reliquary",
        { sceneIdByProofSceneId, sequenceIdByKey: missing },
      ),
    ).toThrow(/Missing runtime sequence binding/u);
  });
});
