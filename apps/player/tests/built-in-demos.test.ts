import { describe, expect, it } from "vitest";
import {
  builtInRuntimeDemoBundlePath,
  builtInRuntimeDemos,
  requestedRuntimeBundleFromSearch,
} from "../src/built-in-demos.js";

describe("built-in runtime demos", () => {
  it("maps the Red Ledger route to its bundle and governed lifecycle sidecar", () => {
    expect(builtInRuntimeDemos["red-ledger"]).toEqual({
      bundlePath: "/demos/the-red-ledger/runtime.bundle.json",
      lifecyclePath: "lifecycle.json",
    });
    expect(builtInRuntimeDemoBundlePath("red-ledger")).toBe(
      "/demos/the-red-ledger/runtime.bundle.json#lifecycle=lifecycle.json",
    );
    expect(requestedRuntimeBundleFromSearch("?demo=red-ledger")).toBe(
      "/demos/the-red-ledger/runtime.bundle.json#lifecycle=lifecycle.json",
    );
  });

  it("keeps an explicit bundle URL authoritative", () => {
    expect(
      requestedRuntimeBundleFromSearch("?demo=red-ledger&bundle=%2Ffixtures%2Fcustom.runtime.json"),
    ).toBe("/fixtures/custom.runtime.json");
  });

  it("allows explicit bundle URLs to carry their own lifecycle sidecar", () => {
    expect(
      requestedRuntimeBundleFromSearch(
        "?bundle=https%3A%2F%2Fexample.test%2Fgame.bundle.json%23lifecycle%3Dending.json",
      ),
    ).toBe("https://example.test/game.bundle.json#lifecycle=ending.json");
  });

  it("falls back to the rendering lab for unknown or empty routes", () => {
    expect(requestedRuntimeBundleFromSearch("?demo=missing")).toBeNull();
    expect(requestedRuntimeBundleFromSearch("?bundle=%20%20")).toBeNull();
  });
});
