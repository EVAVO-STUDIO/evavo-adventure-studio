import { describe, expect, it } from "vitest";
import {
  createExpandedNinthReliquaryProductionPlan,
  ninthReliquaryCompleteAssetSpecs,
  ninthReliquaryExpandedAssetSpecs,
} from "../src/ninth-reliquary-expanded-production.js";

const authorities = Object.fromEntries(
  ninthReliquaryCompleteAssetSpecs.map((spec) => [
    spec.assetId,
    {
      sourceRevisionDigest: `sha256:source:${spec.assetId}`,
      styleDigest: "sha256:style",
      paletteDigest: "sha256:palette",
      environmentLayoutDigest: "sha256:layout",
      modelSheetDigest: "sha256:model",
      xSheetDigest: "sha256:xsheet",
      referenceDigests: ["sha256:reference"],
    },
  ]),
);

describe("expanded Ninth Reliquary production plan", () => {
  it("covers archive, chapel, second protagonist, train, hospice, danger and finale production", () => {
    const ids = new Set(ninthReliquaryExpandedAssetSpecs.map((spec) => spec.assetId));
    expect(ids.size).toBe(ninthReliquaryExpandedAssetSpecs.length);
    expect(ids.has("asset.ninth-reliquary.archive.background")).toBe(true);
    expect(ids.has("asset.ninth-reliquary.chapel.background")).toBe(true);
    expect(ids.has("asset.ninth-reliquary.ivo.model-sheet")).toBe(true);
    expect(ids.has("asset.ninth-reliquary.train.background")).toBe(true);
    expect(ids.has("asset.ninth-reliquary.hospice.background")).toBe(true);
    expect(ids.has("asset.ninth-reliquary.tunnel-action")).toBe(true);
    expect(ids.has("asset.ninth-reliquary.final-confrontation")).toBe(true);
  });

  it("produces one unique governed work order for every complete creative asset", () => {
    const plan = createExpandedNinthReliquaryProductionPlan(authorities);
    expect(plan).toHaveLength(ninthReliquaryCompleteAssetSpecs.length);
    expect(new Set(plan.map((order) => order.assetId)).size).toBe(plan.length);
    expect(new Set(plan.map((order) => order.workOrderId)).size).toBe(plan.length);
    expect(plan.every((order) => order.authorities.profileId === "cinematic-handdrawn-conspiracy")).toBe(true);
  });

  it("routes environment work to Art Studio and authored motion to Cel Animation Studio", () => {
    const plan = createExpandedNinthReliquaryProductionPlan(authorities);
    expect(plan.find((order) => order.assetId === "asset.ninth-reliquary.train.background")?.destinationStudio).toBe("art-studio");
    expect(plan.find((order) => order.assetId === "asset.ninth-reliquary.ivo.walk-east")?.destinationStudio).toBe("cel-animation-studio");
    expect(plan.find((order) => order.assetId === "asset.ninth-reliquary.chapel.foreground")?.alphaPolicy).toBe("required");
  });
});
