import { describe, expect, it } from "vitest";
import {
  builtInRuntimeDemoBundlePath,
  builtInRuntimeDemos,
  requestedRuntimeBundleFromSearch,
} from "../src/built-in-demos.js";

const redLedgerRequest =
  "/demos/the-red-ledger/runtime.bundle.json#frontEnd=front-end.json&lifecycle=lifecycle.json";

describe("built-in runtime demos", () => {
  it("maps the Red Ledger route to its bundle and governed presentation sidecars", () => {
    expect(builtInRuntimeDemos["red-ledger"]).toEqual({
      bundlePath: "/demos/the-red-ledger/runtime.bundle.json",
      frontEndPath: "front-end.json",
      lifecyclePath: "lifecycle.json",
    });
    expect(builtInRuntimeDemoBundlePath("red-ledger")).toBe(redLedgerRequest);
    expect(requestedRuntimeBundleFromSearch("?demo=red-ledger")).toBe(redLedgerRequest);
  });

  it("keeps an explicit bundle URL authoritative", () => {
    expect(
      requestedRuntimeBundleFromSearch("?demo=red-ledger&bundle=%2Ffixtures%2Fcustom.runtime.json"),
    ).toBe("/fixtures/custom.runtime.json");
  });

  it("allows explicit bundle URLs to carry their own presentation sidecars", () => {
    expect(
      requestedRuntimeBundleFromSearch(
        "?bundle=https%3A%2F%2Fexample.test%2Fgame.bundle.json%23" +
          "frontEnd%3Dmenu.json%26lifecycle%3Dending.json",
      ),
    ).toBe("https://example.test/game.bundle.json#frontEnd=menu.json&lifecycle=ending.json");
  });

  it("falls back to the rendering lab for unknown or empty routes", () => {
    expect(requestedRuntimeBundleFromSearch("?demo=missing")).toBeNull();
    expect(requestedRuntimeBundleFromSearch("?bundle=%20%20")).toBeNull();
  });
});
