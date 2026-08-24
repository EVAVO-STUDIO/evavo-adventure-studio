import type { RuntimeMultiProtagonistBindingManifest } from "@evavo/adventure-runtime-bundle";
import { describe, expect, it } from "vitest";
import {
  attachRuntimeMultiProtagonistBindings,
  canonicaliseRuntimeMultiProtagonistBindingManifest,
} from "../src/with-multi-protagonist-bindings.js";

const manifest = (): RuntimeMultiProtagonistBindingManifest => ({
  manifestVersion: 1,
  projectId: "project.cross-time" as never,
  bindings: [
    {
      id: "multi-binding.z",
      source: { kind: "interaction-consumed", interactionId: "interaction.z" as never },
      effects: [{ kind: "set-shared-flag", flag: "z", value: true }],
    },
    {
      id: "multi-binding.a",
      source: { kind: "interaction-consumed", interactionId: "interaction.a" as never },
      effects: [{ kind: "set-shared-flag", flag: "a", value: true }],
    },
  ],
});

describe("cross-protagonist binding compiler attachment", () => {
  it("canonicalises binding order deterministically", () => {
    const first = canonicaliseRuntimeMultiProtagonistBindingManifest(manifest());
    const reversed = manifest();
    const second = canonicaliseRuntimeMultiProtagonistBindingManifest({
      ...reversed,
      bindings: [...reversed.bindings].reverse(),
    });
    expect(second).toEqual(first);
    expect(first.bindings.map((binding) => binding.id)).toEqual([
      "multi-binding.a",
      "multi-binding.z",
    ]);
  });

  it("rejects project mismatch before bundle parsing", () => {
    const compiled = {
      bundle: { projectId: "project.other" },
      canonicalJson: "{}",
      fingerprint: "fnv1a64:0000000000000000",
      warnings: [],
    } as never;
    expect(() => attachRuntimeMultiProtagonistBindings(compiled, manifest())).toThrow(
      /does not match multi-protagonist-binding project/u,
    );
  });
});
