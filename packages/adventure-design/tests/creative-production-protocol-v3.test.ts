import { describe, expect, it } from "vitest";
import {
  ADVENTURE_CREATIVE_HANDOFF_V3_PROTOCOL_FINGERPRINT,
  adventureCreativeHandoffV3Protocol,
  adventureCreativeHandoffV3ProtocolFingerprint,
} from "../src/creative-production-protocol-v3.js";

describe("creative handoff v3 protocol", () => {
  it("keeps cross-studio hard invariants on one stable fingerprint", () => {
    expect(adventureCreativeHandoffV3ProtocolFingerprint()).toBe(
      ADVENTURE_CREATIVE_HANDOFF_V3_PROTOCOL_FINGERPRINT,
    );
    expect(adventureCreativeHandoffV3Protocol.hardInvariants).toEqual(
      expect.arrayContaining([
        "checkerboard-forbidden",
        "targeted-repair-first",
        "animation-x-sheet-conformance-required",
        "delivery-artifact-digest-must-equal-accepted-candidate",
      ]),
    );
  });
});
