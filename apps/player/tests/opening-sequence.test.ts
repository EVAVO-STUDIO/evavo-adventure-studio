import type { ResolvedFrame } from "@evavo/adventure-render-contract";
import type { RuntimeBundle } from "@evavo/adventure-runtime-bundle";
import { describe, expect, it } from "vitest";
import {
  configuredOpeningSequenceId,
  frameWithoutInteractiveChrome,
  openingSequenceSkipped,
  requestedNewGameOpeningSequenceId,
} from "../src/opening-sequence.js";

describe("opening sequence player policy", () => {
  it("starts only for a fresh game and supports an explicit automation bypass", () => {
    const bundle = {
      opening: {
        manifestVersion: 1,
        projectId: "project.opening",
        newGameSequenceId: "sequence.opening",
      },
    } as Pick<RuntimeBundle, "opening">;

    expect(requestedNewGameOpeningSequenceId(bundle, "", false)).toBe(
      "sequence.opening",
    );
    expect(requestedNewGameOpeningSequenceId(bundle, "", true)).toBeNull();
    expect(configuredOpeningSequenceId(bundle, "")).toBe("sequence.opening");
    expect(requestedNewGameOpeningSequenceId(bundle, "?opening=skip", false)).toBeNull();
    expect(openingSequenceSkipped("?opening=off")).toBe(true);
    expect(openingSequenceSkipped("?opening=0")).toBe(true);
  });

  it("removes interface and cursor nodes while retaining the authored world frame", () => {
    const node = (id: string, layer: string) =>
      ({
        id,
        order: {
          layer,
          elevation: 0,
          baselineY: 0,
          zOffset: 0,
          stableId: id,
        },
      }) as ResolvedFrame["nodes"][number];
    const frame = {
      frameVersion: 1,
      tick: 0,
      canvas: { width: 320, height: 200, clearColor: [0, 0, 0, 255] },
      camera: {
        position: { x: 0, y: 0 },
        viewport: { width: 320, height: 200 },
        shakeOffset: { x: 0, y: 0 },
      },
      nodes: [
        node("background", "background"),
        node("actor", "world"),
        node("status", "interface"),
        node("cursor", "cursor"),
      ],
    } as unknown as ResolvedFrame;

    expect(frameWithoutInteractiveChrome(frame).nodes.map((entry) => entry.id)).toEqual([
      "background",
      "actor",
    ]);
  });
});
