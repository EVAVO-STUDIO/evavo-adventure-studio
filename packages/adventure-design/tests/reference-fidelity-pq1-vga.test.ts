import { describe, expect, it } from "vitest";
import { pq1VgaReferenceTitlePack } from "../src/reference-fidelity-pq1-vga.js";
import {
  adventureReferenceEngineDialectById,
  adventureReferenceTitlePackByTitleId,
} from "../src/reference-fidelity-presets.js";
import { validateAdventureReferenceTitlePack } from "../src/reference-fidelity-validation.js";

describe("Police Quest I VGA remake reference binding", () => {
  it("keeps the remake on the early Sierra SCI1 VGA dialect and early procedural profile", () => {
    const dialect = adventureReferenceEngineDialectById("sierra-sci1-vga");
    expect(dialect).toMatchObject({
      id: "sierra-sci1-vga",
      nativeSize: { width: 320, height: 200 },
      paletteMode: "indexed-8-bit",
    });
    expect(pq1VgaReferenceTitlePack.engineDialectId).toBe("sierra-sci1-vga");
    expect(pq1VgaReferenceTitlePack.engineDialectId).not.toBe("sierra-sci32-vga");
    expect(pq1VgaReferenceTitlePack.profileId).toBe("early-procedural-icon-vga");
    expect(pq1VgaReferenceTitlePack.profileId).not.toBe("procedural-investigation-vga");
  });

  it("validates as its own title pack with an original Night Shift proof", () => {
    expect(validateAdventureReferenceTitlePack(pq1VgaReferenceTitlePack)).toEqual([]);
    expect(adventureReferenceTitlePackByTitleId("police-quest-i-vga-remake")).toEqual(
      expect.objectContaining({
        profileId: "early-procedural-icon-vga",
        originalProof: expect.objectContaining({
          showcaseId: "showcase.night-shift",
          title: "Night Shift",
          originalAssetsOnly: true,
        }),
      }),
    );
  });

  it("requires early procedural/icon grammar without inheriting PQ4 case-management requirements", () => {
    const ids = new Set(pq1VgaReferenceTitlePack.capabilities.map((entry) => entry.id));
    for (const id of [
      "temporary-icon-bar",
      "narration-feedback",
      "score-counter",
      "death-restart-flow",
      "procedure-checks",
      "procedural-failure",
      "location-progression",
    ] as const) {
      expect(ids.has(id)).toBe(true);
    }
    expect(ids.has("evidence-chain")).toBe(false);
    expect(ids.has("case-state")).toBe(false);
    expect(ids.has("interrogation-flow")).toBe(false);
  });
});
