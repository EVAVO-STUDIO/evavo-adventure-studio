import { readFileSync } from "node:fs";
import { parseRuntimeBundle } from "@evavo/adventure-runtime-bundle";
import { describe, expect, it } from "vitest";
import { compileProjectWithInstances } from "../../compiler/src/with-instances.ts";
import { attachRuntimePlayFeelProfile } from "../../compiler/src/with-play-feel.ts";
import {
  parseRedLedgerPlayableSliceSource,
  RED_LEDGER_PLAYABLE_SLICE_PROFILE_ID,
  RED_LEDGER_PLAYABLE_SLICE_PROJECT_ID,
} from "../src/red-ledger-runtime.ts";

const sourceUrl = new URL(
  "../../../apps/player/public/demos/the-red-ledger/source-manifests.json",
  import.meta.url,
);
const bundleUrl = new URL(
  "../../../apps/player/public/demos/the-red-ledger/runtime.bundle.json",
  import.meta.url,
);

const parseJson = (url) => JSON.parse(readFileSync(url, "utf8"));

const compileSlice = () => {
  const source = parseRedLedgerPlayableSliceSource(parseJson(sourceUrl));
  return attachRuntimePlayFeelProfile(
    compileProjectWithInstances(
      source.project,
      source.assetManifest,
      source.sceneInstances,
      source.bitmapFonts,
      source.uiSkins,
    ),
    RED_LEDGER_PLAYABLE_SLICE_PROFILE_ID,
  );
};

describe("Red Ledger canonical runtime source", () => {
  it("compiles to the exact checked-in player bundle", () => {
    const compiled = compileSlice();
    const checkedIn = parseRuntimeBundle(parseJson(bundleUrl));

    expect(compiled.bundle.projectId).toBe(RED_LEDGER_PLAYABLE_SLICE_PROJECT_ID);
    expect(compiled.warnings).toEqual([]);
    expect(compiled.bundle).toEqual(checkedIn);
  });

  it("is deterministic across independent compilations", () => {
    const first = compileSlice();
    const second = compileSlice();

    expect(second.fingerprint).toBe(first.fingerprint);
    expect(second.canonicalJson).toBe(first.canonicalJson);
  });
});
