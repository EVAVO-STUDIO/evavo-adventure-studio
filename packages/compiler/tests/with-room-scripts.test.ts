import type { RuntimeRoomScriptManifest } from "@evavo/adventure-runtime-bundle";
import { describe, expect, it } from "vitest";
import {
  attachRuntimeRoomScripts,
  canonicaliseRuntimeRoomScriptManifest,
} from "../src/with-room-scripts.js";

const manifest = (): RuntimeRoomScriptManifest => ({
  manifestVersion: 1,
  projectId: "project.room-script-compile" as never,
  scripts: [
    {
      id: "room-script.b",
      sceneId: "scene.room" as never,
      trigger: { kind: "after-room-ticks", ticks: 60 },
      once: false,
      actions: [{ kind: "set-flag", flag: "b", value: true }],
    },
    {
      id: "room-script.a",
      sceneId: "scene.room" as never,
      trigger: { kind: "scene-first-enter" },
      once: true,
      actions: [{ kind: "set-flag", flag: "a", value: true }],
    },
  ],
});

describe("room-script compiler attachment", () => {
  it("canonicalises script order deterministically", () => {
    const first = canonicaliseRuntimeRoomScriptManifest(manifest());
    const reversed = manifest();
    const second = canonicaliseRuntimeRoomScriptManifest({
      ...reversed,
      scripts: [...reversed.scripts].reverse(),
    });
    expect(second).toEqual(first);
    expect(first.scripts.map((script) => script.id)).toEqual(["room-script.a", "room-script.b"]);
  });

  it("rejects project mismatch before bundle parsing", () => {
    const compiled = {
      bundle: { projectId: "project.other" },
      canonicalJson: "{}",
      fingerprint: "fnv1a64:0000000000000000",
      warnings: [],
    } as never;
    expect(() => attachRuntimeRoomScripts(compiled, manifest())).toThrow(/does not match room-script project/u);
  });
});
