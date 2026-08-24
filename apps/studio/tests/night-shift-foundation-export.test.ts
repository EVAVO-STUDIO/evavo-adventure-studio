import { describe, expect, it } from "vitest";
import {
  createNightShiftFoundationTechnicalArchive,
  nightShiftFoundationTechnicalArchiveFileName,
} from "../src/night-shift-foundation-export.js";

const text = (bytes: Uint8Array): string => new TextDecoder().decode(bytes);

describe("Night Shift Foundation technical archive", () => {
  it("is deterministic and contains the generated palette/icon source set", () => {
    const first = createNightShiftFoundationTechnicalArchive();
    const second = createNightShiftFoundationTechnicalArchive();
    expect(first).toEqual(second);
    const decoded = text(first);
    expect(decoded).toContain("foundation-generated.json");
    expect(decoded).toContain("palettes/night-shift-actor-lighting.rgba");
    expect(decoded).toContain("art/night-shift/ui-walk.png");
    expect(decoded).toContain("indexed/night-shift/ui-walk.idx");
    expect(decoded).toContain("art/night-shift/ui-look.png");
    expect(decoded).toContain("art/night-shift/ui-use.png");
    expect(decoded).toContain("art/night-shift/ui-talk.png");
  });

  it("keeps the archive name stable", () => {
    expect(nightShiftFoundationTechnicalArchiveFileName).toBe(
      "night-shift.foundation-technical-sources.zip",
    );
  });
});
