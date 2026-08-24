import { describe, expect, it } from "vitest";
import { evaluateNightShiftDemoReadiness } from "../src/night-shift-demo-readiness.js";

describe("Night Shift demo readiness", () => {
  it("is authored-ready but not shippable without retained build evidence", () => {
    const report = evaluateNightShiftDemoReadiness();
    expect(report.authoredReady).toBe(true);
    expect(report.shippableReady).toBe(false);
    expect(
      report.gates.filter((gate) => gate.phase === "authored").every((gate) => gate.status === "ready"),
    ).toBe(true);
    expect(report.gates.filter((gate) => gate.phase === "evidence").map((gate) => gate.id)).toEqual(
      expect.arrayContaining([
        "art-master-intake",
        "officer-master-intake",
        "audio-master-intake",
        "compiled-assets",
        "indexed-assets",
        "period-vga",
        "packaged-bundle",
        "replay-evidence",
        "native-screenshots",
      ]),
    );
    expect(report.gates.find((gate) => gate.id === "officer-master-intake")?.status).toBe("blocked");
  });

  it("does not confuse a packaged flag alone with full shippable evidence", () => {
    const report = evaluateNightShiftDemoReadiness({
      packagedBundleReady: true,
      deterministicReplayCount: 2,
      nativeScreenshotCount: 6,
    });
    expect(report.gates.find((gate) => gate.id === "packaged-bundle")?.status).toBe("ready");
    expect(report.gates.find((gate) => gate.id === "replay-evidence")?.status).toBe("ready");
    expect(report.gates.find((gate) => gate.id === "native-screenshots")?.status).toBe("ready");
    expect(report.gates.find((gate) => gate.id === "officer-master-intake")?.status).toBe("blocked");
    expect(report.shippableReady).toBe(false);
  });
});
