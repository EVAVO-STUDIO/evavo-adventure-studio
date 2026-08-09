import { describe, expect, it } from "vitest";
import { builtInRuntimeDemoBundlePath, requestedRuntimeBundleFromSearch } from "../src/built-in-demos.js";

describe("built-in runtime demos", () => {
  it("maps the Red Ledger route to its checked-in runtime bundle", () => {
    expect(builtInRuntimeDemoBundlePath("red-ledger")).toBe("/demos/the-red-ledger/runtime.bundle.json");
    expect(requestedRuntimeBundleFromSearch("?demo=red-ledger")).toBe(
      "/demos/the-red-ledger/runtime.bundle.json",
    );
  });

  it("keeps an explicit bundle URL authoritative", () => {
    expect(
      requestedRuntimeBundleFromSearch("?demo=red-ledger&bundle=%2Ffixtures%2Fcustom.runtime.json"),
    ).toBe("/fixtures/custom.runtime.json");
  });

  it("falls back to the rendering lab for unknown or empty routes", () => {
    expect(requestedRuntimeBundleFromSearch("?demo=missing")).toBeNull();
    expect(requestedRuntimeBundleFromSearch("?bundle=%20%20")).toBeNull();
  });
});
