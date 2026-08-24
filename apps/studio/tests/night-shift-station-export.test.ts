import { describe, expect, it } from "vitest";
import {
  createNightShiftStationHandoffArchive,
  nightShiftStationHandoffArchiveFileName,
} from "../src/night-shift-station-export.js";

const text = (bytes: Uint8Array): string => new TextDecoder().decode(bytes);

describe("Night Shift Station handoff archive", () => {
  it("is deterministic and contains the packet plus non-runtime composition guide", () => {
    const first = createNightShiftStationHandoffArchive();
    const second = createNightShiftStationHandoffArchive();
    expect(first).toEqual(second);
    const decoded = text(first);
    expect(decoded).toContain("station-handoff.json");
    expect(decoded).toContain("night-shift.station-production-packet.json");
    expect(decoded).toContain("guides/night-shift.station-composition-guide.png");
    expect(decoded).toContain("production-reference only");
  });

  it("keeps a stable archive filename", () => {
    expect(nightShiftStationHandoffArchiveFileName).toBe(
      "night-shift.station-production-handoff.zip",
    );
  });
});
