import { describe, expect, it } from "vitest";
import { nightShiftDirectorStaging } from "../src/night-shift-director-fixture.js";
import {
  sceneDirectorStagingFileName,
  serializeSceneDirectorStaging,
} from "../src/scene-director-export.js";

describe("Scene Director staging export", () => {
  it("serializes schema-valid staging with a trailing newline", () => {
    const serialized = serializeSceneDirectorStaging(nightShiftDirectorStaging);
    expect(serialized.endsWith("\n")).toBe(true);
    expect(JSON.parse(serialized)).toMatchObject({
      manifestVersion: 1,
      projectId: nightShiftDirectorStaging.projectId,
    });
  });

  it("uses a portable proof-specific staging filename", () => {
    expect(sceneDirectorStagingFileName("Night Shift / Proof")).toBe(
      "night-shift-proof.scene-staging.json",
    );
  });
});
