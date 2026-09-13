import { describe, expect, it } from "vitest";
import {
  canonicaliseGameLifecycleManifest,
  createDefaultFailureLifecycleMenu,
  parseGameLifecycleManifest,
} from "../src/lifecycle.js";

const outcome = (id: string, priority: number) => ({
  id,
  kind: "failure" as const,
  priority,
  when: { kind: "flag" as const, flag: id, equals: true },
  title: "Case Closed",
  message: "The investigation can no longer continue.",
  menu: createDefaultFailureLifecycleMenu(),
});

describe("game lifecycle manifest", () => {
  it("parses deterministic condition-driven outcomes", () => {
    const manifest = parseGameLifecycleManifest({
      manifestVersion: 1,
      projectId: "project.lifecycle",
      outcomes: [outcome("outcome.dead", 20)],
    });

    expect(manifest.outcomes[0]?.when).toEqual({
      kind: "flag",
      flag: "outcome.dead",
      equals: true,
    });
    expect(manifest.outcomes[0]?.menu.allowRestart).toBe(true);
  });

  it("rejects duplicate outcome IDs and menus without an unconditional exit", () => {
    expect(() =>
      parseGameLifecycleManifest({
        manifestVersion: 1,
        projectId: "project.lifecycle",
        outcomes: [outcome("duplicate", 1), outcome("duplicate", 2)],
      }),
    ).toThrow();

    expect(() =>
      parseGameLifecycleManifest({
        manifestVersion: 1,
        projectId: "project.lifecycle",
        outcomes: [
          {
            ...outcome("trapped", 1),
            menu: {
              ...createDefaultFailureLifecycleMenu(),
              allowRestart: false,
              allowTitle: false,
            },
          },
        ],
      }),
    ).toThrow();
  });

  it("canonicalises by priority then stable ID", () => {
    const manifest = parseGameLifecycleManifest({
      manifestVersion: 1,
      projectId: "project.lifecycle",
      outcomes: [outcome("z-low", 1), outcome("z-high", 10), outcome("a-high", 10)],
    });

    expect(canonicaliseGameLifecycleManifest(manifest).outcomes.map((entry) => entry.id)).toEqual([
      "a-high",
      "z-high",
      "z-low",
    ]);
  });
});