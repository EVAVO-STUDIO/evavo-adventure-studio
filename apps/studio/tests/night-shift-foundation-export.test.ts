import { describe, expect, it } from "vitest";
import {
  createNightShiftFoundationTechnicalArchive,
  nightShiftFoundationTechnicalArchiveFileName,
} from "../src/night-shift-foundation-export.js";

const text = (bytes: Uint8Array): string => new TextDecoder().decode(bytes);

describe("Night Shift Foundation technical archive", () => {
  it("is deterministic and contains palette/font/icons plus the non-runtime officer guide", () => {
    const first = createNightShiftFoundationTechnicalArchive();
    const second = createNightShiftFoundationTechnicalArchive();
    expect(first).toEqual(second);
    const decoded = text(first);
    expect(decoded).toContain("foundation-generated.json");
    expect(decoded).toContain("palettes/night-shift-actor-lighting.rgba");
    expect(decoded).toContain("art/night-shift/system-font.png");
    expect(decoded).toContain("indexed/night-shift/system-font.idx");
    expect(decoded).toContain("art/night-shift/ui-walk.png");
    expect(decoded).toContain("indexed/night-shift/ui-walk.idx");
    expect(decoded).toContain("art/night-shift/ui-look.png");
    expect(decoded).toContain("art/night-shift/ui-use.png");
    expect(decoded).toContain("art/night-shift/ui-talk.png");
    expect(decoded).toContain("guides/night-shift.officer-master-guide.png");
    expect(decoded).toContain("asset.night-shift.actor.officer");
    expect(decoded).toContain("stillRequiresAuthoredMaster");
  });

  it("keeps the archive name stable", () => {
    expect(nightShiftFoundationTechnicalArchiveFileName).toBe(
      "night-shift.foundation-technical-sources.zip",
    );
  });
});
